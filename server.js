const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const etsy=require('./etsy');
const updates=require('./updates');
const {handleWorkspace}=require('./workspace-api');
const {checkFolder}=require('./drive-check');
const root = path.join(__dirname, 'public');
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'};
const server = http.createServer((req,res)=>{
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if(pathname==='/api/health'&&req.method==='GET'){if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress)||!/^(localhost|127\.0\.0\.1):\d+$/.test(req.headers.host||'')){res.writeHead(403);res.end();return;}res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({app:'stl-atelier',version:require('./package.json').version}));return;}
  if(pathname.startsWith('/api/workspace')){void handleWorkspace(req,res,new URL(req.url,'http://localhost'));return;}
  if(pathname==='/api/drive/check'){
    const respond=(code,value)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
    if(req.method!=='POST'||!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress)||!/^(localhost|127\.0\.0\.1):\d+$/.test(req.headers.host||'')||req.headers.origin!=='http://'+req.headers.host){respond(403,{error:'Kontrolü yalnızca yerel panelden başlat.'});return;}
    void (async()=>{try{const chunks=[];let bytes=0;for await(const c of req){bytes+=c.length;if(bytes>4096)throw Error('Kontrol isteği çok büyük.');chunks.push(c);}const value=JSON.parse(Buffer.concat(chunks).toString('utf8'));respond(200,await checkFolder(value.deliveryFolderUrl));}catch(error){respond(400,{error:error.message});}})();return;
  }
  if(pathname.startsWith('/api/etsy/')||pathname==='/oauth/callback'){const u=new URL(req.url,'http://localhost');void etsy.handle(req,res,u);return;}
  if(pathname==='/api/version'&&req.method==='GET'){if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress)||!/^(localhost|127\.0\.0\.1):\d+$/.test(req.headers.host||'')){res.writeHead(403);res.end();return;}void updates.check().then(value=>{res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(value));}).catch(error=>{res.writeHead(502,{'Content-Type':'application/json'});res.end(JSON.stringify({error:error.message,current:require('./package.json').version}));});return;}
  if(pathname==='/version.json'){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({version:require('./package.json').version}));return;}
  const file = {'/':'index.html','/app.js':'app.js','/style.css':'style.css','/score.js':'score.js','/state.js':'state.js','/insights.js':'insights.js','/stl.js':'stl.js','/workbench.js':'workbench.js','/delivery.js':'delivery.js','/preparation.js':'preparation.js','/daily-review.js':'daily-review.js','/atelier-ui.js':'atelier-ui.js','/preparation-ui.js':'preparation-ui.js'}[pathname];
  if (!file) {res.writeHead(404);return res.end('Bulunamadı');}
  fs.readFile(path.join(root,file),(error,data)=>{
    res.writeHead(error?500:200,{'Content-Type':types[path.extname(file)],'X-Content-Type-Options':'nosniff'});
    res.end(error?'Dosya okunamadı':data);
  });
});
server.on('error',error=>{
  console.error(error.code==='EADDRINUSE'?'Bu port zaten kullaniliyor. Diger panel penceresini kapat veya PORT degerini degistir.':error.message);
  process.exitCode=1;
});
server.listen(Number(process.env.PORT || 3000),process.env.HOST || 'localhost',()=>{
  etsy.start();
  console.log('STL Niş Atölyesi hazır; port '+server.address().port);
  if(process.platform==='win32'&&process.env.OPEN_BROWSER==='1'){
    const {execFile}=require('node:child_process');
    execFile('rundll32.exe',['url.dll,FileProtocolHandler','http://localhost:'+server.address().port+'/'],error=>{if(error)console.log('Tarayicida http://localhost:'+server.address().port+'/ adresini ac.');});
  }
});
