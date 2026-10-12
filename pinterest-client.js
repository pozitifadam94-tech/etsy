'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');

// Endpoint/scope/token contracts: Pinterest official OpenAPI v5.28.0.
// OAuth query names: official 2024 quickstart, current web docs unavailable.
const SCOPES=Object.freeze(['user_accounts:read','boards:read','boards:write','pins:read','pins:write']);
const API_HOSTS=Object.freeze({production:'https://api.pinterest.com/v5',sandbox:'https://api-sandbox.pinterest.com/v5'});
const KNOWN_FAILURES=new Set([400,401,403,404,409,422,429]);
const ID=/^\d{1,40}$/;
const clone=value=>JSON.parse(JSON.stringify(value));
const short=(value,max)=>typeof value==='string'?Array.from(value.replace(/[\u0000-\u001f\u007f]/g,' ')).slice(0,max).join(''):null;
function error(kind,message,extras={}){const result=new Error(message);Object.assign(result,{kind,requestDispatched:false,globalStop:['auth','scope','board','rate-limit'].includes(kind)},extras);return result;}
function retryAfterMillis(value,now=Date.now()){
 if(value===null||value===undefined||String(value).trim()==='')return 60000;
 const text=String(value).trim();
 if(/^\d+$/.test(text)){const millis=Number(text)*1000;return Number.isSafeInteger(millis)&&Number.isSafeInteger(now+millis)&&Math.abs(now+millis)<=8640000000000000?Math.max(1000,millis):60000;}
 const stamp=/[A-Za-z]/.test(text)?Date.parse(text):NaN;return Number.isFinite(stamp)?Math.max(1000,stamp-now):60000;
}
function numericId(value){return typeof value==='string'&&ID.test(value)?value:null;}
function redirectAddress(value){
 if(typeof value!=='string'||value.length>2048||/[\u0000-\u0020\u007f]/.test(value))throw error('item','Pinterest uygulama panelinde kayıtlı tam yönlendirme adresini gir.');
 let u;try{u=new URL(value);}catch{throw error('item','Pinterest yönlendirme adresi geçersiz.');}
 if(u.username||u.password||u.hash||u.search||!(u.protocol==='https:'||(u.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(u.hostname))))throw error('item','Yönlendirme için HTTPS veya yerel localhost HTTP adresi kullan; sorgu ve parça ekleme.');
 return u.href;
}
function safeAccount(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw error('unexpected','Pinterest hesap yanıtı okunamadı. Yeniden bağlan.');
 const account={id:numericId(raw.id),username:short(raw.username,200),account_type:['PINNER','BUSINESS'].includes(raw.account_type)?raw.account_type:'unknown'};
 if(!account.id&&!account.username)throw error('unexpected','Pinterest hesap kimliği yanıt içinde bulunamadı. Yeniden bağlan.');
 return account;
}
function safeBoard(raw){
 if(!raw||typeof raw!=='object'||!numericId(raw.id))throw error('unexpected','Pinterest pano yanıtı beklenen biçimde değil.');
 return {id:raw.id,name:short(raw.name,200)||'Pano #'+raw.id,privacy:['PUBLIC','SECRET','PROTECTED'].includes(raw.privacy)?raw.privacy:'unknown'};
}
function safeUrl(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&u.href.length<=2048?u.href:null;}catch{return null;}}
function safeMedia(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;
 const media={media_type:short(raw.media_type,40)};
 if(raw.images&&typeof raw.images==='object'&&!Array.isArray(raw.images)){
  media.images={};for(const [key,item] of Object.entries(raw.images).slice(0,12))if(/^[a-zA-Z0-9_-]{1,40}$/.test(key)&&item&&typeof item==='object')media.images[key]={width:Number.isInteger(item.width)&&item.width>0?item.width:null,height:Number.isInteger(item.height)&&item.height>0?item.height:null,url:safeUrl(item.url)};
 }
 return media;
}
function safePin(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||!numericId(raw.id)||!numericId(raw.board_id))throw error('unexpected','Pinterest pin yanıtı kesin sonuç vermedi; yeniden göndermeden önce kontrol et.');
 return {id:raw.id,board_id:raw.board_id,link:safeUrl(raw.link),title:short(raw.title,100),description:short(raw.description,800),media:safeMedia(raw.media),created_at:typeof raw.created_at==='string'&&Number.isFinite(Date.parse(raw.created_at))?new Date(raw.created_at).toISOString():null,is_owner:typeof raw.is_owner==='boolean'?raw.is_owner:null,url:'https://www.pinterest.com/pin/'+raw.id+'/'};
}
function atomicWrite(file,value){
 const temp=file+'.'+crypto.randomBytes(8).toString('hex')+'.tmp';let fd;
 try{fd=fs.openSync(temp,'wx',0o600);fs.writeFileSync(fd,JSON.stringify(value));fs.fsyncSync(fd);fs.closeSync(fd);fd=undefined;fs.renameSync(temp,file);}
 catch{if(fd!==undefined)try{fs.closeSync(fd);}catch{}try{fs.unlinkSync(temp);}catch{}throw error('unexpected','Pinterest bağlantısı güvenli yerel dosyaya kaydedilemedi. Disk alanını ve izinleri kontrol et.');}
}
function tokenValue(value){return typeof value==='string'&&value.length>0&&value.length<=16384&&!/[\u0000-\u0020\u007f]/.test(value);}
function tokenSet(raw,now,previous){
 const expiresAt=now+raw?.expires_in*1000;
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||!tokenValue(raw.access_token)||!Number.isSafeInteger(raw.expires_in)||raw.expires_in<=0||!Number.isSafeInteger(expiresAt)||Math.abs(expiresAt)>8640000000000000||typeof raw.token_type!=='string'||raw.token_type.toLowerCase()!=='bearer')throw error('auth','Pinterest token yanıtı geçersiz. Yeniden bağlan.');
 const scopes=typeof raw.scope==='string'?[...new Set(raw.scope.split(/[\s,]+/).filter(Boolean))]:previous?.scopes||[];
 if(scopes.length>64||scopes.some(scope=>scope.length>100||!/^[a-z_]+:[a-z_]+$/.test(scope)))throw error('auth','Pinterest token izin yanıtı geçersiz. Yeniden bağlan.');
 const refreshToken=tokenValue(raw.refresh_token)?raw.refresh_token:previous?.refresh_token||null;
 let refreshExpiresAt=previous?.refreshExpiresAt||null;
 if(raw.refresh_token_expires_at!==undefined&&raw.refresh_token_expires_at!==null){if(!Number.isSafeInteger(raw.refresh_token_expires_at)||raw.refresh_token_expires_at<=0)throw error('auth','Pinterest yenileme token süresi geçersiz. Yeniden bağlan.');refreshExpiresAt=raw.refresh_token_expires_at*1000;}
 else if(raw.refresh_token_expires_in!==undefined&&raw.refresh_token_expires_in!==null){if(!Number.isSafeInteger(raw.refresh_token_expires_in)||raw.refresh_token_expires_in<=0)throw error('auth','Pinterest yenileme token süresi geçersiz. Yeniden bağlan.');refreshExpiresAt=now+raw.refresh_token_expires_in*1000;}
 if(refreshExpiresAt!==null&&(!Number.isSafeInteger(refreshExpiresAt)||Math.abs(refreshExpiresAt)>8640000000000000))throw error('auth','Pinterest yenileme token süresi geçersiz. Yeniden bağlan.');
 return {access_token:raw.access_token,refresh_token:refreshToken,expiresAt,refreshExpiresAt,scopes};
}
function empty(){return {schema:1,generation:0,config:null,tokens:null,account:null,board:null,access:{tier:'unknown',source:'unknown',accountId:null,standardApprovalConfirmed:false},retryUntil:0,authBlocked:false,permissionBlocked:null,lastError:null};}
function loadRecord(raw){
 if(!raw||raw.schema!==1||!Number.isSafeInteger(raw.generation)||raw.generation<0)throw Error('Invalid private record');
 const value=empty();value.generation=raw.generation;
 if(raw.config){
  if(!/^[A-Za-z0-9_-]{1,200}$/.test(raw.config.appId||'')||!tokenValue(raw.config.appSecret)||!['production','sandbox','dry-run'].includes(raw.config.environment))throw Error('Invalid config');
  value.config={appId:raw.config.appId,appSecret:raw.config.appSecret,redirectUri:redirectAddress(raw.config.redirectUri),environment:raw.config.environment};
 }
 if(raw.tokens){if(!tokenValue(raw.tokens.access_token)||!Number.isFinite(raw.tokens.expiresAt)||!Array.isArray(raw.tokens.scopes)||raw.tokens.scopes.some(s=>typeof s!=='string'||s.length>100)||raw.tokens.refresh_token!==null&&!tokenValue(raw.tokens.refresh_token))throw Error('Invalid tokens');value.tokens={access_token:raw.tokens.access_token,refresh_token:raw.tokens.refresh_token,expiresAt:raw.tokens.expiresAt,refreshExpiresAt:Number.isFinite(raw.tokens.refreshExpiresAt)?raw.tokens.refreshExpiresAt:null,scopes:[...new Set(raw.tokens.scopes)]};}
 if(raw.account)value.account=safeAccount(raw.account);
 if(raw.board)value.board=safeBoard(raw.board);
 if(raw.access&&['unknown','trial','standard'].includes(raw.access.tier))value.access={tier:raw.access.tier,source:['unknown','user-declared'].includes(raw.access.source)?raw.access.source:'unknown',accountId:numericId(raw.access.accountId),standardApprovalConfirmed:raw.access.standardApprovalConfirmed===true};
 value.retryUntil=Number.isFinite(raw.retryUntil)&&raw.retryUntil>0?raw.retryUntil:0;value.authBlocked=raw.authBlocked===true;
 value.permissionBlocked=['scope','board'].includes(raw.permissionBlocked)?raw.permissionBlocked:null;
 // Persist only application-authored messages, never arbitrary provider bodies.
 value.lastError=value.authBlocked?'Pinterest yetkisi geçersiz. Hesabı yeniden bağla.':value.permissionBlocked==='scope'?'Pinterest izinleri yeterli değil. Uygulama izinlerini kontrol edip yeniden bağla.':value.permissionBlocked==='board'?'Pinterest panosuna erişilemiyor. Başka bir mevcut pano seç.':null;
 return value;
}
function createClient({dir,fetchImpl=globalThis.fetch,clock=Date.now}={}){
 if(typeof dir!=='string'||!dir)throw Error('Pinterest data directory required');
 const file=path.join(dir,'pinterest-connection.json');const now=()=>Number(clock());
 let data=empty(),recordError=null,pending=null,refreshPending=null;
 try{if(fs.statSync(file).size>256*1024)throw Error('Oversized record');data=loadRecord(JSON.parse(fs.readFileSync(file,'utf8')));}catch(e){if(e.code!=='ENOENT')recordError='Pinterest bağlantı dosyası okunamıyor. Mevcut dosya korunuyor; bağlantıyı yeniden yapılandır.';}
 function persist(next,{recover=false}={}){
  if(recordError&&!recover)throw error('unexpected',recordError);
  fs.mkdirSync(dir,{recursive:true,mode:0o700});
  if(recordError&&recover){const copy=path.join(dir,'pinterest-connection-recovery-'+crypto.randomBytes(8).toString('hex')+'.json');try{const fd=fs.openSync(copy,'wx',0o600);try{fs.writeFileSync(fd,fs.readFileSync(file));fs.fsyncSync(fd);}finally{fs.closeSync(fd);}}catch{throw error('unexpected','Bozuk Pinterest bağlantı dosyası korunamadı; mevcut dosyaya dokunulmadı.');}}
  atomicWrite(file,next);data=next;recordError=null;
 }
 function snapshot(){return {generation:data.generation,appId:data.config?.appId,environment:data.config?.environment,redirectUri:data.config?.redirectUri};}
 function assertCurrent(ctx){if(ctx.generation!==data.generation||ctx.appId!==data.config?.appId||ctx.environment!==data.config?.environment||ctx.redirectUri!==data.config?.redirectUri)throw error('stale','Pinterest hedefi veya bağlantısı değişti. Grubu yeniden hazırla.',{status:409});}
 function blockReason(){
  if(recordError)return recordError;
  if(!data.config)return 'Pinterest uygulama kimliğini, gizli anahtarını ve kayıtlı yönlendirme adresini yapılandır.';
  if(!data.tokens||!data.account)return 'Önce Pinterest hesabını OAuth ile bağla.';
  if(data.authBlocked)return 'Pinterest yetkisi geçersiz. Hesabı yeniden bağla.';
  if(data.retryUntil>now())return 'Pinterest istek sınırı nedeniyle bekleniyor. Gösterilen süreden sonra tekrar dene.';
  if(data.permissionBlocked==='scope')return 'Pinterest izinleri yeterli değil. Uygulama izinlerini kontrol edip yeniden bağla.';
  if(data.permissionBlocked==='board')return 'Pinterest panosuna erişilemiyor. Başka bir mevcut pano seç.';
  if(!data.board)return 'Mevcut bir Pinterest hedef panosu seç.';
  if(data.board.privacy==='unknown')return 'Hedef panonun gizlilik bilgisi doğrulanamadı. Panoyu yeniden seç.';
  if(data.board.privacy==='SECRET'&&!['boards:read_secret','boards:write_secret','pins:read_secret','pins:write_secret'].every(s=>data.tokens.scopes.includes(s)))return 'Bu gizli pano için gerekli gizli pano ve pin izinleri yok. Açık/korumalı mevcut pano seç.';
  if(data.config.environment==='dry-run')return 'Dry-run ortamı dışarıya pin göndermez; kayıtları gerçek paylaşıma sayılmaz.';
  if(data.config.environment==='production'){
   if(!data.account.id)return 'Pinterest API sayısal hesap kimliği döndürmedi. Gerçek paylaşım için güvenli hesap eşleştirmesi yapılamıyor.';
   if(data.access.tier==='trial')return 'Trial erişimi gerçek paylaşım olarak kullanılamaz. Uygulama panelindeki canlı erişim onayını kontrol et.';
   if(data.access.tier!=='standard'||data.access.source!=='user-declared'||!data.access.standardApprovalConfirmed||data.access.accountId!==data.account.id)return 'Erişim türü doğrulanmadı. Pinterest uygulama panelinde Standard/canlı onayını kontrol edip kullanıcı beyanını kaydet.';
  }
  if(!SCOPES.every(s=>data.tokens.scopes.includes(s)))return 'Pinterest pin oluşturma izinleri eksik. Gerekli kapsamlarla hesabı yeniden bağla.';
  return null;
 }
 function context(){
  const reason=blockReason();return {shopId:null,accountId:data.account?.id||null,accountUsername:data.account?.username||null,boardId:data.board?.id||null,boardName:data.board?.name||null,boardPrivacy:data.board?.privacy||'unknown',environment:data.config?.environment||'production',tier:data.access.tier,tierSource:data.access.source,generation:data.generation,configured:!!data.config,connected:!!data.tokens&&!!data.account,scopes:[...(data.tokens?.scopes||[])],retryAt:data.retryUntil>now()?new Date(data.retryUntil).toISOString():null,accessReady:reason===null,blockReason:reason};
 }
 function status(){return {...context(),account:data.account?clone(data.account):null,board:data.board?clone(data.board):null,redirectUri:data.config?.redirectUri||null,callback:data.config?.redirectUri||null,oauthPending:!!pending&&pending.until>now(),oauthExpiresAt:pending&&pending.until>now()?new Date(pending.until).toISOString():null,oauthAuthorizationSource:'official-quickstart-2024-current-query-unverified',standardApprovalConfirmed:data.access.standardApprovalConfirmed&&data.access.accountId===data.account?.id,error:recordError||data.lastError,disconnectInstructions:'Yerel bağlantıyı kaldırmak Pinterest yetkisini iptal etmez. Pinterest hesap ayarlarından bu uygulamanın erişimini de kaldır.',apiVersion:'5.28.0'};}
 function configure(input={}){
  if(!/^[A-Za-z0-9_-]{1,200}$/.test(input.appId||'')||!tokenValue(input.appSecret)||input.appSecret.length>512)throw error('item','Pinterest App ID ve App secret değerlerini kontrol et.');
  const environment=input.environment||'production';if(!['production','sandbox','dry-run'].includes(environment))throw error('item','Pinterest ortamı geçersiz.');
  const next={...empty(),generation:data.generation+1,config:{appId:input.appId,appSecret:input.appSecret,redirectUri:redirectAddress(input.redirectUri),environment}};
  persist(next,{recover:true});pending=null;refreshPending=null;return status();
 }
 function host(ctx){return API_HOSTS[ctx.environment]||API_HOSTS.production;}
 function ensureWait(){if(data.retryUntil>now())throw error('rate-limit','Pinterest istek sınırı nedeniyle bekleniyor.',{status:429,retryAt:new Date(data.retryUntil).toISOString()});}
 function classifyHttp(status,route,{requestDispatched=false,ctx,token=false,response}={}){
  let kind='unexpected',message='Pinterest yanıtı işlemin sonucunu kesinleştirmedi. Yeniden göndermeden önce kontrol et.';
  if(token&&(status===400||status===401||status===403)){kind='auth';message='Pinterest yetkilendirmesi veya token yenilemesi reddedildi. Hesabı yeniden bağla.';}
  else if(status===401){kind='auth';message='Pinterest yetkisi geçersiz. Hesabı yeniden bağla.';}
  else if(status===403){kind='scope';message='Pinterest izinleri veya kaynak erişimi yeterli değil. Uygulama izinlerini kontrol et.';}
  else if(status===404){kind=route.startsWith('/boards/')||route==='/pins'?'board':'item';message=kind==='board'?'Pinterest panosuna erişilemiyor. Başka bir mevcut pano seç.':'Pinterest pini bulunamadı veya erişilemiyor.';}
  else if(status===429){kind='rate-limit';message='Pinterest istek sınırı nedeniyle gönderim durduruldu. Bekleyip tekrar dene.';}
  else if([400,409,422].includes(status)){kind='item';message='Pinterest bu pin verisini kabul etmedi. Ürünü ve görseli kontrol et.';}
  let retryAt=null;
  if(ctx){assertCurrent(ctx);let next=data;if(kind==='auth')next={...data,authBlocked:true,lastError:message};else if(kind==='scope'||kind==='board')next={...data,permissionBlocked:kind,lastError:message};else if(kind==='rate-limit'){const retryUntil=now()+retryAfterMillis(response?.headers?.get?.('retry-after'),now());next={...data,retryUntil,lastError:message};retryAt=new Date(retryUntil).toISOString();}if(next!==data)try{persist(next);}catch{/* The request's known classification survives an unavailable local status write. */}}
  return error(kind,message,{status,requestDispatched,uncertain:requestDispatched&&!KNOWN_FAILURES.has(status),...(retryAt?{retryAt}: {})});
 }
 async function request(route,options,ctx,{token=false,requestDispatched=false}={}){
  assertCurrent(ctx);ensureWait();let response;
  // The official OAuth security scheme fixes tokenUrl to the production host,
  // including when the selected content API environment is Sandbox.
  try{response=await fetchImpl((token?API_HOSTS.production:host(ctx))+route,{...options,redirect:'error',signal:AbortSignal.timeout(30000)});}catch{assertCurrent(ctx);throw error('network',requestDispatched?'Pinterest isteğinin sonucu belirsiz. Yeni POST göndermeden önce pinleri kontrol et.':'Pinterest bağlantısına ulaşılamadı. Bağlantıyı kontrol edip yeniden dene.',{requestDispatched,uncertain:requestDispatched});}
  assertCurrent(ctx);
  if(!response||!Number.isInteger(response.status))throw error('unexpected','Pinterest yanıtı okunamadı.',{requestDispatched,uncertain:requestDispatched});
  if(response.status<200||response.status>=300)throw classifyHttp(response.status,route,{requestDispatched,ctx,token,response});
  let value;try{value=await response.json();}catch{throw error('unexpected',requestDispatched?'Pinterest başarı yanıtı okunamadı; pin oluşmuş olabilir. Yeniden göndermeden önce kontrol et.':'Pinterest yanıtı okunamadı. İşlem tamamlanmadı.',{status:response.status,requestDispatched,uncertain:requestDispatched});}
  assertCurrent(ctx);return value;
 }
 async function tokenRequest(fields,ctx){
  const auth=Buffer.from(data.config.appId+':'+data.config.appSecret).toString('base64');
  return request('/oauth/token',{method:'POST',headers:{Authorization:'Basic '+auth,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({...fields,continuous_refresh:'true'}).toString()},ctx,{token:true});
 }
 async function access(ctx){
  assertCurrent(ctx);ensureWait();if(recordError)throw error('unexpected',recordError);if(!data.tokens||data.authBlocked)throw error('auth','Pinterest hesabını yeniden bağla.');
  if(data.tokens.expiresAt>now()+60000)return data.tokens.access_token;
  if(!data.tokens.refresh_token||data.tokens.refreshExpiresAt!==null&&data.tokens.refreshExpiresAt<=now()){persist({...data,authBlocked:true,lastError:'Pinterest yenileme yetkisi sona erdi. Hesabı yeniden bağla.'});throw error('auth','Pinterest yenileme yetkisi sona erdi. Hesabı yeniden bağla.');}
  if(!refreshPending||refreshPending.generation!==ctx.generation){
   const flight={generation:ctx.generation,promise:null};flight.promise=(async()=>{const raw=await tokenRequest({grant_type:'refresh_token',refresh_token:data.tokens.refresh_token},ctx);assertCurrent(ctx);let tokens;try{tokens=tokenSet(raw,now(),data.tokens);}catch{persist({...data,authBlocked:true,lastError:'Pinterest token yenileme yanıtı geçersiz. Hesabı yeniden bağla.'});throw error('auth','Pinterest token yenileme yanıtı geçersiz. Hesabı yeniden bağla.');}persist({...data,tokens,lastError:null});return tokens.access_token;})();refreshPending=flight;
   flight.promise.finally(()=>{if(refreshPending===flight)refreshPending=null;}).catch(()=>{});
  }
  const token=await refreshPending.promise;assertCurrent(ctx);return token;
 }
 async function api(route,ctx=snapshot()){
  const token=await access(ctx);return request(route,{method:'GET',headers:{Authorization:'Bearer '+token}},ctx);
 }
 function startOAuth(){
  if(recordError)throw error('unexpected',recordError);if(!data.config)throw error('auth','Önce Pinterest uygulama anahtarlarını ve kayıtlı yönlendirme adresini kaydet.');
  pending={state:crypto.randomBytes(32).toString('base64url'),until:now()+600000,...snapshot()};
  const q=new URLSearchParams({consumer_id:data.config.appId,redirect_uri:data.config.redirectUri,response_type:'code',refreshable:'true',scope:SCOPES.join(','),state:pending.state});
  return {url:'https://www.pinterest.com/oauth/?'+q};
 }
 async function completeOAuth(input={}){
  let {code,state}=input;let redirectUri=input.redirectUri;
  if(input.redirectUrl!==undefined){let u;try{u=new URL(input.redirectUrl);}catch{throw error('auth','Dönen OAuth adresi geçersiz.');}if(u.username||u.password||u.hash||u.searchParams.getAll('code').length!==1||u.searchParams.getAll('state').length!==1)throw error('auth','Dönen OAuth adresinde tek bir code ve state bulunmalı.');code=u.searchParams.get('code');state=u.searchParams.get('state');u.search='';redirectUri=u.href;}
  const p=pending;
  if(!p||p.until<=now()){pending=null;throw error('auth','Pinterest yetkilendirme süresi doldu. Bağlantıyı yeniden başlat.');}
  assertCurrent(p);
  if(typeof state!=='string'||!/^[-A-Za-z0-9_]+$/.test(state)||state.length!==p.state.length||!crypto.timingSafeEqual(Buffer.from(state),Buffer.from(p.state))||redirectUri!==undefined&&redirectUri!==p.redirectUri)throw error('auth','Pinterest güvenlik kodu veya yönlendirme adresi eşleşmedi. Bağlantıyı yeniden başlat.');
  if(typeof code!=='string'||!code||code.length>4096||/[\u0000-\u0020\u007f]/.test(code))throw error('auth','Pinterest yetkilendirme kodu eksik veya geçersiz.');
  pending=null;
  const raw=await tokenRequest({grant_type:'authorization_code',code,redirect_uri:p.redirectUri},p);assertCurrent(p);const tokens=tokenSet(raw,now());
  const profile=await request('/user_account',{method:'GET',headers:{Authorization:'Bearer '+tokens.access_token}},p);assertCurrent(p);const account=safeAccount(profile);
  persist({...data,generation:data.generation+1,tokens,account,board:null,access:empty().access,retryUntil:0,authBlocked:false,permissionBlocked:null,lastError:null});refreshPending=null;return status();
 }
 function disconnect(){persist({...empty(),generation:data.generation+1,config:data.config});pending=null;refreshPending=null;return {ok:true,localOnly:true,instructions:status().disconnectInstructions,status:status()};}
 function setAccess({tier='unknown',standardApprovalConfirmed=false}={}){
  if(!['unknown','trial','standard'].includes(tier))throw error('item','Pinterest erişim türü geçersiz.');
  if(!data.account||!data.tokens)throw error('auth','Erişim beyanından önce Pinterest hesabını bağla.');
  if(tier==='standard'&&(standardApprovalConfirmed!==true||!data.account.id))throw error('item','Standard beyanı için uygulama panelindeki canlı onayı açıkça doğrula; sayısal hesap kimliği de gerekli.');
  persist({...data,generation:data.generation+1,access:{tier,source:tier==='unknown'?'unknown':'user-declared',accountId:data.account.id,standardApprovalConfirmed:tier==='standard'&&standardApprovalConfirmed===true}});pending=null;return status();
 }
 async function boards(){
  const ctx=snapshot(),result=[],seen=new Set();let bookmark=null;
  for(let page=0;page<40;page++){
   const q=new URLSearchParams({page_size:'100',privacy:'ALL'});if(bookmark)q.set('bookmark',bookmark);
   const raw=await api('/boards?'+q,ctx);assertCurrent(ctx);
   if(!raw||!Array.isArray(raw.items)||raw.items.length>100)throw error('unexpected','Pinterest pano listesi beklenen biçimde değil.');
   for(const item of raw.items){const board=safeBoard(item);if(!result.some(b=>b.id===board.id))result.push(board);}
   if(raw.bookmark===null||raw.bookmark===undefined||raw.bookmark==='')return result;
   if(typeof raw.bookmark!=='string'||raw.bookmark.length>4096||seen.has(raw.bookmark))throw error('unexpected','Pinterest pano sayfalaması tekrarlandı veya geçersiz. Eksik liste kullanılmadı.');
   seen.add(raw.bookmark);bookmark=raw.bookmark;
  }
  throw error('unexpected','Pinterest pano sayfalama sınırı aşıldı. Eksik liste kullanılmadı.');
 }
 async function selectBoard(id){
  if(!numericId(id))throw error('board','Geçerli bir mevcut Pinterest panosu seç.');
  const ctx=snapshot(),available=await boards();assertCurrent(ctx);
  if(!available.some(b=>b.id===id))throw error('board','Bu pano bağlı hesabın erişilebilir mevcut panolarında yok.');
  const board=safeBoard(await api('/boards/'+id,ctx));assertCurrent(ctx);if(board.id!==id)throw error('board','Pinterest farklı bir pano döndürdü. Seçimi yenile.');
  persist({...data,generation:data.generation+1,board,permissionBlocked:data.permissionBlocked==='board'?null:data.permissionBlocked,lastError:data.permissionBlocked==='board'?null:data.lastError});pending=null;return status();
 }
 function assertExpected(expected){
  if(!expected||typeof expected!=='object'||expected.generation!==data.generation||expected.accountId!==(data.account?.id||null)||expected.boardId!==(data.board?.id||null)||expected.environment!==data.config?.environment)throw error('stale','Pinterest hesap/pano hedefi değişti. Grubu yeniden hazırla.',{status:409});
 }
 function ensureCreate(){const reason=blockReason();if(reason){const kind=data.authBlocked||!data.tokens?'auth':data.retryUntil>now()?'rate-limit':data.permissionBlocked||(!data.board||data.board.privacy==='unknown'?'board':'scope');throw error(kind,reason,{...(data.retryUntil>now()?{status:429,retryAt:new Date(data.retryUntil).toISOString()}: {})});}}
 function pinPayload(input){
  if(!input||typeof input!=='object'||input.board_id!==data.board?.id||!numericId(input.board_id))throw error('board','Gönderilecek pinin pano hedefi seçili panoyla eşleşmiyor.');
  for(const [key,max] of [['title',100],['description',800],['alt_text',500]])if((key!=='alt_text'||input[key]!==undefined)&&(typeof input[key]!=='string'||Array.from(input[key]).length>max||/[\u0000-\u001f\u007f]/.test(input[key])))throw error('item','Pin başlık/açıklama veya alt metni geçersiz.');
  if(typeof input.link!=='string'||!/^https:\/\/www\.etsy\.com\/listing\/\d{1,40}$/.test(input.link))throw error('item','Pin hedefi sayısal Etsy ilan bağlantısı olmalı.');
  const m=input.media_source;
  if(!m||m.source_type!=='image_base64'||!['image/jpeg','image/png'].includes(m.content_type)||typeof m.data!=='string'||!m.data||m.data.length>12*1024*1024||m.data.length%4!==0||!/^[A-Za-z0-9+/]+={0,2}$/.test(m.data))throw error('item','Pin için özgün JPEG/PNG görselinin geçerli Base64 verisi gerekli.');
  return {board_id:input.board_id,title:input.title,description:input.description,link:input.link,...(input.alt_text!==undefined?{alt_text:input.alt_text}:{}),media_source:{source_type:'image_base64',content_type:m.content_type,data:m.data}};
 }
 async function createPin(input,{expectedContext,onDispatch}={}){
  assertExpected(expectedContext);ensureCreate();const ctx=snapshot(),payload=pinPayload(input);
  const token=await access(ctx);assertCurrent(ctx);assertExpected(expectedContext);ensureCreate();
  const current=safeBoard(await request('/boards/'+payload.board_id,{method:'GET',headers:{Authorization:'Bearer '+token}},ctx));assertCurrent(ctx);assertExpected(expectedContext);
  if(current.id!==payload.board_id)throw error('board','Pinterest pano yanıtı hedefle eşleşmiyor.');
  if(current.privacy!==data.board.privacy){persist({...data,generation:data.generation+1,board:current});throw error('stale','Pinterest pano gizliliği değişti. Hedefi kontrol edip grubu yeniden hazırla.',{status:409});}
  ensureCreate();if(onDispatch!==undefined){if(typeof onDispatch!=='function')throw error('unexpected','Gönderim kaydı geri çağrısı geçersiz.');try{await onDispatch();}catch{throw error('unexpected','Gönderim öncesi kalıcı kayıt yazılamadı; pin gönderilmedi.');}}
  assertCurrent(ctx);assertExpected(expectedContext);ensureCreate();
  let raw;try{raw=await request('/pins',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(payload)},ctx,{requestDispatched:true});}
  catch(e){if(e.kind==='stale'){e.requestDispatched=true;e.uncertain=true;}throw e;}
  let pin;try{pin=safePin(raw);}catch{throw error('unexpected','Pinterest başarı yanıtı geçerli pin kimliği içermiyor; pin oluşmuş olabilir. Yeniden göndermeden önce kontrol et.',{requestDispatched:true,uncertain:true});}
  if(pin.board_id!==payload.board_id||pin.link!==payload.link)throw error('unexpected','Pinterest başarı yanıtının pano veya Etsy hedefi eşleşmedi; yeniden göndermeden önce kontrol et.',{requestDispatched:true,uncertain:true});
  return pin;
 }
 async function getPin(id){if(!numericId(id))throw error('item','Geçerli Pinterest pin kimliği gerekli.');return safePin(await api('/pins/'+id));}
 async function boardPins(boardId,{bookmark=null}={}){
  if(!numericId(boardId)||typeof bookmark!=='string'&&bookmark!==null||bookmark&&bookmark.length>4096)throw error('item','Pano veya sayfalama kimliği geçersiz.');
  const q=new URLSearchParams({page_size:'100'});if(bookmark)q.set('bookmark',bookmark);
  const raw=await api('/boards/'+boardId+'/pins?'+q);if(!raw||!Array.isArray(raw.items)||raw.items.length>100||raw.bookmark!==undefined&&raw.bookmark!==null&&typeof raw.bookmark!=='string'||typeof raw.bookmark==='string'&&raw.bookmark.length>4096)throw error('unexpected','Pinterest pin listesi okunamadı.');
  return {items:raw.items.map(safePin),bookmark:raw.bookmark||null};
 }
 return {status,context,configure,startOAuth,completeOAuth,disconnect,setAccess,boards,selectBoard,getPin,boardPins,createPin};
}
module.exports={createClient,SCOPES,API_HOSTS,retryAfterMillis};
