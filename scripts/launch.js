// Reopening the same version opens its browser instead of launching a second server.
const {spawn}=require('node:child_process');
const path=require('node:path');
const {version}=require('../package.json');
async function main(){
 const port=Number(process.env.PORT||3000),address='http://localhost:'+port;
 let status;try{const response=await fetch(address+'/api/health',{signal:AbortSignal.timeout(1500)});if(response.ok)status=await response.json();}catch{}
 if(status?.app==='stl-atelier'){
  if(status.version!==version){console.error('Eski panel ('+status.version+') zaten açık. Önce eski sunucu penceresini kapat; sonra '+version+' sürümünü başlat.');process.exitCode=1;return;}
  if(process.platform==='win32')spawn('rundll32.exe',['url.dll,FileProtocolHandler',address],{stdio:'ignore'});
  console.log('Panel zaten açık; ikinci sunucu başlatılmadı.');return;
 }
 const child=spawn(process.execPath,[path.join(__dirname,'..','server.js')],{cwd:path.join(__dirname,'..'),env:process.env,stdio:'inherit'});
 child.on('error',error=>{console.error('Panel başlatılamadı: '+error.message);process.exitCode=1;});
 child.on('exit',code=>process.exitCode=code??1);
 for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
}
void main();
