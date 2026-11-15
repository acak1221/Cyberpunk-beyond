/* The sound of dice and a roll by shaking: settings that stay in the browser, a clatter made without recordings,
   and a shake that is several quick jolts in a row, not one. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const code=fs.readFileSync(path.join(__dirname,'..','site','dice-feel.js'),'utf8');
// A page: storage, a document that remembers its listeners, optionally motion events and Web Audio.
function load({store={},motion=true,ask,audio=true,nodes={}}={}){
 const map=new Map(Object.entries(store)),listeners={},winListeners={},made=[];
 const document={addEventListener:(k,f)=>{(listeners[k]||=[]).push(f)},querySelector:s=>nodes[s]||null,activeElement:null,visibilityState:'visible'};
 const param=()=>({value:0,setValueAtTime(){},exponentialRampToValueAtTime(){}});
 class AudioContext{constructor(){this.currentTime=1;this.sampleRate=8000;this.state='running';this.destination={}}
  createGain(){const n={kind:'gain',gain:param(),connect(){}};made.push(n);return n}
  createBuffer(c,len,rate){return {sampleRate:rate,getChannelData:()=>new Float32Array(len)}}
  createBufferSource(){const n={kind:'click',connect(){},start(){n.started=true}};made.push(n);return n}
  createBiquadFilter(){return {frequency:param(),Q:param(),connect(){}}}
  createOscillator(){const n={kind:'note',frequency:param(),connect(){},start(){},stop(){}};made.push(n);return n}}
 const window={document,localStorage:{getItem:k=>map.has(k)?map.get(k):null,setItem:(k,v)=>map.set(k,String(v))},addEventListener:(k,f)=>{(winListeners[k]||=[]).push(f)},removeEventListener:(k,f)=>{winListeners[k]=(winListeners[k]||[]).filter(x=>x!==f)},...(audio?{AudioContext}:{})};
 if(motion)window.DeviceMotionEvent=ask?{requestPermission:ask}:{};
 vm.runInNewContext(code,{window,Date,Math,Number,String,Float32Array,Promise});
 const change=async target=>{for(const f of listeners.change||[])await f({target})};
 return {D:window.DiceFeel,map,made,nodes,document,change,motion:()=>winListeners.devicemotion||[]};
}
const box=(attr,more={})=>({matches:s=>s===`[${attr}]`,setAttribute(k,v){this[k]=v},closest:()=>null,...more});

test('sound is on at volume 60 until the player says otherwise, and shaking is off until turned on',()=>{
 const {D}=load();
 assert.equal(D.soundOn(),true);assert.equal(D.volume(),60);assert.equal(D.shakeOn(),false);
 const set=load({store:{'nc-dice-sound':'off','nc-dice-volume':'35','nc-dice-shake':'on'}}).D;
 assert.equal(set.soundOn(),false);assert.equal(set.volume(),35);assert.equal(set.shakeOn(),true);
 for(const [raw,want] of [['-5',0],['250',100],['abc',60],['',60],['49.6',50]])assert.equal(load({store:{'nc-dice-volume':raw}}).D.volume(),want,raw);
 assert.deepEqual(Object.keys(D.T.ru).sort(),Object.keys(D.T.en).sort());
});

test('the clatter is a run of ever quieter, ever closer clicks for each die, and more dice make more of it up to a limit',()=>{
 const {D}=load(),rng=()=>0.5,one=D.pattern(1,rng),four=D.pattern(4,rng);
 assert.equal(one.length,4);assert.equal(four.length,16);assert.equal(D.pattern(100,rng).length,32,'eight dice at most are heard');
 assert.equal(D.pattern(0,rng).length,4);assert.equal(D.pattern('x',rng).length,4);
 for(let i=1;i<one.length;i++){assert.ok(one[i].at>one[i-1].at);assert.ok(one[i].gain<one[i-1].gain)}
 assert.ok(one[2].at-one[1].at<one[1].at-one[0].at,'bounces come closer');
 for(const c of four){assert.ok(c.gain>0&&c.gain<=1);assert.ok(c.tone>=1500&&c.tone<=4100);assert.ok(c.length>0&&c.length<0.05);assert.ok(c.at>=0&&c.at<1)}
 for(let i=1;i<four.length;i++)assert.ok(four[i].at>=four[i-1].at,'in the order they sound');
});

test('a roll sounds only when sound is on and the volume is above zero; a critical adds a note',()=>{
 const on=load();assert.equal(on.D.play('',2),true);
 assert.equal(on.made.filter(n=>n.kind==='click'&&n.started).length>=6,true);assert.equal(on.made.filter(n=>n.kind==='note').length,0);
 const crit=load();crit.D.play('crit',1);assert.equal(crit.made.filter(n=>n.kind==='note').length,1);
 const fumble=load();fumble.D.play('fumble',1);assert.equal(fumble.made.filter(n=>n.kind==='note').length,1);
 const off=load({store:{'nc-dice-sound':'off'}});assert.equal(off.D.play('',2),false);assert.equal(off.made.length,0);
 assert.equal(off.D.play('',2,{force:true}),true,'the try-out sounds even when rolls are silent');
 const mute=load({store:{'nc-dice-volume':'0'}});assert.equal(mute.D.play('crit',2),false);assert.equal(mute.made.length,0);
 assert.equal(load({audio:false}).D.play('',2),false,'a browser without Web Audio stays silent and does not fail');
});

test('a shake is several quick jolts in a row; one jolt, slow movement and bad readings are not',()=>{
 const {D}=load();let feed=D.shakeDetector();
 assert.equal(feed(0,0,9.8,0),false,'the first reading has nothing to compare with');
 assert.equal(feed(12,8,0,100),false);assert.equal(feed(-12,-8,9,200),false);assert.equal(feed(12,8,0,300),true,'the third jolt within the window');
 // one roll per shake: the detector rests
 assert.equal(feed(-12,-8,9,400),false);assert.equal(feed(12,8,0,500),false);assert.equal(feed(-12,-8,9,600),false);
 assert.equal(feed(12,8,0,1900),false);assert.equal(feed(-12,-8,9,2000),false);assert.equal(feed(12,8,0,2100),true,'and wakes again');
 feed=D.shakeDetector();feed(0,0,9.8,0);
 assert.equal(feed(20,0,9.8,100),false);assert.equal(feed(20,0,9.8,200),false,'put on the table: one jolt, then still');
 feed=D.shakeDetector();feed(0,0,9.8,0);
 for(let i=1;i<40;i++)assert.equal(feed(i*0.5,0,9.8,i*50),false,'carried around: no single change is sharp enough');
 feed=D.shakeDetector();feed(0,0,9.8,0);
 assert.equal(feed(15,0,0,1000),false);assert.equal(feed(0,0,9.8,2000),false);assert.equal(feed(15,0,0,3000),false,'jolts too far apart are not a shake');
 assert.equal(feed(NaN,0,0,3100),false);assert.equal(feed(1,2,undefined,3200),false);
});

test('a shake rolls the check on the dice page, otherwise the last roll again, and nothing while typing or in a dialog',()=>{
 const check={id:'check'},again={id:'again'};
 assert.equal(load({nodes:{'[data-action="roll-check"]':check,'[data-rh-again]':again}}).D.target(),check);
 assert.equal(load({nodes:{'[data-rh-again]':again}}).D.target(),again);
 assert.equal(load().D.target(),null);
 assert.equal(load({nodes:{'dialog[open]':{},'[data-rh-again]':again}}).D.target(),null);
 for(const [el,want] of [[{tagName:'INPUT',type:'text'},null],[{tagName:'INPUT',type:'number'},null],[{tagName:'TEXTAREA'},null],[{tagName:'SELECT'},null],[{tagName:'INPUT',type:'checkbox'},again],[{tagName:'BUTTON'},again]]){
  const p=load({nodes:{'[data-rh-again]':again}});p.document.activeElement=el;assert.equal(p.D.target(),want,JSON.stringify(el));
 }
});

test('shaking starts only after the player turns it on, asks where the browser wants to be asked, and can be turned off',async()=>{
 let clicks=0;const p=load({nodes:{'[data-rh-again]':{click:()=>clicks++}}});
 assert.equal(p.motion().length,0,'nothing listens to motion by default');
 const sw=box('data-dice-shake',{checked:true});await p.change(sw);
 assert.equal(p.map.get('nc-dice-shake'),'on');assert.equal(p.motion().length,1);
 const jolt=(x,y,z)=>p.motion()[0]({accelerationIncludingGravity:{x,y,z}});
 const real=Date.now;let now=1000;Date.now=()=>now;
 try{jolt(0,0,9.8);now+=100;jolt(12,8,0);now+=100;jolt(-12,-8,9);now+=100;jolt(12,8,0);assert.equal(clicks,1,'a shake presses «Повторить бросок»');
  now+=100;jolt(-12,-8,9);now+=100;jolt(12,8,0);now+=100;jolt(-12,-8,9);assert.equal(clicks,1,'once');
  p.document.visibilityState='hidden';now+=5000;jolt(0,0,9.8);now+=100;jolt(12,8,0);now+=100;jolt(-12,-8,9);now+=100;jolt(12,8,0);assert.equal(clicks,1,'a page that is not shown does not roll');
 }finally{Date.now=real}
 sw.checked=false;await p.change(sw);assert.equal(p.map.get('nc-dice-shake'),'off');assert.equal(p.motion().length,0);
 // a browser that asks first: «no» leaves the switch off and says why
 const note={hidden:true,textContent:''},denied=load({ask:async()=>'denied'}),sw2=box('data-dice-shake',{checked:true,closest:()=>({querySelector:()=>note})});
 await denied.change(sw2);assert.equal(sw2.checked,false);assert.equal(denied.map.get('nc-dice-shake'),'off');assert.equal(denied.motion().length,0);assert.equal(note.hidden,false);assert.match(note.textContent,/не разрешил/);
 const granted=load({ask:async()=>'granted'});await granted.change(box('data-dice-shake',{checked:true}));assert.equal(granted.motion().length,1);
 // a choice made earlier holds after a reload, except where permission must be asked again from a tap
 assert.equal(load({store:{'nc-dice-shake':'on'}}).motion().length,1);assert.equal(load({store:{'nc-dice-shake':'on'},ask:async()=>'granted'}).motion().length,0);
 assert.equal(await load({motion:false}).D.enableShake(),'noMotion');
});

test('the switches show what is saved, save what is chosen, and leave out shaking where the device has no motion',async()=>{
 const p=load({store:{'nc-dice-volume':'40'}}),html=p.D.controls('ru');
 assert.match(html,/data-dice-sound checked> Звук кубиков/);assert.match(html,/type="range" min="0" max="100" step="5" value="40" data-dice-volume aria-valuetext="40%"/);assert.match(html,/data-dice-shake > Бросок встряхиванием/);
 assert.match(p.D.controls('en'),/Roll by shaking/);assert.doesNotMatch(load({motion:false}).D.controls('ru'),/data-dice-shake/);
 await p.change(box('data-dice-sound',{checked:false}));assert.equal(p.map.get('nc-dice-sound'),'off');assert.equal(p.made.length,0);
 await p.change(box('data-dice-sound',{checked:true}));assert.equal(p.map.get('nc-dice-sound'),'on');assert.ok(p.made.length>0,'turning sound on lets it be heard');
 const slider=box('data-dice-volume',{value:'85'});await p.change(slider);assert.equal(p.map.get('nc-dice-volume'),'85');assert.equal(slider['aria-valuetext'],'85%');
 await p.change(box('data-dice-volume',{value:'999'}));assert.equal(p.D.volume(),100);
 assert.match(load({store:{'nc-dice-sound':'off','nc-dice-shake':'on'}}).D.controls('ru'),/data-dice-sound > .*data-dice-shake checked>/s);
});
