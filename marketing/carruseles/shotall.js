const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1080,height:1350},deviceScaleFactor:1});
for(const f of process.argv.slice(2)){await p.goto('file://'+f);await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(800);
const n=await p.locator('section.s').count();const dir=f.replace(/\.html$/,'');require('fs').mkdirSync(dir,{recursive:true});
for(let i=0;i<n;i++){await p.locator('section.s').nth(i).screenshot({path:dir+'/'+String(i+1).padStart(2,'0')+'.png'});}
const over=await p.evaluate(()=>[...document.querySelectorAll('section.s')].map((s,i)=>{const b=s.querySelector('.body');return b.scrollHeight>b.clientHeight+2?i+1:0}).filter(Boolean));
console.log(f.split('/').pop(),n,'overflow:',over);}
await b.close();})();
