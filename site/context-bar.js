/* The phone bottom bar that follows what the person is doing. On a character sheet it offers the four things that are needed
   there (rolls, skills, gear, health); in an open campaign tracker the turn controls (back to the list, previous, next, roll
   initiative). Every item presses the control the page already has, so every guard and rule of that control stays in one place;
   «More» stays last. items() and html() are pure and exported for tests; any other screen gets null and the app draws its usual bar. */
(function(global){
'use strict';
const doc=global.document;
const T={
 ru:{rolls:'Броски',skills:'Навыки',gear:'Снаряжение',health:'Здоровье',list:'Список',prev:'Назад',next:'След. ход',init:'Инициатива',nav:'Быстрые действия'},
 en:{rolls:'Rolls',skills:'Skills',gear:'Gear',health:'Health',list:'List',prev:'Back',next:'Next turn',init:'Initiative',nav:'Quick actions'}
};
const L=lang=>lang==='en'?'en':'ru';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// key = what the item does; sel = the page control it presses; icon = a name in window.Icons.
const SHEET=[['rolls','.sheet-tabs [data-sheet-tab="combat"]','combat'],['skills','.sheet-tabs [data-sheet-tab="skills"]','characters'],['gear','.sheet-tabs [data-sheet-tab="gear"]','catalog'],['health','[data-hud-hp]','medical']];
const TRACKER=[['list','[data-campaign-action="back"]','campaigns'],['prev','[data-campaign-action="prev"]','back'],['next','[data-campaign-action="next"]','next'],['init','[data-campaign-action="roll-all"]','dice']];
// The combat page (combat-dock.js) has its own buttons for the same three turn controls.
const COMBAT=[['prev','[data-cd-action="prev"]','back'],['next','[data-cd-action="next"]','next'],['init','[data-cd-action="roll-all"]','dice']];
// ctx: {view, tracker:boolean}. Returns null when the usual bar is right.
function items(ctx){
 if(ctx?.view==='sheet')return SHEET.map(([key,sel,icon])=>({key,sel,icon}));
 if(ctx?.view==='campaigns'&&ctx.tracker)return TRACKER.map(([key,sel,icon])=>({key,sel,icon}));
 if(ctx?.view==='combat'&&global.CombatDock)return COMBAT.map(([key,sel,icon])=>({key,sel,icon}));
 return null;
}
// The buttons only (the app adds «More» itself), or '' when there is nothing special.
function html(ctx,icons){
 const list=items(ctx);if(!list)return '';
 const t=T[L(ctx.lang)];
 return list.map(i=>`<button type="button" data-ctx="${esc(i.key)}"><span class="bottom-nav-icon" aria-hidden="true">${(icons&&icons[i.icon])||''}</span><span>${esc(t[i.key])}</span></button>`).join('');
}
function press(key){
 const all=[...SHEET,...TRACKER],row=all.find(r=>r[0]===key);if(!row||!doc)return false;
 const combat=COMBAT.find(r=>r[0]===key),target=(combat&&doc.querySelector(combat[1]))||doc.querySelector(row[1]);
 if(!target||target.disabled){return false}
 target.click();
 // A redraw (the tracker) drops the focus: put it on the same item of the new bar, or on the content.
 try{const a=doc.activeElement;if(!a||a===doc.body){(doc.querySelector(`.bottom-nav [data-ctx="${key}"]`)||doc.querySelector('#main-content'))?.focus?.({preventScroll:true})}}catch{}
 return true;
}
if(doc?.addEventListener){
 doc.addEventListener('click',e=>{
  const b=e.target?.closest?.('.bottom-nav [data-ctx]');if(!b)return;
  e.preventDefault?.();
  if(!press(b.dataset.ctx)){try{global.App?.notify?.(L(doc.documentElement?.lang)==='en'?'Open the section first.':'Сначала откройте раздел.')}catch{}}
 });
}
global.ContextBar={items,html,press,T,COMBAT};
})(typeof window!=='undefined'?window:globalThis);
