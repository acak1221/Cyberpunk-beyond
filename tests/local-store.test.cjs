const {test}=require('node:test'),assert=require('node:assert/strict'),plain=x=>JSON.parse(JSON.stringify(x)),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const code=fs.readFileSync(path.join(__dirname,'../site/local-store.js'),'utf8');

function setup({raw=null,quotaFull=false,issue=null,seed={},navigator={},lang='ru',onPersistence}={}){
 const data=new Map([...(raw===null?[]:[['nightcity-red-v1',raw]]),...Object.entries(seed)]),listeners={},timers=[];
 const localStorage={getItem:k=>data.has(k)?data.get(k):null,setItem(k,v){if(typeof quotaFull==='function'?quotaFull(k,v):quotaFull)throw Error('quota');data.set(k,String(v))},removeItem:k=>data.delete(k),get length(){return data.size},key:i=>[...data.keys()][i]??null};
 const status={hidden:true,innerHTML:'',listeners:{},addEventListener(t,fn){this.listeners[t]=fn}};
 const app={inert:true,attrs:{},setAttribute(k,v){this.attrs[k]=v}};
 const win={localStorage,addEventListener(t,fn){listeners[t]=fn},confirm:()=>true,navigator,location:{reload(){win.reloaded=(win.reloaded||0)+1}}};
 const ctx={window:win,document:{querySelector:()=>null,addEventListener(){},visibilityState:'visible'},setTimeout:(fn)=>{timers.push(fn);return timers.length},clearTimeout(){},JSON,Promise,Error,Date,URL,Blob};
 vm.runInNewContext(code,ctx);
 const calls={apply:[],scope:[],failure:0};
 const store=win.LocalStore.create({app,status,language:()=>lang,initialIssue:issue,validate:x=>!!x&&Array.isArray(x.characters),isNewer:x=>x?.schemaVersion>1,apply:x=>calls.apply.push(x),onScopeChange:s=>calls.scope.push(s),onFailure:()=>calls.failure++,onPersistence});
 return {store,data,app,status,listeners,timers,calls,localStorage,win,copyKeys:()=>[...data.keys()].filter(k=>k.startsWith('nightcity-red-v1:recovery'))};
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
 const keys=h.copyKeys();assert.equal(keys.length,1);assert.match(keys[0],/^nightcity-red-v1:recovery:\d+$/);assert.equal(h.data.get(keys[0]),'{broken');
 assert.equal(h.store.canEdit(),true);assert.equal(h.status.hidden,false);assert.match(h.status.innerHTML,/отложена в резерв/);
});

test('editing pauses when unreadable data cannot be set aside',async()=>{
 const h=setup({raw:'{broken',issue:{raw:'{broken'},quotaFull:true});h.store.start();
 assert.equal(h.store.canEdit(),false);assert.equal(h.app.inert,true);
 assert.deepEqual(plain(await h.store.save({characters:[]})),{ok:false,reason:'paused'});
 assert.equal(h.data.get('nightcity-red-v1'),'{broken');
});

test('a repeated unreadable archive gets its own dated copy and the older copy stays untouched',async()=>{
 const h=setup({raw:'{"second":',issue:{raw:'{"second":',kind:'unreadable'},seed:{'nightcity-red-v1:recovery':'{"first":"old incident"}'}});h.store.start();
 assert.equal(h.data.get('nightcity-red-v1:recovery'),'{"first":"old incident"}');
 const dated=h.copyKeys().filter(k=>k!=='nightcity-red-v1:recovery');assert.equal(dated.length,1);assert.equal(h.data.get(dated[0]),'{"second":');
 assert.equal(h.store.canEdit(),true);
 // The first edit replaces the main key only after the original is safe in its own copy.
 const p=h.store.save({characters:[]});h.store.flush();await p;
 assert.equal(h.data.get(dated[0]),'{"second":');assert.equal(h.data.get('nightcity-red-v1:recovery'),'{"first":"old incident"}');
 assert.deepEqual(plain(h.store.copies().map(c=>c.kind)),['recovery','recovery']);
});

