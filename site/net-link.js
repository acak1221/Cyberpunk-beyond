/* The link between a net architecture on the GM desk and the netrunner who runs it, on the same device.
   The architecture may remember who runs it: architecture.runner = {cid, deck?} (a character id and a deck id of that character;
   both optional in the saved data, old saves have neither). With a link:
   - a run-mode roll uses that character's Interface rank, rezzed boosters, wound penalty and the NET Action counter of the
     sheet (one counter: the sheet's), through the same plan as the NETRUN tab (RolePlay.netrunPlan);
   - the combat calculator starts with the runner and the deck already picked;
   - damage that an ICE deals to a program lowers that program's REZ on the linked deck directly, with an undo that applies
     only while the program is exactly as the damage left it.
   Nothing here talks to a room: sending a run to a player is room-netrun.js. Own words; no rulebook text. */
(function(global){
'use strict';
const T={
 ru:{title:'КТО ПРОХОДИТ',help:'Выберите персонажа с листа: бросок, NET-действия, бустеры и штраф от ранений берутся с его листа. Счётчик действий один: на листе.',none:'Не выбран',runner:'Нетраннер',deck:'Дека',noDeck:'Без деки',
  linked:n=>`Ходит: ${n}`,counter:'NET-действия (лист персонажа)',gone:'Выбранный персонаж больше недоступен: связь не используется. Выберите заново.',
  noAbility:'Для этого вида записи нет способности.',roll:(ab,dv)=>`${ab}: бросок с листа против DV ${dv}`,
  program:'Программа на деке',noProgram:'Не выбрана',apply:'Снять REZ с программы на деке',
  after:(n,a,b)=>`${n}: REZ ${a} → ${b}`,applied:(n,a,b)=>`${n}: REZ ${a} → ${b}${b===0&&a>0?' · Derezzed':''}.`,
  stale:'Данные изменились. Бросьте ещё раз.',noRez:'У этой программы нет REZ или она уничтожена.',invalid:'Новое состояние деки не прошло проверку: ничего не изменено.'},
 en:{title:'WHO IS RUNNING',help:'Pick a character from the sheets: the roll, the NET Actions, the boosters and the wound penalty come from their sheet. There is one action counter: the sheet’s.',none:'Not chosen',runner:'Netrunner',deck:'Deck',noDeck:'No deck',
  linked:n=>`Runner: ${n}`,counter:'NET Actions (the character’s sheet)',gone:'The chosen character is no longer available: the link is not used. Choose again.',
  noAbility:'There is no ability for this kind of record.',roll:(ab,dv)=>`${ab}: roll from the sheet against DV ${dv}`,
  program:'Program on the deck',noProgram:'Not chosen',apply:'Take REZ off the program on the deck',
  after:(n,a,b)=>`${n}: REZ ${a} → ${b}`,applied:(n,a,b)=>`${n}: REZ ${a} → ${b}${b===0&&a>0?' · Derezzed':''}.`,
  stale:'Data changed. Roll again.',noRez:'This program has no REZ or is destroyed.',invalid:'The new state of the deck failed validation: nothing was changed.'}
};
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const obj=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
const lng=l=>l==='en'?'en':'ru';
const RP=()=>global.RolePlay;
// A lock record is attacked with the ability whose job it is (names of the ability list of the tool).
const ABILITY={password:'Backdoor',file:'Eye-Dee',control:'Control'};
const rankOf=c=>{try{const n=Number(global.NetrunTab?.interfaceRank?.(c));return Number.isFinite(n)?n:0}catch{return 0}};
const options=chars=>(Array.isArray(chars)?chars:[]).filter(c=>obj(c)&&typeof c.id==='string'&&c.id&&rankOf(c)>0);
const deckList=c=>{try{const st=global.RoleTools?.deckState?.(c);return st?.kind==='ok'?st.value.decks.map(d=>({id:d.id,name:String(d.name||'')})):[]}catch{return []}};

// The linked character of an architecture, or null: not linked, the character is gone or twice in the list, or has no Interface rank.
function resolve(a,chars){
 const l=a?.runner;if(!obj(l)||typeof l.cid!=='string'||!l.cid)return null;
 const m=(Array.isArray(chars)?chars:[]).filter(c=>obj(c)&&c.id===l.cid);if(m.length!==1)return null;
 const c=m[0],rank=rankOf(c);if(!rank)return null;
 const deck=typeof l.deck==='string'&&l.deck?deckList(c).find(d=>d.id===l.deck)||null:null;
 return {c,rank:Math.max(1,Math.min(10,rank)),deck};
}
const rank=(a,chars)=>resolve(a,chars)?.rank||0;
// What the run status shows instead of the architecture's own counter.
function runInfo(a,chars){
 const r=resolve(a,chars);if(!r)return null;
 const n=RP().netLeft(r.c,r.rank);
 return {actions:n.max,remaining:n.left,rank:r.rank,modifier:RP().netMod(r.c),runner:String(r.c.name||'—'),linked:true};
}
// «New turn», «Spend», «Restore» of the run status go to the sheet. -> true when handled.
function counter(op,a,chars){
 const r=resolve(a,chars);if(!r||!RP())return false;
 const n=RP().netLeft(r.c,r.rank);
 if(op==='reset')r.c.extra=RP().turnExtra(r.c.extra);
 else if(op==='spend'){if(n.left>=1)r.c.extra=RP().withRun(r.c.extra,{used:n.used+1})}
 else if(op==='refund'){if(n.used>=1)r.c.extra=RP().withRun(r.c.extra,{used:n.used-1})}
 else return false;
 return true;
}
// A roll against a lock record from the sheet of the runner. -> null (no link) | {ok:false,message} | {ok:true,total,beat,known}
function roll(a,e,chars,lang,label){
 const r=resolve(a,chars),A=global.App;if(!r||!A||!RP())return null;
 const ab=ABILITY[e?.type];if(!ab)return {ok:false,message:T[lng(lang)].noAbility};
 return sheetRoll(r,ab,e.dv,lang,label);
}
// The plain «Interface against a DV» of the settings card of the desk goes the same way: the sheet of the linked runner (rank, boosters,
// wound penalty, the sheet's NET Action counter). -> null (no link) | {ok:false,message} | {ok:true,total,beat,known,dv}
function rollGeneric(a,dv,chars,lang,label){
 const r=resolve(a,chars),A=global.App;if(!r||!A||!RP())return null;
 return sheetRoll(r,'Interface',dv,lang,label);
}
function sheetRoll(r,ab,dvIn,lang,label){
 const A=global.App;
 const dv=Math.max(0,Math.min(999,Math.trunc(Number(dvIn))||0));
 let skip;try{skip=global.NetrunEffects?.skipList?.(r.c)}catch{}
 const p=RP().netrunPlan(r.c,r.rank,ab,dv,lang,{skip});if(!p.ok)return {ok:false,message:p.message};
 // This is the Game Master's page: the roll is not the active character's, so the wound penalty and the sheet effects of the runner are added by hand.
 let m={};try{m=A.rollMods?.(r.c)||{}}catch{}
 const extra=(Number(m.wound)||0)+(Number(m.effect)||0);
 // The DV is not given to the check: a check with a DV writes «> DV 10 — success» into its history line, and that line goes to the room's roll feed. The comparison is made here.
 const out=A.check(p.base,label?`${p.label} · ${label}`:p.label,{wounds:false,dv:0,mod:extra+p.mod}),total=Number(out?.total);
 if(p.extra)r.c.extra=p.extra;
 try{if(p.skipped?.length)global.NetrunEffects?.consume?.(r.c,p.skipped)}catch{}
 return {ok:true,total:Number.isFinite(total)?total:0,beat:Number.isFinite(total)&&dv>0&&total>dv,known:Number.isFinite(total)&&dv>0,dv,ability:ab};
}

/* ---------- Damage to a program of the linked deck ---------- */
function entryOf(c,deckId,entryId){
 const decks=c?.extra?.cyberdecks?.decks,d=Array.isArray(decks)?decks.find(x=>obj(x)&&x.id===deckId):null;
 return Array.isArray(d?.entries)?d.entries.find(x=>obj(x)&&x.id===entryId)||null:null;
}
// The programs of the linked deck that have a REZ, with what they have now.
function programs(a,chars,lang){
 const r=resolve(a,chars);if(!r||!r.deck)return [];
 const l=lng(lang),d=r.c.extra.cyberdecks.decks.find(x=>obj(x)&&x.id===r.deck.id),out=[];
 for(const e of Array.isArray(d?.entries)?d.entries:[]){const s=RP().progState(e);if(s&&!s.destroyed)out.push({id:e.id,name:String(e.name?.[l]||e.name?.en||e.catalogId||''),rez:s.rez,max:s.max,active:s.active})}
 return out;
}
const snap=e=>({rez:e.rez,down:e.down,active:e.active});
const same=(e,s)=>e.rez===s.rez&&e.down===s.down&&e.active===s.active;
function setFields(e,s){for(const k of ['rez','down','active']){if(s[k]===undefined)delete e[k];else e[k]=s[k]}}
// REZ comes off the chosen program. -> null (no link or no deck) | {ok:false,message} | {ok:true,message,undo}
function applyProgram(a,chars,entryId,total,lang){
 const r=resolve(a,chars);if(!r||!r.deck)return null;
 const z=T[lng(lang)],e=entryOf(r.c,r.deck.id,entryId),s=e?RP().progState(e):null;
 if(!e||!s||s.destroyed)return {ok:false,message:e?z.noRez:z.stale};
 const dmg=Math.trunc(Number(total));if(!Number.isInteger(dmg)||dmg<0||dmg>999)return {ok:false,message:z.stale};
 const before=snap(e),next=Math.max(0,s.rez-dmg);
 e.rez=next;if(next===0){e.down=true;delete e.active}
 let ok=false;try{ok=global.RoleTools?.deckState?.(r.c)?.kind==='ok'}catch{}
 if(!ok){setFields(e,before);return {ok:false,message:z.invalid}}
 return {ok:true,message:z.applied(String(e.name?.[lng(lang)]||e.name?.en||''),s.rez,next),undo:{kind:'program',cid:r.c.id,deck:r.deck.id,entry:e.id,before,after:snap(e)}};
}
// Puts the program back, but only while it is exactly as the damage left it.
function undoProgram(u,chars){
 if(!obj(u)||u.kind!=='program')return false;
 const c=(Array.isArray(chars)?chars:[]).filter(x=>obj(x)&&x.id===u.cid);if(c.length!==1)return false;
 const e=entryOf(c[0],u.deck,u.entry);if(!e||!same(e,u.after))return false;
 setFields(e,u.before);return true;
}

/* ---------- Markup and events ---------- */
function cardHtml(a,lang,chars){
 const z=T[lng(lang)],list=options(chars),r=resolve(a,chars),want=a?.runner?.cid||'';
 const sel=want&&!r?`<p class="net-note" role="status">${esc(z.gone)}</p>`:'';
 const decks=r?deckList(r.c):[];
 return `<section class="card net-link" data-net-link-card><div class="card-heading"><span>${esc(z.title)}</span><span>${r?esc(String(r.c.name||'—')):''}</span></div><p class="net-note">${esc(z.help)}</p>${sel}<div class="net-grid"><label class="field">${esc(z.runner)}<select data-net-link="runner"><option value="">${esc(z.none)}</option>${list.map(c=>`<option value="${esc(c.id)}"${c.id===want?' selected':''}>${esc(c.name||'—')} · Interface ${rankOf(c)}</option>`).join('')}${want&&!list.some(c=>c.id===want)?`<option value="${esc(want)}" selected>${esc(z.none)} ⚠</option>`:''}</select></label>${r?`<label class="field">${esc(z.deck)}<select data-net-link="deck"><option value="">${esc(z.noDeck)}</option>${decks.map(d=>`<option value="${esc(d.id)}"${r.deck?.id===d.id?' selected':''}>${esc(d.name||'—')}</option>`).join('')}</select></label>`:''}</div></section>`;
}
// A change of the two selects. -> the result NetTools.handle returns.
function change(el,a,ctx){
 const key=el?.dataset?.netLink,v=String(el?.value??'').slice(0,160);
 if(key==='runner'){
  if(!v){delete a.runner;return {handled:true,dirty:true,rerender:true}}
  if(!options(ctx.characters).some(c=>c.id===v))return {handled:true};
  a.runner={cid:v};return {handled:true,dirty:true,rerender:true};
 }
 if(key==='deck'){
  const r=resolve(a,ctx.characters);if(!r)return {handled:true};
  if(!v){delete a.runner.deck;return {handled:true,dirty:true,rerender:true}}
  if(!deckList(r.c).some(d=>d.id===v))return {handled:true};
  a.runner.deck=v;return {handled:true,dirty:true,rerender:true};
 }
 return {handled:true};
}
// The calculator starts with the runner and the deck of the link; a choice made by hand afterwards stays.
function prefill(a,chars,d){
 if(!obj(d)||!obj(a?.runner))return;
 const key=a.runner.cid+':'+(a.runner.deck||'');if(d.linkedKey===key)return;
 d.linkedKey=key;const r=resolve(a,chars);if(!r)return;
 d.runner=r.c.id;d.deck=r.deck?.id||'';d.copy='';d.copyFingerprint=null;
}
// Under the damage of an ICE to a program: which program of the linked deck loses the REZ.
function damageHtml(a,res,chars,lang,draft){
 const dm=res?.damage,r=resolve(a,chars);
 if(!obj(dm)||res?.mode!=='ice'||dm.to!=='rez'||dm.iceKey||dm.applied||!r||!r.deck)return '';
 const z=T[lng(lang)],list=programs(a,chars,lang),pick=list.find(p=>p.id===draft?.victimProgram);
 return `<div class="rp-result net-link-damage" data-net-link-damage><label class="field">${esc(z.program)}<select data-net-combat="victimProgram"><option value="">${esc(z.noProgram)}</option>${list.map(p=>`<option value="${esc(p.id)}"${p===pick?' selected':''}>${esc(p.name)} · REZ ${p.rez}/${p.max}</option>`).join('')}</select></label>${pick?`<div>${esc(z.after(pick.name,pick.rez,Math.max(0,pick.rez-dm.total)))}</div><div class="rp-actions"><button type="button" class="btn primary" data-net="combat-apply">${esc(z.apply)}</button></div>`:''}</div>`;
}
global.NetLink={ABILITY,T,resolve,rank,runInfo,counter,roll,rollGeneric,programs,applyProgram,undoProgram,cardHtml,change,prefill,damageHtml,options};
})(window);
