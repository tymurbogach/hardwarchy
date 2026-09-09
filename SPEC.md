# SPEC — Modular HW Monitor v1 (clean-room behavior specification)

This document describes observable behavior only. Implementations must be
written from this spec without copying files from the previous codebase.
Behavioral compatibility (JSON fields, prefs keys, click actions) is
intentional; code expression must be original.

## 1. What it is

An Omarchy 4 (`omarchy-shell`, Quickshell) bar widget. One compact read-out
per hardware metric, each its own click target. A popout menu lists every
metric with live values and toggles, plus view/unit/alert settings.

- Plugin id: `io.github.tymurbogach.modular-hw-monitor`
- Entry point: `BarWidget.qml`, kind `bar-widget`, default section `right`.
- Language: English everywhere (code, UI, docs, commits).
- Dependencies at runtime: `bash` only. No lm_sensors, no vendor tools.

## 2. Collector (`scripts/sysread`)

Single executable bash script, `set -u`, no arguments beyond:

- `sysread` — one JSON line on stdout (CPU % measured over ~0.2 s).
- `sysread --loop --interval N` — one JSON line every N seconds.
- Env `MONITOR_HWMON_ROOT` overrides `/sys/class/hwmon` (tests).

Internals must be organized as provider functions (cpu, memory, hwmon
temperature, fans, gpu-nvidia, gpu-amd, gpu-intel, clocks, load). Sourcing
split files is allowed as long as the installed tree keeps working
(`scripts/` ships with the plugin).

### 2.1 JSON schema (v1)

All values numbers or `null`. Missing sensor ⇒ `null`, never a fake zero.

```
{
  "schema": 1,
  "cpu": 12,            // % across all threads, delta of /proc/stat
  "temp": 45,           // °C, preferred CPU package sensor else hottest sane
  "mem": 16,            // % used from MemTotal/MemAvailable
  "gpu": 23,            // % or null (best effort, unprivileged)
  "gpu_temp": 61,       // °C or null
  "fans": [             // every readable fan
    {"id": "thinkpad/fan1", "chip": "thinkpad", "label": "fan1", "rpm": 2262}
  ],
  "cpu_mhz": 3200, "gpu_mhz": 1500,           // mean clocks, MHz or null
  "mem_used_kib": 9500000, "mem_total_kib": 64000000,
  "swap_used_kib": 0, "swap_total_kib": 8000000,
  "cpu_model": "AMD Ryzen 7 ...", "cpu_cores": 16,
  "load": {"one": 0.42, "five": 0.50, "fifteen": 0.55},
  "gpu_detail": {"vram_used_b": N, "vram_total_b": N, "watts": 45.0}
}
```

- `gpu_detail` is `null` unless at least one subfield answered.
- Fan `id` is `chip/fanN` (stable across reboots/reorders). Label defaults
  to `Fan N` when the node carries none.
- CPU temperature: prefer AMD `Tctl`/`Tdie` (`k10temp`/`zenpower`) and Intel
  `Package id ...` (`coretemp`); else the hottest reading in (0, 150).
- GPU sources, picked once at startup: `nvidia-smi` if present and answering;
  else amdgpu `gpu_busy_percent`; else summed Intel drm `busy_time` deltas
  over wall-clock × engine count. Percentage functions prime on first call
  and report `null` (never a wrong 0).
- NVIDIA detail (utilization, temp, clocks, VRAM MiB, power) comes from ONE
  `nvidia-smi` call per reading. AMD VRAM/power from amdgpu sysfs.
- `cpu_model`/`cpu_cores` detected once (they cannot change).

## 3. Metric catalog (bar order default)

CPU usage → CPU temp → GPU usage → GPU temp → Memory usage → fans (as found).

- Keys on disk: `cpu_usage`, `cpu_temp`, `gpu_usage`, `gpu_temp`,
  `mem_usage`, `fan:<chip>/<fanN>`.
- Duplicate fan labels get ` (<chip>)` appended (only duplicates).
- Stopped fan (0 RPM): bar shows `0`, menu shows `stopped`, dimmed.
- Units: bar temp shows `46°` (letter dropped next to thermometer);
  menu/tooltip show `46 °C` / `115 °F`. Fans show bare RPM unless the RPM
  toggle is on (`2262 RPM`).

## 4. Display modes (merged, customizable)

Three modes; right-click cycles them; vertical bar forces `digits`.

| Mode     | Draws                                                        |
|----------|--------------------------------------------------------------|
| `digits` | glyph + digits per metric                                    |
| `gauges` | glyph + vertical gauge for usage; digits for temps and fans  |
| `combo`  | per device: glyph + gauge + that device's temp digits        |

