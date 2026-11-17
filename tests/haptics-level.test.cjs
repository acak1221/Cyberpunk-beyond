// Vibration strength 0-3: the level scales the pulses, 0 is off, the old on/off key stays in step, reduced motion wins.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const code=fs.readFileSync(path.join(__dirname,'..','site','dice-feel.js'),'utf8');
function load({store={},vibrate=true,reduced=false,lang='ru'}={}){
 const map=new Map(Object.entries(store)),listeners={},buzz=[],ranges=[],boxes=[];
 const document={addEventListener:(k,f)=>{(listeners[k]||=[]).push(f)},querySelector:()=>null,querySelectorAll:s=>s==='[data-haptic-level]'?ranges:s==='[data-haptics]'?boxes:[],activeElement:null,visibilityState:'visible'};
 const navigator=vibrate?{vibrate:p=>{buzz.push(p);return true}}:{};
 const window={document,navigator,localStorage:{getItem:k=>map.has(k)?map.get(k):null,setItem:(k,v)=>map.set(k,String(v))},matchMedia:q=>({matches:reduced&&/reduced-motion/.test(q)}),addEventListener(){},App:{lang:()=>lang}};
 vm.runInNewContext(code,{window,Date,Math,Number,String});
 const change=async target=>{for(const f of listeners.change||[])await f({target})};
 return {D:window.DiceFeel,map,buzz,ranges,boxes,change};
}
const range=(v=2)=>({value:String(v),attrs:{},matches:s=>s==='[data-haptic-level]',setAttribute(k,x){this.attrs[k]=x}});
const box=checked=>({checked,matches:s=>s==='[data-haptics]'});

test('the level is 2 (normal) by default, follows the stored number, and the old off switch counts as 0',()=>{
 assert.equal(load().D.hapticLevel(),2);
 for(const [raw,want] of [['0',0],['1',1],['3',3],['9',3],['-4',0],['2.6',3],['abc',2],['',2]])assert.equal(load({store:{'nc-haptics-level':raw}}).D.hapticLevel(),want,raw);
 assert.equal(load({store:{'nc-haptics':'off','nc-haptics-level':'3'}}).D.hapticLevel(),0);
 assert.equal(load({store:{'nc-haptics':'on','nc-haptics-level':'1'}}).D.hapticLevel(),1);
});

test('pulses are scaled by the level and the pauses are not; level 0 plays nothing',()=>{
 const {D}=load();
 assert.deepEqual([...D.hapticPattern('',0)],[]);
 assert.deepEqual([...D.hapticPattern('',2)],[15]);
 assert.deepEqual([...D.hapticPattern('fumble',2)],[120]);
 assert.deepEqual([...D.hapticPattern('crit',2)],[25,40,25,40,60]);
 assert.deepEqual([...D.hapticPattern('',1)],[8]);
 assert.deepEqual([...D.hapticPattern('crit',1)],[13,40,13,40,30]);
 assert.deepEqual([...D.hapticPattern('crit',3)],[43,40,43,40,102]);
 for(const k of ['','crit','fumble']){
  const a=D.hapticPattern(k,1),b=D.hapticPattern(k,2),c=D.hapticPattern(k,3);
  for(let i=0;i<b.length;i++){assert.ok(a[i]<=b[i]&&b[i]<=c[i],k+i);if(i%2===1){assert.equal(a[i],b[i]);assert.equal(c[i],b[i])}}
 }
 assert.deepEqual([...D.hapticPattern('',99)],[...D.hapticPattern('',3)],'out of range counts as the strongest');
 assert.deepEqual([...D.hapticPattern('',NaN)],[]);
});

test('haptic() sends the scaled pattern, a single number for a single pulse',()=>{
 const h=load({store:{'nc-haptics-level':'3'}});
 assert.equal(h.D.haptic('crit'),true);assert.deepEqual([...h.buzz[0]],[43,40,43,40,102]);
 h.D.haptic('');assert.equal(h.buzz[1],26);
 const light=load({store:{'nc-haptics-level':'1'}});light.D.haptic('fumble');assert.equal(light.buzz[0],60);
});

