const fs = require('node:fs');
const path = require('node:path');
const runtime = require('./personal-runtime.json');

// The Mac preparation script writes this ignored, non-secret file. Xcode's
// bundle phase also reads it, even when Xcode was opened outside that shell.
module.exports = ({config}) => {
  const localPath = path.join(__dirname, 'ios-personal.local.json');
  const local = process.env.EAS_BUILD !== 'true' && fs.existsSync(localPath)
    ? JSON.parse(fs.readFileSync(localPath, 'utf8')) : {};
  const personal = process.env.HUNGRYMAN_IOS_PERSONAL_TEAM === undefined
    ? local.enabled === true : process.env.HUNGRYMAN_IOS_PERSONAL_TEAM === '1';
  if (!personal) return config;

  const bundleIdentifier = process.env.HUNGRYMAN_IOS_BUNDLE_IDENTIFIER
    || local.bundleIdentifier || 'ge.hungryman.work.personal';
  if (!/^[a-zA-Z][a-zA-Z0-9-]*(\.[a-zA-Z0-9-]+)+$/.test(bundleIdentifier)) {
    throw new Error('Personal iOS bundle identifier must use reverse-DNS format.');
  }
  const entitlements = {...config.ios?.entitlements};
  delete entitlements['aps-environment'];
  return {
    ...config,
    scheme: 'hungrymanwork-personal',
    ios: {...config.ios, bundleIdentifier, entitlements},
    // Dedicated native compatibility version + channel, isolated from distribution.
    // JS-only releases keep this runtime; native changes require a new binary.
    runtimeVersion: runtime.runtimeVersion,
    updates: {...config.updates, enabled: true, checkAutomatically: 'ON_LOAD',
      fallbackToCacheTimeout: 0, useEmbeddedUpdate: true,
      requestHeaders: {'expo-channel-name': runtime.channel}},
    extra: {...config.extra, personalTeamBuild: true},
    plugins: (config.plugins || []).map(plugin => {
      const [name, options = {}] = Array.isArray(plugin) ? plugin : [plugin, {}];
      return name === 'expo-notifications'
        ? [name, {...options, enableRemoteNotifications: false, enableBackgroundRemoteNotifications: false}]
        : plugin;
    }),
  };
};
