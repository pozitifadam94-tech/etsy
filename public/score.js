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
function automaticGroup(product){
 const text=(String(product.title||'')+' '+(product.tags||[]).join(' ')).toLocaleLowerCase('en').normalize('NFKD').replace(/[\u0300-\u036f]/g,'');
 const rules=[['Dini modeller',/\b(jesus|christ|crucifix|crucified|madonna|saint|angel|religious|isa|melek)\b|virgin mary/],['Dans ve balerin',/\b(ballerina|ballet|dancer|dance|balerin)\b/],['Büst ve portre',/\b(bust|portrait|busts)\b/],['Düzenleyici ve aparatlar',/\b(organizer|organiser|holder|bracket|adapter|stand)\b/],['Saksı ve bahçe',/\b(planter|plant|garden|pot)\b/],['Vazo ve dekor',/\b(vase|vazo|vases)\b/],['Aydınlatma',/\b(lamp|lantern|lampshade|light)\b/],['Minyatür ve oyun',/\b(miniature|tabletop|terrain|miniatures|dnd)\b/],['Hayvan modelleri',/\b(cat|dog|lion|dragon|wolf|animal|bird|elephant)\b/],['Heykel ve figür',/\b(sculpture|statue|figurine|figure|heykel)\b/]];
 return rules.find(([,pattern])=>pattern.test(text))?.[0]||'Diğer modeller';
}
function suggestedMarketQueries(products){
 const queries={'Dini modeller':'religious sculpture stl','Dans ve balerin':'ballerina sculpture stl','Büst ve portre':'portrait bust stl','Düzenleyici ve aparatlar':'organizer stl','Saksı ve bahçe':'planter stl','Vazo ve dekor':'vase stl','Aydınlatma':'lamp stl','Minyatür ve oyun':'tabletop miniature stl','Hayvan modelleri':'animal sculpture stl','Heykel ve figür':'sculpture stl'};
 const sorted=[...products].sort((a,b)=>(b.salesAvailable===false?0:b.periods?.find(p=>p.days===90)?.quantity||0)-(a.salesAvailable===false?0:a.periods?.find(p=>p.days===90)?.quantity||0));
 return [...new Set(sorted.map(p=>queries[automaticGroup(p)]).filter(Boolean))].slice(0,3);
}
function dailySalesSeries(products,updated,days=14,now=Date.now()){
 const day=86400000,stamp=Date.parse(updated);
 if(!Number.isInteger(days)||days<1||days>90||!Number.isFinite(stamp)||stamp>now||now-stamp>2*day)return {ready:false,reason:'Grafik için güncel satış verisi gerekiyor.',series:[]};
 const known=products.filter(p=>p.salesAvailable!==false&&p.daily),end=Math.floor(stamp/day)*day;
 if(!known.length)return {ready:false,reason:'Günlük satış verisi olan aktif ürün yok.',series:[]};
 const series=Array.from({length:days},(_,i)=>{const date=new Date(end-(days-i)*day).toISOString().slice(0,10);return {date,quantity:known.reduce((sum,p)=>sum+(Number(p.daily[date])||0),0)};});
 return {ready:true,series,known:known.length,unknown:products.length-known.length,total:series.reduce((sum,p)=>sum+p.quantity,0)};
}
function familySummary(products,assignments={}){
 const groups=new Map();
 for(const p of products){const name=assignments[String(p.id)]||automaticGroup(p);if(!groups.has(name))groups.set(name,{name,products:0,known:0,quantity:0,selling:0,money:{}});const g=groups.get(name);g.products++;const r=p.periods?.find(r=>r.days===90);if(p.salesAvailable===false||!r)continue;g.known++;g.quantity+=r.quantity;if(r.quantity>0)g.selling++;if(r.currency&&r.revenue!==null)g.money[r.currency]=(g.money[r.currency]||0)+r.revenue;}
 return [...groups.values()].map(g=>({...g,perProduct:g.known?g.quantity/g.known:null})).sort((a,b)=>b.quantity-a.quantity);
}
function supportSummary(products,events,now=Date.now()){
 const format=t=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Istanbul'}).format(new Date(t));const cutoff=format(now-29*86400000),end=format(now);
 const ids=new Set([...products.map(p=>String(p.id)),...events.map(e=>e.product)]);
 return [...ids].map(id=>{const p=products.find(p=>String(p.id)===id),all=events.filter(e=>e.product===id),recent=all.filter(e=>e.date>=cutoff&&e.date<=end);const sales=p?.periods?.find(r=>r.days===30);const quantity=p?.salesAvailable===false?null:sales?.quantity??null;const minutes=recent.reduce((s,e)=>s+e.minutes,0);return {id,title:p?.title||all[0]?.title||'İlan #'+id,events:recent.length,open:all.filter(e=>!e.resolved).length,minutes,quantity,perUnit:recent.length&&quantity>=3?minutes/quantity:null};}).filter(r=>r.events||r.open).sort((a,b)=>b.open-a.open||b.minutes-a.minutes);
}
function changeAssessment(product,products,change,changes,updated,now=Date.now()){
 const stamp=Date.parse(updated),day=86400000,at=Date.parse(change.date+'T00:00:00Z');
 if(!Number.isFinite(stamp)||now-stamp>2*day)return {label:'Önce güncelle',reason:'Güncel satış verisi gerekiyor.'};
 if(product.salesAvailable===false)return {label:'Veri bekleniyor',reason:'Ürünün satış verisi alınmamış.'};
 const target=changeComparison(product,change.date,Math.min(now,stamp));
 if(target.before===undefined)return {label:'Karşılaştırma bekliyor',reason:target.reason};
 const overlaps=c=>{const date=Date.parse(c.date+'T00:00:00Z');return date>=at-14*day&&date<at+14*day;};
 const concurrent=changes.filter(c=>c.id!==change.id&&String(c.product)===String(product.id)&&overlaps(c)).length;
 const controls=products.filter(p=>String(p.id)!==String(product.id)&&p.salesAvailable!==false&&!changes.some(c=>String(c.product)===String(p.id)&&overlaps(c))).map(p=>changeComparison(p,change.date,Math.min(now,stamp))).filter(r=>r.before!==undefined);
 const before=controls.reduce((s,r)=>s+r.before,0),after=controls.reduce((s,r)=>s+r.after,0);
 const base={before:target.before,after:target.after,controlBefore:before,controlAfter:after,controls:controls.length,concurrent};
 if(concurrent)return {...base,label:'Birden çok değişiklik',reason:'Aynı ürünün karşılaştırma döneminde başka değişiklik kaydı var. Etkileri ayrı değerlendiremeyiz.'};
 if(controls.length<3)return {...base,label:'Karşılaştırma grubu küçük',reason:'En az 3 uygun diğer aktif ürün gerekiyor. Dönemde değişiklik kaydı olan veya tam geçmişi olmayan ürünler dışarıda.'};
 if(target.before===0||target.before+target.after<3||before<5||after<5)return {...base,label:'Satış örneği yetersiz',reason:'Üründe başlangıç satışı ve toplam en az 3 adet; diğer ürünlerde her dönemde en az 5 adet gerekiyor. Bu eşikler istatistiksel güven garantisi değildir.'};
 const productPercent=(target.after/target.before-1)*100,controlPercent=(after/before-1)*100,difference=productPercent-controlPercent;
 return {...base,productPercent,controlPercent,difference,label:difference>5?'Diğer ürünlerden daha iyi hareket':difference< -5?'Diğer ürünlerden daha zayıf hareket':'Diğer ürünlerle benzer hareket',reason:'Yüzde değişimleri arasındaki betimsel fark. Sonuç değişikliğin satışa neden olduğunu kanıtlamaz; sezon, reklam, fiyat ve başka etkiler ayrıştırılmadı.'};
}
function listingChecks(product){
 const checks=[];const add=(id,status,title,detail)=>checks.push({id,status,title,detail});
 add('title',typeof product.title!=='string'?'unknown':product.title.trim()?'ok':'missing','Başlık',typeof product.title==='string'&&product.title.trim()?'Başlık mevcut; anlaşılır ve ürüne uygun olduğunu ayrıca kontrol et.':'Başlık bilgisi eksik veya boş.');
 add('description',product.description==null?'unknown':product.description.trim()?'ok':'missing','Açıklama',product.description==null?'API bilgisi alınmadı. Yeni sürümle senkronize et.':product.description.trim()?'Açıklama mevcut; teknik doğruluğu otomatik doğrulanmaz.':'Açıklama boş.');
 add('images',product.imageCount==null?'unknown':product.imageCount===0?'missing':product.imageCount<2?'review':'ok','Ürün görselleri',product.imageCount==null?'Görsel sayısı alınmadı.':product.imageCount===0?'Görsel bulunmuyor.':product.imageCount===1?'Bir görsel var. Farklı açı ve dijital dosya bilgisi eklemeyi değerlendir.':product.imageCount+' görsel var; kalite ve ölçü doğruluğu ayrıca incelenmeli.');
 add('tags',product.tags==null?'unknown':product.tags.length===0?'missing':product.tags.length<13?'review':'ok','Etiketler',product.tags==null?'Etiket bilgisi alınmadı.':product.tags.length===0?'Etiket yok.':product.tags.length<13?product.tags.length+' etiket var; ilgili başka arama ifadeleri varsa kalan alanları değerlendir. 13 etiket zorunluluğu varsayılmaz.':product.tags.length+' etiket var; uygunluk ve arama talebi doğrulanmış değildir.');
 add('type',product.listingType==null?'unknown':product.listingType==='download'?'ok':'review','Dijital ilan türü',product.listingType==null?'İlan türü alınmadı.':product.listingType==='download'?'Etsy ilan türü dijital indirme.':'Etsy ilan türü: '+product.listingType+'. STL dosyası satıyorsan türü kontrol et.');
 const text=product.description;
 add('format',text==null?'unknown':/\bstl\b/i.test(text)?'ok':'review','Dosya formatı',text==null?'Açıklama alınmadı.':/\bstl\b/i.test(text)?'Açıklamada STL ifadesi var. Dosyanın kendisi kontrol edilmedi.':'Açıklamada STL ifadesi bulunamadı; teslim edilen formatı açık yaz.');
 add('digital',text==null?'unknown':/digital|dijital|download|indir/i.test(text)?'ok':'review','Dijital teslim açıklaması',text==null?'Açıklama alınmadı.':/digital|dijital|download|indir/i.test(text)?'Dijital/indirme ifadesi var; fiziksel ürün gönderilmediğini açıkça belirtmeyi kontrol et.':'Dijital teslimi açıklayan ifade bulunamadı; fiziksel ürünle karışmayı önlemek için belirt.');
 return {checks,missing:checks.filter(c=>c.status==='missing').length,review:checks.filter(c=>c.status==='review').length,unknown:checks.filter(c=>c.status==='unknown').length,fingerprint:JSON.stringify([product.title,product.description,product.tags,product.imageCount,product.listingType,product.imageIds,product.image])};
}
function financeSummary(products,ledger,from,to){
 const totals=new Map();const get=currency=>{if(!totals.has(currency))totals.set(currency,{currency,automatic:0,income:0,expense:0,refund:0});return totals.get(currency);};let unknown=0;
 for(const p of products){if(p.salesAvailable===false||!p.dailyMoney||p.moneyComplete===false){unknown++;continue;}for(const [date,money]of Object.entries(p.dailyMoney)){if(date<from||date>to)continue;for(const [currency,amount]of Object.entries(money))get(currency).automatic+=amount;}}
 for(const row of ledger){if(row.date<from||row.date>to)continue;get(row.currency)[row.kind]+=row.amount;}
 return {unknown,rows:[...totals.values()].map(t=>({...t,balance:t.automatic+t.income-t.expense-t.refund})).sort((a,b)=>a.currency.localeCompare(b.currency))};
}
function sharingComparison(product,share,updated,now=Date.now()){
 if(share.status!=='shared')return {label:'Paylaşım planlandı',reason:'Paylaştığında durumu Paylaşıldı olarak değiştir. Platforma otomatik gönderim yapılmaz.'};
 const stamp=Date.parse(updated),day=86400000,at=Date.parse(share.date+'T00:00:00Z');
 if(!product||product.salesAvailable===false||!Number.isFinite(stamp)||now-stamp>2*day)return {label:'Satış verisi gerekiyor',reason:'Güncel aktif ürün verisiyle senkronize et. Trafik verisi ayrıca manuel girilir.'};
 if(!product.daily)return {label:'Günlük veri bekleniyor',reason:'Günlük satış verisi henüz alınmadı.'};
 const reference=Math.min(now,stamp);
 if(reference<at+7*day)return {label:'İlk 7 gün tamamlanmadı',reason:'Paylaşım sonrası 7 tam UTC gününün satış verisi bekleniyor.'};
 if(at-7*day<reference-90*day)return {label:'Geçmiş veri kapsamı dışında',reason:'Önceki dönem 90 günlük API kapsamına sığmıyor.'};
 if(!product.created||product.created*1000>at-7*day)return {label:'Önceki dönem yetersiz',reason:'Ürün paylaşım öncesindeki 7 tam gün boyunca yayında değildi.'};
 const count=(from,to)=>Object.entries(product.daily).reduce((sum,[date,qty])=>{const t=Date.parse(date+'T00:00:00Z');return sum+(t>=from&&t<to?Number(qty):0);},0);
 return {label:'Satış dönemleri hazır',before:count(at-7*day,at),after:count(at,at+7*day),reason:'Paylaşım öncesi/sonrası 7 tam UTC günündeki toplam adetler. Satışların bu paylaşımdan geldiği veya paylaşımın satışa neden olduğu bilinmiyor.'};
}
function marketPriceSummary(listings){
 const digital=listings.filter(l=>l.type==='download'),unknownType=listings.filter(l=>!l.type).length;
 const currencies={};for(const l of digital){if(l.price===null||!Number.isFinite(l.price)||!l.currency)continue;(currencies[l.currency]??=[]).push(l.price);}
 const medians=Object.entries(currencies).map(([currency,values])=>{values.sort((a,b)=>a-b);return {currency,count:values.length,median:(values[Math.floor((values.length-1)/2)]+values[Math.floor(values.length/2)])/2};});
 const reason=!listings.length?'Etsy bu gözlemde ilan döndürmedi.':!digital.length?(unknownType?'İlanlar alındı, fakat '+unknownType+' ilanın türü bilinmiyor ve dijital türünde doğrulanmış ilan yok. Fiyat medyanı hesaplanmadı.':'İlanlar alındı; örneklemde dijital indirme türünde ilan yok. Dijital fiyat medyanı hesaplanmadı.'):'Dijital ilanlar alındı, ancak geçerli fiyat ve para birimi bulunamadı. Fiyat medyanı hesaplanmadı.';
 return {digital:digital.length,unknownType,medians,reason};
}
function dailyBrief(snapshot,records={},now=Date.now()){
 const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Istanbul'}).format(new Date(now));
 const products=snapshot?.products||[],stamp=Date.parse(snapshot?.salesUpdated||snapshot?.updated);
 const fresh=Number.isFinite(stamp)&&now>=stamp&&now-stamp<=2*86400000;
 const tasks=[],support=records.support||[],shares=records.shares||[];
 const open=support.filter(e=>!e.resolved),due=open.filter(e=>e.due&&e.due<=date);
 for(const e of open.filter(e=>!e.due||e.due<=date))tasks.push({key:'support:'+e.id,kind:'support',id:e.id,product:e.product,title:e.title,priority:e.due?100:80,date:e.due||e.date,label:e.due?'Müşteri takibinin zamanı geldi':'Açık müşteri işi',reason:e.kind+(e.due?' · Takip: '+e.due:' · Takip tarihi belirlenmemiş'),target:'support'});
 const plans=shares.filter(r=>r.status==='planned'&&r.date<=date);
 for(const r of plans)tasks.push({key:'share:'+r.id,kind:'sharing',id:r.id,title:r.title,priority:90,date:r.date,label:'Paylaşım planı hazır',reason:r.channel+' · Planlanan tarih: '+r.date,target:'sharing'});
 for(const p of products){
  const id=String(p.id),trend=p.decision||salesTrend(p,snapshot?.salesUpdated||snapshot?.updated,now);
  const hidden=(records.actions||[]).some(a=>a.product===id&&a.until>now&&(a.kind==='snoozed'||a.label===trend.label));
  if(fresh&&trend.priority===4&&!hidden)tasks.push({key:'product:'+id,kind:'products',product:id,title:p.title,priority:trend.priority===4?70:40,label:trend.label,reason:trend.reason,target:'daily',review:true});
  if(p.age!==null&&p.age!==undefined&&p.age<30){const audit=listingChecks(p);const needsCheck=audit.missing>0||audit.checks.some(c=>['type','format','digital'].includes(c.id)&&c.status==='review');if(needsCheck&&records.inspections?.[id]?.fingerprint!==audit.fingerprint)tasks.push({key:'audit:'+id,kind:'products',product:id,title:p.title,priority:60,label:'Yeni ürünün içeriğini incele',reason:audit.unknown?'Bazı ilan bilgileri alınmadı; önce ürün verisini güncelle.':'Başlık, görseller ve dijital teslim açıklamasını kontrol et.',target:'listing-audit'});}
 }
 if(fresh){
  for(const c of records.changes||[]){const p=products.find(p=>String(p.id)===String(c.product));if(!p)continue;const result=changeAssessment(p,products,c,records.changes||[],snapshot?.salesUpdated||snapshot?.updated,now);if(result.before!==undefined)tasks.push({key:'change:'+c.id,kind:'results',product:String(p.id),title:p.title,priority:30,date:c.date,label:'Değişiklik dönemleri tamamlandı',reason:result.label+' · '+c.kind,target:'change-evaluations'});}
  for(const r of shares.filter(r=>r.status==='shared')){const p=products.find(p=>String(p.id)===r.product),result=sharingComparison(p,r,snapshot?.salesUpdated||snapshot?.updated,now);if(result.before!==undefined)tasks.push({key:'share-result:'+r.id,kind:'results',id:r.id,title:p.title,priority:20,date:r.date,label:'Paylaşım satış dönemleri hazır',reason:r.channel+' · Önce '+result.before+', sonra '+result.after+' adet; kaynak ilişkisi bilinmiyor.',target:'sharing'});}
 }
 tasks.sort((a,b)=>b.priority-a.priority||(a.date||date).localeCompare(b.date||date)||a.key.localeCompare(b.key));
 return {date,fresh,active:snapshot?products.length:null,open:open.length,due:due.length,plans:plans.length,review:new Set(tasks.filter(t=>t.kind==='products').map(t=>t.product)).size,tasks};
}
if(typeof module!=='undefined')module.exports={evaluate,performance,salesTrend,changeComparison,weeklySummary,familySummary,supportSummary,changeAssessment,listingChecks,financeSummary,sharingComparison,marketPriceSummary,dailyBrief,automaticGroup,suggestedMarketQueries,dailySalesSeries};else {root.evaluate=evaluate;root.performance=performance;root.salesTrend=salesTrend;root.changeComparison=changeComparison;root.weeklySummary=weeklySummary;root.familySummary=familySummary;root.supportSummary=supportSummary;root.changeAssessment=changeAssessment;root.listingChecks=listingChecks;root.financeSummary=financeSummary;root.sharingComparison=sharingComparison;root.marketPriceSummary=marketPriceSummary;root.dailyBrief=dailyBrief;root.automaticGroup=automaticGroup;root.suggestedMarketQueries=suggestedMarketQueries;root.dailySalesSeries=dailySalesSeries;}
})(globalThis);
