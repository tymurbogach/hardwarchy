// A vertical usage gauge: a capsule that fills from the bottom.
// Pure QtQuick on purpose — no Omarchy imports — so the bar and the
// dev harness share this exact component.
import QtQuick

Item {
  id: root

  // 0..1 filled from the bottom.
  property real ratio: 0
  property color fillColor: "#ffffff"
  property color trackColor: Qt.rgba(fillColor.r, fillColor.g, fillColor.b, 0.14)
  property color borderColor: Qt.rgba(fillColor.r, fillColor.g, fillColor.b, 0.4)

  property real bodyWidth: 7
  property real bodyHeight: 14
  readonly property real inset: 1

  readonly property real clamped: Math.max(0, Math.min(1, root.ratio))

  implicitWidth: root.bodyWidth
  implicitHeight: root.bodyHeight

  Rectangle {
    id: body
    anchors.centerIn: parent
    width: root.bodyWidth
    height: root.bodyHeight
    radius: Math.max(2, width / 2)
    color: root.trackColor
    border.width: 1
    border.color: root.borderColor

    Rectangle {
      id: fill
      anchors.left: parent.left
      anchors.right: parent.right
      anchors.bottom: parent.bottom
      anchors.margins: root.inset
      radius: Math.max(1, body.radius - root.inset)
      color: root.fillColor

      // A live-but-idle reading still earns a sliver, never nothing.
      readonly property real span: body.height - root.inset * 2
      height: root.clamped <= 0 ? 0 : Math.max(2, Math.round(span * root.clamped))

      Behavior on height { NumberAnimation { duration: 300; easing.type: Easing.OutCubic } }
      Behavior on color { ColorAnimation { duration: 200 } }
    }
  }
}
