const {test}=require('node:test');
const assert=require('node:assert/strict');
const {listingObservations}=require('./observations');
const at='2026-10-10T12:00:00Z',oldAt='2026-10-09T12:00:00Z';
const product={id:1,title:'Jesus STL',description:'Digital STL',tags:['stl','jesus'],imageIds:['1','2'],listingType:'download',price:{amount:500,divisor:100,currency_code:'USD'}};
test('İlk gözlem, yeni görülen ilan ve eksik eski alan değişiklik sayılmaz',()=>{assert.deepEqual(listingObservations(null,[product],at),[]);assert.deepEqual(listingObservations({updated:oldAt,products:[]},[product],at),[]);assert.deepEqual(listingObservations({updated:oldAt,products:[{id:1}]},[product],at),[]);});
test('Satış/favori değişimi, etiket sırası ve eşdeğer fiyat düzenleme sayılmaz',()=>{const after={...product,tags:['jesus','stl'],favorites:99,periods:[{quantity:12}],price:{amount:50,divisor:10,currency_code:'USD'}};assert.deepEqual(listingObservations({updated:oldAt,products:[product]},[after],at),[]);});
test('Bilinen başlık/fiyat/görsel değişimi gözlem aralığıyla tek kayıtta korunur',()=>{const after={...product,title:'Updated Jesus STL',imageIds:['2','1'],price:{amount:500,divisor:100,currency_code:'EUR'}};const rows=listingObservations({updated:oldAt,products:[product]},[after],at);assert.equal(rows.length,1);assert.deepEqual(rows[0].fields,['title','images','price']);assert.equal(rows[0].previousObservedAt,oldAt);assert.equal(rows[0].observedAt,at);assert.deepEqual(listingObservations({updated:at,products:[after]},[after],'2026-10-10T13:00:00Z'),[]);});
