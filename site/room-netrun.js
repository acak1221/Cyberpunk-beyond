/* «Показать нетраннеру»: the Game Master shows one run through a net architecture to ONE player of a room, and the player's
   NETRUN tab draws what that player would know: the way down, the floor they stand on and its records as targets.

   Who can read it. Everything in a room is sealed with the room key (and, in a room with a waiting room, with the second key
   of room-gate.js), so every member can read every ordinary message. The view is therefore sealed a second time (room.js
   sealFor: ephemeral ECDH P-256 + AES-GCM) to the «box» key that the chosen player's open page announces, exactly like a
   whisper (room-whispers.js). The envelope names that member, so everybody else sees THAT a run was shown to someone and when,
   never what; a third member's page cannot open the box. The message is retained on the subtopic 'n' (type 'netrun') so that a
   player who reloads gets it back, and the Game Master repeats it now and then and whenever the player's page announces a new
   key. Stopping the share, a different runner, a runner who left, a Game Master who leaves: the retained copy is replaced by
   an empty marker, and a view that is not renewed for a quarter of an hour is dropped by the player's page itself.

   What is in it, and what is not. The view is built on the Game Master's device from the saved architecture, field by field
   (build): only floors the Game Master revealed (by default the floor the runner is on and the floors already passed, see
   architecture.seen), and on those only records marked revealed, each with its kind, whether it is open or derezzed, and the
   player-facing label the Game Master typed (record.rl). A record that is not revealed is sent as «unknown» with nothing else.
   Never sent: the name of the architecture (only a public title the Game Master types: architecture.pub), notes, the name of
   a record, ICE statistics, floors that are not revealed, the tree beyond the revealed floors, and DV unless the Game Master
   ticked «show the DV» for that one record (record.sd). The DV stays on the Game Master's device: a player's roll carries
   none, and the Game Master presses success or failure next to the record.

   Back from the player (type 'netrun-up', sealed to the Game Master's box the same way): the roll the player made on a target
   (which target, which ability, the total) and the answer to a proposal. Program damage and «−1 NET Action» travel the other
   way as proposals inside the view; they change nothing until the player accepts, and then the player's own device changes
   the player's own sheet. Everything received is rebuilt from known fields with limits (clean, cleanUp); anything else is dropped.
   Optional fields on the architecture (all read as absent in old saves): pub, seen, floor.rv, record.rv, record.rl, record.sd. */
