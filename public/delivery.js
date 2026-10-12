(function(root){
'use strict';
const MAX_TXT=100000;
const DEFAULT_TEMPLATE='{{productName}}\n\nDOWNLOAD YOUR FILES\n{{deliveryFolderUrl}}\n\nOpen the Google Drive folder link above in your browser. If the link is not clickable in your text editor, copy the entire link and paste it into your browser address bar.\n\nIn the folder, select the files you want to download and choose Download. Google Drive may prepare a ZIP when several files are selected.\n\n{{support}}\n';
const CHECK_STATUSES=['unverified','verified','requires-permission','unreachable','inconclusive','permission','unknown'];
function object(value){return !!value&&typeof value==='object'&&!Array.isArray(value);}
function text(value,name,max=1000){if(typeof value!=='string'||value.length>max||value.includes('\0'))throw Error(name+' geçersiz veya çok uzun.');return value;}
function timestamp(value){return typeof value==='string'&&Number.isFinite(Date.parse(value));}
function parseFolderUrl(value){
 text(value,'Drive klasör bağlantısı',2048);
 let u;try{u=new URL(value.trim());}catch{throw Error('Geçerli bir Google Drive klasör bağlantısı gir.');}
 if(u.protocol!=='https:'||u.hostname!=='drive.google.com'||u.username||u.password||u.port||u.hash)throw Error('Teslim bağlantısı HTTPS Google Drive klasörüne gitmeli.');
 const match=u.pathname.match(/^\/drive\/(?:u\/\d+\/)?folders\/([A-Za-z0-9_-]{8,200})\/?$/);
 if(!match)throw Error('Tek dosya veya Etsy adresi yerine Google Drive KLASÖR paylaşım bağlantısını gir.');
 const keys=[...u.searchParams.entries()].filter(([key])=>key.toLowerCase()==='resourcekey');
 if(keys.length>1||(keys.length&&!/^[A-Za-z0-9_-]{1,200}$/.test(keys[0][1])))throw Error('Drive bağlantısındaki resourcekey geçersiz veya tekrarlanmış.');
 const resourceKey=keys.length?keys[0][1]:'';
 const url='https://drive.google.com/drive/folders/'+match[1]+(resourceKey?'?resourcekey='+encodeURIComponent(resourceKey):'');
 return {url,folderId:match[1],resourceKey};
}
function etsyListingUrl(value,listingId){
 if(!value)return '';
 text(value,'Etsy ilan bağlantısı',2048);
 let u;try{u=new URL(value);}catch{throw Error('Etsy ilan bağlantısı geçersiz.');}
 const m=u.pathname.match(/^\/listing\/(\d+)(?:\/[^/]+)?\/?$/);
 if(u.protocol!=='https:'||!['etsy.com','www.etsy.com'].includes(u.hostname)||u.username||u.password||u.port||!m||(listingId&&m[1]!==String(listingId)))throw Error('Etsy ilan bağlantısı seçilen ilanla eşleşmeli.');
 return u.origin+u.pathname;
}
function extractTxt(content,fileName=''){
 text(content,'TXT içeriği',MAX_TXT);text(fileName,'TXT dosya adı',250);
 const links=[];
 for(const match of content.matchAll(/https?:\/\/[^\s<>"'\u0000]+/gi)){
  const url=match[0].replace(/[.,;:!?)\]}]+$/,'');let parsed=null,kind='other',reason='';
  try{const u=new URL(url);if(['etsy.com','www.etsy.com'].includes(u.hostname))kind='etsy';else if(u.hostname==='drive.google.com')kind='drive-other';}catch{reason='Bağlantı ayrıştırılamadı.';}
  try{parsed=parseFolderUrl(url);kind='drive-folder';}catch(e){if(kind==='drive-other')reason=e.message;}
  links.push({url,kind,folderId:parsed?.folderId||'',resourceKey:parsed?.resourceKey||'',normalizedUrl:parsed?.url||'',reason});
 }
 const uniqueLinks=[...new Map(links.map(l=>[l.url,l])).values()];
 const folderCandidates=[...new Map(links.filter(l=>l.kind==='drive-folder').map(l=>[l.normalizedUrl,{url:l.normalizedUrl,folderId:l.folderId,resourceKey:l.resourceKey}])).values()];
 const ambiguous=uniqueLinks.length>1||folderCandidates.length>1;
 const ready=folderCandidates.length===1&&!ambiguous;
 const warnings=[];
 if(ambiguous)warnings.push('TXT birden fazla farklı bağlantı içeriyor. Teslim klasörünü kendin seç; hiçbir bağlantı otomatik seçilmedi.');
 if(!folderCandidates.length)warnings.push('Geçerli Google Drive klasör bağlantısı bulunamadı.');
 if(links.some(l=>l.kind==='drive-other'))warnings.push('Bazı Drive adresleri klasör paylaşım bağlantısı değil.');
 return {sourceFileName:fileName,sourceText:content,links,folderCandidates,deliveryFolderUrl:ready?folderCandidates[0].url:'',status:ready?'ready':ambiguous?'ambiguous':'missing',requiresSelection:ambiguous,warnings};
}
function normalizedName(value){return String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\.txt$/,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim();}
function tokens(value){return new Set(normalizedName(value).split(' ').filter(w=>w.length>1&&!['stl','txt','3d','download','downloads','files','file','digital','model','models'].includes(w)));}
function suggestMatches(fileName,products,sourceText=''){
 if(object(fileName)){sourceText=fileName.sourceText||'';fileName=fileName.sourceFileName||fileName.fileName||'';}
 const name=normalizedName(fileName),words=tokens(fileName),firstLine=sourceText.split(/\r?\n/).find(s=>s.trim()&&!/https?:\/\//i.test(s))||'',line=normalizedName(firstLine);
 return (products||[]).map(p=>{
  const rawId=String(p.id??''),listingId=String(p.listingId??(/^\d+$/.test(rawId)?rawId:'')),key=listingId||String(p.productId??rawId),title=String(p.productName??p.title??''),normalized=normalizedName(title),other=tokens(title);
  const intersection=[...words].filter(w=>other.has(w)).length,union=new Set([...words,...other]).size;
  let score=union?intersection/union:0,reason='Dosya adı ile ilan adı arasında kelime benzerliği var; kullanıcı seçimi gerekir.';
  if(normalized&&name===normalized){score=1;reason='Dosya adı ilan adıyla aynı; yine de kullanıcı seçimi gerekir.';}
  else if(/^\d+$/.test(listingId)&&new RegExp('(?:^|\\D)'+listingId+'(?:\\D|$)').test(String(fileName))){score=.98;reason='Dosya adında ilan kimliği var; yine de kullanıcı seçimi gerekir.';}
  else if(line&&line===normalized){score=Math.max(score,.9);reason='TXT ilk satırı ilan adıyla benzer; yine de kullanıcı seçimi gerekir.';}
  return {key,listingId,title,score,reason};
 }).filter(p=>(/^\d+$/.test(p.key)||/^local-[A-Za-z0-9_-]{1,160}$/.test(p.key))&&p.score>=.15).sort((a,b)=>b.score-a.score||a.title.localeCompare(b.title,'tr')).slice(0,8);
}
function emptyCheck(){return {status:'unverified',method:'',checkedAt:null,detail:''};}
function emptyState(){return {schema:1,template:DEFAULT_TEMPLATE,support:'',products:{}};}
function createProduct(product,options={}){
 const rawId=String(product.id??''),listingId=String(product.listingId??(/^\d+$/.test(rawId)?rawId:'')),localId=String(product.productId??rawId);
 if(!/^\d+$/.test(listingId)&&!(listingId===''&&/^local-[A-Za-z0-9_-]{1,160}$/.test(localId)))throw Error('Etsy ilan kimliği veya yerel ürün kimliği gerekiyor.');
 const shopId=String(options.shopId??product.shopId??'');if(shopId&&!/^\d+$/.test(shopId))throw Error('Mağaza kimliği geçersiz.');
 const listingUrl=etsyListingUrl(product.etsyListingUrl??product.url??'',listingId);if(!listingId&&listingUrl)throw Error('Yerel ürüne Etsy ilan adresi atamak için ilan kimliği gerekiyor.');
 return {productId:listingId?'product-'+(shopId||'unassigned')+'-'+listingId:localId,shopId,listingId,etsyListingUrl:listingUrl,productName:String(product.productName??product.title??''),deliveryFolderUrl:'',folderId:'',resourceKey:'',contents:[],contentConfirmedAt:null,models:[],sourceNote:'',licenseNote:'',currentVersionId:null,versions:[],checks:{access:emptyCheck(),contents:emptyCheck(),geometry:emptyCheck()}};
}
function deliveryParagraph(record){const folder=parseFolderUrl(record.deliveryFolderUrl);return 'Download your files from this Google Drive folder:\n'+folder.url+'\n\nOpen the link in your browser, or copy the entire link and paste it into your browser address bar. In the folder, select the files you want and choose Download.';}
function generateTxt(record,settings={}){
 const folder=parseFolderUrl(record.deliveryFolderUrl),template=settings.template??DEFAULT_TEMPLATE,support=settings.support??'';
 text(template,'Teslim şablonu',20000);text(support,'Destek bilgisi',3000);
 if(!template.includes('{{deliveryFolderUrl}}'))throw Error('Teslim şablonunda {{deliveryFolderUrl}} alanı bulunmalı.');
 const values={productName:text(String(record.productName??record.title??''),'Ürün adı',1000),deliveryFolderUrl:folder.url,support};
 if(!values.productName.trim())throw Error('Teslim TXT için ürün adı gerekiyor.');
 const result=template.replace(/\{\{([^{}]+)\}\}/g,(placeholder,key)=>{if(!Object.hasOwn(values,key))throw Error('Bilinmeyen şablon alanı: '+placeholder);return values[key];});
 text(result,'Teslim TXT içeriği',MAX_TXT);return result;
}
async function checksum(content){
 text(content,'TXT içeriği',MAX_TXT);
 const bytes=new TextEncoder().encode(content);
 if(typeof module!=='undefined'&&module.exports)return require('node:crypto').createHash('sha256').update(bytes).digest('hex');
 if(!root.crypto?.subtle)throw Error('TXT sürüm kimliği için güvenli yerel tarayıcı bağlamı gerekiyor.');
 const digest=await root.crypto.subtle.digest('SHA-256',bytes);return [...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,'0')).join('');
}
async function createVersion(record,content,options={}){
 text(content,'Teslim TXT içeriği',MAX_TXT);const folder=parseFolderUrl(record.deliveryFolderUrl);
 const stamp=typeof options.now==='string'?Date.parse(options.now):Number(options.now??Date.now());if(!Number.isFinite(stamp))throw Error('Sürüm tarihi geçersiz.');
 const hash=await checksum(content),existing=new Set((record.versions||[]).map(v=>v.id));let suffix=(record.versions||[]).length+1,id;
 do{id='delivery-'+stamp+'-'+suffix+++'-'+hash.slice(0,12);}while(existing.has(id));
 const origin=options.origin??'generated';if(!['generated','imported','restored','edited'].includes(origin))throw Error('Teslim sürümü kaynağı geçersiz.');
 const version={id,createdAt:new Date(stamp).toISOString(),content,checksum:hash,origin,restoredFrom:options.restoredFrom??null,productName:String(record.productName||''),deliveryFolderUrl:folder.url,folderId:folder.folderId,resourceKey:folder.resourceKey,sourceFileName:options.sourceFileName??''};
 if(version.restoredFrom!==null)text(version.restoredFrom,'Geri alınan sürüm',200);text(version.sourceFileName,'Kaynak dosya adı',250);
 return Object.freeze(version);
}
async function verifyVersion(version){return /^[a-f0-9]{64}$/.test(version?.checksum||'')&&(await checksum(version.content))===version.checksum;}
async function restoreVersion(record,versionId,options={}){
 const old=(record.versions||[]).find(v=>v.id===versionId);if(!old)throw Error('Geri alınacak teslim sürümü bulunamadı.');
 if(!await verifyVersion(old))throw Error('Teslim sürümünün içerik kimliği uyuşmuyor; geri alma yapılmadı.');
 return createVersion({...record,productName:old.productName,deliveryFolderUrl:old.deliveryFolderUrl},old.content,{...options,origin:'restored',restoredFrom:old.id});
}
function versionDiff(before,after){
 const a=typeof before==='string'?before:before?.content||'',b=typeof after==='string'?after:after?.content||'',left=a.split(/\r?\n/),right=b.split(/\r?\n/);let prefix=0,suffix=0;
 while(prefix<left.length&&prefix<right.length&&left[prefix]===right[prefix])prefix++;
 while(suffix<left.length-prefix&&suffix<right.length-prefix&&left[left.length-1-suffix]===right[right.length-1-suffix])suffix++;
 return {before:a,after:b,changed:a!==b,removed:left.slice(prefix,left.length-suffix),added:right.slice(prefix,right.length-suffix)};
}
function duplicateFolders(delivery){
 const products=delivery?.products??delivery??{},groups=new Map();
 for(const [key,record] of Object.entries(products)){if(!record?.deliveryFolderUrl)continue;try{const folder=parseFolderUrl(record.deliveryFolderUrl);const group=groups.get(folder.folderId)||[];group.push({key,productId:record.productId,listingId:record.listingId,productName:record.productName,url:folder.url});groups.set(folder.folderId,group);}catch{}}
 return [...groups].filter(([,products])=>products.length>1).map(([folderId,products])=>({folderId,products,severity:'notice',reason:'Bu klasör birden fazla üründe kullanılıyor. Ortak paket olabilir; tek başına hata veya aynı içerik kanıtı değildir.'}));
}
function inspectContent(content,record){
 const source=extractTxt(content),folder=parseFolderUrl(record.deliveryFolderUrl),issues=[];
 const matches=source.folderCandidates.filter(c=>c.url===folder.url),others=source.folderCandidates.filter(c=>c.url!==folder.url);
 if(!matches.length)issues.push({kind:'missing-delivery-link',severity:'error',message:'TXT, bu ürünün güncel Drive klasör bağlantısını içermiyor.'});
 if(others.length)issues.push({kind:'other-folder-link',severity:'warning',message:'TXT içinde bu ürünün teslim bağlantısından farklı Drive klasörleri var; kullanıcı kontrolü gerekiyor.'});
 if(source.links.some(l=>l.kind==='drive-other'))issues.push({kind:'non-folder-drive-link',severity:'warning',message:'TXT içinde klasör bağlantısı olmayan Drive adresi var.'});
 if(/\{\{[^{}]+\}\}|\[\s*(?:insert|your|product|link)[^\]]*\]/i.test(content))issues.push({kind:'placeholder',severity:'warning',message:'TXT içinde doldurulmamış yer tutucu olabilir.'});
 return {status:issues.some(i=>i.severity==='error')?'invalid':issues.length?'review':'consistent',issues,containsDeliveryFolder:matches.length>0,folderUrls:source.folderCandidates.map(c=>c.url)};
}
function deliveryTxtFilename(record){return (String(record.productName||'delivery-'+record.listingId).replace(/[<>:"/\\|?*\u0000-\u001f]/g,' ').replace(/\s+/g,' ').trim().replace(/[. ]+$/,'').slice(0,120)||'delivery')+'.txt';}
function validateCheck(check,name){
 if(!object(check)||!CHECK_STATUSES.includes(check.status))throw Error(name+' kontrol sonucu geçersiz.');
 text(check.method,name+' yöntemi',300);text(check.detail,name+' açıklaması',5000);
 if(check.checkedAt!==null&&!timestamp(check.checkedAt))throw Error(name+' kontrol tarihi geçersiz.');
 if(check.status==='verified'&&(!check.method.trim()||!check.checkedAt))throw Error(name+' doğrulaması yöntem ve tarih gerektirir.');
}
function validate(value){
 if(!object(value)||value.schema!==1||!object(value.products)||Object.keys(value.products).length>10000)throw Error('Teslim kayıtları geçersiz.');
 text(value.template,'Teslim şablonu',20000);text(value.support,'Destek bilgisi',3000);
 if(!value.template.includes('{{deliveryFolderUrl}}'))throw Error('Teslim şablonunda Drive klasör alanı bulunmalı.');
 for(const [key,record] of Object.entries(value.products)){
  const local=/^local-[A-Za-z0-9_-]{1,160}$/.test(key);
  if(!object(record)||(local?(record.listingId!==''||record.productId!==key):(!/^\d+$/.test(key)||record.listingId!==key)))throw Error('Teslim kaydının ürün veya ilan kimliği geçersiz.');
  text(record.productId,'Dahili ürün kimliği',200);if(!record.productId)throw Error('Dahili ürün kimliği gerekiyor.');
  if(typeof record.shopId!=='string'||(record.shopId&&!/^\d+$/.test(record.shopId)))throw Error('Teslim kaydının mağaza kimliği geçersiz.');
  text(record.etsyListingUrl,'Etsy ilan bağlantısı',2048);if(local&&record.etsyListingUrl)throw Error('Yerel ürünün Etsy ilan bağlantısı boş olmalı.');etsyListingUrl(record.etsyListingUrl,record.listingId);text(record.productName,'Ürün adı',1000);text(record.deliveryFolderUrl,'Drive klasör bağlantısı',2048);text(record.folderId,'Klasör kimliği',200);text(record.resourceKey,'Kaynak anahtarı',200);
  if(record.deliveryFolderUrl){const p=parseFolderUrl(record.deliveryFolderUrl);if(record.folderId!==p.folderId||record.resourceKey!==p.resourceKey)throw Error('Drive klasör bağlantısı ile kimliği uyuşmuyor.');}
  else if(record.folderId||record.resourceKey)throw Error('Klasör kimliği için teslim bağlantısı gerekiyor.');
  if(!Array.isArray(record.contents)||record.contents.length>1000||record.contents.some(c=>!object(c)||typeof c.name!=='string'||!c.name.trim()||c.name.length>500||typeof c.note!=='string'||c.note.length>1000))throw Error('Paket içeriği geçersiz.');
  if(record.contentConfirmedAt!==null&&!timestamp(record.contentConfirmedAt))throw Error('Paket içerik doğrulama tarihi geçersiz.');
  if(!Array.isArray(record.models)||record.models.length>1000||record.models.some(m=>!object(m)||typeof m.id!=='string'||!m.id||m.id.length>200||typeof m.name!=='string'||m.name.length>500||(m.hash!==undefined&&!/^[a-f0-9]{64}$/.test(m.hash))))throw Error('Model ilişkileri geçersiz.');
  text(record.sourceNote,'Kaynak notu',5000);text(record.licenseNote,'İzin notu',5000);
  if(!Array.isArray(record.versions)||record.versions.length>200)throw Error('Teslim sürümleri geçersiz veya sınırı aşıyor.');
  const ids=new Set();for(const version of record.versions){
   if(!object(version)||typeof version.id!=='string'||!version.id||version.id.length>200||ids.has(version.id)||!timestamp(version.createdAt)||!['generated','imported','restored','edited'].includes(version.origin)||!/^[a-f0-9]{64}$/.test(version.checksum))throw Error('Teslim sürümü geçersiz.');
   ids.add(version.id);text(version.content,'Sürüm içeriği',MAX_TXT);text(version.productName,'Sürüm ürün adı',1000);text(version.sourceFileName,'Kaynak dosya adı',250);
   const parsed=parseFolderUrl(version.deliveryFolderUrl);if(version.folderId!==parsed.folderId||version.resourceKey!==parsed.resourceKey)throw Error('Sürüm klasör kimliği uyuşmuyor.');
   if(version.restoredFrom!==null&&(typeof version.restoredFrom!=='string'||!version.restoredFrom||version.restoredFrom.length>200))throw Error('Geri alınan sürüm kaydı geçersiz.');
  }
  if(record.currentVersionId!==null&&!ids.has(record.currentVersionId))throw Error('Güncel teslim sürümü bulunamadı.');
  if(!object(record.checks))throw Error('Teslim kontrolleri geçersiz.');for(const kind of ['access','contents','geometry'])validateCheck(record.checks[kind],kind);
 }
 return value;
}
const api={MAX_TXT,DEFAULT_TEMPLATE,CHECK_STATUSES,parseFolderUrl,etsyListingUrl,extractTxt,suggestMatches,emptyState,createProduct,deliveryParagraph,generateTxt,checksum,createVersion,verifyVersion,restoreVersion,versionDiff,duplicateFolders,inspectContent,deliveryTxtFilename,validate};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.STLDelivery=api;
})(globalThis);
