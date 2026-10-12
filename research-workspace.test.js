const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createWorkspace}=require('./workspace');
const R=require('./public/listing-research');
const I=require('./public/insights-import');
const C=require('./public/listing-compose');
const at='2026-10-12T10:00:00.000Z';
function base(){return {niches:[],listings:[],candidates:[],experiments:[],changes:[],actions:[],families:{},support:[],inspections:{},ledger:[],shares:[]};}
function prepared(shopId='101'){
 let s=R.createStudy({id:'local-research-fixture',title:'Ballerina sculpture'},{shopId,now:at});
 s=R.updateFacts(s,{subject:'ballerina sculpture',appearance:'standing dancer',kind:'single',modelCount:1,formats:['STL'],contents:['ballerina.stl']},at);
 s=R.buildCandidates(s);
 const result=I.fromRows([{phrase:'ballerina stl',searches:'0',listings:'<10'},{phrase:'ballet dancer stl',searches:'',listings:'24'}],{acquiredAt:at,periodLabel:'September 2026',periodStart:'2026-09-01',periodEnd:'2026-09-30'});
 assert.equal(result.errors.length,0);
 s=R.importObservations(s,result.rows);
 s=R.choose(s,s.candidates.find(c=>c.phrase.toLowerCase()==='ballerina stl').id,'primary','Ürünle uyumlu; bu dönemin gerçek sıfırı korunur.');
 return C.save(s,C.generate(s,{now:at}));
}
test('Yeni ilan kimliği olmadan araştırma, kaynaklı metrik ve taslak ortak depoda yeniden açılır',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'stl-research-store-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const store=createWorkspace(dir);store.activateShop('101');const study=prepared(),state={...base(),listingResearch:{schema:1,studies:{[study.id]:study}}};
 store.put(state,store.status().revision,'101');
 const reopened=createWorkspace(dir),saved=reopened.status().state.listingResearch.studies[study.id];
 assert.deepEqual(saved,study);assert.match(saved.productId,/^local-/);assert.equal(saved.publishedLink,null);
 const exact=saved.observations.find(o=>o.phrase==='ballerina stl'),missing=saved.observations.find(o=>o.phrase==='ballet dancer stl');
 assert.equal(exact.searches.state,'exact');assert.equal(exact.searches.value,0);assert.equal(exact.listings.state,'threshold');assert.equal(exact.listings.value,null);
 assert.equal(missing.searches.state,'missing');assert.equal(missing.searches.value,null);assert.equal(missing.region,null);
 assert.deepEqual(saved.drafts[0].basis.observations,study.observations);
 assert.deepEqual(reopened.export().shops['101'].state.listingResearch,state.listingResearch);
 const changed=R.updateFacts(saved,{appearance:'seated dancer'},'2026-10-12T11:00:00Z');
 assert.equal(changed.drafts[0].basis.facts.appearance,'standing dancer','geçmiş taslak önceki ürün bilgisini korumalı');
});
test('Araştırmalar mağazalarda ayrı kalır; eski belirsiz yedek sahipli araştırmayı ezmez',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'stl-research-shops-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const store=createWorkspace(dir);store.activateShop('101');const study=prepared();
 store.put({...base(),listingResearch:{schema:1,studies:{[study.id]:study}}},store.status().revision,'101');
 store.activateShop('202');store.put(base(),store.status().revision,'202');
 assert.equal(store.status().state.listingResearch,undefined);
 assert.deepEqual(store.export().shops['101'].state.listingResearch.studies[study.id],study);
 assert.throws(()=>store.put({...base(),listingResearch:{schema:1,studies:{[study.id]:study}}},store.status().revision,'101'),e=>e.status===409);
 store.activateShop('101');const before=store.status().state.listingResearch;
 store.restore({schema:1,state:base(),history:{products:{},observations:[],firstCaptured:null,lastCaptured:null,salesCaptured:null},research:[],dismissed:[]},store.status().revision,'101');
 assert.deepEqual(store.status().state.listingResearch,before);
 assert(store.status().unassignedLegacy.length);
});
test('Bozuk araştırma sayısı kaydı depoyu değiştirmeden reddedilir',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'stl-research-invalid-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const store=createWorkspace(dir),study=prepared('');const state={...base(),listingResearch:{schema:1,studies:{[study.id]:study}}};store.put(state,store.status().revision,null);
 const before=fs.readFileSync(path.join(dir,'workspace.json'),'utf8'),bad=structuredClone(state);bad.listingResearch.studies[study.id].observations[0].searches={state:'missing',value:0,raw:'',bound:null};
 assert.throws(()=>store.put(bad,store.status().revision,null));
 assert.equal(fs.readFileSync(path.join(dir,'workspace.json'),'utf8'),before);
});
test('Çevrimdışı araştırma yalnız açık eski kayıt atamasından sonra bağlı mağazada görünür',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'stl-research-claim-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const store=createWorkspace(dir),study=prepared('');
 store.put({...base(),listingResearch:{schema:1,studies:{[study.id]:study}}},store.status().revision,null);
 store.activateShop('101');const preserved=store.status().unassignedLegacy[0];
 assert.equal(store.status().state,null,'bağlanmak tek başına eski araştırmaya sahiplik vermez');
 assert.deepEqual(preserved.data.state.listingResearch.studies[study.id],study);
 store.claimLegacy(preserved.id,'101',store.status().revision);
 const assigned=store.status().state.listingResearch.studies[study.id];
 assert.equal(assigned.shopId,'101');assert.deepEqual(assigned.drafts,study.drafts);
 assert.deepEqual(assigned.observations,study.observations);
 assert.deepEqual(store.status().unassignedLegacy[0].data.state.listingResearch.studies[study.id],study,'özgün belirsiz kopya korunur');
 assert.equal(createWorkspace(dir).status().state.listingResearch.studies[study.id].shopId,'101');
 store.activateShop('202');assert.equal(store.status().state,null);
});
test('Sahibi bilinen farklı mağazanın araştırması eski kayıt atamasıyla taşınmaz',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'stl-research-foreign-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const store=createWorkspace(dir),study=prepared('202');
 store.put({...base(),listingResearch:{schema:1,studies:{[study.id]:study}}},store.status().revision,null);
 store.activateShop('101');const prior=store.status(),id=prior.unassignedLegacy[0].id;
 assert.throws(()=>store.claimLegacy(id,'101',prior.revision),/farklı mağaza/);
 assert.deepEqual(store.status().state,prior.state);assert.equal(store.status().revision,prior.revision);
 assert.equal(store.status().unassignedLegacy[0].claimedTo,undefined);
});
