/* Battle map for a campaign's combat tracker. A square grid, one square = 2 m (movement, p. 169;
   range table, pp. 172–173). Tokens stand for the tracker's participants, cover squares block
   movement. The map lives in campaign.map: {v:1,w,h,tokens:[{id,x,y,m?}],cover:[[x,y],…]} —
   optional, small, and read through clean() every time, so a damaged or foreign value is never
   trusted. Selection, the weapon choice and the movement counter are view state and are not saved. */
(function(){
'use strict';
const CELL_M=2,W_MIN=6,W_MAX=30,H_MIN=4,H_MAX=20,W_DEF=14,H_DEF=10,MAX_TOKENS=60,MAX_COVER=200,SHARED_ROWS=40;
const T={
 ru:{title:'КАРТА БОЯ',
  help:'Одна клетка — 2 м. Выберите фишку и нажмите клетку, чтобы поставить или передвинуть её; фишку можно и перетащить. Выберите вторую фишку, чтобы измерить дистанцию. Карта хранится в кампании.',
  create:'Создать карту',empty:'Карты пока нет. Создайте её, чтобы расставить участников трекера по клеткам.',
  foreign:'Карта сохранена в неизвестном формате и здесь не показывается. Данные не изменены.',
  modeLabel:'Режим карты',modeMove:'Фишки',modeCover:'Укрытия',placeAll:'Расставить всех',undo:'Отменить ход',clear:'Очистить карту',remove:'Удалить карту',
  confirmClear:'Убрать с карты все фишки и укрытия?',confirmRemove:'Удалить карту этой кампании? Участники трекера останутся.',
  width:'Ширина, клеток',height:'Высота, клеток',tray:'Не на карте',trayNone:'Все участники на карте.',noRoster:'В трекере пока нет участников.',
  grid:'Поле боя',cellEmpty:'пусто',cellCover:'укрытие',hidden:'скрыт от игроков',out:'вне боя',turnNow:'ходит сейчас',pc:'персонаж',npc:'NPC',
  selected:'Выбрано',pick:'Выберите фишку на карте или в списке «Не на карте».',pickCover:'Нажимайте клетки, чтобы поставить или убрать укрытие.',
  placeHint:'Нажмите свободную клетку, чтобы поставить фишку.',unplace:'Убрать с карты',deselect:'Снять выбор',
  moveLabel:'MOVE',moveHelp:'Берётся из листа или шаблона; измените, если действуют штрафы.',moveUnknown:'Укажите MOVE, чтобы увидеть запас хода.',
  allowance:(m,sq)=>`Действие перемещения: до ${m} м (${sq} кл.). Действие «Бег» даёт ещё столько же.`,
  spent:(a,b)=>`Пройдено за этот ход: ${a} м из ${b} м.`,over:'Больше одного действия перемещения — нужен «Бег».',overRun:'Больше, чем позволяет перемещение вместе с «Бегом».',
  legendReach:'Перемещение',legendRun:'С «Бегом»',legendCover:'Укрытие',legendPc:'Персонаж',legendNpc:'NPC',
  weapon:'Тип оружия',distance:(a,b,m,sq)=>`${a} → ${b}: ${m} м (${sq} кл.)`,dvSingle:'одиночный',dvAuto:'автоогонь',noDv:'вне дальности этого оружия',
  dvNote:'Для попадания результат должен быть строго выше DV.',lineCover:'На прямой между ними есть укрытие — проверьте линию видимости.',
  targetHint:'Нажмите другую фишку, чтобы измерить дистанцию и получить DV.',
  occupied:'Клетка занята.',coverBusy:'В клетке укрытие.',tokenBusy:'В клетке стоит фишка.',full:'На карте слишком много фишек.',coverFull:'Слишком много укрытий.',
  moved:(n,m,sq)=>`${n}: перемещение на ${m} м (${sq} кл.).`,placed:(n,c)=>`${n}: клетка ${c}.`,
  sharedTitle:'Карта боя',sharedHelp:'Карта ведущего, только просмотр. Одна клетка — 2 м.',sharedCover:'Укрытия',noChar:'без персонажа'},
 en:{title:'BATTLE MAP',
  help:'One square is 2 m. Select a token and tap a square to place or move it; you can also drag a token. Select a second token to measure the distance. The map is stored in the campaign.',
  create:'Create map',empty:'No map yet. Create one to place the tracker participants on a grid.',
  foreign:'The map is saved in an unknown format and is not shown here. The data is left untouched.',
  modeLabel:'Map mode',modeMove:'Tokens',modeCover:'Cover',placeAll:'Place everyone',undo:'Undo move',clear:'Clear map',remove:'Delete map',
  confirmClear:'Remove all tokens and cover from the map?',confirmRemove:'Delete this campaign’s map? The tracker participants stay.',
  width:'Width, squares',height:'Height, squares',tray:'Not on the map',trayNone:'Everyone is on the map.',noRoster:'The tracker has no participants yet.',
  grid:'Battlefield',cellEmpty:'empty',cellCover:'cover',hidden:'hidden from players',out:'out of the fight',turnNow:'acting now',pc:'character',npc:'NPC',
  selected:'Selected',pick:'Select a token on the map or in the “Not on the map” list.',pickCover:'Tap squares to add or remove cover.',
  placeHint:'Tap a free square to place the token.',unplace:'Take off the map',deselect:'Deselect',
  moveLabel:'MOVE',moveHelp:'Taken from the sheet or template; change it when penalties apply.',moveUnknown:'Enter MOVE to see the movement allowance.',
  allowance:(m,sq)=>`Move Action: up to ${m} m (${sq} sq.). The Run Action adds as much again.`,
  spent:(a,b)=>`Moved this turn: ${a} m of ${b} m.`,over:'More than one Move Action — this needs the Run Action.',overRun:'More than a Move Action plus the Run Action allow.',
  legendReach:'Move',legendRun:'With Run',legendCover:'Cover',legendPc:'Character',legendNpc:'NPC',
  weapon:'Weapon type',distance:(a,b,m,sq)=>`${a} → ${b}: ${m} m (${sq} sq.)`,dvSingle:'single shot',dvAuto:'autofire',noDv:'out of this weapon’s range',
  dvNote:'To hit, the result must be strictly above the DV.',lineCover:'There is cover on the straight line between them — check line of sight.',
  targetHint:'Tap another token to measure the distance and get the DV.',
  occupied:'The square is taken.',coverBusy:'There is cover in that square.',tokenBusy:'A token stands in that square.',full:'Too many tokens on the map.',coverFull:'Too much cover.',
  moved:(n,m,sq)=>`${n}: moved ${m} m (${sq} sq.).`,placed:(n,c)=>`${n}: square ${c}.`,
  sharedTitle:'Battle map',sharedHelp:'The GM’s map, view only. One square is 2 m.',sharedCover:'Cover',noChar:'no character'}
};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const L=lang=>lang==='en'?'en':'ru';
const int=(v,lo,hi)=>Number.isInteger(v)&&v>=lo&&v<=hi;
const key=(x,y)=>x+','+y;
const isObj=v=>!!v&&typeof v==='object'&&!Array.isArray(v);

/* ---------- Data ---------- */
// A copy that can be trusted, or null. `roster` (optional) drops tokens whose participant is gone.
function clean(raw,roster){
 if(!isObj(raw)||raw.v!==1||!int(raw.w,W_MIN,W_MAX)||!int(raw.h,H_MIN,H_MAX))return null;
 const ids=Array.isArray(roster)?new Set(roster.filter(r=>r&&typeof r.id==='string').map(r=>r.id)):null;
 const taken=new Set(),seen=new Set(),tokens=[],cover=[];
 for(const c of Array.isArray(raw.cover)?raw.cover:[]){
  if(cover.length>=MAX_COVER)break;
  if(!Array.isArray(c)||c.length!==2||!int(c[0],0,raw.w-1)||!int(c[1],0,raw.h-1)||taken.has(key(c[0],c[1])))continue;
  taken.add(key(c[0],c[1]));cover.push([c[0],c[1]]);
 }
 for(const t of Array.isArray(raw.tokens)?raw.tokens:[]){
  if(tokens.length>=MAX_TOKENS)break;
  if(!isObj(t)||typeof t.id!=='string'||!t.id||t.id.length>160||seen.has(t.id)||!int(t.x,0,raw.w-1)||!int(t.y,0,raw.h-1)||taken.has(key(t.x,t.y)))continue;
  if(ids&&!ids.has(t.id))continue;
  seen.add(t.id);taken.add(key(t.x,t.y));
  tokens.push(int(t.m,0,20)?{id:t.id,x:t.x,y:t.y,m:t.m}:{id:t.id,x:t.x,y:t.y});
 }
 return {v:1,w:raw.w,h:raw.h,tokens,cover};
}
const read=campaign=>clean(campaign?.map,campaign?.roster);
// A value that is there but is not ours to rewrite (a later format, or damage).
const foreign=campaign=>campaign?.map!==undefined&&campaign?.map!==null&&!read(campaign);
const blank=(w=W_DEF,h=H_DEF)=>({v:1,w,h,tokens:[],cover:[]});
function write(campaign,map){const next=clean(map,campaign.roster);if(!next)return false;campaign.map=next;return true}

const tokenAt=(map,x,y)=>map.tokens.find(t=>t.x===x&&t.y===y)||null;
const coverAt=(map,x,y)=>map.cover.some(c=>c[0]===x&&c[1]===y);
const inside=(map,x,y)=>int(x,0,map.w-1)&&int(y,0,map.h-1);
// Places or moves a token. Returns '' or the reason it cannot be done.
function placeToken(map,id,x,y){
 if(!inside(map,x,y))return 'occupied';
 if(coverAt(map,x,y))return 'coverBusy';
 const there=tokenAt(map,x,y);if(there)return there.id===id?'':'occupied';
 const t=map.tokens.find(k=>k.id===id);
 if(t){t.x=x;t.y=y;return ''}
 if(map.tokens.length>=MAX_TOKENS)return 'full';
 map.tokens.push({id,x,y});return '';
}
function removeToken(map,id){const i=map.tokens.findIndex(t=>t.id===id);if(i<0)return false;map.tokens.splice(i,1);return true}
function toggleCover(map,x,y){
 if(!inside(map,x,y))return 'occupied';
 const i=map.cover.findIndex(c=>c[0]===x&&c[1]===y);
 if(i>=0){map.cover.splice(i,1);return ''}
 if(tokenAt(map,x,y))return 'tokenBusy';
 if(map.cover.length>=MAX_COVER)return 'coverFull';
 map.cover.push([x,y]);return '';
}
// A new size keeps what still fits; tokens left outside go back to the "not on the map" list.
function resize(map,w,h){
 if(!int(w,W_MIN,W_MAX)||!int(h,H_MIN,H_MAX))return false;
 map.w=w;map.h=h;map.tokens=map.tokens.filter(t=>t.x<w&&t.y<h);map.cover=map.cover.filter(c=>c[0]<w&&c[1]<h);return true;
}
// Everyone not yet on the map: characters down the left edge, NPCs down the right, filling inwards.
function placeAll(map,roster){
 let added=0;
 const free=(x,y)=>!coverAt(map,x,y)&&!tokenAt(map,x,y);
 for(const r of Array.isArray(roster)?roster:[]){
  if(!r||typeof r.id!=='string'||map.tokens.some(t=>t.id===r.id)||map.tokens.length>=MAX_TOKENS)continue;
  const left=r.kind==='pc';let done=false;
  for(let i=0;i<map.w&&!done;i++){const x=left?i:map.w-1-i;for(let y=0;y<map.h&&!done;y++)if(free(x,y)){map.tokens.push({id:r.id,x,y});added++;done=true}}
 }
 return added;
}

/* ---------- Geometry ---------- */
// Squares are counted with diagonals as one square each, the way a grid is used at the table.
function distance(a,b){const squares=Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y));return {squares,metres:squares*CELL_M}}
// Steps from a square to every square that can be walked to; cover blocks, other tokens do not.
function steps(map,from){
 const blocked=new Set(map.cover.map(c=>key(c[0],c[1]))),out=new Map([[key(from.x,from.y),0]]);let queue=[[from.x,from.y]];
 while(queue.length){const next=[];
  for(const [x,y] of queue){const d=out.get(key(x,y));
   for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){const nx=x+dx,ny=y+dy,k=key(nx,ny);if((!dx&&!dy)||!inside(map,nx,ny)||blocked.has(k)||out.has(k))continue;out.set(k,d+1);next.push([nx,ny])}}
  queue=next}
 return out;
}
// Squares a move costs: the walk around cover, or the straight count when there is no way through.
function moveCost(map,from,to){const d=steps(map,from).get(key(to.x,to.y));return d===undefined?distance(from,to).squares:d}
// Cover squares strictly between two squares, on the straight line.
function lineCover(map,a,b){
 const n=distance(a,b).squares,hit=[];
 for(let i=1;i<n;i++){const x=Math.round(a.x+(b.x-a.x)*i/n),y=Math.round(a.y+(b.y-a.y)*i/n);if(coverAt(map,x,y))hit.push([x,y])}
 return hit;
}
function rangeHint(type,metres){
 const f=globalThis.window?.CombatTools?.rangeDV;if(typeof f!=='function')return {single:null,auto:null};
 return {single:f(type,metres,'single')??null,auto:f(type,metres,'auto')??null};
}
function weaponTypes(lang){
 const all=globalThis.window?.CombatTools?.RANGE;if(!isObj(all))return [];
 return Object.entries(all).filter(([,v])=>isObj(v)&&Array.isArray(v.single)).map(([id,v])=>({id,name:String(v.name?.[L(lang)]||id),auto:Array.isArray(v.auto)}));
}
// MOVE of a participant: the value set on the token, the sheet, or the book template; null when unknown.
function moveOf(row,characters,token){
 if(token&&int(token.m,0,20))return token.m;
 if(!row)return null;
 let n=null;
 if(row.kind==='pc'){const pc=(Array.isArray(characters)?characters:[]).find(c=>c&&c.id===row.characterId);n=pc?Number(pc.stats?.MOVE):null}
 else if(typeof row.sourceTemplate==='string'){const rows=globalThis.window?.GMTools?.NPC_TEMPLATES,tpl=Array.isArray(rows)?rows.find(x=>x&&x.id===row.sourceTemplate):null;n=tpl?Number(tpl.stats?.MOVE):null}
 return int(n,0,20)?n:null;
}
// Column letters and row numbers: A1 is the top left square.
function cellName(x,y){let s='',n=x;do{s=String.fromCharCode(65+n%26)+s;n=Math.floor(n/26)-1}while(n>=0);return s+(y+1)}
// Two or three characters for a token: the first letter and the trailing number, or the first two letters.
function label(name){
 const s=String(name??'').trim();if(!s)return '?';
 const chars=[...s],num=/(\d{1,2})\s*$/.exec(s),first=chars[0].toUpperCase();
 if(num&&chars.length>num[1].length)return first+num[1];
 const words=s.split(/\s+/).filter(Boolean);
 if(words.length>1)return first+[...words[1]][0].toUpperCase();
 return first+(chars[1]||'').toLowerCase();
}
function nameOf(row,characters,t){
 if(!row)return '?';
 if(row.kind!=='pc')return String(row.name||'?');
 const pc=(Array.isArray(characters)?characters:[]).find(c=>c&&c.id===row.characterId);
 return pc?String(pc.name||'Edgerunner'):t.noChar;
}

