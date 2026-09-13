# Changelog

## 2.0.0

- Monitors come in six groups (CPU, GPU, Memory, Network, Disk, Fans),
  each with its own card, switch and options in the menu. Network and
  Disk are new and start switched off.
- Every piece of a read-out has its own row in its group's card, in bar
  order. Chips add or remove what the piece draws (light Bar and Number
  and you get both), and every row ends with its own Quiet chip at the
  far right. Sub rows appear only when they apply. The global display
  modes are gone.
- The collector reads only what the bar draws (everything while the
  menu is open). It finds its sensors once, rescans every 30 readings
  and reads with shell builtins: about 10 ms of CPU per reading, down
  from about 450 ms. Its first line already carries real rates, and it
  never probes the GPU (`nvidia-smi` wakes a sleeping card) while the
  GPU group is off.
- New readings: CPU load average, GPU VRAM and power, swap, disk space
  in GiB, and disk read and write apart, each with R/W tags.
- Sources: pick the GPU (NVIDIA, AMD, Intel), the network interface and
  the disk mount; a choice that disappears falls back to the automatic
  pick.
- Fans can be renamed, hide themselves when stopped, and warm on their
  own RPM thresholds.
- Each card header shows a live preview of the group's read-out, drawn
  by the same component as the bar, or "nothing shown".
- Alert thresholds are per group; a 1.0 file's global thresholds seed
  every group. Each card has its own Reset.
- Network rates carry optional ↓/↑ arrows; the temp an optional
  thermometer and unit letter.
- Right-click cycles the clicked group's load (number, bar, both).
- The menu works from the keyboard end to end (every row and button)
  and scrolls when it is taller than the screen. The gaps and the
  refresh interval moved into its General section.
- Tooltips name the net interface, the disk mount and the GPU source,
  and never repeat a headline as a detail.
- Every reading warms on its own severity; the label warms with the
  hottest; a quiet piece never warms.
- The gauge centres on the text ink instead of the line box, so it lines
  up with the icon, and it scales with the theme font size.
- Three ink-to-ink gaps (`iconGap`, the new `partGap`, `metricGap`);
  switching a piece off never leaves a double gap.
- The menu uses Omarchy's own buttons and switches. A card header holds
  an open/closed caret, the switch and the arrows that move the group;
  an open card sits on a tinted ground with a gap below. The fan move
  buttons take their own clicks instead of toggling the fan.
- Prefs move to schema v2; a 1.0 file upgrades itself on first load.

## 1.0.0

Clean-room rewrite on a modular base:

- Three display modes (`Digits`, `Gauges`, `Combo`) with combinable
  options instead of five fixed styles: digits-with-gauges, words
  instead of glyphs, and a flat-gray `Graphite` color mode.
- Menu in sections (Metrics, View, Units & alerts) with per-row
  reordering, adjustable alert thresholds and a reset-defaults footer.
- Versioned prefs file with validation and migration of pre-1.0 state
  (legacy keys, legacy `any-monitor.json`, legacy `barStyle` values).
- Provider-organized collector emitting a versioned (`schema: 1`)
  JSON reading; node + bash test suites; cold-start harness env vars.
