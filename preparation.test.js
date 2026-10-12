const test=require('node:test'),assert=require('node:assert/strict');
const prep=require('./public/preparation');
const product={id:'123',title:'Ballet STL',description:'Digital STL model.',tags:['ballet stl'],listingType:'download',url:'https://www.etsy.com/listing/123/example'};
const delivery={productName:'Ballet STL',deliveryFolderUrl:'https://drive.google.com/drive/folders/ExampleFolder123',contents:[{name:'ballet.stl'}],contentConfirmedAt:'2026-10-10T10:00:00Z'};
const at='2026-10-10T12:00:00Z';
test('Yerel alan sınırları doğrulanmamış resmî kurallar gibi sunulmaz; tekrar etiket hata olur',()=>{
 assert.equal(prep.FORMAT_RULES.verifiedCurrent,false);
 assert.equal(prep.validateDraft({title:'A'.repeat(141)},{partial:true}).ok,false);
 const r=prep.validateDraft({tags:['Ballet','ballet']},{partial:true});assert.equal(r.ok,false);assert.match(r.errors.join(' '),/Tekrarlanan/);
 assert.equal(prep.validateDraft({tags:'ballet'},{partial:true}).ok,false);
 assert.equal(prep.validateDraft({tags:['a\nb']},{partial:true}).ok,false);
 assert.equal(prep.validateDraft({title:'Valid',description:'text',tags:[]}).ok,true);
});
test('Teslim paragrafı Etsy TXT → Drive klasörü akışını açıklar, gerçek linki açıklamada yayımlamaz',()=>{
 const paragraph=prep.commonDeliveryParagraph(delivery);assert.match(paragraph,/TXT delivery file from Etsy/);assert.match(paragraph,/Google Drive folder link/);assert.ok(!paragraph.includes(delivery.deliveryFolderUrl));
 const one=prep.upsertDeliveryParagraph('Original product facts.',delivery);const two=prep.upsertDeliveryParagraph(one.after,delivery);assert.equal(two.changed,false);assert.equal(two.after,one.after);
 const three=prep.upsertDeliveryParagraph(one.after+'\n\n'+paragraph,delivery);assert.equal(three.removedDuplicates,1);assert.equal(three.after,one.after);
 assert.match(one.after,/Original product facts/);
});
test('İlan bulguları içerik, biçim, teslim çelişkisi ve yapılmayan görsel kontrolünü ayrı belirtir',()=>{
 const p={...product,description:'Download STL files directly from Etsy. Includes 2 STL files. This is test printed at 1:10 scale. {{product_name}}'};
 const codes=prep.auditListing(p,delivery).map(f=>f.code);
 for(const code of ['digital-description','delivery-explanation','direct-stl-contradiction','contents-count','placeholder','unverified-claims','image-text-unchecked'])assert.ok(codes.includes(code),code);
 assert.ok(!codes.includes('contents-unconfirmed'));
 assert.ok(prep.auditListing(product,{...delivery,contentConfirmedAt:null}).some(f=>f.code==='contents-unconfirmed'));
 assert.ok(prep.auditListing(product,{deliveryFolderUrl:product.url}).some(f=>f.code==='delivery-folder-invalid'));
 assert.ok(!prep.auditListing({...product,description:'Do not download STL files directly from Etsy. Not test printed.'},delivery).some(f=>f.code==='direct-stl-contradiction'||f.code==='unverified-claims'));
});
test('Yerel taslak önce/sonra ve geri alma kaynak ilanı değiştirmez; sürümler kayıt doğrulamasından geçer',()=>{
 const original=JSON.stringify(product),record=prep.saveDraft(product,null,{description:'Updated digital delivery description.'},{at,source:'manual',purpose:'Teslimi açıklaştır'});
 assert.equal(record.versions.length,2);assert.equal(record.versions[0].description,product.description);assert.equal(prep.validateState({'123':record}),true);
 assert.equal(prep.draftDiff(product,record).find(f=>f.field==='description').changed,true);
 const undo=prep.undoDraft(record,record.versions[0].id,'2026-10-10T12:01:00Z');assert.equal(undo.description,product.description);assert.equal(undo.versions.at(-1).source,'undo');assert.equal(undo.versions.length,3);
 assert.equal(JSON.stringify(product),original);assert.equal(record.description,'Updated digital delivery description.');
 const latest=prep.saveDraft({...product,description:'API changed description'},record,{title:'New local title'},{at:'2026-10-10T12:02:00Z'});assert.equal(latest.description,record.description);
 assert.throws(()=>prep.validateState({'123':{...record,versions:[...record.versions,record.versions[0]]}}),/Geçersiz/);
 assert.throws(()=>prep.validateState({'123':{...record,title:'Unsaved mutation'}}),/Geçersiz/);
});
test('AI JSON yalnızca desteklenen alanları kabul eder; bozuk veya komut içeren çıktı çalıştırılmaz',()=>{
 assert.equal(prep.parseAIOutput('{broken').ok,false);
 assert.equal(prep.parseAIOutput('[]').ok,false);
 const unknown=prep.parseAIOutput('{"title":"Good","price":12}');assert.equal(unknown.ok,false);assert.match(unknown.errors.join(' '),/price/);assert.equal(unknown.patch,null);
 assert.equal(prep.parseAIOutput('{"tags":["same","SAME"]}').ok,false);
 assert.equal(prep.parseAIOutput('{"__proto__":{"x":1},"title":"Good"}').ok,false);
 const accepted=prep.parseAIOutput('```json\n{"title":"window.__danger = true","tags":["new tag"]}\n```',product);assert.equal(accepted.ok,true);assert.equal(globalThis.__danger,undefined);assert.equal(accepted.value.description,product.description);
 assert.equal(prep.parseAIOutput('const command = process.exit();').ok,false);
});
test('Tekrarlı geri alma taslaklar arasında ileri geri dönmez; sık kayıtta sürüm kimlikleri çakışmaz',()=>{
 let record=prep.saveDraft(product,null,{title:'First title'},{at});record=prep.saveDraft(product,record,{title:'Second title'},{at});
 const undo1=prep.undoDraft(record,undefined,at),undo2=prep.undoDraft(undo1,undefined,at);assert.equal(undo1.title,'First title');assert.equal(undo2.title,product.title);assert.throws(()=>prep.undoDraft(undo2,undefined,at),/önceki/);
 for(let i=0;i<70;i++)record=prep.saveDraft(product,record,{title:'Title '+i},{at});
 assert.equal(record.versions.length,50);assert.equal(prep.validateState({'123':record}),true);
 const legacy={...product,title:'Old title '.repeat(20)};let saved=prep.saveDraft(legacy,null,{title:'Fixed title'},{at});saved=prep.undoDraft(saved,saved.versions[0].id,at);assert.equal(saved.title,legacy.title);assert.equal(prep.validateState({'123':saved}),true);
});
test('Varsayılan ChatGPT bağlamı Drive linkini ve ham müşteri kişisel verilerini paylaşmaz',()=>{
 const p={...product,description:'Digital STL. '+delivery.deliveryFolderUrl+' Email seller@example.com, +90 555 111 2233.'};
 const message='My name is Jane Customer. My email is jane@example.com. Permission denied at '+delivery.deliveryFolderUrl;
 const context=prep.buildContext('description',p,delivery,{message});
 assert.ok(!context.includes(delivery.deliveryFolderUrl));assert.ok(!context.includes('seller@example.com'));assert.ok(!context.includes('+90 555 111 2233'));assert.ok(!context.includes('Jane Customer'));
 const customer=prep.buildContext('customer',p,delivery,{message});assert.ok(!customer.includes('Jane Customer'));assert.match(customer,/Drive izni/);assert.match(customer,/Ham müşteri mesajı/);
 const optin=prep.buildContext('customer',p,delivery,{message,includeSensitive:true});assert.ok(optin.includes(message));assert.ok(optin.includes(delivery.deliveryFolderUrl));
 assert.match(prep.buildContext('package',product,{...delivery,contentConfirmedAt:null}),/kullanıcı tarafından doğrulanmamış/);
 assert.equal(prep.redact('Dönem: 2026-10-10'), 'Dönem: 2026-10-10');
});
test('Performans bağlamı başka ürün geçmişini taşımaz ve işlem satırını benzersiz sipariş sanmaz',()=>{
 const p={...product,periods:[{days:30,quantity:5,orders:4,revenue:20,currency:'USD'}]};
 const context=prep.buildContext('performance',p,delivery,{history:{salesCaptured:at,products:{123:{coverage:['2026-10-09']},999:{title:'SECRET_OTHER_PRODUCT',coverage:['2026-10-09']}}}});
 assert.ok(!context.includes('SECRET_OTHER_PRODUCT'));assert.match(context,/"transactionLines": 4/);assert.match(context,/"grossItemAmount": 20/);assert.match(context,/net kâr/);
 assert.match(context,/"uniqueOrders": null/);assert.match(context,/benzersiz sipariş olarak yorumlanmadı/);
 const current=prep.buildContext('performance',{...product,periods:[{days:30,quantity:5,orders:2,transactionLines:4,revenue:20,currency:'USD'}]},delivery);
 assert.match(current,/"uniqueOrders": 2/);assert.match(current,/"transactionLines": 4/);assert.match(current,/"quantity": 5/);
 const explicit=prep.buildContext('performance',{...product,orderMeasuresAvailable:true,periods:[{days:30,orders:2,quantity:5}]},delivery);
 assert.match(explicit,/"uniqueOrders": 2/);assert.match(explicit,/"transactionLines": null/);
});
test('Müşteri yanıtları şablon olarak etiketlenir; içerik/ölçek/baskı garantisi uydurulmaz',()=>{
 const missing=prep.supportReply('missing',product,delivery);assert.equal(missing.source,'template');assert.match(missing.en,/ballet.stl/);assert.equal(missing.missing.length,0);
 const unknown=prep.supportReply('missing',product,{...delivery,contentConfirmedAt:null});assert.ok(!unknown.en.includes('ballet.stl'));assert.ok(unknown.missing.length);
 for(const kind of ['txt','link','permission','missing','zip','scale']){const r=prep.supportReply(kind,product,delivery);assert.ok(r.en);assert.ok(r.tr);assert.ok(!r.en.includes(delivery.deliveryFolderUrl));assert.ok(!/I (?:have |personally )?test printed|guaranteed to print/i.test(r.en));}
 assert.match(prep.supportReply('txt',product,delivery).en,/TXT delivery file from Etsy/);
 assert.match(prep.supportReply('permission',product,delivery).en,/own account does not confirm your access/);
 assert.match(prep.supportReply('link',product,delivery,{includeDeliveryLink:true}).en,/https:\/\/drive.google.com\/drive\/folders\//);
 assert.ok(!prep.supportReply('link',product,delivery,{supportInfo:{}}).en.includes('[object Object]'));
});
