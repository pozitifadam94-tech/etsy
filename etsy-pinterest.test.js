'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {execFile}=require('node:child_process'),{promisify}=require('node:util');
const run=promisify(execFile);
test('Pinterest freshness reads only active metadata and preserves stale sales timestamps/coverage',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'stl-pin-etsy-refresh-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 const earlier=new Date(Date.now()-86400000).toISOString(),dailyDate=earlier.slice(0,10);
 const old={id:111,title:'Old STL title',state:'active',listingType:'download',url:'https://www.etsy.com/listing/111',created:1700000000,daily:{[dailyDate]:3},dailyMoney:{[dailyDate]:{USD:6}},dailyOrders:{[dailyDate]:1},dailyLines:{[dailyDate]:1},moneyComplete:true,salesAvailable:true,periods:[{days:30,quantity:3}],price:{amount:200,divisor:100,currency_code:'USD'}};
 const snapshot={shopId:'901',updated:earlier,salesUpdated:earlier,products:[old],salesProducts:[],orderMeasuresAvailable:true,coverageBasis:'UTC'};
 await fs.writeFile(path.join(dir,'connection.json'),JSON.stringify({key:'fixtureKey',secret:'fixtureSecret',shopId:'901',shopName:'Fixture',tokens:{access_token:'42.fixture',refresh_token:'fixture-refresh'},expires:Date.now()+3600000,snapshot,lastSuccess:earlier}));
 const bootstrap=`
 const assert=require('node:assert/strict'),fs=require('node:fs');
 const {workspace}=require('./workspace'),store=workspace();store.activateShop('901');
 const original=JSON.parse(fs.readFileSync(process.env.STL_DATA_DIR+'/connection.json','utf8')).snapshot;store.capture(original);const before=store.status();
 const calls=[];global.fetch=async value=>{const url=new URL(value);calls.push(url.pathname);assert(!url.pathname.includes('/receipts'),'Pinterest must not refetch historical receipts');let body;
 if(url.pathname==='/v3/application/users/42/shops')body={shop_id:901,shop_name:'Fixture'};
 else if(url.pathname==='/v3/application/shops/901/listings')body={count:2,results:[111,222].map(id=>({listing_id:id,title:'Fresh STL '+id,state:'active',type:'download',original_creation_timestamp:1700000000,images:[{listing_image_id:500+id,rank:1,url_fullxfull:'https://i.etsystatic.com/'+id+'/il_fullxfull.jpg'}]}))};
 else throw Error('Unexpected fixture endpoint');return new Response(JSON.stringify(body),{status:200,headers:{'Content-Type':'application/json'}});};
 (async()=>{const etsy=require('./etsy'),fresh=await etsy.refreshForPinterest(),after=etsy.status(),history=store.status().history;
 assert.equal(fresh.products[0].primaryImage.imageId,'611');assert.equal(fresh.products[0].title,'Fresh STL 111');assert.equal(fresh.products[1].salesAvailable,false);
 assert.deepEqual(fresh.products[0].periods,original.products[0].periods);assert.deepEqual(fresh.products[0].daily,original.products[0].daily);
 assert.equal(after.snapshot.salesUpdated,original.salesUpdated);assert.equal(after.lastSuccess,original.salesUpdated);assert.equal(history.salesCaptured,before.history.salesCaptured);
 assert.deepEqual(history.products['111'].coverage,before.history.products['111'].coverage);assert(history.products['222'].coverage.length===0);
 assert.equal(calls.length,2);assert.equal(after.busy,false);console.log('metadata-only refresh preserved sales and used two reads');})();`;
 const value=await run(process.execPath,['-e',bootstrap],{cwd:__dirname,env:{...process.env,STL_DATA_DIR:dir},timeout:10000});
 assert.match(value.stdout,/metadata-only refresh preserved sales and used two reads/);
});
