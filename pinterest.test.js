'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const crypto=require('node:crypto');
const model=require('./public/pinterest-model');
const {createPinterestStore,validateState}=require('./pinterest-store');

const SCOPES=['user_accounts:read','boards:read','boards:write','pins:read','pins:write'];
const COPY=value=>JSON.parse(JSON.stringify(value));
const image=id=>({listing_image_id:String(id),rank:1,url_fullxfull:'https://i.etsystatic.com/123/r/il/'+id+'/il_fullxfull.'+id+'.jpg',full_width:1200,full_height:800});
const product=(id,created=Number(id))=>({id:String(id),listing_id:String(id),title:'Digital sculpture '+id,state:'active',created,images:[{...image(Number(id)+500),rank:2},image(Number(id)+1000)],deliveryFolderUrl:'https://drive.google.com/private-delivery',description:'Customer: Private Buyer. access_token=PRIVATE_TOKEN. Delivery instructions.',customerEmail:'private@example.com'});
function deferred(){let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};}
function fixture(t,{products=[1,2,3,4,5].map(id=>product(id)),context={},createPin,fetchImage,getPin,boardPins}={}){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'stl-pinterest-queue-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const h={dir,time:Date.parse('2026-10-12T09:00:00Z'),context:{shopId:'10',accountId:'20',accountUsername:'api-account',boardId:'30',boardName:'Existing board',boardPrivacy:'PUBLIC',environment:'production',tier:'standard',tierSource:'user-declared',generation:1,configured:true,connected:true,scopes:SCOPES.slice(),accessReady:true,...context},snapshot:null,creates:[],images:[],refreshes:0,hooks:{createPin,fetchImage,getPin,boardPins}};
 h.snapshot={shopId:'10',updated:new Date(h.time).toISOString(),products:COPY(products)};
 h.snapshotRefresh=()=>{h.refreshes++;h.snapshot.updated=new Date(h.time).toISOString();return h.snapshot;};
 h.args={dir,clock:()=>h.time,getContext:()=>h.context,getSnapshot:()=>h.snapshot,refreshSnapshot:()=>h.snapshotRefresh(),fetchImage:async url=>{h.images.push(url);if(h.hooks.fetchImage)return h.hooks.fetchImage(url,h);return {content_type:'image/jpeg',data:Buffer.from([0xff,0xd8,0xff,0x01,0x02,0x03])};},createPin:async(payload,options)=>{h.creates.push(COPY(payload));if(h.hooks.createPin)return h.hooks.createPin(payload,options,h);await options.onDispatch();return {id:String(9000+h.creates.length),board_id:payload.board_id,link:payload.link};},...(getPin?{getPin:(...args)=>h.hooks.getPin(...args)}:{}),...(boardPins?{boardPins:(...args)=>h.hooks.boardPins(...args)}:{})};
 h.store=createPinterestStore(h.args);h.reopen=()=>createPinterestStore(h.args);h.send=options=>h.store.send({...options,jobIds:h.store.status(options).preview.map(job=>job.id)});h.file=path.join(dir,'pinterest-sharing.json');return h;
}

test('primary selection is explicit numeric rank 1, immutable and honestly unverified',()=>{
 const images=Object.freeze([Object.freeze({...image(2),rank:2}),Object.freeze(image(1))]);
 const primary=model.selectPrimaryImage(images);assert.equal(primary.imageId,'1');assert.equal(primary.url,images[1].url_fullxfull);assert.equal(primary.status,'rank-1');assert.equal(primary.orderingVerification,'historical-rule-current-unverified');
 assert.equal(model.selectPrimaryImage([images[0]]).status,'missing');assert.equal(model.selectPrimaryImage([{...image(1),rank:'1'}]).status,'missing');assert.equal(model.selectPrimaryImage([image(1),image(3)]).status,'ambiguous');assert.equal(model.selectPrimaryImage([{...image(1),listing_image_id:null}]).status,'unavailable');
 assert.equal(model.numericId(Number.MAX_SAFE_INTEGER+1),null);assert.equal(model.numericId('12345678901234567890'),'12345678901234567890');
});

