const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(__dirname + '/../public/game/sync-adapter.js', 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));
function deferred(){ let resolve; const promise = new Promise(r => { resolve = r }); return {promise,resolve}; }
function node(){ return {children:[],listeners:{},inert:false,isConnected:true,attrs:{},set innerHTML(v){this.html=v;this.children=[]},get innerHTML(){return this.html||''},setAttribute(k,v){this.attrs[k]=v},hasAttribute(k){return Object.hasOwn(this.attrs,k)},addEventListener(k,v){this.listeners[k]=v},appendChild(c){this.children.push(c)},contains(c){return this===c||this.children.some(x=>x.contains(c))},querySelector(){return null},click(){}}; }
function setup(providerResult){
 const scope='owner-123456789',app=node(),mount=node(),status=node(),pending=deferred(); let requests=0;
 const controller={scope,getStatus:()=>({kind:'synced'}),getConflict:()=>null,save:()=>pending.promise,refresh:async()=>{}};
 const w={localStorage:{getItem:k=>k==='nightcity-red-sync-owner-v1'?scope:null,setItem(){}},addEventListener(){},fetch:()=>{requests++;return providerResult()},CloudSync:{start:async()=>controller}};
 const document={querySelector(){return null},createElement(){return node()}};
 vm.runInNewContext(source,{window:w,document,Promise,Blob,URL,setTimeout,clearTimeout,confirm:()=>true});
 const adapter=w.SyncAdapter.create({app,mount,status,language:()=> 'en',read:()=>({characters:[],campaigns:[]}),apply(){}});
 return {adapter,app,status,pending,requests:()=>requests};
}
test('provider discovery never blocks sync and account navigation waits for pending writes',async()=>{
 const provider=deferred(),h=setup(()=>provider.promise);await h.adapter.start();assert.equal(h.adapter.canEdit(),true);await tick();assert.equal(h.requests(),1);assert.equal(h.status.children.length,0);
 provider.resolve({ok:true,json:async()=>({provider:'supabase'})});await tick();assert.equal(h.status.children[0].children[0].href,'/auth/account');
 const save=h.adapter.save({characters:[],campaigns:[]});assert.equal(h.status.children.length,0);h.pending.resolve({ok:true});await save;await tick();assert.equal(h.status.children[0].children[0].textContent,'Account and sign out');
});
test('Sites and failed provider discovery never create account navigation or block editing',async()=>{
 for(const response of [()=>Promise.resolve({ok:true,json:async()=>({provider:'sites'})}),()=>Promise.reject(Error('offline'))]){const h=setup(response);await h.adapter.start();await tick();assert.equal(h.adapter.canEdit(),true);assert.equal(h.status.children.length,0)}
});
test('an emergency draft continues to block account navigation after review',async()=>{
 const h=setup(()=>Promise.resolve({ok:true,json:async()=>({provider:'supabase'})}));await h.adapter.start();await tick();
 const save=h.adapter.save({characters:[],campaigns:[]});h.pending.resolve({ok:false,reason:'offline'});await save;assert.equal(h.adapter.hasDraft(),true);
 const click=action=>h.status.listeners.click({target:{closest(selector){return selector==='[data-adapter-action]'?{dataset:{adapterAction:action}}:null}}});
 click('download');click('review');assert.equal(h.adapter.canEdit(),true);assert.equal(h.adapter.hasDraft(),true);assert.equal(h.status.children.length,0);
});
test('account navigation asks before losing temporary fields and rejects a detached link',async()=>{
 const h=setup(()=>Promise.resolve({ok:true,json:async()=>({provider:'supabase'})}));await h.adapter.start();await tick();const link=h.status.children[0].children[0];let prevented=false;
 h.status.listeners.click({target:{closest:s=>s==='[data-adapter-account]'?link:null},preventDefault(){prevented=true}});assert.equal(prevented,false);
 link.isConnected=false;h.status.listeners.click({target:{closest:s=>s==='[data-adapter-account]'?link:null},preventDefault(){prevented=true}});assert.equal(prevented,true);
});
