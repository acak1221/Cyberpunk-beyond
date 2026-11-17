/* The reader remembers the person's own PDF on this device — only if they ask it to.
   The file, the text of each page (so that search needs no second reading of the book) and the last page opened are kept in this
   browser's IndexedDB. Nothing is sent anywhere; «Забыть книгу» removes all of it. Without the opt-in nothing is stored. */
(function(global){
'use strict';
const DB='nightcity-red-book',STORE='kv',FLAG='nightcity-red-book-keep-v1';
const MAX_BYTES=400*1024*1024,MAX_PAGES=1000,MAX_PAGE_CHARS=200000,MAX_INDEX_CHARS=40000000,MAX_BOOK_PAGE=457;
const T={
 ru:{keep:'Помнить мою книгу на этом устройстве',help:'Файл и текст страниц для поиска хранятся только в этом браузере и никуда не отправляются. После перезагрузки книга откроется сама на последней странице. Если не включать, ничего не сохраняется.',unsupported:'Этот браузер не позволяет хранить файл на устройстве.',size:'Занято на устройстве',file:'файл',index:'текст для поиска',none:'Пока ничего не сохранено: выберите PDF.',forget:'Забыть книгу',forgetConfirm:'Удалить сохранённую книгу и текст для поиска с этого устройства? Свой PDF-файл вы не потеряете.',saved:'Книга сохранена на этом устройстве',forgotten:'Книга удалена с этого устройства',failed:'Не удалось сохранить книгу на устройстве: не хватает места или браузер не разрешил.',big:'Файл слишком большой, чтобы хранить его на устройстве.',restored:'Открыта сохранённая книга',lastPage:'последняя страница',kb:'КБ',mb:'МБ'},
 en:{keep:'Remember my book on this device',help:'The file and the text of its pages for search are kept only in this browser and are never sent anywhere. After a reload the book opens by itself on the last page. If you leave this off, nothing is stored.',unsupported:'This browser cannot keep a file on the device.',size:'Used on this device',file:'file',index:'search text',none:'Nothing is stored yet: choose a PDF.',forget:'Forget the book',forgetConfirm:'Delete the stored book and its search text from this device? Your own PDF file is not affected.',saved:'The book is saved on this device',forgotten:'The book was removed from this device',failed:'The book could not be saved on this device: not enough space, or the browser did not allow it.',big:'The file is too large to keep on the device.',restored:'Opened the saved book',lastPage:'last page',kb:'KB',mb:'MB'},
};
const lang=l=>l==='en'?'en':'ru';
const tx=(l,k)=>T[lang(l)][k]??T.ru[k]??k;
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// 1234567 -> «1,2 МБ». Sizes are shown so that the person can judge what the book costs the device.
function formatSize(bytes,l='ru'){
 const n=Number(bytes);if(!Number.isFinite(n)||n<=0)return '0 '+tx(l,'kb');
 const mb=n/1048576;
 if(mb>=1)return (mb>=100?String(Math.round(mb)):mb.toFixed(1).replace(/\.0$/,'')).replace('.',lang(l)==='ru'?',':'.')+' '+tx(l,'mb');
 return Math.max(1,Math.round(n/1024))+' '+tx(l,'kb');
}
const clampPage=n=>Math.max(1,Math.min(MAX_BOOK_PAGE,Math.floor(Number(n))||1));
// The text of each page, as read from a PDF: rebuilt from known fields before it is stored or used, whatever came out of the store.
function validIndex(list){
 if(!Array.isArray(list)||!list.length||list.length>MAX_PAGES)return null;
 const out=[];let chars=0,last=0;
 for(const p of list){
  if(!p||typeof p!=='object'||!Number.isInteger(p.page)||p.page<1||p.page>MAX_PAGES||p.page<=last||typeof p.text!=='string'||p.text.length>MAX_PAGE_CHARS)return null;
  chars+=p.text.length;if(chars>MAX_INDEX_CHARS)return null;
  last=p.page;out.push({page:p.page,text:p.text});
 }
 return out;
}

/* ---- the store ---- */
const idbOf=opts=>opts?.indexedDB||global.indexedDB||null;
const supported=opts=>{try{return !!idbOf(opts)}catch{return false}};
function open(idb){
 return new Promise((resolve,reject)=>{
  let r;try{r=idb.open(DB,1)}catch(e){reject(e);return}
  r.onupgradeneeded=()=>{try{r.result.createObjectStore(STORE)}catch{}};
  r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error||Error('open'));r.onblocked=()=>reject(Error('blocked'));
 });
}
// One transaction: work(store) returns the request whose result is wanted (or nothing).
async function run(opts,mode,work){
 const idb=idbOf(opts);if(!idb)throw Error('unsupported');
 const db=await open(idb);
 try{
  return await new Promise((resolve,reject)=>{
   let t,req;
   try{t=db.transaction(STORE,mode);req=work(t.objectStore(STORE))}catch(e){reject(e);return}
   t.oncomplete=()=>resolve(req&&'result' in req?req.result:undefined);
   t.onerror=()=>reject(t.error||req?.error||Error('transaction'));t.onabort=()=>reject(t.error||Error('aborted'));
  });
 }finally{try{db.close()}catch{}}
}
const get=(opts,key)=>run(opts,'readonly',s=>s.get(key));
const reasonOf=e=>e&&(e.name==='QuotaExceededError'||/quota/i.test(String(e.name||e.message)))?'quota':'error';

// Stores the chosen file. A new file replaces the old one and the text read from it; it opens on page 1.
async function save(file,opts={}){
 if(!file||typeof file.size!=='number'||file.size<=0)return {ok:false,reason:'error'};
 if(file.size>MAX_BYTES)return {ok:false,reason:'big'};
 try{
  const est=await (opts.storage||global.navigator?.storage)?.estimate?.();
  if(est&&Number.isFinite(est.quota)&&Number.isFinite(est.usage)&&est.quota-est.usage<file.size*1.1)return {ok:false,reason:'quota'};
 }catch{}
 try{
  await run(opts,'readwrite',s=>{
   s.delete('index');s.put(1,'page');
   return s.put({blob:file,name:String(file.name||'book.pdf').slice(0,200),size:file.size,type:'application/pdf',at:Date.now()},'file');
  });
  return {ok:true,size:file.size};
 }catch(e){return {ok:false,reason:reasonOf(e)}}
}
async function saveIndex(pages,opts={}){
 const list=validIndex(pages);if(!list)return {ok:false,reason:'invalid'};
 let chars=0;for(const p of list)chars+=p.text.length;
 try{
  // Only for the book that is stored: without one, the text would belong to nothing.
  if(!await get(opts,'file'))return {ok:false,reason:'nofile'};
  await run(opts,'readwrite',s=>s.put({pages:list,chars,at:Date.now()},'index'));
  return {ok:true,chars};
 }catch(e){return {ok:false,reason:reasonOf(e)}}
}
async function savePage(n,opts={}){try{await run(opts,'readwrite',s=>s.put(clampPage(n),'page'));return true}catch{return false}}
// What is stored, for opening it again: {blob,name,size,page,index} or null. A damaged record counts as nothing stored.
async function load(opts={}){
 try{
  const rec=await get(opts,'file');
  if(!rec||!rec.blob||typeof rec.blob.size!=='number'||rec.blob.size<=0||rec.blob.size>MAX_BYTES)return null;
  const [page,idx]=await Promise.all([get(opts,'page'),get(opts,'index')]);
  return {blob:rec.blob,name:typeof rec.name==='string'?rec.name.slice(0,200):'book.pdf',size:rec.blob.size,page:clampPage(page),index:idx&&validIndex(idx.pages)||null};
 }catch{return null}
}
// What the book costs the device, without reading the file itself: {name,size,indexChars,page,at} or null.
async function info(opts={}){
 try{
  const rec=await get(opts,'file');if(!rec||!rec.blob||typeof rec.blob.size!=='number')return null;
  const [page,idx]=await Promise.all([get(opts,'page'),get(opts,'index')]);
  return {name:typeof rec.name==='string'?rec.name.slice(0,200):'book.pdf',size:rec.blob.size,indexChars:idx&&Number.isFinite(idx.chars)?idx.chars:0,page:clampPage(page),at:Number(rec.at)||0};
 }catch{return null}
}
async function forget(opts={}){
 try{await run(opts,'readwrite',s=>s.clear())}catch{
  try{const idb=idbOf(opts);if(idb?.deleteDatabase)await new Promise(r=>{const q=idb.deleteDatabase(DB);q.onsuccess=q.onerror=q.onblocked=()=>r()})}catch{}
  return false;
 }
 return true;
}

/* ---- the opt-in: a plain flag in this browser, off until the person turns it on ---- */
function optedIn(storage){try{return (storage||global.localStorage).getItem(FLAG)==='1'}catch{return false}}
function setOptIn(on,storage){try{const s=storage||global.localStorage;if(on)s.setItem(FLAG,'1');else s.removeItem(FLAG);return true}catch{return false}}

// The card of the book screen. state: {remember, info:{size,indexChars,page}|null, supported, lang}
function card(state){
 const l=lang(state.lang),i=state.info;
 const size=i?`<p class="book-memory-size" role="status">${esc(tx(l,'size'))}: <b>${esc(formatSize(i.size+i.indexChars,l))}</b> (${esc(tx(l,'file'))} ${esc(formatSize(i.size,l))}${i.indexChars?` + ${esc(tx(l,'index'))} ${esc(formatSize(i.indexChars,l))}`:''}) · ${esc(tx(l,'lastPage'))} ${i.page}</p>`:state.remember?`<p class="book-memory-size" role="status">${esc(tx(l,'none'))}</p>`:'';
 return `<section class="card book-memory" data-book-memory><label class="book-keep"><input type="checkbox" id="book-keep"${state.remember?' checked':''}${state.supported===false?' disabled':''}> <span>${esc(tx(l,'keep'))}</span></label><p>${esc(state.supported===false?tx(l,'unsupported'):tx(l,'help'))}</p>${size}${i?`<button type="button" class="btn ghost" data-book-action="forget">${esc(tx(l,'forget'))}</button>`:''}<p class="book-memory-note" role="status" aria-live="polite">${esc(state.note||'')}</p></section>`;
}

global.BookMemory={TEXT:T,tx,formatSize,clampPage,validIndex,supported,save,saveIndex,savePage,load,info,forget,optedIn,setOptIn,card,FLAG,DB,MAX_BYTES};
})(typeof window!=='undefined'?window:globalThis);
