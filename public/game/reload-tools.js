/* Personal standard-weapon reloads from explicitly purchased ammunition. Corebook pp. 170, 174, 344–346. */
(function(){
'use strict';
// A full magazine of exactly one type replaces the empty magazine. Known capacities
// are standard, extended, and drum values from the Corebook p. 344.
const WEAPONS=Object.freeze({
 'weapon-medium-pistol':{types:['medium-pistol'],caps:[12,18,36]},
 'weapon-heavy-pistol':{types:['heavy-pistol'],caps:[8,14,28]},
 'weapon-very-heavy-pistol':{types:['very-heavy-pistol'],caps:[8,14,28]},
 'weapon-smg':{types:['medium-pistol'],caps:[30,40,50]},
 'weapon-heavy-smg':{types:['heavy-pistol'],caps:[40,50,60]},
 'weapon-shotgun':{types:['slug','shell'],caps:[4,8,16]},
 'weapon-assault-rifle':{types:['rifle'],caps:[25,35,45]},
 'weapon-sniper-rifle':{types:['rifle'],caps:[4,8,12]},
 'weapon-grenade-launcher':{types:['grenade'],caps:[2,4,6]},
 'weapon-rocket-launcher':{types:['rocket'],caps:[1,2,3]}
});
const T={ru:{title:'ПЕРЕЗАРЯДКА ИЗ ИНВЕНТАРЯ',intro:'Выберите стандартное оружие и купленные боеприпасы. Перезаряжается только пустой магазин полностью, одним типом боеприпасов; частично заполненный или нестандартный учтите вручную (стр. 170, 174, 344–346).',weapon:'Оружие',ammo:'Запись боеприпасов',choose:'Выберите…',stock:'В запасе',mag:'Магазин',load:'Перезарядить',ready:'Будет израсходовано',need:'Нужно полностью заполнить магазин; недостаточно боеприпасов.',empty:'Оружие или подходящие купленные боеприпасы не найдены.',scope:'Дождитесь подтверждения аккаунта.',manual:'Проверяйте установленный магазин и свойства выбранных боеприпасов вручную; действие и специальные эффекты не применяются автоматически.',confirm:'Перезарядить пустой магазин полностью? Проверьте установленный магазин и совместимость. Потратить',rounds:'шт.',action:'Это занимает одно действие по книге; его расход учитывайте вручную.',ok:'Оружие перезаряжено, боеприпасы списаны.',stale:'Данные или аккаунт изменились. Проверьте и повторите действие.',invalid:'Проверьте оружие, остаток, размер магазина и выбранную запись боеприпасов.',occupied:'Автоматически перезаряжается только пустой магазин. Смену или смешение боеприпасов учтите вручную.'},en:{title:'RELOAD FROM INVENTORY',intro:'Select a standard weapon and purchased ammunition. Only an empty magazine is fully reloaded with one ammunition type; handle partly loaded or nonstandard weapons manually (pp. 170, 174, 344–346).',weapon:'Weapon',ammo:'Ammunition entry',choose:'Choose…',stock:'In stock',mag:'Magazine',load:'Reload',ready:'Will use',need:'A full magazine is required; not enough ammunition.',empty:'No eligible weapon or matching purchased ammunition was found.',scope:'Wait until account identity is confirmed.',manual:'Check the installed magazine and ammunition effects yourself; the Action and special effects are not applied automatically.',confirm:'Fully reload the empty magazine? Check the installed magazine and compatibility. Spend',rounds:'units',action:'This takes one Action under the Corebook; track it manually.',ok:'Weapon reloaded and ammunition deducted.',stale:'The data or account changed. Check and try again.',invalid:'Check the weapon, remaining rounds, magazine capacity and selected ammunition entry.',occupied:'Only an empty magazine can be reloaded automatically. Handle a change or mixing of ammunition manually.'}};
Object.assign(T.ru,{lastReload:'Последняя подтверждённая перезарядка',lastNote:'Это запись последней операции, а не гарантия текущего содержимого магазина: его можно изменить вручную.',unknownReceipt:'Формат записи о последней перезарядке не поддерживается; автоматическая перезарядка отключена, запись сохранена.'});
Object.assign(T.en,{lastReload:'Last confirmed reload',lastNote:'This records the last operation, not the current magazine contents: those can be edited manually.',unknownReceipt:'The last-reload record has an unsupported format; automatic reloading is disabled and the record is preserved.'});
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const text=lang=>T[lang==='en'?'en':'ru'];
const validId=x=>typeof x==='string'&&x.length>0&&x.length<=160;
const integer=(n,a,b)=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=a&&n<=b;
let scope=null;const drafts=new Map();
function setScope(s){scope=typeof s==='string'&&s.length>0&&s.length<=512?s:null}
function key(c){return scope&&validId(c?.id)?JSON.stringify([scope,c.id]):null}
function draft(c){const k=key(c);if(!k)return null;if(!drafts.has(k))drafts.set(k,{weapon:'',ammo:''});return drafts.get(k)}
function lookup(c,list,id){if(!validId(id)||!Array.isArray(c?.extra?.[list]))return null;const matches=c.extra[list].filter(x=>x&&typeof x==='object'&&!Array.isArray(x)&&x.id===id);return matches.length===1?matches[0]:null}
function weaponProfile(w){if(!w||!Object.hasOwn(WEAPONS,w.catalogId))return null;const p=WEAPONS[w.catalogId];return w.usesAmmo===true&&integer(w.capacity,1,100)&&p.caps.includes(w.capacity)&&integer(w.ammo,0,w.capacity)?p:null}
function validReceipt(v){return !!v&&typeof v==='object'&&!Array.isArray(v)&&v.version===1&&validId(v.ammoCatalogId)&&validId(v.ammoType)&&validId(v.ammoRecordId)&&integer(v.units,1,100)}
function ammunition(rec){
 if(!rec||!validId(rec.catalogId)||!validId(rec.ammoType)||!integer(rec.quantity,0,99999))return null;
 // Only records created by an explicitly confirmed catalog purchase are eligible.
 const p=rec.purchase;if(!p||typeof p!=='object'||Array.isArray(p)||p.itemId!==rec.catalogId||p.ammoType!==rec.ammoType||!integer(p.perPack,1,10)||!integer(p.quantity,1,50)||p.ammoCount!==p.perPack*p.quantity)return null;
 const item=Array.isArray(window.CATALOG)?window.CATALOG.find(x=>x.id===rec.catalogId&&x.category==='ammo'):null;
 const available=window.EquipmentTools?.ammoTypeOptions?.(item,'en');if(!item||!Array.isArray(available)||!available.some(x=>x.value===rec.ammoType))return null;
 const expected=['grenade','rocket'].includes(rec.ammoType)?1:10;if(p.perPack!==expected)return null;
 return {item,type:rec.ammoType};
}
function quote(c,weaponId,ammoId,lang){
 const t=text(lang),w=lookup(c,'weapons',weaponId),a=lookup(c,'items',ammoId),profile=weaponProfile(w),spec=ammunition(a);
 if(!scope||!validId(c?.id)||!w||!a||!profile||!spec||!profile.types.includes(spec.type))return {ok:false,reason:'invalid',message:t.invalid};
 if(w.lastReload!==undefined&&!validReceipt(w.lastReload))return {ok:false,reason:'unknownReceipt',message:t.unknownReceipt};
 if(w.ammo!==0)return {ok:false,reason:'occupied',message:t.occupied};
 if(a.quantity<w.capacity)return {ok:false,reason:'need',message:t.need};
 const option=window.EquipmentTools?.ammoTypeName?.(spec.type,lang)||spec.type;
 const itemName=spec.item.name?.[lang==='en'?'en':'ru']||spec.item.name?.en||'';
 const q={scope,characterId:c.id,weaponId:w.id,ammoId:a.id,weaponCatalogId:w.catalogId,ammoCatalogId:a.catalogId,ammoType:spec.type,capacity:w.capacity,weaponAmmo:w.ammo,stock:a.quantity,weaponName:String(w.name||''),ammoName:String(a.name||''),itemName:String(itemName),typeName:String(option),priorReceipt:w.lastReload===undefined?null:w.lastReload};
 return {ok:true,quote:q,signature:JSON.stringify(q)};
}
function commit(c,expected,lang,options={}){
 const t=text(lang);if(!expected||typeof expected!=='object'||!expected.quote||typeof expected.signature!=='string')return {ok:false,reason:'invalid',message:t.invalid};
 let current=false;try{current=typeof options.isCurrent==='function'&&options.isCurrent(c,scope)===true}catch{}
 if(!scope||!current)return {ok:false,reason:'stale',message:t.stale};
 const check=quote(c,expected.quote.weaponId,expected.quote.ammoId,lang);if(!check.ok||check.signature!==expected.signature)return {ok:false,reason:'stale',message:t.stale};
 const w=lookup(c,'weapons',check.quote.weaponId),a=lookup(c,'items',check.quote.ammoId);
 // The host writes the entire character as one snapshot; both mutations are synchronous.
 a.quantity-=check.quote.capacity;w.ammo=check.quote.capacity;
 w.lastReload={...(w.lastReload||{}),version:1,ammoCatalogId:a.catalogId,ammoType:a.ammoType,ammoRecordId:a.id,units:check.quote.capacity};
 return {ok:true,dirty:true,loaded:check.quote.capacity};
}
function render(c,lang){
 const t=text(lang),d=draft(c);let out=`<section class="card reload-tools"><div class="card-heading"><span>${esc(t.title)}</span><span>170 / 344</span></div><p class="reload-note">${esc(t.intro)}</p><p class="reload-note">${esc(t.manual)}</p>`;
 if(!d)return out+`<p class="reload-note">${esc(t.scope)}</p></section>`;
 const allWeapons=Array.isArray(c?.extra?.weapons)?c.extra.weapons.filter(w=>w&&typeof w==='object'&&!Array.isArray(w)):[];
 const weapons=allWeapons.filter(w=>weaponProfile(w)&&lookup(c,'weapons',w.id)===w);
 const items=Array.isArray(c?.extra?.items)?c.extra.items.filter(a=>ammunition(a)&&lookup(c,'items',a.id)===a):[];
 const chosen=weapons.find(w=>w.id===d.weapon),profile=weaponProfile(chosen),compatible=items.filter(a=>profile?.types.includes(a.ammoType));
 const options=(list,selected,fmt)=>`<option value="">${esc(t.choose)}</option>`+list.map(x=>`<option value="${esc(x.id)}" ${x.id===selected?'selected':''}>${esc(fmt(x))}</option>`).join('');
 out+=`<div class="reload-grid"><label class="field">${esc(t.weapon)}<select data-reload-field="weapon">${options(weapons,d.weapon,w=>`${w.name||w.catalogId} · ${t.mag} ${w.ammo}/${w.capacity}`)}</select></label><label class="field">${esc(t.ammo)}<select data-reload-field="ammo">${options(compatible,d.ammo,a=>`${a.name||a.catalogId} · ${window.EquipmentTools?.ammoTypeName?.(a.ammoType,lang)||a.ammoType} · ${t.stock} ${a.quantity}`)}</select></label></div>`;
 for(const gun of allWeapons.filter(w=>w.lastReload!==undefined)){if(validReceipt(gun.lastReload)){const prior=gun.lastReload,entry=Array.isArray(window.CATALOG)?window.CATALOG.find(x=>x.id===prior.ammoCatalogId):null,l=lang==='en'?'en':'ru',name=entry?.name?.[l]||entry?.name?.en||prior.ammoCatalogId,typeName=window.EquipmentTools?.ammoTypeName?.(prior.ammoType,lang)||prior.ammoType;out+=`<p class="reload-note"><strong>${esc(gun.name||gun.catalogId)} — ${esc(t.lastReload)}:</strong> ${esc(name)} · ${esc(typeName)} · ${prior.units} ${esc(t.rounds)}. ${esc(t.lastNote)}</p>`}else out+=`<p class="reload-warning">${esc(gun.name||gun.catalogId)}: ${esc(t.unknownReceipt)}</p>`}
 if(!weapons.length||!items.length)out+=`<p class="reload-note">${esc(t.empty)}</p>`;
 const q=d.weapon&&d.ammo?quote(c,d.weapon,d.ammo,lang):null;if(q?.ok)out+=`<p class="reload-note">${esc(t.ready)} ${q.quote.capacity} ${esc(t.rounds)} · ${esc(q.quote.itemName)} · ${esc(q.quote.typeName)}</p>`;else if(q)out+=`<p class="reload-warning">${esc(q.message)}</p>`;
 out+=`<button type="button" class="btn ghost" data-reload="load" ${!q?.ok?'disabled':''}>${esc(t.load)}</button></section>`;return out;
}
function handle(e,c,lang,options={}){
 const d=draft(c),t=text(lang),el=e?.target;if(!el)return {handled:false};
 if((e.type==='input'||e.type==='change')&&el.dataset?.reloadField){const k=el.dataset.reloadField;if(!d||!['weapon','ammo'].includes(k))return {handled:true};const v=String(el.value||'');if(v&&!validId(v))return {handled:true};d[k]=v;if(k==='weapon')d.ammo='';return {handled:true,rerender:e.type==='change'};}
 const b=e.type==='click'?el.closest?.('[data-reload]'):null;if(!b)return {handled:false};if(b.dataset.reload!=='load'||!d)return {handled:true,notify:t.scope};
 let current=false;try{current=typeof options.isCurrent==='function'&&options.isCurrent(c,scope)===true}catch{}if(!current)return {handled:true,notify:t.stale};
 const before=quote(c,d.weapon,d.ammo,lang);if(!before.ok)return {handled:true,notify:before.message};
 const q=before.quote,prompt=`${t.confirm} ${q.capacity} ${t.rounds}: ${q.itemName} · ${q.typeName}? ${t.action}`;
 if(!window.confirm(prompt))return {handled:true};const result=commit(c,before,lang,options);if(!result.ok)return {handled:true,notify:result.message};
 d.ammo='';return {handled:true,dirty:true,rerender:true,notify:t.ok};
}
window.ReloadTools={WEAPONS,setScope,quote,commit,render,handle,validReceipt};
})();
