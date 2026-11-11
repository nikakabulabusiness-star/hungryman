import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';

const root = process.cwd();
const output = path.resolve(process.argv[2]);
const version = JSON.parse(fs.readFileSync(path.join(root,'mobile/app.json'),'utf8')).expo.version;
const bases = ['bab14fa9dd775de80d85cbb582527f60e55c2e0f','49f535c0025f3d3c4199e330eaa106a6fcbc11c3','1fd1c022d1c83d36a29196362265f56df8646127','8a5f25816304eea55be47dffe41f0a707cd0c13b','6d4de863f4cb6a36f1aa6c03abf20a98296cf53c','a9e0145a36305d1e67fbd834c53a804f500dca70','4b5361eca49b32d4973be16f1b42b79e2c8b4e9a','6ceacd4f3f14fbbc3e2c544e7310c97a238c87f4','5a375f7211f9ec2ba7b32450f5e3f7b6adbaed4c','1f7e70b892f800948aca6eeb40ae333636a643ea','fdc9132408c45c833e1c34964dd07dc2a11cb593','bce6f529b1f6da111ffb5f0b1df519cd28b80d00','fbe5ecfa54a937634bb83efa2d0c8c791f056511','4909382f2ebf703218aa47b8bdb6b374ed2064cb','6f3ac47b2ff04628338e6ad847be4a719f4e27ad','2074cc02a00a69a841927a95d036637d40fa92d1'];
const git = (...args) => execFileSync('git', args, {cwd: root, stdio:['ignore','pipe','pipe']});
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const allowed = name => name.startsWith('mobile/src/') || name.startsWith('mobile/assets/') || name.startsWith('mobile/scripts/') ||
  ['mobile/personal-runtime.json','mobile/app.json','mobile/app.config.js','mobile/package.json','mobile/package-lock.json','mobile/README.md','lib/site-controls.ts','lib/permissions.ts','lib/department-directory.ts'].includes(name);
