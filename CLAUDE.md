# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

An Omarchy 4 (`omarchy-shell`/Quickshell) bar widget plugin. Reads `/proc` and
`/sys/class/hwmon` directly (no `lm_sensors`, no vendor tools) and shows CPU
usage/temp, GPU usage/temp, memory and every fan as independent, individually
toggleable read-outs in the bar. Plugin id:
`io.github.tymurbogach.modular-hw-monitor`.

`SPEC.md` is the authoritative behavior spec (JSON schema, metric catalog,
display modes, prefs format, migration rules) — read it before changing
behavior, not just the code. This is a clean-room rewrite (see `SPEC.md`
header): don't copy patterns from a prior implementation, derive behavior
from the spec.

## Commands

```bash
# Run the widget standalone (any Wayland desktop, no Omarchy needed — uses
# the exact same MetricButton component the real bar uses)
quickshell -p dev.qml

# Same, with cold-start state via env vars (see README "Development" section
# for the full matrix, e.g. MODULAR_HW_MONITOR_MODE, _HIDDEN, _GRAPHITE,
# _FAKE_GPU, _FAKE_LOAD, _WORDS, _CLOCKS, _RAM)
MODULAR_HW_MONITOR_MODE=combo MODULAR_HW_MONITOR_FAKE_GPU=1 quickshell -p dev.qml

# Run the collector on its own
./scripts/sysread                      # one JSON reading on stdout
./scripts/sysread --loop --interval 2  # stream one reading every N seconds
MONITOR_HWMON_ROOT=/path/to/fake/hwmon ./scripts/sysread   # test other machines

# Tests
node tests/model-tests.js     # pure-logic tests for Model/ and Styles/
bash tests/collector-tests.sh # bash collector tests, fake hwmon tree

# Lint (part of the ship gate, see SPEC.md section 8)
qmllint *.qml Menu/*.qml
omarchy-plugin-validate .
```

There is no build step; QML and JS run directly. After editing an
**installed** copy of the plugin, `omarchy plugin disable/enable` and
`omarchy-shell shell rescanPlugins` do NOT reload QML from disk — only
`omarchy-restart-shell` does.

## Architecture

**Two halves that never talk QML-to-shell directly: a bash collector and a
QML/JS UI, joined by one JSON-lines stream on stdout.**

```
scripts/sysread  --loop -->  stdout JSON lines  -->  Process/SplitParser (BarWidget.qml)
                                                          |
                                                    Metrics.parse()
                                                          |
                                                    Metrics.metrics()   (reading + prefs -> per-metric objects)
                                                          |
                                                    Metrics.orderKeys() (apply user order)
                                                          |
                                                    Modes.stripCells()  (apply hidden + display mode -> bar cells)
                                                          |
                                                     MetricButton x N    (strip in BarWidget.qml, rows in Panel.qml)
```

- **`scripts/sysread`** — single bash script (`set -u`), organized as
  provider functions (`provider_cpu_usage`, `provider_memory`,
  `provider_hwmon_temp`, `provider_fans`, `provider_gpu_{nvidia,amd,intel}`,
  `provider_clocks`, `provider_load`). Emits one `schema: 1` JSON object per
  line (`emit_reading`). Missing sensors are `null`, never a fake zero. GPU
  source is picked once at startup (`pick_gpu_source`) and cached. Accepts
  `MONITOR_HWMON_ROOT` (and `MONITOR_DRM_ROOT`) env overrides so tests and
  the harness can point it at a fake sensor tree instead of the real system.

- **`Model/Metrics.js`** — the core translation layer. `parse()` sanitizes
  one JSON line into a reading object (never throws, garbage → `EMPTY`).
  `metrics(reading, opts, prefs)` turns a reading into the ordered default
  metric catalog (CPU usage → CPU temp → GPU usage → GPU temp → Memory →
  fans), computing bar/value strings, severity ramps, glyphs, etc. per
  SPEC section 3. `orderKeys()` applies the user's saved order. `isHidden`/
  `shown()` apply the hidden-list filter. Fan display names are
  deduplicated here (`fanLabels`) — two fans with the same label get
  `(<chip>)` appended.

- **`Styles/Modes.js`** — turns an already-ordered, already-visible metric
  list into bar **cells** (`stripCells`). This is where `digits`/`gauges`/
  `combo` modes live: a cell models one click target, which is not always
  one metric — `combo` mode joins a device's usage and temp into a single
  `"joined"` cell (glyph + gauge from the usage half, digits from the temp
  half). Falls back to one dimmed placeholder cell when every metric is
  hidden, so the bar never has a zero-pixel dead slot.

