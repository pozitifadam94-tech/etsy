'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const model=require('./public/pinterest-model');
const LIMIT=3,MAX_FILE=16*1024*1024,FRESH_MS=5*60*1000;
const activeFiles=new Map();
const REQUIRED_SCOPES=['user_accounts:read','boards:read','boards:write','pins:read','pins:write'];
const DAY=/^\d{4}-\d{2}-\d{2}$/;
const validTime=value=>typeof value==='string'&&Number.isFinite(Date.parse(value));
const validDay=value=>typeof value==='string'&&DAY.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
const clone=value=>JSON.parse(JSON.stringify(value));
const JOB_FIELDS=['id','listingId','shopId','accountId','accountUsername','boardId','boardName','boardPrivacy','environment','generation','status','title','description','link','alt_text','imageId','sourceUrl','orderingVerification','createdAt','preparedDay','snapshotAt','attemptedAt','dispatchedAt','resolvedAt','day','pinId','pinUrl','errorType','reason','simulated','retryOf','resolutionSource','mediaSha256','mediaBytes','mediaContentType'];
function publicJob(value){return Object.fromEntries(JOB_FIELDS.filter(key=>value[key]!==undefined).map(key=>[key,value[key]]));}
function publicHistory(value){return Object.fromEntries(['shopId','accountId','listingId','createdAt','source','pinUrl'].filter(key=>value[key]!==undefined).map(key=>[key,value[key]]));}
function safeContext(raw={}){
 return {shopId:model.numericId(raw.shopId),accountId:model.numericId(raw.accountId),accountUsername:typeof raw.accountUsername==='string'?raw.accountUsername.slice(0,100):null,boardId:model.numericId(raw.boardId),boardName:typeof raw.boardName==='string'?raw.boardName.slice(0,100):null,boardPrivacy:['PUBLIC','SECRET','PROTECTED'].includes(raw.boardPrivacy)?raw.boardPrivacy:'unknown',environment:['production','sandbox','dry-run'].includes(raw.environment)?raw.environment:'production',tier:['standard','trial'].includes(raw.tier)?raw.tier:'unknown',tierSource:raw.tierSource==='user-declared'?'user-declared':'unknown',generation:Number.isSafeInteger(raw.generation)?raw.generation:0,configured:raw.configured===true,connected:raw.connected===true,scopes:Array.isArray(raw.scopes)?raw.scopes.filter(v=>typeof v==='string'&&/^[a-z_:]+$/.test(v)).slice(0,20):[],retryAt:Number.isFinite(Date.parse(raw.retryAt))?new Date(raw.retryAt).toISOString():null,accessReady:raw.accessReady===true,blockReason:typeof raw.blockReason==='string'?raw.blockReason.slice(0,300):null};
}
function atomicWrite(file,value){
 const temp=file+'.'+crypto.randomBytes(8).toString('hex')+'.tmp';let fd;
 try{fd=fs.openSync(temp,'wx',0o600);fs.writeFileSync(fd,JSON.stringify(value));fs.fsyncSync(fd);fs.closeSync(fd);fd=undefined;fs.renameSync(temp,file);if(process.platform!=='win32'){const directory=fs.openSync(path.dirname(file),'r');try{fs.fsyncSync(directory);}finally{fs.closeSync(directory);}}}
 catch(error){if(fd!==undefined)fs.closeSync(fd);try{fs.unlinkSync(temp);}catch{}throw error;}
}
function validateState(value){
 if(!value||value.schema!==1||!Number.isSafeInteger(value.revision)||value.revision<0||!Array.isArray(value.jobs)||!Array.isArray(value.exclusions)||!Array.isArray(value.external)||value.jobs.length>50000)throw Error('Geçersiz Pinterest kayıt dosyası.');
 const ids=new Set();for(const job of value.jobs){
  if(!job||typeof job.id!=='string'||job.id.length>100||ids.has(job.id)||!model.numericId(job.shopId)||!model.numericId(job.listingId)||!(model.numericId(job.accountId)||job.environment==='dry-run'&&job.accountId==='dry-run')||!(model.numericId(job.boardId)||job.environment==='dry-run'&&job.boardId==='dry-run')||!['production','sandbox','dry-run'].includes(job.environment)||!Number.isSafeInteger(job.generation)||!['ready','sending','succeeded','failed','uncertain','skipped'].includes(job.status)||!Number.isFinite(Date.parse(job.createdAt))||!model.numericId(job.imageId)||!model.allowedImageURL(job.sourceUrl)||typeof job.title!=='string'||job.title.length>200||typeof job.description!=='string'||job.description.length>1600||job.link!=='https://www.etsy.com/listing/'+job.listingId)throw Error('Geçersiz Pinterest iş kaydı.');
  ids.add(job.id);
  if(job.simulated!==undefined&&typeof job.simulated!=='boolean'||job.simulated&&job.environment!=='dry-run'||job.environment==='dry-run'&&job.status==='succeeded'&&!job.simulated)throw Error('Geçersiz Pinterest test kaydı.');
  for(const field of ['attemptedAt','dispatchedAt','resolvedAt'])if(job[field]!==undefined&&job[field]!==null&&!validTime(job[field]))throw Error('Geçersiz Pinterest işlem zamanı.');
  if(job.generation<0||!validDay(job.preparedDay)||!validTime(job.snapshotAt)||job.day!==undefined&&!validDay(job.day))throw Error('Geçersiz Pinterest işlem günü.');
  if(['sending','uncertain','succeeded'].includes(job.status)&&(!validTime(job.attemptedAt)||!validDay(job.day)))throw Error('Pinterest gönderim günlüğü eksik.');
  if(job.dispatchedAt&&(!job.attemptedAt||Date.parse(job.dispatchedAt)<Date.parse(job.attemptedAt)))throw Error('Geçersiz Pinterest gönderim günlüğü.');
  if(job.status==='succeeded'&&job.environment!=='dry-run'&&(!model.numericId(job.pinId)||model.pinterestPinURL(job.pinUrl)?.id!==job.pinId))throw Error('Pinterest başarı kaydı eksik.');
  if(job.pinUrl!==undefined&&job.pinUrl!==null&&!model.pinterestPinURL(job.pinUrl))throw Error('Geçersiz Pinterest pin bağlantısı.');
 }
 for(const row of [...value.exclusions,...value.external])if(!row||!model.numericId(row.shopId)||!model.numericId(row.listingId)||!(model.numericId(row.accountId)||row.accountId==='dry-run')||row.pinUrl&&!model.pinterestPinURL(row.pinUrl))throw Error('Geçersiz Pinterest ürün geçmişi.');
 if(value.globalBlock!==undefined&&value.globalBlock!==null){const block=value.globalBlock;if(!block||!model.numericId(block.shopId)||!model.numericId(block.accountId)||!model.numericId(block.boardId)||!['production','sandbox'].includes(block.environment)||!Number.isSafeInteger(block.generation)||block.generation<0||!['auth','scope','board','rate-limit'].includes(block.errorType)||block.errorType==='rate-limit'&&!validTime(block.retryAt))throw Error('Geçersiz Pinterest bağlantı engeli.');}
 return true;
}
function createPinterestStore({dir,clock=Date.now,getContext=()=>({}),getSnapshot=()=>null,refreshSnapshot,createPin,fetchImage,getPin,boardPins}={}){
 if(typeof dir!=='string'||!dir)throw Error('Pinterest kayıt klasörü gerekiyor.');
 const file=path.resolve(dir,'pinterest-sharing.json'),backup=file+'.backup';
 let state={schema:1,revision:0,updated:null,jobs:[],exclusions:[],external:[],globalBlock:null},recoveryError=null,busy=false,stopping=false,lastError=null;
 const now=()=>{const n=Number(clock());if(!Number.isFinite(n))throw Error('Geçersiz saat.');return n;};
 const iso=()=>new Date(now()).toISOString();
 function recoverSending(){
  if(activeFiles.has(file)||busy||recoveryError||!state.jobs.some(job=>job.status==='sending'))return;
  persist({...state,jobs:state.jobs.map(job=>job.status==='sending'?{...job,status:job.dispatchedAt?'uncertain':'failed',errorType:job.dispatchedAt?'uncertain':'interrupted-before-dispatch',reason:job.dispatchedAt?'Uygulama gönderim sırasında kesildi. Sonuç kontrol gerekli; otomatik tekrar yapılmadı.':'Gönderimden önce kesildi. Yeniden deneme açık kullanıcı seçimi gerektirir.',resolvedAt:job.dispatchedAt?null:iso()}:job)});
  lastError=null;
 }
 function read(){
  try{const stat=fs.statSync(file);if(stat.size>MAX_FILE)throw Error('Pinterest kayıt dosyası çok büyük.');const loaded=JSON.parse(fs.readFileSync(file,'utf8'));validateState(loaded);state={schema:1,revision:loaded.revision,updated:validTime(loaded.updated)?loaded.updated:null,jobs:loaded.jobs.map(publicJob),exclusions:loaded.exclusions.map(publicHistory),external:loaded.external.map(publicHistory),globalBlock:loaded.globalBlock?{...safeContext(loaded.globalBlock),errorType:loaded.globalBlock.errorType,reason:safeReason({kind:loaded.globalBlock.errorType}),retryAt:loaded.globalBlock.retryAt||null}:null};recoveryError=null;}
  catch(error){if(error.code!=='ENOENT'||fs.existsSync(backup))recoveryError='Pinterest kayıt dosyası okunamıyor; özgün dosya ve yedek korundu. Geçerli Pinterest yedeğini geri yüklemeden paylaşım yapılamaz.';}
  if(!recoveryError)try{recoverSending();}catch{}
 }
 read();
 function persist(next){
  if(recoveryError)throw Error(recoveryError);validateState(next);fs.mkdirSync(dir,{recursive:true,mode:0o700});
  try{if(fs.existsSync(file))atomicWrite(backup,state);const clean={...next,revision:state.revision+1,updated:iso(),jobs:next.jobs.map(publicJob)};atomicWrite(file,clean);state=clean;}
  catch{recoveryError='Pinterest işlemi diske kaydedilemedi. Yeni istekler engellendi; gönderilmiş bir isteğin sonucunu kontrol et. Disk alanını ve izinleri kontrol et.';throw Error(recoveryError);}
 }
 function contextFor(options={}){const context=safeContext(getContext());if(options.dryRun===true){context.environment='dry-run';context.accountId=context.accountId||'dry-run';context.boardId=context.boardId||'dry-run';context.boardName=context.boardName||'Dry-run önizleme';context.accessReady=false;}return context;}
 const targetEqual=(a,b)=>['shopId','accountId','boardId','environment','generation'].every(k=>a[k]===b[k]);
 const scoped=(row,context)=>row.shopId===context.shopId&&row.accountId===context.accountId;
 const modeScoped=(row,context)=>scoped(row,context)&&row.environment===context.environment;
 const identity=(a,b)=>a.shopId===b.shopId&&a.accountId===b.accountId&&a.listingId===b.listingId;
 function ensureCurrent(context,options){if(!targetEqual(context,contextFor(options))){const error=Error('Mağaza, hesap veya pano değişti; grubu yeniden hazırla.');error.kind='stale';throw error;}}
 function ensureSendable(context,options){ensureCurrent(context,options);const current=contextFor(options),reason=sendBlock(current);if(reason){const kind=!current.connected?'auth':!REQUIRED_SCOPES.every(scope=>current.scopes.includes(scope))?'scope':current.retryAt&&Date.parse(current.retryAt)>now()?'rate-limit':'stale';throw Object.assign(Error(reason),{kind});}}
 function capacity(context){const day=model.istanbulDay(now()),jobs=context.environment==='production'?state.jobs.filter(job=>job.accountId===context.accountId&&job.environment==='production'&&!job.simulated):[];const successful=jobs.filter(job=>job.status==='succeeded'&&job.day===day).length,reserved=jobs.filter(job=>job.status==='uncertain'||job.status==='sending').length;return {day,successfulToday:successful,reservedToday:reserved,remaining:Math.max(0,LIMIT-successful-reserved)};}
 function readyFor(context){return state.jobs.filter(job=>job.status==='ready'&&targetEqual(job,context)&&job.preparedDay===model.istanbulDay(now()));}
 function checkPreviewContext(context){if(!context.shopId)return 'Önce Etsy mağazasını bağla ve ürünleri güncelle.';if(context.environment!=='dry-run'&&!context.accountId)return 'Pinterest sayısal hesap kimliği doğrulanmadı; canlı kuyruk hazırlanamaz. Dry-run önizlemeyi kullanabilirsin.';if(context.environment!=='dry-run'&&!context.connected)return 'Önce Pinterest hesabını OAuth ile bağla.';if(!context.boardId)return 'Önce mevcut bir Pinterest panosu seç.';return null;}
 function sendBlock(context){
  if(recoveryError)return recoveryError;const base=checkPreviewContext(context);if(base)return base;
  if(context.environment==='dry-run')return null;
  if(context.retryAt&&Date.parse(context.retryAt)>now())return 'Pinterest istek sınırı için '+context.retryAt+' tarihine kadar bekleniyor.';
  const block=state.globalBlock,blockApplies=block&&(block.errorType==='rate-limit'?block.accountId===context.accountId&&block.environment===context.environment:targetEqual(block,context));if(blockApplies&&(block.errorType!=='rate-limit'||!block.retryAt||Date.parse(block.retryAt)>now()))return block.reason;
  if(context.environment==='production'&&(context.tier!=='standard'||context.tierSource!=='user-declared'||!context.accessReady))return context.blockReason||'Canlı erişim doğrulanmadı. Uygulama panelindeki Standard onayını kullanıcı beyanı olarak kaydet.';
  if(!context.accessReady)return context.blockReason||'Pinterest bağlantısı veya gerekli izinler hazır değil.';
  if(!REQUIRED_SCOPES.every(scope=>context.scopes.includes(scope)))return 'Pinterest gerekli OAuth izinlerini vermedi; hesabı gerekli izinlerle yeniden bağla.';
  if(context.boardPrivacy==='unknown')return 'Pano gizliliği doğrulanmadı; mevcut panoyu yeniden seç.';
  if(context.boardPrivacy==='SECRET'&&!['boards:read_secret','boards:write_secret','pins:read_secret','pins:write_secret'].every(scope=>context.scopes.includes(scope)))return 'Seçilen gizli pano için gereken OAuth izinleri yok; erişilebilen açık panoyu seç.';
  return null;
 }
 function activeSnapshot(context,snapshot=getSnapshot()){
  if(!snapshot||String(snapshot.shopId)!==context.shopId||!Array.isArray(snapshot.products))throw Error('Güncel Etsy mağaza ürünleri bulunamadı.');
  const stamp=Date.parse(snapshot.updated);if(!Number.isFinite(stamp)||now()-stamp>FRESH_MS||stamp>now()+60000)throw Error('Etsy ürün verisi eski veya zamanı geçersiz; Etsy verisini güncelle.');
  return snapshot;
 }
 function candidates(context,snapshot){
  const eligible=[],blocked=[],seen=new Set();
  for(const product of snapshot?.products||[]){const id=model.numericId(product.listing_id??product.listingId??product.id);if(!id||seen.has(id))continue;seen.add(id);const row={listingId:id,shopId:context.shopId,accountId:context.accountId};
   if(product.state!=='active')continue;
   if((product.listingType??product.type)==='physical'){blocked.push({listingId:id,title:model.buildPinContent(product).title,reason:'Fiziksel Etsy ilanı dijital STL olarak paylaşılmaz; ürün türünü kontrol et.'});continue;}
   if(state.exclusions.some(v=>identity(v,row))||state.external.some(v=>identity(v,row)))continue;
   if(state.jobs.some(job=>identity(job,row)&&job.environment===context.environment&&['succeeded','sending','uncertain','ready'].includes(job.status)))continue;
   if(state.jobs.some(job=>identity(job,row)&&job.environment===context.environment&&job.status==='failed')){blocked.push({listingId:id,title:model.buildPinContent(product).title,reason:'Önceki deneme başarısız. Yeniden dene işlemi açık kullanıcı seçimi gerektirir.'});continue;}
   const image=model.selectPrimaryImage(product.images);if(image.status!=='rank-1'){blocked.push({listingId:id,title:model.buildPinContent(product).title,reason:image.reason});continue;}
   const created=Number(product.created??product.original_creation_timestamp??product.creation_timestamp);eligible.push({product,id,image,created:Number.isFinite(created)&&created>0?created:Infinity});
  }
  eligible.sort((a,b)=>a.created-b.created||(a.id.length-b.id.length)||a.id.localeCompare(b.id));return {eligible,blocked};
 }
 function status(options={}){
  if(!busy&&!activeFiles.has(file))read();const context=contextFor(options),cap=capacity(context);let snapshot=getSnapshot(),selection={eligible:[],blocked:[]};try{snapshot=activeSnapshot(context,snapshot);selection=candidates(context,snapshot);}catch{}
  const preview=readyFor(context).map(publicJob),blockReason=sendBlock(context);
  return {schema:1,revision:state.revision,busy:busy||activeFiles.has(file),stopping:stopping||activeFiles.get(file)?.stopping===true,error:recoveryError||lastError,context,...cap,eligibleCount:selection.eligible.length+preview.length,preview,blocked:selection.blocked,exclusions:clone(state.exclusions.filter(row=>scoped(row,context))),external:clone(state.external.filter(row=>scoped(row,context))),jobs:state.jobs.filter(job=>modeScoped(job,context)).map(publicJob),selectionMethod:'En eski paylaşılmamış aktif ürün önce; oluşturma zamanı yoksa ilan kimliği sırası.',snapshotAt:snapshot?.updated||null,orderingVerification:model.orderingVerification,blockReason,canSend:!blockReason&&preview.length>0&&!busy&&!activeFiles.has(file),dryRun:context.environment==='dry-run',dailyLimit:LIMIT,limitSource:'local-application-policy'};
 }
 function acquire(){if(busy||activeFiles.has(file)){const error=Error('Pinterest işlemi zaten sürüyor; ikinci sekme veya çift tıklama yeni gönderim başlatmadı.');error.kind='busy';throw error;}read();if(recoveryError)throw Error(recoveryError);busy=true;activeFiles.set(file,{stopping:false});lastError=null;stopping=false;}
 function release(){busy=false;activeFiles.delete(file);stopping=false;}
 const shouldStop=()=>stopping||activeFiles.get(file)?.stopping===true;
 async function fresh(context,options){if(typeof refreshSnapshot!=='function')throw Error('Etsy güncellik kontrolü kullanılamıyor; gönderim engellendi.');const result=await refreshSnapshot();ensureCurrent(context,options);return activeSnapshot(context,result?.snapshot||result||getSnapshot());}
 function invalidateReady(context){
  const day=model.istanbulDay(now());let changed=false;const jobs=state.jobs.map(job=>{if(job.environment===context.environment&&job.status==='ready'&&(!targetEqual(job,context)||job.preparedDay!==day)){changed=true;return {...job,status:'skipped',resolvedAt:iso(),errorType:'stale',reason:'Hedef veya gün değişti; grubu yeniden hazırla.'};}return job;});if(changed)persist({...state,jobs});
 }
 function newJob(context,item,snapshot,retryOf){if((item.product.listingType??item.product.type)==='physical')throw Error('Fiziksel Etsy ilanı dijital STL olarak paylaşılmaz.');return {id:crypto.randomUUID(),listingId:item.id,shopId:context.shopId,accountId:context.accountId,accountUsername:context.accountUsername,boardId:context.boardId,boardName:context.boardName,boardPrivacy:context.boardPrivacy,environment:context.environment,generation:context.generation,status:'ready',...model.buildPinContent(item.product,item.product.confirmedFacts),imageId:item.image.imageId,sourceUrl:item.image.url,orderingVerification:item.image.orderingVerification,createdAt:iso(),preparedDay:model.istanbulDay(now()),snapshotAt:snapshot.updated,...(retryOf?{retryOf}:{})};}
 function updateJob(id,patch){const job=state.jobs.find(j=>j.id===id);if(!job)throw Error('Pinterest işi bulunamadı.');persist({...state,jobs:state.jobs.map(j=>j.id===id?{...j,...patch}:j)});return state.jobs.find(j=>j.id===id);}
 async function prepare(options={}){acquire();try{const context=contextFor(options),reason=checkPreviewContext(context);if(reason)throw Error(reason);const snapshot=await fresh(context,options);invalidateReady(context);for(const job of readyFor(context)){const invalid=validateFreshJob(job,snapshot);if(invalid)updateJob(job.id,{status:'skipped',errorType:'stale',reason:invalid,resolvedAt:iso()});}const cap=context.environment==='dry-run'?LIMIT:capacity(context).remaining,existing=readyFor(context);if(existing.length>cap)for(const job of existing.slice(cap))updateJob(job.id,{status:'skipped',reason:'Günlük kapasite değişti; grubu yeniden hazırla.',errorType:'capacity',resolvedAt:iso()});const count=Math.max(0,cap-readyFor(context).length),selection=candidates(context,snapshot);if(count&&selection.eligible.length){const jobs=selection.eligible.slice(0,count).map(item=>newJob(context,item,snapshot));ensureCurrent(context,options);persist({...state,jobs:[...state.jobs,...jobs]});}}catch(error){lastError=safeReason(error);throw error;}finally{release();}return status(options);}
 function validateFreshJob(job,snapshot){const product=snapshot.products.find(p=>String(p.listing_id??p.listingId??p.id)===job.listingId);if(!product||product.state!=='active')return 'Etsy ilanı artık aktif değil; gönderilmedi.';if((product.listingType??product.type)==='physical')return 'Fiziksel Etsy ilanı dijital STL olarak paylaşılmaz; gönderilmedi.';const primary=model.selectPrimaryImage(product.images);if(primary.status!=='rank-1'||primary.imageId!==job.imageId||primary.url!==job.sourceUrl)return 'Etsy rank 1 görsel kimliği veya adresi değişti; önizlemeyi yeniden hazırla.';const content=model.buildPinContent(product,product.confirmedFacts);if(content.title!==job.title||content.description!==job.description||content.link!==job.link||content.alt_text!==job.alt_text)return 'Etsy başlığı veya pin içeriği değişti; önizlemeyi yeniden hazırla.';if(state.exclusions.some(v=>identity(v,job))||state.external.some(v=>identity(v,job)))return 'Ürün hariç tutuldu veya önceden paylaşıldı olarak işaretlendi.';return null;}
 function safeReason(error){const messages={auth:'Pinterest yetkilendirmesi başarısız; hesabı yeniden bağla.',scope:'Pinterest izinleri yetersiz; OAuth bağlantısını gerekli izinlerle yenile.',board:'Pinterest panosu erişilemiyor; hedef panoyu yeniden seç.', 'rate-limit':'Pinterest istek sınırına ulaşıldı; belirtilen zamana kadar bekle.',stale:'Mağaza, hesap veya pano değişti; grubu yeniden hazırla.',network:'Pinterest isteğinin sonucu belirsiz; mevcut pini kontrol et, otomatik tekrar gönderilmedi.',item:'Ürün görseli veya pin içeriği gönderilemedi.',busy:'Pinterest işlemi zaten sürüyor.'};return messages[error?.kind]||'Pinterest işlemi tamamlanamadı; kayıt ve bağlantı durumunu kontrol et.';}
 function globalFailure(error,context){if(!['auth','scope','board','rate-limit'].includes(error?.kind))return false;const retryAt=error.kind==='rate-limit'?(Number.isFinite(Date.parse(error.retryAt))?new Date(error.retryAt).toISOString():new Date(now()+60000).toISOString()):null;persist({...state,globalBlock:{...context,errorType:error.kind,reason:safeReason(error),retryAt}});return true;}
 async function send(options={}){
  acquire();try{const context=contextFor(options),reason=sendBlock(context);if(reason)throw Error(reason);const ready=readyFor(context),ids=options.jobIds;if(!Array.isArray(ids)||!ids.length||new Set(ids).size!==ids.length||ids.length!==ready.length||ids.some(id=>typeof id!=='string'||!ready.some(job=>job.id===id)))throw Error('Gönderim için ekrandaki hazır grubun tam iş kimlikleri gerekiyor; grubu yeniden hazırla.');if(context.environment!=='dry-run'&&ready.length>capacity(context).remaining)throw Error('Günlük üç paylaşım kapasitesi değişti; grubu yeniden hazırla.');
   let snapshot=await fresh(context,options);for(const job of ready){const invalid=validateFreshJob(job,snapshot);if(invalid)updateJob(job.id,{status:'skipped',errorType:'stale',reason:invalid,resolvedAt:iso()});}
   for(const original of ready){
    if(shouldStop())break;let job=state.jobs.find(j=>j.id===original.id);if(job.status!=='ready')continue;
    try{
     ensureSendable(context,options);if(context.environment!=='dry-run'&&capacity(context).remaining<1)break;
     snapshot=await fresh(context,options);const invalid=validateFreshJob(job,snapshot);if(invalid){updateJob(job.id,{status:'skipped',errorType:'stale',reason:invalid,resolvedAt:iso()});continue;}
     if(shouldStop())break;
     if(context.environment==='dry-run'){updateJob(job.id,{status:'succeeded',simulated:true,attemptedAt:iso(),resolvedAt:iso(),day:model.istanbulDay(now()),reason:'Dry-run: yalnızca yerel önizleme; Pinterest isteği yapılmadı.'});continue;}
     if(typeof fetchImage!=='function'||typeof createPin!=='function')throw Object.assign(Error(),{kind:'item'});
     const image=await fetchImage(job.sourceUrl);ensureSendable(context,options);if(shouldStop())break;
     if(!image||!Buffer.isBuffer(image.data)||!image.data.length||!['image/jpeg','image/png'].includes(image.content_type))throw Object.assign(Error(),{kind:'item'});
     // Refresh after bounded media I/O too: no stale active listing or changed
     // source image may be posted because a download took time.
     snapshot=await fresh(context,options);ensureSendable(context,options);const finalInvalid=validateFreshJob(job,snapshot);if(finalInvalid){updateJob(job.id,{status:'skipped',errorType:'stale',reason:finalInvalid,resolvedAt:iso()});continue;}if(shouldStop())break;
     job=updateJob(job.id,{status:'sending',attemptedAt:iso(),day:model.istanbulDay(now()),mediaSha256:crypto.createHash('sha256').update(image.data).digest('hex'),mediaBytes:image.data.length,mediaContentType:image.content_type});
     const payload={board_id:job.boardId,title:job.title,description:job.description,link:job.link,alt_text:job.alt_text,media_source:{source_type:'image_base64',content_type:image.content_type,data:image.data.toString('base64')}};
     const pin=await createPin(payload,{expectedContext:context,onDispatch(){ensureSendable(context,options);if(shouldStop())throw Object.assign(Error(),{kind:'stale'});const current=activeSnapshot(context);const invalid=validateFreshJob(job,current);if(invalid)throw Object.assign(Error(),{kind:'stale'});updateJob(job.id,{dispatchedAt:iso(),day:model.istanbulDay(now())});}});
     const current=state.jobs.find(j=>j.id===job.id);if(!current.dispatchedAt||!model.numericId(pin?.id)||String(pin?.board_id)!==job.boardId||pin.link!==job.link)throw Object.assign(Error(),{kind:'unexpected',requestDispatched:!!current.dispatchedAt});
     // Count the successful completion day conservatively. An in-flight request
     // crossing Istanbul midnight must not free a fourth new-day success.
     updateJob(job.id,{status:'succeeded',pinId:String(pin.id),pinUrl:'https://www.pinterest.com/pin/'+pin.id+'/',resolvedAt:iso(),day:model.istanbulDay(now()),reason:job.boardPrivacy==='PUBLIC'?'Pinterest pin oluşturuldu; herkese açık görünürlük API üzerinden ayrıca doğrulanmadı.':'Pinterest pin oluşturuldu; pano gizliliği açık tanıtım olarak değerlendirilmedi.'});
    }catch(error){
     const current=state.jobs.find(j=>j.id===original.id),dispatched=!!current.dispatchedAt||error?.requestDispatched===true,knownFailure=error?.uncertain!==true&&error?.kind!=='stale'&&[400,401,403,404,409,422,429].includes(error?.status),uncertain=dispatched&&!knownFailure;
     updateJob(original.id,{status:uncertain?'uncertain':error?.kind==='stale'?'skipped':'failed',resolvedAt:uncertain?null:iso(),errorType:uncertain?'uncertain':error?.kind||'item',reason:uncertain?'İstek gönderilmiş olabilir. Sonuç kontrol gerekli; otomatik tekrar gönderilmedi.':safeReason(error)});
     lastError=safeReason(error);if(globalFailure(error,context)||uncertain||error?.kind==='stale')break;
    }
   }
   if(shouldStop()){for(const job of ready){const current=state.jobs.find(j=>j.id===job.id);if(current.status==='ready')updateJob(job.id,{status:'skipped',errorType:'cancelled',resolvedAt:iso(),reason:'Yeni gönderimler durduruldu. Gönderilmiş istekler veya oluşmuş pinler geri alınmadı.'});}}
  }catch(error){lastError=safeReason(error);throw error;}finally{release();}
  return status(options);
 }
 function stop(){const active=activeFiles.get(file);if(active)active.stopping=true;return status();}
 function editContext(options){const context=contextFor(options);const reason=checkPreviewContext(context);if(reason)throw Error(reason);return context;}
 function exclude(listingId,value=true,options={}){acquire();try{const context=editContext(options),id=model.numericId(listingId);if(!id||typeof value!=='boolean')throw Error('Geçerli ürün ve hariç tutma seçimi gerekiyor.');const row={shopId:context.shopId,accountId:context.accountId,listingId:id};const exclusions=state.exclusions.filter(v=>!identity(v,row));if(value)exclusions.push({...row,createdAt:iso()});const jobs=state.jobs.map(job=>identity(job,row)&&job.status==='ready'&&value?{...job,status:'skipped',errorType:'excluded',reason:'Ürün kullanıcı tarafından hariç tutuldu.',resolvedAt:iso()}:job);persist({...state,exclusions,jobs});}finally{release();}return status(options);}
 function markExternal({listingId,pinUrl,...options}={}){acquire();try{const context=editContext(options),id=model.numericId(listingId),pin=pinUrl?model.pinterestPinURL(pinUrl):null;if(!id||pinUrl&&!pin)throw Error('Geçerli ürün kimliği ve Pinterest pin bağlantısı gerekiyor.');const row={shopId:context.shopId,accountId:context.accountId,listingId:id,createdAt:iso(),source:'user-declared',pinUrl:pin?.url||null};persist({...state,external:[...state.external.filter(v=>!identity(v,row)),row],jobs:state.jobs.map(job=>identity(job,row)&&job.status==='ready'?{...job,status:'skipped',errorType:'external',reason:'Kullanıcı önceden dışarıdan paylaşıldığını bildirdi.',resolvedAt:iso()}:job)});}finally{release();}return status(options);}
 async function retry(jobId,options={}){acquire();try{const context=contextFor(options),job=state.jobs.find(j=>j.id===jobId);if(!job||!modeScoped(job,context)||job.status!=='failed')throw Error('Yalnızca kesin başarısız veya oluşmadığı açıkça doğrulanmış iş yeniden hazırlanabilir.');if(job.errorType==='not-created'&&job.resolutionSource!=='user-confirmed')throw Error('Belirsiz sonucun oluşmadığı doğrulanmalı.');const reason=checkPreviewContext(context);if(reason)throw Error(reason);const cap=context.environment==='dry-run'?LIMIT:capacity(context).remaining;if(readyFor(context).length>=cap)throw Error('Günlük grupta boş kapasite yok.');if(state.jobs.some(j=>j.id!==job.id&&identity(j,job)&&j.environment===job.environment&&['ready','sending','uncertain','succeeded'].includes(j.status)))throw Error('Bu ürün için başka bir hazır, belirsiz veya başarılı iş var.');const snapshot=await fresh(context,options),product=snapshot.products.find(p=>String(p.listing_id??p.listingId??p.id)===job.listingId);if(!product||product.state!=='active')throw Error('Etsy ilanı artık aktif değil.');if(state.exclusions.some(v=>identity(v,job))||state.external.some(v=>identity(v,job)))throw Error('Ürün hariç veya önceden paylaşıldı olarak işaretli.');const image=model.selectPrimaryImage(product.images);if(image.status!=='rank-1')throw Error(image.reason);const next=newJob(context,{product,id:job.listingId,image},snapshot,job.id);persist({...state,jobs:[...state.jobs,next]});return status(options);}finally{release();}}
 async function resolve({jobId,outcome,pinUrl,confirmed,...options}={}){acquire();try{if(confirmed!==true)throw Error('Pinterest kontrol sonucunu açıkça doğrulamalısın.');const context=contextFor(options),job=state.jobs.find(j=>j.id===jobId);if(!job||!modeScoped(job,context)||job.status!=='uncertain')throw Error('Bu hesaba ait belirsiz iş bulunamadı.');if(outcome==='not-created'){updateJob(job.id,{status:'failed',errorType:'not-created',resolutionSource:'user-confirmed',reason:'Kullanıcı pin oluşmadığını açıkça doğruladı. Yeniden deneme ayrıca seçilmeli.',resolvedAt:iso()});return status(options);}if(outcome!=='pin-created')throw Error('Geçerli uzlaştırma sonucu gerekiyor.');const pin=model.pinterestPinURL(pinUrl);if(!pin)throw Error('Oluşan Pinterest pininin tam HTTPS bağlantısını gir.');let source='user-confirmed';if(typeof getPin==='function'){let record;try{record=await getPin(pin.id);}catch(error){if(!['auth','scope'].includes(error?.kind))throw Error('Pin okunamadı; sonuç belirsiz kaldı.');}ensureCurrent(context,options);if(record){if(String(record.id)!==pin.id||String(record.board_id)!==job.boardId||record.link!==job.link||record.is_owner!==true||record.account_id&&String(record.account_id)!==job.accountId)throw Error('Pin hesabı, panosu veya Etsy bağlantısı doğrulanamadı; sonuç belirsiz kaldı.');source='api-verified-user-selected';}}
   updateJob(job.id,{status:'succeeded',pinId:pin.id,pinUrl:pin.url,resolvedAt:iso(),day:model.istanbulDay(now()),resolutionSource:source,reason:source==='user-confirmed'?'Pin kullanıcı beyanıyla kaydedildi; API üzerinden doğrulanmadı.':'Kullanıcının seçtiği pin hesap, pano ve Etsy bağlantısı bakımından API ile doğrulandı.'});return status(options);
  }finally{release();}}
 async function reconcile(jobId,options={}){acquire();try{const context=contextFor(options),job=state.jobs.find(j=>j.id===jobId);if(!job||!modeScoped(job,context)||job.status!=='uncertain')throw Error('Bu hesaba ait belirsiz iş bulunamadı.');if(typeof boardPins!=='function')return {jobId,candidates:[],reason:'Pinterest pin okuma izni yok; kullanıcı sonucu kontrol etmeli.',conclusive:false};const value=await boardPins(job.boardId,{});ensureCurrent(context,options);const records=Array.isArray(value)?value:value?.items||[];const candidates=records.filter(pin=>pin.link===job.link&&String(pin.board_id)===job.boardId&&model.numericId(pin.id)).slice(0,100).map(pin=>({id:String(pin.id),url:'https://www.pinterest.com/pin/'+pin.id+'/',boardId:String(pin.board_id),link:pin.link,createdAt:pin.created_at||null}));return {jobId,candidates,conclusive:false,reason:'Aynı Etsy bağlantısı kesin gönderim kanıtı değildir. Aday pin seçimi veya pin oluşmadığına dair açık kullanıcı doğrulaması gerekiyor.'};}finally{release();}}
 function exportRecords(){if(!busy&&!activeFiles.has(file))read();if(recoveryError)throw Error(recoveryError);return {schema:1,revision:state.revision,updated:state.updated,source:'pinterest-sharing-public-records',jobs:state.jobs.map(publicJob),exclusions:clone(state.exclusions),external:clone(state.external),dailyLimit:LIMIT,timeZone:'Europe/Istanbul',limitSource:'local-application-policy'};}
 // Idle reload and startup recovery are local and never create a pin.
 return {status,prepare,send,stop,exclude,markExternal,retry,resolve,reconcile,export:exportRecords};
}
module.exports={createPinterestStore,validateState};
