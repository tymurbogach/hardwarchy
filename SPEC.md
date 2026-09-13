# SPEC — Modular HW Monitor (clean-room behavior specification)

This document describes observable behavior only. Implementations must be
written from this spec without copying files from the previous codebase.
Behavioral compatibility (JSON fields, prefs keys, click actions) is
intentional; code expression must be original.

## 1. What it is

An Omarchy 4 (`omarchy-shell`, Quickshell) bar widget. One compact cell
per hardware group, each its own click target, built piece by piece from
that group's settings. A popout menu lists every group with a live
preview, a switch and one row per piece, plus a few general settings.

- Plugin id: `io.github.tymurbogach.modular-hw-monitor`
- Entry point: `BarWidget.qml`, kind `bar-widget`, default section `right`.
- Language: English everywhere (code, UI, docs, commits).
- Dependencies at runtime: `bash` only. No lm_sensors, no vendor tools.

## 2. Collector (`scripts/sysread`)

Single executable bash script, `set -u`, no arguments beyond:

- `sysread` — one JSON line on stdout (CPU % measured over ~0.2 s).
- `sysread --loop --interval N` — one JSON line every N seconds.

Environment:

- `MONITOR_HWMON_ROOT`, `MONITOR_DRM_ROOT`, `MONITOR_NET_DEV_FILE`,
  `MONITOR_DISKSTATS_PATH`, `MONITOR_MOUNTS_FILE` — fake sources (tests).
- `MONITOR_GPU` (`auto` | `nvidia` | `amd` | `intel`),
  `MONITOR_NET_IFACE` (`auto` | a name), `MONITOR_ROOT_MOUNT` (a path) —
  the sources the widget chose in its menu. A GPU source or an interface
  this machine lacks falls back to the automatic pick; a mount that
  cannot be read falls back to `/`.
- `MONITOR_READ` — what to read, a comma list of `cpu`, `temp`,
  `clocks`, `load`, `mem`, `gpu`, `net`, `disk` (space), `io`, `fans`,
  `mounts`; or `all` (the default) or `none`. A reading it leaves out is
  `null` (`fans` is `[]`). The widget passes the providers behind the
  pieces that draw (`metricsReadList`), and `all` while the menu is open.

Internals must be organized as provider functions (cpu, memory, hwmon
temperature, fans, gpu-nvidia, gpu-amd, gpu-intel, clocks, load, net,
disk). Sourcing split files is allowed as long as the installed tree
keeps working (`scripts/` ships with the plugin).

The collector finds its sensor files at startup and again every 30
readings (hotplug). It reads them with shell builtins: a reading forks
only `stat` (disk space) and `nvidia-smi` (NVIDIA). The temperature
reads the CPU package sensor alone when it answers.

### 2.1 JSON schema (2)

All values numbers or `null`. Missing sensor ⇒ `null`, never a fake zero.

```
{
  "schema": 2,
  "cpu": 12,            // % across all threads, delta of /proc/stat
  "temp": 45,           // °C, preferred CPU package sensor else hottest sane
  "mem": 16,            // % used from MemTotal/MemAvailable
  "gpu": 23,            // % or null (best effort, unprivileged)
  "gpu_temp": 61,       // °C or null
  "gpu_source": "amd",  // the source read, or null
  "gpu_sources": ["amd", "intel"],            // every source that answered
  "fans": [             // every readable fan
    {"id": "thinkpad/fan1", "chip": "thinkpad", "label": "fan1", "rpm": 2262}
  ],
  "cpu_mhz": 3200, "gpu_mhz": 1500,           // mean clocks, MHz or null
  "mem_used_kib": 9500000, "mem_total_kib": 64000000,
  "swap_used_kib": 0, "swap_total_kib": 8000000,
  "cpu_model": "AMD Ryzen 7 ...", "cpu_cores": 16,
  "load": {"one": 0.42, "five": 0.50, "fifteen": 0.55},
  "gpu_detail": {"vram_used_b": N, "vram_total_b": N, "watts": 45.0},
  "net": {"iface": "wlan0", "ifaces": ["eth0", "wlan0"],
          "down_bps": 1200000, "up_bps": 340000},
  "disk": {"mount": "/", "mounts": ["/", "/boot"], "used_pct": 18,
           "used_b": N, "total_b": N, "read_bps": 40960, "write_bps": 12288}
}
```

