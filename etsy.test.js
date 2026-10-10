const {test}=require('node:test');
const assert=require('node:assert/strict');
const {summarize}=require('./etsy');
const now=Date.now(),stamp=Math.floor(now/1000);
const listing={listing_id:1,title:'Model',creation_timestamp:stamp-86400*40};
const transaction={listing_id:1,quantity:2,price:{amount:500,divisor:100,currency_code:'USD'}};
test('Ödenmemiş, iptal edilen ve diğer ürün satışları sayılmaz',()=>{const rows=[{is_paid:true,create_timestamp:stamp,transactions:[transaction]},{is_paid:false,create_timestamp:stamp,transactions:[transaction]},{is_paid:true,is_canceled:true,create_timestamp:stamp,transactions:[transaction]},{is_paid:true,create_timestamp:stamp,transactions:[{...transaction,listing_id:2}]}];const r=summarize([listing],rows,now)[0];assert.equal(r.periods[0].orders,1);assert.equal(r.periods[0].quantity,2);assert.equal(r.periods[0].revenue,10);});
test('Dönemler ayrı tutulur ve karışık para birimleri toplanmaz',()=>{const rows=[{is_paid:true,create_timestamp:stamp-86400*35,transactions:[transaction]},{is_paid:true,create_timestamp:stamp,transactions:[{...transaction,price:{amount:500,divisor:100,currency_code:'EUR'}}]}];const r=summarize([listing],rows,now)[0];assert.equal(r.periods[0].orders,1);assert.equal(r.periods[1].orders,2);assert.equal(r.periods[1].revenue,null);});