Options (combine with any mode):

- `showDigits` (default true): gauges also carry their digits
  (covers old bars vs bars+digits).
- `wordLabels` (default false): words instead of glyphs
  (`CPU usage 12%`; covers old labels style).
- `colorMode` `auto` (default) | `graphite`: `auto` draws the theme
  foreground warming toward urgent past thresholds; `graphite` draws
  everything in flat gray with NO warming.
- `showClocks`: usage read-outs append the clock (`12% 3.2G`,
  menu `12 % · 3.2 GHz`). Digits/words modes only.
- `ramFormat` `percent` (default) | `used`: `16%` vs `9.4/62G`
  (one decimal under 10 GiB, none above).

Severity ramp: 0 below warn, linear to 1 at critical. Defaults:
usage warn 70 / crit 90; temp warn 75 °C / crit 90 °C. User-adjustable
(Alertas), clamped and warn < crit enforced. Joined cells take the hotter
half. Hidden/dimmed rows never warm.

Tooltip per cell: headline first (`CPU usage: 12 %`), then detail lines —
CPU model + cores, load average, clocks; VRAM + watts + GPU clock; memory
shows whichever format the headline is NOT (plus swap when known).
Joined cells show both halves. Nulls are skipped silently.

## 5. Bar behavior

- Left/middle click a metric ⇒ toggle the menu. Right-click ⇒ next mode.
- The strip models CELLS, not metrics (combo joins usage+temp of one
  device; lone halves fall back to gauge/digits rules).
- Glyph-to-number gap is measured from glyph ink, not the character cell,
  so one `iconGap` looks equal under every icon; missing glyphs fall back
  to advance width.
- All metrics hidden ⇒ one dimmed placeholder chip that opens the menu
  (never a zero-pixel dead slot).
- Poll every 3 s; every 1 s while the menu is open. Bad lines keep the
  last good reading.

## 6. Menu (simple, grouped)

One card, three sections + reset:

1. **Metrics** — every metric, live value, toggle row. Click toggles;
   ↑/↓ + Enter from keyboard; per-row move up/down control for order.
   Hidden rows dimmed but still live.
2. **View** — mode segmented control (`Digits Gauges Combo`) +
   toggles `Digits`, `Words`, `Graphite`, `Clocks`, `GiB memory`.
3. **Units & alerts** — `°C/°F`, `RPM`, usage warn/crit steppers,
   temp warn/crit steppers.
4. Footer: `Reset defaults`.

Keyboard cursor walks metric rows; settings answer to the mouse
(documented in README).

## 7. Preferences

File `~/.config/omarchy/modular-hw-monitor.json`, versioned:

```
{"version": 1, "hidden": ["cpu_temp"], "order": null,
 "unit": "C", "showRpm": false, "mode": "digits",
 "showDigits": true, "wordLabels": false, "colorMode": "auto",
 "showClocks": false, "ramFormat": "percent",
 "warnUsage": 70, "critUsage": 90, "warnTemp": 75, "critTemp": 90}
```

- `shell.json` keys are first-run seed only (`omarchy refresh shell`
  rewrites that file; the JSON file is the source of truth after).
- Migrate on load: legacy keys `cpu`→`cpu_usage`, `temp`→`cpu_temp`,
  `mem`→`mem_usage`; legacy file `any-monitor.json`; legacy `barStyle`
  values map to mode+options
  (`numbers`→digits, `bars`→gauges w/o digits, `bars+digits`→gauges,
  `bar+temp`→combo, `labels`→digits+words).
- Corrupt file ⇒ defaults, never a blank bar.

## 8. Harness & tests

- `dev.qml`: same `MetricButton` as the bar, plain window, no Omarchy
  imports in shared components. Env: `HIDDEN`, `MODE`, `DIGITS`,
  `WORDS`, `GRAPHITE`, `CLOCKS`, `RAM`, `FAKE_GPU`, `FAKE_LOAD`.
  Shows strip + menu stand-ins.
- `tests/model-tests.js` (node): pure-logic tests for format, severity,
  styles registry, tooltip, prefs migrate/validate.
- `tests/collector-tests.sh` (bash): fake hwmon tree via
  `MONITOR_HWMON_ROOT`; asserts schema fields incl. null-fallbacks.
- Ship gates: node tests green, collector tests green,
  `omarchy-plugin-validate` clean, `qmllint` clean, harness photos for
  the mode×option matrix, real-bar install + screenshot.

## 9. Docs

README (use, modes table, menu, prefs, install/remove, dev env vars),
CHANGELOG from 1.0.0, MIT LICENSE (single holder: Tymur Bogach —
clean-room tree).
