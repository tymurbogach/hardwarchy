# Hardwarchy

CPU, GPU, memory, network, disk and every fan on the machine — one
compact read-out each, straight in the [Omarchy](https://omarchy.org/)
bar, built piece by piece the way you want it.

**Click a metric to open the menu. Every piece of every read-out has its
own row: add it, remove it, mute it.** Keep the two or three you actually
watch; the rest stay one click away.

![Hardwarchy in the Omarchy bar: seven bar setups and the menu](preview.png)

## Gallery

Every picture is the real Omarchy bar on one ThinkPad, in its own theme,
set up from the menu. This machine has no readable GPU, so no GPU
read-out appears here.

### The bar, from one gauge to everything

**Minimal**: a CPU gauge and the temperature, nothing else.

![A CPU gauge and the temperature](docs/images/bar-minimal.png)

**Simple**: icons and numbers for CPU and RAM.

![CPU and RAM with icons and numbers](docs/images/bar-simple.png)

**Defaults**: what a fresh install shows. The fans are dimmed because
they are stopped.

![The default read-outs: CPU, RAM and three fans](docs/images/bar-defaults.png)

**Gauges**: a gauge beside each percentage.

![CPU, RAM and disk, each with a gauge and digits](docs/images/bar-gauges.png)

**Words**: group names instead of glyphs, RAM in GiB, the network rates.

![CPU, RAM, Net and Disk spelled out as words](docs/images/bar-words.png)

**Hot**: past its alert thresholds, a reading warms toward the theme's
urgent color. The thresholds here are low on purpose.

![CPU and RAM readings warmed toward the urgent color](docs/images/bar-hot.png)

**Everything**: CPU with its clock and load average, RAM, network, disk
space with reads and writes, and the fans.

![Every group switched on](docs/images/bar-full.png)

### The menu

<p>
  <img src="docs/images/menu-cpu.png" alt="The menu with the CPU card open" width="32%">
  <img src="docs/images/menu-fans.png" alt="The menu with the Fans card open" width="32%">
  <img src="docs/images/menu-net.png" alt="The menu with the Net card open" width="32%">
</p>

*Left: the CPU card opens with one row per piece and its Quiet chip.
Middle: the Fans card, with a renamed fan and a phantom one switched off.
Right: the Net card selects the link. The title carries the version; every
header carries a live preview, a switch and arrows that move the group.*

## Why

A monitor that shows everything is a monitor you stop reading. This
ThinkPad reports three fans, one a phantom `acpi_fan` that never leaves
0 RPM, and all of it competed for bar space with the two numbers
actually worth a glance.

So the read-out is a set of independent pieces rather than one string.
Every group is its own click target and opens the menu, which is the
switchboard: it always exposes CPU, GPU, RAM, Net, Disk and Fans, with a
live preview of what each group puts on the bar. Nothing is hard-coded to
one machine: a fanless laptop shows three read-outs, a desktop with four
fans shows seven, and either way you choose which reach the bar, in which
order, and what each one draws.

## What it shows

| Group | Readings |
|---|---|
| CPU | usage, temperature, clock, load average |
| GPU | usage, temperature, clock, VRAM, power (NVIDIA, AMD or Intel; you pick the source) |
| RAM | used (% and GiB), swap |
| Net | download and upload rates of the interface you pick (or the busiest one) |
| Disk | space used on the mount you pick, read and write rates |
| Fans | every readable fan, by name |

Network and Disk start switched off. The menu keeps every group available,
even when a machine has no reading for it yet.

Temperature prefers the real CPU package sensor — `Tctl`/`Tdie` on AMD,
`Package id 0` on Intel — and falls back to the hottest readable sensor.

GPU readings are best-effort and need no privileges: `nvidia-smi` on
NVIDIA, `gpu_busy_percent` plus the `amdgpu` sensor on AMD, summed engine
`busy_time` on Intel (i915 and xe). With more than one, the GPU card's
**Source** row picks which one to read.

Two fans that report the same label get their chip appended, so a
machine with `acpi_fan/fan1` and `thinkpad/fan1` shows *fan1
(acpi_fan)* and *fan1 (thinkpad)* rather than two rows you cannot tell
apart — and you can rename either.

## Use

- **Click a metric** — open the menu: one card per group, with a live
  preview of its read-out, a switch, and ↑ ↓ to move it in the bar
- **Click a card** — open or close that group's rows; the caret before
  its icon shows which, and an open card sits on a tinted ground
- **Right-click a read-out** — cycle its load: number, bar, both (on
  Network and Fans it opens the menu); middle-click opens the menu too
- **Keyboard** — ↑ ↓ walk every line, ← → walk a line's buttons and
  Enter presses one; a card's first button (the caret) opens and closes it
- **Update** — when GitHub has a newer release, the title shows
  **Update to …** beside the version; it opens a terminal that shows the
  changes and asks first, then restarts the shell

### Build each read-out your way

Each group draws one read-out (each fan its own), left to right. An open
card lists one row per piece, in the same order. The chips on the left
**add or remove** — light several and you get all of them — and every
row ends with its own **Quiet** chip, a half-filled circle at the far
right: the piece takes the muted color and never warms. For CPU:

| Row | Chips | Draws |
|---|---|---|
| Label |  · CPU | the chip glyph, `CPU`, both, or nothing |
| Load | ▮ · % | a vertical gauge, `12%`, or both |
| ↳ Zero | 0 | the leading zero under 10% (`05%` or `5%`) |
| Clock | G | `3.2G` |
| Temp |  · ° · °C | thermometer, `58`, unit letter |
| Avg | 1m · 5m · 15m | the load average windows you pick |

GPU has the same rows plus **Source**, **VRAM** (▮ · % · GiB) and
**Power** (W). RAM has **Used** (▮ · % · GiB), **Zero** and **Swap**. Net
has **Link**, then **Down** and **Up** (↓/↑ and the rate). Disk has
**Mount**, **Used**, **Zero**, **Read** and **Write** (R/W and the rate).
Fans have **RPM** (#### · RPM), **Stopped** (`0 RPM`)
(hide the ones at 0 RPM) and one line per fan: switch, name (click the
pencil to rename; empty resets), value, move up or down.

Every card ends with its own **alerts** — warn and crit, so a GPU that
runs hot can have a higher crit than the CPU — and a **Reset** button
for that card alone (`Reset CPU`). A reading warms toward the theme's
urgent color between warn and crit; the label warms with the hottest
reading it names. A card that is on but draws nothing says *nothing
shown*.

The collapsed **General** section holds Color % (how strongly warming
applies, 0 to 100), the temperature unit, the three gaps (inside a piece,
between pieces, between read-outs), the refresh interval and Reset all.

A vertical bar always draws numbers. The exact figures behind any gauge
live in the tooltip and the menu.

Everything is remembered in `~/.config/omarchy/hardwarchy.json`
and survives a reboot, a shell restart and `omarchy refresh shell`:

```json
{"version": 2, "order": ["cpu", "gpu", "mem", "net", "disk", "fan"],
 "groups": {"cpu": {"enabled": true,
                    "label": {"icon": true, "word": false, "quiet": false},
                    "load": {"bar": true, "number": false, "quiet": false},
                    "clock": {"show": true, "quiet": false},
                    "temp": {"icon": false, "value": true, "unit": false, "quiet": true}},
            "fan": {"enabled": true, "showStopped": false,
                    "names": {"fan:thinkpad/fan1": "CPU fan"}}},
 "unit": "C", "colorIntensity": 100,
 "gaps": {"icon": 2, "part": 5, "metric": 10}, "refresh": 3}
```

Groups, pieces and toggles left out of the file take their defaults. A
prefs file from 1.0 upgrades itself on first load, and the first start
adopts a `modular-hw-monitor.json` from before the rename.

A fan is remembered by its hwmon id, never by its position, so loading
a module or docking the machine cannot hide a different fan than the one
you hid. Hiding everything leaves a single dimmed chip on the bar —
the way back to the menu, rather than a zero-pixel hole.

## Install

```bash
omarchy plugin add https://github.com/tymurbogach/hardwarchy.git --enable
```

The widget mounts in the right bar section. Move it with:

```bash
omarchy bar move io.github.tymurbogach.hardwarchy --section center
```

Update later with the **Update to …** button in the menu title, or:

```bash
omarchy plugin update io.github.tymurbogach.hardwarchy
omarchy-restart-shell   # only a restart loads the new QML
```

> Hardwarchy was called Modular HW Monitor before 2.1. The old id does
> not update in place: remove `io.github.tymurbogach.modular-hw-monitor`,
> then add Hardwarchy. Your settings carry over on the first start.

## Remove

```bash
omarchy plugin disable io.github.tymurbogach.hardwarchy   # take it off the bar
omarchy plugin remove io.github.tymurbogach.hardwarchy    # delete it
rm -f ~/.config/omarchy/hardwarchy.json                   # forget the prefs
```

A prefs file from before the rename stays where it was. Delete it too:

```bash
rm -f ~/.config/omarchy/modular-hw-monitor.json ~/.config/omarchy/any-monitor.json
```

## Requirements

- Omarchy 4 (Quattro) with `omarchy-shell`
- `bash` — nothing else. No `lm_sensors`, no kernel modules, no vendor tools.
- `git`, for the update check only. `omarchy plugin add` needs it anyway.

Readings come from `/proc/stat`, `/proc/meminfo`, `/proc/cpuinfo`,
`/proc/loadavg`, `/proc/net/dev`, `/proc/diskstats`, `/proc/mounts` and
`/sys/class/hwmon`, all readable without privileges.

Hardwarchy reaches the network for one thing only: the update check,
a `git fetch` from the repository it was installed from. It runs when
the menu opens, at most every 6 hours, and never for a copy that is not
a git clone.

The collector reads only what the bar draws: a group or piece you
switch off is not read at all. While the menu is open it reads
everything, so the previews stay live. It finds the sensor files once
and reads them with shell builtins, so a reading costs about 10 ms of
CPU.

## Settings

Optional, in the widget's `shell.json` layout entry. These are a
first-run seed only — afterwards the JSON prefs file, and the menu, are
the source of truth:

| Key | Default | What it does |
|---|---|---|
| `iconGap` | `2` | Pixels inside one piece: a mark and its reading, a gauge and its digits |
| `partGap` | `5` | Pixels between two pieces of one read-out |
| `metricGap` | `10` | Pixels between one read-out and the next |
| `hidden` | `[]` | Metric keys folded away before the prefs file exists |
| `unit` | `"C"` | `"F"` for Fahrenheit |
| `showRpm` | `false` | Spell out RPM on the bar |
| `mode` | `"digits"` | `"gauges"` (bar and digits, unless `showDigits` is `false`) |
| `showDigits` | `true` | `false` keeps a `"gauges"` seed to the bar alone |
| `wordLabels` | `false` | Words instead of glyphs, for every group |
| `colorMode` | `"auto"` | `"graphite"` never warms (Color % 0) |
| `showClocks` | `false` | CPU/GPU clocks after the load |
| `ramFormat` | `"percent"` | `"used"` shows memory as used over total GiB |

The gaps are measured against the ink, not the character cell, so one
number means the same visual distance under every icon.

## Development

`dev.qml` is a Quickshell harness that draws the read-out with the
**same** `MetricButton` the bar uses, in a plain window, so it runs on
any Wayland desktop and what you see is what ships:

```bash
quickshell -p dev.qml
```

Photograph states straight from a cold start. Every variable takes the
prefix `HARDWARCHY_`:

| Variable | Effect |
|---|---|
| `HIDDEN` | Comma-separated metric keys to hide |
| `ENABLE` | Comma-separated groups to switch on (`net,disk`) |
| `PARTS` | `group.part=toggle,toggle` entries split by `;`: the toggles named turn on, the rest of that part off; `quiet` mutes it |
| `COLOR` | Color % from 0 to 100 |
| `FAKE_GPU=1` / `FAKE_LOAD=1` | Invent a GPU / a hot machine |
| `FONT` | Font family to draw with |

```bash
HARDWARCHY_PARTS='cpu.load=bar,number;cpu.temp=icon,value,unit' quickshell -p dev.qml
HARDWARCHY_ENABLE=net,disk HARDWARCHY_PARTS='disk.used=percent,gib' quickshell -p dev.qml
HARDWARCHY_PARTS='cpu.label=;cpu.temp=value,quiet' HARDWARCHY_FAKE_LOAD=1 quickshell -p dev.qml
```

In the harness, clicking a read-out cycles its load.

The collector runs on its own:

```bash
./scripts/sysread                      # one reading
./scripts/sysread --loop --interval 2  # stream one reading every 2 seconds
MONITOR_NET_IFACE=wlan0 MONITOR_ROOT_MOUNT=/home ./scripts/sysread   # other sources
./scripts/update check                 # the version on the remote's HEAD
```

Set `MONITOR_HWMON_ROOT` to a directory of fake `hwmon` nodes to test
machines you do not have. Tests:

```bash
node tests/model-tests.js   # pure-logic tests
bash tests/collector-tests.sh
bash tests/update-tests.sh  # a throwaway git remote, the omarchy CLI stubbed
```

## A note on reloading

Editing an installed plugin's QML is not picked up by `omarchy plugin
disable`/`enable`, nor by `omarchy-shell shell rescanPlugins` — both
leave the already-loaded QML in memory. Restart the shell instead:

```bash
omarchy-restart-shell
```

## License

MIT — see [LICENSE](LICENSE).
