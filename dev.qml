// Development harness. Omarchy is not needed: the strip draws with
// the same MetricButton the bar uses, in a plain window, so what is
// photographed here is what ships.
//
//   quickshell -p dev.qml
//   HARDWARCHY_ENABLE=net,disk \
//     HARDWARCHY_PARTS='cpu.load=bar,number;cpu.temp=icon,value,quiet' \
//     HARDWARCHY_COLOR=0 HARDWARCHY_FAKE_GPU=1 \
//     HARDWARCHY_FAKE_LOAD=1 quickshell -p dev.qml
import QtQuick
import QtQuick.Layouts
import Quickshell
import Quickshell.Io
import "Model/Metrics.js" as Metrics
import "Model/Prefs.js" as Prefs
import "Styles/Modes.js" as Modes

ShellRoot {
  id: shell

  property var reading: Metrics.EMPTY

  function env(name) {
    return Quickshell.env("HARDWARCHY_" + name) || ""
  }

  // PARTS lists "group.part=toggle,toggle" entries split by ";": every
  // toggle named turns on, every other toggle of that part turns off, and
  // "quiet" mutes the part.
  function applyParts(p, spec) {
    var entries = spec.split(";")
    for (var i = 0; i < entries.length; i++) {
      var pair = entries[i].split("=")
      var path = pair[0].split(".")
      var group = p.groups[path[0]]
      var part = group ? group[path[1]] : null
      if (!part || typeof part !== "object") continue
      var keys = (pair[1] || "").split(",")
      for (var k in part) part[k] = keys.indexOf(k) >= 0
    }
  }

  // The installed widget reads prefs from disk; the harness takes them
  // from the environment so any state photographs cold.
  property var prefs: {
    var base = Prefs.adoptPrefs({ hidden: shell.env("HIDDEN").split(",") })
    var enable = shell.env("ENABLE").split(",")
    for (var i = 0; i < enable.length; i++)
      if (base.groups[enable[i]]) base.groups[enable[i]].enabled = true
    shell.applyParts(base, shell.env("PARTS"))
    var color = shell.env("COLOR")
    base.colorIntensity = color !== "" ? Number(color) : 100
    return Prefs.adoptPrefs(base)
  }

  function commit(next) { shell.prefs = Prefs.adoptPrefs(next) }

  function patchGroup(id, fields) {
    var p = Prefs.adoptPrefs(shell.prefs)
    for (var k in fields) p.groups[id][k] = fields[k]
    shell.commit(p)
  }

  readonly property bool fakeGpu: shell.env("FAKE_GPU") === "1"
  readonly property bool fakeLoad: shell.env("FAKE_LOAD") === "1"

  readonly property var effectiveReading: {
    var base = shell.reading
    var out = {}
    for (var k in base) out[k] = base[k]
    if (shell.fakeGpu && out.gpu === null && out.gpu_temp === null) {
      out.gpu = 23
      out.gpu_temp = 61
      out.gpu_mhz = 1500
      out.gpu_source = "amd"
      out.gpu_sources = ["amd"]
      out.gpu_detail = { vram_used_b: 2147483648, vram_total_b: 8589934592, watts: 42.5 }
    }
    if (shell.fakeLoad) {
      out.cpu = 92
      out.temp = 96
      out.mem = 88
      if (out.gpu !== null) out.gpu = 91
      if (out.gpu_temp !== null) out.gpu_temp = 97
    }
    return out
  }

  readonly property var allMetrics: Metrics.metrics(shell.effectiveReading, shell.prefs)
  readonly property var orderedMetrics: Metrics.orderKeys(shell.allMetrics,
    Metrics.metricsExpandGroupOrder(shell.prefs.order, shell.prefs.groups.fan.order))
  readonly property var effectiveHidden: Metrics.metricsEffectiveHidden(shell.orderedMetrics, shell.prefs)
  readonly property var visibleMetrics: Metrics.shown(shell.orderedMetrics, shell.effectiveHidden)
  readonly property var stripModel: Modes.groupStripCells(
    Metrics.metricsGroupRuns(shell.visibleMetrics), shell.prefs, false)

  // Same coloring contract as the widget: a reading warms toward red
  // past its thresholds, scaled by colorIntensity (0 never warms).
  readonly property color foreground: "#c0caf5"
  readonly property color hot: "#f7768e"
  readonly property color secondaryColor: "#565f89"
  function warm(amount) {
    var t = Math.min(1, (amount || 0) * (shell.prefs.colorIntensity / 100))
    if (!(t > 0)) return shell.foreground
    return Qt.rgba(shell.foreground.r + (shell.hot.r - shell.foreground.r) * t,
                   shell.foreground.g + (shell.hot.g - shell.foreground.g) * t,
                   shell.foreground.b + (shell.hot.b - shell.foreground.b) * t, 1)
  }

  property string devFont: shell.env("FONT") || "monospace"

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
    title: "hardwarchy preview"
    implicitWidth: 1100
    implicitHeight: 640
    color: "#1a1b26"

    Column {
      width: parent.width
      anchors.verticalCenter: parent.verticalCenter
      spacing: 24

      // What the bar will show. Clicking a cell cycles its group's load.
      Rectangle {
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

              pieces: modelData.pieces
              dimmed: modelData.dim
              fontFamily: shell.devFont
              fontSize: 20
              foreground: shell.foreground
              secondaryColor: shell.secondaryColor
              hotColor: shell.hot
              warmth: shell.prefs.colorIntensity / 100
              iconGap: shell.prefs.gaps.icon
              partGap: shell.prefs.gaps.part
              sideMargin: shell.prefs.gaps.metric / 2
              slotSize: 40
              onPressed: function(button) {
                var patch = Modes.cycleLoadPatch(shell.prefs, modelData.device)
                if (patch) shell.patchGroup(modelData.device, patch)
              }
            }
          }
        }
      }

      // What the menu will list. Click a row to flip its whole group.
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
            height: 26
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
                color: shell.foreground
                opacity: menuRow.off ? 0.35 : 0.7
                font.family: shell.devFont
                font.pixelSize: 14
              }
              Text {
                text: menuRow.modelData.value
                color: menuRow.off ? shell.foreground : shell.warm(menuRow.modelData.severity || 0)
                opacity: menuRow.off ? 0.35 : (menuRow.modelData.dim ? 0.5 : 1.0)
                font.family: shell.devFont
                font.pixelSize: 14
                font.bold: !menuRow.off && !menuRow.modelData.dim
              }
            }

            MouseArea {
              id: rowMouse
              anchors.fill: parent
              hoverEnabled: true
              onClicked: {
                var id = menuRow.modelData.device
                shell.patchGroup(id, { enabled: shell.prefs.groups[id].enabled !== true })
              }
            }
          }
        }
      }
    }
  }
}
