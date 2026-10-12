const test=require('node:test');
const assert=require('node:assert/strict');
const compose=require('./public/listing-compose');
const preparation=require('./public/preparation');
const NOW='2026-10-12T10:00:00.000Z';
const DELIVERY={deliveryFolderUrl:'https://drive.google.com/drive/folders/PRIVATE_FOLDER_12345678',contents:[{name:'ballerina.stl'},{name:'base.stl'}],contentConfirmedAt:NOW};
const metric=(value,state='exact')=>({state,value,raw:value===null?'':String(value),bound:null});
function study(){return {schema:1,id:'study-example',productId:'local-12345678-1234-1234-1234-123456789abc',shopId:'12345',name:'Balerin araştırması',createdAt:NOW,updatedAt:NOW,facts:{subject:'ballerina figurine',appearance:'A standing dancer in a ballet pose',style:'classical sculpture',kind:'set',modelCount:1,contents:['ballerina.stl','base.stl'],formats:['STL'],technical:[],technicalConfirmed:false,purpose:'3D printing',audience:'ballet enthusiasts',confirmedAt:NOW},images:[{url:'https://images.example/FDM-compatible-print-tested.webp'}],candidates:[{id:'keyword-a',phrase:'ballerina stl',sources:[{kind:'product-facts',description:'Ürün konusu',sourceUrl:'',acquiredAt:NOW,referenceIds:[]}],relevance:'relevant',relevanceReason:'Konu ve dijital format uygun.',intent:'digital'},{id:'keyword-b',phrase:'ballet dancer stl',sources:[{kind:'user',description:'Kullanıcı ifadesi',sourceUrl:'',acquiredAt:NOW,referenceIds:[]}],relevance:'relevant',relevanceReason:'Kullanıcının açıkladığı balerin konusuna uygun.',intent:'digital'}],observations:[],samples:[],selection:{primary:{candidateId:'keyword-a',reason:'Doğrudan ürün konusu ve formatı.'},supporting:[{candidateId:'keyword-b',reason:'Uygun alternatif; arama verisi henüz yok.'}],alternatives:[],rejected:{}},drafts:[],activeDraftId:null,publishedLink:null};}
function observation(id,start,value){return {id,phrase:'ballerina stl',source:'marketplace-insights-user',sourceUrl:'https://help.etsy.com/hc/en-us/articles/35122361353239?secret=never-share',sourceDescription:'Kullanıcının aktardığı Marketplace Insights',acquiredAt:NOW,period:{label:start+' dönemi',start,end:start},searches:metric(value,value===null?'missing':'exact'),listings:metric(0),region:null,language:null,method:'table',raw:'',missing:value===null?['Arama sayısı bilinmiyor.']:[]};}

test('new local product produces an honest English draft without 13-tag padding or inferred model count',()=>{
 const input=study(),before=JSON.stringify(input),draft=compose.generate(input,{delivery:DELIVERY,now:NOW});
 assert.equal(JSON.stringify(input),before);
 assert.equal(draft.origin,'local');
 assert(draft.title.includes('ballerina stl'));
 assert(draft.titleAlternatives.length<=2);
 assert(draft.tags.length<13);
 assert.equal(new Set(draft.tags.map(value=>value.toLowerCase())).size,draft.tags.length);
 assert(draft.tags.every(value=>Array.from(value).length<=20));
 assert(draft.missing.some(value=>value.includes('etiket eksik')));
 assert(draft.researchLabel.includes('arama verisiyle doğrulanmamış'));
 assert(draft.description.includes('This set contains 1 model.'));
 assert(!draft.description.includes('2 models'));
 assert(draft.description.includes('ballerina.stl'));
 assert(draft.description.includes(preparation.commonDeliveryParagraph()));
 assert(!/FDM-compatible|print-tested/.test(draft.description));
 assert.equal(draft.categorySuggestion.id,null);
 assert.equal(draft.categorySuggestion.name,null);
 assert.deepEqual(draft.attributes,[]);
 assert(draft.warnings.some(value=>value.includes('yerel taslak sınırları')));
 assert.match(draft.basis.signature,/^sig-v1-[0-9a-f]{32}$/);
});

