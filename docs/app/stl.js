(function(root){
function parseSTL(buffer){
 if(!(buffer instanceof ArrayBuffer)||buffer.byteLength>25*1024*1024)throw Error('En fazla 25 MB STL dosyası seç.');
 const view=new DataView(buffer);let points=[],binary=false,count=0;
 if(buffer.byteLength>=84){count=view.getUint32(80,true);binary=count>0&&count<=300000&&84+count*50===buffer.byteLength;}
 if(binary){points=new Float32Array(count*9);for(let i=0;i<count;i++)for(let j=0;j<9;j++)points[i*9+j]=view.getFloat32(84+i*50+12+j*4,true);}
 else{
  const text=new TextDecoder().decode(buffer);if(!/^\s*solid\b/i.test(text)||!(/endsolid\b/i.test(text)))throw Error('Geçerli ikili veya ASCII STL okunamadı. ZIP dosyasını önce çıkar.');
  const facets=[...text.matchAll(/facet\s+normal\s+[^\n\r]+[\s\S]*?endfacet/gi)];
  if(!facets.length||facets.length>300000)throw Error('STL boş veya 300.000 üçgen sınırını aşıyor.');
  count=facets.length;points=new Float32Array(count*9);
  facets.forEach((f,i)=>{const vertices=[...f[0].matchAll(/vertex\s+([^\s]+)\s+([^\s]+)\s+([^\s]+)/gi)];if(vertices.length!==3)throw Error('STL yüzünde üç köşe bulunamadı.');vertices.forEach((v,j)=>{for(let k=0;k<3;k++)points[i*9+j*3+k]=Number(v[k+1]);});});
 }
 const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];let degenerate=0,signedVolume=0;
 const edges=new Map(),completeTopology=count<=100000;
 for(let i=0;i<count;i++){
  const v=[Array.from(points.slice(i*9,i*9+3)),Array.from(points.slice(i*9+3,i*9+6)),Array.from(points.slice(i*9+6,i*9+9))];
  for(const p of v)for(let a=0;a<3;a++){if(!Number.isFinite(p[a])||Math.abs(p[a])>1e12)throw Error('Dosyada geçersiz veya aşırı büyük koordinat var.');min[a]=Math.min(min[a],p[a]);max[a]=Math.max(max[a],p[a]);}
  const u=v[1].map((x,a)=>x-v[0][a]),w=v[2].map((x,a)=>x-v[0][a]);const cross=[u[1]*w[2]-u[2]*w[1],u[2]*w[0]-u[0]*w[2],u[0]*w[1]-u[1]*w[0]];
  if(Math.hypot(...cross)<1e-12)degenerate++;
  signedVolume+=(v[0][0]*(v[1][1]*v[2][2]-v[1][2]*v[2][1])+v[0][1]*(v[1][2]*v[2][0]-v[1][0]*v[2][2])+v[0][2]*(v[1][0]*v[2][1]-v[1][1]*v[2][0]))/6;
  if(completeTopology){const keys=v.map(p=>p.join(','));for(let a=0;a<3;a++){const b=(a+1)%3,left=keys[a],right=keys[b],sign=left<right?1:-1,key=left<right?left+'|'+right:right+'|'+left;const e=edges.get(key)||{count:0,direction:0};e.count++;e.direction+=sign;edges.set(key,e);}}
 }
 let boundary=null,nonManifold=null,orientation=null;
 if(completeTopology){boundary=0;nonManifold=0;orientation=0;for(const e of edges.values()){if(e.count===1)boundary++;if(e.count>2)nonManifold++;if(e.count===2&&e.direction!==0)orientation++;}}
 const dimensions=max.map((n,i)=>n-min[i]);if(Math.max(...dimensions)===0)throw Error('Modelin tüm köşeleri aynı noktada.');
 const warnings=[];if(degenerate)warnings.push(degenerate+' sıfıra yakın alanlı üçgen var.');if(boundary)warnings.push(boundary+' açık kenar bulundu.');if(nonManifold)warnings.push(nonManifold+' kenarda ikiden fazla yüz birleşiyor.');if(orientation)warnings.push(orientation+' kenarda yüz yönleri tutarsız.');if(!completeTopology)warnings.push('100.000 üçgen üzerinde kenar analizi yapılmadı; topoloji durumu bilinmiyor.');
 const sampleCount=Math.min(2500,count),sample=new Float32Array(sampleCount*9);for(let i=0;i<sampleCount;i++){const at=Math.floor(i*count/sampleCount)*9;sample.set(points.subarray(at,at+9),i*9);}
 return {format:binary?'İkili STL':'ASCII STL',triangles:count,min,max,dimensions,degenerate,boundary,nonManifold,orientation,completeTopology,volume:completeTopology&&!boundary&&!nonManifold&&!orientation&&!degenerate?Math.abs(signedVolume):null,warnings,sample};
}
if(typeof module!=='undefined')module.exports={parseSTL};else{
 root.STLFile={parseSTL};
 if(typeof document==='undefined')root.onmessage=e=>{try{const result=parseSTL(e.data);root.postMessage({result},[result.sample.buffer]);}catch(error){root.postMessage({error:error.message});}};
}
})(globalThis);
