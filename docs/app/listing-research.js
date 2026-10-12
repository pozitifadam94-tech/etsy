(function(root){
'use strict';
const SOURCE_KINDS=['product-facts','competitor-sample','marketplace-insights-user','user'];
const CLASSIFICATIONS=['digital-stl','physical','other-digital','unknown'];
const FACT_KEYS=['subject','appearance','style','kind','modelCount','contents','formats','technical','technicalConfirmed','purpose','audience','confirmedAt'];
const LIMITS={studies:300,candidates:200,observations:2000,samples:30,images:8,drafts:100,bytes:24*1024*1024};
const clone=value=>JSON.parse(JSON.stringify(value));
const own=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
const plain=value=>!!value&&typeof value==='object'&&!Array.isArray(value)&&(Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null);
const normalize=value=>String(value||'').normalize('NFKC').trim().toLocaleLowerCase('en-US').replace(/\s+/g,' ');
const privateLink=value=>/https?:\/\/(?:www\.)?(?:drive\.google\.com|docs\.google\.com|drive\.usercontent\.google\.com|drive\.googleusercontent\.com)(?:[/:?#]|$)/i.test(value);
function text(value,name,max=1000){if(typeof value!=='string'||value.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)||privateLink(value))throw Error(name+' geçersiz, çok uzun veya özel Drive bağlantısı içeriyor.');return value;}
function id(value,name='Kimlik'){if(typeof value!=='string'||! /^[A-Za-z0-9_-]{1,180}$/.test(value))throw Error(name+' geçersiz.');return value;}
function productId(value){if(typeof value!=='string'||!(/^[0-9]+$/.test(value)||/^local-[A-Za-z0-9_-]{1,160}$/.test(value)))throw Error('Ürün kimliği geçersiz.');return value;}
function shopId(value){if(typeof value!=='string'||(value&&!/^\d+$/.test(value)))throw Error('Mağaza kimliği geçersiz.');return value;}
function date(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value+'T00:00:00Z'))||new Date(value+'T00:00:00Z').toISOString().slice(0,10)!==value)throw Error('Dönem tarihi geçersiz.');return value;}
function stamp(value=Date.now()){const number=typeof value==='string'?Date.parse(value):Number(value);if(!Number.isFinite(number))throw Error('Araştırma tarihi geçersiz.');return new Date(number).toISOString();}
function timestamp(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)||!Number.isFinite(Date.parse(value)))throw Error('Kaynak tarihi saat dilimi içeren ISO biçiminde olmalı.');date(value.slice(0,10));return value;}
function https(value,optional=true){
 text(value,'Kaynak bağlantısı',2048);if(!value&&optional)return '';
 let u;try{u=new URL(value);}catch{throw Error('HTTPS kaynak bağlantısı gerekiyor.');}
 if(u.protocol!=='https:'||u.username||u.password||u.port||!u.hostname.includes('.')||u.hostname==='localhost'||u.hostname.endsWith('.localhost')||u.hostname.endsWith('.local')||u.hostname.endsWith('.internal')||/^(?:\d+\.|\[)/.test(u.hostname))throw Error('Herkese açık HTTPS kaynak bağlantısı gerekiyor.');return u.href;
}
function jsonSafe(value){
 let nodes=0;const walk=(item,depth)=>{if(++nodes>350000||depth>24)throw Error('Araştırma kaydı çok büyük veya iç içe.');if(item===null||typeof item==='boolean')return;if(typeof item==='string'){text(item,'Araştırma metni',1500000);return;}if(typeof item==='number'){if(!Number.isFinite(item))throw Error('Sonlu sayısal veri gerekiyor.');return;}if(Array.isArray(item)){if(item.length>20000)throw Error('Araştırma listesi çok büyük.');for(const entry of item)walk(entry,depth+1);return;}if(!plain(item))throw Error('Araştırma güvenli JSON verisi olmalı.');for(const [key,entry] of Object.entries(item)){if(['__proto__','prototype','constructor'].includes(key))throw Error('Güvensiz araştırma alanı.');walk(entry,depth+1);}};walk(value,0);
 if(new TextEncoder().encode(JSON.stringify(value)).byteLength>LIMITS.bytes)throw Error('Araştırma kaydı 24 MB yerel sınırını aşıyor.');
}
function canonical(value){if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';if(plain(value))return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical(value[key])).join(',')+'}';return JSON.stringify(value);}
// Deterministic change fingerprint, not a cryptographic signature or evidence check.
function signature(value){jsonSafe(value);const input=canonical(value),parts=[];for(const seed of [2166136261,2246822507,3266489909,668265263]){let h=seed;for(let i=0;i<input.length;i++)h=Math.imul(h^input.charCodeAt(i),16777619)>>>0;parts.push(h.toString(16).padStart(8,'0'));}return 'sig-v1-'+parts.join('');}
function prep(){return typeof module!=='undefined'&&module.exports?require('./preparation'):root.STLPreparation;}
function importer(){return typeof module!=='undefined'&&module.exports?require('./insights-import'):root.STLInsightsImport;}
function defaultFacts(){return {subject:'',appearance:'',style:'',kind:'unknown',modelCount:null,contents:[],formats:[],technical:[],technicalConfirmed:false,purpose:'',audience:'',confirmedAt:null};}
function validateFacts(facts){
 if(!plain(facts)||Object.keys(facts).some(key=>!FACT_KEYS.includes(key))||FACT_KEYS.some(key=>!own(facts,key)))throw Error('Ürün bilgileri eksik veya desteklenmeyen alan içeriyor.');
 for(const key of ['subject','appearance','style','purpose','audience'])text(facts[key],'Ürün '+key,1000);
 if(!['single','set','unknown'].includes(facts.kind)||!(facts.modelCount===null||(Number.isSafeInteger(facts.modelCount)&&facts.modelCount>0&&facts.modelCount<=10000))||typeof facts.technicalConfirmed!=='boolean')throw Error('Model sayısı/türü veya teknik doğrulama geçersiz.');
 if(facts.kind==='single'&&facts.modelCount!==null&&facts.modelCount!==1)throw Error('Tek model için model sayısı bir olmalı.');
 for(const key of ['contents','formats','technical']){if(!Array.isArray(facts[key])||facts[key].length>(key==='contents'?1000:50))throw Error('Ürün '+key+' listesi geçersiz.');for(const entry of facts[key]){text(entry,'Ürün '+key,500);if(!entry.trim())throw Error('Ürün listesi boş öğe içeremez.');}}
 if(facts.confirmedAt!==null)timestamp(facts.confirmedAt);
}
function createStudy(product,options={}){
 if(!plain(product))throw Error('Ürün bilgileri gerekiyor.');const pid=productId(String(product.id??product.productId??'')),sid=shopId(String(options.shopId??product.shopId??'')),at=stamp(options.now);
 const name=text(String(product.productName??product.title??''),'Ürün adı',1000),contents=prep()?.confirmedContents(options.delivery||{})||[],subject=name.replace(/\b(?:pre[- ]supported|presupported|supported|support[- ]free|print[- ]tested|test[- ]printed|successfully printed|fdm[- ]compatible|fdm|sla|msla|commercial licen[cs]e|commercial use|commercial rights|royalty[- ]free|ready to print|print[- ]ready|guaranteed(?: print)?)\b/gi,'').replace(/\s+/g,' ').replace(/^[\s,|;-]+|[\s,|;-]+$/g,'').trim(),facts={...defaultFacts(),subject,contents:contents.slice(0,1000)};
 const formats=[...new Set(contents.map(name=>/\.([a-z0-9]{1,10})$/i.exec(name)?.[1]?.toUpperCase()).filter(Boolean))];facts.formats=formats;
 const study={schema:1,id:'research-'+Date.parse(at)+'-'+signature({pid,sid,name}).slice(-16),productId:pid,shopId:sid,name,createdAt:at,updatedAt:at,facts,images:[],candidates:[],observations:[],samples:[],selection:{primary:null,supporting:[],alternatives:[],rejected:{}},drafts:[],activeDraftId:null,publishedLink:null};validateStudy(study);return study;
}
function updateFacts(study,patch,now){
 validateStudy(study);if(!plain(patch)||Object.keys(patch).some(key=>!FACT_KEYS.includes(key)))throw Error('Desteklenmeyen ürün bilgisi.');const next=clone(study),at=stamp(now);next.facts={...next.facts,...clone(patch)};
 if(!own(patch,'confirmedAt'))next.facts.confirmedAt=next.facts.subject.trim()?at:null;validateFacts(next.facts);next.updatedAt=at;next.candidates=next.candidates.map(candidate=>({...candidate,...assessPhrase(candidate.phrase,next.facts)}));return next;
}
function phrase(value){text(value,'Arama ifadesi',200);const result=value.trim().replace(/\s+/g,' ');if(!result||/https?:\/\/|[\r\n]/i.test(result))throw Error('Arama ifadesi bağlantı veya boş metin olamaz.');return result;}
function phraseTokens(value){return normalize(value).match(/[\p{L}\p{N}][\p{L}\p{N}\p{M}]*(?:['-][\p{L}\p{N}][\p{L}\p{N}\p{M}]*)*/gu)||[];}
function containsPhrase(title,value){
 const tokens=phraseTokens(title),query=phraseTokens(value);if(!query.length)return false;
 // Adjacent whole tokens preserve the observed phrase without matching inside words.
 for(let at=0;at+query.length<=tokens.length;at++)if(query.every((token,index)=>token===tokens[at+index]))return true;return false;
}
function words(value){return normalize(value).replace(/[^\p{L}\p{N} '-]/gu,' ').split(/\s+/).filter(word=>word.length>1&&!['stl','digital','download','downloads','3d','model','models','file','files','the','and','for','with','set','single'].includes(word));}
function assessPhrase(value,facts){
 const normalized=normalize(value),digital=/\b(?:stl|digital|download|3d model)\b/i.test(normalized),physical=/\b(?:physical|printed|shipped|ready[- ]made|resin print|finished print)\b/i.test(normalized);
 const intent=digital&&physical?'mixed':digital?'digital':physical?'physical':'unknown';
 if(intent==='physical')return {intent,relevance:'irrelevant',relevanceReason:'İfade fiziksel baskı/teslim niyeti taşıyor; bu ürün dijital dosya olarak hazırlanıyor.'};
 const claims=/\b(?:pre[- ]supported|presupported|supported|support[- ]free|print[- ]tested|test[- ]printed|fdm compatible|commercial licen[cs]e|commercial rights|royalty[- ]free|guaranteed)\b/i;
 const claimed=claims.test(normalized),confirmed=facts.technicalConfirmed&&facts.technical.some(entry=>normalize(entry).includes(normalized)||normalized.includes(normalize(entry)));
 if(claimed&&!confirmed)return {intent,relevance:'irrelevant',relevanceReason:'Baskı, destek, uyumluluk veya lisans iddiası doğrulanmış ürün bilgileriyle desteklenmiyor.'};
 const factual=new Set(words([facts.subject,facts.appearance,facts.style,facts.purpose,facts.audience].join(' '))),query=words(value),overlap=query.some(word=>factual.has(word));
 const ballet=/\b(?:ballerina|ballet dancer)\b/i.test(facts.subject)&&/\b(?:ballerina|ballet dancer)\b/i.test(value);
 if(!facts.subject.trim()||(!overlap&&!ballet))return {intent,relevance:'review',relevanceReason:'İfadenin ürünün doğrulanmış konusu ile ilişkisi açık değil; kullanıcı uygunluğu kontrol etmeli.'};
 return {intent,relevance:'relevant',relevanceReason:intent==='mixed'?'Ürünle konu ortaklığı var; dijital dosya ile fiziksel ürün niyeti karışabilir.':intent==='unknown'?'Ürünle konu ortaklığı var; alıcının dosya mı fiziksel ürün mü aradığı bilinmiyor.':'Ürünle konu ve dijital dosya niyeti ortaklığı var; bu, arama talebi kanıtı değildir.'};
}
function addTo(next,value,source){
 const term=phrase(value),key=normalize(term),found=next.candidates.find(candidate=>normalize(candidate.phrase)===key);
 if(found){const existing=found.sources.find(item=>item.kind===source.kind&&item.description===source.description&&item.sourceUrl===source.sourceUrl&&item.acquiredAt===source.acquiredAt);if(existing)existing.referenceIds=[...new Set([...existing.referenceIds,...source.referenceIds])];else found.sources.push(clone(source));Object.assign(found,assessPhrase(term,next.facts));return found;}
 if(next.candidates.length>=LIMITS.candidates)throw Error('En fazla 200 kelime adayı saklanabilir. Önce mevcut adayları kullan.');
 const candidate={id:'keyword-'+signature(key).slice(-24),phrase:term,sources:[clone(source)],...assessPhrase(term,next.facts)};next.candidates.push(candidate);return candidate;
}
function addCandidate(study,value,options={}){
 validateStudy(study);const kind=options.kind??'user';if(!SOURCE_KINDS.includes(kind))throw Error('Kelime kaynağı geçersiz.');if(!['user','product-facts'].includes(kind)&&!Array.isArray(options.referenceIds))throw Error('Gözlenen/ölçülen kaynak için önce gerçek veri aktarımı ve kayıt referansı gerekiyor.');const next=clone(study),at=stamp(options.now),description=text(options.description??(kind==='user'?'Kullanıcının eklediği ifade; ölçülmüş arama verisi değil.':'Ürün bilgisine dayalı araştırma adayı.'),'Kelime kaynak açıklaması',2000);
 addTo(next,value,{kind,description,sourceUrl:options.sourceUrl?https(options.sourceUrl):'',acquiredAt:at,referenceIds:Array.isArray(options.referenceIds)?options.referenceIds.slice():[]});next.updatedAt=at;validateStudy(next);return next;
}
function buildCandidates(study){
 validateStudy(study);const next=clone(study),facts=next.facts,subject=facts.subject.trim(),at=stamp();if(!subject)return next;
 const stl=facts.formats.some(format=>normalize(format)==='stl')||/\bstl\b/i.test(subject),base=subject.replace(/\bstl\b/ig,'').replace(/\s+/g,' ').trim(),suffix=stl?' stl':'';
 const entries=[[base+suffix,'subject'],[base+' digital file','subject']];
 if(facts.style.trim())entries.push([facts.style.trim()+' '+base+suffix,'style']);if(facts.appearance.trim())entries.push([base+' '+facts.appearance.trim()+suffix,'appearance']);
 if(facts.kind==='set')entries.push([base+' set'+suffix,'kind']);if(facts.kind==='single')entries.push([base+' single model'+suffix,'kind']);
 if(facts.purpose.trim())entries.push([base+' '+facts.purpose.trim()+suffix,'purpose']);if(facts.audience.trim())entries.push([base+' '+facts.audience.trim()+suffix,'audience']);
 if(/\bballerina\b/i.test(base))entries.push(['ballet dancer'+suffix,'subject']);else if(/\bballet dancer\b/i.test(base))entries.push(['ballerina'+suffix,'subject']);
 for(const [entry,field] of entries)if(entry.trim()&&entry.length<=180)addTo(next,entry,{kind:'product-facts',description:'Girilen ürün bilgisinden aday: '+field+'. Arama hacmi ölçülmedi.',sourceUrl:'',acquiredAt:facts.confirmedAt||study.createdAt,referenceIds:[study.productId,field]});
 next.candidates=next.candidates.map(candidate=>({...candidate,...assessPhrase(candidate.phrase,facts)}));next.updatedAt=at;validateStudy(next);return next;
}
function observationIdentity(row){const next=clone(row);delete next.id;delete next.acquiredAt;return signature(next);}
function importObservations(study,rows){
 validateStudy(study);if(!Array.isArray(rows))throw Error('Önizlenmiş arama veri satırları gerekiyor.');const next=clone(study),known=new Set(next.observations.map(observationIdentity));let changed=false;
 for(const input of rows){importer().validateObservation(input);const row=clone(input),key=observationIdentity(row);if(known.has(key))continue;if(next.observations.length>=LIMITS.observations)throw Error('Araştırmada en fazla 2000 arama veri satırı saklanabilir.');
  if(next.observations.some(item=>item.id===row.id))throw Error('Aktarılan veri kimliği farklı bir kayıtla çakışıyor; mevcut araştırma değiştirilmedi.');next.observations.push(row);known.add(key);changed=true;
  addTo(next,row.phrase,{kind:'marketplace-insights-user',description:row.sourceDescription,sourceUrl:row.sourceUrl,acquiredAt:row.acquiredAt,referenceIds:[row.id]});
 }
 if(changed)next.updatedAt=stamp();validateStudy(next);return next;
}
function classify(listing){
 if(listing.type==='physical')return {classification:'physical',classificationSource:'api',classificationReason:'API türü fiziksel; STL dosyası rakibi olarak sayılmadı.'};
 if(listing.type==='download'){
  if(/\bstl\b/i.test(listing.title)&&!/\bno stl|\bnot (?:an? )?stl|\bstl not (?:included|provided)/i.test(listing.title))return {classification:'digital-stl',classificationSource:'api+title',classificationReason:'API dijital türü ve başlıkta STL ifadesi. Dosya içeriği veya baskı kalitesi doğrulanmadı.'};
  if(/\b(?:pdf|svg|dxf|png|embroidery|crochet pattern)\b/i.test(listing.title))return {classification:'other-digital',classificationSource:'api+title',classificationReason:'API dijital türü; başlıkta STL dışı dosya/ürün ifadesi. İçerik doğrulanmadı.'};
  return {classification:'unknown',classificationSource:'api',classificationReason:'Dijital ilan ama STL dosyası olduğu başlıktan doğrulanamadı.'};
 }
 return {classification:'unknown',classificationSource:'heuristic',classificationReason:'API ilan türü bilinmiyor. Başlık tek başına kesin STL/fiziksel ayrımı sağlamaz.'};
}
function sampleSummary(sample,listings=sample.listings){
 const groups=new Map(),prices=new Map(),counts=Object.fromEntries(CLASSIFICATIONS.map(kind=>[kind,0]));for(const listing of listings){counts[listing.classification]++;if(listing.shopId)groups.set(listing.shopId,(groups.get(listing.shopId)||0)+1);if(listing.classification==='digital-stl'&&listing.price!==null&&listing.currency){const amounts=prices.get(listing.currency)||[];amounts.push(listing.price);prices.set(listing.currency,amounts);}}
 const known=[...groups.values()].reduce((sum,count)=>sum+count,0),distribution=[...groups].map(([shopId,count])=>({shopId,count,share:known?count/known:null})).sort((a,b)=>b.count-a.count);
 return {sampled:listings.length,classificationCounts:counts,knownShopListings:known,unknownShopListings:listings.length-known,shops:groups.size,shopDistribution:distribution,dominantShare:known?distribution[0].share:null,priceScope:'digital-stl-only',prices:[...prices].map(([currency,amounts])=>{amounts.sort((a,b)=>a-b);const n=amounts.length;return {currency,count:n,min:amounts[0],median:(amounts[Math.floor((n-1)/2)]+amounts[Math.floor(n/2)])/2,max:amounts.at(-1)};}),limits:['İlan örneklemi arama hacmi, satış veya dönüşüm verisi değildir.','Mağaza ağırlığı yalnızca mağaza kimliği bilinen örnek ilanlardan hesaplanır.','Fiyat özetinde yalnız dijital-STL sınıflandırılmış ilanlar var; para birimleri ayrı tutulur.']};
}
function normalizeSample(input){
 if(!plain(input)||!Array.isArray(input.listings)||input.listings.length>1000)throw Error('En fazla 1000 satırlık ilan örneklemi gerekiyor.');jsonSafe(input);
 const query=phrase(String(input.query||'')),acquiredAt=timestamp(String(input.acquiredAt??input.updated??'')),listings=[],seen=new Set(),warnings=[];
 for(const raw of input.listings){if(!plain(raw))throw Error('İlan örneği geçersiz.');const listingId=String(raw.id??'');if(!/^\d+$/.test(listingId))throw Error('Örnek ilan kimliği geçersiz.');if(seen.has(listingId)){warnings.push('Tekrarlanan ilan '+listingId+' örneklemden ayıklandı.');continue;}seen.add(listingId);
  const listing={id:listingId,title:text(String(raw.title??''),'Örnek ilan başlığı',1000),shopId:raw.shopId===null||raw.shopId===undefined?'':shopId(String(raw.shopId)),type:typeof raw.type==='string'?text(raw.type,'İlan türü',50):null,created:Number.isFinite(raw.created)&&raw.created>0?raw.created:null,price:raw.price===null||raw.price===undefined?null:raw.price,currency:raw.currency===null||raw.currency===undefined?'':raw.currency,image:raw.image?https(raw.image):''};
  if(listing.price!==null&&(!Number.isFinite(listing.price)||listing.price<0))throw Error('Örnek fiyatı sıfır veya daha büyük sonlu sayı olmalı.');if(typeof listing.currency!=='string'||(listing.currency&&!/^[A-Z]{3}$/.test(listing.currency)))throw Error('Örnek fiyat para birimi geçersiz.');if(listing.price!==null&&!listing.currency)warnings.push('İlan '+listing.id+' fiyatının para birimi bilinmiyor; fiyat karşılaştırmasına alınmadı.');
  Object.assign(listing,classify(listing));listings.push(listing);
 }
 if(input.searchCount!==null&&input.searchCount!==undefined)warnings.push('İlan örneklemindeki arama sayısı alanı kullanılmadı; API ilan örneklemi Marketplace Insights arama hacmi sağlamaz.');
 const count=input.reportedListingCount??input.reportedCount??null;if(count!==null&&(!Number.isSafeInteger(count)||count<0))throw Error('Bildirilen ilan sayısı geçersiz.');
 const source=['etsy-public-api-sample','existing-market-watch'].includes(input.source)?input.source:'user-listing-sample';
 const sample={source,sourceDescription:text(input.sourceDescription||'Etsy ilan örneklemi; arama sayısı/özel satış verisi sağlamaz.','Örneklem kaynak açıklaması',1000),sourceUrl:input.sourceUrl?https(input.sourceUrl):'',query,acquiredAt,sort:text(input.sort||'unknown','Örneklem sırası',100),sampleLimit:Number.isSafeInteger(input.sampleLimit)&&input.sampleLimit>0?input.sampleLimit:100,reportedListingCount:count,searchCount:null,region:input.region??null,language:input.language??null,sampled:listings.length,rawSampleSize:Number.isSafeInteger(input.rawSampleSize)&&input.rawSampleSize>=input.listings.length?input.rawSampleSize:input.listings.length,listings,warnings};
 if(sample.region!==null)text(sample.region,'Örneklem bölgesi',150);if(sample.language!==null)text(sample.language,'Örneklem dili',150);
 sample.sourceSignature=signature(sample);sample.id='sample-'+sample.sourceSignature.slice(-24);sample.summary=sampleSummary(sample);return sample;
}
function observedPhrases(title,facts){
 const tokens=phraseTokens(title),subject=new Set(words(facts.subject)),result=[];
 for(let size=3;size>=2;size--)for(let at=0;at+size<=tokens.length;at++){const slice=tokens.slice(at,at+size),term=slice.join(' ');if(slice.some(word=>subject.has(word))&&term.length<=80&&!result.includes(term))result.push(term);if(result.length>=3)return result;}
 return result;
}
function importSample(study,input){
 validateStudy(study);const sample=normalizeSample(input),next=clone(study);if(next.samples.some(existing=>existing.sourceSignature===sample.sourceSignature))return next;if(next.samples.length>=LIMITS.samples)throw Error('Araştırmada en fazla 30 ilan örneklemi saklanabilir.');
 next.samples.push(sample);let limit=false;for(const listing of sample.listings)for(const term of observedPhrases(listing.title,next.facts)){if(next.candidates.length>=LIMITS.candidates&&!next.candidates.some(item=>normalize(item.phrase)===normalize(term))){limit=true;continue;}addTo(next,term,{kind:'competitor-sample',description:'Örnek ilanın başlığında gözlendi; '+listing.classification+' sınıfı, açıklama veya satış bilgisi değil.',sourceUrl:'https://www.etsy.com/listing/'+listing.id,acquiredAt:sample.acquiredAt,referenceIds:[sample.id,listing.id]});}
 if(limit)sample.warnings.push('200 aday sınırı nedeniyle bazı başlık ifadeleri aday listesine eklenmedi; ilan örneklemi korundu.');next.updatedAt=stamp();validateStudy(next);return next;
}
function classifySample(study,sampleId,listingId,classification){
 validateStudy(study);if(!CLASSIFICATIONS.includes(classification))throw Error('Örnek sınıfı geçersiz.');const next=clone(study),sample=next.samples.find(item=>item.id===sampleId),listing=sample?.listings.find(item=>item.id===String(listingId));if(!listing)throw Error('Sınıflandırılacak örnek ilan bulunamadı.');
 listing.classificationHistory??=[];listing.classificationHistory.push({classification:listing.classification,source:listing.classificationSource,reason:listing.classificationReason,at:listing.classificationChangedAt||sample.acquiredAt});if(listing.classificationHistory.length>30)throw Error('Bu ilan için en fazla 30 sınıflandırma düzeltmesi saklanabilir.');
 Object.assign(listing,{classification,classificationSource:'user',classificationReason:'Kullanıcı ilan sınıfını düzeltti; gerçek dosya içeriği bu işlemle kontrol edilmedi.',classificationChangedAt:stamp()});sample.summary=sampleSummary(sample);next.updatedAt=stamp();validateStudy(next);return next;
}
function choose(study,candidateId,role,reason){
 validateStudy(study);if(!['primary','supporting','alternative','rejected','none'].includes(role))throw Error('Kelime seçim rolü geçersiz.');const candidate=study.candidates.find(item=>item.id===candidateId);if(!candidate)throw Error('Kelime adayı bulunamadı.');text(reason,'Seçim gerekçesi',1000);if(role!=='none'&&!reason.trim())throw Error('Seçilme veya elenme gerekçesi gerekiyor.');
 if(['primary','supporting'].includes(role)&&candidate.relevance==='irrelevant')throw Error('İlgisiz veya desteklenmeyen iddialı ifade ana/destek hedef olamaz.');const next=clone(study),selection=next.selection;
 if(selection.primary?.candidateId===candidateId)selection.primary=null;selection.supporting=selection.supporting.filter(item=>item.candidateId!==candidateId);selection.alternatives=selection.alternatives.filter(item=>item.candidateId!==candidateId);delete selection.rejected[candidateId];
 if(role==='primary')selection.primary={candidateId,reason};else if(role==='supporting')selection.supporting.push({candidateId,reason});else if(role==='alternative')selection.alternatives.push({candidateId,reason});else if(role==='rejected')selection.rejected[candidateId]=reason;
 next.updatedAt=stamp();validateStudy(next);return next;
}
function evidenceFor(study,candidate){
 const row=typeof candidate==='string'?study.candidates.find(item=>item.id===candidate):candidate;if(!row)throw Error('Kanıtı incelenecek kelime bulunamadı.');
 const observations=study.observations.filter(item=>normalize(item.phrase)===normalize(row.phrase)).map(clone),sampleEvidence=[];
 for(const sample of study.samples){const matched=sample.listings.filter(listing=>containsPhrase(listing.title,row.phrase));if(!matched.length)continue;
  const digital=matched.filter(listing=>listing.classification==='digital-stl'),summary=sampleSummary(sample,digital);sampleEvidence.push({sampleId:sample.id,query:sample.query,source:sample.source,sourceUrl:sample.sourceUrl,acquiredAt:sample.acquiredAt,sort:sample.sort,count:digital.length,matched:matched.length,listingIds:matched.map(listing=>listing.id),shops:summary.shops,dominantShare:summary.dominantShare,prices:summary.prices,classificationCounts:sampleSummary(sample,matched).classificationCounts,sampled:sample.sampled,rawSampleSize:sample.rawSampleSize,reportedListingCount:sample.reportedListingCount,limits:summary.limits});
 }
 const hasExactSearchEvidence=observations.some(item=>item.searches.state==='exact'),hasSearchEvidence=observations.some(item=>['exact','threshold'].includes(item.searches.state)),missing=[];
 if(!hasSearchEvidence)missing.push('Arama sayısı bilinmiyor; ürün veya rakip başlığı arama hacmi değildir.');
 if(observations.some(item=>!item.period.start||!item.period.end))missing.push('Bazı verilerin kesin dönem başlangıç/bitiş tarihleri bilinmiyor.');
 if(observations.some(item=>item.region===null))missing.push('Bazı kaynaklarda bölge kapsamı belirtilmemiş; ABD varsayılmadı.');if(observations.some(item=>item.language===null))missing.push('Bazı kaynaklarda dil kapsamı belirtilmemiş.');
 if(observations.some(item=>item.listings.state==='missing'||item.listings.state==='ambiguous'))missing.push('Bazı ilan sayıları eksik veya belirsiz.');
 return {observations,sampleEvidence,hasSearchEvidence,hasExactSearchEvidence,missing,label:hasExactSearchEvidence?'Kullanıcının aktardığı arama verisi var; başarı veya sıralama garantisi değil.':hasSearchEvidence?'Kullanıcının aktardığı eşikli arama verisi var; kesin arama sayısı değil.':'Ürün bilgilerine dayalı, arama verisiyle doğrulanmamış'};
}
function selectionFor(selection,candidateId){if(selection.primary?.candidateId===candidateId)return {role:'primary',reason:selection.primary.reason};for(const [key,role] of [['supporting','supporting'],['alternatives','alternative']]){const row=selection[key].find(item=>item.candidateId===candidateId);if(row)return {role,reason:row.reason};}return own(selection.rejected,candidateId)?{role:'rejected',reason:selection.rejected[candidateId]}:{role:'none',reason:''};}
function compare(study){
 validateStudy(study);const rows=study.candidates.map(candidate=>({...clone(candidate),candidateId:candidate.id,...evidenceFor(study,candidate),selection:selectionFor(study.selection,candidate.id)}));
 const primary=rows.find(row=>row.selection.role==='primary')||null,supporting=rows.filter(row=>row.selection.role==='supporting'),alternatives=rows.filter(row=>row.selection.role==='alternative'),rejected=rows.filter(row=>row.selection.role==='rejected'),selected=[...(primary?[primary]:[]),...supporting],missing=[];
 if(!study.facts.subject.trim())missing.push('Ürünün İngilizce konusu eksik.');if(!study.facts.formats.length)missing.push('Dosya formatı doğrulanmış ürün bilgisine eklenmemiş.');if(!study.facts.confirmedAt)missing.push('Ürün bilgileri kullanıcı tarafından henüz doğrulanmamış.');if(!primary)missing.push('Ana hedef ifade seçilmemiş.');for(const row of selected)missing.push(...row.missing);
 return {rows,primary,supporting,alternatives,rejected,samples:study.samples.map(sample=>({sampleId:sample.id,query:sample.query,acquiredAt:sample.acquiredAt,sort:sample.sort,reportedListingCount:sample.reportedListingCount,rawSampleSize:sample.rawSampleSize,...sampleSummary(sample),warnings:sample.warnings.slice()})),missing:[...new Set(missing)],label:selected.some(row=>row.hasSearchEvidence)?'Seçilmiş ifadeler için kullanıcı aktarımı arama kanıtı var; kaynaklar ve dönemler ayrı gösterilir.':'Ürün bilgilerine dayalı, arama verisiyle doğrulanmamış',limits:['SEO puanı, satış olasılığı veya kesin kazanan kelime üretilmez.','Farklı kaynak, dönem ve ölçüler toplanmaz; arama/ilan oranı başarı ihtimali değildir.','İlan görselleri gösterilir; görsel anlamı veya görseldeki yazılar analiz edilmedi.']};
}
function linkListing(study,listingId,options={}){
 validateStudy(study);const listing=String(listingId);if(!/^\d+$/.test(listing))throw Error('Yayımlanmış Etsy ilan kimliği gerekiyor.');const next=clone(study);
 // Reconnecting an existing listing must not replace its original local baseline.
 if(next.publishedLink?.listingId===listing)return next;
 const at=stamp(options.now),initialDraft=next.drafts.find(draft=>draft.id===next.activeDraftId)||null,basis=initialDraft?.basis;
 next.publishedLink={listingId:listing,shopId:next.shopId,linkedAt:at,studyId:next.id,productId:next.productId,activeDraftId:initialDraft?.id||null,initialDraft:initialDraft?clone(initialDraft):null,baselineSource:initialDraft?'saved-draft':'unavailable',baselineTextVerified:false,targetSelection:basis?clone(basis.selection):null,researchUpdatedAt:basis?.createdAt||null,researchSignature:basis?.signature||null};next.updatedAt=at;validateStudy(next);return next;
}
function validateSource(source){if(!plain(source)||!SOURCE_KINDS.includes(source.kind)||!Array.isArray(source.referenceIds)||source.referenceIds.length>3000)throw Error('Kelime kaynak kaydı geçersiz.');text(source.description,'Kaynak açıklaması',2000);https(source.sourceUrl);if(source.acquiredAt!==null)timestamp(source.acquiredAt);for(const reference of source.referenceIds)text(reference,'Kaynak referansı',180);}
function validateImage(image){if(!plain(image)||!['user-upload','etsy-image'].includes(image.source))throw Error('Araştırma görsel kaydı geçersiz.');id(image.id,'Görsel kimliği');text(image.name,'Görsel adı',250);text(image.description,'Görsel açıklaması',1000);if(typeof image.url!=='string'||image.url.length>1500000)throw Error('Görsel çok büyük.');if(!/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(image.url))https(image.url,false);}
function validateDraft(draft,study){
 if(!plain(draft))throw Error('Araştırma taslağı geçersiz.');id(draft.id,'Taslak kimliği');timestamp(draft.createdAt);if(!['local','ai','manual'].includes(draft.origin))throw Error('Taslak kaynağı geçersiz.');const result=prep().validateDraft({title:draft.title,tags:draft.tags,description:draft.description});if(!result.ok)throw Error(result.errors.join(' '));
 if(!Array.isArray(draft.titleAlternatives)||draft.titleAlternatives.length>2)throw Error('Başlık alternatifleri geçersiz.');for(const title of draft.titleAlternatives)text(title,'Başlık alternatifi',140);
 for(const key of ['reasons','missing','warnings']){if(!Array.isArray(draft[key])||draft[key].length>200)throw Error('Taslak '+key+' listesi geçersiz.');for(const value of draft[key])text(value,'Taslak '+key,5000);}
 text(draft.researchLabel,'Araştırma etiketi',1000);if(!plain(draft.categorySuggestion)||!(draft.categorySuggestion.name===null||typeof draft.categorySuggestion.name==='string')||!(draft.categorySuggestion.id===null||Number.isSafeInteger(draft.categorySuggestion.id)||typeof draft.categorySuggestion.id==='string')||typeof draft.categorySuggestion.source!=='string'||typeof draft.categorySuggestion.reason!=='string')throw Error('Kategori önerisi geçersiz.');if(!Array.isArray(draft.attributes)||draft.attributes.length>100)throw Error('Özellik önerileri geçersiz.');
 if(!plain(draft.basis)||draft.basis.studyId!==study.id||draft.basis.productId!==study.productId||!/^sig-v1-[a-f0-9]{32}$/.test(draft.basis.signature)||!Array.isArray(draft.basis.observations)||!Array.isArray(draft.basis.samples)||!Array.isArray(draft.basis.candidates)||!plain(draft.basis.selection))throw Error('Taslak araştırma dayanağı geçersiz.');timestamp(draft.basis.createdAt);validateFacts(draft.basis.facts);
}
function validatePublishedLink(link,study){
 if(!plain(link)||!/^\d+$/.test(link.listingId)||link.shopId!==study.shopId||link.studyId!==study.id||link.productId!==study.productId)throw Error('Yayın sonrası ilan ilişkisi geçersiz.');timestamp(link.linkedAt);if(link.initialDraft!==null)validateDraft(link.initialDraft,study);
 if(own(link,'baselineSource')){
  // A listing relationship records a local draft; it does not verify Etsy's text.
  if(!['saved-draft','unavailable'].includes(link.baselineSource)||link.baselineTextVerified!==false)throw Error('Başlangıç metninin kaynağı veya doğrulama durumu geçersiz.');
  if(link.baselineSource==='unavailable'){
   if(link.initialDraft!==null||link.activeDraftId!==null||link.targetSelection!==null||link.researchUpdatedAt!==null||link.researchSignature!==null)throw Error('Kaydedilmiş taslak olmadan başlangıç metni veya hedefleri doğrulanamaz.');return;
  }
  if(link.initialDraft===null||link.activeDraftId!==link.initialDraft.id||link.researchUpdatedAt!==link.initialDraft.basis.createdAt||link.researchSignature!==link.initialDraft.basis.signature||!plain(link.targetSelection)||signature(link.targetSelection)!==signature(link.initialDraft.basis.selection))throw Error('Başlangıç hedefleri ve araştırma tarihi kaydedilmiş taslağın dayanağıyla uyuşmuyor.');
 }
 // Older records predate explicit local-baseline metadata and remain readable.
 if(!/^sig-v1-[a-f0-9]{32}$/.test(link.researchSignature)||!plain(link.targetSelection))throw Error('Başlangıç hedef kelimeleri veya araştırma kimliği geçersiz.');timestamp(link.researchUpdatedAt);
}
function validateStudy(study){
 jsonSafe(study);if(!plain(study)||study.schema!==1)throw Error('Araştırma çalışması geçersiz.');id(study.id,'Araştırma kimliği');productId(study.productId);shopId(study.shopId);text(study.name,'Araştırma adı',1000);timestamp(study.createdAt);timestamp(study.updatedAt);validateFacts(study.facts);
 for(const [key,max] of [['images',LIMITS.images],['candidates',LIMITS.candidates],['observations',LIMITS.observations],['samples',LIMITS.samples],['drafts',LIMITS.drafts]])if(!Array.isArray(study[key])||study[key].length>max)throw Error('Araştırma '+key+' listesi geçersiz veya sınırı aşıyor.');for(const image of study.images)validateImage(image);
 const candidateIds=new Set();for(const candidate of study.candidates){id(candidate.id,'Kelime kimliği');if(candidateIds.has(candidate.id))throw Error('Tekrarlanan kelime kimliği.');candidateIds.add(candidate.id);phrase(candidate.phrase);if(!['relevant','review','irrelevant'].includes(candidate.relevance)||!['digital','mixed','physical','unknown'].includes(candidate.intent))throw Error('Kelime uygunluk/niyet kaydı geçersiz.');text(candidate.relevanceReason,'Uygunluk gerekçesi',2000);if(!Array.isArray(candidate.sources)||!candidate.sources.length||candidate.sources.length>100)throw Error('Kelime kaynakları geçersiz.');for(const source of candidate.sources)validateSource(source);}
 const observationIds=new Set();for(const observation of study.observations){importer().validateObservation(observation);if(observationIds.has(observation.id))throw Error('Tekrarlanan araştırma verisi kimliği.');observationIds.add(observation.id);}
 const sampleIds=new Set();for(const sample of study.samples){id(sample.id,'Örneklem kimliği');if(sampleIds.has(sample.id))throw Error('Tekrarlanan örneklem kimliği.');sampleIds.add(sample.id);if(!/^sig-v1-[a-f0-9]{32}$/.test(sample.sourceSignature))throw Error('Örneklem kaynak kimliği geçersiz.');phrase(sample.query);timestamp(sample.acquiredAt);if(!['etsy-public-api-sample','existing-market-watch','user-listing-sample'].includes(sample.source))throw Error('Örneklem kaynağı geçersiz.');text(sample.sourceDescription,'Örneklem kaynak açıklaması',1000);https(sample.sourceUrl);text(sample.sort,'Örneklem sırası',100);if(sample.searchCount!==null||!Array.isArray(sample.listings)||sample.listings.length>1000||sample.sampled!==sample.listings.length||!Number.isSafeInteger(sample.rawSampleSize)||sample.rawSampleSize<sample.sampled||!Number.isSafeInteger(sample.sampleLimit)||sample.sampleLimit<1)throw Error('Örneklem kapsamı geçersiz.');if(sample.reportedListingCount!==null&&(!Number.isSafeInteger(sample.reportedListingCount)||sample.reportedListingCount<0))throw Error('Örneklem ilan sayısı geçersiz.');for(const key of ['region','language'])if(sample[key]!==null)text(sample[key],'Örneklem '+key,150);if(!Array.isArray(sample.warnings))throw Error('Örneklem uyarıları geçersiz.');for(const warning of sample.warnings)text(warning,'Örneklem uyarısı',1000);
  const listingIds=new Set();for(const listing of sample.listings){if(!plain(listing)||!/^\d+$/.test(listing.id)||listingIds.has(listing.id)||!CLASSIFICATIONS.includes(listing.classification)||!['api','api+title','heuristic','user'].includes(listing.classificationSource))throw Error('Örnek ilan kaydı geçersiz.');listingIds.add(listing.id);text(listing.title,'Örnek ilan başlığı',1000);shopId(listing.shopId);text(listing.classificationReason,'Sınıflandırma gerekçesi',2000);if(listing.type!==null)text(listing.type,'İlan türü',50);if(listing.price!==null&&(!Number.isFinite(listing.price)||listing.price<0))throw Error('Örnek fiyatı geçersiz.');if(typeof listing.currency!=='string'||(listing.currency&&!/^[A-Z]{3}$/.test(listing.currency)))throw Error('Örnek para birimi geçersiz.');if(listing.image)https(listing.image);if(listing.created!==null&&(!Number.isFinite(listing.created)||listing.created<0))throw Error('İlan yayın tarihi geçersiz.');if(listing.classificationChangedAt)timestamp(listing.classificationChangedAt);if(listing.classificationHistory!==undefined){if(!Array.isArray(listing.classificationHistory)||listing.classificationHistory.length>30)throw Error('Sınıflandırma geçmişi geçersiz.');for(const item of listing.classificationHistory){if(!CLASSIFICATIONS.includes(item.classification)||!['api','api+title','heuristic','user'].includes(item.source))throw Error('Sınıflandırma geçmişi geçersiz.');text(item.reason,'Eski sınıflandırma gerekçesi',2000);timestamp(item.at);}}
  }
 }
 for(const candidate of study.candidates)for(const source of candidate.sources){
  if(source.kind==='marketplace-insights-user'&&!study.observations.some(row=>source.referenceIds.includes(row.id)&&normalize(row.phrase)===normalize(candidate.phrase)))throw Error('Kelimenin arama kaynağı gerçek aktarım kaydına bağlanmamış.');
  if(source.kind==='competitor-sample'&&!study.samples.some(sample=>source.referenceIds.includes(sample.id)&&sample.listings.some(listing=>source.referenceIds.includes(listing.id)&&containsPhrase(listing.title,candidate.phrase))))throw Error('Rakip ifadesi kayıtlı örnek başlığında gözlenmemiş.');
 }
 if(!plain(study.selection)||!Array.isArray(study.selection.supporting)||!Array.isArray(study.selection.alternatives)||!plain(study.selection.rejected))throw Error('Kelime seçimleri geçersiz.');const selected=new Set();const checkSelection=entry=>{if(!plain(entry)||!candidateIds.has(entry.candidateId)||selected.has(entry.candidateId)||typeof entry.reason!=='string'||!entry.reason.trim())throw Error('Seçilmiş ifade veya gerekçe geçersiz.');text(entry.reason,'Seçim gerekçesi',1000);selected.add(entry.candidateId);};if(study.selection.primary!==null)checkSelection(study.selection.primary);for(const entry of [...study.selection.supporting,...study.selection.alternatives])checkSelection(entry);for(const [candidateId,reason] of Object.entries(study.selection.rejected)){if(!candidateIds.has(candidateId)||selected.has(candidateId)||typeof reason!=='string'||!reason.trim())throw Error('Elenen ifade geçersiz.');text(reason,'Eleme gerekçesi',1000);selected.add(candidateId);}
 const draftIds=new Set();for(const draft of study.drafts){validateDraft(draft,study);if(draftIds.has(draft.id))throw Error('Tekrarlanan taslak kimliği.');draftIds.add(draft.id);}if(study.activeDraftId!==null&&!draftIds.has(study.activeDraftId))throw Error('Etkin araştırma taslağı bulunamadı.');
 if(study.publishedLink!==null)validatePublishedLink(study.publishedLink,study);
 return study;
}
function validate(state){if(!plain(state)||state.schema!==1||!plain(state.studies)||Object.keys(state.studies).length>LIMITS.studies)throw Error('Araştırma çalışma alanı geçersiz.');jsonSafe(state);for(const [key,study] of Object.entries(state.studies)){if(key!==study.id)throw Error('Araştırma kimliği anahtarla uyuşmuyor.');validateStudy(study);}return state;}
const api={SOURCE_KINDS,CLASSIFICATIONS,LIMITS,createStudy,updateFacts,buildCandidates,addCandidate,importObservations,importSample,classifySample,choose,compare,evidenceFor,linkListing,validate,validateStudy,signature};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.STLListingResearch=api;
})(globalThis);
