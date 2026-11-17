/* Lazy chunks. The production build (scripts/build.mjs) keeps the code of a few screens out of the file that starts the
   app (nc-red.js) and puts it into nc-<name>.js files; the page lists them in window.NC_CHUNKS, for example
   {book:{u:'nc-book.js?v=…',p:'Book',v:['book']}}: u is the file, p a global the file defines (how we know it has run),
   v the screens that need it. They are loaded the first time one of those screens opens (they are also in the service
   worker's offline copy, so this works without a network once the app is installed).
   Without the list (the unbundled site/ in development, and every unit test) everything is already loaded and nothing
   here does anything. No data is read or written; the only network request is for the app's own file. */
(function(global){
'use strict';
const T={
 ru:{load:'Загрузка раздела…',fail:'Не удалось загрузить раздел',hint:'Проверьте соединение и повторите попытку. Если не помогает, обновите страницу: возможно, вышла новая версия. Ваши данные сохранены, остальные разделы работают.',retry:'Повторить',reload:'Обновить страницу'},
 en:{load:'Loading the section…',fail:'The section could not be loaded',hint:'Check your connection and try again. If that does not help, reload the page: a new version may have come out. Your data is saved and the other sections still work.',retry:'Try again',reload:'Reload the page'}
};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const state=new Map();   // name -> 'loading' | 'failed'
const done=new Set();    // chunks whose file has run
const waiting=new Map(); // name -> [callbacks to run once the chunk is there]
const inflight=new Map();// name -> Promise<boolean>

const manifest=()=>{const m=global.NC_CHUNKS;return m&&typeof m==='object'&&!Array.isArray(m)?m:null};
const has=name=>{
 const m=manifest()?.[name];
 if(!m)return true;                     // unknown or no manifest: nothing to wait for
 return done.has(name)||typeof global[m.p]!=='undefined';
};
// The chunks a screen still needs, in manifest order.
function missing(view,m=manifest()){
 if(!m)return [];
 return Object.keys(m).filter(name=>Array.isArray(m[name]?.v)&&m[name].v.includes(view)&&!has(name));
}
function flush(name){
 const list=waiting.get(name)||[];waiting.delete(name);
 for(const fn of list){try{fn()}catch(e){global.console?.error?.(e)}}
}
function load(name){
 if(has(name)){flush(name);return Promise.resolve(true)}
 if(inflight.has(name))return inflight.get(name);
 const m=manifest()?.[name],doc=global.document;
 if(!m||typeof m.u!=='string'||!doc?.createElement)return Promise.resolve(false);
 state.set(name,'loading');
 const p=new Promise(resolve=>{
  const s=doc.createElement('script');
  s.src=m.u;s.async=true;
  s.onload=()=>{s.onload=s.onerror=null;done.add(name);state.delete(name);inflight.delete(name);flush(name);resolve(true)};
  s.onerror=()=>{s.onload=s.onerror=null;s.remove?.();state.set(name,'failed');inflight.delete(name);waiting.delete(name);resolve(false)};
  (doc.head||doc.documentElement).appendChild(s);
 });
 inflight.set(name,p);
 return p;
}
function ensure(names){return Promise.all([].concat(names||[]).map(load)).then(r=>r.every(Boolean))}

// Runs fn once the chunk is loaded (at once if it is). Loading starts if it has not. If it cannot load, fn is dropped.
function after(name,fn){
 if(has(name)){try{fn()}catch(e){global.console?.error?.(e)}return}
 (waiting.get(name)||waiting.set(name,[]).get(name)).push(fn);
 load(name);
}

const card=(lang,failed)=>{
 const t=T[lang==='en'?'en':'ru'];
 return failed
  ?`<section class="card nc-lazy" role="alert"><h1 class="nc-lazy-title" tabindex="-1">${esc(t.fail)}</h1><p>${esc(t.hint)}</p><div class="nc-lazy-actions"><button type="button" class="btn primary" data-lazy-retry>${esc(t.retry)}</button><button type="button" class="btn" data-lazy-reload>${esc(t.reload)}</button></div></section>`
  :`<section class="card nc-lazy" role="status" aria-live="polite"><h1 class="nc-lazy-title" tabindex="-1">${esc(t.load)}</h1><div class="nc-lazy-bar" aria-hidden="true"></div></section>`;
};

// Called by the app before it draws a screen. '' means "go ahead"; otherwise it is the HTML to show for now, and
// rerender() is called when the files have arrived (or failed, which shows the retry card).
const watching=new Set(); // screens whose redraw is already scheduled
function pending(view,rerender,lang){
 const names=missing(view);
 if(!names.length)return '';
 const failed=names.some(n=>state.get(n)==='failed');
 if(!failed&&!watching.has(view)){
  watching.add(view);
  ensure(names).then(()=>{
   watching.delete(view);
   // Someone who moved on to another screen meanwhile is not disturbed (a redraw would reset what they type).
   let now=view;try{now=global.App?.getState?.().view??view}catch{}
   if(now!==view)return;
   if(typeof rerender==='function')rerender();
   settle();
  });
 }
 return card(lang,failed);
}

// After the real screen replaced the placeholder, the focus goes to its heading if it was lost with the placeholder.
function settle(){
 try{
  const doc=global.document,active=doc?.activeElement;
  if(active&&active!==doc.body)return;
  const h=doc.querySelector?.('#app .content h1');
  if(h){h.tabIndex=-1;h.focus({preventScroll:true})}
 }catch{}
}

function retry(){
 for(const [name,s] of [...state])if(s==='failed')state.delete(name);
 try{global.App?.render?.()}catch{}
}
global.document?.addEventListener?.('click',e=>{
 if(e.target?.closest?.('[data-lazy-retry]')){e.preventDefault?.();retry();return}
 // A page left open across an update asks for files that are gone; a reload brings the new version (the app saves as it goes).
 if(e.target?.closest?.('[data-lazy-reload]')){e.preventDefault?.();try{global.location?.reload?.()}catch{}}
});

global.NCLazy={pending,after,ensure,load,missing,has,retry,card,T,
 _test:{state,done,waiting,inflight,reset(){state.clear();done.clear();waiting.clear();inflight.clear();watching.clear()}}};
})(typeof window!=='undefined'?window:globalThis);
