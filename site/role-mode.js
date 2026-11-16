/* Role: «Игрок / Ведущий». A view preference, nothing more.
   It decides which sections the menu, the phone bottom bar and the home page put forward. It hides nothing for good:
   a Game Master screen opened by a direct link still opens in full, with a one-line notice. The choice lives in its own
   localStorage key (nc-role), apart from the archive: it is not in backups, transfers, share links or rooms, and it never
   changes what data exists. Anything else in that key (or no storage at all) means «not chosen yet», and then the menu
   is exactly what it was before this module existed. */
(function(global){
'use strict';
const doc=global.document;
const KEY='nc-role',ROLES=['player','gm'],GM_VIEWS=['gm','campaigns'],GM_GROUP=['campaigns','gm','room'],GM_BOTTOM=['campaigns','room','dice','gm'];
const T={
 ru:{
  chooserTitle:'Кто вы за столом?',player:'Я игрок',gm:'Я ведущий',
  chooserHint:'Это только про меню: что показывать первым. Выбор можно изменить в меню в любой момент, ваши данные от него не зависят.',
  switchLabel:'Роль',switchPlayer:'Игрок',switchGm:'Ведущий',groupGm:'Ведущему',
  notice:'Это экран ведущего. Сейчас выбрана роль игрока.',noticeButton:'Переключить на ведущего'
 },
 en:{
  chooserTitle:'Who are you at the table?',player:'I am a player',gm:'I am the GM',
  chooserHint:'This only affects the menu: what is shown first. You can change it in the menu at any time; your data does not depend on it.',
  switchLabel:'Role',switchPlayer:'Player',switchGm:'Game Master',groupGm:'Game Master',
  notice:'This is a Game Master screen. The Player role is selected right now.',noticeButton:'Switch to Game Master'
 }
};
const L=lang=>lang==='en'?'en':'ru';
const t=(lang,key)=>T[L(lang)][key]??'';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// A role that could not be written (private mode, full storage) still holds for this visit.
let mem=null,memOnly=false;
function get(){
 if(memOnly)return mem;
 try{const v=global.localStorage.getItem(KEY);return ROLES.includes(v)?v:null}catch{return mem}
}
function set(role){
 if(!ROLES.includes(role))return false;
 mem=role;
 try{global.localStorage.setItem(KEY,role);memOnly=false}catch{memOnly=true}
 return true;
}
const isSet=()=>get()!==null;
const hides=(view,role=get())=>role==='player'&&GM_VIEWS.includes(view);
const viewOf=x=>Array.isArray(x)?x[0]:x&&typeof x==='object'?x.view:x;

// navGroups: [[label,[views…]],…] as the app builds it. Returns a new list; the input is never changed.
function groups(navGroups,lang){
 const list=(Array.isArray(navGroups)?navGroups:[]).map(([label,views])=>[label,[...(views||[])]]),role=get();
 if(role==='player')return list.map(([label,views])=>[label,views.filter(v=>!GM_VIEWS.includes(v))]).filter(([,views])=>views.length);
 if(role!=='gm')return list;
 const taken=new Set(GM_GROUP);
 return [[t(lang,'groupGm'),[...GM_GROUP]],...list.map(([label,views])=>[label,views.filter(v=>!taken.has(v))]).filter(([,views])=>views.length)];
}
function bottom(defaultList){
 const base=Array.isArray(defaultList)?[...defaultList]:[];
 return get()==='gm'?[...GM_BOTTOM]:base;
}
// Quick cards of the home page: entries are views, or arrays / objects that start with / carry the view.
function cards(list){
 const items=Array.isArray(list)?[...list]:[],role=get();
 if(role==='player')return items.filter(x=>!GM_VIEWS.includes(viewOf(x)));
 if(role!=='gm')return items;
 const first=['campaigns','gm'].map(v=>items.find(x=>viewOf(x)===v)).filter(Boolean);
 return [...first,...items.filter(x=>!first.includes(x))];
}
function chooser(lang){
 if(isSet())return '';
 return `<section class="role-chooser" aria-labelledby="role-chooser-title"><h2 id="role-chooser-title">${esc(t(lang,'chooserTitle'))}</h2><div class="role-chooser-actions"><button type="button" class="btn" data-role-set="player">${esc(t(lang,'player'))}</button><button type="button" class="btn" data-role-set="gm">${esc(t(lang,'gm'))}</button></div><p>${esc(t(lang,'chooserHint'))}</p></section>`;
}
function switchHTML(lang){
 const role=get(),b=(r,key)=>`<button type="button" data-role-set="${r}" aria-pressed="${role===r}"${role===r?' class="active"':''}>${esc(t(lang,key))}</button>`;
 return `<div class="role-switch" role="group" aria-label="${esc(t(lang,'switchLabel'))}"><span class="role-switch-label" aria-hidden="true">${esc(t(lang,'switchLabel'))}</span>${b('player','switchPlayer')}${b('gm','switchGm')}</div>`;
}
// opts.quiet: the caller knows the player came here on purpose (the trial fight of the first-run guide).
function notice(view,lang,opts){
 if(!hides(view)||opts?.quiet)return '';
 return `<div class="role-notice" role="note"><span>${esc(t(lang,'notice'))}</span><button type="button" class="btn ghost" data-role-set="gm">${esc(t(lang,'noticeButton'))}</button></div>`;
}

if(doc?.addEventListener)doc.addEventListener('click',e=>{
 const el=e.target?.closest?.('[data-role-set]');if(!el)return;
 const role=el.dataset?.roleSet,gone=!!el.closest?.('.role-chooser, .role-notice');
 if(!set(role))return;
 global.App?.render?.();
 // The page is drawn again, so the focus goes back to the control that was used. The chooser and the notice are gone after
 // the choice: the focus goes to the content, so it is never dropped on the page and the reader keeps their place.
 const next=gone?doc.querySelector('#main-content'):doc.querySelector(`.role-switch [data-role-set="${role}"]`);
 next?.focus?.({preventScroll:true});
});

global.RoleMode={KEY,ROLES,GM_VIEWS,get,set,isSet,hides,groups,bottom,cards,chooser,switchHTML,notice,t};
})(window);
