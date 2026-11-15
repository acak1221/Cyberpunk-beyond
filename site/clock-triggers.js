/* Clocks with triggers: three optional additions to the GM progress clocks of gm-extras.js.
   - triggers: "when the clock reaches segment N, remind me of this text";
   - die: a die the GM rolls to fill segments;
   - tick: a link to a campaign, so the clock gains one segment each time that campaign's tracker
     enters a new round (and gives it back when the GM steps back over the round boundary).
   The three fields live next to the old ones in state.gmExtras.clocks[i]; a clock without them
   behaves exactly as before. Trigger texts are the GM's private notes: they are never put into the
   room payload (GMExtras.sharedClocks still sends name, size and filled only), never written to the
   campaign journal (journal entries can be published to players) and the die is rolled locally, not
   through the shared dice, because a shared roll would show the name of a hidden clock to the room.
   The controls sit inside the clock card and reuse the event delegation of gm-extras.js. */
(function(){
'use strict';
const MAX_TRIGGERS=6,MAX_TEXT=160,MAX_HIST=12,MAX_MESSAGE=400;
const DICE=Object.freeze([4,6,10]);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const isObj=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
const GX=()=>typeof window!=='undefined'&&window.GMExtras||null;
const app=()=>typeof window!=='undefined'&&window.App||null;
const appState=()=>{const a=app();return a&&typeof a.getState==='function'?a.getState():null};
const langNow=l=>(l||app()?.lang?.())==='en'?'en':'ru';

const segRu=n=>{const a=n%10,b=n%100;return a===1&&b!==11?'сегмент':a>=2&&a<=4&&!(b>=12&&b<=14)?'сегмента':'сегментов'};
const T={
 ru:{toggle:'Триггеры и автоход',sumTrig:n=>`напоминаний: ${n}`,sumCamp:n=>`бой: ${n}`,sumNone:'не настроены',panel:'Триггеры и автоход',
  trigHead:'Напоминания',at:'На каком сегменте',text:'Текст напоминания',textPh:'Напр. «Приезжает полиция»',delTrig:'Удалить напоминание',addTrig:'Напоминание',maxTrig:'Не больше 6 напоминаний на часы.',
  priv:'Тексты напоминаний видите только вы: игрокам уходят только название и сегменты.',
  die:'Кубик',noDie:'Без кубика',need:'Что даёт бросок',needAll:'Столько сегментов, сколько выпало',needOn:n=>`1 сегмент при ${n}+`,
  camp:'Бой',noCamp:'Не связаны с боем',campHelp:'Каждый новый раунд этой кампании добавляет один сегмент; шаг назад по раунду его снимает.',noName:'Без названия',
  roll:d=>`Бросить d${d}`,rolled:(r,add)=>`Выпало ${r} — +${add} ${segRu(add)}`,rolledNone:(r,need)=>need?`Выпало ${r} — часы стоят (нужно ${need}+)`:`Выпало ${r} — часы уже заполнены`,
  undo:'Отменить',undone:'Бросок отменён.',trigDeleted:'Напоминание удалено.',trigBack:'Напоминание возвращено.',
  reached:(n,at,text)=>text?`Часы «${n}» дошли до ${at}: ${text}`:`Часы «${n}» дошли до ${at}.`,full:n=>`Часы «${n}» заполнены.`,tick:(round,n,f,s)=>`Раунд ${round}: часы «${n}» — ${f}/${s}`,
  fired:'Сработавшие напоминания',strip:'Часы боя',fullBadge:'Заполнено'},
 en:{toggle:'Triggers and auto-advance',sumTrig:n=>`reminders: ${n}`,sumCamp:n=>`combat: ${n}`,sumNone:'not set up',panel:'Triggers and auto-advance',
  trigHead:'Reminders',at:'At which segment',text:'Reminder text',textPh:'E.g. "The police arrive"',delTrig:'Delete the reminder',addTrig:'Reminder',maxTrig:'No more than 6 reminders per clock.',
  priv:'Only you see the reminder texts: players get only the name and the segments.',
  die:'Die',noDie:'No die',need:'What a roll gives',needAll:'As many segments as rolled',needOn:n=>`1 segment on ${n}+`,
  camp:'Combat',noCamp:'Not linked to a combat',campHelp:'Each new round of this campaign adds one segment; stepping back over the round takes it away.',noName:'Untitled',
  roll:d=>`Roll d${d}`,rolled:(r,add)=>`Rolled ${r} — +${add} ${add===1?'segment':'segments'}`,rolledNone:(r,need)=>need?`Rolled ${r} — the clock stays (needs ${need}+)`:`Rolled ${r} — the clock is already full`,
  undo:'Undo',undone:'The roll is undone.',trigDeleted:'The reminder is deleted.',trigBack:'The reminder is back.',
  reached:(n,at,text)=>text?`Clock “${n}” reached ${at}: ${text}`:`Clock “${n}” reached ${at}.`,full:n=>`Clock “${n}” is full.`,tick:(round,n,f,s)=>`Round ${round}: clock “${n}” — ${f}/${s}`,
  fired:'Reminders that have come up',strip:'Combat clocks',fullBadge:'Full'}
};

// ---------- stored fields ----------
function cleanText(v){return typeof v==='string'?v.replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,MAX_TEXT):''}
const whole=v=>typeof v==='number'&&Number.isInteger(v)?v:typeof v==='string'&&/^\d{1,6}$/.test(v)?Number(v):null;
function cleanTriggers(raw,size){
 if(!Array.isArray(raw))return [];
 const out=[];
 // The order is kept as stored: the row number is what the controls of the card point at.
 for(const x of raw){if(out.length>=MAX_TRIGGERS)break;if(!isObj(x))continue;const at=whole(x.at);if(at===null||at<1)continue;out.push({at:Math.min(size,at),text:cleanText(x.text)})}
 return out;
}
function cleanDie(raw){
 if(!isObj(raw))return null;
 const sides=whole(raw.sides);if(!DICE.includes(sides))return null;
 const n=whole(raw.need);
 return {sides,need:n!==null&&n>=2&&n<=sides?n:0};
}
function cleanTick(raw){
 if(!isObj(raw)||typeof raw.camp!=='string'||!raw.camp||raw.camp.length>80||/[\u0000-\u001f\u007f]/.test(raw.camp))return null;
 const hist=(Array.isArray(raw.hist)?raw.hist:[]).filter(n=>typeof n==='number'&&Number.isInteger(n)&&n>=1&&n<=9999).slice(-MAX_HIST);
 return {camp:raw.camp,hist};
}
/* The extra fields of one clock, rebuilt from known fields only. A key appears only when it holds
   something, always in the same order, so an old clock stays exactly as it was and the campaign
   file can compare two clocks as plain data. */
function cleanExtra(raw,size){
 if(!isObj(raw))return null;
 const s=Number(size),out={};
 const triggers=cleanTriggers(raw.triggers,Number.isFinite(s)&&s>=1?s:1);if(triggers.length)out.triggers=triggers;
 const die=cleanDie(raw.die);if(die)out.die=die;
 const tick=cleanTick(raw.tick);if(tick)out.tick=tick;
 return Object.keys(out).length?out:null;
}

// ---------- pure rules ----------
/* What happened between two lists of clocks: every reminder a clock has just passed on its way up
   and the moment it became full. A reminder is "reached" simply when filled >= at, so nothing has
   to be stored about it, and it comes up however the clock moved: a click, the die or a new round. */
function crossings(before,after){
 const out=[],old=new Map((Array.isArray(before)?before:[]).map(c=>[c.id,c]));
 for(const c of Array.isArray(after)?after:[]){
  const b=old.get(c.id);if(!b||!(c.filled>b.filled))continue;
  for(const tr of [...(c.triggers||[])].sort((x,y)=>x.at-y.at))if(tr.at>b.filled&&tr.at<=c.filled)out.push({kind:'trigger',id:c.id,name:c.name,at:tr.at,text:tr.text});
  if(c.filled===c.size)out.push({kind:'full',id:c.id,name:c.name});
 }
 return out;
}
function rollAdvance(clock,rng=Math.random){
 const d=clock?.die,sides=DICE.includes(d?.sides)?d.sides:6,need=d?.need||0;
 let roll=1+Math.floor(rng()*sides);if(!(roll>=1&&roll<=sides))roll=1;
 const want=need?(roll>=need?1:0):roll;
 return {roll,sides,need,add:Math.max(0,Math.min(want,clock.size-clock.filled))};
}
const last=a=>a.length?a[a.length-1]:undefined;
/* A new round of a campaign: every clock linked to it gains one segment. The round is noted in
   tick.hist, which is what lets tickBack take back exactly the segment this round gave. The tracker
   only ever steps forward into a round it is not in, so a round that is not later than the last
   noted one means the counting started over (a new combat) and nobody told us: the notes belong to
   the old combat and are forgotten, and the clock ticks as in any other new round. */
function tickForward(list,campId,round){
 const ticked=[];
 const clocks=list.map(c=>{
  if(!c.tick||c.tick.camp!==campId||c.filled>=c.size)return c;
  const hist=last(c.tick.hist)>=round?[]:c.tick.hist;
  ticked.push(c.id);return {...c,filled:c.filled+1,tick:{camp:c.tick.camp,hist:[...hist,round].slice(-MAX_HIST)}};
 });
 return {clocks,ticked};
}
/* The tracker went back to round 1 (a reset, or initiative rolled for everyone): a new combat. The
   segments stay as they are, but the noted rounds are dropped. Without this a step back in the new
   combat could take away a segment that the old combat gave. */
function forget(list,campId){
 let any=false;
 const clocks=list.map(c=>{if(!c.tick||c.tick.camp!==campId||!c.tick.hist.length)return c;any=true;return {...c,tick:{camp:c.tick.camp,hist:[]}}});
 return {clocks,any};
}
/* The GM stepped back out of a round: the segment that round gave is removed. If the GM changed
   the clock by hand in between, the step back still removes one segment (never below zero). */
function tickBack(list,campId,leftRound){
 const ticked=[];
 const clocks=list.map(c=>{
  if(!c.tick||c.tick.camp!==campId||last(c.tick.hist)!==leftRound)return c;
  ticked.push(c.id);return {...c,filled:Math.max(0,c.filled-1),tick:{camp:c.tick.camp,hist:c.tick.hist.slice(0,-1)}};
 });
 return {clocks,ticked};
}
function message(events,lang){
 const t=T[langNow(lang)],name=e=>e.name||t.noName;
 const lines=(Array.isArray(events)?events:[]).map(e=>e.kind==='trigger'?t.reached(name(e),e.at,e.text):e.kind==='full'?t.full(name(e)):e.kind==='tick'?t.tick(e.round,name(e),e.filled,e.size):'').filter(Boolean);
 const text=lines.join(' · ');
 return text.length>MAX_MESSAGE?text.slice(0,MAX_MESSAGE-1)+'…':text;
}

// ---------- state ----------
// Which settings panels are open and the latest roll of each clock: kept for this page only.
let ui={open:new Set(),last:new Map()};
function reset(){ui={open:new Set(),last:new Map()}}
function say(text){if(!text)return;try{app()?.notify?.(text)}catch(_){}}
function sayUndo(text,undo){const a=app(),t=T[langNow()];try{if(typeof a?.notifyAction==='function')a.notifyAction(text,t.undo,undo);else a?.notify?.(text)}catch(_){}}
// Called by gm-extras.js after every change of the clocks made in its own card.
function changed(before,after){const ev=crossings(before,after);say(message(ev));return ev}
// One change of one clock made by this module. Returns null when it could not be made.
function edit(id,fn){
 const st=appState(),X=GX();if(!st||!X)return null;
 const before=X.readClocks(st),r=X.updateClock(before,id,fn);if(!r.ok)return null;
 X.writeClocks(st,r.clocks);try{app().save()}catch(_){}
 const after=X.readClocks(st);
 return {before,after,clock:after.find(c=>c.id===id)||null,events:crossings(before,after)};
}
/* Keyboard focus after a redraw. gm-extras.js puts the focus back on the control that was pressed,
   but that control can be gone (the last reminder row was deleted) or the press came from a button
   in the notice, which disappears. A keyboard or screen-reader user must not be thrown back to the
   top of the page, so the focus goes to the first of the given controls that is on the screen. It
   is moved only when it is lost: a focus the user has put somewhere else is left alone. */
function refocus(id,wants){
 try{
  if(typeof document==='undefined'||typeof document.querySelectorAll!=='function')return;
  const a=document.activeElement;
  if(a&&a!==document.body&&a.isConnected!==false&&!a.closest?.('#app-notice'))return;
  const all=[...document.querySelectorAll('[data-gx-root] [data-gx-action],[data-gx-root] [data-gx-field]')].filter(e=>e.dataset.gxId===id);
  for(const [name,seg] of wants){const el=all.find(e=>(e.dataset.gxAction||e.dataset.gxField)===name&&(seg===undefined||e.dataset.gxSeg===String(seg)));if(el){el.focus?.();return}}
 }catch(_){}
}
// After the card has been drawn again by gm-extras.js, which happens right after act() returns.
const later=fn=>{try{Promise.resolve().then(fn).catch(()=>{})}catch(_){}};
const find=id=>{const st=appState();return st&&GX()?GX().readClocks(st).find(c=>c.id===id)||null:null};
const campaigns=()=>{const st=appState();return (Array.isArray(st?.campaigns)?st.campaigns:[]).filter(c=>c&&typeof c.id==='string'&&c.id)};

// ---------- events (delegated by gm-extras.js) ----------
// Returns true when the card has to be drawn again.
function act(a,b,root,rng){
 const id=b?.dataset?.gxId;
 if(typeof a!=='string'||!a.startsWith('ct-')||!id)return false;
 const lang=langNow(),t=T[lang];
 if(a==='ct-open'){if(ui.open.has(id))ui.open.delete(id);else ui.open.add(id);return true}
 if(a==='ct-roll'){
  const c=find(id);if(!c||!c.die)return true;
  // The button of a full clock stays focusable (see cardHTML), so a press has to answer something.
  if(c.filled>=c.size){say(t.full(c.name||t.noName));return true}
  const r=rollAdvance(c,typeof rng==='function'?rng:Math.random),was=c.filled,now=was+r.add;
  ui.last.set(id,{roll:r.roll,add:r.add,need:r.need});
  const head=`${c.name||t.noName}: ${r.add?t.rolled(r.roll,r.add):t.rolledNone(r.roll,r.need)}`;
  if(!r.add){say(head);return true}
  const done=edit(id,x=>(x.filled=now,x));if(!done)return true;
  // The undo puts the segments back only while the clock still shows what the roll left: a later
  // change by hand or by a round is not thrown away.
  sayUndo([head,message(done.events,lang)].filter(Boolean).join(' · ').slice(0,MAX_MESSAGE),()=>{
   const cur=find(id);if(!cur||cur.filled!==now)return;
   edit(id,x=>(x.filled=was,x));ui.last.delete(id);say(T[langNow()].undone);GX()?.refresh?.();refocus(id,[['ct-roll'],['ct-open']]);
  });
  return true;
 }
 if(a==='ct-add-trig'){
  const c=find(id);if(!c)return true;
  if((c.triggers||[]).length>=MAX_TRIGGERS){say(t.maxTrig);return true}
  // The new row starts at the nearest segment that is still ahead and has no reminder yet.
  const used=new Set((c.triggers||[]).map(x=>x.at));let at=c.size;for(let n=c.filled+1;n<=c.size;n++)if(!used.has(n)){at=n;break}
  edit(id,x=>(x.triggers=[...(x.triggers||[]),{at,text:''}],x));ui.open.add(id);return true;
 }
 if(a==='ct-del-trig'){
  const c=find(id),i=Number(b.dataset.gxSeg),old=c?.triggers||[];if(!c||!Number.isInteger(i)||!old[i])return true;
  const gone=old[i];
  edit(id,x=>(x.triggers=old.filter((_,k)=>k!==i),x));
  /* The undo puts back the one deleted row, into the list as it is now: whatever the GM added or
     typed into other reminders while the notice was on the screen stays. When six reminders are
     there again by then, there is no room for it and the GM is told so. */
  sayUndo(t.trigDeleted,()=>{
   const cur=find(id);if(!cur)return;
   const now=cur.triggers||[];if(now.length>=MAX_TRIGGERS){say(T[langNow()].maxTrig);return}
   const k=Math.min(i,now.length);
   edit(id,x=>{const list=[...(x.triggers||[])];list.splice(k,0,{at:gone.at,text:gone.text});x.triggers=list;return x});
   say(T[langNow()].trigBack);GX()?.refresh?.();refocus(id,[['ct-text',k],['ct-open']]);
  });
  // The pressed button is gone when the last row was deleted: the row above it, or the add button.
  later(()=>refocus(id,[['ct-del-trig',i-1],['ct-add-trig'],['ct-open']]));
  return true;
 }
 return false;
}
// A changed field. Returns 'render' when the card has to be drawn again, true when the change is
// saved as it is, false when the field is not ours.
function change(target){
 const f=target?.dataset?.gxField,id=target?.dataset?.gxId;
 if(typeof f!=='string'||!f.startsWith('ct-')||!id)return false;
 const c=find(id);if(!c)return true;
 const i=Number(target.dataset.gxSeg),row=Number.isInteger(i)&&(c.triggers||[])[i]?i:-1;
 if(f==='ct-text'){
  // Saved without drawing the card again, like the clock name: a click that ended the typing is
  // not swallowed by the page being replaced under it.
  if(row>=0)edit(id,x=>(x.triggers=x.triggers.map((tr,k)=>k===row?{at:tr.at,text:cleanText(target.value)}:tr),x));
  return true;
 }
 if(f==='ct-at'){
  const at=Number(target.value);
  // Moving a reminder is not the clock moving: nothing is announced here.
  if(row>=0&&Number.isInteger(at)&&at>=1&&at<=c.size)edit(id,x=>(x.triggers=x.triggers.map((tr,k)=>k===row?{at,text:tr.text}:tr),x));
  return 'render';
 }
 if(f==='ct-die'){
  const sides=Number(target.value);
  edit(id,x=>{if(DICE.includes(sides))x.die={sides,need:x.die&&x.die.need<=sides?x.die.need:0};else delete x.die;return x});
  ui.last.delete(id);return 'render';
 }
 if(f==='ct-need'){
  const need=Number(target.value);
  if(c.die)edit(id,x=>(x.die={sides:x.die.sides,need:Number.isInteger(need)&&need>=2&&need<=x.die.sides?need:0},x));
  ui.last.delete(id);return 'render';
 }
 if(f==='ct-camp'){
  const camp=String(target.value||''),known=campaigns().some(k=>k.id===camp);
  edit(id,x=>{if(known){if(x.tick?.camp!==camp)x.tick={camp,hist:[]}}else delete x.tick;return x});
  return 'render';
 }
 return false;
}
/* Called by campaigns.js when the round of a campaign changes (round) or the tracker starts a new
   combat from round 1 (restart). The campaign handler saves and draws
   the page right after, so this only changes the clocks and says what happened. Nothing here may
   break the tracker, hence the catch around everything. */
function restart(campId){
 try{
  const st=appState(),X=GX();if(!st||!X||typeof campId!=='string')return;
  const r=forget(X.readClocks(st),campId);if(r.any)X.writeClocks(st,r.clocks);
 }catch(_){}
}
function round(campId,from,to){
 try{
  const st=appState(),X=GX();if(!st||!X||typeof campId!=='string'||!Number.isInteger(from)||!Number.isInteger(to)||from===to)return [];
  const before=X.readClocks(st);
  if(to<from){const r=tickBack(before,campId,from);if(r.ticked.length)X.writeClocks(st,r.clocks);return []}
  const r=tickForward(before,campId,to);if(!r.ticked.length)return [];
  X.writeClocks(st,r.clocks);
  const after=X.readClocks(st),cross=crossings(before,after),events=[];
  for(const id of r.ticked){const c=after.find(x=>x.id===id);if(!c)continue;events.push({kind:'tick',id,name:c.name,round:to,filled:c.filled,size:c.size},...cross.filter(e=>e.id===id))}
  say(message(events));
  return events;
 }catch(_){return []}
}

// ---------- markup ----------
const reached=c=>[...(c.triggers||[])].filter(x=>x.at<=c.filled&&x.text).sort((a,b)=>a.at-b.at);
/* The part of a clock card that belongs to this module. Every control carries data-gx-action or
   data-gx-field together with data-gx-id, and a reminder row adds its number as data-gx-seg:
   gm-extras.js finds the focused control again by exactly these three after it redraws the card.
   The roll button of a full clock and the add button of a full list are marked aria-disabled, not
   disabled: a disabled button cannot hold the focus, and the press that just filled the clock or
   added the sixth reminder would drop a keyboard user out of the card. act() refuses the press. */
function cardHTML(c,lang){
 if(!isObj(c)||typeof c.id!=='string')return '';
 const l=langNow(lang),t=T[l],id=esc(c.id),trig=c.triggers||[],open=ui.open.has(c.id),full=c.filled>=c.size;
 let h='<div class="ct-box">';
 if(c.die){
  const got=ui.last.get(c.id);
  h+=`<button type="button" class="btn ghost ct-roll" data-gx-action="ct-roll" data-gx-id="${id}"${full?' aria-disabled="true"':''}>⬡ ${esc(t.roll(c.die.sides))}</button>`;
  if(got)h+=`<p class="ct-last">${esc(got.add?t.rolled(got.roll,got.add):t.rolledNone(got.roll,got.need))}</p>`;
 }
 const hit=reached(c);
 if(hit.length)h+=`<ul class="ct-fired" aria-label="${esc(t.fired)}">${hit.map(x=>`<li><b>${x.at}</b><span>${esc(x.text)}</span></li>`).join('')}</ul>`;
 const camp=c.tick?campaigns().find(k=>k.id===c.tick.camp):null;
 const sum=[trig.length?t.sumTrig(trig.length):'',c.die?'d'+c.die.sides:'',camp?t.sumCamp(String(camp.name||'—').slice(0,40)):''].filter(Boolean).join(' · ')||t.sumNone;
 h+=`<button type="button" class="btn ghost ct-toggle" data-gx-action="ct-open" data-gx-id="${id}" aria-expanded="${open?'true':'false'}"${open?` aria-controls="ct-panel-${id}"`:''}><span>${open?'▾':'▸'} ${esc(t.toggle)}</span><small>${esc(sum)}</small></button>`;
 if(open){
  h+=`<div class="ct-panel" id="ct-panel-${id}" role="group" aria-label="${esc(t.panel)}: ${esc(c.name||t.noName)}"><p class="ct-head">${esc(t.trigHead)}</p>`;
  h+=trig.map((x,i)=>`<div class="ct-row"><select data-gx-field="ct-at" data-gx-id="${id}" data-gx-seg="${i}" aria-label="${esc(t.at)}">${Array.from({length:c.size},(_,n)=>`<option value="${n+1}"${x.at===n+1?' selected':''}>${n+1}/${c.size}</option>`).join('')}</select><button type="button" class="btn ghost ct-del" data-gx-action="ct-del-trig" data-gx-id="${id}" data-gx-seg="${i}" aria-label="${esc(t.delTrig)}">✕</button><input type="text" maxlength="${MAX_TEXT}" data-gx-field="ct-text" data-gx-id="${id}" data-gx-seg="${i}" value="${esc(x.text)}" placeholder="${esc(t.textPh)}" aria-label="${esc(t.text)}"></div>`).join('');
  h+=`<button type="button" class="btn ghost ct-add" data-gx-action="ct-add-trig" data-gx-id="${id}"${trig.length>=MAX_TRIGGERS?' aria-disabled="true"':''}>+ ${esc(t.addTrig)}</button>`;
  if(trig.length>=MAX_TRIGGERS)h+=`<p class="ct-note">${esc(t.maxTrig)}</p>`;
  h+=`<p class="ct-note">${esc(t.priv)}</p>`;
  h+=`<label class="field">${esc(t.die)}<select data-gx-field="ct-die" data-gx-id="${id}"><option value="0">${esc(t.noDie)}</option>${DICE.map(d=>`<option value="${d}"${c.die?.sides===d?' selected':''}>d${d}</option>`).join('')}</select></label>`;
  if(c.die)h+=`<label class="field">${esc(t.need)}<select data-gx-field="ct-need" data-gx-id="${id}"><option value="0">${esc(t.needAll)}</option>${Array.from({length:c.die.sides-1},(_,n)=>`<option value="${n+2}"${c.die.need===n+2?' selected':''}>${esc(t.needOn(n+2))}</option>`).join('')}</select></label>`;
  h+=`<label class="field">${esc(t.camp)}<select data-gx-field="ct-camp" data-gx-id="${id}"><option value="">${esc(t.noCamp)}</option>${campaigns().map(k=>`<option value="${esc(k.id)}"${camp===k?' selected':''}>${esc(String(k.name||'—').slice(0,60))}</option>`).join('')}</select></label><p class="ct-note">${esc(t.campHelp)}</p></div>`;
 }
 return h+'</div>';
}
/* A read-only strip under the turn buttons of a campaign: the clocks linked to this combat. Only
   reminders that have already come up are shown here: the tracker is the screen a GM is most
   likely to have in view of the table, and what is still ahead should stay a surprise. */
function trackerHTML(campaign,lang){
 try{
  const st=appState(),X=GX();if(!st||!X||!isObj(campaign)||typeof campaign.id!=='string')return '';
  const list=X.readClocks(st).filter(c=>c.tick&&c.tick.camp===campaign.id);if(!list.length)return '';
  const t=T[langNow(lang)];
  return `<div class="ct-strip" role="group" aria-label="${esc(t.strip)}">${list.map(c=>{const full=c.filled>=c.size,note=last(reached(c));return `<div class="ct-strip-clock${full?' full':''}"><b>${esc(c.name||t.noName)}</b><span class="ct-strip-count">${c.filled}/${c.size}</span><span class="ct-dots" aria-hidden="true">${'●'.repeat(c.filled)}${'○'.repeat(c.size-c.filled)}</span>${full?`<span class="ct-badge">${esc(t.fullBadge)}</span>`:''}${note?`<span class="ct-strip-note">${esc(note.text)}</span>`:''}</div>`}).join('')}</div>`;
 }catch(_){return ''}
}

window.ClockTriggers={MAX_TRIGGERS,MAX_TEXT,DICE,cleanExtra,crossings,rollAdvance,tickForward,tickBack,forget,message,changed,act,change,round,restart,cardHTML,trackerHTML,reset,_test:{ui:()=>ui}};
})();