test('primary selection keeps the exact image and refuses unsafe or cropped thumbnail sources',()=>{
 const selected=model.selectPrimaryImage([{...image(1),url_fullxfull:'https://drive.google.com/image',url_570xN:'https://img1.etsystatic.com/1/il_570xN.1.jpg'}, {...image(2),rank:2}]);assert.equal(selected.imageId,'1');assert.equal(selected.url,'https://img1.etsystatic.com/1/il_570xN.1.jpg');
 const thumbnail={...image(1),url_fullxfull:null,url_570xN:null,url_170x135:'https://i.etsystatic.com/1/thumb.jpg'};assert.equal(model.selectPrimaryImage([thumbnail]).status,'unavailable');
 for(const url of ['http://i.etsystatic.com/a','https://i.etsystatic.com.evil.test/a','https://i.etsystatic.com@127.0.0.1/a','https://i.etsystatic.com:8443/a','https://127.0.0.1/a'])assert.equal(model.allowedImageURL(url),false,url);
});

test('content uses only safe Etsy title and confirmed facts, bounded by Unicode code points',()=>{
 const source=product(7);source.title='😀'.repeat(110)+' https://drive.google.com/SECRET';
 const content=model.buildPinContent(source,{confirmed:false,subject:'Invented subject'});assert.equal(Array.from(content.title).length,100);assert.equal(content.link,'https://www.etsy.com/listing/7');assert.match(content.description,/Digital STL file/);assert.match(content.description,/No physical item/);assert.doesNotMatch(JSON.stringify(content),/PRIVATE_TOKEN|Private Buyer|drive\.google|private@example|Invented subject/);
 assert.match(model.buildPinContent(product(7),{confirmed:true,subject:'A fox sculpture',appearance:'A curled tail'}).alt_text,/A fox sculpture\. A curled tail/);
 assert.throws(()=>model.buildPinContent({id:'wrong'}));assert.equal(model.pinterestPinURL('https://www.pinterest.com/pin/99/').id,'99');assert.equal(model.pinterestPinURL('https://www.pinterest.com/pin/99/?secret=1'),null);
});

test('daily boundary is Europe/Istanbul, including the UTC previous date',()=>{
 assert.equal(model.istanbulDay('2026-10-12T20:59:59Z'),'2026-10-12');assert.equal(model.istanbulDay('2026-10-12T21:00:00Z'),'2026-10-13');assert.throws(()=>model.istanbulDay('not-a-date'));
});

test('prepare is deterministic, reuses its visible group and handles zero, one or two products',async t=>{
 for(const count of [0,1,2,5])await t.test(String(count),async t=>{const h=fixture(t,{products:Array.from({length:count},(_,i)=>product(i+1,count-i))});await h.store.prepare();const first=h.store.status().preview;assert.equal(first.length,Math.min(3,count));assert.deepEqual(first.map(j=>j.listingId),Array.from({length:Math.min(3,count)},(_,i)=>String(count-i)));await h.store.prepare();assert.deepEqual(h.store.status().preview.map(j=>j.id),first.map(j=>j.id));assert.equal(h.creates.length,0);assert.equal(h.images.length,0);assert.match(h.store.status().selectionMethod,/En eski/);});
});

test('invalid primary metadata blocks the item without selecting its next image',async t=>{
 const products=[product(1),product(2),product(3)];products[0].images=[{...image(500),rank:2}];products[1].images=[image(501),image(502)];products[2].state='inactive';const h=fixture(t,{products});await h.store.prepare();assert.equal(h.store.status().preview.length,0);assert.equal(h.store.status().blocked.length,2);assert.equal(h.creates.length,0);
});

test('explicit physical Etsy items never receive digital STL pin content',async t=>{
 const physical=product(1);physical.listingType='physical';const digital=product(2);digital.listingType='download';const h=fixture(t,{products:[physical,digital]});await h.store.prepare();assert.deepEqual(h.store.status().preview.map(j=>j.listingId),['2']);assert.match(h.store.status().blocked[0].reason,/Fiziksel/);h.snapshot.products[1].listingType='physical';await h.send();assert.equal(h.creates.length,0);assert.equal(h.store.status().jobs[0].status,'skipped');
});

