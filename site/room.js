/* Live rooms: the GM and players see each other's character status, the GM's
   initiative order and everyone's rolls in real time. No accounts and no database:
   messages are end-to-end encrypted with the room code and relayed through
   public MQTT brokers (see room-transport.js). Anyone with the code can join,
   but nobody can speak for somebody else: every device signs what it sends with
   its own key, and the Game Master is the holder of the key named in the room
   link (or the first one a player meets when joining by code alone). */
(function(global){
'use strict';
const doc=global.document,te=new TextEncoder(),td=new TextDecoder();
const SESSION_KEY='nightcity-red-room-v1',BROKERS_KEY='nightcity-red-room-brokers',DEVICE_KEY='nightcity-red-room-device';
const ALPHABET='23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const HEARTBEAT=45000,ONLINE_FOR=130000,FORGET_AFTER=6*3600*1000,STATE_TTL=12*3600*1000,MAX_MEMBERS=30,MAX_FEED=40,MAX_BYTES=160000,SHEET_UNPACKED=2000000,SHEET_WAIT=30000,MAX_OUTBOX=20,NO_GM_HINT=12000,PROTOCOL=3,EVENT_WINDOW=600000,GONE_GRACE=8000;
const FP=/^[0-9a-f]{24}$/,MEMBER_ID=/^[0-9a-f]{24}\.[0-9a-f]{8}$/;
let identity=null,identityWait=null,pendingPin='',oldSeen=0,willBytes=null,paintQueued=false;const verifyKeys=new Map(),muted=new Set(),buckets=new Map(),flood={at:0,n:0};
const T={ru:{nav:'Игра онлайн',over:'05 / ONLINE ROOM',title:'ИГРА ОНЛАЙН',lead:'Комната связывает телефоны и компьютеры ведущего и игроков: все видят состояние персонажей, порядок инициативы и броски в реальном времени.',how:'Без регистрации и без базы данных. Данные шифруются кодом комнаты прямо на устройстве и передаются через несколько бесплатных публичных серверов-ретрансляторов одновременно — если один недоступен, работают остальные. Каждое устройство подписывает свои сообщения собственным ключом, поэтому выдать себя за другого участника или за ведущего нельзя: ведущий — владелец ключа из ссылки на комнату. Ваши листы остаются у вас; в комнату уходит только сводка выбранного персонажа (и портрет, если включено). Зашифрованная копия вашего статуса хранится на серверах-ретрансляторах, пока вы в комнате, и заменяется отметкой ухода, когда вы её покидаете.',gm:'Я ведущий',gmLead:'Создайте комнату и отправьте ссылку игрокам в чат.',player:'Я игрок',playerLead:'Откройте ссылку от ведущего или введите код комнаты.',name:'Ваше имя в комнате',namePh:'Например, Мастер или Ви',campaign:'Кампания для трекера инициативы',noCampaign:'Не показывать инициативу',create:'Создать комнату',code:'Код комнаты',codePh:'XXXX-XXXX-XXXX',character:'Персонаж, которого видят другие',noCharacter:'Без персонажа (наблюдатель)',join:'Войти в комнату',badCode:'Проверьте код: 12 символов, например K7RQ-M2XA-PZ9E.',needName:'Введите имя.',room:'КОМНАТА',copy:'Скопировать ссылку',copied:'Ссылка скопирована. Отправьте её игрокам.',share:'Поделиться',leave:'Покинуть',leaveConfirm:'Покинуть комнату? Другие перестанут видеть ваш статус.',you:'Вы',asGM:'ведущий',asPlayer:'игрок',servers:'Серверы связи',online:'в сети',offline:'нет связи',ago:'мин назад',team:'КОМАНДА',noTeam:'Пока здесь только вы. Отправьте ссылку игрокам.',noChar:'без персонажа',initiative:'ИНИЦИАТИВА',round:'Раунд',noCombat:'Ведущий ещё не показал инициативу.',rolls:'БРОСКИ',noRolls:'Бросков пока нет. Броски с листа и со страницы «Кубики» появятся здесь у всех.',broadcast:'Показывать мои броски другим',toasts:'Всплывающие уведомления о бросках других',connecting:'Подключение…',noNetwork:'Нет связи ни с одним сервером. Проверьте интернет — подключение восстановится само.',crit:'КРИТ',fumble:'ПРОВАЛ',unsupported:'Этот браузер не поддерживает шифрование для комнат. Обновите браузер.',hp:'HP',hum:'HUM',luck:'LUCK',sp:'SP',head:'голова',body:'тело',turn:'ходит',gmBadge:'ВЕДУЩИЙ',clocks:'СЧЁТЧИКИ',otherRoom:'Вы открыли ссылку на другую комнату',switchRoom:'Перейти (выйти из текущей)',stayRoom:'Остаться',noGM:'Ведущего пока нет в комнате. Проверьте код или подождите — он появится, когда ведущий откроет комнату.',twoGM:'В комнате несколько ведущих: инициатива и счётчики показываются от последнего обновления.',notSent:'не отправлено — отправится при связи',sharePortrait:'Показывать мой портрет',sendSheet:'Отправить лист ведущему',sendSheetHelp:'Ведущий получит полную копию листа и сможет принять её к себе. Лист шифруется так, что открыть его может только ведущий.',sheetWaiting:'Лист отправлен — ждём подтверждения от ведущего…',sheetSentOld:'Лист отправлен. Подтверждение придёт, когда ведущий его примет.',sheetGot:'Ведущий получил лист «{name}». Ждём, когда он его примет.',sheetNoReply:'Ведущий пока не подтвердил получение листа. Проверьте, что он в комнате и на связи, и отправьте лист ещё раз.',sheetTooBig:'Лист слишком большой для отправки через комнату: {size} КБ после сжатия, а можно не больше {max} КБ. Сократите заметки или передайте лист файлом: откройте лист и нажмите «Экспорт JSON».',sheetTooBigGM:'Лист слишком большой для приложения ведущего: {size} КБ, а можно не больше {max} КБ. Его страница не принимает сжатые листы — попросите ведущего обновить страницу или открыть приложение в свежем браузере и отправьте лист ещё раз. Или передайте лист файлом: откройте лист и нажмите «Экспорт JSON».',sheetTooBigHere:'Лист слишком большой для отправки без сжатия: {size} КБ, а можно не больше {max} КБ. Этот браузер не умеет сжимать листы — откройте приложение в свежем браузере или передайте лист файлом: откройте лист и нажмите «Экспорт JSON».',noGMKey:'Ведущий ещё не в комнате.',incoming:'ПРИСЛАННЫЕ ЛИСТЫ',fromPlayer:'от',accept:'Принять',update:'Обновить',decline:'Отклонить',sheetReceived:'прислал(а) лист',sheetSaved:'Лист сохранён',sheetUpdated:'Лист обновлён',addedRoster:'и добавлен в кампанию',sheetAccepted:'Ведущий принял ваш лист',openSheet:'Открыть',sheetCopied:'Лист добавлен отдельным персонажем',sheetKept:'Прежняя версия сохранена на 30 дней: «Персонажи» → «Удалённые персонажи».',sheetNoRoom:'Лист не сохранён: в браузере не хватает места. Освободите место (удалите ненужных персонажей или портреты) и примите лист ещё раз — он остаётся в списке.',sheetPaused:'Лист не сохранён: редактирование приостановлено. Он остаётся в списке — примите его позже.',sheetGone:'Лист не сохранён: персонаж, которого он обновлял, удалён. Лист остаётся в списке — примите его ещё раз.',sheetBad:'Не удалось прочитать лист.',sheetBig:'Лист слишком большой, чтобы его сохранить.',newCode:'Будет создан новый код комнаты.',tip:'Совет: добавьте сайт на главный экран телефона — так комната откроется как приложение.'},
 en:{nav:'Online play',over:'05 / ONLINE ROOM',title:'ONLINE PLAY',lead:'A room links the GM and players across phones and computers: everyone sees character status, initiative order and rolls in real time.',how:'No sign-up and no database. Data is encrypted with the room code on your device and relayed through several free public relay servers at once — if one is down, the others carry on. Every device signs what it sends with its own key, so nobody can pose as another member or as the Game Master: the Game Master is the holder of the key named in the room link. Your sheets stay with you; only a summary of the chosen character is shared (plus the portrait if enabled). An encrypted copy of your status stays on the relay servers while you are in the room and is replaced by a "left" marker when you leave.',gm:'I am the GM',gmLead:'Create a room and send the link to your players.',player:'I am a player',playerLead:'Open the GM\'s link or type the room code.',name:'Your name in the room',namePh:'For example, GM or V',campaign:'Campaign for the initiative tracker',noCampaign:'Don\'t share initiative',create:'Create room',code:'Room code',codePh:'XXXX-XXXX-XXXX',character:'Character others can see',noCharacter:'No character (observer)',join:'Join room',badCode:'Check the code: 12 characters, e.g. K7RQ-M2XA-PZ9E.',needName:'Enter a name.',room:'ROOM',copy:'Copy link',copied:'Link copied. Send it to your players.',share:'Share',leave:'Leave',leaveConfirm:'Leave the room? Others will stop seeing your status.',you:'You',asGM:'GM',asPlayer:'player',servers:'Relay servers',online:'online',offline:'offline',ago:'min ago',team:'CREW',noTeam:'Only you so far. Send the link to your players.',noChar:'no character',initiative:'INITIATIVE',round:'Round',noCombat:'The GM has not shared initiative yet.',rolls:'ROLLS',noRolls:'No rolls yet. Rolls from sheets and the Dice page show up here for everyone.',broadcast:'Show my rolls to others',toasts:'Pop-up notices for other people\'s rolls',connecting:'Connecting…',noNetwork:'No relay server reachable. Check your connection — it reconnects automatically.',crit:'CRIT',fumble:'FUMBLE',unsupported:'This browser cannot encrypt room traffic. Please update it.',hp:'HP',hum:'HUM',luck:'LUCK',sp:'SP',head:'head',body:'body',turn:'acting',gmBadge:'GM',clocks:'CLOCKS',otherRoom:'You opened a link to another room',switchRoom:'Switch (leave the current one)',stayRoom:'Stay',noGM:'No GM in this room yet. Check the code or wait — the GM appears once they open the room.',twoGM:'There are several GMs in this room: initiative and clocks show the latest update.',notSent:'not sent — will send when online',sharePortrait:'Show my portrait',sendSheet:'Send sheet to the GM',sendSheetHelp:'The GM gets a full copy of the sheet and can accept it. It is encrypted so that only the GM can open it.',sheetWaiting:'Sheet sent — waiting for the GM to confirm…',sheetSentOld:'Sheet sent. You will get a confirmation once the GM accepts it.',sheetGot:'The GM received "{name}". Waiting for them to accept it.',sheetNoReply:'The GM has not confirmed receiving the sheet yet. Check that they are in the room and online, then send it again.',sheetTooBig:'The sheet is too big to send through the room: {size} KB after compression, the limit is {max} KB. Shorten the notes or send it as a file: open the sheet and press Export JSON.',sheetTooBigGM:'The sheet is too big for the GM\'s app: {size} KB, the limit is {max} KB. Their page does not accept compressed sheets — ask the GM to reload the page or open the app in an up-to-date browser, then send the sheet again. Or send it as a file: open the sheet and press Export JSON.',sheetTooBigHere:'The sheet is too big to send uncompressed: {size} KB, the limit is {max} KB. This browser cannot compress sheets — open the app in an up-to-date browser, or send it as a file: open the sheet and press Export JSON.',noGMKey:'The GM is not in the room yet.',incoming:'INCOMING SHEETS',fromPlayer:'from',accept:'Accept',update:'Update',decline:'Decline',sheetReceived:'sent a sheet',sheetSaved:'Sheet saved',sheetUpdated:'Sheet updated',addedRoster:'and added to the campaign',sheetAccepted:'The GM accepted your sheet',openSheet:'Open',sheetCopied:'Sheet added as a separate character',sheetKept:'The previous version is kept for 30 days: Characters → Deleted characters.',sheetNoRoom:'The sheet was not saved: the browser is out of storage. Free some space (delete characters or portraits you do not need) and accept the sheet again — it stays in the list.',sheetPaused:'The sheet was not saved: editing is paused. It stays in the list — accept it later.',sheetGone:'The sheet was not saved: the character it was updating has been deleted. It stays in the list — accept it again.',sheetBad:'Could not read the sheet.',sheetBig:'The sheet is too big to save.',newCode:'A new room code will be generated.',tip:'Tip: add the site to your phone\'s home screen so the room opens like an app.'}};

let app=null,session=null,transport=null,key=null,base='',members=new Map(),combat=null,clocks=[],lastClocks='',combatAt=0,clocksAt=0,outbox=[],connectedAt=0,deferredRepaint=false,selectHold=0,holdTimer=null,feed=[],netStatus={total:0,online:0},heartbeat=null,changeTimer=null,lastMember='',lastCombat='',pendingCode=null,joining=false,gmKeys=null,gmPub=null,incoming=[],qrFor='',qrMarkup='',sheetState=null,sheetTimer=null,device='';

Object.assign(T.ru,{keyMine:'Ваш ключ ведущего',keyLink:'Ведущий подтверждён ссылкой, его ключ',keyFirst:'Ключ ведущего запомнен при входе; если входили по коду, сверьте его с ведущим',gmFirst:'Ведущий комнаты: {name}. Его ключ {key} запомнен. Если вы входили по коду, а не по ссылке, сверьте ключ с ведущим.',impostor:'называет себя ведущим',impostorNote:'Кто-то ещё называет себя ведущим. Инициатива, счётчики и листы принимаются только от ведущего с ключом этой комнаты.',mute:'Скрыть',muteTitle:'Не показывать этого участника и не принимать его сообщения',mutedCount:'Скрыто участников',unmute:'Показать всех',oldVersion:'У кого-то в комнате старая версия приложения. Попросите его обновить страницу, иначе вы не увидите друг друга.',pinNote:'Ссылка называет ключ ведущего',yourTurn:'Ваш ход',yourTurnHint:'Инициатива перешла к вашему персонажу',veiled:'Ходит скрытый участник',initSet:'Инициатива записана в трекер',liveHp:'в комнате',pinChange:'Эта ссылка называет другого ведущего: ключ {new} вместо {old}. Доверять новому ключу?'});
Object.assign(T.en,{keyMine:'Your Game Master key',keyLink:'Game Master confirmed by the link, their key',keyFirst:'Game Master key remembered on joining; if you joined by code, check it with your GM',gmFirst:'Game Master of this room: {name}. Their key {key} is remembered. If you joined by code and not by link, check the key with your GM.',impostor:'claims to be the Game Master',impostorNote:'Someone else claims to be the Game Master. Initiative, clocks and sheets are accepted only from the GM with this room’s key.',mute:'Hide',muteTitle:'Stop showing this member and drop their messages',mutedCount:'Hidden members',unmute:'Show all',oldVersion:'Someone in the room has an older version of the app. Ask them to reload the page, or you will not see each other.',pinNote:'The link names the Game Master key',yourTurn:'Your turn',yourTurnHint:'Initiative has come to your character',veiled:'A hidden participant is acting',initSet:'Initiative written to the tracker',liveHp:'in the room',pinChange:'This link names another Game Master: key {new} instead of {old}. Trust the new key?'});
const lang=()=>{try{return app?.getState?.().lang==='en'?'en':'ru'}catch{return 'ru'}};
const t=k=>T[lang()][k]??T.ru[k]??k;
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Text from another member: anything that is not text or a number reads as empty.
const clip=(s,n)=>(typeof s==='string'?s:typeof s==='number'?String(s):'').slice(0,n);
const int=(v,lo=-999,hi=9999)=>{const n=Math.round(Number(v));return Number.isFinite(n)?Math.max(lo,Math.min(hi,n)):0};
const rand=n=>{const a=new Uint8Array(n);global.crypto.getRandomValues(a);return a};
const hex=b=>Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');

/* Sheets sent to the GM are encrypted a second time with an ECDH key only the GM's open page holds, so other players in the room cannot read them. */
const b64=u=>{let s='';for(const x of u)s+=String.fromCharCode(x);return global.btoa(s)};
const unb64=s=>Uint8Array.from(global.atob(s),c=>c.charCodeAt(0));
const isCoord=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{43}$/.test(v);
const ECDH={name:'ECDH',namedCurve:'P-256'};
/* Every device signs what it sends, so knowing the room code is not enough to speak as someone else. The signing key is made once
   per browser and kept unextractable in IndexedDB (only in memory where that is not available). A member id is the fingerprint of
   that key plus a few random characters, so two tabs of one browser are still two members. */
const SIGN={name:'ECDSA',namedCurve:'P-256'},SIGN_HASH={name:'ECDSA',hash:'SHA-256'},KEY_DB='nc-room-identity';
function keyStore(mode,work){return new Promise((resolve,reject)=>{let open;try{open=global.indexedDB.open(KEY_DB,1)}catch(e){reject(e);return}open.onupgradeneeded=()=>{open.result.createObjectStore('keys')};open.onerror=()=>reject(open.error);open.onsuccess=()=>{const db=open.result;try{const tx=db.transaction('keys',mode),req=work(tx.objectStore('keys'));tx.oncomplete=()=>{db.close();resolve(req.result)};tx.onabort=tx.onerror=()=>{db.close();reject(tx.error)}}catch(e){db.close();reject(e)}}})}
async function fingerprint(pub){return hex(new Uint8Array(await global.crypto.subtle.digest('SHA-256',te.encode(pub.x+'.'+pub.y))).subarray(0,12))}
async function newIdentity(){const subtle=global.crypto.subtle,pair=await subtle.generateKey(SIGN,false,['sign','verify']),j=await subtle.exportKey('jwk',pair.publicKey),pub={x:j.x,y:j.y};return {privateKey:pair.privateKey,pub,fp:await fingerprint(pub)}}
function ensureIdentity(){
 if(identity)return Promise.resolve(identity);
 return identityWait||(identityWait=(async()=>{
  let rec=null;try{rec=await keyStore('readonly',store=>store.get('device'))}catch{}
  if(rec?.privateKey&&isCoord(rec.pub?.x)&&isCoord(rec.pub?.y))return identity={privateKey:rec.privateKey,pub:{x:rec.pub.x,y:rec.pub.y},fp:await fingerprint(rec.pub)};
  const made=await newIdentity();
  try{await keyStore('readwrite',store=>store.put({privateKey:made.privateKey,pub:made.pub},'device'))}catch{}
  return identity=made;
 })().finally(()=>{identityWait=null}));
}
async function verifyKey(pub){const id=pub.x+'.'+pub.y;let k=verifyKeys.get(id);if(!k){k=await global.crypto.subtle.importKey('jwk',{kty:'EC',crv:'P-256',x:pub.x,y:pub.y,ext:true},SIGN,false,['verify']);if(verifyKeys.size>200)verifyKeys.clear();verifyKeys.set(id,k)}return k}
// What is signed: the room, the subtopic and the message text, so a message cannot be moved to another room or another subtopic.
const signedText=(room,sub,body)=>te.encode(room+'\n'+sub+'\n'+body);
const keyLabel=fp=>FP.test(fp||'')?fp.slice(0,12).toUpperCase().replace(/(.{4})(?=.)/g,'$1-'):'—';
// Flood guards: a cap on everything handled per second, before any decryption, and an allowance per sender once the signature is checked.
function underCap(){const now=Date.now();if(now-flood.at>=1000){flood.at=now;flood.n=0}return ++flood.n<=120}
function allowed(fp){const now=Date.now();let b=buckets.get(fp);if(!b){if(buckets.size>300)buckets.clear();b={tokens:30,at:now};buckets.set(fp,b)}b.tokens=Math.min(30,b.tokens+(now-b.at)/1000*3);b.at=now;if(b.tokens<1)return false;b.tokens--;return true}
async function ensureGMKeys(){if(gmKeys)return;const subtle=global.crypto.subtle;gmKeys=await subtle.generateKey(ECDH,false,['deriveKey']);const j=await subtle.exportKey('jwk',gmKeys.publicKey);gmPub={x:j.x,y:j.y}}
const importPub=p=>global.crypto.subtle.importKey('jwk',{kty:'EC',crv:'P-256',x:p.x,y:p.y,ext:true},ECDH,false,[]);
const sharedKey=(priv,pub)=>global.crypto.subtle.deriveKey({name:'ECDH',public:pub},priv,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
async function sealFor(pub,data){const subtle=global.crypto.subtle,eph=await subtle.generateKey(ECDH,true,['deriveKey']),k=await sharedKey(eph.privateKey,await importPub(pub)),iv=rand(12),ct=new Uint8Array(await subtle.encrypt({name:'AES-GCM',iv},k,ArrayBuffer.isView(data)?data:te.encode(JSON.stringify(data)))),j=await subtle.exportKey('jwk',eph.publicKey);return {epk:{x:j.x,y:j.y},iv:b64(iv),ct:b64(ct)}}
async function openBytes(box){if(!gmKeys||!isCoord(box?.epk?.x)||!isCoord(box?.epk?.y)||typeof box.iv!=='string'||typeof box.ct!=='string')return null;const k=await sharedKey(gmKeys.privateKey,await importPub(box.epk));return new Uint8Array(await global.crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(box.iv)},k,unb64(box.ct)))}
async function openFromPeer(box){const plain=await openBytes(box);return plain&&JSON.parse(td.decode(plain))}
function sheetCopy(c){const copy=JSON.parse(JSON.stringify(c));if(copy.extra&&typeof copy.extra==='object'){delete copy.extra.portrait;delete copy.extra.sourceKey}return copy}
/* A sheet travels as {who,dev,character}: 'z' = deflate-raw (all current browsers), 'j' = plain JSON. GM pages list the forms they read
   in their status ('sheets'); older GM pages list none and read only a bare character. */
async function pipe(bytes,stream){return new Uint8Array(await new global.Response(new global.Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer())}
// The packed bytes are handed over 1 KB at a time and only when asked for: given all at once, the browser unpacks everything before the first piece can be counted against the limit.
async function inflate(bytes,limit){let at=0;const reader=new global.ReadableStream({pull(c){if(at>=bytes.length)c.close();else c.enqueue(bytes.slice(at,at+=1024))}},{highWaterMark:0}).pipeThrough(new global.DecompressionStream('deflate-raw')).getReader(),parts=[];let n=0;for(;;){const {done,value}=await reader.read();if(done)break;n+=value.length;if(n>limit){reader.cancel().catch(()=>{});throw Error('too_big')}parts.push(value)}const out=new Uint8Array(n);let o=0;for(const p of parts){out.set(p,o);o+=p.length}return out}
const readsSheets=()=>global.DecompressionStream?'zj':'j';
async function packSheet(obj,forms){const json=te.encode(JSON.stringify(obj));if(forms.includes('z')&&global.CompressionStream){try{return {enc:'z',bytes:await pipe(json,new global.CompressionStream('deflate-raw'))}}catch{}}return {enc:'j',bytes:json}}
async function readSheet(d){
 const plain=await openBytes(d);if(!plain)return null;
 if(d.enc!=='z'&&d.enc!=='j')return {character:JSON.parse(td.decode(plain)),dev:'',who:''};
 const x=JSON.parse(td.decode(d.enc==='z'?await inflate(plain,SHEET_UNPACKED):plain));
 return x&&typeof x==='object'?{character:x.character,dev:typeof x.dev==='string'&&/^[0-9a-f]{16}$/.test(x.dev)?x.dev:'',who:clip(typeof x.who==='string'?x.who:'',40)}:null;
}
// The member id changes on every join; this random id stays on the device, so a sheet sent again (after a rejoin too) updates the GM's copy instead of adding another.
function deviceId(){if(device)return device;try{const v=global.localStorage.getItem(DEVICE_KEY);if(/^[0-9a-f]{16}$/.test(v||''))return device=v}catch{}device=hex(rand(8));try{global.localStorage.setItem(DEVICE_KEY,device)}catch{}return device}
const sheetSource=x=>(x.dev?'room-dev:'+x.dev:'room:'+x.from)+':'+clip(x.character?.id,60);
async function sheetPacket(id,m,copy,ref){
 if(!m.sheets)return {enc:'',bytes:await envelope('e','sheet',{to:id,...await sealFor(m.pub,copy)})};
 const {enc,bytes}=await packSheet({who:clip(session.name,40),dev:deviceId(),character:copy},m.sheets);
 return {enc,bytes:await envelope('e','sheet',{to:id,enc,ref,...await sealFor(m.pub,bytes)})};
}
const SHEET_ICON={waiting:'⏳',sent:'✓',received:'✓',accepted:'✓',timeout:'⚠',big:'⚠',failed:'⚠'};
function sheetText(s){const kb=n=>Math.ceil(n/1024);return s?({waiting:t('sheetWaiting'),sent:t('sheetSentOld'),received:t('sheetGot').replace('{name}',s.name||'—'),accepted:`${t('sheetAccepted')}: ${s.name||'—'}`,timeout:t('sheetNoReply'),big:t(s.why==='gm'?'sheetTooBigGM':s.why==='here'?'sheetTooBigHere':'sheetTooBig').replace('{size}',kb(s.size)).replace('{max}',Math.floor(MAX_BYTES/1024)),failed:t('noNetwork')})[s.state]||'':''}
async function sendSheet(){
 const st=app?.getState?.(),c=st?.characters?.find(x=>x.id===session?.characterId);if(!c)return;
 const gms=[...members.entries()].filter(([,m])=>m.role==='gm'&&!m.me&&m.pub);
 if(!gms.length){app?.notify?.(t('noGMKey'));return}
 // Receivers drop packets over MAX_BYTES, so the final encrypted size is checked, not the JSON length.
 const copy=sheetCopy(c),ref=hex(rand(8)),to=new Map();let sent=0,confirms=0,big=0,why='';
 for(const [id,m] of gms){
  let p;try{p=await sheetPacket(id,m,copy,ref)}catch{continue}
  // A refusal says why: too big even compressed, or not compressed because the GM's page cannot read it ('gm') or this browser cannot write it ('here').
  if(p.bytes.length>MAX_BYTES){if(!big||p.enc==='z'){big=p.bytes.length;why=p.enc==='z'?'':m.sheets.includes('z')?'here':'gm'}continue}
  if(transport?.publish('e',p.bytes,false)){sent++;to.set(id,!!m.sheets);if(m.sheets)confirms++}
 }
 // Newer GM pages confirm receipt at once; older ones only when they accept the sheet.
 clearTimeout(sheetTimer);sheetState={state:sent?(confirms?'waiting':'sent'):big?'big':'failed',ref,to,char:c.id,name:clip(c.name,60),size:big,why};
 if(sheetState.state==='waiting')sheetTimer=setTimeout(()=>{if(session&&sheetState?.ref===ref&&sheetState.state==='waiting'){sheetState={...sheetState,state:'timeout'};app?.notify?.(sheetText(sheetState));refresh()}},SHEET_WAIT);
 app?.notify?.(sheetText(sheetState));
}
// A receipt moves the status only when it comes from a GM this sheet went to and carries the reference sent along. A GM page too old
// to be given one sends none back, and answers only when it accepts the sheet.
function sheetReply(state,ref,from){
 const s=sheetState;if(!s||!s.to?.has(from)||(s.to.get(from)?ref!==s.ref:!!ref||state!=='accepted')||!['waiting','sent','timeout','received'].includes(s.state)||state===s.state)return false;
 clearTimeout(sheetTimer);sheetState={...s,state};refresh();return true;
}
// Whether accepting replaces a sheet this player sent before («Обновить») or adds one, possibly after a question («Принять»).
function sheetKnown(x,chars){const src=sheetSource(x);try{const find=global.App?.findImport;return find?find(x.character,{sourceKey:src})?.by==='source':chars.some(c=>c?.extra?.sourceKey===src)}catch{return false}}
// Why a sheet was not saved, in words the GM can act on. It stays in the list while accepting it again can still work.
const SHEET_FAIL={storage:'sheetNoRoom',paused:'sheetPaused',missing:'sheetGone',too_big:'sheetBig'},SHEET_RETRY=['storage','paused','missing'];
async function acceptSheet(i){
 const item=incoming[i],App=global.App;if(!item||item.busy||!App?.importCharacter)return;
 const c=item.character,src=sheetSource(item);let res;item.busy=true;
 try{
  const match=App.findImport?.(c,{sourceKey:src})||null,ask=global.ShareLink;
  // A sheet this player sent before is updated in place. When the GM's copy was edited later, or the same character got here another
  // way (a link, a file, the GM's own sheet), the GM chooses: update it, keep both, or leave the sheet in the list.
  if(match&&ask?.offer&&(match.by!=='source'||ask.compare?.(c,match)==='local'))res=await ask.offer(c,{kind:'room',sourceKey:src});
  else res=App.importCharacter(c,match?{sourceKey:src,replace:match.id,rebind:true}:{sourceKey:src});
 }catch{res={ok:false,reason:'invalid'}}
 item.busy=false;
 if(!res){refresh();return}
 if(!res.ok){if(!SHEET_RETRY.includes(res.reason))incoming=incoming.filter(x=>x!==item);app?.notify?.(t(SHEET_FAIL[res.reason]||'sheetBad'));refresh();return}
 let added=false;const st=app?.getState?.(),camp=session?.campaignId?st?.campaigns?.find(c=>c.id===session.campaignId):null;
 if(camp&&Array.isArray(camp.roster)&&!camp.roster.some(r=>r.kind==='pc'&&r.characterId===res.id)){camp.roster.push({id:'r'+hex(rand(6)),kind:'pc',characterId:res.id,initiative:0,order:Date.now()});global.App?.save?.();added=true}
 send('e','sheet-ack',{to:item.from,name:clip(item.character.name,60),...(item.ref?{ref:item.ref}:{})},false);
 item.saved=res.id;app?.notify?.(`${t(res.how==='copy'?'sheetCopied':res.updated?'sheetUpdated':'sheetSaved')}: ${clip(c.name,60)||'—'}${added?' '+t('addedRoster'):''}${res.kept?'. '+t('sheetKept'):''}`);
 global.App?.render?.();
}
function normalizeCode(raw){const s=String(raw||'').toUpperCase().replace(/[^A-Z0-9]/g,'');return s.length===12&&[...s].every(ch=>ALPHABET.includes(ch))?s:null}
function formatCode(c){return c?c.slice(0,4)+'-'+c.slice(4,8)+'-'+c.slice(8):''}
function newCode(){const n=ALPHABET.length,limit=256-256%n,out=[];while(out.length<12)for(const b of rand(16)){if(b<limit&&out.length<12)out.push(ALPHABET[b%n])}return out.join('')}
// A link also names the Game Master's key, so whoever opens it accepts only that Game Master.
function roomLink(code){const loc=global.location,pin=session&&session.code===code&&FP.test(session.gmFp||'')?'.'+session.gmFp:'';return loc.origin+loc.pathname+'#/room/'+formatCode(code)+pin}
// An invitation typed or pasted by hand: a room code, a code with the key after a dot, or the whole link.
function parseInvite(raw){const text=String(raw||'').trim().replace(/^.*#\/room\//,''),m=/\.([0-9a-f]{24})$/.exec(text),code=normalizeCode(m?text.slice(0,m.index):text);return code?{code,pin:m?m[1]:''}:null}

async function deriveRoom(code){
 const subtle=global.crypto?.subtle;if(!subtle)throw Error('no_crypto');
 // One slow derivation yields both the key and the topic, so the public topic name does not make guessing the code any cheaper.
 const material=await subtle.importKey('raw',te.encode(code),'PBKDF2',false,['deriveBits']);
 const bits=new Uint8Array(await subtle.deriveBits({name:'PBKDF2',salt:te.encode('ncred-room-v2'),iterations:150000,hash:'SHA-256'},material,384));
 const aes=await subtle.importKey('raw',bits.slice(0,32),{name:'AES-GCM'},false,['encrypt','decrypt']);
 return {topic:'ncred/v2/'+hex(bits.slice(32,44)),key:aes};
}
async function sealText(text,k=key){const iv=rand(12),ct=new Uint8Array(await global.crypto.subtle.encrypt({name:'AES-GCM',iv},k,te.encode(text)));const out=new Uint8Array(12+ct.length);out.set(iv);out.set(ct,12);return out}
const seal=obj=>sealText(JSON.stringify(obj));
// Messages are padded to a few fixed sizes, so the length on the wire does not tell a roll from a status or a sheet.
const PAD=[512,1024,2048,4096,8192,16384];
function padded(text){const n=te.encode(text).length,size=PAD.find(x=>x>=n)||Math.ceil(n/16384)*16384;return text+' '.repeat(size-n)}
async function open(bytes){if(bytes.length<29||bytes.length>MAX_BYTES)return null;const plain=await global.crypto.subtle.decrypt({name:'AES-GCM',iv:bytes.subarray(0,12)},key,bytes.subarray(12));return JSON.parse(td.decode(plain))}

function loadSession(){try{const s=JSON.parse(global.localStorage.getItem(SESSION_KEY)||'null');if(s&&normalizeCode(s.code)&&['gm','player'].includes(s.role)&&typeof s.memberId==='string')return s}catch{}return null}
function saveSession(){try{session?global.localStorage.setItem(SESSION_KEY,JSON.stringify(session)):global.localStorage.removeItem(SESSION_KEY)}catch{}}
function brokers(){try{const b=JSON.parse(global.localStorage.getItem(BROKERS_KEY)||'null');if(Array.isArray(b)&&b.length&&b.every(x=>x&&typeof x.url==='string'&&/^wss?:\/\//.test(x.url)))return b}catch{}return null}

/* ---------- What we share ---------- */
function characterSummary(c){
 if(!c||typeof c!=='object')return null;
 const st=c.stats||{},max=10+5*Math.ceil((int(st.BODY,0,20)+int(st.WILL,0,20))/2),hp=int(c.hp);
 const luckMax=int(st.LUCK,0,20),luck=c.extra&&c.extra.luck!==undefined&&c.extra.luck!==''?int(c.extra.luck,0,20):luckMax;
 return {name:clip(c.name,60),role:clip(c.role,20),rank:int(c.rank,0,10),hp,max,humanity:int(c.humanity,-99,200),luck,luckMax,head:int(c.head,0,99),body:int(c.bodyArmor,0,99),ref:int(st.REF,0,20),dex:int(st.DEX,0,20),rep:int(c.extra?.reputation,0,10)};
}
// Everything received from other devices is untrusted: rebuild it from known fields only.
function cleanSummary(x){
 if(!x||typeof x!=='object'||Array.isArray(x))return null;
 return {name:clip(x.name,60),role:clip(x.role,20),rank:int(x.rank,0,10),hp:int(x.hp),max:Math.max(1,int(x.max,1,999)),humanity:int(x.humanity,-99,200),luck:int(x.luck,0,20),luckMax:int(x.luckMax,0,20),head:int(x.head,0,99),body:int(x.body,0,99),ref:int(x.ref,0,20),dex:int(x.dex,0,20),rep:int(x.rep,0,10)};
}
function memberPayload(){
 const st=app?.getState?.();const c=session.characterId?st?.characters?.find(x=>x.id===session.characterId):null;
 const thumb=session.sharePortrait!==false?(global.Portrait?.thumb?.(c)||''):'';return {name:clip(session.name,40),role:session.role,dev:deviceId(),cid:clip(c?c.id:'',60),character:characterSummary(c),...(thumb?{portrait:thumb}:{}),...(session.role==='gm'&&gmPub?{pub:gmPub,sheets:readsSheets()}:{})};
}
// «device:character» for a sheet that came to the GM through the room: it lets that player's page know which row is theirs.
const OWN=/^[0-9a-f]{16}:.{1,60}$/;
function ownerOf(c){const m=/^room-dev:([0-9a-f]{16}):(.{1,60})$/.exec(typeof c?.extra?.sourceKey==='string'?c.extra.sourceKey:'');return m?m[1]+':'+m[2]:''}
function isMine(r){
 if(!r||!r.pc||!session?.characterId)return false;
 if(r.own)return r.own===deviceId()+':'+session.characterId;
 const mine=app?.getState?.()?.characters?.find(c=>c.id===session.characterId)?.name;return !!mine&&!!r.name&&r.name.trim().toLowerCase()===String(mine).trim().toLowerCase();
}
const myTurn=state=>!!state&&state.order.some(r=>r.current&&isMine(r));
// The player whose sheet a GM-side character is, if they are in the room now: their live HP for the tracker.
function liveFor(c){
 if(!session||session.role!=='gm')return null;const own=ownerOf(c);if(!own)return null;
 for(const m of members.values())if(!m.me&&m.dev&&m.cid&&own===m.dev+':'+m.cid&&m.character&&isOnline(m))return {hp:m.character.hp,max:m.character.max};
 return null;
}
// A player rolled initiative on their sheet: put it on their row in the campaign this room is linked to.
function applyInitiative(from,cid,total){
 if(session?.role!=='gm'||!session.campaignId||!cid)return;
 const st=app?.getState?.(),camp=st?.campaigns?.find(x=>x.id===session.campaignId),dev=members.get(from)?.dev;if(!camp||!dev||!Array.isArray(camp.roster))return;
 const key='room-dev:'+dev+':'+cid,pc=st.characters?.find(c=>c?.extra?.sourceKey===key),row=pc&&camp.roster.find(r=>r.kind==='pc'&&r.characterId===pc.id);if(!row)return;
 const order=list=>[...list].sort((a,b)=>(Number(b.initiative)||0)-(Number(a.initiative)||0)||(Number(a.order)||0)-(Number(b.order)||0)),active=order(camp.roster)[int(camp.turnIndex,0,500)];
 row.initiative=int(total,-99,999);row.ties=[];
 if(active){const i=order(camp.roster).indexOf(active);if(i>=0)camp.turnIndex=i}
 try{global.App?.save?.()}catch{}
 app?.notify?.(`${t('initSet')}: ${clip(pc.name,60)||'—'} — ${row.initiative}`);
 if(st.view==='campaigns')try{global.App?.render?.()}catch{}
 publishCombat();
}
function paintLive(){const st=app?.getState?.();for(const el of doc.querySelectorAll?.('[data-camp-live]')||[]){const c=st?.characters?.find(x=>x.id===el.dataset.campLive);el.textContent=c?global.Room.liveText(c):''}}
function combatPayload(){
 if(session.role!=='gm'||!session.campaignId)return null;
 const st=app?.getState?.(),camp=st?.campaigns?.find(x=>x.id===session.campaignId);if(!camp)return null;
 const roster=[...(camp.roster||[])].sort((a,b)=>{let n=(Number(b.initiative)||0)-(Number(a.initiative)||0);if(n)return n;const x=a.ties||[],y=b.ties||[];for(let i=0;i<Math.max(x.length,y.length);i++){n=(Number(y[i])||0)-(Number(x[i])||0);if(n)return n}return (Number(a.order)||0)-(Number(b.order)||0)});
 const turn=int(camp.turnIndex,0,500),shown=roster.map((r,i)=>({r,now:i===turn})).filter(x=>x.r.hidden!==true||x.r.kind==='pc');
 // A row whose character was deleted keeps a visible name for older pages; newer ones read 'none' and show «без персонажа».
 // Hidden participants are not sent at all; when one of them acts, players only learn that somebody hidden does.
 return {campaign:clip(camp.name,80),round:int(camp.round||1,1,9999),...(roster[turn]&&!shown.some(x=>x.now)?{veiled:true}:{}),order:shown.slice(0,40).map(({r,now})=>{const pc=r.kind==='pc',c=pc&&st.characters?.find(x=>x.id===r.characterId),own=pc&&c?ownerOf(c):'';return {name:clip(pc?c?.name||'—':r.name,60),pc,...(pc&&!c?{none:true}:{}),...(own?{own}:{}),init:int(r.initiative),current:now}}),...(global.BattleMap?.sharedPart?.(camp,shown.map(x=>x.r))||{})};
}

function cleanClocks(list){return Array.isArray(list)?list.slice(0,12).filter(x=>x&&typeof x==='object').map(x=>{const size=int(x.size,2,12);return {name:clip(x.name,60),size,filled:int(x.filled,0,size)}}):[]}
function clocksPayload(){if(session?.role!=='gm')return [];try{return cleanClocks(global.GMExtras?.sharedClocks?.(app?.getState?.()))}catch{return []}}

/* ---------- Networking ---------- */
// On the wire: {v, b, s} sealed with the room key. b is the message as text, s the sender's signature over the room, the subtopic and b.
async function signedEnvelope(who,from,room,k,sub,type,data,at,id){
 const body=JSON.stringify({id,from,t:type,at,d:data,pk:who.pub}),sig=new Uint8Array(await global.crypto.subtle.sign(SIGN_HASH,who.privateKey,signedText(room,sub,body)));
 return sealText(padded(JSON.stringify({v:PROTOCOL,b:body,s:b64(sig)})),k);
}
// The room key, topic and sender are taken at the moment of the call: signing is asynchronous, and leaving a room clears them at once.
function envelope(sub,type,data,at=Date.now(),id=hex(rand(8))){const k=key,room=base,from=session.memberId;return ensureIdentity().then(me=>signedEnvelope(me,from,room,k,sub,type,data,at,id))}
async function send(sub,type,data,retain=false,via=transport,at=Date.now(),id=hex(rand(8))){
 if(!via||!key||!session)return 0;
 // Receivers drop anything over MAX_BYTES, so it is not sent at all.
 try{const bytes=await envelope(sub,type,data,at,id);return bytes.length>MAX_BYTES?0:via.publish(sub,bytes,retain)}catch{return 0}
}
function publishMember(force=false){if(!session)return;const d=memberPayload(),s=JSON.stringify(d);if(!force&&s===lastMember)return;lastMember=s;self(d);send('m/'+session.memberId,'member',d,true)}
function publishCombat(force=false){
 if(!session||session.role!=='gm')return;const d=combatPayload(),s=JSON.stringify(d);if(!force&&s===lastCombat)return;lastCombat=s;
 const at=Date.now();combatAt=at;
 if(d){combat={...d,from:session.memberId,at};send('c','combat',d,true,transport,at)}
 else{combat=null;send('c','cleared',{},true,transport,at)}
 refresh();
}
function publishClocks(force=false){
 if(!session||session.role!=='gm')return;global.RoomJournal?.publish?.(force);const d=clocksPayload(),s=JSON.stringify(d);if(!force&&s===lastClocks)return;lastClocks=s;clocks=d;
 const at=Date.now();clocksAt=at;
 if(d.length)send('k','clocks',{list:d},true,transport,at);else send('k','cleared',{},true,transport,at);
 refresh();
}
// When the room is full a newcomer replaces someone who went quiet, or else someone who came without a character; never the Game Master.
function evictOne(){let oldest=null;for(const [id,m] of members)if(!m.me&&m.role!=='gm'&&Date.now()-m.at>ONLINE_FOR&&(!oldest||m.at<oldest[1].at))oldest=[id,m];if(!oldest)for(const [id,m] of members)if(!m.me&&m.role!=='gm'&&!m.character&&(!oldest||m.sentAt<oldest[1].sentAt))oldest=[id,m];if(!oldest)return false;members.delete(oldest[0]);return true}
// Online: heard from lately, and not reported gone by a broker (a connection that dropped) without a newer status since.
const isOnline=m=>!!m&&(m.me||(Date.now()-m.at<ONLINE_FOR&&!(m.suspectAt&&Date.now()-m.suspectAt>GONE_GRACE&&m.at<=m.suspectAt)));
// Many messages in one frame repaint once.
function repaint(){if(paintQueued)return;paintQueued=true;const run=()=>{paintQueued=false;refresh()};(global.requestAnimationFrame||(f=>setTimeout(f,16)))(run)}
function prune(){let changed=false;for(const [id,m] of members)if(!m.me&&Date.now()-m.at>FORGET_AFTER){members.delete(id);changed=true}return changed}
async function flushOutbox(){
 if(!outbox.length||!transport)return;
 const queue=outbox;outbox=[];
 // Each queued roll goes out twice with the same id (now and on the next heartbeat) so a peer that reconnects a bit later still gets it; duplicates are dropped by id.
 for(const item of queue){const sent=await send('e','roll',{...item.payload,made:item.at},false,transport,Date.now(),item.id);if(sent){item.feed.pending=false;item.tries=(item.tries||0)+1}if(!sent||item.tries<2)outbox.push(item)}
 refresh();
}
function self(d){members.set(session.memberId,{...d,fp:session.memberId.slice(0,24),portrait:global.Portrait?.valid?.(d.portrait,16000)?d.portrait:'',at:Date.now(),me:true});refresh()}
const seen=new Set();
async function receive(p){
 const sub=p.topic.slice(base.length+1);
 // Empty retained messages carry no key, so anyone on a public broker could send one: ignore them.
 if(!p.payload.length||!underCap())return;
 let outer;try{outer=await open(p.payload)}catch{return}
 if(!session)return;
 // A page that has not been updated yet speaks the previous protocol: say so instead of staying silent. Only live traffic counts:
 // a copy a broker kept from before the update says nothing about who is in the room now.
 if(outer&&outer.v===2&&typeof outer.from==='string'){if(!p.retain&&Date.now()-oldSeen>120000){oldSeen=Date.now();app?.notify?.(t('oldVersion'));repaint()}return}
 if(!outer||outer.v!==PROTOCOL||typeof outer.b!=='string'||typeof outer.s!=='string')return;
 let m;try{m=JSON.parse(outer.b)}catch{return}
 if(!m||typeof m.id!=='string'||m.id.length>32||seen.has(m.id)||typeof m.from!=='string'||!MEMBER_ID.test(m.from)||!m.d||typeof m.d!=='object'||Array.isArray(m.d)||!isCoord(m.pk?.x)||!isCoord(m.pk?.y))return;
 const fp=m.from.slice(0,24);
 if(muted.has(fp))return;
 // The sender's id must be the fingerprint of the key that signed this very text for this room and subtopic.
 try{if(await fingerprint(m.pk)!==fp||!await global.crypto.subtle.verify(SIGN_HASH,await verifyKey(m.pk),unb64(outer.s),signedText(base,sub,outer.b)))return}catch{return}
 if(!session||seen.has(m.id))return;
 seen.add(m.id);if(seen.size>2000)seen.clear();
 // A broker reports this page gone when one of its connections drops: answer at once that it is still here.
 if(m.from===session.memberId){if(m.t==='gone')publishMember(true);return}
 if(!allowed(fp))return;
 const rawAt=int(m.at,0,Number.MAX_SAFE_INTEGER),at=Math.min(rawAt,Date.now()),when=p.retain?at:Date.now();
 // Only the Game Master this page trusts can set the initiative and the clocks or answer about a sheet; events must be recent.
 const fromGM=!!session.gmFp&&fp===session.gmFp,fresh=Math.abs(Date.now()-rawAt)<=EVENT_WINDOW;
 if(m.t==='left'&&sub==='m/'+m.from){const prev=members.get(m.from);if(prev&&prev.sentAt>at)return;if(members.delete(m.from))repaint();return}
 if(m.t==='gone'&&sub==='m/'+m.from){const known=members.get(m.from);if(known&&rawAt>(known.goneMark||0)){known.goneMark=rawAt;known.suspectAt=Date.now();setTimeout(repaint,GONE_GRACE+200)}return}
 if(m.t==='member'&&sub==='m/'+m.from){
  if(Date.now()-at>FORGET_AFTER)return;
  const prev=members.get(m.from);if(prev&&prev.sentAt>at)return; // an older retained copy must not overwrite a newer status
  const d=m.d,claims=d.role==='gm';
  // A player who joined by code alone remembers the first Game Master met; a link names the key in advance.
  if(claims&&!session.gmFp&&session.role==='player'){session.gmFp=fp;session.gmPin='first';saveSession();app?.notify?.(t('gmFirst').replace('{name}',clip(d.name,40)||'?').replace('{key}',keyLabel(fp)))}
  const role=claims&&fp===session.gmFp?'gm':'player';
  if(!prev&&members.size>=MAX_MEMBERS&&!evictOne())return;
  if(outbox.length&&!p.retain)flushOutbox(); // someone (re)connected: give them the rolls made while offline
  if(session.role==='gm')setTimeout(paintLive,0);
  members.set(m.from,{sentAt:at,fp,goneMark:prev?.goneMark||0,name:clip(d.name,40)||'?',role,impostor:claims&&role!=='gm',dev:typeof d.dev==='string'&&/^[0-9a-f]{16}$/.test(d.dev)?d.dev:'',cid:clip(d.cid,60),character:cleanSummary(d.character),portrait:global.Portrait?.valid?.(d.portrait,16000)?d.portrait:'',pub:role==='gm'&&isCoord(d.pub?.x)&&isCoord(d.pub?.y)?{x:d.pub.x,y:d.pub.y}:null,sheets:role==='gm'&&typeof d.sheets==='string'?d.sheets.replace(/[^zj]/g,'').slice(0,4):'',at:when});
  repaint();
 }else if((m.t==='combat'||m.t==='cleared')&&sub==='c'){
  if(!fromGM||at<combatAt||Date.now()-at>STATE_TTL)return;
  combatAt=at;if(m.t==='cleared'){combat=null;repaint();return}
  const d=m.d;if(!Array.isArray(d.order))return;
  const was=myTurn(combat);
  combat={campaign:clip(d.campaign,80),round:int(d.round,1,9999),veiled:d.veiled===true,order:d.order.slice(0,40).map(r=>({name:clip(r?.name,60),pc:!!r?.pc,none:!!(r?.pc&&r?.none),own:typeof r?.own==='string'&&OWN.test(r.own)?r.own:'',init:int(r?.init),current:!!r?.current})),map:global.BattleMap?.cleanShared?.(d.map,Math.min(d.order.length,40))||null,from:m.from,at:when};
  // The turn has just come to this player's character: say so, even when the room page is not the one open.
  if(!was&&myTurn(combat)&&!p.retain){if(session.toasts!==false)toast({total:'▶',who:t('yourTurn'),label:t('yourTurnHint'),kind:'turn'});try{if(global.localStorage?.getItem('nc-haptics')!=='off')global.navigator?.vibrate?.([120,80,120])}catch{}}
  repaint();
 }else if((m.t==='clocks'||m.t==='cleared')&&sub==='k'){
  if(!fromGM||at<clocksAt||Date.now()-at>STATE_TTL)return;
  clocksAt=at;clocks=m.t==='cleared'?[]:cleanClocks(m.d.list);repaint();
 }else if(m.t==='journal'&&sub==='j'){
  if(fromGM&&global.RoomJournal?.receive?.(m.d,at,p.retain))repaint();
 }else if(m.t==='sheet'&&sub==='e'){
  if(session.role!=='gm'||m.d.to!==session.memberId||!fresh)return;
  let got=null;try{got=await readSheet(m.d)}catch{return}
  // Only something shaped like a sheet is listed: the list is drawn from its name and role.
  const c=got?.character;if(!c||typeof c!=='object'||Array.isArray(c)||typeof c.name!=='string'||typeof c.role!=='string')return;
  const ref=typeof m.d.ref==='string'?m.d.ref.slice(0,40):'',item={from:m.from,dev:got.dev,who:members.get(m.from)?.name||got.who||'—',character:c,ref,at:Date.now()},src=sheetSource(item),note=`${item.who} ${t('sheetReceived')}: ${clip(c.name,60)||'—'}`;
  incoming=[item,...incoming.filter(x=>sheetSource(x)!==src)].slice(0,10);
  if(ref)send('e','sheet-got',{to:m.from,ref},false); // tells the player it arrived; 'sheet-ack' follows on accept
  app?.notify?.(note);repaint();
 }else if(m.t==='sheet-got'&&sub==='e'){
  if(fromGM&&m.d.to===session.memberId&&sheetReply('received',typeof m.d.ref==='string'?m.d.ref:'',m.from))app?.notify?.(sheetText(sheetState));
 }else if(m.t==='sheet-ack'&&sub==='e'){
  if(m.d.to!==session.memberId||!fromGM)return;
  // An answer to an earlier sheet (another character, or one sent before this page was reloaded) still gets a word when a GM gives it.
  if(sheetReply('accepted',typeof m.d.ref==='string'?m.d.ref:'',m.from))app?.notify?.(sheetText(sheetState));
  else if(session.role!=='gm'&&sheetState?.state!=='accepted')app?.notify?.(`${t('sheetAccepted')}: ${clip(m.d.name,60)||'—'}`);
 }else if(m.t==='roll'&&sub==='e'){
  if(!fresh)return;
  const d=m.d;if(d.init===true&&session.role==='gm')applyInitiative(m.from,clip(d.cid,60),d.total);
  const item={who:members.get(m.from)?.name||clip(d.who,40),character:clip(d.character,60),label:clip(d.label,80),detail:clip(d.detail,200),total:int(d.total,-999,9999),crit:['crit','fumble'].includes(d.crit)?d.crit:'',at:Date.now(),mine:false};
  feed.unshift(item);feed=feed.slice(0,MAX_FEED);repaint();
  if(session.toasts!==false)toast(item);
  const known=members.get(m.from);if(known){known.at=Date.now()}
 }
}
// The message a broker sends for this page when its connection drops without a goodbye (MQTT Last Will). It is signed like any other.
async function prepareWill(){if(!session||!key)return;try{willBytes=await envelope('m/'+session.memberId,'gone',{})}catch{willBytes=null}}
async function connect(){
 if(!session)return;
 disconnect(false);
 try{
  ({topic:base,key}=await deriveRoom(session.code));if(session.role==='gm')await ensureGMKeys();
  const me=await ensureIdentity();
  // A session saved by an earlier version, or by another browser profile, gets an id that belongs to this device's key.
  if(!session.memberId.startsWith(me.fp+'.'))session.memberId=me.fp+'.'+hex(rand(4));
  if(session.role==='gm'){session.gmFp=me.fp;session.gmPin='self'}else if(!FP.test(session.gmFp||'')){session.gmFp='';session.gmPin=''}
  muted.clear();for(const f of Array.isArray(session.muted)?session.muted:[])if(FP.test(f))muted.add(f);
  saveSession();await prepareWill();
 }catch{app?.notify?.(t('unsupported'));session=null;saveSession();refresh();return}
 members=new Map();combat=null;clocks=[];feed=[];outbox=[];clearTimeout(sheetTimer);sheetState=null;lastMember='';lastCombat='';lastClocks='';combatAt=0;clocksAt=0;connectedAt=Date.now();setTimeout(refresh,NO_GM_HINT+500);
 transport=global.RoomTransport.create({topic:base,brokers:brokers(),will:()=>willBytes&&session?{subtopic:'m/'+session.memberId,payload:willBytes}:null,onMessage:p=>{receive(p)},onStatus:s=>{const was=netStatus.online;netStatus=s;if(s.online>was){publishMember(true);publishCombat(true);publishClocks(true);flushOutbox()}refresh()}});
 publishMember(true);publishCombat(true);publishClocks(true);
 heartbeat=setInterval(()=>{publishMember(true);if(session?.role==='gm'){publishCombat(true);publishClocks(true)}prune();flushOutbox();prepareWill();refresh()},HEARTBEAT);
 refresh();
}
function disconnect(clear=true){
 clearInterval(heartbeat);heartbeat=null;willBytes=null;
 const tr=transport,k=key,who=session;transport=null;
 if(tr&&clear&&who&&k){
  const markers=[send('m/'+who.memberId,'left',{},true,tr)];
  if(who.role==='gm')markers.push(send('c','cleared',{},true,tr),send('k','cleared',{},true,tr));
  Promise.allSettled(markers).then(()=>setTimeout(()=>tr.close(),300));
 }else if(tr)tr.close();
 key=null;
}

/* ---------- UI ---------- */
function toast(item){
 let box=doc.querySelector('.room-toasts');if(!box){box=doc.createElement('div');box.className='room-toasts';box.setAttribute('aria-live','polite');doc.body.appendChild(box)}
 const el=doc.createElement('div');el.className='room-toast '+(item.crit||item.kind||'');
 el.innerHTML=`<b>${esc(item.total)}</b><span><strong>${esc(item.who)}${item.character?' · '+esc(item.character):''}</strong>${esc(item.label)}${item.crit?` · ${esc(t(item.crit))}`:''}</span>`;
 box.prepend(el);while(box.children.length>3)box.lastChild.remove();
 setTimeout(()=>{el.classList.add('out');setTimeout(()=>el.remove(),400)},5200);
}
// A segmented progress clock as inline SVG (numbers only, no user text inside).
function clockSvg(size,filled){
 const r=26,c=30,parts=[];
 for(let i=0;i<size;i++){const a0=(i/size)*2*Math.PI-Math.PI/2,a1=((i+1)/size)*2*Math.PI-Math.PI/2,x0=c+r*Math.cos(a0),y0=c+r*Math.sin(a0),x1=c+r*Math.cos(a1),y1=c+r*Math.sin(a1);parts.push(`<path d="M${c},${c} L${x0.toFixed(2)},${y0.toFixed(2)} A${r},${r} 0 0 1 ${x1.toFixed(2)},${y1.toFixed(2)} Z" class="${i<filled?'on':''}"/>`)}
 return `<svg class="room-clock-svg" viewBox="0 0 60 60" aria-hidden="true">${parts.join('')}</svg>`;
}
function roleName(id){const r=global.ROLES?.find?.(x=>x.id===id);return r?.name?.[lang()]||id||''}
function woundOf(c){return c.hp<1?'mortal':c.hp<Math.ceil(c.max/2)?'serious':c.hp<c.max?'light':'full'}
function presence(m){if(m.me)return `<span class="room-dot on"></span>${esc(t('you'))}`;const age=Date.now()-m.at;return isOnline(m)?`<span class="room-dot on"></span>${esc(t('online'))}`:`<span class="room-dot"></span>${esc(t('offline'))} · ${Math.max(1,Math.round(age/60000))} ${esc(t('ago'))}`}
function memberCard(id,m){
 const c=m.character;
 const head=`<div class="room-member-head">${m.portrait&&global.Portrait?.valid?.(m.portrait,16000)?`<img class="room-avatar" src="${m.portrait}" alt="">`:''}<strong>${esc(m.name)}</strong>${m.role==='gm'?`<span class="room-badge">${esc(t('gmBadge'))}</span>`:''}${m.impostor?`<span class="room-badge warn">${esc(t('impostor'))}</span>`:''}<small>${presence(m)}</small>${!m.me&&m.role!=='gm'&&FP.test(m.fp||'')?`<button type="button" class="room-mute" data-room-action="mute" data-fp="${esc(m.fp)}" title="${esc(t('muteTitle'))}">${esc(t('mute'))}</button>`:''}</div>`;
 if(!c)return `<article class="room-member ${m.me?'me':''}">${head}<p class="room-muted">${esc(t('noChar'))}</p></article>`;
 const pct=Math.max(0,Math.min(100,Math.round(c.hp/Math.max(1,c.max)*100))),w=woundOf(c);
 return `<article class="room-member ${m.me?'me':''}" data-wound="${w}">${head}<div class="room-char"><b>${esc(c.name||'—')}</b><span>${esc(roleName(c.role))}${c.rank?` · ${c.rank}`:''}</span></div><div class="room-hp"><div class="room-hp-bar"><i style="width:${pct}%"></i></div><span>${esc(t('hp'))} <b>${c.hp}</b> / ${c.max}</span></div><dl class="room-stats"><div><dt>${esc(t('hum'))}</dt><dd>${c.humanity}</dd></div><div><dt>${esc(t('luck'))}</dt><dd>${c.luck}/${c.luckMax}</dd></div><div><dt>${esc(t('sp'))}</dt><dd>${c.head} / ${c.body}</dd></div><div><dt>REF</dt><dd>${c.ref}</dd></div>${c.rep?`<div><dt>REP</dt><dd>${c.rep}</dd></div>`:''}</dl></article>`;
}
function joinForms(){
 const st=app?.getState?.()||{},chars=st.characters||[],camps=st.campaigns||[],prev=session||loadSession()||{},code=pendingCode?formatCode(pendingCode):'';
 const charSelect=`<select id="room-character">${`<option value="">${esc(t('noCharacter'))}</option>`}${chars.map(c=>`<option value="${esc(c.id)}" ${prev.characterId===c.id?'selected':''}>${esc(c.name||'—')} · ${esc(roleName(c.role))}</option>`).join('')}</select>`;
 const nameVal=esc(prev.name||'');
 return `<div class="room-join-grid">${code?'':`<section class="card room-join"><div class="card-heading"><span>${esc(t('gm'))}</span><span>GM</span></div><p>${esc(t('gmLead'))}</p><label class="field">${esc(t('name'))}<input id="room-gm-name" maxlength="40" placeholder="${esc(t('namePh'))}" value="${nameVal}"></label><label class="field">${esc(t('campaign'))}<select id="room-campaign"><option value="">${esc(t('noCampaign'))}</option>${camps.map(c=>`<option value="${esc(c.id)}">${esc(c.name||'—')}</option>`).join('')}</select></label><label class="field">${esc(t('character'))}${charSelect.replace('id="room-character"','id="room-gm-character"')}</label><button type="button" class="btn primary wide" data-room-action="create">＋ ${esc(t('create'))}</button></section>`}<section class="card room-join"><div class="card-heading"><span>${esc(t('player'))}</span><span>JOIN</span></div><p>${esc(t('playerLead'))}</p><label class="field">${esc(t('code'))}<input id="room-code" maxlength="120" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="${esc(t('codePh'))}" value="${esc(code)}"></label>${code&&pendingPin?`<p class="room-muted">${esc(t('pinNote'))}: <b>${esc(keyLabel(pendingPin))}</b></p>`:''}<label class="field">${esc(t('name'))}<input id="room-player-name" maxlength="40" placeholder="${esc(t('namePh'))}" value="${nameVal}"></label><label class="field">${esc(t('character'))}${charSelect}</label><button type="button" class="btn primary wide" data-room-action="join">→ ${esc(t('join'))}</button></section></div>`;
}
function roomView(){
 const st=app?.getState?.()||{},chars=st.characters||[],camps=st.campaigns||[];
 const list=[...members.entries()].filter(([,m])=>m.me||Date.now()-m.at<FORGET_AFTER).sort((a,b)=>(b[1].role==='gm')-(a[1].role==='gm')||(b[1].me?1:0)-(a[1].me?1:0)||a[1].name.localeCompare(b[1].name));
 const net=netStatus.total?`${netStatus.online} / ${netStatus.total}`:'…';
 const charSelect=`<select data-room-field="character"><option value="">${esc(t('noCharacter'))}</option>${chars.map(c=>`<option value="${esc(c.id)}" ${session.characterId===c.id?'selected':''}>${esc(c.name||'—')}</option>`).join('')}</select>`;
 const campSelect=session.role==='gm'?`<label class="field">${esc(t('campaign'))}<select data-room-field="campaign"><option value="">${esc(t('noCampaign'))}</option>${camps.map(c=>`<option value="${esc(c.id)}" ${session.campaignId===c.id?'selected':''}>${esc(c.name||'—')}</option>`).join('')}</select></label>`:'';
 const gms=list.filter(([,m])=>m.role==='gm').length,hasOtherGM=list.some(([,m])=>m.role==='gm'&&!m.me);
 const notes=`${pendingCode&&pendingCode!==session.code?`<div class="room-alert"><p>${esc(t('otherRoom'))}: <b>${esc(formatCode(pendingCode))}</b></p><div><button type="button" class="btn primary" data-room-action="switch">${esc(t('switchRoom'))}</button><button type="button" class="btn ghost" data-room-action="stay">${esc(t('stayRoom'))}</button></div></div>`:''}${session.role==='player'&&!hasOtherGM&&netStatus.online&&Date.now()-connectedAt>NO_GM_HINT?`<p class="room-alert soft">${esc(t('noGM'))}</p>`:''}${gms>1?`<p class="room-alert soft">${esc(t('twoGM'))}</p>`:''}${list.some(([,m])=>m.impostor)?`<p class="room-alert soft">${esc(t('impostorNote'))}</p>`:''}${Date.now()-oldSeen<120000?`<p class="room-alert soft">${esc(t('oldVersion'))}</p>`:''}`;
 return notes+`<div class="room-banner ${netStatus.online?'ok':'bad'}"><div><small>${esc(t('room'))}</small><strong class="room-code">${esc(formatCode(session.code))}</strong></div><div class="room-banner-actions"><button type="button" class="btn primary" data-room-action="copy">⧉ ${esc(t('copy'))}</button>${global.navigator?.share?`<button type="button" class="btn ghost" data-room-action="share">↗ ${esc(t('share'))}</button>`:''}<button type="button" class="btn ghost" data-room-action="qr" aria-expanded="${qrFor===session.code}">▦ QR</button><button type="button" class="btn ghost" data-room-action="leave">✕ ${esc(t('leave'))}</button></div>${qrFor===session.code&&qrMarkup?`<div class="room-qr">${qrMarkup}<small>${esc(lang()==='ru'?'Наведите камеру телефона, чтобы открыть комнату':'Point a phone camera here to open the room')}</small></div>`:''}${FP.test(session.gmFp||'')?`<p class="room-key">${esc(t(session.role==='gm'?'keyMine':session.gmPin==='link'?'keyLink':'keyFirst'))}: <b>${esc(keyLabel(session.gmFp))}</b></p>`:''}${muted.size?`<p class="room-key">${esc(t('mutedCount'))}: ${muted.size} <button type="button" class="room-mute" data-room-action="unmute-all">${esc(t('unmute'))}</button></p>`:''}<p class="room-net"><span class="room-dot ${netStatus.online?'on':''}"></span>${esc(t('servers'))}: ${net}${netStatus.total&&!netStatus.online?` — ${esc(t('noNetwork'))}`:''}</p></div>
 <section class="card room-me"><div class="card-heading"><span>${esc(t('you'))}: ${esc(session.name)} · ${esc(t(session.role==='gm'?'asGM':'asPlayer'))}</span><span>SETTINGS</span></div><div class="room-me-grid"><label class="field">${esc(t('character'))}${charSelect}</label>${campSelect}</div><label class="room-check"><input type="checkbox" data-room-field="broadcast" ${session.broadcastRolls!==false?'checked':''}> ${esc(t('broadcast'))}</label><label class="room-check"><input type="checkbox" data-room-field="toasts" ${session.toasts!==false?'checked':''}> ${esc(t('toasts'))}</label><label class="room-check"><input type="checkbox" data-room-field="portrait" ${session.sharePortrait!==false?'checked':''}> ${esc(t('sharePortrait'))}</label>${session.role==='player'&&session.characterId&&chars.some(c=>c.id===session.characterId)?`<div class="room-send"><button type="button" class="btn ghost" data-room-action="send-sheet" ${hasOtherGM?'':'disabled'}>📤 ${esc(t('sendSheet'))}</button><small>${esc(hasOtherGM?t('sendSheetHelp'):t('noGMKey'))}</small>${sheetState&&sheetState.char===session.characterId?`<p class="room-send-status" data-state="${sheetState.state}"><span aria-hidden="true">${SHEET_ICON[sheetState.state]||''}</span> ${esc(sheetText(sheetState))}</p>`:''}</div>`:''}</section>${session.role==='gm'&&incoming.length?`<section class="card room-incoming"><div class="card-heading"><span>${esc(t('incoming'))}</span><span data-nx>${incoming.length}</span></div><ul>${incoming.map((x,i)=>`<li><div><b>${esc(clip(x.character.name,60)||'—')}</b><small>${esc(t('fromPlayer'))} ${esc(x.who)}${x.character.role?` · ${esc(roleName(clip(x.character.role,20)))}`:''}</small></div><div>${x.saved&&chars.some(c=>c?.id===x.saved)?`<button type="button" class="btn ghost" data-room-action="open-sheet" data-id="${esc(x.saved)}">${esc(t('openSheet'))}</button>`:`<button type="button" class="btn primary" data-room-action="accept-sheet" data-index="${i}">${esc(t(sheetKnown(x,chars)?'update':'accept'))}</button><button type="button" class="btn ghost" data-room-action="decline-sheet" data-index="${i}">${esc(t('decline'))}</button>`}</div></li>`).join('')}</ul></section>`:''}
 <div class="room-columns"><section class="card room-team"><div class="card-heading"><span>${esc(t('team'))}</span><span data-nx>${list.length}</span></div>${list.length>1?'':`<p class="room-muted">${esc(t('noTeam'))}</p>`}<div class="room-members">${list.map(([id,m])=>memberCard(id,m)).join('')}</div></section>
 <div class="room-side">${clocks.length?`<section class="card room-clocks"><div class="card-heading"><span>${esc(t('clocks'))}</span><span data-nx>${clocks.length}</span></div><div class="room-clock-list">${clocks.map(k=>`<div class="room-clock">${clockSvg(k.size,k.filled)}<div><b>${esc(k.name)}</b><small>${k.filled} / ${k.size}</small></div></div>`).join('')}</div></section>`:''}<section class="card room-combat"><div class="card-heading"><span>${esc(t('initiative'))}</span><span>${combat?`${esc(t('round'))} ${combat.round}`:'—'}</span></div>${combat?`<p class="room-muted">${esc(combat.campaign)}</p>${combat.veiled?`<p class="room-alert soft">${esc(t('veiled'))}</p>`:''}<ol class="room-order">${combat.order.map(r=>`<li class="${r.current?'current':''} ${r.pc?'pc':'npc'}${isMine(r)?' mine':''}"><b>${r.init}</b>${r.pc&&(r.none||!r.name)?`<span class="room-none">${esc(t('noChar'))}</span>`:`<span>${esc(r.name)}</span>`}${r.current?`<em>${esc(isMine(r)?t('yourTurn'):t('turn'))}</em>`:''}</li>`).join('')}</ol>${global.BattleMap?.sharedHTML?.(combat,lang())||''}`:`<p class="room-muted">${esc(t('noCombat'))}</p>`}</section>${global.RoomJournal?.card?.()||''}
 <section class="card room-feed"><div class="card-heading"><span>${esc(t('rolls'))}</span><span data-nx>${feed.length}</span></div>${feed.length?`<ol class="room-rolls">${feed.map(r=>`<li class="${r.crit} ${r.mine?'mine':''}"><b class="room-roll-total">${esc(r.total)}</b><div><strong>${esc(r.who)}${r.character?` · ${esc(r.character)}`:''}</strong><span>${esc(r.label)}${r.crit?` · <em>${esc(t(r.crit))}</em>`:''}</span><small>${esc(r.detail)} · ${new Date(r.at).toLocaleTimeString(lang()==='ru'?'ru-RU':'en-GB',{hour:'2-digit',minute:'2-digit'})}${r.pending?` · <span class="room-pending">⏳ ${esc(t('notSent'))}</span>`:''}</small></div></li>`).join('')}</ol>`:`<p class="room-muted">${esc(t('noRolls'))}</p>`}</section></div></div>`;
}
function inner(){
 return `<div class="page-header"><div><div class="overline">${esc(t('over'))}</div><h1>${esc(t('title'))}</h1><p>${esc(t('lead'))}</p></div></div>${session?roomView():joinForms()}<div class="source-strip room-how"><div class="source-symbol">⌬</div><div><strong>${lang()==='ru'?'КАК ЭТО РАБОТАЕТ':'HOW IT WORKS'}</strong><p>${esc(t('how'))} ${esc(t('tip'))}</p></div></div>`;
}
function render(){return `<div id="room-root">${inner()}</div>`}
// Only text the user changed is carried over a repaint, and only while the page still offers the same value
// (a newly opened room link replaces the code, so the old code must not be written back over it).
function typedInputs(root){const typed={};for(const el of root.querySelectorAll('input[id]'))if(el.value!==el.defaultValue)typed[el.id]=[el.defaultValue,el.value];return typed}
function restoreTyped(root,typed){for(const [id,[was,v]] of Object.entries(typed)){const el=root.querySelector('#'+id);if(el&&el.defaultValue===was)el.value=v}}
function refresh(){
 const root=doc.querySelector('#room-root');
 if(root){
  // Repainting under an open dropdown closes it: wait until the select loses focus.
  // A dropdown cannot report whether it is open, so hold repaints briefly after it is pressed, until a choice is made or focus moves.
  if(Date.now()<selectHold&&root.contains(doc.activeElement)&&doc.activeElement.tagName==='SELECT'){deferredRepaint=true;clearTimeout(holdTimer);holdTimer=setTimeout(refresh,selectHold-Date.now()+50);const pill0=doc.querySelector('[data-room-pill]');if(pill0)pill0.outerHTML=renderPill();return}
  deferredRepaint=false;
  // Keep focus and typed text in inputs while live updates repaint the view.
  const active=doc.activeElement,focusId=root.contains(active)?(active.id||active.dataset?.roomField):null;
  const typed=typedInputs(root);
  // A view that cannot be drawn keeps what is on screen: what follows a repaint (the heartbeat sends this member's status) must go on.
  try{root.innerHTML=inner()}catch(e){global.console?.error?.(e)}
  restoreTyped(root,typed);
  if(focusId){const el=root.querySelector('#'+focusId)||root.querySelector(`[data-room-field="${focusId}"]`);el?.focus?.()}
 }
 const pill=doc.querySelector('[data-room-pill]');if(pill)pill.outerHTML=renderPill();
}
function renderPill(){
 if(!session)return '<span data-room-pill hidden></span>';
 const others=[...members.values()].filter(m=>!m.me&&isOnline(m)).length;
 return `<button type="button" class="room-pill ${netStatus.online?'ok':''}" data-room-pill data-action="navigate" data-view="room" title="${esc(t('nav'))}"><span class="room-dot ${netStatus.online?'on':''}"></span><span class="room-pill-label">${esc(t('nav'))}</span> · ${others+1}</button>`;
}

async function startSession(next){
 if(joining)return;joining=true;
 try{
  let me;try{me=await ensureIdentity()}catch{app?.notify?.(t('unsupported'));return}
  if(session&&transport)disconnect(true);
  const gm=next.role==='gm',pin=!gm&&FP.test(next.pin||'')?next.pin:'';
  session={code:next.code,role:next.role,name:next.name,characterId:next.characterId||'',campaignId:next.campaignId||'',memberId:me.fp+'.'+hex(rand(4)),gmFp:gm?me.fp:pin,gmPin:gm?'self':pin?'link':'',muted:[],broadcastRolls:true,toasts:true,sharePortrait:true};
  pendingCode=null;pendingPin='';saveSession();
  await connect();
 }finally{joining=false}
}
function value(sel){return doc.querySelector(sel)?.value?.trim()||''}
doc.addEventListener('click',async e=>{
 const b=e.target.closest?.('[data-room-action]');if(!b)return;
 const a=b.dataset.roomAction;
 if(a==='create'){const name=clip(value('#room-gm-name'),40);if(!name){app?.notify?.(t('needName'));doc.querySelector('#room-gm-name')?.focus();return}await startSession({code:newCode(),role:'gm',name,campaignId:value('#room-campaign'),characterId:value('#room-gm-character')});global.scrollTo?.(0,0)}
 else if(a==='join'){const invite=parseInvite(value('#room-code')),code=invite?.code,pin=invite?.pin||(code&&code===pendingCode?pendingPin:'');if(!code){app?.notify?.(t('badCode'));doc.querySelector('#room-code')?.focus();return}const name=clip(value('#room-player-name'),40);if(!name){app?.notify?.(t('needName'));doc.querySelector('#room-player-name')?.focus();return}await startSession({code,pin,role:'player',name,characterId:value('#room-character')});global.scrollTo?.(0,0)}
 else if(a==='switch'&&pendingCode){const code=pendingCode,pin=pendingPin;await startSession({code,pin,role:'player',name:session?.name||'?',characterId:session?.characterId||''});global.scrollTo?.(0,0)}
 else if(a==='stay'){pendingCode=null;pendingPin='';refresh()}
 else if(a==='mute'){const fp=b.dataset.fp;if(!session||!FP.test(fp||'')||fp===session.gmFp||fp===session.memberId.slice(0,24))return;muted.add(fp);session.muted=[...muted].slice(-50);saveSession();for(const [id,m] of members)if(m.fp===fp)members.delete(id);refresh()}
 else if(a==='unmute-all'){if(!session)return;muted.clear();session.muted=[];saveSession();refresh()}
 else if(a==='qr'){if(qrFor===session?.code){qrFor='';refresh();return}try{qrMarkup=await global.ShareLink.qrSvg(roomLink(session.code),{label:t('room')+' '+formatCode(session.code)});qrFor=session.code}catch{app?.notify?.(lang()==='ru'?'Не удалось построить QR-код.':'Could not draw the QR code.')}refresh()}
 else if(a==='send-sheet'){b.disabled=true;await sendSheet();refresh()}
 else if(a==='accept-sheet'){await acceptSheet(Number(b.dataset.index));refresh()}
 else if(a==='decline-sheet'){incoming.splice(Number(b.dataset.index),1);refresh()}
 else if(a==='open-sheet'){if(app?.getState?.()?.characters?.some(c=>c?.id===b.dataset.id))global.App?.open?.(b.dataset.id);else refresh()}
 else if(a==='leave'){if(!global.confirm(t('leaveConfirm')))return;disconnect(true);session=null;members=new Map();combat=null;feed=[];clearTimeout(sheetTimer);sheetState=null;saveSession();refresh()}
 else if(a==='copy'){const link=roomLink(session.code);try{await global.navigator.clipboard.writeText(link);app?.notify?.(t('copied'))}catch{global.prompt?.(t('copy'),link)}}
 else if(a==='share'){try{await global.navigator.share({title:'Night City // RED',text:(lang()==='ru'?'Комната для игры: ':'Game room: ')+formatCode(session.code),url:roomLink(session.code)})}catch{}}
});
doc.addEventListener('change',e=>{
 const f=e.target.dataset?.roomField;if(!f||!session)return;
 if(f==='character'){session.characterId=e.target.value;saveSession();publishMember()}
 else if(f==='campaign'){session.campaignId=e.target.value;saveSession();publishCombat()}
 else if(f==='broadcast'){session.broadcastRolls=e.target.checked;saveSession()}
 else if(f==='toasts'){session.toasts=e.target.checked;saveSession()}
 else if(f==='portrait'){session.sharePortrait=e.target.checked;saveSession();publishMember()}
});
// Capture a shared room link before the router normalizes the address.
function captureCode(){
 const m=/^#\/room\/([A-Za-z0-9-]{12,20})(?:\.([0-9a-f]{24}))?$/.exec(global.location?.hash||''),code=m&&normalizeCode(m[1]),pin=m?.[2]||'';
 if(code&&code!==session?.code){pendingCode=code;pendingPin=pin;refresh()}
 else if(code&&pin&&adoptPin(pin))connect();
}
// A link to the room this player is already in can name the Game Master's key. A different key than the one trusted so far is a
// change of Game Master, so the player is asked first.
function adoptPin(pin){
 if(!session||session.role!=='player'||!FP.test(pin||'')||session.gmFp===pin)return false;
 if(FP.test(session.gmFp||'')&&!global.confirm?.(t('pinChange').replace('{old}',keyLabel(session.gmFp)).replace('{new}',keyLabel(pin))))return false;
 session.gmFp=pin;session.gmPin='link';saveSession();return true;
}
captureCode();
global.addEventListener?.('popstate',captureCode);
global.addEventListener?.('hashchange',captureCode);
global.addEventListener?.('online',()=>transport?.wake());
const holdSelect=e=>{if(e.target.closest?.('#room-root select'))selectHold=Date.now()+8000};
doc.addEventListener('pointerdown',holdSelect,true);
doc.addEventListener('keydown',holdSelect,true);
doc.addEventListener('change',e=>{if(e.target.closest?.('#room-root select'))selectHold=0},true);
doc.addEventListener('focusout',e=>{if(!e.target.closest?.('#room-root'))return;selectHold=0;if(deferredRepaint)setTimeout(refresh,0)});
doc.addEventListener?.('visibilitychange',()=>{if(doc.visibilityState==='visible'&&session){transport?.wake();publishMember(true)}});

global.Room={
 attach(api){app=api;session=loadSession();if(pendingCode&&session&&pendingCode===session.code){adoptPin(pendingPin);pendingCode=null;pendingPin=''}refresh();if(session)connect()},
 render,pill:renderPill,label:()=>t('nav'),
 changed(){if(!session)return;clearTimeout(changeTimer);changeTimer=setTimeout(()=>{publishMember();publishCombat();publishClocks()},400)},
 roll({label,detail,total,character,initiative,characterId}){
  if(!session)return;
  const text=String(detail||''),crit=/Критический успех|Critical Success/i.test(text)?'crit':/Критический провал|Critical Failure/i.test(text)?'fumble':'';
  const item={who:clip(session.name,40),character:clip(character,60),label:clip(label,80),detail:clip(text,200),total:int(total,-999,9999),crit,...(initiative===true&&characterId&&characterId===session.characterId?{init:true,cid:clip(characterId,60)}:{})};
  const entry={...item,at:Date.now(),mine:true};feed.unshift(entry);feed=feed.slice(0,MAX_FEED);
  if(session.broadcastRolls!==false){
   const at=entry.at;
   if(!netStatus.online){entry.pending=true;outbox.push({payload:item,at,feed:entry,id:hex(rand(8))});outbox=outbox.slice(-MAX_OUTBOX)}
   else{const id=hex(rand(8));send('e','roll',item,false,transport,at,id).then(sent=>{if(!sent){entry.pending=true;outbox.push({payload:item,at,feed:entry,id});outbox=outbox.slice(-MAX_OUTBOX);refresh()}})}
  }
  refresh();
 },
 active:()=>!!session,
 // For room-journal.js: who this page is in the room, and the Game Master's retained message with the shared journal.
 journalLink:{who:()=>session?{role:session.role,room:base,campaignId:session.campaignId||'',online:netStatus.online}:null,send:(d,at)=>session?.role==='gm'?send('j','journal',d,true,transport,at):Promise.resolve(0)},
 // For the tracker: the live HP of the player this GM-side sheet belongs to, as text, or '' when they are not in the room.
 liveText(c){try{const live=liveFor(c);return live?`♥ ${live.hp}/${live.max} ${t('liveHp')}`:''}catch{return ''}},
 _test:{receive:p=>receive(p),setApp:a=>{app=a},setTransport:x=>{transport=x},sendSheet,acceptSheet,sheetState:()=>sheetState,sheetSource,deviceId,sheetPacket,packSheet,readSheet,combatPayload,memberCard,roomView,typedInputs,restoreTyped,ensureGMKeys,gmPub:()=>gmPub,resetGMKeys:()=>{gmKeys=null;gmPub=null},sealFor,openFromPeer,sheetCopy,incoming:()=>incoming,setSession:(s,b)=>{session=s;base=b},members:()=>members,state:()=>({combat,clocks,combatAt,clocksAt,outbox,feed}),cleanClocks,clockSvg,normalizeCode,formatCode,newCode,deriveRoom,characterSummary,cleanSummary,setKey:k=>{key=k},seal,open,ownerOf,isMine,liveFor,applyInitiative,ensureIdentity,newIdentity,fingerprint,signedEnvelope,parseInvite,roomLink,keyLabel,isOnline,padded,session:()=>session,muted:()=>muted,buckets:()=>buckets,flood:()=>flood,setIdentity:x=>{identity=x},room:()=>({base,key})},
};
})(window);
