const test=require('node:test'),assert=require('node:assert/strict');const {parseSTL}=require('./public/stl');
function binary(faces){const a=new ArrayBuffer(84+faces.length*50),v=new DataView(a);v.setUint32(80,faces.length,true);faces.forEach((face,i)=>face.flat().forEach((n,j)=>v.setFloat32(84+i*50+12+j*4,n,true)));return a;}
test('İkili STL ölçüleri ve açık kenarlar doğru; açık model için hacim uydurulmaz',()=>{
 const r=parseSTL(binary([[[0,0,0],[2,0,0],[0,3,0]]]));assert.deepEqual(r.dimensions,[2,3,0]);assert.equal(r.triangles,1);assert.equal(r.boundary,3);assert.equal(r.volume,null);
});
test('Kapalı tetrahedron açık kenarsız ve tutarlı yönlüdür',()=>{
 const a=[0,0,0],b=[1,0,0],c=[0,1,0],d=[0,0,1];const r=parseSTL(binary([[a,c,b],[a,b,d],[a,d,c],[b,c,d]]));assert.equal(r.boundary,0);assert.equal(r.orientation,0);assert(Math.abs(r.volume-1/6)<1e-8);
});
test('ASCII STL ve hatalı/boş/NaN dosya davranışı',()=>{
 const text='solid a\nfacet normal 0 0 1\nouter loop\nvertex 0 0 0\nvertex 2 0 0\nvertex 0 3 0\nendloop\nendfacet\nendsolid a';
 assert.equal(parseSTL(new TextEncoder().encode(text).buffer).format,'ASCII STL');assert.throws(()=>parseSTL(new ArrayBuffer(84)),/okunamadı/);assert.throws(()=>parseSTL(binary([[[NaN,0,0],[1,0,0],[0,1,0]]])),/koordinat/);
 assert.throws(()=>parseSTL(new TextEncoder().encode(text.replace('vertex 2 0 0','')).buffer),/köşe/);
});
