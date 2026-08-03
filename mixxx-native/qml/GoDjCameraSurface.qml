import Mixxx 1.0 as Mixxx
import QtCore
import QtMultimedia
import QtQuick
import QtQuick.Controls
import QtQuick.Layouts

// Universal performance surface for the real Mixxx QML application.
// The camera is intentionally independent from the Outside Lands catalog so
// this component can be reused by any Go DJ! skin or festival configuration.
Item {
    id: root

    property bool cameraEnabled: false
    property string convexUrl: "https://watchful-herring-241.convex.cloud"
    property bool expanded: false
    property string sessionKey: "android-mixxx-" + Date.now() + "-" + Math.random().toString(36).slice(2)
    property real surfaceScale: 1.0

    height: expanded ? 450 : 360
    scale: surfaceScale
    width: expanded ? 450 : 330
    z: 1000

    CameraPermission {
        id: cameraPermission

        onStatusChanged: {
            if (status === Qt.PermissionStatus.Granted) root.cameraEnabled = true;
        }
    }

    Camera {
        id: performanceCamera

        active: root.cameraEnabled && cameraPermission.status === Qt.PermissionStatus.Granted
    }
    CaptureSession {
        camera: performanceCamera
        videoOutput: preview
    }

    Mixxx.ControlProxy {
        id: playA

        group: "[Channel1]"
        key: "play"
    }
    Mixxx.ControlProxy {
        id: playB

        group: "[Channel2]"
        key: "play"
    }
    Mixxx.ControlProxy {
        id: syncA

        group: "[Channel1]"
        key: "sync_enabled"
    }
    Mixxx.ControlProxy {
        id: syncB

        group: "[Channel2]"
        key: "sync_enabled"
    }
    Mixxx.ControlProxy {
        id: crossfader

        group: "[Master]"
        key: "crossfader"
    }
    Mixxx.ControlProxy {
        id: filterA

        group: "[QuickEffectRack1_[Channel1]]"
        key: "super1"
    }

    function postConvex(route, payload) {
        if (!root.convexUrl) return;
        var request = new XMLHttpRequest();
        request.open("POST", root.convexUrl + route);
        request.setRequestHeader("Content-Type", "application/json");
        request.send(JSON.stringify(payload));
    }

    function ensureConvexSession() {
        postConvex("/api/native/session", {
            sessionKey: root.sessionKey,
            displayName: "Go DJ! Android Mixxx",
        });
    }

    function reportCommand(command, args) {
        postConvex("/api/native/dispatch", {
            sessionKey: root.sessionKey,
            command: command,
            args: args,
            source: "android-mixxx",
            protocol: "mixxx-command-v1",
            requestId: root.sessionKey + "-" + Date.now() + "-" + command,
        });
    }

    Component.onCompleted: root.ensureConvexSession()
    Mixxx.ControlProxy {
        id: filterB

        group: "[QuickEffectRack1_[Channel2]]"
        key: "super1"
    }

    Rectangle {
        id: panel

        anchors.fill: parent
        color: "#121927e8"
        radius: 14
        border.color: root.cameraEnabled ? "#57e6da" : "#45516a"
        border.width: 1

        ColumnLayout {
            anchors.fill: parent
            anchors.margins: 10
            spacing: 7

            RowLayout {
                Layout.fillWidth: true
                spacing: 7

                Text {
                    Layout.fillWidth: true
                    color: "#f5f7fb"
                    elide: Text.ElideRight
                    font.bold: true
                    font.pixelSize: 12
                    text: "PERFORMANCE CAMERA"
                }
                Button {
                    id: cameraButton

                    Layout.preferredHeight: 28
                    Layout.preferredWidth: 108
                    text: root.cameraEnabled ? "STOP" : "ALLOW"

                    onClicked: {
                        if (cameraPermission.status === Qt.PermissionStatus.Granted) {
                            root.cameraEnabled = !root.cameraEnabled;
                        } else {
                            cameraPermission.request();
                        }
                    }
                }
                Button {
                    Layout.preferredHeight: 28
                    Layout.preferredWidth: 32
                    text: root.expanded ? "−" : "+"

                    onClicked: root.expanded = !root.expanded
                }
            }

            Item {
                Layout.fillHeight: true
                Layout.fillWidth: true
                clip: true
                visible: true

                Rectangle {
                    anchors.fill: parent
                    color: "#080b12"
                    radius: 9
                }
                VideoOutput {
                    id: preview

                    anchors.fill: parent
                    fillMode: VideoOutput.PreserveAspectCrop
                    mirror: true
                }
                Text {
                    anchors.centerIn: parent
                    color: "#aab6c9"
                    font.pixelSize: 11
                    text: "Tap ALLOW to request camera access"
                    visible: !root.cameraEnabled
                }
                Rectangle {
                    anchors.bottom: parent.bottom
                    anchors.left: parent.left
                    anchors.margins: 7
                    color: "#080b12cc"
                    height: 22
                    radius: 6
                    width: statusText.implicitWidth + 14

                    Text {
                        id: statusText

                        anchors.centerIn: parent
                        color: root.cameraEnabled ? "#57e6da" : "#aab6c9"
                        font.pixelSize: 10
                        text: root.cameraEnabled ? "CAMERA LIVE" : "CAMERA OFF"
                    }
                }
            }

            RowLayout {
                Layout.fillWidth: true
                spacing: 5

                Button {
                    Layout.fillWidth: true
                    text: playA.value > 0 ? "A · PAUSE" : "A · PLAY"

                    onClicked: {
                        var playing = playA.value > 0 ? 0 : 1;
                        playA.value = playing;
                        root.reportCommand("play", { deck: 1, playing: playing > 0 });
                    }
                }
                Button {
                    Layout.fillWidth: true
                    text: playB.value > 0 ? "B · PAUSE" : "B · PLAY"

                    onClicked: {
                        var playing = playB.value > 0 ? 0 : 1;
                        playB.value = playing;
                        root.reportCommand("play", { deck: 2, playing: playing > 0 });
                    }
                }
            }

            RowLayout {
                Layout.fillWidth: true
                spacing: 5

                Button {
                    Layout.fillWidth: true
                    text: syncA.value > 0 ? "A · SYNC" : "A · SYNC OFF"

                    onClicked: {
                        var enabled = syncA.value > 0 ? 0 : 1;
                        syncA.value = enabled;
                        root.reportCommand("setSync", { deck: 1, enabled: enabled > 0 });
                    }
                }
                Button {
                    Layout.fillWidth: true
                    text: syncB.value > 0 ? "B · SYNC" : "B · SYNC OFF"

                    onClicked: {
                        var enabled = syncB.value > 0 ? 0 : 1;
                        syncB.value = enabled;
                        root.reportCommand("setSync", { deck: 2, enabled: enabled > 0 });
                    }
                }
            }

            RowLayout {
                Layout.fillWidth: true
                spacing: 7

                Text {
                    color: "#aab6c9"
                    font.pixelSize: 10
                    text: "A FILTER"
                }
                Slider {
                    Layout.fillWidth: true
                    from: 0
                    to: 1
                    value: filterA.parameter

                    onMoved: {
                        filterA.parameter = value;
                        root.reportCommand("setEffectMix", { deck: 1, value: value });
                    }
                }
                Text {
                    color: "#aab6c9"
                    font.pixelSize: 10
                    text: "B FILTER"
                }
                Slider {
                    Layout.fillWidth: true
                    from: 0
                    to: 1
                    value: filterB.parameter

                    onMoved: {
                        filterB.parameter = value;
                        root.reportCommand("setEffectMix", { deck: 2, value: value });
                    }
                }
            }

            RowLayout {
                Layout.fillWidth: true
                spacing: 7

                Text {
                    color: "#aab6c9"
                    font.pixelSize: 10
                    text: "CROSSFADER"
                }
                Slider {
                    Layout.fillWidth: true
                    from: -1
                    to: 1
                    value: crossfader.parameter

                    onMoved: {
                        crossfader.parameter = value;
                        root.reportCommand("setCrossfader", { value: (value + 1) * 50 });
                    }
                }
                Button {
                    Layout.preferredWidth: 60
                    text: "RESET"

                    onClicked: {
                        crossfader.reset();
                        filterA.reset();
                        filterB.reset();
                        root.reportCommand("setCrossfader", { value: 50 });
                        root.reportCommand("setEffectMix", { deck: 1, value: 0 });
                        root.reportCommand("setEffectMix", { deck: 2, value: 0 });
                    }
                }
            }
        }
    }

    DragHandler {
        id: moveHandler

        cursorShape: Qt.OpenHandCursor
        target: root
    }
    PinchHandler {
        maximumScale: 1.6
        minimumScale: 0.75
        target: root

        onActiveChanged: {
            if (!active) root.surfaceScale = target.scale;
        }
    }
}
