const {workspace}=require('./workspace');
async function handleWorkspace(req,res,url){
 const respond=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
 if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress)||!/^(localhost|127\.0\.0\.1):\d+$/.test(req.headers.host||'')){respond(403,{error:'Yalnızca yerel panelden erişim.'});return;}
 if(req.method==='POST'&&req.headers.origin!=='http://'+req.headers.host){respond(403,{error:'İşlemi yerel panelden yap.'});return;}
 try{
  const store=workspace();
  if(req.method==='GET'&&url.pathname==='/api/workspace'){respond(200,store.status());return;}
  if(req.method==='GET'&&url.pathname==='/api/workspace/export'){respond(200,store.export());return;}
  if(req.method!=='POST'){respond(404,{error:'Bulunamadı'});return;}
  const chunks=[];let bytes=0;for await(const chunk of req){bytes+=chunk.length;if(bytes>32*1024*1024)throw Error('Yedek en fazla 32 MB olmalı.');chunks.push(chunk);}
  const input=JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if(url.pathname==='/api/workspace'){respond(200,store.put(input.state,input.revision,input.shopId));return;}
  if(url.pathname==='/api/workspace/migrate'){respond(200,store.migrate(input.state));return;}
  if(url.pathname==='/api/workspace/dismiss'){respond(200,store.dismiss(input.id,input.revision));return;}
  if(url.pathname==='/api/workspace/claim-legacy'){respond(200,store.claimLegacy(input.id,input.shopId,input.revision));return;}
  if(url.pathname==='/api/workspace/restore'){
   const etsy=require('./etsy');if(!etsy.canRestore())throw Error('Güncelleme sürüyor; tamamlandıktan sonra geri yükle.');
   const value=input.name?store.readBackup(input.name):input.bundle;
   // Research is part of the same atomic workspace commit. No second connection
   // write can leave a successful restore only partly applied.
   const account=etsy.status();const result=store.restore(value,input.revision,account.connected&&account.shopId?account.shopId:undefined);respond(200,result);return;
  }
  respond(404,{error:'Bulunamadı'});
 }catch(e){respond(e.status||400,{error:e.message});}
}
module.exports={handleWorkspace};