test('prepare replaces stale ready previews with freshly selected image and content',async t=>{
 const h=fixture(t,{products:[product(1)]});await h.store.prepare();const first=h.store.status().preview[0];h.snapshot.products[0].title='Updated Etsy title';h.snapshot.products[0].images=[image(7777)];const result=await h.store.prepare();assert.equal(result.busy,false);assert.equal(result.canSend,true);assert.equal(result.preview.length,1);assert.notEqual(result.preview[0].id,first.id);assert.equal(result.preview[0].imageId,'7777');assert.equal(result.preview[0].title,'Updated Etsy title');assert.equal(result.jobs[0].status,'skipped');h.snapshot.products[0].state='inactive';await h.store.prepare();assert.equal(h.store.status().preview.length,0);assert.equal(h.creates.length,0);
});

test('send uses original first-image bytes, Etsy target and durable dispatch journal before POST',async t=>{
 const h=fixture(t,{products:[product(1)],createPin:async(payload,options,h)=>{
  const before=JSON.parse(fs.readFileSync(h.file));assert.equal(before.jobs[0].status,'sending');assert.equal(before.jobs[0].dispatchedAt,undefined);
  await options.onDispatch();const journal=JSON.parse(fs.readFileSync(h.file));assert.equal(journal.jobs[0].status,'sending');assert.ok(journal.jobs[0].dispatchedAt);assert.equal(journal.jobs[0].sourceUrl,image(1001).url_fullxfull);assert.equal(journal.jobs[0].mediaSha256,crypto.createHash('sha256').update(Buffer.from([0xff,0xd8,0xff,1,2,3])).digest('hex'));return {id:'9001',board_id:payload.board_id,link:payload.link};
 }});await h.store.prepare();await h.send();assert.deepEqual(h.images,[image(1001).url_fullxfull]);const payload=h.creates[0];assert.equal(payload.media_source.source_type,'image_base64');assert.deepEqual(Buffer.from(payload.media_source.data,'base64'),Buffer.from([0xff,0xd8,0xff,1,2,3]));assert.equal(payload.link,'https://www.etsy.com/listing/1');assert.equal(payload.board_id,'30');assert.doesNotMatch(JSON.stringify(payload),/drive|PRIVATE_TOKEN|Private Buyer|private@example/);assert.equal(h.store.status().successfulToday,1);assert.equal(fs.statSync(h.file).mode&0o777,0o600);assert.ok(h.refreshes>=4);
});

test('two successes plus a known failure allow only one additional success and never restart history',async t=>{
 let failed=false;const h=fixture(t,{createPin:async(payload,options,h)=>{await options.onDispatch();if(payload.link.endsWith('/3')&&!failed){failed=true;throw Object.assign(Error('raw secret provider body'),{kind:'item',status:400,requestDispatched:true});}return {id:String(9000+h.creates.length),board_id:payload.board_id,link:payload.link};}});
 await h.store.prepare();await h.send();let status=h.store.status();assert.equal(status.successfulToday,2);assert.equal(status.reservedToday,0);assert.equal(status.remaining,1);assert.deepEqual(status.jobs.map(j=>j.status),['succeeded','succeeded','failed']);await h.store.prepare();assert.deepEqual(h.store.status().preview.map(j=>j.listingId),['4']);await h.send();assert.equal(h.store.status().successfulToday,3);await h.store.prepare();assert.equal(h.store.status().preview.length,0);assert.equal(h.creates.length,4);
 const reopened=h.reopen();assert.equal(reopened.status().successfulToday,3);assert.equal(reopened.status().remaining,0);h.time+=86400000;await reopened.prepare();assert.deepEqual(reopened.status().preview.map(j=>j.listingId),['5']);const failedJob=reopened.status().jobs.find(j=>j.status==='failed');await reopened.retry(failedJob.id);assert.deepEqual(reopened.status().preview.map(j=>j.listingId),['5','3']);assert.equal(h.creates.length,4,'retry only prepares; it does not POST');
});

