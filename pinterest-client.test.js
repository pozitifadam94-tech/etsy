'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {createClient,SCOPES,retryAfterMillis}=require('./pinterest-client');
const ACCOUNT={id:'1234567890123456789',username:'fixture_shop',account_type:'BUSINESS'};
const BOARD={id:'901',name:'Digital STL',privacy:'PUBLIC'};
const PIN={id:'801',board_id:'901',link:'https://www.etsy.com/listing/100',title:'Digital model',description:'Digital STL download. No physical item.',is_owner:true,created_at:'2026-10-12T12:00:00Z',media:{media_type:'image',images:{original:{url:'https://i.pinimg.com/fixture.jpg',width:1200,height:800}}}};
const TOKENS={access_token:'fixture-access-private',refresh_token:'fixture-refresh-private',token_type:'bearer',expires_in:3600,refresh_token_expires_in:60*86400,scope:SCOPES.join(',')};
const config={appId:'12345',appSecret:'fixture-app-secret',redirectUri:'http://localhost:3000/oauth/pinterest/callback'};
const payload={board_id:'901',title:PIN.title,description:PIN.description,link:PIN.link,media_source:{source_type:'image_base64',content_type:'image/jpeg',data:Buffer.from('fixture-original-image').toString('base64')}};
function response(body,status=200,headers={}){return new Response(typeof body==='string'?body:JSON.stringify(body),{status,headers:{'content-type':'application/json',...headers}});}
function fixture(t,overrides={}){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'stl-pinterest-client-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 let time=Date.parse('2026-10-12T12:00:00Z');const calls=[];
 const fixtureFetch=async(url,options={})=>{calls.push({url,options});const u=new URL(url);
  if(overrides.handle){const result=await overrides.handle(u,options,calls);if(result!==undefined)return result;}
  if(u.pathname==='/v5/oauth/token')return response(overrides.tokens||TOKENS);
  if(u.pathname==='/v5/user_account')return response(overrides.account||ACCOUNT);
  if(u.pathname==='/v5/boards')return response({items:overrides.boards||[BOARD],bookmark:null});
  if(u.pathname==='/v5/boards/901')return response(overrides.board||BOARD);
  if(u.pathname==='/v5/pins'&&options.method==='POST')return response(overrides.pin||PIN,201);
  if(u.pathname==='/v5/pins/801')return response(PIN);
  if(u.pathname==='/v5/boards/901/pins')return response({items:[PIN],bookmark:null});
  throw Error('Unmocked URL');
 };
 const make=()=>createClient({dir,fetchImpl:fixtureFetch,clock:()=>time});const client=make();
 return {client,dir,calls,make,advance:amount=>{time+=amount;},setTime:value=>{time=value;}};
}
async function connect(client,c={}){client.configure({...config,...c});const started=client.startOAuth();const u=new URL(started.url);await client.completeOAuth({code:'fixture-code',state:u.searchParams.get('state')});return u;}
async function ready(client,c={}){await connect(client,c);await client.selectBoard(BOARD.id);client.setAccess({tier:'standard',standardApprovalConfirmed:true});}
const posts=f=>f.calls.filter(c=>c.options.method==='POST'&&new URL(c.url).pathname==='/v5/pins');

test('Official OAuth hosts and minimum schema scopes, random pending state and no secret in public status',async t=>{
 const f=fixture(t);f.client.configure(config);const a=new URL(f.client.startOAuth().url),b=new URL(f.client.startOAuth().url);
 assert.equal(a.origin,'https://www.pinterest.com');assert.equal(a.pathname,'/oauth/');assert.equal(a.searchParams.get('consumer_id'),'12345');assert.equal(a.searchParams.has('client_id'),false);assert.equal(a.searchParams.get('refreshable'),'true');assert.deepEqual(a.searchParams.get('scope').split(','),SCOPES);assert.notEqual(a.searchParams.get('state'),b.searchParams.get('state'));
 await assert.rejects(f.client.completeOAuth({code:'fixture-code',state:a.searchParams.get('state')}),/eşleşmedi/);
 await f.client.completeOAuth({code:'fixture-code',state:b.searchParams.get('state')});
 const exchange=f.calls[0];assert.equal(exchange.url,'https://api.pinterest.com/v5/oauth/token');assert.equal(exchange.options.headers.Authorization,'Basic '+Buffer.from('12345:fixture-app-secret').toString('base64'));
 const params=new URLSearchParams(exchange.options.body);assert.equal(params.get('grant_type'),'authorization_code');assert.equal(params.get('continuous_refresh'),'true');assert.equal(params.get('redirect_uri'),config.redirectUri);
 assert.deepEqual(f.client.status().account,ACCOUNT);assert.equal(f.client.context().tier,'unknown');assert.equal(f.client.context().accessReady,false);assert.equal(f.client.context().tierSource,'unknown');
 const publicValue=JSON.stringify(f.client.status());for(const value of ['fixture-app-secret','fixture-access-private','fixture-refresh-private','fixture-code',b.searchParams.get('state')])assert.equal(publicValue.includes(value),false);
 assert.equal(fs.statSync(path.join(f.dir,'pinterest-connection.json')).mode&0o777,0o600);
 await assert.rejects(f.client.completeOAuth({code:'fixture-code',state:b.searchParams.get('state')}),/süresi/);
});