test('the same unreadable archive is not copied twice',()=>{
 const seed={'nightcity-red-v1:recovery:1700000000000':'{broken'};
 const h=setup({raw:'{broken',issue:{raw:'{broken'},seed});h.store.start();
 assert.deepEqual(h.copyKeys(),['nightcity-red-v1:recovery:1700000000000']);assert.equal(h.store.canEdit(),true);
});

test('editing pauses instead of dropping data when the copy limits are reached',async()=>{
 const seed=Object.fromEntries(Array.from({length:5},(_,i)=>['nightcity-red-v1:recovery:'+(1700000000000+i),'{old'+i]));
 const h=setup({raw:'{new',issue:{raw:'{new'},seed});h.store.start();
 assert.equal(h.copyKeys().length,5);assert.equal(h.store.canEdit(),false);assert.equal(h.app.inert,true);assert.match(h.status.innerHTML,/data-store-action="reset"/);
 assert.deepEqual(plain(await h.store.save({characters:[]})),{ok:false,reason:'paused'});assert.equal(h.data.get('nightcity-red-v1'),'{new');
 const big=setup({raw:'x'.repeat(10),issue:{raw:'x'.repeat(10)},seed:{'nightcity-red-v1:recovery:1':'y'.repeat(3e6)}});big.store.start();
 assert.equal(big.store.canEdit(),false);assert.equal(big.copyKeys().length,1);
});

test('a partly readable archive keeps editing and names what was set aside without HTML injection',()=>{
 const h=setup({raw:'{}',issue:{raw:'{}',kind:'partial',summary:{characters:['<img src=x onerror=alert(1)>','Б'],campaigns:['K'],sections:1}}});h.store.start();
 assert.equal(h.store.canEdit(),true);assert.equal(h.copyKeys().length,0);
 assert.match(h.status.innerHTML,/персонажи: 2 — «&lt;img src=x onerror=alert\(1\)&gt;», «Б»; кампании: 1 — «K»; другие разделы: 1/);assert.doesNotMatch(h.status.innerHTML,/<img/);
 const en=setup({raw:'{}',issue:{raw:'{}',kind:'partial',summary:{characters:['Rook'],campaigns:[],sections:0}},lang:'en'});en.store.start();
 assert.match(en.status.innerHTML,/Some saved data could not be read \(characters: 1 — “Rook”\)/);
});

test('data from a newer app version pauses editing and offers a reload',async()=>{
 const h=setup({raw:'{"schemaVersion":9}',issue:{raw:'{"schemaVersion":9}',kind:'newer'}});h.store.start();
 assert.equal(h.store.canEdit(),false);assert.equal(h.copyKeys().length,0);assert.match(h.status.innerHTML,/более новой версией/);
 h.status.listeners.click({target:{closest:()=>({dataset:{storeAction:'reload'}})}});assert.equal(h.win.reloaded,1);
 assert.deepEqual(plain(await h.store.save({characters:[]})),{ok:false,reason:'paused'});
});

test('a newer version writing in another tab pauses this tab and drops its queued save',async()=>{
 const h=setup();h.store.start();const p=h.store.save({characters:[{id:'old'}]});
 h.listeners.storage({key:'nightcity-red-v1',storageArea:h.localStorage,newValue:JSON.stringify({schemaVersion:2,characters:[]})});
 assert.deepEqual(plain(await p),{ok:false,reason:'paused'});assert.equal(h.store.canEdit(),false);assert.equal(h.calls.apply.length,0);assert.equal(h.data.get('nightcity-red-v1'),undefined);
});