/* ---------- View state (not saved) ---------- */
const views=new Map();
function view(campaign){
 const id=String(campaign?.id??'');let v=views.get(id);
 if(!v){if(views.size>30)views.clear();v={sel:null,target:null,mode:'move',weapon:'pistol',turn:'',spent:{},last:null,focus:'0,0',say:''};views.set(id,v)}
 const turn=(Number(campaign?.round)||1)+':'+(Number(campaign?.turnIndex)||0);
 if(v.turn!==turn){v.turn=turn;v.spent={};v.last=null}
 return v;
}
// The participant acting now, in the tracker's order.
function currentId(campaign){
 const roster=[...(campaign?.roster||[])].sort((a,b)=>{let n=(Number(b.initiative)||0)-(Number(a.initiative)||0);if(n)return n;const x=a.ties||[],y=b.ties||[];for(let i=0;i<Math.max(x.length,y.length);i++){n=(Number(y[i])||0)-(Number(x[i])||0);if(n)return n}return (Number(a.order)||0)-(Number(b.order)||0)});
 return roster[Number(campaign?.turnIndex)||0]?.id??null;
}

/* ---------- Rendering ---------- */
function gridHTML(map,cells,labelText,t,interactive,focus){
 let out='';
 for(let y=0;y<map.h;y++)for(let x=0;x<map.w;x++){
  const c=cells.get(key(x,y))||{},cls=['bm-cell'];
  if(c.cover)cls.push('bm-cover');if(c.reach)cls.push('bm-'+c.reach);
  if(c.token){cls.push('bm-has',c.pc?'bm-pc':'bm-npc');if(c.hidden)cls.push('bm-hidden');if(c.out)cls.push('bm-out');if(c.current)cls.push('bm-current');if(c.sel)cls.push('bm-sel');if(c.target)cls.push('bm-target')}
  const what=c.token?[c.name,c.pc?t.pc:t.npc,c.current?t.turnNow:'',c.hidden?t.hidden:'',c.out?t.out:''].filter(Boolean).join(', '):c.cover?t.cellCover:t.cellEmpty;
  const inner=c.token?`<span class="bm-token" aria-hidden="true">${esc(c.label)}</span>`:'';
  out+=interactive
   ?`<button type="button" class="${cls.join(' ')}" data-bm-cell="${x},${y}"${c.token?` data-bm-token="${esc(c.id)}" aria-pressed="${c.sel?'true':'false'}"`:''} tabindex="${focus===key(x,y)?0:-1}" aria-label="${esc(cellName(x,y)+': '+what)}" title="${esc(cellName(x,y)+(c.token?' · '+c.name:''))}">${inner}</button>`
   :`<span class="${cls.join(' ')}"${c.token?` title="${esc(c.name)}"`:''}>${inner}</span>`;
 }
 return `<div class="bm-grid${interactive?'':' bm-static'}" style="--bm-w:${map.w}"${interactive?` role="group" aria-label="${esc(labelText)}"`:' aria-hidden="true"'}>${out}</div>`;
}
function legendHTML(t,withReach){
 const item=(cls,text)=>`<span class="bm-legend-item"><span class="bm-swatch ${cls}" aria-hidden="true"></span>${esc(text)}</span>`;
 return `<p class="bm-legend">${item('bm-pc',t.legendPc)}${item('bm-npc',t.legendNpc)}${item('bm-cover',t.legendCover)}${withReach?item('bm-reach',t.legendReach)+item('bm-run',t.legendRun):''}</p>`;
}
function statusHTML(campaign,characters,map,v,t,lang){
 if(v.mode==='cover')return `<p>${esc(t.pickCover)}</p>`;
 const row=(campaign.roster||[]).find(r=>r&&r.id===v.sel);
 if(!row)return `<p>${esc(t.pick)}</p>`;
 const tok=map.tokens.find(k=>k.id===row.id),name=nameOf(row,characters,t),move=moveOf(row,characters,tok);
 let out=`<p><strong>${esc(t.selected)}: ${esc(name)}</strong>${tok?' · '+esc(cellName(tok.x,tok.y)):''}</p>`;
 if(!tok)return out+`<p>${esc(t.placeHint)}</p><div class="bm-row"><button type="button" class="btn ghost" data-bm-act="deselect">${esc(t.deselect)}</button></div>`;
 out+=`<div class="bm-row"><label class="field bm-move">${esc(t.moveLabel)}<input type="number" inputmode="numeric" min="0" max="20" step="1" data-bm-move value="${move===null?'':move}" aria-describedby="bm-move-help"></label><button type="button" class="btn ghost" data-bm-act="unplace">${esc(t.unplace)}</button><button type="button" class="btn ghost" data-bm-act="deselect">${esc(t.deselect)}</button></div><p class="muted" id="bm-move-help">${esc(t.moveHelp)}</p>`;
 if(move===null)out+=`<p>${esc(t.moveUnknown)}</p>`;
 else{
  const spent=Number(v.spent[row.id])||0;
  out+=`<p>${esc(t.allowance(move*CELL_M,move))}</p>`;
  if(spent)out+=`<p${spent>move?' class="bm-warn"':''}>${esc(t.spent(spent*CELL_M,move*CELL_M))}${spent>move*2?' '+esc(t.overRun):spent>move?' '+esc(t.over):''}</p>`;
 }
 const other=(campaign.roster||[]).find(r=>r&&r.id===v.target),otherTok=other?map.tokens.find(k=>k.id===other.id):null;
 if(!otherTok)return out+`<p class="muted">${esc(t.targetHint)}</p>`;
 const d=distance(tok,otherTok),types=weaponTypes(lang),hint=rangeHint(v.weapon,d.metres),type=types.find(x=>x.id===v.weapon);
 out+=`<p class="bm-distance"><strong>${esc(t.distance(name,nameOf(other,characters,t),d.metres,d.squares))}</strong></p>`;
 if(types.length){
  const dv=[hint.single!==null?`DV ${hint.single} (${t.dvSingle})`:'',type?.auto&&hint.auto!==null?`DV ${hint.auto} (${t.dvAuto})`:''].filter(Boolean);
  out+=`<div class="bm-row"><label class="field bm-weapon">${esc(t.weapon)}<select data-bm-weapon>${types.map(x=>`<option value="${esc(x.id)}"${x.id===v.weapon?' selected':''}>${esc(x.name)}</option>`).join('')}</select></label><p class="bm-dv" data-bm-dv>${dv.length?`<strong>${esc(dv.join(' · '))}</strong>`:esc(t.noDv)}</p></div><p class="muted">${esc(t.dvNote)}</p>`;
 }
 if(lineCover(map,tok,otherTok).length)out+=`<p class="bm-warn">${esc(t.lineCover)}</p>`;
 return out;
}
function inner(campaign,characters,lang){
 const t=T[L(lang)],head=`<div class="card-heading"><span>${esc(t.title)}</span><span data-page-ref>169 / 172–173</span></div>`;
 if(foreign(campaign))return head+`<p class="muted" role="status">${esc(t.foreign)}</p>`;
 const map=read(campaign);
 if(!map)return head+`<p class="muted">${esc(t.empty)}</p><button type="button" class="btn ghost" data-bm-act="create">＋ ${esc(t.create)}</button>`;
 const v=view(campaign),roster=(campaign.roster||[]).filter(r=>r&&typeof r.id==='string'),byId=new Map(roster.map(r=>[r.id,r])),now=currentId(campaign);
 if(v.sel&&!byId.has(v.sel))v.sel=null;
 if(v.target&&(!byId.has(v.target)||v.target===v.sel||!map.tokens.some(k=>k.id===v.target)))v.target=null;
 const cells=new Map();
 for(const c of map.cover)cells.set(key(c[0],c[1]),{cover:true});
 const selTok=v.mode==='move'?map.tokens.find(k=>k.id===v.sel):null,selMove=selTok?moveOf(byId.get(v.sel),characters,selTok):null;
 if(selTok&&selMove!==null){
  const left=Math.max(0,selMove-(Number(v.spent[v.sel])||0));
  for(const [k,d] of steps(map,selTok)){if(!d||d>left+selMove)continue;cells.set(k,{...(cells.get(k)||{}),reach:d<=left?'reach':'run'})}
 }
 for(const tok of map.tokens){const r=byId.get(tok.id),name=nameOf(r,characters,t);
  cells.set(key(tok.x,tok.y),{token:true,id:tok.id,name,label:label(name),pc:r.kind==='pc',hidden:r.kind==='npc'&&r.hidden===true,out:r.out===true||r.dead===true,current:tok.id===now,sel:tok.id===v.sel,target:tok.id===v.target})}
 const [fx,fy]=String(v.focus).split(',').map(Number);if(!inside(map,fx,fy))v.focus='0,0';
 const focus=selTok?key(selTok.x,selTok.y):v.focus;
 const tray=roster.filter(r=>!map.tokens.some(k=>k.id===r.id));
 const sizes=(lo,hi,cur)=>{let s='';for(let i=lo;i<=hi;i++)s+=`<option value="${i}"${i===cur?' selected':''}>${i}</option>`;return s};
 const mode=(id,text)=>`<button type="button" class="btn ghost bm-mode" data-bm-act="mode" data-bm-value="${id}" aria-pressed="${v.mode===id?'true':'false'}">${esc(text)}</button>`;
 return head+`<p class="muted">${esc(t.help)}</p>
<div class="bm-toolbar"><div class="bm-modes" role="group" aria-label="${esc(t.modeLabel)}">${mode('move',t.modeMove)}${mode('cover',t.modeCover)}</div><button type="button" class="btn ghost" data-bm-act="place-all"${tray.length?'':' disabled'}>${esc(t.placeAll)}</button><button type="button" class="btn ghost" data-bm-act="undo"${v.last?'':' disabled'}>↶ ${esc(t.undo)}</button></div>
<div class="bm-tray"><span class="bm-tray-label">${esc(t.tray)}:</span>${tray.length?tray.map(r=>{const name=nameOf(r,characters,t);return `<button type="button" class="bm-chip ${r.kind==='pc'?'bm-pc':'bm-npc'}${r.kind==='npc'&&r.hidden===true?' bm-hidden':''}" data-bm-tray="${esc(r.id)}" aria-pressed="${v.sel===r.id?'true':'false'}"><span class="bm-token" aria-hidden="true">${esc(label(name))}</span><span class="bm-chip-name">${esc(name)}</span></button>`}).join(''):`<span class="muted">${esc(roster.length?t.trayNone:t.noRoster)}</span>`}</div>
<div class="bm-scroll" data-bm-scroll data-bm-mode="${v.mode}">${gridHTML(map,cells,t.grid,t,true,focus)}</div>
${legendHTML(t,true)}
<div class="bm-status" data-bm-status role="status" aria-live="polite">${v.say?`<p class="bm-say">${esc(v.say)}</p>`:''}${statusHTML(campaign,characters,map,v,t,lang)}</div>
<div class="bm-toolbar bm-setup"><label class="field">${esc(t.width)}<select data-bm-size="w">${sizes(W_MIN,W_MAX,map.w)}</select></label><label class="field">${esc(t.height)}<select data-bm-size="h">${sizes(H_MIN,H_MAX,map.h)}</select></label><button type="button" class="btn ghost" data-bm-act="clear"${map.tokens.length||map.cover.length?'':' disabled'}>${esc(t.clear)}</button><button type="button" class="btn ghost bm-danger" data-bm-act="remove">✕ ${esc(t.remove)}</button></div>
<input type="hidden" data-bm-drop value="">`;
}
function render(campaign,characters,lang){
 if(!campaign||typeof campaign!=='object')return '';
 return `<section class="card battle-map" data-bm-root>${inner(campaign,characters,lang)}</section>`;
}

