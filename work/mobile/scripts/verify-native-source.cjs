#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const required = [
  'mobile/personal-runtime.json', 'lib/site-controls.ts', 'mobile/app.json', 'mobile/app.config.js', 'mobile/package-lock.json',
  'mobile/assets/icon.png', 'lib/permissions.ts', 'lib/department-directory.ts',
];
const missing = required.filter(file => !fs.existsSync(path.join(root, file)));
if (missing.length) {
  console.error(`Native source is incomplete: ${missing.join(', ')}`);
  console.error('Keep mobile/ and the shared lib/ folder together. Check the root .easignore.');
  process.exit(1);
}
console.log('Native source includes the app, assets and shared permissions/department modules.');