test('OAuth state expires in ten minutes and binds generation and configured redirect',async t=>{
 const f=fixture(t);f.client.configure(config);const a=new URL(f.client.startOAuth().url);f.advance(600000);
 await assert.rejects(f.client.completeOAuth({code:'fixture-code',state:a.searchParams.get('state')}),/süresi/);assert.equal(f.calls.length,0);
 const b=new URL(f.client.startOAuth().url);await assert.rejects(f.client.completeOAuth({code:'fixture-code',state:b.searchParams.get('state'),redirectUri:'https://example.com/other'}),/eşleşmedi/);
 await assert.rejects(f.client.completeOAuth({code:'fixture-code',state:'ü'.repeat(b.searchParams.get('state').length)}),/eşleşmedi/);
 f.client.configure({...config,environment:'sandbox'});await assert.rejects(f.client.completeOAuth({code:'fixture-code',state:b.searchParams.get('state')}),/süresi/);assert.equal(f.calls.length,0);
});

test('Approved HTTPS redirect can be completed manually without accepting a different redirect or duplicate state',async t=>{
 const f=fixture(t);const redirectUri='https://example.com/pinterest-approved';f.client.configure({...config,redirectUri});let u=new URL(f.client.startOAuth().url);const s=u.searchParams.get('state');
 await assert.rejects(f.client.completeOAuth({redirectUrl:'https://example.com/other?code=fixture-code&state='+s}),/eşleşmedi/);
 await assert.rejects(f.client.completeOAuth({redirectUrl:redirectUri+'?code=fixture-code&state='+s+'&state='+s}),/tek bir/);
 await f.client.completeOAuth({redirectUrl:redirectUri+'?code=fixture-code&state='+s});assert.equal(f.client.status().connected,true);
 assert.throws(()=>f.client.configure({...config,redirectUri:'http://example.com/callback'}),/HTTPS/);
 assert.throws(()=>f.client.configure({...config,redirectUri:'https://user:password@example.com/callback'}),/HTTPS/);
});

test('Changed configuration while OAuth exchange is pending cannot store stale tokens',async t=>{
 let release;let entered;const begun=new Promise(resolve=>{entered=resolve;});
 const f=fixture(t,{handle:async(u)=>{if(u.pathname==='/v5/oauth/token'){entered();await new Promise(resolve=>{release=resolve;});return response(TOKENS);}}});
 f.client.configure(config);const state=new URL(f.client.startOAuth().url).searchParams.get('state');const result=f.client.completeOAuth({code:'fixture-code',state});await begun;
 f.client.configure({...config,appId:'67890'});release();await assert.rejects(result,e=>e.kind==='stale');assert.equal(f.client.status().connected,false);assert.equal(f.client.status().account,null);
});

test('Numeric account identity is never invented; tier is account-bound user declaration',async t=>{
 const f=fixture(t,{account:{username:'fixture_without_id',account_type:'BUSINESS',access_tier:'standard'}});await connect(f.client);await f.client.selectBoard('901');assert.equal(f.client.context().accountId,null);assert.equal(f.client.context().tier,'unknown');assert.equal(f.client.context().accessReady,false);assert.match(f.client.context().blockReason,/sayısal hesap/);
 assert.throws(()=>f.client.setAccess({tier:'standard',standardApprovalConfirmed:true}),/sayısal hesap/);
 const g=fixture(t);await ready(g.client);assert.equal(g.client.context().accessReady,true);assert.equal(g.client.context().tierSource,'user-declared');const before=g.client.context().generation;
 await connect(g.client);assert.equal(g.client.context().tier,'unknown');assert.equal(g.client.context().tierSource,'unknown');assert.ok(g.client.context().generation>before);
});

