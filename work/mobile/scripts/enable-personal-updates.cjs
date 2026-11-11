/* Apply ONLY Expo's update metadata through its config-plugin pipeline.
   Never regenerate the Xcode project, touch signing, or add APNs entitlements. */
const fs=require('node:fs'),path=require('node:path');
const {getConfig}=require('expo/config');
const {withExpoPlist,compileModsAsync,IOSConfig}=require('expo/config-plugins');
const {verify}=require('./verify-personal-runtime.cjs');
async function enable(root=path.resolve(__dirname,'..')){
 verify();
 const localPath=path.join(root,'ios-personal.local.json');
 if(fs.lstatSync(localPath).isSymbolicLink())throw Error('Local configuration cannot be a symbolic link.');
 const local=JSON.parse(fs.readFileSync(localPath,'utf8'));
 if(local.enabled!==true)throw Error('This is not the existing Personal Team project.');
 const plistPath=path.join(root,'ios/HungrymanWork/Supporting/Expo.plist');
 for(const relative of ['ios','ios/HungrymanWork','ios/HungrymanWork/Supporting','ios/HungrymanWork/Supporting/Expo.plist'])if(fs.lstatSync(path.join(root,relative)).isSymbolicLink())throw Error('Symbolic link in native metadata path.');
 const before=fs.readFileSync(plistPath);
 const {exp}=getConfig(root);
 if(!exp.extra?.personalTeamBuild||exp.ios.bundleIdentifier!==local.bundleIdentifier)throw Error('Personal build configuration does not match the existing project.');
 const target=await IOSConfig.Updates.setUpdatesConfigAsync(root,exp,{});
 const plist=require('@expo/plist').default;
 const existing=plist.parse(before.toString());
 if(Object.entries(target).every(([k,v])=>JSON.stringify(existing[k])===JSON.stringify(v)))return console.log('Automatic update metadata already configured.');
 const backup=path.join(root,'..','.hungryman-update-backups');
 if(fs.existsSync(backup)&&fs.lstatSync(backup).isSymbolicLink())throw Error('Backup path cannot be a symbolic link.');
 fs.mkdirSync(backup,{recursive:true});
 const dir=fs.mkdtempSync(path.join(backup,'ota-native-'));fs.writeFileSync(path.join(dir,'Expo.plist'),before);
 const config=withExpoPlist({name:exp.name,slug:exp.slug},c=>{c.modResults={...c.modResults,...target};return c});
 try{
  await compileModsAsync(config,{projectRoot:root,platforms:['ios']});
  const result=plist.parse(fs.readFileSync(plistPath,'utf8'));
  if(!Object.entries(target).every(([k,v])=>JSON.stringify(result[k])===JSON.stringify(v)))throw Error('Update metadata verification failed.');
 }catch(e){fs.writeFileSync(plistPath,before);throw e}
 console.log('ავტომატური განახლება მომზადებულია. Apple-ის ხელმოწერა უცვლელია. ახლა Xcode-ში Run Release.');
}
if(require.main===module)enable().catch(e=>{console.error(e.message);process.exitCode=1});
module.exports={enable};
