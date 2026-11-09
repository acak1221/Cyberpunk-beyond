/* Live rooms: the GM and players see each other's character status, the GM's
   initiative order and everyone's rolls in real time. No accounts and no database:
   messages are end-to-end encrypted with the room code and relayed through
   public MQTT brokers (see room-transport.js). Anyone with the code can join. */
(function(global){
'use strict';
const doc=global.document,te=new TextEncoder(),td=new TextDecoder();
const SESSION_KEY='nightcity-red-room-v1',BROKERS_KEY='nightcity-red-room-brokers';
const ALPHABET='23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const HEARTBEAT=45000,ONLINE_FOR=130000,FORGET_AFTER=6*3600*1000,STATE_TTL=12*3600*1000,MAX_MEMBERS=30,MAX_FEED=40,MAX_BYTES=48000,MAX_OUTBOX=20,NO_GM_HINT=12000,PROTOCOL=2;
const T={ru:{nav:'Игра онлайн',over:'05 / ONLINE ROOM',title:'ИГРА ОНЛАЙН',lead:'Комната связывает телефоны и компьютеры ведущего и игроков: все видят состояние персонажей, порядок инициативы и броски в реальном времени.',how:'Без регистрации и без базы данных. Данные шифруются кодом комнаты прямо на устройстве и передаются через несколько бесплатных публичных серверов-ретрансляторов одновременно — если один недоступен, работают остальные. Ваши листы остаются у вас; в комнату уходит только сводка выбранного персонажа (и портрет, если включено). Зашифрованная копия вашего статуса хранится на серверах-ретрансляторах, пока вы в комнате, и заменяется отметкой ухода, когда вы её покидаете.',gm:'Я ведущий',gmLead:'Создайте комнату и отправьте ссылку игрокам в чат.',player:'Я игрок',playerLead:'Откройте ссылку от ведущего или введите код комнаты.',name:'Ваше имя в комнате',namePh:'Например, Мастер или Ви',campaign:'Кампания для трекера инициативы',noCampaign:'Не показывать инициативу',create:'Создать комнату',code:'Код комнаты',codePh:'XXXX-XXXX-XXXX',character:'Персонаж, которого видят другие',noCharacter:'Без персонажа (наблюдатель)',join:'Войти в комнату',badCode:'Проверьте код: 12 символов, например K7RQ-M2XA-PZ9E.',needName:'Введите имя.',room:'КОМНАТА',copy:'Скопировать ссылку',copied:'Ссылка скопирована. Отправьте её игрокам.',share:'Поделиться',leave:'Покинуть',leaveConfirm:'Покинуть комнату? Другие перестанут видеть ваш статус.',you:'Вы',asGM:'ведущий',asPlayer:'игрок',servers:'Серверы связи',online:'в сети',offline:'нет связи',ago:'мин назад',team:'КОМАНДА',noTeam:'Пока здесь только вы. Отправьте ссылку игрокам.',observer:'наблюдает',initiative:'ИНИЦИАТИВА',round:'Раунд',noCombat:'Ведущий ещё не показал инициативу.',rolls:'БРОСКИ',noRolls:'Бросков пока нет. Броски с листа и со страницы «Кубики» появятся здесь у всех.',broadcast:'Показывать мои броски другим',toasts:'Всплывающие уведомления о бросках других',connecting:'Подключение…',noNetwork:'Нет связи ни с одним сервером. Проверьте интернет — подключение восстановится само.',crit:'КРИТ',fumble:'ПРОВАЛ',unsupported:'Этот браузер не поддерживает шифрование для комнат. Обновите браузер.',hp:'HP',hum:'HUM',luck:'LUCK',sp:'SP',head:'голова',body:'тело',turn:'ходит',gmBadge:'ВЕДУЩИЙ',clocks:'СЧЁТЧИКИ',otherRoom:'Вы открыли ссылку на другую комнату',switchRoom:'Перейти (выйти из текущей)',stayRoom:'Остаться',noGM:'Ведущего пока нет в комнате. Проверьте код или подождите — он появится, когда ведущий откроет комнату.',twoGM:'В комнате несколько ведущих: инициатива и счётчики показываются от последнего обновления.',notSent:'не отправлено — отправится при связи',sharePortrait:'Показывать мой портрет',newCode:'Будет создан новый код комнаты.',tip:'Совет: добавьте сайт на главный экран телефона — так комната откроется как приложение.'},
 en:{nav:'Online play',over:'05 / ONLINE ROOM',title:'ONLINE PLAY',lead:'A room links the GM and players across phones and computers: everyone sees character status, initiative order and rolls in real time.',how:'No sign-up and no database. Data is encrypted with the room code on your device and relayed through several free public relay servers at once — if one is down, the others carry on. Your sheets stay with you; only a summary of the chosen character is shared (plus the portrait if enabled). An encrypted copy of your status stays on the relay servers while you are in the room and is replaced by a "left" marker when you leave.',gm:'I am the GM',gmLead:'Create a room and send the link to your players.',player:'I am a player',playerLead:'Open the GM\'s link or type the room code.',name:'Your name in the room',namePh:'For example, GM or V',campaign:'Campaign for the initiative tracker',noCampaign:'Don\'t share initiative',create:'Create room',code:'Room code',codePh:'XXXX-XXXX-XXXX',character:'Character others can see',noCharacter:'No character (observer)',join:'Join room',badCode:'Check the code: 12 characters, e.g. K7RQ-M2XA-PZ9E.',needName:'Enter a name.',room:'ROOM',copy:'Copy link',copied:'Link copied. Send it to your players.',share:'Share',leave:'Leave',leaveConfirm:'Leave the room? Others will stop seeing your status.',you:'You',asGM:'GM',asPlayer:'player',servers:'Relay servers',online:'online',offline:'offline',ago:'min ago',team:'CREW',noTeam:'Only you so far. Send the link to your players.',observer:'watching',initiative:'INITIATIVE',round:'Round',noCombat:'The GM has not shared initiative yet.',rolls:'ROLLS',noRolls:'No rolls yet. Rolls from sheets and the Dice page show up here for everyone.',broadcast:'Show my rolls to others',toasts:'Pop-up notices for other people\'s rolls',connecting:'Connecting…',noNetwork:'No relay server reachable. Check your connection — it reconnects automatically.',crit:'CRIT',fumble:'FUMBLE',unsupported:'This browser cannot encrypt room traffic. Please update it.',hp:'HP',hum:'HUM',luck:'LUCK',sp:'SP',head:'head',body:'body',turn:'acting',gmBadge:'GM',clocks:'CLOCKS',otherRoom:'You opened a link to another room',switchRoom:'Switch (leave the current one)',stayRoom:'Stay',noGM:'No GM in this room yet. Check the code or wait — the GM appears once they open the room.',twoGM:'There are several GMs in this room: initiative and clocks show the latest update.',notSent:'not sent — will send when online',sharePortrait:'Show my portrait',newCode:'A new room code will be generated.',tip:'Tip: add the site to your phone\'s home screen so the room opens like an app.'}};

let app=null,session=null,transport=null,key=null,base='',members=new Map(),combat=null,clocks=[],lastClocks='',combatAt=0,clocksAt=0,outbox=[],connectedAt=0,deferredRepaint=false,selectHold=0,holdTimer=null,feed=[],netStatus={total:0,online:0},heartbeat=null,changeTimer=null,lastMember='',lastCombat='',pendingCode=null,joining=false;

const lang=()=>{try{return app?.getState?.().lang==='en'?'en':'ru'}catch{return 'ru'}};
const t=k=>T[lang()][k]??T.ru[k]??k;
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clip=(s,n)=>String(s??'').slice(0,n);
const int=(v,lo=-999,hi=9999)=>{const n=Math.round(Number(v));return Number.isFinite(n)?Math.max(lo,Math.min(hi,n)):0};
const rand=n=>{const a=new Uint8Array(n);global.crypto.getRandomValues(a);return a};
const hex=b=>Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');

function normalizeCode(raw){const s=String(raw||'').toUpperCase().replace(/[^A-Z0-9]/g,'');return s.length===12&&[...s].every(ch=>ALPHABET.includes(ch))?s:null}
function formatCode(c){return c?c.slice(0,4)+'-'+c.slice(4,8)+'-'+c.slice(8):''}
function newCode(){const n=ALPHABET.length,limit=256-256%n,out=[];while(out.length<12)for(const b of rand(16)){if(b<limit&&out.length<12)out.push(ALPHABET[b%n])}return out.join('')}
function roomLink(code){const loc=global.location;return loc.origin+loc.pathname+'#/room/'+formatCode(code)}

async function deriveRoom(code){
 const subtle=global.crypto?.subtle;if(!subtle)throw Error('no_crypto');
 // One slow derivation yields both the key and the topic, so the public topic name does not make guessing the code any cheaper.
 const material=await subtle.importKey('raw',te.encode(code),'PBKDF2',false,['deriveBits']);
 const bits=new Uint8Array(await subtle.deriveBits({name:'PBKDF2',salt:te.encode('ncred-room-v2'),iterations:150000,hash:'SHA-256'},material,384));
 const aes=await subtle.importKey('raw',bits.slice(0,32),{name:'AES-GCM'},false,['encrypt','decrypt']);
 return {topic:'ncred/v2/'+hex(bits.slice(32,44)),key:aes};
}
async function seal(obj){const iv=rand(12),data=te.encode(JSON.stringify(obj));const ct=new Uint8Array(await global.crypto.subtle.encrypt({name:'AES-GCM',iv},key,data));const out=new Uint8Array(12+ct.length);out.set(iv);out.set(ct,12);return out}
async function open(bytes){if(bytes.length<29||bytes.length>MAX_BYTES)return null;const plain=await global.crypto.subtle.decrypt({name:'AES-GCM',iv:bytes.subarray(0,12)},key,bytes.subarray(12));return JSON.parse(td.decode(plain))}

function loadSession(){try{const s=JSON.parse(global.localStorage.getItem(SESSION_KEY)||'null');if(s&&normalizeCode(s.code)&&['gm','player'].includes(s.role)&&typeof s.memberId==='string')return s}catch{}return null}
function saveSession(){try{session?global.localStorage.setItem(SESSION_KEY,JSON.stringify(session)):global.localStorage.removeItem(SESSION_KEY)}catch{}}
function brokers(){try{const b=JSON.parse(global.localStorage.getItem(BROKERS_KEY)||'null');if(Array.isArray(b)&&b.length&&b.every(x=>x&&typeof x.url==='string'&&/^wss?:\/\//.test(x.url)))return b}catch{}return null}

/* ---------- What we share ---------- */
function characterSummary(c){
 if(!c||typeof c!=='object')return null;
 const st=c.stats||{},max=10+5*Math.ceil((int(st.BODY,0,20)+int(st.WILL,0,20))/2),hp=int(c.hp);
 const luckMax=int(st.LUCK,0,20),luck=c.extra&&c.extra.luck!==undefined&&c.extra.luck!==''?int(c.extra.luck,0,20):luckMax;
 return {name:clip(c.name,60),role:clip(c.role,20),rank:int(c.rank,0,10),hp,max,humanity:int(c.humanity,-99,200),luck,luckMax,head:int(c.head,0,99),body:int(c.bodyArmor,0,99),ref:int(st.REF,0,20),dex:int(st.DEX,0,20)};
}
// Everything received from other devices is untrusted: rebuild it from known fields only.
function cleanSummary(x){
 if(!x||typeof x!=='object'||Array.isArray(x))return null;
 return {name:clip(x.name,60),role:clip(x.role,20),rank:int(x.rank,0,10),hp:int(x.hp),max:Math.max(1,int(x.max,1,999)),humanity:int(x.humanity,-99,200),luck:int(x.luck,0,20),luckMax:int(x.luckMax,0,20),head:int(x.head,0,99),body:int(x.body,0,99),ref:int(x.ref,0,20),dex:int(x.dex,0,20)};
}
function memberPayload(){
 const st=app?.getState?.();const c=session.characterId?st?.characters?.find(x=>x.id===session.characterId):null;
 const thumb=session.sharePortrait!==false?(global.Portrait?.thumb?.(c)||''):'';return {name:clip(session.name,40),role:session.role,character:characterSummary(c),...(thumb?{portrait:thumb}:{})};
}
function combatPayload(){
 if(session.role!=='gm'||!session.campaignId)return null;
 const st=app?.getState?.(),camp=st?.campaigns?.find(x=>x.id===session.campaignId);if(!camp)return null;
 const roster=[...(camp.roster||[])].sort((a,b)=>{let n=(Number(b.initiative)||0)-(Number(a.initiative)||0);if(n)return n;const x=a.ties||[],y=b.ties||[];for(let i=0;i<Math.max(x.length,y.length);i++){n=(Number(y[i])||0)-(Number(x[i])||0);if(n)return n}return (Number(a.order)||0)-(Number(b.order)||0)});
 const turn=int(camp.turnIndex,0,500);
 return {campaign:clip(camp.name,80),round:int(camp.round||1,1,9999),order:roster.slice(0,40).map((r,i)=>({name:clip(r.kind==='pc'?(st.characters.find(c=>c.id===r.characterId)?.name||'?'):r.name,60),pc:r.kind==='pc',init:int(r.initiative),current:i===turn}))};
}

function cleanClocks(list){return Array.isArray(list)?list.slice(0,12).filter(x=>x&&typeof x==='object').map(x=>{const size=int(x.size,2,12);return {name:clip(x.name,60),size,filled:int(x.filled,0,size)}}):[]}
function clocksPayload(){if(session?.role!=='gm')return [];try{return cleanClocks(global.GMExtras?.sharedClocks?.(app?.getState?.()))}catch{return []}}

/* ---------- Networking ---------- */
async function send(sub,type,data,retain=false,via=transport,at=Date.now(),id=hex(rand(8))){
 if(!via||!key||!session)return 0;
 try{return via.publish(sub,await seal({v:PROTOCOL,id,from:session.memberId,t:type,at,d:data}),retain)}catch{return 0}
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
 if(!session||session.role!=='gm')return;const d=clocksPayload(),s=JSON.stringify(d);if(!force&&s===lastClocks)return;lastClocks=s;clocks=d;
 const at=Date.now();clocksAt=at;
 if(d.length)send('k','clocks',{list:d},true,transport,at);else send('k','cleared',{},true,transport,at);
 refresh();
}
function evictOne(){let oldest=null;for(const [id,m] of members)if(!m.me&&Date.now()-m.at>ONLINE_FOR&&(!oldest||m.at<oldest[1].at))oldest=[id,m];if(!oldest)return false;members.delete(oldest[0]);return true}
function prune(){let changed=false;for(const [id,m] of members)if(!m.me&&Date.now()-m.at>FORGET_AFTER){members.delete(id);changed=true}return changed}
async function flushOutbox(){
 if(!outbox.length||!transport)return;
 const queue=outbox;outbox=[];
 // Each queued roll goes out twice with the same id (now and on the next heartbeat) so a peer that reconnects a bit later still gets it; duplicates are dropped by id.
 for(const item of queue){const sent=await send('e','roll',item.payload,false,transport,item.at,item.id);if(sent){item.feed.pending=false;item.tries=(item.tries||0)+1}if(!sent||item.tries<2)outbox.push(item)}
 refresh();
}
function self(d){members.set(session.memberId,{...d,portrait:global.Portrait?.valid?.(d.portrait,16000)?d.portrait:'',at:Date.now(),me:true});refresh()}
const seen=new Set();
async function receive(p){
 const sub=p.topic.slice(base.length+1);
 // Empty retained messages carry no key, so anyone on a public broker could send one: ignore them.
 if(!p.payload.length)return;
 let m;try{m=await open(p.payload)}catch{return}
 if(!m||m.v!==PROTOCOL||typeof m.id!=='string'||seen.has(m.id)||typeof m.from!=='string'||m.from.length>40||!m.d||typeof m.d!=='object')return;
 seen.add(m.id);if(seen.size>2000)seen.clear();
 if(m.from===session.memberId)return;
 const at=Math.min(int(m.at,0,Number.MAX_SAFE_INTEGER),Date.now()),when=p.retain?at:Date.now();
 if(m.t==='left'&&sub==='m/'+m.from){if(members.delete(m.from))refresh();return}
 if(m.t==='member'&&sub==='m/'+m.from){
  if(Date.now()-at>FORGET_AFTER)return;
  const prev=members.get(m.from);if(prev&&prev.sentAt>at)return; // an older retained copy must not overwrite a newer status
  if(!prev&&members.size>=MAX_MEMBERS&&!evictOne())return;
  const d=m.d;
  if(outbox.length&&!p.retain)flushOutbox(); // someone (re)connected: give them the rolls made while offline
  members.set(m.from,{sentAt:at,name:clip(d.name,40)||'?',role:d.role==='gm'?'gm':'player',character:cleanSummary(d.character),portrait:global.Portrait?.valid?.(d.portrait,16000)?d.portrait:'',at:when});
  refresh();
 }else if((m.t==='combat'||m.t==='cleared')&&sub==='c'){
  if(at<combatAt||Date.now()-at>STATE_TTL)return;
  combatAt=at;if(m.t==='cleared'){combat=null;refresh();return}
  const d=m.d;if(!Array.isArray(d.order))return;
  combat={campaign:clip(d.campaign,80),round:int(d.round,1,9999),order:d.order.slice(0,40).map(r=>({name:clip(r?.name,60),pc:!!r?.pc,init:int(r?.init),current:!!r?.current})),from:m.from,at:when};
  refresh();
 }else if((m.t==='clocks'||m.t==='cleared')&&sub==='k'){
  if(at<clocksAt||Date.now()-at>STATE_TTL)return;
  clocksAt=at;clocks=m.t==='cleared'?[]:cleanClocks(m.d.list);refresh();
 }else if(m.t==='roll'&&sub==='e'){
  const d=m.d,item={who:members.get(m.from)?.name||clip(d.who,40),character:clip(d.character,60),label:clip(d.label,80),detail:clip(d.detail,200),total:int(d.total,-999,9999),crit:['crit','fumble'].includes(d.crit)?d.crit:'',at:Date.now(),mine:false};
  feed.unshift(item);feed=feed.slice(0,MAX_FEED);refresh();
  if(session.toasts!==false)toast(item);
  const known=members.get(m.from);if(known){known.at=Date.now()}
 }
}
async function connect(){
 if(!session)return;
 disconnect(false);
 try{({topic:base,key}=await deriveRoom(session.code))}catch{app?.notify?.(t('unsupported'));session=null;saveSession();refresh();return}
 members=new Map();combat=null;clocks=[];feed=[];outbox=[];lastMember='';lastCombat='';lastClocks='';combatAt=0;clocksAt=0;connectedAt=Date.now();setTimeout(refresh,NO_GM_HINT+500);
 transport=global.RoomTransport.create({topic:base,brokers:brokers(),onMessage:p=>{receive(p)},onStatus:s=>{const was=netStatus.online;netStatus=s;if(s.online>was){publishMember(true);publishCombat(true);publishClocks(true);flushOutbox()}refresh()}});
 publishMember(true);publishCombat(true);publishClocks(true);
 heartbeat=setInterval(()=>{publishMember(true);if(session?.role==='gm'){publishCombat(true);publishClocks(true)}prune();flushOutbox();refresh()},HEARTBEAT);
 refresh();
}
function disconnect(clear=true){
 clearInterval(heartbeat);heartbeat=null;
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
 const el=doc.createElement('div');el.className='room-toast '+(item.crit||'');
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
function presence(m){if(m.me)return `<span class="room-dot on"></span>${esc(t('you'))}`;const age=Date.now()-m.at;return age<ONLINE_FOR?`<span class="room-dot on"></span>${esc(t('online'))}`:`<span class="room-dot"></span>${esc(t('offline'))} · ${Math.max(1,Math.round(age/60000))} ${esc(t('ago'))}`}
function memberCard(id,m){
 const c=m.character;
 const head=`<div class="room-member-head">${m.portrait&&global.Portrait?.valid?.(m.portrait,16000)?`<img class="room-avatar" src="${m.portrait}" alt="">`:''}<strong>${esc(m.name)}</strong>${m.role==='gm'?`<span class="room-badge">${esc(t('gmBadge'))}</span>`:''}<small>${presence(m)}</small></div>`;
 if(!c)return `<article class="room-member ${m.me?'me':''}">${head}<p class="room-muted">${esc(t('observer'))}</p></article>`;
 const pct=Math.max(0,Math.min(100,Math.round(c.hp/Math.max(1,c.max)*100))),w=woundOf(c);
 return `<article class="room-member ${m.me?'me':''}" data-wound="${w}">${head}<div class="room-char"><b>${esc(c.name||'—')}</b><span>${esc(roleName(c.role))}${c.rank?` · ${c.rank}`:''}</span></div><div class="room-hp"><div class="room-hp-bar"><i style="width:${pct}%"></i></div><span>${esc(t('hp'))} <b>${c.hp}</b> / ${c.max}</span></div><dl class="room-stats"><div><dt>${esc(t('hum'))}</dt><dd>${c.humanity}</dd></div><div><dt>${esc(t('luck'))}</dt><dd>${c.luck}/${c.luckMax}</dd></div><div><dt>${esc(t('sp'))}</dt><dd>${c.head} / ${c.body}</dd></div><div><dt>REF</dt><dd>${c.ref}</dd></div></dl></article>`;
}
function joinForms(){
 const st=app?.getState?.()||{},chars=st.characters||[],camps=st.campaigns||[],prev=session||loadSession()||{},code=pendingCode?formatCode(pendingCode):'';
 const charSelect=`<select id="room-character">${`<option value="">${esc(t('noCharacter'))}</option>`}${chars.map(c=>`<option value="${esc(c.id)}" ${prev.characterId===c.id?'selected':''}>${esc(c.name||'—')} · ${esc(roleName(c.role))}</option>`).join('')}</select>`;
 const nameVal=esc(prev.name||'');
 return `<div class="room-join-grid">${code?'':`<section class="card room-join"><div class="card-heading"><span>${esc(t('gm'))}</span><span>GM</span></div><p>${esc(t('gmLead'))}</p><label class="field">${esc(t('name'))}<input id="room-gm-name" maxlength="40" placeholder="${esc(t('namePh'))}" value="${nameVal}"></label><label class="field">${esc(t('campaign'))}<select id="room-campaign"><option value="">${esc(t('noCampaign'))}</option>${camps.map(c=>`<option value="${esc(c.id)}">${esc(c.name||'—')}</option>`).join('')}</select></label><label class="field">${esc(t('character'))}${charSelect.replace('id="room-character"','id="room-gm-character"')}</label><button type="button" class="btn primary wide" data-room-action="create">＋ ${esc(t('create'))}</button></section>`}<section class="card room-join"><div class="card-heading"><span>${esc(t('player'))}</span><span>JOIN</span></div><p>${esc(t('playerLead'))}</p><label class="field">${esc(t('code'))}<input id="room-code" maxlength="16" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="${esc(t('codePh'))}" value="${esc(code)}"></label><label class="field">${esc(t('name'))}<input id="room-player-name" maxlength="40" placeholder="${esc(t('namePh'))}" value="${nameVal}"></label><label class="field">${esc(t('character'))}${charSelect}</label><button type="button" class="btn primary wide" data-room-action="join">→ ${esc(t('join'))}</button></section></div>`;
}
function roomView(){
 const st=app?.getState?.()||{},chars=st.characters||[],camps=st.campaigns||[];
 const list=[...members.entries()].filter(([,m])=>m.me||Date.now()-m.at<FORGET_AFTER).sort((a,b)=>(b[1].role==='gm')-(a[1].role==='gm')||(b[1].me?1:0)-(a[1].me?1:0)||a[1].name.localeCompare(b[1].name));
 const net=netStatus.total?`${netStatus.online} / ${netStatus.total}`:'…';
 const charSelect=`<select data-room-field="character"><option value="">${esc(t('noCharacter'))}</option>${chars.map(c=>`<option value="${esc(c.id)}" ${session.characterId===c.id?'selected':''}>${esc(c.name||'—')}</option>`).join('')}</select>`;
 const campSelect=session.role==='gm'?`<label class="field">${esc(t('campaign'))}<select data-room-field="campaign"><option value="">${esc(t('noCampaign'))}</option>${camps.map(c=>`<option value="${esc(c.id)}" ${session.campaignId===c.id?'selected':''}>${esc(c.name||'—')}</option>`).join('')}</select></label>`:'';
 const gms=list.filter(([,m])=>m.role==='gm').length,hasOtherGM=list.some(([,m])=>m.role==='gm'&&!m.me);
 const notes=`${pendingCode&&pendingCode!==session.code?`<div class="room-alert"><p>${esc(t('otherRoom'))}: <b>${esc(formatCode(pendingCode))}</b></p><div><button type="button" class="btn primary" data-room-action="switch">${esc(t('switchRoom'))}</button><button type="button" class="btn ghost" data-room-action="stay">${esc(t('stayRoom'))}</button></div></div>`:''}${session.role==='player'&&!hasOtherGM&&netStatus.online&&Date.now()-connectedAt>NO_GM_HINT?`<p class="room-alert soft">${esc(t('noGM'))}</p>`:''}${gms>1?`<p class="room-alert soft">${esc(t('twoGM'))}</p>`:''}`;
 return notes+`<div class="room-banner ${netStatus.online?'ok':'bad'}"><div><small>${esc(t('room'))}</small><strong class="room-code">${esc(formatCode(session.code))}</strong></div><div class="room-banner-actions"><button type="button" class="btn primary" data-room-action="copy">⧉ ${esc(t('copy'))}</button>${global.navigator?.share?`<button type="button" class="btn ghost" data-room-action="share">↗ ${esc(t('share'))}</button>`:''}<button type="button" class="btn ghost" data-room-action="leave">✕ ${esc(t('leave'))}</button></div><p class="room-net"><span class="room-dot ${netStatus.online?'on':''}"></span>${esc(t('servers'))}: ${net}${netStatus.total&&!netStatus.online?` — ${esc(t('noNetwork'))}`:''}</p></div>
 <section class="card room-me"><div class="card-heading"><span>${esc(t('you'))}: ${esc(session.name)} · ${esc(t(session.role==='gm'?'asGM':'asPlayer'))}</span><span>SETTINGS</span></div><div class="room-me-grid"><label class="field">${esc(t('character'))}${charSelect}</label>${campSelect}</div><label class="room-check"><input type="checkbox" data-room-field="broadcast" ${session.broadcastRolls!==false?'checked':''}> ${esc(t('broadcast'))}</label><label class="room-check"><input type="checkbox" data-room-field="toasts" ${session.toasts!==false?'checked':''}> ${esc(t('toasts'))}</label><label class="room-check"><input type="checkbox" data-room-field="portrait" ${session.sharePortrait!==false?'checked':''}> ${esc(t('sharePortrait'))}</label></section>
 <div class="room-columns"><section class="card room-team"><div class="card-heading"><span>${esc(t('team'))}</span><span>${list.length}</span></div>${list.length>1?'':`<p class="room-muted">${esc(t('noTeam'))}</p>`}<div class="room-members">${list.map(([id,m])=>memberCard(id,m)).join('')}</div></section>
 <div class="room-side">${clocks.length?`<section class="card room-clocks"><div class="card-heading"><span>${esc(t('clocks'))}</span><span>${clocks.length}</span></div><div class="room-clock-list">${clocks.map(k=>`<div class="room-clock">${clockSvg(k.size,k.filled)}<div><b>${esc(k.name)}</b><small>${k.filled} / ${k.size}</small></div></div>`).join('')}</div></section>`:''}<section class="card room-combat"><div class="card-heading"><span>${esc(t('initiative'))}</span><span>${combat?`${esc(t('round'))} ${combat.round}`:'—'}</span></div>${combat?`<p class="room-muted">${esc(combat.campaign)}</p><ol class="room-order">${combat.order.map(r=>`<li class="${r.current?'current':''} ${r.pc?'pc':'npc'}"><b>${r.init}</b><span>${esc(r.name)}</span>${r.current?`<em>${esc(t('turn'))}</em>`:''}</li>`).join('')}</ol>`:`<p class="room-muted">${esc(t('noCombat'))}</p>`}</section>
 <section class="card room-feed"><div class="card-heading"><span>${esc(t('rolls'))}</span><span>${feed.length}</span></div>${feed.length?`<ol class="room-rolls">${feed.map(r=>`<li class="${r.crit} ${r.mine?'mine':''}"><b class="room-roll-total">${esc(r.total)}</b><div><strong>${esc(r.who)}${r.character?` · ${esc(r.character)}`:''}</strong><span>${esc(r.label)}${r.crit?` · <em>${esc(t(r.crit))}</em>`:''}</span><small>${esc(r.detail)} · ${new Date(r.at).toLocaleTimeString(lang()==='ru'?'ru-RU':'en-GB',{hour:'2-digit',minute:'2-digit'})}${r.pending?` · <span class="room-pending">⏳ ${esc(t('notSent'))}</span>`:''}</small></div></li>`).join('')}</ol>`:`<p class="room-muted">${esc(t('noRolls'))}</p>`}</section></div></div>`;
}
function inner(){
 return `<div class="page-header"><div><div class="overline">${esc(t('over'))}</div><h1>${esc(t('title'))}</h1><p>${esc(t('lead'))}</p></div></div>${session?roomView():joinForms()}<div class="source-strip room-how"><div class="source-symbol">⌬</div><div><strong>${lang()==='ru'?'КАК ЭТО РАБОТАЕТ':'HOW IT WORKS'}</strong><p>${esc(t('how'))} ${esc(t('tip'))}</p></div></div>`;
}
function render(){return `<div id="room-root">${inner()}</div>`}
function refresh(){
 const root=doc.querySelector('#room-root');
 if(root){
  // Repainting under an open dropdown closes it: wait until the select loses focus.
  // A dropdown cannot report whether it is open, so hold repaints briefly after it is pressed, until a choice is made or focus moves.
  if(Date.now()<selectHold&&root.contains(doc.activeElement)&&doc.activeElement.tagName==='SELECT'){deferredRepaint=true;clearTimeout(holdTimer);holdTimer=setTimeout(refresh,selectHold-Date.now()+50);const pill0=doc.querySelector('[data-room-pill]');if(pill0)pill0.outerHTML=renderPill();return}
  deferredRepaint=false;
  // Keep focus and typed text in inputs while live updates repaint the view.
  const active=doc.activeElement,focusId=root.contains(active)?(active.id||active.dataset?.roomField):null;
  const typed={};for(const el of root.querySelectorAll('input[id]'))typed[el.id]=el.value;
  root.innerHTML=inner();
  for(const [id,v] of Object.entries(typed)){const el=root.querySelector('#'+id);if(el)el.value=v}
  if(focusId){const el=root.querySelector('#'+focusId)||root.querySelector(`[data-room-field="${focusId}"]`);el?.focus?.()}
 }
 const pill=doc.querySelector('[data-room-pill]');if(pill)pill.outerHTML=renderPill();
}
function renderPill(){
 if(!session)return '<span data-room-pill hidden></span>';
 const others=[...members.values()].filter(m=>!m.me&&Date.now()-m.at<ONLINE_FOR).length;
 return `<button type="button" class="room-pill ${netStatus.online?'ok':''}" data-room-pill data-action="navigate" data-view="room" title="${esc(t('nav'))}"><span class="room-dot ${netStatus.online?'on':''}"></span><span class="room-pill-label">${esc(t('nav'))}</span> · ${others+1}</button>`;
}

async function startSession(next){
 if(joining)return;joining=true;
 try{
  if(session&&transport)disconnect(true);
  session={code:next.code,role:next.role,name:next.name,characterId:next.characterId||'',campaignId:next.campaignId||'',memberId:hex(rand(8)),broadcastRolls:true,toasts:true,sharePortrait:true};
  pendingCode=null;saveSession();
  await connect();
 }finally{joining=false}
}
function value(sel){return doc.querySelector(sel)?.value?.trim()||''}
doc.addEventListener('click',async e=>{
 const b=e.target.closest?.('[data-room-action]');if(!b)return;
 const a=b.dataset.roomAction;
 if(a==='create'){const name=clip(value('#room-gm-name'),40);if(!name){app?.notify?.(t('needName'));doc.querySelector('#room-gm-name')?.focus();return}await startSession({code:newCode(),role:'gm',name,campaignId:value('#room-campaign'),characterId:value('#room-gm-character')});global.scrollTo?.(0,0)}
 else if(a==='join'){const code=normalizeCode(value('#room-code'));if(!code){app?.notify?.(t('badCode'));doc.querySelector('#room-code')?.focus();return}const name=clip(value('#room-player-name'),40);if(!name){app?.notify?.(t('needName'));doc.querySelector('#room-player-name')?.focus();return}await startSession({code,role:'player',name,characterId:value('#room-character')});global.scrollTo?.(0,0)}
 else if(a==='switch'&&pendingCode){const code=pendingCode;await startSession({code,role:'player',name:session?.name||'?',characterId:session?.characterId||''});global.scrollTo?.(0,0)}
 else if(a==='stay'){pendingCode=null;refresh()}
 else if(a==='leave'){if(!global.confirm(t('leaveConfirm')))return;disconnect(true);session=null;members=new Map();combat=null;feed=[];saveSession();refresh()}
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
function captureCode(){const m=/^#\/room\/([A-Za-z0-9-]{12,20})$/.exec(global.location?.hash||'');const code=m&&normalizeCode(m[1]);if(code&&code!==session?.code){pendingCode=code;refresh()}}
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
 attach(api){app=api;session=loadSession();if(pendingCode&&session&&pendingCode===session.code)pendingCode=null;refresh();if(session)connect()},
 render,pill:renderPill,label:()=>t('nav'),
 changed(){if(!session)return;clearTimeout(changeTimer);changeTimer=setTimeout(()=>{publishMember();publishCombat();publishClocks()},400)},
 roll({label,detail,total,character}){
  if(!session)return;
  const text=String(detail||''),crit=/Критический успех|Critical Success/i.test(text)?'crit':/Критический провал|Critical Failure/i.test(text)?'fumble':'';
  const item={who:clip(session.name,40),character:clip(character,60),label:clip(label,80),detail:clip(text,200),total:int(total,-999,9999),crit};
  const entry={...item,at:Date.now(),mine:true};feed.unshift(entry);feed=feed.slice(0,MAX_FEED);
  if(session.broadcastRolls!==false){
   const at=entry.at;
   if(!netStatus.online){entry.pending=true;outbox.push({payload:item,at,feed:entry,id:hex(rand(8))});outbox=outbox.slice(-MAX_OUTBOX)}
   else{const id=hex(rand(8));send('e','roll',item,false,transport,at,id).then(sent=>{if(!sent){entry.pending=true;outbox.push({payload:item,at,feed:entry,id});outbox=outbox.slice(-MAX_OUTBOX);refresh()}})}
  }
  refresh();
 },
 active:()=>!!session,
 _test:{receive:p=>receive(p),setSession:(s,b)=>{session=s;base=b},members:()=>members,state:()=>({combat,clocks,combatAt,clocksAt,outbox,feed}),cleanClocks,clockSvg,normalizeCode,formatCode,newCode,deriveRoom,characterSummary,cleanSummary,setKey:k=>{key=k},seal,open},
};
})(window);
