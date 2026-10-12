/* Optional acceptance check: use an already installed Playwright + Chromium.
 * The real server and real index/app run with fresh temporary data. Every
 * provider response and image is synthetic; no external request is allowed.
 * No runtime dependencies are added and no real Pinterest pin can be posted.
 */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const crypto=require('node:crypto');
const {spawn}=require('node:child_process');
const {once}=require('node:events');
const ROOT=path.resolve(process.env.STL_VERIFY_ROOT||path.join(__dirname,'..'));
let chromium;
try{({chromium}=require('playwright'));}catch{
 console.error('Optional Pinterest browser check needs an already installed Playwright and Chromium. No package was installed. Run npm test for dependency-free checks.');process.exit(1);
}
const IMAGE=Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/2wBDAQMDAwQDBAgEBAgQCwkLEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBD/wAARCAADAAUDAREAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAABP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAH/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AIQAu/9k=','base64');
const ARTIFACTS=path.resolve(process.env.STL_PINTEREST_ARTIFACT_DIR||path.join(os.tmpdir(),'stl-pinterest-browser-artifacts'));
const SECRET='fixturePinterestSecretABCDE';
const TOKEN='fixturePinterestAccessToken';
const PRIVATE='PRIVATE_CUSTOMER_DRIVE_FIXTURE';
const BOARD='910001',SECRET_BOARD='910002';
const emptyState=()=>({niches:[{id:'retained-fixture',name:'Retained user work',query:'synthetic research',competition:null,date:'2026-10-01'}],listings:[],candidates:[],experiments:[],changes:[],actions:[],families:{},support:[],inspections:{},ledger:[],shares:[]});
const imageURL=id=>'https://i.etsystatic.com/901/r/il/'+id+'/il_fullxfull.'+id+'.jpg';
function products(){
 return Array.from({length:8},(_,i)=>{
  const id=70001+i;
  return {listing_id:id,title:'Fixture digital sculpture STL '+id,state:'active',type:'download',url:'https://www.etsy.com/listing/'+id,
   description:'Synthetic digital model. '+PRIVATE+' https://drive.google.com/drive/folders/'+PRIVATE,
   original_creation_timestamp:1760000000+i*86400,creation_timestamp:1760000000+i*86400,tags:['digital stl'],num_favorers:0,
   price:{amount:300,divisor:100,currency_code:'USD'},images:i===7?[{listing_image_id:80000+id,rank:2,url_fullxfull:imageURL(80000+id)}]:[
    {listing_image_id:90000+id,rank:2,url_fullxfull:imageURL(90000+id)},
    {listing_image_id:80000+id,rank:1,url_fullxfull:imageURL(80000+id),url_570xN:imageURL(80000+id)+'?small=1',full_width:1000,full_height:1400}
   ]};
 });
}
function writeControl(dir,value){fs.writeFileSync(path.join(dir,'fixture-control.json'),JSON.stringify(value));}
function control(dir){return JSON.parse(fs.readFileSync(path.join(dir,'fixture-control.json'),'utf8'));}
function patchControl(dir,value){writeControl(dir,{...control(dir),...value});}
function events(dir){
 const file=path.join(dir,'fixture-events.jsonl');
 return fs.existsSync(file)?fs.readFileSync(file,'utf8').trim().split('\n').filter(Boolean).map(s=>JSON.parse(s)):[];
}
function pinPosts(dir){return events(dir).filter(e=>e.kind==='pin-post');}
function seed(dir,overrides={}){
 fs.mkdirSync(dir,{recursive:true});
 const store=require(path.join(ROOT,'workspace')).createWorkspace(dir);store.activateShop('901');store.put(emptyState(),store.status().revision,'901');
 fs.writeFileSync(path.join(dir,'connection.json'),JSON.stringify({key:'fixtureEtsyKey',secret:'fixtureEtsySecret',tokens:{access_token:'42.fixture',refresh_token:'fixtureEtsyRefresh'},expires:Date.now()+86400000,shopId:'901',shopName:'Fixture Shop'}),{mode:0o600});
 writeControl(dir,{shopId:'901',accountId:'920001',username:'fixture_pinterest_account',boards:[{id:BOARD,name:'Fixture public board',privacy:'PUBLIC'},{id:SECRET_BOARD,name:'Fixture secret board',privacy:'SECRET'}],products:products(),mode:'success',failOnce:[],release:false,...overrides});
}
// This is loaded BEFORE the application's modules, so all normal OAuth, Etsy
// refresh, account, board and pin code is exercised without provider traffic.
function providerFixture(){
 const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
 // Keep this acceptance fixture away from real midnight; separate queue tests
 // advance an injected clock across Istanbul midnight and in-flight responses.
 const fixtureNow=Date.parse('2026-10-12T15:00:00.000Z'),NativeDate=Date;
 global.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:[fixtureNow]));}static now(){return fixtureNow;}};
 const root=process.env.STL_FIXTURE_ROOT,dir=process.env.STL_DATA_DIR;
 const read=()=>JSON.parse(fs.readFileSync(path.join(dir,'fixture-control.json'),'utf8'));
 const log=value=>fs.appendFileSync(path.join(dir,'fixture-events.jsonl'),JSON.stringify({...value,at:new Date().toISOString()})+'\n');
 const image=Buffer.from(process.env.STL_FIXTURE_IMAGE,'base64');
 const reply=(value,status=200,headers={})=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json',...headers}});
 const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 global.fetch=async(input,options={})=>{
  const url=new URL(typeof input==='string'?input:input.url||String(input)),method=options.method||'GET',c=read();
  if(url.origin==='https://openapi.etsy.com'&&method==='GET'){
   log({kind:'etsy-read',path:url.pathname});
   if(/\/users\/42\/shops$/.test(url.pathname))return reply({shop_id:c.shopId,shop_name:'Fixture Shop',listing_active_count:c.products.length});
   if(/\/shops\/\d+\/listings(?:\/active)?$/.test(url.pathname))return reply({count:c.products.length,results:c.products});
   if(/\/shops\/\d+\/receipts$/.test(url.pathname))return reply({count:0,results:[]});
   if(/\/shops\/\d+$/.test(url.pathname))return reply({shop_id:c.shopId,shop_name:'Fixture Shop',listing_active_count:c.products.length});
  }
  if(['https://api.pinterest.com','https://api-sandbox.pinterest.com'].includes(url.origin)){
   if(url.pathname==='/v5/oauth/token'&&method==='POST'){
    log({kind:'oauth-token',host:url.hostname});
    return reply({access_token:'fixturePinterestAccessToken',refresh_token:'fixturePinterestRefreshToken',token_type:'bearer',expires_in:86400,scope:'boards:read boards:write pins:read pins:write user_accounts:read'});
   }
   if(url.pathname==='/v5/user_account'&&method==='GET')return reply({id:c.accountId,username:c.username,account_type:'BUSINESS',profile_image:''});
   if(url.pathname==='/v5/boards'&&method==='GET')return reply({items:c.boards,bookmark:null});
   const board=/^\/v5\/boards\/(\d+)$/.exec(url.pathname);
   if(board&&method==='GET'){const b=c.boards.find(b=>b.id===board[1]);return b?reply(b):reply({code:404,message:'synthetic inaccessible board'},404);}
   if(url.pathname==='/v5/pins'&&method==='POST'){
    const payload=JSON.parse(String(options.body)),previous=fs.existsSync(path.join(dir,'fixture-events.jsonl'))?fs.readFileSync(path.join(dir,'fixture-events.jsonl'),'utf8').trim().split('\n').filter(Boolean).map(JSON.parse).filter(e=>e.kind==='pin-post'):[];
    const listingId=new URL(payload.link).pathname.split('/').pop(),number=previous.length+1;
    log({kind:'pin-post',number,host:url.hostname,payload});
    if(c.mode==='hold'){
     const deadline=Date.now()+15000;while(!read().release&&Date.now()<deadline)await delay(25);
     if(!read().release)throw Error('Synthetic held provider request timed out');
    }else if(c.delayMs)await delay(c.delayMs);
    if(c.mode==='uncertain')throw Error('Synthetic ambiguous network result after dispatch');
    if(c.failOnce.includes(listingId)&&!previous.some(e=>new URL(e.payload.link).pathname.split('/').pop()===listingId))return reply({code:400,message:'synthetic item rejected'},400);
    const result={id:String(930000+number),board_id:payload.board_id,link:payload.link,title:payload.title,description:payload.description,media:{media_type:'image'},created_at:new Date().toISOString()};
    log({kind:'pin-created',pin:result});return reply(result,201);
   }
   const pin=/^\/v5\/pins\/(\d+)$/.exec(url.pathname);
   if(pin&&method==='GET'){
    const records=fs.readFileSync(path.join(dir,'fixture-events.jsonl'),'utf8').trim().split('\n').filter(Boolean).map(JSON.parse),created=records.find(e=>e.kind==='pin-created'&&e.pin.id===pin[1]);return created?reply(created.pin):reply({code:404,message:'synthetic pin not found'},404);
   }
   if(/^\/v5\/boards\/\d+\/pins$/.test(url.pathname)&&method==='GET'){
    const records=fs.existsSync(path.join(dir,'fixture-events.jsonl'))?fs.readFileSync(path.join(dir,'fixture-events.jsonl'),'utf8').trim().split('\n').filter(Boolean).map(JSON.parse):[];
    return reply({items:records.filter(e=>e.kind==='pin-created'&&e.pin.board_id===url.pathname.split('/')[3]).map(e=>e.pin),bookmark:null});
   }
  }
  log({kind:'unexpected-provider-request',host:url.hostname,path:url.pathname,method});throw Error('External provider traffic disabled in Pinterest browser fixture');
 };
 // The production downloader has separate DNS/TLS/byte-bound unit tests. This
 // fixture injects only the original synthetic bytes, leaving queue/media-source
 // construction and all real HTTP routes intact.
 require(path.join(root,'pinterest-media')).createMediaFetcher=()=>async url=>{
  if(!/^https:\/\/i\.etsystatic\.com\/901\/r\/il\/\d+\/il_fullxfull\.\d+\.jpg$/.test(url))throw Error('Unexpected fixture image source');
  log({kind:'media',url});return {content_type:'image/jpeg',data:image,sha256:crypto.createHash('sha256').update(image).digest('hex'),bytes:image.length,width:5,height:3};
 };
 require(path.join(root,'server.js'));
}
async function startServer(dir){
 const preload=path.join(dir,'fixture-preload.cjs');fs.writeFileSync(preload,'('+providerFixture.toString()+')();\n');
 const child=spawn(process.execPath,['--require',preload,path.join(ROOT,'server.js')],{cwd:ROOT,env:{...process.env,STL_DATA_DIR:dir,STL_FIXTURE_ROOT:ROOT,STL_FIXTURE_IMAGE:IMAGE.toString('base64'),HOST:'localhost',PORT:'0',OPEN_BROWSER:'0'},stdio:['ignore','pipe','pipe']});
 let logs='';child.stdout.setEncoding('utf8');child.stderr.setEncoding('utf8');child.stderr.on('data',s=>logs=(logs+s).slice(-10000));
 try{
  const port=await new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>reject(Error('Pinterest fixture server startup timed out. '+logs)),10000);
   child.once('error',error=>{clearTimeout(timer);reject(error);});child.once('exit',code=>{clearTimeout(timer);reject(Error('Pinterest fixture server exited '+code+'. '+logs));});
   child.stdout.on('data',s=>{logs=(logs+s).slice(-10000);const found=/hazır; port (\d+)/.exec(logs);if(found){clearTimeout(timer);resolve(Number(found[1]));}});
  });
  const server={child,base:'http://localhost:'+port,logs:()=>logs};
  const health=await fetch(server.base+'/api/health').then(r=>r.json());assert.equal(health.version,require(path.join(ROOT,'package.json')).version);
  await until(async()=>{const s=await fetch(server.base+'/api/etsy/status').then(r=>r.json());return !s.busy&&s.snapshot?.products?.length===control(dir).products.length;},'fresh real Etsy snapshot');
  return server;
 }catch(error){await stopServer(child);throw error;}
}
async function stopServer(child){
 if(!child||child.exitCode!==null)return;const exited=once(child,'exit');child.kill('SIGTERM');
 await Promise.race([exited,new Promise(resolve=>{const timer=setTimeout(()=>{if(child.exitCode===null)child.kill('SIGKILL');resolve();},3000);timer.unref();})]);
}
async function until(check,label,timeout=15000){
 const deadline=Date.now()+timeout;while(Date.now()<deadline){if(await check())return;await new Promise(resolve=>setTimeout(resolve,30));}throw Error('Timed out waiting for '+label);
}
async function api(page,route,body){
 return page.evaluate(async({route,body})=>{const r=await fetch(route,{method:body===undefined?'GET':'POST',headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,data:await r.json()};},{route,body});
}
async function status(page,dryRun=false){const r=await api(page,'/api/pinterest/status'+(dryRun?'?dryRun=1':''));assert.equal(r.status,200);return r.data;}
async function refresh(page){await page.evaluate(async()=>{await STLPinterestUI.refresh();});}
async function ready(page,dryRun=false){return (await status(page,dryRun)).jobs.filter(j=>j.status==='ready');}
async function settle(page){await until(async()=>!(await status(page)).busy,'Pinterest queue to settle');await refresh(page);}
async function openPinterest(page,base){
 await page.goto(base+'/#pinterest');await page.waitForFunction(()=>window.STLPinterestUI&&document.querySelector('#pinterest')&&!document.querySelector('#pinterest').hidden);await refresh(page);
 assert.equal(await page.locator('main > section:visible').count(),1,'Pinterest follows the real single-section navigation');
}
async function settings(page){await page.locator('#pin-settings').evaluate(el=>{if(el.tagName==='DETAILS')el.open=true;});}
async function setup(page,server,{environment='production',standard=true}={}){
 await settings(page);await page.locator('#pin-app-id').fill('900001');await page.locator('#pin-app-secret').fill(SECRET);await page.locator('#pin-redirect-uri').fill(server.base+'/oauth/pinterest/callback');await page.locator('#pin-environment').selectOption(environment);
 await page.locator('#pin-config').evaluate(el=>el.requestSubmit());await until(async()=>(await status(page)).connection.configured,'Pinterest app configuration');await refresh(page);
 await page.waitForFunction(()=>document.querySelector('#pin-app-secret').value==='');assert.equal(await page.locator('#pin-app-secret').inputValue(),'','saved app secret is immediately cleared from the form');
 await page.locator('#pin-connect').click();await page.waitForFunction(()=>Boolean(window.fixtureOAuthURL||document.querySelector('#pin-oauth-link a')?.href));
 const oauth=new URL(await page.evaluate(()=>window.fixtureOAuthURL||document.querySelector('#pin-oauth-link a').href));assert.equal(oauth.hostname,'www.pinterest.com');assert(oauth.searchParams.get('state'));assert(oauth.searchParams.get('scope').includes('pins:write'));
 const callback=new URL(server.base+'/oauth/pinterest/callback');callback.searchParams.set('code','synthetic-fixture-code');callback.searchParams.set('state',oauth.searchParams.get('state'));
 await page.locator('.pin-oauth-fallback').evaluate(el=>{el.open=true;});await page.locator('#pin-oauth-redirect').fill(callback.href);await page.locator('#pin-oauth-complete').click();await until(async()=>(await status(page)).connection.connected,'real OAuth callback route');await refresh(page);
 await page.locator('#pin-boards-refresh').click();await page.waitForFunction(()=>document.querySelector('#pin-board').options.length>=3);await page.locator('#pin-board').selectOption(BOARD);await page.locator('#pin-board-save').click();await until(async()=>(await status(page)).context.boardId===BOARD,'target board selection');await refresh(page);
 if(standard){await page.locator('#pin-tier').selectOption('standard');await page.locator('#pin-standard-approved').check();await page.locator('#pin-access').evaluate(el=>el.requestSubmit());await until(async()=>(await status(page)).context.accessReady,'declared Standard access');await refresh(page);}
 const publicValue=JSON.stringify(await status(page));for(const privateValue of [SECRET,TOKEN,'fixturePinterestRefreshToken'])assert(!publicValue.includes(privateValue),'safe status excludes credentials');
}
async function prepare(page,dryRun=false){if(dryRun)await page.locator('.pin-dry').evaluate(el=>{el.open=true;});await page.locator(dryRun?'#pin-dry-prepare':'#pin-prepare').click();await until(async()=>(await ready(page,dryRun)).length>0,'prepared visible queue');await refresh(page);await page.waitForFunction(dry=>document.querySelector(dry?'#pin-dry-send':'#pin-send').textContent.includes('ürün')&&document.querySelectorAll('[data-pin-job]').length>0,dryRun);return ready(page,dryRun);}
async function fixtureContext(browser,server,errors,external,{popupBlocked=false}={}){
 const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
 await context.addInitScript(blocked=>{window.open=url=>blocked?null:{opener:null,location:{set href(value){window.fixtureOAuthURL=String(value);}},close(){}};},popupBlocked);
 await context.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.origin!==server.base){
   if(url.hostname==='i.etsystatic.com'&&route.request().resourceType()==='image'){await route.fulfill({contentType:'image/jpeg',body:IMAGE});return;}
   external.push(url.origin+url.pathname);await route.abort();return;
  }
  if(url.pathname==='/api/version'){const v=require(path.join(ROOT,'package.json')).version;await route.fulfill({json:{current:v,latest:v,available:false}});return;}
  await route.continue();
 });
 context.on('page',page=>{page.setDefaultTimeout(10000);page.on('pageerror',error=>errors.push(error.message));});
 return context;
}
function verifyPayloads(dir){
 const c=control(dir);
 for(const e of pinPosts(dir)){
  const payload=e.payload,id=Number(new URL(payload.link).pathname.split('/').pop()),product=c.products.find(p=>p.listing_id===id);
  assert(product,'payload has a known numeric Etsy listing');assert.equal(payload.link,'https://www.etsy.com/listing/'+id);assert.equal(payload.media_source.source_type,'image_base64');assert.equal(payload.media_source.content_type,'image/jpeg');assert.equal(payload.media_source.data,IMAGE.toString('base64'),'pin media contains unchanged fixture original bytes');
  assert(payload.title.length<=100);assert(payload.description.length<=800);assert(/digital|STL/i.test(payload.description));for(const privateValue of [SECRET,TOKEN,PRIVATE,'drive.google.com'])assert(!JSON.stringify(payload).includes(privateValue),'pin excludes credentials, customer data and Drive URLs');
 }
 for(const e of events(dir).filter(e=>e.kind==='media')){const id=Number(/\.(\d+)\.jpg$/.exec(e.url)[1]),p=c.products.find(p=>p.images.some(i=>i.listing_image_id===id));assert(p);assert.equal(p.images.find(i=>i.listing_image_id===id).rank,1,'download uses explicit rank 1 despite unordered arrays');}
 assert.deepEqual(events(dir).filter(e=>e.kind==='unexpected-provider-request'),[],'no unhandled provider or external request');
}
async function capacityScenario(browser,dir,report){
 seed(dir,{failOnce:['70003'],delayMs:300});let server=await startServer(dir),context;const errors=[],external=[];
 try{
  context=await fixtureContext(browser,server,errors,external);const page=await context.newPage();await openPinterest(page,server.base);assert.equal(pinPosts(dir).length,0,'opening the application never posts pins');
  await setup(page,server,{standard:false});assert(await page.locator('#pin-send').isDisabled(),'unknown access blocks live send');assert.match(await page.locator('#pinterest').innerText(),/doğrulan|Standard|erişim/i);
  await until(async()=>{const value=await status(page);return !value.busy&&value.preview.length===3;},'panel opens and prepares its visible group without a pin POST');
  await page.waitForFunction(()=>document.querySelectorAll('#pin-preview [data-pin-job]').length===3);
  assert.equal(pinPosts(dir).length,0,'automatic preparation never publishes pins');
  await page.locator('#pin-tier').selectOption('standard');await page.locator('#pin-standard-approved').check();await page.locator('#pin-access').evaluate(el=>el.requestSubmit());await until(async()=>(await status(page)).context.accessReady,'Standard access');await refresh(page);
  await page.locator('#pin-manual').evaluate(el=>{el.open=true;});await page.waitForFunction(()=>document.querySelector('#pin-product').options.length===8);await page.locator('#pin-product').selectOption('70007');await page.locator('#pin-exclude-toggle').click();await until(async()=>(await status(page)).exclusions.some(row=>row.listingId==='70007'),'manual listing exclusion');await page.locator('#pin-exclude-toggle').click();await until(async()=>!(await status(page)).exclusions.some(row=>row.listingId==='70007'),'manual exclusion removal');await page.locator('#pin-product').selectOption('70006');await page.locator('#pin-external-url').fill('https://www.pinterest.com/pin/940000/');await page.locator('#pin-external-confirm').check();await page.locator('#pin-external-save').click();await until(async()=>(await status(page)).external.some(row=>row.listingId==='70006'),'manual external prior share');assert.equal((await status(page)).successfulToday,0,'old external share is not a new daily success');await page.locator('#pin-manual').evaluate(el=>{el.open=false;});
  let queue=await prepare(page);assert.equal(queue.length,3);assert.deepEqual(queue.map(j=>String(j.listingId)),['70001','70002','70003'],'oldest unshared active listings selected deterministically');
  for(const job of queue){assert.equal(String(job.imageId),String(80000+Number(job.listingId)));assert.equal(job.sourceUrl,imageURL(80000+Number(job.listingId)));assert.equal(await page.locator('[data-pin-job="'+job.id+'"] img').getAttribute('src'),job.sourceUrl);assert.equal(await page.locator('[data-pin-job="'+job.id+'"] a[href*="etsy.com/listing"]').getAttribute('href'),job.link);}
  assert((await status(page)).blocked.some(b=>String(b.listingId||b.id)==='70008'),'missing rank 1 listing is blocked');await page.locator('#pin-blocked-products').evaluate(el=>{el.open=true;});assert.match(await page.locator('#pin-blocked-list').innerText(),/70008/,'blocked listing reason is shown in the real UI');await page.locator('#pin-blocked-products').evaluate(el=>{el.open=false;});await capture(page,'pinterest-preview-desktop');await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));await capture(page,'pinterest-preview-mobile');await page.setViewportSize({width:1440,height:1000});await settings(page);
  const oldIds=queue.map(j=>j.id),oldContext=(await status(page)).context;
  await page.locator('#pin-board').selectOption(SECRET_BOARD);await page.locator('#pin-board-save').click();await until(async()=>(await status(page)).context.boardId===SECRET_BOARD,'secret target board');await refresh(page);assert.match(await page.locator('#pinterest').innerText(),/SECRET|gizli/i);
  const stale=await api(page,'/api/pinterest/send',{jobIds:oldIds,expectedContext:oldContext,shopId:'901'});assert(stale.status>=400,'previous visible group cannot be sent to changed board');assert.equal(pinPosts(dir).length,0);
  await page.locator('#pin-board').selectOption(BOARD);await page.locator('#pin-board-save').click();await until(async()=>(await status(page)).context.boardId===BOARD,'restored public target');await refresh(page);queue=await prepare(page);
  const second=await context.newPage();await openPinterest(second,server.base);
  await Promise.all([page.locator('#pin-send').evaluate(el=>{el.click();el.click();}),second.locator('#pin-send').evaluate(el=>el.click())]);await until(async()=>pinPosts(dir).length>=3,'first three synthetic pin attempts');await settle(page);
  let s=await status(page);assert.equal(s.successfulToday,2,'two successes and one rejected item');assert.equal(s.remaining,1,'failed request does not consume successful capacity');assert.equal(pinPosts(dir).length,3,'double-click and two tabs share one queue worker');assert(s.jobs.some(j=>j.status==='failed'));
  queue=await prepare(page);assert.equal(queue.length,1,'only the remaining daily slot is prepared');await refresh(second);
  await Promise.all([page.locator('#pin-send').evaluate(el=>{el.click();el.click();}),second.locator('#pin-send').evaluate(el=>el.click())]);await until(async()=>pinPosts(dir).length===4,'last permitted synthetic pin');await settle(page);s=await status(page);assert.equal(s.successfulToday,3);assert.equal(s.remaining,0);assert(await page.locator('#pin-send').isDisabled());assert.equal(pinPosts(dir).length,4);
  const successfulIds=s.jobs.filter(j=>j.status==='succeeded').map(j=>j.listingId),before=pinPosts(dir).length;
  await page.locator('#pin-board').selectOption(SECRET_BOARD);await page.locator('#pin-board-save').click();await refresh(page);assert.equal((await status(page)).successfulToday,3,'board change preserves account daily history');assert.equal(pinPosts(dir).length,before);
  const c=control(dir);c.products=c.products.map(p=>successfulIds.some(id=>String(id)===String(p.listing_id))?{...p,title:'Changed title '+p.listing_id,images:p.images.map(i=>i.rank===1?{...i,url_fullxfull:imageURL(i.listing_image_id)}:i)}:p);writeControl(dir,c);await page.locator('#pin-prepare').click();await until(async()=>!(await status(page)).busy,'capacity stays blocked after title edits');await refresh(page);assert.equal((await ready(page)).length,0,'title/image/board changes cannot reopen completed listing identities');assert.equal(pinPosts(dir).length,before,'pressing again at daily capacity makes no new pin POST');
  const retained=(await api(page,'/api/workspace')).data;assert(retained.state.niches.some(n=>n.id==='retained-fixture'),'existing user work survives Pinterest writes');
  const exportValue=(await api(page,'/api/pinterest/export')).data;for(const privateValue of [SECRET,TOKEN,'fixturePinterestRefreshToken',PRIVATE])assert(!JSON.stringify(exportValue).includes(privateValue),'ordinary Pinterest export is safe');
  await page.setViewportSize({width:390,height:844});await refresh(page);assert(await page.locator('#pin-prepare').isVisible());assert(await page.locator('#pin-history').isVisible());assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'Pinterest is usable without horizontal overflow on mobile');
  await capture(page,'pinterest-history-mobile');assert.deepEqual(errors,[]);assert.deepEqual(external,[]);verifyPayloads(dir);report.push('real UI OAuth/config/board, unknown access, explicit primary image, target invalidation, two tabs/double-click, partial success/daily cap, mobile, safe export, retained work');
 }finally{if(context)await context.close();await stopServer(server?.child);}
}
async function stopAndRestartScenario(browser,dir,report){
 seed(dir,{mode:'hold'});let server=await startServer(dir),context;const errors=[],external=[];
 try{
  context=await fixtureContext(browser,server,errors,external);let page=await context.newPage();await openPinterest(page,server.base);await setup(page,server);await prepare(page);
  await page.locator('#pin-send').click();await until(()=>pinPosts(dir).length===1,'in-flight held pin');await refresh(page);await until(()=>page.locator('#pin-stop').isEnabled(),'stop control after async send acceptance');assert(await page.locator('#pin-stop').isEnabled());await page.locator('#pin-stop').click();patchControl(dir,{release:true});await settle(page);assert.equal(pinPosts(dir).length,1,'stop prevents later jobs and permits the in-flight request to finish');assert.equal((await status(page)).successfulToday,1);
  patchControl(dir,{mode:'uncertain',release:false});await prepare(page);await page.locator('#pin-send').click();await until(async()=>(await status(page)).jobs.some(j=>j.status==='uncertain'),'uncertain dispatched network result');await settle(page);
  const before=await status(page),uncertain=before.jobs.find(j=>j.status==='uncertain'),postCount=pinPosts(dir).length;assert(before.reservedToday>=1,'uncertain jobs reserve daily capacity');assert(before.successfulToday+before.reservedToday<=3);assert.match(await page.locator('#pin-history').innerText(),/belirsiz|kontrol/i);
  await page.reload();await openPinterest(page,server.base);assert.equal(pinPosts(dir).length,postCount,'reload does not automatically retry an uncertain POST');
  await context.close();context=null;await stopServer(server.child);server=await startServer(dir);context=await fixtureContext(browser,server,errors,external);page=await context.newPage();await openPinterest(page,server.base);
  const restarted=await status(page);assert.equal(restarted.successfulToday,before.successfulToday);assert.equal(restarted.reservedToday,before.reservedToday);assert.equal(restarted.jobs.find(j=>j.id===uncertain.id).status,'uncertain');assert.equal(pinPosts(dir).length,postCount,'server restart preserves history and never repeats dispatched POSTs');
  const form=page.locator('[data-pin-resolve="'+uncertain.id+'"]');await form.evaluate(el=>{for(let p=el.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;});await form.locator('select[name=outcome]').selectOption('not-created');await form.locator('input[name=pinUrl]').fill('https://www.pinterest.com/pin/999999/');await form.locator('input[name=pinUrl]').focus();await refresh(page);assert.equal(await form.locator('input[name=pinUrl]').inputValue(),'https://www.pinterest.com/pin/999999/','poll preserves manual resolution draft');assert.equal(await form.locator('input[name=pinUrl]').evaluate(el=>el===document.activeElement),true,'poll preserves focused resolution input');await settings(page);await page.locator('#pin-boards-refresh').click();await page.waitForFunction(()=>document.querySelector('#pin-board').options.length>=3);await page.locator('#pin-board').selectOption(SECRET_BOARD);await page.locator('#pin-board-save').click();await until(async()=>(await status(page)).context.boardId===SECRET_BOARD,'board change with unresolved prior job');await refresh(page);assert.equal(await form.locator('input[name=pinUrl]').inputValue(),'https://www.pinterest.com/pin/999999/','target change preserves unresolved form draft');await form.locator('input[name=confirmed]').check();await form.evaluate(el=>el.requestSubmit());await until(async()=>(await status(page)).jobs.find(j=>j.id===uncertain.id).status!=='uncertain','explicit unresolved-result confirmation');assert.equal(pinPosts(dir).length,postCount,'resolving is not an automatic retry');
  await capture(page,'pinterest-resolved-desktop');assert.deepEqual(errors,[]);assert.deepEqual(external,[]);verifyPayloads(dir);report.push('stop with in-flight request, uncertain reservation, reload/server restart, explicit resolution without automatic POST');
 }finally{if(context)await context.close();await stopServer(server?.child);}
}
async function dryRunScenario(browser,dir,report){
 seed(dir);let server=await startServer(dir),context;const errors=[],external=[];
 try{
  context=await fixtureContext(browser,server,errors,external,{popupBlocked:true});const page=await context.newPage();await openPinterest(page,server.base);await setup(page,server,{environment:'production',standard:false});
  await prepare(page,true);await page.locator('#pin-dry-send').click();await until(async()=>!(await status(page,true)).busy,'dry-run completion');await refresh(page);
  const s=await status(page,true);assert(s.jobs.some(j=>j.status==='succeeded'),'dry-run creates durable test results');assert.equal(s.successfulToday,0,'dry-run is excluded from real successful daily count');assert.equal(pinPosts(dir).length,0,'dry-run makes zero Pinterest pin POST requests');assert.match(await page.locator('#pinterest').innerText(),/dry.run|deneme|test/i);
  await capture(page,'pinterest-dry-run-desktop');assert.deepEqual(errors,[]);assert.deepEqual(external,[]);verifyPayloads(dir);report.push('dry-run real UI and durable queue with zero pin POSTs and zero production successes');
 }finally{if(context)await context.close();await stopServer(server?.child);}
}
async function capture(page,name){fs.mkdirSync(ARTIFACTS,{recursive:true});await page.locator('#pin-settings').evaluate(el=>{el.open=false;});await page.waitForFunction(()=>!document.querySelector('#message')?.textContent,null,{timeout:12000});await page.evaluate(async()=>{window.scrollTo(0,0);await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});await page.screenshot({path:path.join(ARTIFACTS,name+'.png'),fullPage:true});}
async function sandboxScenario(browser,dir,report){
 seed(dir);let server=await startServer(dir),context;const errors=[],external=[];
 try{
  context=await fixtureContext(browser,server,errors,external);const page=await context.newPage();await openPinterest(page,server.base);await setup(page,server,{environment:'sandbox',standard:false});await prepare(page);await page.locator('#pin-send').click();await until(()=>pinPosts(dir).length===3,'synthetic Sandbox attempts');await settle(page);
  const s=await status(page);assert.equal(s.successfulToday,0,'Sandbox outcomes do not count as real daily successes');assert(s.jobs.every(j=>j.environment==='sandbox'));assert(pinPosts(dir).every(e=>e.host==='api-sandbox.pinterest.com'));assert.match(await page.locator('#pin-history').innerText(),/Sandbox.*gerçek başarı değil/i);assert.deepEqual(errors,[]);assert.deepEqual(external,[]);verifyPayloads(dir);await capture(page,'pinterest-sandbox-desktop');report.push('Sandbox provider host, durable test results clearly labeled, zero production successes');
 }finally{if(context)await context.close();await stopServer(server?.child);}
}
async function run(){
 const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'stl-pinterest-browser-'));let browser;const report=[];
 const startedAt=new Date().toISOString();fs.mkdirSync(ARTIFACTS,{recursive:true});fs.writeFileSync(path.join(ARTIFACTS,'acceptance.json'),JSON.stringify({passed:false,startedAt,syntheticProviders:true,publishedRealPins:false},null,2));
 try{
  const executable=process.env.STL_CHROMIUM_PATH||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined);browser=await chromium.launch({...(executable?{executablePath:executable}:{}),args:['--no-sandbox']});
  await capacityScenario(browser,path.join(scratch,'capacity'),report);await stopAndRestartScenario(browser,path.join(scratch,'restart'),report);await dryRunScenario(browser,path.join(scratch,'dry-run'),report);await sandboxScenario(browser,path.join(scratch,'sandbox'),report);
  fs.mkdirSync(ARTIFACTS,{recursive:true});fs.writeFileSync(path.join(ARTIFACTS,'acceptance.json'),JSON.stringify({passed:true,startedAt,syntheticProviders:true,publishedRealPins:false,scenarios:report,verifiedAt:new Date().toISOString()},null,2));
  console.log('PNG screenshots and acceptance report: '+ARTIFACTS);console.log('Pinterest browser acceptance passed ('+report.length+' scenarios). All provider traffic was synthetic; no real pin was published.');for(const item of report)console.log('  '+item);
 }finally{if(browser)await browser.close();fs.rmSync(scratch,{recursive:true,force:true});}
}
run().catch(error=>{console.error(error.stack||error.message);process.exitCode=1;});