- `gpu_detail` is `null` unless at least one subfield answered.
- Fan `id` is `chip/fanN` (stable across reboots/reorders). Label defaults
  to `Fan N` when the node carries none.
- CPU temperature: prefer AMD `Tctl`/`Tdie` (`k10temp`/`zenpower`) and Intel
  `Package id ...` (`coretemp`); else the hottest reading in (0, 150).
- GPU sources, probed once at startup: `nvidia-smi` answering, amdgpu
  `gpu_busy_percent`, Intel drm `busy_time` engines. The wanted source
  wins when it answers, else the first in that order. Percentage
  functions prime on first call and report `null` (never a wrong 0).
- NVIDIA detail (utilization, temp, clocks, VRAM MiB, power) comes from ONE
  `nvidia-smi` call per reading. AMD VRAM/power from amdgpu sysfs.
- Net: the wanted interface, else the non-virtual one with the most
  traffic at startup. `ifaces` lists the non-virtual interfaces (plus the
  chosen one). Rates are deltas and prime to `null`.
- Disk: usage and bytes of the mount via `stat -f`; I/O sums every whole
  physical disk in `/proc/diskstats`. `mounts` lists real filesystems,
  one mount point per device (btrfs subvolumes appear once).
- `cpu_model`/`cpu_cores` detected once (they cannot change).

## 3. Metric catalog (bar order default)

CPU usage, temp, load average → GPU usage, temp, memory (VRAM), power →
memory used, swap → net down, up → disk used, read, write → fans (as
found). Six groups own them: `cpu`, `gpu`, `mem`, `net`, `disk`, `fan`.

- Keys: `<group>_<kind>` (`cpu_usage`, `cpu_temp`, `cpu_avg`,
  `gpu_vram`, `gpu_power`, `mem_swap`, `disk_read`, …) and
  `fan:<chip>/<fanN>`.
- Duplicate fan labels get ` (<chip>)` appended (only duplicates). A
  name the user gives a fan wins over its label.
- Stopped fan (0 RPM): bar shows `0`, menu shows `stopped`, dimmed.
- Usage-like metrics (usage, VRAM, swap, disk used) carry the padded
  percentage (`05%`), the GiB pair (`9.4/62G`) and a 0–1 ratio.
- Temps: bar `46°`, with the unit letter when asked (`46°C`); menu and
  tooltip `46 °C` / `115 °F`.
- Every metric carries its group's glyph and word (`CPU`, `GPU`, `RAM`,
  `Net`, `Disk`, or a fan's own name) for the cell label, plus its own
  mark: the thermometer for temps, ↓/↑ for net rates, R/W for disk rates.
- With the clock on, a CPU/GPU usage metric carries the short clock
  (`3.2G`); the menu value appends the long form (`12 % · 3.2 GHz`).
- Severity uses the group's own thresholds (§4).

## 4. Cells

Every group draws one cell; each fan draws its own. A cell is a row of
pieces in a fixed order. Each piece is a **part**: boolean toggles that
add or remove what it draws — several can be on at once — and its own
color, `quiet` (muted, never warms) or regular. Every combination is
valid.

| Group | Parts, left to right |
|-------|----------------------|
| cpu   | label · load · clock · temp · avg |
| gpu   | label · load · clock · temp · vram · power |
| mem   | label · used · swap |
| net   | label · down · up |
| disk  | label · used · read · write |
| fan   | label · rpm |

| Part | Toggles | Draws |
|------|---------|-------|
| label | `icon`, `word` | the group's glyph, its word, both, or nothing |
| load | `bar`, `number` | a vertical gauge, the digits, or both (cpu, gpu) |
| used, vram, swap | `bar`, `percent`, `gib` | gauge, percentage, GiB pair |
| zero | `show` | the pad digit of a percentage under 10 % (`05%` vs `5%`) |
| clock, power | `show` | the clock (`3.2G`), the power draw (`45W`) |
| temp | `icon`, `value`, `unit` | thermometer, value, unit letter |
| avg | `one`, `five`, `fifteen` | the chosen load-average windows |
| down, up | `icon`, `value` | arrow and rate |
| read, write | `tag`, `value` | R/W tag and rate |
| rpm | `value`, `unit` | fan speed, `RPM` after it |

