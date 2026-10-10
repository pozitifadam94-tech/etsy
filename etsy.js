const {listingObservations}=require('./observations');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const crypto=require('node:crypto');
const market=require('./market');
const {workspace}=require('./workspace');
const dir=process.env.STL_DATA_DIR||path.join(process.env.LOCALAPPDATA||os.homedir(),'STLNicheLab');
const file=path.join(dir,'connection.json');
let data={};try{data=JSON.parse(fs.readFileSync(file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw Error('Yerel baglanti dosyasi okunamiyor. Dosyayi silmeden once yedekle.');}
let pending=null,busy=false;
function persist(next){const watchesChanged=JSON.stringify(next.watches||[])!==JSON.stringify(data.watches||[]);fs.mkdirSync(dir,{recursive:true,mode:0o700});const tmp=file+'.tmp';fs.writeFileSync(tmp,JSON.stringify(next),{mode:0o600});fs.renameSync(tmp,file);data=next;if(watchesChanged){const store=workspace();if(!store.status().error)store.research(next.watches||[]);}}
async function jsonFetch(url,options={}){const r=await fetch(url,{...options,signal:AbortSignal.timeout(30000)});if(!r.ok){const error=new Error(r.status===429?'Etsy istek siniri: daha sonra tekrar dene.':`Etsy erisim hatasi (${r.status}). Uygulama izinlerini ve baglantiyi kontrol et.`);error.status=r.status;throw error;}return r.json();}
async function tokenRequest(body){return jsonFetch('https://api.etsy.com/v3/public/oauth/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(body)});}
async function access(){if(!data.tokens)throw Error('Once Etsy hesabini bagla.');if(data.expires>Date.now()+60000)return data.tokens.access_token;const tokens=await tokenRequest({grant_type:'refresh_token',client_id:data.key,refresh_token:data.tokens.refresh_token});persist({...data,tokens:{...data.tokens,...tokens},expires:Date.now()+tokens.expires_in*1000});return tokens.access_token;}
async function api(route){const token=await access();return jsonFetch('https://openapi.etsy.com/v3/application'+route,{headers:{'x-api-key':data.key+':'+data.secret,Authorization:'Bearer '+token}});}
async function pages(route){const all=[];for(let offset=0;offset<100000;offset+=100){const r=await api(route+(route.includes('?')?'&':'?')+'limit=100&offset='+offset);if(!Array.isArray(r.results))throw Error('Beklenmeyen Etsy yaniti.');all.push(...r.results);if(r.results.length<100||(Number.isFinite(r.count)&&all.length>=r.count))return all;}throw Error('Etsy sayfalama siniri asildi; eksik veri kaydedilmedi.');}
function summarize(listings,receipts,now=Date.now()){
 return listings.map(l=>{const created=l.original_creation_timestamp||l.creation_timestamp;const age=created?Math.max(0,Math.floor((now-created*1000)/86400000)):null;const periods=[30,60,90].map(days=>{const start=Math.max((created||0)*1000,now-days*86400000);const sales=receipts.filter(r=>r.is_paid&&!r.is_canceled&&(r.create_timestamp||r.creation_timestamp)*1000>=start).flatMap(r=>r.transactions||[]).filter(t=>t.listing_id===l.listing_id);const currencies=new Set(sales.map(t=>t.price?.currency_code).filter(Boolean));return {days,orders:sales.length,quantity:sales.reduce((s,t)=>s+(t.quantity||0),0),revenue:currencies.size<=1?sales.reduce((s,t)=>s+(t.price?.amount||0)/(t.price?.divisor||100)*(t.quantity||0),0):null,currency:currencies.size===1?[...currencies][0]:null};});const daily={},dailyMoney={};let moneyComplete=true;for(const r of receipts){if(!r.is_paid||r.is_canceled)continue;const stamp=(r.create_timestamp||r.creation_timestamp)*1000;if(!Number.isFinite(stamp))continue;const day=new Date(stamp).toISOString().slice(0,10);for(const t of r.transactions||[]){if(t.listing_id!==l.listing_id)continue;daily[day]=(daily[day]||0)+(t.quantity||0);const price=t.price;if(!price||!Number.isFinite(price.amount)||!Number.isFinite(price.divisor)||price.divisor<=0||!price.currency_code){moneyComplete=false;continue;}dailyMoney[day]??={};dailyMoney[day][price.currency_code]=(dailyMoney[day][price.currency_code]||0)+price.amount/price.divisor*(t.quantity||0);}}return {dailyMoney,moneyComplete,description:typeof l.description==='string'?l.description:null,tags:Array.isArray(l.tags)?l.tags:null,imageCount:Array.isArray(l.images)?l.images.length:null,imageIds:Array.isArray(l.images)?l.images.map(i=>String(i.listing_image_id||i.url_fullxfull||i.url_570xN||'')):null,listingType:typeof l.type==='string'?l.type:null,daily,id:l.listing_id,title:l.title,url:l.url||'https://www.etsy.com/listing/'+l.listing_id,state:l.state,created,age,price:l.price,image:l.images?.[0]?.url_570xN||l.images?.[0]?.url_fullxfull||null,periods,favorites:l.num_favorers??null};});
}
function bundleAnalysis(listings,receipts){
 const active=new Set(listings.map(l=>String(l.listing_id))),counts=new Map(),pairs=new Map();let baskets=0;
 for(const r of receipts){if(!r.is_paid||r.is_canceled)continue;const ids=[...new Set((r.transactions||[]).filter(t=>Number(t.quantity)>0).map(t=>String(t.listing_id)).filter(id=>active.has(id)))].sort();if(!ids.length)continue;baskets++;for(const id of ids)counts.set(id,(counts.get(id)||0)+1);for(let a=0;a<ids.length;a++)for(let b=a+1;b<ids.length;b++){const key=ids[a]+':'+ids[b];pairs.set(key,(pairs.get(key)||0)+1);}}
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
 if(busy)return;busy=true;let stage='Magaza';
 try{
  const user=data.tokens?.access_token.split('.')[0];if(!/^\d+$/.test(user||''))throw Error('Etsy kullanici kimligi dogrulanamadi.');
  const shop=await api('/users/'+user+'/shops');const id=shop.shop_id||shop.results?.[0]?.shop_id;
  if(!id)throw Error('Bu hesaba ait magaza bulunamadi.');
  persist({...data,shopId:id,shopName:shop.shop_name||shop.results?.[0]?.shop_name});
  stage='Urunler';const {listings,diagnostics}=await loadActive(id);
  const updated=new Date().toISOString();
  // Product visibility must not depend on whether sales access succeeds.
  const products=summarize(listings,[]).map(p=>({...p,periods:[],salesAvailable:false}));
  const observations=[...(data.snapshot?.observations||[]),...listingObservations(data.snapshot,products,updated)].slice(-100);
  persist({...data,snapshot:{updated,listingCount:listings.length,products,diagnostics,observations,salesUpdated:null},error:null});
  workspace().capture(data.snapshot);
  stage='Satislar';const receipts=await pages('/shops/'+id+'/receipts?min_created='+Math.floor((Date.now()-90*86400000)/1000));
  for(const r of receipts)r.transactions=await pages('/shops/'+id+'/receipts/'+r.receipt_id+'/transactions');
  const activeIds=new Set(listings.map(l=>String(l.listing_id))),inactive=new Map();
  for(const r of receipts)for(const t of r.transactions||[])if(!activeIds.has(String(t.listing_id))&&/^\d+$/.test(String(t.listing_id)))inactive.set(String(t.listing_id),{listing_id:t.listing_id,title:t.title||'İlan #'+t.listing_id,state:'inactive',price:t.price});
  persist({...data,snapshot:{updated,listingCount:listings.length,receiptCount:receipts.length,transactionCount:receipts.reduce((s,r)=>s+(r.transactions?.length||0),0),bundles:bundleAnalysis(listings,receipts),observations,products:summarize(listings,receipts).map(p=>({...p,salesAvailable:true})),salesProducts:summarize([...inactive.values()],receipts).map(p=>({...p,salesAvailable:true})),diagnostics,salesUpdated:new Date().toISOString()},error:null});
  workspace().capture(data.snapshot);
 }catch(e){persist({...data,error:stage+': '+e.message});}finally{busy=false;}
}
let marketBusy=false,marketQueued=false;
async function publicApi(route){if(!data.key)throw Error('Once yerel Etsy anahtarlarini kaydet.');return jsonFetch('https://openapi.etsy.com/v3/application'+route,{headers:{'x-api-key':data.key+':'+data.secret}});}
async function syncMarket(force=false){
 if(marketBusy){marketQueued=true;return;}marketBusy=true;
 try{for(const target of [...(data.watches||[])]){
 const last=target.history?.at(-1);if(last&&Date.now()-Date.parse(last.updated)<(force?10*60000:6*3600000))continue;
 if(target.retryAfter&&Date.now()<target.retryAfter)continue;
 try{const result=await market.observe(target,publicApi);persist({...data,watches:(data.watches||[]).map(w=>w.id===target.id?{...w,shopId:result.shopId||w.shopId,history:[...(w.history||[]),result.snapshot].slice(-30),error:null,retryAfter:null}:w)});}
 catch(e){persist({...data,watches:(data.watches||[]).map(w=>w.id===target.id?{...w,error:e.message,retryAfter:Date.now()+(e.status===429?6*3600000:3600000)}:w)});if(e.status===429)break;}
 }}finally{marketBusy=false;if(marketQueued){marketQueued=false;void syncMarket();}}
}
function marketStatus(){return {busy:marketBusy,watches:(data.watches||[]).map(w=>{const current=w.history?.at(-1),previous=w.history?.at(-2);return {id:w.id,kind:w.kind,query:w.query,error:w.error,retryAfter:w.retryAfter||null,current:current||null,comparison:market.compare(previous,current),history:(w.history||[]).map(h=>({updated:h.updated,reportedCount:h.reportedCount,sampled:h.sampled}))};})};}
function status(){return {configured:!!data.key,connected:!!data.tokens,shop:data.shopName||null,busy,error:data.error||null,snapshot:data.snapshot||null};}
async function handle(req,res,url){const respond=(code,value)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
 if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress)){respond(403,{error:'Yalnizca yerel bilgisayardan erisim.'});return;}
 if(!/^(localhost|127\.0\.0\.1):\d+$/.test(req.headers.host||'')){respond(403,{error:'Paneli localhost adresinden ac.'});return;}
 const expected='http://'+req.headers.host;
 if(req.method==='POST'&&req.headers.origin!==expected){respond(403,{error:'Yerel sayfadan islem yap.'});return;}
 try{
 if(url.pathname==='/api/etsy/market-export'&&req.method==='GET'){respond(200,{exported:new Date().toISOString(),watches:data.watches||[]});return;}
 if(url.pathname==='/api/etsy/market'&&req.method==='GET'){respond(200,marketStatus());return;}
 if(url.pathname==='/api/etsy/market'&&req.method==='POST'){
 let body='';for await(const c of req){body+=c;if(body.length>4096)throw Error('Istek cok buyuk.');}const input=JSON.parse(body);
 if(input.action==='add'){const target=market.normalizeTarget(input);if((data.watches||[]).length>=10)throw Error('En fazla 10 takip kaydi eklenebilir.');if((data.watches||[]).some(w=>w.kind===target.kind&&w.query.toLowerCase()===target.query.toLowerCase()))throw Error('Bu takip zaten var.');persist({...data,watches:[...(data.watches||[]),target]});void syncMarket();}
 else if(input.action==='remove')persist({...data,watches:(data.watches||[]).filter(w=>w.id!==input.id)});
 else if(input.action==='sync'){if(!data.key)throw Error('Yerel Etsy baglantisini once ayarla.');void syncMarket(true);}
 else throw Error('Gecersiz takip islemi.');respond(202,{ok:true});return;
 }
 if(url.pathname==='/api/etsy/status'&&req.method==='GET'){respond(200,status());return;}
 if(url.pathname==='/api/etsy/config'&&req.method==='POST'){let body='';for await(const c of req){body+=c;if(body.length>4096)throw Error('Istek cok buyuk.');}const c=JSON.parse(body);if(!/^[A-Za-z0-9]{5,200}$/.test(c.key)||!/^[A-Za-z0-9]{5,200}$/.test(c.secret))throw Error('Keystring ve Shared secret degerlerini kontrol et.');if(new URL(expected).hostname!=='localhost')throw Error('Baglanti icin http://localhost:3000 adresini kullan.');persist({key:c.key,secret:c.secret,callback:expected+'/oauth/callback',watches:data.watches||[]});respond(200,{ok:true});return;}
 if(url.pathname==='/api/etsy/connect'&&req.method==='POST'){if(!data.key)throw Error('Once anahtarlari yerel forma kaydet.');const verifier=crypto.randomBytes(32).toString('base64url');pending={verifier,state:crypto.randomBytes(24).toString('hex'),until:Date.now()+600000};const q=new URLSearchParams({response_type:'code',client_id:data.key,redirect_uri:data.callback,scope:'listings_r shops_r transactions_r',state:pending.state,code_challenge:crypto.createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256'});respond(200,{url:'https://www.etsy.com/oauth/connect?'+q});return;}
 if(url.pathname==='/oauth/callback'&&req.method==='GET'){const p=pending;pending=null;if(!p||p.until<Date.now()||url.searchParams.get('state')!==p.state)throw Error('Yetkilendirme suresi veya guvenlik kodu gecersiz. Yeniden baglan.');if(!url.searchParams.get('code'))throw Error('Etsy yetkilendirmesi tamamlanmadi.');const tokens=await tokenRequest({grant_type:'authorization_code',client_id:data.key,redirect_uri:data.callback,code:url.searchParams.get('code'),code_verifier:p.verifier});persist({...data,tokens,expires:Date.now()+tokens.expires_in*1000});void sync();res.writeHead(303,{Location:'/'});res.end();return;}
 if(url.pathname==='/api/etsy/sync'&&req.method==='POST'){if(!data.tokens)throw Error('Once Etsy hesabini bagla.');void sync();respond(202,{ok:true});return;}
 respond(404,{error:'Bulunamadi'});
 }catch(e){respond(400,{error:e.message});}
}
function canRestore(){return !busy&&!marketBusy;}
function restoreResearch(watches){persist({...data,watches});}
function start(){const store=workspace();if(!store.status().error){if(data.snapshot)store.capture(data.snapshot);if(data.watches?.length)store.research(data.watches);}if(data.tokens)void sync();if(data.key)void syncMarket();const marketTimer=setInterval(()=>{if(data.key)void syncMarket();},30*60000);marketTimer.unref();const timer=setInterval(()=>{if(data.tokens)void sync();},30*60000);timer.unref();}
module.exports={handle,start,summarize,loadActive,bundleAnalysis,canRestore,restoreResearch};
