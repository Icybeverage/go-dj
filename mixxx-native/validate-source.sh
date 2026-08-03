#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "${script_dir}/.." && pwd)"
mixxx_root="${repo_root}/third_party/mixxx"

[[ "$(git -C "${mixxx_root}" rev-parse HEAD)" == "14f3ccaaf3787330b07c45b959d7ed0a5b96c201" ]]
grep -q 'Camera' "${script_dir}/patches/go-dj-mixxx.patch"
grep -q 'android.permission.CAMERA' "${script_dir}/patches/go-dj-mixxx.patch"
grep -q 'Mixxx.ControlProxy' "${script_dir}/qml/GoDjCameraSurface.qml"
grep -q 'Loader' "${script_dir}/qml/GoDjCameraSurface.qml"
grep -q 'CaptureSession' "${script_dir}/qml/GoDjCameraCapture.qml"
grep -q 'CameraPermission' "${script_dir}/qml/GoDjCameraCapture.qml"
grep -q 'XMLHttpRequest' "${script_dir}/qml/GoDjCameraSurface.qml"
echo "Mixxx source pin and Go DJ! integration patch are present."
