/* Rumors: what the people of the city are saying, kept per campaign in campaign.rumors (cap 60, so they are saved,
   backed up and exported with the campaign like the «Агент» feed). A rumor has its text, whether it is true (true,
   partly, false: a flag that only the Game Master sees), where the crew heard it and, once it has been published, the id
   of the news entry it became. «Опубликовать как новость» hands the text to room-agent.js as a news entry that is
   published at once; the truth flag, the place and the rest of the rumor never leave the device. The module has no
   content of its own. card(campaign, lang) is the card for one campaign, render(lang) the same with a campaign picker
   for the GM hub. The events are delegated on the document. */
(function(global){
'use strict';
const MAX=60,MAX_TEXT=300,MAX_WHERE=80,MAX_TITLE=80;
const TRUTHS=Object.freeze(['true','part','false']);
const isObj=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const app=()=>global.App||null;
const stateNow=()=>{try{const a=app();return a&&typeof a.getState==='function'?a.getState():null}catch{return null}};
const langNow=l=>(l||app()?.lang?.())==='en'?'en':'ru';
const ID=/^[A-Za-z0-9_-]{1,40}$/;

const T={
 ru:{title:'СЛУХИ',sub:'ТОЛЬКО ДЛЯ ВЕДУЩЕГО',intro:'Что говорят на улицах. Правдивость, место и ваши пометки видите только вы; игрокам уходит лишь текст, и только если вы опубликуете слух как новость.',
  text:'Текст слуха',textPh:'Напр. «Говорят, в порту вчера пропал целый контейнер»',truth:'Что на самом деле',truths:{true:'Правда',part:'Отчасти',false:'Ложь'},where:'Где услышали',wherePh:'Напр. «бар у эстакады»',
  add:'Добавить слух',none:'Слухов пока нет.',count:n=>`${n} из ${MAX}`,limit:`Достигнут предел — ${MAX} слухов.`,needText:'Введите текст слуха.',added:'Слух добавлен.',
  publish:'Опубликовать как новость',published:'Опубликовано как новость',pubDone:'Слух опубликован как новость. Правдивость игрокам не видна.',pubAlready:'Этот слух уже опубликован как новость.',
  noAgent:'Лента «Агент» недоступна на этой странице.',noRoom:'Слух добавлен в ленту новостей кампании. Он дойдёт до игроков, когда вы откроете комнату с этой кампанией.',pubFull:'Игрокам уже открыто слишком много записей. Скройте одну из опубликованных в ленте «Агент».',feedFull:'Лента «Агент» заполнена. Удалите ненужные записи.',
  del:'Удалить',confirm:'Точно удалить?',deleted:'Слух удалён.',undo:'Отменить',restored:'Слух возвращён.',noUndo:'Вернуть не удалось: список уже изменился.',gone:'Этого слуха уже нет.',
  camp:'Кампания',noCamp:'Чтобы вести слухи, создайте кампанию.',list:'Список слухов',item:n=>`Слух ${n}`},
 en:{title:'RUMORS',sub:'GM ONLY',intro:'What people are saying on the streets. The truth, the place and your notes are for you alone; players only get the text, and only if you publish a rumor as news.',
  text:'Rumor text',textPh:'E.g. “They say a whole container vanished from the port yesterday”',truth:'What is really so',truths:{true:'True',part:'Partly',false:'False'},where:'Where it was heard',wherePh:'E.g. “the bar under the overpass”',
  add:'Add a rumor',none:'No rumors yet.',count:n=>`${n} of ${MAX}`,limit:`Limit reached — ${MAX} rumors.`,needText:'Enter the text of the rumor.',added:'Rumor added.',
  publish:'Publish as news',published:'Published as news',pubDone:'The rumor is published as news. The players cannot see whether it is true.',pubAlready:'This rumor is already published as news.',
  noAgent:'The “Agent” feed is not available on this page.',noRoom:'The rumor is in the campaign news feed. Players get it when you open a room with this campaign.',pubFull:'Too many entries are already open to players. Hide one of the published ones in the “Agent” feed.',feedFull:'The “Agent” feed is full. Delete entries you do not need.',
  del:'Delete',confirm:'Really delete?',deleted:'The rumor is deleted.',undo:'Undo',restored:'The rumor is back.',noUndo:'Could not bring it back: the list has changed.',gone:'This rumor is no longer there.',
  camp:'Campaign',noCamp:'Create a campaign to keep rumors.',list:'Rumors',item:n=>`Rumor ${n}`}
};

// ---------- stored data ----------
const line=(v,n)=>typeof v==='string'?v.replace(/[\u0000-\u001f\u007f\u2028\u2029]/g,' ').replace(/\s+/g,' ').trim().slice(0,n).trim():'';
const para=(v,n)=>typeof v==='string'?v.replace(/\t/g,' ').replace(/[\u2028\u2029]/g,'\n').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g,'').replace(/\n{3,}/g,'\n\n').trim().slice(0,n).trim():'';
const time=v=>{const n=Number(v);return Number.isFinite(n)&&n>0&&n<=Number.MAX_SAFE_INTEGER?Math.trunc(n):0};
// One rumor rebuilt from known fields; one without a text or a usable id is dropped.
function clean(raw){
 if(!isObj(raw)||typeof raw.id!=='string'||!ID.test(raw.id))return null;
 const text=para(raw.text,MAX_TEXT);if(!text)return null;
 const out={id:raw.id,text,truth:TRUTHS.includes(raw.truth)?raw.truth:'true'},where=line(raw.where,MAX_WHERE);
 if(where)out.where=where;
 out.at=time(raw.at);
 if(typeof raw.news==='string'&&ID.test(raw.news))out.news=raw.news;
 return out;
}
function read(c){
 const out=[],seen=new Set();
 for(const x of Array.isArray(c?.rumors)?c.rumors:[]){const r=clean(x);if(r&&!seen.has(r.id)){seen.add(r.id);out.push(r)}if(out.length>=MAX)break}
 return out;
}
// An emptied list leaves no field behind, so a campaign that never used rumors stays as it was.
function store(c,list){if(list.length)c.rumors=list;else delete c.rumors}
let seq=0;
const newId=taken=>{for(;;){const id='r'+Date.now().toString(36)+'-'+(seq++).toString(36)+Math.random().toString(36).slice(2,6);if(!taken.has(id))return id}};
function add(c,fields,now=Date.now()){
 if(!isObj(c))return {ok:false,reason:'missing'};
 const text=para(fields?.text,MAX_TEXT);if(!text)return {ok:false,reason:'empty'};
 const list=read(c);if(list.length>=MAX)return {ok:false,reason:'full'};
 const r=clean({id:newId(new Set(list.map(x=>x.id))),text,truth:fields.truth,where:fields.where,at:now});
 list.unshift(r);store(c,list);return {ok:true,id:r.id};
}
function update(c,id,fields){
 if(!isObj(c))return {ok:false,reason:'missing'};
 const list=read(c),i=list.findIndex(x=>x.id===id);if(i<0)return {ok:false,reason:'missing'};
 const old=list[i],next={...old};
 if('text' in fields){const t=para(fields.text,MAX_TEXT);if(!t)return {ok:false,reason:'empty'};next.text=t}
 if('truth' in fields&&TRUTHS.includes(fields.truth))next.truth=fields.truth;
 if('where' in fields){const w=line(fields.where,MAX_WHERE);if(w)next.where=w;else delete next.where}
 list[i]=clean(next);store(c,list);return {ok:true,id};
}
function remove(c,id){
 if(!isObj(c))return {ok:false,reason:'missing'};
 const list=read(c),index=list.findIndex(x=>x.id===id);if(index<0)return {ok:false,reason:'missing'};
 const [entry]=list.splice(index,1);store(c,list);return {ok:true,entry,index};
}
function restore(c,entry,index){
 if(!isObj(c))return {ok:false,reason:'missing'};
 const back=clean(entry),list=read(c);
 if(!back||list.some(x=>x.id===back.id))return {ok:false,reason:'missing'};
 if(list.length>=MAX)return {ok:false,reason:'full'};
 list.splice(Number.isInteger(index)?Math.max(0,Math.min(index,list.length)):0,0,back);store(c,list);return {ok:true,id:back.id};
}
// The title of the news entry: the first sentence or line of the rumor, never longer than the feed allows.
function titleOf(text){
 const first=String(text).split(/\n/)[0],cut=first.search(/[.!?…](\s|$)/),head=cut>=8?first.slice(0,cut+1):first;
 return line(head,MAX_TITLE);
}
/* The rumor becomes a news entry of the «Агент» feed and is published at once. Only the text goes: the entry is
   made from the rumor text alone, so the truth flag and the place cannot reach the players. */
function publishAsNews(c,id,agent=global.RoomAgent){
 if(!isObj(c))return {ok:false,reason:'missing'};
 if(!agent||typeof agent.add!=='function'||typeof agent.setPublished!=='function')return {ok:false,reason:'noagent'};
 const list=read(c),i=list.findIndex(x=>x.id===id);if(i<0)return {ok:false,reason:'missing'};
 const r=list[i];
 if(r.news&&agent.read(c).some(e=>e.id===r.news&&e.pub))return {ok:false,reason:'already'};
 // The entry it became earlier is still in the feed, only hidden: show that one again instead of making a copy.
 const old=r.news?agent.read(c).find(e=>e.id===r.news):null;
 if(old){const q=agent.setPublished(c,old.id,true);return q.ok?{ok:true,entry:old.id}:{ok:false,reason:q.reason==='full'?'pubfull':'noagent'}}
 const made=agent.add(c,{kind:'news',title:titleOf(r.text),text:r.text});
 if(!made.ok)return {ok:false,reason:made.reason==='full'?'feedfull':'noagent'};
 const p=agent.setPublished(c,made.id,true);
 if(!p.ok){agent.remove(c,made.id);return {ok:false,reason:p.reason==='full'?'pubfull':'noagent'}}
 list[i]={...r,news:made.id};store(c,list);
 return {ok:true,entry:made.id};
}

// ---------- markup ----------
let ui={camp:'',draft:'',truth:'true',where:'',armed:null};
function reset(){ui={camp:'',draft:'',truth:'true',where:'',armed:null}}
const campsOf=st=>(Array.isArray(st?.campaigns)?st.campaigns:[]).filter(c=>isObj(c)&&typeof c.id==='string'&&ID.test(c.id));
const campOf=(st,id)=>campsOf(st).find(c=>c.id===id)||null;
const stamp=at=>{const d=new Date(at);if(!at||isNaN(d))return '';const p=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`};
function row(r,i,cid,t,agent){
 const id=esc(r.id),armed=ui.armed===r.id,live=!!(r.news&&agent&&typeof agent.read==='function'&&agent.read(campOfSafe(cid)||{}).some(e=>e.id===r.news&&e.pub));
 return `<li class="ru-item ru-t-${r.truth}" data-ru-item="${id}"><label class="field ru-field">${esc(t.item(i+1))}<textarea rows="2" maxlength="${MAX_TEXT}" data-ru-field="text" data-ru-id="${id}" aria-label="${esc(t.text)}">${esc(r.text)}</textarea></label>`
 +`<div class="ru-meta"><label class="field ru-field">${esc(t.truth)}<select data-ru-field="truth" data-ru-id="${id}">${TRUTHS.map(k=>`<option value="${k}"${r.truth===k?' selected':''}>${esc(t.truths[k])}</option>`).join('')}</select></label><label class="field ru-field">${esc(t.where)}<input type="text" maxlength="${MAX_WHERE}" data-ru-field="where" data-ru-id="${id}" value="${esc(r.where||'')}" placeholder="${esc(t.wherePh)}"></label></div>`
 +`<p class="ru-badge"><span class="ru-chip">${esc(t.truths[r.truth])}</span>${stamp(r.at)?`<time>${esc(stamp(r.at))}</time>`:''}${live?`<span class="ru-pub">${esc(t.published)}</span>`:''}</p>`
 +`<div class="ru-actions"><button type="button" class="btn ghost" data-ru-action="news" data-ru-id="${id}"${live||!agent?' aria-disabled="true"':''}>${esc(live?t.published:t.publish)}</button><button type="button" class="btn ghost ru-del${armed?' armed':''}" data-ru-action="del" data-ru-id="${id}">✕ ${esc(armed?t.confirm:t.del)}</button></div></li>`;
}
function campOfSafe(id){return campOf(stateNow(),id)}
function body(c,t){
 const list=read(c),agent=global.RoomAgent||null;
 let h=`<div class="ru-new"><label class="field">${esc(t.text)}<textarea rows="2" maxlength="${MAX_TEXT}" data-ru-field="draft" placeholder="${esc(t.textPh)}">${esc(ui.draft)}</textarea></label><label class="field">${esc(t.truth)}<select data-ru-field="newtruth">${TRUTHS.map(k=>`<option value="${k}"${ui.truth===k?' selected':''}>${esc(t.truths[k])}</option>`).join('')}</select></label><label class="field">${esc(t.where)}<input type="text" maxlength="${MAX_WHERE}" data-ru-field="newwhere" placeholder="${esc(t.wherePh)}" value="${esc(ui.where)}"></label><button type="button" class="btn primary" data-ru-action="add"${list.length>=MAX?' aria-disabled="true"':''}>+ ${esc(t.add)}</button></div>`;
 h+=`<p class="ru-note" role="status">${esc(list.length>=MAX?t.limit:list.length?t.count(list.length):t.none)}</p>`;
 if(list.length)h+=`<ul class="ru-list" aria-label="${esc(t.list)}">${list.map((r,i)=>row(r,i,c.id,t,agent)).join('')}</ul>`;
 return h;
}
// The card of one campaign (for the campaign page); render() adds the picker.
function card(c,lang){
 const l=langNow(lang),t=T[l];if(!isObj(c)||typeof c.id!=='string')return '';
 return `<section class="card ru-card" data-ru-root data-ru-card="1" data-ru-camp="${esc(c.id)}" data-lang="${l}"><div class="card-heading"><span>${esc(t.title)}</span><span>${esc(t.sub)}</span></div><p class="ru-note">${esc(t.intro)}</p>${body(c,t)}</section>`;
}
function render(lang){
 const l=langNow(lang),t=T[l],st=stateNow(),camps=campsOf(st);
 if(!camps.length)return `<section class="card ru-card" data-ru-root data-lang="${l}"><div class="card-heading"><span>${esc(t.title)}</span><span>${esc(t.sub)}</span></div><p class="ru-note" role="status">${esc(t.noCamp)}</p></section>`;
 const c=camps.find(x=>x.id===ui.camp)||camps[0];ui.camp=c.id;
 const pick=camps.length>1?`<label class="field ru-pick">${esc(t.camp)}<select data-ru-field="camp">${camps.map(k=>`<option value="${esc(k.id)}"${k.id===c.id?' selected':''}>${esc(String(k.name||'—').slice(0,60))}</option>`).join('')}</select></label>`:'';
 return `<section class="card ru-card" data-ru-root data-ru-camp="${esc(c.id)}" data-lang="${l}"><div class="card-heading"><span>${esc(t.title)}</span><span>${esc(t.sub)}</span></div><p class="ru-note">${esc(t.intro)}</p>${pick}${body(c,t)}</section>`;
}

// ---------- events ----------
const say=m=>{try{app()?.notify?.(m)}catch{}};
const keyOf=el=>el&&el.dataset?(el.dataset.ruAction||el.dataset.ruField)+'|'+(el.dataset.ruId||''):null;
function redraw(root,lang,focusKey,fallback){
 const doc=global.document,camp=root?.dataset?.ruCamp;
 const now=(root&&root.isConnected!==false&&typeof root.outerHTML==='string')?root:doc?.querySelector?.('[data-ru-root]');
 if(!now||typeof now.outerHTML!=='string')return;
 const cardMode=now.dataset?.ruCard==='1';
 now.outerHTML=cardMode&&camp?card(campOfSafe(camp),lang):render(lang);
 try{
  const all=[...doc.querySelectorAll('[data-ru-root] [data-ru-action],[data-ru-root] [data-ru-field]')];
  const el=(focusKey&&all.find(e=>keyOf(e)===focusKey))||(fallback&&all.find(e=>keyOf(e)===fallback))||all.find(e=>e.dataset.ruField==='draft');
  el?.focus?.();
 }catch{}
}
function commit(){try{app()?.save?.()}catch{}}
function act(a,b,root,lang){
 const l=langNow(lang),t=T[l],st=stateNow(),cid=root?.dataset?.ruCamp||ui.camp,c=campOf(st,cid),id=b?.dataset?.ruId;
 if(!c)return false;
 if(a!=='del')ui.armed=null;
 if(a==='add'){
  const text=root?.querySelector?.('[data-ru-field="draft"]')?.value??ui.draft,truth=root?.querySelector?.('[data-ru-field="newtruth"]')?.value??ui.truth,where=root?.querySelector?.('[data-ru-field="newwhere"]')?.value??ui.where;
  if(TRUTHS.includes(truth))ui.truth=truth;
  const r=add(c,{text,truth:ui.truth,where});
  if(!r.ok){say(r.reason==='full'?t.limit:t.needText);redraw(root,l,'draft|');return true}
  ui.draft='';ui.where='';commit();say(t.added);redraw(root,l,'text|'+r.id);return true;
 }
 if(a==='news'){
  const r=publishAsNews(c,id);
  if(!r.ok){
   say(r.reason==='already'?t.pubAlready:r.reason==='pubfull'?t.pubFull:r.reason==='feedfull'?t.feedFull:r.reason==='missing'?t.gone:t.noAgent);
   redraw(root,l,'news|'+id,'draft|');return true;
  }
  commit();try{global.RoomAgent?.publish?.()}catch{}
  say(t.pubDone);redraw(root,l,'news|'+id,'draft|');return true;
 }
 if(a==='del'){
  if(ui.armed!==id){ui.armed=id;redraw(root,l,'del|'+id);return true}
  ui.armed=null;
  const r=remove(c,id);
  if(!r.ok){say(t.gone);redraw(root,l,'draft|');return true}
  commit();
  const undo=()=>{
   const again=campOf(stateNow(),cid),back=again?restore(again,r.entry,r.index):{ok:false};
   if(!back.ok){say(T[langNow()].noUndo);return}
   commit();say(T[langNow()].restored);redraw(null,langNow(),'text|'+back.id,'draft|');
  };
  try{if(typeof app()?.notifyAction==='function')app().notifyAction(t.deleted,t.undo,undo);else say(t.deleted)}catch{}
  redraw(root,l,'draft|');return true;
 }
 return false;
}
function handle(e,lang){
 const target=e?.target,root=target?.closest?.('[data-ru-root]');
 if(!root||root.isConnected===false)return false;
 const l=langNow(lang||root.dataset?.lang),f=target.dataset?.ruField,id=target.dataset?.ruId;
 if(e.type==='input'){
  if(f==='draft'){ui.draft=para(target.value,MAX_TEXT);return true}
  if(f==='newwhere'){ui.where=line(target.value,MAX_WHERE);return true}
  return false;
 }
 if(e.type==='change'){
  if(f==='draft'||f==='newwhere')return true;
  if(f==='newtruth'){if(TRUTHS.includes(target.value))ui.truth=target.value;return true}
  if(f==='camp'){ui.camp=String(target.value||'');redraw(root,l,'camp|');return true}
  if(!f||!id)return false;
  const c=campOf(stateNow(),root.dataset?.ruCamp||ui.camp);
  const r=c?update(c,id,{[f]:target.value}):{ok:false};
  if(!r.ok){say(r.reason==='empty'?T[l].needText:T[l].gone);redraw(root,l,'draft|');return true}
  commit();
  // The text and the place are saved in place; the truth redraws so its badge follows.
  if(f==='truth')redraw(root,l,f+'|'+id);
  return true;
 }
 if(e.type!=='click')return false;
 const b=target.closest?.('[data-ru-action]');if(!b||!root.contains?.(b))return false;
 return act(b.dataset.ruAction,b,root,l);
}
if(global.document?.addEventListener)for(const type of ['click','change','input'])global.document.addEventListener(type,e=>{handle(e)});

global.Rumors={MAX,MAX_TEXT,MAX_WHERE,TRUTHS,T,clean,read,add,update,remove,restore,titleOf,publishAsNews,card,render,handle,act,reset,_test:{ui:()=>ui}};
})(typeof window!=='undefined'?window:globalThis);
