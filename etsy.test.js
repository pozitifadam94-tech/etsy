const {test}=require('node:test');
const assert=require('node:assert/strict');
const {summarize}=require('./etsy');
const now=Date.now(),stamp=Math.floor(now/1000);
const listing={listing_id:1,title:'Model',creation_timestamp:stamp-86400*40};
const transaction={listing_id:1,quantity:2,price:{amount:500,divisor:100,currency_code:'USD'}};
test('Ödenmemiş, iptal edilen ve diğer ürün satışları sayılmaz',()=>{const rows=[{is_paid:true,create_timestamp:stamp,transactions:[transaction]},{is_paid:false,create_timestamp:stamp,transactions:[transaction]},{is_paid:true,is_canceled:true,create_timestamp:stamp,transactions:[transaction]},{is_paid:true,create_timestamp:stamp,transactions:[{...transaction,listing_id:2}]}];const r=summarize([listing],rows,now)[0];assert.equal(r.periods[0].orders,1);assert.equal(r.periods[0].quantity,2);assert.equal(r.periods[0].revenue,10);});
test('Dönemler ayrı tutulur ve karışık para birimleri toplanmaz',()=>{const rows=[{is_paid:true,create_timestamp:stamp-86400*35,transactions:[transaction]},{is_paid:true,create_timestamp:stamp,transactions:[{...transaction,price:{amount:500,divisor:100,currency_code:'EUR'}}]}];const r=summarize([listing],rows,now)[0];assert.equal(r.periods[0].orders,1);assert.equal(r.periods[1].orders,2);assert.equal(r.periods[1].revenue,null);});
const {loadActive}=require('./etsy');
test('Yetkili mağaza ilanları endpointi kullanılır',async()=>{let route;const r=await loadActive(123,async path=>{route=path;return [listing];});assert.match(route,/\/shops\/123\/listings\?state=active/);assert.equal(r.listings.length,1);});
test('Boş birinci yanıt alternatif endpoint ile kontrol edilir',async()=>{let calls=0;const r=await loadActive(123,async()=>++calls===1?[]:[listing]);assert.equal(calls,2);assert.equal(r.listings.length,1);});
test('Mağazada aktif ilan varken boş yanıt başarılı sayılmaz',async()=>{await assert.rejects(()=>loadActive(123,async()=>[],async()=>({listing_active_count:5})),/5 aktif ilan/);});
const {bundleAnalysis}=require('./etsy');
test('Paket çiftleri aynı siparişte tekrar sayılmaz; iptal/ödenmemiş siparişler dışarıda',()=>{const listings=[{listing_id:1},{listing_id:2}];const receipt={is_paid:true,transactions:[{listing_id:1,quantity:1},{listing_id:1,quantity:1},{listing_id:2,quantity:3}]};const r=bundleAnalysis(listings,[receipt,{...receipt,is_paid:false},{...receipt,is_canceled:true}]);assert.equal(r.baskets,1);assert.equal(r.pairs[0].count,1);assert.equal(r.pairs[0].label,'Veri yetersiz');});
test('Üç farklı ortak sipariş adaydır; aktif olmayan ürünler paket önerisine girmez',()=>{const receipt={is_paid:true,transactions:[{listing_id:1,quantity:1},{listing_id:2,quantity:1},{listing_id:3,quantity:1}]};const r=bundleAnalysis([{listing_id:1},{listing_id:2}],[receipt,receipt,receipt]);assert.equal(r.pairs.length,1);assert.equal(r.pairs[0].count,3);assert.equal(r.pairs[0].label,'Paket araştırmasına aday');});
test('Benzersiz sipariş, işlem satırı ve adet ayrıdır; yinelenen kimlikler tekrar sayılmaz',()=>{
 const rows=[{receipt_id:11,is_paid:true,create_timestamp:stamp,transactions:[{...transaction,transaction_id:21},{...transaction,transaction_id:22,quantity:3}]},{receipt_id:11,is_paid:true,create_timestamp:stamp,transactions:[{...transaction,transaction_id:21},{...transaction,transaction_id:21},{...transaction,transaction_id:22,quantity:3}]}];
 const r=summarize([listing],rows,now)[0];assert.equal(r.periods[0].orders,1);assert.equal(r.periods[0].transactionLines,2);assert.equal(r.periods[0].quantity,5);assert.equal(r.periods[0].revenueKind,'grossItemValue');
});
test('Sonradan iptal olan yinelenmiş siparişin en son kaydı satıştan çıkarılır',()=>{
 const old={receipt_id:11,is_paid:true,create_timestamp:stamp,transactions:[transaction]};assert.equal(summarize([listing],[old,{...old,is_canceled:true}],now)[0].periods[0].quantity,0);
});
test('Eksik fiyat bedeli sıfırmış gibi gösterilmez; Retry-After saniye ve tarih biçimi tanınır',()=>{
 const r=summarize([listing],[{is_paid:true,create_timestamp:stamp,transactions:[{...transaction,price:null}]}],now)[0];assert.equal(r.periods[0].revenue,null);assert.equal(r.moneyComplete,false);
 const {retryAfterMillis}=require('./etsy');assert.equal(retryAfterMillis('3',0),3000);assert.equal(retryAfterMillis('Thu, 01 Jan 1970 00:01:00 GMT',0),60000);assert.equal(retryAfterMillis('invalid',0),60000);
});
