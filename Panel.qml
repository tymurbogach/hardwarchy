// The menu: one collapsible card per monitor group (CPU, RAM, GPU, Net,
// Disk, Fans), each with a live value, an on/off switch and — once
// expanded — that group's own display config. Below that, the small
// cross-cutting View and Units & alerts sections. The widget owns all
// state; this file only draws it and forwards gestures.
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

  readonly property var prefs:
    hostWidget ? hostWidget.prefs : null
  readonly property var groupRuns:
    hostWidget ? Metrics.metricsGroupRuns(hostWidget.orderedMetrics) : []

  function groupOf(id) {
    return (root.prefs && root.prefs.groups && root.prefs.groups[id]) ? root.prefs.groups[id] : {}
  }

  // Which group cards are expanded, keyed by device id — kept here on
  // the panel itself, NOT as local state on a Repeater delegate. Every
  // new sensor reading rebuilds `groupRuns` as a fresh array (readings
  // arrive every 1s while the panel is open), and a Repeater bound to a
  // plain array model rebuilds its delegates whenever that array's
  // identity changes — so any state living only on a delegate (like a
  // "this card is expanded" flag) would get silently reset on the very
  // next reading. Keying by device id here survives that rebuild.
  property var expandedGroups: ({})

  function isExpanded(id) {
    return root.expandedGroups[id] === true
  }

  function toggleExpanded(id) {
    var next = {}
    var k = ""
    for (k in root.expandedGroups) next[k] = root.expandedGroups[k]
    next[id] = !next[id]
    root.expandedGroups = next
  }

  // One highlight on screen at a time, driven by mouse and keys.
  // The keyboard cursor walks the collapsed group rows only; a group's
  // own expanded controls answer to the mouse.
  property int cursorIndex: 0

  function clampCursor() {
    if (root.groupRuns.length === 0) { root.cursorIndex = 0; return }
    if (root.cursorIndex < 0) root.cursorIndex = 0
    if (root.cursorIndex > root.groupRuns.length - 1)
      root.cursorIndex = root.groupRuns.length - 1
  }

  onGroupRunsChanged: clampCursor()
  onOpenedChanged: if (opened) root.cursorIndex = 0

  function moveCursor(dy) {
    if (root.groupRuns.length === 0) return
    root.cursorIndex = (root.cursorIndex + dy + root.groupRuns.length) % root.groupRuns.length
  }

  function activateCursor() {
    var run = root.groupRuns[root.cursorIndex]
    if (run && root.hostWidget) {
      var enabled = root.groupOf(run.device).enabled !== false
      root.hostWidget.setGroupEnabled(run.device, !enabled)
    }
  }

  function metricColor(severity, off) {
    if (!root.hostWidget || off) return root.barForeground
    return root.hostWidget.warm(root.barForeground, severity || 0)
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
    contentWidth: panel.fittedContentWidth(Style.space(320))
    contentHeight: panel.fittedContentHeight(content.implicitHeight)

    PanelKeyCatcher {
      id: keyCatcher
      anchors.fill: parent
      onCloseRequested: root.close()
      onTabRequested: function(direction) { root.switchPanel(direction) }
      onMoveRequested: function(dx, dy) { if (dy !== 0) root.moveCursor(dy) }
      onActivateRequested: root.activateCursor()

      Column {
        id: content
        width: parent.width
        spacing: Style.space(4)

        Text {
          width: parent.width
          text: "Modular HW Monitor"
          color: root.fg
          font.family: root.ff
          font.pixelSize: Style.font.subtitle
          font.bold: true
          bottomPadding: Style.space(4)
        }

        Text {
          width: parent.width
          visible: root.groupRuns.length === 0
          text: "No readings yet."
          wrapMode: Text.WordWrap
          color: root.fg
          opacity: 0.7
          font.family: root.ff
          font.pixelSize: Style.font.body
        }

        Repeater {
          model: root.groupRuns

          delegate: Column {
            id: cardWrap
            required property var modelData
            required property int index
            readonly property bool expanded: root.isExpanded(modelData.device)

            readonly property var groupPrefs: root.groupOf(modelData.device)
            readonly property bool grpEnabled: groupPrefs.enabled !== false
            readonly property real runSeverity: {
              var s = 0
              for (var i = 0; i < modelData.items.length; i++)
                s = Math.max(s, modelData.items[i].severity || 0)
              return s
            }
            readonly property string runBar: {
              if (modelData.device === "fan")
                return modelData.items.length + (modelData.items.length === 1 ? " fan" : " fans")
              var parts = []
              for (var i = 0; i < modelData.items.length; i++) parts.push(modelData.items[i].bar)
              return parts.join(" ")
            }

            width: parent.width
            spacing: Style.space(6)

            GroupCard {
              width: parent.width
              groupLabel: Metrics.GROUP_LABELS[cardWrap.modelData.device] || cardWrap.modelData.device
              groupGlyph: Metrics.GLYPH[cardWrap.modelData.device] || ""
              collapsedValue: cardWrap.runBar
              groupEnabled: cardWrap.grpEnabled
              expanded: cardWrap.expanded
              valueColor: root.metricColor(cardWrap.runSeverity, !cardWrap.grpEnabled)
              hasCursor: root.cursorIndex === cardWrap.index
              foreground: root.fg
              accent: root.ac
              fontFamily: root.ff

              onHovered: root.cursorIndex = cardWrap.index
              onToggled: if (root.hostWidget) root.hostWidget.setGroupEnabled(cardWrap.modelData.device, !cardWrap.grpEnabled)
              onExpandRequested: root.toggleExpanded(cardWrap.modelData.device)
            }

            // Each device's expanded config is its own Component, built
            // only on demand: collapsed cards (and the three device kinds
            // that AREN'T this card) never instantiate anything.
            Component {
              id: cpuConfig
              Column {
                width: cardWrap.width
                spacing: Style.space(8)

                Row {
                  width: parent.width
                  spacing: Style.space(14)
                  Chip {
                    text: "Auto"
                    active: cardWrap.groupPrefs.mode === "inherit"
                    foreground: root.fg; accent: root.ac; fontFamily: root.ff
                    onClicked: if (root.hostWidget) root.hostWidget.setGroupMode("cpu", "inherit")
                  }
                  SwitchPair {
                    leftLabel: "Number"; rightLabel: "Bar"
                    checked: cardWrap.groupPrefs.mode === "gauges"
                    foreground: root.fg; accent: root.ac; fontFamily: root.ff
                    onToggled: if (root.hostWidget) root.hostWidget.setGroupMode("cpu", checked ? "digits" : "gauges")
                  }
                }
                Row {
                  width: parent.width
                  spacing: Style.space(10)
                  Chip {
                    text: "Usage"
                    active: cardWrap.groupPrefs.showUsage !== false
                    foreground: root.fg; accent: root.ac; fontFamily: root.ff
                    onClicked: if (root.hostWidget) root.hostWidget.setGroupOption("cpu", "showUsage", !cardWrap.groupPrefs.showUsage)
                  }
                  Chip {
                    text: "Temp"
                    active: cardWrap.groupPrefs.showTemp !== false
                    foreground: root.fg; accent: root.ac; fontFamily: root.ff
                    onClicked: if (root.hostWidget) root.hostWidget.setGroupOption("cpu", "showTemp", !cardWrap.groupPrefs.showTemp)
                  }
                  Chip {
                    text: "Clock"
                    active: cardWrap.groupPrefs.showClocks === true
                    foreground: root.fg; accent: root.ac; fontFamily: root.ff
                    onClicked: if (root.hostWidget) root.hostWidget.setGroupOption("cpu", "showClocks", !cardWrap.groupPrefs.showClocks)
                  }
                }
                Row {
                  width: parent.width
                  spacing: Style.space(20)
                  SwitchPair {
                    leftLabel: "Icon"; rightLabel: "Word"
                    checked: cardWrap.groupPrefs.wordLabel === true
                    foreground: root.fg; accent: root.ac; fontFamily: root.ff
                    onToggled: if (root.hostWidget) root.hostWidget.setGroupOption("cpu", "wordLabel", !checked)
                  }
                  SwitchPair {
                    leftLabel: "Warm"; rightLabel: "Quiet"
                    checked: cardWrap.groupPrefs.tempColor === "secondary"
                    foreground: root.fg; accent: root.ac; fontFamily: root.ff
                    onToggled: if (root.hostWidget) root.hostWidget.setGroupOption("cpu", "tempColor", checked ? "primary" : "secondary")
                  }
                }
              }
            }

            Component {
              id: gpuConfig
              Column {
                width: cardWrap.width
                spacing: Style.space(8)

                Row {
                  width: parent.width
                  spacing: Style.space(14)
                  Chip {
                    text: "Auto"
                    active: cardWrap.groupPrefs.mode === "inherit"
                    foreground: root.fg; accent: root.ac; fontFamily: root.ff
                    onClicked: if (root.hostWidget) root.hostWidget.setGroupMode("gpu", "inherit")
                  }
                  SwitchPair {
                    leftLabel: "Number"; rightLabel: "Bar"
                    checked: cardWrap.groupPrefs.mode === "gauges"
                    foreground: root.fg; accent: root.ac; fontFamily: root.ff
                    onToggled: if (root.hostWidget) root.hostWidget.setGroupMode("gpu", checked ? "digits" : "gauges")
                  }
                }
                Row {
                  width: parent.width
                  spacing: Style.space(10)
                  Chip {
                    text: "Usage"
                    active: cardWrap.groupPrefs.showUsage !== false
                    foreground: root.fg; accent: root.ac; fontFamily: root.ff
                    onClicked: if (root.hostWidget) root.hostWidget.setGroupOption("gpu", "showUsage", !cardWrap.groupPrefs.showUsage)
                  }
                  Chip {
                    text: "Temp"
                    active: cardWrap.groupPrefs.showTemp !== false
                    foreground: root.fg; accent: root.ac; fontFamily: root.ff
                    onClicked: if (root.hostWidget) root.hostWidget.setGroupOption("gpu", "showTemp", !cardWrap.groupPrefs.showTemp)
                  }
                  Chip {
                    text: "Clock"
                    active: cardWrap.groupPrefs.showClocks === true
                    foreground: root.fg; accent: root.ac; fontFamily: root.ff
                    onClicked: if (root.hostWidget) root.hostWidget.setGroupOption("gpu", "showClocks", !cardWrap.groupPrefs.showClocks)
                  }
                }
                Row {
                  width: parent.width
                  spacing: Style.space(20)
                  SwitchPair {
                    leftLabel: "Icon"; rightLabel: "Word"
                    checked: cardWrap.groupPrefs.wordLabel === true
                    foreground: root.fg; accent: root.ac; fontFamily: root.ff
                    onToggled: if (root.hostWidget) root.hostWidget.setGroupOption("gpu", "wordLabel", !checked)
                  }
                  SwitchPair {
                    leftLabel: "Warm"; rightLabel: "Quiet"
                    checked: cardWrap.groupPrefs.tempColor === "secondary"
                    foreground: root.fg; accent: root.ac; fontFamily: root.ff
                    onToggled: if (root.hostWidget) root.hostWidget.setGroupOption("gpu", "tempColor", checked ? "primary" : "secondary")
                  }
                }
              }
            }

            Component {
              id: memConfig
              Column {
                width: cardWrap.width
                spacing: Style.space(8)

                Row {
                  width: parent.width
                  spacing: Style.space(14)
                  Chip {
                    text: "Auto"
                    active: cardWrap.groupPrefs.mode === "inherit"
                    foreground: root.fg; accent: root.ac; fontFamily: root.ff
                    onClicked: if (root.hostWidget) root.hostWidget.setGroupMode("mem", "inherit")
                  }
                  SwitchPair {
                    leftLabel: "Number"; rightLabel: "Bar"
                    checked: cardWrap.groupPrefs.mode === "gauges"
                    foreground: root.fg; accent: root.ac; fontFamily: root.ff
                    onToggled: if (root.hostWidget) root.hostWidget.setGroupMode("mem", checked ? "digits" : "gauges")
                  }
                }
                Row {
                  width: parent.width
                  spacing: Style.space(20)
                  SwitchPair {
                    leftLabel: "%"; rightLabel: "GiB"
                    checked: cardWrap.groupPrefs.ramFormat === "used"
                    foreground: root.fg; accent: root.ac; fontFamily: root.ff
                    onToggled: if (root.hostWidget) root.hostWidget.setGroupOption("mem", "ramFormat", checked ? "percent" : "used")
                  }
                  SwitchPair {
                    leftLabel: "Icon"; rightLabel: "Word"
                    checked: cardWrap.groupPrefs.wordLabel === true
                    foreground: root.fg; accent: root.ac; fontFamily: root.ff
                    onToggled: if (root.hostWidget) root.hostWidget.setGroupOption("mem", "wordLabel", !checked)
                  }
                }
              }
            }

            Component {
              id: fanConfig
              Column {
                width: cardWrap.width
                spacing: Style.space(8)

                Row {
                  width: parent.width
                  spacing: Style.space(20)
                  Chip {
                    text: "RPM"
                    active: cardWrap.groupPrefs.showRpm === true
                    foreground: root.fg; accent: root.ac; fontFamily: root.ff
                    onClicked: if (root.hostWidget) root.hostWidget.setGroupOption("fan", "showRpm", !cardWrap.groupPrefs.showRpm)
                  }
                  SwitchPair {
                    leftLabel: "Icon"; rightLabel: "Word"
                    checked: cardWrap.groupPrefs.wordLabel === true
                    foreground: root.fg; accent: root.ac; fontFamily: root.ff
                    onToggled: if (root.hostWidget) root.hostWidget.setGroupOption("fan", "wordLabel", !checked)
                  }
                }
                Column {
                  width: parent.width
                  spacing: Style.space(4)

                  Repeater {
                    model: cardWrap.modelData.items

                    delegate: MetricRow {
                      required property var modelData
                      required property int index

                      readonly property bool rowOff: Metrics.isHidden(modelData.key, cardWrap.groupPrefs.hidden)

                      rowLabel: modelData.label
                      rowValue: modelData.value
                      rowValueColor: root.metricColor(modelData.severity, rowOff)
                      off: rowOff
                      dimValue: modelData.dim === true
                      atFirst: index === 0
                      atLast: index === cardWrap.modelData.items.length - 1
                      foreground: root.fg
                      accent: root.ac
                      fontFamily: root.ff

                      onClicked: if (root.hostWidget) root.hostWidget.toggleFanHidden(modelData.key)
                      onMoveUp: if (root.hostWidget) root.hostWidget.moveFan(modelData.key, -1)
                      onMoveDown: if (root.hostWidget) root.hostWidget.moveFan(modelData.key, 1)
                    }
                  }
                }
              }
            }

            // Net's down/up pair has no natural 0-100 ratio, so there's
            // no Number/Bar choice to offer it — just enable (the card's
            // own switch) and icon-vs-word.
            Component {
              id: netConfig
              Column {
                width: cardWrap.width
                spacing: Style.space(8)

                Row {
                  width: parent.width
                  spacing: Style.space(10)
                  SwitchPair {
                    leftLabel: "Icon"; rightLabel: "Word"
                    checked: cardWrap.groupPrefs.wordLabel === true
                    foreground: root.fg; accent: root.ac; fontFamily: root.ff
                    onToggled: if (root.hostWidget) root.hostWidget.setGroupOption("net", "wordLabel", !checked)
                  }
                }
              }
            }

            Component {
              id: diskConfig
              Column {
                width: cardWrap.width
                spacing: Style.space(8)

                Row {
                  width: parent.width
                  spacing: Style.space(14)
                  Chip {
                    text: "Auto"
                    active: cardWrap.groupPrefs.mode === "inherit"
                    foreground: root.fg; accent: root.ac; fontFamily: root.ff
                    onClicked: if (root.hostWidget) root.hostWidget.setGroupMode("disk", "inherit")
                  }
                  SwitchPair {
                    leftLabel: "Number"; rightLabel: "Bar"
                    checked: cardWrap.groupPrefs.mode === "gauges"
                    foreground: root.fg; accent: root.ac; fontFamily: root.ff
                    onToggled: if (root.hostWidget) root.hostWidget.setGroupMode("disk", checked ? "digits" : "gauges")
                  }
                }
                Row {
                  width: parent.width
                  spacing: Style.space(10)
                  Chip {
                    text: "Usage"
                    active: cardWrap.groupPrefs.showUsage !== false
                    foreground: root.fg; accent: root.ac; fontFamily: root.ff
                    onClicked: if (root.hostWidget) root.hostWidget.setGroupOption("disk", "showUsage", !cardWrap.groupPrefs.showUsage)
                  }
                  Chip {
                    text: "Activity"
                    active: cardWrap.groupPrefs.showIo !== false
                    foreground: root.fg; accent: root.ac; fontFamily: root.ff
                    onClicked: if (root.hostWidget) root.hostWidget.setGroupOption("disk", "showIo", !cardWrap.groupPrefs.showIo)
                  }
                  SwitchPair {
                    leftLabel: "Icon"; rightLabel: "Word"
                    checked: cardWrap.groupPrefs.wordLabel === true
                    foreground: root.fg; accent: root.ac; fontFamily: root.ff
                    onToggled: if (root.hostWidget) root.hostWidget.setGroupOption("disk", "wordLabel", !checked)
                  }
                }
              }
            }

            Loader {
              width: parent.width
              active: cardWrap.expanded
              visible: active
              sourceComponent: {
                if (cardWrap.modelData.device === "cpu") return cpuConfig
                if (cardWrap.modelData.device === "gpu") return gpuConfig
                if (cardWrap.modelData.device === "mem") return memConfig
                if (cardWrap.modelData.device === "net") return netConfig
                if (cardWrap.modelData.device === "disk") return diskConfig
                if (cardWrap.modelData.device === "fan") return fanConfig
                return null
              }
            }
          }
        }

        Item { width: 1; height: Style.space(4) }

        PanelSeparator {
          width: parent.width
          foreground: root.fg
        }

        Text {
          width: parent.width
          text: "VIEW"
          color: root.fg
          opacity: 0.45
          font.family: root.ff
          font.pixelSize: Style.font.caption
        }

        Row {
          width: parent.width
          spacing: Style.space(10)

          SwitchPair {
            leftLabel: "Number"; rightLabel: "Bar"
            checked: root.prefs && root.prefs.defaultMode === "gauges"
            foreground: root.fg
            accent: root.ac
            fontFamily: root.ff
            onToggled: if (root.hostWidget) root.hostWidget.setDefaultMode(checked ? "digits" : "gauges")
          }
        }

        Row {
          width: parent.width
          spacing: Style.space(10)

          Chip {
            text: "+digits"
            active: root.prefs && root.prefs.showDigits === true
            foreground: root.fg
            accent: root.ac
            fontFamily: root.ff
            onClicked: if (root.hostWidget) root.hostWidget.setFlag("showDigits", !(root.prefs && root.prefs.showDigits))
          }
        }

        Stepper {
          width: parent.width
          title: "Color %"
          text: root.prefs ? String(root.prefs.colorIntensity) : "–"
          foreground: root.fg
          fontFamily: root.ff
          onDecrement: if (root.hostWidget) root.hostWidget.stepThreshold("colorIntensity", -10)
          onIncrement: if (root.hostWidget) root.hostWidget.stepThreshold("colorIntensity", 10)
        }

        Item { width: 1; height: Style.space(4) }

        PanelSeparator {
          width: parent.width
          foreground: root.fg
        }

        Text {
          width: parent.width
          text: "UNITS & ALERTS"
          color: root.fg
          opacity: 0.45
          font.family: root.ff
          font.pixelSize: Style.font.caption
        }

        Row {
          width: parent.width
          spacing: Style.space(10)

          SwitchPair {
            leftLabel: "°C"; rightLabel: "°F"
            checked: root.prefs && root.prefs.unit === "F"
            foreground: root.fg
            accent: root.ac
            fontFamily: root.ff
            onToggled: if (root.hostWidget) root.hostWidget.setUnit(checked ? "C" : "F")
          }
        }

        Stepper {
          width: parent.width
          title: "Usage warn %"
          text: root.prefs ? String(root.prefs.warnUsage) : "–"
          foreground: root.fg
          fontFamily: root.ff
          onDecrement: if (root.hostWidget) root.hostWidget.stepThreshold("warnUsage", -5)
          onIncrement: if (root.hostWidget) root.hostWidget.stepThreshold("warnUsage", 5)
        }

        Stepper {
          width: parent.width
          title: "Usage crit %"
          text: root.prefs ? String(root.prefs.critUsage) : "–"
          foreground: root.fg
          fontFamily: root.ff
          onDecrement: if (root.hostWidget) root.hostWidget.stepThreshold("critUsage", -5)
          onIncrement: if (root.hostWidget) root.hostWidget.stepThreshold("critUsage", 5)
        }

        Stepper {
          width: parent.width
          title: "Temp warn °"
          text: root.prefs ? String(root.prefs.warnTemp) : "–"
          foreground: root.fg
          fontFamily: root.ff
          onDecrement: if (root.hostWidget) root.hostWidget.stepThreshold("warnTemp", -1)
          onIncrement: if (root.hostWidget) root.hostWidget.stepThreshold("warnTemp", 1)
        }

        Stepper {
          width: parent.width
          title: "Temp crit °"
          text: root.prefs ? String(root.prefs.critTemp) : "–"
          foreground: root.fg
          fontFamily: root.ff
          onDecrement: if (root.hostWidget) root.hostWidget.stepThreshold("critTemp", -1)
          onIncrement: if (root.hostWidget) root.hostWidget.stepThreshold("critTemp", 1)
        }

        Item { width: 1; height: Style.space(4) }

        PanelSeparator {
          width: parent.width
          foreground: root.fg
        }

        Chip {
          text: "Reset defaults"
          active: false
          foreground: root.fg
          accent: root.ac
          fontFamily: root.ff
          onClicked: if (root.hostWidget) root.hostWidget.resetDefaults()
        }
      }
    }
  }
}
