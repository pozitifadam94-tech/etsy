const test=require('node:test');const assert=require('node:assert/strict');
const {captureHistory}=require('./history');const {createWorkspace}=require('./workspace');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const now=Date.parse('2026-10-10T12:00:00Z');
const state=()=>({niches:[],listings:[],candidates:[]});
const snapshot=(products,extra={})=>({updated:new Date(now).toISOString(),salesUpdated:new Date(now).toISOString(),products,...extra});
const p=(id=1,q=3)=>({id,title:'Test STL',created:Math.floor((now-100*86400000)/1000),daily:{'2026-10-09':q},dailyMoney:{'2026-10-09':{USD:q*2}},moneyComplete:true,salesAvailable:true});
test('Geçmiş eski günleri tutar; yeniden alınan dönem düzeltmeleri toplamda ikinci kez sayılmaz',()=>{
 let h=captureHistory(null,snapshot([p()]),now);h.products['1'].daily['2026-01-01']=8;h.products['1'].coverage.push('2026-01-01');
 h=captureHistory(h,snapshot([p(1,2)]),now);
 assert.equal(h.products['1'].daily['2026-10-09'],2);assert.equal(h.products['1'].daily['2026-01-01'],8);
 assert(!h.products['1'].coverage.includes('2026-10-10'));assert(!h.products['1'].coverage.includes('2026-07-12'));
});
test('Pasif ürün ve aktif olmayan satış ürünleri kaybolmaz; boş başarılı satış günleri bilinen sıfırdır',()=>{
 let h=captureHistory(null,snapshot([p()]),now);h=captureHistory(h,snapshot([],{salesProducts:[p(2,5)]}),now);
 assert.equal(h.products['1'].active,false);assert.equal(h.products['1'].daily['2026-10-09'],0);assert.equal(h.products['2'].daily['2026-10-09'],5);
});
test('Satış aşaması başarısızsa eski satışlar ve kapsam korunur; değişiklikler tekilleşir',()=>{
 let h=captureHistory(null,snapshot([p()]),now);const o={id:'1:test',product:'1',fields:['title'],observedAt:new Date(now).toISOString(),previousObservedAt:new Date(now-60000).toISOString()};
 h=captureHistory(h,snapshot([{...p(),salesAvailable:false,daily:{}}],{salesUpdated:null,observations:[o]}),now);
 h=captureHistory(h,snapshot([{...p(),salesAvailable:false,daily:{}}],{salesUpdated:null,observations:[o]}),now);
 assert.equal(h.products['1'].daily['2026-10-09'],3);assert.equal(h.observations.length,1);assert.equal(h.salesCaptured,new Date(now).toISOString());
});
test('Ortak depo yeniden açılır; yedekte anahtar yok; eski revizyon ve bozuk geri yükleme kayıtları değiştirmez',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'stl-store-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const store=createWorkspace(dir);store.put(state(),0);store.capture(snapshot([p()]));
 const revision=store.status().revision;assert.throws(()=>store.put(state(),0),/Başka bir sekme/);
 assert.throws(()=>store.restore({...store.export(),history:{}},revision),/Geçersiz/);
 assert.equal(store.status().revision,revision);assert.equal(createWorkspace(dir).status().history.products['1'].daily['2026-10-09'],3);
 assert(!JSON.stringify(store.export()).includes('access_token'));
 const before=store.export();store.put({...state(),fileChecks:[]},revision);store.restore(before,revision+1);
 assert(store.status().backups.some(b=>b.name.includes('before-restore')));assert.equal(store.status().state.niches.length,0);
});
test('Tarayıcı taşıması mevcut ortak kaydı ezmez ve farklı eski kaydı yedekler',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'stl-migrate-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const store=createWorkspace(dir);store.migrate(state());const different={...state(),niches:[{id:'a',name:'Eski',query:'old stl',competition:null}]};
 store.migrate(different);assert.equal(store.status().state.niches.length,0);assert(store.status().backups.some(b=>b.name.includes('browser-migration')));
 const revision=store.status().revision;store.migrate(different);assert.equal(store.status().revision,revision);
 assert.throws(()=>store.readBackup('../connection.json'),/bulunamadı/);
});
test('Bozuk depo sessizce sıfırlanmaz; geçerli yedekten onarılırken özgün dosya korunur',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'stl-recover-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const original=createWorkspace(dir);original.put(state(),0);const backupName=original.status().backups[0].name;
 const broken='{broken JSON';fs.writeFileSync(path.join(dir,'workspace.json'),broken);
 const store=createWorkspace(dir);assert.match(store.status().error,/okunamıyor/);assert.throws(()=>store.put(state(),0),/okunamıyor/);assert.equal(fs.readFileSync(path.join(dir,'workspace.json'),'utf8'),broken);
 store.restore(store.readBackup(backupName),0);assert.equal(store.status().error,null);assert.equal(createWorkspace(dir).status().state.niches.length,0);
 const recovery=fs.readdirSync(path.join(dir,'recovery'));assert.equal(fs.readFileSync(path.join(dir,'recovery',recovery[0]),'utf8'),broken);
});
