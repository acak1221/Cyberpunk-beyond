// The update notice: «Обновить» activates the waiting worker, or only reloads when another tab already did.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'..','site','pwa.js'),'utf8');

function el(tag){const e={tag,children:[],listeners:{},className:'',textContent:'',classList:{add(){},remove(){}},setAttribute(){},appendChild:c=>{e.children.push(c);return c},addEventListener:(t,f)=>{e.listeners[t]=f}};Object.defineProperty(e,'innerHTML',{set(){e.children=[]}});return e}
async function start(state){
 const posted=[],reloads=[],swListeners={},byId={};
 const worker={state,postMessage:m=>posted.push(m)};
 const reg={waiting:worker,addEventListener(){},update:async()=>{}};
 const body=el('body');body.appendChild=c=>{if(c.id)byId[c.id]=c;return c};
 const document={readyState:'complete',documentElement:{lang:'ru',dataset:{build:'abc123'},classList:{add(){},remove(){}}},body,createElement:el,querySelector:s=>byId[s.slice(1)]||null,addEventListener(){}};
 const navigator={serviceWorker:{controller:{},addEventListener:(t,f)=>{swListeners[t]=f},register:async()=>reg}};
 const ctx={document,navigator,location:{reload:()=>reloads.push(1)},addEventListener(){},dispatchEvent(){},CustomEvent:class{},matchMedia:()=>({matches:false})};ctx.window=ctx;
 vm.runInNewContext(source,ctx);
 for(let i=0;i<5;i++)await new Promise(r=>setImmediate(r));
 const toast=byId['pwa-toast'];assert.ok(toast,'the update notice is shown');
 return {posted,reloads,swListeners,worker,button:toast.children.find(c=>c.className==='btn primary'),close:toast.children.find(c=>c.className==='pwa-toast-close'),chip:()=>byId['pwa-chip']};
}

test('«Обновить» activates the waiting version, and the page reloads once it takes over',async()=>{
 const s=await start('installed');assert.equal(s.button.textContent,'Обновить');
 s.button.listeners.click();assert.deepEqual(s.posted,['skip-waiting']);assert.equal(s.reloads.length,0);
 s.swListeners.controllerchange();assert.equal(s.reloads.length,1);
});

test('when another tab has already applied the update, the button and the chip just reload',async()=>{
 const s=await start('installed');
 s.worker.state='activated';s.swListeners.controllerchange();assert.equal(s.reloads.length,0,'no reload the user did not ask for');
 s.button.listeners.click();assert.deepEqual(s.posted,[]);assert.equal(s.reloads.length,1);
 const t=await start('installed');t.close.listeners.click();assert.equal(t.chip().textContent,'↻ Обновить');
 t.worker.state='activating';t.chip().listeners.click();assert.deepEqual(t.posted,[]);assert.equal(t.reloads.length,1);
});