test('an older pre-restore snapshot stays until the restore is written, and survives a failed write',()=>{
 const h=setup();h.store.start();
 const first=h.store.keepBeforeRestore('{"a":1}');assert.match(first,/^nightcity-red-v1:before-restore:\d+$/);
 const second=h.store.keepBeforeRestore('{"a":2}');assert.notEqual(second,first);
 assert.equal(h.store.readCopy(first),'{"a":1}','a restore that does not fit must not cost the snapshot the user already had');assert.equal(h.store.readCopy(second),'{"a":2}');
 // The caller wrote the restored data: only now do the older snapshots go.
 h.data.set('nightcity-red-v1:recovery:3','{old');h.store.dropOlderBeforeRestore(second);
 assert.equal(h.data.has(first),false);assert.equal(h.store.readCopy(second),'{"a":2}');assert.equal(h.data.get('nightcity-red-v1:recovery:3'),'{old','unreadable copies are not snapshots');
 // An id that is not a stored snapshot removes nothing.
 const third=h.store.keepBeforeRestore('{"a":3}');
 for(const id of ['nightcity-red-v1:before-restore:1','nightcity-red-v1:recovery:3','nightcity-red-v1',false,undefined])h.store.dropOlderBeforeRestore(id);
 assert.equal(h.store.readCopy(second),'{"a":2}');assert.equal(h.store.readCopy(third),'{"a":3}');
 assert.equal(h.store.keepBeforeRestore({a:1}),false);
 const failing=setup({quotaFull:(k,v)=>v==='{"b":2}',seed:{'nightcity-red-v1:before-restore:5':'{"b":1}'}});failing.store.start();
 assert.equal(failing.store.keepBeforeRestore('{"b":2}'),false);assert.equal(failing.data.get('nightcity-red-v1:before-restore:5'),'{"b":1}');
});

test('a save that did not fit is tried again quietly by the next flush',async()=>{
 let full=true;const h=setup({quotaFull:k=>full&&k==='nightcity-red-v1'});h.store.start();
 const p=h.store.save({characters:[{id:'a'}]});assert.deepEqual(plain(h.store.flush()),{ok:false,reason:'storage'});assert.deepEqual(plain(await p),{ok:false,reason:'storage'});
 assert.equal(h.calls.failure,1);assert.match(h.store.stateLabel(),/ОШИБКА/);
 assert.deepEqual(plain(h.store.flush()),{ok:false,reason:'storage'});assert.equal(h.calls.failure,1,'the second failure of the same save shows no new notice');
 // Space was freed (a copy removed, a picture deleted): the edits that failed are written when the page is hidden or closed.
 full=false;h.listeners.pagehide();
 assert.deepEqual(JSON.parse(h.data.get('nightcity-red-v1')),{characters:[{id:'a'}]});assert.match(h.store.stateLabel(),/СОХРАНЕНО/);
 assert.deepEqual(plain(h.store.flush()),{ok:true});
});

test('a newer save replaces the one that did not fit, and forget drops it when the old data is put back',async()=>{
 let full=true;const h=setup({raw:'{"characters":[]}',quotaFull:k=>full&&k==='nightcity-red-v1'});h.store.start();
 h.store.save({characters:[{id:'big'}]});h.store.flush();
 h.store.save({characters:[{id:'small'}]});full=false;assert.deepEqual(plain(h.store.flush()),{ok:true});
 assert.deepEqual(JSON.parse(h.data.get('nightcity-red-v1')),{characters:[{id:'small'}]});
 full=true;h.store.save({characters:[{id:'big'}]});h.store.flush();assert.match(h.store.stateLabel(),/ОШИБКА/);
 h.store.forget();full=false;assert.match(h.store.stateLabel(),/СОХРАНЕНО/);assert.deepEqual(plain(h.store.flush()),{ok:true});
 assert.deepEqual(JSON.parse(h.data.get('nightcity-red-v1')),{characters:[{id:'small'}]},'the forgotten save is never written');
 h.store.forget();
});

