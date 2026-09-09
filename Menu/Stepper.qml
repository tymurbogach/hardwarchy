// A labelled numeric stepper: name, minus, value, plus.
// Used for the alert thresholds, which change too rarely to earn
// anything bigger.
import QtQuick
import QtQuick.Layouts
import qs.Commons

RowLayout {
  id: root

  required property string title
  required property string text

  property color foreground: "#ffffff"
  property string fontFamily: Style.font.family

  signal decrement()
  signal increment()

  spacing: Style.space(8)

  Text {
    Layout.fillWidth: true
    text: root.title
    elide: Text.ElideRight
    color: root.foreground
    opacity: 0.7
    font.family: root.fontFamily
    font.pixelSize: Style.font.body
  }

  Text {
    text: "−"
    color: root.foreground
    opacity: 0.6
    font.family: root.fontFamily
    font.pixelSize: Style.font.body

    MouseArea {
      anchors.fill: parent
      anchors.margins: -Style.space(4)
      hoverEnabled: true
      cursorShape: Qt.PointingHandCursor
      onClicked: root.decrement()
    }
  }

  Text {
    text: root.text
    color: root.foreground
    font.family: root.fontFamily
    font.pixelSize: Style.font.body
    font.bold: true
  }

  Text {
    text: "+"
    color: root.foreground
    opacity: 0.6
    font.family: root.fontFamily
    font.pixelSize: Style.font.body

    MouseArea {
      anchors.fill: parent
      anchors.margins: -Style.space(4)
      hoverEnabled: true
      cursorShape: Qt.PointingHandCursor
      onClicked: root.increment()
    }
  }
}