const names = new Set(git('ls-files','--cached','--others','--exclude-standard','-z').toString().split('\0').filter(allowed));
for (const base of bases) for (const name of git('ls-tree','-r','--name-only','-z',base).toString().split('\0').filter(allowed)) names.add(name);
fs.mkdirSync(path.join(output,'payload'), {recursive: true});
const files = [];
for (const name of [...names].sort()) {
  const afterBytes = fs.existsSync(path.join(root,name)) ? fs.readFileSync(path.join(root,name)) : null;
  const after = afterBytes === null ? null : hash(afterBytes);
  const before = [...new Set(bases.map(base => {try {return hash(git('cat-file','blob',`${base}:${name}`));} catch {return null;}}))];
  if (before.length === 1 && before[0] === after) continue;
  files.push({path:name,before,after});
  if (afterBytes !== null) {const dest=path.join(output,'payload',name);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,afterBytes);}
}
const manifest = {format:1,id:'work-update-2026-10-26',baseCommits:bases,sourceCommit:git('rev-parse','HEAD').toString().trim(),files};
fs.writeFileSync(path.join(output,'manifest.json'),JSON.stringify(manifest,null,2));
fs.copyFileSync(path.join(root,'mobile/scripts/apply-source-update.cjs'),path.join(output,'apply-source-update.cjs'));
fs.writeFileSync(path.join(output,'Update-on-Mac.command'),`#!/bin/bash
set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
update_dir="$(cd "$(dirname "$0")" && pwd)"
finish() {
  update_status=$?
  if [ "$update_status" -ne 0 ]; then echo "განახლება შეჩერდა. გამომიგზავნე ზემოთ დაწერილი შეცდომა."; fi
  if [ -t 0 ]; then read -r -p "ფანჯრის დასახურად დააჭირე Enter-ს. " _ || true; fi
}
trap finish EXIT
if [ "$(uname -s)" != "Darwin" ]; then echo "ეს ფაილი შენს Mac-ზე უნდა გახსნა." >&2; exit 1; fi
if ! command -v node >/dev/null 2>&1; then echo "Node.js ვერ მოიძებნა." >&2; exit 1; fi
project_dir="$HOME/Desktop/HungrymanWork-Free-Mac"
if [ "$#" -gt 0 ]; then project_dir="$1"; fi
node "$update_dir/apply-source-update.cjs" "$project_dir"
HUNGRYMAN_IOS_PERSONAL_TEAM=1 node "$project_dir/mobile/scripts/enable-personal-updates.cjs"
echo "თუ ტელეფონზე OTA ჯერ არ ჩაგირთავს: Xcode-ში აირჩიე შენი iPhone და დააჭირე ▶. Run უნდა იყოს Release რეჟიმში."
echo "თუ 0.3.15 უკვე დაყენებულია ჩართული OTA-ით: ამ თავსებადი განახლებისთვის Xcode Run საჭირო არ არის; გამოიყენე Publish-Update.command."
open "$project_dir/mobile/ios/HungrymanWork.xcworkspace"
`, {mode:0o755});
fs.writeFileSync(path.join(output,'Publish-Update.command'),`#!/bin/bash
set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
finish() {
  if [ -t 0 ]; then read -r -p "ფანჯრის დასახურად დააჭირე Enter-ს. " _ || true; fi
}
trap finish EXIT
if [ "$(uname -s)" != "Darwin" ]; then echo "ეს ფაილი შენს Mac-ზე უნდა გახსნა." >&2; exit 1; fi
project_dir="$HOME/Desktop/HungrymanWork-Free-Mac"
if [ "$#" -gt 0 ]; then project_dir="$1"; fi
if [ ! -f "$project_dir/mobile/scripts/publish-personal-update.cjs" ]; then echo "ჯერ გახსენი Update-on-Mac.command." >&2; exit 1; fi
node "$project_dir/mobile/scripts/publish-personal-update.cjs"
`, {mode:0o755});
fs.writeFileSync(path.join(output,'Login-to-Expo.command'),`#!/bin/bash
set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
finish() {
  if [ -t 0 ]; then read -r -p "ფანჯრის დასახურად დააჭირე Enter-ს. " _ || true; fi
}
trap finish EXIT
if [ "$(uname -s)" != "Darwin" ]; then echo "ეს ფაილი შენს Mac-ზე უნდა გახსნა." >&2; exit 1; fi
if ! command -v npx >/dev/null 2>&1; then echo "Node.js და npm ვერ მოიძებნა." >&2; exit 1; fi
project_dir="$HOME/Desktop/HungrymanWork-Free-Mac"
if [ "$#" -gt 0 ]; then project_dir="$1"; fi
if [ ! -f "$project_dir/mobile/scripts/publish-personal-update.cjs" ]; then echo "ჯერ გახსენი Update-on-Mac.command." >&2; exit 1; fi
cd "$project_dir/mobile"
echo "შედი შენს Expo ანგარიშში, რომელსაც hungrymanworks-team/hungryman-wrok პროექტზე გამოქვეყნების უფლება აქვს."
echo "პაროლი შეიყვანე მხოლოდ Expo CLI-ის მოთხოვნაში. პაროლი და ერთჯერადი კოდი ჩატში არ გამოაგზავნო."
npx --yes eas-cli@latest login
npx --yes eas-cli@latest whoami
echo "შესვლა დასრულდა. განახლების გამოსაქვეყნებლად გახსენი Publish-Update.command."
echo "ეს ფაილი მხოლოდ ანგარიშში შესვლას აკეთებს; განახლებას არ აქვეყნებს."
`, {mode:0o755});
fs.writeFileSync(path.join(output,'READ-ME.txt'),`Hungryman Work — iPhone განახლება ${version}

ეს პაკეტი განაახლებს შენს უკვე არსებულ Mac პროექტს. ეს არ არის პირდაპირ ტელეფონზე დასაყენებელი IPA.

თუ 0.3.15 უკვე წარმატებით დააყენე Xcode-ით და OTA ჩართულია, ამ ვერსიას ახალი ბილდი არ სჭირდება.
ასეთ შემთხვევაში Update-on-Mac.command-ით განაახლე Mac-ის წყარო, გახსნილი Xcode შეგიძლია დახურო და განახლება Publish-Update.command-ით გამოაქვეყნო.
ტელეფონში პროფილიდან შეამოწმე განახლება. ქვემოთ მოცემული Xcode Run საჭიროა მათთვის, ვისთანაც OTA ჯერ ჩართული არ არის, ან ვისაც Apple-ის ხელმოწერის ვადა გაუვიდა.

ახლა გასაკეთებელი
1. ჩამოტვირთე ZIP Mac-ზე და გახსენი.
2. ორჯერ დააჭირე Update-on-Mac.command-ს. არსებული პროექტი უნდა იყოს Desktop/HungrymanWork-Free-Mac-ში.
   თუ სხვაგანაა: Terminal-ში გაუშვი bash, შემდეგ გადაათრიე Update-on-Mac.command, შემდეგ პროექტის საქაღალდე და Enter.
3. გახსნილ Xcode-ში აირჩიე შენი iPhone და ▶ Run. როგორც წინა დაყენებისას, Run უნდა იყოს Release რეჟიმში.
4. გახსენი iPhone-ზე Hungryman Work. პროფილში, „აპის განახლებები“ განყოფილებაში უნდა ეწეროს ვერსია ${version}.

შენარჩუნდება პროექტის Apple Team, Bundle Identifier და არსებული ხელმოწერის არჩევანი. აპი არ წაშალო.
თუ macOS ბრძანების გახსნას ვერ ახერხებს, Terminal-ში აკრიფე bash, დატოვე სივრცე, გადაათრიე Update-on-Mac.command და Enter.
თუ ფაილი ცალკეა შეცვლილი, სკრიპტი გაჩერდება და არ გადააწერს მას. გამომიგზავნე შეცდომის ტექსტი, პაროლისა და გასაღებების გარეშე.

რა დაემატა
— Work სამუშაო სივრცე: სცენარი, პროდაქშენი, მონტაჟი, სოციალური მედია და ტექნიკური დაფები.
— სრული ქოლშითი, მრავალდღიანი განრიგი, გუნდი, ლოკაციები, კატეგორიების ბიუჯეტი და ფოტოები.
— დამფუძნებლის დასტური, კალენდარში ჩანიშნვა, გამოყოფილი Shorts გადაღებები და შეტყობინებები.
— პირადი და მონიჭებული დავალებები, შესრულების პროგრესი, ჩეკლისტები და კონტაქტების ბაზა.
— ქართული PDF, JSON და Excel CSV ექსპორტი; დამტკიცებული ვერსიების არქივი.

ასევე შენარჩუნებულია
— ადმინისტრაციისა და ადმინისტრატორის უფლებების დამოუკიდებელი მართვა, მხოლოდ დეველოპერისთვის.
— ანგარიშის დეტალები, დადასტურებით წაშლა და დეაქტივაცია/გააქტიურება.
— დეველოპერისთვის „ფუნქციების ამოღება“: მართვადი მოდულებისა და მოქმედებების ერთი დაჭერით ამოღება, აღდგენა და შენახული ისტორია. მონაცემები არ ნადგურდება.
— დელეგირებული ფუნქციების ჩართვა/გამორთვა, იგივე სერვერის უფლებებით, რასაც ვებსაიტი იყენებს.
— ინტერნეტით თავსებადი განახლებების მიღება და პროფილიდან შემოწმება.
— თუ ახალი ვერსია ახალ ბილდს მოითხოვს, მთავარ გვერდსა და პროფილში გამოჩნდება „საჭიროა ახალი ბილდი“ და დაყენების ინსტრუქცია. მოწმდება აპის გახსნისას და დაბრუნებისას; დახურულ აპზე Push არ არის.

შემდგომი განახლებების გამოქვეყნება (პროექტის მფლობელისთვის)
Expo Go საჭირო არ არის. OTA განახლებებს მიიღებს უშუალოდ ჩამოტვირთული Hungryman Work.
ჯერ აუცილებელია ზემოთ აღწერილი ერთჯერადი Xcode Run. ძველ, OTA-გამორთულ აპში ამას დისტანციურად ვერ ჩავრთავთ.
ამ პაკეტს არ გამოუქვეყნებია OTA განახლება Expo-ზე და არ აქვს ანგარიშის შესვლის მონაცემები.
პირველ ჯერზე გახსენი Login-to-Expo.command — ეს მხოლოდ Expo-ში შეგიყვანს და არაფერს გამოაქვეყნებს.
ან Mac-ის Terminal-ში:
  cd "$HOME/Desktop/HungrymanWork-Free-Mac/mobile"
  npx eas-cli@latest login
შედი შენს არსებულ Expo ანგარიშში, რომელსაც hungrymanworks-team პროექტზე წვდომა აქვს.
შემდეგ ამ პაკეტიდან გაუშვი Publish-Update.command. ის ამოწმებს Expo-ში ავტორიზაციასა და პროექტს და აქვეყნებს მხოლოდ ამ პროექტის iOS personal-iphone არხზე.
ახალი დიზაინისა და JavaScript ფუნქციების შემდეგი ვერსიები შეიძლება იმავე არხით გავრცელდეს, თუ native თავსებადობა უცვლელია.
აპი ცვლილებას ფონურად ჩამოტვირთავს; ჩაირთვება მომდევნო გაშვებაზე, ან პროფილში შენი დადასტურების შემდეგ.
მიმდინარე ზარს განახლება ავტომატურად არ შეწყვეტს. გამოქვეყნება/ჩამოტვირთვა მოითხოვს ინტერნეტს.

PWA და აპლიკაცია
work.hungryman.ge ტელეფონის მთავარ ეკრანზე დამატებით დაყენდება როგორც PWA.
PWA იმავე საიტის განახლებებს მიიღებს; დაყენებულ React Native აპს ცალკე თავსებადი OTA გამოქვეყნება სჭირდება.
ანგარიშები და სერვერის მონაცემები საერთოა. საიტის ახალი დიზაინი ავტომატურად არ გარდაიქმნება native კოდად.

შეზღუდვები
Apple-ის უფასო Personal Team ხელმოწერის განახლება კვლავ საჭიროა დაახლოებით 7 დღეში. OTA ამას არ ახანგრძლივებს.
ახალ სისტემურ მოდულს ან ნებართვას შეიძლება დასჭირდეს ახალი Xcode Build და ახალი runtime ვერსია.
Expo-ს უფასო გეგმის OTA ლიმიტები მოქმედებს. ფასიანი გეგმა ამ პაკეტს არ ჩაურთავს.
დახურულ აპზე APNs/CallKit ზარები ამ განახლებით არ დამატებულა.
კოდი და iOS JavaScript პაკეტი შემოწმებულია; რეალურ iPhone-ზე დაყენებასა და მუშაობას შენი Xcode Run-ის შემდეგ ვამოწმებთ.
`);
console.log(JSON.stringify({output,files:files.length,sourceCommit:manifest.sourceCommit}));
