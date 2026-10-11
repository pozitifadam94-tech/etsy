/* Optional development check. Uses an already installed Playwright + Chromium.
 * All data is synthetic; temporary files/server/browser are removed on exit.
 * No Etsy, Google Drive, or other external network requests are permitted.
 */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {spawn}=require('node:child_process');
const {once}=require('node:events');
const ROOT=path.resolve(process.env.STL_VERIFY_ROOT||path.join(__dirname,'..'));
let chromium;
try{({chromium}=require('playwright'));}catch{console.error('Optional browser check needs an already installed Playwright and Chromium. No package was installed. Run npm test for the dependency-free checks.');process.exit(1);}

const emptyState=()=>({niches:[{id:'fixture-niche-a',name:'Fixture A',query:'fixture a',competition:null,date:new Date().toISOString().slice(0,10)},{id:'fixture-niche-b',name:'Fixture B',query:'fixture b',competition:null,date:new Date().toISOString().slice(0,10)}],listings:[],candidates:[],experiments:[],changes:[],actions:[],families:{},support:[],inspections:{},ledger:[],shares:[]});
const folder='https://drive.google.com/drive/folders/syntheticFolderA?resourcekey=syntheticKey';
function syntheticProduct(shopId='901'){
 return {id:70001,title:shopId==='901'?'Fixture Etsy ballet listing':'Fixture second shop listing',url:'https://www.etsy.com/listing/70001',description:'Original product details. This is a digital STL model; no physical item.',tags:['ballet stl','digital model'],listingType:'download',age:30,created:Math.floor(Date.now()/1000)-30*86400,favorites:0,price:{amount:300,divisor:100,currency_code:'USD'},image:'',periods:[],daily:{},dailyMoney:{}};
}
function etsyStatus(shopId='901'){
 return {configured:true,connected:true,shop:shopId==='901'?'Fixture Shop A':'Fixture Shop B',shopId,busy:false,error:null,retryAfter:null,snapshot:{shopId,updated:new Date().toISOString(),salesAvailable:false,salesUpdated:null,products:[syntheticProduct(shopId)],bundles:[]}};
}
function tetrahedron(){
 const a=[0,0,0],b=[1,0,0],c=[0,1,0],d=[0,0,1],faces=[[a,c,b],[a,b,d],[a,d,c],[b,c,d]],buffer=Buffer.alloc(84+faces.length*50);buffer.writeUInt32LE(faces.length,80);
 faces.forEach((face,i)=>face.flat().forEach((n,j)=>buffer.writeFloatLE(n,84+i*50+12+j*4)));return buffer;
}
async function startServer(dir){
 // The fixture server cannot call real external services, even if a test route
 // is missed. The temporary directory contains no connection credentials.
 const bootstrap="global.fetch=async()=>{throw Error('External fetch disabled in browser fixture');};process.on('message',message=>{if(message?.type!=='fixture-shop')return;try{const store=require(require('node:path').join(require('node:path').dirname(process.argv[1]),'workspace')).workspace();store.activateShop(message.shopId);store.put(message.state,store.status().revision,message.shopId);process.send({type:'fixture-shop-result',request:message.request,ok:true});}catch(error){process.send({type:'fixture-shop-result',request:message.request,error:error.message});}});require(process.argv[1]);";
 const child=spawn(process.execPath,['-e',bootstrap,path.join(ROOT,'server.js')],{cwd:ROOT,env:{...process.env,STL_DATA_DIR:dir,HOST:'localhost',PORT:'0',OPEN_BROWSER:'0'},stdio:['ignore','pipe','pipe','ipc']});
 let logs='';child.stdout.setEncoding('utf8');child.stderr.setEncoding('utf8');child.stderr.on('data',s=>logs=(logs+s).slice(-10000));
 try{
  const port=await new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>reject(Error('Fixture server startup timed out. '+logs)),10000);
   child.once('error',e=>{clearTimeout(timer);reject(e);});child.once('exit',code=>{clearTimeout(timer);reject(Error('Fixture server exited during startup: '+code+'. '+logs));});
   child.stdout.on('data',s=>{logs=(logs+s).slice(-10000);const found=/hazır; port (\d+)/.exec(logs);if(found){clearTimeout(timer);resolve(Number(found[1]));}});
  });
  return {child,base:'http://localhost:'+port};
 }catch(e){await stopServer(child);throw e;}
}
async function stopServer(child){
 if(!child||child.exitCode!==null)return;const exited=once(child,'exit');child.kill('SIGTERM');
 await Promise.race([exited,new Promise(resolve=>{const timer=setTimeout(()=>{if(child.exitCode===null)child.kill('SIGKILL');resolve();},3000);timer.unref();})]);
}
async function changeFixtureShop(child,shopId,state){
 const request='fixture-'+Date.now();
 await new Promise((resolve,reject)=>{const done=message=>{if(message?.request!==request)return;clearTimeout(timer);child.off('message',done);if(message.error)reject(Error(message.error));else resolve();};const timer=setTimeout(()=>{child.off('message',done);reject(Error('Fixture shop change timed out'));},10000);child.on('message',done);child.send({type:'fixture-shop',request,shopId,state});});
}
async function localJSON(page,route='/api/workspace',body){
 return page.evaluate(async({route,body})=>{const r=await fetch(route,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined}),data=await r.json();if(!r.ok)throw Error(data.error||'Fixture request failed');return data;},{route,body});
}
async function routeTo(page,base,id){await page.goto(base+'/#'+id);await page.waitForFunction(id=>document.getElementById(id)&&!document.getElementById(id).hidden,id);}
async function detailsOpen(locator){await locator.evaluate(el=>{el.open=true;});}
async function run(){
 const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'stl-browser-'));let server,browser;
 try{
  const {createWorkspace}=require(path.join(ROOT,'workspace')),{createProduct,emptyState:emptyDelivery}=require(path.join(ROOT,'public/delivery'));
  const store=createWorkspace(scratch);store.activateShop('901');const state=emptyState();state.delivery=emptyDelivery();state.delivery.products['70001']=createProduct(syntheticProduct(),{shopId:'901'});store.put(state,store.status().revision,'901');
  store.capture({shopId:'901',updated:new Date().toISOString(),salesUpdated:null,salesAvailable:false,products:[syntheticProduct()],observations:[]});
  const sourceTXT=path.join(scratch,'Offline test model.txt'),sourceSTL=path.join(scratch,'fixture-original.stl');
  const originalTXT=Buffer.from('Drive: https://drive.google.com/drive/folders/syntheticFolderA\nOther folder: https://drive.google.com/drive/folders/syntheticFolderB\nHelp: https://www.etsy.com/listing/123'),originalSTL=tetrahedron();
  fs.writeFileSync(sourceTXT,originalTXT);fs.writeFileSync(sourceSTL,originalSTL);
  server=await startServer(scratch);const health=await fetch(server.base+'/api/health').then(r=>r.json());assert.deepEqual(health,{app:'stl-atelier',version:require(path.join(ROOT,'package.json')).version});
  const executable=process.env.STL_CHROMIUM_PATH||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined);
  browser=await chromium.launch({...(executable?{executablePath:executable}:{}),args:['--no-sandbox']});
  const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true}),page=await context.newPage(),errors=[],external=[];
  page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));let status=etsyStatus(),driveFailure=false;
  await context.route('**/*',async route=>{
   const u=new URL(route.request().url());if(u.origin!==server.base){external.push(u.origin);await route.abort();return;}
   if(u.pathname==='/api/etsy/status'){await route.fulfill({json:status});return;}
   if(u.pathname==='/api/etsy/sync'){await route.fulfill({status:202,json:{ok:true}});return;}
   if(u.pathname==='/api/etsy/market'){await route.fulfill({json:{busy:false,watches:[]}});return;}
   if(u.pathname==='/api/drive/check'){if(driveFailure)await route.fulfill({status:503,json:{error:'Synthetic Drive failure'}});else await route.fulfill({json:{status:'unknown',checkedAt:new Date().toISOString(),method:'anonymous-html',scope:'folder-page-only',reason:'Synthetic response; access was not verified.'}});return;}
   if(u.pathname==='/api/version'){await route.fulfill({json:{current:require(path.join(ROOT,'package.json')).version,latest:require(path.join(ROOT,'package.json')).version,available:false}});return;}
   await route.continue();
  });
  await page.goto(server.base);await page.waitForFunction(()=>window.STLAtelierUI&&document.querySelector('#delivery-count'));
  assert.equal(await page.locator('main > section:visible').count(),1);
  await routeTo(page,server.base,'deliveries');
  assert(await page.locator('#delivery-cards [data-delivery-product="70001"]').isVisible(),'known Etsy product appears without manual creation');
  await page.locator('#delivery-cards [data-delivery-product="70001"]').click();await page.waitForSelector('#delivery-dialog[open]');
  assert.match(await page.locator('#delivery-detail h2').innerText(),/Fixture Etsy ballet listing/);
  assert.equal(await page.locator('#delivery-detail a[href*="etsy.com/listing"]').first().getAttribute('href'),'https://www.etsy.com/listing/70001');
  await page.locator('#delivery-product-form input[name=folder]').fill(folder);await page.locator('#delivery-product-form button.primary').click();
  await page.waitForFunction(()=>!document.querySelector('#generate-txt').disabled);await page.locator('#generate-txt').click();
  const etsyTXT=await page.locator('#txt-preview').inputValue();assert(etsyTXT.includes(folder));assert(!etsyTXT.includes('etsy.com/listing'),'Etsy management URL must not replace the delivery folder');
  await page.locator('#close-delivery').click();
  page.once('dialog',d=>d.accept('Offline test model'));await page.locator('#local-product-add').click();await page.waitForSelector('#delivery-dialog[open]');
  const localId=await page.evaluate(()=>Object.keys(STLAtelierUI.getProducts().reduce((o,p)=>{if(p.local&&p.title==='Offline test model')o[p.id]=true;return o;},{}))[0]);assert(localId);
  await page.locator('#delivery-product-form input[name=folder]').fill(folder);await page.locator('#delivery-product-form button.primary').click();await page.waitForFunction(()=>!document.querySelector('#generate-txt').disabled);await page.locator('#generate-txt').click();
  const txt=await page.locator('#txt-preview').inputValue();assert(txt.includes(folder));assert(!txt.includes('etsy.com/listing'));
  const downloadEvent=page.waitForEvent('download');await page.locator('#save-txt').click();const downloaded=await downloadEvent;assert.equal(fs.readFileSync(await downloaded.path(),'utf8'),txt);
  await page.waitForFunction(()=>document.querySelector('#txt-versions').textContent.includes('Güncel yerel sürüm'));
  await page.locator('#close-delivery').click();await page.reload();await page.waitForSelector('#delivery-cards [data-delivery-product="'+localId+'"]');await page.locator('#delivery-cards [data-delivery-product="'+localId+'"]').click();
  assert.equal(await page.locator('#delivery-product-form input[name=folder]').inputValue(),folder);assert.equal(await page.locator('#txt-preview').inputValue(),txt);
  const checks=await page.locator('.check-grid').innerText();assert(checks.includes('Kontrol edilmedi'),'unperformed checks must not report success');
  await page.locator('#check-folder').click();await page.waitForFunction(()=>document.querySelector('.check-grid').textContent.includes('Doğrulanamadı'));
  assert((await page.locator('.check-grid').innerText()).includes('Kontrol edilmedi'),'access check must not mark content or geometry passed');
  await page.locator('#delivery-product-form input[name=folder]').fill('https://www.etsy.com/listing/123');await page.locator('#delivery-product-form button.primary').click();await page.waitForFunction(()=>document.querySelector('#message').textContent.includes('Drive'));assert((await page.locator('#message').innerText()).includes('klasör'));assert(await page.locator('#delivery-dialog [data-dialog-message]').isVisible(),'modal error must be visible inside the modal');await page.locator('#delivery-product-form input[name=folder]').fill(folder);
  const prep=page.locator('#product-preparation');await prep.locator('.prep-draft > summary').click();await prep.locator('[data-prep-paragraph]').click();const description=await prep.locator('textarea[name=description]').inputValue();assert(/TXT/i.test(description));assert(/Google Drive/i.test(description));
  await prep.locator('[data-prep-form] button[type=submit]').click();await page.waitForFunction(()=>document.querySelector('#product-preparation [data-prep-saved]').textContent.includes('Yerel taslak kaydı'));
  await prep.locator('[data-prep-paragraph]').click();assert.equal(await prep.locator('textarea[name=description]').inputValue(),description,'common delivery paragraph is idempotent');
  await prep.locator('.prep-ai > summary').click();await prep.locator('[data-prep-context]').click();const contextText=await prep.locator('[data-prep-context-text]').inputValue();assert(!contextText.includes('syntheticFolderA'));assert(!contextText.includes('syntheticKey'));
  await prep.locator('.prep-ai > .optional-tools > summary').click();await prep.locator('[data-prep-ai-output]').fill('{"title":"Test", "command":"delete"}');await prep.locator('[data-prep-ai-apply]').click();await page.waitForFunction(()=>document.querySelector('#product-preparation [data-prep-ai-result]').textContent.length>0);assert(/alan|field|destek/i.test(await prep.locator('[data-prep-ai-result]').innerText()));
  await page.locator('#close-delivery').click();await page.locator('#delivery-txt-files').setInputFiles(sourceTXT);await detailsOpen(page.locator('#deliveries > .optional-tools').first());await page.locator('#txt-import-preview').waitFor();assert.equal(await page.locator('[data-import-folder="0"]').inputValue(),'','ambiguous folder selection must be explicit');
  await page.locator('[data-import-product="0"]').selectOption(localId);await page.locator('[data-import-folder="0"]').selectOption('https://drive.google.com/drive/folders/syntheticFolderA');await page.locator('[data-import-save="0"]').click();await page.waitForFunction(()=>document.querySelector('[data-import-save="0"]').disabled);
  await routeTo(page,server.base,'files');await page.locator('#stl-file').setInputFiles(sourceSTL);await page.waitForFunction(()=>!document.querySelector('#stl-workspace').hidden);assert((await page.locator('#stl-report').innerText()).includes('4 üçgen'));
  await page.locator('#stl-save').click();await page.waitForFunction(()=>document.querySelector('#message').textContent.includes('saklandı'));
  const imageEvent=page.waitForEvent('download');await page.locator('#stl-export-preview').click();const imageDownload=await imageEvent;assert(fs.statSync(await imageDownload.path()).size>1000,'PNG was drawn from a real selected fixture mesh');
  await routeTo(page,server.base,'overview');await page.locator('#daily-run').click();await page.waitForFunction(()=>document.querySelector('#daily-run-status').textContent.includes('tamamlandı'));assert((await page.locator('#daily-run-status').innerText()).includes('dosya içeriği/geometri kontrol edilmedi'));
  // Failed external checks remain failures while other daily stages complete.
  // The same-shop authoritative refresh also invalidates an already open form's
  // record identity, so it cannot claim to save detached delivery data.
  await routeTo(page,server.base,'deliveries');await page.locator('#delivery-cards [data-delivery-product="'+localId+'"]').click();await page.waitForSelector('#delivery-dialog[open]');
  await page.evaluate(()=>{window.staleDeliveryForm=document.querySelector('#delivery-product-form');});
  const beforeFailure=await localJSON(page),failureState=structuredClone(beforeFailure.state);failureState.delivery.products[localId].sourceNote='CONCURRENT_SOURCE_NOTE';failureState.delivery.products[localId].checks.access={status:'unverified',checkedAt:null,method:'',detail:'Synthetic check is due'};
  await localJSON(page,'/api/workspace',{state:failureState,revision:beforeFailure.revision,shopId:'901'});driveFailure=true;await page.evaluate(()=>STLAtelierUI.dailyRun());
  const failureResult=await localJSON(page);assert(failureResult.state.dailyReview.lastRun.stages.some(s=>s.status==='error'&&s.detail.includes('Synthetic Drive failure')));assert(failureResult.state.dailyReview.lastRun.stages.some(s=>s.status==='ok'),'other daily stages still complete');assert.equal(failureResult.state.delivery.products[localId].checks.access.status,'unverified','failed access must not be marked verified');
  await page.evaluate(async()=>{staleDeliveryForm.elements.folder.value='https://drive.google.com/drive/folders/syntheticStaleFolder';staleDeliveryForm.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await new Promise(resolve=>setTimeout(resolve,30));});
  const afterStale=await localJSON(page);assert.equal(afterStale.state.delivery.products[localId].sourceNote,'CONCURRENT_SOURCE_NOTE');assert(!afterStale.state.delivery.products[localId].deliveryFolderUrl.includes('syntheticStaleFolder'));assert((await page.locator('#message').innerText()).includes('değişti'),'detached delivery form reports rejection');await page.locator('#close-delivery').click();driveFailure=false;
  // A separate same-shop write invalidates old local undo, avoiding an overwrite
  // of the concurrent user's state after refresh.
  await routeTo(page,server.base,'niches');page.once('dialog',d=>d.accept());await page.locator('[data-delete="niches"]').first().click();await page.waitForFunction(()=>!document.querySelector('#undo').hidden);
  await page.waitForFunction(()=>document.querySelector('#storage-status').textContent.includes('Ortak yerel depo hazır'));
  const deleted=await localJSON(page),remoteState=structuredClone(deleted.state);remoteState.niches.push({id:'concurrent-fixture',name:'Concurrent fixture',query:'concurrent',competition:null,date:new Date().toISOString().slice(0,10)});
  await localJSON(page,'/api/workspace',{state:remoteState,revision:deleted.revision,shopId:'901'});await page.evaluate(()=>STLAtelierUI.dailyRun());assert(await page.locator('#undo').isHidden());await page.locator('#undo').evaluate(el=>el.click());assert((await localJSON(page)).state.niches.some(n=>n.id==='concurrent-fixture'));
  // A shop switch while settings are focused must clear old dirty settings and
  // preserve only draft fields in an explicitly downloadable session recovery.
  await routeTo(page,server.base,'preparation');await page.locator('#prep-product').selectOption('70001');await page.locator('#prep-editor .prep-draft>summary').click();await page.locator('#prep-editor input[name=title]').fill('Unsaved old shop fixture');await page.evaluate(()=>{window.staleScopedForm=document.querySelector('#prep-editor [data-prep-form]');document.querySelector('#prep-editor [data-prep-message]').value='RAW_SCOPE_CUSTOMER_MESSAGE';});
  await routeTo(page,server.base,'deliveries');await detailsOpen(page.locator('#deliveries > .optional-tools').last());await page.locator('#delivery-support').fill('OLD_SCOPE_SUPPORT');await page.locator('#delivery-template').fill('{{productName}}\n{{deliveryFolderUrl}}\n{{support}}\nOLD_SCOPE_TEMPLATE');await page.locator('#delivery-template').focus();
  await changeFixtureShop(server.child,'902',emptyState());status=etsyStatus('902');await page.evaluate(()=>STLAtelierUI.dailyRun());await page.waitForFunction(()=>document.querySelector('.workspace-header .eyebrow').textContent.includes('Fixture Shop B'));
  assert(!(await page.locator('#delivery-template').inputValue()).includes('OLD_SCOPE_TEMPLATE'),'focused template from prior shop must clear');assert.equal(await page.locator('#delivery-support').inputValue(),'');assert.equal((await localJSON(page)).activeShopId,'902');
  await routeTo(page,server.base,'preparation');assert.equal(await page.locator('#prep-editor input[name=title]').inputValue(),'Fixture second shop listing');assert(await page.locator('#prep-recovery').isVisible());
  const recoveryEvent=page.waitForEvent('download');await page.locator('#prep-recovery-export').click();const recovery=await recoveryEvent,content=fs.readFileSync(await recovery.path(),'utf8');assert(content.includes('Unsaved old shop fixture'));assert(content.includes('"shopId": "901"'));assert(!content.includes('RAW_SCOPE_CUSTOMER_MESSAGE'));
  await page.evaluate(async()=>{staleScopedForm.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await new Promise(resolve=>setTimeout(resolve,30));});assert.equal(Object.keys((await localJSON(page)).state.preparations||{}).length,0,'old shop form must not save into same listing ID in new shop');
  for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:900});for(const section of ['overview','deliveries','preparation','live']){await routeTo(page,server.base,section);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Horizontal overflow at '+width+' / '+section);assert.equal(await page.locator('main > section:visible').count(),1);}}
  assert.deepEqual(fs.readFileSync(sourceTXT),originalTXT,'source TXT must remain unchanged');assert.deepEqual(fs.readFileSync(sourceSTL),originalSTL,'source STL must remain unchanged');assert.deepEqual(external,[],'no external network request was allowed');assert.deepEqual(errors,[],'no uncaught browser error');
  console.log('Browser checks passed: temporary local server; Etsy fixture enrichment; TXT download/persistence; URL separation; independent checks; private AI context; strict JSON; unchanged TXT/STL; PNG from selected mesh; daily partial failure; detached delivery form rejection; concurrent undo protection; shop-switch recovery; responsive 320/390/768/1440.');
 }finally{try{if(browser)await browser.close();}finally{try{await stopServer(server?.child);}finally{fs.rmSync(scratch,{recursive:true,force:true});}}}
}
run().catch(error=>{console.error(error);process.exitCode=1;});
