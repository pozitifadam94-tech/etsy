const {test}=require('node:test');
const assert=require('node:assert/strict');
const D=require('./public/delivery');
const FOLDER='https://drive.google.com/drive/folders/FIXTURE_FOLDER_123';
const OTHER='https://drive.google.com/drive/folders/FIXTURE_FOLDER_456';
function product(id='123'){return D.createProduct({id,title:'Ballet dancer STL',url:'https://www.etsy.com/listing/'+id+'/ballet-dancer-stl'},{shopId:'42'});}
function linked(id='123',url=FOLDER){const p=product(id),f=D.parseFolderUrl(url);return {...p,deliveryFolderUrl:f.url,folderId:f.folderId,resourceKey:f.resourceKey};}
function workspace(record){const state=D.emptyState();state.products[record.listingId||record.productId]=record;return state;}
test('Drive klasör ayrıştırma resourcekey korur, hesaba bağlı yol ve izleme sorgusunu sadeleştirir',()=>{
 const f=D.parseFolderUrl('https://drive.google.com/drive/u/2/folders/FIXTURE_FOLDER_123/?usp=sharing&resourcekey=0-FIXTURE_KEY');
 assert.deepEqual(f,{url:FOLDER+'?resourcekey=0-FIXTURE_KEY',folderId:'FIXTURE_FOLDER_123',resourceKey:'0-FIXTURE_KEY'});
 assert.equal(D.parseFolderUrl(FOLDER+'?RESOURCEKEY=0-FIXTURE_KEY').resourceKey,'0-FIXTURE_KEY');
});
test('Drive parser yalnızca güvenli klasör biçimini kabul eder; dosya ve Etsy URL teslim olamaz',()=>{
 for(const url of ['http://drive.google.com/drive/folders/FIXTURE_FOLDER_123','https://drive.google.com/file/d/FIXTURE_FOLDER_123/view','https://drive.google.com/open?id=FIXTURE_FOLDER_123','https://www.etsy.com/listing/123','https://drive.google.com.evil.test/drive/folders/FIXTURE_FOLDER_123','https://user@drive.google.com/drive/folders/FIXTURE_FOLDER_123','https://drive.google.com:8000/drive/folders/FIXTURE_FOLDER_123','https://127.0.0.1/drive/folders/FIXTURE_FOLDER_123',FOLDER+'#fragment',FOLDER+'?resourcekey=x&resourcekey=y',FOLDER+'?resourcekey='])assert.throws(()=>D.parseFolderUrl(url));
});
test('TXT teslim bölümü Etsy ilan URL yerine Drive klasör adresini içerir',()=>{
 const p=linked(),content=D.generateTxt(p,{support:'For help, contact the seller through Etsy Messages.'});
 assert.ok(content.includes(FOLDER));assert.ok(!content.includes(p.etsyListingUrl));assert.ok(content.includes(p.productName));assert.match(content,/paste it into your browser address bar/);assert.match(content,/For help/);
 assert.throws(()=>D.generateTxt({...p,deliveryFolderUrl:p.etsyListingUrl}),/Google Drive/);
});
test('Düzenlenebilir teslim şablonu bilinmeyen alanları ve eksik Drive alanını reddeder',()=>{
 const p=linked();assert.equal(D.generateTxt(p,{template:'{{productName}}\r\n{{deliveryFolderUrl}}\r\n{{support}}',support:'Help'}),p.productName+'\r\n'+FOLDER+'\r\nHelp');
 assert.throws(()=>D.generateTxt(p,{template:'{{productName}} only'}),/deliveryFolderUrl/);
 assert.throws(()=>D.generateTxt(p,{template:'{{deliveryFolderUrl}} {{printedSuccessfully}}'}),/Bilinmeyen/);
 assert.throws(()=>D.generateTxt({...p,productName:''}),/ürün adı/);
 assert.ok(!/tested|commercial rights|support.free|millimetre/i.test(D.DEFAULT_TEMPLATE));
});
test('Tek klasörlü TXT tam kaynak içeriğini korur ve Drive adresini ayırır',()=>{
 const content='Ballet dancer STL\r\n\r\nDownload: '+FOLDER+'?usp=sharing&resourcekey=0-TEST_KEY\r\n';
 const result=D.extractTxt(content,'Ballet dancer STL.txt');assert.equal(result.sourceText,content);assert.equal(result.sourceFileName,'Ballet dancer STL.txt');assert.equal(result.status,'ready');assert.equal(result.deliveryFolderUrl,FOLDER+'?resourcekey=0-TEST_KEY');assert.equal(result.links[0].kind,'drive-folder');
});
test('Birden fazla klasör veya Etsy/yardım bağlantısı varsa teslim linki keyfî seçilmez',()=>{
 for(const content of [FOLDER+'\n'+OTHER,FOLDER+'\nhttps://www.etsy.com/listing/123',FOLDER+'\nhttps://support.google.com/drive']){
  const parsed=D.extractTxt(content);assert.equal(parsed.status,'ambiguous');assert.equal(parsed.deliveryFolderUrl,'');assert.equal(parsed.requiresSelection,true);
 }
 assert.equal(D.extractTxt(FOLDER+'\n'+FOLDER).status,'ready');
});
test('Dosya Drive URL ve Etsy URL klasör teslimi olarak çıkarılmaz',()=>{
 const parsed=D.extractTxt('https://drive.google.com/file/d/FIXTURE_MODEL_123/view\nhttps://www.etsy.com/listing/123');
 assert.equal(parsed.folderCandidates.length,0);assert.equal(parsed.deliveryFolderUrl,'');assert.equal(parsed.links[0].kind,'drive-other');assert.equal(parsed.links[1].kind,'etsy');assert.ok(parsed.warnings.length);
 assert.equal(D.extractTxt('No link').status,'missing');
});
test('TXT URL çevresindeki noktalama ayrılır, sourceText değiştirilmez',()=>{
 const content='Download ('+FOLDER+').';const parsed=D.extractTxt(content);assert.equal(parsed.deliveryFolderUrl,FOLDER);assert.equal(parsed.sourceText,content);
});
test('Dosya/ürün adından eşleşme önerilir; aynı isimli iki ilanda kesin eşleştirme yoktur',()=>{
 const products=[{id:123,title:'Ballet dancer STL'},{id:456,title:'Ballet dancer STL'},{id:789,title:'Religious wall sculpture STL'}];
 const result=D.suggestMatches('Ballet dancer STL.txt',products);assert.equal(result.length,2);assert.equal(result[0].score,1);assert.equal(result[1].score,1);assert.ok(result.every(r=>!Object.hasOwn(r,'selected')&&!Object.hasOwn(r,'confirmed')));
 assert.equal(D.suggestMatches('delivery-789.txt',products)[0].listingId,'789');assert.deepEqual(D.suggestMatches('unrelatedname.txt',products),[]);
 const local=D.suggestMatches('Ballet dancer STL.txt',[{id:'local-fixture-123',title:'Ballet dancer STL'}])[0];assert.equal(local.key,'local-fixture-123');assert.equal(local.listingId,'');
});
test('Teslim sürümü UTF-8 checksum ve ayrı frozen içerik snapshotı tutar',async()=>{
 const p=linked(),content='Ürün ölçüsü bilinmiyor\r\n'+FOLDER+'\r\n',version=await D.createVersion(p,content,{now:'2026-10-10T09:00:00Z',origin:'imported',sourceFileName:'original.txt'});
 assert.equal(version.content,content);assert.equal(version.deliveryFolderUrl,FOLDER);assert.equal(version.sourceFileName,'original.txt');assert.ok(Object.isFrozen(version));assert.match(version.checksum,/^[a-f0-9]{64}$/);assert.equal(await D.verifyVersion(version),true);
 p.productName='Edited product';p.deliveryFolderUrl=OTHER;assert.notEqual(version.productName,p.productName);assert.equal(version.deliveryFolderUrl,FOLDER);
 assert.equal(await D.verifyVersion({...version,content:content+'x'}),false);
});
test('Teslim geri alma eski sürümü değiştirmeden yeni sürüm oluşturur',async()=>{
 const p=linked(),first=await D.createVersion(p,D.generateTxt(p),{now:1000000000000});p.versions.push(first);p.currentVersionId=first.id;
 const second=await D.createVersion({...p,deliveryFolderUrl:OTHER},'Updated\n'+OTHER,{now:1000000000001,origin:'edited'});p.versions.push(second);p.currentVersionId=second.id;
 const restored=await D.restoreVersion(p,first.id,{now:1000000000002});assert.equal(restored.content,first.content);assert.equal(restored.deliveryFolderUrl,first.deliveryFolderUrl);assert.equal(restored.restoredFrom,first.id);assert.equal(restored.origin,'restored');assert.notEqual(restored.id,first.id);assert.equal(p.versions.length,2);assert.equal(p.currentVersionId,second.id);
 p.versions.push({...first,id:'corrupt',content:'Changed'});await assert.rejects(()=>D.restoreVersion(p,'corrupt'),/kimliği/);
});
test('Aynı zaman/içerikle sonraki sürüm ayrı kimlik alır; fark görünümü eski/yeni metni korur',async()=>{
 const p=linked(),v1=await D.createVersion(p,'Title\n'+FOLDER+'\nHelp',{now:1000000000000});p.versions.push(v1);const v2=await D.createVersion(p,v1.content,{now:1000000000000});assert.notEqual(v1.id,v2.id);
 const diff=D.versionDiff(v1,'Title\n'+OTHER+'\nHelp');assert.equal(diff.changed,true);assert.deepEqual(diff.removed,[FOLDER]);assert.deepEqual(diff.added,[OTHER]);assert.equal(diff.before,v1.content);
});
test('Ortak Drive klasörü hata veya dosya eşitliği kanıtı değildir; anahtar farkına rağmen görünür',()=>{
 const a=linked('123',FOLDER+'?resourcekey=0-FIRST'),b=linked('456',FOLDER+'?resourcekey=0-SECOND'),c=linked('789',OTHER),state=D.emptyState();state.products={123:a,456:b,789:c};
 const duplicates=D.duplicateFolders(state);assert.equal(duplicates.length,1);assert.equal(duplicates[0].products.length,2);assert.equal(duplicates[0].severity,'notice');assert.match(duplicates[0].reason,/tek başına hata/);
});
test('TXT tutarlılığı erişim veya klasör içeriği doğrulaması yerine geçmez',()=>{
 const p=linked(),valid=D.inspectContent(D.generateTxt(p),p);assert.equal(valid.status,'consistent');assert.equal(p.checks.access.status,'unverified');assert.equal(p.checks.contents.status,'unverified');assert.equal(p.checks.geometry.status,'unverified');
 assert.equal(D.inspectContent('Download '+p.etsyListingUrl,p).status,'invalid');assert.equal(D.inspectContent(FOLDER+'\n'+OTHER,p).status,'review');assert.equal(D.inspectContent(FOLDER+'\n{{support}}',p).status,'review');
});
test('Ürün/TXT kaydı JSON yeniden açılışında ilişkileri ve kaynak sürümü korur',async()=>{
 const p=linked(),version=await D.createVersion(p,D.generateTxt(p),{now:'2026-10-10T09:00:00Z'});p.versions.push(version);p.currentVersionId=version.id;p.contents=[{name:'dancer.stl',note:'User confirmed'}];p.contentConfirmedAt='2026-10-10T09:00:00Z';p.models=[{id:'model-1',name:'Dancer'}];
 const reopened=JSON.parse(JSON.stringify(workspace(p)));assert.equal(D.validate(reopened),reopened);assert.equal(reopened.products['123'].currentVersionId,version.id);assert.equal(reopened.products['123'].deliveryFolderUrl,FOLDER);assert.equal(await D.verifyVersion(reopened.products['123'].versions[0]),true);
});
test('Etsy bağlantısı olmadan yerel ürün ve teslim TXT akışı doğrulanır',async()=>{
 const p=D.createProduct({id:'local-fixture-123',title:'Local product'},{shopId:''}),f=D.parseFolderUrl(FOLDER);Object.assign(p,{deliveryFolderUrl:f.url,folderId:f.folderId,resourceKey:f.resourceKey});
 const version=await D.createVersion(p,D.generateTxt(p));p.versions.push(version);p.currentVersionId=version.id;const state=JSON.parse(JSON.stringify(workspace(p)));D.validate(state);assert.equal(p.listingId,'');assert.equal(p.etsyListingUrl,'');assert.equal(p.productId,'local-fixture-123');assert.ok(version.content.includes(FOLDER));
 assert.throws(()=>D.createProduct({id:'local-fixture-123',title:'Local',url:'https://www.etsy.com/listing/123'}),/ilan kimliği/);
});
test('Teslim doğrulaması klasör/ilan kimliği uyuşmazlığını ve göstermelik başarıyı reddeder',()=>{
 const p=linked();D.validate(workspace(p));assert.throws(()=>D.validate(workspace({...p,folderId:'WRONG_FOLDER'})),/uyuşmuyor/);assert.throws(()=>D.validate(workspace({...p,etsyListingUrl:'https://www.etsy.com/listing/456'})),/eşleşmeli/);
 const checks=JSON.parse(JSON.stringify(p.checks));checks.access.status='verified';assert.throws(()=>D.validate(workspace({...p,checks})),/yöntem ve tarih/);checks.access.method='Anonymous check';checks.access.checkedAt='2026-10-10T09:00:00Z';D.validate(workspace({...p,checks}));assert.equal(checks.geometry.status,'unverified');
});
test('Boyut sınırı ve Windows TXT dosya adı korunur',()=>{
 assert.throws(()=>D.extractTxt('x'.repeat(D.MAX_TXT+1)),/çok uzun/);assert.equal(D.deliveryTxtFilename({productName:'Dancer: model / one?',listingId:'123'}),'Dancer model one.txt');
});
