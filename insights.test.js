const test=require('node:test'),assert=require('node:assert/strict');
const {decision,autoAssessment,marketEvidence,launchReview,topicSuggestion}=require('./public/insights');
const DAY=86400000,now=Date.parse('2026-10-10T12:00:00Z'),updated=new Date(now).toISOString(),end=Math.floor(now/DAY)*DAY;
function product(id=1){const p={id,title:'Test',created:(end-150*DAY)/1000,daily:{},coverage:[],active:true};for(let t=end-100*DAY;t<end;t+=DAY){const date=new Date(t).toISOString().slice(0,10);p.coverage.push(date);p.daily[date]=0;}return p;}
function add(p,from,values){values.forEach((q,i)=>p.daily[new Date(from+i*DAY).toISOString().slice(0,10)]=q);return p;}
test('İki satıştan bire iniş güçlü düşüş önerisi üretmez; bilinmeyen gün sıfır sayılmaz',()=>{
 const p=product();add(p,end-14*DAY,[1]);assert.equal(decision(p,updated,{products:{1:p}},now).label,'Karar verilemiyor');
 p.coverage.pop();assert.match(decision(p,updated,{products:{1:p}},now).reason,/eksik/);
});
test('Kalıcı düşüş için üç dönem gerekir; düzenli satış sinyali en az üç farklı gün ister',()=>{
 const p=product();add(p,end-42*DAY,[8,7]);add(p,end-28*DAY,[5,4]);add(p,end-14*DAY,[1,1]);assert.equal(decision(p,updated,{products:{1:p}},now).label,'Gerileme izleniyor');
 const q=product(2);add(q,end-14*DAY,[10]);assert.equal(decision(q,updated,{products:{2:q}},now).label,'Karar verilemiyor');
 add(q,end-14*DAY,[2,2,2]);assert.equal(decision(q,updated,{products:{2:q}},now).label,'Satış sinyali var');
 assert.equal(decision(q,'2020-01-01',null,now).label,'Karar verilemiyor');
});
test('Otomatik değerlendirme gözlem gününü dışlar; genel mağaza hareketini ayrı gösterir',()=>{
 const observation={id:'o',product:'1',previousObservedAt:'2026-09-20T10:00:00Z',observedAt:'2026-09-20T10:30:00Z',fields:['price']};
 const p=product();add(p,Date.parse('2026-09-06'),Array(14).fill(1));add(p,Date.parse('2026-09-21'),Array(14).fill(2));p.daily['2026-09-20']=100;
 const products={1:p};for(let id=2;id<=4;id++){const x=product(id);add(x,Date.parse('2026-09-06'),Array(14).fill(1));add(x,Date.parse('2026-09-21'),Array(14).fill(2));products[id]=x;}
 const history={products,observations:[observation],salesCaptured:updated};const r=autoAssessment(observation,history,[],now);
 assert.equal(r.before,14);assert.equal(r.after,28);assert.equal(r.difference,0);assert.equal(r.label,'Mağazayla benzer hareket');
 const concurrent={...observation,id:'o2',observedAt:'2026-09-25',previousObservedAt:'2026-09-24'};history.observations.push(concurrent);assert.equal(autoAssessment(observation,history,[],now).label,'Birden çok değişiklik');
 history.observations.pop();p.coverage=p.coverage.filter(d=>d!=='2026-09-22');assert.equal(autoAssessment(observation,history,[],now).label,'Geçmişte boşluk var');
});
test('Uzun gözlem aralığı, küçük örnek ve bekleme ayrı durumlardır',()=>{
 const o={id:'o',product:'1',previousObservedAt:'2026-09-20T10:00:00Z',observedAt:'2026-09-20T10:30:00Z'};
 assert.equal(autoAssessment({...o,previousObservedAt:'2026-09-10'},null,[],now).label,'Değişiklik zamanı belirsiz');
 const history={salesCaptured:updated,products:{1:product()},observations:[o]};assert.equal(autoAssessment(o,history,[],now).label,'Satış örneği yetersiz');
 assert.equal(autoAssessment({...o,previousObservedAt:'2026-10-09',observedAt:'2026-10-09T01:00:00Z'},history,[],now).ready,false);
});
test('Pazar elemesi fiziksel/dijital ve STL uygunluğunu ayırır; para birimleri karışmaz',()=>{
 const listings=[{title:'STL figure',type:'physical',shopId:'1',price:10,currency:'USD'},{title:'pdf',type:'download',shopId:'2',price:5,currency:'USD'},...Array.from({length:12},(_,i)=>({title:'STL model',type:'download',shopId:String(i%4),price:i+1,currency:i%2?'USD':'EUR'}))];
 const r=marketEvidence({listings},[{},{}]);assert.equal(r.stl,12);assert.equal(r.shops,4);assert.equal(r.concentration,.25);assert.equal(r.medians.length,2);assert.equal(r.label,'Araştırmaya uygun örneklem');assert.equal(r.observations,2);
});
test('Yeni ilan ilk dönem ölçümü otomatik olur; eski ilanların eksik ilk dönemi uydurulmaz',()=>{
 const p=product();p.created=(end-32*DAY)/1000;add(p,end-30*DAY,[2,2,2]);const h={products:{1:p},salesCaptured:updated};assert.equal(launchReview(p,h,now).days,30);
 p.created=(end-300*DAY)/1000;assert.equal(launchReview(p,h,now).ready,false);
});
test('Konu önerisi belirsiz mesajı anlamış gibi davranmaz',()=>{
 assert.equal(topicSuggestion('Can you modify this model?').topic,'edit');assert.equal(topicSuggestion('Download and shipping?').topic,null);assert.equal(topicSuggestion('Hello there').topic,null);
});
