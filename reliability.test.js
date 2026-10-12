const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{execFileSync}=require('node:child_process');
function isolated(t,script){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'stl-account-race-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const prelude=`const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');const dir=process.env.STL_DATA_DIR;const {Readable}=require('node:stream');const config={key:'synthetickey',secret:'syntheticsecret',tokens:{access_token:'99.synthetic',refresh_token:'synthetic'},expires:Date.now()+3600000,shopId:'101',shopName:'Synthetic',lastSuccess:'2026-01-01T00:00:00Z'};
const request=(etsy,route,input)=>new Promise((resolve,reject)=>{const req=Readable.from([Buffer.from(JSON.stringify(input))]);req.method='POST';req.headers={host:'localhost:3000',origin:'http://localhost:3000'};req.socket={remoteAddress:'127.0.0.1'};const res={writeHead(code){this.code=code;},end(value){resolve({status:this.code,body:JSON.parse(value)});}};etsy.handle(req,res,new URL(route,'http://localhost:3000')).catch(reject);});
const reply=value=>({ok:true,status:200,headers:new Headers(),json:async()=>value});`;
 return execFileSync(process.execPath,['-e',prelude+';(async()=>{'+script+'})().catch(e=>{console.error(e);process.exitCode=1;});'],{cwd:__dirname,env:{...process.env,STL_DATA_DIR:dir},encoding:'utf8',timeout:15000});
}
test('Hesap değişimi sonrası geç Etsy yanıtı kayıtlı mağaza geçmişini değiştirmez',t=>{
 isolated(t,`
 fs.writeFileSync(path.join(dir,'connection.json'),JSON.stringify(config));const store=require('./workspace').workspace();store.activateShop('101');store.put({niches:[],listings:[],candidates:[]},store.status().revision);
 const stamp=new Date().toISOString();store.capture({shopId:'101',updated:stamp,salesUpdated:stamp,products:[{id:1,title:'Protected',daily:{'2026-01-01':3},dailyMoney:{},salesAvailable:true}]});const protectedScope=JSON.stringify(store.status().shops['101']);
 let release,started;const ready=new Promise(resolve=>started=resolve);global.fetch=async()=>{started();return new Promise(resolve=>release=()=>resolve(reply({shop_id:101,shop_name:'Old'})));};
 const etsy=require('./etsy'),pending=etsy.sync();await ready;const changed=await request(etsy,'/api/etsy/config',{key:'newsynthetickey',secret:'newsyntheticsecret'});assert.equal(changed.status,200);release();await pending;
 assert.equal(etsy.status().connected,false);assert.equal(etsy.status().snapshot,null);assert.equal(store.status().activeShopId,null);assert.equal(JSON.stringify(store.status().shops['101']),protectedScope);assert.equal(store.status().history.products['1'],undefined);
 `);
});
test('Satış ağ hatası son sağlam günlük geçmişi ve son başarı zamanını korur',t=>{
 isolated(t,`
 fs.writeFileSync(path.join(dir,'connection.json'),JSON.stringify(config));const store=require('./workspace').workspace();store.activateShop('101');const now=Date.now(),date=new Date(now-86400000).toISOString().slice(0,10),stamp=new Date(now).toISOString();
 store.capture({shopId:'101',updated:stamp,salesUpdated:stamp,products:[{id:1,title:'Protected',daily:{[date]:3},dailyMoney:{},salesAvailable:true}]});
 global.fetch=async url=>{if(url.includes('/users/'))return reply({shop_id:101,shop_name:'Synthetic'});if(url.includes('/listings'))return reply({count:1,results:[{listing_id:1,title:'Protected',creation_timestamp:Math.floor(now/1000)-100*86400}]});throw Error('Synthetic offline sales');};
 const etsy=require('./etsy');await etsy.sync();assert.equal(store.status().history.products['1'].daily[date],3);assert.equal(etsy.status().lastSuccess,'2026-01-01T00:00:00Z');assert(etsy.status().lastAttempt);assert.match(etsy.status().error,/Satışlar/);assert.equal(etsy.status().snapshot.products[0].salesAvailable,false);
 `);
});
test('429 ve kota başlıkları kontrollü beklemeye dönüşür; bekleme sırasında yeni ağ isteği yapılmaz',t=>{
 isolated(t,`
 let calls=0;global.fetch=async()=>{calls++;return {ok:false,status:429,headers:new Headers({'retry-after':'120','x-remaining-today':'0','x-limit-per-day':'10000'})};};const etsy=require('./etsy');
 await assert.rejects(()=>etsy.jsonFetch('https://example.invalid/mock'),e=>e.status===429&&e.retryAt>Date.now());await assert.rejects(()=>etsy.jsonFetch('https://example.invalid/mock'),e=>e.status===429);assert.equal(calls,1);assert.equal(etsy.status().quota.remainingDay,'0');assert(etsy.status().retryAfter>Date.now());
 `);
});
test('Bozuk bağlantı programı durdurmaz; yalnız açık yeniden ayarlamada özgün dosya korunur',t=>{
 isolated(t,`
 const broken='{invalid connection';fs.writeFileSync(path.join(dir,'connection.json'),broken);global.fetch=()=>{throw Error('No network expected');};const etsy=require('./etsy');assert.match(etsy.status().error,/okunamıyor/);assert.equal(fs.readFileSync(path.join(dir,'connection.json'),'utf8'),broken);
 const result=await request(etsy,'/api/etsy/config',{key:'newsynthetickey',secret:'newsyntheticsecret'});assert.equal(result.status,200);assert.equal(etsy.status().error,null);const files=fs.readdirSync(path.join(dir,'recovery'));assert.equal(fs.readFileSync(path.join(dir,'recovery',files[0]),'utf8'),broken);
 `);
});