- **`Model/Prefs.js`** — prefs validation/versioning. `adoptPrefs(raw)` is
  the only way prefs enter the app: it clamps thresholds, enforces
  `warn < crit`, drops unknown/malformed fields, and always returns a
  complete, valid object (corrupt file → defaults, never a blank bar).
  `migrateBarStyle()` handles the legacy `barStyle` string → `mode` +
  option-flags mapping and legacy key renames (`cpu`→`cpu_usage`, etc.),
  invoked once when the prefs file loads.

- **`Model/Tooltip.js`** / **`Model/Format.js`** / **`Model/Severity.js`** —
  tooltip text assembly, number/unit formatting (temp, clocks, GiB pairs),
  and the severity ramp (0 at warn, 1 at crit) shared by bar-color warming.

- **`BarWidget.qml`** — the plugin entry point (`bar-widget` kind). Owns
  **all** state: reads prefs from
  `~/.config/omarchy/modular-hw-monitor.json` via a watched `FileView`
  (so two bar instances/monitors stay in sync), runs the `sysread --loop`
  `Process`, and derives `allMetrics` → `orderedMetrics` → `stripModel`
  through the pipeline above. Polls every 3s normally, 1s while the menu
  is open. Every prefs mutation goes through `commit()` →
  `Prefs.adoptPrefs()` → `savePrefs()`, so nothing binds to half-written
  state. Left/middle click opens the menu; right-click cycles the mode.

- **`Panel.qml`** — the popout menu. Pure view: reads `hostWidget.prefs`/
  `orderedMetrics`, forwards clicks/keyboard back to `BarWidget.qml`'s
  functions (`toggleHidden`, `moveMetric`, `setMode`, `setFlag`,
  `stepThreshold`, `resetDefaults`). Three sections (Metrics, View,
  Units & alerts) plus a reset footer, matching SPEC section 6.

- **`MetricButton.qml`** — the one shared bar-cell component, deliberately
  **pure QtQuick with no Omarchy imports**, so both the real bar
  (`BarWidget.qml`) and the standalone harness (`dev.qml`) render pixel-
  identical output. Handles glyph/value/gauge layout (ink-box-aware
  glyph spacing, not character-cell spacing), click registration with the
  bar's hit-testing, and tooltip show/hide.

- **`dev.qml`** — a `Quickshell` `ShellRoot` harness that reconstructs the
  same pipeline (`Metrics.parse` → `Metrics.metrics` → `Modes.stripCells`)
  from env vars instead of a prefs file/live `Process`, for screenshotting
  states cold without installing the plugin.

- **`Menu/`** — small presentational subcomponents used only by
  `Panel.qml` (`MetricRow`, `Chip`, `Stepper`).

### Key invariants worth preserving when editing

- A fan is identified by stable `chip/fanN` id, never by position/index —
  reordering hwmon nodes or docking a machine must not silently hide the
  wrong fan.
- `null` means "sensor unavailable," and must never be coerced to `0` or
  hidden as a fake reading — a stopped fan (`0` RPM) is a different,
  legitimate state from a missing one (`null`).
- Prefs always flow through `Prefs.adoptPrefs()`; never assign a raw
  parsed/user object straight to `BarWidget.qml`'s `prefs` property.
- `Model/*.js` and `Styles/Modes.js` are plain scripts (top-level `var`/
  `function`, no `import`/`export`) intentionally so they load identically
  in the QML JS engine, the Quickshell harness, and Node's `vm` sandbox in
  `tests/model-tests.js` — don't introduce ES module syntax there.
- `MetricButton.qml` must stay free of Omarchy-specific imports/types —
  that's what keeps `dev.qml` a faithful, installable-Omarchy-free preview.

## Working rules for agents in this repo

- **Language split.** Code, comments, docs, commit messages and PR text stay
  in English — this matches the project's own stated policy (`SPEC.md`
  section 9: "Language: English everywhere"). Conversation with the human
  maintainer happens in whatever language they use with you; it never leaks
  into files.

