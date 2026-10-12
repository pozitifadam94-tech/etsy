(function(root){
'use strict';
let ctx=null,mainProduct='',mainEditor=null,batchPreview=null,activeScope=null;
const recoveredDrafts=[];
const mounted=new Set();
const fields={title:'Başlık',description:'Açıklama',tags:'Etiketler'};
const replyKinds={txt:'TXT dosyasını bulma',link:'Drive bağlantısını açma',permission:'Erişim izni sorunu',missing:'Eksik / yanlış dosya',zip:'ZIP dosyasını açma',scale:'Model ölçüsü / ölçek'};
const tasks={title:'Başlık ve etiket incelemesi',description:'Açıklama ve teslim talimatı',customer:'Müşteriye uygun yanıt',performance:'Ürünün gidişatını değerlendirme',package:'Birlikte sunulabilecek ürünler'};
const $=(s,el=document)=>el.querySelector(s);
const E=v=>ctx.esc(v);
const core=()=>root.STLPreparation;
const products=()=>ctx.getProducts?.()||ctx.getLive?.()?.snapshot?.products||[];
const idOf=p=>String(p.id);
const delivery=p=>ctx.getState().delivery?.products?.[idOf(p)]||{};
const record=p=>ctx.getState().preparations?.[idOf(p)]||null;
const dateLabel=s=>s?new Date(s).toLocaleString('tr-TR',{timeZone:'Europe/Istanbul'}):'—';
const scopeId=()=>{const id=ctx.getWorkspace?.()?.activeShopId;return id===undefined||id===null?null:String(id);};
function assertScope(expected){if(scopeId()!==expected)throw Error('Mağaza değişti. Eski mağazanın hazırlığı bu mağazaya kaydedilmedi. Hazırlık alanını yeniden aç.');}
const base=p=>core().listingDraft(p);
function selectedProduct(){return products().find(p=>idOf(p)===mainProduct);}
function buttonAction(button,fn){
 const expectedScope=scopeId();
 button.addEventListener('click',async event=>{event.preventDefault();if(button.disabled)return;button.disabled=true;try{assertScope(expectedScope);await fn();}catch(e){ctx.message(e.message||'İşlem tamamlanamadı.',true);}finally{if(button.isConnected)button.disabled=button.dataset.disabledAfter==='true';}});
}
async function persist(expectedScope=activeScope){assertScope(expectedScope);if(ctx.save()===false)throw Error('Kayıt saklanamadı. Sekmedeki kopyanı yedekle.');await ctx.flush();assertScope(expectedScope);}
async function copy(text){if(!text)throw Error('Önce metni hazırla.');if(!navigator.clipboard?.writeText)throw Error('Panoya erişilemiyor. Metni seçerek kopyalayabilirsin.');await navigator.clipboard.writeText(text);ctx.message('Metin kopyalandı. Dışarı gönderilmedi.');}
function textExport(name,text){ctx.downloadText(name,text);}
function draftExport(p,r){return JSON.stringify({schema:1,kind:'listing-preparation',exportedAt:new Date().toISOString(),product:idOf(p),title:r.title,description:r.description,tags:r.tags,updatedAt:r.updatedAt||null,purpose:r.purpose||'',versions:r.versions||[]},null,2);}
function diffHTML(p,r){
 const rows=core().draftDiff(p,r);
 return '<p class="small">Sol: son Etsy kaydı. Sağ: yerel hazırlık. Kaydetmek Etsy ilanını değiştirmez.</p><div class="prep-diff">'+rows.map(row=>`<details ${row.changed?'open':''}><summary>${E(fields[row.field]||row.field)} · ${row.changed?'Değişiklik var':'Aynı'}</summary><div class="form"><label>Önce<textarea readonly rows="${row.field==='description'?6:3}">${E(Array.isArray(row.before)?row.before.join(', '):row.before)}</textarea></label><label>Sonra<textarea readonly rows="${row.field==='description'?6:3}">${E(Array.isArray(row.after)?row.after.join(', '):row.after)}</textarea></label></div></details>`).join('')+'</div>';
}
function auditHTML(p){
 const findings=core().auditListing(p,delivery(p));
 return '<p class="small">Son Etsy kaydı üzerinden kontrol edilir. Teknik eksikler ile editoryal öneriler ayrıdır. Bir SEO veya satış puanı üretilmez.</p><ul class="audit-list">'+(findings.length?findings.map(f=>`<li><span class="badge ${f.severity==='error'?'audit-missing':f.severity==='warning'?'audit-review':'audit-unknown'}">${f.kind==='technical'?'Teknik kontrol':'Editoryal inceleme'}</span><strong> ${E(f.issue)}</strong><p>Dayanak: ${E(f.evidence)}</p><p>Öneri: ${E(f.suggestion)}</p></li>`).join(''):'<li>Bu temel kontrolde yeni bulgu işaretlenmedi. Müşteri erişimi, klasör içeriği ve STL geometrisi kendi teslim kontrollerinde ayrı değerlendirilir.</li>')+'</ul>';
}
function mountProduct(p,container){
 if(!ctx||!core()||!p||!container)return null;
 if(scopeId()!==activeScope)resetScope();
 const mountedScope=scopeId();
 const panel=document.createElement('div');panel.className='preparation-product';panel.dataset.preparationProduct=idOf(p);panel.dataset.preparationShop=mountedScope??'';
 const saved=record(p),value=saved||base(p);
 panel.innerHTML=`<details class="optional-tools prep-audit"><summary>İlanı iyileştir · Somut kontroller</summary><div data-prep-audit>${auditHTML(p)}</div></details>
 <details class="optional-tools prep-draft"><summary>Başlık, açıklama ve etiket hazırlığı${saved?' · Kayıtlı taslak var':''}</summary><p>İçeriği burada hazırla, önce/sonra farkını incele ve Etsy’ye kendin uygula. Drive bağlantısını veya dosya paylaşımını değiştirmeyiz.</p><form class="form" data-prep-form><label style="flex-basis:100%">Başlık<input name="title" value="${E(value.title)}" maxlength="500" required></label><label style="flex-basis:100%">Açıklama<textarea name="description" rows="9" maxlength="50000">${E(value.description)}</textarea></label><label style="flex-basis:100%">Etiketler · virgülle ayır<input name="tags" value="${E((value.tags||[]).join(', '))}" maxlength="1200"></label><p data-prep-validation class="small" role="status" style="flex-basis:100%"></p><button type="submit" class="primary">Yerel taslağı kaydet</button><button type="button" data-prep-paragraph>Teslim paragrafını hazırla</button><button type="button" data-prep-preview>Farkı göster</button></form><p data-prep-saved class="small" role="status"></p><div data-prep-diff></div><div class="tools"><button type="button" data-prep-copy-title>Başlığı kopyala</button><button type="button" data-prep-copy-description>Açıklamayı kopyala</button><button type="button" data-prep-copy-tags>Etiketleri kopyala</button><button type="button" data-prep-export>Taslak JSON indir</button></div><details class="optional-tools"><summary>Taslak sürümleri ve geri dönüş</summary><label>Kaydedilmiş sürüm<select data-prep-versions></select></label><button type="button" data-prep-undo>Seçili sürüme dön</button><p class="small">Geri dönüş de yeni yerel sürüm olarak saklanır. Etsy’deki içerik değişmez.</p></details></details>
 <details class="optional-tools prep-ai"><summary>ChatGPT / başka yapay zekâ için bağlam hazırla</summary><p>Ürün bilgisi ve bilinen verilerden kopyalanabilir metin hazırlarız. Uygulama bir yapay zekâ servisine bağlanmaz; yanıtı otomatik üretmez.</p><div class="form"><label>Görev<select data-prep-task>${Object.entries(tasks).map(([k,v])=>`<option value="${k}">${E(v)}</option>`).join('')}</select></label><label style="flex-basis:100%">Müşteri mesajı · gerekirse<textarea data-prep-message rows="4" maxlength="12000" placeholder="Yalnızca bu oturumda kalır. Kişisel bilgileri çıkar."></textarea></label><label style="display:flex;align-items:center;flex-basis:100%"><input data-prep-sensitive type="checkbox" style="width:auto">Drive bağlantıları ve ham müşteri mesajını bağlama dahil et</label><p class="small" style="flex-basis:100%">Varsayılan metin gerçek Drive bağlantılarını içermez; müşteri mesajından yalnızca konu çıkarılır. Bu seçeneği açarsan metni kopyalamadan önce özel bilgileri kontrol et.</p><button type="button" data-prep-context class="primary">Bağlam metnini hazırla</button></div><label>Hazırlanan metin<textarea data-prep-context-text readonly rows="8" placeholder="Görev seçip metni hazırla."></textarea></label><div class="tools"><button type="button" data-prep-context-copy>Metni kopyala</button><button type="button" data-prep-context-export>Metni indir</button></div><details class="optional-tools"><summary>Yapay zekâdan gelen JSON’u yerel taslağa al</summary><p class="small">Yalnızca başlık, açıklama ve etiketler kabul edilir. Bilinmeyen alan veya geçersiz değer kaydedilmez. Sonuç mağazaya gönderilmez.</p><label>Yanıt JSON<textarea data-prep-ai-output rows="6" maxlength="60000" placeholder='{"title":"…","description":"…","tags":["…"]}'></textarea></label><button type="button" data-prep-ai-apply>Kontrol et ve taslak kaydet</button><p data-prep-ai-result class="small" role="status"></p></details></details>
 <details class="optional-tools prep-customer"><summary>Teslim sorununa İngilizce yanıt hazırla</summary><p>Müşterinin sorununa uygun şablonu seç, metni düzenle ve Etsy’de kendin gönder. Bağlantı erişimi kontrol edilmemişse başarılıymış gibi söz verilmez.</p><div class="form"><label>Sorun<select data-prep-reply-kind>${Object.entries(replyKinds).map(([k,v])=>`<option value="${k}">${E(v)}</option>`).join('')}</select></label><label style="display:flex;align-items:center;flex-basis:100%"><input type="checkbox" data-prep-reply-link style="width:auto">Yanıta kayıtlı teslim bağlantısını ekle</label><button type="button" data-prep-reply-generate class="primary">Yanıt şablonunu hazırla</button></div><label>İngilizce yanıt · düzenleyebilirsin<textarea data-prep-reply-text rows="7" maxlength="12000"></textarea></label><p data-prep-reply-tr class="small"></p><p data-prep-reply-missing class="small" role="status"></p><div class="tools"><button type="button" data-prep-reply-copy>Yanıtı kopyala</button><button type="button" data-prep-case-save>Yalnızca sorun kaydını sakla</button></div><p class="small">Mesaj ve yanıt kaydedilmez. Sorun kaydı yalnızca ürün, konu, tarih ve çözülme bilgisidir. Kayıt oluşturmak müşteriye yanıt göndermek değildir.</p><div data-prep-cases></div></details>`;
 const researchButton=document.createElement('button');researchButton.type='button';researchButton.textContent='Araştırmadan İlan Hazırla';researchButton.dataset.researchProduct=idOf(p);panel.prepend(researchButton);
 container.appendChild(panel);mounted.add(panel);
 const form=$('[data-prep-form]',panel),validation=$('[data-prep-validation]',panel),diff=$('[data-prep-diff]',panel);
 const currentProduct=()=>{assertScope(mountedScope);const current=products().find(item=>idOf(item)===idOf(p));if(!current)throw Error('Ürün mevcut mağaza kaydında bulunmuyor. Ürünleri yenile ve hazırlığı yeniden aç.');return current;};
 let generatedReply=false;
 const read=()=>({title:form.elements.title.value,description:form.elements.description.value,tags:form.elements.tags.value.split(',').map(v=>v.trim()).filter(Boolean)});
 const dirty=()=>{panel.dataset.dirty='true';};
 form.addEventListener('input',()=>{dirty();const result=core().validateDraft(read());validation.textContent=[...result.errors,...result.warnings].join(' ');});
 function versions(){
  const r=record(p),v=$('[data-prep-versions]',panel);v.innerHTML=(r?.versions||[]).slice().reverse().map(x=>`<option value="${E(x.id)}">${E(dateLabel(x.at))} · ${E(({etsy:'İlk Etsy kaydı',ai:'AI yanıtı',batch:'Toplu hazırlık',undo:'Geri dönüş',manual:'Elle hazırlık'})[x.source]||x.source)}</option>`).join('')||'<option value="">Kaydedilmiş sürüm yok</option>';
  $('[data-prep-undo]',panel).disabled=!r?.versions?.length;
  $('[data-prep-saved]',panel).textContent=r?'Yerel taslak kaydı: '+dateLabel(r.updatedAt)+' · '+r.versions.length+' sürüm':'Henüz yerel taslak kaydedilmedi.';
 }
 function populate(r){for(const name of ['title','description'])form.elements[name].value=r[name];form.elements.tags.value=(r.tags||[]).join(', ');panel.dataset.dirty='false';diff.innerHTML=diffHTML(currentProduct(),r);validation.textContent='';versions();renderCases(panel,p);}
 async function store(patch,source='manual',purpose='İlan hazırlığı'){
  const next=core().saveDraft(currentProduct(),record(p),patch,{source,purpose});ctx.getState().preparations??={};ctx.getState().preparations[idOf(p)]=next;await persist(mountedScope);populate(next);ctx.message('Yerel taslak kaydedildi. Etsy ilanı değişmedi.');return next;
 }
 form.addEventListener('submit',async event=>{event.preventDefault();const b=form.querySelector('button[type=submit]');if(b.disabled)return;b.disabled=true;try{await store(read());}catch(e){ctx.message(e.message,true);}finally{b.disabled=false;}});
 buttonAction($('[data-prep-paragraph]',panel),()=>{const r=core().upsertDeliveryParagraph(form.elements.description.value,delivery(p));form.elements.description.value=r.after;dirty();diff.innerHTML=diffHTML(currentProduct(),read());validation.textContent=r.changed?'Teslim paragrafı hazırlandı. Kaydetmeden önce metni incele.':'Teslim paragrafı zaten aynı. Yeni kopya eklenmedi.';});
 buttonAction($('[data-prep-preview]',panel),()=>{const r=core().validateDraft(read());validation.textContent=[...r.errors,...r.warnings].join(' ');diff.innerHTML=diffHTML(currentProduct(),read());});
 for(const field of ['title','description','tags'])buttonAction($('[data-prep-copy-'+field+']',panel),()=>{const r=read();return copy(field==='tags'?r.tags.join(', '):r[field]);});
 buttonAction($('[data-prep-export]',panel),()=>{const r=core().validateDraft(read());if(!r.ok)throw Error(r.errors.join(' '));textExport('ilan-'+idOf(p)+'-taslak.json',draftExport(p,{...record(p),...r.value}));});
 buttonAction($('[data-prep-undo]',panel),async()=>{currentProduct();const version=$('[data-prep-versions]',panel).value;if(!version)throw Error('Önce bir taslak kaydet.');const next=core().undoDraft(record(p),version);ctx.getState().preparations[idOf(p)]=next;await persist(mountedScope);populate(next);ctx.message('Seçili yerel sürüme dönüldü. Etsy ilanı değişmedi.');});
 buttonAction($('[data-prep-context]',panel),()=>{
  const t=$('[data-prep-task]',panel).value,opts={message:$('[data-prep-message]',panel).value,includeSensitive:$('[data-prep-sensitive]',panel).checked,history:ctx.getWorkspace?.()?.history,period:90,supportInfo:ctx.getState().delivery?.support};
  $('[data-prep-context-text]',panel).value=core().buildContext(t,currentProduct(),delivery(p),opts);ctx.message('Bağlam hazır. Kopyalamadan önce inceleyebilirsin.');
 });
 buttonAction($('[data-prep-context-copy]',panel),()=>copy($('[data-prep-context-text]',panel).value));
 buttonAction($('[data-prep-context-export]',panel),()=>{const text=$('[data-prep-context-text]',panel).value;if(!text)throw Error('Önce bağlam metnini hazırla.');textExport('urun-'+idOf(p)+'-baglam.txt',text);});
 buttonAction($('[data-prep-ai-apply]',panel),async()=>{
  const result=core().parseAIOutput($('[data-prep-ai-output]',panel).value,read());$('[data-prep-ai-result]',panel).textContent=[...result.errors,...result.warnings].join(' ');if(!result.ok)throw Error(result.errors.join(' '));await store(result.patch,'ai','Yapay zekâ yanıtı; kullanıcı incelemesi gerekir');$('[data-prep-ai-result]',panel).textContent='Geçerli alanlar yerel taslağa kaydedildi. '+result.warnings.join(' ');$('.prep-draft',panel).open=true;
 });
 buttonAction($('[data-prep-reply-generate]',panel),()=>{const kind=$('[data-prep-reply-kind]',panel).value,r=core().supportReply(kind,currentProduct(),delivery(p),{supportInfo:ctx.getState().delivery?.support,includeDeliveryLink:$('[data-prep-reply-link]',panel).checked});$('[data-prep-reply-text]',panel).value=r.en;$('[data-prep-reply-tr]',panel).textContent=r.tr;$('[data-prep-reply-missing]',panel).textContent=r.missing.length?'Bilgi eksik: '+r.missing.join(' '):'Bu bir hazır şablondur; göndermeden önce doğrula.';generatedReply=true;});
 buttonAction($('[data-prep-reply-copy]',panel),()=>copy($('[data-prep-reply-text]',panel).value));
 buttonAction($('[data-prep-case-save]',panel),async()=>{
  currentProduct();if(!generatedReply)throw Error('Önce soruna uygun yanıt şablonunu hazırla.');const kind=$('[data-prep-reply-kind]',panel).value;const state=ctx.getState();state.customerCases??=[];state.customerCases.push({id:crypto.randomUUID(),product:idOf(p),kind,date:new Date().toISOString(),resolved:false,note:'Yanıt şablonu hazırlandı'});await persist(mountedScope);renderCases(panel,p);ctx.message('Sorun konusu kaydedildi. Müşteri mesajı ve yanıt metni saklanmadı.');
 });
 $('[data-prep-reply-kind]',panel).addEventListener('change',()=>{generatedReply=false;});
 versions();renderCases(panel,p);if(saved)diff.innerHTML=diffHTML(p,saved);
 return panel;
}
function renderCases(panel,p){
 const cases=(ctx.getState().customerCases||[]).filter(c=>c.product===idOf(p)),recent=cases.filter(c=>Date.parse(c.date)>=Date.now()-30*86400000);
 const node=$('[data-prep-cases]',panel);node.innerHTML=`<p class="small">Son 30 günde ${recent.length} kayıtlı sorun · ${cases.filter(c=>!c.resolved).length} açık kayıt. Kayıt yokluğu, müşteri sorunu yok demek değildir.</p>`+cases.slice(-8).reverse().map(c=>`<div class="backup-row"><span>${E(replyKinds[c.kind]||c.kind)}<small>${E(dateLabel(c.date))} · ${c.resolved?'Çözüldü':'Açık'}</small></span><button type="button" data-prep-case-toggle="${E(c.id)}">${c.resolved?'Yeniden aç':'Çözüldü işaretle'}</button></div>`).join('');
 node.querySelectorAll('[data-prep-case-toggle]').forEach(b=>buttonAction(b,async()=>{const caseScope=panel.dataset.preparationShop||null;assertScope(caseScope);const c=ctx.getState().customerCases.find(c=>c.id===b.dataset.prepCaseToggle);if(!c)throw Error('Kayıt artık bulunmuyor.');c.resolved=!c.resolved;await persist(caseScope);renderCases(panel,p);ctx.message('Takip durumu kaydedildi. Müşteriye mesaj gönderilmedi.');}));
}
function createMain(){
 let section=$('#preparation');if(!section){section=document.createElement('section');section.id='preparation';document.querySelector('main').insertBefore(section,document.querySelector('main>footer'));}
 section.innerHTML='<h2>İlan ve yanıt hazırlığı</h2><p>Ürünü kontrol et, teslim yöntemine uygun içeriğini hazırla ve önce/sonra farkını gör. Her değişiklik yerel taslaktır; Etsy’ye kendiliğinden uygulanmaz.</p><p data-prep-summary class="small" role="status"></p><article id="prep-recovery" class="card" hidden><h3>Önceki mağazanın kaydedilmemiş hazırlığı</h3><p>Mağaza değiştiğinde eski taslak alanları yeni mağazaya aktarılmaz. Kaydedilmemiş başlık, açıklama ve etiketlerin bu oturumda ayrı tutuldu. Müşteri mesajı ve yanıtı bu kopyada bulunmaz. Sayfayı kapatmadan önce istersen indir.</p><div class="tools"><button id="prep-recovery-export" type="button">Oturum kopyasını indir</button><button id="prep-recovery-clear" type="button">Oturum kopyasını temizle</button></div></article><div class="filters"><label>Hazırlanacak ürün<select id="prep-product"></select></label></div><div id="prep-editor"></div><details class="optional-tools"><summary>Birden fazla ürüne ortak teslim paragrafı hazırla</summary><p>Seçili ürünlerin mevcut açıklamasına TXT → Drive teslim talimatı eklenir veya eski ortak paragraf yenilenir. Her ürünün metnini kaydetmeden önce ayrı görebilirsin.</p><div class="tools"><button type="button" id="prep-select-all">Görünen ürünleri seç</button><button type="button" id="prep-select-none">Seçimi temizle</button></div><div id="prep-batch-products" class="prep-batch-products"></div><div class="tools"><button type="button" id="prep-batch-preview">Seçili ürünlerin farkını hazırla</button><button type="button" id="prep-batch-save" class="primary" disabled>Önizlemeyi yerel taslaklara kaydet</button><button type="button" id="prep-batch-export" disabled>Önizleme JSON indir</button></div><p id="prep-batch-status" class="small" role="status"></p><div id="prep-batch-results"></div></details>';
 mainEditor=$('#prep-editor');
 $('#prep-recovery').hidden=!recoveredDrafts.length;
 buttonAction($('#prep-recovery-export'),()=>textExport('kaydedilmemis-magaza-hazirliklari.json',JSON.stringify({schema:1,kind:'unsaved-preparations',exportedAt:new Date().toISOString(),drafts:recoveredDrafts},null,2)));
 buttonAction($('#prep-recovery-clear'),()=>{recoveredDrafts.length=0;$('#prep-recovery').hidden=true;ctx.message('Oturum kopyası temizlendi. Kaydedilmiş mağaza verileri değişmedi.');});
 $('#prep-product').addEventListener('change',event=>{const next=event.target.value;if(mainEditor.querySelector('[data-dirty=true]')&&!confirm('Kaydedilmemiş taslak alanların var. Ürün değiştirilsin mi?')){event.target.value=mainProduct;return;}mainProduct=next;showMainProduct();});
 const invalidate=()=>{batchPreview=null;$('#prep-batch-save').disabled=true;$('#prep-batch-export').disabled=true;$('#prep-batch-status').textContent='Seçim değişti. Önizlemeyi yeniden hazırla.';$('#prep-batch-results').replaceChildren();};
 $('#prep-batch-products').addEventListener('change',invalidate);
 $('#prep-select-all').onclick=()=>{$('#prep-batch-products').querySelectorAll('input').forEach(e=>e.checked=true);invalidate();};
 $('#prep-select-none').onclick=()=>{$('#prep-batch-products').querySelectorAll('input').forEach(e=>e.checked=false);invalidate();};
 buttonAction($('#prep-batch-preview'),()=>{
  const selected=[...$('#prep-batch-products').querySelectorAll('input:checked')].map(e=>e.value);if(!selected.length)throw Error('En az bir ürün seç.');
  batchPreview=selected.map(id=>{const p=products().find(p=>idOf(p)===id);if(!p)throw Error('Seçilen ürün artık aktif listede yok.');const current=record(p)||base(p),result=core().upsertDeliveryParagraph(current.description,delivery(p));return {shopId:activeScope,id,title:p.title,before:result.before,after:result.after,changed:result.changed,removedDuplicates:result.removedDuplicates,source:JSON.stringify(current),liveSource:JSON.stringify(base(p))};});
  $('#prep-batch-results').innerHTML=batchPreview.map(r=>`<article class="card"><h3>${E(r.title)}</h3><p>${r.changed?'Teslim paragrafı hazırlanacak':'Metin aynı; yeni sürüm oluşturulmayacak'}${r.removedDuplicates?' · '+r.removedDuplicates+' yinelenen ortak paragraf temizlenecek':''}</p><div class="form"><label>Önce<textarea readonly rows="6">${E(r.before)}</textarea></label><label>Sonra<textarea readonly rows="6">${E(r.after)}</textarea></label></div></article>`).join('');
  $('#prep-batch-save').dataset.disabledAfter='false';$('#prep-batch-save').disabled=!batchPreview.some(r=>r.changed);$('#prep-batch-export').disabled=false;$('#prep-batch-status').textContent=batchPreview.length+' ürün incelendi; '+batchPreview.filter(r=>r.changed).length+' açıklamada değişiklik var. Etsy’ye gönderilmez.';
 });
 buttonAction($('#prep-batch-save'),async()=>{
  if(!batchPreview?.length)throw Error('Önce değişiklik önizlemesi hazırla.');if(batchPreview.some(r=>r.shopId!==scopeId()))throw Error('Toplu hazırlık farklı mağazaya ait. Önizlemeyi yeniden hazırla.');
  const next=batchPreview.filter(r=>r.changed).map(r=>{const p=products().find(p=>idOf(p)===r.id);if(!p||JSON.stringify(record(p)||base(p))!==r.source||JSON.stringify(base(p))!==r.liveSource)throw Error('Ürün veya taslak değişmiş. Önizlemeyi yeniden hazırla.');return [r.id,core().saveDraft(p,record(p),{description:r.after},{source:'batch',purpose:'Ortak TXT → Drive teslim paragrafı'})];});
  if(!next.length)throw Error('Kaydedilecek değişiklik yok.');ctx.getState().preparations??={};for(const [id,r] of next)ctx.getState().preparations[id]=r;await persist();$('#prep-batch-status').textContent=next.length+' yerel taslak kaydedildi. Etsy ilanları değiştirilmedi.';batchPreview=null;$('#prep-batch-save').dataset.disabledAfter='true';$('#prep-batch-export').disabled=true;if(!mainEditor.querySelector('[data-dirty=true]'))showMainProduct();ctx.message(next.length+' yerel taslak kaydedildi.');
 });
 buttonAction($('#prep-batch-export'),()=>{if(!batchPreview?.length)throw Error('Önce değişiklik önizlemesi hazırla.');textExport('toplu-teslim-paragrafi.json',JSON.stringify({schema:1,kind:'batch-preparation-preview',exportedAt:new Date().toISOString(),products:batchPreview.map(({id,title,before,after,changed,removedDuplicates})=>({id,title,before,after,changed,removedDuplicates}))},null,2));});
}
function showMainProduct(){
 mainEditor.replaceChildren();const p=selectedProduct();if(p)mountProduct(p,mainEditor);else mainEditor.innerHTML='<p class="empty">Canlı ürünler geldiğinde burada hazırlık yapabilirsin. Ürün verilerini Etsy bağlantısından yenile.</p>';
}
function resetScope(){
 if(!ctx||scopeId()===activeScope)return false;
 let preserved=0;
 for(const panel of mounted){
  if(panel.dataset.dirty==='true'){
   const form=$('[data-prep-form]',panel);
   if(form){const snapshot={shopId:panel.dataset.preparationShop||null,product:panel.dataset.preparationProduct,capturedAt:new Date().toISOString(),title:form.elements.title.value,description:form.elements.description.value,tags:form.elements.tags.value.split(',').map(v=>v.trim()).filter(Boolean)};recoveredDrafts.push(snapshot);preserved++;}
  }
 }
 ctx.message(preserved?'Mağaza değişti. Kaydedilmemiş hazırlığın ayrı oturum kopyasında tutuldu; yeni mağazaya aktarılmadı. Hazırlık bölümünden indirebilirsin.':'Mağaza değişti. Önceki hazırlık alanı kapatıldı; yeni mağazanın verileri ayrı açılıyor.');
 for(const panel of mounted)panel.remove();mounted.clear();mainProduct='';batchPreview=null;activeScope=scopeId();createMain();return true;
}
function render(){
 if(!ctx)return;if(scopeId()!==activeScope)resetScope();for(const p of mounted)if(!p.isConnected)mounted.delete(p);
 const list=products(),select=$('#prep-product'),ids=list.map(idOf),existing=[...select.options].map(o=>o.value);
 if(ids.join('|')!==existing.join('|')||list.some((p,i)=>select.options[i]?.textContent!==p.title)){
  select.innerHTML=list.map(p=>`<option value="${E(idOf(p))}">${E(p.title)}</option>`).join('');
  if(ids.includes(mainProduct))select.value=mainProduct;else if(!mainEditor.querySelector('[data-dirty=true]')){mainProduct=ids[0]||'';select.value=mainProduct;showMainProduct();}
 }
 select.disabled=!list.length;
 const oldChecked=new Set([...$('#prep-batch-products').querySelectorAll('input:checked')].map(e=>e.value)),oldIds=[...$('#prep-batch-products').querySelectorAll('input')].map(e=>e.value);
 if(ids.join('|')!==oldIds.join('|')){$('#prep-batch-products').innerHTML=list.map(p=>`<label class="prep-check" style="display:flex;align-items:center;gap:10px;padding:10px 0"><input type="checkbox" value="${E(idOf(p))}" style="width:auto" ${oldChecked.has(idOf(p))?'checked':''}><span>${E(p.title)}</span></label>`).join('')||'<p class="small">Aktif ürün bulunmuyor.</p>';batchPreview=null;$('#prep-batch-save').disabled=true;$('#prep-batch-export').disabled=true;}
 const drafts=Object.keys(ctx.getState().preparations||{}).length;$('#preparation [data-prep-summary]').textContent=list.length+' aktif ürün · '+drafts+' kayıtlı yerel taslak. Bu hazırlık araçları ücretli yapay zekâ API’si kullanmaz.';
 for(const panel of mounted){const p=list.find(p=>idOf(p)===panel.dataset.preparationProduct);if(p){$('[data-prep-audit]',panel).innerHTML=auditHTML(p);renderCases(panel,p);}}
}
function init(context){ctx=context;activeScope=scopeId();if(!core())throw Error('Hazırlık araçları yüklenemedi. Sayfayı yenile.');createMain();render();}
root.STLPreparationUI={init,render,mountProduct,resetScope};
})(globalThis);
