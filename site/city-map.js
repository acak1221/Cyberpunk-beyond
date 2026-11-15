/* City map of a campaign, for the Game Master. The user brings their own picture of a city and puts typed pins on it:
   a name, a note, a route between pins, a "the crew is here" mark. Nothing here comes from a book: the types and the
   placeholder grid are our own, the picture and every name are the user's.

   Two kinds of data, kept apart on purpose:
   - campaign.cityMap = {v:1,ratio,pins:[{id,t,x,y,name,note?,shown?}],route?:[pinId…],crew?:pinId,crewShown?:true}.
     Optional (a campaign without it behaves as before), small, read through clean() every time, part of the campaign
     file and of the backup. Coordinates are whole numbers 0…1000 across the stage, so they do not depend on the
     picture and mean the same on the players' grid.
   - the picture: only in this browser (IndexedDB, one record per campaign id). It is never written into the campaign,
     so it is in no export, no backup and no room message. A map picture is hundreds of kilobytes; inside the saved
     data it would eat the space the sheets live in.

   In an online room the Game Master may show chosen pins and the crew mark to the players: one retained signed message
   of type 'citymap' on the room subtopic 'p' (room.js, PROTOCOL 3 unchanged). It carries type, position and name of
   the chosen pins and the position of the crew — never the picture, a note, the route or a pin that was not chosen.
   Whatever a player's page receives is rebuilt from scratch by cleanShared(). */
