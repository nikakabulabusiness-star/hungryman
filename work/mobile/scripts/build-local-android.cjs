#!/usr/bin/env node
// Build in an isolated copy: never regenerate the user's iOS/signing project.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {spawnSync} = require('node:child_process');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../..');

function testConfig(config) {
  const next = structuredClone(config);
  next.expo.name = 'Hungryman Work Test';
  next.expo.android.package = 'ge.hungryman.work.local';
  next.expo.scheme = 'hungrymanwork-local';
  next.expo.updates = {enabled: false};
  next.expo.runtimeVersion = next.expo.version + '-android-local';
  delete next.expo.extra.eas;
  return next;
}
function run(command, args, cwd, env) {
  const result = spawnSync(command, args, {cwd, env, stdio: 'inherit', shell: false});
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${path.basename(command)} failed (${result.status ?? result.signal}).`);
}
function main() {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== '--check')) throw new Error('Usage: node scripts/build-local-android.cjs [--check]');
  const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
  if (!sdk || !fs.existsSync(path.join(sdk, 'platforms'))) throw new Error('Install Android Studio and an Android SDK, then set ANDROID_HOME. No paid account is needed.');
  const windows = process.platform === 'win32';
  const builds = path.join(sdk, 'build-tools');
  const signerName = windows ? 'apksigner.bat' : 'apksigner';
  const signer = fs.existsSync(builds) && fs.readdirSync(builds).sort((a,b) => b.localeCompare(a, undefined, {numeric:true})).map(v => path.join(builds, v, signerName)).find(f => fs.existsSync(f));
  if (!signer) throw new Error('Install Android SDK Build-Tools in Android Studio.');
  run('java', ['-version'], root, process.env);
  run(process.execPath, [path.join(root, 'scripts/verify-native-source.cjs')], root, process.env);
  if (args.includes('--check')) { console.log('Android prerequisites found; native compilation has not run.'); return; }

  const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'hungryman-android-'));
  const mobile = path.join(stage, 'mobile');
  const sourceEntries = new Set(['src', 'assets', 'scripts', 'app.json', 'app.config.js', 'package.json', 'package-lock.json', 'metro.config.js', 'tsconfig.json', 'eslint.config.cjs']);
  try {
    fs.cpSync(root, mobile, {recursive: true, filter: file => {
      const relative = path.relative(root, file);
      if (!relative) return true;
      if (!sourceEntries.has(relative.split(path.sep)[0])) return false;
      if (fs.lstatSync(file).isSymbolicLink()) throw new Error('Source symlinks are not supported: ' + relative);
      return !relative.split(path.sep).some(part => part.startsWith('.') || part === 'credentials.json' || /\.(keystore|jks|p12|p8|pem|key|mobileprovision)$/.test(part));
    }, dereference: false});
    fs.mkdirSync(path.join(stage, 'lib'));
    for (const name of ['permissions.ts', 'department-directory.ts']) fs.copyFileSync(path.join(root, '../lib', name), path.join(stage, 'lib', name));
    fs.writeFileSync(path.join(mobile, 'app.json'), JSON.stringify(testConfig(JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'))), null, 2) + '\n');
    const env = {...process.env, CI:'1', HUNGRYMAN_IOS_PERSONAL_TEAM:'0'};
    // npm's JS CLI avoids Windows shell quoting and never invokes EAS login/build.
    const npmCli = process.env.npm_execpath;
    if (!npmCli || !fs.existsSync(npmCli)) throw new Error('Run this builder with npm run build:android:local.');
    run(process.execPath, [npmCli, 'ci', '--no-audit', '--no-fund'], mobile, env);
    run(process.execPath, [path.join(mobile, 'node_modules/expo/bin/cli'), 'prebuild', '--platform', 'android', '--no-install'], mobile, env);
    const android = path.join(mobile, 'android');
    if (windows) run('cmd.exe', ['/d','/c','gradlew.bat assembleRelease --no-daemon'], android, env);
    else run('sh', ['./gradlew', 'assembleRelease', '--no-daemon'], android, env);
    const apk = path.join(android, 'app/build/outputs/apk/release/app-release.apk');
    if (!fs.existsSync(apk)) throw new Error('No signed APK was produced. Nothing was published.');
    // Android's signer script is backed by this bundled JAR on every platform.
    const signerJar = path.join(path.dirname(signer), 'lib/apksigner.jar');
    run('java', ['-jar', signerJar, 'verify', '--verbose', apk], mobile, env);
    const bytes = fs.readFileSync(apk), digest = crypto.createHash('sha256').update(bytes).digest('hex');
    const output = path.join(root, 'outputs'); fs.mkdirSync(output, {recursive:true});
    const name = `Hungryman-Work-${digest.slice(0,12)}-test.apk`;
    fs.writeFileSync(path.join(output, name), bytes);
    fs.writeFileSync(path.join(output, name + '.sha256'), `${digest}  ${name}\n`);
    console.log(`Verified test APK: ${path.join(output, name)}\nTest signing only; not a store release. Remote push is not configured. Device testing is still required.`);
  } finally { fs.rmSync(stage, {recursive:true, force:true}); }
}
module.exports = {testConfig};
if (require.main === module) { try { main(); } catch (error) {console.error(error.message); process.exitCode = 1;} }
