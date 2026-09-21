# SPEC: Hardwarchy (clean-room behavior specification)

This document describes observable behavior only. Implementations must be
written from this spec without copying files from the previous codebase.
Behavioral compatibility (JSON fields, prefs keys, click actions) is
intentional; code expression must be original.

## 1. What it is

An Omarchy 4 (`omarchy-shell`, Quickshell) bar widget. One compact cell
per hardware group, each its own click target, built piece by piece from
that group's settings. A popout menu lists every group with a live
preview, a switch and one row per piece, plus a few general settings.

- Plugin id: `io.github.tymurbogach.hardwarchy`
- Entry point: `BarWidget.qml`, kind `bar-widget`, default section `right`.
- Language: English everywhere (code, UI, docs, commits).
- Dependencies at runtime: `bash` only. No lm_sensors, no vendor tools.
  The update check (§6.1) alone runs `git` and `timeout`, and only in a
  git install, which `omarchy plugin add` already needs git for.

## 2. Collector (`scripts/sysread`)

Single executable bash script, `set -u`, no arguments beyond:

- `sysread` — one JSON line on stdout (CPU % measured over ~0.2 s).
- `sysread --loop --interval N` — one JSON line every N seconds, the
  first after ~0.2 s.

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
  A GPU source is probed only while `gpu` is read: `nvidia-smi` wakes a
  sleeping NVIDIA card.

Internals must be organized as provider functions (cpu, memory, hwmon
temperature, fans, gpu-nvidia, gpu-amd, gpu-intel, clocks, load, net,
disk). Sourcing split files is allowed as long as the installed tree
keeps working (`scripts/` ships with the plugin).

The collector finds the sensor files its wanted providers need at
startup, and again every 30 readings (hotplug). It reads them with shell builtins: a reading forks
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
  wins when it answers, else the first in that order.
- Every delta (CPU %, Intel GPU %, net and disk rates) is primed about
  0.2 s before the first line, so no line carries a priming `null` or
  a wrong 0.
- NVIDIA detail (utilization, temp, clocks, VRAM MiB, power) comes from ONE
  `nvidia-smi` call per reading. AMD VRAM/power from amdgpu sysfs.
- Net: the wanted interface, else the non-virtual one with the most
  traffic at startup. `ifaces` lists the non-virtual interfaces (plus the
  chosen one). Rates are deltas and prime to `null`.
- Disk: usage and bytes of the mount via `stat -f`; I/O sums every whole
  physical disk in `/proc/diskstats`. `mounts` lists real filesystems,
  one mount point per device (btrfs subvolumes appear once).
- `cpu_model`/`cpu_cores` detected once (they cannot change). The model
  drops trademark marks, the base clock and filler words: `Intel(R)
  Core(TM) i7-8550U CPU @ 1.80GHz` reads `Intel Core i7-8550U`.

### 2.2 Diagnostic JSON (`--info`)

`--info` remains a diagnostic command for static machine facts. The
widget does not call it. A fact that does not answer is `null`; a list
with nothing in it is `[]`.

```
{
  "info": 1,
  "system": {"vendor": "LENOVO", "product": "21QTCTO1WW",
             "version": "ThinkPad P14s Gen 6", "board_vendor": "LENOVO",
             "board": "21QTCTO1WW", "kernel": "7.2.3-arch1-3",
             "boot_time": 1789340805},
  "cpu": {"model": "Intel Core Ultra 9 285H", "cores": 16, "threads": 16,
          "max_mhz": 5400, "cache_kib": 24576, "cache_level": 3,
          "governor": "powersave", "driver": "intel_pstate"},
  "gpus": [{"source": "intel", "name": "Arrow Lake-P [Arc Pro 130T/140T]",
            "driver": "xe", "pci": "8086:7d51"}],
  "mem": {"total_kib": 65240496,
          "swaps": [{"kind": "zram", "size_kib": 65240060}]},
  "net": [{"iface": "wlan0", "wireless": true, "virtual": false,
           "state": "up", "mbps": null, "mac": "c8:95:ce:31:cc:2f"}],
  "disks": [{"mount": "/", "fs": "btrfs", "device": "nvme0n1",
             "model": "SAMSUNG MZVLC1T0HFLU-00BLL", "size_b": 1024209543168}]
}
```

- `system`: the DMI strings from `/sys/class/dmi/id`, the kernel release
  and `btime` from `/proc/stat`.
- `cpu`: cores count distinct (package, core) pairs, threads count
  processors. `max_mhz` is the fastest core's `cpuinfo_max_freq`, the
  cache the highest level cpu0 reports.
- `gpus`: every `/sys/class/drm/cardN` with PCI ids, named from
  `pci.ids` (hwdata) in one pass, its driver from the `driver` link.
  `source` maps the vendor to the GPU source names of §2.1.
- `net`: the interfaces of §2.1 from `/sys/class/net`; `virtual` when
  no device backs it. Wi-Fi and a down link have no `mbps`.