test('a failed save is not retried over data from another tab or a newer version',()=>{
 let full=true;const h=setup({quotaFull:k=>full&&k==='nightcity-red-v1'});h.store.start();
 h.store.save({characters:[{id:'mine'}]});h.store.flush();
 const other=JSON.stringify({characters:[{id:'theirs'}]});h.data.set('nightcity-red-v1',other);
 h.listeners.storage({key:'nightcity-red-v1',storageArea:h.localStorage,newValue:other});
 full=false;h.store.flush();assert.equal(h.data.get('nightcity-red-v1'),other);assert.equal(h.calls.apply.length,1);
 full=true;h.store.save({characters:[{id:'mine'}]});h.store.flush();
 const newer=JSON.stringify({schemaVersion:2,characters:[]});h.data.set('nightcity-red-v1',newer);
 h.listeners.storage({key:'nightcity-red-v1',storageArea:h.localStorage,newValue:newer});
 full=false;h.store.flush();assert.equal(h.data.get('nightcity-red-v1'),newer);assert.equal(h.store.canEdit(),false);
});

test('hasRoom probes the browser storage without leaving anything behind',()=>{
 const h=setup({raw:'{"characters":[]}',quotaFull:(k,v)=>v.length>1000});h.store.start();
 assert.equal(h.store.hasRoom(1000),true);assert.equal(h.store.hasRoom(1001),false);assert.equal(h.store.hasRoom(999.2),true);
 for(const odd of [0,-5,NaN,undefined,'x'])assert.equal(h.store.hasRoom(odd),true);
 assert.deepEqual([...h.data.keys()],['nightcity-red-v1']);
 const broken=setup({quotaFull:true});broken.store.start();assert.equal(broken.store.hasRoom(1),false);assert.equal(broken.data.size,0);
});

test('copy helpers only touch set-aside keys',()=>{
 const h=setup({raw:'{"characters":[]}',seed:{'nightcity-red-v1:recovery':'{old','nightcity-red-v1:before-restore:7':'{b','other':'x'}});h.store.start();
 assert.deepEqual(plain(h.store.copies().map(c=>[c.id,c.kind,c.at,c.size])),[['nightcity-red-v1:before-restore:7','before-restore',7,2],['nightcity-red-v1:recovery','recovery',null,4]]);
 assert.equal(h.store.readCopy('nightcity-red-v1'),null);assert.equal(h.store.removeCopy('nightcity-red-v1'),false);assert.equal(h.store.removeCopy('other'),false);
 assert.equal(h.store.removeCopy('nightcity-red-v1:recovery'),true);assert.equal(h.data.has('nightcity-red-v1:recovery'),false);assert.equal(h.data.get('nightcity-red-v1'),'{"characters":[]}');
});

test('storage persistence is requested once and its answer is reported',async()=>{
 const asked=[];let reported;
 const granted=setup({navigator:{storage:{persisted:async()=>false,persist:async()=>{asked.push(1);return true}}},onPersistence:p=>reported=p});granted.store.start();
 assert.equal(granted.store.persistence(),'pending');await new Promise(r=>setImmediate(r));
 assert.equal(granted.store.persistence(),'granted');assert.equal(reported,'granted');assert.equal(asked.length,1);
 const already=setup({navigator:{storage:{persisted:async()=>true,persist:async()=>{asked.push(2);return false}}}});already.store.start();await new Promise(r=>setImmediate(r));
 assert.equal(already.store.persistence(),'granted');assert.equal(asked.length,1);
 const denied=setup({navigator:{storage:{persist:async()=>false}}});denied.store.start();await new Promise(r=>setImmediate(r));assert.equal(denied.store.persistence(),'denied');
 let late;const none=setup({onPersistence:p=>late=p});none.store.start();assert.equal(none.store.persistence(),'unsupported');assert.equal(late,undefined,'never called while start() runs');
 await new Promise(r=>setImmediate(r));assert.equal(late,'unsupported');
});
