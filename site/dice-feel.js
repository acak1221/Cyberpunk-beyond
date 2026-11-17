/* The sound of dice and a roll by shaking the phone.

   Sound. There are no recordings: the clatter is made on the spot (Web Audio) from short bursts of noise, one little run of
   them per die, with a bright note on a critical success and a dull one on a critical failure. So the app stays one small
   bundle, works offline and borrows nobody's audio. A switch and a volume slider are on the «Кубики» page.

   Shaking. With the switch on, a firm shake rolls: the check on the «Кубики» page, and anywhere else the last roll again
   (the same «Повторить бросок» the roll card offers). It is off until the player turns it on: a phone in a pocket must
   not roll, and iOS asks for permission to read motion, which can only be asked from a tap.

   Vibration. The pulses of a roll (a short buzz, a long one for a fumble, a rhythm for a critical success) are scaled by a
   strength level from 0 (off) to 3 (strong). Level 0 is the same as the old «off» switch (nc-haptics), and the two are kept
   in step. Nothing vibrates when the system asks for reduced motion.

   These settings live in this browser only (localStorage), like the vibration switch next to them. */
(function(global){
'use strict';
const doc=global.document;
const SOUND='nc-dice-sound',VOLUME='nc-dice-volume',SHAKE='nc-dice-shake',HAPTICS='nc-haptics',LEVEL='nc-haptics-level';
const T={
 ru:{sound:'Звук кубиков',volume:'Громкость',shake:'Бросок встряхиванием',shakeHelp:'Встряхните телефон: на этой странице бросится проверка, на остальных повторится последний бросок.',denied:'Браузер не разрешил читать движение телефона: бросок встряхиванием выключен.',noMotion:'Это устройство не сообщает о движении.',test:'Проверить звук',haptics:'Вибрация при бросках',hapticLevel:'Сила вибрации',levels:['Выкл.','Слабая','Обычная','Сильная']},
 en:{sound:'Dice sound',volume:'Volume',shake:'Roll by shaking',shakeHelp:'Shake the phone: on this page it rolls the check, elsewhere it repeats the last roll.',denied:'The browser did not allow reading the phone’s motion: rolling by shaking is off.',noMotion:'This device does not report motion.',test:'Try the sound',haptics:'Vibrate on rolls',hapticLevel:'Vibration strength',levels:['Off','Light','Normal','Strong']},
};
const t=(lang,k)=>T[lang==='en'?'en':'ru'][k]??k;
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const read=k=>{try{return global.localStorage?.getItem(k)}catch{return null}};
const write=(k,v)=>{try{global.localStorage?.setItem(k,v)}catch{}};
const soundOn=()=>read(SOUND)!=='off';
const shakeOn=()=>read(SHAKE)==='on';
// 0..3: off, light, normal, strong. Normal (2) unless the player chose otherwise; the old off switch counts as 0.
const LEVEL_SCALE=[0,0.5,1,1.7],DEFAULT_LEVEL=2;
function hapticLevel(){
 if(read(HAPTICS)==='off')return 0;
 const raw=read(LEVEL);if(raw===null||raw==='')return DEFAULT_LEVEL;
 const n=Math.round(Number(raw));return Number.isFinite(n)?Math.max(0,Math.min(3,n)):DEFAULT_LEVEL;
}
// The pattern (ms) for a kind of roll at a level: pulses are scaled, pauses stay. [] means nothing to play.
function hapticPattern(kind,level){
 const lv=Math.max(0,Math.min(3,Math.round(Number(level))||0)),k=LEVEL_SCALE[lv];if(!k)return [];
 const base=kind==='crit'?[25,40,25,40,60]:kind==='fumble'?[120]:[15];
 return base.map((ms,i)=>i%2===0?Math.max(5,Math.round(ms*k)):ms);
}
// True when something was sent to the vibration motor.
function haptic(kind,{force=false}={}){
 try{
  if(global.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return false;
  const level=hapticLevel();if(!level&&!force)return false;
  const p=hapticPattern(kind,level||DEFAULT_LEVEL);if(!p.length||typeof global.navigator?.vibrate!=='function')return false;
  global.navigator.vibrate(p.length===1?p[0]:p);return true;
 }catch{return false}
}
const vibrates=()=>{try{return typeof global.navigator==='object'&&global.navigator!==null&&'vibrate' in global.navigator}catch{return false}};
function setHapticLevel(n){
 const lv=Math.max(0,Math.min(3,Math.round(Number(n))||0));
 write(LEVEL,String(lv));write(HAPTICS,lv===0?'off':'on');return lv;
}
// 0..100, 60 unless the player chose otherwise.
function volume(){const raw=read(VOLUME),n=raw===null||raw===''?60:Math.round(Number(raw));return Number.isFinite(n)?Math.max(0,Math.min(100,n)):60}

/* ---------- Sound ---------- */
/* The clatter as a list of clicks: {at (s), gain (0..1), tone (Hz), length (s)}. Each die bounces a few times, every bounce
   quieter and closer to the one before; more dice make a longer, denser clatter, up to a limit. */
function pattern(dice,rng=Math.random){
 const n=Math.max(1,Math.min(8,Math.floor(Number(dice))||1)),out=[];
 for(let d=0;d<n;d++){
  let at=d*0.035+rng()*0.03,gap=0.07+rng()*0.05,gain=0.9-d*0.05;
  const bounces=3+Math.floor(rng()*3);
  for(let b=0;b<bounces;b++){out.push({at,gain:Math.max(0.08,gain),tone:1500+rng()*2600,length:0.018+rng()*0.022});at+=gap;gap*=0.62;gain*=0.6}
 }
 return out.sort((a,b)=>a.at-b.at);
}
let ctx=null,noise=null;
function audio(){
 const AC=global.AudioContext||global.webkitAudioContext;if(!AC)return null;
 try{if(!ctx)ctx=new AC();if(ctx.state==='suspended')ctx.resume?.()}catch{ctx=null}
 return ctx;
}
function noiseBuffer(a){
 if(noise&&noise.sampleRate===a.sampleRate)return noise;
 const len=Math.floor(a.sampleRate*0.25),buf=a.createBuffer(1,len,a.sampleRate),data=buf.getChannelData(0);
 for(let i=0;i<len;i++)data[i]=Math.random()*2-1;
 return noise=buf;
}
// kind: '' | 'crit' | 'fumble'. Returns true when something was scheduled to sound.
function play(kind,dice,{force=false}={}){
 if(!force&&!soundOn())return false;
 const level=volume()/100;if(level<=0)return false;
 const a=audio();if(!a)return false;
 try{
  const now=a.currentTime+0.01,out=a.createGain();out.gain.value=level*0.5;out.connect(a.destination);
  let end=0;
  for(const c of pattern(dice)){
   const src=a.createBufferSource(),band=a.createBiquadFilter(),g=a.createGain();
   src.buffer=noiseBuffer(a);band.type='bandpass';band.frequency.value=c.tone;band.Q.value=1.4;
   g.gain.setValueAtTime(0.0001,now+c.at);g.gain.exponentialRampToValueAtTime(c.gain,now+c.at+0.003);g.gain.exponentialRampToValueAtTime(0.0001,now+c.at+c.length);
   src.connect(band);band.connect(g);g.connect(out);src.start(now+c.at,Math.random()*0.2,c.length+0.02);end=Math.max(end,c.at+c.length);
  }
  if(kind==='crit'||kind==='fumble'){
   const o=a.createOscillator(),g=a.createGain(),at=now+end+0.03,len=kind==='crit'?0.32:0.26;
   o.type=kind==='crit'?'triangle':'sine';o.frequency.setValueAtTime(kind==='crit'?880:150,at);
   if(kind==='crit')o.frequency.exponentialRampToValueAtTime(1320,at+0.12);else o.frequency.exponentialRampToValueAtTime(70,at+len);
   g.gain.setValueAtTime(0.0001,at);g.gain.exponentialRampToValueAtTime(kind==='crit'?0.5:0.8,at+0.015);g.gain.exponentialRampToValueAtTime(0.0001,at+len);
   o.connect(g);g.connect(out);o.start(at);o.stop(at+len+0.02);
  }
  return true;
 }catch{return false}
}

/* ---------- Shaking ---------- */
/* A shake is not one jolt (a phone put on the table) but several quick changes of acceleration in a row: `need` of them
   within `window` ms. After a roll the detector rests for `rest` ms, so one shake is one roll. */
function shakeDetector({threshold=14,need=3,window:span=900,rest=1500}={}){
 let last=null,hits=[],quiet=0;
 return function feed(x,y,z,at){
  if(![x,y,z,at].every(Number.isFinite))return false;
  const prev=last;last=[x,y,z];
  if(!prev||at<quiet)return false;
  if(Math.abs(x-prev[0])+Math.abs(y-prev[1])+Math.abs(z-prev[2])<threshold)return false;
  hits=hits.filter(h=>at-h<span);hits.push(at);
  if(hits.length<need)return false;
  hits=[];quiet=at+rest;return true;
 };
}
// What a shake rolls: the check on the dice page, otherwise the last roll again. Nothing while a dialog is open or text is typed.
function target(){
 if(!doc?.querySelector)return null;
 if(doc.querySelector('dialog[open]'))return null;
 const el=doc.activeElement,tag=el?.tagName;if(tag==='INPUT'&&!['checkbox','radio','range','button'].includes(el.type)||tag==='TEXTAREA'||tag==='SELECT')return null;
 return doc.querySelector('[data-action="roll-check"]')||doc.querySelector('[data-rh-again]')||null;
}
let listening=false,feed=shakeDetector();
function onMotion(e){
 const a=e?.accelerationIncludingGravity||e?.acceleration;if(!a||!shakeOn()||doc?.visibilityState==='hidden')return;
 if(feed(Number(a.x),Number(a.y),Number(a.z),Date.now())){const b=target();if(b&&!b.disabled)b.click()}
}
function listen(){
 if(listening||typeof global.addEventListener!=='function'||!('DeviceMotionEvent' in global))return listening;
 global.addEventListener('devicemotion',onMotion);listening=true;return true;
}
function unlisten(){if(listening){global.removeEventListener?.('devicemotion',onMotion);listening=false}}
const supported=()=>'DeviceMotionEvent' in global;
// Turning it on is a tap, which is when iOS lets a page ask for motion. Resolves to '' or to the reason it stays off.
async function enableShake(){
 if(!supported())return 'noMotion';
 const ask=global.DeviceMotionEvent?.requestPermission;
 if(typeof ask==='function'){let answer='denied';try{answer=await ask.call(global.DeviceMotionEvent)}catch{}if(answer!=='granted')return 'denied'}
 write(SHAKE,'on');feed=shakeDetector();listen();return '';
}
function disableShake(){write(SHAKE,'off');unlisten()}

/* ---------- The switches on the «Кубики» page ---------- */
function hapticControls(lang,withSwitch){
 if(!vibrates())return '';
 const lv=hapticLevel(),names=T[lang==='en'?'en':'ru'].levels;
 return (withSwitch?`<label class="haptics-toggle"><input type="checkbox" data-haptics ${lv>0?'checked':''}> ${esc(t(lang,'haptics'))}</label>`:'')+`<label class="dice-volume">${esc(t(lang,'hapticLevel'))}<input type="range" min="0" max="3" step="1" value="${lv}" data-haptic-level aria-valuetext="${esc(names[lv])}"></label>`;
}
// opts.haptics: also draw the on/off switch (the «Кубики» page has its own, drawn by the app).
function controls(lang,opts){
 const v=volume();
 return `<div class="dice-feel" data-dice-feel><label class="haptics-toggle"><input type="checkbox" data-dice-sound ${soundOn()?'checked':''}> ${esc(t(lang,'sound'))}</label><label class="dice-volume">${esc(t(lang,'volume'))}<input type="range" min="0" max="100" step="5" value="${v}" data-dice-volume aria-valuetext="${v}%"></label>${supported()?`<label class="haptics-toggle"><input type="checkbox" data-dice-shake ${shakeOn()?'checked':''}> ${esc(t(lang,'shake'))}</label><small class="dice-feel-help">${esc(t(lang,'shakeHelp'))}</small>`:''}${hapticControls(lang,!!opts?.haptics)}<p class="dice-feel-note" data-dice-feel-note role="status" hidden></p></div>`;
}
const pageLang=()=>{try{return global.App?.lang?.()==='en'?'en':'ru'}catch{return 'ru'}};
function paintHaptics(){
 const lv=hapticLevel(),names=T[pageLang()==='en'?'en':'ru'].levels;
 for(const r of doc?.querySelectorAll?.('[data-haptic-level]')||[]){r.value=String(lv);r.setAttribute('aria-valuetext',names[lv])}
 for(const c of doc?.querySelectorAll?.('[data-haptics]')||[])c.checked=lv>0;
}
doc?.addEventListener?.('change',async e=>{
 const el=e.target;if(!el?.matches)return;
 if(el.matches('[data-haptic-level]')){setHapticLevel(el.value);paintHaptics();haptic('',{force:false});return}
 if(el.matches('[data-haptics]')){
  // The app writes the on/off key itself; a switch turned on while the strength is 0 brings back the normal level.
  if(el.checked){write(HAPTICS,'on');if(Math.round(Number(read(LEVEL)))===0)write(LEVEL,String(DEFAULT_LEVEL))}
  else if(!el.checked)write(HAPTICS,'off');
  paintHaptics();return;
 }
 if(el.matches('[data-dice-sound]')){write(SOUND,el.checked?'on':'off');if(el.checked)play('',2)}
 else if(el.matches('[data-dice-volume]')){const n=Math.max(0,Math.min(100,Math.round(Number(el.value))||0));write(VOLUME,String(n));el.setAttribute('aria-valuetext',n+'%');if(soundOn())play('',1)}
 else if(el.matches('[data-dice-shake]')){
  const note=el.closest?.('[data-dice-feel]')?.querySelector?.('[data-dice-feel-note]');if(note)note.hidden=true;
  if(!el.checked){disableShake();return}
  const why=await enableShake();if(why){el.checked=false;write(SHAKE,'off');if(note){note.textContent=t(pageLang(),why);note.hidden=false}}
 }
});
// A choice made earlier holds after a reload wherever the browser does not ask for permission again.
if(shakeOn()&&supported()&&typeof global.DeviceMotionEvent?.requestPermission!=='function')listen();

global.DiceFeel={T,t,haptic,hapticLevel,hapticPattern,setHapticLevel,hapticControls,play,pattern,volume,soundOn,shakeOn,shakeDetector,target,enableShake,disableShake,controls,supported,KEYS:{SOUND,VOLUME,SHAKE,HAPTICS,LEVEL},_test:{onMotion,listening:()=>listening,reset:()=>{feed=shakeDetector()}}};
})(typeof window!=='undefined'?window:globalThis);