(function(global){
'use strict';
const TYPES=['bar','clinic','fixer','gang','safehouse','job','shop','corp','danger','other'];
// One sign per type, so the colour of a pin is never the only thing that tells the types apart.
const GLYPH={bar:'♫',clinic:'✚',fixer:'$',gang:'☠',safehouse:'⌂',job:'★',shop:'◈',corp:'▲',danger:'!',other:'●'};
const MAX_PINS=80,MAX_SHARED=40,MAX_ROUTE=20,MAX_NAME=60,MAX_NOTE=300,MAX_BYTES=16000,TTL=12*3600*1000,RESEND=180000;
const PIC_SIDE=1600,PIC_CHARS=900000,PIC_READ=1200000,MAX_FILE=20*1024*1024,DB='nightcity-red-citymap',STORE='pics',GRACE=7*24*3600*1000;
const T={
 ru:{title:'КАРТА ГОРОДА',pageTitle:'Карта города',back:'К кампании',local:'Хранится на устройстве',lead:n=>`Кампания «${n}». Картинка ваша, метки ваши; картинка остаётся только в этом браузере.`,
  cardNone:'Карты города пока нет. Загрузите свою картинку или ставьте метки на условной сетке.',cardLine:(n,m)=>`Меток: ${n} · игрокам показано: ${m}`,cardCrew:n=>` · группа: ${n}`,open:'Открыть карту города',
  foreign:'Карта города сохранена в неизвестном формате и здесь не показывается. Данные не изменены.',
  tools:'Инструменты карты',modeLabel:'Режим карты',modeSelect:'Выбор',modeAdd:'Поставить метку',modeRoute:'Маршрут',
  addCentre:'Метку в центр',newType:'Тип новой метки',zoomOut:'Уменьшить карту',zoomIn:'Увеличить карту',zoom:n=>`×${n}`,labels:'Подписи',
  picUpload:'Загрузить картинку карты',picChange:'Сменить картинку',picRemove:'Убрать картинку',picConfirm:'Убрать картинку карты? Метки останутся на своих местах.',picRemoved:'Картинка карты убрана.',picChanged:'Картинка карты заменена.',undo:'Вернуть',
  picBad:'Не удалось прочитать изображение. Выберите файл JPG, PNG или WebP.',picBig:'Файл слишком большой (больше 20 МБ).',picHeavy:'Картинка слишком тяжёлая даже после сжатия. Выберите изображение меньшего размера.',
  picSaved:'Картинка карты сохранена в этом браузере.',picSession:'Браузер не дал сохранить картинку: она пропадёт, когда вы закроете страницу.',
  picLocal:'Картинка карты остаётся только в этом браузере: игрокам, в файл кампании и в резервную копию она не попадает.',
  gridHint:'Картинки нет — показана условная сетка. Метки ставятся так же.',
  filter:'Фильтр по типу',all:'Все',stage:'Карта города: метки',
  hintSelect:'Нажмите метку, чтобы выбрать её. Метку можно перетащить или подвинуть стрелками на клавиатуре.',hintAdd:'Нажмите место на карте, чтобы поставить там метку.',hintRoute:'Нажимайте метки по порядку. Нажатие на последнюю остановку убирает её.',
  routeNone:'Маршрут не проложен.',routeLine:(s,n)=>`Маршрут: ${s} (остановок: ${n})`,routeClear:'Очистить маршрут',routeCleared:'Маршрут очищен.',routeKept:'Маршрут уже проложен заново, поэтому прежний не возвращён.',routeFull:`В маршруте не больше ${MAX_ROUTE} остановок.`,
  editor:'МЕТКА',editorNone:'Выберите метку на карте или в списке, чтобы изменить её.',name:'Название',type:'Тип',note:'Заметка ведущего',noteHint:'Игроки её не видят.',show:'Показать игрокам',
  crewHere:'Группа здесь',remove:'Удалить метку',removed:n=>`Метка «${n}» удалена.`,
  list:'МЕТКИ',listEmpty:'Меток пока нет. Нажмите «Поставить метку» и укажите место на карте.',listFiltered:'Под этот фильтр не подходит ни одна метка.',
  bCrew:'группа здесь',bShown:'видна игрокам',bStop:n=>`остановка ${n}`,crewTag:'Группа',
  newPin:n=>`Метка ${n}`,full:`На карте не больше ${MAX_PINS} меток.`,sharedFull:`Игрокам можно показать не больше ${MAX_SHARED} меток. Снимите отметку с другой метки.`,
  sayAdded:n=>`Метка «${n}» поставлена.`,sayMoved:n=>`Метка «${n}» передвинута.`,sayStop:(n,i)=>`«${n}» — остановка ${i}.`,sayUnstop:n=>`«${n}» убрана из маршрута.`,sayCrew:n=>`Группа отмечена на метке «${n}».`,sayCrewOff:'Отметка группы снята.',
  share:'ИГРОКАМ В КОМНАТЕ',crewShow:'Показывать игрокам, где группа',
  stNoRoom:'Комната не открыта. Отмеченные метки появятся у игроков, когда вы создадите комнату и выберете в ней эту кампанию.',stPlayer:'Вы в комнате как игрок. Показывать карту может только ведущий комнаты.',stOther:'В комнате выбрана другая кампания. Чтобы игроки увидели эти метки, выберите эту кампанию на странице «Игра онлайн».',
  stLive:n=>`Комната открыта. Игроки видят меток: ${n}.`,stCrew:' Место группы показано.',cut:(a,b)=>` Из-за объёма игрокам уйдут только ${a} из ${b}.`,
  roomFrom:'Метки показывает ведущий. Картинка карты остаётся у него, здесь — условная сетка.',roomStage:n=>`Схема города, меток: ${n}`,roomStageCrew:', отмечено место группы',roomCrewAt:n=>`Группа здесь: ${n}`,roomCrew:'Группа отмечена на карте.',updated:'Ведущий обновил карту города.',
  gmSees:n=>`Игроки видят меток: ${n}.`,gmNone:'Игроки пока не видят карту. Откройте кампанию → «Карта города» и отметьте метки.',gmNoCampaign:'Чтобы показывать игрокам карту города, выберите выше кампанию для комнаты.',
  types:{bar:'Бар',clinic:'Клиника',fixer:'Фиксер',gang:'Банда',safehouse:'Убежище',job:'Заказ',shop:'Магазин',corp:'Корпорация',danger:'Опасность',other:'Другое'}},
 en:{title:'CITY MAP',pageTitle:'City map',back:'Back to the campaign',local:'Stored on this device',lead:n=>`Campaign “${n}”. Your picture, your pins; the picture stays in this browser only.`,
  cardNone:'No city map yet. Load your own picture or put pins on the placeholder grid.',cardLine:(n,m)=>`Pins: ${n} · shown to players: ${m}`,cardCrew:n=>` · crew: ${n}`,open:'Open the city map',
  foreign:'The city map is saved in an unknown format and is not shown here. The data is left untouched.',
  tools:'Map tools',modeLabel:'Map mode',modeSelect:'Select',modeAdd:'Place a pin',modeRoute:'Route',
  addCentre:'Pin in the centre',newType:'Type of a new pin',zoomOut:'Zoom the map out',zoomIn:'Zoom the map in',zoom:n=>`×${n}`,labels:'Labels',
  picUpload:'Load a map picture',picChange:'Change the picture',picRemove:'Remove the picture',picConfirm:'Remove the map picture? The pins stay where they are.',picRemoved:'The map picture is removed.',picChanged:'The map picture is replaced.',undo:'Undo',
  picBad:'Could not read the image. Choose a JPG, PNG or WebP file.',picBig:'The file is too large (over 20 MB).',picHeavy:'The picture is too heavy even after compression. Choose a smaller image.',
  picSaved:'The map picture is saved in this browser.',picSession:'The browser did not let the picture be saved: it will be gone when you close the page.',
  picLocal:'The map picture stays in this browser only: it does not go to players, into the campaign file or into the backup.',
  gridHint:'There is no picture, so a placeholder grid is shown. Pins work the same way.',
  filter:'Filter by type',all:'All',stage:'City map: pins',
  hintSelect:'Tap a pin to select it. A pin can be dragged, or moved with the arrow keys.',hintAdd:'Tap a place on the map to put a pin there.',hintRoute:'Tap the pins in order. Tapping the last stop removes it.',
  routeNone:'No route yet.',routeLine:(s,n)=>`Route: ${s} (stops: ${n})`,routeClear:'Clear the route',routeCleared:'The route is cleared.',routeKept:'A new route is already drawn, so the old one was not brought back.',routeFull:`A route has no more than ${MAX_ROUTE} stops.`,
  editor:'PIN',editorNone:'Select a pin on the map or in the list to change it.',name:'Name',type:'Type',note:'GM note',noteHint:'Players do not see it.',show:'Show to players',
  crewHere:'The crew is here',remove:'Delete the pin',removed:n=>`Pin “${n}” is deleted.`,
  list:'PINS',listEmpty:'No pins yet. Press “Place a pin” and tap a place on the map.',listFiltered:'No pin matches this filter.',
  bCrew:'the crew is here',bShown:'shown to players',bStop:n=>`stop ${n}`,crewTag:'Crew',
  newPin:n=>`Pin ${n}`,full:`A map has no more than ${MAX_PINS} pins.`,sharedFull:`No more than ${MAX_SHARED} pins can be shown to players. Unmark another pin first.`,
  sayAdded:n=>`Pin “${n}” is placed.`,sayMoved:n=>`Pin “${n}” is moved.`,sayStop:(n,i)=>`“${n}” is stop ${i}.`,sayUnstop:n=>`“${n}” is taken off the route.`,sayCrew:n=>`The crew is marked at “${n}”.`,sayCrewOff:'The crew mark is removed.',
  share:'FOR PLAYERS IN THE ROOM',crewShow:'Show players where the crew is',
  stNoRoom:'No room is open. Marked pins reach the players once you create a room and choose this campaign in it.',stPlayer:'You are in the room as a player. Only the Game Master of the room can show the map.',stOther:'Another campaign is chosen in the room. To show these pins, choose this campaign on the “Online play” page.',
  stLive:n=>`The room is open. Players see pins: ${n}.`,stCrew:' The place of the crew is shown.',cut:(a,b)=>` Because of their size only ${a} of ${b} are sent to players.`,
  roomFrom:'The pins are shown by the Game Master. The map picture stays with them; this is a placeholder grid.',roomStage:n=>`City layout, pins: ${n}`,roomStageCrew:', the place of the crew is marked',roomCrewAt:n=>`The crew is here: ${n}`,roomCrew:'The crew is marked on the map.',updated:'The Game Master updated the city map.',
  gmSees:n=>`Players see pins: ${n}.`,gmNone:'Players do not see the map yet. Open the campaign → “City map” and mark pins.',gmNoCampaign:'To show the city map to players, choose a campaign for the room above.',
  types:{bar:'Bar',clinic:'Clinic',fixer:'Fixer',gang:'Gang',safehouse:'Safehouse',job:'Job',shop:'Shop',corp:'Corporation',danger:'Danger',other:'Other'}}
};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const L=l=>l==='en'?'en':'ru';
const isObj=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
const int=(v,lo,hi)=>Number.isInteger(v)&&v>=lo&&v<=hi;
const ID=/^[A-Za-z0-9_-]{1,40}$/;
// Control characters and the characters that turn the direction of text around have no place in a name:
// a name is shown to other people, also inside attributes read by a screen reader.
const CTRL=/[\u0000-\u001f\u007f-\u009f\u2028\u2029\u202a-\u202e\u2066-\u2069]/g;
const line=(v,n)=>typeof v==='string'?v.replace(CTRL,' ').replace(/\s+/g,' ').trim().slice(0,n).trim():'';
const para=(v,n)=>typeof v==='string'?v.replace(/\r\n?/g,'\n').replace(/[\u0000-\u0009\u000b-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g,'').slice(0,n):'';
const ratioOf=v=>typeof v==='number'&&Number.isFinite(v)&&v>0?Math.round(Math.min(2,Math.max(.5,v))*1000)/1000:1.5;
const clamp=v=>Math.min(1000,Math.max(0,Math.round(Number(v)||0)));
const curLang=()=>{try{return global.App?.lang?.()==='en'?'en':'ru'}catch{return 'ru'}};
const appState=()=>{try{return global.App?.getState?.()||null}catch{return null}};
const campaignOf=(st,id)=>id&&Array.isArray(st?.campaigns)?st.campaigns.find(c=>isObj(c)&&c.id===id)||null:null;
const enc=typeof TextEncoder!=='undefined'?new TextEncoder():null;
const size=s=>enc?enc.encode(s).length:s.length*3;

/* ---------- Data ---------- */
// A copy that can be trusted, or null. Only the fields named here survive, whatever the value held.
function clean(raw){
 if(!isObj(raw)||raw.v!==1)return null;
 const pins=[],ids=new Set();let shown=0;
 for(const p of Array.isArray(raw.pins)?raw.pins:[]){
  if(pins.length>=MAX_PINS)break;
  if(!isObj(p)||typeof p.id!=='string'||!ID.test(p.id)||ids.has(p.id)||!TYPES.includes(p.t)||!int(p.x,0,1000)||!int(p.y,0,1000))continue;
  const name=line(p.name,MAX_NAME);if(!name)continue;
  const pin={id:p.id,t:p.t,x:p.x,y:p.y,name},note=para(p.note,MAX_NOTE);
  if(note.trim())pin.note=note;
  if(p.shown===true&&shown<MAX_SHARED){pin.shown=true;shown++}
  ids.add(p.id);pins.push(pin);
 }
 const out={v:1,ratio:ratioOf(raw.ratio),pins},route=[];
 for(const id of Array.isArray(raw.route)?raw.route:[]){if(route.length>=MAX_ROUTE)break;if(typeof id==='string'&&ids.has(id)&&route[route.length-1]!==id)route.push(id)}
 if(route.length)out.route=route;
 if(typeof raw.crew==='string'&&ids.has(raw.crew))out.crew=raw.crew;
 if(raw.crewShown===true)out.crewShown=true;
 return out;
}
const read=c=>clean(c?.cityMap);
// A value that is there but is not ours to rewrite (a later format, or damage).
const foreign=c=>c?.cityMap!==undefined&&c?.cityMap!==null&&!read(c);
const blank=()=>({v:1,ratio:1.5,pins:[]});
function write(c,map){const next=clean(map);if(!next||!isObj(c))return false;c.cityMap=next;return true}
let seq=0;
const newId=()=>'p'+Date.now().toString(36)+(seq++).toString(36)+Math.floor(Math.random()*1296).toString(36);
const pinOf=(map,id)=>map.pins.find(p=>p.id===id)||null;
function addPin(map,{t,x,y,name}={}){
 if(map.pins.length>=MAX_PINS)return null;
 const n=line(name,MAX_NAME);if(!n)return null;
 const pin={id:newId(),t:TYPES.includes(t)?t:'other',x:clamp(x),y:clamp(y),name:n};map.pins.push(pin);return pin;
}
function updatePin(map,id,patch){
 const p=pinOf(map,id);if(!p||!isObj(patch))return false;
 if(patch.name!==undefined){const n=line(patch.name,MAX_NAME);if(!n)return false;p.name=n}
 if(patch.t!==undefined){if(!TYPES.includes(patch.t))return false;p.t=patch.t}
 if(patch.note!==undefined){const n=para(patch.note,MAX_NOTE);if(n.trim())p.note=n;else delete p.note}
 return true;
}
function movePin(map,id,x,y){const p=pinOf(map,id);if(!p)return false;p.x=clamp(x);p.y=clamp(y);return true}
// The way a route reads once it is saved: only stops that are still pins, and no stop twice in a row.
const routeNow=(map,ids)=>ids.filter(id=>pinOf(map,id)).filter((id,i,a)=>a[i-1]!==id);
// Removing a pin takes it off the route and lifts the crew mark; what is returned puts all three back.
function removePin(map,id){
 const index=map.pins.findIndex(p=>p.id===id);if(index<0)return null;
 const snap={pin:{...map.pins[index]},index,route:(map.route||[]).slice(),crew:map.crew===id};
 map.pins.splice(index,1);
 if(map.route)map.route=map.route.filter(x=>x!==id);
 if(map.crew===id)delete map.crew;
 return snap;
}
function restorePin(map,snap){
 if(!snap?.pin||pinOf(map,snap.pin.id)||map.pins.length>=MAX_PINS)return false;
 map.pins.splice(Math.min(snap.index,map.pins.length),0,{...snap.pin});
 // The route and the crew mark come back only where nothing was done to them in the meantime: a route drawn after the
 // removal, or a crew mark put on another pin, is newer than what is being taken back and has no "undo" of its own.
 const id=snap.pin.id,left=routeNow(map,snap.route.filter(x=>x!==id)),now=map.route||[];
 if(now.length===left.length&&now.every((x,i)=>x===left[i])){const old=routeNow(map,snap.route);if(old.length)map.route=old;else delete map.route}
 if(snap.crew&&!map.crew)map.crew=id;
 return true;
}
// A tap on the last stop takes it off the route; a tap on any other pin makes it the next stop.
function toggleRoute(map,id){
 if(!pinOf(map,id))return {ok:false,reason:'missing'};
 const route=map.route||[];
 if(route[route.length-1]===id){route.pop();map.route=route;return {ok:true,added:false,stops:route.length}}
 if(route.length>=MAX_ROUTE)return {ok:false,reason:'full'};
 route.push(id);map.route=route;return {ok:true,added:true,stops:route.length};
}
function clearRoute(map){const was=(map.route||[]).slice();delete map.route;return was}
function setCrew(map,id){if(id===null||id===undefined){delete map.crew;return true}if(!pinOf(map,id))return false;map.crew=id;return true}
function setShown(map,id,on){
 const p=pinOf(map,id);if(!p)return {ok:false,reason:'missing'};
 const count=map.pins.filter(x=>x.shown===true).length;
 if(on){if(p.shown!==true){if(count>=MAX_SHARED)return {ok:false,reason:'full'};p.shown=true;return {ok:true,count:count+1}}return {ok:true,count}}
 if(p.shown===true){delete p.shown;return {ok:true,count:count-1}}
 return {ok:true,count};
}
// Where "pin in the centre" puts a pin: the centre, or the nearest free place around it. A step is 12% of the width, and
// the same distance down (the stage is rarely square), so on a phone two pins put this way do not lie on each other.
function freeSpot(map){
 const sx=120,sy=Math.round(sx*ratioOf(map.ratio)),taken=(x,y)=>map.pins.some(p=>Math.abs(p.x-x)<sx&&Math.abs(p.y-y)<sy);
 for(let r=0;r<=4;r++)for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){
  if(Math.max(Math.abs(dx),Math.abs(dy))!==r)continue;
  const x=500+dx*sx,y=500+dy*sy;if(y>=0&&y<=1000&&!taken(x,y))return {x,y};
 }
 return {x:500,y:500};
}
const typesUsed=map=>TYPES.map(t=>[t,map.pins.filter(p=>p.t===t).length]).filter(x=>x[1]);
// An empty filter shows everything.
const filterPins=(map,types)=>!types||!types.size?map.pins.slice():map.pins.filter(p=>types.has(p.t));
// Arrow keys move a pin by 1% of the stage, with Shift by 5%.
function nudge(x,y,key,shift){
 const d={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[key];if(!d)return null;
 const k=shift?50:10;return {x:clamp(x+d[0]*k),y:clamp(y+d[1]*k)};
}

/* ---------- The picture: this browser only ---------- */
// The longer side is brought down to `max`; a small picture is not blown up.
function fit(w,h,max=PIC_SIDE){
 if(!(w>0)||!(h>0))return null;
 const k=Math.min(1,max/Math.max(w,h));return {w:Math.max(1,Math.round(w*k)),h:Math.max(1,Math.round(h*k))};
}
// Only an inline raster image of a known size is ever put into an <img>.
function validPic(r){return isObj(r)&&r.v===1&&int(r.w,1,PIC_SIDE)&&int(r.h,1,PIC_SIDE)&&typeof r.src==='string'&&r.src.length<=PIC_READ&&/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(r.src)}
function idbStore(){
 const open=()=>new Promise((ok,no)=>{let rq;try{rq=global.indexedDB.open(DB,1)}catch(e){no(e);return}rq.onupgradeneeded=()=>{try{rq.result.createObjectStore(STORE)}catch{}};rq.onsuccess=()=>ok(rq.result);rq.onerror=()=>no(rq.error||Error('open'));rq.onblocked=()=>no(Error('blocked'))});
 const run=(mode,work)=>open().then(db=>new Promise((ok,no)=>{let out;try{const tx=db.transaction(STORE,mode),rq=work(tx.objectStore(STORE));if(rq)rq.onsuccess=()=>{out=rq.result};tx.oncomplete=()=>{db.close();ok(out)};tx.onerror=tx.onabort=()=>{db.close();no(tx.error||Error('tx'))}}catch(e){try{db.close()}catch{}no(e)}}));
 return {get:id=>run('readonly',s=>s.get(id)),put:(id,rec)=>run('readwrite',s=>{s.put(rec,id)}),del:id=>run('readwrite',s=>{s.delete(id)}),keys:()=>run('readonly',s=>s.getAllKeys())};
}
let store;
const theStore=()=>{if(store===undefined){try{store=global.indexedDB?idbStore():null}catch{store=null}}return store};
// What is known about the pictures so far: campaign id -> {rec,url} or null (looked for, none). The page is drawn at
// once with the grid; the picture comes a moment later and only the map body is drawn again.
const pics=new Map(),pending=new Map(),volatile=new Set();
// The page gets a short blob: address instead of a megabyte of text in its markup; where that cannot be made, the data address itself.
function urlOf(rec){
 try{
  if(typeof global.URL?.createObjectURL!=='function'||typeof global.atob!=='function'||typeof global.Blob!=='function')return rec.src;
  const m=/^data:(image\/[a-z]+);base64,(.+)$/.exec(rec.src),bin=global.atob(m[2]),bytes=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
  return global.URL.createObjectURL(new global.Blob([bytes],{type:m[1]}));
 }catch{return rec.src}
}
function setPic(id,rec){
 const old=pics.get(id);if(old?.url&&old.url!==old.rec.src){try{global.URL.revokeObjectURL(old.url)}catch{}}
 pics.set(id,rec?{rec,url:urlOf(rec)}:null);
}
function loadPic(id){
 if(pics.has(id))return Promise.resolve(pics.get(id)?.rec||null);
 if(pending.has(id))return pending.get(id);
 const s=theStore();
 const p=Promise.resolve().then(()=>s?s.get(id):null).then(r=>{
  if(!validPic(r))return null;
  // A picture that waited for its campaign to come back (see sweep) is no longer on its way out.
  if(r.gone!==undefined){const {gone,...rest}=r;Promise.resolve().then(()=>s.put(id,rest)).catch(()=>{});return rest}
  return r;
 },()=>null).then(rec=>{pending.delete(id);if(!pics.has(id))setPic(id,rec);if(rec)repaintOpen(id);return rec});
 pending.set(id,p);return p;
}
// Pictures whose campaign is gone are removed, but not at once: a restore from a backup can be undone and bring the
// campaign back, so a picture is first marked and only deleted when it has been an orphan for a week.
async function sweep(s,now=Date.now()){
 const st=appState();if(!s||!Array.isArray(st?.campaigns))return 0;
 const live=new Set(st.campaigns.map(c=>c?.id));let gone=0;
 for(const k of await s.keys()){
  if(live.has(k))continue;
  const r=await s.get(k);
  if(!validPic(r)||(int(r.gone,1,Number.MAX_SAFE_INTEGER)&&now-r.gone>GRACE)){await s.del(k);pics.delete(k);gone++}
  else if(!int(r.gone,1,Number.MAX_SAFE_INTEGER))await s.put(k,{...r,gone:now});
 }
 return gone;
}
// Keeps the picture for a campaign. 'saved' = in the browser's storage, 'session' = only until the page is closed, 'bad' = refused.
async function savePic(id,rec){
 if(!validPic(rec)||rec.src.length>PIC_CHARS||typeof id!=='string'||!id)return 'bad';
 let kept=true;const s=theStore();
 try{if(!s)throw Error('no store');await s.put(id,rec)}catch{kept=false}
 setPic(id,rec);if(kept)volatile.delete(id);else volatile.add(id);
 if(kept)sweep(s).catch(()=>{});
 return kept?'saved':'session';
}
// Opening a map is the moment to look for pictures left behind by deleted campaigns: waiting for the next picture to be
// saved would keep them for good on a device where no other map is ever loaded.
function tidy(){try{const s=theStore();if(s)sweep(s).catch(()=>{})}catch{}}
async function dropPic(id){
 const had=pics.get(id)?.rec||null;
 try{await theStore()?.del(id)}catch{}
 setPic(id,null);volatile.delete(id);return had;
}
function loadImage(file){
 const viaElement=()=>new Promise((resolve,reject)=>{const url=global.URL.createObjectURL(file),img=new global.Image();img.onload=()=>{global.URL.revokeObjectURL(url);resolve(img)};img.onerror=()=>{global.URL.revokeObjectURL(url);reject(Error('decode'))};img.src=url});
 return global.createImageBitmap?global.createImageBitmap(file).catch(viaElement):viaElement();
}
function draw(img,d,quality){
 try{
  const canvas=global.document.createElement('canvas');canvas.width=d.w;canvas.height=d.h;
  const g=canvas.getContext('2d');g.imageSmoothingQuality='high';
  // JPEG has no transparency: a see-through map is put on white, the way it looks in a picture viewer.
  g.fillStyle='#fff';g.fillRect(0,0,d.w,d.h);g.drawImage(img,0,0,d.w,d.h);
  return canvas.toDataURL('image/jpeg',quality);
 }catch{return ''}
}
// The whole way of a chosen file: decode once, shrink until it fits the budget, keep, note the proportions in the campaign.
async function attach(file,c,l){
 const t=T[L(l)],say=m=>{try{global.App?.notify?.(m)}catch{}};
 if(!file||!isObj(c)||foreign(c))return 'none';
 if(file.size>MAX_FILE){say(t.picBig);return 'big'}
 let img;try{img=await loadImage(file)}catch{say(t.picBad);return 'bad'}
 let rec=null,readable=false;
 for(const [side,q] of [[PIC_SIDE,.8],[1280,.7],[1024,.6]]){
  const d=fit(img.width,img.height,side),src=d?draw(img,d,q):'';if(!src)break;
  readable=true;if(src.length<=PIC_CHARS){rec={v:1,w:d.w,h:d.h,src,at:Date.now()};break}
 }
 try{img.close?.()}catch{}
 if(!rec||!validPic(rec)){say(readable?t.picHeavy:t.picBad);return 'bad'}
 // The campaign may have been deleted or replaced while the image was decoded.
 if(campaignOf(appState(),c.id)!==c||foreign(c))return 'none';
 return keepPic(c,rec,l);
}
// The stage takes the proportions of the picture, and the page shows it.
function showPic(c,rec){
 const map=read(c)||blank();map.ratio=ratioOf(rec.w/rec.h);
 if(write(c,map)){try{global.App.save()}catch{}}
 if(!repaintOpen(String(c.id))){try{global.App.render()}catch{}}
}
// A new picture takes the place of the one before it. That one cannot be loaded again from anywhere (it may have come
// from a file the user no longer has), so replacing it is offered back like every other removal on this page.
async function keepPic(c,rec,l){
 const t=T[L(l)],say=m=>{try{global.App?.notify?.(m)}catch{}},id=String(c.id);
 const before=await loadPic(id).catch(()=>null);
 const how=await savePic(id,rec);if(how==='bad'){say(t.picBad);return how}
 showPic(c,rec);
 const back=()=>{const now=campaignOf(appState(),c.id);if(!now||foreign(now))return;savePic(id,before).then(h=>{if(h!=='bad')showPic(now,before)})};
 try{if(before&&before.src!==rec.src&&typeof global.App?.notifyAction==='function'){global.App.notifyAction(t.picChanged,t.undo,back);return how}}catch{}
 say(how==='saved'?t.picSaved:t.picSession);return how;
}

/* ---------- View ---------- */
// What is selected, the mode, the filter and the zoom are not saved: they belong to this visit of the page.
const views=new Map();let openId=null;
function view(c){
 const id=String(c?.id??'');let v=views.get(id);
 if(!v){if(views.size>30)views.clear();v={sel:null,mode:'select',filter:new Set(),zoom:1,say:'',type:'other',labels:true};views.set(id,v)}
 return v;
}
const isOpen=id=>openId!==null&&openId===String(id??'');
const stopsOf=(map,id)=>(map.route||[]).map((x,i)=>x===id?i+1:0).filter(Boolean);
function pinLabel(p,map,t){
 const stops=stopsOf(map,p.id);
 return `${t.types[p.t]}: ${p.name}`+(map.crew===p.id?', '+t.bCrew:'')+(p.shown?', '+t.bShown:'')+(stops.length?', '+t.bStop(stops.join(', ')):'');
}
const routeText=(map,t)=>{const names=(map.route||[]).map(id=>pinOf(map,id)?.name).filter(Boolean);return names.length?t.routeLine(names.join(' → '),names.length):t.routeNone};
const glyph=k=>`<span class="cm-chip cm-t-${k}" aria-hidden="true">${GLYPH[k]}</span>`;
// Positions go into the markup as numbers made from checked whole numbers, never as text from the data.
const at=(x,y)=>`--x:${x/10}%;--y:${y/10}%`;
// A pin near the left or right edge hangs its label and the crew tag inwards, so they are not cut by the edge of the stage.
const edge=x=>x<250?' cm-edge-l':x>750?' cm-edge-r':'';
const routeSVG=pts=>`<svg class="cm-route" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true" focusable="false">${pts.length>1?`<polyline points="${pts.map(p=>p[0]+','+p[1]).join(' ')}" vector-effect="non-scaling-stroke"/>`:''}</svg>`;
function stageHTML(map,v,t,url){
 const pin=p=>{const stops=stopsOf(map,p.id),crew=map.crew===p.id;
  return `<button type="button" class="cm-pin${v.sel===p.id?' cm-sel':''}${crew?' cm-crew':''}${p.shown?' cm-shown':''}${edge(p.x)}" data-cm-pin="${esc(p.id)}" data-cm-xy="${p.x},${p.y}" style="${at(p.x,p.y)}" aria-pressed="${v.sel===p.id?'true':'false'}" aria-label="${esc(pinLabel(p,map,t))}">${glyph(p.t)}${stops.length?`<span class="cm-stop" aria-hidden="true">${stops[0]}</span>`:''}${crew?`<span class="cm-crew-tag" aria-hidden="true">${esc(t.crewTag)}</span>`:''}${v.labels?`<span class="cm-pin-name" aria-hidden="true">${esc(p.name)}</span>`:''}</button>`};
 const route=(map.route||[]).map(id=>pinOf(map,id)).filter(Boolean).map(p=>[p.x,p.y]);
 // The stage keeps the proportions of the picture (held between 1:2 and 2:1; a longer picture is fitted inside), and pins
 // are placed in shares of the stage, so they sit on the same spots at any zoom and on the players' grid.
 return `<div class="cm-scroll" data-cm-scroll data-cm-mode="${v.mode}" tabindex="0" role="group" aria-label="${esc(t.stage)}"><div class="cm-stage${url?'':' cm-grid'}" data-cm-stage style="aspect-ratio:${map.ratio};width:${v.zoom*100}%">${url?`<img class="cm-pic" src="${esc(url)}" alt="" draggable="false">`:''}${routeSVG(route)}${filterPins(map,v.filter).map(pin).join('')}</div></div>`;
}
const link=()=>{try{return global.Room?.mapLink||null}catch{return null}};
const whoIs=()=>{try{const w=link()?.who?.();return isObj(w)?w:null}catch{return null}};
function statusText(c,t){
 const who=whoIs();if(!who)return t.stNoRoom;if(who.role!=='gm')return t.stPlayer;if(who.campaignId!==c.id)return t.stOther;
 const p=payload(c);return t.stLive(p.fit)+(p.data.crew?t.stCrew:'')+(p.fit<p.total?t.cut(p.fit,p.total):'');
}
function bodyHTML(c,l){
 const t=T[L(l)];
 if(foreign(c))return `<section class="card"><p class="cm-hint" role="status">${esc(t.foreign)}</p></section>`;
 const map=read(c)||blank(),v=view(c),id=String(c.id),pic=pics.get(id)||null;
 if(!pics.has(id))loadPic(id);
 if(v.sel&&!pinOf(map,v.sel))v.sel=null;
 for(const k of [...v.filter])if(!map.pins.some(p=>p.t===k))v.filter.delete(k);
 const vis=filterPins(map,v.filter),sel=v.sel?pinOf(map,v.sel):null,shown=map.pins.filter(p=>p.shown).length;
 const mode=(k,text)=>`<button type="button" class="btn ghost cm-mode" data-cm-act="mode" data-cm-value="${k}" aria-pressed="${v.mode===k?'true':'false'}">${esc(text)}</button>`;
 const tools=`<div class="cm-toolbar" role="group" aria-label="${esc(t.tools)}"><div class="cm-modes" role="group" aria-label="${esc(t.modeLabel)}">${mode('select',t.modeSelect)}${mode('add',t.modeAdd)}${mode('route',t.modeRoute)}</div><label class="field cm-newtype">${esc(t.newType)}<select data-cm-newtype>${TYPES.map(k=>`<option value="${k}"${v.type===k?' selected':''}>${esc(t.types[k])}</option>`).join('')}</select></label><button type="button" class="btn ghost" data-cm-act="add-centre"${map.pins.length>=MAX_PINS?' disabled':''}>＋ ${esc(t.addCentre)}</button><div class="cm-zoom"><button type="button" class="btn ghost" data-cm-act="zoom-out" aria-label="${esc(t.zoomOut)}"${v.zoom<=1?' disabled':''}>−</button><span class="cm-zoom-now" aria-hidden="true">${esc(t.zoom(v.zoom))}</span><button type="button" class="btn ghost" data-cm-act="zoom-in" aria-label="${esc(t.zoomIn)}"${v.zoom>=3?' disabled':''}>＋</button></div><button type="button" class="btn ghost" data-cm-act="labels" aria-pressed="${v.labels?'true':'false'}">${esc(t.labels)}</button><label class="btn ghost cm-file">${esc(pic?t.picChange:t.picUpload)}<input type="file" accept="image/jpeg,image/png,image/webp" data-cm-file></label>${pic?`<button type="button" class="btn ghost cm-danger" data-cm-act="pic-remove">${esc(t.picRemove)}</button>`:''}</div>`;
 const used=typesUsed(map);
 const filters=used.length?`<div class="cm-filters" role="group" aria-label="${esc(t.filter)}"><button type="button" class="cm-filter" data-cm-act="filter" data-cm-value="" aria-pressed="${v.filter.size?'false':'true'}">${esc(t.all)} <span class="cm-count">${map.pins.length}</span></button>${used.map(([k,n])=>`<button type="button" class="cm-filter" data-cm-act="filter" data-cm-value="${k}" aria-pressed="${v.filter.has(k)?'true':'false'}">${glyph(k)}${esc(t.types[k])} <span class="cm-count">${n}</span></button>`).join('')}</div>`:'';
 const hint=v.mode==='add'?t.hintAdd:v.mode==='route'?t.hintRoute:t.hintSelect;
 const main=`<section class="card cm-main">${tools}${filters}<p class="cm-hint" data-cm-hint>${esc(hint)}${pic?'':' '+esc(t.gridHint)}${volatile.has(id)?' '+esc(t.picSession):''}</p>${stageHTML(map,v,t,pic?.url||'')}<div class="cm-route-row"><p class="cm-route-line" data-cm-route-line>${esc(routeText(map,t))}</p>${map.route?.length?`<button type="button" class="btn ghost" data-cm-act="route-clear">${esc(t.routeClear)}</button>`:''}</div><p class="cm-say" aria-hidden="true" data-cm-say>${esc(v.say)}</p><input type="hidden" data-cm-drop value=""></section>`;
 const editor=`<section class="card cm-editor"><div class="card-heading"><span>${esc(t.editor)}</span><span data-nx>${sel?glyph(sel.t):''}</span></div>${sel?`<label class="field">${esc(t.name)}<input type="text" data-cm-field="name" maxlength="${MAX_NAME}" value="${esc(sel.name)}" autocomplete="off"></label><label class="field">${esc(t.type)}<select data-cm-field="t">${TYPES.map(k=>`<option value="${k}"${sel.t===k?' selected':''}>${esc(t.types[k])}</option>`).join('')}</select></label><label class="field textarea-field">${esc(t.note)}<textarea data-cm-field="note" rows="4" maxlength="${MAX_NOTE}" aria-describedby="cm-note-hint">${esc(sel.note||'')}</textarea></label><p class="cm-hint" id="cm-note-hint">${esc(t.noteHint)}</p><label class="cm-check"><input type="checkbox" data-cm-field="shown"${sel.shown?' checked':''}> <span>${esc(t.show)}</span></label><div class="cm-actions"><button type="button" class="btn ghost" data-cm-act="crew" aria-pressed="${map.crew===sel.id?'true':'false'}">${esc(t.crewHere)}</button><button type="button" class="btn ghost cm-danger" data-cm-act="pin-remove">✕ ${esc(t.remove)}</button></div>`:`<p class="cm-hint">${esc(t.editorNone)}</p>`}</section>`;
 const row=p=>{const stops=stopsOf(map,p.id),badges=[map.crew===p.id?t.bCrew:'',p.shown?t.bShown:'',stops.length?t.bStop(stops.join(', ')):''].filter(Boolean);
  return `<li><button type="button" class="cm-row" data-cm-row="${esc(p.id)}" aria-pressed="${v.sel===p.id?'true':'false'}">${glyph(p.t)}<span class="cm-row-text"><b class="cm-row-name">${esc(p.name)}</b><span class="cm-row-type">${esc(t.types[p.t])}${badges.length?' · '+esc(badges.join(' · ')):''}</span></span></button></li>`};
 const list=`<section class="card cm-list"><div class="card-heading"><span>${esc(t.list)}</span><span data-nx>${vis.length===map.pins.length?map.pins.length:vis.length+' / '+map.pins.length}</span></div>${vis.length?`<ul class="cm-rows">${vis.map(row).join('')}</ul>`:`<p class="cm-hint">${esc(map.pins.length?t.listFiltered:t.listEmpty)}</p>`}</section>`;
 const share=`<section class="card cm-share"><div class="card-heading"><span>${esc(t.share)}</span><span data-nx>${shown} / ${MAX_SHARED}</span></div><label class="cm-check"><input type="checkbox" data-cm-field="crewShown"${map.crewShown?' checked':''}> <span>${esc(t.crewShow)}</span></label><p class="cm-status" role="status">${esc(statusText(c,t))}</p><p class="cm-hint cm-local">${esc(t.picLocal)}</p></section>`;
 return `<div class="cm-layout">${main}<div class="cm-side">${editor}${list}${share}</div></div>`;
}
// The page of the map: Campaigns.render returns it instead of the tracker while the map is open.
// The line a screen reader hears after an action stands outside the part that is redrawn: a live region that arrives
// together with its text is not read out, one whose text changes is. The line on the screen is a copy for the eyes.
function page(c,characters,l){
 if(!isObj(c))return '';
 const t=T[L(l)];
 return `<div class="cm-page" data-cm-root data-cm-page="${esc(c.id)}"><div class="sheet-top"><button type="button" class="back-link" data-cm-act="close">← ${esc(t.back)}</button><span class="saved-indicator"><span class="status-dot"></span> ${esc(t.local)}</span></div><div class="page-header"><div><div class="overline">04 / JOB MANAGEMENT</div><h1>${esc(t.pageTitle)}</h1><p>${esc(t.lead(line(c.name,100)||'—'))}</p></div></div><p class="sr-only" role="status" aria-live="polite" data-cm-live></p><div data-cm-body>${bodyHTML(c,l)}</div></div>`;
}
// The small card on the campaign page that leads to the map.
function card(c,l){
 if(!isObj(c))return '';
 const t=T[L(l)],map=read(c),crew=map?.crew?pinOf(map,map.crew):null;
 const text=foreign(c)?t.foreign:map&&map.pins.length?t.cardLine(map.pins.length,map.pins.filter(p=>p.shown).length)+(crew?t.cardCrew(crew.name):''):t.cardNone;
 return `<section class="card city-map-card" data-cm-root data-cm-card><div class="card-heading"><span>${esc(t.title)}</span><span data-nx>${map?map.pins.length:0}</span></div><p class="cm-hint">${esc(text)}</p><button type="button" class="btn ghost" data-cm-act="open">${esc(t.open)} ↗</button></section>`;
}

/* ---------- Events ---------- */
const owns=e=>!!e?.target?.closest?.('[data-cm-root]');
const pinSel=id=>'[data-cm-pin="'+id+'"]';
function focusKey(el){
 const d=el?.dataset;if(!d)return null;
 if(d.cmPin!==undefined)return pinSel(d.cmPin);
 if(d.cmRow!==undefined)return '[data-cm-row="'+d.cmRow+'"]';
 if(d.cmAct!==undefined)return '[data-cm-act="'+d.cmAct+'"]'+(d.cmValue!==undefined?'[data-cm-value="'+d.cmValue+'"]':'');
 if(d.cmField!==undefined)return '[data-cm-field="'+d.cmField+'"]';
 if(d.cmNewtype!==undefined)return '[data-cm-newtype]';
 if(d.cmFile!==undefined)return '[data-cm-file]';
 if(d.cmScroll!==undefined)return '[data-cm-scroll]';
 return null;
}
// Redraws the body of the map page only, keeping where the map was scrolled to and where the keyboard focus was.
function repaint(root,c,l,prefer){
 const body=root?.querySelector?.('[data-cm-body]');if(!body)return false;
 let active=null;try{active=root.contains?.(global.document.activeElement)?global.document.activeElement:null}catch{}
 const want=prefer||focusKey(active),sc=root.querySelector('[data-cm-scroll]'),left=sc?.scrollLeft||0,top=sc?.scrollTop||0;
 body.innerHTML=bodyHTML(c,l);
 // The same words twice in a row (a pin moved step by step) still have to be a change, or they are read once only.
 try{const live=root.querySelector('[data-cm-live]'),say=foreign(c)?'':view(c).say;if(live)live.textContent=say&&live.textContent===say?say+'\u00a0':say}catch{}
 const now=root.querySelector('[data-cm-scroll]');if(now){now.scrollLeft=left;now.scrollTop=top}
 if(want){let el=null;try{el=root.querySelector(want)}catch{}if(!el||el.disabled)el=root.querySelector('[data-cm-act="mode"][aria-pressed="true"]');try{el?.focus?.({preventScroll:true})}catch{}}
 return true;
}
// Something outside a click on the page changed the map (the picture arrived, an undo): draw the open page again.
function repaintOpen(id){
 try{
  const root=global.document?.querySelector?.('[data-cm-page]');if(!root||root.dataset?.cmPage!==String(id))return false;
  const c=campaignOf(appState(),root.dataset.cmPage);if(!c)return false;
  return repaint(root,c,curLang());
 }catch{return false}
}
// Every removal here can be taken back for as long as the notice is on the screen.
function offerUndo(c,message,label,restore){
 const id=c.id;
 const run=()=>{
  const now=campaignOf(appState(),id);if(!now||foreign(now))return;
  const map=read(now)||blank();if(restore(map)===false||!write(now,map))return;
  view(now).say=''; // the line that announced the removal is no longer true
  try{global.App.save()}catch{}
  if(!repaintOpen(String(id))){try{global.App.render()}catch{}}
 };
 try{if(typeof global.App?.notifyAction==='function'){global.App.notifyAction(message,label,run);return}}catch{}
 try{global.App?.notify?.(message)}catch{}
}
const later=f=>{try{(global.setTimeout||setTimeout)(f,0)}catch{}};
let suppressClick=0;
// Returns {handled, dirty, rerender}. The caller (campaigns.js) saves and, for opening and closing, draws the whole page.
function handle(e,c,ctx){
 const el=e?.target,root=el?.closest?.('[data-cm-root]');
 if(!root||!isObj(c))return {handled:false,dirty:false};
 const l=L(ctx?.lang),t=T[l],idle={handled:true,dirty:false},notify=m=>{try{ctx?.notify?.(m)}catch{}};
 const act=e.type==='click'?el.closest?.('[data-cm-act]'):null,a=act?.dataset?.cmAct;
 // The focus follows the reader onto the page they asked for and back to the button they came from.
 if(a==='open'){openId=String(c.id);tidy();later(()=>global.document?.querySelector?.('[data-cm-page] [data-cm-act="close"]')?.focus?.());return {handled:true,dirty:false,rerender:true}}
 if(a==='close'){openId=null;later(()=>global.document?.querySelector?.('[data-cm-card] [data-cm-act="open"]')?.focus?.());return {handled:true,dirty:false,rerender:true}}
 if(!['click','change','input'].includes(e.type)||foreign(c))return idle;
 const map=read(c)||blank(),v=view(c),id=String(c.id);
 const done=(dirty,prefer,say='')=>{if(dirty&&!write(c,map))return idle;v.say=say;repaint(root,c,l,prefer);return {handled:true,dirty:!!dirty}};
 const place=(x,y)=>{
  const pin=addPin(map,{t:v.type,x,y,name:t.newPin(map.pins.length+1)});if(!pin){notify(t.full);return idle}
  v.sel=pin.id;v.mode='select';if(v.filter.size)v.filter.add(pin.t);
  return done(true,'[data-cm-field="name"]',t.sayAdded(pin.name));
 };
 const remove=pid=>{
  const snap=removePin(map,pid);if(!snap)return idle;
  if(v.sel===pid)v.sel=null;
  const r=done(true,'[data-cm-act="mode"][aria-pressed="true"]',t.removed(snap.pin.name));
  if(r.dirty)offerUndo(c,t.removed(snap.pin.name),t.undo,m=>restorePin(m,snap));
  return r;
 };
 if(e.type==='input'){
  // Text is saved as it is typed and the page is not redrawn, so the caret stays where it is; the places that repeat the name follow it.
  const f=el.dataset?.cmField,p=v.sel?pinOf(map,v.sel):null;if(!p||(f!=='name'&&f!=='note'))return idle;
  if(!updatePin(map,p.id,{[f]:el.value})||!write(c,map))return idle;
  if(f==='name'){
   try{
    const pinEl=root.querySelector(pinSel(p.id)),rowName=root.querySelector('[data-cm-row="'+p.id+'"] .cm-row-name'),label=pinEl?.querySelector('.cm-pin-name'),routeLine=root.querySelector('[data-cm-route-line]');
    if(pinEl)pinEl.setAttribute('aria-label',pinLabel(p,map,t));if(label)label.textContent=p.name;if(rowName)rowName.textContent=p.name;if(routeLine)routeLine.textContent=routeText(map,t);
   }catch{}
  }
  return {handled:true,dirty:true};
 }
 if(e.type==='change'){
  const d=el.dataset||{};
  if(d.cmDrop!==undefined){
   const raw=String(el.value||'');el.value='';
   const del=/^del\|([A-Za-z0-9_-]{1,40})$/.exec(raw);if(del)return remove(del[1]);
   const m=/^([A-Za-z0-9_-]{1,40})\|(\d{1,4}),(\d{1,4})$/.exec(raw);if(!m||v.mode!=='select')return idle;
   const p=pinOf(map,m[1]);if(!p||!movePin(map,p.id,Number(m[2]),Number(m[3])))return idle;
   v.sel=p.id;return done(true,pinSel(p.id),t.sayMoved(p.name));
  }
  if(d.cmFile!==undefined){const file=el.files?.[0];try{el.value=''}catch{}if(file)attach(file,c,l).catch(()=>{});return idle}
  if(d.cmNewtype!==undefined){if(TYPES.includes(el.value))v.type=el.value;return idle}
  const f=d.cmField,p=v.sel?pinOf(map,v.sel):null;
  if(f==='crewShown'){if(el.checked===true)map.crewShown=true;else delete map.crewShown;return done(true,'[data-cm-field="crewShown"]')}
  if(!p)return idle;
  if(f==='t'){if(!updatePin(map,p.id,{t:el.value}))return idle;if(v.filter.size)v.filter.add(p.t);return done(true,'[data-cm-field="t"]')}
  if(f==='shown'){const r=setShown(map,p.id,el.checked===true);if(!r.ok){el.checked=false;notify(t.sharedFull);return idle}return done(true,'[data-cm-field="shown"]')}
  // A name cannot be empty: leaving the field empty brings the saved name back.
  if(f==='name'&&!line(el.value,MAX_NAME)){el.value=p.name;return idle}
  return idle;
 }
 if(act){
  if(a==='mode'){v.mode=['add','route'].includes(act.dataset.cmValue)?act.dataset.cmValue:'select';return done(false)}
  if(a==='zoom-in'||a==='zoom-out'){v.zoom=Math.min(3,Math.max(1,v.zoom+(a==='zoom-in'?1:-1)));return done(false,v.zoom>=3?'[data-cm-act="zoom-out"]':v.zoom<=1?'[data-cm-act="zoom-in"]':null)}
  if(a==='labels'){v.labels=!v.labels;return done(false)}
  if(a==='filter'){const k=act.dataset.cmValue;if(!k)v.filter.clear();else if(v.filter.has(k))v.filter.delete(k);else if(TYPES.includes(k))v.filter.add(k);const p=v.sel?pinOf(map,v.sel):null;if(p&&v.filter.size&&!v.filter.has(p.t))v.sel=null;return done(false)}
  if(a==='add-centre'){
   // A second pin put in the centre steps aside, so it does not hide the first one.
   const spot=freeSpot(map);return place(spot.x,spot.y);
  }
  if(a==='route-clear'){const was=clearRoute(map);if(!was.length)return idle;const r=done(true,'[data-cm-act="mode"][aria-pressed="true"]',t.routeCleared);if(r.dirty)offerUndo(c,t.routeCleared,t.undo,m=>{if(m.route?.length){notify(t.routeKept);return false}m.route=was.filter(x=>pinOf(m,x))});return r}
  if(a==='pin-remove')return v.sel?remove(v.sel):idle;
  if(a==='crew'){const p=v.sel?pinOf(map,v.sel):null;if(!p)return idle;const off=map.crew===p.id;setCrew(map,off?null:p.id);return done(true,'[data-cm-act="crew"]',off?t.sayCrewOff:t.sayCrew(p.name))}
  if(a==='pic-remove'){
   if(!pics.get(id)||!global.confirm?.(t.picConfirm))return idle;
   // The proportions stay with the campaign, so the pins keep their places on the grid.
   dropPic(id).then(had=>{
    if(!repaintOpen(id)){try{global.App?.render?.()}catch{}}
    const back=()=>{if(had)savePic(id,had).then(()=>{if(!repaintOpen(id)){try{global.App?.render?.()}catch{}}})};
    try{if(typeof global.App?.notifyAction==='function')global.App.notifyAction(t.picRemoved,t.undo,back);else notify(t.picRemoved)}catch{}
   });
   return idle;
  }
  return idle;
 }
 const rowEl=el.closest?.('[data-cm-row]');
 if(rowEl){
  const p=pinOf(map,rowEl.dataset.cmRow);if(!p)return idle;
  v.sel=p.id;const r=done(false,'[data-cm-row="'+p.id+'"]');
  try{root.querySelector(pinSel(p.id))?.scrollIntoView?.({block:'nearest',inline:'nearest'})}catch{}
  return r;
 }
 const pinEl=el.closest?.('[data-cm-pin]');
 if(pinEl){
  if(Date.now()-suppressClick<400)return idle;
  const p=pinOf(map,pinEl.dataset.cmPin);if(!p)return idle;
  if(v.mode==='route'){
   const r=toggleRoute(map,p.id);if(!r.ok){notify(t.routeFull);return idle}
   return done(true,pinSel(p.id),r.added?t.sayStop(p.name,r.stops):t.sayUnstop(p.name));
  }
  v.sel=p.id;return done(false,pinSel(p.id));
 }
 const stage=el.closest?.('[data-cm-stage]');
 if(stage&&v.mode==='add'){
  if(Date.now()-suppressClick<400)return idle;
  let r=null;try{r=stage.getBoundingClientRect()}catch{}
  if(!r||!(r.width>0)||!(r.height>0)||!Number.isFinite(e.clientX)||!Number.isFinite(e.clientY))return idle;
  return place((e.clientX-r.left)/r.width*1000,(e.clientY-r.top)/r.height*1000);
 }
 return idle;
}

/* ---------- Online room: what players get ---------- */
const empty=()=>({campaign:'',ratio:1.5,pins:[],crew:null});
let shownMap=empty(),shownAt=0,roomKey='',lastSent=null,sentAt=0,lastOnline=0;
// Exactly four things leave the device: the campaign name, the proportions of the stage, [type,x,y,name] of the pins the
// Game Master chose, and the point where the crew is. No ids, no notes, no route, nothing of the picture.
function payload(c){
 const map=isObj(c)?read(c):null;if(!map)return {data:empty(),fit:0,total:0};
 const pins=map.pins.filter(p=>p.shown===true).slice(0,MAX_SHARED).map(p=>[p.t,p.x,p.y,p.name]),total=pins.length,cp=map.crewShown===true&&map.crew?pinOf(map,map.crew):null;
 const data={campaign:line(c.name,80),ratio:map.ratio,pins,crew:cp?[cp.x,cp.y]:null};
 while(pins.length&&size(JSON.stringify(data))>MAX_BYTES)pins.pop();
 return {data,fit:pins.length,total};
}
// Anything received is rebuilt from scratch.
function cleanShared(d){
 const out=empty();if(!isObj(d))return out;
 out.campaign=line(d.campaign,80);out.ratio=ratioOf(d.ratio);
 for(const p of Array.isArray(d.pins)?d.pins.slice(0,MAX_SHARED):[]){
  if(!Array.isArray(p)||!int(p[1],0,1000)||!int(p[2],0,1000))continue;
  const name=line(p[3],MAX_NAME);if(name)out.pins.push([TYPES.includes(p[0])?p[0]:'other',p[1],p[2],name]);
 }
 if(Array.isArray(d.crew)&&int(d.crew[0],0,1000)&&int(d.crew[1],0,1000))out.crew=[d.crew[0],d.crew[1]];
 return out;
}
function sync(who){const k=who?String(who.room||''):'';if(k!==roomKey){roomKey=k;shownMap=empty();shownAt=0;lastSent=null;sentAt=0;lastOnline=0}}
// Called by room.js for the Game Master whenever it publishes its own state. Sends when what players may see changed; `force`
// (a heartbeat or a new connection) repeats it now and then, so a relay that lost its copy gets one again. An empty map is
// small and is repeated on every heartbeat: pins the Game Master took back do not stay with players who join later.
function publish(force=false,now=Date.now()){
 const who=whoIs();sync(who);if(!who||who.role!=='gm')return false;
 const data=payload(campaignOf(appState(),who.campaignId)).data,s=JSON.stringify(data),online=Number(who.online)||0,grew=online>lastOnline;lastOnline=online;
 const bare=!data.pins.length&&!data.crew;
 if(s===lastSent&&!(force&&(grew||bare||now-sentAt>=RESEND)))return false;
 lastSent=s;sentAt=now;
 try{Promise.resolve(link().send(data,now)).then(n=>{if(!n&&lastSent===s)lastSent=null},()=>{if(lastSent===s)lastSent=null})}catch{lastSent=null}
 return true;
}
// Called by room.js only for a message the trusted Game Master signed. True when the view has to be repainted.
function receive(d,at,retained=false,now=Date.now()){
 const who=whoIs();sync(who);if(!who||who.role==='gm')return false;
 const when=Number(at);if(!Number.isFinite(when)||when<shownAt||now-when>TTL)return false;
 const next=cleanShared(d),changed=JSON.stringify(next)!==JSON.stringify(shownMap);
 shownAt=when;shownMap=next;
 if(changed&&(next.pins.length||next.crew)&&!retained){try{global.App?.notify?.(T[curLang()].updated)}catch{}}
 return changed;
}
// The card on the room page: the placeholder grid with the shown pins for players, one line of summary for the Game Master.
function roomCard(){
 const who=whoIs();sync(who);if(!who)return '';
 const t=T[curLang()],gm=who.role==='gm',head=n=>`<div class="card-heading"><span>${esc(t.title)}</span><span data-nx>${n}</span></div>`;
 if(gm){
  const camp=campaignOf(appState(),who.campaignId),p=payload(camp).data;
  return `<section class="card room-citymap" data-cm-room>${head(p.pins.length)}<p class="room-muted">${esc(!camp?t.gmNoCampaign:p.pins.length||p.crew?t.gmSees(p.pins.length)+(p.crew?t.stCrew:''):t.gmNone)}</p></section>`;
 }
 const d=shownMap;if(!d.pins.length&&!d.crew)return '';
 const here=d.crew?d.pins.find(p=>p[1]===d.crew[0]&&p[2]===d.crew[1]):null;
 const pin=p=>`<span class="cm-pin cm-static${here===p?' cm-crew':''}${edge(p[1])}" style="${at(p[1],p[2])}">${glyph(p[0])}<span class="cm-pin-name">${esc(p[3])}</span></span>`;
 const crew=d.crew?`<span class="cm-pin cm-static cm-crew${here?' cm-crew-only':''}${edge(d.crew[0])}" style="${at(d.crew[0],d.crew[1])}">${here?'':`<span class="cm-chip cm-t-crew">◎</span>`}<span class="cm-crew-tag">${esc(t.crewTag)}</span></span>`:'';
 return `<section class="card room-citymap" data-cm-room>${head(d.pins.length)}${d.campaign?`<p class="room-muted cm-campaign">${esc(d.campaign)}</p>`:''}<p class="room-muted">${esc(t.roomFrom)}</p><div class="cm-stage cm-grid cm-shared" style="aspect-ratio:${d.ratio}" role="img" aria-label="${esc(t.roomStage(d.pins.length)+(d.crew?t.roomStageCrew:''))}">${d.pins.map(pin).join('')}${crew}</div>${d.pins.length?`<ul class="cm-shared-list">${d.pins.map(p=>`<li>${glyph(p[0])}<span><b>${esc(p[3])}</b> — ${esc(t.types[p[0]])}</span></li>`).join('')}</ul>`:''}${d.crew?`<p class="cm-crew-line">${esc(here?t.roomCrewAt(here[3]):t.roomCrew)}</p>`:''}</section>`;
}

/* ---------- Keyboard and drag (browser only) ---------- */
function wire(){
 const doc=global.document;if(!doc||typeof doc.addEventListener!=='function')return;
 // Saving goes the usual way, through the campaign page: a hidden field gets the new place and reports a change.
 const send=(root,value)=>{const input=root?.querySelector?.('[data-cm-drop]');if(!input||typeof global.Event!=='function')return;input.value=value;input.dispatchEvent(new global.Event('change',{bubbles:true}))};
 doc.addEventListener('keydown',e=>{
  const pin=e.target?.closest?.('button[data-cm-pin]');if(!pin||e.altKey||e.ctrlKey||e.metaKey)return;
  const root=pin.closest('[data-cm-root]');
  if(e.key==='Delete'){e.preventDefault();send(root,'del|'+pin.dataset.cmPin);return}
  const [x,y]=String(pin.dataset.cmXy||'').split(',').map(Number),to=Number.isFinite(x)&&Number.isFinite(y)?nudge(x,y,e.key,e.shiftKey):null;
  if(!to||pin.closest('[data-cm-scroll]')?.dataset.cmMode!=='select')return;
  e.preventDefault();send(root,pin.dataset.cmPin+'|'+to.x+','+to.y);
 });
 let drag=null;
 const end=back=>{if(!drag)return;drag.el.classList.remove('cm-dragging');if(back){drag.el.style.setProperty('--x',drag.left);drag.el.style.setProperty('--y',drag.top)}drag=null};
 doc.addEventListener('pointerdown',e=>{
  const el=e.target?.closest?.('button[data-cm-pin]');
  if(!el||e.button>0||e.isPrimary===false||el.closest('[data-cm-scroll]')?.dataset.cmMode!=='select')return;
  const stage=el.closest('[data-cm-stage]');if(!stage)return;
  end(true);drag={el,stage,id:el.dataset.cmPin,x:e.clientX,y:e.clientY,pointer:e.pointerId,active:false,pos:null,left:el.style.getPropertyValue('--x'),top:el.style.getPropertyValue('--y')};
 });
 doc.addEventListener('pointermove',e=>{
  if(!drag||e.pointerId!==drag.pointer)return;
  if(!drag.active){if(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)<8)return;drag.active=true;drag.el.classList.add('cm-dragging')}
  const r=drag.stage.getBoundingClientRect();if(!(r.width>0)||!(r.height>0))return;
  drag.pos={x:clamp((e.clientX-r.left)/r.width*1000),y:clamp((e.clientY-r.top)/r.height*1000)};
  drag.el.style.setProperty('--x',drag.pos.x/10+'%');drag.el.style.setProperty('--y',drag.pos.y/10+'%');
  e.preventDefault();
 },{passive:false});
 doc.addEventListener('pointerup',e=>{
  if(!drag||e.pointerId!==drag.pointer)return;
  const d=drag;end(false);if(!d.active)return;
  // The click that ends a drag is not a tap on the pin.
  suppressClick=Date.now();
  if(d.pos)send(d.stage.closest('[data-cm-root]'),d.id+'|'+d.pos.x+','+d.pos.y);
 });
 doc.addEventListener('pointercancel',()=>end(true));
}
wire();

global.CityMap={TYPES,GLYPH,MAX_PINS,MAX_SHARED,MAX_ROUTE,MAX_NAME,MAX_NOTE,MAX_BYTES,TTL,PIC_SIDE,PIC_CHARS,
 clean,read,foreign,blank,write,addPin,updatePin,movePin,removePin,restorePin,toggleRoute,clearRoute,setCrew,setShown,typesUsed,filterPins,nudge,
 fit,validPic,loadPic,savePic,keepPic,dropPic,sweep,freeSpot,
 isOpen,page,card,owns,handle,
 payload,cleanShared,publish,receive,roomCard,statusText,
 // The Game Master role came (back) to this device: whoever held it in between sent a map of their own, so the next
 // publish goes out even when this device's map has not changed since it last sent it.
 forget(){lastSent=null;sentAt=0},
 _view:view,
 _test:{T,shown:()=>shownMap,reset:()=>{roomKey='\u0000';sync(null)},state:()=>({lastSent,sentAt,shownAt}),setStore:s=>{store=s;pics.clear();pending.clear();volatile.clear()},setOpen:id=>{openId=id===null?null:String(id)},pics,volatile}};
})(typeof window!=='undefined'?window:globalThis);
