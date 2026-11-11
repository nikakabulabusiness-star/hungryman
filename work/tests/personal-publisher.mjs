import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const source=fs.readFileSync('mobile/scripts/publish-personal-update.cjs','utf8');
const runtime=JSON.parse(fs.readFileSync('mobile/personal-runtime.json','utf8'));
const app=JSON.parse(fs.readFileSync('mobile/app.json','utf8'));
function run({authenticated=true,remoteAvailable=true,remoteName='@hungrymanworks-team/hungryman-wrok',config=app,nativeCompatible=true}={}){
 const calls=[],errors=[],process={env:{},platform:'darwin',argv:['node','publish-personal-update.cjs']};
 vm.runInNewContext(source,{
  __dirname:path.resolve('mobile/scripts'),process,console:{log(){},error(message){errors.push(message)}},
  require(name){
   if(name==='node:path')return path;
   if(name==='../app.json')return config;
   if(name==='./verify-personal-runtime.cjs')return {verify(){if(!nativeCompatible)throw Error('Native configuration changed.');return runtime;}};
   if(name==='node:child_process')return {spawnSync(_executable,args){
    calls.push(args);
    if(args[2]==='whoami')return {status:authenticated?0:1};
    if(args[2]==='project:info')return {status:remoteAvailable?0:1,stdout:`fullName ${remoteName}\nID ${runtime.projectId}`,stderr:remoteAvailable?'':'Access denied'};
    if(args[2]==='update')return {status:0};
    throw Error('Unexpected command '+args.join(' '));
   }};
   throw Error('Unexpected module '+name);
  }
 });
 return {calls,errors,status:process.exitCode??0};
}

for(const options of [
 {authenticated:false},
 {remoteAvailable:false},
 {remoteName:'@another-team/another-project'},
 {config:{expo:{...app.expo,owner:'another-team'}}},
 {nativeCompatible:false}
]){
 const result=run(options);
 assert.equal(result.status,1);
 assert.ok(result.errors.length);
 assert.equal(result.calls.some(args=>args[2]==='update'),false,'a failed prerequisite must never publish');
}
const good=run();assert.equal(good.status,0);assert.deepEqual(good.errors,[]);
assert.deepEqual(good.calls.map(args=>args[2]),['whoami','project:info','update']);
const publication=good.calls[2];
for(const [flag,value] of [['--channel','personal-iphone'],['--platform','ios'],['--environment','preview']])assert.equal(publication[publication.indexOf(flag)+1],value);
console.log('PASS publisher refuses missing auth, denied/wrong remote project, wrong owner and native incompatibility before publication; verified publication targets only personal iOS. No external process executed.');
