// Development harness. Omarchy is not needed: the strip draws with
// the same MetricButton the bar uses, in a plain window, so what is
// photographed here is what ships.
//
//   quickshell -p dev.qml
//   MODULAR_HW_MONITOR_HIDDEN='mem_usage' MODULAR_HW_MONITOR_MODE=combo \
//     MODULAR_HW_MONITOR_GRAPHITE=1 MODULAR_HW_MONITOR_FAKE_GPU=1 \
//     MODULAR_HW_MONITOR_FAKE_LOAD=1 quickshell -p dev.qml
import QtQuick
import QtQuick.Layouts
import Quickshell
import Quickshell.Io
import "Model/Metrics.js" as Metrics
import "Model/Prefs.js" as Prefs
import "Model/Tooltip.js" as Tips
import "Styles/Modes.js" as Modes

ShellRoot {
  id: shell

  property var reading: Metrics.EMPTY

  function envFlag(name) {
    return (Quickshell.env(name) || "") === "1"
  }

  // The installed widget reads prefs from disk; the harness takes
  // them from the environment so any state photographs cold.
  property var prefs: Prefs.adoptPrefs({
    hidden: (Quickshell.env("MODULAR_HW_MONITOR_HIDDEN") || "").split(","),
    mode: Quickshell.env("MODULAR_HW_MONITOR_MODE") || "digits",
    showDigits: Quickshell.env("MODULAR_HW_MONITOR_DIGITS") !== "0",
    wordLabels: shell.envFlag("MODULAR_HW_MONITOR_WORDS"),
    colorMode: shell.envFlag("MODULAR_HW_MONITOR_GRAPHITE") ? "graphite" : "auto",
    showClocks: shell.envFlag("MODULAR_HW_MONITOR_CLOCKS"),
    ramFormat: Quickshell.env("MODULAR_HW_MONITOR_RAM") === "used" ? "used" : "percent"
  })

  function commit(next) { shell.prefs = Prefs.adoptPrefs(next) }

  function toggleHidden(key) {
    var p = Prefs.adoptPrefs(shell.prefs)
    var out = []
    var found = false
    for (var i = 0; i < p.hidden.length; i++) {
      if (p.hidden[i] === key) found = true
      else out.push(p.hidden[i])
    }
    if (!found) out.push(key)
    p.hidden = out
    shell.commit(p)
  }

  function setFlag(name, value) {
    var p = Prefs.adoptPrefs(shell.prefs)
    p[name] = value
    shell.commit(p)
  }

  readonly property bool fakeGpu: shell.envFlag("MODULAR_HW_MONITOR_FAKE_GPU")
  readonly property bool fakeLoad: shell.envFlag("MODULAR_HW_MONITOR_FAKE_LOAD")

  readonly property var effectiveReading: {
    var base = shell.reading
    if (shell.fakeGpu && base.gpu === null && base.gpu_temp === null) {
      var gpuDetail = base.gpu_detail
      if (gpuDetail === null)
        gpuDetail = { vram_used_b: 2147483648, vram_total_b: 8589934592, watts: 42.5 }
      base = {
        schema: 1, cpu: base.cpu, temp: base.temp, mem: base.mem,
        gpu: 23, gpu_temp: 61, fans: base.fans,
        cpu_mhz: base.cpu_mhz, gpu_mhz: 1500,
        mem_used_kib: base.mem_used_kib, mem_total_kib: base.mem_total_kib,
        swap_used_kib: base.swap_used_kib, swap_total_kib: base.swap_total_kib,
        cpu_model: base.cpu_model, cpu_cores: base.cpu_cores,
        load: base.load, gpu_detail: gpuDetail
      }
    }
    if (!shell.fakeLoad) return base
    return {
      schema: 1, cpu: 92, temp: 96, mem: 88,
      gpu: base.gpu !== null ? 91 : base.gpu,
      gpu_temp: base.gpu_temp !== null ? 97 : base.gpu_temp,
      fans: base.fans,
      cpu_mhz: base.cpu_mhz, gpu_mhz: base.gpu_mhz,
      mem_used_kib: base.mem_used_kib, mem_total_kib: base.mem_total_kib,
      swap_used_kib: base.swap_used_kib, swap_total_kib: base.swap_total_kib,
      cpu_model: base.cpu_model, cpu_cores: base.cpu_cores,
      load: base.load, gpu_detail: base.gpu_detail
    }
  }

  readonly property var allMetrics: Metrics.metrics(shell.effectiveReading,
    ({ unit: shell.prefs.unit, showRpm: shell.prefs.showRpm,
       showClocks: shell.prefs.showClocks, ramFormat: shell.prefs.ramFormat,
       showDigits: shell.prefs.showDigits, wordLabels: shell.prefs.wordLabels,
       mode: shell.prefs.mode }), shell.prefs)
  readonly property var orderedMetrics: Metrics.orderKeys(shell.allMetrics, shell.prefs.order)
  readonly property var stripModel: Modes.stripCells(shell.orderedMetrics,
    shell.prefs.hidden, Modes.normalizeMode(shell.prefs.mode),
    ({ showDigits: shell.prefs.showDigits, wordLabels: shell.prefs.wordLabels }))

  // Same coloring contract as the widget: foreground warms toward red
  // past the thresholds, graphite stays flat gray.
  function grayOf() { return "#9aa0b4" }
  function warm(amount) {
    if (shell.prefs.colorMode === "graphite") return shell.grayOf()
    if (!(amount > 0)) return "#c0caf5"
    var t = Math.min(1, amount)
    function mix(a, b) { return Math.round(a + (b - a) * t) }
    return Qt.rgba(mix(192, 247) / 255, mix(202, 118) / 255, mix(245, 142) / 255, 1)
  }

  property string devFont: Quickshell.env("MODULAR_HW_MONITOR_FONT") || "monospace"
  property real iconGap: 2
  property real metricGap: 10

  readonly property string readerPath:
    String(Qt.resolvedUrl("scripts/sysread")).replace("file://", "")

  Process {
    id: reader
    command: [shell.readerPath, "--loop", "--interval", "1"]
    running: true
    stdout: SplitParser {
      onRead: data => {
        const parsed = Metrics.parse(data)
        if (Metrics.hasReading(parsed)) shell.reading = parsed
      }
    }
  }

  FloatingWindow {
    id: window
    title: "modular-hw-monitor preview"
    implicitWidth: 1100
    implicitHeight: 640
    color: "#1a1b26"

    Column {
      id: preview
      width: parent.width
      anchors.verticalCenter: parent.verticalCenter
      spacing: 24

      // What the bar will show.
      Rectangle {
        id: pill
        anchors.horizontalCenter: parent.horizontalCenter
        width: strip.implicitWidth + 20
        height: 40
        color: "#24283b"

        Row {
          id: strip
          anchors.centerIn: parent

          Repeater {
            model: shell.stripModel

            delegate: MetricButton {
              required property var modelData
              readonly property bool isJoined: modelData.cell === "joined"
              readonly property var cellMetric: isJoined ? modelData.usage : modelData.metric
              readonly property bool isGauge: modelData.cell === "gauge" || isJoined
              readonly property real cellSeverity: {
                if (isJoined)
                  return Math.max(modelData.usage.severity || 0, modelData.temp.severity || 0)
                return (cellMetric && cellMetric.severity) || 0
              }

              glyph: cellMetric ? cellMetric.glyph : ""
              showGlyph: modelData.bare !== true
              gaugeRatio: isGauge && cellMetric && typeof cellMetric.ratio === "number"
                ? cellMetric.ratio : -1
              value: {
                if (!cellMetric) return ""
                if (modelData.cell === "gauge" && !modelData.withDigits) return ""
                if (isJoined) return modelData.temp.bar
                if (modelData.bare === true) return cellMetric.label + " " + cellMetric.bar
                return cellMetric.bar
              }
              dimmed: cellMetric ? cellMetric.dim === true : true
              fontFamily: shell.devFont
              fontSize: 20
              foreground: shell.warm(cellSeverity)
              iconGap: shell.iconGap
              sideMargin: shell.metricGap / 2
              slotSize: 40
              // The harness has no menu: every button cycles the mode.
              onPressed: function(button) {
                var p = Prefs.adoptPrefs(shell.prefs)
                p.mode = Modes.nextMode(p.mode)
                shell.commit(p)
              }
            }
          }
        }
      }

      // What the menu will show. Click a row to toggle that metric.
      Column {
        anchors.horizontalCenter: parent.horizontalCenter
        spacing: 2

        Repeater {
          model: shell.orderedMetrics

          delegate: Rectangle {
            id: menuRow
            required property var modelData
            readonly property bool off: Metrics.isHidden(modelData.key, shell.prefs.hidden)

            width: 420
            height: 30
            color: rowMouse.containsMouse ? "#2a2f45" : "transparent"

            RowLayout {
              anchors.fill: parent
              anchors.leftMargin: 8
              anchors.rightMargin: 8
              spacing: 12

              Text {
                Layout.fillWidth: true
                text: menuRow.modelData.label
                elide: Text.ElideRight
                color: "#c0caf5"
                opacity: menuRow.off ? 0.35 : 0.7
                font.family: shell.devFont
                font.pixelSize: 14
              }
              Text {
                text: menuRow.modelData.value
                color: menuRow.off ? "#c0caf5" : shell.warm(menuRow.modelData.severity || 0)
                opacity: menuRow.off ? 0.35 : (menuRow.modelData.dim ? 0.5 : 1.0)
                font.family: shell.devFont
                font.pixelSize: 14
                font.bold: !menuRow.off && !menuRow.modelData.dim
              }
              Rectangle {
                Layout.alignment: Qt.AlignVCenter
                width: 28; height: 15
                color: menuRow.off ? "#3b4261" : "#7aa2f7"
                Rectangle {
                  width: 11; height: 11; y: 2
                  x: menuRow.off ? 2 : 15
                  color: "#1a1b26"
                }
              }
            }

            MouseArea {
              id: rowMouse
              anchors.fill: parent
              hoverEnabled: true
              onClicked: shell.toggleHidden(menuRow.modelData.key)
            }
          }
        }

        // Stand-in for the menu settings: mode chips plus toggles.
        Column {
          anchors.horizontalCenter: parent.horizontalCenter
          spacing: 4

          Row {
            anchors.horizontalCenter: parent.horizontalCenter
            spacing: 14

            Repeater {
              model: Modes.MODES

              delegate: Text {
                required property var modelData
                readonly property bool active: shell.prefs.mode === modelData
                text: Modes.MODE_LABELS[modelData]
                color: active ? "#7aa2f7" : "#c0caf5"
                opacity: active ? 1.0 : 0.55
                font.family: shell.devFont
                font.pixelSize: 12
                font.bold: active

                MouseArea {
                  anchors.fill: parent
                  hoverEnabled: true
                  cursorShape: Qt.PointingHandCursor
                  onClicked: {
                    var p = Prefs.adoptPrefs(shell.prefs)
                    p.mode = modelData
                    shell.commit(p)
                  }
                }
              }
            }
          }

          Row {
            anchors.horizontalCenter: parent.horizontalCenter
            spacing: 14

            Text {
              text: shell.prefs.unit === "F" ? "°F" : "°C"
              color: "#7aa2f7"
              font.family: shell.devFont
              font.pixelSize: 12
              font.bold: true
              MouseArea {
                anchors.fill: parent
                hoverEnabled: true
                cursorShape: Qt.PointingHandCursor
                onClicked: shell.setFlag("unit", !(shell.prefs.unit === "F") ? "F" : "C")
              }
            }

            Text {
              text: "+digits"
              color: shell.prefs.showDigits ? "#7aa2f7" : "#c0caf5"
              font.family: shell.devFont
              font.pixelSize: 12
              MouseArea {
                anchors.fill: parent
                hoverEnabled: true
                cursorShape: Qt.PointingHandCursor
                onClicked: shell.setFlag("showDigits", !shell.prefs.showDigits)
              }
            }

            Text {
              text: shell.prefs.wordLabels ? "Words" : "words"
              color: shell.prefs.wordLabels ? "#7aa2f7" : "#c0caf5"
              font.family: shell.devFont
              font.pixelSize: 12
              MouseArea {
                anchors.fill: parent
                hoverEnabled: true
                cursorShape: Qt.PointingHandCursor
                onClicked: shell.setFlag("wordLabels", !shell.prefs.wordLabels)
              }
            }

            Text {
              text: shell.prefs.colorMode === "graphite" ? "Graphite" : "graphite"
              color: shell.prefs.colorMode === "graphite" ? "#7aa2f7" : "#c0caf5"
              font.family: shell.devFont
              font.pixelSize: 12
              MouseArea {
                anchors.fill: parent
                hoverEnabled: true
                cursorShape: Qt.PointingHandCursor
                onClicked: shell.setFlag("colorMode", shell.prefs.colorMode === "graphite" ? "auto" : "graphite")
              }
            }
          }
        }
      }
    }
  }
}
