const test=require('node:test'),assert=require('node:assert/strict'),I=require('./public/insights-import');
const opts={acquiredAt:'2026-10-12T12:00:00Z'};
test('Bilinmeyen, gerçek sıfır, eşik ve yuvarlanmış sayı aynı ölçü değildir',()=>{
 for(const raw of ['',null,undefined,'—','N/A','bilinmiyor','veri yok']){const m=I.parseMetric(raw);assert.equal(m.state,'missing');assert.equal(m.value,null);}
 assert.deepEqual(I.parseMetric('0'),{state:'exact',value:0,raw:'0',bound:null});
 assert.deepEqual(I.parseMetric('<10'),{state:'threshold',value:null,raw:'<10',bound:10});
 assert.equal(I.parseMetric('10’dan az').state,'threshold');
 for(const raw of ['12K','1.2k','12 bin','~100','12,3','1.234,567','-1','1e3','99999999999999999']){assert.equal(I.parseMetric(raw).state,'ambiguous',raw);assert.equal(I.parseMetric(raw).value,null);}
 for(const raw of ['1,234','1.234','1 234','1\u202f234'])assert.equal(I.parseMetric(raw).value,1234);
 assert.equal(I.parseMetric('12,345,678').value,12345678);
});
test('Başlıklı TSV Türkçe alanları ve ayrı dönemleri kaybetmeden önizler',()=>{
 const text='Anahtar kelime\tArama sayısı\tİlan sayısı\tDönem\tBölge\tDil\nballerina stl\t1.234\t56\tLast 30 days\t\tEnglish\njesus stl\t0\t<10\t2026-09-01 to 2026-09-30\tTürkiye\t';
 const p=I.preview(text,opts);assert.equal(p.errors.length,0);assert.equal(p.rows.length,2);assert(p.needsReview);
 const a=p.rows[0],b=p.rows[1];assert.equal(a.searches.value,1234);assert.equal(a.region,null);assert.equal(a.period.label,'Last 30 days');assert.equal(a.period.start,null);
 assert.match(a.raw,/Anahtar kelime\tArama sayısı/);assert.match(a.raw,/ballerina stl\t1.234\t56/);
 assert.equal(b.searches.value,0);assert.equal(b.listings.state,'threshold');assert.equal(b.period.start,'2026-09-01');assert.equal(b.period.end,'2026-09-30');assert.equal(b.language,null);
 assert.equal(a.source,'marketplace-insights-user');assert.match(a.sourceDescription,/API verisi değildir/);assert(a.missing.includes('region'));assert.equal(I.validateObservation(a),true);
});
test('CSV tırnaklı binlik sayıyı tanır, bozuk satır veya yinelenen sütunlarda seçim yapmaz',()=>{
 const p=I.preview('Keyword,Searches,Listings,Period\n"ballet dancer stl","1,234",23,"Last 30 days"',opts);assert.equal(p.rows[0].searches.value,1234);assert.equal(p.rows[0].phrase,'ballet dancer stl');
 assert.match(p.rows[0].raw,/"ballet dancer stl","1,234"/);
 const bad=I.preview('Keyword,Searches,Listings\nballet stl,1,234,23',opts);assert.equal(bad.rows.length,0);assert.match(bad.errors.join(' '),/sütun sayısı/);
 assert.equal(I.preview('Keyword,Searches,Search count\nballet stl,10,20',opts).rows.length,0);
 assert(I.preview('Keyword,Searches,Listings\n"ballet stl,10,20',opts).errors.length);
});
test('Açık etiket blokları ve iki satırlı etiketler tanınır; etiketsiz sayılar tahmin edilmez',()=>{
 const text='Keyword: ballet dancer stl\nSearches: 34\nListings: 0\nPeriod: October sample\nDate: 2026-10-10\n\nKeyword: religious relief stl\nSearches\n<10\nListings\n23';
 const p=I.preview(text,opts);assert.equal(p.rows.length,2);assert.equal(p.rows[0].listings.value,0);assert.equal(p.rows[0].acquiredAt,'2026-10-10T00:00:00.000Z');assert(p.warnings.some(w=>w.includes('gerçek saat')));assert.equal(p.rows[1].searches.state,'threshold');
 assert.match(p.rows[0].raw,/Keyword: ballet dancer stl/);assert.match(p.rows[1].raw,/Searches\n<10/);
 assert.equal(I.preview('ballerina stl\n1,234\n56',opts).rows.length,0);
 const fallback=I.preview('23 45 ballerina stl',opts);assert(fallback.warnings.some(w=>w.includes('giriş tablosuna')));
 assert.equal(I.preview('Searches: 23\nListings: 4',{...opts,defaultPhrase:'ballerina stl'}).rows[0].phrase,'ballerina stl');
 assert.equal(I.preview('Keyword: ballet stl\nSearches: 20\nSearches: 30\nListings: 10',opts).rows.length,0);
});
test('Manuel tabloda eksikler sıfıra dönüşmez ve yeniden aktarım zamanı kimliği değiştirmez',()=>{
 const input=[{phrase:'ballerina stl',searches:'',listings:'0'}],a=I.fromRows(input,opts),b=I.fromRows(input,{acquiredAt:'2026-10-13T12:00:00Z'});
 assert.equal(a.rows[0].searches.state,'missing');assert.equal(a.rows[0].listings.value,0);assert.equal(a.rows[0].period.label,'');assert.equal(a.rows[0].region,null);assert.equal(a.rows[0].language,null);assert.equal(a.rows[0].id,b.rows[0].id);
 const different=I.fromRows(input,{...opts,periodLabel:'Last 7 days'});assert.notEqual(a.rows[0].id,different.rows[0].id);
 const roundtrip=I.fromRows(a.rows,opts);assert.equal(roundtrip.rows[0].id,a.rows[0].id);assert.equal(roundtrip.rows[0].raw,a.rows[0].raw);
 const noted=I.fromRows(input,{...opts,sourceDescription:'n'.repeat(1500)});assert.equal(I.fromRows(noted.rows,opts).rows[0].id,noted.rows[0].id);
 assert.equal(I.fromRows([{...input[0],source:'etsy-api'}],opts).rows.length,0);
});
test('Tarih, kaynak adresi ve boyut sınırları gerçek hataları gösterir; teslim linki sızmaz',()=>{
 assert(I.fromRows([{phrase:'test',searches:'1',periodStart:'2026-02-30'}],opts).errors.length);
 assert(I.fromRows([{phrase:'test',searches:'1',periodStart:'2026-10-10',periodEnd:'2026-10-01'}],opts).errors.length);
 assert(I.fromRows([{phrase:'test',searches:'1',date:'10/12/2026'}],opts).errors.length);
 assert(I.fromRows([{phrase:'test',searches:'1',date:'2026-10-12T24:00:00Z'}],opts).errors.length);
 for(const sourceUrl of ['http://etsy.com','https://localhost/test','https://127.0.0.1/test','https://192.168.1.2/test','https://[::1]/test','javascript:alert(1)','https://user:pass@etsy.com','https://drive.google.com/drive/folders/privateLink'])assert(I.fromRows([{phrase:'test',searches:'1'}],{...opts,sourceUrl}).errors.length,sourceUrl);
 assert.equal(I.fromRows([{phrase:'test',searches:'1'}],{...opts,sourceUrl:'https://help.etsy.com/hc/en-us/articles/example'}).errors.length,0);
 assert(I.preview('Keyword: test\nSearches: 10\nListings: 2\nhttps://drive.google.com/drive/folders/privateLink',opts).errors.length);
 assert(I.preview('Keyword: test\nSearches: 10\nListings: 2\n'+encodeURIComponent('https://drive.google.com/drive/folders/privateLink'),opts).errors.length);
 assert(I.preview('ü'.repeat(I.MAX_BYTES),opts).errors.length);assert(I.fromRows(Array.from({length:201},()=>({phrase:'test'})),opts).errors.length);
});
test('Saklanan ölçü kaynakla uyuşmalı; belirsiz veya bozuk nesne kesin sayı sayılmaz',()=>{
 const row=I.fromRows([{phrase:'test',searches:'12K',listings:'0'}],opts).rows[0];assert.equal(row.searches.state,'ambiguous');
 assert.throws(()=>I.validateObservation({...row,searches:{state:'exact',value:12000,raw:'12K',bound:null}}),/uyuşmuyor/);
 assert.throws(()=>I.validateObservation({...row,missing:[]}),/Eksik bilgi/);
 assert.throws(()=>I.validateObservation({...row,source:'etsy-api'}));
 assert.equal(I.parseMetric({state:'exact',value:12000,raw:'12K',bound:null}).state,'ambiguous');
 const circular={};circular.circular=circular;assert.equal(I.parseMetric(circular).state,'ambiguous');
 assert(I.fromRows([circular],opts).errors.length);assert(I.preview('Keyword: test\nSearches: 1',circular).errors.length);assert(I.preview('anything',null).errors.length);
});
test('Yapıştırılan HTML veya komut çalıştırılmaz; kaynak ve dönem sessizce değiştirilmez',()=>{
 globalThis.__insightsDanger=false;
 const p=I.preview('Keyword,Searches,Listings,Notes\nballet stl,12,13,"<script>globalThis.__insightsDanger=true</script>"',opts);assert.equal(p.rows.length,1);assert.equal(globalThis.__insightsDanger,false);assert.match(p.rows[0].raw,/<script>/);
 const a=I.preview('Keyword: ballet stl\nSearches: 10\nListings: 1\nPeriod: Last 7 days',{...opts,periodLabel:'Last 30 days'});assert.equal(a.rows[0].period.label,'Last 7 days');assert(a.warnings.some(w=>w.includes('genel dönem farklı')));
 const scoped=I.preview('Keyword: ballet stl\nSearches: 10\nListings: 1\nPeriod: Last 7 days',{...opts,periodLabel:'Last 30 days',periodStart:'2026-09-01',periodEnd:'2026-09-30'});assert.equal(scoped.rows[0].period.start,null);assert.equal(scoped.rows[0].period.end,null);
 delete globalThis.__insightsDanger;
});
test('Kaynakta yazan ISO dönem aralığı genel tarihlerle karıştırılmaz',()=>{
 const source='phrase\tsearches\tlistings\tperiod\ncat stl\t20\t10\t2026-01-01 – 2026-01-31',options={...opts,periodStart:'2026-02-01',periodEnd:'2026-02-28'};
 const preview=I.preview(source,options);assert.deepEqual(preview.errors,[]);assert.equal(preview.rows.length,1);
 assert.deepEqual(preview.rows[0].period,{label:'2026-01-01 – 2026-01-31',start:'2026-01-01',end:'2026-01-31'});
 assert(preview.warnings.some(w=>w.includes('kaynak aralığı korundu')));
 const restored=I.fromRows(preview.rows,options);assert.deepEqual(restored.errors,[]);assert.deepEqual(restored.rows[0].period,preview.rows[0].period);assert.equal(restored.rows[0].id,preview.rows[0].id);
 const invalid={...preview.rows[0],period:{...preview.rows[0].period,start:'2026-02-01',end:'2026-02-28'}};
 const conflict=I.fromRows([invalid],opts);assert.equal(conflict.rows.length,0);assert.match(conflict.errors.join(' '),/açık tarihleri çelişiyor/);
});
test('Açık satır tarihleri ISO kaynak aralığıyla çelişirse kayıt reddedilir',()=>{
 const period={label:'2026-01-01 to 2026-01-31',start:'2026-01-01',end:'2026-01-31'},base={phrase:'cat stl',searches:'20',listings:'10',period};
 for(const patch of [{periodStart:'2026-02-01'},{periodEnd:'2026-02-28'},{period:{...period,start:'2026-02-01'}},{period:{...period,end:'2026-02-28'}}]){
  const result=I.fromRows([{...base,...patch}],opts);assert.equal(result.rows.length,0);assert.match(result.errors.join(' '),/açık tarihleri çelişiyor/);
 }
 assert.equal(I.fromRows([{...base,periodStart:period.start,periodEnd:period.end}],opts).errors.length,0);
});
