'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createResearchSampler,handle}=require('./etsy');
const STAMP=Date.UTC(2026,9,12,12);
const row=(id,extra={})=>({listing_id:id,shop_id:10,title:'Ballerina model',type:'download',creation_timestamp:100,price:{amount:500,divisor:100,currency_code:'USD'},...extra});
function fixture(request){
 let ctx={generation:1,key:'fixture-key',secret:'not-exported'},now=STAMP;
 const sample=createResearchSampler({request,getContext:()=>({...ctx}),clock:()=>now,ensureCurrent:value=>{
  if(value.generation!==ctx.generation||value.key!==ctx.key){const e=Error('Hesap değişti; eski yanıt kaydedilmedi.');e.code='STALE_ACCOUNT';throw e;}
 }});
 return {sample,advance:ms=>{now+=ms;},changeAccount:()=>{ctx={generation:ctx.generation+1,key:'other-key',secret:'other-secret'};}};
}

test('Research sample reuses existing active-listing query and states its actual scope',async()=>{
 let route;
 const {sample}=fixture(async path=>{route=path;return {count:450,results:[row(1),row(1),row(2,{type:'physical'})]};});
 const result=await sample(' ballerina stl ');
 assert.equal(route,'/listings/active?keywords=ballerina%20stl&sort_on=created&sort_order=desc&limit=100&includes=Images');
 assert.equal(result.query,'ballerina stl');
 assert.equal(result.source,'etsy-public-api-sample');
 assert.equal(result.sort,'created-desc');
 assert.equal(result.sampleLimit,100);
 assert.equal(result.reportedListingCount,450);
 assert.equal(result.rawSampleSize,3);
 assert.equal(result.sampled,2);
 assert.equal(result.listings[1].type,'physical');
 assert.equal(result.searchCount,null);
 assert.equal(result.period,null);
 assert.equal(result.region,null);
 assert.equal(result.language,null);
 assert.equal(result.acquiredAt,new Date(STAMP).toISOString());
 assert.equal(JSON.stringify(result).includes('not-exported'),false);
 assert.equal(JSON.stringify(result).includes('fixture-key'),false);
});

test('Missing count and price remain unknown, while a reported real zero remains zero',async()=>{
 const {sample}=fixture(async()=>({results:[row(1,{price:null,shop_id:null}),row(undefined)]}));
 const unknown=await sample('model stl');
 assert.equal(unknown.reportedListingCount,null);
 assert.equal(unknown.listings[0].price,null);
 assert.equal(unknown.listings[0].shopId,null);
 assert.equal(unknown.sampled,1);
 const zero=await fixture(async()=>({count:0,results:[]})).sample('model stl');
 assert.equal(zero.reportedListingCount,0);
 assert.equal(zero.searchCount,null);
});

test('A provider ignoring limit cannot return more than 100 bounded listings',async()=>{
 const rows=Array.from({length:130},(_,i)=>row(i+1,{title:'x'.repeat(5000),images:[{url_570xN:'https://example.com/'+('x'.repeat(4000))}]}));
 const {sample}=fixture(async()=>({count:200,results:rows}));
 const result=await sample('model stl');
 assert.equal(result.sampled,100);
 assert.equal(result.rawSampleSize,130);
 assert.equal(result.truncated,true);
 assert.equal(result.listings[0].title.length,1000);
 assert.equal(result.listings[0].image.length,2048);
});

test('Sample cache preserves date, lasts 10 minutes, and cannot be mutated by its caller',async()=>{
 let calls=0;
 const f=fixture(async()=>{calls++;return {count:1,results:[row(1)]};});
 const first=await f.sample('model stl');first.listings[0].title='mutated';
 f.advance(9*60000);
 const saved=await f.sample(' model stl ');
 assert.equal(calls,1);
 assert.equal(saved.cached,true);
 assert.equal(saved.acquiredAt,new Date(STAMP).toISOString());
 assert.equal(saved.listings[0].title,'Ballerina model');
 f.advance(2*60000);
 assert.equal((await f.sample('model stl')).cached,false);
 assert.equal(calls,2);
 f.changeAccount();
 assert.equal((await f.sample('model stl')).cached,false);
 assert.equal(calls,3);
});

test('Concurrent identical requests share one public query',async()=>{
 let calls=0,release;
 const gate=new Promise(resolve=>{release=resolve;});
 const {sample}=fixture(async()=>{calls++;await gate;return {count:1,results:[row(1)]};});
 const first=sample('model stl'),second=sample('model stl');
 release();
 const results=await Promise.all([first,second]);
 assert.equal(calls,1);
 assert.deepEqual(results[0],results[1]);
});

test('Account change during a request rejects stale data and does not cache it for the new account',async()=>{
 let calls=0,release;
 const gate=new Promise(resolve=>{release=resolve;});
 const f=fixture(async()=>{calls++;if(calls===1)await gate;return {count:1,results:[row(1)]};});
 const old=f.sample('model stl');f.changeAccount();release();
 await assert.rejects(()=>old,error=>error.code==='STALE_ACCOUNT');
 assert.equal((await f.sample('model stl')).cached,false);
 assert.equal(calls,2);
});

