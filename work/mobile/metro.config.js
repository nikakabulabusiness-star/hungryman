const path = require('path');
const {getDefaultConfig} = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
// The web app and native app are separate package roots. Only the pure shared
// permission/department modules are imported from this directory by mobile.
config.watchFolders = [...config.watchFolders, path.resolve(__dirname, '../lib')];

module.exports = config;