test('Board list includes returned privacy, paginates safely and selection refetches an existing board',async t=>{
 const second={id:'902',name:'Secret fixture',privacy:'SECRET'},unknown={id:'903',name:'Unknown fixture'};
 const f=fixture(t,{handle:async(u)=>{if(u.pathname==='/v5/boards')return response(u.searchParams.has('bookmark')?{items:[second,unknown],bookmark:null}:{items:[BOARD],bookmark:'next-page'});if(u.pathname==='/v5/boards/902')return response(second);if(u.pathname==='/v5/boards/903')return response(unknown);}});
 await connect(f.client);assert.deepEqual(await f.client.boards(),[BOARD,second,{...unknown,privacy:'unknown'}]);assert.ok(f.calls.filter(c=>new URL(c.url).pathname==='/v5/boards').every(c=>new URL(c.url).searchParams.get('privacy')==='ALL'));
 await assert.rejects(f.client.selectBoard('bad'),/Geçerli/);
 await assert.rejects(f.client.selectBoard('999'),/erişilebilir/);
 await f.client.selectBoard('902');f.client.setAccess({tier:'standard',standardApprovalConfirmed:true});assert.equal(f.client.context().boardPrivacy,'SECRET');assert.match(f.client.context().blockReason,/gizli pano/);
 await f.client.selectBoard('903');assert.equal(f.client.context().boardPrivacy,'unknown');assert.match(f.client.context().blockReason,/gizlilik/);assert.equal(posts(f).length,0);
});

test('Repeated bookmark or too many pages fails instead of exposing an incomplete board list',async t=>{
 const f=fixture(t,{handle:async(u)=>u.pathname==='/v5/boards'?response({items:[BOARD],bookmark:'repeat'}):undefined});await connect(f.client);await assert.rejects(f.client.boards(),/sayfalaması/);
 let page=0;const g=fixture(t,{handle:async(u)=>u.pathname==='/v5/boards'?response({items:[BOARD],bookmark:'page-'+(++page)}):undefined});await connect(g.client);await assert.rejects(g.client.boards(),/sınırı/);assert.equal(page,40);
});

test('Standard declaration requires explicit approval and does not claim API-verified public visibility',async t=>{
 const f=fixture(t);await connect(f.client);await f.client.selectBoard('901');assert.throws(()=>f.client.setAccess({tier:'standard'}),/açıkça/);
 f.client.setAccess({tier:'trial'});await assert.rejects(f.client.createPin(payload,{expectedContext:f.client.context()}),/Trial/);assert.equal(posts(f).length,0);
 f.client.setAccess({tier:'standard',standardApprovalConfirmed:true});assert.equal(f.client.status().accessReady,true);assert.equal(f.client.status().tierSource,'user-declared');assert.equal(f.client.status().verified,undefined);
});

test('Original base64 JPEG pin is dispatched once after durable callback with Etsy link and no invented idempotency header',async t=>{
 const f=fixture(t);await ready(f.client);let durable=false;
 const pin=await f.client.createPin({...payload,deliveryFolderUrl:'https://drive.google.com/secret',customer:'private-customer'},{expectedContext:f.client.context(),onDispatch:async()=>{assert.equal(posts(f).length,0);durable=true;}});
 assert.equal(durable,true);assert.equal(pin.id,'801');assert.equal(pin.url,'https://www.pinterest.com/pin/801/');assert.equal(pin.is_owner,true);assert.equal(posts(f).length,1);
 const request=posts(f)[0];assert.deepEqual(JSON.parse(request.options.body),payload);assert.equal(request.options.headers.Authorization,'Bearer fixture-access-private');assert.equal(Object.keys(request.options.headers).some(k=>/idempotency/i.test(k)),false);assert.equal(request.options.redirect,'error');
});

test('Invalid link/image or stale pinned destination prevents POST; journal failure prevents dispatch',async t=>{
 const f=fixture(t);await ready(f.client);const target=f.client.context();
 await assert.rejects(f.client.createPin({...payload,link:'https://drive.google.com/secret'},{expectedContext:target}),e=>e.kind==='item'&&!e.requestDispatched);
 await assert.rejects(f.client.createPin({...payload,media_source:{source_type:'image_url',url:'https://i.etsystatic.com/a.jpg'}},{expectedContext:target}),e=>e.kind==='item'&&!e.requestDispatched);
 await assert.rejects(f.client.createPin(payload,{expectedContext:target,onDispatch:()=>{throw Error('fixture-secret-do-not-leak');}}),e=>!e.requestDispatched&&!e.message.includes('fixture-secret'));
 f.client.setAccess({tier:'standard',standardApprovalConfirmed:true});await assert.rejects(f.client.createPin(payload,{expectedContext:target}),e=>e.kind==='stale'&&!e.requestDispatched);assert.equal(posts(f).length,0);
});