test('Invalid or URL-shaped search inputs are rejected before any provider call',async()=>{
 let calls=0;
 const {sample}=fixture(async()=>{calls++;return {results:[]};});
 for(const query of ['', 'x', 'x'.repeat(101), 'model\nstl', 'https://drive.google.com/drive/folders/SECRET_FOLDER', null])await assert.rejects(()=>sample(query));
 assert.equal(calls,0);
});

test('Malformed and rate-limited responses do not become invented empty samples',async()=>{
 await assert.rejects(()=>fixture(async()=>({count:10})).sample('model stl'),/beklenen biçimde/);
 const error=Object.assign(Error('Etsy istek sınırı için bekleniyor.'),{status:429,retryAt:STAMP+60000});
 let calls=0;
 const {sample}=fixture(async()=>{calls++;throw error;});
 await assert.rejects(()=>sample('model stl'),e=>e.status===429&&e.retryAt===STAMP+60000);
 assert.equal(calls,1);
});

test('Research-sample handler inherits loopback/host checks and validates a single query',async()=>{
 async function request(address,host,path){
  let code,payload;
  const req={method:'GET',socket:{remoteAddress:address},headers:{host}};
  const res={writeHead:value=>{code=value;},end:value=>{payload=JSON.parse(value);}};
  await handle(req,res,new URL(path,'http://localhost:3000'));
  return {code,payload};
 }
 assert.equal((await request('192.168.1.8','localhost:3000','/api/etsy/research-sample?query=model')).code,403);
 assert.equal((await request('127.0.0.1','evil.example:3000','/api/etsy/research-sample?query=model')).code,403);
 assert.equal((await request('127.0.0.1','localhost:3000','/api/etsy/research-sample')).code,400);
 assert.equal((await request('127.0.0.1','localhost:3000','/api/etsy/research-sample?query=model&query=other')).code,400);
 assert.equal((await request('127.0.0.1','localhost:3000','/api/etsy/research-sample?query=x')).code,400);
});

test('Cross-origin browser requests cannot spend API quota; same-origin and native queries still work',t=>{
 const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'stl-research-origin-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 fs.writeFileSync(path.join(dir,'connection.json'),JSON.stringify({key:'fixture-key',secret:'fixture-secret'}));
 const script=String.raw`
  const assert=require('node:assert/strict');
  let calls=0;
  global.fetch=async(url,options)=>{
   assert.equal(options.headers['x-api-key'],'fixture-key:fixture-secret');calls++;
   return {ok:true,status:200,headers:{get:()=>null},json:async()=>({count:0,results:[]})};
  };
  const {handle}=require(process.argv[1]);
  async function request(headers,query='fixture model'){
   let code,payload;
   const req={method:'GET',socket:{remoteAddress:'127.0.0.1'},headers:{host:'localhost:3000',...headers}};
   const res={writeHead:value=>{code=value;},end:value=>{payload=JSON.parse(value);}};
   await handle(req,res,new URL('/api/etsy/research-sample?query='+encodeURIComponent(query),'http://localhost:3000'));
   return {code,payload};
  }
  (async()=>{
   const blocked=[
    {origin:'https://untrusted.example'},
    {origin:'null'},
    {origin:''},
    {'sec-fetch-site':'cross-site','sec-fetch-mode':'no-cors'},
    {'sec-fetch-site':'same-site','sec-fetch-mode':'cors'},
    {'sec-fetch-site':'none','sec-fetch-mode':'no-cors'},
    {'sec-fetch-site':'none','sec-fetch-mode':'navigate'},
    {'sec-fetch-site':'same-origin','sec-fetch-mode':'no-cors'},
    {origin:'http://localhost:4000','sec-fetch-site':'same-origin','sec-fetch-mode':'cors'}
   ];
   for(const headers of blocked){assert.equal((await request(headers)).code,403);assert.equal(calls,0);}
   assert.equal((await request({'sec-fetch-site':'same-origin','sec-fetch-mode':'cors'},'same origin model')).code,200);
   assert.equal((await request({origin:'http://localhost:3000','sec-fetch-site':'same-origin','sec-fetch-mode':'same-origin'},'explicit origin model')).code,200);
   assert.equal((await request({},'native model')).code,200);
   assert.equal(calls,3);
   process.stdout.write(JSON.stringify({blocked:blocked.length,calls}));
  })().catch(error=>{console.error(error);process.exitCode=1;});
 `;
 const result=spawnSync(process.execPath,['-e',script,path.join(__dirname,'etsy.js')],{env:{...process.env,STL_DATA_DIR:dir},encoding:'utf8',timeout:10000});
 assert.equal(result.status,0,result.stderr);assert.deepEqual(JSON.parse(result.stdout),{blocked:9,calls:3});
});
