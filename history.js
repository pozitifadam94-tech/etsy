const DAY=86400000;
const dayAt=stamp=>new Date(stamp).toISOString().slice(0,10);
const emptyHistory=()=>({products:{},observations:[],firstCaptured:null,lastCaptured:null,salesCaptured:null});

// Keep calendar coverage separate from sales: missing coverage is never a zero.
function captureHistory(previous,snapshot,now=Date.now()){
 const history=structuredClone(previous||emptyHistory());
 if(!snapshot?.updated||!Array.isArray(snapshot.products))return history;
 const stamp=Date.parse(snapshot.salesUpdated||snapshot.updated);
 if(!Number.isFinite(stamp)||stamp>now)return history;
 const active=new Set(snapshot.products.map(p=>String(p.id)));
 for(const [id,p] of Object.entries(history.products))if(!active.has(id)){p.active=false;p.lastAbsent=snapshot.updated;}
 for(const p of snapshot.products){
  const id=String(p.id),before=history.products[id];
  history.products[id]={...before,...p,active:true,firstSeen:before?.firstSeen||snapshot.updated,lastSeen:snapshot.updated,
   daily:before?.daily||{},dailyMoney:before?.dailyMoney||{},coverage:before?.coverage||[],moneyCoverage:before?.moneyCoverage||[]};
 }
 history.firstCaptured??=snapshot.updated;history.lastCaptured=snapshot.updated;
 const seen=new Set(history.observations.map(o=>o.id));
 for(const o of snapshot.observations||[])if(!seen.has(o.id)){history.observations.push(o);seen.add(o.id);}
 if(!snapshot.salesUpdated)return history;
 const end=Math.floor(stamp/DAY)*DAY,start=Math.ceil((stamp-90*DAY)/DAY)*DAY;
 const dates=[];for(let t=start;t<end;t+=DAY)dates.push(dayAt(t));
 const sources=new Map([...(snapshot.salesProducts||[]),...snapshot.products.filter(p=>p.salesAvailable!==false)].map(p=>[String(p.id),p]));
 for(const [id,p] of sources)if(!history.products[id])history.products[id]={...p,active:active.has(id),firstSeen:snapshot.updated,lastSeen:snapshot.updated,daily:{},dailyMoney:{},coverage:[],moneyCoverage:[]};
 // Receipt sync covers absent products too; newly discovered inactive sales remain in history.
 for(const [id,p] of Object.entries(history.products)){
  const source=sources.get(id);
  if(active.has(id)&&!source)continue;
  const coverage=new Set(p.coverage),moneyCoverage=new Set(p.moneyCoverage);
  for(const date of dates){
   p.daily[date]=Number(source?.daily?.[date])||0;
   p.dailyMoney[date]=source?.dailyMoney?.[date]||{};
   coverage.add(date);
   if(!source||source.moneyComplete!==false)moneyCoverage.add(date);else moneyCoverage.delete(date);
  }
  // Today's count is stored for display but never included in complete-day decisions.
  const today=dayAt(stamp);if(source?.daily?.[today]!==undefined){p.daily[today]=source.daily[today];p.dailyMoney[today]=source.dailyMoney?.[today]||{};}
  p.coverage=[...coverage].sort();p.moneyCoverage=[...moneyCoverage].sort();
 }
 history.salesCaptured=snapshot.salesUpdated;
 return history;
}
module.exports={captureHistory,emptyHistory};
