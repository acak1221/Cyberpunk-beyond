/* Online rooms: the waiting room.

   Without it, whoever has the room code is in the room. With it, the code opens only the door:
   1. The Game Master makes a second key for the room and seals everything that happens in it with that key: statuses,
      initiative, clocks, rolls, sheets, whispers. The code alone no longer reads any of it.
   2. A device that opens the link sees one thing, the Game Master's signed notice «this room has a waiting room», and
      answers with a request to enter («knock»): a name and the public half of a key only that open page holds.
   3. The Game Master lets the device in: the room key travels to it sealed to that page's key. Nobody else, not even
      another member of the room, can open it. A device let in once is given the key again without a question after a
      reload, because the list of those let in is kept by the fingerprint of the device's signing key.
   4. Removing a member replaces the key. The others ask for the new one by themselves and get it; the removed one does not.

   This file holds the key helpers, the checks of what arrives, the texts and the markup; the state of the room stays in
   room.js, which also works without this file (then a page simply cannot enter a room that has a waiting room). */
(function(global){
'use strict';
const te=new TextEncoder();
const FP=/^[0-9a-f]{24}$/,KID=/^[0-9a-f]{16}$/,KEY=/^[A-Za-z0-9+/]{43}=$/;
const MAX_ADMITTED=60,MAX_DENIED=60,MAX_WAITING=20,PREFIX='ncred-room-gate-v1\n';
const T={
 ru:{
  title:'ЗАЛ ОЖИДАНИЯ',
  createLabel:'Зал ожидания: впускать игроков вручную',
  createHelp:'Ссылки или кода будет мало: каждого, кто откроет комнату, впускаете вы. Всё, что происходит в комнате, шифруется вторым ключом, и получают его только впущенные устройства.',
  toggle:'Зал ожидания: впускать игроков вручную',
  toggleHelp:'Пока он выключен, в комнату входит любой, у кого есть ссылка или код.',
  onConfirm:'Включить зал ожидания? Все, кто сейчас в комнате, останутся. Новые участники будут ждать, пока вы их не впустите. У каждого должна быть свежая версия страницы: устройство со старой версией в комнату не попадёт.',
  offConfirm:'Выключить зал ожидания? В комнату снова сможет войти любой, у кого есть ссылка или код.',
  lockedGM:'Зал ожидания включён: комнату видят только устройства, которые вы впустили.',
  lockedPlayer:'В комнате включён зал ожидания: её видят только устройства, которые впустил ведущий.',
  help:'Кода комнаты теперь мало: эти устройства ждут вашего решения и пока ничего в комнате не видят.',
  none:'Сейчас никто не ждёт. Новый участник появится здесь, когда откроет ссылку.',
  knocking:'просит впустить в комнату',
  admit:'Впустить',deny:'Отклонить',admitAll:'Впустить всех',
  key:'ключ устройства',noChar:'без персонажа',
  checkKey:'Не уверены, кто это? Попросите назвать ключ устройства: он показан у ждущего на экране.',
  legacy:'страница не обновлена или ещё подключается. Если после «Впустить» участник не появился, попросите его обновить страницу',
  denied:'Отклонено устройств',forgive:'Разрешить им проситься снова',
  remove:'Убрать из комнаты',
  removeConfirm:'Убрать участника «{name}» из комнаты (ключ устройства {key})? Он перестанет видеть комнату, а ключ комнаты сменится: остальные получат новый сами, это занимает пару секунд. Проситься обратно он не сможет, пока вы не разрешите.',
  removed:'Участник убран из комнаты. Ключ комнаты сменён.',
  lobbyWait:'В этой комнате включён зал ожидания. Ведущий увидит ваш запрос и впустит вас: до этого комната вам не видна.',
  lobbyGM:'Ведущий',lobbyOnline:'в сети',
  lobbyOffline:'Ведущего сейчас нет в сети. Запрос дождётся его: страницу можно не закрывать.',
  lobbyRekey:'Ключ комнаты сменился. Устройство ведущего выдаст вам новый само, как только будет в сети.',
  lobbyDenied:'Ведущий не впустил это устройство в комнату.',
  again:'Попроситься ещё раз',
  myKey:'Ключ этого устройства',myKeyHelp:'Если ведущий спросит, назовите его.',
  admitted:'Ведущий впустил вас в комнату.',
  kept:'В этой комнате был включён зал ожидания, он остался включённым. У этого устройства новый ключ комнаты: впустите игроков заново.',
  noCrypto:'Этот браузер не умеет создавать ключи: зал ожидания недоступен.',
  pill:'Ждут в зале ожидания',pillWait:'Ждём, когда ведущий впустит',
 },
 en:{
  title:'WAITING ROOM',
  createLabel:'Waiting room: let players in by hand',
  createHelp:'The link or the code will not be enough: you let in everyone who opens the room. Everything that happens in the room is sealed with a second key, and only the devices you let in get it.',
  toggle:'Waiting room: let players in by hand',
  toggleHelp:'While it is off, anyone with the link or the code enters the room.',
  onConfirm:'Turn the waiting room on? Everyone who is in the room now stays. New members will wait until you let them in. Everybody needs an up-to-date page: a device with an old version will not get in.',
  offConfirm:'Turn the waiting room off? Anyone with the link or the code will be able to enter the room again.',
  lockedGM:'The waiting room is on: only the devices you let in see the room.',
  lockedPlayer:'This room has a waiting room: only the devices the Game Master let in see it.',
  help:'The room code is no longer enough: these devices wait for your decision and see nothing of the room yet.',
  none:'Nobody is waiting now. A new member shows up here once they open the link.',
  knocking:'asks to be let into the room',
  admit:'Let in',deny:'Decline',admitAll:'Let everyone in',
  key:'device key',noChar:'no character',
  checkKey:'Not sure who this is? Ask them to read out their device key: the waiting screen shows it.',
  legacy:'the page is not updated or is still connecting. If the member does not show up after “Let in”, ask them to reload the page',
  denied:'Devices declined',forgive:'Let them ask again',
  remove:'Remove from the room',
  removeConfirm:'Remove “{name}” from the room (device key {key})? They will stop seeing the room and the room key will change: the others get the new one by themselves, it takes a couple of seconds. They cannot ask to come back until you allow it.',
  removed:'The member was removed from the room. The room key was changed.',
  lobbyWait:'This room has a waiting room. The Game Master will see your request and let you in: until then you cannot see the room.',
  lobbyGM:'Game Master',lobbyOnline:'online',
  lobbyOffline:'The Game Master is not online now. Your request will wait for them: you can keep this page open.',
  lobbyRekey:'The room key has changed. The Game Master’s device will give you the new one by itself as soon as it is online.',
  lobbyDenied:'The Game Master did not let this device into the room.',
  again:'Ask again',
  myKey:'This device’s key',myKeyHelp:'If the Game Master asks, read it out.',
  admitted:'The Game Master let you into the room.',
  kept:'This room had a waiting room and it stays on. This device has a new room key: let the players in again.',
  noCrypto:'This browser cannot make keys: the waiting room is not available.',
  pill:'Waiting to be let in',pillWait:'Waiting for the Game Master to let you in',
 },
};
const t=(k,lang)=>(T[lang==='en'?'en':'ru'][k])??T.ru[k]??k;
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clip=(s,n)=>(typeof s==='string'?s:typeof s==='number'?String(s):'').slice(0,n);
const isCoord=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{43}$/.test(v);
const b64=u=>{let s='';for(const x of u)s+=String.fromCharCode(x);return global.btoa(s)};
const unb64=s=>Uint8Array.from(global.atob(s),c=>c.charCodeAt(0));
const hex=b=>Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');
const subtle=()=>global.crypto.subtle;

/* ---------- The room key ---------- */
// A short public name of a key. The Game Master's notice carries it, so a page knows whether the key it holds is still the one in use.
async function kidOf(key){return hex(new Uint8Array(await subtle().digest('SHA-256',te.encode(PREFIX+key))).subarray(0,8))}
async function newKey(){const raw=new Uint8Array(32);global.crypto.getRandomValues(raw);const key=b64(raw);return {key,kid:await kidOf(key)}}
const importKey=key=>{if(!KEY.test(key||''))return Promise.reject(Error('bad_key'));return subtle().importKey('raw',unb64(key),{name:'AES-GCM'},false,['encrypt','decrypt'])};

/* ---------- What arrives from other devices, and what a saved session holds: rebuilt from known fields only ---------- */
function cleanAdmitted(x){
 const out={};if(!x||typeof x!=='object'||Array.isArray(x))return out;
 let n=0;for(const fp of Object.keys(x)){if(!FP.test(fp)||n>=MAX_ADMITTED)continue;const v=x[fp];out[fp]={name:clip(v?.name,40),at:Number.isSafeInteger(v?.at)&&v.at>0?v.at:0};n++}
 return out;
}
const cleanDenied=x=>Array.isArray(x)?[...new Set(x.filter(f=>FP.test(f||'')))].slice(-MAX_DENIED):[];
// A request to enter: a name to show the Game Master and the key to seal the answer to.
function cleanKnock(d){if(!d||typeof d!=='object'||!isCoord(d.box?.x)||!isCoord(d.box?.y))return null;return {name:clip(d.name,40)||'?',cname:clip(d.cname,60),box:{x:d.box.x,y:d.box.y}}}
// The Game Master's notice: whether the room has a waiting room and which key is in use.
function cleanNotice(d){if(!d||typeof d!=='object')return null;const on=d.on===true;if(on&&!KID.test(d.kid||''))return null;return {on,kid:on?d.kid:'',name:clip(d.name,40)}}
// The room key as it comes out of the sealed answer. The name must be the name of this very key.
async function readAdmit(x){
 if(!x||typeof x!=='object'||!KEY.test(x.k||'')||!KID.test(x.kid||''))return null;
 try{return await kidOf(x.k)===x.kid?{key:x.k,kid:x.kid}:null}catch{return null}
}
// The Game Master keeps the key and the lists; a player keeps the key it was given and the name of the key in use.
function cleanGate(g,role){
 if(!g||typeof g!=='object'||Array.isArray(g))return null;
 const at=Number.isSafeInteger(g.at)&&g.at>0?g.at:0;
 if(g.on!==true)return {on:false,at};
 const has=KEY.test(g.key||'')&&KID.test(g.kid||'');
 if(role==='gm')return has?{on:true,key:g.key,kid:g.kid,admitted:cleanAdmitted(g.admitted),denied:cleanDenied(g.denied),at}:null;
 if(!KID.test(g.want||''))return null;
 return {on:true,want:g.want,kid:has?g.kid:'',...(has?{key:g.key}:{}),at};
}
// A Game Master who becomes a player keeps the key as a player would; a player who becomes the Game Master takes the lists over.
const asPlayer=g=>g&&g.on&&KEY.test(g.key||'')?{on:true,want:g.kid,kid:g.kid,key:g.key,at:g.at||0}:g&&g.on===false?{on:false,at:g.at||0}:null;
const asGM=(g,lists,at)=>g&&g.on&&KEY.test(g.key||'')&&KID.test(g.kid||'')?{on:true,key:g.key,kid:g.kid,admitted:cleanAdmitted(lists?.admitted),denied:cleanDenied(lists?.denied),at}:null;

/* ---------- Markup (drawn inside room.js views) ---------- */
// The create form: the Game Master decides before the link goes out.
function createField(lang){
 return `<label class="room-check room-gate-create"><input type="checkbox" id="room-gate"> ${esc(t('createLabel',lang))}</label><small class="room-gate-help">${esc(t('createHelp',lang))}</small>`;
}
// The switch in «You», for the Game Master.
function toggle({lang,on}){
 return `<div class="room-gate-switch"><label class="room-check"><input type="checkbox" data-room-field="gate" ${on?'checked':''}> ${esc(t('toggle',lang))}</label><small class="room-gate-help">${esc(t(on?'lockedGM':'toggleHelp',lang))}</small></div>`;
}
// One line under the room code, for everyone who is in a room with a waiting room.
const lockNote=({lang,gm})=>`<p class="room-key room-gate-lock"><span aria-hidden="true">🔒</span> ${esc(t(gm?'lockedGM':'lockedPlayer',lang))}</p>`;
// The Game Master's list of those who wait. waiting: [[memberId,{fp,name,cname,legacy}]].
function waitingCard({lang,waiting,denied,keyLabel}){
 const list=waiting||[];
 const rows=list.map(([id,w])=>`<li${w.legacy?' class="legacy"':''}><div><b>${esc(w.name||'?')}</b><small>${esc(w.cname||t('noChar',lang))} · ${esc(t('key',lang))} <span class="room-gate-key">${esc(keyLabel(w.fp))}</span>${w.legacy?` · ${esc(t('legacy',lang))}`:''}</small></div><div><button type="button" class="btn primary" data-room-action="gate-admit" data-id="${esc(id)}">${esc(t('admit',lang))}</button><button type="button" class="btn ghost" data-room-action="gate-deny" data-id="${esc(id)}">${esc(t('deny',lang))}</button></div></li>`).join('');
 return `<section class="card room-gate${list.length?' busy':''}" data-room-gate><div class="card-heading"><span>${esc(t('title',lang))}</span><span data-nx>${list.length}</span></div>${list.length?`<p class="room-muted">${esc(t('help',lang))} ${esc(t('checkKey',lang))}</p><ul class="room-gate-list">${rows}</ul>${list.length>1?`<button type="button" class="btn ghost" data-room-action="gate-admit-all">${esc(t('admitAll',lang))}</button>`:''}`:`<p class="room-muted">${esc(t('none',lang))}</p>`}${denied?`<p class="room-key">${esc(t('denied',lang))}: ${denied} <button type="button" class="room-mute" data-room-action="gate-forgive">${esc(t('forgive',lang))}</button></p>`:''}</section>`;
}
// What a device sees instead of the room until it is let in. gmOnline: true, false, or null while it is not known yet.
function lobby({lang,state,gm,gmOnline,myKey}){
 const who=[gm?`${esc(t('lobbyGM',lang))}: <b>${esc(gm)}</b>`:'',gmOnline===true?esc(t('lobbyOnline',lang)):gmOnline===false?esc(t('lobbyOffline',lang)):''].filter(Boolean).join(' · ');
 const text=state==='denied'?t('lobbyDenied',lang):state==='rekey'?t('lobbyRekey',lang):t('lobbyWait',lang);
 return `<section class="card room-lobby" data-room-lobby="${esc(state)}"><div class="card-heading"><span>${esc(t('title',lang))}</span><span>LOBBY</span></div><p class="room-lobby-text" role="status">${state==='denied'?'':'<span class="room-lobby-wait" aria-hidden="true">⏳</span> '}${esc(text)}</p>${state==='denied'?`<button type="button" class="btn ghost" data-room-action="gate-again">${esc(t('again',lang))}</button>`:who?`<p class="room-muted">${who}</p>`:''}<p class="room-key">${esc(t('myKey',lang))}: <b class="room-gate-key">${esc(myKey)}</b> — ${esc(t('myKeyHelp',lang))}</p></section>`;
}
// A button under a member's name, for the Game Master of a room with a waiting room.
function memberTool(m,{lang,gm,on}){
 if(!gm||!on||!m||m.me||m.role==='gm'||!FP.test(m.fp||''))return '';
 return `<div class="room-tools"><button type="button" class="btn ghost room-tool" data-room-action="gate-remove" data-fp="${esc(m.fp)}">${esc(t('remove',lang))}</button></div>`;
}

global.RoomGate={t,T,MAX_ADMITTED,MAX_DENIED,MAX_WAITING,kidOf,newKey,importKey,cleanAdmitted,cleanDenied,cleanKnock,cleanNotice,readAdmit,cleanGate,asPlayer,asGM,createField,toggle,lockNote,waitingCard,lobby,memberTool};
})(window);