test('unconfirmed technical prose is excluded locally; affirmative owner-confirmed claims are distinct from negatives',()=>{
 const input=study();input.facts.appearance='Print-tested FDM compatible ballerina';input.facts.technical=['pre-supported','FDM compatible','commercial license'];
 const draft=compose.generate(input,{delivery:DELIVERY,now:NOW});
 assert(!/print-tested|FDM compatible|pre-supported|commercial license/i.test(draft.description));
 assert(draft.missing.some(value=>value.includes('Teknik özellikler doğrulanmamış')));
 input.facts.appearance='A standing dancer';input.facts.technicalConfirmed=true;
 const confirmed=compose.generate(input,{delivery:DELIVERY,now:NOW});
 assert(confirmed.description.includes('FDM compatible'));
 assert(!confirmed.warnings.some(value=>value.includes('doğrulanmamış FDM')));
 input.facts.technical=['Not FDM compatible'];
 const output=compose.parseAI(JSON.stringify({title:'Ballerina STL',tags:['ballerina stl'],description:'This model is FDM compatible.'}),input,{delivery:DELIVERY,now:NOW});
 assert(output.ok);
 assert(output.warnings.some(value=>value.includes('doğrulanmamış FDM')));
});

test('confirmed negative permission and exact scale do not verify contradictory AI claims',()=>{
 const input=study();input.facts.technical=['Commercial use is not permitted','Scale 1:6'];input.facts.technicalConfirmed=true;
 const before=JSON.stringify(input);
 const output=compose.parseAI(JSON.stringify({title:'Ballerina STL',tags:['ballerina stl','dancer sculpture'],description:'Commercial use is permitted. This model is supplied in 1:12 scale.'}),input,{delivery:DELIVERY,now:NOW});
 assert(output.ok);
 assert(output.warnings.some(value=>value.includes('doğrulanmamış ticari kullanım/lisans')));
 assert(output.warnings.some(value=>value.includes('doğrulanmamış ölçek')));
 assert(output.draft.missing.some(value=>value.includes('manuel olarak incelenmeden')));
 assert.deepEqual(output.newKeywords,['dancer sculpture']);
 assert.equal(JSON.stringify(input),before);
 const saved=compose.save(input,output.draft);
 assert.deepEqual(saved.observations,input.observations);
 assert.deepEqual(saved.selection,input.selection);
 assert.deepEqual(saved.candidates,input.candidates);
});

test('technical claim verification preserves polarity, subtype, printer details and licence scope',()=>{
 const cases=[
  {fact:'FDM compatible: no',claim:'This model is FDM compatible.',category:'FDM'},
  {fact:'FDM compatible',claim:'This model is not FDM compatible.',category:'FDM'},
  {fact:'Pre-supported files are not included',claim:'The files are pre-supported.',category:'destek'},
  {fact:'Pre-supported',claim:'No supports are required.',category:'destek'},
  {fact:'Support-free',claim:'The files are pre-supported.',category:'destek'},
  {fact:'Print-tested',claim:'Tested on a Prusa printer.',category:'baskı testi'},
  {fact:'Print-tested on an Ender 3 printer',claim:'Print-tested on a Prusa MK4 printer.',category:'baskı testi'},
  {fact:'FDM compatible',claim:'FDM compatible with every printer.',category:'FDM'},
  {fact:'FDM ready',claim:'FDM optimized for a 0.2 mm nozzle.',category:'FDM'},
  {fact:'Resin compatible',claim:'SLA compatible.',category:'reçine/SLA'},
  {fact:'Resin compatible with standard grey resin',claim:'Resin compatible with flexible resin.',category:'reçine/SLA'},
  {fact:'Commercial license for physical prints only',claim:'Commercial license for physical prints and digital files.',category:'ticari kullanım/lisans'},
  {fact:'Commercial use is permitted; physical prints only',claim:'Commercial use is permitted.',category:'ticari kullanım/lisans'},
  {fact:'Commercial use is permitted. Physical prints only.',claim:'Commercial use is permitted.',category:'ticari kullanım/lisans'},
  {fact:'Commercial use is permitted\nfor physical prints only',claim:'Commercial use is permitted.',category:'ticari kullanım/lisans'},
  {fact:'Commercial license for physical prints only',claim:'You may sell STL files.',category:'ticari kullanım/lisans'},
  {fact:'Scale 1:6',claim:'A digital model in 1 : 12 scale.',category:'ölçek'}
 ];
 for(const {fact,claim,category} of cases){
  const input=study();input.facts.technical=[fact];input.facts.technicalConfirmed=true;
  const output=compose.parseAI(JSON.stringify({title:'Ballerina STL',tags:['ballerina stl'],description:claim}),input,{delivery:DELIVERY,now:NOW});
  assert(output.ok,claim);
  assert(output.warnings.some(value=>value.includes('doğrulanmamış '+category)),fact+' must not verify '+claim);
 }
});

