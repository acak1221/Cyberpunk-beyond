/* Private, account-scoped bookmarks for the supplied Corebook. */
(function(){
'use strict';
const T={ru:{title:'МОИ ЗАКЛАДКИ',intro:'Сохраняйте печатную страницу и личную заметку в своём архиве. Сам PDF не сохраняется и не загружается.',page:'Страница',label:'Название',note:'Личная заметка',add:'Добавить закладку',save:'Сохранить изменения',remove:'Удалить',open:'Открыть страницу',empty:'Закладок пока нет.',invalid:'Проверьте страницу, название и текст заметки.',unsupported:'Формат закладок несовместим; существующие данные сохранены без изменений.',stale:'Данные или аккаунт изменились. Повторите действие.',full:'Достигнут предел закладок.',addConfirm:'Добавить эту закладку?',saveConfirm:'Сохранить изменения закладки?',removeConfirm:'Удалить закладку и её заметку?',done:'Закладки обновлены.'},en:{title:'MY BOOKMARKS',intro:'Save a printed page and private note in your archive. The PDF itself is not saved or uploaded.',page:'Page',label:'Title',note:'Private note',add:'Add bookmark',save:'Save changes',remove:'Delete',open:'Open page',empty:'No bookmarks yet.',invalid:'Check the page, title and note.',unsupported:'Bookmark data is incompatible; existing data was left unchanged.',stale:'The data or account changed. Try again.',full:'The bookmark limit was reached.',addConfirm:'Add this bookmark?',saveConfirm:'Save changes to this bookmark?',removeConfirm:'Delete this bookmark and its note?',done:'Bookmarks updated.'}};
const obj=x=>!!x&&typeof x==='object'&&!Array.isArray(x),esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
Object.assign(T.ru,{draft:'Несохранённый черновик',conflict:'Закладка изменилась или была удалена в другой версии. Черновик сохранён ниже: скопируйте его либо отбросьте перед новой правкой.',discard:'Отбросить черновик',discardConfirm:'Отбросить несохранённый черновик?'});
Object.assign(T.en,{draft:'Unsaved draft',conflict:'The bookmark changed or was deleted in another version. Your draft remains below: copy it or discard it before editing again.',discard:'Discard draft',discardConfirm:'Discard this unsaved draft?'});
// Drafts never enter a saved snapshot. A scope can see only its own memory drafts.
const drafts=new Map(),NEW='new:',key=id=>'entry:'+id;
function draftMap(scope,create=false){if(!scope)return null;let m=drafts.get(scope);if(!m&&create){m=new Map();drafts.set(scope,m)}return m}
const baseline=e=>JSON.stringify([e.id,e.page,e.label,e.note]);
globalThis.addEventListener?.('beforeunload',event=>{if([...drafts.values()].some(m=>m.size)){event.preventDefault();event.returnValue='';return ''}});
function state(x){if(x===undefined)return {kind:'new'};if(!obj(x)||x.version!==1||!Array.isArray(x.entries)||x.entries.length>200)return {kind:'invalid'};let ids=new Set();for(const e of x.entries){if(!obj(e)||typeof e.id!=='string'||!e.id||e.id.length>160||ids.has(e.id)||!Number.isSafeInteger(e.page)||e.page<1||e.page>457||typeof e.label!=='string'||!e.label.trim()||e.label.length>120||typeof e.note!=='string'||e.note.length>3000)return {kind:'invalid'};ids.add(e.id)}return {kind:'ok',value:x}}
function render(ctx){
 const t=T[ctx.lang==='en'?'en':'ru'],s=state(ctx.data);if(!ctx.scope)return '';const map=draftMap(ctx.scope)||new Map();
 const form=(v)=>`<div class="bookmarks-fields"><label class="field">${esc(t.page)}<input data-bm-page type="number" min="1" max="457" value="${esc(v.page)}"></label><label class="field">${esc(t.label)}<input data-bm-label maxlength="120" value="${esc(v.label)}"></label></div><label class="field">${esc(t.note)}<textarea data-bm-note maxlength="3000" rows="2">${esc(v.note)}</textarea></label>`;
 const discard=()=>`<button type="button" class="btn ghost" data-bm-action="discard">${esc(t.discard)}</button>`;
 let out=`<section class="card book-bookmarks" data-bookmarks-root><div class="card-heading"><span>${esc(t.title)}</span><span>COREBOOK</span></div><p>${esc(t.intro)}</p>`;
 if(s.kind==='invalid')out+=`<p>${esc(t.unsupported)}</p>`;else{
  const draft=map.get(NEW),initial=draft||{page:Number.isSafeInteger(ctx.page)?String(ctx.page):'1',label:'',note:''};
  out+=form(initial)+`<button type="button" class="btn primary" data-bm-action="add">${esc(t.add)}</button>${draft?`<p role="status">${esc(t.draft)}</p>${discard()}`:''}`;
  if(!s.value?.entries.length)out+=`<p>${esc(t.empty)}</p>`;
  else for(const e of s.value.entries){const d=map.get(key(e.id)),conflict=!!d&&d.base!==baseline(e),shown=d||e;
   out+=`<div class="bookmark-entry" data-bm-id="${esc(e.id)}" data-bm-base="${esc(baseline(e))}">${form(shown)}${d?`<p role="status">${esc(conflict?t.conflict:t.draft)}</p>`:''}<div class="bookmark-actions"><button type="button" class="btn ghost" data-bm-action="open">${esc(t.open)}</button>${conflict?'':`<button type="button" class="btn ghost" data-bm-action="save">${esc(t.save)}</button><button type="button" class="btn ghost" data-bm-action="remove">${esc(t.remove)}</button>`}${d?discard():''}</div></div>`;
  }
 }
 // If a synced version deletes a bookmark (or is unsupported), keep its draft visible for copying.
 const live=new Set(s.kind==='ok'?s.value.entries.map(e=>key(e.id)):[]);
 for(const [k,d] of map){if(k===NEW||live.has(k))continue;out+=`<div class="bookmark-entry" data-bm-id="${esc(d.id)}" data-bm-base="${esc(d.base)}" data-bm-orphan="true">${form(d)}<p role="status">${esc(t.conflict)}</p>${discard()}</div>`}
 if(s.kind==='invalid'&&map.has(NEW)){const d=map.get(NEW);out+=`<div class="bookmark-entry" data-bm-new-orphan="true">${form(d)}<p role="status">${esc(t.conflict)}</p>${discard()}</div>`}
 return out+'</section>';
}
function handle(event,ctx){
 const el=event?.target,t=T[ctx.lang==='en'?'en':'ru'];if(!el)return {handled:false};
 const field=(event.type==='input'||event.type==='change')&&['page','label','note'].find(k=>el.matches?.(`[data-bm-${k}]`));
 const b=event.type==='click'?el.closest?.('[data-bm-action]'):null;if(!field&&!b)return {handled:false};
 const active=b||el,root=active.closest?.('[data-bookmarks-root]'),box=active.closest?.('[data-bm-id]'),newOrphan=active.closest?.('[data-bm-new-orphan]'),s=state(ctx.data),current=()=>{try{return !!ctx.scope&&ctx.isCurrent(ctx.data,ctx.scope)===true&&root?.isConnected===true&&active.isConnected===true&&active.closest('[data-bookmarks-root]')===root}catch{return false}};
 if(!current())return {handled:true,notify:t.stale};
 const source=box||newOrphan||root,id=box?.dataset.bmId,k=box?key(id):NEW,map=draftMap(ctx.scope),entry=s.kind==='ok'?s.value.entries.find(e=>e.id===id):null,existing=map?.get(k);
 const get=n=>source.querySelector(`[data-bm-${n}]`)?.value,read=()=>({page:String(get('page')??''),label:String(get('label')??''),note:String(get('note')??'')});
 if(field){const draftValues=read();if(draftValues.page.length>10||draftValues.label.length>120||draftValues.note.length>3000)return {handled:true,notify:t.invalid};if(s.kind==='invalid'&&!existing)return {handled:true,notify:t.unsupported};if(box&&!entry&&!existing)return {handled:true,notify:t.stale};const base=box?(existing?.base??box.dataset.bmBase):null;if(box&&typeof base!=='string')return {handled:true,notify:t.stale};draftMap(ctx.scope,true).set(k,{...draftValues,base,id:box?id:null});return {handled:true}}
 const action=b.dataset.bmAction;if(!['add','save','remove','open','discard'].includes(action))return {handled:true};
 if(action==='discard'){
  if(!existing)return {handled:true,notify:t.stale};const before=JSON.stringify([ctx.data,existing,box?.dataset.bmId,box?.dataset.bmBase]),oldScope=ctx.scope,oldBox=box,oldNew=newOrphan;
  if(!window.confirm(t.discardConfirm))return {handled:true};
  if(!current()||ctx.scope!==oldScope||draftMap(ctx.scope)?.get(k)!==existing||JSON.stringify([ctx.data,existing,box?.dataset.bmId,box?.dataset.bmBase])!==before||b.dataset.bmAction!==action||b.closest?.('[data-bm-id]')!==oldBox||b.closest?.('[data-bm-new-orphan]')!==oldNew)return {handled:true,notify:t.stale};
  map.delete(k);return {handled:true,rerender:true};
 }
 if(s.kind==='invalid')return {handled:true,notify:t.unsupported};
 if(action!=='add'&&(!entry||!box||box.closest?.('[data-bookmarks-root]')!==root))return {handled:true,notify:t.stale};
 if(action==='open')return {handled:true,page:entry.page,rerender:true};
 if(action==='add'&&box)return {handled:true,notify:t.stale};
 if(action!=='add'&&((existing&&existing.base!==baseline(entry))||box.dataset.bmBase!==baseline(entry)))return {handled:true,notify:t.conflict,rerender:true};
 const values=read(),page=/^\d+$/.test(values.page)?Number(values.page):NaN,label=values.label.trim(),note=values.note;
 if(action!=='remove'&&(!Number.isSafeInteger(page)||page<1||page>457||!label||label.length>120||note.length>3000))return {handled:true,notify:t.invalid};
 if(action==='add'&&(s.value?.entries.length||0)>=200)return {handled:true,notify:t.full};
 const fields=()=>JSON.stringify([read(),b.dataset.bmAction,box?.dataset.bmId,box?.dataset.bmBase]);let before;try{before=JSON.stringify(ctx.data)}catch{return {handled:true,notify:t.stale}}const f=fields(),scope=ctx.scope,buttonBox=box,draftBefore=existing;
 if(!window.confirm(t[action==='add'?'addConfirm':action==='save'?'saveConfirm':'removeConfirm']))return {handled:true};
 let after;try{after=JSON.stringify(ctx.data)}catch{return {handled:true,notify:t.stale}}
 if(!current()||ctx.scope!==scope||before!==after||fields()!==f||b.closest?.('[data-bm-id]')!==buttonBox||draftMap(scope)?.get(k)!==draftBefore)return {handled:true,notify:t.stale};
 const next=s.kind==='new'?{version:1,entries:[]}:{...s.value,entries:s.value.entries.slice()};
 if(action==='add'){const newId=globalThis.crypto?.randomUUID?.()||Date.now()+'-'+Math.random().toString(36).slice(2);if(next.entries.some(e=>e.id===newId))return {handled:true,notify:t.stale};next.entries.push({id:newId,page,label,note})}
 else if(action==='save'){const i=next.entries.indexOf(entry);if(i<0)return {handled:true,notify:t.stale};next.entries[i]={...entry,page,label,note}}
 else{const i=next.entries.indexOf(entry);if(i<0)return {handled:true,notify:t.stale};next.entries.splice(i,1)}
 draftMap(scope)?.delete(k);return {handled:true,data:next,dirty:true,rerender:true,notify:t.done};
}
window.BookBookmarks={state,render,handle};
})();
