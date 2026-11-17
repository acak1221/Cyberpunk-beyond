// Per-device view preferences: guarded storage under their own prefix, validated on the way out, never in the archive.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const code=fs.readFileSync(path.join(__dirname,'..','site','ui-memory.js'),'utf8');
function load({store={},broken=false,full=false}={}){
 const map=new Map(Object.entries(store));
 const localStorage=broken?{getItem(){throw new Error('blocked')},setItem(){throw new Error('blocked')},removeItem(){throw new Error('blocked')},get length(){throw new Error('blocked')}}
  :{get length(){return map.size},key:i=>[...map.keys()][i]??null,getItem:k=>map.has(k)?map.get(k):null,setItem:(k,v)=>{if(full)throw new Error('quota');map.set(k,String(v))},removeItem:k=>map.delete(k)};
 const window={localStorage};
 vm.runInNewContext(code,{window,JSON,Map});
 return {M:window.UIMemory,map};
}

test('a value round-trips under the nc-pref- prefix',()=>{
 const {M,map}=load();
 assert.equal(M.set('combat-filter',{open:true,n:3}),true);
 assert.ok(map.has('nc-pref-combat-filter'));
 assert.deepEqual(JSON.parse(JSON.stringify(M.get('combat-filter',null))),{open:true,n:3});
 assert.equal(M.get('missing','fallback'),'fallback');
});

test('the fallback is returned for unreadable JSON and for values that fail the check',()=>{
 const {M}=load({store:{'nc-pref-a':'{not json','nc-pref-b':'"sheet"','nc-pref-c':'7'}});
 assert.equal(M.get('a','x'),'x');
 const tab=v=>['skills','gear'].includes(v);
 assert.equal(M.get('b','skills',tab),'skills');
 assert.equal(M.get('c','skills',tab),'skills');
 M.set('b','gear');assert.equal(M.get('b','skills',tab),'gear');
 // A validator may also clean the value.
 M.set('c',99);assert.equal(M.get('c',1,v=>Number.isFinite(v)?Math.min(v,10):false),10);
 assert.equal(M.get('c',1,()=>{throw new Error('bad')}),1);
});

test('names are restricted, so no other key can be read or written through it',()=>{
 const {M,map}=load({store:{'nightcity-red-v1':'{}','nc-ui-theme':'dark'}});
 for(const bad of ['','A','a b','../x','x'.repeat(60),'a/b',null,undefined])assert.equal(M.set(bad,1),false,String(bad));
 assert.equal(M.get('nightcity-red-v1','no'),'no');
 
 // A name that looks like another key only ever reaches the prefixed one.
 assert.equal(M.set('nc-ui-theme','x'),true);assert.equal(map.get('nc-ui-theme'),'dark');assert.ok(map.has('nc-pref-nc-ui-theme'));
 M.remove('nightcity-red-v1');assert.ok(map.has('nightcity-red-v1'));
});

test('values that cannot be stored are refused: undefined, cycles, over-long',()=>{
 const {M}=load();
 assert.equal(M.set('a',undefined),false);
 const loop={};loop.me=loop;assert.equal(M.set('a',loop),false);
 assert.equal(M.set('a','x'.repeat(2500)),false);
 assert.equal(M.get('a','none'),'none');
});

test('keys lists the stored names, remove forgets one',()=>{
 const {M}=load({store:{'nc-pref-b':'1','nc-pref-a':'2','nc-role':'gm'}});
 assert.deepEqual([...M.keys()],['a','b']);
 assert.equal(M.remove('a'),true);assert.deepEqual([...M.keys()],['b']);assert.equal(M.get('a','gone'),'gone');
});

test('where storage is blocked the value still holds for this visit and nothing throws',()=>{
 const {M}=load({broken:true});
 assert.equal(M.set('tab','gear'),false,'reports that it was not saved');
 assert.equal(M.get('tab','skills'),'gear','but this visit remembers it');
 assert.doesNotThrow(()=>{M.keys();M.remove('tab')});
 assert.equal(M.get('tab','skills'),'skills');
});

test('a full storage keeps the value in memory too',()=>{
 const {M}=load({full:true});
 assert.equal(M.set('tab','gear'),false);assert.equal(M.get('tab','skills'),'gear');
});

test('the preferences are not part of the archive: no module of the archive reads the prefix',()=>{
 for(const f of ['app.js','transfer.js','campaign-io.js','local-store.js','share-link.js']){
  assert.doesNotMatch(fs.readFileSync(path.join(__dirname,'..','site',f),'utf8'),/nc-pref-|UIMemory/,f);
 }
});
