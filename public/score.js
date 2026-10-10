(function(root){
function evaluate(niche,listings){
 const rows=listings.filter(x=>x.niche===niche.id);
 const observed=rows.filter(x=>x.reviews!==null&&x.reviews!==undefined);
 const reviews=observed.reduce((s,x)=>s+Number(x.reviews),0);
 const sellers=new Set(rows.map(x=>x.shop.trim().toLowerCase()).filter(Boolean)).size;
 const prices=rows.map(x=>Number(x.price)).filter(x=>Number.isFinite(x)&&x>0).sort((a,b)=>a-b);
 const median=prices.length?(prices[Math.floor((prices.length-1)/2)]+prices[Math.floor(prices.length/2)])/2:null;
 const complete=niche.competition!==null&&observed.length>=3&&sellers>=2;
 const demand=Math.min(100,Math.log1p(reviews/Math.max(1,observed.length))/Math.log(21)*100);
 const competition=niche.competition===null?null:Math.min(100,Math.log1p(niche.competition)/Math.log(10001)*100);
 return {rows:rows.length,reviews,sellers,median,score:complete?Math.round(demand*.65+(100-competition)*.35):null,confidence:complete?(observed.length>=10&&sellers>=5?'Orta':'Düşük'):'Yetersiz',observed:observed.length};
}
function performance(records){
 const rows=[...records].sort((a,b)=>Number(b.period)-Number(a.period));
 const r=rows[0];
 if(!r)return {score:null,label:'Veri bekleniyor',reason:'Tamamlanan ilk 30 günlük dönemi kaydet.'};
 const conversion=r.views?100*r.orders/r.views:0;
 const net=r.cost==null?null:r.revenue-r.cost;
 const prior=rows.find(x=>Number(x.period)<Number(r.period));
 const inconsistent=prior&&['views','orders','revenue'].some(k=>r[k]<prior[k]);
 if(inconsistent)return {score:null,label:'Veriyi kontrol et',reason:'Birikimli dönem değerleri önceki dönemden düşük. Dönem kapsamını düzelt.'};
 if(r.views<100)return {score:null,label:'Görünürlüğü artır',reason:'100 görüntülenmeden az: talep hakkında karar vermek için örnek küçük. Başlık, ana görsel ve ilgili aramaları incele.'};
 const score=Math.round(Math.min(100,conversion/3*100));
 let label='İyileştir',reason='Görüntüleniyor fakat sipariş dönüşümü sınırlı. Bir seferde ana görsel, açıklama veya fiyat gibi tek bir değişkeni dene.';
 if(net!==null&&net<0){label='Maliyetleri incele';reason='Girilen giderler geliri aşıyor. Ücret ve indirimleri kontrol et; satış olması kâr olduğu anlamına gelmez.';}
 else if(r.orders>=3&&conversion>=2){label='Devam et';reason='En az 3 sipariş ve %2 dönüşüm görüldü. Benzer ürünleri küçük denemelerle test et; gider bilinmiyorsa kârlılık henüz bilinmiyor.';}
 else if(Number(r.period)>=90&&r.views>=300&&r.orders===0){label='Duraklatmayı değerlendir';reason='İlk 90 günde en az 300 görüntülenme ve sıfır sipariş var. İlanı düzeltip yeniden denemeyi veya duraklatmayı değerlendir; otomatik kaldırma yapılmaz.';}
 const stale=Date.now()-Date.parse(r.date)>30*86400000;
 if(stale){label='Veriyi güncelle';reason='Son gözlem 30 günden eski. Güncel veri olmadan bu öneriyi uygulama.';}
 return {score:stale?null:score,label,reason,conversion,net,period:r.period,views:r.views,orders:r.orders,increment:prior?{days:r.period-prior.period,views:r.views-prior.views,orders:r.orders-prior.orders}:null};
}
function salesTrend(product,updated,now=Date.now()){
 const recent=product.periods?.find(p=>p.days===30),total=product.periods?.find(p=>p.days===60);
 if(product.salesAvailable===false||!recent||!total)return {label:'Veri bekleniyor',reason:'Satış senkronizasyonu henüz tamamlanmadı.',priority:0};
 if(!updated||now-Date.parse(updated)>2*86400000)return {label:'Güncelle',reason:'Satış kaydı eski; önce senkronizasyonu yenile.',priority:5};
 if(product.age===null||product.age<60)return {label:'Yeni / süre yetersiz',reason:'İki tam 30 günlük dönemi karşılaştırmak için ilan en az 60 günlük olmalı.',priority:1,current:recent.quantity};
 const current=recent.quantity,previous=total.quantity-current;
 if(previous<0)return {label:'Veriyi kontrol et',reason:'60 günlük toplam 30 günlük toplamdan düşük.',priority:5};
 const delta=current-previous;
 if(current+previous<3)return {label:'Örnek küçük',reason:'İki dönemde toplam 3 adetten az satış var. Görünürlük ve sunumu incele; kaldırma kararı verme.',priority:current===0?3:1,current,previous,delta};
 const label=delta>0?'Satış artıyor':delta<0?'Satış azalıyor':'Satış aynı';
 return {label,current,previous,delta,percent:previous?Math.round(delta/previous*100):null,priority:delta<0?4:2,reason:delta<0?'Ana görsel, başlık veya fiyatı incele. Tek değişkeni değiştirip sonucu izle.':delta>0?'Mevcut ilanı izle; benzer ürün fikrini küçük bir denemeyle test et.':'Mevcut sunumu izle; yeni bir değişiklik için somut gerekçe ara.'};
}
function changeComparison(product,date,now=Date.now()){
 const at=Date.parse(date+'T00:00:00Z'),day=86400000;
 if(!Number.isFinite(at)||!product.daily)return {reason:'Bu kayıt için günlük satış verisi henüz yok.'};
 if(now<at+14*day)return {reason:'Sonrası karşılaştırması için değişiklikten sonra 14 tam gün bekle.'};
 if(at-14*day<now-90*day)return {reason:'Önceki dönem 90 günlük veri kapsamı dışında.'};
 if(!product.created||product.created*1000>at-14*day)return {reason:'Değişiklik öncesinde 14 tam günlük ilan geçmişi yok.'};
 const count=(from,to)=>Object.entries(product.daily).reduce((s,[date,q])=>{const t=Date.parse(date+'T00:00:00Z');return s+(t>=from&&t<to?q:0);},0);
 return {before:count(at-14*day,at),after:count(at,at+14*day),reason:'Önceki ve sonraki 14 tam gün. Değişiklik günü sonrası döneme dahildir. Satış farkı değişikliğin etkisini kanıtlamaz.'};
}
function weeklySummary(products,updated,now=Date.now()){
 if(!updated||!Number.isFinite(Date.parse(updated))||now-Date.parse(updated)>2*86400000)return {ready:false,reason:'Haftalık özet için güncel satış senkronizasyonu gerekiyor.',rows:[]};
 const day=86400000,end=Math.floor(Date.parse(updated)/day)*day;
 const rows=products.map(p=>{
  if(p.salesAvailable===false||!p.daily||p.age===null||p.age<14)return {id:p.id,title:p.title,ready:false,label:'Veri / süre yetersiz'};
  const count=(from,to)=>Object.entries(p.daily).reduce((s,[date,q])=>{const stamp=Date.parse(date+'T00:00:00Z');return s+(stamp>=from&&stamp<to?Number(q):0);},0);
  const current=count(end-7*day,end),previous=count(end-14*day,end-7*day),older=count(end-90*day,end-7*day);
  return {id:p.id,title:p.title,ready:true,current,previous,delta:current-previous,firstObserved:current>0&&older===0,label:current+previous<3?'Örnek küçük':current>previous?'Artıyor':current<previous?'Azalıyor':'Aynı'};
 });
 return {ready:true,from:new Date(end-7*day).toISOString().slice(0,10),to:new Date(end-day).toISOString().slice(0,10),rows,current:rows.filter(r=>r.ready).reduce((s,r)=>s+r.current,0),previous:rows.filter(r=>r.ready).reduce((s,r)=>s+r.previous,0)};
}
function familySummary(products,assignments={}){
 const groups=new Map();
 for(const p of products){const name=assignments[String(p.id)]||'Sınıflandırılmadı';if(!groups.has(name))groups.set(name,{name,products:0,known:0,quantity:0,selling:0,money:{}});const g=groups.get(name);g.products++;const r=p.periods?.find(r=>r.days===90);if(p.salesAvailable===false||!r)continue;g.known++;g.quantity+=r.quantity;if(r.quantity>0)g.selling++;if(r.currency&&r.revenue!==null)g.money[r.currency]=(g.money[r.currency]||0)+r.revenue;}
 return [...groups.values()].map(g=>({...g,perProduct:g.known?g.quantity/g.known:null})).sort((a,b)=>b.quantity-a.quantity);
}
function supportSummary(products,events,now=Date.now()){
 const format=t=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Istanbul'}).format(new Date(t));const cutoff=format(now-29*86400000),end=format(now);
 const ids=new Set([...products.map(p=>String(p.id)),...events.map(e=>e.product)]);
 return [...ids].map(id=>{const p=products.find(p=>String(p.id)===id),all=events.filter(e=>e.product===id),recent=all.filter(e=>e.date>=cutoff&&e.date<=end);const sales=p?.periods?.find(r=>r.days===30);const quantity=p?.salesAvailable===false?null:sales?.quantity??null;const minutes=recent.reduce((s,e)=>s+e.minutes,0);return {id,title:p?.title||all[0]?.title||'İlan #'+id,events:recent.length,open:all.filter(e=>!e.resolved).length,minutes,quantity,perUnit:recent.length&&quantity>=3?minutes/quantity:null};}).filter(r=>r.events||r.open).sort((a,b)=>b.open-a.open||b.minutes-a.minutes);
}
if(typeof module!=='undefined')module.exports={evaluate,performance,salesTrend,changeComparison,weeklySummary,familySummary,supportSummary};else {root.evaluate=evaluate;root.performance=performance;root.salesTrend=salesTrend;root.changeComparison=changeComparison;root.weeklySummary=weeklySummary;root.familySummary=familySummary;root.supportSummary=supportSummary;}
})(globalThis);
