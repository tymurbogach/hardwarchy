// One fan row inside the Fans card: an on/off switch, the fan's name
// (editable in place), its live value, and move buttons for its place in
// the bar. Buttons count 0 (switch), 1 (rename), 2 (up) and 3 (down) for
// the keyboard cursor. The caller owns the rename state (`editing`), so
// a row rebuilt by a new reading keeps it.
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
  property bool editing: false
  // The button the keyboard cursor sits on, or -1.
  property int cursorButton: -1

  property string fontFamily: "monospace"

  signal toggled()
  signal renameRequested()
  signal renamed(string name)
  signal renameCancelled()
  signal moveUp()
  signal moveDown()

  width: parent ? parent.width : 0
  implicitHeight: rowLayout.implicitHeight + Style.space(2)

  RowLayout {
    id: rowLayout
    anchors.fill: parent
    anchors.leftMargin: Style.space(4)
    anchors.rightMargin: Style.space(2)
    spacing: Style.space(4)

    // The switch is the row's add-or-remove box, first like a checkbox.
    ToggleSwitch {
      checked: !root.off
      hasCursor: root.cursorButton === 0
      trackHeight: Style.space(14)
      cursorPad: Style.space(2)
      foreground: root.foreground
      accent: root.accent
      onToggled: root.toggled()
    }

    Text {
      Layout.fillWidth: true
      visible: !root.editing
      text: root.rowLabel
      elide: Text.ElideRight
      color: root.foreground
      // A hidden fan reads as off from across the menu.
      opacity: root.off ? 0.35 : 0.7
      font.family: root.fontFamily
      font.pixelSize: Style.font.bodySmall
    }

    Loader {
      Layout.fillWidth: true
      active: root.editing
      visible: active
      sourceComponent: TextField {
        text: root.rowLabel
        foreground: root.foreground
        accent: root.accent
        font.family: root.fontFamily
        font.pixelSize: Style.font.bodySmall
        verticalPadding: Style.space(1)
        placeholderText: "Name (empty resets)"
        Component.onCompleted: { forceActiveFocus(); selectAll() }
        onAccepted: root.renamed(text)
        Keys.onEscapePressed: root.renameCancelled()
      }
    }

    Text {
      visible: !root.editing
      text: root.rowValue
      color: root.rowValueColor
      opacity: root.off ? 0.35 : (root.dimValue ? 0.5 : 1.0)
      font.family: root.fontFamily
      font.pixelSize: Style.font.bodySmall
      font.bold: !root.off && !root.dimValue
    }

    PanelActionButton {
      iconText: "\uf040"
      size: Style.space(20)
      hasCursor: root.cursorButton === 1
      fontFamily: root.fontFamily
      fontSize: Style.font.caption
      foreground: root.foreground
      tooltipText: "Rename"
      onClicked: root.editing ? root.renameCancelled() : root.renameRequested()
    }

    // An end row keeps its button's space and swallows the click.
    PanelActionButton {
      iconText: "\uf062"
      size: Style.space(20)
      hasCursor: root.cursorButton === 2
      fontFamily: root.fontFamily
      fontSize: Style.font.caption
      foreground: root.foreground
      opacity: root.atFirst ? 0.25 : 1
      onClicked: if (!root.atFirst) root.moveUp()
    }

    PanelActionButton {
      iconText: "\uf063"
      size: Style.space(20)
      hasCursor: root.cursorButton === 3
      fontFamily: root.fontFamily
      fontSize: Style.font.caption
      foreground: root.foreground
      opacity: root.atLast ? 0.25 : 1
      onClicked: if (!root.atLast) root.moveDown()
    }
  }
}
