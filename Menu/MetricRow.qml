// One metric row in the menu: live label and value, a move control
// for ordering, and a read-only switch showing on/off. The row owns
// the click; the switch is display only so a row never has two hit
// regions with the same effect.
import QtQuick
import QtQuick.Layouts
import qs.Commons
import qs.Ui

CursorSurface {
  id: root

  required property string rowLabel
  required property string rowValue
  required property color rowValueColor
  required property bool off
  required property bool dimValue
  required property bool atFirst
  required property bool atLast

  property string fontFamily: "monospace"

  signal clicked()
  signal hovered()
  signal moveUp()
  signal moveDown()

  width: parent ? parent.width : 0
  implicitHeight: rowLayout.implicitHeight + Style.space(10)

  RowLayout {
    id: rowLayout
    anchors.fill: parent
    anchors.leftMargin: Style.space(8)
    anchors.rightMargin: Style.space(8)
    spacing: Style.space(6)

    Text {
      Layout.fillWidth: true
      text: root.rowLabel
      elide: Text.ElideRight
      color: root.foreground
      // A hidden metric reads as off from across the menu.
      opacity: root.off ? 0.35 : 0.7
      font.family: root.fontFamily
      font.pixelSize: Style.font.body
    }

    Text {
      text: root.rowValue
      color: root.rowValueColor
      opacity: root.off ? 0.35 : (root.dimValue ? 0.5 : 1.0)
      font.family: root.fontFamily
      font.pixelSize: Style.font.body
      font.bold: !root.off && !root.dimValue
    }

    // Space is always reserved: hiding via `visible` collapses the
    // neighbouring arrow out of the RowLayout with it, so off-ends go
    // transparent and non-interactive instead.
    Text {
      text: "^"
      opacity: root.atFirst ? 0 : 0.5
      color: root.foreground
      font.family: root.fontFamily
      font.pixelSize: Style.font.caption

      MouseArea {
        anchors.fill: parent
        anchors.margins: -Style.space(4)
        enabled: !root.atFirst
        hoverEnabled: true
        cursorShape: Qt.PointingHandCursor
        onClicked: function(mouse) { mouse.accepted = true; root.moveUp() }
      }
    }

    Text {
      text: "v"
      opacity: root.atLast ? 0 : 0.5
      color: root.foreground
      font.family: root.fontFamily
      font.pixelSize: Style.font.caption

      MouseArea {
        anchors.fill: parent
        anchors.margins: -Style.space(4)
        enabled: !root.atLast
        hoverEnabled: true
        cursorShape: Qt.PointingHandCursor
        onClicked: function(mouse) { mouse.accepted = true; root.moveDown() }
      }
    }

    ToggleSwitch {
      Layout.alignment: Qt.AlignVCenter
      checked: !root.off
      interactive: false
      foreground: root.foreground
      accent: root.accent
    }
  }

  MouseArea {
    anchors.fill: parent
    hoverEnabled: true
    cursorShape: Qt.PointingHandCursor
    onEntered: root.hovered()
    onClicked: root.clicked()
  }
}
