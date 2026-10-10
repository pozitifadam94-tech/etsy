const current=require('./package.json').version;
let cache=null;
function newer(remote,local){const valid=/^\d+\.\d+\.\d+$/;if(!valid.test(remote)||!valid.test(local))throw Error('Gecersiz surum bilgisi.');const a=remote.split('.').map(Number),b=local.split('.').map(Number);for(let i=0;i<3;i++){if(a[i]>b[i])return true;if(a[i]<b[i])return false;}return false;}
async function check(){if(cache&&Date.now()-cache.at<600000)return cache.value;const response=await fetch('https://raw.githubusercontent.com/pozitifadam94-tech/etsy/main/package.json',{signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('Surum sunucusuna erisilemedi ('+response.status+').');const remote=await response.json();const available=newer(remote.version,current);const value={current,latest:remote.version,available,download:'https://github.com/pozitifadam94-tech/etsy/archive/refs/heads/main.zip'};cache={at:Date.now(),value};return value;}
module.exports={check,newer};
