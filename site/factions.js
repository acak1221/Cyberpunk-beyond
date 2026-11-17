/* Factions: the groups of a campaign world that the Game Master keeps track of, saved in state.gmExtras.factions
   (cap 40, so the full backup and the transfer of a device carry them with everything else in gmExtras). A faction has
   a name, a type (gang, corporation, law, media, fixer, other), an attitude to the crew from -3 to +3, a private
   note and, optionally, a link to one of the progress clocks (what the faction is working towards) and to a campaign.
   Everything here is the GM's own: nothing is written to the room payload or to a journal. The module has no content of
   its own, only the fields. render(lang) returns the card for the GM hub; the events are delegated on the document. */
(function(global){
'use strict';
const MAX=40,MAX_NAME=60,MAX_NOTE=500;
const TYPES=Object.freeze(['gang','corp','law','media','fixer','other']);
const isObj=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const app=()=>global.App||null;
const stateNow=()=>{try{const a=app();return a&&typeof a.getState==='function'?a.getState():null}catch{return null}};
const langNow=l=>(l||app()?.lang?.())==='en'?'en':'ru';
const ID=/^[A-Za-z0-9_-]{1,40}$/;

const T={
 ru:{title:'ФРАКЦИИ',sub:'ТОЛЬКО ДЛЯ ВЕДУЩЕГО',intro:'Банды, корпорации, закон, медиа и фиксеры вашего мира: кто как относится к команде и к чему идёт. Всё это видите только вы.',
  name:'Название',namePh:'Напр. «Ржавые голуби»',type:'Тип',types:{gang:'Банда',corp:'Корпорация',law:'Закон',media:'Медиа',fixer:'Фиксер',other:'Другое'},
  attitude:'Отношение к команде',att:{'-3':'Враг','-2':'Недруг','-1':'Холодно','0':'Нейтрально','1':'Тепло','2':'Друг','3':'Союзник'},worse:'Хуже отношение',better:'Лучше отношение',
  note:'Заметка (видите только вы)',notePh:'Чего хотят, чем можно надавить, кто в верхушке',clock:'Часы фракции',noClock:'Без часов',clockNow:(n,f,s)=>`Часы «${n}»: ${f}/${s}`,
  camp:'Кампания',anyCamp:'Любая',add:'Добавить фракцию',none:'Фракций пока нет.',limit:`Достигнут предел — ${MAX} фракций.`,
  del:'Удалить',confirm:'Точно удалить?',deleted:'Фракция удалена.',undo:'Отменить',restored:'Фракция возвращена.',noUndo:'Вернуть не удалось: список уже изменился.',gone:'Этой фракции уже нет.',unnamed:'Без названия',
  needName:'Введите название фракции.',added:n=>`Фракция «${n}» добавлена.`,count:n=>`${n} из ${MAX}`,list:'Список фракций'},
 en:{title:'FACTIONS',sub:'GM ONLY',intro:'The gangs, corporations, law, media and fixers of your world: how each one feels about the crew and what it is working towards. Only you see this.',
  name:'Name',namePh:'E.g. “The Rusty Doves”',type:'Type',types:{gang:'Gang',corp:'Corporation',law:'Law',media:'Media',fixer:'Fixer',other:'Other'},
  attitude:'Attitude to the crew',att:{'-3':'Enemy','-2':'Hostile','-1':'Cold','0':'Neutral','1':'Warm','2':'Friend','3':'Ally'},worse:'Worse attitude',better:'Better attitude',
  note:'Note (only you see it)',notePh:'What they want, how to lean on them, who runs them',clock:'Faction clock',noClock:'No clock',clockNow:(n,f,s)=>`Clock “${n}”: ${f}/${s}`,
  camp:'Campaign',anyCamp:'Any',add:'Add a faction',none:'No factions yet.',limit:`Limit reached — ${MAX} factions.`,
  del:'Delete',confirm:'Really delete?',deleted:'The faction is deleted.',undo:'Undo',restored:'The faction is back.',noUndo:'Could not bring it back: the list has changed.',gone:'This faction is no longer there.',unnamed:'Untitled',
  needName:'Enter a name for the faction.',added:n=>`Faction “${n}” added.`,count:n=>`${n} of ${MAX}`,list:'Factions'}
};

// ---------- stored data ----------
const line=(v,n)=>typeof v==='string'?v.replace(/[\u0000-\u001f\u007f\u2028\u2029]/g,' ').replace(/\s+/g,' ').trim().slice(0,n).trim():'';
const para=(v,n)=>typeof v==='string'?v.replace(/\t/g,' ').replace(/[\u2028\u2029]/g,'\n').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g,'').replace(/\n{3,}/g,'\n\n').trim().slice(0,n).trim():'';
const attitudeOf=v=>{const n=Math.round(Number(v));return Number.isFinite(n)?Math.max(-3,Math.min(3,n)):0};
// One faction rebuilt from known fields. A key appears only when it holds something, always in the same order.
function clean(raw){
 if(!isObj(raw)||typeof raw.id!=='string'||!ID.test(raw.id))return null;
 const out={id:raw.id,name:line(raw.name,MAX_NAME),type:TYPES.includes(raw.type)?raw.type:'other',attitude:attitudeOf(raw.attitude)};
 const note=para(raw.note,MAX_NOTE);if(note)out.note=note;
 if(typeof raw.clock==='string'&&ID.test(raw.clock))out.clock=raw.clock;
 if(typeof raw.camp==='string'&&ID.test(raw.camp))out.camp=raw.camp;
 return out;
}
function read(state){
 const raw=isObj(state)&&isObj(state.gmExtras)?state.gmExtras.factions:null;
 if(!Array.isArray(raw))return [];
 const out=[],seen=new Set();
 for(const x of raw){const f=clean(x);if(f&&!seen.has(f.id)){seen.add(f.id);out.push(f)}if(out.length>=MAX)break}
 return out;
}
function write(state,list){
 if(!isObj(state))return false;
 if(!isObj(state.gmExtras))state.gmExtras={};
 const out=(Array.isArray(list)?list:[]).map(clean).filter(Boolean).slice(0,MAX);
 if(out.length)state.gmExtras.factions=out;else delete state.gmExtras.factions;
 return true;
}
let seq=0;
const newId=()=>'fc-'+Date.now().toString(36)+'-'+(seq++).toString(36)+Math.floor(Math.random()*1296).toString(36);
// Pure operations on a clean list; each returns {ok, list, ...}.
function add(list,fields,id=newId()){
 if(list.length>=MAX)return {ok:false,reason:'full',list};
 const f=clean({...(isObj(fields)?fields:{}),id});
 if(!f||!f.name)return {ok:false,reason:'empty',list};
 return {ok:true,id:f.id,list:[...list,f]};
}
function update(list,id,fn){
 let ok=false;
 const out=list.map(f=>{if(f.id!==id)return f;const g=clean(fn({...f}));if(!g)return f;ok=true;return g});
 return {ok,list:out};
}
function remove(list,id){
 const index=list.findIndex(f=>f.id===id);if(index<0)return {ok:false,list};
 return {ok:true,entry:list[index],index,list:list.filter(f=>f.id!==id)};
}
function restore(list,entry,index){
 const f=clean(entry);if(!f||list.some(x=>x.id===f.id)||list.length>=MAX)return {ok:false,list};
 const at=Number.isInteger(index)?Math.max(0,Math.min(index,list.length)):list.length,out=list.slice();out.splice(at,0,f);
 return {ok:true,list:out};
}
const shift=(f,d)=>({...f,attitude:attitudeOf(f.attitude+d)});

// ---------- markup ----------
let ui={draft:'',type:'gang',armed:null};
function reset(){ui={draft:'',type:'gang',armed:null}}
const clocksOf=st=>{try{return global.GMExtras?.readClocks?.(st)||[]}catch{return []}};
const campsOf=st=>(Array.isArray(st?.campaigns)?st.campaigns:[]).filter(c=>isObj(c)&&typeof c.id==='string'&&ID.test(c.id));
function row(f,t,clocks,camps){
 const id=esc(f.id),link=f.clock?clocks.find(c=>c.id===f.clock):null,armed=ui.armed===f.id;
 const att=String(f.attitude),tone=f.attitude<0?'neg':f.attitude>0?'pos':'neu';
 return `<li class="fc-item" data-fc-item="${id}"><div class="fc-top"><input type="text" class="fc-name" maxlength="${MAX_NAME}" data-fc-field="name" data-fc-id="${id}" value="${esc(f.name)}" placeholder="${esc(t.unnamed)}" aria-label="${esc(t.name)}"><select data-fc-field="type" data-fc-id="${id}" aria-label="${esc(t.type)}">${TYPES.map(k=>`<option value="${k}"${f.type===k?' selected':''}>${esc(t.types[k])}</option>`).join('')}</select></div>`
 +`<div class="fc-att fc-${tone}" role="group" aria-label="${esc(t.attitude)}"><button type="button" class="btn ghost fc-step" data-fc-action="worse" data-fc-id="${id}" aria-label="${esc(t.worse)}">−</button><strong aria-live="polite"><span class="fc-num">${f.attitude>0?'+':f.attitude<0?'−':''}${Math.abs(f.attitude)}</span> <span class="fc-word">${esc(t.att[att])}</span></strong><button type="button" class="btn ghost fc-step" data-fc-action="better" data-fc-id="${id}" aria-label="${esc(t.better)}">+</button></div>`
 +`<label class="field fc-field">${esc(t.note)}<textarea rows="2" maxlength="${MAX_NOTE}" data-fc-field="note" data-fc-id="${id}" placeholder="${esc(t.notePh)}">${esc(f.note||'')}</textarea></label>`
 +`<label class="field fc-field">${esc(t.clock)}<select data-fc-field="clock" data-fc-id="${id}"><option value="">${esc(t.noClock)}</option>${clocks.map(c=>`<option value="${esc(c.id)}"${f.clock===c.id?' selected':''}>${esc((c.name||'—').slice(0,60))}</option>`).join('')}</select></label>`
 +(link?`<p class="fc-clock">${esc(t.clockNow(link.name||'—',link.pool?link.size-link.filled:link.filled,link.size))}</p>`:'')
 +(camps.length?`<label class="field fc-field">${esc(t.camp)}<select data-fc-field="camp" data-fc-id="${id}"><option value="">${esc(t.anyCamp)}</option>${camps.map(c=>`<option value="${esc(c.id)}"${f.camp===c.id?' selected':''}>${esc(String(c.name||'—').slice(0,60))}</option>`).join('')}</select></label>`:'')
 +`<div class="fc-actions"><button type="button" class="btn ghost fc-del${armed?' armed':''}" data-fc-action="del" data-fc-id="${id}">✕ ${esc(armed?t.confirm:t.del)}</button></div></li>`;
}
function render(lang){
 const l=langNow(lang),t=T[l],st=stateNow(),list=read(st),clocks=clocksOf(st),camps=campsOf(st);
 let h=`<section class="card fc-card" data-fc-root data-lang="${l}"><div class="card-heading"><span>${esc(t.title)}</span><span>${esc(t.sub)}</span></div><p class="fc-note">${esc(t.intro)}</p>`;
 h+=`<div class="fc-new"><label class="field">${esc(t.name)}<input type="text" maxlength="${MAX_NAME}" data-fc-field="draft" placeholder="${esc(t.namePh)}" value="${esc(ui.draft)}"></label><label class="field">${esc(t.type)}<select data-fc-field="newtype">${TYPES.map(k=>`<option value="${k}"${ui.type===k?' selected':''}>${esc(t.types[k])}</option>`).join('')}</select></label><button type="button" class="btn primary" data-fc-action="add"${list.length>=MAX?' aria-disabled="true"':''}>+ ${esc(t.add)}</button></div>`;
 h+=`<p class="fc-note" role="status">${esc(list.length>=MAX?t.limit:list.length?t.count(list.length):t.none)}</p>`;
 if(list.length)h+=`<ul class="fc-list" aria-label="${esc(t.list)}">${list.map(f=>row(f,t,clocks,camps)).join('')}</ul>`;
 return h+'</section>';
}

// ---------- events ----------
const say=m=>{try{app()?.notify?.(m)}catch{}};
function keyOf(el){return el&&el.dataset?(el.dataset.fcAction||el.dataset.fcField)+'|'+(el.dataset.fcId||''):null}
function redraw(root,lang,focusKey,fallback){
 const now=(root&&root.isConnected!==false&&typeof root.outerHTML==='string')?root:global.document?.querySelector?.('[data-fc-root]');
 if(!now||typeof now.outerHTML!=='string')return;
 now.outerHTML=render(lang);
 try{
  const all=[...global.document.querySelectorAll('[data-fc-root] [data-fc-action],[data-fc-root] [data-fc-field]')];
  const el=(focusKey&&all.find(e=>keyOf(e)===focusKey))||(fallback&&all.find(e=>keyOf(e)===fallback))||all.find(e=>e.dataset.fcAction==='add');
  el?.focus?.();
 }catch{}
}
function mutate(fn){
 const st=stateNow();if(!st)return null;
 const r=fn(read(st));if(!r||!r.ok)return r||null;
 write(st,r.list);try{app().save()}catch{}
 return r;
}
function act(a,b,root,lang){
 const l=langNow(lang),t=T[l],id=b?.dataset?.fcId;
 if(a!=='del')ui.armed=null;
 if(a==='add'){
  const nameEl=root?.querySelector?.('[data-fc-field="draft"]'),typeEl=root?.querySelector?.('[data-fc-field="newtype"]');
  const name=nameEl?nameEl.value:ui.draft,type=typeEl?typeEl.value:ui.type;
  if(TYPES.includes(type))ui.type=type;
  const r=mutate(list=>add(list,{name,type:ui.type,attitude:0}));
  if(!r||!r.ok){say(r&&r.reason==='full'?t.limit:t.needName);redraw(root,l,'draft|');return true}
  ui.draft='';say(t.added(line(name,MAX_NAME)));redraw(root,l,'name|'+r.id);return true;
 }
 if(a==='worse'||a==='better'){
  const r=mutate(list=>update(list,id,f=>shift(f,a==='better'?1:-1)));
  if(!r||!r.ok)say(t.gone);
  else{const g=read(stateNow()).find(x=>x.id===id);if(g)say(`${g.name||t.unnamed}: ${g.attitude>0?'+':g.attitude<0?'−':''}${Math.abs(g.attitude)} ${t.att[String(g.attitude)]}`)}
  redraw(root,l,a+'|'+id,'add|');return true;
 }
 if(a==='del'){
  if(ui.armed!==id){ui.armed=id;redraw(root,l,'del|'+id);return true}
  ui.armed=null;
  const r=mutate(list=>remove(list,id));
  if(!r||!r.ok){say(t.gone);redraw(root,l,'add|');return true}
  const undo=()=>{
   const st=stateNow();if(!st)return;
   const back=restore(read(st),r.entry,r.index);
   if(!back.ok){say(T[langNow()].noUndo);return}
   write(st,back.list);try{app().save()}catch{}
   say(T[langNow()].restored);redraw(null,langNow(),'name|'+r.entry.id);
  };
  try{if(typeof app()?.notifyAction==='function')app().notifyAction(t.deleted,t.undo,undo);else say(t.deleted)}catch{}
  // The deleted row is gone with the focus: the add button of the card is the nearest place that stays.
  redraw(root,l,'add|');return true;
 }
 return false;
}
function handle(e,lang){
 const target=e?.target,root=target?.closest?.('[data-fc-root]');
 if(!root||root.isConnected===false)return false;
 const l=langNow(lang||root.dataset?.lang),f=target.dataset?.fcField,id=target.dataset?.fcId;
 if(e.type==='input'){if(f==='draft'){ui.draft=line(target.value,MAX_NAME);return true}return false}
 if(e.type==='change'){
  if(f==='draft')return true;
  if(f==='newtype'){if(TYPES.includes(target.value))ui.type=target.value;return true}
  if(!f||!id)return false;
  const v=target.value;
  const r=mutate(list=>update(list,id,x=>{
   if(f==='name')x.name=v;else if(f==='type')x.type=v;else if(f==='note')x.note=v;
   else if(f==='clock'){if(v)x.clock=v;else delete x.clock}
   else if(f==='camp'){if(v)x.camp=v;else delete x.camp}
   return x;
  }));
  if(!r||!r.ok){say(T[l].gone);redraw(root,l,'add|');return true}
  // Name and note are saved in place (a click that ended the typing must not be swallowed by a redraw).
  if(f==='clock'||f==='camp')redraw(root,l,f+'|'+id);
  return true;
 }
 if(e.type==='keydown'){if(f==='draft'&&e.key==='Enter'){e.preventDefault?.();return act('add',{dataset:{}},root,l)}return false}
 if(e.type!=='click')return false;
 const b=target.closest?.('[data-fc-action]');if(!b||!root.contains?.(b))return false;
 return act(b.dataset.fcAction,b,root,l);
}
if(global.document?.addEventListener)for(const type of ['click','change','input','keydown'])global.document.addEventListener(type,e=>{handle(e)});

global.Factions={MAX,MAX_NAME,MAX_NOTE,TYPES,T,clean,read,write,add,update,remove,restore,shift,render,handle,act,reset,_test:{ui:()=>ui}};
})(typeof window!=='undefined'?window:globalThis);
