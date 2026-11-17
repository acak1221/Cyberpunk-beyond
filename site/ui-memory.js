/* Per-device view preferences: which tab was open, which filter was chosen, how a list is sorted.
   They live in this browser's localStorage under their own prefix (nc-pref-) and are never part of the archive:
   not in backups, transfers, share links or rooms. Every read and write is guarded: where storage is blocked the value
   is kept in memory for this visit, and a stored value that does not pass the check is ignored. */
(function(global){
'use strict';
const PREFIX='nc-pref-',NAME=/^[a-z0-9][a-z0-9-]{0,47}$/,MAX_CHARS=2000;
const mem=new Map();
const valid=n=>typeof n==='string'&&NAME.test(n);
function storage(){try{return global.localStorage||null}catch{return null}}
// validate(value) returns true, false, or the cleaned value; without it any JSON value passes.
function check(validate,value){
 if(typeof validate!=='function')return {ok:true,value};
 try{const r=validate(value);if(r===true)return {ok:true,value};if(r===false||r===undefined||r===null)return {ok:false};return {ok:true,value:r}}catch{return {ok:false}}
}
function get(name,fallback,validate){
 if(!valid(name))return fallback;
 let raw=null;
 try{raw=storage()?.getItem(PREFIX+name)??null}catch{raw=null}
 if(raw===null){if(mem.has(name)){const c=check(validate,mem.get(name));return c.ok?c.value:fallback}return fallback}
 let value;try{value=JSON.parse(raw)}catch{return fallback}
 const c=check(validate,value);
 return c.ok?c.value:fallback;
}
function set(name,value){
 if(!valid(name)||value===undefined)return false;
 let raw;try{raw=JSON.stringify(value)}catch{return false}
 if(typeof raw!=='string'||raw.length>MAX_CHARS)return false;
 mem.set(name,JSON.parse(raw));
 try{storage()?.setItem(PREFIX+name,raw)}catch{return false}
 return true;
}
function remove(name){
 if(!valid(name))return false;
 mem.delete(name);
 try{storage()?.removeItem(PREFIX+name)}catch{return false}
 return true;
}
function keys(){
 const out=[];
 try{const s=storage();if(s)for(let i=0;i<s.length;i++){const k=s.key(i);if(typeof k==='string'&&k.startsWith(PREFIX))out.push(k.slice(PREFIX.length))}}catch{}
 return out.sort();
}
global.UIMemory={PREFIX,get,set,remove,keys,_test:{mem}};
})(typeof window!=='undefined'?window:globalThis);
