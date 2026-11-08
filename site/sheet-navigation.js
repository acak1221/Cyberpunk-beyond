/* In-page navigation for the active character sheet. */
(function(global){
'use strict';
const links=[['sheet-vitals','Состояние','Vitals'],['sheet-skills','Навыки','Skills'],['sheet-specializations','Специализации','Specializations'],['sheet-weapons','Оружие','Weapons'],['sheet-items','Инвентарь','Inventory'],['sheet-role','Роль','Role'],['sheet-equipment','Экипировка','Equipment'],['sheet-damage','Полученный урон','Received damage'],['sheet-ip','Опыт','Improvement'],['sheet-lifepath','История','Lifepath'],['sheet-notes','Заметки','Notes']];
function render(lang){const ru=lang!=='en';return `<nav class="sheet-jump-nav" aria-label="${ru?'Разделы листа персонажа':'Character sheet sections'}">${links.map(([id,r,e])=>`<button type="button" data-sheet-jump="${id}">${ru?r:e}</button>`).join('')}</nav>`}
function refresh(nav,lang){
 if(!nav)return;
 for(const b of nav.querySelectorAll('[data-sheet-jump]')){
  const target=global.document.getElementById(b.dataset.sheetJump),available=!!target&&target.isConnected===true&&target.childElementCount>0;
  b.disabled=!available;b.title=available?'':lang==='en'?'Section unavailable':'Раздел недоступен';
 }
}
function handle(event){
 if(event?.type!=='click')return false;
 const b=event.target?.closest?.('[data-sheet-jump]');if(!b)return false;
 const id=b.dataset.sheetJump,nav=b.closest?.('.sheet-jump-nav'),shell=nav?.closest?.('.app-shell');
 if(!links.some(x=>x[0]===id)||b.disabled||b.isConnected!==true||nav?.isConnected!==true||!shell||shell.isConnected!==true)return true;
 const target=global.document.getElementById(id);
 if(!target||target.isConnected!==true||target.childElementCount===0||target.closest?.('.app-shell')!==shell)return true;
 target.scrollIntoView({block:'start'});target.focus({preventScroll:true});return true;
}
global.SheetNavigation={render,refresh,handle};
})(window);