- `disks`: the mounts of §2.1, each followed down device-mapper (LUKS,
  LVM) and up from a partition to the whole disk in `/sys/class/block`.
- Shell builtins only: symlinks resolve through `cd -P`, not `readlink`.

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

The title reads `Hardwarchy` and the installed version from
`manifest.json`.

One card per group, in preference order. Cards exist before readings
arrive, so the panel geometry stays stable. The header shows a caret (▸ closed,
▾ open), glyph, name, a live preview of the group's cell (drawn by the
bar's own component, dimmed while the group is off, "nothing shown"
when every part is off), an on/off switch, and ↑ ↓ that move the group
in the bar. A click anywhere else on the header opens or closes the
card. An open card sits on a tinted ground (`Color.menu.selectedBackground`)
with a gap below it.

An open card lists, top to bottom:

0. The source, one choice: GPU `Source` (Auto and the answering
   sources), Net `Link` (Auto and the interfaces), Disk `Mount` (the
   mounts). A choice that is gone right now stays listed.
1. One row per part, in bar order: chips on the left that add or remove
   each toggle, and the part's Quiet chip (a half-filled circle) at the
   far right. A chip that needs another (an icon needs its value) is
   disabled without it. The `Zero` sub row shows only with digits.
2. Fans: `Stopped` (show stopped fans or not), then one line per fan:
   on/off switch, name (renamed in place; empty resets), value, move
   up/down.
3. Alerts: warn/crit steppers for the readings that warm and show.
4. `Reset <group>` at the far right, for that group alone.

Below the cards, collapsed **General**: Color %, Unit °C · °F, the three
gaps, Refresh seconds, Reset all. The menu is 340 theme pixels wide and
grows with its expanded cards up to 560 theme pixels high. It then scrolls
internally, bounded by the available screen space.

Keyboard: ↑/↓ walk every line (the update button while it shows,
headers, the rows of open cards, each fan, General). The cursor starts
on the first header, never on the update button; ←/→ walk a line's buttons and Enter presses one. A
header's buttons are the caret, the switch, ↑ and ↓. A menu taller than
the screen scrolls, and follows the cursor.

### 6.1 Version and updates

`scripts/update` backs the update button. The installed copy is a git
clone, and `omarchy plugin update` moves it, as for any plugin.

- `update check`: without `.git` in the plugin folder, print nothing and
  exit 0. Else `git fetch origin HEAD` (10 s timeout, no prompts), then
  print the `version` of `FETCH_HEAD:manifest.json`. Exit non-zero when
  that fails. The installed copy never moves.
- The widget runs the check when the menu opens, at most every 6 h, or
  every 15 min after a failure. The timestamp lives in memory only.
- The title shows `Update to 2.2.0` at the far right while the fetched
  version is newer than the installed one (numeric dotted compare; any
  other string is never newer). A commit without a version bump shows
  nothing.
- The button closes the menu and opens a floating terminal
  (`omarchy-launch-floating-terminal-with-presentation`) with `update
  apply`: `omarchy plugin update <id>` shows the changes and asks, then
  the shell restarts when HEAD moved, because only a restart reloads
  QML. A declined update restarts nothing.

## 7. Preferences

File `~/.config/omarchy/hardwarchy.json`, versioned:

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
    `mem`→`mem_usage`; the v1 mode sets
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
- Without `hardwarchy.json`, the widget adopts the newest file from
  before a rename, `modular-hw-monitor.json` (2.0) and then
  `any-monitor.json` (pre-1.0), and saves it under the current name. It
  looks once per start and leaves the old file on disk.

## 8. Harness & tests

- `dev.qml`: same `MetricButton` as the bar, plain window, no Omarchy
  imports in shared components. Env (prefix `HARDWARCHY_`):
  `HIDDEN`, `ENABLE`, `PARTS`, `COLOR`, `FAKE_GPU`, `FAKE_LOAD`, `FONT`.
  Shows strip + menu stand-ins.
- `tests/model-tests.js` (node): pure-logic tests for parse, metrics,
  visibility, the read list, cells, tooltip, prefs migrate/validate,
  and version compare (`Model/Version.js`).
- `tests/collector-tests.sh` (bash): fake hwmon, drm, net, diskstats and
  mounts trees; asserts schema fields incl. null-fallbacks and the
  widget's source choices with their fallbacks; `--info` against a fake
  machine and an empty one.
- `tests/update-tests.sh` (bash): a throwaway remote and clone; `check`
  and `apply` with the omarchy CLI and the shell restart stubbed.
- Ship gates: node, collector and update tests green,
  `omarchy-plugin-validate` clean, `qmllint` clean, harness photos for
  the part matrix, real-bar install + screenshot.

## 9. Docs

README (use, cell options, menu, prefs, install/remove, dev env vars,
a gallery from `docs/images/`), CHANGELOG from 1.0.0, MIT LICENSE
(single holder: Tymur Bogach, clean-room tree), and contributor notes
in `docs/CONTRIBUTING.md`. The tree carries no agent instruction files
(`CLAUDE.md`, `AGENTS.md`): the marketplace review rejects them.
