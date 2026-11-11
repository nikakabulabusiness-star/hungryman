import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';

const root=process.cwd();
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'hungryman-mac-update-test-'));
const packageDir=path.join(temp,'package');
const bases=['bab14fa9dd775de80d85cbb582527f60e55c2e0f','49f535c0025f3d3c4199e330eaa106a6fcbc11c3','1fd1c022d1c83d36a29196362265f56df8646127','8a5f25816304eea55be47dffe41f0a707cd0c13b','6d4de863f4cb6a36f1aa6c03abf20a98296cf53c','a9e0145a36305d1e67fbd834c53a804f500dca70','4b5361eca49b32d4973be16f1b42b79e2c8b4e9a','6ceacd4f3f14fbbc3e2c544e7310c97a238c87f4','5a375f7211f9ec2ba7b32450f5e3f7b6adbaed4c','1f7e70b892f800948aca6eeb40ae333636a643ea','fdc9132408c45c833e1c34964dd07dc2a11cb593','bce6f529b1f6da111ffb5f0b1df519cd28b80d00','fbe5ecfa54a937634bb83efa2d0c8c791f056511','4909382f2ebf703218aa47b8bdb6b374ed2064cb','6f3ac47b2ff04628338e6ad847be4a719f4e27ad','2074cc02a00a69a841927a95d036637d40fa92d1'];
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const git=(...args)=>execFileSync('git',args,{cwd:root,stdio:['ignore','pipe','pipe']});
const write=(file,bytes)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bytes)};
const allowed=name=>name.startsWith('mobile/src/')||name.startsWith('mobile/assets/')||name.startsWith('mobile/scripts/')||['mobile/personal-runtime.json','mobile/app.json','mobile/app.config.js','mobile/package.json','mobile/package-lock.json','mobile/README.md','lib/site-controls.ts','lib/permissions.ts','lib/department-directory.ts'].includes(name);
function snapshot(dir){
 const entries=[];
 function visit(here,relative=''){
  for(const name of fs.readdirSync(here).sort()){
   const full=path.join(here,name),key=relative?relative+'/'+name:name,stat=fs.lstatSync(full);
   if(stat.isSymbolicLink())entries.push([key,'link',fs.readlinkSync(full)]);
   else if(stat.isDirectory()){entries.push([key,'dir']);visit(full,key)}
   else entries.push([key,'file',hash(fs.readFileSync(full))]);
  }
 }
 visit(dir);return entries;
}
let fixture=0;
function project(base,options={}){
 const dir=path.join(temp,'project-'+(++fixture));fs.mkdirSync(dir);
 for(const name of git('ls-tree','-r','--name-only','-z',base).toString().split('\0').filter(allowed))write(path.join(dir,name),git('cat-file','blob',base+':'+name));
 if(options.personal!==false)write(path.join(dir,'mobile/ios-personal.local.json'),JSON.stringify({enabled:true,bundleIdentifier:'ge.hungryman.work.personal.test',signingTeam:'PERSONAL_SENTINEL'}));
 if(options.workspace!==false)fs.mkdirSync(path.join(dir,'mobile/ios/HungrymanWork.xcworkspace'),{recursive:true});
 write(path.join(dir,'mobile/ios/HungrymanWork.xcodeproj/project.pbxproj'),'preserve this personal signing project byte for byte\nDEVELOPMENT_TEAM = TEAM_SENTINEL;\n');
 write(path.join(dir,'mobile/ios/HungrymanWork.xcworkspace/contents.xcworkspacedata'),'<Workspace>signing-sentinel</Workspace>');
 if(options.workspace===false)fs.rmSync(path.join(dir,'mobile/ios/HungrymanWork.xcworkspace'),{recursive:true});
 write(path.join(dir,'notes-personal.txt'),'unrelated local file stays unchanged');
 return dir;
}
function signingSnapshot(dir){return ['mobile/ios-personal.local.json','mobile/ios/HungrymanWork.xcodeproj/project.pbxproj','mobile/ios/HungrymanWork.xcworkspace/contents.xcworkspacedata','notes-personal.txt'].map(name=>[name,fs.readFileSync(path.join(dir,name),'utf8')]);}
function assertExpected(manifest,dir){for(const entry of manifest.files){const file=path.join(dir,entry.path);if(entry.after===null)assert.equal(fs.existsSync(file),false,entry.path+' must be removed');else assert.equal(hash(fs.readFileSync(file)),entry.after,entry.path+' must match captured payload');}}
function refusesWithoutWrites(apply,update,dir,pattern){const before=snapshot(dir);assert.throws(()=>apply(update,dir),pattern);assert.deepEqual(snapshot(dir),before,'a rejected update must not write even a backup or empty directory');}

