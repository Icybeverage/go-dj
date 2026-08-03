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
    property bool cameraRequested: false
    property string convexUrl: "https://watchful-herring-241.convex.cloud"
    property bool expanded: false
    property int handoffSourceDeck: 0
    property string sessionKey: ""
    property real surfaceScale: 1.0
    property string recordingError: ""

    height: expanded ? 540 : 430
    scale: surfaceScale
    width: expanded ? 500 : 360
    z: 1000

    Settings {
        id: appSettings

        category: "GoDj"
        property string sessionKey: ""
    }

    function initializeSession() {
        if (!appSettings.sessionKey) {
            appSettings.sessionKey = "android-mixxx-" + Date.now() + "-" + Math.random().toString(36).slice(2);
            appSettings.sync();
        }
        root.sessionKey = appSettings.sessionKey;
    }

    Loader {
        id: cameraCapture

        active: root.cameraRequested
        source: "GoDjCameraCapture.qml"

        onLoaded: {
            item.output = preview;
            item.cameraEnabled = root.cameraEnabled;
        }
    }

    Connections {
        target: cameraCapture.item

        function onPermissionGranted() {
            root.cameraEnabled = true;
            if (cameraCapture.item) cameraCapture.item.cameraEnabled = true;
        }
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
        id: pitchA

        group: "[Channel1]"
        key: "pitch_adjust"
    }
    Mixxx.ControlProxy {
        id: pitchB

        group: "[Channel2]"
        key: "pitch_adjust"
    }
    Mixxx.ControlProxy {
        id: keylockA

        group: "[Channel1]"
        key: "keylock"
    }
    Mixxx.ControlProxy {
        id: keylockB

        group: "[Channel2]"
        key: "keylock"
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
        if (!root.sessionKey) return;
        postConvex("/api/native/session", {
            sessionKey: root.sessionKey,
            displayName: "Go DJ! Android Mixxx",
        });
    }

    function requestCameraPermission() {
        if (!cameraCapture.item) return;
        if (cameraCapture.item.hasPermission()) {
            root.cameraEnabled = true;
            cameraCapture.item.cameraEnabled = true;
        } else {
            cameraCapture.item.requestPermission();
        }
    }

    function reportCommand(command, args) {
        if (!root.sessionKey) return;
        postConvex("/api/native/dispatch", {
            sessionKey: root.sessionKey,
            command: command,
            args: args,
            source: "android-mixxx",
            protocol: "mixxx-command-v1",
            requestId: root.sessionKey + "-" + Date.now() + "-" + command,
        });
    }

    function toggleRecording() {
        root.recordingError = "";
        if (recordingStatus.value > 0) {
            recordingToggle.trigger();
            root.reportCommand("record", { enabled: false, format: "MP3" });
            return;
        }
        if (!Mixxx.Recording.prepareMp3Recording()) {
            root.recordingError = "Recording folder unavailable";
            return;
        }
        recordingToggle.trigger();
        root.reportCommand("record", { enabled: true, format: "MP3" });
    }

    function setPitch(deck, semitones) {
        var pitch = deck === 1 ? pitchA : pitchB;
        var keylock = deck === 1 ? keylockA : keylockB;
        keylock.value = 1;
        pitch.parameter = Math.max(-3, Math.min(3, Number(semitones)));
        root.reportCommand("setPitch", {
            deck: deck,
            percent: (pitch.parameter + 3) * (100 / 6),
            semitones: pitch.parameter,
            keylock: true,
        });
    }

    function handoff(sourceDeck) {
        var targetDeck = sourceDeck === 1 ? 2 : 1;
        var targetPlay = targetDeck === 1 ? playA : playB;
        var targetSync = targetDeck === 1 ? syncA : syncB;
        targetSync.value = 1;
        targetPlay.value = 1;
        root.reportCommand("setSync", { deck: targetDeck, enabled: true });
        root.reportCommand("play", { deck: targetDeck, playing: true });
        root.handoffSourceDeck = sourceDeck;
        handoffTimer.restart();
    }

    Component.onCompleted: {
        root.initializeSession();
        root.ensureConvexSession();
        sessionKeepAlive.restart();
        // Keep native pitch_adjust independent from transport rate.
        keylockA.value = 1;
        keylockB.value = 1;
    }

    Mixxx.ControlProxy {
        id: filterB

        group: "[QuickEffectRack1_[Channel2]]"
        key: "super1"
    }

    Mixxx.ControlProxy {
        id: recordingStatus

        group: "[Recording]"
        key: "status"
    }
    Mixxx.ControlProxy {
        id: recordingToggle

        group: "[Recording]"
        key: "toggle_recording"
    }

    Timer {
        id: handoffTimer

        interval: 220
        repeat: false

        onTriggered: {
            var sourceDeck = root.handoffSourceDeck;
            if (sourceDeck !== 1 && sourceDeck !== 2) return;
            var sourcePlay = sourceDeck === 1 ? playA : playB;
            var crossfaderValue = sourceDeck === 1 ? 1 : -1;
            crossfader.parameter = crossfaderValue;
            sourcePlay.value = 0;
            root.reportCommand("setCrossfader", {
                value: sourceDeck === 1 ? 100 : 0,
                reason: "handoff",
            });
            root.reportCommand("play", {
                deck: sourceDeck,
                playing: false,
                reason: "handoff",
            });
            root.handoffSourceDeck = 0;
        }
    }

    Timer {
        id: sessionKeepAlive

        interval: 4 * 60 * 1000
        repeat: true

        onTriggered: root.ensureConvexSession()
    }

    Connections {
        target: Qt.application

        function onStateChanged() {
            if (Qt.application.state === Qt.ApplicationActive) {
                root.ensureConvexSession();
                sessionKeepAlive.restart();
                return;
            }

            // Camera providers are a common source of resume crashes on
            // Android emulators. Release the camera before the app sleeps;
            // the user can tap ALLOW again after resume.
            if (root.cameraEnabled) {
                root.cameraEnabled = false;
                if (cameraCapture.item) cameraCapture.item.cameraEnabled = false;
            }
        }
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
                        if (cameraCapture.item && cameraCapture.item.hasPermission()) {
                            root.cameraEnabled = !root.cameraEnabled;
                            cameraCapture.item.cameraEnabled = root.cameraEnabled;
                        } else {
                            root.cameraRequested = true;
                            Qt.callLater(root.requestCameraPermission);
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
                spacing: 5

                Text {
                    color: "#aab6c9"
                    font.pixelSize: 10
                    text: "PITCH · SPEEDLOCK"
                }
                Slider {
                    Layout.fillWidth: true
                    from: -3
                    stepSize: 0.1
                    to: 3
                    value: pitchA.parameter

                    onMoved: root.setPitch(1, value)
                }
                Text {
                    color: "#aab6c9"
                    font.pixelSize: 10
                    text: "A"
                }
                Slider {
                    Layout.fillWidth: true
                    from: -3
                    stepSize: 0.1
                    to: 3
                    value: pitchB.parameter

                    onMoved: root.setPitch(2, value)
                }
                Text {
                    color: "#aab6c9"
                    font.pixelSize: 10
                    text: "B"
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
                        pitchA.parameter = 0;
                        pitchB.parameter = 0;
                        keylockA.value = 1;
                        keylockB.value = 1;
                        root.reportCommand("setCrossfader", { value: 50 });
                        root.reportCommand("setEffectMix", { deck: 1, value: 0 });
                        root.reportCommand("setEffectMix", { deck: 2, value: 0 });
                        root.reportCommand("setPitch", { deck: 1, percent: 50, semitones: 0, keylock: true });
                        root.reportCommand("setPitch", { deck: 2, percent: 50, semitones: 0, keylock: true });
                    }
                }
            }

            RowLayout {
                Layout.fillWidth: true
                spacing: 5

                Button {
                    Layout.fillWidth: true
                    text: "HANDOFF A → B"

                    onClicked: root.handoff(1)
                }
                Button {
                    Layout.fillWidth: true
                    text: "HANDOFF B → A"

                    onClicked: root.handoff(2)
                }
            }

            RowLayout {
                Layout.fillWidth: true
                spacing: 6

                Button {
                    Layout.fillWidth: true
                    highlighted: recordingStatus.value > 0
                    text: recordingStatus.value > 0 ? "STOP REC" : "REC MP3"

                    onClicked: root.toggleRecording()
                }
                Text {
                    color: recordingStatus.value > 0 ? "#ff6b7a" : "#aab6c9"
                    font.bold: recordingStatus.value > 0
                    font.pixelSize: 11
                    horizontalAlignment: Text.AlignRight
                    text: recordingStatus.value > 0 ? Mixxx.Recording.durationText : "MP3"
                }
            }
            Text {
                Layout.fillWidth: true
                color: "#ff9aa5"
                elide: Text.ElideRight
                font.pixelSize: 9
                text: root.recordingError
                visible: root.recordingError.length > 0
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