test('an in-flight request across Istanbul midnight consumes the new success day and prevents a fourth pin',async t=>{
 const h=fixture(t,{createPin:async(payload,options,h)=>{await options.onDispatch();if(h.creates.length===1)h.time+=2000;return {id:String(9000+h.creates.length),board_id:payload.board_id,link:payload.link,created_at:new Date(h.time).toISOString()};}});h.time=Date.parse('2026-10-12T20:59:59Z');await h.store.prepare();await h.send();const status=h.store.status();assert.equal(status.day,'2026-10-13');assert.equal(status.successfulToday,3);assert.equal(status.remaining,0);assert.equal(status.jobs[0].day,'2026-10-13');assert.equal(model.istanbulDay(status.jobs[0].dispatchedAt),'2026-10-12');await h.store.prepare();assert.equal(h.store.status().preview.length,0);assert.equal(h.creates.length,3);assert.equal(h.reopen().status().successfulToday,3);
});

test('listing identity survives title, image and board changes, and belongs to the account and shop',async t=>{
 const h=fixture(t,{products:[product(1)]});await h.store.prepare();await h.send();h.snapshot.products[0].title='New title';h.snapshot.products[0].images=[image(7001)];h.context.boardId='31';h.context.generation++;await h.store.prepare();assert.equal(h.store.status().preview.length,0);assert.equal(h.store.status().successfulToday,1);
 h.context.accountId='21';h.context.generation++;await h.store.prepare();assert.deepEqual(h.store.status().preview.map(j=>j.listingId),['1']);assert.equal(h.store.status().successfulToday,0);h.context.shopId='11';h.snapshot.shopId='11';h.context.generation++;await h.store.prepare();assert.equal(h.store.status().preview.length,1);assert.equal(h.store.status().preview[0].shopId,'11');
});

test('exact displayed job IDs are required, rejecting stale, partial and duplicated groups',async t=>{
 const h=fixture(t);await h.store.prepare();const ids=h.store.status().preview.map(j=>j.id);for(const values of [[ids[0]],['old',ids[1],ids[2]],[ids[0],ids[0],ids[2]],[]])await assert.rejects(h.store.send({jobIds:values}),/tam iş kimlikleri/);assert.equal(h.creates.length,0);assert.equal(h.images.length,0);
});

test('double clicks and a second store cannot send or overwrite an active journal; stop reaches the sender',async t=>{
 const started=deferred(),finish=deferred();const h=fixture(t,{createPin:async(payload,options)=>{await options.onDispatch();started.resolve();await finish.promise;return {id:'9001',board_id:payload.board_id,link:payload.link};}});await h.store.prepare();const second=h.reopen(),ids=h.store.status().preview.map(j=>j.id),sending=h.store.send({jobIds:ids});await started.promise;
 await assert.rejects(second.send({jobIds:ids}),error=>error.kind==='busy');await assert.rejects(h.send(),error=>error.kind==='busy');await assert.rejects(second.prepare(),error=>error.kind==='busy');assert.throws(()=>second.exclude('1'),error=>error.kind==='busy');assert.throws(()=>second.markExternal({listingId:'1'}),error=>error.kind==='busy');assert.equal(second.stop().stopping,true);finish.resolve();await sending;
 const status=h.store.status();assert.equal(h.creates.length,1);assert.equal(status.successfulToday,1);assert.deepEqual(status.jobs.map(j=>j.status),['succeeded','skipped','skipped']);assert.equal(status.busy,false);assert.equal(second.status().successfulToday,1);
});

