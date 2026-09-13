// A labelled numeric stepper: name, minus, value, plus. The value sits
// in a fixed-width slot, so the buttons never shift as it changes.
// Buttons count 0 (−) and 1 (+) for the keyboard cursor.
import QtQuick
import QtQuick.Layouts
import qs.Commons
import qs.Ui

RowLayout {
  id: root

  required property string title
  required property string text
  // The button the keyboard cursor sits on, or -1.
  property int cursorButton: -1

  property color foreground: Color.foreground
  property string fontFamily: Style.font.family

  signal pressed(int index)

  spacing: Style.space(4)

  Text {
    Layout.fillWidth: true
    text: root.title
    elide: Text.ElideRight
    color: root.foreground
    opacity: 0.7
    font.family: root.fontFamily
    font.pixelSize: Style.font.bodySmall
  }

  PanelActionButton {
    iconText: "−"
    size: Style.space(20)
    hasCursor: root.cursorButton === 0
    fontFamily: root.fontFamily
    fontSize: Style.font.body
    foreground: root.foreground
    onClicked: root.pressed(0)
  }

  Text {
    Layout.preferredWidth: Style.space(34)
    horizontalAlignment: Text.AlignHCenter
    text: root.text
    color: root.foreground
    font.family: root.fontFamily
    font.pixelSize: Style.font.bodySmall
    font.bold: true
  }

  PanelActionButton {
    iconText: "+"
    size: Style.space(20)
    hasCursor: root.cursorButton === 1
    fontFamily: root.fontFamily
    fontSize: Style.font.body
    foreground: root.foreground
    onClicked: root.pressed(1)
  }
}
