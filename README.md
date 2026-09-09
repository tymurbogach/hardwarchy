# Modular HW Monitor

CPU usage, CPU temp, GPU usage, GPU temp, memory and every fan on the
machine — one compact read-out each, straight in the
[Omarchy](https://omarchy.org/) bar.

**Click a metric to open the menu. Every row names what it toggles.**
Keep the two or three you actually watch; the rest stay one click away.

![Modular HW Monitor in the Omarchy bar](preview.png)

*The bar keeps CPU usage, CPU temp and one fan. The menu lists everything
the machine reports — including what is hidden, still updating, so you
can decide whether to bring it back.*

## Why

A monitor that shows everything is a monitor you stop reading. This
ThinkPad reports three fans, one a phantom `acpi_fan` that never leaves
0 RPM, and all of it competed for bar space with the two numbers
actually worth a glance.

So the read-out is a set of independent pieces rather than one string.
Every metric is its own click target and opens the menu, which is the
switchboard: each row names its quantity outright — CPU usage, CPU temp,
GPU usage, GPU temp, Memory usage, Fan 1 — with a live value beside it.
Nothing is hard-coded to one machine: a fanless laptop shows three
metrics, a desktop with four fans shows seven, and either way you choose
which reach the bar and in which order.

## What it shows

| Machine | Available |
|---|---|
| Laptop with two fans | CPU usage, CPU temp, memory, both fans |
| NVIDIA/AMD desktop | …plus GPU usage and GPU temp |
| Fanless laptop | CPU usage, CPU temp, memory |
| Desktop with four fans | CPU usage, CPU temp, memory, four fans |
| No sensors at all | CPU usage, memory |

Temperature prefers the real CPU package sensor — `Tctl`/`Tdie` on AMD,
`Package id 0` on Intel — and falls back to the hottest readable sensor.

GPU readings are best-effort and need no privileges: `nvidia-smi` on
NVIDIA, `gpu_busy_percent` plus the `amdgpu` sensor on AMD, summed engine
`busy_time` on Intel (i915 and xe). A machine that exposes nothing
readable simply lists no GPU rows instead of showing zeros.

Two fans that report the same label get their chip appended, so a
machine with `acpi_fan/fan1` and `thinkpad/fan1` shows *fan1
(acpi_fan)* and *fan1 (thinkpad)* rather than two rows you cannot tell
apart.

## Use

- **Click a metric** — open the menu: every metric, its live value, its switch
- **Click a row** — show or hide that metric
- **▲ ▼ on a row** — move it up or down the bar order
- **↑ ↓ and Enter** — toggle from the keyboard
- **Right-click a metric** — cycle the display mode; middle-click opens
  the menu too

### Display modes

Three modes, cycled with right-click or picked in the menu:

| Mode | Bar shows |
|---|---|
| `Digits` | glyph + digits per metric (the default) |
| `Gauges` | glyph + vertical gauge for usage; digits for temps and fans |
| `Combo` | usage and temp of one device joined: glyph + gauge + temp |

Options combine with any mode:

- **Digits** — gauges also carry their digits
- **Words** — digit read-outs use words instead of glyphs (`CPU usage 12%`; gauges keep their glyph)
- **Graphite** — flat gray chrome, no alert warming
- **Clocks** — usage read-outs carry their clock (`12% 3.2G`)
- **GiB** — memory as used over total (`9.4/62G`) instead of a percentage

In `Auto` color a hot machine warms toward the theme's urgent color as
load climbs past its warn threshold (fully urgent at crit) — in the bar
and in the menu values alike. The defaults are 70/90 % for usage and
75/90 °C for temps; the menu's Units & alerts section adjusts them.

A vertical bar always draws digits. The exact figure behind any gauge
lives in the tooltip and the menu.

Two more prefs sit in the menu's Units row:

- **°C / °F** — temperatures everywhere (bar, menu, tooltip)
- **RPM** — spell out the unit next to each fan (`2262 RPM`)

Everything is remembered in `~/.config/omarchy/modular-hw-monitor.json`
and survives a reboot, a shell restart and `omarchy refresh shell`:

```json
{"version": 1, "hidden": ["cpu_temp"], "order": null,
 "unit": "C", "showRpm": false, "mode": "combo",
 "showDigits": true, "wordLabels": false, "colorMode": "graphite",
 "showClocks": false, "ramFormat": "percent",
 "warnUsage": 70, "critUsage": 90, "warnTemp": 75, "critTemp": 90}
```

A fan is remembered by its hwmon id, never by its position, so loading
a module or docking the machine cannot hide a different fan than the one
you hid. Hiding every metric leaves a single dimmed chip on the bar —
the way back to the menu, rather than a zero-pixel hole.

## Install

```bash
omarchy plugin add https://github.com/tymurbogach/omarchy-modular-hw-monitor.git --enable
```

The widget mounts in the right bar section. Move it with:

```bash
omarchy bar move io.github.tymurbogach.modular-hw-monitor --section center
```

Update later with:

```bash
omarchy plugin update io.github.tymurbogach.modular-hw-monitor
```

> Reinstalls from a fresh clone: if you carried a checkout from before
> the 1.0 rewrite, remove the plugin and add it again rather than
> updating, so no stale file survives.

## Remove

```bash
omarchy plugin disable io.github.tymurbogach.modular-hw-monitor   # take it off the bar
omarchy plugin remove io.github.tymurbogach.modular-hw-monitor    # delete it
rm -f ~/.config/omarchy/modular-hw-monitor.json                   # forget the prefs
```

## Requirements

- Omarchy 4 (Quattro) with `omarchy-shell`
- `bash` — nothing else. No `lm_sensors`, no kernel modules, no vendor tools.

Readings come from `/proc/stat`, `/proc/meminfo`, `/proc/cpuinfo`,
`/proc/loadavg` and `/sys/class/hwmon`, all readable without privileges.

## Settings

Optional, in the widget's `shell.json` layout entry (first-run seed
only — afterwards the JSON prefs file is the source of truth):

