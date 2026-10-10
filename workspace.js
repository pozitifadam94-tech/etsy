const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const crypto=require('node:crypto');
const {validate}=require('./public/state');
const {captureHistory,emptyHistory}=require('./history');
const MAX=32*1024*1024;
const clean=value=>JSON.parse(JSON.stringify(value));
function stateOnly(value){const copy=clean(value);validate(copy);return Object.fromEntries(['niches','listings','candidates','experiments','changes','actions','families','support','inspections','ledger','shares','fileChecks'].filter(key=>copy[key]!==undefined).map(key=>[key,copy[key]]));}
function validateHistory(h){
 if(!h||typeof h!=='object'||!h.products||Array.isArray(h.products)||!Array.isArray(h.observations))throw Error('Geçersiz mağaza geçmişi.');
 for(const [id,p] of Object.entries(h.products)){
  if(!/^\d+$/.test(id)||String(p.id)!==id||typeof p.title!=='string'||!p.daily||!Array.isArray(p.coverage)||!Array.isArray(p.moneyCoverage))throw Error('Geçersiz geçmiş ürün kaydı.');
  for(const d of [...p.coverage,...p.moneyCoverage])if(!/^\d{4}-\d{2}-\d{2}$/.test(d)||!Number.isFinite(Date.parse(d+'T00:00:00Z'))||new Date(d+'T00:00:00Z').toISOString().slice(0,10)!==d)throw Error('Geçersiz geçmiş tarihi.');
  if(Object.values(p.daily).some(q=>!Number.isFinite(q)||q<0))throw Error('Geçersiz geçmiş satış adedi.');
 }
 for(const o of h.observations)if(typeof o.id!=='string'||!/^\d+$/.test(String(o.product))||!Array.isArray(o.fields)||!Number.isFinite(Date.parse(o.observedAt))||!Number.isFinite(Date.parse(o.previousObservedAt)))throw Error('Geçersiz geçmiş değişikliği.');
}
function createWorkspace(dir=process.env.STL_DATA_DIR||path.join(process.env.LOCALAPPDATA||os.homedir(),'STLNicheLab')){
 const file=path.join(dir,'workspace.json'),backupDir=path.join(dir,'backups');
 let data={schema:1,revision:0,state:null,history:emptyHistory(),research:[],dismissed:[],migrations:[],updated:null};
 let recoveryError=null;
 try{const loaded=JSON.parse(fs.readFileSync(file,'utf8'));validateBundle(loaded);if(!Number.isInteger(loaded.revision)||loaded.revision<0||!Array.isArray(loaded.migrations))throw Error('Geçersiz yerel depo sürümü.');data=loaded;}catch(e){if(e.code!=='ENOENT')recoveryError='Çalışma alanı okunamıyor. Dosya korunuyor; Ayarlar’dan geçerli bir otomatik yedek geri yükle. '+e.message;}
 let lastBackupError=null;
 function validateBundle(value){
  if(value.schema!==1)throw Error('Desteklenmeyen yedek sürümü.');
  if(value.state!==null)validate(value.state);validateHistory(value.history);
  if(!Array.isArray(value.research)||value.research.length>10||value.research.some(w=>typeof w.id!=='string'||!['shop','keyword'].includes(w.kind)||typeof w.query!=='string'||w.query.length>100||!Array.isArray(w.history)||w.history.length>30||w.history.some(h=>!Number.isFinite(Date.parse(h.updated))||!Array.isArray(h.listings)||h.listings.length>100||h.listings.some(l=>typeof l.id!=='string'||typeof l.title!=='string'||(l.price!==null&&(!Number.isFinite(l.price)||l.price<0))))))throw Error('Geçersiz pazar geçmişi.');
  if(!Array.isArray(value.dismissed)||value.dismissed.some(id=>typeof id!=='string'))throw Error('Geçersiz sonuç kayıtları.');
 }
 function publicBundle(){return {schema:1,exported:new Date().toISOString(),state:clean(data.state),history:clean(data.history),research:clean(data.research),dismissed:clean(data.dismissed)};}
 function backup(reason='daily',value=publicBundle()){
  fs.mkdirSync(backupDir,{recursive:true,mode:0o700});
  const day=new Date().toISOString().slice(0,10),name=reason==='daily'?day+'-daily.json':Date.now()+'-'+crypto.randomBytes(3).toString('hex')+'-'+reason+'.json';
  const dest=path.join(backupDir,name);
  const payload=JSON.stringify(value);if(Buffer.byteLength(payload)>MAX)throw Error('Yedek boyutu 32 MB sınırını aşıyor.');
  fs.writeFileSync(dest+'.tmp',payload,{mode:0o600});fs.renameSync(dest+'.tmp',dest);
  const files=fs.readdirSync(backupDir).filter(n=>n.endsWith('.json')).sort((a,b)=>fs.statSync(path.join(backupDir,b)).mtimeMs-fs.statSync(path.join(backupDir,a)).mtimeMs);
  for(const old of files.slice(30))fs.unlinkSync(path.join(backupDir,old));
 }
 function persist(next){
  const payload=JSON.stringify(next);if(Buffer.byteLength(payload)>MAX)throw Error('Yerel veri boyutu 32 MB sınırını aşıyor. Yedek indir.');
  fs.mkdirSync(dir,{recursive:true,mode:0o700});fs.writeFileSync(file+'.tmp',payload,{mode:0o600});fs.renameSync(file+'.tmp',file);data=next;
  try{backup();lastBackupError=null;}catch(e){lastBackupError=e.message;}
 }
 function put(state,revision){
  if(recoveryError)throw Error(recoveryError);
  if(revision!==data.revision){const e=Error('Başka bir sekme kayıtları değiştirdi. Bu sekmedeki veriyi yedekleyip sayfayı yenile; eski veriyle üzerine yazılmadı.');e.status=409;throw e;}
  const next=stateOnly(state);persist({...data,state:next,revision:data.revision+1,updated:new Date().toISOString()});return status();
 }
 function migrate(state){
  if(recoveryError)throw Error(recoveryError);
  const value=stateOnly(state);const digest=crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
  if(data.migrations.includes(digest)||JSON.stringify(value)===JSON.stringify(data.state))return status();
  if(data.state)backup('browser-migration',{...publicBundle(),state:value});
  persist({...data,state:data.state||value,migrations:[...data.migrations,digest],revision:data.revision+1,updated:new Date().toISOString()});return status();
 }
 function capture(snapshot){if(recoveryError)throw Error(recoveryError);persist({...data,history:captureHistory(data.history,snapshot),updated:new Date().toISOString()});}
 function research(watches){if(recoveryError)throw Error(recoveryError);persist({...data,research:clean(watches)});}
 function restore(value,revision){
  if(revision!==data.revision){const e=Error('Kayıtlar değişti; sayfayı yenileyip geri yüklemeyi tekrar aç.');e.status=409;throw e;}
  const next=clean(value);validateBundle(next);
  if(recoveryError){const recoveryDir=path.join(dir,'recovery');fs.mkdirSync(recoveryDir,{recursive:true,mode:0o700});fs.copyFileSync(file,path.join(recoveryDir,'workspace-'+Date.now()+'.json'));}else backup('before-restore');
  persist({...data,state:next.state===null?null:stateOnly(next.state),history:next.history,research:next.research,dismissed:next.dismissed,revision:data.revision+1,updated:new Date().toISOString()});recoveryError=null;return status();
 }
 function backups(){try{return fs.readdirSync(backupDir).filter(n=>/^[\w.-]+\.json$/.test(n)).map(name=>({name,updated:new Date(fs.statSync(path.join(backupDir,name)).mtimeMs).toISOString()})).sort((a,b)=>b.updated.localeCompare(a.updated));}catch(e){if(e.code==='ENOENT')return [];throw e;}}
 function readBackup(name){if(!/^[\w.-]+\.json$/.test(name)||!backups().some(b=>b.name===name))throw Error('Yedek bulunamadı.');return JSON.parse(fs.readFileSync(path.join(backupDir,name),'utf8'));}
 function dismiss(id,revision){if(revision!==data.revision){const e=Error('Kayıtlar değişti; sayfayı yenile.');e.status=409;throw e;}if(!data.history.observations.some(o=>o.id===id))throw Error('Sonuç bulunamadı.');persist({...data,dismissed:[...new Set([...data.dismissed,id])],revision:data.revision+1});return status();}
 function status(){return {...publicBundle(),error:recoveryError,revision:data.revision,updated:data.updated,backupError:lastBackupError,backups:backups(),historySummary:{products:Object.keys(data.history.products).length,archived:Object.values(data.history.products).filter(p=>!p.active).length,firstCaptured:data.history.firstCaptured,lastCaptured:data.history.lastCaptured,salesCaptured:data.history.salesCaptured,observations:data.history.observations.length}};}
 return {status,put,migrate,capture,research,restore,readBackup,dismiss,export:publicBundle,backup};
}
let instance;function workspace(){return instance??=createWorkspace();}
module.exports={createWorkspace,workspace,validateHistory};
