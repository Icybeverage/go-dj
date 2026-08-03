import QtMultimedia
import QtQuick

// Deferred Qt Multimedia objects. Keeping these out of the startup component
// lets Mixxx boot on devices and emulators without a camera provider.
Item {
    id: root

    property bool cameraEnabled: false
    property var output
    signal permissionGranted

    function hasPermission() {
        return cameraPermission.status === Qt.PermissionStatus.Granted;
    }

    function requestPermission() {
        cameraPermission.request();
    }

    CameraPermission {
        id: cameraPermission

        onStatusChanged: {
            if (status === Qt.PermissionStatus.Granted) {
                root.permissionGranted();
            }
        }
    }

    Camera {
        id: performanceCamera

        active: root.cameraEnabled && root.hasPermission()
    }

    CaptureSession {
        camera: performanceCamera
        videoOutput: root.output
    }
}
