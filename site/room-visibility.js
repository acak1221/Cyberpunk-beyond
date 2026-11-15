/* Online rooms: how much of each tracker participant the players see.

   The Game Master picks one of four levels, for the whole tracker and, where needed, for one participant:
     hidden  the participant is not sent to the room at all;
     name    name, initiative and whose turn it is: exactly what the room sent before this file existed;
     state   the above and the Wound State (a code, not the HP number), plus «out of the fight»;
     full    the above and HP, and for an NPC the Game Master runs, the armor SP of head and body.

   Two rules keep it safe:
   1. What a level does not show is never put into the message: part() builds the extra fields on the Game Master's
      device from the level alone, so there is nothing for a curious player's page to dig out.
   2. Everything that arrives is rebuilt by clean() from whole numbers inside known ranges; anything else is dropped.

   Where it is stored (no migration: a missing field is the old behaviour):
   - campaign.vis  'hidden' | 'state' | 'full'; absent means 'name'.
   - row.vis       'name' | 'state' | 'full'; absent means «as in the room».
   - row.hidden    true is the «hidden» choice for one participant. It stays in the field the older «hide from
                   players» button wrote, so old saves, an older copy of the app and the battle map keep hiding the
                   same participants.
   A player's own character can never be hidden: their page must see the row to say «Ваш ход». For such rows
   «hidden» as the room level is read as «name», and the list does not offer it.

   This covers the initiative list and the map tokens. Rolls the Game Master sends to the feed and shared journal
   entries are separate messages and may still name a participant.

   The file has no dependencies; room.js, campaigns.js and battle-map.js call it with optional chaining and behave as
   before without it. */
