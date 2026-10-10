(function(root){
let ctx=null,model=null,fileInfo=null,worker=null,fileGeneration=0,rotation=[-.45,.6],zoom=1,drag=null,lastNotice='';
const $=selector=>document.querySelector(selector);
const getHistory=()=>ctx.getWorkspace()?.history;
function preference(key){try{return localStorage.getItem(key);}catch{return null;}}
function setPreference(key,value){try{if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value);}catch{ctx.message('Tarayıcı bildirim tercihini saklayamadı; ortak mağaza kayıtları etkilenmez.',true);}}
const formatDate=value=>value?new Date(value).toLocaleDateString('tr-TR'):'—';
function resultHTML(o){
 if(!ctx)return '';
 const r=STLInsights.autoAssessment(o,getHistory(),ctx.getState().changes||[]);
 const names={title:'Başlık',description:'Açıklama',tags:'Etiketler',images:'Görseller',type:'İlan türü',price:'Fiyat'};
 const e=ctx.esc;
 return `<span class="badge">${e(r.label)}</span><p>${e((o.fields||[]).map(f=>names[f]||f).join(', '))} · ${formatDate(o.observedAt)}</p>${r.ready?`<div class="metrics"><div>Ürün · önce → sonra<strong>${r.before} → ${r.after} adet</strong></div>${r.controls!==undefined?`<div>${r.controls} karşılaştırılabilir ürün<strong>${r.controlBefore} → ${r.controlAfter} adet</strong></div>`:''}</div>`:''}${r.difference!==undefined?`<p>Mağaza hareketinden fark: <strong>${r.difference>0?'+':''}${r.difference.toFixed(1)} yüzde puan</strong></p>`:''}<p>${e(r.reason)}</p>${r.ready&&!ctx.getWorkspace()?.dismissed?.includes(o.id)?`<button data-result-read="${e(o.id)}">Sonucu gördüm ✓</button>`:''}`;
}
function render(){
 if(!ctx)return;
 const w=ctx.getWorkspace(),history=w?.history,live=ctx.getLive(),state=ctx.getState(),e=ctx.esc;
 const products=Object.values(history?.products||{}),observations=history?.observations||[];
 const assessments=observations.slice(-100).map(o=>({o,r:STLInsights.autoAssessment(o,history,state.changes||[])}));
 const unread=assessments.filter(x=>x.r.ready&&!w.dismissed.includes(x.o.id)).reverse();
 ctx.setMarkup('#automatic-results',assessments.length?assessments.slice(-24).reverse().map(({o})=>`<article class="card"><h3>${e(history.products[String(o.product)]?.title||o.title)}</h3>${resultHTML(o)}</article>`).join(''):'<p class="empty">Etsy’de yaptığın ilk düzenlemeden sonra izleme otomatik başlar. Sonucu görmek için yeniden kayıt açman gerekmez.</p>');
 ctx.setMarkup('#home-auto-jobs',unread.slice(0,2).map(({o,r})=>`<article class="card"><span class="badge">Otomatik karşılaştırma hazır</span><h3>${e(history.products[String(o.product)]?.title||o.title)}</h3><p>${e(r.label)} · ${r.before} → ${r.after} adet</p><div class="card-actions"><a class="button primary" href="#change-evaluations">Sonucu incele →</a><button data-result-read="${e(o.id)}">Gördüm ✓</button></div></article>`).join(''));
 const launch=(live?.snapshot?.products||[]).filter(p=>p.age!==null&&p.age<=90).map(p=>({p,r:STLInsights.launchReview(p,history)}));
 ctx.setMarkup('#launch-results',launch.length?launch.map(({p,r})=>`<article class="card"><span class="badge">${r.ready?e(r.label):'Veri birikiyor'}</span><h3>${e(p.title)}</h3>${r.ready?`<p>İlk ${r.days} tam gün: <strong>${r.quantity} adet</strong> · ${r.sellingDays} farklı satış günü</p>`:''}<p>${e(r.reason)}</p><button data-product="${e(p.id)}">Ürünü incele</button></article>`).join(''):'<p class="empty">İlk 90 günündeki ürünlerin denemeleri burada kendiliğinden takip edilir.</p>');
 const archived=products.filter(p=>!p.active).length;
 ctx.setMarkup('#home-benefits',`<div class="benefit-row"><strong>${observations.length}</strong><span>ilan değişikliği otomatik fark edildi</span></div><div class="benefit-row"><strong>${unread.length}</strong><span>okunmamış karşılaştırma hazır</span></div><div class="benefit-row"><strong>${archived}</strong><span>aktif listeden çıkan ürünün geçmişi korundu</span></div><p class="small">Bunlar yapılan işlerdir; tahmini zaman kazancı veya satış artışı değildir.</p><a class="button" href="#change-evaluations">Değiştirdim; ne oldu? →</a>`);
 const status=!ctx.isLocal?'Statik önizleme: kayıtlar yalnızca bu tarayıcıda.':ctx.isBlocked()?'Kaydetme durduruldu. Sekme kopyasını yedekleyip yenile.':ctx.getPending()?'Yerel kayıt kaydediliyor…':w?.backupError?'Kayıt saklandı; otomatik yedek alınamadı: '+w.backupError:w?'Ortak yerel depo hazır · '+w.backups.length+' otomatik yedek · '+formatDate(w.updated):'Yerel depo henüz alınamadı.';
 $('#storage-status').textContent=status;
 ctx.setMarkup('#backup-list',w?.backups?.length?w.backups.slice(0,8).map(b=>`<div class="backup-row"><span>${e(b.name)}<small>${formatDate(b.updated)}</small></span><button data-restore-backup="${e(b.name)}">Geri yükle</button></div>`).join(''):'<p class="small">İlk yerel kayıttan sonra otomatik yedek oluşur.</p>');
 ctx.setMarkup('#history-summary',[['Hafızadaki ürün',products.length],['Aktif listede olmayan',archived],['İlk kayıt',formatDate(history?.firstCaptured)],['Değişiklik gözlemi',observations.length]].map(([label,value])=>`<div class="stat"><span>${label}</span><strong>${e(value)}</strong></div>`).join(''));
 const query=$('#history-search').value.toLocaleLowerCase('tr'),filter=$('#history-filter').value;
 const visible=products.filter(p=>(filter==='all'||!p.active)&&(p.title+' '+p.id).toLocaleLowerCase('tr').includes(query));
 ctx.setMarkup('#history-cards',visible.map(p=>{const days=p.coverage||[],knownDays=new Set(days),total=Object.entries(p.daily||{}).filter(([d])=>knownDays.has(d)).reduce((s,[,q])=>s+q,0);return `<article class="card"><span class="badge">${p.active?'Aktif listede':'Son aktif listede yok'}</span><h3>${e(p.title)}</h3><p>${days.length} tam gün kaydı · ${total} adet</p><p class="small">Aktif listede olmamak, silindiği anlamına gelmez. Kayıtlı günler kesintili olabilir; toplam tüm mağaza geçmişi değildir.</p><details><summary>Kaydedilmiş günleri aç</summary><div class="table-wrap"><table><thead><tr><th>Tarih (UTC)</th><th>Adet</th></tr></thead><tbody>${days.slice(-90).reverse().map(d=>`<tr><td>${e(d)}</td><td>${p.daily[d]||0}</td></tr>`).join('')}</tbody></table></div><p class="small">Son 90 kayıtlı gün gösterilir. Daha eski toplanmış günler tam yedekte bulunur.</p></details></article>`;}).join('')||'<p class="empty">Bu görünümde geçmiş ürün yok. Aktif listeden çıkan ürünler sonraki eşitlemelerde burada korunacak.</p>');
 const watches=ctx.getMarket()?.watches||[];
 ctx.setMarkup('#market-evidence',watches.map(watch=>{const r=STLInsights.marketEvidence(watch.current,watch.history),marketStamp=Date.parse(watch.current?.updated),stale=!Number.isFinite(marketStamp)||marketStamp>Date.now()||Date.now()-marketStamp>2*86400000;return `<article class="card"><span class="badge">${stale?'Gözlem eski veya eksik':e(r.label)}</span><h3>${e(watch.query)}</h3><div class="metrics"><div>Başlığında STL olan dijital<strong>${r.stl} / ${r.sampled}</strong></div><div>Bu STL örneğinde mağaza<strong>${r.shops}</strong></div><div>En büyük mağazanın payı<strong>${r.concentration===null?'—':Math.round(r.concentration*100)+'%'}</strong></div><div>Başarılı gözlem<strong>${r.observations}</strong></div></div>${r.medians.map(p=>`<p>${e(p.currency)}: medyan ${p.median.toFixed(2)} · ${p.min.toFixed(2)}–${p.max.toFixed(2)} · ${p.count} fiyat</p>`).join('')}<p class="small">${e(r.reason)}${r.unknownShops?' '+r.unknownShops+' STL ilanda mağaza kimliği eksik.':''}</p><p><strong>Talep: bilinmiyor.</strong> Düşük sonuç sayısı tek başına fırsat sayılmadı.</p></article>`;}).join(''));
 const queries=STLInsights.adjacentQueries(live?.snapshot?.products||[]).filter(q=>!watches.some(w=>w.kind==='keyword'&&w.query.toLowerCase()===q.toLowerCase()));
 ctx.setMarkup('#adjacent-suggestions',queries.length?`<h3>Yakın bir kullanım alanını dene</h3><p>Aynı tür modeli farklı kullanım için araştır. Bunlar kural tabanlı fikirlerdir; talep ölçümü değildir.</p><div class="tools">${queries.map(q=>`<button data-watch-query="${e(q)}" ${!ctx.isLocal||!live?.configured||watches.length>=10?'disabled':''}>${e(q)} ＋</button>`).join('')}</div>`:'<p class="small">Ürün grupların geldikçe yakın kullanım alanları önerilebilir.</p>');
 ctx.setMarkup('#file-checks',(state.fileChecks||[]).slice(-20).reverse().map(f=>`<article class="card"><h3>${e(f.name)}</h3><p>${f.triangles.toLocaleString('tr-TR')} üçgen · ${formatDate(f.date)}</p><p>${f.dimensions.map(n=>n.toFixed(2)).join(' × ')} model birimi</p><p>${f.warnings.length?e(f.warnings.join(' ')):'Temel kontrollerde sorun işaretlenmedi; baskı garantisi değildir.'}</p><button data-delete-check="${e(f.id)}">Özeti sil</button></article>`).join('')||'<p class="empty">Dosyanın kendisi saklanmaz; seçersen yalnızca kontrol özeti kaydedilir.</p>');
 notifyDue(state);
}
function notifyDue(state){
 if(!ctx.isLocal||typeof Notification==='undefined'||Notification.permission!=='granted'||preference('stl-notifications')!=='on')return;
 const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Istanbul'}).format(new Date()),count=(state.support||[]).filter(x=>!x.resolved&&x.due&&x.due<=day).length;
 const key=day+':'+count;if(!count||lastNotice===key||preference('stl-notified')===key)return;
 lastNotice=key;setPreference('stl-notified',key);new Notification('STL Atölyesi',{body:count+' kayıtlı müşteri işinin takip zamanı geldi. Etsy mesaj kutusu otomatik okunmuyor.',tag:'stl-support'});
}
function draw(){
 if(!model)return;const canvas=$('#stl-canvas'),c=canvas.getContext('2d'),width=canvas.width,height=canvas.height;c.fillStyle='#f5f7fa';c.fillRect(0,0,width,height);
 const center=model.min.map((n,i)=>(n+model.max[i])/2),size=Math.max(...model.dimensions),scale=Math.min(width,height)*.6/size*zoom;
 const project=(x,y,z)=>{x-=center[0];y-=center[1];z-=center[2];const x1=x*Math.cos(rotation[1])+z*Math.sin(rotation[1]),z1=-x*Math.sin(rotation[1])+z*Math.cos(rotation[1]);const y1=y*Math.cos(rotation[0])-z1*Math.sin(rotation[0]),z2=y*Math.sin(rotation[0])+z1*Math.cos(rotation[0]);return [width/2+x1*scale,height/2-y1*scale,z2];};
 const faces=[];for(let i=0;i<model.sample.length;i+=9){const f=[];for(let j=0;j<3;j++)f.push(project(...model.sample.slice(i+j*3,i+j*3+3)));faces.push(f);}faces.sort((a,b)=>a.reduce((s,p)=>s+p[2],0)-b.reduce((s,p)=>s+p[2],0));
 for(const f of faces){c.beginPath();c.moveTo(f[0][0],f[0][1]);c.lineTo(f[1][0],f[1][1]);c.lineTo(f[2][0],f[2][1]);c.closePath();const shade=Math.round(170+Math.max(-1,Math.min(1,f.reduce((s,p)=>s+p[2],0)/3/size))*35);c.fillStyle=`rgb(${shade-35},${shade-8},${shade+20})`;c.fill();c.strokeStyle='#537ca655';c.lineWidth=.6;c.stroke();}
}
function report(){
 if(!model)return;const e=ctx.esc,query=(fileInfo.name.replace(/\.stl$/i,'').replace(/[_-]+/g,' ').replace(/\b(supported|unsupported|presupported)\b/gi,'').trim().slice(0,85)+' stl').replace(/\bstl\s+stl\b/i,'stl'),unit=$('#stl-unit').value,label=unit==='model'?'model birimi':unit,duplicate=(ctx.getState().fileChecks||[]).find(f=>f.hash===fileInfo.hash);
 $('#stl-report').innerHTML=`<h3>${e(fileInfo.name)}</h3><p>${e(model.format)} · ${model.triangles.toLocaleString('tr-TR')} üçgen</p><div class="metrics"><div>Boyutlar<strong>${model.dimensions.map(n=>n.toFixed(2)).join(' × ')}</strong><small>${e(label)}${unit==='model'?' · Birim dosyada belirtilmez':' · Senin seçimin'}</small></div><div>Açık kenar<strong>${model.boundary??'Kontrol edilmedi'}</strong></div></div>${model.warnings.length?`<ul class="audit-list">${model.warnings.map(w=>`<li>${e(w)}</li>`).join('')}</ul>`:'<p>Temel geometri kontrollerinde sorun işaretlenmedi. Kendi kendini kesme veya baskı başarısı doğrulanmadı.</p>'}${duplicate?`<p class="notice">Aynı dosya daha önce ${e(duplicate.name)} adıyla kontrol edilmiş. Dosya içeriği SHA-256 ile eşleşti.</p>`:''}`;
 $('#stl-report').insertAdjacentHTML('beforeend',`<a class="button" href="https://www.etsy.com/search?q=${encodeURIComponent(query)}" target="_blank" rel="noopener noreferrer">Bu dosya adıyla pazarı araştır ↗</a><p class="small">Arama dosya adından oluşturuldu; modelin ne olduğunu veya talebi doğrulamaz.</p>`);
 $('#stl-save').disabled=!!duplicate;
}
async function openFile(file){
 if(!file)return;const generation=++fileGeneration;if(worker){worker.terminate();worker=null;}model=null;$('#stl-workspace').hidden=true;
 if(!/\.stl$/i.test(file.name)||file.size>25*1024*1024){$('#stl-status').textContent='En fazla 25 MB .stl dosyası seç. ZIP’i önce çıkar.';return;}
 $('#stl-status').textContent='Dosya yerel olarak okunuyor ve kontrol ediliyor…';
 try{
  const buffer=await file.arrayBuffer();if(generation!==fileGeneration)return;
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',buffer))).map(n=>n.toString(16).padStart(2,'0')).join('');if(generation!==fileGeneration)return;
  fileInfo={name:file.name.slice(0,250),hash};
  worker=new Worker(new URL('stl.js',location.href));const current=worker;
  const parsed=await new Promise((resolve,reject)=>{current.onmessage=e=>{e.data.error?reject(Error(e.data.error)):resolve(e.data.result);};current.onerror=()=>reject(Error('Dosya kontrolü başlatılamadı. Sayfayı yenileyip tekrar dene.'));current.postMessage(buffer,[buffer]);});
  current.terminate();if(worker===current)worker=null;if(generation!==fileGeneration)return;model=parsed;
  rotation=[-.45,.6];zoom=1;$('#stl-unit').value='model';$('#stl-workspace').hidden=false;$('#stl-status').textContent='Dosya açıldı. Kontrol özeti isteğe bağlı saklanabilir.';draw();report();
 }catch(e){if(generation===fileGeneration)$('#stl-status').textContent=e.message;if(worker){worker.terminate();worker=null;}}
}
function init(context){
 ctx=context;$('#history-search').oninput=render;$('#history-filter').onchange=render;
 document.addEventListener('click',async event=>{const b=event.target.closest('button');if(!b||(!b.dataset.resultRead&&!b.dataset.restoreBackup&&!b.dataset.deleteCheck))return;
  try{if(b.dataset.resultRead){b.disabled=true;await ctx.dismiss(b.dataset.resultRead);ctx.message('Sonuç görüldü; günlük listeden kaldırıldı. Geçmişte duruyor.');}
   if(b.dataset.restoreBackup){if(!confirm('Bu yedek geri yüklensin mi? Önce mevcut kayıtların yedeği alınır. Etsy bağlantısı değişmez.'))return;b.disabled=true;await ctx.restore(b.dataset.restoreBackup);ctx.message('Yedek geri yüklendi.');}
   if(b.dataset.deleteCheck){ctx.getState().fileChecks=ctx.getState().fileChecks.filter(f=>f.id!==b.dataset.deleteCheck);ctx.save();render();}
  }catch(e){ctx.message(e.message,true);}finally{b.disabled=false;}
 });
 $('#customer-message').addEventListener('input',()=>{const r=STLInsights.topicSuggestion($('#customer-message').value);$('#topic-suggestion').textContent=r.label;if(r.topic){$('#reply-topic').value=r.topic;$('#reply-topic').dispatchEvent(new Event('change'));}});
 $('#stl-file').onchange=event=>{void openFile(event.target.files[0]);event.target.value='';};
 const drop=$('#stl-drop');drop.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();$('#stl-file').click();}};drop.ondragover=e=>{e.preventDefault();drop.classList.add('dragging');};drop.ondragleave=()=>drop.classList.remove('dragging');drop.ondrop=e=>{e.preventDefault();drop.classList.remove('dragging');void openFile(e.dataTransfer.files[0]);};
 $('#stl-unit').onchange=report;$('#stl-reset').onclick=()=>{rotation=[-.45,.6];zoom=1;draw();};
 const canvas=$('#stl-canvas');canvas.onpointerdown=e=>{drag=[e.clientX,e.clientY];canvas.setPointerCapture(e.pointerId);};canvas.onpointermove=e=>{if(!drag)return;rotation[1]+=(e.clientX-drag[0])*.01;rotation[0]+=(e.clientY-drag[1])*.01;drag=[e.clientX,e.clientY];draw();};canvas.onpointerup=canvas.onpointercancel=()=>drag=null;
 canvas.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-','='].includes(e.key))return;e.preventDefault();if(e.key==='ArrowLeft')rotation[1]-=.15;if(e.key==='ArrowRight')rotation[1]+=.15;if(e.key==='ArrowUp')rotation[0]-=.15;if(e.key==='ArrowDown')rotation[0]+=.15;if(['+','='].includes(e.key))zoom=Math.min(4,zoom*1.1);if(e.key==='-')zoom=Math.max(.2,zoom/1.1);draw();};
 $('#stl-save').onclick=()=>{if(!model)return;const state=ctx.getState();state.fileChecks??=[];if(state.fileChecks.some(f=>f.hash===fileInfo.hash))return;if(state.fileChecks.length>=300){ctx.message('En fazla 300 kontrol özeti saklanabilir. Eski bir özeti sil veya yedek indir.',true);return;}state.fileChecks.push({id:crypto.randomUUID(),...fileInfo,date:new Date().toISOString(),triangles:model.triangles,dimensions:model.dimensions,warnings:model.warnings});if(ctx.save()){ctx.message('Kontrol özeti saklandı. Dosyanın kendisi kaydedilmedi.');render();report();}};
 const settings=$('#messages');const link=document.createElement('a');link.className='button';link.href='https://www.etsy.com/your/messages';link.target='_blank';link.rel='noopener noreferrer';link.textContent='Etsy mesaj kutusunu aç ↗';settings.insertBefore(link,settings.querySelector('.form'));
 const notifications=document.createElement('button');notifications.textContent='Kayıtlı müşteri işleri için masaüstü bildirimi aç';notifications.id='enable-notifications';$('#live').appendChild(notifications);const note=document.createElement('p');note.className='small';note.textContent='Yalnızca bu uygulama açıkken ve elle kaydedilmiş takip tarihleri için. Etsy mesajları otomatik alınmaz; Star Seller cevap süresi takip edilmez.';$('#live').appendChild(note);
 notifications.disabled=!ctx.isLocal||typeof Notification==='undefined';notifications.onclick=async()=>{if(preference('stl-notifications')==='on'){setPreference('stl-notifications',null);notifications.textContent='Masaüstü bildirimi aç';return;}const permission=await Notification.requestPermission();if(permission==='granted'){setPreference('stl-notifications','on');notifications.textContent='Masaüstü bildirimini kapat';notifyDue(ctx.getState());}else ctx.message('Bildirim izni verilmedi; işler günlük listede görünür.');};if(preference('stl-notifications')==='on')notifications.textContent='Masaüstü bildirimini kapat';
 render();
}
root.STLWorkbench={init,render,resultHTML};
})(globalThis);
