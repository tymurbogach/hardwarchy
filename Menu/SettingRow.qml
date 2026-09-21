// One setting row: a title, then buttons. The buttons on the left add or
// remove one piece each (several can be on at once) or pick one source;
// the buttons flagged `right` sit at the far right, where every piece
// row keeps its own Quiet chip. A sub row refines the row above it and
// indents its title only, so every button stays in one column.
import QtQuick
import QtQuick.Layouts
import qs.Commons
import qs.Ui
import ".."

RowLayout {
  id: root

  required property string title
  // [{ label, on, enabled?, right?, tooltip? }]
  required property var buttons
  property bool sub: false
  // The button the keyboard cursor sits on, or -1.
  property int cursorButton: -1

  property color foreground: Color.foreground
  property color accent: Color.accent
  property string fontFamily: Style.font.family

  signal pressed(int index)

  spacing: Style.space(6)

  component Chip: Button {
    id: chip
    required property var modelData
    required property int index
    readonly property bool usable: modelData.enabled !== false
    readonly property bool gaugePreview: modelData.preview === "gauge"

    text: gaugePreview ? "" : modelData.label
    tooltipText: modelData.tooltip || (gaugePreview ? "Usage gauge" : "")
    selected: modelData.on === true
    enabled: usable
    opacity: usable ? 1 : 0.3
    hasCursor: index === root.cursorButton
    bordered: true
    foreground: root.foreground
    accent: root.accent
    fontFamily: root.fontFamily
    fontSize: Style.font.caption
    horizontalPadding: Style.space(6)
    verticalPadding: gaugePreview ? Style.space(7) : Style.space(2)

    Gauge {
      anchors.centerIn: parent
      visible: chip.gaugePreview === true
      width: Style.space(7)
      height: Style.space(14)
      ratio: 0.65
      fillColor: chip.foreground
    }
    onClicked: root.pressed(index)
  }

  Text {
    Layout.preferredWidth: Style.space(58)
    Layout.alignment: Qt.AlignVCenter
    leftPadding: root.sub ? Style.space(10) : 0
    text: root.title
    elide: Text.ElideRight
    color: root.foreground
    opacity: root.sub ? 0.5 : 0.7
    font.family: root.fontFamily
    font.pixelSize: Style.font.bodySmall
  }

  Flow {
    Layout.fillWidth: true
    Layout.alignment: Qt.AlignVCenter
    spacing: Style.space(3)

    Repeater {
      model: root.buttons
      delegate: Chip { visible: modelData.right !== true }
    }
  }

  // Quiet and Reset sit apart, at the far right.
  Row {
    Layout.alignment: Qt.AlignVCenter
    spacing: Style.space(2)

    Repeater {
      model: root.buttons
      delegate: Chip { visible: modelData.right === true }
    }
  }
}