test('Changing account in an awaited dispatch callback prevents POST',async t=>{
 const f=fixture(t);await ready(f.client);await assert.rejects(f.client.createPin(payload,{expectedContext:f.client.context(),onDispatch:async()=>{f.client.disconnect();}}),e=>e.kind==='stale'&&!e.requestDispatched);assert.equal(posts(f).length,0);
});

test('Changed board privacy detected at send time invalidates prepared context before POST',async t=>{
 let privacy='PUBLIC';const f=fixture(t,{handle:async(u)=>u.pathname==='/v5/boards/901'?response({...BOARD,privacy}):undefined});await ready(f.client);privacy='SECRET';
 await assert.rejects(f.client.createPin(payload,{expectedContext:f.client.context()}),e=>e.kind==='stale'&&!e.requestDispatched);assert.equal(f.client.context().boardPrivacy,'SECRET');assert.match(f.client.context().blockReason,/gizli pano/);assert.equal(posts(f).length,0);
});

test('Expired access token uses singleflight continuous refresh and safely stores rotated credentials',async t=>{
 let tokenCalls=0,release,entered;const begun=new Promise(resolve=>{entered=resolve;});
 const f=fixture(t,{handle:async(u,options)=>{if(u.pathname==='/v5/oauth/token'){tokenCalls++;if(tokenCalls===1)return response({...TOKENS,expires_in:70});entered();await new Promise(resolve=>{release=resolve;});const params=new URLSearchParams(options.body);assert.equal(params.get('grant_type'),'refresh_token');assert.equal(params.get('continuous_refresh'),'true');return response({...TOKENS,access_token:'fixture-rotated-access',refresh_token:'fixture-rotated-refresh'});}}});
 await connect(f.client);f.advance(20000);const one=f.client.boards(),two=f.client.boards();await begun;release();await Promise.all([one,two]);assert.equal(tokenCalls,2);
 const record=JSON.parse(fs.readFileSync(path.join(f.dir,'pinterest-connection.json'),'utf8'));assert.equal(record.tokens.access_token,'fixture-rotated-access');assert.equal(record.tokens.refresh_token,'fixture-rotated-refresh');assert.equal(JSON.stringify(f.client.status()).includes('fixture-rotated'),false);
});

test('Dispatch journal runs after token refresh and current permissions validation, immediately before the only POST',async t=>{
 for(const removedPermission of [false,true]){
  let tokenCalls=0,journaled=false;const order=[];
  const f=fixture(t,{handle:async(u,o)=>{
   if(u.pathname==='/v5/oauth/token'){tokenCalls++;if(tokenCalls===1)return response({...TOKENS,expires_in:70});order.push('refresh');return response({...TOKENS,access_token:'fixture-rotated-for-dispatch',scope:removedPermission?'boards:read':TOKENS.scope});}
   if(u.pathname==='/v5/pins'&&o.method==='POST'){order.push('post');assert.equal(journaled,true);assert.equal(o.headers.Authorization,'Bearer fixture-rotated-for-dispatch');}
  }});
  await ready(f.client);const expected=f.client.context();f.advance(20000);
  const operation=f.client.createPin(payload,{expectedContext:expected,onDispatch:async()=>{assert.equal(tokenCalls,2);assert.equal(posts(f).length,0);await Promise.resolve();journaled=true;order.push('journal');}});
  if(removedPermission){await assert.rejects(operation,e=>e.kind==='scope'&&!e.requestDispatched);assert.equal(journaled,false);assert.equal(posts(f).length,0);assert.deepEqual(order,['refresh']);}
  else{await operation;assert.deepEqual(order,['refresh','journal','post']);assert.equal(posts(f).length,1);}
 }
});