(function(global){
'use strict';
const LEVELS=['hidden','name','state','full'],ROW=['name','state','full'];
// The same shape room.js accepts for a row that belongs to a player's device; a looser check would let a junk
// value in an imported file turn a hidden enemy into a «player's row» that cannot be hidden.
const OWN=/^[0-9a-f]{16}:.{1,60}$/;
const T={
 ru:{
  roomLabel:'Игроки в комнате видят',rowLabel:'Игроки видят',
  hiddenRoom:'Никого, пока вы не откроете',hidden:'Скрыт',name:'Только имя',state:'Имя и состояние',full:'Всё: HP и броня',
  asHidden:'Как в комнате: скрыт',asName:'Как в комнате: только имя',asState:'Как в комнате: имя и состояние',asFull:'Как в комнате: HP и броня',
  help:'Это уровень для всех участников трекера; у каждого его можно изменить в «Действиях». То, что не показано, в комнату не отправляется. Персонажей игроков скрыть нельзя. Если комнату ведёте не только вы, обновите приложение на всех устройствах ведущих: старая версия не знает этого уровня и покажет тех, кто скрыт только им.',
  gmNote:'Так список видят игроки. Уровень меняется в трекере кампании.',
  w0:'Не ранен',w1:'Тяжело ранен',w2:'Смертельно ранен',w3:'Мёртв',out:'Выбыл',
  armor:'SP: голова {h} · тело {b}',
 },
 en:{
  roomLabel:'Players in the room see',rowLabel:'Players see',
  hiddenRoom:'Nobody until you reveal them',hidden:'Hidden',name:'Name only',state:'Name and wound state',full:'Everything: HP and armor',
  asHidden:'As in the room: hidden',asName:'As in the room: name only',asState:'As in the room: name and state',asFull:'As in the room: HP and armor',
  help:'This is the level for everyone in the tracker; you can change it per participant under Actions. What is not shown is not sent to the room. Player characters cannot be hidden. If you are not the only one running the room, update the app on every Game Master device: an older version does not know this level and will show those hidden by it alone.',
  gmNote:'This is the list as players see it. Change the level in the campaign tracker.',
  w0:'Unhurt',w1:'Seriously Wounded',w2:'Mortally Wounded',w3:'Dead',out:'Out',
  armor:'SP: head {h} · body {b}',
 },
};
const t=(key,lang)=>(T[lang==='en'?'en':'ru'][key])??key;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const isObj=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
const whole=(n,lo,hi)=>Number.isInteger(n)&&n>=lo&&n<=hi;
const clamp=(n,lo,hi)=>{n=Math.trunc(Number(n));return Number.isFinite(n)?Math.min(hi,Math.max(lo,n)):0};

/* ---------- Which level a participant has ---------- */
const owned=r=>!!r&&(r.kind==='pc'||(r.kind==='npc'&&typeof r.own==='string'&&OWN.test(r.own)));
const roomLevel=camp=>isObj(camp)&&typeof camp.vis==='string'&&LEVELS.includes(camp.vis)?camp.vis:'name';
const rowVis=r=>typeof r?.vis==='string'&&ROW.includes(r.vis)?r.vis:'';
function level(r,camp){
 if(!isObj(r))return 'hidden';
 if(owned(r)){const lv=rowVis(r)||roomLevel(camp);return lv==='hidden'?'name':lv}
 if(r.hidden===true)return 'hidden';
 return rowVis(r)||roomLevel(camp);
}
function setRoom(camp,v){
 if(!isObj(camp)||!LEVELS.includes(v)||roomLevel(camp)===v)return false;
 if(v==='name')delete camp.vis;else camp.vis=v;
 return true;
}
// What the list of one participant shows as chosen: '' is «as in the room».
const chosen=r=>r?.hidden===true&&!owned(r)?'hidden':rowVis(r);
function setRow(r,v){
 if(!isObj(r)||!(v===''||LEVELS.includes(v))||(v==='hidden'&&owned(r)))return false;
 // An owned row may carry a stray hidden flag from an older save; it never hid the row, so clearing it is not a change the players notice.
 if(chosen(r)===v&&!(v===''&&(r.hidden===true||r.vis!==undefined)))return false;
 if(v===''){delete r.vis;delete r.hidden}
 else if(v==='hidden'){r.hidden=true;delete r.vis}
 else{r.vis=v;delete r.hidden}
 return true;
}

/* ---------- What goes out and what is accepted ---------- */
// The Wound State as a code: 0 none, 1 Seriously Wounded (below half of full HP), 2 Mortally Wounded (below 1 HP), 3 dead.
// The thresholds are the tracker's own (campaigns.js, woundOf), so the Game Master and the players read the same state.
function wound(hp,max,dead){
 if(dead===true)return 3;
 const h=Number(hp)||0,m=Number(max)||0;
 return h<1?2:m>0&&h<Math.ceil(m/2)?1:0;
}
// facts: {hp,max,dead,out,sp}. Only the fields the level shows are returned; for «name» and «hidden» that is nothing,
// which keeps the message the same as before for anyone who never touches the setting.
function part(lv,facts){
 if(lv!=='state'&&lv!=='full')return {};
 const f=isObj(facts)?facts:{},out={w:wound(f.hp,f.max,f.dead)};
 if(f.out===true)out.out=true;
 if(lv!=='full')return out;
 out.hp=clamp(f.hp,-999,999);
 const max=Math.trunc(Number(f.max));if(whole(max,1,999))out.max=max;
 if(isObj(f.sp)){const h=clamp(f.sp.head,0,30),b=clamp(f.sp.body,0,30);if(h>0||b>0)out.sp=[h,b]}
 return out;
}
// A row received from another device. Without a valid state code nothing is kept, so a broken or hostile row falls
// back to the plain «name» row. No value is converted: a string or a fraction is simply not a number here.
function clean(raw){
 if(!isObj(raw)||!whole(raw.w,0,3))return {};
 const out={w:raw.w};
 if(raw.out===true)out.out=true;
 // Full HP means something only next to the HP itself.
 if(whole(raw.hp,-999,999)){out.hp=raw.hp;if(whole(raw.max,1,999))out.max=raw.max}
 if(Array.isArray(raw.sp)&&raw.sp.length===2&&whole(raw.sp[0],0,30)&&whole(raw.sp[1],0,30))out.sp=[raw.sp[0],raw.sp[1]];
 return out;
}

/* ---------- Markup ---------- */
// The room list: small labels after the name. They are <small>, not <span>: the list colours every span in a row as a name.
function chips(row,lang){
 const c=clean(row);if(c.w===undefined)return '';
 const list=[`<small class="rv-chip rv-w${c.w}">${esc(t('w'+c.w,lang))}</small>`];
 if(c.out&&c.w!==3)list.push(`<small class="rv-chip rv-out">${esc(t('out',lang))}</small>`);
 if(c.hp!==undefined)list.push(`<small class="rv-chip rv-hp">HP ${c.hp}${c.max!==undefined?'/'+c.max:''}</small>`);
 if(c.sp)list.push(`<small class="rv-chip rv-hp">${esc(t('armor',lang).replace('{h}',c.sp[0]).replace('{b}',c.sp[1]))}</small>`);
 return `<div class="rv-info">${list.join('')}</div>`;
}
// «As in the room» names the level it stands for. Each has its own text: lowering the case of a translated label by
// machine turned «HP» into «hp».
const AS={hidden:'asHidden',name:'asName',state:'asState',full:'asFull'};
const option=(value,label,now)=>`<option value="${esc(value)}"${value===now?' selected':''}>${esc(label)}</option>`;
function defaultHTML(camp,lang){
 const now=roomLevel(camp);
 return `<div class="rv-default"><label class="rv-field">${esc(t('roomLabel',lang))}<select data-rv-room>${LEVELS.map(v=>option(v,t(v==='hidden'?'hiddenRoom':v,lang),now)).join('')}</select></label><p class="muted rv-help">${esc(t('help',lang))}</p></div>`;
}
function rowHTML(r,camp,lang){
 if(!isObj(r))return '';
 const now=chosen(r),mine=owned(r),base=roomLevel(camp),shown=mine&&base==='hidden'?'name':base;
 return `<label class="rv-field rv-row">${esc(t('rowLabel',lang))}<select data-rv-row="${esc(r.id)}">${option('',t(AS[shown],lang),now)}${(mine?ROW:LEVELS).map(v=>option(v,t(v,lang),now)).join('')}</select></label>`;
}
const gmNote=lang=>`<p class="room-muted rv-note">${esc(t('gmNote',lang))}</p>`;

/* ---------- The tracker's two lists ---------- */
const owns=e=>!!e&&e.type==='change'&&!!e.target?.dataset&&(e.target.dataset.rvRoom!==undefined||e.target.dataset.rvRow!==undefined);
// The tracker is drawn again after a change, which closes «Действия» and drops the focus. Put both back, so a
// keyboard user can go on choosing instead of looking for the list again.
function refocus(find){
 const doc=global.document;if(!doc?.querySelectorAll)return;
 Promise.resolve().then(()=>{try{
  const now=doc.activeElement;if(now&&now!==doc.body)return;
  const el=[...doc.querySelectorAll('[data-rv-room],[data-rv-row]')].find(find);if(!el)return;
  const box=el.closest?.('details');if(box)box.open=true;
  el.focus({preventScroll:true});
 }catch{}});
}
function handle(e,camp){
 const none={dirty:false,rerender:false};
 if(!owns(e)||!isObj(camp))return none;
 const d=e.target.dataset,v=String(e.target.value??'');
 if(d.rvRoom!==undefined){
  if(!setRoom(camp,v))return none;
  refocus(el=>el.dataset.rvRoom!==undefined);
  return {dirty:true,rerender:true};
 }
 const id=d.rvRow,r=Array.isArray(camp.roster)?camp.roster.find(x=>isObj(x)&&x.id===id):null;
 if(!r||!setRow(r,v))return none;
 refocus(el=>el.dataset.rvRow===id);
 return {dirty:true,rerender:true};
}

global.RoomVisibility={LEVELS,t,owned,roomLevel,level,setRoom,setRow,wound,part,clean,chips,defaultHTML,rowHTML,gmNote,owns,handle,_test:{T,chosen}};
})(typeof window!=='undefined'?window:globalThis);