test('level 0, the old off switch, reduced motion and a device without vibration all stay silent',()=>{
 for(const opts of [{store:{'nc-haptics-level':'0'}},{store:{'nc-haptics':'off'}},{reduced:true},{vibrate:false}]){
  const h=load(opts);assert.equal(h.D.haptic('crit'),false);assert.equal(h.buzz.length,0,JSON.stringify(opts));
 }
 // Reduced motion wins even over a forced test pulse.
 const h=load({reduced:true});assert.equal(h.D.haptic('',{force:true}),false);assert.equal(h.buzz.length,0);
});

test('setHapticLevel writes the level and keeps the old key in step',()=>{
 const h=load();
 assert.equal(h.D.setHapticLevel(0),0);assert.equal(h.map.get('nc-haptics'),'off');assert.equal(h.map.get('nc-haptics-level'),'0');
 assert.equal(h.D.setHapticLevel(3),3);assert.equal(h.map.get('nc-haptics'),'on');assert.equal(h.D.hapticLevel(),3);
 assert.equal(h.D.setHapticLevel(7),3);assert.equal(h.D.setHapticLevel('x'),0);
});

test('moving the slider changes the level, the switches and the spoken value, and plays a test pulse',async()=>{
 const h=load({store:{'nc-haptics':'off'}}),r=range(0),b=box(false);
 h.ranges.push(r);h.boxes.push(b);
 r.value='1';await h.change(r);
 assert.equal(h.D.hapticLevel(),1);assert.equal(b.checked,true);assert.equal(r.attrs['aria-valuetext'],'Слабая');assert.equal(h.buzz.length,1);
 r.value='0';await h.change(r);
 assert.equal(h.map.get('nc-haptics'),'off');assert.equal(b.checked,false);assert.equal(r.attrs['aria-valuetext'],'Выкл.');
});

test('turning the switch on after level 0 brings back the normal level; turning it off keeps the level for later',async()=>{
 const h=load({store:{'nc-haptics':'off','nc-haptics-level':'0'}}),r=range(0),b=box(true);h.ranges.push(r);h.boxes.push(b);
 await h.change(b);assert.equal(h.D.hapticLevel(),2);assert.equal(r.value,'2');
 h.map.set('nc-haptics-level','3');b.checked=false;await h.change(b);
 assert.equal(h.map.get('nc-haptics'),'off');assert.equal(h.map.get('nc-haptics-level'),'3');
 b.checked=true;await h.change(b);assert.equal(h.D.hapticLevel(),3,'the strength chosen before is back');
});

test('the controls draw the slider with names in both languages, and nothing where the device cannot vibrate',()=>{
 const ru=load().D.controls('ru'),en=load().D.controls('en',{haptics:true});
 assert.match(ru,/data-haptic-level/);assert.match(ru,/Сила вибрации/);assert.ok(!ru.includes('data-haptics'));
 assert.match(ru,/aria-valuetext="Обычная"/);
 assert.match(en,/Vibrate on rolls/);assert.match(en,/data-haptics checked/);assert.match(en,/aria-valuetext="Normal"/);
 assert.match(en,/min="0" max="3" step="1"/);
 const none=load({vibrate:false}).D;assert.ok(!none.controls('ru',{haptics:true}).includes('data-haptic'));assert.equal(none.hapticControls('ru',true),'');
 assert.deepEqual(Object.keys(load().D.T.ru).sort(),Object.keys(load().D.T.en).sort());
 assert.equal(load().D.T.ru.levels.length,4);assert.equal(load().D.T.en.levels.length,4);
});

test('app.js hands haptics over to dice-feel.js and no longer reads the key itself',()=>{
 const app=fs.readFileSync(path.join(__dirname,'..','site','app.js'),'utf8');
 assert.match(app,/function haptic\(kind\)\{try\{window\.DiceFeel\?\.haptic\?\.\(kind\)\}catch\{\}\}/);
 assert.doesNotMatch(app,/navigator\.vibrate/);
});
