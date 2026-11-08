/* Live rooms: the GM and players see each other's character status, the GM's
   initiative order and everyone's rolls in real time. No accounts and no database:
   messages are end-to-end encrypted with the room code and relayed through
   public MQTT brokers (see room-transport.js). Anyone with the code can join. */
(function(global){
'use strict';
const doc=global.document,te=new TextEncoder(),td=new TextDecoder();
const SESSION_KEY='nightcity-red-room-v1',BROKERS_KEY='nightcity-red-room-brokers';
const ALPHABET='23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const HEARTBEAT=45000,ONLINE_FOR=130000,FORGET_AFTER=6*3600*1000,MAX_MEMBERS=30,MAX_FEED=40,MAX_BYTES=48000;
const T={ru:{nav:'Игра онлайн',over:'05 / ONLINE ROOM',title:'ИГРА ОНЛАЙН',lead:'Комната связывает телефоны и компьютеры ведущего и игроков: все видят состояние персонажей, порядок инициативы и броски в реальном времени.',how:'Без регистрации и без базы данных. Данные шифруются кодом комнаты прямо на устройстве и передаются через несколько бесплатных публичных серверов-ретрансляторов одновременно — если один недоступен, работают остальные. Ваши листы остаются у вас; в комнату уходит только сводка выбранного персонажа.',gm:'Я ведущий',gmLead:'Создайте комнату и отправьте ссылку игрокам в чат.',player:'Я игрок',playerLead:'Откройте ссылку от ведущего или введите код комнаты.',name:'Ваше имя в комнате',namePh:'Например, Мастер или Ви',campaign:'Кампания для трекера инициативы',noCampaign:'Не показывать инициативу',create:'Создать комнату',code:'Код комнаты',codePh:'XXXX-XXXX-XXXX',character:'Персонаж, которого видят другие',noCharacter:'Без персонажа (наблюдатель)',join:'Войти в комнату',badCode:'Проверьте код: 12 символов, например K7RQ-M2XA-PZ9E.',needName:'Введите имя.',room:'КОМНАТА',copy:'Скопировать ссылку',copied:'Ссылка скопирована. Отправьте её игрокам.',share:'Поделиться',leave:'Покинуть',leaveConfirm:'Покинуть комнату? Другие перестанут видеть ваш статус.',you:'Вы',asGM:'ведущий',asPlayer:'игрок',servers:'Серверы связи',online:'в сети',offline:'нет связи',ago:'мин назад',team:'КОМАНДА',noTeam:'Пока здесь только вы. Отправьте ссылку игрокам.',observer:'наблюдает',initiative:'ИНИЦИАТИВА',round:'Раунд',noCombat:'Ведущий ещё не показал инициативу.',rolls:'БРОСКИ',noRolls:'Бросков пока нет. Броски с листа и со страницы «Кубики» появятся здесь у всех.',broadcast:'Показывать мои броски другим',toasts:'Всплывающие уведомления о бросках других',connecting:'Подключение…',noNetwork:'Нет связи ни с одним сервером. Проверьте интернет — подключение восстановится само.',crit:'КРИТ',fumble:'ПРОВАЛ',unsupported:'Этот браузер не поддерживает шифрование для комнат. Обновите браузер.',hp:'HP',hum:'HUM',luck:'LUCK',sp:'SP',head:'голова',body:'тело',turn:'ходит',gmBadge:'ВЕДУЩИЙ',newCode:'Будет создан новый код комнаты.',tip:'Совет: добавьте сайт на главный экран телефона — так комната откроется как приложение.'},
 en:{nav:'Online play',over:'05 / ONLINE ROOM',title:'ONLINE PLAY',lead:'A room links the GM and players across phones and computers: everyone sees character status, initiative order and rolls in real time.',how:'No sign-up and no database. Data is encrypted with the room code on your device and relayed through several free public relay servers at once — if one is down, the others carry on. Your sheets stay with you; only a summary of the chosen character is shared.',gm:'I am the GM',gmLead:'Create a room and send the link to your players.',player:'I am a player',playerLead:'Open the GM\'s link or type the room code.',name:'Your name in the room',namePh:'For example, GM or V',campaign:'Campaign for the initiative tracker',noCampaign:'Don\'t share initiative',create:'Create room',code:'Room code',codePh:'XXXX-XXXX-XXXX',character:'Character others can see',noCharacter:'No character (observer)',join:'Join room',badCode:'Check the code: 12 characters, e.g. K7RQ-M2XA-PZ9E.',needName:'Enter a name.',room:'ROOM',copy:'Copy link',copied:'Link copied. Send it to your players.',share:'Share',leave:'Leave',leaveConfirm:'Leave the room? Others will stop seeing your status.',you:'You',asGM:'GM',asPlayer:'player',servers:'Relay servers',online:'online',offline:'offline',ago:'min ago',team:'CREW',noTeam:'Only you so far. Send the link to your players.',observer:'watching',initiative:'INITIATIVE',round:'Round',noCombat:'The GM has not shared initiative yet.',rolls:'ROLLS',noRolls:'No rolls yet. Rolls from sheets and the Dice page show up here for everyone.',broadcast:'Show my rolls to others',toasts:'Pop-up notices for other people\'s rolls',connecting:'Connecting…',noNetwork:'No relay server reachable. Check your connection — it reconnects automatically.',crit:'CRIT',fumble:'FUMBLE',unsupported:'This browser cannot encrypt room traffic. Please update it.',hp:'HP',hum:'HUM',luck:'LUCK',sp:'SP',head:'head',body:'body',turn:'acting',gmBadge:'GM',newCode:'A new room code will be generated.',tip:'Tip: add the site to your phone\'s home screen so the room opens like an app.'}};

let app=null,session=null,transport=null,key=null,base='',members=new Map(),combat=null,feed=[],netStatus={total:0,online:0},heartbeat=null,changeTimer=null,lastMember='',lastCombat='',pendingCode=null,joining=false;

const lang=()=>{try{return app?.getState?.().lang==='en'?'en':'ru'}catch{return 'ru'}};
const t=k=>T[lang()][k]??T.ru[k]??k;
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clip=(s,n)=>String(s??'').slice(0,n);
const int=(v,lo=-999,hi=9999)=>{const n=Math.round(Number(v));return Number.isFinite(n)?Math.max(lo,Math.min(hi,n)):0};
const rand=n=>{const a=new Uint8Array(n);global.crypto.getRandomValues(a);return a};
const hex=b=>Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');

function normalizeCode(raw){const s=String(raw||'').toUpperCase().replace(/[^A-Z0-9]/g,'');return s.length===12&&[...s].every(ch=>ALPHABET.includes(ch))?s:null}
function formatCode(c){return c?c.slice(0,4)+'-'+c.slice(4,8)+'-'+c.slice(8):''}
function newCode(){return Array.from(rand(12),b=>ALPHABET[b%ALPHABET.length]).join('')}
function roomLink(code){const loc=global.location;return loc.origin+loc.pathname+'#/room/'+formatCode(code)}

async function deriveRoom(code){
 const subtle=global.crypto?.subtle;if(!subtle)throw Error('no_crypto');
 const digest=new Uint8Array(await subtle.digest('SHA-256',te.encode('ncred-topic-v1:'+code)));
 const material=await subtle.importKey('raw',te.encode(code),'PBKDF2',false,['deriveKey']);
 const aes=await subtle.deriveKey({name:'PBKDF2',salt:te.encode('ncred-room-v1'),iterations:120000,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
 return {topic:'ncred/v1/'+hex(digest).slice(0,24),key:aes};
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
 return {name:clip(session.name,40),role:session.role,character:characterSummary(c)};
}
function combatPayload(){
 if(session.role!=='gm'||!session.campaignId)return null;
 const st=app?.getState?.(),camp=st?.campaigns?.find(x=>x.id===session.campaignId);if(!camp)return null;
 const roster=[...(camp.roster||[])].sort((a,b)=>{let n=(Number(b.initiative)||0)-(Number(a.initiative)||0);if(n)return n;const x=a.ties||[],y=b.ties||[];for(let i=0;i<Math.max(x.length,y.length);i++){n=(Number(y[i])||0)-(Number(x[i])||0);if(n)return n}return (Number(a.order)||0)-(Number(b.order)||0)});
 const turn=int(camp.turnIndex,0,500);
 return {campaign:clip(camp.name,80),round:int(camp.round||1,1,9999),order:roster.slice(0,40).map((r,i)=>({name:clip(r.kind==='pc'?(st.characters.find(c=>c.id===r.characterId)?.name||'?'):r.name,60),pc:r.kind==='pc',init:int(r.initiative),current:i===turn}))};
}

/* ---------- Networking ---------- */
async function send(sub,type,data,retain=false){
 if(!transport||!key)return;
 try{transport.publish(sub,await seal({v:1,id:hex(rand(8)),from:session.memberId,t:type,at:Date.now(),d:data}),retain)}catch{}
}
function publishMember(force=false){if(!session)return;const d=memberPayload(),s=JSON.stringify(d);if(!force&&s===lastMember)return;lastMember=s;self(d);send('m/'+session.memberId,'member',d,true)}
function publishCombat(force=false){
 if(!session||session.role!=='gm')return;const d=combatPayload(),s=JSON.stringify(d);if(!force&&s===lastCombat)return;lastCombat=s;
 if(d){combat={...d,from:session.memberId,at:Date.now()};send('c','combat',d,true)}
 else{combat=null;transport?.publish('c',new Uint8Array(0),true)}
 refresh();
}
function self(d){members.set(session.memberId,{...d,at:Date.now(),me:true});refresh()}
const seen=new Set();
async function receive(p){
 const sub=p.topic.slice(base.length+1);
 if(!p.payload.length){ // a cleared retained message: member left or GM stopped sharing
  if(sub.startsWith('m/')){const id=sub.slice(2);if(id!==session?.memberId){members.delete(id);refresh()}}
  else if(sub==='c'){combat=null;refresh()}
  return;
 }
 let m;try{m=await open(p.payload)}catch{return}
 if(!m||m.v!==1||typeof m.id!=='string'||seen.has(m.id)||typeof m.from!=='string'||m.from.length>40||!m.d||typeof m.d!=='object')return;
 seen.add(m.id);if(seen.size>2000)seen.clear();
 if(m.from===session.memberId)return;
 const at=Math.min(int(m.at,0,Number.MAX_SAFE_INTEGER),Date.now()),when=p.retain?at:Date.now();
 if(m.t==='member'&&sub==='m/'+m.from){
  if(Date.now()-at>FORGET_AFTER)return;
  if(!members.has(m.from)&&members.size>=MAX_MEMBERS)return;
  const d=m.d;
  members.set(m.from,{name:clip(d.name,40)||'?',role:d.role==='gm'?'gm':'player',character:cleanSummary(d.character),at:when});
  refresh();
 }else if(m.t==='combat'&&sub==='c'){
  const d=m.d;if(!Array.isArray(d.order))return;
  combat={campaign:clip(d.campaign,80),round:int(d.round,1,9999),order:d.order.slice(0,40).map(r=>({name:clip(r?.name,60),pc:!!r?.pc,init:int(r?.init),current:!!r?.current})),from:m.from,at:when};
  refresh();
 }else if(m.t==='roll'&&sub==='e'){
  const d=m.d,item={who:clip(d.who,40),character:clip(d.character,60),label:clip(d.label,80),detail:clip(d.detail,200),total:int(d.total,-999,9999),crit:['crit','fumble'].includes(d.crit)?d.crit:'',at:Date.now(),mine:false};
  feed.unshift(item);feed=feed.slice(0,MAX_FEED);refresh();
  if(session.toasts!==false)toast(item);
  const known=members.get(m.from);if(known){known.at=Date.now()}
 }
}
async function connect(){
 if(!session)return;
 disconnect(false);
 try{({topic:base,key}=await deriveRoom(session.code))}catch{app?.notify?.(t('unsupported'));session=null;saveSession();refresh();return}
 members=new Map();combat=null;feed=[];lastMember='';lastCombat='';
 transport=global.RoomTransport.create({topic:base,brokers:brokers(),onMessage:p=>{receive(p)},onStatus:s=>{const was=netStatus.online;netStatus=s;if(s.online>was){publishMember(true);publishCombat(true)}refresh()}});
 publishMember(true);publishCombat(true);
 heartbeat=setInterval(()=>{publishMember(true);if(session?.role==='gm')publishCombat(true);refresh()},HEARTBEAT);
 refresh();
}
function disconnect(clear=true){
 clearInterval(heartbeat);heartbeat=null;
 if(transport&&clear&&session){transport.publish('m/'+session.memberId,new Uint8Array(0),true);if(session.role==='gm')transport.publish('c',new Uint8Array(0),true)}
 const tr=transport;transport=null;key=null;
 if(tr)setTimeout(()=>tr.close(),clear?400:0);
}

/* ---------- UI ---------- */
function toast(item){
 let box=doc.querySelector('.room-toasts');if(!box){box=doc.createElement('div');box.className='room-toasts';box.setAttribute('aria-live','polite');doc.body.appendChild(box)}
 const el=doc.createElement('div');el.className='room-toast '+(item.crit||'');
 el.innerHTML=`<b>${esc(item.total)}</b><span><strong>${esc(item.who)}${item.character?' · '+esc(item.character):''}</strong>${esc(item.label)}${item.crit?` · ${esc(t(item.crit))}`:''}</span>`;
 box.prepend(el);while(box.children.length>3)box.lastChild.remove();
 setTimeout(()=>{el.classList.add('out');setTimeout(()=>el.remove(),400)},5200);
}
function roleName(id){const r=global.ROLES?.find?.(x=>x.id===id);return r?.name?.[lang()]||id||''}
function woundOf(c){return c.hp<1?'mortal':c.hp<Math.ceil(c.max/2)?'serious':c.hp<c.max?'light':'full'}
function presence(m){if(m.me)return `<span class="room-dot on"></span>${esc(t('you'))}`;const age=Date.now()-m.at;return age<ONLINE_FOR?`<span class="room-dot on"></span>${esc(t('online'))}`:`<span class="room-dot"></span>${esc(t('offline'))} · ${Math.max(1,Math.round(age/60000))} ${esc(t('ago'))}`}
function memberCard(id,m){
 const c=m.character;
 const head=`<div class="room-member-head"><strong>${esc(m.name)}</strong>${m.role==='gm'?`<span class="room-badge">${esc(t('gmBadge'))}</span>`:''}<small>${presence(m)}</small></div>`;
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
 return `<div class="room-banner ${netStatus.online?'ok':'bad'}"><div><small>${esc(t('room'))}</small><strong class="room-code">${esc(formatCode(session.code))}</strong></div><div class="room-banner-actions"><button type="button" class="btn primary" data-room-action="copy">⧉ ${esc(t('copy'))}</button>${global.navigator?.share?`<button type="button" class="btn ghost" data-room-action="share">↗ ${esc(t('share'))}</button>`:''}<button type="button" class="btn ghost" data-room-action="leave">✕ ${esc(t('leave'))}</button></div><p class="room-net"><span class="room-dot ${netStatus.online?'on':''}"></span>${esc(t('servers'))}: ${net}${netStatus.total&&!netStatus.online?` — ${esc(t('noNetwork'))}`:''}</p></div>
 <section class="card room-me"><div class="card-heading"><span>${esc(t('you'))}: ${esc(session.name)} · ${esc(t(session.role==='gm'?'asGM':'asPlayer'))}</span><span>SETTINGS</span></div><div class="room-me-grid"><label class="field">${esc(t('character'))}${charSelect}</label>${campSelect}</div><label class="room-check"><input type="checkbox" data-room-field="broadcast" ${session.broadcastRolls!==false?'checked':''}> ${esc(t('broadcast'))}</label><label class="room-check"><input type="checkbox" data-room-field="toasts" ${session.toasts!==false?'checked':''}> ${esc(t('toasts'))}</label></section>
 <div class="room-columns"><section class="card room-team"><div class="card-heading"><span>${esc(t('team'))}</span><span>${list.length}</span></div>${list.length>1?'':`<p class="room-muted">${esc(t('noTeam'))}</p>`}<div class="room-members">${list.map(([id,m])=>memberCard(id,m)).join('')}</div></section>
 <div class="room-side"><section class="card room-combat"><div class="card-heading"><span>${esc(t('initiative'))}</span><span>${combat?`${esc(t('round'))} ${combat.round}`:'—'}</span></div>${combat?`<p class="room-muted">${esc(combat.campaign)}</p><ol class="room-order">${combat.order.map(r=>`<li class="${r.current?'current':''} ${r.pc?'pc':'npc'}"><b>${r.init}</b><span>${esc(r.name)}</span>${r.current?`<em>${esc(t('turn'))}</em>`:''}</li>`).join('')}</ol>`:`<p class="room-muted">${esc(t('noCombat'))}</p>`}</section>
 <section class="card room-feed"><div class="card-heading"><span>${esc(t('rolls'))}</span><span>${feed.length}</span></div>${feed.length?`<ol class="room-rolls">${feed.map(r=>`<li class="${r.crit} ${r.mine?'mine':''}"><b class="room-roll-total">${esc(r.total)}</b><div><strong>${esc(r.who)}${r.character?` · ${esc(r.character)}`:''}</strong><span>${esc(r.label)}${r.crit?` · <em>${esc(t(r.crit))}</em>`:''}</span><small>${esc(r.detail)} · ${new Date(r.at).toLocaleTimeString(lang()==='ru'?'ru-RU':'en-GB',{hour:'2-digit',minute:'2-digit'})}</small></div></li>`).join('')}</ol>`:`<p class="room-muted">${esc(t('noRolls'))}</p>`}</section></div></div>`;
}
function inner(){
 return `<div class="page-header"><div><div class="overline">${esc(t('over'))}</div><h1>${esc(t('title'))}</h1><p>${esc(t('lead'))}</p></div></div>${session?roomView():joinForms()}<div class="source-strip room-how"><div class="source-symbol">⌬</div><div><strong>${lang()==='ru'?'КАК ЭТО РАБОТАЕТ':'HOW IT WORKS'}</strong><p>${esc(t('how'))} ${esc(t('tip'))}</p></div></div>`;
}
function render(){return `<div id="room-root">${inner()}</div>`}
function refresh(){
 const root=doc.querySelector('#room-root');
 if(root){
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
  session={code:next.code,role:next.role,name:next.name,characterId:next.characterId||'',campaignId:next.campaignId||'',memberId:hex(rand(8)),broadcastRolls:true,toasts:true};
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
});
// Capture a shared room link before the router normalizes the address.
function captureCode(){const m=/^#\/room\/([A-Za-z0-9-]{12,20})$/.exec(global.location?.hash||'');const code=m&&normalizeCode(m[1]);if(code&&code!==session?.code){pendingCode=code;refresh()}}
captureCode();
global.addEventListener?.('popstate',captureCode);
global.addEventListener?.('hashchange',captureCode);
global.addEventListener?.('online',()=>transport?.wake());
doc.addEventListener?.('visibilitychange',()=>{if(doc.visibilityState==='visible'&&session){transport?.wake();publishMember(true)}});

global.Room={
 attach(api){app=api;session=loadSession();if(pendingCode&&session&&pendingCode===session.code)pendingCode=null;refresh();if(session)connect()},
 render,pill:renderPill,label:()=>t('nav'),
 changed(){if(!session)return;clearTimeout(changeTimer);changeTimer=setTimeout(()=>{publishMember();publishCombat()},400)},
 roll({label,detail,total,character}){
  if(!session)return;
  const text=String(detail||''),crit=/Критический успех|Critical Success/i.test(text)?'crit':/Критический провал|Critical Failure/i.test(text)?'fumble':'';
  const item={who:clip(session.name,40),character:clip(character,60),label:clip(label,80),detail:clip(text,200),total:int(total,-999,9999),crit};
  feed.unshift({...item,at:Date.now(),mine:true});feed=feed.slice(0,MAX_FEED);refresh();
  if(session.broadcastRolls!==false)send('e','roll',item,false);
 },
 active:()=>!!session,
 _test:{normalizeCode,formatCode,newCode,deriveRoom,characterSummary,cleanSummary,setKey:k=>{key=k},seal,open},
};
})(window);
