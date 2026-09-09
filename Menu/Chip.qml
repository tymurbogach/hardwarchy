// A caption-size chip: a small setting that answers to the mouse.
// Active chips take the accent; the rest sit quiet.
import QtQuick
import qs.Commons

Text {
  id: root

  required property bool active

  property color foreground: "#ffffff"
  property color accent: "#ffffff"
  property string fontFamily: Style.font.family

  signal clicked()

  color: root.active ? root.accent : root.foreground
  opacity: root.active ? 1.0 : 0.55
  font.family: root.fontFamily
  font.pixelSize: Style.font.caption
  font.bold: root.active

  MouseArea {
    anchors.fill: parent
    anchors.margins: -Style.space(4)
    hoverEnabled: true
    cursorShape: Qt.PointingHandCursor
    onClicked: root.clicked()
  }
}
