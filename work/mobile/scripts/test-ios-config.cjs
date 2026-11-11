// Inspect actual Expo-generated native metadata, not only the JS config object.
const assert = require('node:assert/strict');
const {execFileSync} = require('node:child_process');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
function inspect(personal) {
  const output = execFileSync(process.execPath, [path.join(root, 'node_modules/expo/bin/cli'), 'config', '--type', 'introspect', '--json'], {
    cwd: root,
    env: {...process.env, HUNGRYMAN_IOS_PERSONAL_TEAM: personal ? '1' : '0', HUNGRYMAN_IOS_BUNDLE_IDENTIFIER: ''},
    encoding: 'utf8', maxBuffer: 8 * 1024 * 1024,
  });
  return JSON.parse(output);
}
const standard = inspect(false), personal = inspect(true);
const normalNative = standard._internal.modResults.ios;
const personalNative = personal._internal.modResults.ios;
assert.ok(normalNative.entitlements['aps-environment'], 'Distribution build must retain APNs capability');
assert.equal(personalNative.entitlements['aps-environment'], undefined, 'Free Personal Team cannot sign APNs entitlement');
assert.notEqual(personal.ios.bundleIdentifier, standard.ios.bundleIdentifier, 'Personal install must be separate');
assert.notDeepEqual(personal.runtimeVersion, standard.runtimeVersion, 'Native variants must not share OTA runtime');
assert.equal(personalNative.expoPlist.EXUpdatesEnabled, true);
assert.equal(personalNative.expoPlist.EXUpdatesRuntimeVersion, require('../personal-runtime.json').runtimeVersion);
assert.equal(personalNative.expoPlist.EXUpdatesRequestHeaders['expo-channel-name'], 'personal-iphone');
assert.equal(personalNative.expoPlist.EXUpdatesLaunchWaitMs, 0);
assert.notEqual(personalNative.expoPlist.EXUpdatesHasEmbeddedUpdate, false);
assert.notEqual(personalNative.expoPlist.EXUpdatesDisableAntiBrickingMeasures, true);
assert.equal(normalNative.expoPlist.EXUpdatesEnabled, true, 'Distribution OTA settings must be preserved');
assert.equal(personal.extra.personalTeamBuild, true);
assert.notEqual(standard.extra?.personalTeamBuild, true);
for (const native of [normalNative, personalNative]) {
  for (const key of ['NSCameraUsageDescription', 'NSMicrophoneUsageDescription', 'NSLocationWhenInUseUsageDescription']) {
    assert.ok(native.infoPlist[key], `${key} must be present`);
  }
}
console.log('iOS native metadata: distribution APNs preserved; personal signing, OTA isolation and privacy descriptions pass.');
