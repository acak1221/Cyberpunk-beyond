/* Clock files and starter clocks: a toolbar under the "new clock" form of the GM clocks card.
   - «Шаблоны»: a few ready clocks written for this app (wanted level, reinforcements, a deadline, a pool of
     dice, a timer). They are only a starting point: after adding, a clock is an ordinary one and can be edited.
   - Export / import: all clocks go to one JSON file and come back from one. The format follows the roll-table
     file of roll-tables.js: a format name, a version (a newer file is refused with a word), a size limit, every
     clock rebuilt field by field (GMExtras.cleanClock), a preview before anything changes, and a clock with the
     id of one you already have replaces it. What is local stays local: the "shown to players" switch, the link to
     a combat and the state of a running timer are neither written to the file nor taken from it. */
(function(global){
'use strict';
const FORMAT='nightcity-red-clocks',VERSION=1,MAX_FILE_CHARS=200000,MAX_SCAN=60;
const isObj=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const GX=()=>global.GMExtras||null;
const app=()=>global.App||null;
const stateNow=()=>{try{const a=app();return a&&typeof a.getState==='function'?a.getState():null}catch{return null}};
const langNow=l=>(l||app()?.lang?.())==='en'?'en':'ru';

const T={
 ru:{tpl:'Шаблоны',tplHelp:'Заготовки для быстрого старта: после добавления это обычные часы, их можно менять.',export:'Экспорт часов',import:'Импорт часов',importName:'Файл с часами',
  none:'Часов для экспорта пока нет.',added:n=>`Добавлены часы «${n}».`,full:'Достигнут предел — 30 часов.',
  preview:'Что будет при импорте',plan:(a,u,s)=>`Новых: ${a}, обновится: ${u}, без изменений: ${s}.`,overflow:n=>`Не поместятся (предел 30 часов): ${n}.`,rejected:n=>`Пропущено повреждённых или повторных записей: ${n}.`,nothing:'Нечего добавлять.',
  apply:'Добавить в мои часы',discard:'Отмена',st:{new:'новые',update:'заменят ваши',same:'без изменений',overflow:'не поместятся'},
  done:(a,u)=>`Импортировано часов: новых ${a}, обновлено ${u}.`,undo:'Отменить',undone:'Импорт отменён.',noUndo:'Отменить не удалось: часы уже изменились.',
  exported:n=>`Файл с часами сохранён (${n}).`,exportFail:'Не удалось сохранить файл.',
  err:{size:'Файл слишком большой.',json:'Не удалось прочитать файл: это не JSON.',format:'Это не файл с часами этого приложения.',newer:'Файл сделан более новой версией приложения. Обновите приложение.',empty:'В файле нет подходящих часов.'},
  file:'часы'},
 en:{tpl:'Templates',tplHelp:'Ready-made starters: once added they are ordinary clocks you can change.',export:'Export clocks',import:'Import clocks',importName:'Clocks file',
  none:'There are no clocks to export yet.',added:n=>`Added the clock “${n}”.`,full:'Limit reached — 30 clocks.',
  preview:'What the import will do',plan:(a,u,s)=>`New: ${a}, replaced: ${u}, unchanged: ${s}.`,overflow:n=>`Will not fit (limit 30 clocks): ${n}.`,rejected:n=>`Skipped broken or repeated entries: ${n}.`,nothing:'Nothing to add.',
  apply:'Add to my clocks',discard:'Cancel',st:{new:'new',update:'replaces yours',same:'unchanged',overflow:'will not fit'},
  done:(a,u)=>`Clocks imported: ${a} new, ${u} updated.`,undo:'Undo',undone:'The import is undone.',noUndo:'Could not undo: the clocks have changed since.',
  exported:n=>`Clocks file saved (${n}).`,exportFail:'Could not save the file.',
  err:{size:'The file is too big.',json:'Could not read the file: it is not JSON.',format:'This is not a clocks file of this app.',newer:'The file was made by a newer version of the app. Update the app.',empty:'There are no usable clocks in the file.'},
  file:'clocks'}
};

// ---------- starter clocks (own wording) ----------
const TEMPLATES=Object.freeze([
 {id:'wanted',ru:'Розыск',en:'Wanted',size:6,triggers:[
  {at:2,ru:'Патрули начинают присматриваться к приметам',en:'Patrols start to look for the description'},
  {at:4,ru:'За сведения о команде назначена награда',en:'A reward is posted for tips about the crew'},
  {at:6,ru:'Облава: за командой выезжают',en:'A sweep: units are sent after the crew'}]},
 {id:'reinforcements',ru:'Подкрепление',en:'Reinforcements',size:4,die:{sides:6,need:5},triggers:[
  {at:2,ru:'Слышно, как на подъезде гудят машины',en:'Engines can be heard on the approach'},
  {at:4,ru:'Подкрепление уже на месте',en:'The reinforcements are on the spot'}]},
 {id:'deadline',ru:'Срок',en:'Deadline',size:8,triggers:[
  {at:4,ru:'Половина срока позади',en:'Half of the time is gone'},
  {at:7,ru:'Времени почти не осталось',en:'Almost no time is left'},
  {at:8,ru:'Срок вышел',en:'The deadline is here'}]},
 {id:'margin',ru:'Запас скрытности',en:'Stealth margin',size:5,pool:{sides:6,face:1},triggers:[
  {at:4,ru:'Остался один кубик: тревога близко',en:'One die left: the alarm is close'},
  {at:5,ru:'Пул пуст: поднимается тревога',en:'The pool is empty: the alarm goes up'}]},
 {id:'scene',ru:'Таймер сцены',en:'Scene timer',size:4,countdown:10,triggers:[]}
]);
const textOf=(o,l)=>l==='en'?o.en:o.ru;

/* A new list with the starter added. Pure: the id comes from GMExtras.addClock like for any new clock. */
function addTemplate(list,id,lang,idMaker){
 const X=GX(),tpl=TEMPLATES.find(x=>x.id===id);
 if(!X||!tpl)return {ok:false,reason:'missing',clocks:list};
 const l=lang==='en'?'en':'ru';
 const r=X.addClock(list,textOf(tpl,l),tpl.size,idMaker?idMaker():undefined,tpl.pool?{pool:tpl.pool}:undefined);
 if(!r.ok)return {ok:false,reason:'full',clocks:list};
 const made=r.clocks[r.clocks.length-1];
 const u=X.updateClock(r.clocks,made.id,c=>{
  c.triggers=tpl.triggers.map(x=>({at:x.at,text:textOf(x,l)}));
  if(tpl.die)c.die={...tpl.die};
  if(tpl.countdown)c.countdown={ms:tpl.countdown*60000};
  return c;
 });
 return {ok:true,clocks:u.clocks,id:made.id,name:made.name};
}

// ---------- the file ----------
/* One clock as it goes into a file or is compared with one: only what belongs to the clock itself. */
function portable(c){
 const X=GX();if(!X||!isObj(c))return null;
 const x=X.cleanClock({...c,shared:false,tick:undefined,countdown:isObj(c.countdown)?{ms:c.countdown.ms}:undefined});
 return x;
}
function buildFile(clocks,now=new Date()){
 return {format:FORMAT,version:VERSION,exportedAt:now&&typeof now.toISOString==='function'&&!isNaN(now)?now.toISOString():'',clocks:(Array.isArray(clocks)?clocks:[]).map(portable).filter(Boolean).slice(0,GX()?.MAX_CLOCKS||30)};
}
function parseFile(text){
 if(typeof text!=='string'||text.length>MAX_FILE_CHARS)return {ok:false,reason:'size'};
 let raw;try{raw=JSON.parse(text)}catch{return {ok:false,reason:'json'}}
 if(!isObj(raw)||raw.format!==FORMAT||!Array.isArray(raw.clocks))return {ok:false,reason:'format'};
 if(typeof raw.version==='number'&&raw.version>VERSION)return {ok:false,reason:'newer'};
 const clocks=[],rejected=[],seen=new Set();
 for(const x of raw.clocks.slice(0,MAX_SCAN)){
  const c=portable(x);
  if(!c)rejected.push({reason:'broken'});
  else if(seen.has(c.id))rejected.push({reason:'twice',name:c.name});
  else{seen.add(c.id);clocks.push(c)}
 }
 if(!clocks.length)return {ok:false,reason:'empty',rejected};
 return {ok:true,clocks,rejected};
}
/* What an import would do, clock by clock. A clock with the id of one you have replaces it (your own sharing switch
   and combat link stay); the same content is skipped; what does not fit under the limit is left out. */
function planImport(current,pack){
 const X=GX(),max=X?.MAX_CLOCKS||30,rows=[];let list=current.slice(),added=0,updated=0,same=0,overflow=0;
 for(const c of pack.clocks){
  const old=list.find(x=>x.id===c.id);
  if(old&&JSON.stringify(portable(old))===JSON.stringify(c)){same++;rows.push({clock:c,status:'same'});continue}
  if(!old&&list.length>=max){overflow++;rows.push({clock:c,status:'overflow'});continue}
  if(old){const keep=old.countdown&&c.countdown&&old.countdown.ms===c.countdown.ms?old.countdown:c.countdown,merged=X.cleanClock({...c,shared:old.shared,tick:old.tick,...(keep?{countdown:keep}:{})});list=list.map(x=>x.id===c.id?merged:x);updated++}
  else{list=[...list,X.cleanClock({...c,shared:false})];added++}
  rows.push({clock:c,status:old?'update':'new'});
 }
 return {rows,list,added,updated,same,overflow};
}

// ---------- UI ----------
let ui={menu:false,preview:null,error:null};
function reset(){ui={menu:false,preview:null,error:null}}
const say=m=>{try{app()?.notify?.(m)}catch{}};
function download(raw,name){
 try{const blob=new Blob([raw],{type:'application/json'}),url=URL.createObjectURL(blob),a=global.document.createElement('a');a.href=url;a.download=name;global.document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);return true}catch{return false}
}
function fileName(now=new Date()){return 'night-city-clocks-'+now.toISOString().slice(0,10)+'.json'}

function toolbar(lang){
 const l=langNow(lang),t=T[l],id='cf-tpl-menu';
 let h=`<div class="cf-bar" data-cf-root><div class="cf-row"><button type="button" class="btn ghost" data-cf-action="tpl-toggle" aria-expanded="${ui.menu?'true':'false'}" aria-controls="${id}">${ui.menu?'▾':'▸'} ${esc(t.tpl)}</button><button type="button" class="btn ghost" data-cf-action="export">${esc(t.export)}</button><label class="btn ghost cf-file"><span>${esc(t.import)}</span><input type="file" class="cf-file-input" accept=".json,application/json" data-cf-file aria-label="${esc(t.importName)}"></label></div>`;
 if(ui.menu){
  h+=`<div class="cf-menu" id="${id}" role="group" aria-label="${esc(t.tpl)}"><p class="cf-note">${esc(t.tplHelp)}</p>${TEMPLATES.map(x=>`<button type="button" class="btn ghost cf-tpl" data-cf-action="tpl" data-cf-tpl="${esc(x.id)}">+ ${esc(textOf(x,l))}</button>`).join('')}</div>`;
 }
 if(ui.error)h+=`<p class="cf-error" role="alert" tabindex="-1" data-cf-error>${esc(t.err[ui.error]||t.err.format)}</p>`;
 if(ui.preview){
  const p=ui.preview,can=p.plan.added+p.plan.updated>0;
  h+=`<div class="cf-preview" data-cf-preview role="group" aria-label="${esc(t.preview)}"><p class="cf-head">${esc(t.preview)}</p><p class="cf-note">${esc(t.plan(p.plan.added,p.plan.updated,p.plan.same))}</p>${p.plan.overflow?`<p class="cf-note cf-warn">${esc(t.overflow(p.plan.overflow))}</p>`:''}${p.rejected.length?`<p class="cf-note cf-warn">${esc(t.rejected(p.rejected.length))}</p>`:''}<ul class="cf-plan">${p.plan.rows.map(r=>`<li><span>${esc(r.clock.name||'—')}</span><small>${esc(t.st[r.status])}</small></li>`).join('')}</ul>${can?'':`<p class="cf-note">${esc(t.nothing)}</p>`}<div class="cf-row">${can?`<button type="button" class="btn primary" data-cf-action="apply">${esc(t.apply)}</button>`:''}<button type="button" class="btn ghost" data-cf-action="discard">${esc(t.discard)}</button></div></div>`;
 }
 return h+'</div>';
}
function redraw(focusSel){
 try{GX()?.refresh?.()}catch{}
 if(focusSel)try{global.document?.querySelector?.(focusSel)?.focus?.()}catch{}
}
function openFile(text){
 const X=GX(),st=stateNow();
 const r=parseFile(text);
 if(!r.ok||!X||!st){ui.preview=null;ui.error=r.ok?'format':r.reason;return}
 ui.error=null;ui.preview={pack:r,rejected:r.rejected,plan:planImport(X.readClocks(st),r)};
}
function act(a,b,lang){
 const l=langNow(lang),t=T[l],X=GX(),st=stateNow();if(!X||!st)return false;
 if(a==='tpl-toggle'){ui.menu=!ui.menu;redraw('[data-cf-action="tpl-toggle"]');return true}
 if(a==='export'){
  const list=X.readClocks(st);if(!list.length){say(t.none);return true}
  const f=buildFile(list);
  say(download(JSON.stringify(f,null,2),fileName())?t.exported(f.clocks.length):t.exportFail);return true;
 }
 if(a==='tpl'){
  const tid=b?.dataset?.cfTpl,r=addTemplate(X.readClocks(st),tid,l);
  if(!r.ok){say(r.reason==='full'?t.full:'');return true}
  X.writeClocks(st,r.clocks);try{app().save()}catch{}
  say(t.added(r.name));
  redraw(`[data-cf-tpl="${tid}"]`);return true;
 }
 if(a==='discard'){ui.preview=null;ui.error=null;redraw('[data-cf-file]');return true}
 if(a==='apply'){
  const p=ui.preview;if(!p)return true;
  const before=X.readClocks(st),plan=planImport(before,p.pack);
  ui.preview=null;
  if(plan.added+plan.updated===0){redraw('[data-cf-file]');return true}
  X.writeClocks(st,plan.list);try{app().save()}catch{}
  const after=JSON.stringify(X.readClocks(st));
  const undo=()=>{
   const s2=stateNow();if(!s2)return;
   if(JSON.stringify(X.readClocks(s2))!==after){say(T[langNow()].noUndo);return}
   X.writeClocks(s2,before);try{app().save()}catch{}say(T[langNow()].undone);redraw('[data-cf-action="export"]');
  };
  const msg=t.done(plan.added,plan.updated);
  try{if(typeof app()?.notifyAction==='function')app().notifyAction(msg,t.undo,undo);else say(msg)}catch{}
  redraw('[data-cf-action="export"]');return true;
 }
 return false;
}
function handle(e,lang){
 const target=e?.target;if(!target)return false;
 if(e.type==='change'&&target.dataset?.cfFile!==undefined){
  const file=target.files?.[0];if(!file)return false;
  const show=()=>redraw(ui.error?'[data-cf-error]':'[data-cf-preview] .btn');
  if(Number(file.size)>MAX_FILE_CHARS*4){ui.preview=null;ui.error='size';show();return true}
  Promise.resolve().then(()=>file.text()).then(text=>{openFile(text);show()},()=>{ui.preview=null;ui.error='json';show()});
  return true;
 }
 if(e.type!=='click')return false;
 const b=target.closest?.('[data-cf-action]');if(!b||b.disabled)return false;
 return act(b.dataset.cfAction,b,lang);
}
if(global.document?.addEventListener)for(const type of ['click','change'])global.document.addEventListener(type,e=>{handle(e)});

global.ClockFile={FORMAT,VERSION,MAX_FILE_CHARS,MAX_SCAN,TEMPLATES,T,addTemplate,portable,buildFile,parseFile,planImport,toolbar,handle,act,openFile,reset,_test:{ui:()=>ui}};
})(typeof window!=='undefined'?window:globalThis);
