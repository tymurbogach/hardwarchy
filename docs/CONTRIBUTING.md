# Contributing to Hardwarchy

Hardwarchy is an Omarchy 4 (`omarchy-shell`, Quickshell) bar widget
plugin. It reads `/proc` and `/sys/class/hwmon` directly (no
`lm_sensors`, no vendor tools). It shows CPU, GPU, memory, network, disk
and every fan as independent read-outs that you switch on one by one.
Plugin id: `io.github.tymurbogach.hardwarchy`.

`SPEC.md` is the authoritative behavior spec: JSON schema, metric
catalog, cells, prefs format and migration rules. Read it before you
change behavior. The tree is a clean-room rewrite (see the `SPEC.md`
header): derive behavior from the spec, not from a prior implementation.

## Commands

```bash
# Run the widget standalone (any Wayland desktop, no Omarchy needed).
# It draws with the same MetricButton component as the real bar.
quickshell -p dev.qml

# Same, with cold-start state from env vars (README "Development" lists
# them all: HARDWARCHY_PARTS, _ENABLE, _HIDDEN, _COLOR, _FAKE_GPU,
# _FAKE_LOAD, _FONT)
HARDWARCHY_PARTS='cpu.load=bar,number' HARDWARCHY_FAKE_GPU=1 quickshell -p dev.qml

# Run the collector on its own
./scripts/sysread                      # one JSON reading on stdout
./scripts/sysread --loop --interval 2  # one reading every N seconds
./scripts/sysread --info               # the static facts the menu shows
./scripts/update check                 # the version on the remote's HEAD
MONITOR_HWMON_ROOT=/path/to/fake/hwmon ./scripts/sysread   # other machines

# Tests
node tests/model-tests.js     # pure-logic tests for Model/ and Styles/
bash tests/collector-tests.sh # bash collector tests, fake hwmon tree
bash tests/update-tests.sh    # update check/apply, throwaway git remote

# Lint (part of the ship gate, SPEC.md section 8)
qmllint -I /usr/share/omarchy/shell *.qml Menu/*.qml
omarchy plugin validate .
```

There is no build step: QML and JS run directly. After you edit an
installed copy of the plugin, `omarchy plugin disable`/`enable` and
`omarchy-shell shell rescanPlugins` do not reload QML from disk. Only
`omarchy-restart-shell` does.

## Architecture

A bash collector and a QML/JS UI, joined by one JSON-lines stream on
stdout. The two halves never call each other directly.

```
scripts/sysread  --loop -->  stdout JSON lines  -->  Process/SplitParser (BarWidget.qml)
                                                          |
                                                    Metrics.parse()
                                                          |
                                                    Metrics.metrics()   (reading + prefs -> per-metric objects)
                                                          |
                                                    Metrics.orderKeys() (apply user order)
                                                          |
                                                    Metrics.shown() + metricsGroupRuns() (hide, cluster per group)
                                                          |
                                                    Modes.groupStripCells() (group parts -> cells of pieces)
                                                          |
                                                     MetricButton x N    (strip in BarWidget.qml and dev.qml)
```

- **`scripts/sysread`**: one bash script (`set -u`), organized as
  provider functions (`provider_cpu_usage`, `provider_memory`,
  `provider_hwmon_temp`, `provider_fans`, `provider_gpu_{nvidia,amd,intel}`,
  `provider_clocks`, `provider_load`, `provider_net`, `provider_disk_*`).
  It emits one `schema: 2` JSON object per line (`emit_reading`). A
  missing sensor is `null`, never a fake zero. `scan_sensors` finds the
  sensor files at startup and every 30 readings; builtins read them.
  Do not add a per-reading fork (`$(...)`, awk, date, sleep) without a
  measurement. `MONITOR_READ` (from `Metrics.metricsReadList`, `all`
  while the menu is open) names the providers to run, so what is off is
  not read. `pick_gpu_source` picks the GPU source once at startup. The
  `MONITOR_HWMON_ROOT` and `MONITOR_DRM_ROOT` overrides point the tests
  at a fake sensor tree. The widget hands down the menu's source choices
  the same way (`MONITOR_GPU`, `MONITOR_NET_IFACE`, `MONITOR_ROOT_MOUNT`),
  and the JSON lists what the menu can offer (`gpu_sources`,
  `net.ifaces`, `disk.mounts`). `sysread --info` prints the facts that
  never change (DMI names, CPU topology, GPU names from `pci.ids`,
  drives) once, for the menu; `MONITOR_INFO_ROOT` points it at a fake
  machine.

- **`scripts/update`**: `check` fetches the remote's HEAD and prints its
  manifest version; `apply` runs `omarchy plugin update` and restarts
  the shell when the clone moved. The menu's update button runs `apply`
  in a floating terminal.

