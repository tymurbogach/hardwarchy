import QtQuick
import Quickshell
import Quickshell.Io
import qs.Commons
import qs.Ui
import "Model/Metrics.js" as Metrics
import "Model/Prefs.js" as Prefs
import "Model/Tooltip.js" as Tips
import "Styles/Modes.js" as Modes

BarWidget {
  id: root
  moduleName: "io.github.tymurbogach.modular-hw-monitor"

  readonly property bool opened: panelLoader.item
    ? panelLoader.item.opened === true
    : false
  readonly property bool popoutSwitchClosing: panelLoader.item
    ? panelLoader.item.popoutSwitchClosing === true
    : false

  property var reading: Metrics.EMPTY

  // One prefs object, always valid: every setter clones through
  // adoptPrefs (which revalidates) and then saves. Nothing binds to
  // half-written state.
  property var prefs: Prefs.adoptPrefs({})

  // The GLOBAL fallback every group uses while its own mode is "inherit".
  // A vertical bar still forces digits everywhere, same as before.
  readonly property string defaultMode:
    root.vertical ? "digits" : Modes.normalizeMode(root.prefs.defaultMode)

  function groupMode(id) {
    if (root.vertical) return "digits"
    var g = root.prefs.groups[id]
    var m = (g && g.mode) || "inherit"
    return m === "inherit" ? root.defaultMode : Modes.normalizeMode(m)
  }

  // Only cpu/gpu have a "show clocks" option, and it only applies in
  // digits mode — Metrics.metrics() needs each one's resolved mode to
  // decide that, ahead of building the metric list itself.
  readonly property var groupModes: ({ cpu: root.groupMode("cpu"), gpu: root.groupMode("gpu") })

  // The menu reads everything through the widget, so two bar instances
  // (two monitors) stay in step via the watched prefs file.
  readonly property var allMetrics: Metrics.metrics(root.reading, root.groupModes, root.prefs)
  readonly property var orderedMetrics: Metrics.orderKeys(root.allMetrics,
    Metrics.metricsExpandGroupOrder(root.prefs.order, root.prefs.groups.fan.order))
  readonly property var effectiveHidden: Metrics.metricsEffectiveHidden(root.orderedMetrics, root.prefs)
  readonly property var visibleMetrics: Metrics.shown(root.orderedMetrics, root.effectiveHidden)
  // Icon vs word is a per-group choice (each device picks its own —
  // there's no single icon everyone agrees reads as "RAM", for one), so
  // this builds each group's own opts instead of sharing one globally.
  function groupModeOpts(id) {
    var g = root.prefs.groups[id]
    return { showDigits: root.prefs.showDigits, wordLabels: !!(g && g.wordLabel) }
  }

  // One display mode per group: cluster the visible list into contiguous
  // per-device runs, build each run's cells with THAT group's own
  // effective mode, then concatenate — this is what lets CPU run as a
  // bar while Network runs as plain numbers at the same time.
  readonly property var stripModel: {
    var runs = Metrics.metricsGroupRuns(root.visibleMetrics)
    var out = []
    for (var i = 0; i < runs.length; i++) {
      var run = runs[i]
      out = out.concat(Modes.buildStripCells(run.items, root.groupMode(run.device), root.groupModeOpts(run.device)))
    }
    if (out.length === 0) {
      out.push({ cell: "metric", key: "placeholder", metric: Metrics.PLACEHOLDER, bare: false })
    }
    return out
  }
  readonly property bool empty: root.visibleMetrics.length === 0

  // ---- appearance ---------------------------------------------------
  property real iconGap: root.setting("iconGap", 2)
  property real metricGap: root.setting("metricGap", 10)
  readonly property real outerMargin: Math.max(0, 8.5 - root.metricGap / 2)

  // Urgent color with a transparency guard: an unthemed urgent arrives
  // transparent, and warming toward that would fade the read-out out.
  readonly property color hot: {
    var u = root.bar ? root.bar.urgent : Color.urgent
    return u.a > 0 ? u : Color.urgent
  }
  // 0-100: how much a hot reading warms toward `hot`. At 0 nothing ever
  // warms (the old "Graphite" mode's effect, without a flat custom gray —
  // foreground just stays the theme's own foreground). At 100, a
  // reading right at the critical threshold reaches `hot` fully, same as
  // the old "Auto" mode. Values in between scale the blend, not the
  // threshold — a cell either warms a little or a lot, it doesn't reach
  // full color later.
  readonly property real colorIntensity: root.prefs.colorIntensity / 100

  function warm(from, amount) {
    var scaled = (amount || 0) * root.colorIntensity
    if (!(scaled > 0)) return from
    var t = Math.min(1, scaled)
    return Qt.rgba(from.r + (hot.r - from.r) * t,
                   from.g + (hot.g - from.g) * t,
                   from.b + (hot.b - from.b) * t,
                   from.a)
  }

  function open() { if (panelLoader.item) panelLoader.item.open() }
  function close() { if (panelLoader.item) panelLoader.item.close() }
  function toggle() { if (panelLoader.item) panelLoader.item.toggle() }
  function closeForPopoutSwitch() {
    if (panelLoader.item) panelLoader.item.closeForPopoutSwitch()
  }

  function injectPanel() {
    if (!panelLoader.item) return
    panelLoader.item.bar = root.bar
    panelLoader.item.anchorItem = panelAnchor
    panelLoader.item.hostWidget = root
  }

  implicitWidth: Math.max(12, strip.implicitWidth + Style.spaceReal(root.outerMargin) * 2)
  implicitHeight: root.vertical
    ? Math.max(12, strip.implicitHeight + Style.spaceReal(root.outerMargin) * 2)
    : root.barSize

  onBarChanged: injectPanel()

  // ---- preferences, on disk -----------------------------------------
  // shell.json is rewritten wholesale by `omarchy refresh shell` with no
  // post-refresh hook, so prefs live in their own watched file. Two bar
  // instances (two monitors) follow each other through watchChanges.
  readonly property string prefsPath:
    Quickshell.env("HOME") + "/.config/omarchy/modular-hw-monitor.json"
  property string legacyPath: ""

  function commit(next) {
    root.prefs = Prefs.adoptPrefs(next)
    root.savePrefs()
  }

  function savePrefs() {
    prefsFile.setText(Prefs.serialize(root.prefs) + "\n")
  }

  // Fan hidden/reorder stay their own thing, nested under the Fans card —
  // every other group is shown/hidden wholesale via setGroupEnabled.
  function toggleFanHidden(key) {
    if (!key) return
    var p = Prefs.adoptPrefs(root.prefs)
    var list = p.groups.fan.hidden
    var out = []
    var found = false
    for (var i = 0; i < list.length; i++) {
      if (list[i] === key) found = true
      else out.push(list[i])
    }
    if (!found) out.push(key)
    p.groups.fan.hidden = out
    root.commit(p)
  }

  // Reorder fans by swapping neighbours in the current visible fan order,
  // then storing the full fan order so it survives fans coming and going.
  function moveFan(key, delta) {
    var keys = []
    for (var i = 0; i < root.orderedMetrics.length; i++)
      if (root.orderedMetrics[i].device === "fan") keys.push(root.orderedMetrics[i].key)
    var at = keys.indexOf(key)
    var to = at + delta
    if (at < 0 || to < 0 || to >= keys.length) return
    var tmp = keys[at]
    keys[at] = keys[to]
    keys[to] = tmp
    var p = Prefs.adoptPrefs(root.prefs)
    p.groups.fan.order = keys
    root.commit(p)
  }

  // Master on/off for a whole monitor group (CPU, RAM, GPU, Net, Disk,
  // Fans). Reordering the groups themselves is moveGroup, below.
  function setGroupEnabled(id, on) {
    var p = Prefs.adoptPrefs(root.prefs)
    if (p.groups[id]) p.groups[id].enabled = on === true
    root.commit(p)
  }

  // Per-group display mode ("inherit" defers to defaultMode).
  function setGroupMode(id, mode) {
    var p = Prefs.adoptPrefs(root.prefs)
    if (p.groups[id]) p.groups[id].mode = mode
    root.commit(p)
  }

  // Generic setter for a group's own sub-options (showUsage, showTemp,
  // showClocks, ramFormat, showIo, adapter, showRpm) — one function
  // instead of one setter per option, since they're all "flip this field
  // on this group's config object".
  function setGroupOption(id, key, value) {
    var p = Prefs.adoptPrefs(root.prefs)
    if (p.groups[id]) p.groups[id][key] = value
    root.commit(p)
  }

  function moveGroup(id, delta) {
    var order = root.prefs.order.slice()
    var at = order.indexOf(id)
    var to = at + delta
    if (at < 0 || to < 0 || to >= order.length) return
    var tmp = order[at]
    order[at] = order[to]
    order[to] = tmp
    var p = Prefs.adoptPrefs(root.prefs)
    p.order = order
    root.commit(p)
  }

  function setDefaultMode(value) {
    var p = Prefs.adoptPrefs(root.prefs)
    p.defaultMode = Modes.normalizeMode(value)
    root.commit(p)
  }

  function cycleMode() { root.setDefaultMode(Modes.nextMode(root.prefs.defaultMode)) }

  function setUnit(value) {
    var p = Prefs.adoptPrefs(root.prefs)
    p.unit = (value === "F") ? "F" : "C"
    root.commit(p)
  }

  function setFlag(name, value) {
    var p = Prefs.adoptPrefs(root.prefs)
    p[name] = value === true
    root.commit(p)
  }

  function stepThreshold(name, delta) {
    var p = Prefs.adoptPrefs(root.prefs)
    if (typeof p[name] === "number") p[name] = Math.round(p[name] + delta)
    root.commit(p)
  }

  function resetDefaults() { root.commit({}) }

  // Only reached before the prefs file exists: shell.json seeds the
  // first run, then the file is what counts.
  function seedPrefs() {
    root.commit({
      hidden: root.setting("hidden", []),
      unit: root.setting("unit", "C"),
      showRpm: root.setting("showRpm", false),
      mode: root.setting("mode", root.setting("barStyle", "digits")),
      showDigits: root.setting("showDigits", true),
      wordLabels: root.setting("wordLabels", false),
      colorMode: root.setting("colorMode", "auto"),
      showClocks: root.setting("showClocks", false),
      ramFormat: root.setting("ramFormat", "percent")
    })
  }

  FileView {
    id: prefsFile
    path: root.prefsPath
    watchChanges: true
    atomicWrites: true
    printErrors: false
    onLoaded: root.commit(text())
    onLoadFailed: {
      root.seedPrefs()
      root.legacyPath = Quickshell.env("HOME") + "/.config/omarchy/any-monitor.json"
    }
    onFileChanged: reload()
  }

  // A pre-rename state file still counts, and is re-saved under the
  // new name on first sight.
  FileView {
    id: legacyPrefs
    path: root.legacyPath
    watchChanges: false
    atomicWrites: false
    printErrors: false
    onLoaded: {
      root.commit(text())
    }
  }

  // ---- clicks ---------------------------------------------------------
  // Left opens the menu, right cycles the mode, middle opens the menu
  // too. Folding lives in the menu, where every switch names what it
  // toggles.
  function metricPressed(key, button) {
    if (button === Qt.RightButton) { root.cycleMode(); return }
    root.toggle()
  }

  // ---- collector ------------------------------------------------------
  // Slow-moving numbers: poll lazily until the menu is open.
  readonly property int pollSeconds: opened ? 1 : 3
  readonly property string readerPath:
    String(Qt.resolvedUrl("scripts/sysread")).replace("file://", "")

  // A restarted collector always primes its delta-based fields (cpu%,
  // and gpu% on the Intel backend) back to null on its very first line —
  // set whenever the poll interval changes (opening/closing the menu
  // restarts the process below), consumed once by the next reading.
  property bool primingAfterRestart: false

  Process {
    id: reader
    command: [root.readerPath, "--loop", "--interval", String(root.pollSeconds)]
    running: true

    stdout: SplitParser {
      onRead: data => {
        const parsed = Metrics.parse(data)
        if (!Metrics.hasReading(parsed)) return
        // Keep the last good reading rather than flashing blanks, and
        // paper over the one-line null blip a deliberate restart causes.
        root.reading = root.primingAfterRestart
          ? Metrics.mergeReading(root.reading, parsed)
          : parsed
        root.primingAfterRestart = false
      }
    }
  }

  onPollSecondsChanged: {
    reader.running = false
    reader.command = [root.readerPath, "--loop", "--interval", String(pollSeconds)]
    root.primingAfterRestart = true
    reader.running = true
  }

  Loader {
    id: panelLoader
    active: true
    source: Qt.resolvedUrl("Panel.qml")
    visible: false
    onLoaded: {
      root.injectPanel()
      Qt.callLater(root.injectPanel)
    }
  }

  // ---- the read-out ---------------------------------------------------
  readonly property real cardWidth: panelLoader.item ? panelLoader.item.cardWidth : 0
  readonly property real cardHeight: panelLoader.item ? panelLoader.item.cardHeight : 0

  // KeyboardPanel always centres its card on the anchor, which slides
  // the card sideways whenever a metric is folded away. The anchor is
  // given the card's own width at the strip's leading edge, so the
  // formula collapses and the card unfolds from the first metric.
  Item {
    id: panelAnchor
    anchors.left: strip.left
    anchors.top: strip.top
    width: root.vertical
      ? strip.width
      : (root.cardWidth > 0 ? root.cardWidth : strip.width)
    height: root.vertical
      ? (root.cardHeight > 0 ? root.cardHeight : strip.height)
      : strip.height
  }

  Grid {
    id: strip
    anchors.centerIn: parent
    // One row across a horizontal bar, one column down a vertical one.
    columns: root.vertical ? 1 : Math.max(1, root.stripModel.length)
    rows: root.vertical ? Math.max(1, root.stripModel.length) : 1

    Repeater {
      model: root.stripModel

      delegate: MetricButton {
        required property var modelData

        // A cell is one click target whatever it draws. `joined` always
        // carries the usage half's glyph together with the temp half's
        // digits — whether that usage half itself draws as a bar or a
        // plain number follows `gaugeFirst` (the group's own mode); the
        // exact usage figure lives in the tooltip either way.
        readonly property bool isJoined: modelData.cell === "joined"
        readonly property var cellMetric: isJoined ? modelData.usage : modelData.metric
        readonly property bool isGauge: modelData.cell === "gauge"
          || (isJoined && modelData.gaugeFirst === true)
        // Joined severity is the hotter half: a cool load on a hot
        // chip still deserves to read warm.
        readonly property real cellSeverity: {
          if (isJoined)
            return Math.max(modelData.usage.severity || 0, modelData.temp.severity || 0)
          return (cellMetric && cellMetric.severity) || 0
        }
        readonly property color base:
          root.bar ? root.bar.barForeground : Color.foreground
        readonly property string cellDevice: isJoined ? modelData.usage.device : (cellMetric ? cellMetric.device : "")
        // Only cpu/gpu carry a temp half with its own primary/secondary
        // choice — net's "up" or disk's "io" are never a temperature,
        // even though they can join a cell the same way. A *lone* temp
        // cell (its usage half hidden) draws itself as `value`, so it
        // uses the pad-whole-value trick below; a *joined* cell's temp
        // always rides in `trailValue` instead (see tempTrailSecondary),
        // so it never reaches this branch.
        readonly property bool isTempCell: !isJoined && (cellDevice === "cpu" || cellDevice === "gpu")
          && cellMetric && cellMetric.kind === "temp"
        readonly property bool tempIsSecondary: {
          var g = root.prefs.groups[cellDevice]
          return !!(g && g.tempColor === "secondary")
        }
        // The word-mode label is the group's own short name (CPU, GPU,
        // RAM, Net, Disk) — never a metric's own long label ("CPU
        // usage") — so it stays a compact identifier next to the fused
        // reading. Fans are the one multi-instance group, so a fan's own
        // label ("Fan 1", "Fan 2 (thinkpad)") is what identifies it.
        readonly property string wordLabelText: cellDevice === "fan"
          ? (cellMetric ? cellMetric.label : "")
          : (Metrics.GROUP_LABELS[cellDevice] || (cellMetric ? cellMetric.label : ""))

        bar: root.bar
        glyph: cellMetric ? cellMetric.glyph : ""
        showGlyph: modelData.bare !== true
        gaugeRatio: isGauge && cellMetric && typeof cellMetric.ratio === "number"
          ? cellMetric.ratio : -1
        value: {
          if (!cellMetric) return ""
          if (modelData.cell === "gauge" && !modelData.withDigits) return ""
          if (isJoined) {
            // Words mode: the label replaces the icon; the fused temp
            // still trails wordlessly either way (see trailValue).
            if (modelData.bare === true) return wordLabelText + " " + modelData.usage.bar
            // Gauge: usage is drawn as the bar itself, no usage digits.
            return isGauge ? "" : modelData.usage.bar
          }
          // Words mode: the words ARE the read-out.
          if (modelData.bare === true) return wordLabelText + " " + cellMetric.bar
          return cellMetric.bar
        }
        // Joined cells always fuse the temp half right after usage, with
        // no word/separator between them (never falls back to "CPU temp")
        // — only the joined case gets a trailValue at all. A small
        // trailGap (below) keeps the two halves near but not glued.
        trailValue: isJoined ? modelData.temp.bar : ""
        trailSecondary: isJoined && tempIsSecondary
        padLen: {
          if (isTempCell && tempIsSecondary) return value.length
          // The zero-pad only makes sense right after the icon — once a
          // word label is showing, the leading digit isn't at a fixed
          // offset in `value` any more, so there's nothing to grey out.
          if (modelData.bare === true) return 0
          if (isJoined) return (!isGauge && modelData.usage.padLen) || 0
          return (cellMetric && cellMetric.padLen) || 0
        }
        secondaryColor: Color.muted
        dimmed: cellMetric ? cellMetric.dim === true : true
        vertical: root.vertical
        slotSize: root.vertical ? 0 : root.barSize

        fontFamily: root.bar ? root.bar.fontFamily : Style.font.family
        fontSize: Style.font.body
        foreground: root.warm(base, cellSeverity)

        iconGap: Style.spaceReal(root.iconGap)
        trailGap: Style.spaceReal(root.iconGap)
        sideMargin: Style.spaceReal(root.metricGap / 2)

        tooltipText: root.empty
          ? "Every metric is hidden.\nClick to open the menu and bring one back."
          : Tips.tooltipFor(modelData, root.reading, { ramFormat: root.prefs.groups.mem.ramFormat })

        onPressed: function(button) { root.metricPressed(modelData.key, button) }
      }
    }
  }
}
