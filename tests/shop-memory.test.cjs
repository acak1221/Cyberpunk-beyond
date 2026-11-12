// The shop remembers its buyer (site/shop-memory.js).
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const load=localStorage=>{const window={localStorage};vm.runInNewContext(fs.readFileSync(__dirname+'/../site/shop-memory.js','utf8'),{window});return window.ShopMemory};
const mem=()=>{const m=new Map();return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)}};
const chars=[{id:'a'},{id:'b'}];
test('remembers the buyer between visits',()=>{
 const ls=mem();load(ls).set('b');
 assert.equal(load(ls).get(chars),'b');
});
test('a deleted character falls back to nothing',()=>{
 const ls=mem();const m=load(ls);m.set('gone');
 assert.equal(m.get(chars),'');assert.equal(m.get([]),'');
});
test('clearing and blocked storage are safe',()=>{
 const ls=mem(),m=load(ls);m.set('a');m.set('');assert.equal(m.get(chars),'');
 const bad={getItem(){throw new Error('x')},setItem(){throw new Error('x')},removeItem(){throw new Error('x')}};
 const b=load(bad);b.set('a');assert.equal(b.get(chars),'');
 const none=load(undefined);none.set('a');assert.equal(none.get(chars),'');
});
