// One bar cell: a row of pieces (label, gauge, readings) built by
// Styles/Modes.js. Pure QtQuick on purpose — no Omarchy imports — so the
// bar, the menu preview and the dev harness draw with this exact
// component.
//
// The bar hit-tests registered targets geometrically instead of giving
// the whole widget one click, so each cell registers itself and answers
// the clickable contract the bar checks.
import QtQuick

Item {
  id: root

  // Everything Omarchy-flavoured is injected: font, colors, the bar
  // handle for tooltip + click registration.
  property var bar: null
  // [{ kind: "mark"|"gauge"|"text", text, ratio, pad, quiet, severity, gap }]
  property var pieces: []
  property string fontFamily: "monospace"
  property real fontSize: 14
  property color foreground: "#ffffff"
  // Quiet pieces and pad digits draw in this color.
  property color secondaryColor: root.foreground
  // A piece warms from `foreground` toward `hotColor` by its severity
  // times `warmth` (0 never warms, 1 reaches hotColor at critical).
  property color hotColor: root.foreground
  property real warmth: 1

  // The space before a piece: `iconGap` inside one part (an icon and its
  // reading, a gauge and its digits), `partGap` between two parts. Both
  // are measured ink to ink.
  property real iconGap: 0
  property real partGap: 0
  // Half the gap to the neighbouring cell; each side owns half.
  property real sideMargin: 5
  property real slotSize: 0
  property bool vertical: false

  property bool dimmed: false
  property string tooltipText: ""

  // About the height of the icon ink, and half as wide: sized from the
  // font so the gauge keeps its proportion at any theme font size.
  property real gaugeHeight: Math.round(root.fontSize * 0.93)
  property real gaugeWidth: Math.max(4, Math.round(root.gaugeHeight / 2))

  // The clickable contract the bar checks before dispatching a press.
  property bool interactive: true
  property bool pressable: true
  property bool concealed: false

  signal pressed(int button)

  function triggerPress(button) {
    if (root.bar) root.bar.hideTooltip(root)
    root.pressed(button)
  }

  function pieceColor(piece) {
    if (piece.quiet) return root.secondaryColor
    var t = Math.min(1, Math.max(0, (piece.severity || 0) * root.warmth))
    if (t <= 0) return root.foreground
    var from = root.foreground
    var to = root.hotColor
    return Qt.rgba(from.r + (to.r - from.r) * t,
                   from.g + (to.g - from.g) * t,
                   from.b + (to.b - from.b) * t,
                   from.a)
  }

  function gapBefore(piece) {
    if (piece.gap === "tight") return root.iconGap
    if (piece.gap === "part") return root.partGap
    return 0
  }

  // Every reading opens with a digit. Its left bearing comes off the
  // gap, so the gap is ink-to-ink on that side too. Its ink centre is
  // where the gauge centres: a text centres its line box, whose middle
  // sits below the ink, so a gauge centred on the box reads low.
  TextMetrics {
    id: digitInk
    font.family: root.fontFamily
    font.pixelSize: root.fontSize
    text: "0"
  }

  // The line box every text piece shares: one font, one height, one
  // baseline, measured on a real Text rather than on font metrics.
  Text {
    id: lineRef
    visible: false
    text: "0"
    font.family: root.fontFamily
    font.pixelSize: root.fontSize
    renderType: Text.NativeRendering
  }

  readonly property real digitBearing: Math.max(0, digitInk.tightBoundingRect.x)
  readonly property real digitInkMid: -(digitInk.tightBoundingRect.y + digitInk.tightBoundingRect.height / 2)
  readonly property real contentHeight: lineRef.implicitHeight
  readonly property real gaugeY: lineRef.baselineOffset - root.digitInkMid - root.gaugeHeight / 2
  readonly property real contentWidth: content.implicitWidth

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

  Row {
    id: content
    anchors.centerIn: parent
    height: root.contentHeight
    rotation: root.vertical ? 90 : 0

    Repeater {
      model: root.pieces

      // One piece. Its width holds the gap before it, so the Row packs
      // pieces with the right spacing and no positioner arithmetic.
      delegate: Item {
        id: piece
        required property var modelData
        readonly property string kind: modelData.kind
        readonly property real gap: root.gapBefore(modelData)
        readonly property string padText: kind === "text" ? modelData.text.substring(0, modelData.pad || 0) : ""
        readonly property string mainText: kind === "text" ? modelData.text.substring(modelData.pad || 0) : ""

        // A mark's drawn ink and its advance cell are different boxes,
        // per glyph. Placing it by the ink keeps one gap visually equal
        // under every icon and word. A missing glyph inks nothing, so
        // fall back to the advance width.
        TextMetrics {
          id: ink
          font.family: root.fontFamily
          font.pixelSize: root.fontSize
          text: piece.kind === "mark" ? piece.modelData.text : ""
        }
        readonly property real inkLeft: ink.tightBoundingRect.width > 0 ? ink.tightBoundingRect.x : 0
        readonly property real inkWidth: ink.tightBoundingRect.width > 0 ? ink.tightBoundingRect.width : ink.advanceWidth

        width: gap + (kind === "mark" ? inkWidth
          : kind === "gauge" ? root.gaugeWidth
          : padItem.implicitWidth + mainItem.implicitWidth - root.digitBearing)
        height: root.contentHeight

        Text {
          visible: piece.kind === "mark"
          x: piece.gap - piece.inkLeft
          text: piece.kind === "mark" ? piece.modelData.text : ""
          color: root.pieceColor(piece.modelData)
          font.family: root.fontFamily
          font.pixelSize: root.fontSize
          renderType: Text.NativeRendering
        }

        Gauge {
          visible: piece.kind === "gauge"
          x: piece.gap
          y: root.gaugeY
          width: root.gaugeWidth
          height: root.gaugeHeight
          ratio: piece.kind === "gauge" ? piece.modelData.ratio : 0
          fillColor: root.pieceColor(piece.modelData)
        }

        // Split in two so a zero-padded reading ("03%") can draw its
        // padding character in its own color: muted unless the group's
        // zero is regular, then the same as the digits after it.
        Text {
          id: padItem
          visible: piece.padText !== ""
          x: piece.gap - root.digitBearing
          text: piece.padText
          color: piece.modelData.padQuiet === false ? root.pieceColor(piece.modelData) : root.secondaryColor
          font.family: root.fontFamily
          font.pixelSize: root.fontSize
          renderType: Text.NativeRendering
        }

        Text {
          id: mainItem
          visible: piece.kind === "text"
          x: piece.gap - root.digitBearing + padItem.implicitWidth
          text: piece.mainText
          color: root.pieceColor(piece.modelData)
          font.family: root.fontFamily
          font.pixelSize: root.fontSize
          renderType: Text.NativeRendering
        }
      }
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
