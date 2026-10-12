const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const crypto=require('node:crypto');
const {validate}=require('./public/state');
const {captureHistory,emptyHistory}=require('./history');
const MAX=32*1024*1024;
const clean=value=>JSON.parse(JSON.stringify(value));
const STATE_KEYS=['niches','listings','candidates','experiments','changes','actions','families','support','inspections','ledger','shares','fileChecks','delivery','preparations','dailyReview','customerCases','modelLinks','listingResearch'];
function stateOnly(value){const copy=clean(value);validate(copy);return Object.fromEntries(STATE_KEYS.filter(key=>copy[key]!==undefined).map(key=>[key,copy[key]]));}
function validateHistory(h){
 if(!h||typeof h!=='object'||!h.products||Array.isArray(h.products)||!Array.isArray(h.observations))throw Error('Geçersiz mağaza geçmişi.');
 if(h.shopId!==undefined&&!/^\d+$/.test(String(h.shopId)))throw Error('Geçersiz geçmiş mağazası.');
 if(h.coverageBasis!==undefined&&h.coverageBasis!=='UTC')throw Error('Desteklenmeyen günlük veri takvimi.');
 for(const [id,p] of Object.entries(h.products)){
  if(!/^\d+$/.test(id)||String(p.id)!==id||typeof p.title!=='string'||!p.daily||!Array.isArray(p.coverage)||!Array.isArray(p.moneyCoverage))throw Error('Geçersiz geçmiş ürün kaydı.');
  for(const d of [...p.coverage,...p.moneyCoverage])if(!/^\d{4}-\d{2}-\d{2}$/.test(d)||!Number.isFinite(Date.parse(d+'T00:00:00Z'))||new Date(d+'T00:00:00Z').toISOString().slice(0,10)!==d)throw Error('Geçersiz geçmiş tarihi.');
  if(Object.values(p.daily).some(q=>!Number.isFinite(q)||q<0))throw Error('Geçersiz geçmiş satış adedi.');
  for(const counters of [p.dailyOrders,p.dailyLines])if(counters!==undefined&&(!counters||typeof counters!=='object'||Object.values(counters).some(q=>!Number.isInteger(q)||q<0)))throw Error('Geçersiz geçmiş sipariş/satır sayısı.');
  if(p.dailyMoney!==undefined&&(!p.dailyMoney||typeof p.dailyMoney!=='object'||Object.values(p.dailyMoney).some(m=>!m||typeof m!=='object'||Array.isArray(m)||Object.entries(m).some(([currency,amount])=>!/^[A-Z]{3}$/.test(currency)||!Number.isFinite(amount)||amount<0))))throw Error('Geçersiz geçmiş para birimi/bedel.');
 }
 for(const o of h.observations)if(typeof o.id!=='string'||!/^\d+$/.test(String(o.product))||!Array.isArray(o.fields)||!Number.isFinite(Date.parse(o.observedAt))||!Number.isFinite(Date.parse(o.previousObservedAt)))throw Error('Geçersiz geçmiş değişikliği.');
}
const scope=()=>({state:null,history:emptyHistory(),research:[],dismissed:[]});
const scopeFrom=value=>({state:clean(value.state),history:clean(value.history),research:clean(value.research),dismissed:clean(value.dismissed)});
function normalizedScope(value){
 const copy=scopeFrom(value);copy.state=value.state===null?null:stateOnly(value.state);copy.history.coverageBasis='UTC';
 if(copy.history.shopId!==undefined)copy.history.shopId=String(copy.history.shopId);return copy;
}
function hasScopeData(value){return value.state!==null||Object.keys(value.history.products).length>0||value.history.observations.length>0||value.research.length>0||value.dismissed.length>0;}
function validateScope(value){
 if(value.state!==null)validate(value.state);validateHistory(value.history);
 if(!Array.isArray(value.research)||value.research.length>10||value.research.some(w=>typeof w.id!=='string'||!['shop','keyword'].includes(w.kind)||typeof w.query!=='string'||w.query.length>100||!Array.isArray(w.history)||w.history.length>30||w.history.some(h=>!Number.isFinite(Date.parse(h.updated))||!Array.isArray(h.listings)||h.listings.length>100||h.listings.some(l=>typeof l.id!=='string'||typeof l.title!=='string'||(l.price!==null&&(!Number.isFinite(l.price)||l.price<0))))))throw Error('Geçersiz pazar geçmişi.');
 if(!Array.isArray(value.dismissed)||value.dismissed.some(id=>typeof id!=='string'))throw Error('Geçersiz sonuç kayıtları.');
}
function validateBundle(value){
 if(!value||value.schema!==1)throw Error('Desteklenmeyen yedek sürümü.');validateScope(value);
 if(value.storageVersion!==undefined&&value.storageVersion!==2)throw Error('Desteklenmeyen yerel veri sürümü.');
 if(value.storageVersion===2){
  if(value.activeShopId!==null&&!/^\d+$/.test(String(value.activeShopId)))throw Error('Geçersiz aktif mağaza.');
  if(!value.shops||typeof value.shops!=='object'||Array.isArray(value.shops)||!Array.isArray(value.unassignedLegacy))throw Error('Geçersiz mağaza bölümleri.');
  for(const [id,s] of Object.entries(value.shops)){if(!/^\d+$/.test(id))throw Error('Geçersiz mağaza bölümü.');validateScope(s);if(s.history.shopId&&String(s.history.shopId)!==id)throw Error('Geçmiş farklı mağazaya ait.');}
  if(value.activeShopId&&value.history.shopId&&String(value.history.shopId)!==String(value.activeShopId))throw Error('Aktif geçmiş farklı mağazaya ait.');
  for(const item of value.unassignedLegacy){if(typeof item.id!=='string'||typeof item.source!=='string'||(item.claimedTo!==undefined&&!/^\d+$/.test(String(item.claimedTo))))throw Error('Geçersiz eski kayıt bölümü.');validateScope(item.data);}
 }
}
function upgrade(value){
 const scoped=value.storageVersion===2,activeShopId=scoped&&value.activeShopId!==null?String(value.activeShopId):null;
 const shops=scoped?Object.fromEntries(Object.entries(value.shops).map(([id,entry])=>[id,normalizedScope(entry)])):{};
 const unassignedLegacy=scoped?value.unassignedLegacy.map(item=>({...item,data:normalizedScope(item.data),...(item.claimedTo!==undefined?{claimedTo:String(item.claimedTo)}:{})})):[];
 // Normalize every scope at the disk/import boundary. Inactive and unassigned
 // records are exported too, so cleaning only the currently visible state leaks
 // otherwise-unvalidated credential-shaped fields into ordinary backups.
 return {schema:1,revision:value.revision,migrations:value.migrations,updated:value.updated,...normalizedScope(value),storageVersion:2,activeShopId,shops,unassignedLegacy,migrationVersion:2,migrationSteps:[...new Set([...(value.migrationSteps||[]),'shop-isolation-v2'])]};
}
function atomicWrite(dest,payload){
 const tmp=dest+'.'+crypto.randomBytes(6).toString('hex')+'.tmp';let fd;
 try{fd=fs.openSync(tmp,'wx',0o600);fs.writeFileSync(fd,payload);fs.fsyncSync(fd);fs.closeSync(fd);fd=undefined;fs.renameSync(tmp,dest);}
 catch(e){if(fd!==undefined)fs.closeSync(fd);try{fs.unlinkSync(tmp);}catch{}throw e;}
}
function createWorkspace(dir=process.env.STL_DATA_DIR||path.join(process.env.LOCALAPPDATA||os.homedir(),'STLNicheLab')){
 const file=path.join(dir,'workspace.json'),backupDir=path.join(dir,'backups');
 let data=upgrade({schema:1,revision:0,...scope(),migrations:[],updated:null});let recoveryError=null;
 try{const loaded=JSON.parse(fs.readFileSync(file,'utf8'));validateBundle(loaded);if(!Number.isInteger(loaded.revision)||loaded.revision<0||!Array.isArray(loaded.migrations))throw Error('Geçersiz yerel depo sürümü.');data=upgrade(loaded);}
 catch(e){if(e.code!=='ENOENT')recoveryError='Çalışma alanı okunamıyor. Dosya korunuyor; Ayarlar’dan geçerli bir otomatik yedek geri yükle. '+e.message;}
 let lastBackupError=null;
 function publicBundle(){const shops=clean(data.shops);if(data.activeShopId)shops[data.activeShopId]=scopeFrom(data);return {schema:1,storageVersion:2,exported:new Date().toISOString(),activeShopId:data.activeShopId,shops,unassignedLegacy:clean(data.unassignedLegacy),migrationVersion:data.migrationVersion,migrationSteps:clean(data.migrationSteps),...scopeFrom(data)};}
 function backup(reason='daily',value=publicBundle()){
  fs.mkdirSync(backupDir,{recursive:true,mode:0o700});
  const day=new Date().toISOString().slice(0,10),name=reason==='daily'?day+'-daily.json':Date.now()+'-'+crypto.randomBytes(3).toString('hex')+'-'+reason+'.json';
  const payload=JSON.stringify(value);if(Buffer.byteLength(payload)>MAX)throw Error('Yedek boyutu 32 MB sınırını aşıyor.');atomicWrite(path.join(backupDir,name),payload);
  const files=fs.readdirSync(backupDir).filter(n=>n.endsWith('.json')).sort((a,b)=>fs.statSync(path.join(backupDir,b)).mtimeMs-fs.statSync(path.join(backupDir,a)).mtimeMs);
  for(const old of files.slice(30))fs.unlinkSync(path.join(backupDir,old));
 }
 function persist(next){
  const nextScope=scopeFrom(next);if(next.activeShopId)next={...next,shops:{...next.shops,[next.activeShopId]:nextScope}};
  const payload=JSON.stringify(next);if(Buffer.byteLength(payload)>MAX)throw Error('Yerel veri boyutu 32 MB sınırını aşıyor. Yedek indir.');
  fs.mkdirSync(dir,{recursive:true,mode:0o700});atomicWrite(file,payload);data=next;
  try{backup();lastBackupError=null;}catch(e){lastBackupError=e.message;}
 }
 const check=()=>{if(recoveryError)throw Error(recoveryError);};
 function revisionMatches(revision,message='Başka bir sekme kayıtları değiştirdi. Bu sekmedeki veriyi yedekleyip sayfayı yenile; eski veriyle üzerine yazılmadı.'){
  if(revision!==data.revision){const e=Error(message);e.status=409;throw e;}
 }
 function put(state,revision,expectedShopId){
  check();revisionMatches(revision);
  if(expectedShopId!==undefined&&(expectedShopId===null?null:String(expectedShopId))!==data.activeShopId){const e=Error('Mağaza değişti; eski mağazanın yerel kaydı yeni mağazaya yazılmadı. Sayfayı yenile.');e.status=409;throw e;}
  persist({...data,state:stateOnly(state),revision:data.revision+1,updated:new Date().toISOString()});return status();
 }
 function addLegacy(next,value,source){
  const digest=crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex'),id=source+':'+digest;
  if(!next.unassignedLegacy.some(item=>item.id===id))next.unassignedLegacy=[...next.unassignedLegacy,{id,source,data:clean(value),preservedAt:new Date().toISOString()}];return next;
 }
 function migrate(state){
  check();const value=stateOnly(state),digest=crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
  if(data.migrations.includes(digest)||JSON.stringify(value)===JSON.stringify(data.state))return status();
  let next={...data,migrations:[...data.migrations,digest],revision:data.revision+1,updated:new Date().toISOString()};
  if(data.activeShopId)next=addLegacy(next,{...scope(),state:value},'browser-v1');
  else {if(data.state){backup('browser-migration',{...publicBundle(),state:value});next=addLegacy(next,{...scope(),state:value},'browser-v1');}next.state=data.state||value;}
  persist(next);return status();
 }
 function activateShop(shopId){
  check();const id=shopId===null?null:String(shopId);if(id!==null&&!/^\d+$/.test(id))throw Error('Geçersiz mağaza kimliği.');if(id===data.activeShopId)return status();
  let next={...data,shops:{...data.shops},revision:data.revision+1,updated:new Date().toISOString()};
  if(data.activeShopId)next.shops[data.activeShopId]=scopeFrom(data);
  else if(hasScopeData(data)){backup('unassigned-preserved');next=addLegacy(next,scopeFrom(data),'workspace-v1');}
  const chosen=id?(next.shops[id]||scope()):scope();if(id)chosen.history={...chosen.history,shopId:id,coverageBasis:'UTC'};
  persist({...next,...chosen,activeShopId:id});return status();
 }
 function capture(snapshot){
  check();if(snapshot?.shopId!==undefined){const id=String(snapshot.shopId);if(data.activeShopId!==id){const e=Error('Geç yanıt veya farklı mağaza kaydı reddedildi.');e.status=409;throw e;}}
  else if(data.activeShopId){const e=Error('Mağazası belirsiz geçmiş aktif mağazaya yazılmadı.');e.status=409;throw e;}
  persist({...data,history:captureHistory(data.history,snapshot),updated:new Date().toISOString()});
 }
 function research(watches,shopId=data.activeShopId){check();if(shopId!==data.activeShopId){const e=Error('Geç pazar yanıtı reddedildi.');e.status=409;throw e;}const next={...data,research:clean(watches)};validateScope(next);persist(next);}
 function restore(value,revision,authenticatedShopId){
  revisionMatches(revision,'Kayıtlar değişti; sayfayı yenileyip geri yüklemeyi tekrar aç.');const raw=clean(value);validateBundle(raw);const incoming=upgrade(raw);
  if(recoveryError){const recoveryDir=path.join(dir,'recovery');fs.mkdirSync(recoveryDir,{recursive:true,mode:0o700});fs.copyFileSync(file,path.join(recoveryDir,'workspace-'+Date.now()+'.json'));}else backup('before-restore');
  const currentId=authenticatedShopId===undefined?data.activeShopId:authenticatedShopId===null?null:String(authenticatedShopId);if(currentId!==null&&!/^\d+$/.test(currentId))throw Error('Geçersiz bağlı mağaza kimliği.');
  let next={...incoming,shops:{...data.shops,...incoming.shops},unassignedLegacy:[...new Map([...data.unassignedLegacy,...incoming.unassignedLegacy].map(item=>[item.id,item])).values()],migrations:data.migrations,revision:data.revision+1,updated:new Date().toISOString()};
  // A backup must never change the currently authenticated account's scope.
  if(currentId&&incoming.activeShopId!==currentId){
   if(incoming.activeShopId)next.shops={...next.shops,[incoming.activeShopId]:scopeFrom(incoming)};
   else if(hasScopeData(incoming))next=addLegacy(next,scopeFrom(incoming),'restore-unassigned');
   const currentScope=data.activeShopId===currentId?scopeFrom(data):(next.shops[currentId]||scope());
   next={...next,...currentScope,activeShopId:currentId};next.history={...next.history,shopId:currentId,coverageBasis:'UTC'};
  }
  persist(next);recoveryError=null;return status();
 }
 function claimLegacy(id,shopId,revision){
  check();revisionMatches(revision);if(String(shopId)!==data.activeShopId||!data.activeShopId)throw Error('Eski kayıt yalnızca bağlı mağazaya açık onayla atanabilir.');
  const old=data.unassignedLegacy.find(item=>item.id===id);if(!old)throw Error('Eski kayıt bulunamadı.');if(old.claimedTo){if(old.claimedTo===data.activeShopId)return status();throw Error('Eski kayıt başka mağazaya atanmış.');}
  backup('before-legacy-claim');const prior=old.data,current=scopeFrom(data),history=clean(prior.history);
  history.coverageBasis='UTC';history.shopId=data.activeShopId;
  for(const product of Object.values(history.products))product.active=false;
  for(const [key,p] of Object.entries(current.history.products)){const before=history.products[key];history.products[key]={...before,...p,daily:{...before?.daily,...p.daily},dailyMoney:{...before?.dailyMoney,...p.dailyMoney},coverage:[...new Set([...(before?.coverage||[]),...p.coverage])].sort(),moneyCoverage:[...new Set([...(before?.moneyCoverage||[]),...p.moneyCoverage])].sort()};}
  history.observations=[...new Map([...prior.history.observations,...current.history.observations].map(o=>[o.id,o])).values()];history.firstCaptured=prior.history.firstCaptured||current.history.firstCaptured;history.lastCaptured=current.history.lastCaptured||prior.history.lastCaptured;history.salesCaptured=current.history.salesCaptured||prior.history.salesCaptured;
  const merge=(a,b)=>{
   if(Array.isArray(a)&&Array.isArray(b))return [...new Map([...a,...b].map(item=>[item?.id??JSON.stringify(item),item])).values()];
   if(a&&b&&typeof a==='object'&&typeof b==='object'&&!Array.isArray(a)&&!Array.isArray(b)){const result={...a};for(const [key,value] of Object.entries(b))result[key]=key in a?merge(a[key],value):value;return result;}
   return b===undefined?a:b;
  };
  const combined=clean(merge(prior.state||{},current.state||{}));
  // Explicit legacy claiming is the only point where an offline research
  // study can receive an owner. Preserve its draft/evidence history verbatim.
  for(const study of Object.values(combined.listingResearch?.studies||{})){
   if(study.shopId&&study.shopId!==data.activeShopId)throw Error('Araştırma farklı mağazaya ait; eski kayıtlar birleştirilmedi.');
   if(!study.shopId){study.shopId=data.activeShopId;if(study.publishedLink)study.publishedLink.shopId=data.activeShopId;}
  }
  const research=[...new Map([...prior.research,...current.research].map(w=>[w.id,w])).values()];if(research.length>10)throw Error('Birleşen pazar takipleri 10 sınırını aşıyor; kayıtlar değiştirilmedi.');
  const next={...data,state:Object.keys(combined).length?stateOnly(combined):null,history,research,dismissed:[...new Set([...prior.dismissed,...current.dismissed])],unassignedLegacy:data.unassignedLegacy.map(item=>item.id===id?{...item,claimedTo:data.activeShopId,claimedAt:new Date().toISOString()}:item),revision:data.revision+1,updated:new Date().toISOString()};validateScope(next);persist(next);return status();
 }
 function backups(){try{return fs.readdirSync(backupDir).filter(n=>/^[\w.-]+\.json$/.test(n)).map(name=>({name,updated:new Date(fs.statSync(path.join(backupDir,name)).mtimeMs).toISOString()})).sort((a,b)=>b.updated.localeCompare(a.updated));}catch(e){if(e.code==='ENOENT')return [];throw e;}}
 function readBackup(name){if(!/^[\w.-]+\.json$/.test(name)||!backups().some(b=>b.name===name))throw Error('Yedek bulunamadı.');return JSON.parse(fs.readFileSync(path.join(backupDir,name),'utf8'));}
 function dismiss(id,revision){check();revisionMatches(revision,'Kayıtlar değişti; sayfayı yenile.');if(!data.history.observations.some(o=>o.id===id))throw Error('Sonuç bulunamadı.');persist({...data,dismissed:[...new Set([...data.dismissed,id])],revision:data.revision+1});return status();}
 function status(){return {...publicBundle(),error:recoveryError,revision:data.revision,updated:data.updated,backupError:lastBackupError,backups:backups(),historyScope:data.activeShopId?'shop':'unassigned',legacySummary:data.unassignedLegacy.map(item=>({id:item.id,source:item.source,claimedTo:item.claimedTo||null,products:Object.keys(item.data.history.products).length,hasState:item.data.state!==null})),historySummary:{products:Object.keys(data.history.products).length,archived:Object.values(data.history.products).filter(p=>!p.active).length,firstCaptured:data.history.firstCaptured,lastCaptured:data.history.lastCaptured,salesCaptured:data.history.salesCaptured,observations:data.history.observations.length,coverageBasis:'UTC'}};}
 return {status,put,migrate,activateShop,capture,research,restore,claimLegacy,readBackup,dismiss,export:publicBundle,backup};
}
let instance;function workspace(){return instance??=createWorkspace();}
module.exports={createWorkspace,workspace,validateHistory,validateBundle,atomicWrite};