try{
 // Capture one generated manifest/payload; later working-tree changes cannot alter assertions.
 const generated=JSON.parse(execFileSync(process.execPath,['scripts/package-mac-update.mjs',packageDir],{cwd:root,encoding:'utf8'}));
 const manifest=JSON.parse(fs.readFileSync(path.join(packageDir,'manifest.json'),'utf8'));
 const require=createRequire(import.meta.url),{apply}=require(path.join(packageDir,'apply-source-update.cjs'));
 assert.equal(generated.files,manifest.files.length);assert.ok(manifest.files.length>0);assert.deepEqual(manifest.baseCommits,bases);
 for(const launcher of ['Update-on-Mac.command','Login-to-Expo.command','Publish-Update.command']){
  assert.equal(fs.statSync(path.join(packageDir,launcher)).mode&0o111,0o111);
  execFileSync('bash',['-n',path.join(packageDir,launcher)]);
 }
 const readme=fs.readFileSync(path.join(packageDir,'READ-ME.txt'),'utf8');
 assert.ok(readme.includes(JSON.parse(fs.readFileSync(path.join(root,'mobile/app.json'),'utf8')).expo.version));
 for(const base of bases){
  const dir=project(base),signing=signingSnapshot(dir),initial=snapshot(dir);
  apply(packageDir,dir);assertExpected(manifest,dir);assert.deepEqual(signingSnapshot(dir),signing);
  const backups=fs.readdirSync(path.join(dir,'.hungryman-update-backups'));assert.equal(backups.length,1);
  const backup=path.join(dir,'.hungryman-update-backups',backups[0]);
  for(const entry of manifest.files){const before=initial.find(item=>item[0]===entry.path&&item[1]==='file');if(before&&before[2]!==entry.after)assert.equal(hash(fs.readFileSync(path.join(backup,entry.path))),before[2],'backup must preserve original '+entry.path);}
  const once=snapshot(dir);apply(packageDir,dir);assert.deepEqual(snapshot(dir),once,'reapply must be a complete no-op including backups');
 }
 console.log('PASS packaged update applies from all supported Mac source commits, backs up originals, reapplies idempotently and preserves native signing.');
 const changedExisting=manifest.files.findLast(entry=>entry.after!==null&&entry.before.every(value=>value!==null));
 const newFile=manifest.files.find(entry=>entry.after!==null&&entry.before[0]===null);
 assert.ok(changedExisting,'test requires an existing changed file');assert.ok(newFile,'test requires a newly introduced file');
 const corruptPackage=path.join(temp,'corrupt-package');fs.cpSync(packageDir,corruptPackage,{recursive:true});
 fs.appendFileSync(path.join(corruptPackage,'payload',manifest.files.findLast(entry=>entry.after!==null).path),'corrupted payload');
 refusesWithoutWrites(apply,corruptPackage,project(bases[0]),/დაზიანებული პაკეტი/);
 const edited=project(bases[0]);fs.appendFileSync(path.join(edited,changedExisting.path),'\nuser customization\n');
 refusesWithoutWrites(apply,packageDir,edited,/ცალკეა შეცვლილი/);
 console.log('PASS corrupt payload and unexpected user edits refuse before touching any project file.');
 const symlink=project(bases[0]),external=path.join(temp,'external-existing.txt');write(external,'outside target sentinel');
 fs.rmSync(path.join(symlink,changedExisting.path));fs.symlinkSync(external,path.join(symlink,changedExisting.path));
 refusesWithoutWrites(apply,packageDir,symlink,/Symbolic link/);assert.equal(fs.readFileSync(external,'utf8'),'outside target sentinel');
 const dangling=project(bases[0]),missingTarget=path.join(temp,'must-not-be-created.txt');
 fs.mkdirSync(path.dirname(path.join(dangling,newFile.path)),{recursive:true});fs.symlinkSync(missingTarget,path.join(dangling,newFile.path));
 refusesWithoutWrites(apply,packageDir,dangling,/Symbolic link/);assert.equal(fs.existsSync(missingTarget),false);
 const parentLink=project(bases[0]),externalDir=path.join(temp,'external-directory');fs.mkdirSync(externalDir);fs.renameSync(path.join(parentLink,'mobile/src'),path.join(externalDir,'src'));fs.symlinkSync(path.join(externalDir,'src'),path.join(parentLink,'mobile/src'));const outsideBefore=snapshot(externalDir);
 refusesWithoutWrites(apply,packageDir,parentLink,/Symbolic link/);assert.deepEqual(snapshot(externalDir),outsideBefore);
 const backupLink=project(bases[0]);fs.symlinkSync(path.join(temp,'missing-backup-target'),path.join(backupLink,'.hungryman-update-backups'));
 refusesWithoutWrites(apply,packageDir,backupLink,/symbolic link/i);
 console.log('PASS existing/dangling file symlinks, symlink parent paths and symlink backup roots are refused without external writes.');
 refusesWithoutWrites(apply,packageDir,project(bases[0],{personal:false}),/ENOENT|მომზადებული/);
 refusesWithoutWrites(apply,packageDir,project(bases[0],{workspace:false}),/მომზადებული/);
 const disabled=project(bases[0]);write(path.join(disabled,'mobile/ios-personal.local.json'),'{"enabled":false}');
 refusesWithoutWrites(apply,packageDir,disabled,/მომზადებული/);
 console.log('PASS missing workspace/personal configuration and disabled Personal Team projects are rejected.');
}finally{fs.rmSync(temp,{recursive:true,force:true})}