- **Use the `omarchy` skill/CLI for anything Omarchy-side.** Installing,
  enabling, disabling, removing, updating or validating the plugin,
  restarting the shell, or inspecting `~/.config/omarchy/` state should
  always go through the real tooling — never hand-edit shell state or guess
  at behavior:
  ```bash
  omarchy plugin validate <plugin-folder>   # manifest schema check
  omarchy plugin add <git-url-or-path> --enable --yes
  omarchy plugin disable io.github.tymurbogach.modular-hw-monitor
  omarchy plugin remove io.github.tymurbogach.modular-hw-monitor --yes
  omarchy plugin update io.github.tymurbogach.modular-hw-monitor
  omarchy-shell shell rescanPlugins
  omarchy-restart-shell
  ```
  Never edit anything under `/usr/share/omarchy/` — it's package-owned and
  read-only; reading it for reference is fine.

- **Verify substantial changes with a real remove/reinstall cycle**, not
  just `qmllint`/the unit tests. Any change to the collector JSON schema,
  the prefs format/migration, `manifest.json`, or a QML entry point needs:
  1. `omarchy plugin validate` on the plugin folder — must pass clean.
  2. `omarchy plugin disable io.github.tymurbogach.modular-hw-monitor` then
     `omarchy plugin remove io.github.tymurbogach.modular-hw-monitor --yes`.
  3. Confirm `~/.config/omarchy/plugins/io.github.tymurbogach.modular-hw-monitor/`
     is fully gone afterwards — no leftover files, caches, or stray state
     from the previous version. This is "no queda basura": a clean remove
     must leave nothing behind but the user's own
     `~/.config/omarchy/modular-hw-monitor.json` (which the README already
     documents as separately removable).
  4. Reinstall — via `omarchy plugin add <repo> --enable --yes`, or by hand
     (drop the folder under `~/.config/omarchy/plugins/<id>/`,
     `omarchy-shell shell rescanPlugins`, `omarchy plugin enable <id>`) when
     testing local, not-yet-pushed changes — then `omarchy-restart-shell`,
     since editing an already-loaded plugin's QML is **not** picked up by
     disable/enable or `rescanPlugins` alone (see README "A note on
     reloading").
  5. Confirm the bar renders correctly from a cold start, the menu opens,
     and prefs seed/migrate as expected. The goal is proving a *fresh*
     install behaves correctly end-to-end, not just that the diff compiles.

- **Keep it eligible for the official Omarchy plugin marketplace
  (https://plugins.omarchy.org) and repo.** Confirmed requirements from the
  marketplace's own publish page (`plugins.omarchy.org/publish.html`):
  - A public GitHub repository (this one:
    `github.com/tymurbogach/omarchy-modular-hw-monitor`).
  - A valid `manifest.json` at the repo root with `schemaVersion`, `id`,
    `name`, `version`, `author`, `description`, `kinds`, `entryPoints` —
    all already present; keep them accurate on every release.
  - README and license documentation (`README.md`, `LICENSE`) — keep both
    in sync with behavior changes; keep the MIT license intact.
  - Safe install *and* removal (the README's "Install"/"Remove" sections
    already cover this — don't regress them).
  - Optional preview image (`preview.png`) — keep it representative of the
    current UI when the bar's visual output changes.
  - `manifest.json` must always pass `omarchy plugin validate` (correct
    `schemaVersion`, all required fields, entry points that actually exist,
    no symlinks, a non-reserved id) and keep the reverse-DNS id already in
    use (`io.github.tymurbogach.modular-hw-monitor`).
  - Submission itself (when the maintainer decides to (re)submit) is a
    GitHub issue against
    `github.com/omacom/omarchy-plugin-marketplace/issues/new?template=submit-plugin.yml`
    with the repo link, category and tags, after validating locally and
    after automated checks run against the current commit — this is on the
    maintainer to trigger, not something to do unprompted.
  - Don't add runtime dependencies beyond `bash` (README "Requirements": no
    `lm_sensors`, no vendor tools, no privileged calls) — the marketplace
    reviews the repo, not a sandboxed build, so what ships in the repo is
    exactly what a reviewer and every installer sees and runs.

- **Stay clean and modular, always.** No dead code, no leftover debug flags
  or env vars, no half-finished providers or QML files. New functionality
  belongs in the existing layering — a provider function in `sysread`, a
  field in the `Metrics.js` schema, cell logic in `Modes.js`, a view in
  `Panel.qml`/`Menu/` — rather than a new ad-hoc path next to it. Don't
  leave temp fixtures, fake hwmon trees, or scratch files inside the repo;
  tests already use `mktemp` for that, follow the same pattern for any new
  manual/test fixture.

- **No AI attribution in commits or PRs.** Do not add "Co-Authored-By:
  Claude" (or any Claude/Claude Code byline, generated-with footer, etc.)
  to commit messages or pull request descriptions in this repo — author
  everything as the maintainer, full stop.