test('local confirmed statements retain positive details and natural negative restrictions',()=>{
 const input=study();input.facts.technicalConfirmed=true;
 input.facts.technical=['FDM compatible','Pre-supported','Print-tested on an Ender 3 printer','Scale 1:6','Commercial license\nfor physical prints only'];
 const positive=compose.generate(input,{delivery:DELIVERY,now:NOW});
 for(const fact of input.facts.technical)assert(positive.description.includes(fact.replace(/\s+/g,' ')));
 assert(!positive.warnings.some(value=>value.startsWith('Manuel inceleme: doğrulanmamış')));
 const natural=compose.parseAI(JSON.stringify({title:'Ballerina STL',tags:['ballerina stl'],description:'This model is FDM compatible.\nThe files are pre-supported.'}),input,{delivery:DELIVERY,now:NOW});
 assert(natural.ok);
 assert(!natural.warnings.some(value=>value.startsWith('Manuel inceleme: doğrulanmamış')));
 input.facts.technical=['Commercial use is not permitted','Not FDM compatible','Pre-supported files are not included'];
 const negative=compose.generate(input,{delivery:DELIVERY,now:NOW});
 for(const fact of input.facts.technical)assert(negative.description.includes(fact));
 assert(!negative.warnings.some(value=>value.startsWith('Manuel inceleme: doğrulanmamış')));
 const naturalNegative=compose.parseAI(JSON.stringify({title:'Ballerina STL',tags:['ballerina stl'],description:'Commercial use is not permitted.\nThis model is not FDM compatible.\nPre-supported files are not included.'}),input,{delivery:DELIVERY,now:NOW});
 assert(naturalNegative.ok);
 assert(!naturalNegative.warnings.some(value=>value.startsWith('Manuel inceleme: doğrulanmamış')));
});

test('private delivery URLs and identifiers are excluded across drafts, full research, report and prompt',()=>{
 const input=study(),secret=DELIVERY.deliveryFolderUrl,id='PRIVATE_FOLDER_12345678';
 input.name+=' '+secret;
 input.facts.appearance='A dancer '+secret+' artist@example.com';
 input.candidates[0].relevanceReason+=' '+secret;
 input.candidates[0].sources.push({kind:'user',description:'Owner '+secret,sourceUrl:secret,acquiredAt:NOW,referenceIds:[]});
 input.selection.primary.reason+=' '+id;
 input.observations=[observation('obs-a','2026-10-01',null)];
 input.observations[0].raw=JSON.stringify({private:secret,encoded:encodeURIComponent(secret),escaped:secret.replaceAll('/','\\/'),hint:id});
 input.samples=[{id:'sample-a',query:'ballerina stl '+secret,acquiredAt:NOW,listings:[{id:'987654321',title:secret,image:secret}]}];
 const draft=compose.generate(input,{delivery:DELIVERY,now:NOW});
 const saved=compose.save(input,draft),report=compose.exportReport(saved,{delivery:DELIVERY}),prompt=compose.buildPrompt(saved,{delivery:DELIVERY});
 for(const value of [JSON.stringify(draft),JSON.stringify(report),prompt]){assert(!value.includes(secret));assert(!value.includes(id));assert(!value.includes(encodeURIComponent(secret)));assert(!value.includes('artist@example.com'));}
 assert.equal(report.research.observations[0].sourceUrl,'https://help.etsy.com/hc/en-us/articles/35122361353239');
 assert(prompt.includes('Görseller anlamsal olarak analiz edilmedi'));
 assert(prompt.includes('kendin ayrıca ekle'));
 assert.equal(report.research.observations[0].searches.value,null);
 assert.equal(report.research.observations[0].listings.value,0);
});

