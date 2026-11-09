// The built service worker, run in node:vm against an in-memory Cache Storage and a fake network.
const {test,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{execFileSync}=require('node:child_process'),vm=require('node:vm');

const out=fs.mkdtempSync(path.join(os.tmpdir(),'ncred-sw-'));
execFileSync(process.execPath,[path.join(__dirname,'..','scripts','build.mjs'),out],{stdio:'pipe'});
after(()=>fs.rmSync(out,{recursive:true,force:true}));
const source=fs.readFileSync(path.join(out,'sw.js'),'utf8');
const VERSION=JSON.parse(source.match(/const VERSION = (".*?");/)[1]),PRECACHE=JSON.parse(source.match(/const PRECACHE = (\[.*\]);/)[1]),PDFJS=JSON.parse(source.match(/const PDFJS = (\{.*\});/)[1]);
const SCOPE='https://me.github.io/Cyberpunk-beyond/';

// Serves the build like a static host; mode 'offline' rejects, 'hang' never answers.
function host(){
 const net={mode:'online',requests:[],page:null};
 net.fetch=async(input,init)=>{
  const req=typeof input==='string'||input instanceof URL?new Request(input,init):input;net.requests.push({url:req.url,cache:req.cache});
  if(net.mode==='offline')throw new TypeError('Failed to fetch');if(net.mode==='hang')return new Promise(()=>{});
  const url=new URL(req.url);let rel=url.pathname.slice(new URL(SCOPE).pathname.length);if(rel===''||rel.endsWith('/'))rel+='index.html';
  const file=path.join(out,rel);
  if(!fs.existsSync(file)||!fs.statSync(file).isFile())return new Response(fs.readFileSync(path.join(out,'404.html')),{status:404,headers:{'content-type':'text/html'}});
  if(net.stale?.[rel])return new Response(net.stale[rel],{status:200});
  return new Response(rel==='index.html'&&net.page!=null?net.page:fs.readFileSync(file),{status:200});
 };
 return net;
}
// A minimal Cache Storage: entries keyed by absolute URL, matched exactly unless ignoreSearch.
function cacheStorage(){
 const store=new Map(),key=r=>new URL(typeof r==='string'?r:r.url,SCOPE).href;
 const find=(name,r,o={})=>{const m=store.get(name);if(!m)return;const k=key(r);for(const [u,res] of m)if(u===k||(o.ignoreSearch&&u.split('?')[0]===k.split('?')[0]))return res.clone()};
 const cache=name=>({match:async(r,o)=>find(name,r,o),put:async(r,res)=>{await res.clone().arrayBuffer();store.get(name).set(key(r),res)},delete:async r=>store.get(name).delete(key(r)),keys:async()=>[...store.get(name).keys()]});
 return {store,open:async n=>{if(!store.has(n))store.set(n,new Map());return cache(n)},match:async(r,o={})=>o.cacheName?find(o.cacheName,r,o):[...store.keys()].map(n=>find(n,r,o)).find(Boolean),keys:async()=>[...store.keys()],delete:async n=>store.delete(n),has:async n=>store.has(n)};
}
// windows: the open pages (URLs) this worker controls once it has claimed them; navigate() records where each goes.
function worker(windows=[]){
 const net=host(),caches=cacheStorage(),handlers={},navigated=[],self={registration:{scope:SCOPE},addEventListener:(t,f)=>{handlers[t]=f},skipWaiting(){self.skipped=true},clients:{claim:async()=>{self.claimed=true},matchAll:async o=>o?.type==='window'&&self.claimed?windows.map(url=>({url:new URL(url,SCOPE).href,navigate:async to=>{navigated.push(to);return null}})):[]}};
 vm.runInNewContext(source,{self,caches,fetch:(...a)=>net.fetch(...a),Request,Response,URL,crypto:globalThis.crypto});
 const extendable=(type,props)=>{const waits=[];handlers[type]({...props,waitUntil:p=>waits.push(p)});return Promise.all(waits)};
 const request=(url,mode='no-cors')=>({url:new URL(url,SCOPE).href,method:'GET',mode});
 // Resolves with the worker's response, or null when it leaves the request to the browser.
 async function get(url,mode){let responded=null;const waits=[];handlers.fetch({request:request(url,mode),respondWith:p=>{responded=Promise.resolve(p)},waitUntil:p=>waits.push(p)});const response=responded&&await responded;await Promise.all(waits);return response}
 return {net,caches,self,navigated,install:()=>extendable('install'),activate:()=>extendable('activate'),message:data=>extendable('message',{data}),get,navigate:url=>get(url,'navigate')};
}
const within=(promise,ms=500)=>Promise.race([promise,new Promise((_,reject)=>setTimeout(()=>reject(new Error('timed out')),ms))]);

test('install stores the URLs the page loads and reuses the HTTP cache only for versioned bundles',async()=>{
 const sw=worker();await sw.install();
 const app=sw.caches.store.get('nc-red-app-'+VERSION);
 assert.deepEqual([...app.keys()].sort(),PRECACHE.map(u=>new URL(u,SCOPE).href).sort());
 const modes=Object.fromEntries(sw.net.requests.map(r=>[r.url.slice(SCOPE.length),r.cache]));
 assert.equal(modes[`nc-red.js?v=${VERSION}`],'force-cache');assert.equal(modes[`nc-red.css?v=${VERSION}`],'force-cache');
 assert.equal(modes[''],'no-cache');assert.equal(modes['manifest.webmanifest'],'no-cache');
 assert.equal(sw.net.requests.length,PRECACHE.length,'each file is downloaded once');
 assert.ok(!sw.net.requests.some(r=>/index\.html|nc-red\.js$|pdfjs/.test(r.url)));
});

test('install refuses a page from another build and leaves no half-filled cache',async()=>{
 const sw=worker();sw.net.page=fs.readFileSync(path.join(out,'index.html'),'utf8').replace(`data-build="${VERSION}"`,'data-build="0123456789ab"');
 await assert.rejects(sw.install(),/precache failed: \.\//);
 assert.ok(!sw.caches.store.has('nc-red-app-'+VERSION));
});

test('a bundle with another ?v= is never answered with this version, and the page never waits for the network',async()=>{
 const sw=worker();await sw.install();await sw.activate();sw.net.requests.length=0;sw.net.mode='hang';
 const js=await within(sw.get(`nc-red.js?v=${VERSION}`));assert.match(await js.text(),/bundled by scripts\/build\.mjs/);
 assert.equal(await sw.get('nc-red.js?v=0123456789ab'),null,'left to the network');
 assert.equal(await sw.get('nc-red.js'),null);
 for(const url of ['', 'index.html', 'index.html?x=1', '?share=1']){
  const page=await within(sw.navigate(url));assert.equal(page.status,200,url);assert.match(await page.text(),new RegExp(`data-build="${VERSION}"`),url);
 }
 assert.equal(sw.net.requests.length,0);
});

test('nested paths open the matching hash route; other pages fall back to the app offline',async()=>{
 const sw=worker();await sw.install();await sw.activate();sw.net.mode='offline';
 const location=async url=>{const r=await sw.navigate(url);assert.equal(r.status,302,url);return r.headers.get('location')};
 assert.equal(await location('sheet/abc'),SCOPE+'#/sheet/abc');
 assert.equal(await location('sheet/abc/'),SCOPE+'#/sheet/abc');
 assert.equal(await location('room/K7RQ-M2XA-PZ9E'),SCOPE+'#/room/K7RQ-M2XA-PZ9E');
 assert.equal(await location('rules?x=2'),SCOPE+'?x=2#/rules');
 assert.equal(await location('missing/page'),SCOPE);
 assert.equal((await sw.navigate('icons/icon-192.png')).status,200);
 sw.net.mode='online';assert.equal((await sw.navigate('missing/page')).status,404,'online: the host answers (404.html)');
 assert.equal(await sw.get('missing.js'),null);
});

test('activate keeps the PDF reader across app updates and drops other versions',async()=>{
 const sw=worker();
 for(const name of ['nc-red-app-old','nc-red-runtime-old','nc-red-pdfjs-old',`nc-red-pdfjs-${PDFJS.version}`,'nc-red-fonts-v1','someone-else'])await sw.caches.open(name);
 await sw.install();await sw.activate();
 assert.deepEqual((await sw.caches.keys()).sort(),[`nc-red-app-${VERSION}`,'nc-red-fonts-v1',`nc-red-pdfjs-${PDFJS.version}`,'someone-else'].sort());
 assert.ok(sw.self.claimed);
 await sw.message('skip-waiting');assert.ok(sw.self.skipped);
});

test('the PDF reader is stored on first use or in the background and found without a retry query',async()=>{
 const files=Object.keys(PDFJS.files);assert.deepEqual(files,['vendor/pdfjs/pdf.min.mjs','vendor/pdfjs/pdf.worker.min.mjs']);
 const sw=worker();await sw.install();await sw.activate();sw.net.requests.length=0;
 const first=await sw.get('vendor/pdfjs/pdf.min.mjs?retry=2','cors');assert.equal(first.status,200);
 const pdf=sw.caches.store.get(`nc-red-pdfjs-${PDFJS.version}`);assert.deepEqual([...pdf.keys()],[SCOPE+'vendor/pdfjs/pdf.min.mjs']);
 await sw.message('cache-pdf');assert.deepEqual(sw.net.requests.map(r=>r.url.slice(SCOPE.length)),['vendor/pdfjs/pdf.min.mjs?retry=2','vendor/pdfjs/pdf.worker.min.mjs'],'only the missing file');
 await sw.message('cache-pdf');assert.equal(sw.net.requests.length,2);
 sw.net.mode='offline';
 for(const file of files)assert.equal((await sw.get(file,'cors')).status,200,file);
 // an app update reuses the stored reader
 const next=worker();next.caches.store.set(`nc-red-pdfjs-${PDFJS.version}`,pdf);await next.install();await next.activate();next.net.mode='offline';next.net.requests.length=0;
 await next.message('cache-pdf');assert.equal(next.net.requests.length,0);assert.equal((await next.get(files[1],'cors')).status,200);
});

test('the first update from the per-version runtime cache carries a matching pdf.js over',async()=>{
 const sw=worker(),old=await sw.caches.open('nc-red-runtime-0123456789ab');
 await old.put(SCOPE+'vendor/pdfjs/pdf.min.mjs',new Response(fs.readFileSync(path.join(out,'vendor/pdfjs/pdf.min.mjs'))));
 await old.put(SCOPE+'vendor/pdfjs/pdf.worker.min.mjs',new Response('/* another pdf.js version */'));
 await sw.install();sw.net.mode='offline';await sw.activate();
 assert.ok(!sw.caches.store.has('nc-red-runtime-0123456789ab'));
 assert.deepEqual([...sw.caches.store.get(`nc-red-pdfjs-${PDFJS.version}`).keys()],[SCOPE+'vendor/pdfjs/pdf.min.mjs']);
});

test('a pdf.js file of another version (a stale HTTP or CDN copy) is passed through but never stored',async()=>{
 const sw=worker();await sw.install();await sw.activate();sw.net.stale={'vendor/pdfjs/pdf.worker.min.mjs':'/* pdf.js 4.0 worker */'};
 assert.equal(await (await sw.get('vendor/pdfjs/pdf.worker.min.mjs','same-origin')).text(),'/* pdf.js 4.0 worker */');
 await sw.message('cache-pdf');
 assert.deepEqual([...sw.caches.store.get(`nc-red-pdfjs-${PDFJS.version}`).keys()],[SCOPE+'vendor/pdfjs/pdf.min.mjs']);
 sw.net.stale=null;await sw.message('cache-pdf');assert.equal(sw.caches.store.get(`nc-red-pdfjs-${PDFJS.version}`).size,2);
});

test('a failed background download is harmless and retried next time',async()=>{
 const sw=worker();await sw.install();await sw.activate();sw.net.mode='offline';
 await sw.message('cache-pdf');assert.equal(sw.caches.store.get(`nc-red-pdfjs-${PDFJS.version}`).size,0);
 sw.net.mode='online';await sw.message('cache-pdf');assert.equal(sw.caches.store.get(`nc-red-pdfjs-${PDFJS.version}`).size,2);
});

test('a worker from before this scheme (index.html in its cache) is replaced at once and its pages reload into this version',async()=>{
 // The old worker answers nc-red.js?v=NEW with its own copy, so new tabs and offline starts mix versions until it is gone.
 const sw=worker(['#/dice','index.html#/sheet','sheet/abc']),old=await sw.caches.open('nc-red-app-556a6019a9bf');
 for(const url of ['','index.html','nc-red.js','nc-red.css'])await old.put(SCOPE+url,new Response('old'));
 await sw.install();assert.ok(sw.self.skipped,'no waiting for «Обновить»');assert.deepEqual(sw.navigated,[]);
 await sw.activate();assert.ok(!sw.caches.store.has('nc-red-app-556a6019a9bf'));
 // A URL that differs only after # would not reload the page, so the path changes as well.
 assert.deepEqual(sw.navigated,[SCOPE+'index.html#/dice',SCOPE+'#/sheet',SCOPE]);
 sw.net.mode='offline';const page=await sw.navigate('index.html#/dice');assert.match(await page.text(),new RegExp(`data-build="${VERSION}"`));
});

test('an update from a worker of this scheme waits for «Обновить» and reloads nothing',async()=>{
 const first=worker(['#/dice']);await first.install();await first.activate();
 const next=worker(['#/dice']);for(const [name,entries] of first.caches.store)next.caches.store.set(name.replace(VERSION,'0123456789ab'),entries);
 await next.install();assert.ok(!next.self.skipped);await next.activate();assert.deepEqual(next.navigated,[]);
});
