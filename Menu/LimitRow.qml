// One alert row: a title, then the warn and the crit threshold, each
// with its own minus and plus. A reading starts to warm at warn and is
// fully hot at crit. The title shares the SettingRow column. Buttons
// count 0 (warn −), 1 (warn +), 2 (crit −), 3 (crit +).
import QtQuick
import QtQuick.Layouts
import qs.Commons
import qs.Ui

RowLayout {
  id: root

  required property string title
  required property int warn
  required property int crit
  property string unit: ""
  // The button the keyboard cursor sits on, or -1.
  property int cursorButton: -1

  property color foreground: Color.foreground
  property string fontFamily: Style.font.family

  signal pressed(int index)

  spacing: Style.space(4)

  Text {
    Layout.preferredWidth: Style.space(58)
    text: root.title
    elide: Text.ElideRight
    color: root.foreground
    opacity: 0.7
    font.family: root.fontFamily
    font.pixelSize: Style.font.bodySmall
  }

  Repeater {
    model: [
      { name: "warn", value: root.warn, first: 0 },
      { name: "crit", value: root.crit, first: 2 }
    ]

    delegate: RowLayout {
      required property var modelData
      spacing: Style.space(1)

      Text {
        Layout.leftMargin: modelData.first > 0 ? Style.space(6) : 0
        text: modelData.name
        color: root.foreground
        opacity: 0.45
        font.family: root.fontFamily
        font.pixelSize: Style.font.caption
      }

      PanelActionButton {
        iconText: "−"
        size: Style.space(20)
        hasCursor: root.cursorButton === modelData.first
        fontFamily: root.fontFamily
        fontSize: Style.font.body
        foreground: root.foreground
        onClicked: root.pressed(modelData.first)
      }

      Text {
        Layout.preferredWidth: Style.space(34)
        horizontalAlignment: Text.AlignHCenter
        text: modelData.value + root.unit
        color: root.foreground
        font.family: root.fontFamily
        font.pixelSize: Style.font.bodySmall
        font.bold: true
      }

      PanelActionButton {
        iconText: "+"
        size: Style.space(20)
        hasCursor: root.cursorButton === modelData.first + 1
        fontFamily: root.fontFamily
        fontSize: Style.font.body
        foreground: root.foreground
        onClicked: root.pressed(modelData.first + 1)
      }
    }
  }

  Item { Layout.fillWidth: true }
}
