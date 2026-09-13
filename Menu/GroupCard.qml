// One monitor-group card's header: an open/closed caret, icon, short
// label, a live preview of the group's bar cell, an on/off switch and
// arrows that move the group in the bar. Renders only the compact row —
// the caller (Panel.qml) owns the expanded state and places that group's
// own rows beneath this. Keeping this component header-only avoids QML's
// "default property" self-nesting trap.
//
// A click anywhere on the row opens or closes the card; the switch and
// the arrows take their own clicks. Buttons count 0 (caret), 1 (switch),
// 2 (up) and 3 (down) for the keyboard cursor.
import QtQuick
import QtQuick.Layouts
import qs.Commons
import qs.Ui
import ".."

CursorSurface {
  id: root

  required property string groupLabel
  required property string groupGlyph
  required property bool groupEnabled
  required property bool expanded
  property bool atFirst: false
  property bool atLast: false
  // The button the keyboard cursor sits on, or -1.
  property int cursorButton: -1

  // The group's cells exactly as the bar draws them (Modes.groupCells),
  // with the same color and gap tokens as the bar.
  property var previewCells: []
  property color previewSecondary: root.foreground
  property color previewHot: root.foreground
  property real previewWarmth: 1
  property real iconGap: 0
  property real partGap: 0
  property string fontFamily: "monospace"

  signal pressed(int index)
  signal hovered()

  width: parent ? parent.width : 0
  implicitHeight: row.implicitHeight + Style.space(6)

  // Declared first, so it sits under the switch and the arrows.
  MouseArea {
    anchors.fill: parent
    hoverEnabled: true
    cursorShape: Qt.PointingHandCursor
    onEntered: root.hovered()
    onClicked: root.pressed(0)
  }

  RowLayout {
    id: row
    anchors.left: parent.left
    anchors.right: parent.right
    anchors.verticalCenter: parent.verticalCenter
    anchors.leftMargin: Style.space(2)
    anchors.rightMargin: Style.space(2)
    spacing: Style.space(6)

    // A caret, not a chevron: the arrows at the far right move the group.
    PanelActionButton {
      iconText: root.expanded ? "\uf0d7" : "\uf0da"
      size: Style.space(18)
      hasCursor: root.cursorButton === 0
      fontFamily: root.fontFamily
      fontSize: Style.font.caption
      foreground: root.foreground
      opacity: 0.6
      onClicked: root.pressed(0)
    }

    // A fixed glyph column: icons differ in width, and the labels after
    // them line up from card to card.
    Text {
      Layout.preferredWidth: Style.space(18)
      horizontalAlignment: Text.AlignHCenter
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

    // A group switched on whose pieces are all off draws nothing; say so
    // instead of leaving a blank the user has to puzzle over.
    Text {
      visible: root.previewCells.length === 0
      text: "nothing shown"
      color: root.foreground
      opacity: 0.4
      font.family: root.fontFamily
      font.pixelSize: Style.font.caption
      font.italic: true
    }

    // The preview: what this group puts on the bar right now, or would
    // put there once switched on (then dimmed).
    Row {
      Repeater {
        model: root.previewCells

        delegate: MetricButton {
          required property var modelData

          pieces: modelData.pieces
          interactive: false
          dimmed: !root.groupEnabled || modelData.dim
          fontFamily: root.fontFamily
          fontSize: Style.font.body
          foreground: root.foreground
          secondaryColor: root.previewSecondary
          hotColor: root.previewHot
          warmth: root.groupEnabled ? root.previewWarmth : 0
          iconGap: root.iconGap
          partGap: root.partGap
          sideMargin: Style.spaceReal(3)
        }
      }
    }

    ToggleSwitch {
      trackHeight: Style.space(18)
      cursorPad: Style.space(3)
      checked: root.groupEnabled
      hasCursor: root.cursorButton === 1
      foreground: root.foreground
      accent: root.accent
      onToggled: root.pressed(1)
    }

    // An end card keeps its arrow's place and swallows the click.
    PanelActionButton {
      iconText: "\uf062"
      size: Style.space(20)
      hasCursor: root.cursorButton === 2
      fontFamily: root.fontFamily
      fontSize: Style.font.caption
      foreground: root.foreground
      opacity: root.atFirst ? 0.25 : 1
      tooltipText: "Move left in the bar"
      onClicked: if (!root.atFirst) root.pressed(2)
    }

    PanelActionButton {
      iconText: "\uf063"
      size: Style.space(20)
      hasCursor: root.cursorButton === 3
      fontFamily: root.fontFamily
      fontSize: Style.font.caption
      foreground: root.foreground
      opacity: root.atLast ? 0.25 : 1
      tooltipText: "Move right in the bar"
      onClicked: if (!root.atLast) root.pressed(3)
    }
  }
}
