// Compare known listing metadata only. An observation time is not an edit time.
function listingObservations(previous,products,observedAt){
 if(!previous?.updated)return [];
 const old=new Map((previous.products||[]).map(p=>[String(p.id),p]));
 const fields=[['title','title'],['description','description'],['tags','tags'],['images','imageIds'],['type','listingType'],['price','price']];
 const normalized=(name,value)=>name==='tags'?JSON.stringify([...value].sort()):name==='price'?JSON.stringify([value.amount/value.divisor,value.currency_code]):JSON.stringify(value);
 const known=(name,value)=>name==='price'?value&&Number.isFinite(value.amount)&&Number.isFinite(value.divisor)&&value.divisor>0&&typeof value.currency_code==='string':['tags','images'].includes(name)?Array.isArray(value):typeof value==='string';
 return products.flatMap(p=>{const before=old.get(String(p.id));if(!before)return [];const changes=fields.filter(([name,key])=>known(name,before[key])&&known(name,p[key])&&normalized(name,before[key])!==normalized(name,p[key]));return changes.length?[{id:String(p.id)+':'+observedAt,product:String(p.id),title:p.title,observedAt,previousObservedAt:previous.updated,fields:changes.map(([name])=>name),content:Object.fromEntries(changes.map(([name,key])=>[name,{before:structuredClone(before[key]),after:structuredClone(p[key])}]))}]:[];});
}
module.exports={listingObservations};
