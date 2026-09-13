// One monitor-group card's header: icon, short label, a live preview of
// the group's bar cell, an on/off switch and an expand button. Renders
// only the compact row — the caller (Panel.qml) owns the expanded state
// and places that group's own rows beneath this. Keeping this component
// header-only avoids QML's "default property" self-nesting trap.
//
// The whole row expands and collapses the card. The switch and the
// expand button take their own clicks, so enabling a group never
// requires opening its card first.
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

  // The group's cells exactly as the bar draws them (Modes.groupCells),
  // with the same color and gap tokens as the bar.
  property var previewCells: []
  property color previewSecondary: root.foreground
  property color previewHot: root.foreground
  property real previewWarmth: 1
  property real iconGap: 0
  property real partGap: 0
  property string fontFamily: "monospace"

  signal toggled()
  signal hovered()
  signal expandRequested()

  width: parent ? parent.width : 0
  implicitHeight: row.implicitHeight + Style.space(6)

  // Declared first, so it sits under the switch and the expand button.
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
    anchors.rightMargin: Style.space(2)
    spacing: Style.space(8)

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
      foreground: root.foreground
      accent: root.accent
      onToggled: root.toggled()
    }

    // A full-size hit target with a hover fill, pointing right while the
    // card is closed and down while it is open.
    PanelActionButton {
      iconText: root.expanded ? "" : ""
      fontFamily: root.fontFamily
      foreground: root.foreground
      onClicked: root.expandRequested()
    }
  }
}
