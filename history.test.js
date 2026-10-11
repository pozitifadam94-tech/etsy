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
test('Mağaza bölümleri ayrıdır; belirsiz eski kayıt korunur ve tekrar açılışta çoğalmaz',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'stl-scopes-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const store=createWorkspace(dir);store.put(state(),0);store.capture(snapshot([p(8,7)]));
 store.activateShop('101');assert.equal(store.status().legacySummary.length,1);assert.deepEqual(store.status().history.products,{});
 store.capture(snapshot([p(1,3)],{shopId:'101'}));const a=store.status().history.products['1'].daily['2026-10-09'];
 store.activateShop('202');store.capture(snapshot([p(2,9)],{shopId:'202'}));
 assert.equal(store.status().shops['101'].history.products['1'].daily['2026-10-09'],a);assert.equal(store.status().history.products['1'],undefined);
 assert.throws(()=>store.capture(snapshot([p(1,99)],{shopId:'101'})),/Geç yanıt/);assert.equal(store.status().history.products['2'].daily['2026-10-09'],9);
 store.activateShop('101');assert.equal(store.status().history.products['1'].daily['2026-10-09'],3);assert.equal(store.status().history.products['8'],undefined);
 const reopened=createWorkspace(dir);assert.equal(reopened.status().legacySummary.length,1);assert.equal(reopened.status().migrationSteps.filter(x=>x==='shop-isolation-v2').length,1);
 reopened.activateShop('101');assert.equal(reopened.status().legacySummary.length,1);assert.equal(reopened.export().unassignedLegacy[0].data.history.products['8'].daily['2026-10-09'],7);
});
test('Eski kayıt ataması açık onay gerektirir; tekrar onay çoğaltmaz ve özgün arşiv kalır',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'stl-claim-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const store=createWorkspace(dir);store.put(state(),0);store.capture(snapshot([p(8,7)]));store.activateShop('101');store.capture(snapshot([p(1,3)],{shopId:'101'}));
 const id=store.status().legacySummary[0].id;assert.throws(()=>store.claimLegacy(id,'202',store.status().revision),/bağlı mağazaya/);
 store.claimLegacy(id,'101',store.status().revision);assert.equal(store.status().history.products['8'].daily['2026-10-09'],7);assert.equal(store.status().history.products['1'].daily['2026-10-09'],3);
 const rev=store.status().revision;store.claimLegacy(id,'101',rev);assert.equal(store.status().revision,rev);assert.equal(store.status().unassignedLegacy.length,1);assert.equal(store.status().legacySummary[0].claimedTo,'101');
});
test('Başka mağazanın yedeği bağlı mağazanın görünümüne yazılmaz; belirsiz yedek ayrılır',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'stl-restore-scope-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const store=createWorkspace(dir);store.activateShop('101');store.capture(snapshot([p(1,3)],{shopId:'101'}));const a=store.export();
 store.activateShop('202');store.capture(snapshot([p(2,9)],{shopId:'202'}));store.restore(a,store.status().revision);
 assert.equal(store.status().activeShopId,'202');assert.equal(store.status().history.products['2'].daily['2026-10-09'],9);assert.equal(store.status().history.products['1'],undefined);assert.equal(store.status().shops['101'].history.products['1'].daily['2026-10-09'],3);
 const legacy={schema:1,state:state(),history:captureHistory(null,snapshot([p(8,7)]),now),research:[],dismissed:[]};
 store.restore(legacy,store.status().revision);assert.equal(store.status().activeShopId,'202');assert.equal(store.status().history.products['8'],undefined);assert.equal(store.status().unassignedLegacy[0].data.history.products['8'].daily['2026-10-09'],7);
});
test('Kesilen atomik yazma önceki dosyayı ve bellekteki kaydı korur',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'stl-cut-write-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const store=createWorkspace(dir);store.put(state(),0);const previous=fs.readFileSync(path.join(dir,'workspace.json'),'utf8'),rename=fs.renameSync;
 fs.renameSync=(from,to)=>{if(to===path.join(dir,'workspace.json'))throw Error('Temsili disk hatası');return rename(from,to);};
 try{assert.throws(()=>store.put({...state(),fileChecks:[]},1),/disk hatası/);}finally{fs.renameSync=rename;}
 assert.equal(store.status().revision,1);assert.equal(fs.readFileSync(path.join(dir,'workspace.json'),'utf8'),previous);assert.equal(fs.readdirSync(dir).filter(x=>x.endsWith('.tmp')).length,0);
});
test('Yeni sipariş/satır ölçüleri geçmiş olmayan günler için uydurulmaz',()=>{
 const h=captureHistory(null,snapshot([{...p(),dailyOrders:{'2026-10-09':1},dailyLines:{'2026-10-09':2}}],{shopId:'101',orderMeasuresAvailable:true}),now);
 assert.equal(h.products['1'].dailyOrders['2026-10-09'],1);assert.equal(h.products['1'].dailyLines['2026-10-09'],2);assert.equal(h.products['1'].daily['2026-10-09'],3);assert(!h.products['1'].orderCoverage.includes('2026-01-01'));assert.equal(h.coverageBasis,'UTC');
});
test('Güncel revizyon olsa bile eski mağazaya ait bekleyen arayüz kaydı reddedilir',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'stl-ui-scope-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const store=createWorkspace(dir);
 store.activateShop('101');store.put(state(),store.status().revision,'101');store.activateShop('202');const revision=store.status().revision;
 assert.throws(()=>store.put({...state(),fileChecks:[]},revision,'101'),e=>e.status===409&&/Mağaza değişti/.test(e.message));assert.equal(store.status().revision,revision);assert.equal(store.status().state,null);
 assert.throws(()=>store.put(state(),revision,null),/Mağaza değişti/);store.put(state(),revision,'202');assert.equal(store.status().state.niches.length,0);
});
test('Bozuk depoyu farklı mağaza yedeğiyle onarmak bağlı hesabı değiştirmez',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'stl-recovery-scope-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const original=createWorkspace(dir);original.activateShop('202');original.capture(snapshot([p(2,9)],{shopId:'202'}));const backup=original.export();fs.writeFileSync(path.join(dir,'workspace.json'),'{broken');
 const recovering=createWorkspace(dir);recovering.restore(backup,0,'101');assert.equal(recovering.status().activeShopId,'101');assert.equal(recovering.status().history.products['2'],undefined);assert.equal(recovering.status().shops['202'].history.products['2'].daily['2026-10-09'],9);assert.equal(recovering.status().error,null);
});
test('Geri yüklenen aktif, pasif ve belirsiz bölüm durumları aynı izin listesiyle temizlenir',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'stl-restore-state-clean-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const store=createWorkspace(dir);store.activateShop('101');
 const localScope=(id,name)=>({state:{...state(),niches:[{id:'n-'+name,name,query:name+' stl',competition:null}],tokens:{access_token:'synthetic-sensitive-'+name},key:'synthetic-key-'+name,unknown:'unapproved-state-'+name},history:{products:{},observations:[],firstCaptured:null,lastCaptured:null,salesCaptured:null,coverageBasis:'UTC',...(id?{shopId:id}:{})},research:[],dismissed:[]});
 const current=localScope('101','active'),inactive=localScope('202','inactive'),unknown=localScope(null,'legacy');
 const bundle={schema:1,storageVersion:2,activeShopId:'101',...current,shops:{'101':current,'202':inactive},unassignedLegacy:[{id:'legacy-clean',source:'browser-v1',data:unknown}]};
 store.restore(bundle,store.status().revision);const output=store.export();
 for(const entry of [output,output.shops['101'],output.shops['202'],output.unassignedLegacy[0].data]){assert.equal(entry.state.tokens,undefined);assert.equal(entry.state.key,undefined);assert.equal(entry.state.unknown,undefined);assert.equal(entry.state.niches.length,1);}
 assert(!JSON.stringify(output).includes('synthetic-sensitive-'));assert(!JSON.stringify(output).includes('synthetic-key-'));
 const reopened=createWorkspace(dir);assert.equal(reopened.status().error,null);assert.equal(reopened.export().shops['202'].state.niches[0].name,'inactive');
 const persisted=JSON.parse(fs.readFileSync(path.join(dir,'workspace.json'),'utf8'));persisted.state.tokens={access_token:'synthetic-load-sensitive'};persisted.shops['202'].state.key='synthetic-load-key';persisted.unassignedLegacy[0].data.state.tokens={refresh_token:'synthetic-legacy-load'};fs.writeFileSync(path.join(dir,'workspace.json'),JSON.stringify(persisted));
 const loaded=createWorkspace(dir).export();assert(!JSON.stringify(loaded).includes('synthetic-load-sensitive'));assert(!JSON.stringify(loaded).includes('synthetic-load-key'));assert(!JSON.stringify(loaded).includes('synthetic-legacy-load'));assert.equal(loaded.state.niches[0].name,'active');
});
test('Bağlantısız A kaydı varken taşınan B kaydı normal dışa aktarımda korunur ve tekrar çoğalmaz',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'stl-browser-legacy-export-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const store=createWorkspace(dir);
 const a={...state(),niches:[{id:'a',name:'A',query:'a stl',competition:null}]},b={...state(),niches:[{id:'b',name:'B',query:'b stl',competition:null}]};
 store.migrate(a);store.migrate(b);const before=store.export();assert.equal(before.state.niches[0].name,'A');assert.equal(before.unassignedLegacy.length,1);assert.equal(before.unassignedLegacy[0].data.state.niches[0].name,'B');
 const revision=store.status().revision;store.migrate(b);assert.equal(store.status().revision,revision);assert.equal(store.export().unassignedLegacy.length,1);
 const reopened=createWorkspace(dir);reopened.migrate(b);assert.equal(reopened.export().unassignedLegacy.length,1);assert.equal(reopened.status().revision,revision);
 reopened.activateShop('101');const bEntry=reopened.export().unassignedLegacy.find(item=>item.data.state.niches[0]?.name==='B');assert(bEntry);reopened.claimLegacy(bEntry.id,'101',reopened.status().revision);assert.equal(reopened.status().state.niches[0].name,'B');
});
test('Sayısal eski mağaza kimlikleri yükleme ve geri yüklemede tutarlı metne dönüşür',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'stl-numeric-shop-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const store=createWorkspace(dir);store.activateShop('101');store.put(state(),store.status().revision,'101');
 const backup=store.export();backup.activeShopId=101;backup.history.shopId=101;backup.shops['101'].history.shopId=101;backup.unassignedLegacy=[{id:'old-numeric',source:'browser-v1',claimedTo:101,data:{state:state(),history:{products:{},observations:[],firstCaptured:null,lastCaptured:null,salesCaptured:null},research:[],dismissed:[]}}];
 store.restore(backup,store.status().revision);assert.equal(store.status().activeShopId,'101');assert.equal(store.status().history.shopId,'101');assert.equal(store.status().unassignedLegacy[0].claimedTo,'101');store.put(state(),store.status().revision,'101');
 const persisted=JSON.parse(fs.readFileSync(path.join(dir,'workspace.json'),'utf8'));persisted.activeShopId=101;persisted.history.shopId=101;persisted.shops['101'].history.shopId=101;persisted.unassignedLegacy[0].claimedTo=101;fs.writeFileSync(path.join(dir,'workspace.json'),JSON.stringify(persisted));
 const reopened=createWorkspace(dir);assert.equal(reopened.status().activeShopId,'101');assert.equal(reopened.status().history.shopId,'101');assert.equal(reopened.status().unassignedLegacy[0].claimedTo,'101');reopened.put(state(),reopened.status().revision,'101');const revision=reopened.status().revision;reopened.claimLegacy('old-numeric','101',revision);assert.equal(reopened.status().revision,revision);
});
