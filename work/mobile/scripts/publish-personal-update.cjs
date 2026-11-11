#!/usr/bin/env node
// Run deliberately by the owner; no builds, signing, billing changes or store submissions.
const {spawnSync}=require('node:child_process');
const path=require('node:path');
const {verify}=require('./verify-personal-runtime.cjs');
const root=path.resolve(__dirname,'..');
const env={...process.env,HUNGRYMAN_IOS_PERSONAL_TEAM:'1',EAS_NO_VCS:'1'};
function eas(args,capture=false){
 const r=spawnSync(process.platform==='win32'?'npx.cmd':'npx',['--yes','eas-cli@latest',...args],{cwd:root,env,stdio:capture?['ignore','pipe','pipe']:'inherit',encoding:'utf8'});
 if(r.error)throw r.error;
 if(capture){if(r.status!==0)throw Error(r.stderr||r.stdout||'Expo project verification failed.');return r.stdout;}
 return r.status??1;
}
try{
 const runtime=verify();
 const {expo}=require('../app.json');
 if(expo.extra.eas.projectId!==runtime.projectId||runtime.projectId!=='9e2f2ace-b709-4e31-b709-c3eae666194a'||expo.owner!=='hungrymanworks-team'||expo.slug!=='hungryman-wrok'||runtime.channel!=='personal-iphone')throw Error('Unexpected project or channel. Publication stopped.');
 if(eas(['whoami'])!==0)throw Error('Expo-ში შესვლა საჭიროა. გახსენი Login-to-Expo.command, ან mobile საქაღალდეში გაუშვი: npx eas-cli@latest login. შემდეგ ხელახლა გახსენი Publish-Update.command. პაროლი ჩატში არ გამოაგზავნო.');
 const project=eas(['project:info'],true);
 if(!project.includes('@hungrymanworks-team/hungryman-wrok')||!project.includes(runtime.projectId))throw Error('Expo-მ მოსალოდნელი პროექტი არ დაადასტურა. განახლება არ გამოქვეყნებულა.');
 console.log(`Only iOS / ${runtime.channel} / ${runtime.runtimeVersion} will receive this update.`);
 const args=['update','--channel',runtime.channel,'--platform','ios','--environment','preview','--message',process.argv[2]||`Hungryman Work ${expo.version}: companion release and automatic updates`];
 if(eas(args)!==0)throw Error('განახლება არ გამოქვეყნებულა. შეამოწმე ზემოთ მოცემული Expo-ს პასუხი.');
 console.log('EAS update published. Existing OTA-disabled apps still require the one-time Xcode Release Run.');
}catch(e){console.error(e.message);process.exitCode=1}