/* ---------- Events ---------- */
const owns=e=>!!e?.target?.closest?.('[data-bm-root]');
function focusKey(el){
 if(!el?.dataset)return null;const d=el.dataset;
 if(d.bmCell!==undefined)return '[data-bm-cell="'+d.bmCell+'"]';
 if(d.bmAct!==undefined)return '[data-bm-act="'+d.bmAct+'"]'+(d.bmValue?'[data-bm-value="'+d.bmValue+'"]':'');
 if(d.bmTray!==undefined)return '[data-bm-tray]';
 if(d.bmMove!==undefined)return '[data-bm-move]';
 if(d.bmWeapon!==undefined)return '[data-bm-weapon]';
 if(d.bmSize!==undefined)return '[data-bm-size="'+d.bmSize+'"]';
 return null;
}
// Redraws only the map card, keeping the scroll position of the grid and the keyboard focus.
function repaint(root,campaign,characters,lang,prefer){
 if(!root||typeof root.querySelector!=='function')return;
 let active=null;try{active=root.contains?.(document.activeElement)?document.activeElement:null}catch{}
 const want=prefer||focusKey(active),sc=root.querySelector('[data-bm-scroll]'),left=sc?.scrollLeft||0,top=sc?.scrollTop||0;
 root.innerHTML=inner(campaign,characters,lang);
 const now=root.querySelector('[data-bm-scroll]');if(now){now.scrollLeft=left;now.scrollTop=top}
 if(want){let el=null;try{el=root.querySelector(want)}catch{}if(!el||el.disabled)el=root.querySelector('[data-bm-cell][tabindex="0"]')||root.querySelector('[data-bm-act]');try{el?.focus?.({preventScroll:true})}catch{}}
}
let suppressClick=0;
// Returns {handled, dirty}. The caller saves; the card redraws itself.
function handle(e,campaign,ctx){
 const el=e?.target,root=el?.closest?.('[data-bm-root]');
 if(!root||!campaign)return {handled:false,dirty:false};
 const lang=L(ctx?.lang),t=T[lang],characters=ctx?.characters||[],done=(dirty,prefer)=>{repaint(root,campaign,characters,lang,prefer);return {handled:true,dirty:!!dirty}},idle={handled:true,dirty:false};
 if(e.type!=='click'&&e.type!=='change')return idle;
 if(foreign(campaign))return idle;
 const v=view(campaign);v.say='';
 const act=e.type==='click'?el.closest?.('[data-bm-act]'):null;
 if(act?.dataset.bmAct==='create'){if(read(campaign))return idle;campaign.map=blank();return done(true,'[data-bm-act="place-all"]')}
 const map=read(campaign);if(!map)return idle;
 const fail=code=>{ctx?.notify?.(t[code]||t.occupied);return idle};
 const rowOf=id=>(campaign.roster||[]).find(r=>r&&r.id===id)||null;
 // Moves or places the selected token and counts the squares against this turn's movement.
 const moveTo=(id,x,y)=>{
  const row=rowOf(id);if(!row)return idle;
  const was=map.tokens.find(k=>k.id===id),from=was?{x:was.x,y:was.y}:null;
  if(from&&from.x===x&&from.y===y)return idle;
  const cost=from?moveCost(map,from,{x,y}):0,why=placeToken(map,id,x,y);
  if(why)return fail(why);
  if(!write(campaign,map))return idle;
  const name=nameOf(row,characters,t);
  if(from){v.spent[id]=(Number(v.spent[id])||0)+cost;v.last={id,x:from.x,y:from.y,cost};v.say=t.moved(name,cost*CELL_M,cost)}
  else{v.last=null;v.say=t.placed(name,cellName(x,y))}
  v.sel=id;v.focus=key(x,y);
  return done(true,'[data-bm-cell="'+key(x,y)+'"]');
 };
 if(e.type==='change'){
  if(el.dataset?.bmDrop!==undefined){
   const m=/^([^|]{1,160})\|(\d{1,2}),(\d{1,2})$/.exec(String(el.value||''));el.value='';
   if(!m||v.mode!=='move')return idle;
   const x=Number(m[2]),y=Number(m[3]),there=tokenAt(map,x,y);
   if(there&&there.id!==m[1])return fail('occupied');
   return moveTo(m[1],x,y);
  }
  if(el.dataset?.bmSize){
   const n=Number(el.value),w=el.dataset.bmSize==='w'?n:map.w,h=el.dataset.bmSize==='h'?n:map.h;
   if(!resize(map,w,h)||!write(campaign,map))return done(false);
   v.last=null;return done(true);
  }
  if(el.dataset?.bmWeapon!==undefined){if(weaponTypes(lang).some(x=>x.id===el.value))v.weapon=el.value;return done(false)}
  if(el.dataset?.bmMove!==undefined){
   const tok=map.tokens.find(k=>k.id===v.sel),raw=String(el.value??'').trim();if(!tok)return done(false);
   if(raw===''){delete tok.m}
   else{const n=/^\d{1,2}$/.test(raw)?Number(raw):NaN;if(!int(n,0,20))return done(false);
    if(n===moveOf(rowOf(tok.id),characters,null))delete tok.m;else tok.m=n}
   if(!write(campaign,map))return idle;return done(true);
  }
  return idle;
 }
 if(act){
  const a=act.dataset.bmAct;
  if(a==='mode'){v.mode=act.dataset.bmValue==='cover'?'cover':'move';return done(false)}
  if(a==='deselect'){v.sel=null;v.target=null;return done(false,'[data-bm-cell][tabindex="0"]')}
  if(a==='unplace'){if(!removeToken(map,v.sel)||!write(campaign,map))return idle;v.target=null;v.last=null;return done(true,'[data-bm-tray]')}
  if(a==='place-all'){if(!placeAll(map,campaign.roster)||!write(campaign,map))return idle;v.last=null;return done(true)}
  if(a==='undo'){
   const last=v.last;v.last=null;if(!last||!rowOf(last.id))return done(false);
   if(placeToken(map,last.id,last.x,last.y)||!write(campaign,map))return done(false);
   v.spent[last.id]=Math.max(0,(Number(v.spent[last.id])||0)-last.cost);v.sel=last.id;
   return done(true,'[data-bm-cell="'+key(last.x,last.y)+'"]');
  }
  if(a==='clear'){if(!globalThis.confirm?.(t.confirmClear))return idle;map.tokens=[];map.cover=[];if(!write(campaign,map))return idle;v.sel=null;v.target=null;v.last=null;return done(true)}
  if(a==='remove'){if(!globalThis.confirm?.(t.confirmRemove))return idle;delete campaign.map;views.delete(String(campaign.id));return done(true,'[data-bm-act="create"]')}
  return idle;
 }
 const chip=el.closest?.('[data-bm-tray]');
 if(chip){const id=chip.dataset.bmTray;if(!rowOf(id))return idle;v.mode='move';v.target=null;v.sel=v.sel===id?null:id;return done(false,'[data-bm-cell][tabindex="0"]')}
 const cell=el.closest?.('[data-bm-cell]');
 if(!cell)return idle;
 if(Date.now()-suppressClick<400)return idle;
 const [x,y]=String(cell.dataset.bmCell).split(',').map(Number);
 if(!inside(map,x,y))return idle;
 v.focus=key(x,y);const here='[data-bm-cell="'+key(x,y)+'"]';
 if(v.mode==='cover'){const why=toggleCover(map,x,y);if(why)return fail(why);if(!write(campaign,map))return idle;v.last=null;return done(true,here)}
 const there=tokenAt(map,x,y);
 if(there){
  if(!v.sel||!rowOf(v.sel)){v.sel=there.id;v.target=null}
  else if(there.id===v.sel){v.sel=null;v.target=null}
  else if(!map.tokens.some(k=>k.id===v.sel)){v.sel=there.id;v.target=null}
  else v.target=v.target===there.id?null:there.id;
  return done(false,here);
 }
 if(coverAt(map,x,y))return fail('coverBusy');
 if(!v.sel||!rowOf(v.sel))return done(false,here);
 return moveTo(v.sel,x,y);
}

