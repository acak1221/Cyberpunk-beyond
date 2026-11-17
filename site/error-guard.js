/* Error guard. Loaded first. A script error or a rejected promise must not leave the player guessing: a small banner says,
   in both languages, that the data is saved, offers a reload and copies diagnostics that can be pasted into a bug report.
   It never blocks the page and never moves the focus. The last 20 messages are kept in memory only; nothing is stored or sent. */
(function(global){
'use strict';
const doc=global.document;
const MAX_LOG=20,MAX_TEXT=300;
const T={
 ru:{unsure:'Что-то пошло не так. Приложение сообщает, что последние правки могут быть не сохранены: скачайте копию данных, затем перезагрузите страницу.',text:'Что-то пошло не так. Ваши данные сохранены в этом браузере. Перезагрузите страницу: обычно этого достаточно.',reload:'Перезагрузить',copy:'Скопировать сведения',copied:'Сведения скопированы.',copyFail:'Не удалось скопировать. Выделите текст ниже и скопируйте его вручную.',close:'Скрыть',label:'Сообщение об ошибке',again:n=>`Повторилось раз: ${n}`},
 en:{unsure:'Something went wrong. The app reports that your latest edits may not be saved: download a backup copy, then reload the page.',text:'Something went wrong. Your data is saved in this browser. Reload the page: that is usually enough.',reload:'Reload',copy:'Copy diagnostics',copied:'Diagnostics copied.',copyFail:'Could not copy. Select the text below and copy it by hand.',close:'Dismiss',label:'Error message',again:n=>`Repeated: ${n}`}
};
const log=[];
let waiting=false,shown=null,lastKey='',lastAt=0,repeats=0;
const lang=()=>{try{const l=global.App?.lang?.()||doc?.documentElement?.lang;return l==='en'?'en':'ru'}catch{return 'ru'}};
const t=(l,k)=>T[l==='en'?'en':'ru'][k];
const clip=(s,n=MAX_TEXT)=>{s=String(s??'');return s.length>n?s.slice(0,n-1)+'…':s};
// Errors that are not the app's: browser extensions, and a harmless layout notice that some browsers report as an error.
function ignorable(message,source){
 if(/^(chrome|moz|safari-web)-extension:/.test(String(source||'')))return true;
 return /ResizeObserver loop/i.test(String(message||''));
}
function record(kind,message,source,line){
 message=clip(message||'(no message)');
 if(ignorable(message,source))return null;
 const entry={at:Date.now(),kind,message,source:clip(source||'',160),line:Number.isFinite(line)?line:0};
 log.push(entry);if(log.length>MAX_LOG)log.splice(0,log.length-MAX_LOG);
 return entry;
}
// The store's own status line says when saving failed or editing is paused; then this banner must not promise that all is saved.
const BAD_STATUS=/ОШИБКА СОХРАНЕНИЯ|ПРИОСТАНОВЛЕНО|SAVE FAILED|EDITING PAUSED/i;
function saveProblem(){try{const n=doc?.querySelector?.('#store-status');return !!n&&BAD_STATUS.test(String(n.textContent||''))}catch{return false}}
function version(){try{return doc?.documentElement?.dataset?.build||'dev'}catch{return 'dev'}}
// Diagnostics hold messages, the build and the browser. The address is cut after the section name, so no sheet id leaves the page.
function diagnostics(now=Date.now()){
 const nav=global.navigator||{},lines=['Night City // RED diagnostics','build: '+version(),'time: '+new Date(now).toISOString(),'agent: '+clip(nav.userAgent||'',200),'language: '+(nav.language||''),'view: '+clip(String(global.location?.hash||'').split('/').slice(0,2).join('/'),40),'online: '+(nav.onLine===undefined?'?':nav.onLine)];
 if(!log.length)lines.push('(no errors recorded)');
 for(const e of log)lines.push(`[${new Date(e.at).toISOString()}] ${e.kind}: ${e.message}${e.source?' @ '+e.source+(e.line?':'+e.line:''):''}`);
 return lines.join('\n');
}
const STYLE='#nc-error-guard{position:fixed;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom,0px));z-index:3000;max-width:640px;margin:0 auto;padding:12px 14px;color:#f4f4f6;background:#2b1514;border:1px solid #ff453a;border-radius:12px;box-shadow:0 8px 28px rgba(0,0,0,.5);font:14px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif}#nc-error-guard p{margin:0 0 8px}#nc-error-guard .ncg-row{display:flex;flex-wrap:wrap;gap:8px}#nc-error-guard button{min-height:44px;padding:8px 14px;color:#f4f4f6;background:#3a2523;border:1px solid #ff453a;border-radius:10px;font:inherit;font-weight:600;cursor:pointer}#nc-error-guard button:focus-visible{outline:2px solid #ffcc4d;outline-offset:2px}#nc-error-guard textarea{display:block;width:100%;min-height:96px;margin-top:8px;color:#f4f4f6;background:#18181b;border:1px solid #555;border-radius:8px;font:12px/1.4 ui-monospace,Consolas,monospace}#nc-error-guard small{display:block;margin-top:6px;color:#d4d4da}@media print{#nc-error-guard{display:none}}';
function ensureStyle(){
 if(!doc||doc.getElementById('nc-error-guard-style'))return;
 const s=doc.createElement('style');s.id='nc-error-guard-style';s.textContent=STYLE;(doc.head||doc.documentElement).appendChild(s);
}
function el(tag,props){const n=doc.createElement(tag);for(const [k,v] of Object.entries(props||{}))n.setAttribute(k,v);return n}
function hide(){if(shown){try{shown.remove()}catch{}shown=null}}
async function copyText(text){
 try{if(global.navigator?.clipboard?.writeText){await global.navigator.clipboard.writeText(text);return true}}catch{}
 try{
  const ta=doc.createElement('textarea');ta.value=text;ta.setAttribute('readonly','');ta.style.cssText='position:fixed;left:-9999px;top:0';doc.body.appendChild(ta);
  const prior=doc.activeElement;ta.select();const ok=doc.execCommand?.('copy');ta.remove();try{prior?.focus?.({preventScroll:true})}catch{}return !!ok;
 }catch{return false}
}
function show(){
 // An error before the page body exists is shown as soon as the body is there.
 if(!doc?.body){if(!waiting&&doc?.addEventListener){waiting=true;doc.addEventListener('DOMContentLoaded',()=>{waiting=false;if(log.length)show()},{once:true})}return false}
 const l=lang();
 if(shown&&shown.isConnected){
  const first=shown.querySelector('p');if(first)first.textContent=t(l,saveProblem()?'unsure':'text');
  const note=shown.querySelector('[data-ncg-repeat]');if(note){note.textContent=repeats>0?t(l,'again')(repeats+1):'';note.hidden=!(repeats>0)}
  return true;
 }
 ensureStyle();
 const box=el('div',{id:'nc-error-guard',role:'alert','aria-label':t(l,'label')});
 const text=el('p');text.textContent=t(l,saveProblem()?'unsure':'text');
 const row=el('div',{class:'ncg-row'});
 const reload=el('button',{type:'button','data-ncg':'reload'});reload.textContent=t(l,'reload');
 const copy=el('button',{type:'button','data-ncg':'copy'});copy.textContent=t(l,'copy');
 const close=el('button',{type:'button','data-ncg':'close'});close.textContent=t(l,'close');
 row.append(reload,copy,close);
 const rep=el('small',{'data-ncg-repeat':''});rep.hidden=true;
 const status=el('small',{'data-ncg-status':'',role:'status'});
 box.append(text,row,rep,status);
 box.addEventListener('click',async e=>{
  const b=e.target?.closest?.('[data-ncg]');if(!b)return;
  const what=b.getAttribute('data-ncg'),now=lang();
  if(what==='reload'){try{global.location.reload()}catch{}}
  else if(what==='close'){
   // The focus was never moved here, so closing leaves it where the reader was; if a button of the banner had it, it goes to the page.
   const had=box.contains(doc.activeElement);hide();if(had)try{(doc.querySelector('#main-content')||doc.body).focus?.({preventScroll:true})}catch{}
  }else if(what==='copy'){
   const body=diagnostics(),ok=await copyText(body);
   status.textContent=ok?t(now,'copied'):t(now,'copyFail');
   if(!ok&&!box.querySelector('textarea')){const ta=el('textarea',{readonly:'','aria-label':t(now,'copy')});ta.value=body;box.append(ta)}
  }
 });
 doc.body.appendChild(box);shown=box;return true;
}
function report(kind,message,source,line){
 try{
  const entry=record(kind,message,source,line);if(!entry)return false;
  const key=kind+'|'+entry.message;
  if(key===lastKey&&entry.at-lastAt<5000)repeats++;else{lastKey=key;repeats=0}
  lastAt=entry.at;
  return show();
 }catch{return false}
}
function reasonText(r){
 if(r&&typeof r==='object')return (r.name?r.name+': ':'')+(r.message||'');
 return String(r??'');
}
if(global.addEventListener){
 global.addEventListener('error',e=>{
  // A failed image or stylesheet has no message of its own; only script errors count.
  if(e&&e.target&&e.target!==global&&!e.message)return;
  report('error',e?.message||reasonText(e?.error),e?.filename,e?.lineno);
 });
 global.addEventListener('unhandledrejection',e=>{report('promise',reasonText(e?.reason))});
}
global.ErrorGuard={T,saveProblem,log:()=>log.slice(),report,diagnostics,hide,MAX_LOG,_test:{record,reset(){log.length=0;lastKey='';lastAt=0;repeats=0;hide()},shown:()=>shown}};
})(typeof window!=='undefined'?window:globalThis);
