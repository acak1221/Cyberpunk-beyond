const {test}=require('node:test'),assert=require('node:assert/strict'),plain=x=>JSON.parse(JSON.stringify(x)),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const code=fs.readFileSync(path.join(__dirname,'../site/local-store.js'),'utf8');

function setup({raw=null,quotaFull=false,issue=null}={}){
 const data=new Map(raw===null?[]:[['nightcity-red-v1',raw]]),listeners={},timers=[];
 const localStorage={getItem:k=>data.has(k)?data.get(k):null,setItem(k,v){if(quotaFull)throw Error('quota');data.set(k,String(v))},removeItem:k=>data.delete(k)};
 const status={hidden:true,innerHTML:'',listeners:{},addEventListener(t,fn){this.listeners[t]=fn}};
 const app={inert:true,attrs:{},setAttribute(k,v){this.attrs[k]=v}};
 const win={localStorage,addEventListener(t,fn){listeners[t]=fn},confirm:()=>true,navigator:{}};
 const ctx={window:win,document:{querySelector:()=>null,addEventListener(){},visibilityState:'visible'},setTimeout:(fn)=>{timers.push(fn);return timers.length},clearTimeout(){},JSON,Promise,Error,Date,URL,Blob};
 vm.runInNewContext(code,ctx);
 const calls={apply:[],scope:[],failure:0};
 const store=win.LocalStore.create({app,status,language:()=>'ru',initialIssue:issue,validate:x=>!!x&&Array.isArray(x.characters),apply:x=>calls.apply.push(x),onScopeChange:s=>calls.scope.push(s),onFailure:()=>calls.failure++});
 return {store,data,app,status,listeners,timers,calls,localStorage};
}

test('start unlocks the app and reports a fixed local scope',()=>{
 const h=setup();assert.equal(h.store.getScope(),null);h.store.start();
 assert.equal(h.app.inert,false);assert.equal(h.store.getScope(),'local');assert.equal(h.store.canEdit(),true);assert.deepEqual(h.calls.scope,['local']);
});

test('save coalesces writes and resolves every waiter after flushing',async()=>{
 const h=setup();h.store.start();
 const a=h.store.save({characters:[1]}),b=h.store.save({characters:[1,2]});
 assert.equal(h.data.get('nightcity-red-v1'),undefined);
 assert.equal(h.store.hasQueued(),false);
 assert.deepEqual(plain(await a),{ok:true});assert.deepEqual(plain(await b),{ok:true});
 assert.deepEqual(JSON.parse(h.data.get('nightcity-red-v1')),{characters:[1,2]});
});

test('save snapshots the value at call time',async()=>{
 const h=setup();h.store.start();const value={characters:[{id:'a'}]};const p=h.store.save(value);value.characters.push({id:'b'});h.store.flush();await p;
 assert.equal(JSON.parse(h.data.get('nightcity-red-v1')).characters.length,1);
});

test('storage failures are reported instead of thrown',async()=>{
 const h=setup({quotaFull:true});h.store.start();const p=h.store.save({characters:[]});h.store.flush();
 assert.deepEqual(plain(await p),{ok:false,reason:'storage'});assert.equal(h.calls.failure,1);assert.match(h.store.stateLabel(),/ОШИБКА/);
});

test('changes from another tab are validated before being applied',()=>{
 const h=setup();h.store.start();
 h.listeners.storage({key:'nightcity-red-v1',storageArea:h.localStorage,newValue:'{broken'});
 h.listeners.storage({key:'nightcity-red-v1',storageArea:h.localStorage,newValue:JSON.stringify({nope:1})});
 assert.equal(h.calls.apply.length,0);
 h.listeners.storage({key:'nightcity-red-v1',storageArea:h.localStorage,newValue:JSON.stringify({characters:[]})});
 assert.equal(h.calls.apply.length,1);
});

test('unreadable data is set aside before editing is allowed',()=>{
 const h=setup({raw:'{broken',issue:{raw:'{broken'}});h.store.start();
 assert.equal(h.data.get('nightcity-red-v1:recovery'),'{broken');assert.equal(h.store.canEdit(),true);assert.equal(h.status.hidden,false);
});

test('editing pauses when unreadable data cannot be set aside',async()=>{
 const h=setup({raw:'{broken',issue:{raw:'{broken'},quotaFull:true});h.store.start();
 assert.equal(h.store.canEdit(),false);assert.equal(h.app.inert,true);
 assert.deepEqual(plain(await h.store.save({characters:[]})),{ok:false,reason:'paused'});
 assert.equal(h.data.get('nightcity-red-v1'),'{broken');
});
