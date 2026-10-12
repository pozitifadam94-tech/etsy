(function(root){
const DAY=86400000;
const preparation=typeof module!=='undefined'&&module.exports?require('./preparation'):root.STLPreparation;
const EXPLICIT_ISSUES=new Set(['direct-stl-contradiction','contents-count','placeholder','unverified-claims','description-folder-mismatch','other-product-reference']);
function signature(value){let h=2166136261;for(const c of JSON.stringify(value)){h=Math.imul(h^c.charCodeAt(0),16777619);}return (h>>>0).toString(16);}
function jobs(products,delivery,preparations={},cases=[],review={},now=Date.now()){
 const result=[];
 const add=(p,kind,priority,title,reason,evidence,missing='',details={})=>{const id=String(p.id)+':'+kind,fingerprint=signature(evidence),action=review.actions?.[id];if(action?.fingerprint===fingerprint&&(action.kind==='completed'||action.until>now))return;result.push({id,product:String(p.id),kind,priority,title,reason,evidence:typeof evidence==='string'?evidence:JSON.stringify(evidence),missing,fingerprint,...details});};
 for(const p of products){
  const r=delivery?.products?.[String(p.id)];
  const local=preparations[String(p.id)],source={...p,title:local?.title??p.title,description:local?.description??p.description,tags:local?.tags??p.tags};
  const findings=typeof preparation?.auditListing==='function'?preparation.auditListing(source,r||{}).filter(f=>EXPLICIT_ISSUES.has(f.code)&&['error','warning'].includes(f.severity)):[];
  if(findings.length){
   const date=local?.updatedAt||r?.updatedAt||p.updatedAt||p.observedAt,sourceAt=typeof date==='string'&&Number.isFinite(Date.parse(date))?date:null;
   const evidence={title:source.title,description:source.description,tags:source.tags,deliveryFolderUrl:r?.deliveryFolderUrl||null,productName:r?.productName||null,contents:r?.contentConfirmedAt?(r.contents||[]).map(c=>({name:c.name,note:c.note||''})):null,findings:findings.map(f=>({code:f.code,kind:f.kind,issue:f.issue,evidence:f.evidence,suggestion:f.suggestion}))};
   add(p,'listing-review',4,p.title+' · ilan tutarlılığını kontrol et',findings.map(f=>f.issue+' '+f.suggestion).join(' '),evidence,'Yalnızca ilan metni ve kayıtlı teslim bilgileri karşılaştırıldı. Görsel yazıları, baskı testi, müşteri erişimi ve dosya geometrisi bu kontrolle doğrulanmadı.',{codes:findings.map(f=>f.code),sourceAt,findings:findings.map(f=>({code:f.code,kind:f.kind,severity:f.severity,issue:f.issue,evidence:f.evidence,suggestion:f.suggestion}))});
  }
  if(!r?.deliveryFolderUrl){add(p,'folder',3,p.title+' · teslim bağlantısı','Drive klasörünü bir kez bağla. Etsy ilan adresi teslim bağlantısı değildir.','folder:missing','Klasör bağlantısı bilinmiyor.');continue;}
  const access=r.checks?.access;
  if(['permission','unreachable'].includes(access?.status))add(p,'access',5,p.title+' · müşteri erişimini incele',access.detail||'Son oturumsuz kontrol erişim sorunu bildirdi.',{url:r.deliveryFolderUrl,status:access.status,detail:access.detail||''},'Klasör içeriği ve STL geometrisi bu testte incelenmez.',{sourceAt:access.checkedAt||null});
  const v=r.versions?.find(v=>v.id===r.currentVersionId);
  if(v&&v.deliveryFolderUrl!==r.deliveryFolderUrl)add(p,'old-txt',5,p.title+' · TXT bağlantısı eski','Kayıtlı güncel TXT başka klasör bağlantısını kullanıyor. Yeni TXT oluştur ve Etsy yüklemesini kendin yap.',{version:v.id,url:r.deliveryFolderUrl},'Etsy’ye yüklenmiş TXT ayrıca doğrulanmadı.');
  if(!v)add(p,'txt',3,p.title+' · teslim TXT’sini hazırla','Klasör bağlantısı kayıtlı; ürüne özel TXT hazırlanabilir.',{url:r.deliveryFolderUrl,title:r.productName},'Etsy yükleme işlemi manuel.');
  const desc=source.description;
  if(!findings.some(f=>f.code==='direct-stl-contradiction')&&typeof desc==='string'&&desc&&(!/\btxt\b|text file/i.test(desc)||!/google drive|drive folder/i.test(desc)))add(p,'explanation',4,p.title+' · teslim açıklamasını netleştir','Açıklama, TXT üzerinden Drive klasörüne erişimi açıkça anlatmıyor.',{description:desc},'Görsellerin içindeki yazılar okunmadı.');
  const repeated=cases.filter(c=>String(c.product)===String(p.id)&&['txt','link','permission','missing'].includes(c.kind)&&Date.parse(c.date)>=now-30*DAY);
  if(repeated.length>=2)add(p,'support',4,p.title+' · tekrarlanan teslim sorunu',repeated.length+' kayıtlı teslim sorunu var. TXT/açıklamayı birlikte gözden geçir.',repeated.map(c=>({id:c.id,kind:c.kind})), 'Yalnızca kaydedilen sorunlar; bütün müşterileri temsil etmez.');
 }
 return result.sort((a,b)=>b.priority-a.priority||a.id.localeCompare(b.id));
}
function recordAction(review,job,kind,now=Date.now()){if(!['completed','snoozed'].includes(kind))throw Error('Geçersiz görev işlemi.');return {...review,actions:{...review.actions,[job.id]:{fingerprint:job.fingerprint,kind,at:new Date(now).toISOString(),until:kind==='snoozed'?now+3*DAY:0}}};}
function validate(value){if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Geçersiz günlük kontrol.');if(value.actions&&Object.values(value.actions).some(a=>!a||typeof a.fingerprint!=='string'||!['completed','snoozed'].includes(a.kind)||!Number.isFinite(a.until)))throw Error('Geçersiz günlük görev kaydı.');if(value.lastRun&&(!Array.isArray(value.lastRun.stages)||typeof value.lastRun.at!=='string'||value.lastRun.stages.some(s=>!['ok','error','skipped','cancelled'].includes(s.status)||typeof s.name!=='string'||typeof s.detail!=='string')))throw Error('Geçersiz günlük kontrol sonucu.');return true;}
const api={jobs,recordAction,validate};if(typeof module!=='undefined')module.exports=api;else root.STLDailyReview=api;
})(globalThis);
