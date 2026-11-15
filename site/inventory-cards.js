/* The inventory as cards. Every thing a character owns is one card in one list, sorted into types the player can pick
   with chips (inventory-filter.js): weapons, armor, cyberware, gear, ammunition and the rest.

   A card says what the thing is (a sign for its type, the line the catalog gives it, the page) and offers the one action
   that matters for it right there: put armor on or take it off, install cyberware, go to the weapon's rolls.
   Nothing here changes a character: the buttons carry the same attributes as the ones in the armor and cyberware block,
   so the same handlers (equipment-tools.js) do the work, ask the same questions and keep the same rules.

   The long block «Экипировка и кибернетика» folds away under the list: it is still the place for SP, the Humanity
   maximum and the ways of installing, and it opens by itself when an installation waits to be confirmed.

   A card also says which of the player's own groups it is in (item-groups.js), so the list can be drawn group by group. */
(function(global){
'use strict';
const TYPES=['weapon','armor','cyberware','gear','ammo','other'];
const SIGN={weapon:'⌖',armor:'⛨',cyberware:'⌬',gear:'◇',ammo:'⁍',other:'⋯'};
const T={
 ru:{all:'Все',weapon:'Оружие',armor:'Броня',cyberware:'Импланты',gear:'Снаряжение',ammo:'Боеприпасы и обвес',other:'Прочее',
  page:'стр.',toHead:'На голову',toBody:'На тело',wear:'Надеть',offHead:'Снять с головы',offBody:'Снять с тела',off:'Снять',install:'Установить',
  toCombat:'К броскам',damage:'Урон',rof:'ROF',mag:'магазин',noAmmo:'без патронов',
  more:'Броня, SP и установка имплантов: подробно',moreHelp:'Текущий SP, максимум Человечности, способы установки и снятие имплантов.'},
 en:{all:'All',weapon:'Weapons',armor:'Armor',cyberware:'Cyberware',gear:'Gear',ammo:'Ammo & attachments',other:'Other',
  page:'p.',toHead:'On the head',toBody:'On the body',wear:'Put on',offHead:'Take off the head',offBody:'Take off the body',off:'Take off',install:'Install',
  toCombat:'To the rolls',damage:'Damage',rof:'ROF',mag:'magazine',noAmmo:'no ammo',
  more:'Armor, SP and installing cyberware: in detail',moreHelp:'Current SP, the Humanity maximum, ways of installing and removing cyberware.'},
};
const L=lang=>lang==='en'?'en':'ru',t=(lang,k)=>T[L(lang)][k]??T.ru[k]??k;
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const isObject=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const catalog=id=>Array.isArray(global.CATALOG)&&typeof id==='string'&&id?global.CATALOG.find(x=>x&&x.id===id):undefined;
const whole=v=>{const n=Math.floor(Number(v));return Number.isFinite(n)?n:0};

// The type of a thing: what the catalog says it is, or, for a thing written in by hand, the category the player gave it.
function typeOf(record){
 const cat=catalog(record?.catalogId)?.category;
 if(cat==='weapon'||cat==='armor'||cat==='cyberware'||cat==='gear')return cat;
 if(cat==='ammo'||cat==='attachment')return 'ammo';
 const own=record?.category;
 return own==='armor'||own==='cyberware'?own:own==='other'?'other':'gear';
}
const sign=type=>`<span class="inv-sign" data-inv-sign="${esc(type)}" aria-hidden="true">${SIGN[type]||SIGN.other}</span>`;
const icon=record=>sign(typeOf(record));
// The line the catalog gives a thing, with the page of the book.
function line(record,lang){
 const item=catalog(record?.catalogId);if(!item)return '';
 const text=item.details?.[L(lang)]||item.details?.ru||'',page=whole(item.page);
 return [text,page>0?`${t(lang,'page')} ${page}`:''].filter(Boolean).join(' · ');
}
const eqButton=(action,label,attrs,primary)=>`<button type="button" class="cx-button inv-act${primary?' inv-primary':''}" data-eq-action="${action}" ${attrs}>${esc(label)}</button>`;
// Where this piece of armor is worn now: [] when it is in the bag.
function wornAt(c,record){const a=c?.extra?.equipment?.armor;return isObject(a)?['head','body'].filter(k=>a[k]?.recordId===record?.id):[]}
function installedCount(c,record){
 if(record?.humanityLossIncluded===true)return whole(record.quantity)||1;
 const list=c?.extra?.equipment?.installs;return Array.isArray(list)?list.filter(i=>i&&i.recordId===record?.id&&!i.removedAt).length:0;
}
/* The buttons of a card. Armor: one piece covers the head or the body, so a piece that is worn offers to come off and a
   spare one offers the place that is left; a Bodyweight Suit covers both. Cyberware: «Установить» while a copy is not
   installed (the confirmation with the Humanity roll is shown in the block below, as before). */
function actions(c,record,lang){
 const item=catalog(record?.catalogId),id=esc(record?.id||'');if(!item||!id)return '';
 if(item.category==='armor'){
  if(!Number.isInteger(item.stats?.sp))return '';
  let fixed;try{fixed=global.EquipmentTools?.starterArmorLocation?.(record)}catch{fixed=false}
  if(fixed===false)return '';
  const worn=wornAt(c,record),spare=Math.max(0,(whole(record.quantity)||0)-(item.id==='armor-bodyweight-suit'?(worn.length?1:0):worn.length));
  if(item.id==='armor-bodyweight-suit')return worn.length?eqButton('unequip',t(lang,'off'),`data-eq-location="${worn[0]}"`):spare?eqButton('equip',t(lang,'wear'),`data-eq-id="${id}" data-eq-location="both"`,true):'';
  const places=fixed?[fixed]:['head','body'];
  return places.map(k=>worn.includes(k)?eqButton('unequip',t(lang,k==='head'?'offHead':'offBody'),`data-eq-location="${k}"`):spare?eqButton('equip',t(lang,k==='head'?'toHead':'toBody'),`data-eq-id="${id}" data-eq-location="${k}"`,true):'').join('');
 }
 if(item.category==='cyberware'&&installedCount(c,record)<(whole(record.quantity)||0))return eqButton('prepare',t(lang,'install'),`data-eq-id="${id}"`,true);
 return '';
}
// Under the name of a thing: its line and its buttons. Empty for a thing written in by hand, which has neither.
function quick(c,record,lang){
 // mods: the named modifiers tied to this thing (named-modifiers.js), to read only.
 const text=line(record,lang),buttons=actions(c,record,lang),mods=global.NamedModifiers?.itemChips?.(c,record,lang)||'';
 return text||buttons||mods?`<div class="inv-quick">${text?`<span class="inv-line">${esc(text)}</span>`:''}${mods}${buttons?`<span class="inv-actions">${buttons}</span>`:''}</div>`:'';
}
// A weapon is a card in the inventory too; its rolls stay on the fight tab, one tap away.
function weaponRow(c,w,lang,name){
 const item=catalog(w?.catalogId),label=name||w?.name||'',cap=whole(w?.capacity),uses=w?.usesAmmo===true||cap>0;
 const parts=[w?.damage?`${t(lang,'damage')} ${w.damage}`:'',`${t(lang,'rof')} ${Math.max(1,whole(w?.rof)||1)}`,uses&&cap>0?`${t(lang,'mag')} ${Math.max(0,whole(w?.ammo))}/${cap}`:'',whole(item?.page)>0?`${t(lang,'page')} ${whole(item.page)}`:''].filter(Boolean);
 return `<div class="cx-entry cx-item inv-weapon" data-inventory-row data-inventory-group="${esc(global.ItemGroups?.groupOf?.(c,w)||'')}" data-inventory-type="weapon" data-inventory-other="${esc([label,item?.name?.ru,item?.name?.en].filter(Boolean).join(' '))}"><div class="inv-head">${sign('weapon')}<strong>${esc(label||t(lang,'weapon'))}</strong><span class="gf-meta"><span class="gf-tag">${esc(t(lang,'weapon'))}</span></span></div><div class="inv-quick"><span class="inv-line">${esc(parts.join(' · '))}</span>${global.NamedModifiers?.itemChips?.(c,w,lang)||''}<span class="inv-actions">${global.ItemGroups?.field?.(c,'weapons',w,lang)||''}<button type="button" class="cx-button inv-act" data-hud-jump="sheet-weapons">${esc(t(lang,'toCombat'))} →</button></span></div></div>`;
}
// The weapon cards one by one, each with its record, so that item-groups.js can put a card into its group.
function weaponList(c,lang,nameOf){
 const list=c?.extra?.weapons;if(!Array.isArray(list))return [];
 return list.filter(isObject).map(w=>{let name='';try{name=typeof nameOf==='function'?nameOf(w):''}catch{}return {record:w,html:weaponRow(c,w,lang,name)}});
}
const weaponRows=(c,lang,nameOf)=>weaponList(c,lang,nameOf).map(x=>x.html).join('');

/* The armor and cyberware block, folded. It opens when the player opens it (and stays so across redraws), when «Надеть или
   снять» above the list leads to it, and when an installation waits there to be confirmed. */
let sticky=false;
function wrapEquipment(html,lang){
 if(!html)return '';
 const open=sticky||html.includes('data-eq-preview');
 return `<details class="inv-more" data-inv-more${open?' open':''}><summary><span>${esc(t(lang,'more'))}</span><small>${esc(t(lang,'moreHelp'))}</small></summary>${html}</details>`;
}
const doc=global.document;
doc?.addEventListener?.('toggle',e=>{if(e.target?.matches?.('[data-inv-more]'))sticky=e.target.open===true},true);
doc?.addEventListener?.('click',e=>{
 if(!e.target?.closest?.('[data-hud-jump="sheet-equipment"]'))return;
 sticky=true;const box=doc.querySelector?.('[data-inv-more]');if(box)box.open=true;
},true);

global.InventoryCards={TYPES,T,t,typeOf,icon,sign,line,actions,quick,wornAt,installedCount,weaponRow,weaponList,weaponRows,wrapEquipment,_test:{sticky:v=>{if(v!==undefined)sticky=!!v;return sticky}}};
})(typeof window!=='undefined'?window:globalThis);
