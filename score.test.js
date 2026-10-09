const {test}=require('node:test');
const assert=require('node:assert/strict');
const {evaluate}=require('./public/score.js');
test('Eksik veriden fırsat puanı üretilmez',()=>{assert.equal(evaluate({id:'n',competition:null},[]).score,null);});
test('Fiyat medyanı ve mağaza tekilleştirme doğru',()=>{const rows=[1,2,3,4].map((price,i)=>({niche:'n',price,shop:i%2?' Shop ':'shop',reviews:0}));const result=evaluate({id:'n',competition:10},rows);assert.equal(result.median,2.5);assert.equal(result.sellers,1);assert.equal(result.score,null);});
test('Aynı talepte daha düşük rekabet daha yüksek puan alır',()=>{const rows=[1,2,3].map(i=>({niche:'n',price:5,shop:'shop'+i,reviews:10}));assert.ok(evaluate({id:'n',competition:20},rows).score>evaluate({id:'n',competition:2000},rows).score);});
test('Bilinmeyen yorum sıfır olarak sayılmaz',()=>{const rows=[1,2,3].map(i=>({niche:'n',price:5,shop:'shop'+i,reviews:null}));assert.equal(evaluate({id:'n',competition:20},rows).score,null);});
