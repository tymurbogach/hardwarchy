// One fact at the top of an open card ("Model", "Intel Core Ultra 9
// 285H"): the title sits in the column every setting row uses, the value
// is plain text. Nothing here takes a click or the keyboard cursor.
import QtQuick
import QtQuick.Layouts
import qs.Commons

RowLayout {
  id: root

  required property string title
  required property string value

  property color foreground: Color.foreground
  property string fontFamily: Style.font.family

  spacing: Style.space(6)

  Text {
    Layout.preferredWidth: Style.space(58)
    text: root.title
    elide: Text.ElideRight
    color: root.foreground
    opacity: 0.5
    font.family: root.fontFamily
    font.pixelSize: Style.font.bodySmall
  }

  Text {
    Layout.fillWidth: true
    text: root.value
    elide: Text.ElideRight
    color: root.foreground
    opacity: 0.85
    font.family: root.fontFamily
    font.pixelSize: Style.font.bodySmall
  }
}
