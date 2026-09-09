// The menu: every metric with its live value and toggle, then the
// view, units and alert settings in three small sections. The widget
// owns all state; this file only draws it and forwards gestures.
import QtQuick
import QtQuick.Layouts
import Quickshell
import qs.Commons
import qs.Ui
import "Model/Metrics.js" as Metrics
import "Styles/Modes.js" as Modes
import "Menu/MetricRow.qml" as MetricRow
import "Menu/Chip.qml" as Chip
import "Menu/Stepper.qml" as Stepper

Panel {
  id: root
  moduleName: "io.github.tymurbogach.modular-hw-monitor"
  manageIpc: false

  property var anchorItem: null
  property var hostWidget: null

  // Read back by the widget, which sizes the panel's anchor from them.
  readonly property real cardWidth: panel.contentWidth
  readonly property real cardHeight: panel.contentHeight

  readonly property var metrics:
    hostWidget ? hostWidget.orderedMetrics : []
  readonly property var prefs:
    hostWidget ? hostWidget.prefs : null

  // One highlight on screen at a time, driven by mouse and keys.
  // The keyboard cursor walks metric rows only; settings answer to
  // the mouse.
  property int cursorIndex: 0

  function clampCursor() {
    if (root.metrics.length === 0) { root.cursorIndex = 0; return }
    if (root.cursorIndex < 0) root.cursorIndex = 0
    if (root.cursorIndex > root.metrics.length - 1)
      root.cursorIndex = root.metrics.length - 1
  }

  onMetricsChanged: clampCursor()
  onOpenedChanged: if (opened) root.cursorIndex = 0

  function moveCursor(dy) {
    if (root.metrics.length === 0) return
    root.cursorIndex = (root.cursorIndex + dy + root.metrics.length) % root.metrics.length
  }

  function activateCursor() {
    var metric = root.metrics[root.cursorIndex]
    if (metric && root.hostWidget) root.hostWidget.toggleHidden(metric.key)
  }

  function isHidden(key) {
    return root.hostWidget
      ? Metrics.isHidden(key, root.hostWidget.prefs.hidden)
      : false
  }

  function metricColor(metric, off) {
    if (!root.hostWidget || off) return root.barForeground
    return root.hostWidget.warm(root.barForeground, metric.severity || 0)
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
          visible: root.metrics.length === 0
          text: "No readings yet."
          wrapMode: Text.WordWrap
          color: root.fg
          opacity: 0.7
          font.family: root.ff
          font.pixelSize: Style.font.body
        }

        Text {
          width: parent.width
          visible: root.metrics.length > 0
          text: "METRICS"
          color: root.fg
          opacity: 0.45
          font.family: root.ff
          font.pixelSize: Style.font.caption
        }

        Repeater {
          model: root.metrics

          delegate: MetricRow {
            required property var modelData
            required property int index

            readonly property bool off: root.isHidden(modelData.key)

            rowLabel: modelData.label
            rowValue: modelData.value
            rowValueColor: root.metricColor(modelData, off)
            off: off
            dimValue: modelData.dim === true
            atFirst: index === 0
            atLast: index === root.metrics.length - 1
            hasCursor: root.cursorIndex === index
            foreground: root.fg
            accent: root.ac
            fontFamily: root.ff

            onHovered: root.cursorIndex = index
            onClicked: if (root.hostWidget) root.hostWidget.toggleHidden(modelData.key)
            onMoveUp: if (root.hostWidget) root.hostWidget.moveMetric(modelData.key, -1)
            onMoveDown: if (root.hostWidget) root.hostWidget.moveMetric(modelData.key, 1)
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

          Repeater {
            model: Modes.MODES

            delegate: Chip {
              required property var modelData
              text: Modes.MODE_LABELS[modelData]
              active: root.prefs && root.prefs.mode === modelData
              foreground: root.fg
              accent: root.ac
              fontFamily: root.ff
              onClicked: if (root.hostWidget) root.hostWidget.setMode(modelData)
            }
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

          Chip {
            text: "Words"
            active: root.prefs && root.prefs.wordLabels === true
            foreground: root.fg
            accent: root.ac
            fontFamily: root.ff
            onClicked: if (root.hostWidget) root.hostWidget.setFlag("wordLabels", !(root.prefs && root.prefs.wordLabels))
          }

          Chip {
            text: "Graphite"
            active: root.prefs && root.prefs.colorMode === "graphite"
            foreground: root.fg
            accent: root.ac
            fontFamily: root.ff
            onClicked: if (root.hostWidget) root.hostWidget.setColorMode(root.prefs && root.prefs.colorMode === "graphite" ? "auto" : "graphite")
          }

          Chip {
            text: "Clocks"
            active: root.prefs && root.prefs.showClocks === true
            foreground: root.fg
            accent: root.ac
            fontFamily: root.ff
            onClicked: if (root.hostWidget) root.hostWidget.setFlag("showClocks", !(root.prefs && root.prefs.showClocks))
          }

          Chip {
            text: "GiB"
            active: root.prefs && root.prefs.ramFormat === "used"
            foreground: root.fg
            accent: root.ac
            fontFamily: root.ff
            onClicked: if (root.hostWidget) root.hostWidget.setRamFormat(root.prefs && root.prefs.ramFormat === "used" ? "percent" : "used")
          }
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

          Chip {
            text: "°C"
            active: !(root.prefs && root.prefs.unit === "F")
            foreground: root.fg
            accent: root.ac
            fontFamily: root.ff
            onClicked: if (root.hostWidget) root.hostWidget.setUnit("C")
          }

          Chip {
            text: "°F"
            active: root.prefs && root.prefs.unit === "F"
            foreground: root.fg
            accent: root.ac
            fontFamily: root.ff
            onClicked: if (root.hostWidget) root.hostWidget.setUnit("F")
          }

          Chip {
            text: "RPM"
            active: root.prefs && root.prefs.showRpm === true
            foreground: root.fg
            accent: root.ac
            fontFamily: root.ff
            onClicked: if (root.hostWidget) root.hostWidget.setFlag("showRpm", !(root.prefs && root.prefs.showRpm))
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
