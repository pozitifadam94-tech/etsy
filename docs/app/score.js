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
if(typeof module!=='undefined')module.exports={evaluate,performance};else {root.evaluate=evaluate;root.performance=performance;}
})(globalThis);
