'use strict';
const path=require('node:path');
const os=require('node:os');
const {createClient}=require('./pinterest-client');
const {createPinterestStore}=require('./pinterest-store');
const {createMediaFetcher}=require('./pinterest-media');
const localAddresses=new Set(['127.0.0.1','::1','::ffff:127.0.0.1']);
const boundActions=new Set(['board','access','prepare','send','stop','exclude','external','retry','resolve','reconcile']);
const contextFields=['shopId','accountId','boardId','environment','generation'];
function problem(message,status=400){return Object.assign(new Error(message),{publicMessage:message,status});}
function publicError(error){
 if(error?.publicMessage)return error.publicMessage;
 const messages={stale:'Mağaza, Pinterest hesabı veya pano değişti. Güncel hedef için grubu yeniden hazırla.',busy:'Bir Pinterest işlemi sürüyor; ikinci gönderim başlatılmadı.',auth:'Pinterest yetkisi geçersiz veya sona erdi. Hesabı yeniden bağla.',scope:'Pinterest izinleri yeterli değil. Uygulama izinlerini ve pano erişimini kontrol et.',board:'Pinterest panosuna erişilemiyor. Mevcut panoları yenileyip hedefi düzelt.', 'rate-limit':'Pinterest istek sınırı nedeniyle bekleniyor; paneldeki bekleme süresinden sonra yeniden dene.',image:'Etsy görseli güvenle alınamadı. Görsel kaynağını, biçimini ve boyutunu kontrol et.',network:'Pinterest ağ yanıtı alınamadı. Belirsiz işleri yeniden göndermeden önce kontrol et.',unexpected:'Pinterest yanıtı veya kalıcı kayıt doğrulanamadı. Kontrol gereken işleri incele.'};
 return messages[error?.kind]||'Pinterest işlemi tamamlanamadı. Bağlantı, hedef ve kuyruk durumunu kontrol et; kayıtlar korunuyor.';
}
async function readBody(req){
 const chunks=[];let bytes=0;
 for await(const chunk of req){bytes+=chunk.length;if(bytes>16384)throw problem('Pinterest isteği en fazla 16 KiB olabilir.',413);chunks.push(chunk);}
 let value;try{value=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw problem('Okunabilir JSON istek gövdesi gerekiyor.');}
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.hasOwn(value,'__proto__')||Object.hasOwn(value,'constructor')||Object.hasOwn(value,'prototype'))throw problem('Geçerli bir işlem nesnesi gerekiyor.');
 return value;
}
function createPinterestController(options={}){
 const etsy=options.etsy||require('./etsy'),workspace=options.workspace||require('./workspace').workspace();
 const dir=options.dir||process.env.STL_DATA_DIR||path.join(process.env.LOCALAPPDATA||os.homedir(),'STLNicheLab');
 const client=options.client||createClient({dir});
 let lastActionError=null;
 function getContext(){
  const account=etsy.status(),active=workspace.status().activeShopId,context=client.context();
  const shopId=account.connected&&account.shopId&&String(account.shopId)===String(active)?String(active):null;
  return {...context,shopId,accessReady:!!shopId&&context.accessReady,blockReason:shopId?context.blockReason:'Önce Etsy mağazasını bağla ve aktif ürünlerini eşitle.'};
 }
 function attachFacts(snapshot){
  const studies=Object.values(workspace.status().state?.listingResearch?.studies||{});
  return {...snapshot,products:(snapshot.products||[]).map(product=>{
   const id=String(product.id??product.listing_id),study=studies.filter(s=>s.shopId===snapshot.shopId&&(s.productId===id||s.publishedLink?.listingId===id)&&s.facts?.confirmedAt).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))[0];
   return {...product,...(study?{confirmedFacts:{confirmed:true,subject:study.facts.subject,appearance:study.facts.appearance}}:{})};
  })};
 }
 function getSnapshot(){
  const context=getContext(),value=etsy.status();if(!context.shopId||value.snapshot?.shopId!==context.shopId)return null;
  return attachFacts({shopId:context.shopId,updated:value.lastProductsSuccess||value.snapshot.updated,products:value.snapshot.products});
 }
 async function refreshSnapshot(){
  const prior=getContext();if(!prior.shopId)throw problem('Önce Etsy mağazasını bağla ve aktif ürünlerini eşitle.');
  const fresh=await etsy.refreshForPinterest();
  if(String(fresh.shopId)!==prior.shopId||getContext().shopId!==prior.shopId)throw problem('Etsy mağazası değişti; eski paylaşım grubu kullanılmadı.',409);
  return attachFacts(fresh);
 }
 const store=options.store||createPinterestStore({dir,getContext,getSnapshot,refreshSnapshot,
  createPin:(payload,settings)=>client.createPin(payload,settings),fetchImage:options.fetchImage||createMediaFetcher(),
  getPin:id=>client.getPin(id),boardPins:(id,settings)=>client.boardPins(id,settings)});
 function status(settings={}){const value=store.status(settings);return {...value,connection:client.status(),error:value.error||lastActionError};}
 function assertExpected(input,settings={}){
  const expected=input.expectedContext,actual=store.status(settings).context;
  if(!expected||typeof expected!=='object'||Array.isArray(expected)||contextFields.some(key=>!Object.hasOwn(expected,key)||String(expected[key]??'')!==String(actual[key]??''))||(input.shopId!==undefined&&String(input.shopId??'')!==String(actual.shopId??'')))throw problem('Mağaza, hesap, pano veya ortam değişti. Güncel paylaşım grubunu yeniden hazırla.',409);
 }
 async function handle(req,res,url){
  const respond=(code,value)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});res.end(JSON.stringify(value));};
  if(!localAddresses.has(req.socket.remoteAddress)||!/^(localhost|127\.0\.0\.1):\d+$/.test(req.headers.host||'')){respond(403,{error:'Pinterest işlemlerine yalnızca yerel panelden erişilebilir.'});return;}
  const origin='http://'+req.headers.host,callback=url.pathname==='/oauth/pinterest/callback';
  if(req.method==='POST'&&req.headers.origin!==origin){respond(403,{error:'Pinterest işlemini yerel panelden başlat.'});return;}
  if(req.method==='GET'&&!callback&&((req.headers.origin!==undefined&&req.headers.origin!==origin)||(req.headers['sec-fetch-site']!==undefined&&!['same-origin','none'].includes(req.headers['sec-fetch-site']))||(req.headers['sec-fetch-mode']!==undefined&&!['cors','same-origin'].includes(req.headers['sec-fetch-mode'])))){respond(403,{error:'Pinterest bilgilerini ve pano sorgularını yerel panelden aç.'});return;}
  try{
   if(callback&&req.method==='GET'){
    if(url.searchParams.getAll('code').length!==1||url.searchParams.getAll('state').length!==1)throw problem('Pinterest yetkilendirmesi tamamlanmadı. Panelden yeniden bağlan.');
    await client.completeOAuth({code:url.searchParams.get('code'),state:url.searchParams.get('state')});lastActionError=null;
    res.writeHead(303,{'Location':'/#pinterest','Cache-Control':'no-store','Referrer-Policy':'no-referrer'});res.end();return;
   }
   const route=url.pathname.slice('/api/pinterest/'.length),settings={dryRun:url.searchParams.get('dryRun')==='1'};
   if(req.method==='GET'){
    if(route==='status'){respond(200,status(settings));return;}
    if(route==='boards'){respond(200,{boards:await client.boards()});return;}
    if(route==='export'){respond(200,store.export());return;}
    respond(404,{error:'Pinterest işlemi bulunamadı.'});return;
   }
   if(req.method!=='POST'){respond(405,{error:'Bu Pinterest işlemi için POST gerekir.'});return;}
   const input=await readBody(req),mode={dryRun:input.dryRun===true};
   if(boundActions.has(route))assertExpected(input,mode);
   if(route==='config')client.configure({appId:input.appId,appSecret:input.appSecret,redirectUri:input.redirectUri||origin+'/oauth/pinterest/callback',environment:input.environment});
   else if(route==='connect'){const value=await client.startOAuth();respond(200,{...status(mode),url:value.url});return;}
   else if(route==='oauth-complete')await client.completeOAuth({redirectUrl:input.redirectUrl,code:input.code,state:input.state});
   else if(route==='disconnect')client.disconnect();
   else if(route==='board')await client.selectBoard(input.boardId);
   else if(route==='access')client.setAccess({tier:input.tier,standardApprovalConfirmed:input.standardApprovalConfirmed});
   else if(route==='prepare')await store.prepare(mode);
   else if(route==='send'){
    const before=status(mode);if(before.busy)throw problem('Pinterest gönderimi zaten sürüyor; ikinci gönderim başlatılmadı.',409);
    if(before.blockReason)throw problem(before.blockReason,409);
    if(!Array.isArray(input.jobIds)||input.jobIds.length<1||input.jobIds.length>3||new Set(input.jobIds).size!==input.jobIds.length||input.jobIds.some(id=>typeof id!=='string'||id.length>180))throw problem('Ekranda görünen en fazla üç farklı hazır iş kimliği gerekiyor.');
    const visible=before.preview.map(job=>job.id);if(visible.length!==input.jobIds.length||visible.some(id=>!input.jobIds.includes(id)))throw problem('Görünen paylaşım grubu değişti; önizlemeyi yeniden hazırla.',409);
    lastActionError=null;void store.send({jobIds:input.jobIds,...mode}).catch(error=>{lastActionError=publicError(error);});respond(202,{...status(mode),accepted:true});return;
   }
   else if(route==='stop')store.stop();
   else if(route==='exclude'){
    if(mode.dryRun)throw problem('Hariç tutma gerçek Pinterest hesabının geçmişinde yapılır. Gerçek yayın görünümünü aç.');
    store.exclude(input.listingId,input.value,mode);
   }
   else if(route==='external'){
    if(mode.dryRun)throw problem('Önceki paylaşım işareti gerçek Pinterest hesabına aittir. Gerçek yayın görünümünü aç.');
    store.markExternal({listingId:input.listingId,pinUrl:input.pinUrl,...mode});
   }
   else if(route==='retry')await store.retry(input.jobId,mode);
   else if(route==='resolve'){
    const confirmed=input.confirmed===true||(input.outcome==='not-created'&&input.notCreatedConfirmed===true);
    if(!confirmed)throw problem('Belirsiz gönderimin sonucunu açıkça doğruladıktan sonra kaydedebilirsin.');
    await store.resolve({jobId:input.jobId,outcome:input.outcome,pinUrl:input.pinUrl,confirmed,...mode});
   }
   else if(route==='reconcile'){const reconciliation=await store.reconcile(input.jobId,mode);respond(200,{...status(mode),reconciliation});return;}
   else {respond(404,{error:'Pinterest işlemi bulunamadı.'});return;}
   lastActionError=null;respond(200,status(mode));
  }catch(error){respond(error.status||(['busy','stale'].includes(error.kind)?409:400),{error:publicError(error)});}
 }
 return {handle,status,client,store};
}
let instance;
async function handle(req,res,url){
 try{instance??=createPinterestController();await instance.handle(req,res,url);}
 catch{if(!res.headersSent){res.writeHead(503,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify({error:'Pinterest yerel kayıtları açılamadı. Mevcut dosyalar korunuyor; diğer uygulama bölümlerini kullanabilirsin.'}));}}
}
module.exports={handle,createPinterestController,publicError};