- **`Model/Metrics.js`**: the core translation layer. `parse()`
  sanitizes one JSON line into a reading object: it never throws, and
  garbage becomes `EMPTY`. `metrics(reading, prefs)` turns a reading
  into the ordered metric catalog (SPEC section 3), with bar and value
  strings, severity ramps and glyphs. Number formatting and the severity
  ramp (0 at warn, 1 at crit) live here. `orderKeys()` applies the saved
  order. `metricsEffectiveHidden()` and `shown()` drop what draws
  nothing, and `metricsReadList()` names the collector providers behind
  what draws. `fanLabels` deduplicates fan names: two fans with the same
  label get `(<chip>)` appended.

- **`Styles/Modes.js`**: turns per-group runs of visible metrics into
  bar **cells** (`groupCells`, `groupStripCells`). There is one cell per
  group (one per fan), and each cell is a click target. A cell is a list
  of **pieces** (`mark`, `gauge`, `text`, each with its gap, pad, quiet
  flag and own severity), built from the group's parts (see `Prefs.js`).
  So MetricButton only draws data. `cycleLoadPatch()` is the
  right-click. When every metric is hidden, it returns one dimmed
  placeholder cell, so the bar never has a zero-pixel dead slot.

- **`Model/Prefs.js`**: prefs validation and versioning.
  `adoptPrefs(raw)` is the only way prefs enter the app. It clamps
  thresholds, enforces `warn < crit`, drops unknown or malformed fields,
  and always returns a complete, valid object (a corrupt file gives
  defaults, never a blank bar). `prefsUpgradeV1ToV2()` handles the v1
  shape, the legacy `barStyle` mapping and legacy key renames
  (`cpu`→`cpu_usage`, etc.). `prefsUpgradeModes()` and
  `prefsUpgradeWords()` handle the two pre-release drafts of v2.

- **`Model/Info.js`**: the menu facts. `infoSystemLines()` names the
  machine, kernel and uptime; `infoRows(id, info, reading)` gives the
  facts at the top of a card, for the source the reading follows;
  `infoNewerVersion()` compares versions for the update button.

- **`Model/Tooltip.js`**: tooltip text. One headline per metric of a
  cell, then the group's details once, never a repeated headline.

- **`BarWidget.qml`**: the plugin entry point (`bar-widget` kind). It
  owns all state. It reads prefs from `~/.config/omarchy/hardwarchy.json`
  through a watched `FileView`, so two bar instances stay in sync.
  Without that file, it adopts the newest file from before a rename
  (`legacyNames`). It runs the `sysread --loop` `Process` and derives
  `allMetrics` → `orderedMetrics` → `stripModel` through the pipeline
  above. It polls every `refresh` seconds (3 by default), and every
  second while the menu is open. The first open runs `sysread --info`
  once; every open may run `scripts/update check` (at most every 6 h).
  It restarts the collector once per
  change (through `Qt.callLater`) with the menu's GPU, interface, mount
  and read list (`MONITOR_READ`). Every prefs change goes through
  `commit()` → `Prefs.adoptPrefs()` → `savePrefs()`, so nothing binds to
  half-written state. Left or middle click opens the menu; right-click
  cycles that group's load.

- **`Panel.qml`**: the popout menu, a pure view. It reads
  `hostWidget.prefs` and `orderedMetrics` and forwards clicks and keys to
  the functions of `BarWidget.qml` (`patchGroup`, `resetGroup`,
  `stepGroupLimit`, `previewCells`, `moveGroup`, `toggleFanHidden`,
  `renameFan`, `moveFan`, `setUnit`, `stepColorIntensity`, `stepGap`,
  `stepRefresh`, `resetDefaults`, `runUpdate`). The title carries the
  version and the update button, two lines name the machine. There is
  one card per group: a header
  with a live preview, the hardware facts (`Menu/InfoRow`), one row per
  cell piece (rows as data in
  `rowsFor`/`buttonsOf`, one flat `navItems` list for the keyboard),
  then a General section (SPEC section 6). Cards and rows repeat over
  stable ids, not per-reading arrays, so a reading or a click does not
  rebuild them.

- **`MetricButton.qml`**: the one shared bar-cell component. It is pure
  QtQuick with no Omarchy imports, so the real bar (`BarWidget.qml`),
  the harness (`dev.qml`) and the menu's header preview draw identical
  pixels. It lays out a cell's `pieces` with ink-to-ink gaps (not
  character-cell spacing), centres the gauge on the digit ink, colors
  each piece by its own severity, and handles clicks and the tooltip.

- **`dev.qml`**: a Quickshell `ShellRoot` harness. It rebuilds the same
  pipeline (`Metrics.parse` → `Metrics.metrics` → `Modes.groupStripCells`)
  from env vars instead of a prefs file, so any state photographs cold
  without an installed plugin.

- **`Menu/`**: small presentational parts used only by `Panel.qml`
  (`GroupCard`, `InfoRow`, `SettingRow`, `LimitRow`, `MetricRow`,
  `Stepper`).

### Invariants

- A fan is identified by its stable `chip/fanN` id, never by its
  position. If hwmon nodes reorder or the machine docks, the wrong fan
  must not hide.