test('Malformed token responses fail with application-authored authentication errors and never expose provider details',async t=>{
 for(const invalid of [
  {token_type:42}, {expires_in:'3600'}, {expires_in:1e100},
  {refresh_token_expires_in:1e100}, {refresh_token_expires_at:-1},
  {scope:'fixture-access-private'}, {scope:'pins:'+ 'a'.repeat(101)}
 ]){
  const f=fixture(t,{tokens:{...TOKENS,...invalid}});f.client.configure(config);const state=new URL(f.client.startOAuth().url).searchParams.get('state');
  await assert.rejects(f.client.completeOAuth({code:'fixture-code',state}),e=>e.kind==='auth'&&!e.requestDispatched&&!e.message.includes('fixture-'));
  assert.equal(f.client.status().connected,false);assert.equal(f.calls.length,1);
 }
});

test('Context changed during refresh cannot receive stale credentials',async t=>{
 let calls=0,release,entered;const begun=new Promise(resolve=>{entered=resolve;});
 const f=fixture(t,{handle:async(u)=>{if(u.pathname==='/v5/oauth/token'){calls++;if(calls===1)return response({...TOKENS,expires_in:70});entered();await new Promise(resolve=>{release=resolve;});return response({...TOKENS,access_token:'stale-token'});}}});await connect(f.client);f.advance(20000);const result=f.client.boards();await begun;f.client.disconnect();release();await assert.rejects(result,e=>e.kind==='stale');assert.equal(f.client.status().connected,false);
});

test('Known provider failures are safely classified; network, malformed success and 5xx stay uncertain with no POST retries',async t=>{
 for(const [status,kind] of [[400,'item'],[401,'auth'],[403,'scope'],[404,'board'],[409,'item'],[422,'item'],[429,'rate-limit']]){
  const f=fixture(t,{handle:async(u,o)=>u.pathname==='/v5/pins'&&o.method==='POST'?response({message:'fixture-access-private fixture-app-secret'},status,{'retry-after':'5'}):undefined});await ready(f.client);
  await assert.rejects(f.client.createPin(payload,{expectedContext:f.client.context()}),e=>e.kind===kind&&e.requestDispatched===true&&e.uncertain===false&&!e.message.includes('fixture-'));assert.equal(posts(f).length,1);
  if(['auth','scope','board','rate-limit'].includes(kind)){assert.equal(f.client.context().accessReady,false);await assert.rejects(f.client.createPin(payload,{expectedContext:f.client.context()}));assert.equal(posts(f).length,1);}
 }
 for(const behavior of ['network','malformed','missing-id','5xx']){
  const f=fixture(t,{handle:async(u,o)=>{if(u.pathname!=='/v5/pins'||o.method!=='POST')return undefined;if(behavior==='network')throw Error('fixture-access-private');if(behavior==='malformed')return response('{invalid',201);if(behavior==='missing-id')return response({board_id:'901'},201);return response({message:'fixture-secret'},503);}});await ready(f.client);
  await assert.rejects(f.client.createPin(payload,{expectedContext:f.client.context()}),e=>e.requestDispatched===true&&e.uncertain===true&&!e.message.includes('fixture-'));assert.equal(posts(f).length,1);
 }
});

test('Refresh authentication rejection stops all API attempts until reconnect, without logging provider body',async t=>{
 let tokenCalls=0;const f=fixture(t,{handle:async(u)=>{if(u.pathname==='/v5/oauth/token')return ++tokenCalls===1?response({...TOKENS,expires_in:70}):response({error:'fixture-refresh-private'},400);}});await connect(f.client);f.advance(20000);
 await assert.rejects(f.client.boards(),e=>e.kind==='auth'&&!e.requestDispatched&&!e.message.includes('fixture-refresh'));await assert.rejects(f.client.boards(),e=>e.kind==='auth');assert.equal(tokenCalls,2);assert.match(f.client.context().blockReason,/yetkisi/);
});

test('429 Retry-After survives restart, does not retry automatically and resumes only after wait',async t=>{
 let failed=false;const f=fixture(t,{handle:async(u,o)=>{if(u.pathname==='/v5/pins'&&o.method==='POST'&&!failed){failed=true;return response({},429,{'retry-after':'5'});}}});await ready(f.client);await assert.rejects(f.client.createPin(payload,{expectedContext:f.client.context()}),e=>e.kind==='rate-limit'&&e.retryAt==='2026-10-12T12:00:05.000Z');
 const restored=f.make();assert.equal(restored.context().retryAt,'2026-10-12T12:00:05.000Z');const count=f.calls.length;await assert.rejects(restored.boards(),e=>e.kind==='rate-limit');assert.equal(f.calls.length,count);
 f.advance(5001);assert.equal(restored.context().retryAt,null);await restored.boards();assert.equal(posts(f).length,1);
 assert.equal(retryAfterMillis('3',0),3000);assert.equal(retryAfterMillis('Thu, 01 Jan 1970 00:01:00 GMT',0),60000);assert.equal(retryAfterMillis(null,0),60000);
});

