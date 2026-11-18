// Static script inventory, not a timing or compressed-network benchmark.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const scripts=[...fs.readFileSync(path.join(root,'index.html'),'utf8').matchAll(/<script[^>]+src=["']([^"']+)/g)].map(match=>match[1]);
const local=scripts.filter(url=>!/^https?:/.test(url)),remote=scripts.filter(url=>/^https?:/.test(url));
console.log(JSON.stringify({initial_scripts:scripts.length,local_scripts:local.length,remote_scripts:remote.length,local_bytes:local.reduce((sum,url)=>sum+fs.statSync(path.join(root,url.split('?')[0])).size,0),remote_urls:remote},null,2));