test('dry-run has no image fetch or createPin and never consumes production history or capacity',async t=>{
 const h=fixture(t,{products:[product(1),product(2)]});await h.store.prepare({dryRun:true});await h.send({dryRun:true});let status=h.store.status({dryRun:true});assert.equal(h.creates.length,0);assert.equal(h.images.length,0);assert.equal(status.successfulToday,0);assert.equal(status.reservedToday,0);assert.equal(status.remaining,3);assert.ok(status.jobs.every(j=>j.environment==='dry-run'&&j.simulated));assert.equal(h.store.status().jobs.length,0);await h.store.prepare();assert.equal(h.store.status().preview.length,2);await h.send();assert.equal(h.store.status().successfulToday,2);assert.equal(h.store.status({dryRun:true}).successfulToday,0);
 const disconnected=fixture(t,{products:[product(1)],context:{accountId:null,boardId:null,connected:false,accessReady:false,tier:'unknown'}});await disconnected.store.prepare({dryRun:true});await disconnected.send({dryRun:true});assert.equal(disconnected.creates.length,0);assert.equal(disconnected.store.status({dryRun:true}).jobs[0].accountId,'dry-run');assert.ok(disconnected.store.status().blockReason);
});

test('sandbox results stay separate and unknown or Trial production access blocks sends',async t=>{
 const h=fixture(t,{products:[product(1)],context:{environment:'sandbox',tier:'trial',tierSource:'user-declared'}});await h.store.prepare();await h.send();assert.equal(h.creates.length,1);assert.equal(h.store.status().successfulToday,0);assert.equal(h.store.status().remaining,3);assert.equal(h.store.status().jobs[0].environment,'sandbox');h.context.environment='production';h.context.generation++;await h.store.prepare();await assert.rejects(h.send());assert.equal(h.creates.length,1);h.context.tier='unknown';assert.ok(h.store.status().blockReason);h.context.accountId=null;h.context.accountUsername='api-only-username';assert.match(h.store.status().blockReason,/sayısal hesap/);
});

test('global auth, scope, board and 429 failures stop the group; item errors allow partial success',async t=>{
 for(const [kind,status] of [['auth',401],['scope',403],['board',404],['rate-limit',429]])await t.test(kind,async t=>{const h=fixture(t,{createPin:async(payload,options)=>{await options.onDispatch();throw Object.assign(Error('unsafe provider token SECRET'),{kind,status,requestDispatched:true,retryAt:'2026-10-12T09:01:00Z'});}});await h.store.prepare();await h.send();assert.equal(h.creates.length,1);assert.deepEqual(h.store.status().jobs.map(j=>j.status),['failed','ready','ready']);assert.equal(h.store.status().reservedToday,0);assert.ok(h.store.status().blockReason);assert.doesNotMatch(JSON.stringify(h.store.status()),/SECRET/);await assert.rejects(h.send());if(kind==='rate-limit'){h.context.boardId='31';h.context.generation++;assert.ok(h.store.status().blockReason,'board change must not bypass global 429');h.time+=61000;assert.equal(h.store.status().blockReason,null);}});
 const h=fixture(t,{fetchImage:async(url,h)=>{if(url===image(1001).url_fullxfull)throw Object.assign(Error('broken image'),{kind:'item'});return {content_type:'image/png',data:Buffer.from([0x89,0x50,0x4e,0x47])};}});await h.store.prepare();await h.send();assert.equal(h.creates.length,2);assert.equal(h.store.status().successfulToday,2);assert.deepEqual(h.store.status().jobs.map(j=>j.status),['failed','succeeded','succeeded']);
});

test('freshness, active listing, exact image, content, scopes and target are checked again after media fetch',async t=>{
 const changes={inactive:h=>{h.snapshot.products[0].state='inactive';},image:h=>{h.snapshot.products[0].images=[image(7001)];},title:h=>{h.snapshot.products[0].title='Changed';},scopes:h=>{h.context.scopes=[];},target:h=>{h.context.boardId='31';h.context.generation++;}};
 for(const [name,change] of Object.entries(changes))await t.test(name,async t=>{const h=fixture(t,{products:[product(1)],fetchImage:async(url,h)=>{change(h);return {content_type:'image/jpeg',data:Buffer.from([0xff,0xd8,0xff])};}});await h.store.prepare();await h.send();assert.equal(h.creates.length,0);assert.notEqual(h.store.export().jobs[0].status,'succeeded');});
 const stale=fixture(t,{products:[product(1)]});stale.snapshotRefresh=()=>({...stale.snapshot,updated:'2026-10-01T00:00:00Z'});await assert.rejects(stale.store.prepare(),/eski/);assert.equal(stale.creates.length,0);
});