| Key | Default | What it does |
|---|---|---|
| `iconGap` | `2` | Pixels between a glyph's **ink** and its value |
| `metricGap` | `10` | Pixels between one metric and the next |
| `hidden` | `[]` | Metric keys folded away before the prefs file exists |
| `unit` | `"C"` | `"F"` for Fahrenheit |
| `showRpm` | `false` | Spell out RPM on the bar |
| `mode` | `"digits"` | `"gauges"` or `"combo"` |
| `showDigits` | `true` | Digits alongside gauges |
| `wordLabels` | `false` | Words instead of glyphs |
| `colorMode` | `"auto"` | `"graphite"` for flat gray |
| `showClocks` | `false` | Append CPU/GPU clocks to usage |
| `ramFormat` | `"percent"` | `"used"` shows memory as used over total GiB |

`iconGap` is measured against the glyph's ink box, not its character
cell, so one number means the same visual distance under every icon.

## Development

`dev.qml` is a Quickshell harness that draws the read-out with the
**same** `MetricButton` the bar uses, in a plain window, so it runs on
any Wayland desktop and what you see is what ships:

```bash
quickshell -p dev.qml
```

Photograph states straight from a cold start:

```bash
MODULAR_HW_MONITOR_HIDDEN='mem_usage' quickshell -p dev.qml
MODULAR_HW_MONITOR_MODE=combo MODULAR_HW_MONITOR_FAKE_GPU=1 quickshell -p dev.qml
MODULAR_HW_MONITOR_GRAPHITE=1 MODULAR_HW_MONITOR_FAKE_LOAD=1 quickshell -p dev.qml
MODULAR_HW_MONITOR_WORDS=1 MODULAR_HW_MONITOR_CLOCKS=1 MODULAR_HW_MONITOR_RAM=used quickshell -p dev.qml
```

The collector runs on its own:

```bash
./scripts/sysread                      # one reading
./scripts/sysread --loop --interval 2  # stream one reading every 2 seconds
```

Set `MONITOR_HWMON_ROOT` to a directory of fake `hwmon` nodes to test
machines you do not have. Tests:

```bash
node tests/model-tests.js   # pure-logic tests
bash tests/collector-tests.sh
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
