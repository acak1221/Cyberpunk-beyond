/* The sound of dice and a roll by shaking the phone.

   Sound. There are no recordings: the clatter is made on the spot (Web Audio) from short bursts of noise, one little run of
   them per die, with a bright note on a critical success and a dull one on a critical failure. So the app stays one small
   bundle, works offline and borrows nobody's audio. A switch and a volume slider are on the «Кубики» page.

   Shaking. With the switch on, a firm shake rolls: the check on the «Кубики» page, and anywhere else the last roll again
   (the same «Повторить бросок» the roll card offers). It is off until the player turns it on: a phone in a pocket must
   not roll, and iOS asks for permission to read motion, which can only be asked from a tap.

   Both settings live in this browser only (localStorage), like the vibration switch next to them. */
(function(global){
'use strict';
const doc=global.document;
const SOUND='nc-dice-sound',VOLUME='nc-dice-volume',SHAKE='nc-dice-shake';
const T={
 ru:{sound:'Звук кубиков',volume:'Громкость',shake:'Бросок встряхиванием',shakeHelp:'Встряхните телефон: на этой странице бросится проверка, на остальных повторится последний бросок.',denied:'Браузер не разрешил читать движение телефона: бросок встряхиванием выключен.',noMotion:'Это устройство не сообщает о движении.',test:'Проверить звук'},
 en:{sound:'Dice sound',volume:'Volume',shake:'Roll by shaking',shakeHelp:'Shake the phone: on this page it rolls the check, elsewhere it repeats the last roll.',denied:'The browser did not allow reading the phone’s motion: rolling by shaking is off.',noMotion:'This device does not report motion.',test:'Try the sound'},
};
const t=(lang,k)=>T[lang==='en'?'en':'ru'][k]??k;
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const read=k=>{try{return global.localStorage?.getItem(k)}catch{return null}};
const write=(k,v)=>{try{global.localStorage?.setItem(k,v)}catch{}};
const soundOn=()=>read(SOUND)!=='off';
const shakeOn=()=>read(SHAKE)==='on';
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
function controls(lang){
 const v=volume();
 return `<div class="dice-feel" data-dice-feel><label class="haptics-toggle"><input type="checkbox" data-dice-sound ${soundOn()?'checked':''}> ${esc(t(lang,'sound'))}</label><label class="dice-volume">${esc(t(lang,'volume'))}<input type="range" min="0" max="100" step="5" value="${v}" data-dice-volume aria-valuetext="${v}%"></label>${supported()?`<label class="haptics-toggle"><input type="checkbox" data-dice-shake ${shakeOn()?'checked':''}> ${esc(t(lang,'shake'))}</label><small class="dice-feel-help">${esc(t(lang,'shakeHelp'))}</small>`:''}<p class="dice-feel-note" data-dice-feel-note role="status" hidden></p></div>`;
}
const pageLang=()=>{try{return global.App?.lang?.()==='en'?'en':'ru'}catch{return 'ru'}};
doc?.addEventListener?.('change',async e=>{
 const el=e.target;if(!el?.matches)return;
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

global.DiceFeel={T,t,play,pattern,volume,soundOn,shakeOn,shakeDetector,target,enableShake,disableShake,controls,supported,KEYS:{SOUND,VOLUME,SHAKE},_test:{onMotion,listening:()=>listening,reset:()=>{feed=shakeDetector()}}};
})(typeof window!=='undefined'?window:globalThis);
