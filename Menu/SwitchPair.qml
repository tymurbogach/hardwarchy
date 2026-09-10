// A compact binary choice: two short labels flanking a bare switch,
// the whole row clickable — one flip between exactly two states
// (Icon/Word, Number/Bar, warm/quiet, %/GiB, °C/°F), rather than two
// separate Chip buttons pretending to be independent.
import QtQuick
import qs.Commons
import qs.Ui

Item {
  id: root

  property string leftLabel: ""
  property string rightLabel: ""
  // false selects leftLabel, true selects rightLabel.
  property bool checked: false

  property color foreground: "#ffffff"
  property color accent: "#ffffff"
  property string fontFamily: Style.font.family

  signal toggled()

  implicitWidth: inner.implicitWidth
  implicitHeight: inner.implicitHeight

  // Row is a Positioner: none of ITS children may carry anchors, so the
  // vertical-centering happens one level up instead, on Row itself.
  Row {
    id: inner
    anchors.verticalCenter: parent.verticalCenter
    spacing: Style.space(6)

    Text {
      text: root.leftLabel
      color: root.checked ? root.foreground : root.accent
      opacity: root.checked ? 0.55 : 1.0
      font.family: root.fontFamily
      font.pixelSize: Style.font.caption
      font.bold: !root.checked
    }

    ToggleSwitch {
      checked: root.checked
      interactive: false
      trackHeight: 14
      foreground: root.foreground
      accent: root.accent
    }

    Text {
      text: root.rightLabel
      color: root.checked ? root.accent : root.foreground
      opacity: root.checked ? 1.0 : 0.55
      font.family: root.fontFamily
      font.pixelSize: Style.font.caption
      font.bold: root.checked
    }
  }

  MouseArea {
    anchors.fill: parent
    anchors.margins: -Style.space(4)
    hoverEnabled: true
    cursorShape: Qt.PointingHandCursor
    onClicked: root.toggled()
  }
}
