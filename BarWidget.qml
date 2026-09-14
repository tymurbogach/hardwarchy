import QtQuick
import Quickshell
import Quickshell.Io
import qs.Commons
import qs.Ui
import "Model/Metrics.js" as Metrics
import "Model/Prefs.js" as Prefs
import "Model/Tooltip.js" as Tips
import "Model/Info.js" as Info
import "Styles/Modes.js" as Modes

BarWidget {
  id: root
  moduleName: "io.github.tymurbogach.hardwarchy"

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
  readonly property var allMetrics: Metrics.metrics(root.reading, root.prefs)
  readonly property var orderedMetrics: Metrics.orderKeys(root.allMetrics,
    Metrics.metricsExpandGroupOrder(root.prefs.order, root.prefs.groups.fan.order))
  readonly property var effectiveHidden: Metrics.metricsEffectiveHidden(root.orderedMetrics, root.prefs)
  readonly property var visibleMetrics: Metrics.shown(root.orderedMetrics, root.effectiveHidden)
  // Each group's contiguous run draws as that group's own cell, piece by
  // piece from its prefs; a vertical bar forces digits. Nothing visible
  // yields one placeholder.
  readonly property var stripModel: Modes.groupStripCells(
    Metrics.metricsGroupRuns(root.visibleMetrics), root.prefs, root.vertical)
  readonly property bool empty: root.visibleMetrics.length === 0

  // The cells a group would draw, as if it were switched on, so the menu
  // can preview a group before the user enables it.
  function previewCells(id) {
    var p = Prefs.adoptPrefs(root.prefs)
    if (!p.groups[id]) return []
    p.groups[id].enabled = true
    var items = []
    for (var i = 0; i < root.orderedMetrics.length; i++)
      if (root.orderedMetrics[i].device === id) items.push(root.orderedMetrics[i])
    return Modes.groupCells(Metrics.shown(items, Metrics.metricsEffectiveHidden(items, p)), p, id, false)
  }

  // ---- appearance ---------------------------------------------------
  // Three gaps, all ink to ink: inside one part of a cell (an icon and
  // its reading), between two parts of a cell, and between two cells.
  readonly property real iconGap: root.prefs.gaps.icon
  readonly property real partGap: root.prefs.gaps.part
  readonly property real metricGap: root.prefs.gaps.metric
  readonly property real outerMargin: Math.max(0, 8.5 - root.metricGap / 2)

  // Urgent color with a transparency guard: an unthemed urgent arrives
  // transparent, and warming toward that would fade the read-out out.
  readonly property color hot: {
    var u = root.bar ? root.bar.urgent : Color.urgent
    return u.a > 0 ? u : Color.urgent
  }
  // 0-100: how much a hot reading warms toward `hot`. At 0 nothing ever
  // warms; at 100 a reading at its critical threshold reaches `hot`.
  readonly property real colorIntensity: root.prefs.colorIntensity / 100

  function warm(from, amount) {
    var t = Math.min(1, (amount || 0) * root.colorIntensity)
    if (!(t > 0)) return from
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
  readonly property string configDir: Quickshell.env("HOME") + "/.config/omarchy/"
  readonly property string prefsPath: root.configDir + "hardwarchy.json"
  // Prefs files from before a rename, newest first. Without a current
  // file, the first one found is re-saved under the current name.
  readonly property var legacyNames: ["modular-hw-monitor.json", "any-monitor.json"]
  property int legacyIndex: -1
  readonly property string legacyPath:
    root.legacyIndex >= 0 && root.legacyIndex < root.legacyNames.length
      ? root.configDir + root.legacyNames[root.legacyIndex] : ""

  function commit(next) {
    root.prefs = Prefs.adoptPrefs(next)
    root.savePrefs()
  }

  function savePrefs() {
    prefsFile.setText(Prefs.serialize(root.prefs) + "\n")
  }

  // Every per-group change goes through one patch, so each click writes
  // one consistent file.
  function patchGroup(id, patch) {
    var p = Prefs.adoptPrefs(root.prefs)
    if (!p.groups[id]) return
    for (var k in patch) p.groups[id][k] = patch[k]
    root.commit(p)
  }

  // Back to that group's defaults; an empty group validates to them.
  function resetGroup(id) {
    var p = Prefs.adoptPrefs(root.prefs)
    if (!p.groups[id]) return
    p.groups[id] = {}
    root.commit(p)
  }

  // One threshold of one group; adoptPrefs clamps it and keeps warn < crit.
  function stepGroupLimit(id, key, delta) {
    var g = root.prefs.groups[id]
    if (!g || typeof g[key] !== "number") return
    var patch = {}
    patch[key] = g[key] + delta
    root.patchGroup(id, patch)
  }

  // Fans hide, reorder and rename one by one inside the Fans card; every
  // other group shows or hides wholesale through its `enabled` field.
  function toggleFanHidden(key) {
    if (!key) return
    var list = root.prefs.groups.fan.hidden
    var out = []
    var found = false
    for (var i = 0; i < list.length; i++) {
      if (list[i] === key) found = true
      else out.push(list[i])
    }
    if (!found) out.push(key)
    root.patchGroup("fan", { hidden: out })
  }

  // An empty name, or the detected label itself, drops the custom name.
  function renameFan(key, name, autoLabel) {
    var names = {}
    var current = root.prefs.groups.fan.names
    for (var k in current) names[k] = current[k]
    var t = String(name || "").trim()
    if (t === "" || t === autoLabel) delete names[key]
    else names[key] = t
    root.patchGroup("fan", { names: names })
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
    root.patchGroup("fan", { order: keys })
  }

  // Reorder groups by swapping with the neighbour the menu shows, so a
  // group without readings (no GPU, say) never swallows a move.
  function moveGroup(id, delta) {
    var runs = Metrics.metricsGroupRuns(root.orderedMetrics)
    var at = -1
    for (var i = 0; i < runs.length; i++)
      if (runs[i].device === id) at = i
    var to = at + delta
    if (at < 0 || to < 0 || to >= runs.length) return
    var other = runs[to].device
    var order = root.prefs.order.slice()
    var a = order.indexOf(id)
    var b = order.indexOf(other)
    if (a < 0 || b < 0) return
    order[a] = other
    order[b] = id
    var p = Prefs.adoptPrefs(root.prefs)
    p.order = order
    root.commit(p)
  }

  function setUnit(value) {
    var p = Prefs.adoptPrefs(root.prefs)
    p.unit = (value === "F") ? "F" : "C"
    root.commit(p)
  }

  function stepColorIntensity(delta) {
    var p = Prefs.adoptPrefs(root.prefs)
    p.colorIntensity = p.colorIntensity + delta
    root.commit(p)
  }

  function stepGap(key, delta) {
    var p = Prefs.adoptPrefs(root.prefs)
    p.gaps[key] = p.gaps[key] + delta
    root.commit(p)
  }

  function stepRefresh(delta) {
    var p = Prefs.adoptPrefs(root.prefs)
    p.refresh = p.refresh + delta
    root.commit(p)
  }

  function resetDefaults() { root.commit({}) }

  // Only reached before the prefs file exists: shell.json seeds the
  // first run with v1-shaped keys, then the file is what counts.
  function seedPrefs() {
    root.commit({
      hidden: root.setting("hidden", []),
      unit: root.setting("unit", "C"),
      showRpm: root.setting("showRpm", false),
      mode: root.setting("mode", "digits"),
      barStyle: root.setting("barStyle", ""),
      showDigits: root.setting("showDigits", true),
      wordLabels: root.setting("wordLabels", false),
      colorMode: root.setting("colorMode", "auto"),
      showClocks: root.setting("showClocks", false),
      ramFormat: root.setting("ramFormat", "percent"),
      iconGap: root.setting("iconGap", 2),
      partGap: root.setting("partGap", 5),
      metricGap: root.setting("metricGap", 10)
    })
  }

  FileView {
    id: prefsFile
    path: root.prefsPath
    watchChanges: true
    atomicWrites: true
    printErrors: false
    onLoaded: root.commit(text())
    // The legacy search runs once: a prefs file deleted later falls back
    // to the seed, not to an old file.
    onLoadFailed: {
      root.seedPrefs()
      if (root.legacyIndex < 0) root.legacyIndex = 0
    }
    onFileChanged: reload()
  }

  // Walks legacyNames: the first file found wins, a missing one moves on.
  FileView {
    id: legacyPrefs
    path: root.legacyPath
    watchChanges: false
    atomicWrites: false
    printErrors: false
    onLoaded: root.commit(text())
    onLoadFailed: if (root.legacyIndex >= 0) root.legacyIndex++
  }

  // ---- clicks ---------------------------------------------------------
  // Left and middle open the menu. Right cycles the clicked group's load
  // (number, bar, both); a group with no load (Net, Fans) opens the menu.
  function metricPressed(device, button) {
    var patch = button === Qt.RightButton ? Modes.cycleLoadPatch(root.prefs, device) : null
    if (patch) root.patchGroup(device, patch)
    else root.toggle()
  }

  // ---- collector ------------------------------------------------------
  // Slow-moving numbers: poll at the chosen refresh until the menu opens.
  readonly property int pollSeconds: opened ? 1 : root.prefs.refresh
  readonly property string readerPath:
    String(Qt.resolvedUrl("scripts/sysread")).replace("file://", "")
  // Only what the bar draws is read; the open menu reads everything, so
  // its previews stay live and any piece can come back.
  readonly property string readList: root.opened ? "all"
    : (Metrics.metricsReadList(root.prefs).join(",") || "none")
  // What the collector reads, chosen in the menu, handed down through the
  // environment it already takes overrides from.
  readonly property var collectorEnv: ({
    MONITOR_GPU: root.prefs.groups.gpu.adapter,
    MONITOR_NET_IFACE: root.prefs.groups.net.iface,
    MONITOR_ROOT_MOUNT: root.prefs.groups.disk.mount,
    MONITOR_READ: root.readList
  })
  readonly property string collectorKey: [root.pollSeconds, root.prefs.groups.gpu.adapter,
    root.prefs.groups.net.iface, root.prefs.groups.disk.mount, root.readList].join("|")

  Process {
    id: reader
    command: [root.readerPath, "--loop", "--interval", String(root.pollSeconds)]
    environment: root.collectorEnv
    running: true

    stdout: SplitParser {
      // A bad line keeps the last good reading rather than flashing blanks.
      // The collector primes its rates before its first line, so a restart
      // never reads as a null blip either.
      onRead: data => {
        const parsed = Metrics.parse(data)
        if (Metrics.hasReading(parsed)) root.reading = parsed
      }
    }
  }

  function restartCollector() {
    reader.running = false
    reader.command = [root.readerPath, "--loop", "--interval", String(root.pollSeconds)]
    reader.environment = root.collectorEnv
    reader.running = true
  }

  // A new interval, source or read list restarts the collector once, even
  // when several of them move together (opening the menu changes both the
  // interval and the read list).
  onCollectorKeyChanged: Qt.callLater(root.restartCollector)

  // ---- menu facts -----------------------------------------------------
  // Facts that never change (`sysread --info`), read once, the first time
  // the menu opens: a menu nobody opens costs nothing.
  property var info: null

  onOpenedChanged: if (root.opened && !root.info && !infoReader.running) infoReader.running = true

  Process {
    id: infoReader
    command: [root.readerPath, "--info"]
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: root.info = Info.infoParse(text)
    }
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

      // A cell is one click target whatever it draws; Modes.js already
      // built its pieces, so this only styles them.
      delegate: MetricButton {
        required property var modelData

        bar: root.bar
        pieces: modelData.pieces
        dimmed: modelData.dim
        vertical: root.vertical
        slotSize: root.vertical ? 0 : root.barSize

        fontFamily: root.bar ? root.bar.fontFamily : Style.font.family
        fontSize: Style.font.body
        foreground: root.bar ? root.bar.barForeground : Color.foreground
        secondaryColor: Color.muted
        hotColor: root.hot
        warmth: root.colorIntensity

        iconGap: Style.spaceReal(root.iconGap)
        partGap: Style.spaceReal(root.partGap)
        sideMargin: Style.spaceReal(root.metricGap / 2)

        tooltipText: root.empty
          ? "Every metric is hidden.\nClick to open the menu and bring one back."
          : Tips.tooltipFor(modelData, root.reading)

        onPressed: function(button) { root.metricPressed(modelData.device, button) }
      }
    }
  }
}