test('draft versions retain immutable evidence periods and original basis after research changes and manual edits',()=>{
 const input=study();input.observations=[observation('obs-a','2026-10-01',0),observation('obs-b','2026-10-08',14)];
 const first=compose.generate(input,{delivery:DELIVERY,now:NOW});
 let saved=compose.save(input,first);
 assert(first.researchLabel.includes('Marketplace Insights'));
 assert.deepEqual(first.basis.observations.map(value=>value.searches.value),[0,14]);
 saved.observations.push(observation('obs-c','2026-10-12',22));
 saved.selection.primary.reason='Yeni seçim nedeni';
 const edited=compose.edit(saved,saved.activeDraftId,{title:'Ballerina STL — Digital Figurine File'},{delivery:DELIVERY,now:'2026-10-12T11:00:00.000Z'});
 assert.equal(edited.origin,'manual');
 assert.equal(edited.basis.signature,first.basis.signature);
 assert.equal(edited.basis.observations.length,2);
 assert.notEqual(edited.basis.selection.primary.reason,saved.selection.primary.reason);
 const next=compose.save(saved,edited);
 assert.equal(next.drafts.length,2);
 assert.equal(next.drafts[0].title,first.title);
 assert.equal(next.observations.length,3);
 assert.equal(saved.drafts.length,1);
 const reopening=JSON.parse(JSON.stringify(next));
 assert.equal(reopening.activeDraftId,next.activeDraftId);
 assert.equal(reopening.drafts[1].basis.observations[0].period.start,'2026-10-01');
 assert.equal(reopening.drafts[1].basis.observations[1].period.start,'2026-10-08');
 const large=study();large.observations=[observation('obs-large','2026-10-01',1234567890)];
 const largeDraft=compose.generate(large,{delivery:DELIVERY,now:NOW});
 assert.equal(largeDraft.basis.observations[0].searches.raw,'1234567890');
 assert.equal(largeDraft.basis.observations[0].acquiredAt,NOW);
});

test('invalid AI leaves all research unchanged; valid new AI terms are unresearched and unsupported claims require review',()=>{
 const input=study(),before=JSON.stringify(input);
 for(const value of ['alert("bad")','{"title":null,"tags":[],"description":"a"}',JSON.stringify({title:'STL',tags:['same','Same'],description:'a'}),JSON.stringify({title:'STL',tags:[],description:'a',observations:[]}),JSON.stringify({title:'STL',tags:[],description:'a',categorySuggestion:{name:'Sculptures',id:123}})]){
  const result=compose.parseAI(value,input,{delivery:DELIVERY,now:NOW});assert.equal(result.ok,false);assert.equal(result.draft,null);assert.equal(JSON.stringify(input),before);
 }
 const result=compose.parseAI(JSON.stringify({title:'Ballerina STL',titleAlternatives:['Ballet Dancer STL'],tags:['ballerina stl','ballet gift stl'],description:'A pre-supported, print-tested ballerina with a commercial license.'}),input,{delivery:DELIVERY,now:NOW});
 assert(result.ok);
 assert.deepEqual(result.newKeywords,['ballet gift stl']);
 assert(result.warnings.some(value=>value.includes('Yeni AI ifadeleri araştırılmadı')));
 assert(result.warnings.some(value=>value.includes('doğrulanmamış destek')));
 assert(result.warnings.some(value=>value.includes('doğrulanmamış baskı testi')));
 assert(result.warnings.some(value=>value.includes('ticari kullanım')));
 assert.equal(JSON.stringify(input),before);
 const saved=compose.save(input,result.draft);
 assert.equal(saved.candidates.length,input.candidates.length);
 assert.deepEqual(saved.observations,input.observations);
 assert.deepEqual(saved.selection,input.selection);
 assert(saved.drafts[0].description.includes(preparation.commonDeliveryParagraph()));
});

