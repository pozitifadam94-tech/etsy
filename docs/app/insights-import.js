(function(root){
'use strict';
const MAX_BYTES=128*1024,MAX_ROWS=200,SOURCE='marketplace-insights-user';
const SOURCE_DESCRIPTION='Kullanıcının aktardığı Etsy Marketplace Insights verisi; otomatik API verisi değildir.';
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const plain=o=>!!o&&typeof o==='object'&&!Array.isArray(o)&&(Object.getPrototypeOf(o)===Object.prototype||Object.getPrototypeOf(o)===null);
const bytes=s=>new TextEncoder().encode(s).byteLength;
const PRIVATE_LINK=/(?:https?:\/\/)?(?:drive\.google\.com|docs\.google\.com|drive\.usercontent\.google\.com)\//i;
function hasPrivateLink(text){let value=String(text);for(let i=0;i<3;i++){if(PRIVATE_LINK.test(value))return true;const decoded=value.replace(/%([a-f0-9]{2})/ig,(_,n)=>String.fromCharCode(parseInt(n,16)));if(decoded===value)break;value=decoded;}return false;}
const metric=(state,raw,value=null,bound=null)=>({state,value,raw,bound});
function parseMetric(value){
 if(plain(value)){
  try{validateMetric(value);return {...value};}catch{return metric('ambiguous',typeof value.raw==='string'?value.raw:'[unsupported metric object]');}
 }
 if(value===null||value===undefined)return metric('missing','');
 const raw=typeof value==='string'?value:String(value),s=raw.trim().replace(/[\u00a0\u202f]/g,' ');
 if(!s||/^(?:unknown|n\/?a|none|no data|not available|data unavailable|missing|bilinmiyor|bilinmeyen|veri yok|yok|—|–|-)$/i.test(s))return metric('missing',raw);
 if(typeof value!=='string'&&typeof value!=='number')return metric('ambiguous',raw);
 if(typeof value==='number')return Number.isSafeInteger(value)&&value>=0?metric('exact',raw,value):metric('ambiguous',raw);
 let threshold=/^(?:<\s*=?|≤\s*|less than\s+|below\s+|under\s+)(\d+)$/i.exec(s);
 if(!threshold)threshold=/^(\d+)\s*(?:['’]?(?:den|dan)\s+az|altında)$/i.exec(s);
 if(threshold){const n=Number(threshold[1]);return Number.isSafeInteger(n)?metric('threshold',raw,null,n):metric('ambiguous',raw);}
 if(/^\d+$/.test(s)){const n=Number(s);return Number.isSafeInteger(n)?metric('exact',raw,n):metric('ambiguous',raw);}
 // Search/listing counts are integer measures. Only consistently grouped
 // thousands are accepted; decimal, abbreviated and mixed forms stay unknown.
 if(/^\d{1,3}([.,' ])\d{3}(?:\1\d{3})*$/.test(s)){const n=Number(s.replace(/[.,' ]/g,''));return Number.isSafeInteger(n)?metric('exact',raw,n):metric('ambiguous',raw);}
 return metric('ambiguous',raw);
}
function validateMetric(value){
 if(!plain(value)||Object.keys(value).some(k=>!['state','value','raw','bound'].includes(k))||!['missing','exact','threshold','ambiguous'].includes(value.state)||typeof value.raw!=='string'||value.raw.length>500)throw Error('Geçersiz arama/ilan ölçüsü.');
 if(value.state==='exact'){if(!Number.isSafeInteger(value.value)||value.value<0||value.bound!==null)throw Error('Kesin ölçü negatif olmayan tam sayı olmalı.');}
 else if(value.value!==null)throw Error('Bilinmeyen veya eşik ölçüsü kesin sayı olamaz.');
 if(value.state==='threshold'){if(!Number.isSafeInteger(value.bound)||value.bound<0)throw Error('Eşik sınırı geçersiz.');}
 else if(value.bound!==null)throw Error('Bu ölçüde eşik sınırı bulunamaz.');
 const parsed=parseMetric(value.raw);if(parsed.state!==value.state||parsed.value!==value.value||parsed.bound!==value.bound)throw Error('Ölçü, saklanan kaynak metniyle uyuşmuyor.');
 return true;
}
function dateOnly(value){return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;}
function instant(value){
 if(dateOnly(value))return value+'T00:00:00.000Z';
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)||!dateOnly(value.slice(0,10))||!Number.isFinite(Date.parse(value)))throw Error('Tarih YYYY-MM-DD veya saat dilimi içeren ISO tarih/saat olmalı.');
 return new Date(value).toISOString();
}
function safeURL(value){
 if(!value)return '';
 if(typeof value!=='string'||value.length>2000||hasPrivateLink(value))throw Error('Kaynak bağlantısı gerçek Drive teslim bağlantısı içeremez.');
 let url;try{url=new URL(value);}catch{throw Error('Kaynak bağlantısı geçerli HTTPS adresi olmalı.');}
 const host=url.hostname.toLowerCase(),ip=/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(host);
 const local=host==='localhost'||/\.(?:localhost|local|internal)$/.test(host)||!host.includes('.')||host.includes(':')||(ip&&(Number(ip[1])===0||Number(ip[1])===10||Number(ip[1])===127||Number(ip[1])>=224||(Number(ip[1])===100&&Number(ip[2])>=64&&Number(ip[2])<=127)||(Number(ip[1])===169&&Number(ip[2])===254)||(Number(ip[1])===172&&Number(ip[2])>=16&&Number(ip[2])<=31)||(Number(ip[1])===192&&[0,168].includes(Number(ip[2])))||(Number(ip[1])===198&&[18,19].includes(Number(ip[2])))));
 if(url.protocol!=='https:'||url.username||url.password||url.port||local||['drive.google.com','docs.google.com','drive.usercontent.google.com'].includes(host))throw Error('Kaynak bağlantısı özel/yerel ağ veya teslim adresi olamaz; güvenli HTTPS kaynak bağlantısı kullan.');
 return url.href;
}
function normalizeLabel(text){return String(text).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ı/g,'i').replace(/[\s_().-]+/g,'');}
const ALIASES={
 phrase:['keyword','keywords','searchterm','query','phrase','anahtarkelime','kelime','aramaifadesi','aramakelimesi','sorgu'],
 searches:['searches','searchcount','numberofsearches','aramalar','aramasayisi','searchvolume'],
 listings:['listings','listingcount','numberoflistings','ilanlar','ilansayisi','ilan'],
 period:['period','timeperiod','dateperiod','donem','veridonemi'],
 periodStart:['periodstart','startdate','periodstartdate','donembaslangici','baslangic','baslangictarihi'],
 periodEnd:['periodend','enddate','periodenddate','donembitisi','bitis','bitistarihi'],
 date:['date','acquisitiondate','observeddate','tarih','eldeedilmetarihi'],
 acquiredAt:['acquiredat'],region:['region','country','bolge','ulke'],language:['language','dil'],
 sourceUrl:['sourceurl','sourcelink','kaynakbaglantisi','kaynakurl'],sourceDescription:['sourcedescription','sourcenote','kaynakaciklamasi','kaynaknotu']
};
const LABELS=new Map(Object.entries(ALIASES).flatMap(([key,values])=>values.map(v=>[v,key])));
const field=text=>LABELS.get(normalizeLabel(text));
function canonical(value){if(Array.isArray(value))return value.map(canonical);if(plain(value))return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])]));return value;}
function identifier(value){const text=JSON.stringify(canonical(value));let a=2166136261,b=2654435769;for(const c of text){a=Math.imul(a^c.charCodeAt(0),16777619);b=Math.imul(b^c.charCodeAt(0),2246822519);}return 'mi-'+(a>>>0).toString(16).padStart(8,'0')+(b>>>0).toString(16).padStart(8,'0');}
function nullable(value,key){if(value===undefined||value===null||value==='')return null;if(typeof value!=='string'||value.length>100||/[\u0000-\u001f]/.test(value))throw Error(key+' kısa bir metin olmalı.');return value.trim()||null;}
function literalPeriod(label){
 const range=/^(\d{4}-\d{2}-\d{2})\s*(?:to|through|–|—|\.\.|\s-\s)\s*(\d{4}-\d{2}-\d{2})$/i.exec(label.trim());
 if(!range)return null;
 if(!dateOnly(range[1])||!dateOnly(range[2])||range[1]>range[2])throw Error('Kaynak dönem aralığında geçersiz tarih var.');
 return {start:range[1],end:range[2]};
}
function periodFor(row,options,warnings,index){
 if(row.period!==undefined&&row.period!==null&&typeof row.period!=='string'&&!plain(row.period))throw Error('Dönem etiketi veya dönem nesnesi gerekiyor.');
 const original=plain(row.period)?row.period:{label:typeof row.period==='string'?row.period:''};
 if(Object.keys(original).some(k=>!['label','start','end'].includes(k)))throw Error('Desteklenmeyen dönem alanı.');
 const localLabel=original.label||row.periodLabel||'',differentScope=localLabel&&options.periodLabel&&localLabel!==options.periodLabel;
 const p={label:localLabel||options.periodLabel||'',start:original.start||row.periodStart||null,end:original.end||row.periodEnd||null};
 if(typeof p.label!=='string'||p.label.length>300||/[\u0000-\u001f]/.test(p.label))throw Error('Dönem etiketi en fazla 300 karakter olmalı.');p.label=p.label.trim();
 // A literal ISO range is explicit source evidence, not a relative-date guess.
 const range=literalPeriod(p.label);
 if(range){
  for(const [key,field] of [['start','periodStart'],['end','periodEnd']])for(const supplied of [original[key],row[field]])if(supplied!==undefined&&supplied!==null&&supplied!==''&&supplied!==range[key])throw Error('Kaynak dönem etiketi ile satırın açık tarihleri çelişiyor; dönemi düzeltip yeniden önizle.');
  if(['start','end'].some(key=>options[key==='start'?'periodStart':'periodEnd']&&options[key==='start'?'periodStart':'periodEnd']!==range[key]))warnings.push('Satır '+index+': genel dönem tarihleri kaynakta yazan açık aralıkla farklı; kaynak aralığı korundu.');
  p.start=range.start;p.end=range.end;
 }else if(!differentScope){p.start=p.start||options.periodStart||null;p.end=p.end||options.periodEnd||null;}
 for(const key of ['start','end'])if(p[key]!==null&&!dateOnly(p[key]))throw Error('Dönem tarihleri YYYY-MM-DD biçiminde gerçek günler olmalı.');
 if(p.start&&p.end&&p.start>p.end)throw Error('Dönem başlangıcı bitişten sonra olamaz.');return p;
}
function missingFor(row){const list=[];for(const key of ['searches','listings'])if(row[key].state!=='exact')list.push(key);if(!row.period.label&&!row.period.start&&!row.period.end)list.push('period');if(!row.period.start)list.push('periodStart');if(!row.period.end)list.push('periodEnd');if(!row.region)list.push('region');if(!row.language)list.push('language');return list;}
function validateObservation(row){
 const keys=['id','phrase','source','sourceUrl','sourceDescription','acquiredAt','period','searches','listings','region','language','method','raw','missing'];
 if(!plain(row)||Object.keys(row).some(k=>!keys.includes(k))||typeof row.id!=='string'||!/^mi-[a-f0-9]{16}$/.test(row.id)||typeof row.phrase!=='string'||!row.phrase.trim()||row.phrase.length>200||/[\u0000-\u001f]/.test(row.phrase)||row.source!==SOURCE||typeof row.sourceDescription!=='string'||!row.sourceDescription.startsWith(SOURCE_DESCRIPTION)||row.sourceDescription.length>2000||!['pasted','table'].includes(row.method)||typeof row.raw!=='string'||bytes(row.raw)>MAX_BYTES||hasPrivateLink(JSON.stringify(row)))throw Error('Geçersiz Marketplace Insights kullanıcı aktarımı.');
 safeURL(row.sourceUrl);instant(row.acquiredAt);validateMetric(row.searches);validateMetric(row.listings);
 if(!plain(row.period)||Object.keys(row.period).some(k=>!['label','start','end'].includes(k))||typeof row.period.label!=='string'||row.period.label.length>300||!['start','end'].every(k=>row.period[k]===null||dateOnly(row.period[k]))||row.period.start&&row.period.end&&row.period.start>row.period.end)throw Error('Geçersiz gözlem dönemi.');
 for(const key of ['region','language'])if(row[key]!==null&&(typeof row[key]!=='string'||!row[key].trim()||row[key].length>100))throw Error('Geçersiz kaynak bölge/dil kapsamı.');
 if(!Array.isArray(row.missing)||row.missing.some(k=>!['searches','listings','period','periodStart','periodEnd','region','language'].includes(k))||new Set(row.missing).size!==row.missing.length||JSON.stringify([...row.missing].sort())!==JSON.stringify(missingFor(row).sort()))throw Error('Eksik bilgi kaydı kaynak alanlarıyla uyuşmuyor.');
 return true;
}
function normalizeRow(row,options,warnings,index){
 if(!plain(row))throw Error('Satır nesne olmalı.');
 if(row.source!==undefined&&row.source!==SOURCE)throw Error('Bu aktarım yalnızca kullanıcının aktardığı Marketplace Insights verisi olarak kaydedilir.');
 const phrase=row.phrase??row.keyword??options.defaultPhrase;
 if(typeof phrase!=='string'||!phrase.trim()||phrase.trim().length>200||/[\u0000-\u001f]/.test(phrase))throw Error('Araştırma kelimesi 1–200 karakter metin olmalı.');
 const period=periodFor(row,options,warnings,index),region=nullable(row.region??options.region,'Bölge'),language=nullable(row.language??options.language,'Dil');
 let sourceDescription=SOURCE_DESCRIPTION;const note=row.sourceDescription||options.sourceDescription;
 if(note){if(typeof note!=='string'||note.length>(note.startsWith(SOURCE_DESCRIPTION)?2000:1500))throw Error('Kaynak notu en fazla 1500 karakter olmalı.');sourceDescription=note.startsWith(SOURCE_DESCRIPTION)?note:SOURCE_DESCRIPTION+' Kullanıcı kaynak notu: '+note;}
 const acquired=row.acquiredAt||row.date||options.acquiredAt||new Date().toISOString(),acquiredAt=instant(acquired);
 if(dateOnly(acquired))warnings.push('Satır '+index+': kaynak yalnızca gün bildirdi; 00:00 UTC kayıt biçimidir, gerçek saat veya kaynak saat dilimi değildir.');
 const searches=parseMetric(row.searches),listings=parseMetric(row.listings),sourceUrl=safeURL(row.sourceUrl||options.sourceUrl||'');
 const method=row.method||options.method||'table';if(!['pasted','table'].includes(method))throw Error('Desteklenmeyen aktarım yöntemi.');
 const sourceRaw=own(row,'raw')?row.raw:JSON.stringify(canonical({phrase:phrase.trim(),searches:searches.raw,listings:listings.raw,period,region,language,sourceUrl,sourceDescription,...(row.date?{date:row.date}:{})}));
 if(typeof sourceRaw!=='string'||bytes(sourceRaw)>MAX_BYTES)throw Error('Kaynak metni boyutu veya türü geçersiz.');
 const observation={id:'',phrase:phrase.trim(),source:SOURCE,sourceUrl,sourceDescription,acquiredAt,period,searches,listings,region,language,method,raw:sourceRaw,missing:[]};
 observation.missing=missingFor(observation);
 observation.id=identifier({phrase:observation.phrase,source:SOURCE,sourceUrl,sourceDescription,period,searches,listings,region,language,method,raw:sourceRaw});
 validateObservation(observation);
 for(const key of ['searches','listings'])if(observation[key].state==='ambiguous')warnings.push('Satır '+index+': '+key+' sayısı “'+observation[key].raw+'” kesin tam sayı olarak yorumlanmadı.');
 if(observation.missing.length)warnings.push('Satır '+index+': eksik veya kesin olmayan bilgi: '+observation.missing.join(', ')+'. Sıfır veya varsayılan bölge/dönem atanmadı.');
 if(options.periodLabel&&row.period&&(plain(row.period)?row.period.label:row.period)&&options.periodLabel!==(plain(row.period)?row.period.label:row.period))warnings.push('Satır '+index+': kaynak dönem etiketi ile genel dönem farklı; satırdaki açık kaynak dönemi korundu.');
 return observation;
}
function fromRows(input,options={}){
 const warnings=[],errors=[],rows=[];
 if(!plain(options))return {rows,warnings,errors:['Aktarım seçenekleri bir nesne olmalı.'],needsReview:true};
 if(!Array.isArray(input)||input.length>MAX_ROWS)return {rows,warnings,errors:['En fazla '+MAX_ROWS+' satırlık giriş tablosu kullan.'],needsReview:true};
 let encoded;try{encoded=JSON.stringify(input);}catch{return {rows,warnings,errors:['Giriş tablosu JSON verisine dönüştürülemedi.'],needsReview:true};}
 if(bytes(encoded)>MAX_BYTES)return {rows,warnings,errors:['Aktarım en fazla 128 KiB olabilir.'],needsReview:true};
 let config;try{config=JSON.stringify(options);}catch{return {rows,warnings,errors:['Aktarım seçenekleri JSON verisine dönüştürülemedi.'],needsReview:true};}
 if(bytes(config)>MAX_BYTES)return {rows,warnings,errors:['Aktarım seçenekleri en fazla 128 KiB olabilir.'],needsReview:true};
 if(hasPrivateLink(encoded)||hasPrivateLink(config))return {rows,warnings,errors:['Gerçek Drive teslim bağlantısını araştırma verisine ekleme.'],needsReview:true};
 for(let i=0;i<input.length;i++)try{rows.push(normalizeRow(input[i],options,warnings,i+1));}catch(error){errors.push('Satır '+(i+1)+': '+error.message);}
 if(rows.length)warnings.push('Kaydetmeden önce kelime, ölçüler, kaynak ve dönem satırlarını doğrula.');
 return {rows,warnings:[...new Set(warnings)],errors,needsReview:true};
}
function delimited(text,separator){
 const rows=[];let row=[],cell='',quoted=false,closed=false,rowStart=0;
 const append=end=>{if(row.some(v=>v.trim())){Object.defineProperty(row,'rawText',{value:text.slice(rowStart,end)});rows.push(row);}};
 for(let i=0;i<text.length;i++){
  const char=text[i];
  if(quoted){if(char==='"'){if(text[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else cell+=char;continue;}
  if(char==='"'){if(cell||closed)throw Error('CSV tırnakları belirsiz; tablo biçimini kontrol et.');quoted=true;continue;}
  if(closed&&char!==separator&&char!=='\n'&&char!=='\r'&&!/[ \t]/.test(char))throw Error('CSV kapanış tırnağından sonra beklenmeyen metin var.');
  if(char===separator){row.push(cell);cell='';closed=false;}
  else if(char==='\n'||char==='\r'){row.push(cell);append(i);if(char==='\r'&&text[i+1]==='\n')i++;rowStart=i+1;row=[];cell='';closed=false;}
  else if(!closed)cell+=char;
 }
 if(quoted)throw Error('CSV içinde kapanmamış tırnak var.');row.push(cell);append(text.length);return rows;
}
function parseTable(text){
 const top=text.split(/\r?\n/).find(line=>line.trim())||'';
 for(const delimiter of ['\t',';',',']){
  if(!top.includes(delimiter))continue;
  let cells;try{cells=delimited(text,delimiter);}catch(error){return {rows:[],warnings:[],errors:[error.message],recognized:true};}
  const names=cells[0].map(field);if(!names.includes('phrase')||!names.some(k=>['searches','listings'].includes(k)))continue;
  if(names.filter(Boolean).length!==new Set(names.filter(Boolean)).size)return {rows:[],warnings:[],errors:['Aynı anlama gelen yinelenen sütun başlıkları var; ölçüyü keyfî seçmedim.'],recognized:true};
  const rows=[],warnings=[],errors=[];
  if(names.some(n=>!n))warnings.push('Tanınmayan sütunlar yorumlanmadı; kaynak satırında korunuyor.');
  if(cells.length-1>MAX_ROWS)return {rows:[],warnings,errors:['En fazla '+MAX_ROWS+' araştırma satırı aktarılabilir.'],recognized:true};
  for(let i=1;i<cells.length;i++){
   if(cells[i].length!==names.length){errors.push('Satır '+(i+1)+': sütun sayısı başlıklarla uyuşmuyor. Binlik virgüllerini CSV’de tırnak içine al veya TSV kullan.');continue;}
   const row={};for(let j=0;j<names.length;j++)if(names[j])row[names[j]]=cells[i][j].trim();
   row.raw=cells[0].rawText+'\n'+cells[i].rawText;rows.push(row);
  }
  return {rows,warnings,errors,recognized:true};
 }
 return {recognized:false};
}
function parseLabels(text,options){
 const lines=text.replace(/\r\n?/g,'\n').split('\n'),rows=[],errors=[],warnings=[];let current={},pieces=[],unrecognized=0;
 const finish=()=>{if(Object.keys(current).length){current.raw=pieces.join('\n');rows.push(current);}current={};pieces=[];};
 for(let i=0;i<lines.length;i++){
  const originalIndex=i,line=lines[i].trim();if(!line){pieces.push(lines[i]);continue;}
  const labelled=/^(.{1,80}?)\s*[:=]\s*(.*)$/.exec(line);let key=labelled?field(labelled[1]):field(line),value=labelled?.[2];
  if(key&&value===undefined){let j=i+1;while(j<lines.length&&!lines[j].trim())j++;const next=j<lines.length?/^(.{1,80}?)\s*[:=]/.exec(lines[j]):null;if(j===lines.length||field(lines[j])||next&&field(next[1])){errors.push('Etiketin değeri bulunamadı: '+line);continue;}value=lines[j].trim();i=j;}
  if(!key){unrecognized++;pieces.push(lines[i]);continue;}
  if(key==='phrase'&&current.phrase!==undefined)finish();
  if(own(current,key)&&current[key]!==value){errors.push('Aynı kelime bloğunda farklı '+key+' değerleri var; keyfî seçim yapılmadı.');continue;}
  current[key]=value;pieces.push(lines.slice(originalIndex,i+1).join('\n'));
 }
 finish();
 const recognized=rows.some(r=>own(r,'searches')||own(r,'listings'));
 if(!recognized)return {recognized:false};
 if(errors.length)return {recognized:true,rows:[],warnings,errors};
 if(rows.some(r=>!r.phrase&&!options.defaultPhrase))return {recognized:true,rows:[],warnings,errors:['Etiketli ölçünün kelimesi açık değil; kelimeyi giriş tablosunda seç.']};
 if(rows.length>MAX_ROWS)return {recognized:true,rows:[],warnings,errors:['En fazla '+MAX_ROWS+' kelime bloğu aktarılabilir.']};
 if(unrecognized)warnings.push('Etiketlenmemiş '+unrecognized+' satırdan kelime veya ölçü çıkarılmadı.');
 return {recognized:true,rows,warnings,errors};
}
function preview(text,options={}){
 const empty={rows:[],warnings:[],errors:[],needsReview:true};
 if(!plain(options))return {...empty,errors:['Aktarım seçenekleri bir nesne olmalı.']};
 if(typeof text!=='string')return {...empty,errors:['Marketplace Insights sonucunu metin olarak yapıştır.']};
 if(bytes(text)>MAX_BYTES)return {...empty,errors:['Yapıştırılan metin en fazla 128 KiB olabilir.']};
 let config;try{config=JSON.stringify(options);}catch{return {...empty,errors:['Aktarım seçenekleri JSON verisine dönüştürülemedi.']};}
 if(bytes(config)>MAX_BYTES)return {...empty,errors:['Aktarım seçenekleri en fazla 128 KiB olabilir.']};
 if(hasPrivateLink(text)||hasPrivateLink(config))return {...empty,errors:['Gerçek Drive teslim bağlantısını araştırma verisine ekleme.']};
 const source=text.replace(/^\uFEFF/,'').replace(/^[\r\n]+|[\r\n]+$/g,'');if(!source.trim())return {...empty,warnings:['Henüz aktarılacak metin yok. Sade giriş tablosunu da kullanabilirsin.']};
 const parsedTable=parseTable(source),parsed=parsedTable.recognized?parsedTable:parseLabels(source,options);
 if(!parsed.recognized)return {...empty,warnings:['Düzen güvenilir biçimde tanınmadı. Etiketlenmemiş sayılar tahmin edilmedi; kelime/arama/ilan alanlarını sade giriş tablosuna aktar.']};
 const result=fromRows(parsed.rows,{...options,method:'pasted'});
 return {rows:result.rows,warnings:[...new Set([...parsed.warnings,...result.warnings])],errors:[...parsed.errors,...result.errors],needsReview:true};
}
const api={parseMetric,preview,fromRows,validateObservation,MAX_BYTES,MAX_ROWS,SOURCE_DESCRIPTION};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.STLInsightsImport=api;
})(globalThis);
