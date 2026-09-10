// One monitor-group card's HEADER: icon, short label, live value, a real
// on/off switch, and an expand chevron. Renders only the compact row —
// the caller (Panel.qml) owns the expanded state and places that
// group's own controls as a sibling Column beneath this, shown/hidden
// together with `expanded`. Keeping this component header-only avoids
// QML's "default property" self-nesting trap: a component can't safely
// redirect its own internal children into an alias of one of its own
// children, so this file simply doesn't try to accept extra content.
//
// Click semantics split like MetricRow's row-vs-switch, but flipped:
// the row body expands/collapses (that's the new primary action), the
// switch is the one thing with its own hit target, so enabling a group
// never requires opening its card first.
import QtQuick
import QtQuick.Layouts
import qs.Commons
import qs.Ui

CursorSurface {
  id: root

  required property string groupLabel
  required property string groupGlyph
  required property string collapsedValue
  required property bool groupEnabled
  required property bool expanded

  property color valueColor: root.foreground
  property string fontFamily: "monospace"

  signal toggled()
  signal hovered()
  signal expandRequested()

  width: parent ? parent.width : 0
  implicitHeight: row.implicitHeight + Style.space(10)

  MouseArea {
    anchors.fill: parent
    hoverEnabled: true
    cursorShape: Qt.PointingHandCursor
    onEntered: root.hovered()
    onClicked: root.expandRequested()
  }

  RowLayout {
    id: row
    anchors.left: parent.left
    anchors.right: parent.right
    anchors.verticalCenter: parent.verticalCenter
    anchors.leftMargin: Style.space(8)
    anchors.rightMargin: Style.space(8)
    spacing: Style.space(8)

    Text {
      text: root.groupGlyph
      color: root.foreground
      opacity: root.groupEnabled ? 0.9 : 0.35
      font.family: root.fontFamily
      font.pixelSize: Style.font.body
    }

    Text {
      Layout.fillWidth: true
      text: root.groupLabel
      elide: Text.ElideRight
      color: root.foreground
      opacity: root.groupEnabled ? 0.7 : 0.35
      font.family: root.fontFamily
      font.pixelSize: Style.font.body
    }

    Text {
      text: root.collapsedValue
      color: root.valueColor
      opacity: root.groupEnabled ? 1.0 : 0.35
      font.family: root.fontFamily
      font.pixelSize: Style.font.body
      font.bold: root.groupEnabled
    }

    ToggleSwitch {
      Layout.alignment: Qt.AlignVCenter
      checked: root.groupEnabled
      foreground: root.foreground
      accent: root.accent
      onToggled: root.toggled()
    }

    // Plain Unicode, not Nerd Font: expand/collapse must read clearly
    // even on a system whose monospace font isn't patched.
    Text {
      text: root.expanded ? "▾" : "▸"
      color: root.foreground
      opacity: 0.5
      font.pixelSize: Style.font.caption
    }
  }
}
