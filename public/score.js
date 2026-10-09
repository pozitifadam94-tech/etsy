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
if(typeof module!=='undefined')module.exports={evaluate};else root.evaluate=evaluate;
})(globalThis);
