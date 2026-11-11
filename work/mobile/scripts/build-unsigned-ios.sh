#!/usr/bin/env bash
# Builds native iPhone code without distribution credentials. The resulting IPA
# must be signed with the installer's own Apple account before it can run.
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$script_dir/.."

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "This build requires macOS and Xcode (provided by the EAS iOS builder)." >&2
  exit 1
fi

archive_path="$PWD/build/HungrymanWork.xcarchive"
package_path="$PWD/build/unsigned-package"
ipa_path="$PWD/build/HungrymanWork-unsigned.ipa"
mkdir -p "$package_path/Payload"

export RCT_NO_LAUNCH_PACKAGER=1
xcodebuild archive \
  -workspace ios/HungrymanWork.xcworkspace \
  -scheme HungrymanWork \
  -configuration Release \
  -sdk iphoneos \
  -destination 'generic/platform=iOS' \
  -archivePath "$archive_path" \
  CODE_SIGNING_ALLOWED=NO \
  CODE_SIGNING_REQUIRED=NO \
  CODE_SIGN_IDENTITY='' \
  DEVELOPMENT_TEAM=''

app_path="$archive_path/Products/Applications/HungrymanWork.app"
test -d "$app_path"
test -s "$app_path/main.jsbundle"
platform=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleSupportedPlatforms:0' "$app_path/Info.plist")
if [[ "$platform" != "iPhoneOS" ]]; then
  echo "Refusing to package a non-device build: $platform" >&2
  exit 1
fi
executable=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleExecutable' "$app_path/Info.plist")
xcrun lipo -verify_arch arm64 "$app_path/$executable"

# Custom EAS workflows must configure the update channel explicitly before
# archiving; an update URL alone cannot select this build's update stream.
update_channel=$(/usr/libexec/PlistBuddy -c 'Print :EXUpdatesRequestHeaders:expo-channel-name' "$app_path/Expo.plist")
if [[ "$update_channel" != "ios-free-unsigned" ]]; then
  echo "Refusing to package an iPhone build with an unexpected update channel: $update_channel" >&2
  exit 1
fi

ditto "$app_path" "$package_path/Payload/HungrymanWork.app"
ditto -c -k --keepParent "$package_path/Payload" "$ipa_path"
test -s "$ipa_path"
echo "Created a physical-iPhone IPA for personal signing: $ipa_path"
echo "This is unsigned: it cannot be installed directly or submitted to TestFlight."
