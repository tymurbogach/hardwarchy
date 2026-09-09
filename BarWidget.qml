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

  // The menu reads everything through the widget, so two bar instances
  // (two monitors) stay in step via the watched prefs file.
  readonly property var allMetrics: Metrics.metrics(root.reading,
    ({ unit: root.prefs.unit, showRpm: root.prefs.showRpm,
       showClocks: root.prefs.showClocks, ramFormat: root.prefs.ramFormat,
       showDigits: root.prefs.showDigits, wordLabels: root.prefs.wordLabels,
       mode: root.prefs.mode }), root.prefs)
  readonly property var orderedMetrics: Metrics.orderKeys(root.allMetrics, root.prefs.order)
  readonly property string effectiveMode:
    root.vertical ? "digits" : Modes.normalizeMode(root.prefs.mode)
  readonly property var modeOpts: ({ showDigits: root.prefs.showDigits,
    wordLabels: root.prefs.wordLabels })
  readonly property var stripModel: Modes.stripCells(root.orderedMetrics,
    root.prefs.hidden, root.effectiveMode, root.modeOpts)
  readonly property bool empty: {
    var n = 0
    for (var i = 0; i < root.orderedMetrics.length; i++)
      if (!Metrics.isHidden(root.orderedMetrics[i].key, root.prefs.hidden)) n++
    return n === 0
  }

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
  readonly property bool graphite: root.prefs.colorMode === "graphite"

  function grayOf(c) {
    var g = (c.r + c.g + c.b) / 3 * 0.85 + 0.08
    return Qt.rgba(g, g, g, c.a)
  }

  function warm(from, amount) {
    // Graphite is flat gray by design: no warming, ever. Who wants
    // alerts uses Auto.
    if (root.graphite) return grayOf(from)
    if (!(amount > 0)) return from
    var t = Math.min(1, amount)
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

  function toggleHidden(key) {
    if (!key) return
    var p = Prefs.adoptPrefs(root.prefs)
    var out = []
    var found = false
    for (var i = 0; i < p.hidden.length; i++) {
      if (p.hidden[i] === key) found = true
      else out.push(p.hidden[i])
    }
    if (!found) out.push(key)
    p.hidden = out
    root.commit(p)
  }

  // Reorder by swapping neighbours in the current visible order, then
  // storing the full order so it survives sensors coming and going.
  function moveMetric(key, delta) {
    var keys = []
    for (var i = 0; i < root.orderedMetrics.length; i++)
      keys.push(root.orderedMetrics[i].key)
    var at = keys.indexOf(key)
    var to = at + delta
    if (at < 0 || to < 0 || to >= keys.length) return
    var tmp = keys[at]
    keys[at] = keys[to]
    keys[to] = tmp
    var p = Prefs.adoptPrefs(root.prefs)
    p.order = keys
    root.commit(p)
  }

  function setMode(value) {
    var p = Prefs.adoptPrefs(root.prefs)
    p.mode = Modes.normalizeMode(value)
    root.commit(p)
  }

  function cycleMode() { root.setMode(Modes.nextMode(root.prefs.mode)) }

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

  function setColorMode(value) {
    var p = Prefs.adoptPrefs(root.prefs)
    p.colorMode = (value === "graphite") ? "graphite" : "auto"
    root.commit(p)
  }

  function setRamFormat(value) {
    var p = Prefs.adoptPrefs(root.prefs)
    p.ramFormat = (value === "used") ? "used" : "percent"
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
    onLoaded: root.commit(Prefs.migrateBarStyle(text()))
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
      root.commit(Prefs.migrateBarStyle(text()))
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

  Process {
    id: reader
    command: [root.readerPath, "--loop", "--interval", String(root.pollSeconds)]
    running: true

    stdout: SplitParser {
      onRead: data => {
        const parsed = Metrics.parse(data)
        // Keep the last good reading rather than flashing blanks.
        if (Metrics.hasReading(parsed)) root.reading = parsed
      }
    }
  }

  onPollSecondsChanged: {
    reader.running = false
    reader.command = [root.readerPath, "--loop", "--interval", String(pollSeconds)]
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

        // A cell is one click target whatever it draws. `joined`
        // carries the usage half's glyph and gauge with the temp
        // half's digits; the exact usage figure lives in the tooltip.
        readonly property bool isJoined: modelData.cell === "joined"
        readonly property var cellMetric: isJoined ? modelData.usage : modelData.metric
        readonly property bool isGauge: modelData.cell === "gauge" || isJoined
        // Joined severity is the hotter half: a cool load on a hot
        // chip still deserves to read warm.
        readonly property real cellSeverity: {
          if (isJoined)
            return Math.max(modelData.usage.severity || 0, modelData.temp.severity || 0)
          return (cellMetric && cellMetric.severity) || 0
        }
        readonly property color base:
          root.bar ? root.bar.barForeground : Color.foreground

        bar: root.bar
        glyph: cellMetric ? cellMetric.glyph : ""
        showGlyph: modelData.bare !== true
        gaugeRatio: isGauge && cellMetric && typeof cellMetric.ratio === "number"
          ? cellMetric.ratio : -1
        value: {
          if (!cellMetric) return ""
          if (modelData.cell === "gauge" && !modelData.withDigits) return ""
          if (isJoined) return modelData.temp.bar
          // Words mode: the words ARE the read-out.
          if (modelData.bare === true) return cellMetric.label + " " + cellMetric.bar
          return cellMetric.bar
        }
        dimmed: cellMetric ? cellMetric.dim === true : true
        vertical: root.vertical
        slotSize: root.vertical ? 0 : root.barSize

        fontFamily: root.bar ? root.bar.fontFamily : Style.font.family
        fontSize: Style.font.body
        foreground: root.warm(base, cellSeverity)

        iconGap: Style.spaceReal(root.iconGap)
        sideMargin: Style.spaceReal(root.metricGap / 2)

        tooltipText: root.empty
          ? "Every metric is hidden.\nClick to open the menu and bring one back."
          : Tips.tooltipFor(modelData, root.reading, { ramFormat: root.prefs.ramFormat })

        onPressed: function(button) { root.metricPressed(modelData.key, button) }
      }
    }
  }
}