test('dispatch callback rechecks late scope and image changes without sending a POST',async t=>{
 for(const change of [h=>{h.context.scopes=[];},h=>{h.snapshot.products[0].images=[image(7777)];}])await t.test('late change',async t=>{let posted=false;const h=fixture(t,{products:[product(1)],createPin:async(payload,options,h)=>{change(h);await options.onDispatch();posted=true;return {id:'9001',board_id:payload.board_id,link:payload.link};}});await h.store.prepare();await h.send();assert.equal(posted,false);assert.equal(h.store.export().jobs[0].dispatchedAt,undefined);assert.equal(h.store.status().reservedToday,0);});
});

test('a local stale/409 after dispatch stays uncertain and retains account-wide capacity',async t=>{
 const h=fixture(t,{products:[product(1)],createPin:async(payload,options,h)=>{await options.onDispatch();h.context.boardId='31';h.context.generation++;throw Object.assign(Error('local target changed'),{kind:'stale',status:409,requestDispatched:true,uncertain:true});}});await h.store.prepare();await h.send();assert.equal(h.store.status().jobs[0].status,'uncertain');assert.equal(h.store.status().reservedToday,1);assert.equal(h.store.status().remaining,2);await h.store.prepare();assert.equal(h.store.status().preview.length,0);assert.equal(h.creates.length,1);assert.equal(h.reopen().status().reservedToday,1);
});

test('uncertain results survive restart and old days, and require explicit reconciliation and retry',async t=>{
 const h=fixture(t,{createPin:async(payload,options)=>{await options.onDispatch();throw Object.assign(Error('timeout'),{kind:'network',requestDispatched:true});},boardPins:async()=>({items:[{id:'77',board_id:'30',link:'https://www.etsy.com/listing/1'},{id:'78',board_id:'30',link:'https://www.etsy.com/listing/2'}]})});await h.store.prepare();await h.send();const job=h.store.status().jobs[0];assert.equal(job.status,'uncertain');assert.equal(h.store.status().reservedToday,1);await assert.rejects(h.store.retry(job.id));const reopened=h.reopen();assert.equal(h.creates.length,1);assert.equal(reopened.status().reservedToday,1);h.time+=86400000;await reopened.prepare();assert.equal(reopened.status().remaining,2);assert.equal(reopened.status().preview.length,2);const match=await reopened.reconcile(job.id);assert.equal(match.candidates.length,1);assert.equal(match.conclusive,false);assert.equal(reopened.status().reservedToday,1);await assert.rejects(reopened.resolve({jobId:job.id,outcome:'not-created'}),/doğrulamalısın/);await reopened.resolve({jobId:job.id,outcome:'not-created',confirmed:true});assert.equal(reopened.status().reservedToday,0);assert.equal(h.creates.length,1);await reopened.retry(job.id);assert.equal(reopened.status().preview.length,3);assert.equal(reopened.status().jobs.at(-1).retryOf,job.id);assert.equal(h.creates.length,1);
});

