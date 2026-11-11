import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root=path.resolve(import.meta.dirname,'..');
const hash=crypto.createHash('sha256');
function walk(dir){for(const item of fs.readdirSync(path.join(root,dir),{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){const name=dir+'/'+item.name;if(item.isSymbolicLink())continue;if(item.isDirectory())walk(name);else if(name!=='lib/pwa-release.json'){hash.update(name+'\0');hash.update(fs.readFileSync(path.join(root,name)))}}}
for(const folder of ['app','components','lib','public'])walk(folder);
for(const filename of ['package.json','pnpm-lock.yaml','next.config.ts','vite.config.ts','postcss.config.mjs','tsconfig.json'])if(fs.existsSync(path.join(root,filename))){hash.update(filename+'\0');hash.update(fs.readFileSync(path.join(root,filename)))}
fs.writeFileSync(path.join(root,'lib/pwa-release.json'),JSON.stringify({version:hash.digest('hex').slice(0,20)})+'\n');