test('Overflowing or malformed Retry-After headers retain a safe rate-limit stop across restart',async t=>{
 for(const header of ['9'.repeat(50),'-1','1e100']){
  const f=fixture(t,{handle:async(u,o)=>u.pathname==='/v5/pins'&&o.method==='POST'?response({},429,{'retry-after':header}):undefined});await ready(f.client);
  await assert.rejects(f.client.createPin(payload,{expectedContext:f.client.context()}),e=>e.kind==='rate-limit'&&e.globalStop&&e.requestDispatched&&!e.uncertain&&e.retryAt==='2026-10-12T12:01:00.000Z');
  assert.equal(f.make().context().retryAt,'2026-10-12T12:01:00.000Z');assert.equal(posts(f).length,1);
 }
});

test('Sandbox uses separate fixed official host; dry-run never posts and trial production never counts as live access',async t=>{
 const f=fixture(t);await connect(f.client,{environment:'sandbox'});await f.client.selectBoard('901');assert.equal(f.client.context().tier,'unknown');assert.equal(f.client.context().accessReady,true);await f.client.createPin(payload,{expectedContext:f.client.context()});
 const tokens=f.calls.filter(c=>new URL(c.url).pathname==='/v5/oauth/token');assert(tokens.length>0);assert(tokens.every(c=>new URL(c.url).origin==='https://api.pinterest.com'),'official OAuth tokenUrl stays fixed');
 assert(f.calls.filter(c=>new URL(c.url).pathname!=='/v5/oauth/token').every(c=>new URL(c.url).origin==='https://api-sandbox.pinterest.com'),'Sandbox content requests stay separate');
 f.advance(3600000);await f.client.getPin('801');assert(f.calls.filter(c=>new URL(c.url).pathname==='/v5/oauth/token').every(c=>new URL(c.url).origin==='https://api.pinterest.com'),'Sandbox token refresh uses the documented production tokenUrl');
 const g=fixture(t);await ready(g.client,{environment:'dry-run'});await assert.rejects(g.client.createPin(payload,{expectedContext:g.client.context()}),/Dry-run/);assert.equal(posts(g).length,0);
});

test('Disconnect removes local tokens without making an unsupported remote revoke claim and preserves generation across restart',async t=>{
 const f=fixture(t);await ready(f.client);const generation=f.client.context().generation;const calls=f.calls.length;const result=f.client.disconnect();assert.equal(result.localOnly,true);assert.match(result.instructions,/iptal etmez/);assert.equal(f.calls.length,calls);assert.equal(f.client.status().connected,false);assert.equal(f.client.status().configured,true);
 const restored=f.make();assert.ok(restored.context().generation>generation);assert.equal(restored.status().connected,false);const privateValue=fs.readFileSync(path.join(f.dir,'pinterest-connection.json'),'utf8');assert.equal(privateValue.includes(TOKENS.access_token),false);assert.equal(privateValue.includes(TOKENS.refresh_token),false);
});

test('Read-only reconciliation returns bounded safe fields without writing pins',async t=>{
 const f=fixture(t);await connect(f.client);assert.equal((await f.client.getPin('801')).is_owner,true);const list=await f.client.boardPins('901');assert.equal(list.items[0].link,PIN.link);assert.equal(list.bookmark,null);assert.equal(posts(f).length,0);
 await assert.rejects(f.client.getPin('https://www.pinterest.com/pin/801/'),/kimliği/);await assert.rejects(f.client.boardPins('901',{bookmark:'a'.repeat(4097)}),/geçersiz/);
});

test('Corrupt private connection is protected until configuration saves a private recovery copy',t=>{
 const f=fixture(t);const file=path.join(f.dir,'pinterest-connection.json'),original='{corrupt fixture-private';fs.writeFileSync(file,original,{mode:0o600});const client=f.make();assert.equal(client.status().connected,false);assert.match(client.status().error,/dosyası/);assert.equal(fs.readFileSync(file,'utf8'),original);
 client.configure(config);const recovery=fs.readdirSync(f.dir).find(n=>n.startsWith('pinterest-connection-recovery-'));assert.equal(fs.readFileSync(path.join(f.dir,recovery),'utf8'),original);assert.equal(fs.statSync(path.join(f.dir,recovery)).mode&0o777,0o600);assert.equal(client.status().error,null);
});
