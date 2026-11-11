#!/bin/bash
# Double-click from Finder. No enrollment, payment or cloud authentication.
set -uo pipefail
entry_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
echo "Hungryman Work — უფასო iPhone ვერსიის მომზადება"
echo "პირველად: პროექტის მომზადება. შემდეგ: არსებული პროექტის გახსნა 7-დღიანი ხელმოწერის გასაახლებლად."
if [[ -f "$entry_dir/scripts/prepare-mac-ios.sh" ]]; then
  bash "$entry_dir/scripts/prepare-mac-ios.sh" "$@"
  result=$?
elif [[ -f "$entry_dir/mobile/scripts/prepare-mac-ios.sh" ]]; then
  # The downloadable archive also places this launcher at its top level.
  bash "$entry_dir/mobile/scripts/prepare-mac-ios.sh" "$@"
  result=$?
else
  echo "პაკეტი არასრულია: mobile და lib საქაღალდეები ერთად დატოვე."
  result=1
fi
if [[ "$result" -ne 0 ]]; then
  echo "მომზადება შეჩერდა. ზემოთ წერია მიზეზი. შეგიძლია გამომიგზავნო შეცდომის ტექსტი ან სქრინი."
fi
if [[ -t 0 ]]; then
  read -r -p "ამ ფანჯრის დასახურად დააჭირე Enter-ს. " _answer
fi
exit "$result"
