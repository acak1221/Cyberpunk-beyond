/* The run console of the NETRUN tab (window.NetrunConsole): one place to roll, in one tap.
   Top to bottom: the status line (jacked in or not, NET Actions as pips, «New turn»), the DV and the own modifier, a compact grid of
   the nine Interface abilities with the total each press will roll, and the line of the last roll. A Zap hit offers its 1d6 right there.
   The «Атака» of an attacker program lives on its card in the deck (attackHtml) and uses the same check path.
   Layout choice for a phone: compact, not sticky. The whole console (status, DV, grid) is about 300 px tall, so the counter and the
   DV stay on the screen together with the grid at 390 px; a second pinned bar under the pinned sheet header would eat the screen.
   One roll path: every roll goes through RolePlay.netrunRoll / netrunAttack -> App.check (wound penalty, sheet effects, the own
   modifier, boosters), so history and the online room feed get it. Data: c.extra.roleTools.netrunner.values {used, modifier,
   jackedIn?}; `jackedIn` is optional, absent = not jacked in. Own words only; the numbers come from the catalog and the repo data. */
(function(global){
'use strict';
const doc=global.document;
const T={
 ru:{title:'NETRUN',kicker:'INTERFACE',rank:'Interface',
  jackIn:'Войти в сеть',jackOut:'Выйти из сети',inNet:'В сети',outNet:'Не в сети',
  actions:'NET-действия',of:'из',spend:'Потратить',spendAria:'Потратить NET-действие',turn:'Новый ход',pips:(l,m)=>`NET-действий осталось ${l} из ${m}`,
  dv:'DV проверки',dvNone:'нет',mod:'Свой модификатор',dvHint:'Scanner, Pathfinder и Cloak DV не используют.',
  group:'Способности Interface',meat:'без действия',what:'Что делает каждая способность',
  costs:'Тратит одно NET-действие.',free:'Не тратит NET-действие: это физическое действие.',needNet:'Нужно быть в сети.',
  abAria:(n,t,d,extra)=>`${n}, ${t} к броску. ${d}. ${extra}`,
  open:'Открыть NET-архитектуры',
  last:'Последний бросок',success:'успех',failure:'провал',noDv:'DV не задан: сравните результат сами',resultOnly:'результат для ведущего',
  zapDmg:'Урон 1d6',zapHint:'Успех: бросьте урон.',zapMiss:'Промах: урона нет.',zapUnknown:'DV не задан: бросайте урон, если попали.',
  zapDone:t=>`Урон Zap: ${t}`,
  attack:'Атака',attackTotal:n=>`Атака ${n>=0?'+':'−'}${Math.abs(n)}`,attackNote:'Приложение само не списывает NET-действие за атаку: потратьте его кнопкой «Потратить», если так играет ваш стол.',
  hit:'Попадание',miss:'Промах: урона нет.',target:'Цель',tProgram:'Программа, не Black ICE',tIce:'Black ICE',
  dmgBtn:(n,to)=>`Урон ${n}d6 · ${to==='brain'?'в мозг':'по REZ'}`,dmgDone:(n,dice,total,to)=>`Урон ${n}d6 (${dice}) = ${total} ${to==='brain'?'в мозг, напрямую в HP':'по REZ'}`,
  diceLabel:'Кубики d6',diceBtn:'Бросить кубики',diceNote:'Эффект программы с кубиками описан только текстом, и это не обязательно урон: число кубиков возьмите из описания программы.',noDice:'В описании программы нет кубиков: её эффект применяйте по тексту.',pickDice:'Укажите число кубиков от 1 до 6.',diceName:'кубики',diceDone:(n,dice,total)=>`${n}d6 (${dice}) = ${total}`,
  stale:'Данные изменились. Повторите действие.',undo:'Отменить',restored:'Возвращено.',
  noSpend:'NET-действия этого хода исчерпаны. Нажмите «Новый ход».',spent:(l,m)=>`NET-действие потрачено: осталось ${l} из ${m}.`,newTurn:'Новый ход: NET-действия восстановлены.',turnCut:(m,f)=>`В этом ходу их ${m} из ${f}: сработала метка «−1 NET-действие».`,
  openRole:'Проверки Interface, NET-действия, модификатор и кибердека теперь на вкладке NETRUN.',openRoleBtn:'Открыть вкладку NETRUN',
  lead:'Кнопка способности бросает 1d10 + ранг Interface + активный бустер + свой модификатор − штраф от ранений против DV из поля. Все способности, кроме Scanner, работают, только когда вы в сети.'},
 en:{title:'NETRUN',kicker:'INTERFACE',rank:'Interface',
  jackIn:'Jack In',jackOut:'Jack Out',inNet:'Jacked in',outNet:'Not jacked in',
  actions:'NET Actions',of:'of',spend:'Spend',spendAria:'Spend a NET Action',turn:'New turn',pips:(l,m)=>`${l} of ${m} NET Actions left`,
  dv:'Check DV',dvNone:'none',mod:'Own modifier',dvHint:'Scanner, Pathfinder and Cloak do not use the DV.',
  group:'Interface abilities',meat:'no action',what:'What each ability does',
  costs:'Spends one NET Action.',free:'Spends no NET Action: it is a Meat Action.',needNet:'You need to be jacked in.',
  abAria:(n,t,d,extra)=>`${n}, ${t} to the roll. ${d}. ${extra}`,
  open:'Open NET architectures',
  last:'Last roll',success:'success',failure:'failure',noDv:'No DV set: compare the result yourself',resultOnly:'a result for the GM',
  zapDmg:'Damage 1d6',zapHint:'On a success, roll the damage.',zapMiss:'A miss: no damage.',zapUnknown:'No DV set: roll the damage if it hit.',
  zapDone:t=>`Zap damage: ${t}`,
  attack:'Attack',attackTotal:n=>`Attack ${n>=0?'+':'−'}${Math.abs(n)}`,attackNote:'The app does not spend a NET Action for the attack by itself: use “Spend” if your table counts it.',
  hit:'Hit',miss:'A miss: no damage.',target:'Target',tProgram:'A program, not Black ICE',tIce:'Black ICE',
  dmgBtn:(n,to)=>`Damage ${n}d6 · ${to==='brain'?'to the brain':'to REZ'}`,dmgDone:(n,dice,total,to)=>`Damage ${n}d6 (${dice}) = ${total} ${to==='brain'?'to the brain, straight to HP':'to REZ'}`,
  diceLabel:'d6 dice',diceBtn:'Roll the dice',diceNote:'The effect of this program is only described in text, and it is not necessarily damage: take the number of dice from the program description.',noDice:'The program description names no dice: apply its effect from the text.',pickDice:'Enter a number of dice from 1 to 6.',diceName:'dice',diceDone:(n,dice,total)=>`${n}d6 (${dice}) = ${total}`,
  stale:'Data changed. Try again.',undo:'Undo',restored:'Restored.',
  noSpend:'No NET Actions remain this turn. Press “New turn”.',spent:(l,m)=>`NET Action spent: ${l} of ${m} left.`,newTurn:'New turn: NET Actions restored.',turnCut:(m,f)=>`This turn you have ${m} of ${f}: the “−1 NET Action” marker applied.`,
  openRole:'Interface checks, NET Actions, the modifier and the cyberdeck are now on the NETRUN tab.',openRoleBtn:'Open the NETRUN tab',
  lead:'An ability button rolls 1d10 + Interface rank + a rezzed booster + your own modifier − the wound penalty against the DV in the field. Every ability but Scanner works only while you are jacked in.'}
};
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const obj=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
const lng=l=>l==='en'?'en':'ru';
const RP=()=>global.RolePlay,app=()=>global.App;
const langNow=()=>lng(app()?.lang?.());
const rankOf=c=>{try{return Number(global.NetrunTab?.interfaceRank?.(c))||0}catch{return 0}};
const MEAT=['Scanner'],RESULT_ONLY=['Scanner','Pathfinder','Cloak'];
const signed=n=>(n<0?'−':'+')+Math.abs(n);
function abilities(){const list=global.RoleTools?.data?.netAbilities;return Array.isArray(list)?list.filter(a=>Array.isArray(a)&&a.length>=3):[]}

// ---------- what a press will roll ----------
// The sheet's own part of every check: the wound penalty and the effects of the sheet (what App.check adds itself).
function sheetMod(c){
 try{const m=app()?.rollMods?.(c);const w=Number(m?.wound),e=Number(m?.effect);return (Number.isFinite(w)?w:0)+(Number.isFinite(e)?e:0)}catch{return 0}
}
function abilityInfo(c,rank,name){
 const b=RP()?.netBonus?.(c,name,global.NetrunEffects?.skipList?.(c))||{value:0,names:[]},mod=RP()?.netMod?.(c)??0,sheet=sheetMod(c);
 return {name,boost:b.value,boosters:b.names,mod,sheet,total:rank+b.value+mod+sheet,free:MEAT.includes(name),resultOnly:RESULT_ONLY.includes(name),needsNet:!MEAT.includes(name)};
}
function attackInfo(c,rank,entry){
 const p=(Array.isArray(global.CATALOG)?global.CATALOG:[]).find(x=>x?.id===entry?.catalogId),atk=Number(p?.stats?.atk)||0,mod=RP()?.netMod?.(c)??0,sheet=sheetMod(c);
 return {atk,mod,sheet,total:rank+atk+mod+sheet};
}

// ---------- the memory of the page (a view, not part of the sheet) ----------
let ui={char:'',last:null,dmg:null,msg:'',msgFor:'',vsIce:false,dice:0};
const uiFor=c=>{if(ui.char!==c?.id)ui={char:c?.id,last:null,dmg:null,msg:'',msgFor:'',vsIce:false,dice:0};return ui};

// ---------- drawing ----------
function pipsHtml(left,max){let h='';for(let i=0;i<max;i++)h+=`<i class="nc-pip${i<left?' is-on':''}"></i>`;return h}
function lastHtml(c,t,l,u){
 const r=u.last;if(!r)return '';
 let verdict;
 if(r.resultOnly)verdict=t.resultOnly;
 else if(r.noVerdict)verdict='';
 else if(r.beat===true)verdict=`DV ${r.dv}: ${t.success}`;
 else if(r.beat===false)verdict=`DV ${r.dv}: ${t.failure}`;
 else verdict=t.noDv;
 return `<p class="nc-last"><span>${esc(t.last)}</span> <b>${esc(r.label)}</b> → <strong>${esc(r.total)}</strong>${verdict?' · '+esc(verdict):''}</p>`;
}
function zapHtml(t,u){
 const r=u.last;if(!r||r.kind!=='ability'||r.ability!=='Zap')return '';
 if(u.dmg&&u.dmg.kind==='zap')return `<p class="nc-dmg" data-nc-dmg tabindex="-1">${esc(t.zapDone(u.dmg.text))}</p>`;
 if(r.beat===false)return `<p class="nc-note">${esc(t.zapMiss)}</p>`;
 return `<div class="nc-zap"><button type="button" class="nc-btn nc-primary" data-nc-act="zap-dmg">${esc(t.zapDmg)}</button><span class="nc-note">${esc(r.beat===true?t.zapHint:t.zapUnknown)}</span></div>`;
}
function render(c,lang){
 const rank=rankOf(c);if(!rank||!obj(c))return '';
 const l=lng(lang),t=T[l],u=uiFor(c),rp=RP(),n=rp?.netLeft?.(c,rank)||{max:0,used:0,left:0},jacked=rp?.jackedIn?.(c)===true,mod=rp?.netMod?.(c)??0,dv=rp?.getDv?.()||0;
 const jackBtn=jacked?`<button type="button" class="nc-btn nc-jack is-in" data-nc-act="jack-out">${esc(t.jackOut)}</button>`:`<button type="button" class="nc-btn nc-jack nc-primary" data-nc-act="jack-in">${esc(t.jackIn)}</button>`;
 const status=`<div class="nc-row nc-status" data-nc-status role="status"><span class="nc-state${jacked?' is-in':''}"><i aria-hidden="true"></i>${esc(jacked?t.inNet:t.outNet)}</span><span class="nc-rank">${esc(t.rank)} <b>${rank}</b></span><span class="nc-count"><span class="nc-pips" aria-hidden="true">${pipsHtml(n.left,n.max)}</span><span class="nc-sr">${esc(t.pips(n.left,n.max))}</span><span aria-hidden="true"><b>${n.left}</b> ${esc(t.of)} ${n.max}</span></span></div>`;
 const row=`<div class="nc-row nc-buttons">${jackBtn}<button type="button" class="nc-btn" data-nc-act="spend" aria-label="${esc(t.spendAria)}">${esc(t.spend)}</button><button type="button" class="nc-btn" data-nc-act="turn">${esc(t.turn)}</button></div>`;
 const fields=`<div class="nc-row nc-fields"><label class="nc-field">${esc(t.dv)}<input type="number" inputmode="numeric" min="0" max="99" data-rp-net-dv value="${dv||''}" placeholder="${esc(t.dvNone)}" aria-describedby="nc-dvhint"></label><label class="nc-field">${esc(t.mod)}<input type="number" inputmode="numeric" min="-100" max="100" data-nc-mod value="${mod}"></label></div><p class="nc-hint" id="nc-dvhint">${esc(t.dvHint)}</p>`;
 const list=abilities();
 const grid=`<div class="netrun-grid nc-grid" role="group" aria-label="${esc(t.group)}">${list.map(([name,ru,en])=>{
  const a=abilityInfo(c,rank,name),desc=l==='ru'?ru:en,extra=[a.free?t.free:t.costs,a.needsNet?t.needNet:''].filter(Boolean).join(' ');
  const parts=[`Interface ${rank}`,a.boost?`${a.boosters.join(', ')} ${a.boost}`:'',a.mod?`${t.mod} ${signed(a.mod)}`:'',a.sheet?signed(a.sheet):''].filter(Boolean).join(' + ');
  return `<button type="button" class="netrun-ability nc-ab${a.needsNet&&!jacked?' is-off':''}" data-netrun-roll="${esc(name)}" data-nc-total="${a.total}" title="${esc(parts)}" aria-label="${esc(t.abAria(name,signed(a.total),desc,extra))}"><b>${esc(name)}</b><em>${signed(a.total)}</em>${a.free?`<small>${esc(t.meat)}</small>`:''}</button>`;
 }).join('')}</div>`;
 const fx=global.NetrunEffects?.render?.(c,l)||{speed:'',strip:'',damage:''};
 const what=`<details class="nc-what"><summary>${esc(t.what)}</summary><ul>${list.map(([name,ru,en])=>`<li><b>${esc(name)}</b> · ${esc(l==='ru'?ru:en)}</li>`).join('')}</ul><p class="nc-hint">${esc(t.lead)}</p></details>`;
 const msg=u.msg&&!u.msgFor?`<p class="nc-msg">${esc(u.msg)}</p>`:'';
 const result=`${msg}<div class="nc-result" data-nc-result role="status" aria-live="polite">${lastHtml(c,t,l,u)}${zapHtml(t,u)}</div>`;
 return `<section class="card netrun-card nc-card" data-nc-root data-nc-char="${esc(c.id)}" aria-labelledby="nc-title"><div class="card-heading"><span id="nc-title">${esc(t.title)}</span><span>${t.kicker}</span></div>${status}${row}${fields}${grid}${result}${fx.speed}${fx.strip}${fx.damage}${what}<div class="netrun-actions"><button type="button" class="btn ghost" data-action="navigate" data-view="net">⌬ ${esc(t.open)}</button></div></section>`;
}
// The block of an attacker program for its card in the deck (NetrunDeck calls it).
function attackHtml(c,entry,lang){
 const rank=rankOf(c),s=RP()?.runState?.(entry);if(!rank||!s?.attacker)return '';
 const l=lng(lang),t=T[l],u=uiFor(c),a=attackInfo(c,rank,entry),id=esc(entry.id);
 let h=`<div class="nc-attack" data-nc-attack="${id}"><div class="nc-row"><button type="button" class="nc-btn nc-primary" data-nc-act="attack" data-deck-entry="${id}">${esc(t.attack)} <b>${signed(a.total)}</b></button></div><p class="nc-note">${esc(t.attackNote)}</p>`;
 if(u.msg&&u.msgFor===entry.id)h+=`<p class="nc-msg">${esc(u.msg)}</p>`;
 const r=u.last;
 if(r&&r.kind==='attack'&&r.entryId===entry.id){
  h+=`<div role="status" aria-live="polite">${lastHtml(c,t,l,u)}`;
  if(r.beat===false)h+=`<p class="nc-note">${esc(t.miss)}</p>`;
  else{
   if(u.dmg&&u.dmg.entryId===entry.id)h+=`<p class="nc-dmg" data-nc-dmg tabindex="-1">${esc(u.dmg.text)}</p>`;
   h+=damageControls(entry,t,u,r);
  }
  h+='</div>';
 }
 return h+'</div>';
}
// Does the described effect of the program name dice at all (NdM in its own text)? Only then a dice picker is offered.
function textHasDice(catalogId){
 const p=(Array.isArray(global.CATALOG)?global.CATALOG:[]).find(x=>x?.id===catalogId);
 return /\d\s*d\s*\d/i.test(String(p?.details?.en||''))||/\d\s*d\s*\d/i.test(String(p?.details?.ru||''));
}
function damageControls(entry,t,u,r){
 const d=RP()?.attackDamage?.(entry.catalogId,u.vsIce);
 if(d?.fixed){
  const pick=d.byTarget?`<label class="nc-field">${esc(t.target)}<select data-nc-vs><option value="program"${u.vsIce?'':' selected'}>${esc(t.tProgram)}</option><option value="ice"${u.vsIce?' selected':''}>${esc(t.tIce)}</option></select></label>`:'';
  return `<div class="nc-row">${pick}<button type="button" class="nc-btn nc-primary" data-nc-act="attack-dmg" data-deck-entry="${esc(entry.id)}">${esc(t.dmgBtn(d.dice,d.to))}</button></div>${r.beat===null?`<p class="nc-note">${esc(t.zapUnknown)}</p>`:''}`;
 }
 if(!textHasDice(entry.catalogId))return `<p class="nc-note">${esc(t.noDice)}</p>`;
 return `<div class="nc-row"><label class="nc-field">${esc(t.diceLabel)}<input type="number" inputmode="numeric" min="1" max="6" data-nc-dice value="${u.dice||''}" placeholder="1–6"></label><button type="button" class="nc-btn nc-primary" data-nc-act="attack-dice" data-deck-entry="${esc(entry.id)}">${esc(t.diceBtn)}</button></div><p class="nc-note">${esc(t.diceNote)}</p>`;
}
// A small note in the role panel of a netrunner points to the tab (the Interface block is not drawn there any more).
function roleNote(lang){
 const t=T[lng(lang)];
 return `<p class="rt-help">${esc(t.openRole)}</p><div class="rt-actions"><button type="button" class="rt-button" data-netrun-open>${esc(t.openRoleBtn)}</button></div>`;
}

// ---------- redraw ----------
const DMG_FOCUS='[data-nc-root] [data-nc-dmg]';
const say=m=>{if(m)try{app()?.notify?.(m)}catch{}};
// Only the console is redrawn (the page does not jump); the focus stays on the pressed control.
function focusKey(){
 const a=doc?.activeElement;if(!a||!a.closest||!a.closest('[data-nc-root]'))return null;
 if(a.dataset?.netrunRoll)return `[data-nc-root] [data-netrun-roll="${a.dataset.netrunRoll}"]`;
 if(a.dataset?.nxFocus)return `[data-nc-root] [data-nx-focus="${String(a.dataset.nxFocus).replace(/[^\w-]/g,'')}"]`;
 if(a.dataset?.ncAct)return `[data-nc-root] [data-nc-act="${a.dataset.ncAct}"]`;
 return null;
}
// `fallback`: where the focus goes when the pressed control is gone after the redraw (Jack In becomes Jack Out, a button becomes its result);
// `force`: the press came from a control that is replaced elsewhere (the deck card), so the focus is moved there too.
const insideRun=()=>{const a=doc?.activeElement;return !!(a&&a.closest&&a.closest('[data-nc-root], [data-nd-root]'))};
function refresh(fallback,force){
 const A=app(),c=A?.active?.(),root=doc?.querySelector?.('[data-nc-root]');
 if(!c||!root)return;
 const key=focusKey()||(force&&fallback&&insideRun()?fallback:null),box=doc.createElement('div');box.innerHTML=render(c,langNow());const next=box.firstElementChild;
 if(!next)return;
 root.replaceWith(next);
 if(key)try{setTimeout(()=>{try{(doc.querySelector(key)||(fallback&&doc.querySelector(fallback)))?.focus?.({preventScroll:true})}catch{}},0)}catch{}
}
function refreshAll(fallback){
 refresh(fallback,true);try{global.NetrunDeck?.redraw?.()}catch{}
}
// the numbers on the buttons follow the own modifier while it is typed (the field itself is not redrawn)
function patchTotals(){
 const c=app()?.active?.(),rank=rankOf(c);if(!c||!rank||!doc?.querySelectorAll)return;
 const l=langNow(),t=T[l],list=abilities();
 for(const b of doc.querySelectorAll('[data-nc-root] [data-netrun-roll]')){
  const name=b.dataset.netrunRoll,a=abilityInfo(c,rank,name),row=list.find(x=>x[0]===name);
  b.dataset.ncTotal=String(a.total);const em=b.querySelector?.('em');if(em)em.textContent=signed(a.total);
  if(row)b.setAttribute?.('aria-label',t.abAria(name,signed(a.total),l==='ru'?row[1]:row[2],[a.free?t.free:t.costs,a.needsNet?t.needNet:''].filter(Boolean).join(' ')));
 }
}

// ---------- actions ----------
function current(){const A=app(),c=A?.active?.(),rank=rankOf(c);return c&&rank?{A,c,rank,l:langNow()}:null}
function rollAbility(name){
 const x=current();if(!x||!abilities().some(a=>a[0]===name))return false;
 const r=RP()?.netrunRoll?.(x.c,x.rank,name);if(!r)return false;
 const u=uiFor(x.c),t=T[x.l];u.dmg=null;
 if(!r.ok){u.msg=r.message;u.msgFor='';refresh();return r}
 u.msg='';u.msgFor='';
 u.last={kind:'ability',ability:name,label:r.plan.label,total:r.out?.total,beat:r.out?.beat===true?true:r.out?.beat===false?false:null,dv:r.plan.dv,resultOnly:RESULT_ONLY.includes(name)};
 refresh();
 return r;
}
function zapDamage(rng){
 const x=current();if(!x)return false;
 const u=uiFor(x.c),r=u.last;if(!r||r.kind!=='ability'||r.ability!=='Zap'||r.beat===false)return false;
 const roll=RP()?.netDamageRoll?.({dice:1,to:'rez'},rng);if(!roll)return false;
 try{global.Rolls?.sum?.('NET · '+(x.l==='ru'?'урон':'damage')+' · Zap',roll.dice,6)}catch{}
 u.dmg={kind:'zap',text:`1d6 = ${roll.total}`,total:roll.total};say(T[x.l].zapDone(u.dmg.text));
 refresh(DMG_FOCUS);return u.dmg;
}
const atkSel=(id,act)=>`[data-nd-root] [data-nc-attack="${String(id).replace(/[^\w-]/g,'')}"] [data-nc-act="${act}"]`;
function attack(deckId,entryId){
 const x=current();if(!x)return false;
 const u=uiFor(x.c),r=RP()?.netrunAttack?.(x.c,x.rank,deckId,entryId);if(!r)return false;
 u.dmg=null;
 if(!r.ok){u.msg=r.message;u.msgFor=entryId;try{global.NetrunDeck?.redraw?.(atkSel(entryId,'attack'))}catch{}return r}
 u.msg='';u.msgFor='';
 u.last={kind:'attack',entryId,deckId,catalogId:r.plan.program.catalogId,label:r.plan.label,total:r.out?.total,beat:r.out?.beat===true?true:r.out?.beat===false?false:null,dv:r.plan.dv};
 try{global.NetrunDeck?.redraw?.(atkSel(entryId,'attack'))}catch{}
 refresh();
 return r;
}
function findEntry(c,deckId,entryId){
 const decks=c?.extra?.cyberdecks?.decks,d=Array.isArray(decks)?decks.find(z=>obj(z)&&z.id===deckId):null;
 return Array.isArray(d?.entries)?d.entries.find(e=>obj(e)&&e.id===entryId)||null:null;
}
// kind: 'dmg' (the number of dice is in the data) | 'dice' (the player picks the number)
function attackDamageRoll(kind,deckId,entryId,rng){
 const x=current();if(!x)return false;
 const u=uiFor(x.c),r=u.last,e=findEntry(x.c,deckId,entryId),t=T[x.l];
 if(!e||!r||r.kind!=='attack'||r.entryId!==entryId||r.beat===false||!RP()?.runState?.(e)?.attacker){say(t.stale);return false}
 let plan,count,to='rez';
 if(kind==='dmg'){const d=RP().attackDamage(e.catalogId,u.vsIce);if(!d.fixed){say(t.stale);return false}plan=d.plan;count=d.dice;to=d.to}
 else{if(!textHasDice(e.catalogId)){say(t.stale);return false}count=Math.max(0,Math.min(6,Math.trunc(Number(u.dice))||0));if(!count){say(t.pickDice);return false}plan={dice:count,to:'rez'}}
 const roll=RP().netDamageRoll(plan,rng);if(!roll)return false;
 const name=String(e.name?.[x.l]||e.name?.en||''),dice=roll.dice.join(' + ');
 try{global.Rolls?.sum?.('NET · '+(kind==='dmg'?(x.l==='ru'?'урон':'damage'):t.diceName)+(name?' · '+name:''),roll.dice,6,{note:kind==='dmg'?(to==='brain'?(x.l==='ru'?'в мозг, напрямую в HP':'to the brain, straight to HP'):'REZ'):''})}catch{}
 const text=kind==='dmg'?t.dmgDone(count,dice,roll.total,to):t.diceDone(count,dice,roll.total);
 u.dmg={kind:'attack',entryId,text,total:roll.total};say(`${name}: ${text}`);
 try{global.NetrunDeck?.redraw?.(atkSel(entryId,kind==='dmg'?'attack-dmg':'attack-dice'))}catch{}
 return u.dmg;
}
function setMod(value){
 const x=current();if(!x)return false;
 const n=Math.trunc(Number(value));if(!Number.isFinite(n))return false;
 const v=Math.max(-100,Math.min(100,n));
 x.c.extra=RP().withRun(x.c.extra,{modifier:v});
 patchTotals();return v;
}
function saveNow(){try{app()?.save?.()}catch{}}
function spend(){
 const x=current();if(!x)return false;const n=RP().netLeft(x.c,x.rank),t=T[x.l];
 if(n.left<1){say(t.noSpend);return false}
 x.c.extra=RP().withRun(x.c.extra,{used:n.used+1});saveNow();refresh();say(t.spent(n.left-1,n.max));return true;
}
function newTurn(){
 const x=current();if(!x)return false;
 const pend=Number(x.c.extra?.roleTools?.netrunner?.values?.netPenalty)>0;
 x.c.extra=RP().turnExtra(x.c.extra);saveNow();refresh();
 const after=RP().netLeft(x.c,x.rank),t=T[x.l];
 say(pend&&after.cut?`${t.newTurn} ${t.turnCut(after.max,after.full)}`:t.newTurn);return true;
}
// What Jack Out changes: the netrunner values and the decks. The undo applies only to exactly what the action left.
const runSnap=c=>JSON.stringify({rt:c?.extra?.roleTools?.netrunner??null,cd:c?.extra?.cyberdecks??null});
function restoreRun(c,before){
 const b=JSON.parse(before);if(!obj(c.extra))c.extra={};
 if(b.rt===null){if(obj(c.extra.roleTools))delete c.extra.roleTools.netrunner}
 else c.extra.roleTools={...(obj(c.extra.roleTools)?c.extra.roleTools:{}),netrunner:b.rt};
 if(b.cd===null)delete c.extra.cyberdecks;else c.extra.cyberdecks=b.cd;
}
// op: 'in' | 'out'; deckId: the deck whose programs are reset on Jack Out. Returns true when the press was handled here.
function jack(op,deckId){
 const x=current();if(!x||(op!=='in'&&op!=='out'))return false;
 const {A,c,rank,l}=x,t=T[l],id=deckId||global.NetrunDeck?.currentId?.(c)||'';
 const before=runSnap(c),r=RP().jackAct(c,op,id,rank,l);
 const u=uiFor(c);u.last=null;u.dmg=null;u.msg='';u.msgFor='';
 const succ=op==='in'?'[data-nc-root] [data-nc-act="jack-out"]':'[data-nc-root] [data-nc-act="jack-in"]';
 if(!r.ok){say(r.message);refreshAll(succ);return true}
 c.extra=r.extra;const after=runSnap(c);saveNow();refreshAll(succ);
 if(op==='out'&&typeof A.notifyAction==='function'){
  const cid=c.id,undo=()=>{
   const ch=A.getState?.()?.characters?.find?.(z=>z&&z.id===cid);
   if(!ch||runSnap(ch)!==after){say(t.stale);return}
   restoreRun(ch,before);saveNow();
   if(A.active?.()?.id===cid)refreshAll('[data-nc-root] [data-nc-act="jack-in"]');else A.render?.();
   say(t.restored);
  };
  try{A.notifyAction(r.message,t.undo,undo);return true}catch{}
 }
 say(r.message);return true;
}

// ---------- events ----------
function onClick(e){
 const el=e.target;if(!el?.closest)return;
 const open=el.closest('[data-netrun-open]');
 if(open){try{doc.querySelector('.sheet-tabs [data-sheet-tab="netrun"]')?.click()}catch{}return}
 const ab=el.closest('[data-netrun-roll]');
 if(ab&&ab.closest('[data-nc-root]')){rollAbility(ab.dataset.netrunRoll);return}
 const b=el.closest('[data-nc-act]');if(!b)return;
 const act=b.dataset.ncAct,deckId=b.closest?.('[data-deck-id]')?.dataset?.deckId||'';
 if(act==='jack-in')jack('in');
 else if(act==='jack-out')jack('out');
 else if(act==='spend')spend();
 else if(act==='turn')newTurn();
 else if(act==='zap-dmg')zapDamage();
 else if(act==='attack')attack(deckId,b.dataset.deckEntry);
 else if(act==='attack-dmg')attackDamageRoll('dmg',deckId,b.dataset.deckEntry);
 else if(act==='attack-dice')attackDamageRoll('dice',deckId,b.dataset.deckEntry);
}
function onInput(e){
 const m=e.target?.closest?.('[data-nc-mod]');
 if(m){setMod(m.value);return}
 const d=e.target?.closest?.('[data-nc-dice]');
 if(d){const c=app()?.active?.();if(c){const n=Math.trunc(Number(d.value));if(Number.isFinite(n))uiFor(c).dice=Math.max(1,Math.min(6,n))}}
}
function onChange(e){
 if(e.target?.closest?.('[data-nc-mod]')){saveNow();return}
 const vs=e.target?.closest?.('[data-nc-vs]');
 if(vs){const c=app()?.active?.();if(c){uiFor(c).vsIce=vs.value==='ice';uiFor(c).dmg=null;try{global.NetrunDeck?.redraw?.('[data-nd-root] [data-nc-vs]')}catch{}}}
}
if(doc?.addEventListener){
 doc.addEventListener('click',onClick);
 doc.addEventListener('input',onInput);
 doc.addEventListener('change',onChange);
}
function setLast(r){const c=app()?.active?.();if(c&&obj(r))uiFor(c).last=r}
global.NetrunConsole={setLast,render,refresh,attackHtml,roleNote,abilityInfo,attackInfo,rollAbility,zapDamage,attack,attackDamageRoll,setMod,spend,newTurn,jack,patchTotals,restoreRun,runSnap,signed,T};
})(window);