(function(global){
'use strict';
const doc=global.document;
const ID=/^[A-Za-z0-9_-]{1,64}$/,HEX=/^[0-9a-f]{16}$/,FP=/^[0-9a-f]{24}$/,CAT=/^extra-program-[a-z0-9-]{1,40}$/;
const KINDS=['password','file','control','ice','other'],LOCKS=['password','file','control'],STATES=['o','c','d'];
const ABILITIES=['Backdoor','Cloak','Control','Eye-Dee','Pathfinder','Scanner','Slide','Virus','Zap'];
const MAX_FLOORS=40,MAX_ENTRIES=20,MAX_LABEL=60,MAX_TITLE=80,MAX_RES=8,MAX_PROP=8,MAX_BYTES=24000,MAX_INBOX=20,MAX_REZ=99;
const TTL=15*60*1000,RESEND=120000,PROP_TTL=3600000,EVENT_WINDOW=600000,DEBOUNCE=250;
const T={
 ru:{title:'АРХИТЕКТУРА',gmTitle:'ПОКАЗАТЬ НЕТРАННЕРУ',untitled:'Архитектура',unknown:'неизвестно',target:n=>`Цель ${n}`,floor:n=>`Этаж ${n}`,onFloor:(n,d)=>`цель ${n} на этаже ${d}`,
  kinds:{password:'Пароль',file:'Файл',control:'Узел управления',ice:'Black ICE',other:'Другое'},states:{o:'открыто',c:'закрыто',d:'Derezzed'},dv:'DV',
  path:'Путь',here:'вы здесь',pickTarget:'Выберите цель, затем способность. Бросок идёт без DV: результат увидит ведущий и сам скажет, получилось ли.',
  noTargets:'На этом этаже ведущий пока ничего не показал.',ability:'Способность',pressed:'Выбрана',needTarget:'Сначала выберите цель.',
  last:(ab,t,total)=>`${ab} → ${t}: ${total}`,sentOk:'Результат отправлен ведущему.',sentNo:'Ведущий сейчас недоступен: бросок остался только в вашей истории.',
  answer:{y:'Ведущий: получилось',n:'Ведущий: не получилось'},proposals:'Предложения ведущего',
  rez:(p,n)=>`Программа ${p}: REZ −${n}`,net:'−1 NET-действие на следующий ход',accept:'Принять',acceptTo:(name,a,b)=>`Принять: ${name} (REZ ${a} → ${b})`,decline:'Отклонить',
  noProgram:'У вас нет подходящей активной программы: принять предложение нельзя.',applied:'Принято.',declined:'Отклонено.',undo:'Отменить',undone:'Возвращено.',stale:'Данные изменились. Повторите действие.',
  invalid:'Новое состояние деки не прошло проверку: ничего не изменено.',
  gmNoRoom:'Комната не открыта: показывать некому. Создайте комнату на странице «Игра онлайн».',gmPlayer:'Показывать забег может только ведущий комнаты.',
  pubTitle:'Публичное название для игрока',pubHelp:'Название самой архитектуры игроку не уходит: только то, что вы впишете здесь.',
  runner:'Кто нетраннер',noPeers:'В комнате нет игроков, которым можно показать забег.',choose:'Выберите игрока',offline:'не в сети',
  share:'Показать нетраннеру',stop:'Остановить показ',sharing:n=>`Показано игроку ${n}. Другие участники комнаты не читают содержимое.`,stopped:'Показ остановлен: игрок больше не видит забег.',started:'Игрок увидит архитектуру на вкладке NETRUN.',
  summary:(f,e,u,d)=>`Игроку видно: этажей ${f}, записей ${e} (из них неизвестных ${u}), DV показывается у ${d}.`,preview:'Что именно уходит игроку',previewHelp:'Это содержимое сообщения целиком. Названия, заметки, DV (кроме отмеченных), характеристики ICE и скрытые этажи сюда не попадают.',
  rvFloor:'Этаж виден игроку',rvAuto:'по ходу прохода',rvShow:'показан',rvHide:'скрыт',rvEntry:'Для нетраннера',rvShown:'Показать запись игроку',rvLabel:'Подпись для игрока',rvLabelPh:'Что игрок видит вместо названия',rvDv:'Показывать DV игроку',
  incoming:'Бросок нетраннера',vsDv:(t,dv)=>`${t} против DV ${dv}: ${t>dv?'выше DV':'не выше DV'}`,noDv:t=>`${t} (у записи нет DV)`,ok:'Получилось',no:'Не получилось',
  rollSaid:(who,ab,t)=>`${who}: ${ab} → ${t}`,propose:'Предложить нетраннеру',proposeRez:n=>`Отправить игроку: REZ −${n}`,proposeNet:'Отправить игроку: −1 NET-действие',proposed:'Предложение отправлено.',propNoShare:'Сначала покажите забег игроку.',
  pickProg:'Программа игрока',anyProg:'Не выбрана',
  inboxTitle:n=>`Броски нетраннера: ${n}`,inboxLabel:'Броски нетраннера, ожидающие ответа',inboxOpen:'Открыть NET',inboxDrop:'Убрать',inboxDropAria:'Убрать бросок без ответа',inboxGone:'Этаж или запись больше не существуют: бросок убран.',inboxDone:'Ответ записан.',inboxUndone:'Ответ отменён.',inboxUndo:'Отменить',inboxWhere:(pos,d)=>`цель ${pos}, этаж ${d}`},
 en:{title:'ARCHITECTURE',gmTitle:'SHOW TO THE NETRUNNER',untitled:'Architecture',unknown:'unknown',target:n=>`Target ${n}`,floor:n=>`Floor ${n}`,onFloor:(n,d)=>`target ${n} on floor ${d}`,
  kinds:{password:'Password',file:'File',control:'Control node',ice:'Black ICE',other:'Other'},states:{o:'open',c:'closed',d:'Derezzed'},dv:'DV',
  path:'Path',here:'you are here',pickTarget:'Pick a target, then an ability. The roll carries no DV: the Game Master sees the result and says whether it worked.',
  noTargets:'The Game Master has not shown anything on this floor yet.',ability:'Ability',pressed:'Selected',needTarget:'Pick a target first.',
  last:(ab,t,total)=>`${ab} → ${t}: ${total}`,sentOk:'The result was sent to the Game Master.',sentNo:'The Game Master is not reachable now: the roll stays in your history only.',
  answer:{y:'Game Master: it worked',n:'Game Master: it did not work'},proposals:'Proposals from the Game Master',
  rez:(p,n)=>`Program ${p}: REZ −${n}`,net:'−1 NET Action next turn',accept:'Accept',acceptTo:(name,a,b)=>`Accept: ${name} (REZ ${a} → ${b})`,decline:'Decline',
  noProgram:'You have no matching rezzed program: the proposal cannot be accepted.',applied:'Accepted.',declined:'Declined.',undo:'Undo',undone:'Restored.',stale:'Data changed. Try again.',
  invalid:'The new state of the deck failed validation: nothing was changed.',
  gmNoRoom:'No room is open: there is nobody to show it to. Create a room on the “Online play” page.',gmPlayer:'Only the Game Master of the room can show a run.',
  pubTitle:'Public title for the player',pubHelp:'The name of the architecture itself is not sent: only what you type here.',
  runner:'Who is the netrunner',noPeers:'No players in the room to show the run to.',choose:'Choose a player',offline:'offline',
  share:'Show to the netrunner',stop:'Stop showing',sharing:n=>`Shown to ${n}. The other members of the room cannot read the content.`,stopped:'Sharing stopped: the player no longer sees the run.',started:'The player will see the architecture on the NETRUN tab.',
  summary:(f,e,u,d)=>`The player sees: floors ${f}, records ${e} (unknown among them ${u}), DV shown on ${d}.`,preview:'What exactly is sent to the player',previewHelp:'This is the whole content of the message. Names, notes, DV (except the ticked ones), ICE statistics and hidden floors never get here.',
  rvFloor:'Floor visible to the player',rvAuto:'as the run goes',rvShow:'shown',rvHide:'hidden',rvEntry:'For the netrunner',rvShown:'Show this record to the player',rvLabel:'Label for the player',rvLabelPh:'What the player sees instead of the name',rvDv:'Show the DV to the player',
  incoming:'Netrunner roll',vsDv:(t,dv)=>`${t} against DV ${dv}: ${t>dv?'above the DV':'not above the DV'}`,noDv:t=>`${t} (the record has no DV)`,ok:'It worked',no:'It did not work',
  rollSaid:(who,ab,t)=>`${who}: ${ab} → ${t}`,propose:'Propose to the netrunner',proposeRez:n=>`Send to the player: REZ −${n}`,proposeNet:'Send to the player: −1 NET Action',proposed:'Proposal sent.',propNoShare:'Show the run to the player first.',
  pickProg:'Program of the player',anyProg:'Not chosen',
  inboxTitle:n=>`Netrunner rolls: ${n}`,inboxLabel:'Netrunner rolls waiting for an answer',inboxOpen:'Open NET',inboxDrop:'Dismiss',inboxDropAria:'Dismiss the roll without an answer',inboxGone:'The floor or the record no longer exists: the roll was removed.',inboxDone:'Answer saved.',inboxUndone:'Answer undone.',inboxUndo:'Undo',inboxWhere:(pos,d)=>`target ${pos}, floor ${d}`}
};
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const obj=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
const lng=l=>l==='en'?'en':'ru';
const lang=()=>{try{return lng(global.App?.lang?.())}catch{return 'ru'}};
const enc=typeof TextEncoder!=='undefined'?new TextEncoder():null;
const size=s=>enc?enc.encode(s).length:s.length*3;
const int=(v,lo,hi)=>Number.isSafeInteger(v)&&v>=lo&&v<=hi;
const line=(v,n)=>typeof v==='string'?v.replace(/[\u0000-\u001f\u007f\u2028\u2029]/g,' ').replace(/\s+/g,' ').trim().slice(0,n).trim():'';
const hex8=()=>{const a=new Uint8Array(8);global.crypto.getRandomValues(a);return Array.from(a,x=>x.toString(16).padStart(2,'0')).join('')};
const link=()=>{try{return global.Room?.netrunLink||null}catch{return null}};
const whoIs=()=>{try{const w=link()?.who?.();return obj(w)?w:null}catch{return null}};
const appState=()=>{try{return global.App?.getState?.()||null}catch{return null}};
const say=m=>{try{global.App?.notify?.(m)}catch{}};
const abilityNames=()=>{try{const l=global.RoleTools?.data?.netAbilities;const n=Array.isArray(l)?l.filter(a=>Array.isArray(a)&&typeof a[0]==='string').map(a=>a[0]):[];return n.length?n:ABILITIES}catch{return ABILITIES}};

/* ---------- The view: what leaves the Game Master's device ---------- */
const entriesOf=f=>Array.isArray(f?.entries)?f.entries.filter(e=>obj(e)):[];
// The floors as a tree (net-editor.js); without it, one straight list.
function treeOf(a){
 if(typeof global.NetEditor?.tree==='function')return global.NetEditor.tree(a);
 const list=[],nodes=new Map();
 (Array.isArray(a?.floors)?a.floors:[]).forEach((floor,index)=>{if(!obj(floor)||nodes.has(floor.id))return;const n={floor,index,depth:list.length+1,parent:list[list.length-1]||null,children:[]};list.push(n);nodes.set(floor.id,n)});
 return {roots:list.slice(0,1),nodes,list,order:list.map(n=>n.floor)};
}
// A wire id is the saved id when it is a plain token, else a name made from the place; the same on both ends of one reading.
const wid=(id,prefix,index)=>typeof id==='string'&&ID.test(id)?id:prefix+index;
const stateCode=e=>e.state==='open'?'o':e.state==='derezzed'||e.state==='destroyed'?'d':'c';
// Which floors a player may see: the one the runner is on, the floors passed, those the Game Master turned on; never one turned off.
// The floor the runner stands on is still named (the path needs it), but when the Game Master turned it off it carries no records at all.
function shownFloors(a,t){
 const here=(t.nodes.get(a?.runAt)||t.roots[0])?.floor?.id,seen=new Set(Array.isArray(a?.seen)?a.seen:[]),out=new Set();
 let hideHere=false;
 for(const n of t.list){const f=n.floor;if(f.id===here){out.add(f.id);hideHere=f.rv===false}else if(f.rv!==false&&(f.rv===true||seen.has(f.id)))out.add(f.id)}
 return {ids:out,here,hideHere};
}
function entryWire(e,index){
 const i=wid(e.id,'e',index);
 // A record that is not revealed is «unknown»: no kind, no state, nothing.
 if(e.rv!==true)return {i,u:1};
 const o={i,k:KINDS.includes(e.type)?e.type:'other',s:stateCode(e)},label=line(e.rl,MAX_LABEL);
 if(label)o.l=label;
 if(e.sd===true&&LOCKS.includes(e.type)&&int(e.dv,0,999))o.dv=e.dv;
 return o;
}
// -> the plain view (no addressing) or null when the architecture has no floor to show.
function build(a,share){
 if(!obj(a))return null;
 const t=treeOf(a);if(!t.list.length)return null;
 const sh=shownFloors(a,t);if(!sh.here)return null;
 const floors=[],wf=new Map();
 for(const n of t.list){if(!sh.ids.has(n.floor.id))continue;wf.set(n.floor.id,wid(n.floor.id,'f',n.index))}
 for(const n of t.list){
  if(!wf.has(n.floor.id)||floors.length>=MAX_FLOORS)continue;
  let up=n.parent;while(up&&!wf.has(up.floor.id))up=up.parent;
  floors.push({i:wf.get(n.floor.id),d:Math.max(1,Math.min(99,n.depth)),p:up?wf.get(up.floor.id):'',e:sh.hideHere&&n.floor.id===sh.here?[]:entriesOf(n.floor).slice(0,MAX_ENTRIES).map((e,j)=>entryWire(e,j))});
 }
 const cur=wf.get(sh.here);if(!cur||!floors.some(f=>f.i===cur))return null;
 const out={floors,cur},title=line(a.pub,MAX_TITLE);
 if(title)out.title=title;
 out.res=(share?.res||[]).slice(0,MAX_RES).map(r=>({e:r.e,...(r.rid?{rid:r.rid}:{}),ok:r.ok}));
 const now=Date.now();out.prop=(share?.prop||[]).filter(p=>now-p.t<PROP_TTL).slice(0,MAX_PROP).map(p=>({i:p.i,k:p.k,n:p.n,...(p.c?{c:p.c}:{}),t:p.t}));
 // Past the size cap the deepest floors go first, never the one the runner is on.
 while(size(JSON.stringify(out))>MAX_BYTES){let k=-1;for(let i=out.floors.length-1;i>=0;i--)if(out.floors[i].i!==cur){k=i;break}if(k<0)return null;out.floors.splice(k,1)}
 for(const f of out.floors)if(f.p&&!out.floors.some(x=>x.i===f.p))f.p='';
 return out;
}

/* ---------- What a player's page accepts ---------- */
const time=v=>Number.isSafeInteger(v)&&v>0?v:0;
function clean(o,{to,from}={}){
 if(!obj(o)||o.v!==1||typeof o.id!=='string'||!HEX.test(o.id)||o.to!==to||o.gm!==from||typeof to!=='string'||typeof from!=='string'||!FP.test(from))return null;
 const ids=new Set(),floors=[];
 for(const f of Array.isArray(o.floors)?o.floors.slice(0,MAX_FLOORS):[]){
  if(!obj(f)||typeof f.i!=='string'||!ID.test(f.i)||ids.has(f.i)||!int(f.d,1,99))continue;
  const seen=new Set(),entries=[];
  for(const e of Array.isArray(f.e)?f.e.slice(0,MAX_ENTRIES):[]){
   if(!obj(e)||typeof e.i!=='string'||!ID.test(e.i)||seen.has(e.i))continue;seen.add(e.i);
   if(e.u===1){entries.push({i:e.i,u:true});continue}
   if(!KINDS.includes(e.k)||!STATES.includes(e.s))continue;
   const x={i:e.i,k:e.k,s:e.s},l=line(e.l,MAX_LABEL);if(l)x.l=l;
   if(LOCKS.includes(e.k)&&int(e.dv,0,999))x.dv=e.dv;
   entries.push(x);
  }
  ids.add(f.i);floors.push({i:f.i,d:f.d,p:typeof f.p==='string'&&ID.test(f.p)?f.p:'',e:entries});
 }
 for(const f of floors)if(f.p&&(f.p===f.i||!ids.has(f.p)))f.p='';
 if(typeof o.cur!=='string'||!ids.has(o.cur))return null;
 const out={id:o.id,title:line(o.title,MAX_TITLE),cur:o.cur,floors,res:[],prop:[]},known=new Set();
 for(const f of floors)for(const e of f.e)known.add(e.i);
 for(const r of Array.isArray(o.res)?o.res.slice(0,MAX_RES):[])if(obj(r)&&typeof r.e==='string'&&known.has(r.e)&&typeof r.ok==='boolean')out.res.push({e:r.e,...(typeof r.rid==='string'&&HEX.test(r.rid)?{rid:r.rid}:{}),ok:r.ok});
 const pids=new Set();
 for(const p of Array.isArray(o.prop)?o.prop.slice(0,MAX_PROP):[]){
  if(!obj(p)||typeof p.i!=='string'||!HEX.test(p.i)||pids.has(p.i))continue;
  if(p.k==='net'){pids.add(p.i);out.prop.push({i:p.i,k:'net',n:1,t:time(p.t)});continue}
  if(p.k==='rez'&&int(p.n,1,MAX_REZ)&&typeof p.c==='string'&&CAT.test(p.c)&&catalogProgram(p.c)){pids.add(p.i);out.prop.push({i:p.i,k:'rez',n:p.n,c:p.c,t:time(p.t)})}
 }
 return out;
}
// What the Game Master's page accepts from the runner: a roll on a target or an answer to a proposal.
function cleanUp(o,{to,from}={}){
 if(!obj(o)||o.v!==1||o.to!==to||o.from!==from||typeof to!=='string'||typeof from!=='string'||!FP.test(from)||typeof o.run!=='string'||!HEX.test(o.run))return null;
 if(o.k==='roll'){
  if(typeof o.f!=='string'||!ID.test(o.f)||typeof o.e!=='string'||!ID.test(o.e)||!abilityNames().includes(o.ab)||!int(o.total,-99,999)||typeof o.rid!=='string'||!HEX.test(o.rid))return null;
  return {k:'roll',run:o.run,f:o.f,e:o.e,ab:o.ab,total:o.total,rid:o.rid};
 }
 if(o.k==='ack'){if(typeof o.p!=='string'||!HEX.test(o.p))return null;return {k:'ack',run:o.run,p:o.p,ok:o.ok===true}}
 return null;
}
function catalogProgram(id){const all=global.CATALOG;if(!Array.isArray(all))return typeof id==='string';return all.find(p=>obj(p)&&p.id===id&&p.category==='programs')||null}
const catName=(id,l)=>{const p=catalogProgram(id);return p&&obj(p)?String(p.name?.[l]||p.name?.en||id):String(id)};

/* ---------- The Game Master's side ---------- */
let share=null,chain=Promise.resolve(),roomKey='',timer=null,draft={fp:'',title:''},preview=false;
const inbox=[],seenRolls=new Set();
/* The inbox of the runner's rolls is kept for the session (sessionStorage, this tab only, never sent anywhere): a reload of the page, a move
   of the runner to another floor or leaving #/net does not lose a roll that still waits for an answer. It belongs to one room and is dropped
   when the Game Master leaves the room (forget) or enters a different one. Everything read back is rebuilt field by field. */
const INBOX_KEY='nc-netrun-inbox';
const inboxStore=()=>{try{return global.sessionStorage||null}catch{return null}};
function persist(){
 try{const s=inboxStore();if(!s)return;if(!roomKey||!inbox.length){s.removeItem(INBOX_KEY);return}
  s.setItem(INBOX_KEY,JSON.stringify({v:1,room:roomKey,items:inbox.slice(-MAX_INBOX),seen:[...seenRolls].slice(-200)}))}catch{}
}
function cleanInbox(raw,room){
 let o;try{o=JSON.parse(raw)}catch{return null}
 if(!obj(o)||o.v!==1||o.room!==room||!Array.isArray(o.items))return null;
 const tok=x=>typeof x==='string'&&x.length>0&&x.length<=160,items=[];
 for(const r of o.items.slice(-MAX_INBOX)){
  if(!obj(r)||typeof r.id!=='string'||!HEX.test(r.id)||!tok(r.arch)||!tok(r.floor)||!tok(r.entry)||!ABILITIES.includes(r.ab)||!int(r.total,-99,999)||!int(r.pos,1,999)||!int(r.depth,1,999)||typeof r.who!=='string'||!Number.isFinite(r.at))continue;
  items.push({id:r.id,arch:r.arch,floor:r.floor,entry:r.entry,ab:r.ab,total:r.total,pos:r.pos,depth:r.depth,who:r.who.slice(0,40),at:r.at});
 }
 const seen=(Array.isArray(o.seen)?o.seen:[]).filter(x=>typeof x==='string'&&HEX.test(x)).slice(-200);
 return {items,seen};
}
function restoreInbox(room){
 try{const s=inboxStore(),raw=s?s.getItem(INBOX_KEY):null;if(!raw)return;
  const got=cleanInbox(raw,room);
  if(!got){s.removeItem(INBOX_KEY);return}
  inbox.push(...got.items);for(const x of got.seen)seenRolls.add(x);
 }catch{}
}
const archOf=(st,id)=>Array.isArray(st?.netArchitectures)?st.netArchitectures.find(x=>obj(x)&&x.id===id)||null:null;
function peers(){try{const p=link()?.peers?.();return Array.isArray(p)?p.filter(x=>obj(x)&&FP.test(x.fp||'')&&x.role!=='gm'&&obj(x.box)):[]}catch{return []}}
const peerByFp=fp=>peers().filter(p=>p.fp===fp).sort((a,b)=>(b.at||0)-(a.at||0))[0]||null;
// A moment without room information (k is empty) empties the memory only: the stored inbox waits for the room to come back.
function sync(who){const k=who?String(who.room||''):'';if(k!==roomKey){roomKey=k;share=null;inbox.length=0;seenRolls.clear();shown=null;shownAt=0;draft={fp:'',title:''};if(k)restoreInbox(k);paintInbox()}}
const clearOut=()=>{try{return Promise.resolve(link()?.send?.({clear:true},Date.now())).catch(()=>0)}catch{return Promise.resolve(0)}};
async function run(force,now){
 const who=whoIs();sync(who);if(!who||who.role!=='gm'||!share)return false;
 const a=archOf(appState(),share.arch);
 if(!a){share=null;await clearOut();return false}
 const peer=peerByFp(share.fp);
 // The runner left or was removed: the retained copy is replaced at once; it comes back if they do.
 if(!peer){if(share.state!=='cleared'){share.state='cleared';share.last='';await clearOut()}return false}
 const view=build(a,share);
 if(!view){if(share.state!=='cleared'){share.state='cleared';share.last='';await clearOut()}return false}
 const inner={v:1,id:share.id,gm:who.fp,to:peer.id,at:now,...view},body=JSON.stringify({...inner,at:0})+'|'+peer.box.x+peer.box.y;
 if(body===share.last&&!(force&&now-share.sentAt>=RESEND))return false;
 let sealed;try{sealed=await link().seal(peer.box,inner)}catch{return false}
 const n=await Promise.resolve(link().send({to:peer.id,...sealed},now)).catch(()=>0);
 if(n){share.last=body;share.sentAt=now;share.state='live'}
 return !!n;
}
// Called by room.js when the Game Master's page publishes its state (a heartbeat, a new connection, a member's new key).
function publish(force=false,now=Date.now()){chain=chain.then(()=>run(force,now)).catch(()=>false);return chain}
// The architecture changed on the desk: send it soon, once for a burst of changes.
function changed(){if(!share)return;clearTimeout(timer);timer=setTimeout(()=>{publish(false)},DEBOUNCE);timer.unref?.()}
function start(archId,fp,now=Date.now()){
 const who=whoIs();sync(who);if(!who||who.role!=='gm')return {ok:false,reason:'gm'};
 const a=archOf(appState(),archId);if(!a)return {ok:false,reason:'arch'};
 if(!peerByFp(fp))return {ok:false,reason:'peer'};
 if(!build(a,null))return {ok:false,reason:'empty'};
 // A different runner or architecture replaces the share: the new message is addressed to the new runner, so the old one stops seeing it.
 share={arch:archId,fp,id:hex8(),res:[],prop:[],last:'',sentAt:0,state:''};
 return {ok:true,done:publish(true,now)};
}
function stop(){const had=share;share=null;clearTimeout(timer);return had?clearOut():Promise.resolve(0)}
const sharing=()=>!!share;
// The room was left: nothing is shown and nothing is kept; no message is sent (room.js sent the marker before).
function forget(){share=null;clearTimeout(timer);clearTimeout(expTimer);shown=null;shownAt=0;sel='';last=null;inbox.length=0;seenRolls.clear();roomKey='';try{inboxStore()?.removeItem(INBOX_KEY)}catch{}paintInbox()}
// A roll or an answer from the runner (room.js passes the sealed box, who sent it, and this page's member id).
async function receiveUp(d,from){
 const who=whoIs();sync(who);if(!who||who.role!=='gm'||!share||!obj(d)||!obj(from)||from.fp!==share.fp)return false;
 let inner;try{inner=await link().open(d)}catch{return false}
 const o=cleanUp(inner,{to:who.memberId,from:from.fp});if(!o||o.run!==share.id)return false;
 if(o.k==='ack'){const k=share.prop.findIndex(p=>p.i===o.p);if(k<0)return false;share.prop.splice(k,1);changed();return true}
 if(seenRolls.has(o.rid))return false;
 const a=archOf(appState(),share.arch),t=a?treeOf(a):null;if(!a||!t)return false;
 const sh=shownFloors(a,t),n=t.list.find(x=>wid(x.floor.id,'f',x.index)===o.f&&sh.ids.has(x.floor.id)&&!(sh.hideHere&&x.floor.id===sh.here));if(!n)return false;
 const idx=entriesOf(n.floor).findIndex((e,j)=>wid(e.id,'e',j)===o.e);if(idx<0)return false;
 const e=entriesOf(n.floor)[idx];
 seenRolls.add(o.rid);if(seenRolls.size>200)seenRolls.clear();
 inbox.push({id:o.rid,arch:a.id,floor:n.floor.id,entry:e.id,ab:o.ab,total:o.total,pos:idx+1,depth:n.depth,who:String(peerByFp(share.fp)?.name||'').slice(0,40),at:Date.now()});
 while(inbox.length>MAX_INBOX)inbox.shift();
 persist();paintInbox();
 say(T[lang()].rollSaid(inbox[inbox.length-1].who||'—',o.ab,o.total));
 try{if(/^#\/net\b/.test(String(global.location?.hash||'')))global.App?.render?.()}catch{}
 return true;
}
// The Game Master presses «it worked» / «it did not work» next to a record.
function verdict(ok,a,floor,e,rollId){
 const k=inbox.findIndex(x=>x.id===rollId&&x.arch===a?.id&&x.floor===floor?.id&&x.entry===e?.id);if(k<0)return null;
 inbox.splice(k,1);persist();paintInbox();
 if(share&&share.arch===a.id){share.res=[{e:wid(e.id,'e',Math.max(0,entriesOf(floor).indexOf(e))),rid:rollId,ok:!!ok},...share.res.filter(r=>r.e!==wid(e.id,'e',Math.max(0,entriesOf(floor).indexOf(e))))].slice(0,MAX_RES)}
 if(ok&&LOCKS.includes(e.type))e.state='open';
 changed();return {dirty:true,rerender:true};
}
function propose(kind,{c,n}={}){
 if(!share)return {ok:false,reason:'share'};
 if(share.prop.length>=MAX_PROP)share.prop.shift();
 const p=kind==='net'?{i:hex8(),k:'net',n:1,t:Date.now()}:int(n,1,MAX_REZ)&&typeof c==='string'&&CAT.test(c)&&catalogProgram(c)?{i:hex8(),k:'rez',n,c,t:Date.now()}:null;
 if(!p)return {ok:false,reason:'bad'};
 share.prop.push(p);publish(false);return {ok:true,id:p.i};
}
// The buttons and fields of the Game Master's desk (net-editor.js and net-tools.js call these).
function act(op,b,a){
 const z=T[lang()];
 if(op==='run-rn-share'){
  const fp=String(b.closest?.('[data-rn-box]')?.querySelector?.('[data-net-rn="peer"]')?.value||draft.fp||'');draft.fp=fp;
  const r=start(a.id,fp);if(!r.ok)return {rerender:true,notify:r.reason==='peer'?z.choose:r.reason==='gm'?z.gmPlayer:z.gmNoRoom};
  return {rerender:true,notify:z.started};
 }
 if(op==='run-rn-stop'){stop();return {rerender:true,notify:z.stopped}}
 if(op==='run-rn-prop'||op==='run-rn-net'){
  if(!share||share.arch!==a.id)return {rerender:true,notify:z.propNoShare};
  const box=b.closest?.('[data-rn-prop]'),n=Number(b.dataset.n),c=String(box?.querySelector?.('[data-rn-prog]')?.value||b.dataset.c||'');
  const r=op==='run-rn-net'?propose('net'):propose('rez',{c,n});
  return {rerender:true,notify:r.ok?z.proposed:z.propNoShare};
 }
 return null;
}
// While the Game Master is still typing (an 'input' event) the text is saved but not sent: the runner gets it when the field is left.
function change(el,a,type){
 const k=el?.dataset?.netRn,z=T[lang()],typing=type==='input';
 if(k==='peer'){draft.fp=String(el.value||'').slice(0,24);return {handled:true,rerender:true}}
 if(k==='preview'){preview=el.checked===true;return {handled:true}}
 if(k==='pub'){const v=line(el.value,MAX_TITLE);if(v)a.pub=v;else delete a.pub;return {handled:true,dirty:true,quiet:typing}}
 const f=Array.isArray(a.floors)?a.floors[Number(el.dataset.index)]:null;if(!obj(f))return {handled:true};
 if(k==='floor-rv'){const v=el.value;if(v==='show')f.rv=true;else if(v==='hide')f.rv=false;else delete f.rv;changed();return {handled:true,dirty:true,rerender:true}}
 const e=Array.isArray(f.entries)?f.entries[Number(el.dataset.entry)]:null;if(!obj(e))return {handled:true};
 if(k==='e-rv'){if(el.checked)e.rv=true;else delete e.rv;changed();return {handled:true,dirty:true,rerender:true}}
 if(k==='e-sd'){if(el.checked&&LOCKS.includes(e.type))e.sd=true;else delete e.sd;changed();return {handled:true,dirty:true,rerender:true}}
 if(k==='e-rl'){const v=line(el.value,MAX_LABEL);if(v)e.rl=v;else delete e.rl;return {handled:true,dirty:true,quiet:typing}}
 void z;return {handled:true};
}
const idx=(i,n)=>`data-index="${i}" data-entry="${n}"`;
function floorHtml(a,f,index,l){
 const z=T[lng(l)],v=f.rv===true?'show':f.rv===false?'hide':'auto';
 return `<label class="field net-rn-field">${esc(z.rvFloor)}<select data-net-rn="floor-rv" data-index="${index}"><option value="auto"${v==='auto'?' selected':''}>${esc(z.rvAuto)}</option><option value="show"${v==='show'?' selected':''}>${esc(z.rvShow)}</option><option value="hide"${v==='hide'?' selected':''}>${esc(z.rvHide)}</option></select></label>`;
}
function entryHtml(a,f,e,j,index,l){
 const z=T[lng(l)],lock=LOCKS.includes(e.type);
 let h=`<details class="net-rn-entry"${e.rv===true?' open':''}><summary>${esc(z.rvEntry)}${e.rv===true?' · '+esc(z.rvShown):''}</summary><div class="net-rn-grid"><label class="rp-check net-rn-check"><input type="checkbox" data-net-rn="e-rv" ${idx(index,j)}${e.rv===true?' checked':''}> ${esc(z.rvShown)}</label><label class="field">${esc(z.rvLabel)}<input data-net-rn="e-rl" ${idx(index,j)} maxlength="${MAX_LABEL}" placeholder="${esc(z.rvLabelPh)}" value="${esc(e.rl||'')}"></label>${lock?`<label class="rp-check net-rn-check"><input type="checkbox" data-net-rn="e-sd" ${idx(index,j)}${e.sd===true?' checked':''}> ${esc(z.rvDv)}</label>`:''}</div></details>`;
 for(const r of inbox.filter(x=>x.arch===a.id&&x.floor===f.id&&x.entry===e.id)){
  const cmp=lock&&int(e.dv,0,999)?z.vsDv(r.total,e.dv):z.noDv(r.total);
  h+=`<div class="net-result net-rn-roll" role="status" data-rn-roll="${esc(r.id)}"><strong>${esc(z.incoming)}</strong>: ${esc(r.ab)} · ${esc(cmp)}<div class="net-actions"><button type="button" class="btn" data-net="run-rn-ok" data-floor="${esc(f.id)}" data-entry="${esc(e.id)}" data-roll="${esc(r.id)}">${esc(z.ok)}</button><button type="button" class="btn ghost" data-net="run-rn-no" data-floor="${esc(f.id)}" data-entry="${esc(e.id)}" data-roll="${esc(r.id)}">${esc(z.no)}</button></div></div>`;
 }
 return h;
}
// The card of the run mode: who the run is shown to, the public title, and exactly what goes out.
function gmHtml(a,l){
 const z=T[lng(l)],who=whoIs();
 const head=`<div class="card-heading"><span>${esc(z.gmTitle)}</span><span></span></div>`;
 if(!who)return `<section class="card net-rn" data-rn-box>${head}<p class="net-note">${esc(z.gmNoRoom)}</p></section>`;
 if(who.role!=='gm')return `<section class="card net-rn" data-rn-box>${head}<p class="net-note">${esc(z.gmPlayer)}</p></section>`;
 const list=peers(),mine=share&&share.arch===a.id?share:null,view=build(a,mine),fp=mine?mine.fp:draft.fp;
 const opts=list.map(p=>`<option value="${esc(p.fp)}"${p.fp===fp?' selected':''}>${esc(p.name||'—')}${p.character?' · '+esc(p.character):''}${p.online?'':' · '+esc(z.offline)}</option>`).join('');
 const entries=view?view.floors.reduce((n,f)=>n+f.e.length,0):0,unknown=view?view.floors.reduce((n,f)=>n+f.e.filter(e=>e.u).length,0):0,dvs=view?view.floors.reduce((n,f)=>n+f.e.filter(e=>e.dv!==undefined).length,0):0;
 let h=`<section class="card net-rn" data-rn-box>${head}<p class="net-note">${esc(z.pubHelp)}</p><div class="net-grid"><label class="field">${esc(z.pubTitle)}<input data-net-rn="pub" maxlength="${MAX_TITLE}" value="${esc(a.pub||'')}"></label>`;
 h+=list.length?`<label class="field">${esc(z.runner)}<select data-net-rn="peer"><option value="">${esc(z.choose)}</option>${opts}</select></label>`:`<p class="net-note">${esc(z.noPeers)}</p>`;
 h+=`</div>`;
 if(view)h+=`<p class="net-note">${esc(z.summary(view.floors.length,entries,unknown,dvs))}</p>`;
 if(mine){const p=peerByFp(mine.fp);h+=`<p class="net-note" role="status">${esc(z.sharing(p?.name||'—'))}</p>`}
 h+=`<div class="net-actions"><button type="button" class="btn" data-net="run-rn-share">${esc(z.share)}</button>${mine?`<button type="button" class="btn ghost" data-net="run-rn-stop">${esc(z.stop)}</button>`:''}</div>`;
 if(view)h+=`<details class="net-rn-preview" data-rn-preview${preview?' open':''}><summary>${esc(z.preview)}</summary><p class="net-note">${esc(z.previewHelp)}</p><pre>${esc(JSON.stringify(view,null,1))}</pre></details>`;
 return h+'</section>';
}
// The programs (catalog id, name) of the deck the architecture is linked to; the player's own deck decides where the loss lands.
function linkedPrograms(a,chars,lg){
 const r=global.NetLink?.resolve?.(a,chars);if(!r||!r.deck)return [];
 const d=r.c.extra.cyberdecks.decks.find(x=>obj(x)&&x.id===r.deck.id),m=new Map();
 for(const e of Array.isArray(d?.entries)?d.entries:[])if(obj(e)&&CAT.test(e.catalogId||'')&&global.RolePlay?.progState?.(e)&&!m.has(e.catalogId))m.set(e.catalogId,String(e.name?.[lg]||e.name?.en||e.catalogId));
 return [...m.entries()];
}
// Under the damage of an ICE to a program: a proposal to the player's own deck, and the «−1 NET Action» marker.
function proposalHtml(a,res,chars,l){
 const dm=res?.damage,who=whoIs();
 if(!obj(dm)||res?.mode!=='ice'||!who||who.role!=='gm'||!share||share.arch!==a.id||dm.applied)return '';
 const z=T[lng(l)],lg=lng(l);
 const rez=dm.to==='rez'&&!dm.iceKey&&int(dm.total,1,MAX_REZ),netCut=dm.to==='brain'&&['extra-ice-wisp','extra-program-vrizzbolt'].some(id=>catName(id,'en')===dm.source||catName(id,'ru')===dm.source);
 if(!rez&&!netCut)return '';
 let programs=[];
 if(rez){
  programs=linkedPrograms(a,chars,lg);
  if(!programs.length)programs=(Array.isArray(global.CATALOG)?global.CATALOG:[]).filter(p=>obj(p)&&CAT.test(p.id||'')&&p.category==='programs'&&int(p.stats?.rez,1,999)).map(p=>[p.id,String(p.name?.[lg]||p.name?.en||p.id)]);
 }
 return `<div class="rp-result net-rn-prop" data-rn-prop><div class="card-heading"><span>${esc(z.propose)}</span><span></span></div>${rez?`<label class="field">${esc(z.pickProg)}<select data-rn-prog>${programs.map(([id,name])=>`<option value="${esc(id)}">${esc(name)}</option>`).join('')}</select></label><div class="net-actions"><button type="button" class="btn" data-net="run-rn-prop" data-n="${dm.total}">${esc(z.proposeRez(dm.total))}</button></div>`:''}${netCut?`<div class="net-actions"><button type="button" class="btn" data-net="run-rn-net">${esc(z.proposeNet)}</button></div>`:''}</div>`;
}

/* ---------- The inbox as a panel of its own ---------- */
// Not tied to a floor or to #/net: it stays on screen while the Game Master moves the runner or works elsewhere in the app.
let inboxOpen=null,paintSig='';
// Open by default only when one roll waits and the screen is wide; on a phone the panel starts as a one-line summary so it does not cover the page.
const narrow=()=>{try{return !!global.matchMedia?.('(max-width: 640px)')?.matches}catch{return false}};
function inboxRows(l){
 const z=T[lng(l)],st=appState();
 return inbox.map(r=>{
  const a=archOf(st,r.arch),f=a&&Array.isArray(a.floors)?a.floors.find(x=>obj(x)&&x.id===r.floor):null,e=f?entriesOf(f).find(x=>x.id===r.entry):null;
  const lock=!!e&&LOCKS.includes(e.type)&&int(e.dv,1,999);
  return {r,arch:a?String(a.name||''):'',name:e?String(e.name||z.kinds[e.type]||''):'',cmp:lock?z.vsDv(r.total,e.dv):z.noDv(r.total),live:!!e};
 });
}
function inboxHtml(l){
 const who=whoIs();if(!who||who.role!=='gm'||!inbox.length)return '';
 const z=T[lng(l)],rows=inboxRows(l);
 return `<section class="rn-inbox" data-rn-inbox-box aria-label="${esc(z.inboxLabel)}"><details data-rn-inbox-details${(inboxOpen===null?(rows.length<2&&!narrow()):inboxOpen)?' open':''}><summary>${esc(z.inboxTitle(rows.length))}</summary><ul class="rn-inbox-list">${rows.map(({r,arch,name,cmp})=>`<li class="rn-inbox-roll" data-rn-inbox-roll="${esc(r.id)}"><p class="rn-inbox-what"><strong>${esc(r.who||'—')}</strong>: ${esc(r.ab)} · ${esc(z.inboxWhere(r.pos,r.depth))}${name?' · '+esc(name):''}${arch?' · '+esc(arch):''}<br>${esc(cmp)}</p><div class="rn-inbox-actions"><button type="button" class="btn" data-rn-inbox="ok" data-roll="${esc(r.id)}">${esc(z.ok)}</button><button type="button" class="btn ghost" data-rn-inbox="no" data-roll="${esc(r.id)}">${esc(z.no)}</button><button type="button" class="btn ghost" data-rn-inbox="drop" data-roll="${esc(r.id)}" aria-label="${esc(z.inboxDropAria)}">${esc(z.inboxDrop)}</button></div></li>`).join('')}</ul><div class="rn-inbox-actions"><button type="button" class="btn ghost" data-rn-inbox="open">${esc(z.inboxOpen)}</button></div></details></section>`;
}
const sigNow=()=>{let r='';try{r=whoIs()?.role||''}catch{}return lang()+'|'+r+'|'+inbox.length};
function paintInbox(){
 try{
  if(!doc?.body||typeof doc.createElement!=='function')return;
  let host=doc.getElementById?.('rn-inbox-host');
  if(!host){if(!inbox.length)return;host=doc.createElement('div');host.id='rn-inbox-host';host.className='rn-inbox-host';doc.body.appendChild(host)}
  paintSig=sigNow();host.innerHTML=inboxHtml(lang());
 }catch{}
}
function focusInbox(){
 try{
  const f=doc.querySelector('[data-rn-inbox-roll] button');if(f){f.focus({preventScroll:true});return}
  const m=doc.querySelector('main')||doc.getElementById('app');if(m){if(!m.hasAttribute('tabindex'))m.setAttribute('tabindex','-1');m.focus({preventScroll:true})}
 }catch{}
}
// An answer given from the panel can be taken back: the roll returns to the inbox and the record gets its old state.
function offerUndo(item,e,was,z){
 try{global.App?.notifyAction?.(z.inboxDone,z.inboxUndo,()=>{
  if(e&&e.state!==was)e.state=was;
  // The player's view must lose the answer too: it is taken out of what is shown and the view goes out again.
  if(e&&share&&Array.isArray(share.res)&&share.res.some(r=>r.rid===item.id)){share.res=share.res.filter(r=>r.rid!==item.id);publish(false)}
  if(!inbox.some(x=>x.id===item.id)&&whoIs()?.role==='gm'){inbox.push(item);while(inbox.length>MAX_INBOX)inbox.shift();persist();paintInbox()}
  try{global.App?.save?.()}catch{}try{if(/^#\/net\b/.test(String(global.location?.hash||'')))global.App?.render?.()}catch{}
  say(z.inboxUndone);focusInbox();
 })}catch{}
}
// The buttons of the panel. «It worked» / «It did not work» go through the same verdict as the buttons under a record.
function inboxAct(op,id){
 const z=T[lang()];
 if(op==='open'){try{global.location.hash='#/net'}catch{}return true}
 const k=inbox.findIndex(x=>x.id===id);if(k<0){paintInbox();focusInbox();return true}
 if(op==='drop'){const item={...inbox[k]};inbox.splice(k,1);persist();paintInbox();offerUndo(item,null,undefined,z);focusInbox();return true}
 if(op!=='ok'&&op!=='no')return false;
 const it=inbox[k],a=archOf(appState(),it.arch),f=a&&Array.isArray(a.floors)?a.floors.find(x=>obj(x)&&x.id===it.floor):null,e=f?entriesOf(f).find(x=>x.id===it.entry):null;
 if(!e){inbox.splice(k,1);persist();paintInbox();say(z.inboxGone);focusInbox();return true}
 const item={...it},was=e.state,r=verdict(op==='ok',a,f,e,id);
 if(r?.dirty){try{global.App?.save?.()}catch{}offerUndo(item,e,was,z);try{if(/^#\/net\b/.test(String(global.location?.hash||'')))global.App?.render?.()}catch{}}
 focusInbox();return true;
}

/* ---------- The runner's side ---------- */
let shown=null,shownAt=0,sel='',last=null,expTimer=null,applied=new Map();
const APPLIED_KEY='nc-netrun-applied';
function appliedSet(run){
 if(!applied.has(run)){let s=[];try{const o=JSON.parse(global.localStorage?.getItem(APPLIED_KEY)||'{}');if(obj(o)&&Array.isArray(o[run]))s=o[run].filter(x=>typeof x==='string'&&HEX.test(x))}catch{}applied.set(run,new Set(s))}
 return applied.get(run);
}
function keepApplied(run){try{const o={};for(const [k,v] of [...applied.entries()].slice(-5))o[k]=[...v].slice(-40);global.localStorage?.setItem(APPLIED_KEY,JSON.stringify(o))}catch{}}
const redraw=()=>{
 try{
  const box=doc?.querySelector?.('[data-rn-panel]'),c=global.App?.active?.();
  if(box&&c){const t=doc.createElement('div');t.innerHTML=panel(c,lang());const next=t.firstElementChild;if(next)box.replaceWith(next);else box.remove();return true}
  if(!box&&shown&&/^#\/sheet/.test(String(global.location?.hash||'')))global.App?.render?.();
 }catch{}
 return false;
};
// A view from the Game Master. d is {to,epk,iv,ct} or {clear:true}; `at` is the time the Game Master signed it.
async function receive(d,at,retained=false,now=Date.now()){
 const who=whoIs();sync(who);if(!who||who.role==='gm'||!obj(d))return false;
 const when=Number(at);if(!Number.isFinite(when)||when<shownAt||now-when>TTL)return false;
 // Addressed to somebody else (another runner, or nobody): this page shows nothing, and drops what it showed.
 if(d.clear===true||d.to!==who.memberId){shownAt=when;const had=!!shown;shown=null;sel='';clearTimeout(expTimer);if(had)redraw();return had}
 let inner;try{inner=await link().open(d)}catch{return false}
 const v=clean(inner,{to:who.memberId,from:who.gmFp});if(!v)return false;
 const same=JSON.stringify(v)===JSON.stringify(shown?.view),first=!shown;
 shownAt=when;shown={view:v,seen:now};
 if(!v.floors.some(f=>f.e.some(e=>e.i===sel)))sel='';
 clearTimeout(expTimer);expTimer=setTimeout(()=>{shown=null;sel='';redraw()},TTL+1000);expTimer.unref?.();
 if(!same){if(!retained&&first)say(T[lang()].title);redraw()}
 return !same;
}
const floorOf=v=>v?.floors.find(f=>f.i===v.cur)||null;
function targetLabel(f,e,pos,z){return e.l||z.onFloor(pos,f.d)}
function proposalState(c,p){
 // The entries of the player's own decks that could take this REZ loss.
 if(p.k!=='rez')return [];
 const out=[],decks=c?.extra?.cyberdecks?.decks;
 for(const d of Array.isArray(decks)?decks:[])for(const e of Array.isArray(d?.entries)?d.entries:[]){
  if(!obj(e)||e.catalogId!==p.c)continue;const s=global.RolePlay?.progState?.(e);if(!s||s.destroyed||s.rez<1)continue;
  out.push({deck:d.id,entry:e.id,name:String(e.name?.[lang()]||e.name?.en||p.c),from:s.rez,to:Math.max(0,s.rez-p.n)});
 }
 return out;
}
function panel(c,l){
 const who=whoIs();if(!who||who.role==='gm'||!shown||Date.now()-shown.seen>TTL)return '';
 if(who.characterId&&c&&who.characterId!==c.id)return '';
 const z=T[lng(l)],v=shown.view,f=floorOf(v);if(!f)return '';
 const byId=new Map(v.floors.map(x=>[x.i,x])),path=[];
 for(let x=f,n=0;x&&n<MAX_FLOORS;x=byId.get(x.p),n++)path.unshift(x);
 const done=appliedSet(v.id),props=v.prop.filter(p=>!done.has(p.i)&&Date.now()-p.t<PROP_TTL);
 let h=`<section class="card rn-panel" data-rn-panel tabindex="-1" data-rn-run="${esc(v.id)}"><div class="card-heading"><span>${esc(z.title)}</span><span>${esc(v.title||'')}</span></div>`;
 h+=`<nav class="rn-path" aria-label="${esc(z.path)}"><ol>${path.map(x=>`<li${x===f?' aria-current="location"':''}>${esc(z.floor(x.d))}${x===f?` <small>${esc(z.here)}</small>`:''}</li>`).join('')}</ol></nav>`;
 h+=`<p class="rn-help">${esc(z.pickTarget)}</p>`;
 h+=f.e.length?`<ul class="rn-targets" aria-label="${esc(z.floor(f.d))}">${f.e.map((e,k)=>{
  const pos=k+1,name=e.u?z.unknown:(e.l||z.kinds[e.k]),meta=e.u?'':`${esc(z.kinds[e.k])} · ${esc(z.states[e.s])}${e.dv!==undefined?` · ${esc(z.dv)} ${e.dv}`:''}`,on=sel===e.i;
  return `<li><button type="button" class="rn-target${on?' on':''}${e.u?' unknown':''}" data-rn-target="${esc(e.i)}" aria-pressed="${on}"><b>${esc(z.target(pos))}</b><span>${esc(name)}</span>${meta?`<small>${meta}</small>`:''}</button></li>`}).join('')}</ul>`:`<p class="rn-help">${esc(z.noTargets)}</p>`;
 h+=`<div class="rn-abilities" role="group" aria-label="${esc(z.ability)}">${abilityNames().map(n=>`<button type="button" class="rn-ability" data-rn-roll="${esc(n)}"${sel?'':' aria-disabled="true"'}>${esc(n)}</button>`).join('')}</div>`;
 const res=last&&last.run===v.id?last:null,ans=v.res.find(r=>res&&r.e===res.e&&r.rid===res.rid);
 h+=`<p class="rn-result" role="status" data-rn-result>${res?esc(z.last(res.ab,res.name,res.total))+' · '+esc(res.sent?z.sentOk:z.sentNo)+(ans?' · '+esc(ans.ok?z.answer.y:z.answer.n):''):''}</p>`;
 if(props.length){
  h+=`<div class="rn-props"><h3>${esc(z.proposals)}</h3><ul>${props.map(p=>{
   const opts=proposalState(c,p),text=p.k==='net'?z.net:z.rez(catName(p.c,lng(l)),p.n);
   const accept=p.k==='net'?`<button type="button" class="btn primary" data-rn-accept="${esc(p.i)}">${esc(z.accept)}</button>`:opts.length?opts.map(o=>`<button type="button" class="btn primary" data-rn-accept="${esc(p.i)}" data-rn-deck="${esc(o.deck)}" data-rn-entry="${esc(o.entry)}">${esc(opts.length>1?z.acceptTo(o.name,o.from,o.to):z.accept)}</button>`).join(''):`<span class="rn-note">${esc(z.noProgram)}</span>`;
   return `<li data-rn-prop-id="${esc(p.i)}"><strong>${esc(text)}</strong><div class="rn-actions">${accept}<button type="button" class="btn ghost" data-rn-decline="${esc(p.i)}">${esc(z.decline)}</button></div></li>`}).join('')}</ul></div>`;
 }
 return h+'</section>';
}
const activeRank=c=>{try{return Number(global.NetrunTab?.interfaceRank?.(c))||0}catch{return 0}};
// One tap on an ability with a target chosen: the roll is made here, with no DV, then reported to the Game Master.
function rollTarget(ability,c=global.App?.active?.()){
 const who=whoIs(),z=T[lang()];
 if(!shown||!sel||!c||!who){if(!sel)say(z.needTarget);return false}
 if(!abilityNames().includes(ability))return false;
 const v=shown.view,f=floorOf(v),pos=f?f.e.findIndex(e=>e.i===sel):-1;if(pos<0)return false;
 const e=f.e[pos],name=targetLabel(f,e,pos+1,z),rank=activeRank(c);if(!rank)return false;
 // The roll goes to the open room feed, so its label names the target by its place only: the label the Game Master typed is for the runner alone.
 const r=global.RolePlay?.netrunRoll?.(c,rank,ability,{dv:0,suffix:z.onFloor(pos+1,f.d)});
 if(!r||!r.ok)return r||false;
 const total=Number(r.out?.total),rid=hex8(),entry={run:v.id,e:e.i,rid,ab:ability,name,total:Number.isFinite(total)?total:0,sent:false};
 last=entry;
 if(int(total,-99,999)){
  Promise.resolve(link()?.up?.({k:'roll',run:v.id,f:f.i,e:e.i,ab:ability,total,rid})).then(n=>{if(last===entry&&n){entry.sent=true;redraw()}},()=>{});
 }
 redraw();return r;
}
const sendAck=(run,p,ok)=>{try{return Promise.resolve(link()?.up?.({k:'ack',run,p,ok:ok===true})).catch(()=>0)}catch{return Promise.resolve(0)}};
function snapEntry(e){return {rez:e.rez,down:e.down,active:e.active}}
// «Accept» on a proposal. -> {ok,message}
function accept(pid,deckId,entryId,c=global.App?.active?.()){
 const z=T[lang()],v=shown?.view,p=v?.prop.find(x=>x.i===pid);if(!v||!p||!c)return {ok:false,message:z.stale};
 const done=appliedSet(v.id);if(done.has(pid))return {ok:false,message:z.stale};
 const A=global.App;
 if(p.k==='net'){
  const before=c.extra;
  try{c.extra=global.NetrunEffects?.setPending?global.NetrunEffects.setPending(c,true):global.RolePlay.withRun(c.extra,{netPenalty:1})}catch{return {ok:false,message:z.stale}}
  done.add(pid);keepApplied(v.id);try{A.save?.()}catch{}
  const snapshot=c.extra;
  try{A.notifyAction?.(z.applied,z.undo,()=>{if(c.extra!==snapshot){say(z.stale);return}c.extra=before;try{A.save?.()}catch{}redraw();try{A.render?.()}catch{}say(z.undone)})}catch{}
  sendAck(v.id,pid,true);redraw();try{A.render?.()}catch{}return {ok:true,message:z.applied};
 }
 const opt=proposalState(c,p).find(o=>o.deck===deckId&&o.entry===entryId)||(proposalState(c,p).length===1?proposalState(c,p)[0]:null);
 if(!opt)return {ok:false,message:z.noProgram};
 const decks=c.extra?.cyberdecks?.decks,d=Array.isArray(decks)?decks.find(x=>obj(x)&&x.id===opt.deck):null,e=Array.isArray(d?.entries)?d.entries.find(x=>obj(x)&&x.id===opt.entry):null;
 if(!e)return {ok:false,message:z.stale};
 const was=snapEntry(e);
 e.rez=opt.to;if(opt.to===0){e.down=true;delete e.active}
 let ok=false;try{ok=global.RoleTools?.deckState?.(c)?.kind==='ok'}catch{}
 if(!ok){for(const k of ['rez','down','active']){if(was[k]===undefined)delete e[k];else e[k]=was[k]}return {ok:false,message:z.invalid}}
 done.add(pid);keepApplied(v.id);const after=snapEntry(e);try{A.save?.()}catch{}
 try{A.notifyAction?.(z.applied,z.undo,()=>{const cur=snapEntry(e);if(cur.rez!==after.rez||cur.down!==after.down||cur.active!==after.active){say(z.stale);return}for(const k of ['rez','down','active']){if(was[k]===undefined)delete e[k];else e[k]=was[k]}try{A.save?.()}catch{}redraw();try{A.render?.()}catch{}say(z.undone)})}catch{}
 sendAck(v.id,pid,true);redraw();try{A.render?.()}catch{}
 return {ok:true,message:z.applied};
}
function decline(pid){
 const v=shown?.view,p=v?.prop.find(x=>x.i===pid);if(!v||!p)return false;
 appliedSet(v.id).add(pid);keepApplied(v.id);sendAck(v.id,pid,false);redraw();say(T[lang()].declined);return true;
}
// A roll or an answer redraws the whole page, which drops the focus to the top: put it back once the page is drawn.
function refocus(...sels){
 // Focus counts as lost when it is on the page body or on a control the redraw has already removed; checked a few times, as the redraw may come later.
 const go=()=>{try{const f=doc.activeElement;if(f&&f!==doc.body&&f.isConnected!==false)return true;for(const s of sels){const n=doc.querySelector(s);if(n){n.focus({preventScroll:true});return true}}}catch{}return false};
 try{[0,60,120,200,300,500,900].forEach(ms=>setTimeout(go,ms))}catch{}
}
function onClick(e){
 const t=e?.target;if(!t?.closest)return false;
 const box=t.closest('[data-rn-inbox]');
 if(box&&box.dataset)return inboxAct(box.dataset.rnInbox,box.dataset.roll||'');
 const target=t.closest('[data-rn-target]');
 if(target){const id=target.dataset.rnTarget;sel=sel===id?'':String(id).slice(0,64);redraw();try{doc.querySelector(`[data-rn-target="${sel||id}"]`)?.focus?.()}catch{}return true}
 const roll=t.closest('[data-rn-roll]');
 if(roll&&roll.closest('[data-rn-panel]')){rollTarget(roll.dataset.rnRoll);refocus(`[data-rn-panel] [data-rn-roll="${String(roll.dataset.rnRoll).replace(/[^\w-]/g,'')}"]`,'[data-rn-panel]');return true}
 const acc=t.closest('[data-rn-accept]');
 if(acc){const r=accept(acc.dataset.rnAccept,acc.dataset.rnDeck||'',acc.dataset.rnEntry||'');say(r.message);refocus('[data-rn-panel] [data-rn-target]','[data-rn-panel]');return true}
 const dec=t.closest('[data-rn-decline]');
 if(dec){decline(dec.dataset.rnDecline);refocus('[data-rn-panel] [data-rn-target]','[data-rn-panel]');return true}
 return false;
}
// The panel lives outside #app: repaint it when the language or the role changed, after the page was drawn.
try{if(typeof global.MutationObserver==='function'&&doc?.documentElement){const f=()=>{if(doc.getElementById?.('rn-inbox-host')&&sigNow()!==paintSig)paintInbox()};new global.MutationObserver(f).observe(doc.documentElement,{attributes:true,attributeFilter:['lang']});const app=doc.getElementById?.('app');if(app)new global.MutationObserver(f).observe(app,{childList:true})}}catch{}
if(doc?.addEventListener){
 doc.addEventListener('click',onClick);
 doc.addEventListener('toggle',e=>{if(e.target?.dataset?.rnPreview!==undefined)preview=e.target.open===true;if(e.target?.dataset?.rnInboxDetails!==undefined)inboxOpen=e.target.open===true},true);
}
global.RoomNetrun={T,ID,KINDS,ABILITIES,MAX_FLOORS,MAX_ENTRIES,MAX_BYTES,TTL,RESEND,build,clean,cleanUp,publish,changed,start,stop,sharing,forget,receive,receiveUp,verdict,propose,act,change,gmHtml,floorHtml,entryHtml,proposalHtml,panel,rollTarget,accept,decline,onClick,inboxHtml,inboxAct,paintInbox,
 _test:{persist,shown:()=>shown,share:()=>share,inbox:()=>inbox,select:id=>{sel=id},reset:()=>{roomKey='\u0000';sync(null);applied=new Map();last=null},last:()=>last,wid,shownFloors,treeOf}};
})(typeof window!=='undefined'?window:globalThis);
