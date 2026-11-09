// PDF search without a network: an accurate message when the reader module is missing, a working retry
// once the device is back online, and the background request that stores the module for offline use.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'..','site','book-search.js'),'utf8');
const IMPORT="await import('./vendor/pdfjs/pdf.min.mjs'";
const flush=async()=>{for(let i=0;i<20;i++)await new Promise(r=>setImmediate(r))};
const file={arrayBuffer:async()=>new Uint8Array([1]).buffer};

// net.module / net.worker: whether each file can be fetched right now.
function load({navigator,build='abc123',lang='ru'}={}){
 assert.ok(source.includes(IMPORT));
 const net={module:true,worker:true,imports:[],probes:[],tasks:[]},win={addEventListener:(t,f)=>{(win.listeners[t]||=[]).push(f)},listeners:{},requestIdleCallback:f=>f()};
 const doc={baseURI:'https://me.github.io/Cyberpunk-beyond/',documentElement:{lang,dataset:build?{build}:{}},querySelector:()=>null};
 const document=doc;
 const lib={GlobalWorkerOptions:{},getDocument(){const task={destroyed:false,destroy(){task.destroyed=true},promise:net.worker&&!net.damaged?Promise.resolve({numPages:2,getPage:async()=>({getTextContent:async()=>({items:[{str:'Hello Night City'}]})})}):Promise.reject(Error('Setting up fake worker failed'))};net.tasks.push(task);return task}};
 const context={window:win,document,URL,Uint8Array,setTimeout,
  __import:async spec=>{net.imports.push(spec);if(!net.module)throw new TypeError('Failed to fetch dynamically imported module');return lib},
  fetch:async url=>{net.probes.push(String(url));if(!net.worker)throw new TypeError('Failed to fetch');return {ok:true,body:{cancel:async()=>{}}}}};
 if(navigator)context.navigator=navigator;
 vm.runInNewContext(source.replace(IMPORT,"await __import('./vendor/pdfjs/pdf.min.mjs'"),context);
 return {net,win,doc,BookSearch:win.BookSearch};
}

test('offline without the stored reader the user is told to connect once, in Russian and English',async()=>{
 for(const [lang,text] of [['ru',/^Модуль чтения PDF ещё не загружен на это устройство\. Подключитесь к интернету один раз — модуль сохранится, и поиск будет работать офлайн\.$/],['en',/^The PDF reader module is not on this device yet\. Connect to the internet once — it will be saved and search will work offline\.$/]]){
  const {net,BookSearch,doc}=load({lang});net.module=net.worker=false;
  const status={textContent:''},root={isConnected:true,querySelector:s=>s==='[data-bs-status]'?status:s==='[data-bs-query]'?{value:'Hello'}:null},button={dataset:{bsAction:'search'},isConnected:true,closest:()=>root};doc.querySelector=()=>root;
  BookSearch.setFile(file);assert.equal(BookSearch.handle({type:'click',target:{closest:()=>button}},lang),true);await flush();
  assert.match(status.textContent,text);assert.ok(BookSearch.render(lang).includes(status.textContent));
 }
});

test('after reconnecting, the same page retries with a fresh module URL (a failed import is remembered)',async()=>{
 const {net,BookSearch}=load();net.module=net.worker=false;
 const s=BookSearch.create();s.setFile(file);await s.search('Hello');assert.equal(s.snapshot().status.key,'module');
 net.module=net.worker=true;await s.search('Hello');
 assert.equal(s.snapshot().status.key,'ready');assert.deepEqual(Array.from(s.snapshot().results,r=>r.page),[1]);
 assert.deepEqual(net.imports,['./vendor/pdfjs/pdf.min.mjs','./vendor/pdfjs/pdf.min.mjs?retry=1']);
});

test('a missing worker is also reported as the module, and pdf.js is loaded afresh next time',async()=>{
 const {net,BookSearch}=load();net.worker=false;
 const s=BookSearch.create();s.setFile(file);await s.search('Hello');
 assert.equal(s.snapshot().status.key,'module');assert.deepEqual(net.probes,['https://me.github.io/Cyberpunk-beyond/vendor/pdfjs/pdf.worker.min.mjs']);
 net.worker=true;await s.search('Hello');assert.equal(s.snapshot().status.key,'ready');assert.equal(net.imports.at(-1),'./vendor/pdfjs/pdf.min.mjs?retry=1');
});

test('a damaged PDF with a working reader still says to check the file',async()=>{
 const {net,BookSearch}=load();net.damaged=true;
 const s=BookSearch.create();s.setFile(file);await s.search('Hello');
 assert.equal(s.snapshot().status.key,'error');assert.equal(net.probes.length,1);
 const plain=BookSearch.create(async()=>{throw Error('bad file')});plain.setFile(file);await plain.search('Hello');assert.equal(plain.snapshot().status.key,'error');
 const flagged=BookSearch.create(async()=>{throw Object.assign(Error('x'),{pdfModule:true})});flagged.setFile(file);await flagged.search('Hello');assert.equal(flagged.snapshot().status.key,'module');
});

test('the installed app asks its service worker to store the reader when online and idle',async()=>{
 const make=(extra={},controller={})=>{const posted=[];const navigator={onLine:true,connection:{},serviceWorker:{controller,ready:Promise.resolve({active:{postMessage:m=>posted.push(m)}})},...extra};return {posted,navigator}};
 let n=make();load({navigator:n.navigator});await flush();assert.deepEqual(n.posted,['cache-pdf']);
 n=make();load({navigator:n.navigator,build:''});await flush();assert.deepEqual(n.posted,[],'not in development copies without a service worker');
 n=make({connection:{saveData:true}});load({navigator:n.navigator});await flush();assert.deepEqual(n.posted,[],'data saver');
 n=make({connection:{effectiveType:'2g'}});load({navigator:n.navigator});await flush();assert.deepEqual(n.posted,[],'2G');
 n=make({onLine:false});const {win}=load({navigator:n.navigator});await flush();assert.deepEqual(n.posted,[]);
 n.navigator.onLine=true;win.listeners.online.forEach(f=>f());await flush();assert.deepEqual(n.posted,['cache-pdf'],'asks again when the device reconnects');
 assert.doesNotThrow(()=>load());
});

test('a first visit downloads only the app; the reader follows on a later start or once a search needs it',async()=>{
 const posted=[],navigator={onLine:true,connection:{saveData:true},serviceWorker:{controller:null,ready:Promise.resolve({active:{postMessage:m=>posted.push(m)}})}};
 const {net,win,BookSearch}=load({navigator});await flush();assert.deepEqual(posted,[],'not on the first visit');
 win.listeners.online.forEach(f=>f());await flush();assert.deepEqual(posted,[],'nor when it reconnects');
 navigator.onLine=false;net.module=net.worker=false;const s=BookSearch.create();s.setFile(file);await s.search('Hello');assert.equal(s.snapshot().status.key,'module');
 navigator.onLine=true;win.listeners.online.forEach(f=>f());await flush();assert.deepEqual(posted,['cache-pdf'],'after «connect once» the reader is stored, data saver or not');
});
