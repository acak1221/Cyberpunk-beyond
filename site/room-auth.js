/* Online rooms: who may act as the Game Master besides the key named in the room link.

   1. A change of device. The Game Master's key signs a «handover» to another key. A device that shows an unbroken chain of
      such handovers from the key a player already trusts to its own key is accepted as the new Game Master, and the player
      then trusts the new key instead. Nothing else moves the trust: without the chain a claimant stays an impostor.
      The chain is made either live (the old device signs for a device that is in the room) or through a file: the old
      device signs for a spare key and saves that key to a file; the new device opens the file and the spare key signs for it.
   2. A co-GM. This needs no certificate of its own: the Game Master names the key in its signed status message, and the
      room (room.js) takes the name only from the Game Master it trusts, never from the helper.

   This file holds the signatures, the file format, the texts and the markup; the state of the room stays in room.js. */
(function(global){
'use strict';
const te=new TextEncoder();
const SIGN={name:'ECDSA',namedCurve:'P-256'},SIGN_HASH={name:'ECDSA',hash:'SHA-256'};
const MAX_CHAIN=8,FILE_FORMAT='nightcity-red-room-gm',FILE_VERSION=1,MAX_FILE=20000,PREFIX='ncred-room-auth-v1\n';
const CODE=/^[2-9A-HJKMNP-Z]{12}$/,FP=/^[0-9a-f]{24}$/;
const T={
 ru:{
  coBadge:'Со-ведущий',grant:'Сделать со-ведущим',revoke:'Забрать права со-ведущего',
  grantConfirm:'Дать участнику «{name}» права со-ведущего? Он сможет вести инициативу и общие счётчики для всей комнаты. Ключ его устройства: {key}. Права можно забрать в любой момент.',
  handover:'Передать ведение',
  handoverConfirm:'Передать ведение комнаты устройству «{name}» (ключ {key})? Сверьте ключ: он показан на том устройстве под кодом комнаты. Игроки примут нового ведущего без новой ссылки, а это устройство станет игроком. Вернуть ведение сможет только новый ведущий.',
  handoverWait:'Ведение передаётся устройству «{name}» (ключ {key}). Не закрывайте страницу, пока оно не ответит.',
  handoverSent:'Передача ведения отправлена. Ждём ответа нового устройства.',handoverCancel:'Отменить передачу',
  nowGM:'Ведение комнаты передано этому устройству: теперь вы ведущий.',
  gmMoved:'Ведущий сменил устройство. Новый ключ {key} подтверждён подписью прежнего.',
  steppedDown:'Ведение перешло к другому устройству (ключ {key}). Здесь вы теперь игрок.',
  coGranted:'Ведущий дал вам права со-ведущего. Выберите кампанию в настройках комнаты, чтобы вести инициативу и счётчики.',
  coRevoked:'Ведущий забрал у вас права со-ведущего.',
  coNote:'Вы со-ведущий: инициативу и общие счётчики выбранной кампании видит вся комната.',
  coIs:'Со-ведущий назначен. Его инициативу и счётчики комната принимает наравне с вашими.',
  myKey:'Ключ этого устройства',keyMoved:'Ведущий сменил устройство; его новый ключ',
  tools:'Смена устройства',fileSave:'Сохранить файл ведущего',
  fileHelp:'Запасной ключ этой комнаты. С ним вы откроете комнату как ведущий в другом браузере или на другом устройстве, и игрокам не понадобится новая ссылка. Храните файл как пароль: любой, у кого он есть, может стать ведущим этой комнаты.',
  fileSaved:'Файл ведущего сохранён. Храните его как пароль.',
  fileOpen:'Открыть файл ведущего',fileOpenTitle:'Ведущий сменил устройство?',
  fileOpenHelp:'Откройте файл ведущего, сохранённый на прежнем устройстве: комната продолжится, и игрокам не понадобится новая ссылка.',
  fileBad:'Это не файл ведущего комнаты, или он повреждён.',
  chainFull:'Ведение этой комнаты передавали слишком много раз. Создайте новую комнату и разошлите новую ссылку.',
  noCrypto:'Этот браузер не умеет подписывать: передать ведение не получится.',
  fileName:'Имя ведущего',fileNamePh:'Как вас видят игроки',
 },
 en:{
  coBadge:'Co-GM',grant:'Make co-GM',revoke:'Revoke co-GM rights',
  grantConfirm:'Give “{name}” co-GM rights? They will be able to run initiative and shared clocks for the whole room. Their device key: {key}. You can revoke the rights at any time.',
  handover:'Hand over GM role',
  handoverConfirm:'Hand the room over to the device “{name}” (key {key})? Compare the key: that device shows it under the room code. Players will accept the new Game Master without a new link, and this device becomes a player. Only the new Game Master can hand the role back.',
  handoverWait:'Handing the room over to “{name}” (key {key}). Keep this page open until that device answers.',
  handoverSent:'Handover sent. Waiting for the new device to answer.',handoverCancel:'Cancel the handover',
  nowGM:'The room was handed over to this device: you are the Game Master now.',
  gmMoved:'The Game Master changed device. The new key {key} is confirmed by the signature of the previous one.',
  steppedDown:'The Game Master role moved to another device (key {key}). You are a player here now.',
  coGranted:'The Game Master made you a co-GM. Pick a campaign in the room settings to run initiative and clocks.',
  coRevoked:'The Game Master revoked your co-GM rights.',
  coNote:'You are a co-GM: the whole room sees the initiative and shared clocks of the campaign you pick.',
  coIs:'A co-GM is appointed. The room accepts their initiative and clocks the same as yours.',
  myKey:'This device’s key',keyMoved:'The Game Master changed device; the new key',
  tools:'Changing device',fileSave:'Save the Game Master file',
  fileHelp:'A spare key for this room. With it you can open the room as the Game Master in another browser or on another device, and players will not need a new link. Keep the file like a password: anyone who has it can become the Game Master of this room.',
  fileSaved:'Game Master file saved. Keep it like a password.',
  fileOpen:'Open a Game Master file',fileOpenTitle:'Game Master on a new device?',
  fileOpenHelp:'Open the Game Master file saved on the previous device: the room goes on and players will not need a new link.',
  fileBad:'This is not a room Game Master file, or it is damaged.',
  chainFull:'This room has been handed over too many times. Create a new room and send out a new link.',
  noCrypto:'This browser cannot sign: the room cannot be handed over.',
  fileName:'Game Master name',fileNamePh:'How players see you',
 },
};
const t=(k,lang)=>(T[lang==='en'?'en':'ru'][k])??T.ru[k]??k;
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const isCoord=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{43}$/.test(v);
const isPub=p=>!!p&&isCoord(p.x)&&isCoord(p.y);
const b64=u=>{let s='';for(const x of u)s+=String.fromCharCode(x);return global.btoa(s)};
const unb64=s=>Uint8Array.from(global.atob(s),c=>c.charCodeAt(0));
const hex=b=>Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');
const subtle=()=>global.crypto.subtle;
// The same fingerprint room.js gives a key: a member id starts with it.
async function fingerprint(pub){return hex(new Uint8Array(await subtle().digest('SHA-256',te.encode(pub.x+'.'+pub.y))).subarray(0,12))}
const importVerify=pub=>subtle().importKey('jwk',{kty:'EC',crv:'P-256',x:pub.x,y:pub.y,ext:true},SIGN,false,['verify']);

/* One handover: «key from passes the Game Master role of this room to key to», signed by from. The room is part of the
   signed text, so a handover made for one room proves nothing in another. */
async function signHandover(privateKey,from,to,room,at){
 const body=JSON.stringify({k:'handover',room,from:{x:from.x,y:from.y},to:{x:to.x,y:to.y},at});
 return {b:body,s:b64(new Uint8Array(await subtle().sign(SIGN_HASH,privateKey,te.encode(PREFIX+body))))};
}
function readHandover(c){
 if(!c||typeof c!=='object'||typeof c.b!=='string'||c.b.length>700||typeof c.s!=='string'||c.s.length>130)return null;
 let o;try{o=JSON.parse(c.b)}catch{return null}
 if(!o||o.k!=='handover'||typeof o.room!=='string'||o.room.length>80||!isPub(o.from)||!isPub(o.to)||!Number.isSafeInteger(o.at)||o.at<=0)return null;
 return o;
}
const cleanChain=chain=>Array.isArray(chain)&&chain.length&&chain.length<=MAX_CHAIN&&chain.every(readHandover)?chain.map(c=>({b:c.b,s:c.s})):null;
/* Does this chain lead from the key trusted so far (root) to the key that shows it (leaf)?
   - every link is for this room, each one starts where the previous ended, and each is later than the previous;
   - the part that counts starts at the last link signed by the trusted key, and that link must be later than the handover
     this page accepted last (after): an old handover cannot be shown again to take the role back;
   - every link of that part carries a valid signature of its «from» key.
   Returns {at, links} or null. */
async function verifyChain(chain,{room,root,leaf,after=0}={}){
 try{
  if(!Array.isArray(chain)||!chain.length||chain.length>MAX_CHAIN||!FP.test(root||'')||!FP.test(leaf||'')||typeof room!=='string'||!room)return null;
  const links=[];
  for(const c of chain){const o=readHandover(c);if(!o||o.room!==room)return null;links.push({o,c,from:await fingerprint(o.from),to:await fingerprint(o.to)})}
  for(let i=1;i<links.length;i++)if(links[i].from!==links[i-1].to||links[i].o.at<=links[i-1].o.at)return null;
  if(links[links.length-1].to!==leaf)return null;
  let start=-1;for(let i=links.length-1;i>=0;i--)if(links[i].from===root){start=i;break}
  if(start<0||!(links[start].o.at>(Number(after)||0)))return null;
  for(let i=start;i<links.length;i++){const l=links[i];if(!await subtle().verify(SIGN_HASH,await importVerify(l.o.from),unb64(l.c.s),te.encode(PREFIX+l.c.b)))return null}
  return {at:links[links.length-1].o.at,links:links.length-start};
 }catch{return null}
}
// The key the chain ends at, or '' for something that is not a chain.
async function leafOf(chain){const c=cleanChain(chain);if(!c)return '';try{return await fingerprint(readHandover(c[c.length-1]).to)}catch{return ''}}
// A chain one handover longer: «me» (the holder of the last key) passes the role on.
async function extend(chain,me,toPub,room){
 const prev=cleanChain(chain)||[];if(prev.length>=MAX_CHAIN)throw Error('chain_full');
 if(!isPub(toPub))throw Error('bad_key');
 const last=prev.length?readHandover(prev[prev.length-1]).at:0;
 return [...prev,await signHandover(me.privateKey,me.pub,toPub,room,Math.max(Date.now(),last+1))];
}

/* The Game Master file: a spare key the Game Master's key has already handed the room to, with the secret half inside.
   Whoever opens it lets the spare key sign for their own device. The file is as good as the role itself, hence the warning. */
async function makeFile({chain,me,room,code,name}){
 const pair=await subtle().generateKey(SIGN,true,['sign','verify']),j=await subtle().exportKey('jwk',pair.privateKey);
 const spare={x:j.x,y:j.y};
 return {format:FILE_FORMAT,v:FILE_VERSION,code,name:String(name||'').slice(0,40),made:new Date().toISOString(),chain:await extend(chain,me,spare,room),key:{kty:'EC',crv:'P-256',x:j.x,y:j.y,d:j.d}};
}
function parseFile(text){
 if(typeof text!=='string'||!text||text.length>MAX_FILE)return null;
 let o;try{o=JSON.parse(text)}catch{return null}
 if(!o||typeof o!=='object'||Array.isArray(o)||o.format!==FILE_FORMAT||o.v!==FILE_VERSION||typeof o.code!=='string'||!CODE.test(o.code))return null;
 const chain=cleanChain(o.chain),k=o.key;
 if(!chain||!k||typeof k!=='object'||k.kty!=='EC'||k.crv!=='P-256'||!isCoord(k.x)||!isCoord(k.y)||!isCoord(k.d))return null;
 return {code:o.code,name:typeof o.name==='string'?o.name.slice(0,40):'',chain,key:{kty:'EC',crv:'P-256',x:k.x,y:k.y,d:k.d}};
}
// The spare key from the file signs for this device. The result is checked like any chain a stranger would show.
async function redeem(file,me,room){
 try{
  if(!file||!cleanChain(file.chain))return null;
  const priv=await subtle().importKey('jwk',{...file.key,ext:true},SIGN,false,['sign']),spare={x:file.key.x,y:file.key.y};
  const first=readHandover(file.chain[0]),last=readHandover(file.chain[file.chain.length-1]);
  if(last.to.x!==spare.x||last.to.y!==spare.y)return null;
  const chain=await extend(file.chain,{privateKey:priv,pub:spare},me.pub,room),res=await verifyChain(chain,{room,root:await fingerprint(first.from),leaf:me.fp});
  return res?{chain,at:res.at}:null;
 }catch{return null}
}
function download(name,text){
 const doc=global.document,url=global.URL.createObjectURL(new global.Blob([text],{type:'application/json'})),a=doc.createElement('a');
 a.href=url;a.download=name;a.rel='noopener';doc.body.appendChild(a);a.click();a.remove();setTimeout(()=>global.URL.revokeObjectURL(url),2000);
}
// Ask for a file and give back its text ('' when nothing was chosen or it is far too large to be ours).
function pickFile(){
 return new Promise(resolve=>{
  const doc=global.document,input=doc.createElement('input');input.type='file';input.accept='.json,application/json';input.hidden=true;
  input.addEventListener('change',async()=>{const f=input.files&&input.files[0];input.remove();if(!f||f.size>MAX_FILE){resolve(f?'\u0000':'');return}try{resolve(await f.text())}catch{resolve('\u0000')}});
  input.addEventListener('cancel',()=>{input.remove();resolve('')});
  doc.body.appendChild(input);input.click();
 });
}

/* ---------- Markup (drawn inside room.js views) ---------- */
// Buttons under a member's name, for the Game Master only.
function memberTools(m,{lang,gm,deputy,pending}){
 if(!gm||!m||m.me||m.role==='gm'||m.impostor||!FP.test(m.fp||''))return '';
 const co=m.fp===deputy;
 return `<div class="room-tools"><button type="button" class="btn ghost room-tool" data-room-action="${co?'co-revoke':'co-grant'}" data-fp="${esc(m.fp)}" aria-pressed="${co}">${esc(t(co?'revoke':'grant',lang))}</button>${m.pk&&!pending?`<button type="button" class="btn ghost room-tool" data-room-action="handover" data-fp="${esc(m.fp)}">${esc(t('handover',lang))}</button>`:''}</div>`;
}
const coBadge=lang=>`<span class="room-badge co">${esc(t('coBadge',lang))}</span>`;
// The block in «You» for the Game Master (file, pending handover) and for a co-GM (a note).
function panel({lang,gm,co,deputy,pending,keyLabel}){
 if(co)return `<p class="room-auth-note">${esc(t('coNote',lang))}</p>`;
 if(!gm)return '';
 return `<div class="room-auth">${pending?`<p class="room-auth-note" role="status">${esc(t('handoverWait',lang).replace('{name}',pending.name||'?').replace('{key}',keyLabel(pending.fp)))} <button type="button" class="btn ghost room-tool" data-room-action="handover-cancel">${esc(t('handoverCancel',lang))}</button></p>`:''}${deputy?`<p class="room-auth-note">${esc(t('coIs',lang))}</p>`:''}<div class="room-auth-file"><button type="button" class="btn ghost" data-room-action="gm-file">⭳ ${esc(t('fileSave',lang))}</button><small>${esc(t('fileHelp',lang))}</small></div></div>`;
}
// Under the «create / join» forms: come back as the Game Master with a file.
function importCard({lang,name}){
 return `<section class="card room-join room-auth-import"><div class="card-heading"><span>${esc(t('fileOpenTitle',lang))}</span><span>GM FILE</span></div><p>${esc(t('fileOpenHelp',lang))}</p><label class="field">${esc(t('fileName',lang))}<input id="room-file-name" maxlength="40" placeholder="${esc(t('fileNamePh',lang))}" value="${esc(name||'')}"></label><button type="button" class="btn ghost wide" data-room-action="gm-file-open">⭱ ${esc(t('fileOpen',lang))}</button></section>`;
}

global.RoomAuth={t,MAX_CHAIN,FILE_FORMAT,fingerprint,signHandover,readHandover,cleanChain,verifyChain,leafOf,extend,makeFile,parseFile,redeem,download,pickFile,memberTools,coBadge,panel,importCard};
})(window);
