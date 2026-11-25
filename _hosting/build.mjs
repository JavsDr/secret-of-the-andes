// Run from the Sites source checkout, after staging public assets with stage.py.
import fs from 'node:fs';
import path from 'node:path';
const files = {};
function visit(dir) {
  for (const entry of fs.readdirSync(dir,{withFileTypes:true})) {
    const name = path.join(dir,entry.name);
    if (entry.isDirectory()) visit(name);
    else files['/' + path.relative('public',name)] = fs.readFileSync(name).toString('base64');
  }
}
visit('public');
fs.mkdirSync('dist/server',{recursive:true});
fs.mkdirSync('dist/.openai',{recursive:true});
fs.writeFileSync('dist/server/index.js','const FILES = ' + JSON.stringify(files) + ';\n' + fs.readFileSync('worker.js','utf8'));
fs.copyFileSync('.openai/hosting.json','dist/.openai/hosting.json');
fs.cpSync('drizzle','dist/.openai/drizzle',{recursive:true});
