#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "${script_dir}/.." && pwd)"
mixxx_root="${repo_root}/third_party/mixxx"
patch_file="${script_dir}/patches/go-dj-mixxx.patch"
expected_commit="14f3ccaaf3787330b07c45b959d7ed0a5b96c201"

if [[ ! -e "${mixxx_root}/.git" ]]; then
  echo "Mixxx submodule is missing: ${mixxx_root}" >&2
  exit 1
fi

actual_commit="$(git -C "${mixxx_root}" rev-parse HEAD)"
if [[ "${actual_commit}" != "${expected_commit}" ]]; then
  echo "Mixxx commit mismatch: expected ${expected_commit}, got ${actual_commit}" >&2
  exit 1
fi

if [[ -f "${mixxx_root}/res/qml/GoDjCameraSurface.qml" ]]; then
  grep -q 'Universal performance surface' "${mixxx_root}/res/qml/GoDjCameraSurface.qml"
  if grep -q 'id: goDjCameraSurface' "${mixxx_root}/res/qml/main.qml"; then
    echo "Go DJ! Mixxx overlay already applied."
    exit 0
  fi
  echo "Go DJ! Mixxx overlay is incomplete; refusing to continue." >&2
  exit 1
fi

git -C "${mixxx_root}" diff --quiet
git -C "${mixxx_root}" diff --cached --quiet
git -C "${mixxx_root}" apply --check "${patch_file}"
cp "${script_dir}/qml/GoDjCameraSurface.qml" "${mixxx_root}/res/qml/GoDjCameraSurface.qml"
git -C "${mixxx_root}" apply "${patch_file}"
echo "Applied Go DJ! camera/control surface to Mixxx ${expected_commit}."