- A mark (icon, unit, tag) never shows without its value.
- A gauge with no ratio, or on a vertical bar, falls back to digits.
- The zero part colors the pad digit: quiet mutes it, regular draws it
  like the digits after it.
- A group whose parts all draw nothing draws no cell, never a lone
  label. A CPU/GPU usage metric with its load off stays for its clock.

Color: each reading warms by its own severity, from its group's warn to
crit threshold (usage 70/90 %, temp 75/90 °C, fan 4000/6000 RPM). The
label warms with the hottest reading it names. A quiet piece is always
the muted color and never warms. `colorIntensity` 0–100 scales all
warming (0 never warms). Dimmed cells never warm.

Tooltip per cell: one headline per metric (`CPU usage: 12 %`), then the
group's details once — CPU model + cores, load average, clock; GPU
source, VRAM, watts, clock; swap; the net interface; the disk mount and
what I/O counts. A detail never repeats a headline. Nulls are skipped.

## 5. Bar behavior

- Left/middle click a cell ⇒ toggle the menu. Right-click a cpu, gpu,
  mem or disk cell ⇒ that group's next load: number → bar → both →
  number (a load that was off comes back as the number). Right-click on
  net or a fan opens the menu.
- Three gaps, all measured ink to ink, all in the prefs: `icon` inside
  one part (a mark and its reading, a gauge and its digits, the label
  icon and what follows it), `part` between two parts, `metric` between
  two cells. Missing glyphs fall back to advance width.
- Text keeps its line box centred in the bar slot, so the read-out
  shares a baseline with neighbouring widgets. The gauge centres on the
  digits' ink, is about 0.93 em tall (the icon ink height) and half as
  wide, so it scales with the theme font.
- All metrics hidden ⇒ one dimmed placeholder chip that opens the menu.
- Poll every `refresh` seconds (3 by default); every 1 s while the menu
  is open. A new source choice or read list (§2) restarts the
  collector. Bad lines keep the last good reading.

## 6. Menu

One card per group, in bar order. The header shows glyph, name, a live
preview of the group's cell (drawn by the bar's own component, dimmed
while the group is off, "nothing shown" when every part is off), an
on/off switch and an expand button; a click anywhere else on the header
also expands.

An open card lists, top to bottom:

1. The source, one choice: GPU `Source` (Auto and the answering
   sources), Net `Link` (Auto and the interfaces), Disk `Mount` (the
   mounts). A choice that is gone right now stays listed.
2. One row per part, in bar order: chips on the left that add or remove
   each toggle, and the part's Quiet chip (a half-filled circle) at the
   far right. A chip that needs another (an icon needs its value) is
   disabled without it. The `Zero` sub row shows only with digits.
3. Fans: `Stopped` (show stopped fans or not), then one line per fan:
   on/off switch, name (renamed in place; empty resets), value, move
   up/down.
4. Alerts: warn/crit steppers for the readings that warm and show.
5. `Order`: Up · Down, and `Reset` for that group alone.

Below the cards, **General**: Color %, Unit °C · °F, the three gaps,
Refresh seconds, Reset all.

Keyboard: ↑/↓ walk every line (headers, the rows of open cards, each
fan, General); on a header → opens, ← closes, Enter switches the group;
on a row ←/→ walk its buttons and Enter presses one. A menu taller than
the screen scrolls, and follows the cursor.

## 7. Preferences

File `~/.config/omarchy/modular-hw-monitor.json`, versioned:

```
{"version": 2, "order": ["cpu", "gpu", "mem", "net", "disk", "fan"],
 "groups": {
   "cpu": {"enabled": true,
           "label": {"icon": true, "word": false, "quiet": false},
           "load": {"bar": false, "number": true, "quiet": false},
           "zero": {"show": true, "quiet": true},
           "clock": {"show": false, "quiet": false},
           "temp": {"icon": false, "value": true, "unit": false, "quiet": false},
           "avg": {"one": false, "five": false, "fifteen": false, "quiet": false},
           "warnUsage": 70, "critUsage": 90, "warnTemp": 75, "critTemp": 90},
   "gpu": {"enabled": true, "adapter": "auto", …the cpu parts without avg…,
           "vram": {"bar": false, "percent": false, "gib": false, "quiet": false},
           "power": {"show": false, "quiet": false}, …thresholds…},
   "mem": {"enabled": true, "label": {…word…}, "used": {…percent…}, "zero": {…},
           "swap": {…}, "warnUsage": 70, "critUsage": 90},
   "net": {"enabled": false, "iface": "auto", "label": {…},
           "down": {"icon": true, "value": true, "quiet": false}, "up": {…}},
   "disk": {"enabled": false, "mount": "/", "label": {…}, "used": {…}, "zero": {…},
            "read": {"tag": true, "value": true, "quiet": false}, "write": {…},
            "warnUsage": 70, "critUsage": 90},
   "fan": {"enabled": true, "label": {…}, "rpm": {"value": true, "unit": false, "quiet": false},
           "showStopped": true, "warnRpm": 4000, "critRpm": 6000,
           "hidden": [], "order": null, "names": {}}},
 "unit": "C", "colorIntensity": 100,
 "gaps": {"icon": 2, "part": 5, "metric": 10}, "refresh": 3}
```

- Every field, and every toggle of a part, falls back to its group's
  default on its own; unknown fields drop; thresholds clamp (usage 0–100,
  temp 0–150, RPM 0–20000) with warn < crit; gaps clamp (0–20, 0–40);
  refresh clamps to 1–10 s; fan names are trimmed to 1–24 characters.
- `shell.json` keys are first-run seed only (`omarchy refresh shell`
  rewrites that file; the JSON file is the source of truth after). The
  seed keeps the v1 shape plus `iconGap`/`partGap`/`metricGap`.
- Older files upgrade on load. Each is first read as one word per piece,
  then each word maps to a part:
  - v1 (no `groups`): legacy keys `cpu`→`cpu_usage`, `temp`→`cpu_temp`,
    `mem`→`mem_usage`; legacy file `any-monitor.json`; the v1 mode sets
    every load (`gauges` → bar + number, or bar alone when `showDigits`
    was false; `combo` → bar; `digits` → number); hidden usage/temp →
    off; hidden `mem_usage` disables memory; `showClocks` → clock;
    `wordLabels` → word labels; `ramFormat: "used"` → GiB; `showRpm` →
    RPM unit; global thresholds seed every group; `colorMode:
    "graphite"` → intensity 0. Legacy `barStyle` values map first.
  - The mode draft (a top-level `defaultMode`): each group's mode (or
    the default it inherited) and its show-booleans map the same way.
  - The word draft (`"load": "bar"`, `"temp": "plain"`, …): each word
    maps to its part; `tempColor: "secondary"` → a quiet temp.
- Corrupt file ⇒ defaults, never a blank bar.

## 8. Harness & tests

- `dev.qml`: same `MetricButton` as the bar, plain window, no Omarchy
  imports in shared components. Env (prefix `MODULAR_HW_MONITOR_`):
  `HIDDEN`, `ENABLE`, `PARTS`, `COLOR`, `FAKE_GPU`, `FAKE_LOAD`, `FONT`.
  Shows strip + menu stand-ins.
- `tests/model-tests.js` (node): pure-logic tests for format, severity,
  parse, metrics, visibility, cells, tooltip, prefs migrate/validate.
- `tests/collector-tests.sh` (bash): fake hwmon, drm, net, diskstats and
  mounts trees; asserts schema fields incl. null-fallbacks and the
  widget's source choices with their fallbacks.
- Ship gates: node tests green, collector tests green,
  `omarchy-plugin-validate` clean, `qmllint` clean, harness photos for
  the part matrix, real-bar install + screenshot.

## 9. Docs

README (use, cell options, menu, prefs, install/remove, dev env vars),
CHANGELOG from 1.0.0, MIT LICENSE (single holder: Tymur Bogach —
clean-room tree).
