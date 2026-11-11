#!/usr/bin/env bash
# User-requested local Mac / free Personal Team workflow. No EAS login, cloud
# build, paid enrollment, credentials, device installation or store submission.
set -euo pipefail
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$script_dir/.."

if [[ $# -gt 1 || ( $# -eq 1 && "$1" != "--check" ) ]]; then
  echo "Usage: bash scripts/prepare-mac-ios.sh [--check]" >&2
  exit 1
fi
if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "ეს ფაილი გახსენი Mac-ზე. iPhone-ისთვის ხელმოწერა Xcode-ში სრულდება." >&2
  exit 1
fi
missing=0
for tool in node npm xcodebuild xcrun pod; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    case "$tool" in
      node|npm) echo "აკლია $tool — დააყენე Node.js 24 LTS: https://nodejs.org/en/download" >&2 ;;
      xcodebuild|xcrun) echo "აკლია $tool — გახსენი Xcode და დაასრულე პირველადი დაყენება: https://developer.apple.com/xcode/" >&2 ;;
      pod) echo "აკლია CocoaPods: https://guides.cocoapods.org/using/getting-started.html" >&2 ;;
    esac
    missing=1
  fi
done
if [[ "$missing" -eq 1 ]]; then
  echo "დააყენე ზემოთ ჩამოთვლილი პროგრამები და თავიდან გახსენი Start-on-Mac.command." >&2
  exit 1
fi
node -e 'const [major,minor]=process.versions.node.split(".").map(Number); if(!((major===22&&minor>=13)||(major===24&&minor>=3)||major>=26)){console.error("Use Node 24 LTS (24.3 or newer), or another version supported by this project.");process.exit(1)}'
if ! xcodebuild -version || ! xcrun --sdk iphoneos --show-sdk-version; then
  echo "გახსენი Xcode, დაასრულე პირველადი დაყენება და Settings → Locations → Command Line Tools-ში აირჩიე Xcode." >&2
  exit 1
fi
pod --version
node scripts/verify-native-source.cjs
if [[ "${1:-}" == "--check" ]]; then
  echo "Mac-ის საჭირო პროგრამები ნაპოვნია. ხელმოწერა და iPhone-ზე დაყენება ჯერ არ შესრულებულა."
  exit 0
fi
if [[ -d ios ]]; then
  # Weekly renewal must not regenerate the project or discard signing choices.
  # A normal-distribution workspace must never be mistaken for this variant.
  if ! node -e 'const fs=require("node:fs");try {const p=JSON.parse(fs.readFileSync("ios-personal.local.json","utf8"));process.exit(p.enabled===true?0:1)}catch{process.exit(1)}'; then
    echo "არსებული iOS პროექტი უფასო Personal Team ვარიანტად ვერ დადასტურდა. უცვლელად დავტოვეთ." >&2
    echo "გამოიყენე პაკეტის ახლად ამოარქივებული ასლი; ძველ პროექტს ნუ წაშლი." >&2
    exit 1
  fi
  if [[ ! -d ios/HungrymanWork.xcworkspace || ! -d node_modules/expo ]]; then
    echo "მომზადება არასრულია. არსებული iOS პროექტი და ხელმოწერის პარამეტრები უცვლელად დავტოვეთ." >&2
    echo "წაიკითხე MAC-IPHONE.md → შეწყვეტილი მომზადება, ან გამოიყენე ახალი ასლი." >&2
    exit 1
  fi
  HUNGRYMAN_IOS_PERSONAL_TEAM=1 node scripts/enable-personal-updates.cjs
  echo "იხსნება არსებული პროექტი. აირჩიე შენი iPhone და დააჭირე ▶︎ — ხელმოწერა განახლდება."
  echo "გამოიყენე იგივე Personal Team და Bundle Identifier. Run-ის რეჟიმი უნდა იყოს Release."
  open ios/HungrymanWork.xcworkspace
  exit 0
fi

# Store only the build variant, never an Apple ID, password, certificate or token.
export HUNGRYMAN_IOS_PERSONAL_TEAM=1
node <<'NODE'
const fs = require('node:fs');
const existing = fs.existsSync('ios-personal.local.json')
  ? JSON.parse(fs.readFileSync('ios-personal.local.json', 'utf8')) : {};
const bundleIdentifier = process.env.HUNGRYMAN_IOS_BUNDLE_IDENTIFIER
  || existing.bundleIdentifier || 'ge.hungryman.work.personal';
if (!/^[a-zA-Z][a-zA-Z0-9-]*(\.[a-zA-Z0-9-]+)+$/.test(bundleIdentifier)) {
  throw new Error('Invalid personal iOS bundle identifier.');
}
fs.writeFileSync('ios-personal.local.json', JSON.stringify({enabled: true, bundleIdentifier}, null, 2) + '\n');
NODE
npm ci --no-fund
./node_modules/.bin/expo prebuild --platform ios --no-install
(cd ios && pod install)
echo "პროექტი მომზადებულია. ხელმოწერა და iPhone-ზე ინსტალაცია შემდეგ Xcode-ში სრულდება."
echo "1. Xcode → Settings → Accounts: შედი Apple ანგარიშით."
echo "2. HungrymanWork → Signing & Capabilities: Automatically manage signing; Team → Personal Team."
echo "3. Product → Scheme → Edit Scheme → Run → Build Configuration → Release."
echo "4. აირჩიე დაკავშირებული iPhone და დააჭირე ▶︎."
echo "iOS 26.6-ზე პირველი დაკავშირებისთვის გამოიყენე კაბელი და ტელეფონზე დაადასტურე Trust."
open ios/HungrymanWork.xcworkspace
