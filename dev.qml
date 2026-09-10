// Development harness. Omarchy is not needed: the strip draws with
// the same MetricButton the bar uses, in a plain window, so what is
// photographed here is what ships.
//
//   quickshell -p dev.qml
//   MODULAR_HW_MONITOR_HIDDEN='mem_usage' MODULAR_HW_MONITOR_MODE=combo \
//     MODULAR_HW_MONITOR_COLOR=0 MODULAR_HW_MONITOR_FAKE_GPU=1 \
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
  // them from the environment so any state photographs cold. The seed
  // below is deliberately v1-shaped (hidden/mode/ramFormat) so it goes
  // through the same upgrade path a real old prefs file would;
  // colorIntensity and the per-group word/temp-color choices are v2-only
  // fields with nothing to migrate from, so they're overlaid on the
  // already-adopted result instead. The harness only exposes these for
  // the cpu group — enough to preview the feature, not a full per-group
  // control surface (that's what the real menu is for).
  property var prefs: {
    var base = Prefs.adoptPrefs({
      hidden: (Quickshell.env("MODULAR_HW_MONITOR_HIDDEN") || "").split(","),
      mode: Quickshell.env("MODULAR_HW_MONITOR_MODE") || "digits",
      showDigits: Quickshell.env("MODULAR_HW_MONITOR_DIGITS") !== "0",
      showClocks: shell.envFlag("MODULAR_HW_MONITOR_CLOCKS"),
      ramFormat: Quickshell.env("MODULAR_HW_MONITOR_RAM") === "used" ? "used" : "percent"
    })
    var envColor = Quickshell.env("MODULAR_HW_MONITOR_COLOR")
    base.colorIntensity = envColor !== "" ? Math.max(0, Math.min(100, Number(envColor))) : 100
    base.groups.cpu.wordLabel = shell.envFlag("MODULAR_HW_MONITOR_WORDS")
    base.groups.cpu.tempColor = shell.envFlag("MODULAR_HW_MONITOR_TEMP_SECONDARY") ? "secondary" : "primary"
    return base
  }

  function commit(next) { shell.prefs = Prefs.adoptPrefs(next) }

  // The harness has no per-group cards like the real menu: clicking a
  // preview row just flips that metric's whole group on/off, which is
  // enough to photograph a group being hidden.
  function toggleGroupEnabled(id) {
    var p = Prefs.adoptPrefs(shell.prefs)
    if (p.groups[id]) p.groups[id].enabled = p.groups[id].enabled !== true
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

  function groupMode(id) {
    var g = shell.prefs.groups[id]
    var m = (g && g.mode) || "inherit"
    return m === "inherit" ? Modes.normalizeMode(shell.prefs.defaultMode) : Modes.normalizeMode(m)
  }

  readonly property var groupModes: ({ cpu: shell.groupMode("cpu"), gpu: shell.groupMode("gpu") })
  readonly property var allMetrics: Metrics.metrics(shell.effectiveReading, shell.groupModes, shell.prefs)
  readonly property var orderedMetrics: Metrics.orderKeys(shell.allMetrics,
    Metrics.metricsExpandGroupOrder(shell.prefs.order, shell.prefs.groups.fan.order))
  readonly property var effectiveHidden: Metrics.metricsEffectiveHidden(shell.orderedMetrics, shell.prefs)
  readonly property var visibleMetrics: Metrics.shown(shell.orderedMetrics, shell.effectiveHidden)
  function groupModeOpts(id) {
    var g = shell.prefs.groups[id]
    return { showDigits: shell.prefs.showDigits, wordLabels: !!(g && g.wordLabel) }
  }
  readonly property var stripModel: {
    var runs = Metrics.metricsGroupRuns(shell.visibleMetrics)
    var out = []
    for (var i = 0; i < runs.length; i++) {
      var run = runs[i]
      out = out.concat(Modes.buildStripCells(run.items, shell.groupMode(run.device), shell.groupModeOpts(run.device)))
    }
    return out
  }

  // Same coloring contract as the widget: foreground warms toward red
  // past the thresholds, scaled by colorIntensity (0 never warms).
  readonly property color secondaryColor: "#565f89"
  function warm(amount) {
    var scaled = (amount || 0) * (shell.prefs.colorIntensity / 100)
    if (!(scaled > 0)) return "#c0caf5"
    var t = Math.min(1, scaled)
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
              readonly property bool isGauge: modelData.cell === "gauge"
                || (isJoined && modelData.gaugeFirst === true)
              readonly property real cellSeverity: {
                if (isJoined)
                  return Math.max(modelData.usage.severity || 0, modelData.temp.severity || 0)
                return (cellMetric && cellMetric.severity) || 0
              }
              readonly property string cellDevice: isJoined ? modelData.usage.device : (cellMetric ? cellMetric.device : "")
              readonly property bool isTempCell: !isJoined && (cellDevice === "cpu" || cellDevice === "gpu")
                && cellMetric && cellMetric.kind === "temp"
              readonly property bool tempIsSecondary: {
                var g = shell.prefs.groups[cellDevice]
                return !!(g && g.tempColor === "secondary")
              }
              readonly property string wordLabelText: cellDevice === "fan"
                ? (cellMetric ? cellMetric.label : "")
                : (Metrics.GROUP_LABELS[cellDevice] || (cellMetric ? cellMetric.label : ""))

              glyph: cellMetric ? cellMetric.glyph : ""
              showGlyph: modelData.bare !== true
              gaugeRatio: isGauge && cellMetric && typeof cellMetric.ratio === "number"
                ? cellMetric.ratio : -1
              value: {
                if (!cellMetric) return ""
                if (modelData.cell === "gauge" && !modelData.withDigits) return ""
                if (isJoined) {
                  if (modelData.bare === true) return wordLabelText + " " + modelData.usage.bar
                  return isGauge ? "" : modelData.usage.bar
                }
                if (modelData.bare === true) return wordLabelText + " " + cellMetric.bar
                return cellMetric.bar
              }
              trailValue: isJoined ? modelData.temp.bar : ""
              trailSecondary: isJoined && tempIsSecondary
              trailGap: iconGap
              padLen: {
                if (isTempCell && tempIsSecondary) return value.length
                if (modelData.bare === true) return 0
                if (isJoined) return (!isGauge && modelData.usage.padLen) || 0
                return (cellMetric && cellMetric.padLen) || 0
              }
              secondaryColor: shell.secondaryColor
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
                p.defaultMode = Modes.nextMode(p.defaultMode)
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
            readonly property bool off: Metrics.isHidden(modelData.key, shell.effectiveHidden)

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
              onClicked: shell.toggleGroupEnabled(menuRow.modelData.device)
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
                readonly property bool active: shell.prefs.defaultMode === modelData
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
                    p.defaultMode = modelData
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
              text: shell.prefs.groups.cpu.wordLabel ? "CPU: Word" : "cpu: word"
              color: shell.prefs.groups.cpu.wordLabel ? "#7aa2f7" : "#c0caf5"
              font.family: shell.devFont
              font.pixelSize: 12
              MouseArea {
                anchors.fill: parent
                hoverEnabled: true
                cursorShape: Qt.PointingHandCursor
                onClicked: {
                  var p = Prefs.adoptPrefs(shell.prefs)
                  p.groups.cpu.wordLabel = !p.groups.cpu.wordLabel
                  shell.commit(p)
                }
              }
            }

            Text {
              text: "color " + shell.prefs.colorIntensity + "%"
              color: "#c0caf5"
              font.family: shell.devFont
              font.pixelSize: 12
              MouseArea {
                anchors.fill: parent
                hoverEnabled: true
                cursorShape: Qt.PointingHandCursor
                // Cycle 100 -> 0 -> 50 -> 100, enough to preview the range.
                onClicked: {
                  var cur = shell.prefs.colorIntensity
                  var next = cur >= 100 ? 0 : (cur === 0 ? 50 : 100)
                  shell.setFlag("colorIntensity", next)
                }
              }
            }

            Text {
              text: shell.prefs.groups.cpu.tempColor === "secondary" ? "CPU: Temp 2nd" : "cpu: temp 2nd"
              color: shell.prefs.groups.cpu.tempColor === "secondary" ? "#7aa2f7" : "#c0caf5"
              font.family: shell.devFont
              font.pixelSize: 12
              MouseArea {
                anchors.fill: parent
                hoverEnabled: true
                cursorShape: Qt.PointingHandCursor
                onClicked: {
                  var p = Prefs.adoptPrefs(shell.prefs)
                  p.groups.cpu.tempColor = p.groups.cpu.tempColor === "secondary" ? "primary" : "secondary"
                  shell.commit(p)
                }
              }
            }
          }
        }
      }
    }
  }
}
