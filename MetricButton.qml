// One bar cell: a glyph (or words), an optional gauge, a value.
// Pure QtQuick on purpose — no Omarchy imports — so the bar and the
// dev harness draw with this exact component.
//
// The bar hit-tests registered targets geometrically instead of giving
// the whole widget one click, so each metric registers itself and
// answers the clickable contract the bar checks.
import QtQuick

Item {
  id: root

  // Everything Omarchy-flavoured is injected: font, colors, the bar
  // handle for tooltip + click registration.
  property var bar: null
  property string glyph: ""
  property string value: ""
  property bool showGlyph: true
  property string fontFamily: "monospace"
  property real fontSize: 14
  property color foreground: "#ffffff"

  // Ink-to-ink gap between glyph and value, in real pixels.
  property real iconGap: 0
  // Half the gap to the neighbouring cell; each side owns half.
  property real sideMargin: 5
  property real slotSize: 0
  property bool vertical: false

  property bool dimmed: false
  property string tooltipText: ""

  // How many leading characters of `value` are padding (e.g. the "0" in
  // a zero-padded "03%") to draw in `secondaryColor` instead of
  // `foreground`. Zero (the default) draws the whole value in one color,
  // identical to before this existed.
  property int padLen: 0
  property color secondaryColor: root.foreground

  // A joined cell's second half (e.g. temp, fused right after usage with
  // no separator) — its own single-color segment, independent of
  // `value`'s pad split, since "temp reads secondary" is a whole-value
  // choice while `value`'s own padding is only ever one leading digit.
  property string trailValue: ""
  property bool trailSecondary: false
  // Ink-to-ink gap before the trailing segment, same unit as iconGap —
  // keeps the two fused halves near each other without gluing them.
  property real trailGap: 0

  // Gauge mode: -1 draws glyph plus value; 0..1 draws glyph plus a
  // vertical gauge, with the value only when it is non-empty.
  property real gaugeRatio: -1
  property real gaugeWidth: 7
  property real gaugeHeight: 14

  readonly property bool showGauge: root.gaugeRatio >= 0
  readonly property bool showValue: root.value !== ""

  // The clickable contract the bar checks before dispatching a press.
  property bool interactive: true
  property bool pressable: true
  property bool concealed: false

  signal pressed(int button)

  function triggerPress(button) {
    if (root.bar) root.bar.hideTooltip(root)
    root.pressed(button)
  }

  // A Nerd Font glyph's drawn ink and its advance cell are different
  // boxes, per icon. Measuring the ink box and placing the value
  // against it keeps one iconGap visually equal for every icon.
  // A missing glyph inks nothing, so fall back to the advance width
  // rather than sliding the value under the icon.
  TextMetrics {
    id: ink
    font.family: root.fontFamily
    font.pixelSize: root.fontSize
    text: root.glyph
  }

  readonly property real inkLeft: !root.showGlyph ? 0
    : ink.tightBoundingRect.width > 0 ? ink.tightBoundingRect.x : 0
  readonly property real inkWidth: !root.showGlyph ? 0
    : ink.tightBoundingRect.width > 0 ? ink.tightBoundingRect.width : ink.advanceWidth

  // Words mode hides the glyph and its gap entirely, or the value
  // keeps a glyph-sized hole on its left.
  readonly property real glyphAdvance: root.showGlyph ? root.inkWidth + root.iconGap : 0
  readonly property real gaugeAdvance: root.showGauge ? root.gaugeWidth + root.iconGap : 0

  readonly property string valuePadText: root.padLen > 0 ? root.value.substring(0, root.padLen) : ""
  readonly property string valueMainText: root.padLen > 0 ? root.value.substring(root.padLen) : root.value

  readonly property bool showTrail: root.trailValue !== ""
  readonly property real trailAdvance: root.showTrail ? root.trailGap : 0

  readonly property real contentWidth: root.glyphAdvance + root.gaugeAdvance
    + (root.showValue ? valuePad.implicitWidth + valueMain.implicitWidth : 0)
    + (root.showTrail ? root.trailAdvance + valueTrail.implicitWidth : 0)
  readonly property real contentHeight: Math.max(glyphText.implicitHeight,
    valueMain.implicitHeight, root.showGauge ? root.gaugeHeight : 0)

  implicitWidth: root.vertical
    ? (root.slotSize > 0 ? root.slotSize : root.contentHeight)
    : root.contentWidth + root.sideMargin * 2
  implicitHeight: root.vertical
    ? root.contentWidth + root.sideMargin * 2
    : (root.slotSize > 0 ? root.slotSize : root.contentHeight)

  opacity: root.concealed ? 0 : (root.dimmed ? 0.45 : 1)

  Behavior on opacity {
    NumberAnimation { duration: 140; easing.type: Easing.OutCubic }
  }

  Item {
    id: content
    width: root.contentWidth
    height: root.contentHeight
    anchors.centerIn: parent
    rotation: root.vertical ? 90 : 0

    Text {
      id: glyphText
      visible: root.showGlyph
      // Start at the ink, not the cell: the space before an icon
      // otherwise varies per icon too.
      x: -root.inkLeft
      anchors.verticalCenter: parent.verticalCenter
      text: root.glyph
      color: root.foreground
      font.family: root.fontFamily
      font.pixelSize: root.fontSize
      renderType: Text.NativeRendering
    }

    // Split in two so a zero-padded value ("03%") can draw its padding
    // character in a quieter secondary color than the significant digit
    // — padLen 0 (the default) leaves valuePad empty and valueMain at
    // the same position/text as the single Text this replaced.
    Text {
      id: valuePad
      visible: root.showValue && root.padLen > 0
      x: root.glyphAdvance + root.gaugeAdvance
      anchors.verticalCenter: parent.verticalCenter
      text: root.valuePadText
      color: root.secondaryColor
      font.family: root.fontFamily
      font.pixelSize: root.fontSize
      renderType: Text.NativeRendering
    }

    Text {
      id: valueMain
      visible: root.showValue
      x: root.glyphAdvance + root.gaugeAdvance + valuePad.implicitWidth
      anchors.verticalCenter: parent.verticalCenter
      text: root.valueMainText
      color: root.foreground
      font.family: root.fontFamily
      font.pixelSize: root.fontSize
      renderType: Text.NativeRendering
    }

    Text {
      id: valueTrail
      visible: root.showTrail
      x: root.glyphAdvance + root.gaugeAdvance + valuePad.implicitWidth + valueMain.implicitWidth + root.trailAdvance
      anchors.verticalCenter: parent.verticalCenter
      text: root.trailValue
      color: root.trailSecondary ? root.secondaryColor : root.foreground
      font.family: root.fontFamily
      font.pixelSize: root.fontSize
      renderType: Text.NativeRendering
    }

    Gauge {
      visible: root.showGauge
      x: root.glyphAdvance
      anchors.verticalCenter: parent.verticalCenter
      width: root.gaugeWidth
      height: root.gaugeHeight
      ratio: Math.max(0, root.gaugeRatio)
      fillColor: root.foreground
    }
  }

  MouseArea {
    id: mouseArea
    anchors.fill: parent
    acceptedButtons: Qt.LeftButton | Qt.RightButton | Qt.MiddleButton
    enabled: root.interactive
    hoverEnabled: true
    cursorShape: root.pressable ? Qt.PointingHandCursor : Qt.ArrowCursor

    onEntered: if (root.bar) root.bar.showTooltip(root, root.tooltipText)
    onExited: if (root.bar) root.bar.hideTooltip(root)
    onClicked: function(mouse) { if (root.pressable) root.triggerPress(mouse.button) }

    // Swallowed, not handled: in the bar's centre section an unaccepted
    // double-click falls through to the transparency toggle. Accepting
    // it here keeps a double-click on a metric from blanking the bar.
    onDoubleClicked: function(mouse) { mouse.accepted = true }
  }

  property var registeredBar: null

  function syncClickRegistration() {
    if (registeredBar && registeredBar.unregisterClickTarget)
      registeredBar.unregisterClickTarget(root)
    registeredBar = root.bar
    if (registeredBar && registeredBar.registerClickTarget)
      registeredBar.registerClickTarget(root)
  }

  onBarChanged: syncClickRegistration()
  onVisibleChanged: if (!visible && root.bar) root.bar.hideTooltip(root)
  Component.onCompleted: syncClickRegistration()
  Component.onDestruction: {
    if (registeredBar && registeredBar.unregisterClickTarget)
      registeredBar.unregisterClickTarget(root)
  }
}