/* ---------- Online room: what players get ---------- */
// rows: the participants players are allowed to see, in the order they are sent. Hidden NPCs are not among them,
// so their tokens never leave the GM's device. A token points at its row by index.
function sharedPart(campaign,rows){
 const map=read(campaign);if(!map||!Array.isArray(rows))return null;
 const index=new Map();rows.slice(0,SHARED_ROWS).forEach((r,i)=>{if(r&&typeof r.id==='string'&&!(r.kind==='npc'&&r.hidden===true))index.set(r.id,i)});
 const t=map.tokens.filter(k=>index.has(k.id)).map(k=>[index.get(k.id),k.x,k.y]);
 return {map:{w:map.w,h:map.h,c:map.cover.map(c=>[c[0],c[1]]),t}};
}
function cleanShared(raw,rows){
 if(!isObj(raw)||!int(raw.w,W_MIN,W_MAX)||!int(raw.h,H_MIN,H_MAX))return null;
 const n=int(rows,0,SHARED_ROWS)?rows:0,taken=new Set(),seen=new Set(),c=[],t=[];
 for(const p of Array.isArray(raw.c)?raw.c.slice(0,MAX_COVER):[]){if(!Array.isArray(p)||!int(p[0],0,raw.w-1)||!int(p[1],0,raw.h-1)||taken.has(key(p[0],p[1])))continue;taken.add(key(p[0],p[1]));c.push([p[0],p[1]])}
 for(const p of Array.isArray(raw.t)?raw.t.slice(0,SHARED_ROWS):[]){if(!Array.isArray(p)||!int(p[0],0,n-1)||seen.has(p[0])||!int(p[1],0,raw.w-1)||!int(p[2],0,raw.h-1)||taken.has(key(p[1],p[2])))continue;seen.add(p[0]);taken.add(key(p[1],p[2]));t.push([p[0],p[1],p[2]])}
 return {w:raw.w,h:raw.h,c,t};
}
// combat: the room's cleaned combat state, {order:[{name,pc,none,current}], map}.
function sharedHTML(combat,lang){
 const map=cleanShared(combat?.map,Array.isArray(combat?.order)?Math.min(combat.order.length,SHARED_ROWS):0);if(!map)return '';
 const t=T[L(lang)],cells=new Map(),list=[];
 for(const c of map.c)cells.set(key(c[0],c[1]),{cover:true});
 for(const [i,x,y] of map.t){const r=combat.order[i]||{},name=r.pc&&(r.none||!r.name)?t.noChar:String(r.name||'?'),lab=label(name);
  cells.set(key(x,y),{token:true,name,label:lab,pc:!!r.pc,current:!!r.current});list.push(`<li><b>${esc(lab)}</b> ${esc(name)} — ${esc(cellName(x,y))}${r.current?' · '+esc(t.turnNow):''}</li>`)}
 return `<div class="bm-shared" data-bm-shared><h3 class="bm-shared-title">${esc(t.sharedTitle)}</h3><p class="room-muted">${esc(t.sharedHelp)}</p><div class="bm-scroll" tabindex="0" role="group" aria-label="${esc(t.sharedTitle)}">${gridHTML({w:map.w,h:map.h},cells,t.sharedTitle,t,false,'')}</div>${legendHTML(t,false)}${list.length?`<ul class="bm-shared-list">${list.join('')}</ul>`:''}${map.c.length?`<p class="room-muted">${esc(t.sharedCover)}: ${esc(map.c.map(c=>cellName(c[0],c[1])).join(', '))}</p>`:''}</div>`;
}

