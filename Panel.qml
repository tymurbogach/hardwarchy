// The menu: one collapsible card per monitor group (CPU, GPU, RAM, Net,
// Disk, Fans). A card's header shows an open/closed caret, a live preview
// of the group's bar cell, an on/off switch and arrows that move the group
// in the bar. An open card sits on a tinted ground and lists the group's
// source (GPU, link, mount), then one row per piece of the cell in bar
// order: chips that add or remove what the piece draws, and the piece's
// own Quiet chip at the far right. Then the group's alerts and its Reset.
// A General section closes the menu.
// Rows are data (rowsFor/buttonsOf); the widget owns all state; this file
// draws it and forwards gestures, from the mouse and the keyboard alike.
import QtQuick
import QtQuick.Layouts
import Quickshell
import qs.Commons
import qs.Ui
import "Model/Metrics.js" as Metrics
import "Menu"

Panel {
  id: root
  moduleName: "io.github.tymurbogach.modular-hw-monitor"
  manageIpc: false

  property var anchorItem: null
  property var hostWidget: null

  // Read back by the widget, which sizes the panel's anchor from them.
  readonly property real cardWidth: panel.contentWidth
  readonly property real cardHeight: panel.contentHeight

  readonly property var prefs: hostWidget ? hostWidget.prefs : null
  readonly property var reading: hostWidget ? hostWidget.reading : ({})
  readonly property var groupRuns:
    hostWidget ? Metrics.metricsGroupRuns(hostWidget.orderedMetrics) : []

  // Readings arrive every second while the menu is open, and each one
  // builds a fresh `groupRuns` array. A Repeater fed that array would
  // rebuild every card each second, dropping hover and half-done clicks,
  // so cards, rows and fan lines all repeat over stable keys instead and
  // look their live data up by key.
  property var groupIds: []
  readonly property var runByDevice: {
    var out = {}
    for (var i = 0; i < root.groupRuns.length; i++)
      out[root.groupRuns[i].device] = root.groupRuns[i]
    return out
  }

  function sameList(a, b) {
    if (a.length !== b.length) return false
    for (var i = 0; i < a.length; i++)
      if (a[i] !== b[i]) return false
    return true
  }

  function idsOf(list, field) {
    var out = []
    for (var i = 0; i < list.length; i++) out.push(list[i][field])
    return out
  }

  function findBy(list, field, value) {
    for (var i = 0; i < list.length; i++)
      if (list[i][field] === value) return list[i]
    return null
  }

  onGroupRunsChanged: {
    var ids = root.idsOf(root.groupRuns, "device")
    if (!root.sameList(ids, root.groupIds)) root.groupIds = ids
  }

  function groupOf(id) {
    return (root.prefs && root.prefs.groups && root.prefs.groups[id]) ? root.prefs.groups[id] : {}
  }

  function patchField(id, field, value) {
    var fields = {}
    fields[field] = value
    if (root.hostWidget) root.hostWidget.patchGroup(id, fields)
  }

  // Which cards are open, keyed by device id: a card that moves in the
  // order is rebuilt, and comes back the way it was.
  property var expandedGroups: ({})

  function isExpanded(id) {
    return root.expandedGroups[id] === true
  }

  function setExpanded(id, on) {
    var next = {}
    for (var k in root.expandedGroups) next[k] = root.expandedGroups[k]
    next[id] = on === true
    root.expandedGroups = next
  }

  // The fan being renamed, by key, or "".
  property string renamingFan: ""

  // ---- the rows of a card, as data -------------------------------------
  readonly property var sourceNames: ({ auto: "Auto", nvidia: "NVIDIA", amd: "AMD", intel: "Intel" })
  // Half-filled circle (Font Awesome "adjust"): the piece's muted color.
  readonly property string quietGlyph: ""
  readonly property var usedChips: [root.chip("bar", "Bar"), root.chip("percent", "%"), root.chip("gib", "GiB")]

  // A chip adds or removes one toggle of a part; `needs` names the toggle
  // it only makes sense with (an icon needs its value).
  function chip(key, label, needs) {
    return { key: key, label: label, needs: needs || "" }
  }

  readonly property var usedKeys: ["bar", "percent", "gib"]

  // Whether a part draws: any of the given toggles is on.
  function shows(part, keys) {
    if (!part) return false
    for (var i = 0; i < keys.length; i++)
      if (part[keys[i]] === true) return true
    return false
  }

  function partRow(key, title, chips, sub) {
    return { type: "part", key: key, title: title, chips: chips, sub: sub === true }
  }

  // A source row: the automatic pick (where there is one), what the
  // collector found, and the current choice even while it is gone.
  function choiceRow(key, title, current, found, withAuto, names) {
    var values = withAuto ? ["auto"] : []
    var list = found || []
    for (var i = 0; i < list.length; i++)
      if (values.indexOf(list[i]) < 0) values.push(list[i])
    if (current && values.indexOf(current) < 0) values.push(current)
    var options = []
    for (var j = 0; j < values.length; j++)
      options.push({ value: values[j], label: (names && names[values[j]]) || values[j] })
    return { type: "choice", key: key, title: title, options: options }
  }

  function markedRow(key, title, markKey, markLabel) {
    return root.partRow(key, title, [root.chip(markKey, markLabel, "value"), root.chip("value", "Value")])
  }

  // Every row of one group's card, top to bottom: source, pieces in bar
  // order (sub rows only while they apply), alerts, fans, reset.
  function rowsFor(id, g, reading) {
    var r = reading || {}
    var rows = []
    var load = g.load || {}
    var used = g.used || {}
    var temp = g.temp || {}
    if (id === "gpu")
      rows.push(root.choiceRow("adapter", "Source", g.adapter, r.gpu_sources, true, root.sourceNames))
    if (id === "net")
      rows.push(root.choiceRow("iface", "Link", g.iface, r.net ? r.net.ifaces : [], true, root.sourceNames))
    if (id === "disk")
      rows.push(root.choiceRow("mount", "Mount", g.mount, r.disk ? r.disk.mounts : [], false, null))
    rows.push(root.partRow("label", "Label", [root.chip("icon", "Icon"), root.chip("word", "Word")]))
    if (id === "cpu" || id === "gpu") {
      rows.push(root.partRow("load", "Load", [root.chip("bar", "Bar"), root.chip("number", "Number")]))
      if (load.number === true)
        rows.push(root.partRow("zero", "Zero", [root.chip("show", "Show")], true))
      rows.push(root.partRow("clock", "Clock", [root.chip("show", "Show")]))
      rows.push(root.partRow("temp", "Temp", [root.chip("icon", "Icon", "value"), root.chip("value", "Value"),
        root.chip("unit", root.prefs && root.prefs.unit === "F" ? "°F" : "°C", "value")]))
      if (id === "cpu") {
        rows.push(root.partRow("avg", "Avg", [root.chip("one", "1m"), root.chip("five", "5m"), root.chip("fifteen", "15m")]))
      } else {
        rows.push(root.partRow("vram", "VRAM", root.usedChips))
        rows.push(root.partRow("power", "Power", [root.chip("show", "Show")]))
      }
    } else if (id === "mem" || id === "disk") {
      rows.push(root.partRow("used", "Used", root.usedChips))
      if (used.percent === true)
        rows.push(root.partRow("zero", "Zero", [root.chip("show", "Show")], true))
      if (id === "mem") {
        rows.push(root.partRow("swap", "Swap", root.usedChips))
      } else {
        rows.push(root.markedRow("read", "Read", "tag", "Tag"))
        rows.push(root.markedRow("write", "Write", "tag", "Tag"))
      }
    } else if (id === "net") {
      rows.push(root.markedRow("down", "Down", "icon", "Icon"))
      rows.push(root.markedRow("up", "Up", "icon", "Icon"))
    } else if (id === "fan") {
      rows.push(root.partRow("rpm", "RPM", [root.chip("value", "Value"), root.chip("unit", "Unit", "value")]))
      rows.push({ type: "flag", key: "showStopped", title: "Stopped", label: "Show" })
    }
    // The usage alert covers every percentage that warms on it: the load,
    // the space used, VRAM and swap.
    var usageShown = root.shows(load, ["bar", "number"]) || root.shows(used, root.usedKeys)
      || root.shows(g.vram, root.usedKeys) || root.shows(g.swap, root.usedKeys)
    if (typeof g.warnUsage === "number" && usageShown)
      rows.push({ type: "limit", key: "usageLimit", title: "Alert %", warn: "warnUsage", crit: "critUsage", step: 5, unit: "" })
    if (typeof g.warnTemp === "number" && temp.value === true)
      rows.push({ type: "limit", key: "tempLimit", title: "Alert °", warn: "warnTemp", crit: "critTemp", step: 1, unit: "°" })
    if (id === "fan") {
      rows.push({ type: "limit", key: "rpmLimit", title: "Alert", warn: "warnRpm", crit: "critRpm", step: 250, unit: "" })
      rows.push({ type: "fans", key: "fans" })
    }
    rows.push({ type: "reset", key: "reset", title: "", label: "Reset " + (Metrics.GROUP_LABELS[id] || id) })
    return rows
  }

  // What the buttons of one row show and do. A part row's chips add or
  // remove, and its last one, apart at the far right, mutes the piece.
  function buttonsOf(spec, g) {
    var out = []
    var i = 0
    if (spec.type === "part") {
      var p = g[spec.key] || {}
      for (i = 0; i < spec.chips.length; i++) {
        var c = spec.chips[i]
        out.push({ label: c.label, on: p[c.key] === true, enabled: c.needs === "" || p[c.needs] === true,
          act: { t: "toggle", part: spec.key, k: c.key } })
      }
      out.push({ label: root.quietGlyph, on: p.quiet === true, right: true,
        tooltip: "Quiet: muted color, never warms", act: { t: "quiet", part: spec.key } })
    } else if (spec.type === "choice") {
      for (i = 0; i < spec.options.length; i++)
        out.push({ label: spec.options[i].label, on: g[spec.key] === spec.options[i].value,
          act: { t: "set", field: spec.key, v: spec.options[i].value } })
    } else if (spec.type === "flag") {
      out.push({ label: spec.label, on: g[spec.key] === true, act: { t: "flag", field: spec.key } })
    } else if (spec.type === "limit") {
      out.push({ act: { t: "limit", field: spec.warn, d: -spec.step } })
      out.push({ act: { t: "limit", field: spec.warn, d: spec.step } })
      out.push({ act: { t: "limit", field: spec.crit, d: -spec.step } })
      out.push({ act: { t: "limit", field: spec.crit, d: spec.step } })
    } else if (spec.type === "reset") {
      out.push({ label: spec.label, right: true, act: { t: "reset" } })
    }
    return out
  }

  function runAction(id, act) {
    var host = root.hostWidget
    if (!host || !act) return
    var g = root.groupOf(id)
    if (act.t === "toggle" || act.t === "quiet") {
      var next = {}
      var src = g[act.part] || {}
      for (var k in src) next[k] = src[k]
      var flip = act.t === "toggle" ? act.k : "quiet"
      next[flip] = next[flip] !== true
      root.patchField(id, act.part, next)
    } else if (act.t === "set") {
      root.patchField(id, act.field, act.v)
    } else if (act.t === "flag") {
      root.patchField(id, act.field, g[act.field] !== true)
    } else if (act.t === "limit") {
      host.stepGroupLimit(id, act.field, act.d)
    } else if (act.t === "reset") {
      host.resetGroup(id)
    }
  }

  function pressRow(id, spec, index) {
    var b = root.buttonsOf(spec, root.groupOf(id))[index]
    if (b && b.enabled !== false) root.runAction(id, b.act)
  }

  // A card header's buttons: 0 open/close, 1 on/off, 2 up, 3 down. The
  // end cards keep their arrow's place and ignore it.
  function pressHeader(id, index) {
    var host = root.hostWidget
    var at = root.groupIds.indexOf(id)
    if (!host) return
    if (index === 0) root.setExpanded(id, !root.isExpanded(id))
    else if (index === 1) root.patchField(id, "enabled", root.groupOf(id).enabled === false)
    else if (index === 2 && at > 0) host.moveGroup(id, -1)
    else if (index === 3 && at < root.groupIds.length - 1) host.moveGroup(id, 1)
  }

  // A fan line's buttons: 0 on/off, 1 rename, 2 up, 3 down.
  function pressFan(key, index) {
    var host = root.hostWidget
    if (!host || !key) return
    if (index === 0) host.toggleFanHidden(key)
    else if (index === 1) root.renamingFan = key
    else if (index === 2) host.moveFan(key, -1)
    else if (index === 3) host.moveFan(key, 1)
  }

  function finishRename(key, name, autoLabel) {
    if (name !== undefined && root.hostWidget) root.hostWidget.renameFan(key, name, autoLabel)
    root.renamingFan = ""
    keyCatcher.forceActiveFocus()
  }

  // ---- general settings, as data too -----------------------------------
  readonly property var generalKeys: ["color", "unit", "gapIcon", "gapPart", "gapMetric", "refresh", "reset"]
  readonly property var generalSpecs: {
    var p = root.prefs
    if (!p) return []
    function stepper(key, title, value, act, step) {
      var down = {}
      var up = {}
      for (var k in act) { down[k] = act[k]; up[k] = act[k] }
      down.d = -step
      up.d = step
      return { key: key, type: "stepper", title: title, value: String(value), acts: [down, up] }
    }
    return [
      stepper("color", "Color %", p.colorIntensity, { t: "color" }, 10),
      { key: "unit", type: "setting", title: "Unit", buttons: [
        { label: "°C", on: p.unit === "C", act: { t: "unit", v: "C" } },
        { label: "°F", on: p.unit === "F", act: { t: "unit", v: "F" } }] },
      stepper("gapIcon", "Icon gap", p.gaps.icon, { t: "gap", k: "icon" }, 1),
      stepper("gapPart", "Part gap", p.gaps.part, { t: "gap", k: "part" }, 1),
      stepper("gapMetric", "Cell gap", p.gaps.metric, { t: "gap", k: "metric" }, 1),
      stepper("refresh", "Refresh s", p.refresh, { t: "refresh" }, 1),
      { key: "reset", type: "setting", title: "", buttons: [{ label: "Reset all", act: { t: "resetAll" } }] }
    ]
  }

  function generalActs(spec) {
    if (spec.type === "stepper") return spec.acts
    return root.idsOf(spec.buttons, "act")
  }

  function runGeneral(act) {
    var host = root.hostWidget
    if (!host || !act) return
    if (act.t === "color") host.stepColorIntensity(act.d)
    else if (act.t === "unit") host.setUnit(act.v)
    else if (act.t === "gap") host.stepGap(act.k, act.d)
    else if (act.t === "refresh") host.stepRefresh(act.d)
    else if (act.t === "resetAll") host.resetDefaults()
  }

  // ---- keyboard -----------------------------------------------------------
  // Every line the keyboard reaches, top to bottom, each with a stable key:
  // the card headers, the rows of open cards (one line per fan), then
  // General. ↑/↓ walk the lines, ←/→ walk a line's buttons and Enter
  // presses one; a header's first button opens and closes its card.
  readonly property var navItems: {
    var out = []
    for (var i = 0; i < root.groupIds.length; i++) {
      var id = root.groupIds[i]
      out.push({ key: id, kind: "header", device: id, count: 4 })
      if (!root.isExpanded(id)) continue
      var g = root.groupOf(id)
      var rows = root.rowsFor(id, g, root.reading)
      for (var j = 0; j < rows.length; j++) {
        if (rows[j].type === "fans") {
          var run = root.runByDevice[id]
          var items = run ? run.items : []
          for (var f = 0; f < items.length; f++)
            out.push({ key: id + ":fan:" + items[f].key, kind: "fan", device: id, fan: items[f].key, count: 4 })
        } else {
          out.push({ key: id + ":" + rows[j].key, kind: "row", device: id, spec: rows[j],
            count: root.buttonsOf(rows[j], g).length })
        }
      }
    }
    for (var k = 0; k < root.generalSpecs.length; k++) {
      var gs = root.generalSpecs[k]
      out.push({ key: "general:" + gs.key, kind: "general", spec: gs, count: root.generalActs(gs).length })
    }
    return out
  }

  property string cursorKey: ""
  property int cursorButton: 0

  function navIndex() {
    for (var i = 0; i < root.navItems.length; i++)
      if (root.navItems[i].key === root.cursorKey) return i
    return -1
  }

  function resetCursor() {
    root.cursorKey = root.navItems.length > 0 ? root.navItems[0].key : ""
    root.cursorButton = 0
  }

  onNavItemsChanged: if (root.navIndex() < 0) root.resetCursor()
  onOpenedChanged: if (opened) root.resetCursor()

  function moveCursor(dy) {
    var n = root.navItems.length
    if (n === 0) return
    var at = root.navIndex()
    root.cursorKey = root.navItems[at < 0 ? 0 : (at + dy + n) % n].key
    root.cursorButton = 0
  }

  function sideCursor(dx) {
    var item = root.navItems[root.navIndex()]
    if (!item) return
    root.cursorButton = Math.max(0, Math.min(item.count - 1, root.cursorButton + dx))
  }

  function activateCursor() {
    var item = root.navItems[root.navIndex()]
    if (!item) return
    if (item.kind === "header") root.pressHeader(item.device, root.cursorButton)
    else if (item.kind === "row") root.pressRow(item.device, item.spec, root.cursorButton)
    else if (item.kind === "fan") root.pressFan(item.fan, root.cursorButton)
    else if (item.kind === "general") root.runGeneral(root.generalActs(item.spec)[root.cursorButton])
  }

  // Scroll the menu so the keyboard cursor's line stays in view.
  function ensureVisible(item) {
    if (!item) return
    var y = item.mapToItem(content, 0, 0).y
    if (y < flick.contentY) flick.contentY = y
    else if (y + item.height > flick.contentY + flick.height) flick.contentY = y + item.height - flick.height
  }

  function switchPanel(direction) {
    if (root.bar && typeof root.bar.switchPanelFrom === "function")
      return root.bar.switchPanelFrom(root.hostWidget || root, direction)
    return false
  }

  readonly property color fg: root.barForeground
  readonly property color ac: root.bar ? root.bar.barForeground : Color.accent
  readonly property string ff: root.bar ? root.bar.fontFamily : Style.font.family

  KeyboardPanel {
    id: panel
    anchorItem: root.anchorItem
    owner: root.hostWidget || root
    bar: root.bar
    open: root.opened
    focusTarget: keyCatcher
    contentWidth: panel.fittedContentWidth(Style.space(340))
    contentHeight: panel.fittedContentHeight(content.implicitHeight)

    PanelKeyCatcher {
      id: keyCatcher
      anchors.fill: parent
      onCloseRequested: root.close()
      onTabRequested: function(direction) { root.switchPanel(direction) }
      onMoveRequested: function(dx, dy) {
        if (dy !== 0) root.moveCursor(dy)
        else if (dx !== 0) root.sideCursor(dx)
      }
      onActivateRequested: root.activateCursor()

      // Taller than the screen, the menu scrolls; the cursor scrolls it.
      Flickable {
        id: flick
        anchors.fill: parent
        contentWidth: width
        contentHeight: content.implicitHeight
        clip: true
        interactive: contentHeight > height
        boundsBehavior: Flickable.StopAtBounds

        Column {
          id: content
          width: flick.width
          spacing: Style.space(3)

          Text {
            width: parent.width
            text: "Modular HW Monitor"
            color: root.fg
            font.family: root.ff
            font.pixelSize: Style.font.subtitle
            font.bold: true
            bottomPadding: Style.space(2)
          }

          Text {
            width: parent.width
            visible: root.groupIds.length === 0
            text: "No readings yet."
            wrapMode: Text.WordWrap
            color: root.fg
            opacity: 0.7
            font.family: root.ff
            font.pixelSize: Style.font.body
          }

          Repeater {
            model: root.groupIds

            delegate: Item {
              id: card
              required property string modelData
              required property int index

              readonly property string device: card.modelData
              readonly property var run: root.runByDevice[card.device] || ({ device: card.device, items: [] })
              readonly property var group: root.groupOf(card.device)
              readonly property bool isOn: card.group.enabled !== false
              readonly property bool expanded: root.isExpanded(card.device)
              readonly property bool cursorHere: root.cursorKey === card.device
              onCursorHereChanged: if (cursorHere) root.ensureVisible(header)

              // Fan lines repeat over stable keys, like the cards.
              property var itemKeys: []
              readonly property var itemByKey: {
                var out = {}
                for (var i = 0; i < card.run.items.length; i++) out[card.run.items[i].key] = card.run.items[i]
                return out
              }
              function syncItemKeys() {
                var keys = root.idsOf(card.run.items, "key")
                if (!root.sameList(keys, card.itemKeys)) card.itemKeys = keys
              }
              onRunChanged: card.syncItemKeys()
              Component.onCompleted: card.syncItemKeys()

              width: parent.width
              // An open card stands apart: a tinted ground and a gap below.
              height: body.height + (card.expanded ? Style.space(8) : 0)

              Rectangle {
                visible: card.expanded
                width: body.width
                height: body.height
                radius: Style.cornerRadius
                color: Color.menu.selectedBackground
              }

              Column {
                id: body
                width: parent.width
                spacing: Style.space(2)

                GroupCard {
                  id: header
                  width: parent.width
                  groupLabel: Metrics.GROUP_LABELS[card.device] || card.device
                  groupGlyph: Metrics.GLYPH[card.device] || ""
                  groupEnabled: card.isOn
                  expanded: card.expanded
                  atFirst: card.index === 0
                  atLast: card.index === root.groupIds.length - 1
                  hasCursor: card.cursorHere
                  cursorButton: card.cursorHere ? root.cursorButton : -1
                  previewCells: root.hostWidget ? root.hostWidget.previewCells(card.device) : []
                  previewSecondary: Color.muted
                  previewHot: root.hostWidget ? root.hostWidget.hot : root.fg
                  previewWarmth: root.prefs ? root.prefs.colorIntensity / 100 : 1
                  iconGap: root.hostWidget ? Style.spaceReal(root.hostWidget.iconGap) : 0
                  partGap: root.hostWidget ? Style.spaceReal(root.hostWidget.partGap) : 0
                  foreground: root.fg
                  accent: root.ac
                  fontFamily: root.ff

                  // The pointer lands the cursor on what a click does: the caret.
                  onHovered: {
                    if (root.cursorKey === card.device) return
                    root.cursorKey = card.device
                    root.cursorButton = 0
                  }
                  onPressed: function(index) {
                    root.cursorKey = card.device
                    root.cursorButton = index
                    root.pressHeader(card.device, index)
                  }
                }

                // Built only while the card is open.
                Loader {
                  width: parent.width
                  active: card.expanded
                  visible: active
                  sourceComponent: cardRows
                }
              }

              Component {
                id: cardRows

                Column {
                  id: rows
                  readonly property real rowWidth: width - leftPadding - rightPadding
                  readonly property var specs: root.rowsFor(card.device, card.group, root.reading)
                  property var rowKeys: []
                  function syncRows() {
                    var keys = root.idsOf(rows.specs, "key")
                    if (!root.sameList(keys, rows.rowKeys)) rows.rowKeys = keys
                  }
                  onSpecsChanged: rows.syncRows()
                  Component.onCompleted: rows.syncRows()

                  width: card.width
                  leftPadding: Style.space(6)
                  rightPadding: Style.space(6)
                  bottomPadding: Style.space(6)
                  spacing: Style.space(3)

                  Repeater {
                    model: rows.rowKeys

                    // One line: a setting row, an alert row or the fans.
                    delegate: Loader {
                      id: line
                      required property string modelData
                      readonly property var spec: root.findBy(rows.specs, "key", modelData) || ({ type: "none" })
                      readonly property string navKey: card.device + ":" + modelData
                      readonly property bool cursorHere: root.cursorKey === navKey
                      onCursorHereChanged: if (cursorHere) root.ensureVisible(line)

                      width: rows.rowWidth
                      sourceComponent: line.spec.type === "limit" ? limitLine
                        : (line.spec.type === "fans" ? fanLines : settingLine)

                      Component {
                        id: settingLine
                        SettingRow {
                          title: line.spec.title || ""
                          sub: line.spec.sub === true
                          buttons: root.buttonsOf(line.spec, card.group)
                          cursorButton: line.cursorHere ? root.cursorButton : -1
                          foreground: root.fg; accent: root.ac; fontFamily: root.ff
                          onPressed: function(index) {
                            root.cursorKey = line.navKey
                            root.cursorButton = index
                            root.pressRow(card.device, line.spec, index)
                          }
                        }
                      }

                      Component {
                        id: limitLine
                        LimitRow {
                          title: line.spec.title || ""
                          unit: line.spec.unit || ""
                          warn: card.group[line.spec.warn] || 0
                          crit: card.group[line.spec.crit] || 0
                          cursorButton: line.cursorHere ? root.cursorButton : -1
                          foreground: root.fg; fontFamily: root.ff
                          onPressed: function(index) {
                            root.cursorKey = line.navKey
                            root.cursorButton = index
                            root.pressRow(card.device, line.spec, index)
                          }
                        }
                      }

                      Component {
                        id: fanLines
                        Column {
                          spacing: Style.space(1)

                          Repeater {
                            model: card.itemKeys

                            delegate: MetricRow {
                              id: fanLine
                              required property string modelData
                              required property int index
                              readonly property var fan: card.itemByKey[modelData] || null
                              readonly property string navKey: card.device + ":fan:" + modelData
                              readonly property bool cursorHere: root.cursorKey === navKey
                              onCursorHereChanged: if (cursorHere) root.ensureVisible(fanLine)

                              rowLabel: fan ? fan.label : modelData
                              rowValue: fan ? fan.value : "–"
                              rowValueColor: root.hostWidget && fan ? root.hostWidget.warm(root.fg, fan.severity) : root.fg
                              off: Metrics.isHidden(modelData, card.group.hidden)
                              dimValue: !fan || fan.dim === true
                              atFirst: index === 0
                              atLast: index === card.itemKeys.length - 1
                              editing: root.renamingFan === modelData
                              hasCursor: cursorHere
                              cursorButton: cursorHere ? root.cursorButton : -1
                              foreground: root.fg
                              accent: root.ac
                              fontFamily: root.ff

                              onToggled: root.pressFan(modelData, 0)
                              onRenameRequested: root.pressFan(modelData, 1)
                              onRenamed: function(name) { root.finishRename(modelData, name, fan ? fan.autoLabel : "") }
                              onRenameCancelled: root.finishRename(modelData)
                              onMoveUp: root.pressFan(modelData, 2)
                              onMoveDown: root.pressFan(modelData, 3)
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }

          Item { width: 1; height: Style.space(2) }

          PanelSeparator {
            width: parent.width
            foreground: root.fg
          }

          PanelSectionHeader {
            text: "GENERAL"
            foreground: root.fg
            fontFamily: root.ff
          }

          Repeater {
            model: root.generalKeys

            delegate: Loader {
              id: general
              required property string modelData
              readonly property var spec: root.findBy(root.generalSpecs, "key", modelData) || ({ type: "none" })
              readonly property string navKey: "general:" + modelData
              readonly property bool cursorHere: root.cursorKey === navKey
              onCursorHereChanged: if (cursorHere) root.ensureVisible(general)

              width: content.width
              sourceComponent: general.spec.type === "stepper" ? generalStepper : generalSetting

              Component {
                id: generalStepper
                Stepper {
                  title: general.spec.title || ""
                  text: general.spec.value || ""
                  cursorButton: general.cursorHere ? root.cursorButton : -1
                  foreground: root.fg
                  fontFamily: root.ff
                  onPressed: function(index) {
                    root.cursorKey = general.navKey
                    root.cursorButton = index
                    root.runGeneral(general.spec.acts[index])
                  }
                }
              }

              Component {
                id: generalSetting
                SettingRow {
                  title: general.spec.title || ""
                  buttons: general.spec.buttons || []
                  cursorButton: general.cursorHere ? root.cursorButton : -1
                  foreground: root.fg; accent: root.ac; fontFamily: root.ff
                  onPressed: function(index) {
                    root.cursorKey = general.navKey
                    root.cursorButton = index
                    root.runGeneral(general.spec.buttons[index].act)
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}
