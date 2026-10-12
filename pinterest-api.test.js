'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {Readable}=require('node:stream');
const {createPinterestController}=require('./pinterest');
function fixture(){
 const context={shopId:'901',accountId:'123',boardId:'456',environment:'production',generation:1,connected:true,configured:true,accessReady:true,tier:'standard',tierSource:'user-declared',boardPrivacy:'PUBLIC',scopes:['boards:read','boards:write','pins:read','pins:write','user_accounts:read']};
 let busy=false,sendCount=0,boardsCount=0,stopCount=0,resolveCount=0,finish;
 const store={status({dryRun=false}={}){return {schema:1,revision:0,context:dryRun?{...context,environment:'dry-run'}:{...context},busy,preview:[{id:'visible-job-1'},{id:'visible-job-2'}],jobs:[],successfulToday:0,reservedToday:0,remaining:3,blockReason:null};},send(){sendCount++;busy=true;return new Promise(resolve=>{finish=()=>{busy=false;resolve();};});},stop(){stopCount++;},resolve(value){resolveCount++;assert.equal(value.confirmed,true);},reconcile(){return {candidates:[],conclusive:false};},export(){return {jobs:[],source:'pinterest-sharing-public-records'};}};
 const client={context:()=>({...context}),status:()=>({...context,account:{id:'123',username:'fixture-account'}}),boards:async()=>{boardsCount++;return [{id:'456',name:'Fixture',privacy:'PUBLIC'}];},completeOAuth:async()=>{throw Error('PRIVATE_ACCESS_TOKEN https://drive.google.com/drive/folders/private-fixture');}};
 const etsy={status:()=>({connected:true,shopId:'901',snapshot:{shopId:'901',updated:new Date().toISOString(),products:[]}})};
 const workspace={status:()=>({activeShopId:'901',state:null})};
 const controller=createPinterestController({client,store,etsy,workspace});
 async function request(route,{method='GET',body,headers={},address='127.0.0.1'}={}){
  const req=Readable.from(body===undefined?[]:[Buffer.from(typeof body==='string'?body:JSON.stringify(body))]);req.method=method;req.socket={remoteAddress:address};req.headers={host:'localhost:3000',...(method==='POST'?{origin:'http://localhost:3000'}:{}),...headers};
  let code,value;const res={writeHead(status){code=status;},end(text=''){value=text?JSON.parse(text):null;}};
  await controller.handle(req,res,new URL(route,'http://localhost:3000'));return {code,value};
 }
 const pinned=()=>Object.fromEntries(['shopId','accountId','boardId','environment','generation'].map(key=>[key,context[key]]));
 return {request,context,pinned,finish:()=>finish?.(),counts:()=>({sendCount,boardsCount,stopCount,resolveCount})};
}
test('Pinterest outbound board reads reject cross-origin embeds, wrong host/socket and preserve local requests',async()=>{
 const f=fixture();
 for(const options of [{headers:{origin:'https://untrusted.example'}},{headers:{'sec-fetch-site':'cross-site'}},{headers:{'sec-fetch-mode':'no-cors'}},{headers:{'sec-fetch-mode':'navigate'}},{headers:{host:'untrusted.example:3000'}},{address:'203.0.113.4'}])assert.equal((await f.request('/api/pinterest/boards',options)).code,403);
 assert.equal(f.counts().boardsCount,0);
 assert.equal((await f.request('/api/pinterest/boards')).code,200);
 assert.equal((await f.request('/api/pinterest/boards',{headers:{origin:'http://localhost:3000','sec-fetch-site':'same-origin','sec-fetch-mode':'cors'}})).code,200);
 assert.equal(f.counts().boardsCount,2);
});
test('Posting requires local Origin and the exact displayed context and complete visible group',async()=>{
 const f=fixture(),body={expectedContext:f.pinned(),shopId:'901',jobIds:['visible-job-1','visible-job-2']};
 assert.equal((await f.request('/api/pinterest/send',{method:'POST',body,headers:{origin:'https://untrusted.example'}})).code,403);
 assert.equal((await f.request('/api/pinterest/send',{method:'POST',body:{...body,shopId:'902'}})).code,409);
 assert.equal((await f.request('/api/pinterest/send',{method:'POST',body:{...body,expectedContext:{...body.expectedContext,boardId:'789'}}})).code,409);
 assert.equal((await f.request('/api/pinterest/send',{method:'POST',body:{...body,jobIds:['visible-job-1']}})).code,409);
 assert.equal(f.counts().sendCount,0);
 assert.equal((await f.request('/api/pinterest/send',{method:'POST',body})).code,202);
 assert.equal((await f.request('/api/pinterest/send',{method:'POST',body})).code,409,'second tab cannot initiate another active sender');
 assert.equal(f.counts().sendCount,1);f.finish();
});
test('Dry-run uses its separate context and cannot silently change real exclusions or old-share history',async()=>{
 const f=fixture(),dry={...f.pinned(),environment:'dry-run'};
 const view=await f.request('/api/pinterest/status?dryRun=1');assert.equal(view.value.context.environment,'dry-run');assert.equal(view.value.connection.environment,'production');
 const body={dryRun:true,expectedContext:f.pinned(),jobIds:['visible-job-1','visible-job-2']};
 assert.equal((await f.request('/api/pinterest/send',{method:'POST',body})).code,409);
 for(const route of ['exclude','external'])assert.equal((await f.request('/api/pinterest/'+route,{method:'POST',body:{dryRun:true,expectedContext:dry,listingId:'70001',value:true}})).code,400);
 assert.equal(f.counts().sendCount,0);
});
test('Provider exception text, OAuth callback code and pasted secrets never appear in route errors',async()=>{
 const f=fixture();
 for(const [route,options] of [['/oauth/pinterest/callback?code=PRIVATE_CALLBACK_CODE&state=PRIVATE_STATE',{}],['/api/pinterest/oauth-complete',{method:'POST',body:{code:'PRIVATE_CALLBACK_CODE',state:'PRIVATE_STATE'}}]]){
  const result=await f.request(route,options);assert.equal(result.code,400);
  assert.doesNotMatch(JSON.stringify(result.value),/PRIVATE_|drive\.google|private-fixture/);
 }
});
test('Uncertain resolution requires an explicit decision and stop remains an operation without deletion',async()=>{
 const f=fixture(),body={expectedContext:f.pinned(),jobId:'uncertain-job',outcome:'not-created'};
 assert.equal((await f.request('/api/pinterest/resolve',{method:'POST',body})).code,400);assert.equal(f.counts().resolveCount,0);
 assert.equal((await f.request('/api/pinterest/resolve',{method:'POST',body:{...body,notCreatedConfirmed:true}})).code,200);assert.equal(f.counts().resolveCount,1);
 assert.equal((await f.request('/api/pinterest/stop',{method:'POST',body:{expectedContext:f.pinned()}})).code,200);assert.equal(f.counts().stopCount,1);assert.equal(f.counts().sendCount,0);
});
test('Malformed and oversized command bodies fail before any provider or sender operation',async()=>{
 const f=fixture();
 for(const body of ['{broken','[]','{"__proto__":{}}'])assert.equal((await f.request('/api/pinterest/send',{method:'POST',body})).code,400);
 assert.equal((await f.request('/api/pinterest/send',{method:'POST',body:'x'.repeat(16385)})).code,413);
 assert.deepEqual(f.counts(),{sendCount:0,boardsCount:0,stopCount:0,resolveCount:0});
});
