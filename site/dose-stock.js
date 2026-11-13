/* Doses of street drugs and pharmaceuticals live in the inventory (c.extra.items).
   Pure functions over a character. Legacy Medtech stock (c.extra.pharmacy.doses) is counted and spent first. */
(function(){
'use strict';
const IDS=Object.freeze({'black-lace':'extra-drug-black-lace','blue-glass':'extra-drug-blue-glass',boost:'extra-drug-boost',smash:'extra-drug-smash',synthcoke:'extra-drug-synthcoke',antibiotic:'extra-pharmaceutical-antibiotic',rapidetox:'extra-pharmaceutical-rapidetox',speedheal:'extra-pharmaceutical-speedheal',stim:'extra-pharmaceutical-stim',surge:'extra-pharmaceutical-surge'});
const NAMES=Object.freeze({'black-lace':'Black Lace','blue-glass':'Blue Glass',boost:'Boost',smash:'Smash',synthcoke:'Synthcoke',antibiotic:'Antibiotic',rapidetox:'Rapidetox',speedheal:'Speedheal',stim:'Stim',surge:'Surge'});
const PHARMA=new Set(['antibiotic','rapidetox','speedheal','stim','surge']);
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const catalogId=key=>typeof key==='string'&&Object.hasOwn(IDS,key)?IDS[key]:null;
function keyOf(record){
 if(!obj(record))return null;
 const id=record.catalogId;
 if(typeof id==='string'&&id!=='')return Object.keys(IDS).find(k=>IDS[k]===id)||null;
 if(id!==undefined&&id!==null&&id!=='')return null;
 if(typeof record.name!=='string')return null;
 const n=record.name.trim().toLowerCase();
 return Object.keys(NAMES).find(k=>NAMES[k].toLowerCase()===n)||null;
}
const list=c=>Array.isArray(c?.extra?.items)?c.extra.items:null;
function rows(c,key){const items=list(c);if(!items||!catalogId(key))return [];return items.filter(r=>obj(r)&&keyOf(r)===key&&Number.isSafeInteger(r.quantity)&&r.quantity>=1)}
function legacy(c,key){if(!PHARMA.has(key))return 0;const d=c?.extra?.pharmacy?.doses;if(!obj(d)||!Object.hasOwn(d,key))return 0;const n=d[key];return Number.isSafeInteger(n)&&n>=1&&n<=9999?n:0}
const count=(c,key)=>legacy(c,key)+rows(c,key).reduce((s,r)=>s+r.quantity,0);
function take(c,key){
 if(count(c,key)<1)return {ok:false,reason:'none'};
 if(legacy(c,key)>0){c.extra.pharmacy.doses[key]--}
 else{const row=rows(c,key)[0];if(row.quantity>1)row.quantity--;else c.extra.items.splice(c.extra.items.indexOf(row),1)}
 return {ok:true,left:count(c,key)};
}
const item=key=>(Array.isArray(window.CATALOG)?window.CATALOG.find(x=>x&&x.id===catalogId(key)):null)||null;
function canAdd(c,key,n){
 if(!catalogId(key)||!Number.isSafeInteger(n)||n<1||n>9999)return {ok:false,reason:'invalid'};
 if(!window.CharacterExtra?.addCatalog||!item(key)||!obj(c)||(c.extra!==undefined&&!obj(c.extra))||(c.extra?.items!==undefined&&!Array.isArray(c.extra.items)))return {ok:false,reason:'unavailable'};
 const items=list(c)||[],row=items.find(r=>obj(r)&&r.catalogId===catalogId(key));
 if(row){if(!Number.isSafeInteger(row.quantity)||row.quantity<0||row.quantity+n>99999)return {ok:false,reason:'full'}}
 else if(items.length>=500)return {ok:false,reason:'full'};
 return {ok:true};
}
function add(c,key,n,lang){
 const can=canAdd(c,key,n);if(!can.ok)return can;
 const items=list(c)||[],row=items.find(r=>obj(r)&&r.catalogId===catalogId(key));
 if(row){row.quantity+=n;return {ok:true,rowId:row.id}}
 try{const e=window.CharacterExtra.addCatalog(c,item(key),lang);if(!e?.record||e.kind!=='item')return {ok:false,reason:'unavailable'};e.record.quantity=n;return {ok:true,rowId:e.record.id}}
 catch{return {ok:false,reason:'unavailable'}}
}
window.DoseStock={IDS,NAMES,drugKeys:Object.keys(IDS),catalogId,keyOf,rows,legacy,count,take,canAdd,add};
})();