- `null` means "sensor unavailable". Never coerce it to `0` or show it
  as a fake reading. A stopped fan (`0` RPM) is a legitimate state,
  different from a missing one (`null`).
- Prefs always flow through `Prefs.adoptPrefs()`. Never assign a raw
  parsed or user object to the `prefs` property of `BarWidget.qml`.
- `Model/*.js` and `Styles/Modes.js` are plain scripts (top-level
  `var`/`function`, no `import`/`export`). They load identically in the
  QML JS engine, the Quickshell harness and the Node `vm` sandbox of
  `tests/model-tests.js`. Do not add ES module syntax there.
- `MetricButton.qml` stays free of Omarchy imports and types. That keeps
  `dev.qml` a faithful preview without an Omarchy install.

## Working rules

- **Language.** Code, comments, docs, commit messages and PR text are
  English (`SPEC.md` section 9).

- **Omarchy through its CLI.** Install, enable, disable, remove, update
  and validate the plugin, and restart the shell, with the real tooling.
  Do not hand-edit shell state:
  ```bash
  omarchy plugin validate <plugin-folder>   # manifest schema check
  omarchy plugin add <git-url-or-path> --enable --yes
  omarchy plugin disable io.github.tymurbogach.hardwarchy
  omarchy plugin remove io.github.tymurbogach.hardwarchy --yes
  omarchy plugin update io.github.tymurbogach.hardwarchy
  omarchy-shell shell rescanPlugins
  omarchy-restart-shell
  ```
  Never edit anything under `/usr/share/omarchy/`. The package owns it.
  Reading it for reference is fine.

- **Verify a substantial change with a real remove and reinstall.**
  `qmllint` and the unit tests are not enough. A change to the collector
  JSON schema, the prefs format or migration, `manifest.json` or a QML
  entry point needs this cycle:
  1. Run `omarchy plugin validate` on the plugin folder. It must pass
     clean.
  2. Run `omarchy plugin disable io.github.tymurbogach.hardwarchy`, then
     `omarchy plugin remove io.github.tymurbogach.hardwarchy --yes`.
  3. Confirm that `~/.config/omarchy/plugins/io.github.tymurbogach.hardwarchy/`
     is gone: no leftover files, caches or state. A clean remove leaves
     only the user's own `~/.config/omarchy/hardwarchy.json`, which the
     README documents as separately removable.
  4. Reinstall with `omarchy plugin add <repo> --enable --yes`. For
     local commits that are not pushed yet, give the path of the local
     clone: `plugin add` clones it, so the install holds exactly the
     committed tree. Then run `omarchy-restart-shell`, because
     disable/enable and `rescanPlugins` do not reload loaded QML.
  5. Confirm from a cold start that the bar renders, the menu opens,
     and prefs seed or migrate as expected.

- **Stay eligible for the Omarchy plugin marketplace**
  (https://plugins.omarchy.org). The requirements, from its publish page
  and `SUBMISSION.md`:
  - A public GitHub repository: `github.com/tymurbogach/hardwarchy`.
  - A valid root `manifest.json` with `schemaVersion`, `id`, `name`,
    `version`, `author`, `description`, `kinds` and `entryPoints`. Keep
    them accurate on every release. The id stays
    `io.github.tymurbogach.hardwarchy`: marketplace ids are permanent.
  - A root `README.md` with install and removal instructions, and the
    MIT `LICENSE`. Keep both in sync with behavior.
  - An optional root `preview.png`. The marketplace shows only this one
    image, so it stays a composite of bar variants and the menu. Refresh
    it, and the README gallery in `docs/images/`, when the bar's look
    changes.
  - `omarchy plugin validate` passes: correct `schemaVersion`, every
    required field, entry points that exist, no symlinks, no reserved
    `omarchy.*` id.
  - No agent instruction files in the tree (`CLAUDE.md`, `AGENTS.md` and
    the like). The marketplace review rejects them, because an
    installed plugin root would feed them to coding agents as ambient
    instructions. Contributor notes live here, in `docs/`.
  - No runtime dependency beyond `bash` (README "Requirements"): no
    `lm_sensors`, no vendor tools, no privileged calls. Reviewers and
    installers run exactly what the repository holds.
  - The maintainer submits, or updates, a listing through an issue on
    `github.com/omacom/omarchy-plugin-marketplace`, after local
    validation.

- **Stay clean and modular.** No dead code, no leftover debug flags or
  env vars, no half-finished providers or QML files. New functionality
  goes into the existing layers: a provider function in `sysread`, a
  field in the `Metrics.js` schema, cell logic in `Modes.js`, a view in
  `Panel.qml` or `Menu/`. Do not leave temp fixtures, fake hwmon trees
  or scratch files in the repository. The tests use `mktemp` for them;
  follow the same pattern.

- **Commits.** English, imperative, one concern per commit, authored by
  the maintainer. No tool bylines, no `Co-Authored-By` lines for tools,
  no generated-with footers in commits or PR descriptions.