test('user-selected pin resolution verifies ownership, board and listing, or labels missing read permission',async t=>{
 const h=fixture(t,{products:[product(1)],createPin:async(payload,options)=>{await options.onDispatch();throw Object.assign(Error('timeout'),{kind:'network',requestDispatched:true});},getPin:async()=>({id:'77',board_id:'31',link:'https://www.etsy.com/listing/1',is_owner:true})});await h.store.prepare();await h.send();const job=h.store.status().jobs[0];await assert.rejects(h.store.resolve({jobId:job.id,outcome:'pin-created',pinUrl:'https://www.pinterest.com/pin/77/',confirmed:true}),/doğrulanamadı/);assert.equal(h.store.status().reservedToday,1);h.hooks.getPin=async()=>{throw Object.assign(Error('no read'),{kind:'scope'});};await h.store.resolve({jobId:job.id,outcome:'pin-created',pinUrl:'https://www.pinterest.com/pin/77/',confirmed:true});assert.equal(h.store.status().jobs[0].resolutionSource,'user-confirmed');assert.equal(h.store.status().successfulToday,1);assert.equal(h.store.status().reservedToday,0);assert.equal(h.creates.length,1);
 const verified=fixture(t,{products:[product(1)],createPin:h.hooks.createPin,getPin:async()=>({id:'88',board_id:'30',link:'https://www.etsy.com/listing/1',is_owner:true,account_id:'20'})});await verified.store.prepare();await verified.send();await verified.store.resolve({jobId:verified.store.status().jobs[0].id,outcome:'pin-created',pinUrl:'https://www.pinterest.com/pin/88/',confirmed:true});assert.equal(verified.store.status().jobs[0].resolutionSource,'api-verified-user-selected');
});

test('exclusions and explicit outside shares are account-associated, board-independent and not successes',async t=>{
 const h=fixture(t,{products:[product(1),product(2),product(3)]});h.store.exclude('1');h.store.markExternal({listingId:'2',pinUrl:'https://www.pinterest.com/pin/77/'});await h.store.prepare();assert.deepEqual(h.store.status().preview.map(j=>j.listingId),['3']);assert.equal(h.store.status().successfulToday,0);h.context.boardId='31';h.context.generation++;await h.store.prepare();assert.deepEqual(h.store.status().preview.map(j=>j.listingId),['3']);h.store.exclude('1',false);await h.store.prepare();assert.deepEqual(h.store.status().preview.map(j=>j.listingId),['3','1']);assert.throws(()=>h.store.markExternal({listingId:'2',pinUrl:'https://evil.test/pin/77/'}));h.context.accountId='21';h.context.generation++;await h.store.prepare();assert.equal(h.store.status().preview.length,3);assert.equal(h.store.status().external.length,0);assert.equal(h.store.status().exclusions.length,0);
});

test('restart recovers dispatched sending as uncertain and pre-dispatch sending as failed, without POST',async t=>{
 const h=fixture(t,{products:[product(1),product(2)]});await h.store.prepare();const journal=JSON.parse(fs.readFileSync(h.file));for(const job of journal.jobs)Object.assign(job,{status:'sending',attemptedAt:new Date(h.time).toISOString(),day:model.istanbulDay(h.time)});journal.jobs[0].dispatchedAt=new Date(h.time).toISOString();fs.writeFileSync(h.file,JSON.stringify(journal));const reopened=h.reopen();assert.deepEqual(reopened.status().jobs.map(j=>j.status),['uncertain','failed']);assert.equal(reopened.status().reservedToday,1);assert.equal(h.creates.length,0);assert.equal(h.images.length,0);await reopened.prepare();assert.equal(reopened.status().preview.length,0);assert.equal(h.creates.length,0);
});

test('dispatch-journal disk failure prevents POST; success-write failure remains reserved after restart',async t=>{
 for(const failStatus of ['dispatch','succeeded'])await t.test(failStatus,async t=>{
  let posted=false;const h=fixture(t,{products:[product(1)],createPin:async(payload,options)=>{await options.onDispatch();posted=true;return {id:'9001',board_id:payload.board_id,link:payload.link};}});await h.store.prepare();const rename=fs.renameSync;t.mock.method(fs,'renameSync',(source,target)=>{if(target===h.file){const job=JSON.parse(fs.readFileSync(source)).jobs[0];if(failStatus==='dispatch'&&(job.status==='sending'&&job.dispatchedAt||job.status==='failed')||failStatus==='succeeded'&&['succeeded','uncertain'].includes(job.status))throw Object.assign(Error('simulated disk full'),{code:'ENOSPC'});}return rename(source,target);});await assert.rejects(h.send());assert.equal(posted,failStatus==='succeeded');assert.ok(h.store.status().error);assert.doesNotMatch(h.store.status().error,/Yeni istek gönderilmedi/);t.mock.restoreAll();const recovered=h.store.status();assert.equal(recovered.error,null);assert.equal(recovered.jobs[0].status,failStatus==='dispatch'?'failed':'uncertain');assert.equal(recovered.reservedToday,failStatus==='dispatch'?0:1);const reopened=h.reopen();assert.equal(reopened.status().jobs[0].status,recovered.jobs[0].status);assert.equal(h.creates.length,1);if(failStatus==='succeeded'){await h.store.resolve({jobId:recovered.jobs[0].id,outcome:'not-created',confirmed:true});assert.equal(h.store.status().jobs[0].status,'failed');assert.equal(h.creates.length,1,'same-process recovery enables manual resolution without reposting');}
 });
});

