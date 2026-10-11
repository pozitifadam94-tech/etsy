const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const target=path.join(root,'docs','app');
fs.mkdirSync(target,{recursive:true});
for(const file of ['index.html','app.js','score.js','style.css','state.js','insights.js','stl.js','workbench.js','delivery.js','preparation.js','daily-review.js','atelier-ui.js','preparation-ui.js'])fs.copyFileSync(path.join(root,'public',file),path.join(target,file));
console.log('GitHub Pages uygulama dosyaları hazır.');

fs.writeFileSync(path.join(target,'version.json'),JSON.stringify({version:require('../package.json').version}));