/* ---------- Import: roster rows get new ids, the tokens follow them ---------- */
function rekey(copy,oldRoster){
 try{
  if(!isObj(copy)||copy.map===undefined)return;
  const map=clean(copy.map);if(!map||!Array.isArray(oldRoster)||!Array.isArray(copy.roster))return;
  const ids=new Map();oldRoster.forEach((r,i)=>{const next=copy.roster[i]?.id;if(r&&typeof r.id==='string'&&typeof next==='string'&&!ids.has(r.id))ids.set(r.id,next)});
  map.tokens=map.tokens.filter(k=>ids.has(k.id)).map(k=>({...k,id:ids.get(k.id)}));
  copy.map=map;
 }catch{}
}

/* ---------- Keyboard and drag (browser only) ---------- */
function wire(){
 const doc=globalThis.document;if(!doc||typeof doc.addEventListener!=='function')return;
 doc.addEventListener('keydown',e=>{
  const cell=e.target?.closest?.('[data-bm-cell]');if(!cell||e.altKey||e.ctrlKey||e.metaKey)return;
  const step={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];if(!step)return;
  const [x,y]=String(cell.dataset.bmCell).split(',').map(Number),next=cell.closest('[data-bm-root]')?.querySelector('[data-bm-cell="'+(x+step[0])+','+(y+step[1])+'"]');
  e.preventDefault();if(!next)return;
  cell.tabIndex=-1;next.tabIndex=0;next.focus();
 });
 let drag=null;
 const cellUnder=e=>{const el=doc.elementFromPoint?.(e.clientX,e.clientY)?.closest?.('[data-bm-cell]');return el&&drag&&el.closest('[data-bm-root]')===drag.root?el:null};
 const end=()=>{if(!drag)return;drag.ghost?.remove();drag.el.classList.remove('bm-dragging');drag.over?.classList.remove('bm-drop');drag=null};
 doc.addEventListener('pointerdown',e=>{
  const el=e.target?.closest?.('[data-bm-cell][data-bm-token]');
  if(!el||e.button>0||e.isPrimary===false||el.closest('[data-bm-scroll]')?.dataset.bmMode!=='move')return;
  end();drag={el,root:el.closest('[data-bm-root]'),id:el.dataset.bmToken,x:e.clientX,y:e.clientY,pointer:e.pointerId,active:false,ghost:null,over:null};
 });
 doc.addEventListener('pointermove',e=>{
  if(!drag||e.pointerId!==drag.pointer)return;
  if(!drag.active){
   if(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)<8)return;
   drag.active=true;drag.el.classList.add('bm-dragging');
   const g=doc.createElement('span');g.className='bm-ghost '+(drag.el.classList.contains('bm-pc')?'bm-pc':'bm-npc');g.textContent=drag.el.textContent;g.setAttribute('aria-hidden','true');doc.body.appendChild(g);drag.ghost=g;
  }
  drag.ghost.style.left=e.clientX+'px';drag.ghost.style.top=e.clientY+'px';
  const over=cellUnder(e);if(over!==drag.over){drag.over?.classList.remove('bm-drop');over?.classList.add('bm-drop');drag.over=over}
  e.preventDefault();
 },{passive:false});
 doc.addEventListener('pointerup',e=>{
  if(!drag||e.pointerId!==drag.pointer)return;
  const d=drag,over=d.active?cellUnder(e):null;end();
  if(!d.active)return;
  suppressClick=Date.now();
  const input=d.root?.querySelector('[data-bm-drop]');
  if(!over||over===d.el||!input)return;
  input.value=d.id+'|'+over.dataset.bmCell;
  input.dispatchEvent(new Event('change',{bubbles:true}));
 });
 doc.addEventListener('pointercancel',end);
}
wire();

window.BattleMap={render,owns,handle,read,clean,foreign,blank,write,placeToken,removeToken,toggleCover,resize,placeAll,distance,steps,moveCost,lineCover,rangeHint,weaponTypes,moveOf,cellName,label,sharedPart,cleanShared,sharedHTML,rekey,
 CELL_M,W_MIN,W_MAX,H_MIN,H_MAX,MAX_TOKENS,MAX_COVER,_view:view};
})();