test('damaged or missing journals block safely and preserve existing 1.7 workspace files',async t=>{
 const h=fixture(t);for(const name of ['workspace.json','connection.json','old-export.json'])fs.writeFileSync(path.join(h.dir,name),'previous 1.7 user data '+name);const broken='{broken Pinterest journal';fs.writeFileSync(h.file,broken);const blocked=h.reopen();assert.match(blocked.status().error,/özgün dosya/);await assert.rejects(blocked.prepare());assert.throws(()=>blocked.exclude('1'));assert.equal(fs.readFileSync(h.file,'utf8'),broken);for(const name of ['workspace.json','connection.json','old-export.json'])assert.equal(fs.readFileSync(path.join(h.dir,name),'utf8'),'previous 1.7 user data '+name);
 const missing=fixture(t,{products:[product(1)]});await missing.store.prepare();await missing.send();fs.unlinkSync(missing.file);assert.ok(missing.reopen().status().error,'a missing authoritative journal with an existing backup must not reset history');
});

test('journal validation rejects malformed successes, invalid times and hidden production simulations',async t=>{
 const h=fixture(t,{products:[product(1)]});await h.store.prepare();await h.send();const original=JSON.parse(fs.readFileSync(h.file));assert.equal(validateState(original),true);for(const change of [job=>delete job.day,job=>delete job.pinId,job=>{job.dispatchedAt='INVALID';},job=>{job.day='2026-99-99';},job=>{job.simulated=true;},job=>{job.generation=-1;}]){const bad=COPY(original);change(bad.jobs[0]);assert.throws(()=>validateState(bad));}
 const injected=COPY(original);injected.access_token='PRIVATE_TOKEN';injected.jobs[0].refresh_token='PRIVATE_REFRESH';fs.writeFileSync(h.file,JSON.stringify(injected));h.context.access_token='CONTEXT_TOKEN';const reopened=h.reopen();assert.doesNotMatch(JSON.stringify(reopened.export()),/PRIVATE_TOKEN|PRIVATE_REFRESH/);assert.doesNotMatch(JSON.stringify(reopened.status()),/CONTEXT_TOKEN/);
});

test('Windows writes retain file fsync and atomic rename without unsupported directory fsync',async t=>{
 const h=fixture(t,{products:[product(1)]}),platform=Object.getOwnPropertyDescriptor(process,'platform'),open=fs.openSync,sync=fs.fsyncSync;let fileSyncs=0;t.after(()=>Object.defineProperty(process,'platform',platform));Object.defineProperty(process,'platform',{...platform,value:'win32'});t.mock.method(fs,'openSync',(file,flags,...args)=>{if(file===h.dir&&flags==='r')throw Object.assign(Error('directory handles cannot be flushed on Windows'),{code:'EPERM'});return open(file,flags,...args);});t.mock.method(fs,'fsyncSync',fd=>{assert.ok(fs.fstatSync(fd).isFile());fileSyncs++;return sync(fd);});await h.store.prepare();await h.send();assert.ok(fileSyncs>=3);assert.equal(h.store.status().successfulToday,1);assert.equal(h.store.status().error,null);
});
