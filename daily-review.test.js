const test=require('node:test'),assert=require('node:assert/strict'),D=require('./public/daily-review');
const p={id:1,title:'Test STL',description:'Digital item. TXT gives a Google Drive folder link.'};
const delivery=()=>({products:{1:{deliveryFolderUrl:'https://drive.google.com/drive/folders/test-folder',productName:p.title,currentVersionId:'v',versions:[{id:'v',deliveryFolderUrl:'https://drive.google.com/drive/folders/test-folder'}],checks:{access:{status:'unknown'}}}}});
test('İş yoksa satışsızlıktan veya bilinmeyen erişimden sorun uydurulmaz',()=>assert.deepEqual(D.jobs([p],delivery()),[]));
test('Tamamlanan aynı kaynak gizlenir; bağlantı değişince yeniden değerlendirilir',()=>{const d=delivery();d.products[1].versions=[];const j=D.jobs([p],d)[0];const r=D.recordAction({},j,'completed');assert.equal(D.jobs([p],d,{},[],r).length,0);d.products[1].deliveryFolderUrl+='2';assert.equal(D.jobs([p],d,{},[],r).length,1);});
test('Erişim ve eski TXT, hazırlık işinden önce gelir; sadece kayıtlı sorunlar sayılır',()=>{const d=delivery();d.products[1].checks.access={status:'permission',checkedAt:new Date().toISOString()};d.products[1].deliveryFolderUrl+='2';const jobs=D.jobs([p,{id:2,title:'New'}],d);assert.equal(jobs[0].priority,5);assert(jobs.some(j=>j.kind==='old-txt'));assert.equal(jobs.at(-1).kind,'folder');});
test('Günlük kayıt hataları reddedilir; erteleme süresi geçince geri döner',()=>{const j=D.jobs([{id:2,title:'Test'}],{})[0],r=D.recordAction({},j,'snoozed',1000);assert.equal(D.jobs([{id:2,title:'Test'}],{}, {},[],r,2000).length,0);assert.equal(D.jobs([{id:2,title:'Test'}],{}, {},[],r,4*86400000).length,1);assert(D.validate(r));assert.throws(()=>D.validate({actions:{x:{kind:'invented'}}}));});
test('Açık teslim çelişkisi tek ilan inceleme işi üretir; açıklama işiyle yinelenmez',()=>{
 const product={...p,description:'Download STL files directly from Etsy.'},data=delivery(),before=JSON.stringify({product,data});
 const jobs=D.jobs([product],data),job=jobs.find(j=>j.kind==='listing-review');assert.equal(jobs.length,1);assert.equal(job.priority,4);assert.deepEqual(job.codes,['direct-stl-contradiction']);assert.equal(job.sourceAt,null);
 assert.match(job.reason,/Etsy’den TXT/);assert.match(job.evidence,/Download STL files directly from Etsy/);assert.match(job.missing,/doğrulanmadı/);assert.equal(job.findings[0].kind,'editorial');assert.equal(JSON.stringify({product,data}),before);
});
test('Doğrulanmış dosya sayısı uyuşmazlığı iş üretir; bilinmeyen içerik veya model sayısı tahmin edilmez',()=>{
 const product={...p,description:p.description+' Includes 2 STL files.'},data=delivery();
 assert.deepEqual(D.jobs([product],data),[]);
 data.products[1].contentConfirmedAt='2026-10-10T12:00:00Z';data.products[1].contents=[{name:'one.stl'}];
 let job=D.jobs([product],data).find(j=>j.kind==='listing-review');assert(job);assert(job.codes.includes('contents-count'));assert.match(job.evidence,/1 STL dosyası/);
 assert.deepEqual(D.jobs([{...p,description:p.description+' Includes 2 models.'}],data),[]);
 data.products[1].contents=[{name:'one.stl'},{name:'instructions.pdf'}];assert.deepEqual(D.jobs([product],data),[]);
});
test('Yer tutucu, baskı iddiası ve farklı açıklama klasörü somut dayanakla tek işe gruplanır',()=>{
 const data=delivery(),product={...p,description:p.description+' {{product_name}} This model is test printed. https://drive.google.com/drive/folders/other-folder'};
 const jobs=D.jobs([product],data),job=jobs.find(j=>j.kind==='listing-review');assert.equal(jobs.length,1);for(const code of ['placeholder','unverified-claims','description-folder-mismatch'])assert(job.codes.includes(code));
 assert.match(job.reason,/Kanıtı olmayan/);assert.match(job.evidence,/other-folder/);assert.equal(job.findings.every(f=>f.kind==='editorial'),true);
});
test('Tamamlanan ilan bulgusu kaynak aynıysa tekrar gelmez; metin değişince yeni değerlendirme olur',()=>{
 const data=delivery(),local={1:{description:p.description+' {{product_name}}',updatedAt:'2026-10-10T12:00:00Z'}},job=D.jobs([p],data,local)[0];assert.equal(job.sourceAt,local[1].updatedAt);
 const review=D.recordAction({},job,'completed',Date.parse('2026-10-10T12:10:00Z'));
 assert.deepEqual(D.jobs([p],data,local,[],review,Date.parse('2026-11-10')),[]);
 local[1].updatedAt='2026-10-11T12:00:00Z';assert.deepEqual(D.jobs([p],data,local,[],review),[]);
 local[1].description=p.description+' {{other_product}}';const changed=D.jobs([p],data,local,[],review).find(j=>j.kind==='listing-review');assert(changed);assert.notEqual(changed.fingerprint,job.fingerprint);
});
test('Aynı erişim sorunu sırf tekrar kontrol tarihi değişti diye sürekli iş oluşturmaz',()=>{
 const data=delivery();data.products[1].checks.access={status:'permission',checkedAt:'2026-10-10T12:00:00Z',detail:'Permission required.'};
 const job=D.jobs([p],data)[0],review=D.recordAction({},job,'completed');assert.equal(job.sourceAt,data.products[1].checks.access.checkedAt);
 data.products[1].checks.access.checkedAt='2026-10-11T12:00:00Z';assert.deepEqual(D.jobs([p],data,{},[],review),[]);
 data.products[1].checks.access.status='unreachable';assert(D.jobs([p],data,{},[],review).some(j=>j.kind==='access'));
});
test('Eksik bilgiler, düşük satış ve görsel kontrolünün yapılmaması gerçek sorun gibi gösterilmez',()=>{
 const data=delivery(),product={...p,salesAvailable:false,periods:[{days:30,orders:0,quantity:0}],tags:[]};
 data.products[1].checks={access:{status:'unknown'},contents:{status:'unknown'},geometry:{status:'unknown'}};
 assert.deepEqual(D.jobs([product],data),[]);
 assert.deepEqual(D.jobs([{...product,description:undefined}],data),[]);
});
