const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
function nativeHash(){
 const app=JSON.parse(fs.readFileSync(path.join(root,'app.json'),'utf8')).expo;
 const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
 const inputs={dependencies:pkg.dependencies,plugins:app.plugins,ios:app.ios,android:app.android,scheme:app.scheme,orientation:app.orientation,config:fs.readFileSync(path.join(root,'app.config.js'),'utf8'),lock:fs.readFileSync(path.join(root,'package-lock.json'),'utf8')};
 return crypto.createHash('sha256').update(JSON.stringify(inputs)).digest('hex');
}
function verify(){const runtime=require('../personal-runtime.json');if(nativeHash()!==runtime.nativeHash)throw Error('Native configuration changed. Create and test a new iPhone binary, assign a NEW personal runtime, then record its native hash. Do not publish incompatible OTA code.');return runtime;}
if(require.main===module){try{verify();console.log('Personal OTA native compatibility verified.')}catch(e){console.error(e.message);process.exitCode=1}}
module.exports={verify,nativeHash};
