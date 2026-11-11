const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function statIfPresent(name) {
  try {return fs.lstatSync(name);}
  catch (error) {if (error.code === 'ENOENT') return null; throw error;}
}

function safePath(root, name) {
  if (typeof name !== 'string' || name.includes('\\') || name.split('/').some(p => !p || p === '.' || p === '..')) throw Error('Invalid update path');
  const allowed = name.startsWith('mobile/src/') || name.startsWith('mobile/assets/') || name.startsWith('mobile/scripts/') ||
    ['mobile/personal-runtime.json','mobile/app.json','mobile/app.config.js','mobile/package.json','mobile/package-lock.json','mobile/README.md','lib/site-controls.ts','lib/permissions.ts','lib/department-directory.ts'].includes(name);
  if (!allowed) throw Error(`Unsupported update file: ${name}`);
  let current = root;
  for (const part of name.split('/')) {
    current = path.join(current, part);
    if (statIfPresent(current)?.isSymbolicLink()) throw Error(`Symbolic link in update path: ${name}`);
  }
  return current;
}

function apply(packageDir, project) {
  const root = fs.realpathSync(project);
  const personal = JSON.parse(fs.readFileSync(path.join(root, 'mobile/ios-personal.local.json'), 'utf8'));
  if (personal.enabled !== true || !fs.existsSync(path.join(root, 'mobile/ios/HungrymanWork.xcworkspace'))) throw Error('მომზადებული iPhone პროექტი ვერ მოიძებნა. აირჩიე HungrymanWork-Free-Mac საქაღალდე.');
  const manifest = JSON.parse(fs.readFileSync(path.join(packageDir, 'manifest.json'), 'utf8'));
  if (manifest.format !== 1 || manifest.id !== 'work-update-2026-10-26' || !Array.isArray(manifest.files) || !manifest.files.length) throw Error('განახლების პაკეტი არასრულია.');
  const seen = new Set();
  // Validate every file before touching the user's existing project.
  const entries = manifest.files.map(entry => {
    const target = safePath(root, entry.path);
    if (seen.has(entry.path)) throw Error('Duplicate update file');
    seen.add(entry.path);
    const exists = fs.existsSync(target);
    if (exists && !fs.lstatSync(target).isFile()) throw Error(`Unexpected file: ${entry.path}`);
    const current = exists ? fs.readFileSync(target) : null;
    const currentHash = current === null ? null : hash(current);
    if (!Array.isArray(entry.before) || !entry.before.includes(currentHash) && currentHash !== entry.after) throw Error(`ფაილი ცალკეა შეცვლილი და არ გადავაწერთ: ${entry.path}`);
    let next = null;
    if (entry.after !== null) {
      next = fs.readFileSync(safePath(path.join(packageDir, 'payload'), entry.path));
      if (hash(next) !== entry.after) throw Error(`დაზიანებული პაკეტი: ${entry.path}`);
    }
    return {...entry, target, current, next, changed: currentHash !== entry.after};
  });
  const changes = entries.filter(entry => entry.changed);
  if (!changes.length) {console.log('განახლების ფაილები უკვე ჩაწერილია. ახლა გაუშვი აპი Xcode-დან.'); return;}
  const backupRoot = path.join(root, '.hungryman-update-backups');
  if (statIfPresent(backupRoot)?.isSymbolicLink()) throw Error('Backup directory is a symbolic link');
  fs.mkdirSync(backupRoot, {recursive: true});
  const backup = fs.mkdtempSync(path.join(backupRoot, 'work-20261024-'));
  for (const entry of changes) {
    if (entry.current === null) continue;
    const dest = path.join(backup, entry.path);
    fs.mkdirSync(path.dirname(dest), {recursive: true});
    fs.writeFileSync(dest, entry.current);
  }
  fs.writeFileSync(path.join(backup, 'manifest.json'), JSON.stringify(manifest, null, 2));
  const applied = [];
  try {
    for (const entry of changes) {
      applied.push(entry);
      if (entry.next === null) fs.rmSync(entry.target, {force: true});
      else {fs.mkdirSync(path.dirname(entry.target), {recursive: true}); fs.writeFileSync(entry.target, entry.next);}
    }
  } catch (error) {
    for (const entry of applied.reverse()) {
      if (entry.current === null) fs.rmSync(entry.target, {force: true});
      else fs.writeFileSync(entry.target, entry.current);
    }
    throw error;
  }
  console.log(`განახლდა ${changes.length} ფაილი. Apple-ის ხელმოწერა და iOS პროექტი შენარჩუნებულია.`);
  console.log(`წინა ფაილები: ${backup}`);
}

if (require.main === module) {
  try {apply(__dirname, process.argv[2]);}
  catch (error) {console.error(`განახლება ვერ შესრულდა: ${error.message}`); process.exitCode = 1;}
}
module.exports = {apply};
