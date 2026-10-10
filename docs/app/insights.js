(function(root){
const DAY=86400000;
const iso=t=>new Date(t).toISOString().slice(0,10);
function windowCount(product,start,end){
 const coverage=new Set(product.coverage||[]);let quantity=0,sellingDays=0;
 for(let t=start;t<end;t+=DAY){const d=iso(t);if(!coverage.has(d))return null;const q=Number(product.daily?.[d])||0;quantity+=q;if(q>0)sellingDays++;}
 return {quantity,sellingDays};
}
function decision(product,updated,history,now=Date.now()){
 const stamp=Date.parse(updated),base={priority:0,confidence:'Yetersiz',label:'Karar verilemiyor',reason:'Güncel ve kapsamı bilinen satış verisi gerekiyor.',next:'Veriler birikene kadar ilanı koru; satışsızlıktan kaldırma kararı verme.'};
 if(product.salesAvailable===false||!Number.isFinite(stamp)||stamp>now||now-stamp>2*DAY)return base;
 let p=history?.products?.[String(product.id)];
 if(!p){const end=Math.floor(stamp/DAY)*DAY,start=Math.ceil((stamp-90*DAY)/DAY)*DAY;p={...product,coverage:[]};for(let t=start;t<end;t+=DAY)p.coverage.push(iso(t));}
 const end=Math.floor(stamp/DAY)*DAY,created=product.created*1000,age=Number.isFinite(created)&&created>0?Math.floor((end-created)/DAY):null;
 if(age===null||age<14)return {...base,label:'Deneme aşamasında',reason:'İlk değerlendirme için en az 14 tamamlanmış gün gerekiyor.'};
 const a=windowCount(p,end-14*DAY,end),b=windowCount(p,end-28*DAY,end-14*DAY),c=windowCount(p,end-42*DAY,end-28*DAY);
 if(!a)return {...base,reason:'Son 14 günün satış kapsamı eksik. Eksik günler sıfır sayılmadı.'};
 if(age>=42&&b&&c&&a.quantity+b.quantity+c.quantity>=12&&b.quantity+c.quantity>=10&&c.quantity-b.quantity>=2&&b.quantity-a.quantity>=3&&b.quantity<=c.quantity*.85&&a.quantity<=b.quantity*.7){
  return {...base,label:'Gerileme izleniyor',priority:4,confidence:'Sınırlı',windows:[c.quantity,b.quantity,a.quantity],reason:'Üç ayrık 14 günlük dönemde düşüş sürüyor. Trafik ve sezon etkisi bilinmiyor.',next:'Son değişiklikleri kontrol et. Bir değişkeni düzelt; sonucu otomatik izlemeye bırak.'};
 }
 if(a.quantity>=5&&a.sellingDays>=3)return {...base,label:'Satış sinyali var',priority:2,confidence:a.quantity>=15&&a.sellingDays>=6?'Orta':'Sınırlı',windows:b?[b.quantity,a.quantity]:[a.quantity],reason:`Son 14 tam günde ${a.quantity} adet, ${a.sellingDays} farklı günde satış görüldü. Kârlılık ve talebin büyüklüğü bilinmiyor.`,next:'İlanı koru. Bu ürün grubunda yalnızca küçük bir benzer ürün denemesi düşün.'};
 if(age<60)return {...base,label:'Deneme aşamasında',reason:`Son 14 tam günde ${a.quantity} adet satış var. Düzenli satış sinyali için örnek henüz küçük.`};
 return {...base,reason:`Son 14 tam günde ${a.quantity} adet satış var. Görüntülenme bilinmediği için görünürlük sorununu talep sorunundan ayıramıyoruz.`};
}
function autoAssessment(observation,history,manual=[],now=Date.now()){
 const base={id:observation.id,product:observation.product,label:'İzleme sürüyor',ready:false,reason:'Önceki ve sonraki 14 tam gün karşılaştırılacak.'};
 const observed=Date.parse(observation.observedAt),previous=Date.parse(observation.previousObservedAt),stamp=Date.parse(history?.salesCaptured);
 if(!Number.isFinite(observed)||!Number.isFinite(previous)||previous>observed)return {...base,label:'Gözlem aralığı geçersiz'};
 const beforeEnd=Math.floor(previous/DAY)*DAY,afterStart=(Math.floor(observed/DAY)+1)*DAY,afterEnd=afterStart+14*DAY;
 const due=iso(afterEnd);base.due=due;
 if(observed-previous>2*DAY)return {...base,label:'Değişiklik zamanı belirsiz',reason:'İki gözlem arasında iki günden fazla var; karşılaştırma bir düzenlemeye bağlanmadı.'};
 if(!Number.isFinite(stamp)||stamp>now||now-stamp>2*DAY)return {...base,label:'Güncel satış verisi gerekiyor'};
 if(Math.floor(stamp/DAY)*DAY<afterEnd)return {...base,reason:`Sonuç için ${due} tarihine kadar 14 tam gün ve güncel satış kaydı gerekiyor.`};
 const p=history.products?.[String(observation.product)];
 const from=beforeEnd-14*DAY;
 if(!p||!p.created||p.created*1000>from)return {...base,label:'Önceki ilan geçmişi yetersiz',reason:'İlanın değişiklik öncesinde 14 tam gün yayında olduğu doğrulanamadı.'};
 const before=windowCount(p,from,beforeEnd),after=windowCount(p,afterStart,afterEnd);
 if(!before||!after)return {...base,label:'Geçmişte boşluk var',reason:'Karşılaştırma dönemlerinde eksik gün var; sıfır olarak tamamlanmadı.'};
 const overlaps=o=>Date.parse(o.previousObservedAt)<afterEnd&&Date.parse(o.observedAt)>=from;
 const manualOverlap=c=>Date.parse(c.date+'T00:00:00Z')>=from&&Date.parse(c.date+'T00:00:00Z')<afterEnd;
 const other=(history.observations||[]).filter(o=>o.id!==observation.id&&overlaps(o));
 const concurrent=other.filter(o=>String(o.product)===String(p.id)).length+manual.filter(c=>String(c.product)===String(p.id)&&manualOverlap(c)).length;
 const measured={...base,ready:true,before:before.quantity,after:after.quantity,concurrent};
 if(concurrent)return {...measured,label:'Birden çok değişiklik',reason:'Bu ürünün dönemi başka değişikliklerle çakışıyor; tek düzenlemenin sonucu ayrılamadı.'};
 const controls=Object.values(history.products).filter(x=>String(x.id)!==String(p.id)&&x.active&&x.created*1000<=from&&!other.some(o=>String(o.product)===String(x.id))&&!manual.some(c=>String(c.product)===String(x.id)&&manualOverlap(c))).map(x=>({before:windowCount(x,from,beforeEnd),after:windowCount(x,afterStart,afterEnd)})).filter(x=>x.before&&x.after);
 const controlBefore=controls.reduce((s,x)=>s+x.before.quantity,0),controlAfter=controls.reduce((s,x)=>s+x.after.quantity,0);
 const result={...measured,controls:controls.length,controlBefore,controlAfter};
 if(before.quantity<3||before.quantity+after.quantity<10||controls.length<3||controlBefore<10||controlAfter<10)return {...result,label:'Satış örneği yetersiz',reason:'Dönemler tamamlandı; anlamlı yorum için başlangıç satışı, daha büyük örnek ve en az üç karşılaştırılabilir ürün gerekiyor.'};
 const productPercent=(after.quantity/before.quantity-1)*100,controlPercent=(controlAfter/controlBefore-1)*100,difference=productPercent-controlPercent;
 return {...result,productPercent,controlPercent,difference,label:difference>15?'Mağazadan daha güçlü hareket':difference< -15?'Mağazadan daha zayıf hareket':'Mağazayla benzer hareket',reason:'Betimsel karşılaştırma. Birden çok alan aynı anda değiştiyse alanları ayıramaz; reklam, trafik ve sezon bilinmediği için nedensellik kanıtlanmaz.'};
}
function marketEvidence(snapshot,history=[]){
 const listings=snapshot?.listings||[],digital=listings.filter(l=>l.type==='download'),stl=digital.filter(l=>/\bstl\b/i.test(l.title)),shops=new Map(),prices={};
 for(const l of stl){if(l.shopId)shops.set(l.shopId,(shops.get(l.shopId)||0)+1);if(Number.isFinite(l.price)&&l.price>0&&l.currency)(prices[l.currency]??=[]).push(l.price);}
 const known=[...shops.values()].reduce((s,n)=>s+n,0),concentration=known?Math.max(...shops.values())/known:null;
 const medians=Object.entries(prices).map(([currency,values])=>{values.sort((a,b)=>a-b);return {currency,count:values.length,min:values[0],max:values.at(-1),median:(values[Math.floor((values.length-1)/2)]+values[Math.floor(values.length/2)])/2};});
 const label=!listings.length?'Örneklem yok':stl.length<10?'STL örneği yetersiz':known<stl.length*.8?'Mağaza bilgisi eksik':shops.size<3||concentration>.6?'Örneklem yoğunlaşmış':'Araştırmaya uygun örneklem';
 return {sampled:listings.length,digital:digital.length,stl:stl.length,shops:shops.size,unknownShops:stl.length-known,concentration,medians,label,observations:history.length,reason:'Başlığında STL geçen dijital ilanlar. Dosya içeriği doğrulanmadı. Yeni ilanlara göre sıralanan en fazla 100 sonuç; talep veya düşük rekabet kanıtı değildir.'};
}
function adjacentQueries(products){
 const grouping=typeof module!=='undefined'?require('./score').automaticGroup:root.automaticGroup;
 const groups=new Set(products.map(p=>grouping(p)));
 const mapping={'Dini modeller':['religious wall relief stl','nativity ornament stl'],'Dans ve balerin':['ballet wall art stl','dancer bust stl'],'Heykel ve figür':['sculpture bookend stl','wall relief sculpture stl'],'Büst ve portre':['portrait wall relief stl'],'Hayvan modelleri':['animal bookend stl','animal wall relief stl'],'Vazo ve dekor':['textured vase stl'],'Düzenleyici ve aparatlar':['modular desk organizer stl']};
 return [...new Set([...groups].flatMap(g=>mapping[g]||[]))].slice(0,4);
}
function launchReview(product,history,now=Date.now()){
 const p=history?.products?.[String(product.id)];if(!p?.created)return {ready:false,reason:'İlk yayın tarihi bilinmiyor.'};
 const start=Math.ceil(p.created*1000/DAY)*DAY,end=Math.floor(Date.parse(history.salesCaptured)/DAY)*DAY,age=Math.floor((end-start)/DAY);
 const milestone=[90,60,30,14].find(d=>age>=d);
 if(!milestone)return {ready:false,reason:'İlk 14 tam gün bekleniyor.'};
 if(now-Date.parse(history.salesCaptured)>2*DAY)return {ready:false,reason:'Önce satışları güncelle.'};
 const measured=windowCount(p,start,start+milestone*DAY);if(!measured)return {ready:false,reason:'İlk yayın döneminin tamamı geçmişte yok. Eski ürünlere ilk dönem sonucu uydurulmadı.'};
 return {ready:true,days:milestone,...measured,label:measured.quantity>=5&&measured.sellingDays>=3?'Tekrarlanan satış sinyali':'Karar için sınırlı satış',reason:'İlk yayın sonrası tam günler; görünürlük ve kâr ölçülmedi.'};
}
function topicSuggestion(text){
 const t=String(text||'').toLowerCase();const hits=[['edit',/custom|customiz|modify|modification|resize|change the|özel|değiştir|boyut/],['download',/download|zip|where.*file|cannot.*open|can't.*open|indir|dosya.*aç/],['digital',/physical|ship|shipping|delivery|deliver|fiziksel|kargo/],['print',/printer|print settings|resin|filament|support|baskı|yazıcı/]].filter(([,re])=>re.test(t));
 return hits.length===1?{topic:hits[0][0],label:'Anahtar kelimelere göre konu önerisi; mesajın tamamını anlamaz.'}:{topic:null,label:hits.length?'Birden fazla konu var. Yanıtı kendin seç veya ChatGPT metnini kullan.':'Konu güvenle seçilemedi. Şablon seç veya ChatGPT metnini kullan.'};
}
const api={windowCount,decision,autoAssessment,marketEvidence,adjacentQueries,launchReview,topicSuggestion};
if(typeof module!=='undefined')module.exports=api;else root.STLInsights=api;
})(globalThis);
