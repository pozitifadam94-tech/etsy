const {listingObservations}=require('./observations');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const crypto=require('node:crypto');
const market=require('./market');
const {workspace}=require('./workspace');
const dir=process.env.STL_DATA_DIR||path.join(process.env.LOCALAPPDATA||os.homedir(),'STLNicheLab');
const file=path.join(dir,'connection.json');
let data={},connectionError=null;try{data=JSON.parse(fs.readFileSync(file,'utf8'));if(!data||typeof data!=='object'||Array.isArray(data))throw Error('Geçersiz bağlantı kaydı.');}catch(e){if(e.code!=='ENOENT')connectionError='Yerel bağlantı dosyası okunamıyor. Dosya korunuyor; Ayarlar’dan bağlantıyı yeniden kur. Kayıtlı çalışma alanı silinmedi.';data={};}
let pending=null,busy=false,generation=0,refreshPending=null;
let quota=data.quota||{},retryUntil=Number(data.rateLimitUntil)||0;
function stale(){const e=Error('Hesap değişti; eski yanıt kaydedilmedi.');e.code='STALE_ACCOUNT';return e;}
function context(){return {generation,key:data.key,secret:data.secret};}
function assertCurrent(ctx){if(ctx.generation!==generation||ctx.key!==data.key)throw stale();}
function persist(next){fs.mkdirSync(dir,{recursive:true,mode:0o700});if(connectionError){const recovery=path.join(dir,'recovery');fs.mkdirSync(recovery,{recursive:true,mode:0o700});fs.copyFileSync(file,path.join(recovery,'private-connection-'+Date.now()+'.json'));}const {atomicWrite}=require('./workspace');atomicWrite(file,JSON.stringify(next));data=next;connectionError=null;}
function retryAfterMillis(value,now=Date.now()){
 if(value==null)return 60000;const number=Number(value);if(String(value).trim()!==''&&Number.isFinite(number)&&number>=0)return Math.max(1000,number*1000);
 const stamp=Date.parse(value);return Number.isFinite(stamp)?Math.max(1000,stamp-now):60000;
}
async function jsonFetch(url,options={},ctx){
 if(ctx)assertCurrent(ctx);
 if(retryUntil>Date.now()){const e=Error('Etsy istek sınırı için bekleniyor. Son sağlam kayıt korunuyor.');e.status=429;e.retryAt=retryUntil;throw e;}
 const r=await fetch(url,{...options,signal:AbortSignal.timeout(30000)});if(ctx)assertCurrent(ctx);
 const read=name=>r.headers?.get?.(name)||null;
 quota={checkedAt:new Date().toISOString(),remainingSecond:read('x-remaining-this-second'),remainingDay:read('x-remaining-today'),limitSecond:read('x-limit-per-second'),limitDay:read('x-limit-per-day')};
 if(!r.ok){const error=new Error(r.status===429?'Etsy istek sınırı: son sağlam kayıt korundu; bekleyip yeniden dene.':`Etsy erişim hatası (${r.status}). Uygulama izinlerini ve bağlantıyı kontrol et.`);error.status=r.status;
  if(r.status===429){retryUntil=Date.now()+retryAfterMillis(read('retry-after'));error.retryAt=retryUntil;persist({...data,quota,rateLimitUntil:retryUntil});}throw error;
 }
 const value=await r.json();if(ctx)assertCurrent(ctx);return value;
}
async function tokenRequest(body,ctx=context()){return jsonFetch('https://api.etsy.com/v3/public/oauth/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(body)},ctx);}
async function access(ctx=context()){
 assertCurrent(ctx);if(!data.tokens)throw Error('Önce Etsy hesabını bağla.');if(data.expires>Date.now()+60000)return data.tokens.access_token;
 if(!refreshPending||refreshPending.generation!==ctx.generation){
  const request={generation:ctx.generation,promise:null};request.promise=(async()=>{const tokens=await tokenRequest({grant_type:'refresh_token',client_id:ctx.key,refresh_token:data.tokens.refresh_token},ctx);assertCurrent(ctx);persist({...data,tokens:{...data.tokens,...tokens},expires:Date.now()+tokens.expires_in*1000});return tokens.access_token;})();refreshPending=request;
  request.promise.finally(()=>{if(refreshPending===request)refreshPending=null;}).catch(()=>{});
 }
 const token=await refreshPending.promise;assertCurrent(ctx);return token;
}
async function api(route,ctx=context()){const token=await access(ctx);return jsonFetch('https://openapi.etsy.com/v3/application'+route,{headers:{'x-api-key':ctx.key+':'+ctx.secret,Authorization:'Bearer '+token}},ctx);}
async function pages(route,ctx=context()){const all=[];for(let offset=0;offset<100000;offset+=100){const r=await api(route+(route.includes('?')?'&':'?')+'limit=100&offset='+offset,ctx);if(!Array.isArray(r.results))throw Error('Beklenmeyen Etsy yanıtı.');all.push(...r.results);if(r.results.length<100||(Number.isFinite(r.count)&&all.length>=r.count))return all;}throw Error('Etsy sayfalama sınırı aşıldı; eksik veri kaydedilmedi.');}
function receiptRows(receipts){return [...new Map(receipts.map((r,index)=>[r.receipt_id===undefined?'row:'+index:String(r.receipt_id),r])).values()].map(r=>({...r,transactions:[...new Map((r.transactions||[]).map((t,index)=>[t.transaction_id===undefined?'row:'+index:String(t.transaction_id),t])).values()]}));}
function listingImages(value){
 const safeURL=value=>{try{const u=new URL(value);if(u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&(u.hostname==='etsystatic.com'||u.hostname.endsWith('.etsystatic.com')))return u.href;}catch{}return null;};
 return (Array.isArray(value)?value:[]).slice(0,50).map(image=>({
  listing_image_id:/^\d+$/.test(String(image?.listing_image_id||''))?String(image.listing_image_id):null,
  rank:Number.isInteger(image?.rank)&&image.rank>0?image.rank:null,
  url_fullxfull:safeURL(image?.url_fullxfull),url_570xN:safeURL(image?.url_570xN),
  full_width:Number.isInteger(image?.full_width)&&image.full_width>0?image.full_width:null,
  full_height:Number.isInteger(image?.full_height)&&image.full_height>0?image.full_height:null
 }));
}
function summarize(listings,receipts,now=Date.now()){
 const rows=receiptRows(receipts);
 return listings.map(l=>{
  const created=l.original_creation_timestamp||l.creation_timestamp,age=created?Math.max(0,Math.floor((now-created*1000)/86400000)):null;
  const eligible=rows.filter(r=>r.is_paid&&!r.is_canceled).map(r=>({stamp:(r.create_timestamp||r.creation_timestamp)*1000,transactions:r.transactions.filter(t=>String(t.listing_id)===String(l.listing_id))})).filter(r=>Number.isFinite(r.stamp));
  const periods=[30,60,90].map(days=>{
   const start=Math.max((created||0)*1000,now-days*86400000),period=eligible.filter(r=>r.stamp>=start&&r.stamp<=now),sales=period.flatMap(r=>r.transactions),currencies=new Set(sales.map(t=>t.price?.currency_code).filter(Boolean));
   const complete=sales.every(t=>t.price&&Number.isFinite(t.price.amount)&&Number.isFinite(t.price.divisor)&&t.price.divisor>0&&typeof t.price.currency_code==='string');
   return {days,orders:period.filter(r=>r.transactions.length).length,transactionLines:sales.length,quantity:sales.reduce((sum,t)=>sum+(Number(t.quantity)||0),0),revenue:complete&&currencies.size<=1?sales.reduce((sum,t)=>sum+t.price.amount/t.price.divisor*(Number(t.quantity)||0),0):null,currency:currencies.size===1?[...currencies][0]:null,revenueKind:'grossItemValue'};
  });
  const daily={},dailyMoney={},dailyOrders={},dailyLines={};let moneyComplete=true;
  for(const r of eligible){if(r.stamp>now||!r.transactions.length)continue;const day=new Date(r.stamp).toISOString().slice(0,10);dailyOrders[day]=(dailyOrders[day]||0)+1;dailyLines[day]=(dailyLines[day]||0)+r.transactions.length;
   for(const t of r.transactions){daily[day]=(daily[day]||0)+(Number(t.quantity)||0);const price=t.price;if(!price||!Number.isFinite(price.amount)||!Number.isFinite(price.divisor)||price.divisor<=0||!price.currency_code){moneyComplete=false;continue;}dailyMoney[day]??={};dailyMoney[day][price.currency_code]=(dailyMoney[day][price.currency_code]||0)+price.amount/price.divisor*(Number(t.quantity)||0);}
  }
  const images=listingImages(l.images),primaryImage=require('./public/pinterest-model').selectPrimaryImage(images),primary=images.find(image=>image.listing_image_id===primaryImage.imageId);
  return {dailyMoney,dailyOrders,dailyLines,moneyComplete,coverageBasis:'UTC',description:typeof l.description==='string'?l.description:null,tags:Array.isArray(l.tags)?l.tags:null,imageCount:Array.isArray(l.images)?l.images.length:null,imageIds:Array.isArray(l.images)?l.images.map(i=>String(i.listing_image_id||i.url_fullxfull||i.url_570xN||'')):null,images,primaryImage,listingType:typeof l.type==='string'?l.type:null,daily,id:l.listing_id,title:l.title,url:l.url||'https://www.etsy.com/listing/'+l.listing_id,state:l.state,created,age,price:l.price,image:primaryImage.status==='rank-1'?(primary?.url_570xN||primaryImage.url):null,periods,favorites:l.num_favorers??null};
 });
}
function bundleAnalysis(listings,receipts){
 const active=new Set(listings.map(l=>String(l.listing_id))),counts=new Map(),pairs=new Map();let baskets=0;
 for(const r of receiptRows(receipts)){if(!r.is_paid||r.is_canceled)continue;const ids=[...new Set((r.transactions||[]).filter(t=>Number(t.quantity)>0).map(t=>String(t.listing_id)).filter(id=>active.has(id)))].sort();if(!ids.length)continue;baskets++;for(const id of ids)counts.set(id,(counts.get(id)||0)+1);for(let a=0;a<ids.length;a++)for(let b=a+1;b<ids.length;b++){const key=ids[a]+':'+ids[b];pairs.set(key,(pairs.get(key)||0)+1);}}
 return {baskets,pairs:[...pairs].map(([key,count])=>{const ids=key.split(':');return {ids,count,leftBaskets:counts.get(ids[0]),rightBaskets:counts.get(ids[1]),label:count>=3?'Paket araştırmasına aday':'Veri yetersiz',share:baskets?count/baskets:null};}).sort((a,b)=>b.count-a.count)};
}
async function loadActive(shopId,requestPages=pages,request=api){
 const diagnostics=[];
 let listings;
 try{listings=await requestPages('/shops/'+shopId+'/listings?state=active&includes=Images');diagnostics.push({source:'Magaza ilanlari / active',count:listings.length});}
 catch(e){diagnostics.push({source:'Magaza ilanlari / active',error:e.message});}
 if(!listings?.length){
  try{const fallback=await requestPages('/shops/'+shopId+'/listings/active?includes=Images');diagnostics.push({source:'Aktif ilanlar',count:fallback.length});listings=fallback;}
  catch(e){diagnostics.push({source:'Aktif ilanlar',error:e.message});}
 }
 if(!listings)throw Error('Urun listesi alinamadi: '+diagnostics.map(d=>d.error).filter(Boolean).join(' / '));
 if(!listings.length){const shop=await request('/shops/'+shopId);const count=shop.listing_active_count??shop.results?.[0]?.listing_active_count;diagnostics.push({source:'Magaza aktif ilan sayisi',count:count??null});if(Number(count)>0)throw Error('Etsy magazada '+count+' aktif ilan bildiriyor ancak ilan listesi bos geldi. Bos yanit basarili sayilmadi.');}
 return {listings,diagnostics};
}
async function sync(){
 if(busy||retryUntil>Date.now())return;const ctx=context();busy=true;let stage='Mağaza';
 try{
  persist({...data,lastAttempt:new Date().toISOString()});
  const user=data.tokens?.access_token.split('.')[0];if(!/^\d+$/.test(user||''))throw Error('Etsy kullanıcı kimliği doğrulanamadı.');
  const shop=await api('/users/'+user+'/shops',ctx),id=String(shop.shop_id||shop.results?.[0]?.shop_id||'');if(!/^\d+$/.test(id))throw Error('Bu hesaba ait mağaza bulunamadı.');assertCurrent(ctx);
  const previous=data.snapshot?.shopId===id?data.snapshot:null;workspace().activateShop(id);persist({...data,shopId:id,shopName:shop.shop_name||shop.results?.[0]?.shop_name});
  stage='Ürünler';const {listings,diagnostics}=await loadActive(id,route=>pages(route,ctx),route=>api(route,ctx));assertCurrent(ctx);
  const updated=new Date().toISOString(),products=summarize(listings,[]).map(p=>({...p,periods:[],salesAvailable:false}));
  const observations=[...(previous?.observations||[]),...listingObservations(previous,products,updated)].slice(-100);
  const productSnapshot={shopId:id,updated,listingCount:listings.length,products,diagnostics,observations,salesUpdated:null,coverageBasis:'UTC'};
  workspace().capture(productSnapshot);persist({...data,snapshot:productSnapshot,lastProductsSuccess:updated});
  stage='Satışlar';const receipts=await pages('/shops/'+id+'/receipts?min_created='+Math.floor((Date.now()-90*86400000)/1000),ctx);
  for(const r of receipts)r.transactions=await pages('/shops/'+id+'/receipts/'+r.receipt_id+'/transactions',ctx);assertCurrent(ctx);
  const activeIds=new Set(listings.map(l=>String(l.listing_id))),inactive=new Map();
  for(const r of receipts)for(const t of r.transactions||[])if(!activeIds.has(String(t.listing_id))&&/^\d+$/.test(String(t.listing_id)))inactive.set(String(t.listing_id),{listing_id:t.listing_id,title:t.title||'İlan #'+t.listing_id,state:'inactive',price:t.price});
  const finalSnapshot={shopId:id,updated,listingCount:listings.length,receiptCount:receiptRows(receipts).length,transactionCount:receiptRows(receipts).reduce((sum,r)=>sum+r.transactions.length,0),bundles:bundleAnalysis(listings,receipts),observations,products:summarize(listings,receipts).map(p=>({...p,salesAvailable:true})),salesProducts:summarize([...inactive.values()],receipts).map(p=>({...p,salesAvailable:true})),diagnostics,salesUpdated:new Date().toISOString(),coverageBasis:'UTC',orderMeasuresAvailable:true};
  assertCurrent(ctx);workspace().capture(finalSnapshot);persist({...data,snapshot:finalSnapshot,lastSuccess:finalSnapshot.salesUpdated,error:null,lastErrorAt:null});
 }catch(e){if(e.code!=='STALE_ACCOUNT'&&ctx.generation===generation){try{persist({...data,error:stage+': '+e.message,lastErrorAt:new Date().toISOString()});}catch{data={...data,error:'Yerel kayıt yazılamadı; önceki dosya korundu. Disk alanını ve dosya izinlerini kontrol et.'};console.error('Etsy kontrolü kaydedilemedi; önceki dosya korundu.');}}}
 finally{if(ctx.generation===generation)busy=false;}
}
let marketBusy=false,marketQueued=false;
const watches=()=>workspace().status().research;
async function publicApi(route,ctx=context()){if(!ctx.key)throw Error('Önce yerel Etsy anahtarlarını kaydet.');return jsonFetch('https://openapi.etsy.com/v3/application'+route,{headers:{'x-api-key':ctx.key+':'+ctx.secret}},ctx);}
// Reuse the already implemented public active-listing sample. This is not a
// Marketplace Insights endpoint and never returns keyword search volume.
function createResearchSampler({request=publicApi,getContext=context,ensureCurrent=assertCurrent,clock=Date.now}={}){
 const cache=new Map(),pending=new Map(),ttl=10*60000;
 const copy=value=>structuredClone(value);
 return async function sample(query){
  if(typeof query!=='string'||/[\u0000-\u001f\u007f]/.test(query)||/https?:\/\//i.test(query))throw Error('Araştırma için bağlantı değil, 2–100 karakterlik arama ifadesi gir.');
  const target=market.normalizeTarget({kind:'keyword',query}),ctx=getContext();ensureCurrent(ctx);
  if(!ctx.key)throw Error('Önce yerel Etsy anahtarlarını kaydet.');
  const stamp=clock(),key=String(ctx.generation)+':'+ctx.key+':'+target.query;
  const saved=cache.get(key);if(saved&&stamp-saved.at<ttl&&stamp>=saved.at)return {...copy(saved.value),cached:true};
  if(pending.has(key)){const result=await pending.get(key);ensureCurrent(ctx);return copy(result);}
  const promise=(async()=>{
   let rawSampleSize=0;
   const {snapshot}=await market.observe(target,async route=>{
    const value=await request(route,ctx);ensureCurrent(ctx);
    if(!Array.isArray(value?.results))throw Error('Etsy ilan yanıtı beklenen biçimde değil.');
    rawSampleSize=value.results.length;return {...value,results:value.results.slice(0,100)};
   });ensureCurrent(ctx);
   const listings=[...new Map(snapshot.listings.filter(l=>/^\d{1,30}$/.test(l.id)).map(l=>[l.id,{
    ...l,title:l.title.slice(0,1000),shopId:l.shopId&&/^\d{1,30}$/.test(l.shopId)?l.shopId:null,
    type:typeof l.type==='string'?l.type.slice(0,40):null,
    price:Number.isFinite(l.price)&&l.price>=0?l.price:null,
    currency:typeof l.currency==='string'&&/^[A-Z]{3}$/.test(l.currency)?l.currency:null,
    created:Number.isFinite(l.created)&&l.created>0?l.created:null,
    image:typeof l.image==='string'?l.image.slice(0,2048):null
   }])).values()];
   const value={source:'etsy-public-api-sample',sourceDescription:'Etsy açık aktif ilan API örneklemi; Marketplace Insights veya arama hacmi değildir.',sourceUrl:'https://developers.etsy.com/documentation/reference/',
    query:target.query,acquiredAt:new Date(clock()).toISOString(),sort:'created-desc',sampleLimit:100,
    reportedListingCount:Number.isFinite(snapshot.reportedCount)&&snapshot.reportedCount>=0?snapshot.reportedCount:null,
    searchCount:null,period:null,region:null,language:null,sampled:listings.length,rawSampleSize,truncated:rawSampleSize>100,listings,cached:false};
   ensureCurrent(ctx);cache.set(key,{at:clock(),value:copy(value)});while(cache.size>100)cache.delete(cache.keys().next().value);return value;
  })();pending.set(key,promise);
  try{return copy(await promise);}finally{if(pending.get(key)===promise)pending.delete(key);}
 };
}
const researchSample=createResearchSampler();
async function syncMarket(force=false){
 if(marketBusy){marketQueued=true;return;}if(retryUntil>Date.now())return;marketBusy=true;const ctx=context(),shopId=workspace().status().activeShopId;
 try{for(const target of [...watches()]){
  assertCurrent(ctx);const last=target.history?.at(-1);if(last&&Date.now()-Date.parse(last.updated)<(force?10*60000:6*3600000))continue;if(target.retryAfter&&Date.now()<target.retryAfter)continue;
  const attemptedAt=new Date().toISOString();workspace().research(watches().map(w=>w.id===target.id?{...w,lastAttempt:attemptedAt}:w),shopId);
  try{const result=await market.observe(target,route=>publicApi(route,ctx));assertCurrent(ctx);workspace().research(watches().map(w=>w.id===target.id?{...w,shopId:result.shopId||w.shopId,history:[...(w.history||[]),result.snapshot].slice(-30),lastAttempt:attemptedAt,lastSuccess:result.snapshot.updated,error:null,retryAfter:null}:w),shopId);}
  catch(e){if(e.code==='STALE_ACCOUNT')throw e;assertCurrent(ctx);workspace().research(watches().map(w=>w.id===target.id?{...w,lastAttempt:attemptedAt,lastErrorAt:new Date().toISOString(),error:e.message,retryAfter:e.retryAt||Date.now()+3600000}:w),shopId);if(e.status===429)break;}
 }}catch(e){if(e.code!=='STALE_ACCOUNT')console.error('Pazar kontrolü kaydedilemedi; önceki kayıt korundu.');}
 finally{if(ctx.generation===generation){marketBusy=false;if(marketQueued){marketQueued=false;void syncMarket();}}}
}
function marketStatus(){return {busy:marketBusy,watches:watches().map(w=>{const current=w.history?.at(-1),previous=w.history?.at(-2);return {id:w.id,kind:w.kind,query:w.query,error:w.error,lastAttempt:w.lastAttempt||null,lastSuccess:w.lastSuccess||current?.updated||null,retryAfter:w.retryAfter||null,current:current||null,comparison:market.compare(previous,current),history:(w.history||[]).map(h=>({updated:h.updated,reportedCount:h.reportedCount,sampled:h.sampled}))};})};}
function status(){return {configured:!!data.key,connected:!!data.tokens,shop:data.shopName||null,shopId:data.shopId?String(data.shopId):null,busy,error:connectionError||data.error||null,lastAttempt:data.lastAttempt||null,lastSuccess:data.lastSuccess||data.snapshot?.salesUpdated||null,lastProductsSuccess:data.lastProductsSuccess||null,lastErrorAt:data.lastErrorAt||null,quota,retryAfter:retryUntil>Date.now()?retryUntil:null,snapshot:data.snapshot||null};}
async function refreshForPinterest(){
 if(!data.tokens||!data.shopId)throw Error('Önce Etsy mağazasını bağla ve ürünlerini eşitle.');
 if(busy)throw Object.assign(Error('Etsy eşitlemesi sürüyor; tamamlanınca paylaşım grubunu yeniden hazırla.'),{kind:'busy',status:409});
 const ctx=context(),id=String(data.shopId);busy=true;
 try{
  persist({...data,lastAttempt:new Date().toISOString()});
  const user=data.tokens.access_token.split('.')[0];if(!/^\d+$/.test(user))throw Error('Etsy kullanıcı kimliği doğrulanamadı.');
  const shop=await api('/users/'+user+'/shops',ctx),actual=String(shop.shop_id||shop.results?.[0]?.shop_id||'');assertCurrent(ctx);
  if(actual!==id||workspace().status().activeShopId!==id)throw Object.assign(Error('Etsy mağazası değişti; eski paylaşım grubu kullanılmadı.'),{kind:'stale',status:409});
  // Pinterest needs active metadata/images, not another 90-day sales import.
  const {listings,diagnostics}=await loadActive(id,route=>pages(route,ctx),route=>api(route,ctx));assertCurrent(ctx);
  if(workspace().status().activeShopId!==id)throw Object.assign(Error('Etsy mağazası değişti; eski paylaşım grubu kullanılmadı.'),{kind:'stale',status:409});
  const previous=data.snapshot?.shopId===id?data.snapshot:null,updated=new Date().toISOString();
  const metadata=summarize(listings,[]).map(p=>({...p,periods:[],salesAvailable:false}));
  const observations=[...(previous?.observations||[]),...listingObservations(previous,metadata,updated)].slice(-100);
  // Capture only product changes. Reusing old receipts as fresh history would
  // create false complete-day coverage; sales timestamps remain unchanged.
  workspace().capture({shopId:id,updated,products:metadata,observations,salesUpdated:null,coverageBasis:'UTC'});
  const old=new Map((previous?.products||[]).map(product=>[String(product.id),product]));
  const salesKeys=['periods','daily','dailyMoney','dailyOrders','dailyLines','moneyComplete','salesAvailable'];
  const products=metadata.map(product=>{const before=old.get(String(product.id));return before?{...product,...Object.fromEntries(salesKeys.filter(key=>before[key]!==undefined).map(key=>[key,before[key]]))}:product;});
  persist({...data,snapshot:{...previous,shopId:id,updated,products,observations,listingCount:listings.length,diagnostics,coverageBasis:'UTC'},lastProductsSuccess:updated});
  return {shopId:id,updated,products};
 }catch(error){
  if(error.code==='STALE_ACCOUNT'){error.kind='stale';error.status=409;}
  if(ctx.generation===generation){try{persist({...data,error:'Pinterest ürün kontrolü tamamlanamadı; önceki ürün ve satış kayıtları korundu.',lastErrorAt:new Date().toISOString()});}catch{}}
  throw error;
 }finally{if(ctx.generation===generation)busy=false;}
}
function accountChanged(){generation++;pending=null;refreshPending=null;busy=false;marketBusy=false;marketQueued=false;workspace().activateShop(null);}
async function handle(req,res,url){const respond=(code,value)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
 if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress)){respond(403,{error:'Yalnizca yerel bilgisayardan erisim.'});return;}
 if(!/^(localhost|127\.0\.0\.1):\d+$/.test(req.headers.host||'')){respond(403,{error:'Paneli localhost adresinden ac.'});return;}
 const expected='http://'+req.headers.host;
 if(req.method==='POST'&&req.headers.origin!==expected){respond(403,{error:'Yerel sayfadan islem yap.'});return;}
 try{
 if(url.pathname==='/api/etsy/research-sample'&&req.method==='GET'){
  // Browser embeds/navigation must not spend the locally configured API quota.
  // Headerless native clients and the panel's same-origin fetch remain supported.
  const origin=req.headers.origin,site=req.headers['sec-fetch-site'],mode=req.headers['sec-fetch-mode'];
  if((origin!==undefined&&origin!==expected)||(site!==undefined&&!['same-origin','none'].includes(site))||(mode!==undefined&&!['cors','same-origin'].includes(mode))){respond(403,{error:'İlan örneklemini yalnızca yerel panelden başlat.'});return;}
  if(url.searchParams.getAll('query').length!==1)throw Error('Bir araştırma ifadesi gerekiyor.');respond(200,await researchSample(url.searchParams.get('query')));return;
 }
 if(url.pathname==='/api/etsy/market-export'&&req.method==='GET'){respond(200,{exported:new Date().toISOString(),watches:watches()});return;}
 if(url.pathname==='/api/etsy/market'&&req.method==='GET'){respond(200,marketStatus());return;}
 if(url.pathname==='/api/etsy/market'&&req.method==='POST'){
 let body='';for await(const c of req){body+=c;if(body.length>4096)throw Error('Istek cok buyuk.');}const input=JSON.parse(body);
 if(input.action==='add'){const target=market.normalizeTarget(input);if(watches().length>=10)throw Error('En fazla 10 takip kaydi eklenebilir.');if(watches().some(w=>w.kind===target.kind&&w.query.toLowerCase()===target.query.toLowerCase()))throw Error('Bu takip zaten var.');workspace().research([...watches(),target]);void syncMarket();}
 else if(input.action==='remove')workspace().research(watches().filter(w=>w.id!==input.id));
 else if(input.action==='sync'){if(!data.key)throw Error('Yerel Etsy baglantisini once ayarla.');void syncMarket(true);}
 else throw Error('Gecersiz takip islemi.');respond(202,{ok:true});return;
 }
 if(url.pathname==='/api/etsy/status'&&req.method==='GET'){respond(200,status());return;}
 if(url.pathname==='/api/etsy/config'&&req.method==='POST'){let body='';for await(const c of req){body+=c;if(body.length>4096)throw Error('Istek cok buyuk.');}const c=JSON.parse(body);if(!/^[A-Za-z0-9]{5,200}$/.test(c.key)||!/^[A-Za-z0-9]{5,200}$/.test(c.secret))throw Error('Keystring ve Shared secret degerlerini kontrol et.');if(new URL(expected).hostname!=='localhost')throw Error('Baglanti icin http://localhost:3000 adresini kullan.');accountChanged();persist({key:c.key,secret:c.secret,callback:expected+'/oauth/callback'});respond(200,{ok:true});return;}
 if(url.pathname==='/api/etsy/connect'&&req.method==='POST'){if(!data.key)throw Error('Once anahtarlari yerel forma kaydet.');const verifier=crypto.randomBytes(32).toString('base64url');pending={verifier,state:crypto.randomBytes(24).toString('hex'),until:Date.now()+600000,generation};const q=new URLSearchParams({response_type:'code',client_id:data.key,redirect_uri:data.callback,scope:'listings_r shops_r transactions_r',state:pending.state,code_challenge:crypto.createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256'});respond(200,{url:'https://www.etsy.com/oauth/connect?'+q});return;}
 if(url.pathname==='/oauth/callback'&&req.method==='GET'){const p=pending;pending=null;if(!p||p.generation!==generation||p.until<Date.now()||url.searchParams.get('state')!==p.state)throw Error('Yetkilendirme suresi veya guvenlik kodu gecersiz. Yeniden baglan.');if(!url.searchParams.get('code'))throw Error('Etsy yetkilendirmesi tamamlanmadi.');const ctx=context();const tokens=await tokenRequest({grant_type:'authorization_code',client_id:data.key,redirect_uri:data.callback,code:url.searchParams.get('code'),code_verifier:p.verifier},ctx);assertCurrent(ctx);accountChanged();persist({...data,tokens,shopId:null,shopName:null,snapshot:null,lastAttempt:null,lastSuccess:null,lastProductsSuccess:null,error:null,expires:Date.now()+tokens.expires_in*1000});void sync();res.writeHead(303,{Location:'/'});res.end();return;}
 if(url.pathname==='/api/etsy/sync'&&req.method==='POST'){if(!data.tokens)throw Error('Once Etsy hesabini bagla.');if(retryUntil>Date.now()){const e=Error('Etsy istek sınırı için bekleniyor.');e.status=429;throw e;}void sync();respond(202,{ok:true});return;}
 respond(404,{error:'Bulunamadi'});
 }catch(e){respond(e.status||400,{error:e.message,retryAfter:e.retryAt||retryUntil||null});}
}
function canRestore(){return !busy&&!marketBusy;}
function restoreResearch(values){workspace().research(values);}
function start(){
 const store=workspace();try{if(!store.status().error){
  // Old connection snapshots have no trustworthy shop namespace: preserve them
  // as unassigned, never infer ownership from the currently connected account.
  if(data.snapshot){if(data.snapshot.shopId&&String(data.snapshot.shopId)===store.status().activeShopId)store.capture(data.snapshot);else if(!store.status().activeShopId&&!data.snapshot.shopId)store.capture(data.snapshot);}
  if(data.watches?.length&&!store.status().activeShopId&&!store.status().research.length)store.research(data.watches);
 }}catch{data={...data,error:'Son kayıt yerel geçmişe aktarılamadı; mevcut dosyalar korundu. Ayarlar’daki yedeği ve disk alanını kontrol et.'};console.error('Yerel geçmiş güncellenemedi; uygulama güvenli eski kayıtla açılıyor.');}
 if(data.tokens)void sync();if(data.key)void syncMarket();
 const marketTimer=setInterval(()=>{if(data.key)void syncMarket();},30*60000);marketTimer.unref();const timer=setInterval(()=>{if(data.tokens)void sync();},30*60000);timer.unref();
}
module.exports={handle,start,sync,syncMarket,status,summarize,listingImages,refreshForPinterest,loadActive,bundleAnalysis,canRestore,restoreResearch,retryAfterMillis,jsonFetch,researchSample,createResearchSampler};