test('known incorrect delivery claims are rejected and long/repeated tags remain validation errors',()=>{
 const input=study();
 for(const description of ['Download the STL files directly from Etsy.','The TXT has a link to the Etsy listing.']){
  const result=compose.parseAI(JSON.stringify({title:'Ballerina STL',tags:['ballerina stl'],description}),input,{delivery:DELIVERY,now:NOW});
  assert.equal(result.ok,false);assert(result.errors.some(value=>value.includes('Teslim')));
 }
 const negated=compose.parseAI(JSON.stringify({title:'Ballerina STL',tags:['ballerina stl'],description:'You cannot download the STL directly from Etsy.'}),input,{delivery:DELIVERY,now:NOW});
 assert.equal(negated.ok,true);
 const longTag=compose.parseAI(JSON.stringify({title:'Ballerina STL',tags:['a'.repeat(21)],description:'Digital model.'}),input,{now:NOW});
 assert.equal(longTag.ok,false);
 const tooMany=compose.parseAI(JSON.stringify({title:'Ballerina STL',tags:Array.from({length:14},(_,i)=>'tag '+i),description:'Digital model.'}),input,{now:NOW});
 assert.equal(tooMany.ok,false);
});

test('real research engine accepts a new-product draft, saved versions and published initial snapshot after reopening',()=>{
 const research=require('./public/listing-research'),importer=require('./public/insights-import');
 let input=research.createStudy({id:'local-new-product',title:'Ballerina'},{shopId:'',delivery:DELIVERY,now:NOW});
 input=research.updateFacts(input,{subject:'ballerina',kind:'set',modelCount:1,formats:['STL']},NOW);
 input=research.buildCandidates(input);
 const primary=input.candidates.find(value=>value.phrase==='ballerina stl');
 input=research.choose(input,primary.id,'primary','Ürüne uygun; gerçek veri aşağıda ayrı kaydedildi.');
 const preview=importer.fromRows([{phrase:'ballerina stl',searches:'<10',listings:'0'}],{periodLabel:'Kaynağın bildirdiği dönem',periodStart:'2026-10-01',periodEnd:'2026-10-07',acquiredAt:NOW});
 assert.deepEqual(preview.errors,[]);
 input=research.importObservations(input,preview.rows);
 const saved=compose.save(input,compose.generate(input,{delivery:DELIVERY,now:NOW}));
 const reopened=JSON.parse(JSON.stringify(saved));
 assert.doesNotThrow(()=>research.validate({schema:1,studies:{[reopened.id]:reopened}}));
 assert.equal(reopened.drafts[0].basis.observations[0].searches.state,'threshold');
 assert.equal(reopened.drafts[0].basis.observations[0].searches.value,null);
 assert.equal(reopened.drafts[0].basis.observations[0].listings.value,0);
 const edited=compose.save(reopened,compose.edit(reopened,reopened.activeDraftId,{description:reopened.drafts[0].description+'\n\nPlease check the included file list.'},{delivery:DELIVERY,now:'2026-10-12T11:00:00.000Z'}));
 assert.doesNotThrow(()=>research.validate({schema:1,studies:{[edited.id]:edited}}));
 const linked=research.linkListing(edited,'987654321',{now:'2026-10-12T12:00:00.000Z'});
 assert.equal(linked.publishedLink.initialDraft.id,edited.activeDraftId);
 assert.equal(linked.publishedLink.initialDraft.basis.signature,edited.drafts[0].basis.signature);
 assert.equal(linked.publishedLink.targetSelection.primary.candidateId,primary.id);
});
