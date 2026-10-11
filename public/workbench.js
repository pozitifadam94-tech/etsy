(function(root){
let ctx=null,model=null,fileInfo=null,worker=null,reader=null,workerReject=null,fileGeneration=0,rotation=[.55,.65],zoom=1,lightAngle=-.6,drag=null,lastNotice='',currentView='isometric';
const $=selector=>document.querySelector(selector);
const getHistory=()=>ctx.getWorkspace()?.history;
function preference(key){try{return localStorage.getItem(key);}catch{return null;}}
function setPreference(key,value){try{if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value);}catch{ctx.message('Tarayıcı bildirim tercihini saklayamadı; ortak mağaza kayıtları etkilenmez.',true);}}
const formatDate=value=>value?new Date(value).toLocaleDateString('tr-TR',{timeZone:'Europe/Istanbul'}):'—';
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
function drawPreview(canvas,options={}){
 if(!model)return;const c=canvas.getContext('2d'),width=canvas.width,height=canvas.height,pose=options.rotation||rotation,magnify=options.zoom??zoom;
 c.fillStyle='#f5f7fa';c.fillRect(0,0,width,height);
 const center=model.min.map((n,i)=>(n+model.max[i])/2),size=Math.max(...model.dimensions),scale=Math.min(width,height)*.6/size*magnify;
 const rotate=(x,y,z)=>{x-=center[0];y-=center[1];z-=center[2];const horizontal=x*Math.cos(pose[1])+y*Math.sin(pose[1]),depth=-x*Math.sin(pose[1])+y*Math.cos(pose[1]);return [horizontal,z*Math.cos(pose[0])-depth*Math.sin(pose[0]),depth*Math.cos(pose[0])+z*Math.sin(pose[0])];};
 const faces=[];for(let i=0;i<model.sample.length;i+=9){const f=[];for(let j=0;j<3;j++)f.push(rotate(...model.sample.slice(i+j*3,i+j*3+3)));faces.push(f);}faces.sort((a,b)=>a.reduce((s,p)=>s+p[2],0)-b.reduce((s,p)=>s+p[2],0));
 const light=[Math.cos(lightAngle)*.7,Math.sin(lightAngle)*.7,1],lightLength=Math.hypot(...light);
 for(const f of faces){
  const u=f[1].map((v,i)=>v-f[0][i]),v=f[2].map((n,i)=>n-f[0][i]),normal=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],length=Math.hypot(...normal),illumination=length?Math.abs(normal.reduce((s,n,i)=>s+n*light[i],0)/(length*lightLength)):0;
  const shade=Math.round(140+illumination*65);c.beginPath();c.moveTo(width/2+f[0][0]*scale,height/2-f[0][1]*scale);c.lineTo(width/2+f[1][0]*scale,height/2-f[1][1]*scale);c.lineTo(width/2+f[2][0]*scale,height/2-f[2][1]*scale);c.closePath();c.fillStyle=`rgb(${shade-35},${shade-8},${Math.min(255,shade+20)})`;c.fill();c.strokeStyle='#537ca655';c.lineWidth=.6;c.stroke();
 }
}
function draw(){if(model)drawPreview($('#stl-canvas'));}
function updatePreviewControls(){
 document.querySelectorAll('[data-stl-view]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.stlView===currentView)));
 if($('#stl-zoom'))$('#stl-zoom').value=String(zoom);if($('#stl-light'))$('#stl-light').value=String(Math.round(lightAngle*180/Math.PI));
 if($('#stl-preview-scope')&&model)$('#stl-preview-scope').textContent=`${model.sample.length/9} / ${model.triangles} yüz gösteriliyor. ${model.triangles>model.sample.length/9?'Örneklenmiş kontrol görünümü; modelin bazı ayrıntıları görünmeyebilir.':'Dosyanın bütün üçgenleri bu önizlemede gösteriliyor.'} Ön/yan yönleri STL eksenlerine göre adlandırılır; tasarımcının ön yönü bilinmiyor.`;
}
function setView(view){
 const poses={front:[0,0],side:[0,Math.PI/2],isometric:[.55,.65]};if(!poses[view])return;
 rotation=poses[view].slice();currentView=view;updatePreviewControls();draw();
}
function getCurrentFileSummary(){
 if(!model||!fileInfo)return null;return {...fileInfo,triangles:model.triangles,dimensions:model.dimensions.slice(),warnings:model.warnings.slice(),format:model.format,shownTriangles:model.sample.length/9,sampled:model.triangles>model.sample.length/9,geometryCheck:{boundary:model.boundary,nonManifold:model.nonManifold,orientation:model.orientation,completeTopology:model.completeTopology},unit:$('#stl-unit').value,printVerified:false};
}
function wrapCanvasText(c,value,x,y,maxWidth,lineHeight,maxLines=10){
 const words=String(value).split(/\s+/).flatMap(word=>{const chunks=[];let part='';for(const letter of word){if(part&&c.measureText(part+letter).width>maxWidth){chunks.push(part);part=letter;}else part+=letter;}if(part)chunks.push(part);return chunks;}),lines=[];let line='';for(const word of words){const next=line?line+' '+word:word;if(line&&c.measureText(next).width>maxWidth){lines.push(line);line=word;}else line=next;}if(line)lines.push(line);
 const visible=lines.slice(0,maxLines);if(lines.length>maxLines)visible[visible.length-1]+='…';visible.forEach((text,i)=>c.fillText(text,x,y+i*lineHeight));return y+visible.length*lineHeight;
}
async function exportPreview(kind){
 if(!model||!fileInfo)return;const summary=getCurrentFileSummary(),view=currentView,canvas=document.createElement('canvas');canvas.width=1200;canvas.height=kind==='info'?1400:1050;const c=canvas.getContext('2d');
 c.fillStyle='#f5f7fa';c.fillRect(0,0,canvas.width,canvas.height);
 if(kind==='info'){
  c.fillStyle='#15364f';c.font='bold 38px system-ui';c.fillText('DIGITAL STL FILE',65,85);c.font='26px system-ui';wrapCanvasText(c,summary.name,65,140,1070,36,3);
  const preview=document.createElement('canvas');preview.width=1070;preview.height=620;drawPreview(preview,{rotation:[.55,.65],zoom:1});c.drawImage(preview,65,260);
  c.fillStyle='#15364f';c.font='bold 26px system-ui';c.fillText('LOCAL FILE INFORMATION',65,950);c.font='23px system-ui';
  c.fillText(summary.triangles.toLocaleString('en-US')+' triangles · '+(summary.format==='İkili STL'?'Binary STL':summary.format),65,995);
  const label=summary.unit==='model'?'model units (unit not specified in STL)':summary.unit+' (user interpretation; not encoded in STL)';
  wrapCanvasText(c,summary.dimensions.map(n=>n.toFixed(2)).join(' × ')+' '+label,65,1038,1070,33,3);
  c.font='21px system-ui';wrapCanvasText(c,summary.sampled?'Sampled illustration: '+summary.shownTriangles+' of '+summary.triangles+' faces shown. Details may be missing.':'Illustration made from the selected local STL file.',65,1145,1070,32,3);
  c.fillStyle='#754121';wrapCanvasText(c,'Digital illustration, not a photograph of a printed object. Printability, supports, scale and material compatibility are not verified.',65,1230,1070,32,3);
  c.fillStyle='#15364f';c.font='18px system-ui';wrapCanvasText(c,'For an Etsy digital purchase, follow the seller\'s delivery TXT to the Google Drive folder.',65,1340,1070,26,2);
 }else{
  const preview=document.createElement('canvas');preview.width=1200;preview.height=850;drawPreview(preview);c.drawImage(preview,0,0);c.fillStyle='#fff';c.fillRect(0,850,1200,200);
  c.fillStyle='#15364f';c.font='bold 28px system-ui';c.fillText('DIGITAL STL · MODEL PREVIEW',45,895);c.font='22px system-ui';wrapCanvasText(c,summary.name,45,934,1110,29,2);
  c.font='19px system-ui';c.fillText((summary.sampled?'Sample: '+summary.shownTriangles+' / '+summary.triangles+' faces. Some details may be missing.':'All '+summary.triangles+' file triangles shown.')+' Not a print photograph.',45,1020);
 }
 const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw Error('PNG oluşturulamadı.');
 const url=URL.createObjectURL(blob),link=document.createElement('a'),name=summary.name.replace(/\.stl$/i,'').replace(/[<>:"/\\|?*\u0000-\u001f]/g,' ').trim().slice(0,100)||'stl-preview';link.href=url;link.download=name+(kind==='info'?'-file-info':'-'+view)+'-preview.png';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
 ctx.message('PNG indirmesi başlatıldı. Bu yerel STL çizimidir; baskı fotoğrafı veya yüksek ayrıntılı satış renderı değildir.');
}
function report(){
 if(!model)return;const e=ctx.esc,query=(fileInfo.name.replace(/\.stl$/i,'').replace(/[_-]+/g,' ').replace(/\b(supported|unsupported|presupported)\b/gi,'').trim().slice(0,85)+' stl').replace(/\bstl\s+stl\b/i,'stl'),unit=$('#stl-unit').value,label=unit==='model'?'model birimi':unit,duplicate=(ctx.getState().fileChecks||[]).find(f=>f.hash===fileInfo.hash);
 $('#stl-report').innerHTML=`<h3>${e(fileInfo.name)}</h3><p>${e(model.format)} · ${model.triangles.toLocaleString('tr-TR')} üçgen</p><div class="metrics"><div>Boyutlar<strong>${model.dimensions.map(n=>n.toFixed(2)).join(' × ')}</strong><small>${e(label)}${unit==='model'?' · Birim dosyada belirtilmez':' · Senin seçimin'}</small></div><div>Açık kenar<strong>${model.boundary??'Kontrol edilmedi'}</strong></div></div>${model.warnings.length?`<ul class="audit-list">${model.warnings.map(w=>`<li>${e(w)}</li>`).join('')}</ul>`:'<p>Temel geometri kontrollerinde sorun işaretlenmedi. Kendi kendini kesme veya baskı başarısı doğrulanmadı.</p>'}${duplicate?`<p class="notice">Aynı dosya daha önce ${e(duplicate.name)} adıyla kontrol edilmiş. Dosya içeriği SHA-256 ile eşleşti.</p>`:''}`;
 $('#stl-report').insertAdjacentHTML('beforeend',`<a class="button" href="https://www.etsy.com/search?q=${encodeURIComponent(query)}" target="_blank" rel="noopener noreferrer">Bu dosya adıyla pazarı araştır ↗</a><p class="small">Arama dosya adından oluşturuldu; modelin ne olduğunu veya talebi doğrulamaz.</p>`);
 $('#stl-save').disabled=!!duplicate;
}
function cancelProcessing(quiet=false){
 fileGeneration++;if(reader){const pending=reader;reader=null;pending.abort();}if(workerReject){const reject=workerReject;workerReject=null;reject(Error('İşlem iptal edildi.'));}if(worker){worker.terminate();worker=null;}
 model=null;fileInfo=null;$('#stl-workspace').hidden=true;if($('#stl-cancel'))$('#stl-cancel').hidden=true;if(!quiet)$('#stl-status').textContent='İşlem iptal edildi. Dosya değiştirilmedi veya saklanmadı.';
}
function processingStage(value){$('#stl-status').textContent=value;if($('#stl-cancel'))$('#stl-cancel').hidden=false;}
async function openFile(file){
 if(!file)return;cancelProcessing(true);const generation=fileGeneration;
 if(!/\.stl$/i.test(file.name)||file.size>25*1024*1024||file.size===0){$('#stl-status').textContent='Boş olmayan, en fazla 25 MB .stl dosyası seç. ZIP’i önce çıkar.';return;}
 processingStage('1/3 · Dosya bilgisayarından okunuyor…');
 try{
  const buffer=await new Promise((resolve,reject)=>{
   const current=new FileReader();reader=current;current.onload=()=>{if(reader===current)reader=null;resolve(current.result);};current.onerror=()=>{if(reader===current)reader=null;reject(Error('Dosya okunamadı.'));};current.onabort=()=>reject(Error('Dosya okuma iptal edildi.'));
   current.onprogress=e=>{if(generation===fileGeneration&&e.lengthComputable)processingStage(`1/3 · Dosya okunuyor: ${(e.loaded/1048576).toFixed(1)} / ${(e.total/1048576).toFixed(1)} MB`);};current.readAsArrayBuffer(file);
  });if(generation!==fileGeneration)return;
  processingStage('2/3 · Dosyanın SHA-256 içerik kimliği hesaplanıyor…');
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',buffer))).map(n=>n.toString(16).padStart(2,'0')).join('');if(generation!==fileGeneration)return;
  fileInfo={name:file.name.slice(0,250),hash};processingStage('3/3 · STL geometrisi kontrol ediliyor. En fazla 300.000 üçgen; süre dosyaya bağlı…');
  worker=new Worker(new URL('stl.js',location.href));const current=worker;
  let parsed;try{parsed=await new Promise((resolve,reject)=>{workerReject=reject;current.onmessage=e=>{e.data.error?reject(Error(e.data.error)):resolve(e.data.result);};current.onerror=()=>reject(Error('Dosya kontrolü başlatılamadı. Sayfayı yenileyip tekrar dene.'));current.postMessage(buffer,[buffer]);});}
  finally{current.terminate();if(worker===current){worker=null;workerReject=null;}}
  if(generation!==fileGeneration)return;model=parsed;zoom=1;lightAngle=-.6;$('#stl-unit').value='model';$('#stl-workspace').hidden=false;$('#stl-status').textContent='Dosya açıldı. Görseller ve kontrol özeti isteğe bağlıdır.';if($('#stl-cancel'))$('#stl-cancel').hidden=true;setView('isometric');report();
  document.dispatchEvent(new CustomEvent('stl-file-loaded',{detail:getCurrentFileSummary()}));
 }catch(e){if(generation===fileGeneration){fileInfo=null;model=null;$('#stl-status').textContent=e.message;if($('#stl-cancel'))$('#stl-cancel').hidden=true;}}
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
 const cancel=document.createElement('button');cancel.id='stl-cancel';cancel.hidden=true;cancel.textContent='Dosya işlemini iptal et';$('#stl-status').insertAdjacentElement('afterend',cancel);cancel.onclick=()=>cancelProcessing();
 const previewTools=document.createElement('div');previewTools.className='tools';previewTools.id='stl-preview-tools';previewTools.innerHTML='<button type="button" data-stl-view="front">Ön · X/Z</button><button type="button" data-stl-view="side">Yan · Y/Z</button><button type="button" data-stl-view="isometric">Çapraz</button><label>Yakınlık<input id="stl-zoom" type="range" min="0.2" max="4" step="0.05" value="1"></label><label>Işık yönü<input id="stl-light" type="range" min="-180" max="180" step="5" value="-35"></label>';
 $('#stl-canvas').insertAdjacentElement('afterend',previewTools);previewTools.querySelectorAll('[data-stl-view]').forEach(button=>button.onclick=()=>setView(button.dataset.stlView));$('#stl-zoom').oninput=e=>{zoom=Number(e.target.value);draw();};$('#stl-light').oninput=e=>{lightAngle=Number(e.target.value)*Math.PI/180;draw();};
 const scope=document.createElement('p');scope.id='stl-preview-scope';scope.className='small';previewTools.insertAdjacentElement('afterend',scope);
 const exports=document.createElement('div');exports.className='tools';exports.innerHTML='<button type="button" id="stl-export-preview">Bu görünümü PNG indir</button><button type="button" id="stl-export-info">Dosya bilgi görseli indir</button>';
 $('#stl-save').insertAdjacentElement('beforebegin',exports);const note=document.createElement('p');note.className='small';note.textContent='PNG, seçtiğin yerel STL’den çizilir. Örneklenmiş önizleme yüksek ayrıntılı satış renderı değildir; dijital çizimdir, gerçek baskı fotoğrafı değildir. Drive klasör bağlantısından model okunmaz.';exports.insertAdjacentElement('afterend',note);
 for(const [selector,kind] of [['#stl-export-preview','preview'],['#stl-export-info','info']])$(selector).onclick=async event=>{const button=event.currentTarget;button.disabled=true;try{await exportPreview(kind);}catch(e){ctx.message(e.message,true);}finally{button.disabled=false;}};
 $('#stl-unit').onchange=report;$('#stl-reset').onclick=()=>{zoom=1;lightAngle=-.6;setView('isometric');};
 const canvas=$('#stl-canvas');canvas.onpointerdown=e=>{drag=[e.clientX,e.clientY];canvas.setPointerCapture(e.pointerId);};canvas.onpointermove=e=>{if(!drag)return;rotation[1]+=(e.clientX-drag[0])*.01;rotation[0]+=(e.clientY-drag[1])*.01;currentView='custom';drag=[e.clientX,e.clientY];updatePreviewControls();draw();};canvas.onpointerup=canvas.onpointercancel=()=>drag=null;
 canvas.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-','='].includes(e.key))return;e.preventDefault();if(e.key==='ArrowLeft')rotation[1]-=.15;if(e.key==='ArrowRight')rotation[1]+=.15;if(e.key==='ArrowUp')rotation[0]-=.15;if(e.key==='ArrowDown')rotation[0]+=.15;if(['+','='].includes(e.key))zoom=Math.min(4,zoom*1.1);if(e.key==='-')zoom=Math.max(.2,zoom/1.1);currentView='custom';updatePreviewControls();draw();};
 $('#stl-save').onclick=async event=>{
  const summary=getCurrentFileSummary();if(!summary)return;const generation=fileGeneration,scope=ctx.getWorkspace()?.activeShopId??null,button=event.currentTarget;
  const unchanged=()=>generation===fileGeneration&&fileInfo?.hash===summary.hash&&(ctx.getWorkspace()?.activeShopId??null)===scope;button.disabled=true;
  try{
   if(ctx.flush)await ctx.flush();if(!unchanged())throw Error('Dosya veya mağaza değişti; önceki görünümün kontrolü yeni kayda eklenmedi.');
   const state=ctx.getState();state.fileChecks??=[];if(state.fileChecks.some(f=>f.hash===summary.hash))return;if(state.fileChecks.length>=300)throw Error('En fazla 300 kontrol özeti saklanabilir. Eski bir özeti sil veya yedek indir.');
   const record={id:crypto.randomUUID(),name:summary.name,hash:summary.hash,date:new Date().toISOString(),triangles:summary.triangles,dimensions:summary.dimensions.slice(),warnings:summary.warnings.slice()};state.fileChecks.push(record);
   if(!ctx.save())throw Error('Kontrol özeti kaydedilemedi.');if(ctx.flush)await ctx.flush();if(!unchanged())throw Error('Kayıt sırasında dosya veya mağaza değişti. Yeni görünüm için başarı gösterilmedi; geçmiş özeti kendi mağazasında korunur.');
   ctx.message('Kontrol özeti saklandı. Dosyanın kendisi kaydedilmedi.');document.dispatchEvent(new CustomEvent('stl-file-saved',{detail:{record:{...record},summary}}));render();
  }catch(e){ctx.message(e.message,true);}finally{if(generation===fileGeneration)report();}
 };
 const settings=$('#messages');const link=document.createElement('a');link.className='button';link.href='https://www.etsy.com/your/messages';link.target='_blank';link.rel='noopener noreferrer';link.textContent='Etsy mesaj kutusunu aç ↗';settings.insertBefore(link,settings.querySelector('.form'));
 const notifications=document.createElement('button');notifications.textContent='Kayıtlı müşteri işleri için masaüstü bildirimi aç';notifications.id='enable-notifications';$('#live').appendChild(notifications);const notificationNote=document.createElement('p');notificationNote.className='small';notificationNote.textContent='Yalnızca bu uygulama açıkken ve elle kaydedilmiş takip tarihleri için. Etsy mesajları otomatik alınmaz; Star Seller cevap süresi takip edilmez.';$('#live').appendChild(notificationNote);
 notifications.disabled=!ctx.isLocal||typeof Notification==='undefined';notifications.onclick=async()=>{if(preference('stl-notifications')==='on'){setPreference('stl-notifications',null);notifications.textContent='Masaüstü bildirimi aç';return;}const permission=await Notification.requestPermission();if(permission==='granted'){setPreference('stl-notifications','on');notifications.textContent='Masaüstü bildirimini kapat';notifyDue(ctx.getState());}else ctx.message('Bildirim izni verilmedi; işler günlük listede görünür.');};if(preference('stl-notifications')==='on')notifications.textContent='Masaüstü bildirimini kapat';
 render();
}
root.STLWorkbench={init,render,resultHTML,getCurrentFileSummary};
})(globalThis);
