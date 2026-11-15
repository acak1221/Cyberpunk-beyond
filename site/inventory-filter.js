/* View-only inventory search and type chips; character records and saved state are never changed.
   A row says what it is in data-inventory-type (inventory-cards.js); a row without it is read by the category the player
   gave the thing. The chips count what each type holds, and the search narrows whatever type is picked.
   A second row of chips shows one of the player's own groups (item-groups.js); it narrows the list the same way. */
(function(global){
'use strict';
let character=null,owner=null,epoch=null,query='',category='all',group='all',shownLang='ru';
const types=['all','weapon','armor','cyberware','gear','ammo','other'];
// The category select of a row («equipment», «cyberware», «armor», «other») as a type.
const legacy={equipment:'gear',cyberware:'cyberware',armor:'armor',other:'other'};
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const normalized=x=>String(x??'').normalize('NFKC').trim().toLocaleLowerCase();
const fallback={ru:{all:'Все',weapon:'Оружие',armor:'Броня',cyberware:'Импланты',gear:'Снаряжение',ammo:'Боеприпасы и обвес',other:'Прочее'},en:{all:'All',weapon:'Weapons',armor:'Armor',cyberware:'Cyberware',gear:'Gear',ammo:'Ammo & attachments',other:'Other'}};
const label=(type,lang)=>global.InventoryCards?.t?.(lang,type)||fallback[lang==='en'?'en':'ru'][type]||type;
const sign=type=>type==='all'?'':global.InventoryCards?.sign?.(type)||'';
function render(c,lang,scope,generation){
 if(c!==character||scope!==owner||generation!==epoch){character=c;owner=scope;epoch=generation;query='';category='all';group='all'}
 const ru=lang!=='en';shownLang=ru?'ru':'en';
 // A group that was deleted (or never was) cannot stay picked: the list would be empty with no chip to unpress.
 if(group!=='all'&&!(group==='none'?global.ItemGroups?.groups?.(c)?.length>0:global.ItemGroups?.has?.(c,group)===true))group='all';
 return `<div class="inventory-filter"><div class="inventory-chips" role="group" aria-label="${ru?'Тип предметов':'Item type'}">${types.map(v=>`<button type="button" class="inventory-chip" data-inventory-filter="type" value="${v}" aria-pressed="${v===category}">${sign(v)}<span>${esc(label(v,lang))}</span><b data-inventory-count="${v}"></b></button>`).join('')}</div>${global.ItemGroups?.chips?.(c,lang,group)||''}<label class="field">${ru?'Поиск по инвентарю':'Search inventory'}<input type="search" data-inventory-filter="query" maxlength="120" value="${esc(query)}" placeholder="${ru?'Название или заметки':'Name or notes'}" autocomplete="off"></label><p data-inventory-filter-count role="status" aria-live="polite"></p></div>`;
}
const typeOfRow=row=>{const own=row.dataset?.inventoryType;if(types.includes(own)&&own!=='all')return own;const kind=row.querySelector('[data-cx-list="items"][data-cx-key="category"]')?.value||'';return legacy[kind]||'gear'};
function apply(root,lang){
 if(!root)return;
 const words=normalized(query).split(/\s+/).filter(Boolean),counts={all:0},inGroup={};let shown=0,total=0;
 for(const row of root.querySelectorAll('[data-inventory-row]')){
  total++;const name=row.querySelector('[data-cx-list="items"][data-cx-key="name"]')?.value||'',notes=row.querySelector('[data-cx-list="items"][data-cx-key="notes"]')?.value||'',kind=typeOfRow(row);
  // A card without a group (or drawn before groups existed) counts as «Без группы».
  const g=row.dataset?.inventoryGroup||'none';
  counts.all++;counts[kind]=(counts[kind]||0)+1;inGroup[g]=(inGroup[g]||0)+1;
  const text=normalized([name,notes,row.dataset.inventoryOther||''].join(' '));const yes=(category==='all'||category===kind)&&(group==='all'||group===g)&&words.every(word=>text.includes(word));row.hidden=!yes;if(yes)shown++;
 }
 // The chips: how many of each type there are, which one is picked, and nothing to press where there is nothing.
 for(const chip of root.querySelectorAll?.('[data-inventory-filter="type"]')||[]){
  const v=chip.value,n=counts[v]||0,b=chip.querySelector?.('[data-inventory-count]');if(b)b.textContent=String(n);
  chip.setAttribute?.('aria-pressed',String(v===category));chip.classList?.toggle('empty',!n&&v!=='all'&&v!==category);
 }
 for(const chip of root.querySelectorAll?.('[data-inventory-filter="group"]')||[]){
  if(chip.dataset?.inventoryFilter!=='group')continue;
  const b=chip.querySelector?.('[data-inventory-gcount]');if(b)b.textContent=String(inGroup[chip.value]||0);
  chip.setAttribute?.('aria-pressed',String(chip.value===group));
 }
 const count=root.querySelector('[data-inventory-filter-count]');if(count)count.textContent=lang==='en'?`Showing ${shown} of ${total}`:`Показано ${shown} из ${total}`;
 // The groups fold, open and step aside according to what is left to see in them.
 global.ItemGroups?.afterFilter?.(root,{query:words.length>0,group,filtered:words.length>0||group!=='all'||category!=='all'});
}
function handle(e,c,lang,scope,generation){
 const el=e?.target,key=el?.dataset?.inventoryFilter,rowEdit=el?.dataset?.cxList==='items'&&['name','notes','category'].includes(el?.dataset?.cxKey);
 if(!['query','category','type'].includes(key)&&!rowEdit)return false;
 if(c!==character||scope!==owner||generation!==epoch)return !!key;
 const root=el.closest?.('#sheet-items');if(!root||root.isConnected!==true||el.isConnected!==true)return !!key;
 // Keep the edited row visible while typing; re-filter only when the edit is committed.
 if(rowEdit){if(e.type==='change')apply(root,lang);return false}
 if(key==='query'){if(root.querySelector('[data-inventory-filter="query"]')!==el)return true;query=String(el.value||'').slice(0,120)}
 else{const v=legacy[el.value]||el.value;category=types.includes(v)?v:'all'}
 apply(root,lang);return true;
}
function reset(root,c,lang,scope,generation){character=c;owner=scope;epoch=generation;query='';category='all';group='all';if(!root||root.isConnected!==true)return;const a=root.querySelector('[data-inventory-filter="query"]'),b=root.querySelector('[data-inventory-filter="category"]');if(a)a.value='';if(b)b.value='all';apply(root,lang)}
// A chip is a button: it is pressed, not changed. The filter belongs to the sheet that was drawn last.
global.document?.addEventListener?.('click',e=>{
 const chip=e.target?.closest?.('[data-inventory-filter="type"],[data-inventory-filter="group"]'),root=chip?.closest?.('#sheet-items');if(!chip||!root)return;
 const v=chip.value;
 // A group chip works like a type chip: pressing the pressed one again shows everything.
 if(chip.dataset?.inventoryFilter==='group')group=typeof v==='string'&&v&&v!==group?v:'all';
 else category=types.includes(v)&&v!==category?v:'all';
 apply(root,shownLang);
});
global.InventoryFilter={render,apply,handle,reset,_group:()=>group};
})(window);
