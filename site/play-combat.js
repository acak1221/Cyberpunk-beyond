/* The player's fight on the sheet: what a person at the table needs between «my turn» and «next».
   Pure rules are in the first half (tested in tests/play-combat.test.cjs); the second half is the small amount of DOM work.
   Nothing here changes a character by itself: the app calls in, gets a plan and saves the way it always does. */
(function(global){
'use strict';
const num=v=>{const n=Number(v);return Number.isFinite(n)?n:0};
const int=(v,lo,hi)=>Math.max(lo,Math.min(hi,Math.trunc(num(v))));

/* ---------- 1. The page keeps its place when the sheet is drawn again ----------
   Every saving action (a shot, «−1», a reload) redraws the whole sheet. The browser then «anchors» the scroll to whatever
   block it finds, and on a phone in the «Досье» look the page ran away by a screen. The tapped control is remembered here
   by a selector, and after the redraw the page is moved so that the control is where the finger left it. */
const cssText=v=>String(v).replace(/["\\]/g,'\\$&');
// A selector that finds the same control after the HTML has been replaced: tag, id or data-attributes, and its number among equals.
function markOf(el,root){
 try{
  if(!el||!root||typeof el.getAttribute!=='function')return null;
  let sel=String(el.tagName||'').toLowerCase();if(!sel)return null;
  if(el.id)sel+=`[id="${cssText(el.id)}"]`;
  else{
   const attrs=[...(el.attributes||[])].filter(a=>a.name.startsWith('data-')&&a.value.length<=120);
   if(!attrs.length&&!el.getAttribute('name'))return null;
   for(const a of attrs)sel+=`[${a.name}="${cssText(a.value)}"]`;
   if(el.getAttribute('name'))sel+=`[name="${cssText(el.getAttribute('name'))}"]`;
  }
  return {sel,index:Math.max(0,[...root.querySelectorAll(sel)].indexOf(el))};
 }catch{return null}
}
// How far to move the page: the control was at `before` px from the top of the screen and is now at `after`.
function scrollFix(before,after){const d=Math.round(num(after)-num(before));return Math.abs(d)<1?0:d}
let touched=null,touchedAt=0,lastScreen=null;
function remember(e){
 const t=e?.target?.closest?.('button,select,input,textarea,summary,a,[data-action],[data-cx-action]');
 if(t){touched=t;touchedAt=Date.now()}
}
/* Called by the app right before a redraw; returns the function to call right after it. `screen` names what is shown
   (view + character): a change of screen is navigation, and navigation decides the scroll itself. */
function keepPlace(screen){
 const doc=global.document,win=global;
 try{
  const same=lastScreen===screen;lastScreen=screen;
  if(!same||!doc?.querySelector||typeof win.scrollBy!=='function')return null;
  const root=doc.body,y=win.scrollY;
  const el=touched&&touched.isConnected&&Date.now()-touchedAt<4000&&touched.getClientRects?.().length?touched:null;
  const mark=el?markOf(el,root):null,top=el?el.getBoundingClientRect().top:0;
  let expected=null;
  const fix=()=>{
   try{
    // Somebody else has scrolled since (a link to a section, «to the top»): leave it.
    if(expected!==null&&Math.abs(win.scrollY-expected)>1)return;
    const now=mark?root.querySelectorAll(mark.sel)[mark.index]:null;
    if(now&&now.getClientRects?.().length){const d=scrollFix(top,now.getBoundingClientRect().top);if(d)win.scrollBy(0,d)}
    else if(Math.abs(win.scrollY-y)>1)win.scrollTo(0,y);
    expected=win.scrollY;
   }catch{}
  };
  return ()=>{
   fix();
   // The looks finish their layout after the redraw (the chips of «Досье» in a microtask, the native look in a frame).
   try{global.queueMicrotask?.(fix)}catch{}
   try{global.requestAnimationFrame?.(()=>{fix();global.requestAnimationFrame?.(fix)})}catch{}
  };
 }catch{return null}
}

/* ---------- 2. Words ---------- */
const lang=()=>{try{return global.document?.documentElement?.lang==='en'?'en':'ru'}catch{return 'ru'}};
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const T={
 ru:{dead:'Персонаж мёртв',hitTitle:'Попадание по мне',hitRaw:'Урон',hitBody:'Тело',hitHead:'Голова',hitDirect:'Мимо брони',hitMelee:'Оружие ближнего боя: SP ÷ 2',hitAp:'Бронебойный',hitCrit:'Крит. ранение +5',hitApply:'Применить',hitFull:'Полный расчёт',hitEmpty:'Введите урон с кубиков атакующего.',hitManual:'Этот случай считается в полном расчёте.',hitBlocked:'Броня остановила удар',hitToHp:'По HP',hitHeadX:'голова ×{n}',hitInjury:'ранение +{n}',hitDeath:'штраф Death Save {from} → {to}',hitForced:'при смерти: каждое попадание даёт критическое ранение',hitUnstable:'стабилизация сброшена',hitDone:'Записано',hitUndo:'Отменить',hitUndone:'Попадание отменено.',hitUndoStale:'Лист уже изменился: отменить попадание нельзя.',hitRollInjury:'Бросить критическое ранение',aim:'Прицельно',aimNo:'нет',aim_head:'в голову',aim_item:'по предмету в руке',aim_leg:'в ногу',aimTitle:'Прицельная атака: −8 к проверке, одна атака за действие. Очередью прицельно бить нельзя.',aimLabel:'прицельно',aimHint_head:'Прицельно в голову: урон, прошедший броню, умножается на 2.',aimHint_item:'Прицельно по предмету: если урон прошёл броню, цель роняет предмет.',aimHint_leg:'Прицельно в ногу: если урон прошёл броню, у цели критическое ранение «Сломанная нога».',burst:'Очередь −10',burstTitle:'Автоматический огонь: REF + Автоматический огонь + 1d10, расход 10 патронов. DV берётся из выбранной дистанции.',burstLabel:'Очередь',burstShort:'очередь',burstNeed:'Для очереди нужно 10 патронов в магазине.',burstFar:'На этой дистанции очередью стрелять нельзя: автоматический огонь бьёт до 100 м.',burstHit:'Очередь {total} против DV {dv}: попадание, урон 2d6 × {mult}.',burstMiss:'Очередь {total} против DV {dv}: промах.',burstOpen:'Очередь {total}. Сравните с DV дистанции или уклонением цели: урон 2d6 × превышение, не больше ×{max}.',burstDamage:'Урон очереди',burstTable:'по превышению',suppress:'Подавление −10',suppressTitle:'Подавляющий огонь: REF + Автоматический огонь + 1d10, расход 10 патронов.',suppressLabel:'Подавляющий огонь',suppressDone:'Подавление {total}. Все в 25 м вне укрытия бросают WILL + Концентрация + 1d10; у кого меньше {total}, следующим движением уходят в укрытие.',crit:'критическое ранение: +5 урона напрямую по HP цели',soloInvalid:'Проверьте ранг и распределение очков Solo либо отключите автоматизацию.',unarmed:'Без оружия',brawl:'Рукопашный бой',martial:'Боевые искусства',attackBtn:'Атака',damageBtn:'Урон',halfSp:'броня цели считается вдвое меньше',brawlLabel:'Рукопашный бой: урон',martialLabel:'Боевые искусства: урон',bodyNote:'Урон по BODY {body}',cyberarm:'с киберрукой не меньше 2d6',grenade:'Граната',throwRange:'Дистанция',throwBtn:'Бросить',throwLabel:'Бросок гранаты',throwNone:'Гранаты этого вида закончились.',throwLeft:'осталось {n}',meters:'м',loaded:'В магазине',hitGroup:'Куда попали',hitOptions:'Особенности этого попадания',
  deadFix:'Исправить запись',unconscious:'Без сознания',unconsciousGo:'К медицине',mortal:'При смерти',mortalText:'−4 ко всем проверкам · MOVE −6 · Death Save в начале каждого хода',serious:'Тяжело ранен',seriousText:'−2 ко всем проверкам',seriousOff:'штраф снят действующим эффектом',deathSave:'Спасбросок от смерти',
  deathBase:'Базовый штраф Death Save: {from} → {to} (критические ранения)'},
 en:{dead:'The character is dead',hitTitle:'A hit on me',hitRaw:'Damage',hitBody:'Body',hitHead:'Head',hitDirect:'Past armor',hitMelee:'Melee weapon: SP ÷ 2',hitAp:'Armor-piercing',hitCrit:'Crit. Injury +5',hitApply:'Apply',hitFull:'Full calculation',hitEmpty:'Enter the damage from the attacker’s dice.',hitManual:'This case is worked out in the full calculation.',hitBlocked:'The armor stopped the hit',hitToHp:'To HP',hitHeadX:'head ×{n}',hitInjury:'injury +{n}',hitDeath:'Death Save penalty {from} → {to}',hitForced:'mortally wounded: every hit gives a Critical Injury',hitUnstable:'stabilization is lost',hitDone:'Recorded',hitUndo:'Undo',hitUndone:'The hit was undone.',hitUndoStale:'The sheet has changed since: the hit cannot be undone.',hitRollInjury:'Roll the Critical Injury',aim:'Aimed',aimNo:'no',aim_head:'head',aim_item:'held item',aim_leg:'leg',aimTitle:'Aimed Shot: −8 to the check, one attack for the Action. A burst cannot be aimed.',aimLabel:'aimed',aimHint_head:'Aimed at the head: damage that gets through armor is doubled.',aimHint_item:'Aimed at a held item: if damage gets through armor, the target drops it.',aimHint_leg:'Aimed at a leg: if damage gets through armor, the target suffers the Broken Leg Critical Injury.',burst:'Burst −10',burstTitle:'Autofire: REF + Autofire + 1d10, spends 10 rounds. The DV comes from the chosen range.',burstLabel:'Burst',burstShort:'burst',burstNeed:'A burst needs 10 rounds in the magazine.',burstFar:'Autofire cannot reach this range: it works up to 100 m.',burstHit:'Burst {total} against DV {dv}: hit, damage 2d6 × {mult}.',burstMiss:'Burst {total} against DV {dv}: miss.',burstOpen:'Burst {total}. Compare with the range DV or the target’s Evasion: damage 2d6 × the margin, ×{max} at most.',burstDamage:'Burst damage',burstTable:'by margin',suppress:'Suppress −10',suppressTitle:'Suppressive Fire: REF + Autofire + 1d10, spends 10 rounds.',suppressLabel:'Suppressive Fire',suppressDone:'Suppression {total}. Everyone within 25 m out of cover rolls WILL + Concentration + 1d10; anyone below {total} uses their next Move to get into cover.',crit:'Critical Injury: +5 damage directly to the target’s HP',soloInvalid:'Check Solo rank and point allocation or disable automation.',unarmed:'Unarmed',brawl:'Brawling',martial:'Martial Arts',attackBtn:'Attack',damageBtn:'Damage',halfSp:'the target’s armor counts as half',brawlLabel:'Brawling damage',martialLabel:'Martial Arts damage',bodyNote:'Damage by BODY {body}',cyberarm:'2d6 at least with a cyberarm',grenade:'Grenade',throwRange:'Range',throwBtn:'Throw',throwLabel:'Grenade throw',throwNone:'No grenades of this kind left.',throwLeft:'{n} left',meters:'m',loaded:'Loaded',hitGroup:'Where it hit',hitOptions:'What is special about this hit',
  deadFix:'Correct the record',unconscious:'Unconscious',unconsciousGo:'To Medicine',mortal:'Mortally wounded',mortalText:'−4 to all checks · MOVE −6 · Death Save at the start of each turn',serious:'Seriously wounded',seriousText:'−2 to all checks',seriousOff:'the penalty is removed by an effect in force',deathSave:'Death Save',
  deathBase:'Base Death Save Penalty: {from} → {to} (Critical Injuries)'},
};
const tr=(l,k,vars)=>{let s=(T[l==='en'?'en':'ru'][k]??k);if(vars)for(const [a,b] of Object.entries(vars))s=s.split('{'+a+'}').join(String(b));return s};

/* ---------- 3. Wounds, death and the Death Save ---------- */
function hpMax(c){const s=c?.stats||{};return 10+5*Math.ceil((num(s.BODY)+num(s.WILL))/2)}
// What the player must know right now, the worst first: dead, unconscious, mortally or seriously wounded.
function condition(c){
 if(!c)return {state:''};
 const x=c.extra&&typeof c.extra==='object'?c.extra:{};
 if(x.deathRecord?.version===1&&x.deathRecord.dead===true)return {state:'dead',penalty:0};
 const hp=num(c.hp),out=hp<1?{state:'mortal',penalty:-4}:hp<Math.ceil(hpMax(c)/2)?{state:'serious',penalty:-2}:{state:'',penalty:0};
 if(out.state==='serious'){let off=false;try{off=!!global.Effects?.ignoresSerious?.(c)}catch{}if(off){out.penalty=0;out.ignored=true}}
 if(x.medical?.version===1&&x.medical.unconscious===true)out.unconscious=true;
 return out;
}
/* Critical Injuries raise the Base Death Save Penalty (p. 187 and the injury tables). The sheet used to offer a button on
   another tab; now the number follows the injuries by itself. `deathInjuryBase` remembers how much of the base came from
   injuries, so healing one takes its part away again. A sheet where the player had already raised the base by hand
   (old saves) is not raised twice. */
function deathPlan(c,need){
 const x=c?.extra&&typeof c.extra==='object'&&!Array.isArray(c.extra)?c.extra:null;
 const base=int(x?.baseDeathPenalty,0,100),penalty=Math.max(base,int(x?.deathPenalty,0,100));
 need=int(need,0,100);
 const known=!!x&&x.deathInjuryBase!==undefined,counted=known?int(x.deathInjuryBase,0,100):Math.min(base,need);
 const nextBase=int(base+need-counted,0,100),nextPenalty=int(penalty+nextBase-base,nextBase,100);
 return {ok:!!x,base,penalty,need,nextBase,nextPenalty,changed:!!x&&(nextBase!==base||nextPenalty!==penalty||(known?int(x.deathInjuryBase,0,100)!==need:need>0))};
}
function deathNeed(c){try{return int(global.Effects?.collect?.(c)?.death,0,100)}catch{return 0}}
// Brings the stored penalty in line with the injuries. Returns what changed; the caller saves.
function syncDeathBase(c){
 const p=deathPlan(c,deathNeed(c));if(!p.ok||!p.changed)return {...p,changed:false};
 c.extra.baseDeathPenalty=p.nextBase;c.extra.deathPenalty=p.nextPenalty;c.extra.deathInjuryBase=p.need;
 return p;
}
function syncDeathBaseAll(list,l){
 const notes=[];
 for(const c of Array.isArray(list)?list:[]){const p=syncDeathBase(c);if(p.changed&&p.nextBase!==p.base)notes.push(tr(l||lang(),'deathBase',{from:p.base,to:p.nextBase}))}
 return notes.join('\n');
}
// The number a Death Save must stay under: BODY minus the penalty the next save will use.
function deathTarget(c){return Math.max(0,int(c?.stats?.BODY,0,99)-deathPlan(c,deathNeed(c)).nextPenalty)}
// The line under the HP chip. A phone has no room for the wound label inside the chip, and death was shown on another tab only.
function statusLine(c,l){
 l=l||lang();const s=condition(c);if(!s.state&&!s.unconscious)return '';
 const row=(state,title,text,button)=>`<div class="pc-status" data-pc-state="${state}" role="status"><b>${esc(title)}</b>${text?`<span>${esc(text)}</span>`:''}${button||''}</div>`;
 if(s.state==='dead')return row('dead',tr(l,'dead'),'',`<button type="button" class="btn ghost small" data-pc-go="death-fix">${esc(tr(l,'deadFix'))}</button>`);
 let out='';
 if(s.unconscious)out+=row('unconscious',tr(l,'unconscious'),'',`<button type="button" class="btn ghost small" data-pc-go="medical">${esc(tr(l,'unconsciousGo'))} →</button>`);
 if(s.state==='mortal')out+=row('mortal',tr(l,'mortal'),tr(l,'mortalText'),`<button type="button" class="btn small" data-proxy-roll='[data-cx-action="death-save"]'>${esc(tr(l,'deathSave'))} &lt; ${deathTarget(c)}</button>`);
 else if(s.state==='serious')out+=row('serious',tr(l,'serious'),s.ignored?tr(l,'seriousOff'):tr(l,'seriousText'));
 return out;
}
// «Исправить запись»: the block is on another tab, inside a closed <details>.
function go(kind){
 const doc=global.document;
 if(kind==='medical'){global.App?.setView?.('medical');return}
 if(kind==='death-fix'){
  const box=doc.querySelector('.sheet-layout [data-cx-death-adjust]'),card=box?.closest('[id]');
  if(!box)return;
  const tab=card&&global.SheetTabs?.owner?.(card.id);if(tab&&tab!==global.SheetTabs?.shown?.())global.SheetTabs.select(tab,{scroll:false});
  global.DossierPanel?.reveal?.(box);box.open=true;box.scrollIntoView?.({block:'center'});
 }
}

/* ---------- 4. A hit taken: damage, where, apply ----------
   The full «Полученный урон» form stays for the rare cases (aimed at a leg, Damage Deflection, rubber bullets). This is the
   everyday one: the number from the attacker's dice, body or head, and the switches that belong to one hit only, so they
   go back to «off» after it. The arithmetic is DamageApply.quote, the same as in the full form. */
const hit={raw:'',location:'body',melee:false,ap:false,crit:false,done:null};
function hitArgs(c,s){
 const direct=s.location==='direct';
 return {type:direct?'direct':s.melee?'melee':'standard',location:direct?'body':s.location==='head'?'head':'body',raw:/^\d{1,4}$/.test(String(s.raw).trim())?Number(String(s.raw).trim()):NaN,critical:s.crit===true,ammo:!direct&&!s.melee&&s.ap?'ap':'standard',...(num(c?.hp)<1?{source:'attack'}:{})};
}
function hitQuote(c,s){
 const args=hitArgs(c,s);if(!Number.isInteger(args.raw)||args.raw<1||args.raw>1000)return {ok:false,reason:'empty'};
 let q=null,copy=null;try{q=global.DamageApply?.quote?.(c,args)||null;copy=q?global.DamageApply.armorClone(c,q):null}catch{}
 return q&&copy?{ok:true,q,copy}:{ok:false,reason:'manual'};
}
function hitText(q,l){
 const parts=[];
 if(q.damage<=0&&q.type!=='direct')parts.push(tr(l,'hitBlocked'));else parts.push(`${tr(l,'hitToHp')}: ${q.damage}`);
 parts.push(`HP ${q.hp} → ${q.hpAfter}`);
 if(q.type!=='direct')parts.push(`SP ${q.sp} → ${q.spAfter}`);
 if(q.headMultiplier>1&&q.penetrating>0)parts.push(tr(l,'hitHeadX',{n:q.headMultiplier}));
 if(q.bonus>0)parts.push(tr(l,'hitInjury',{n:q.bonus}));
 if(q.mortalAttack)parts.push(tr(l,'hitDeath',{from:q.penaltyBefore,to:q.penaltyAfter}));
 if(q.forcedCritical)parts.push(tr(l,'hitForced'));
 if(q.resetStabilization)parts.push(tr(l,'hitUnstable'));
 return parts.join(' · ');
}
const copyOf=v=>v===undefined?undefined:JSON.parse(JSON.stringify(v));
// Applies the hit to the character and returns what is needed to take it back.
function hitApply(c,s){
 const r=hitQuote(c,s);if(!r.ok)return r;
 const q=r.q,copy=r.copy,hadExtra=c.extra!==undefined;
 const before={hp:c.hp,head:c.head,bodyArmor:c.bodyArmor,hadExtra,deathPenalty:copyOf(c.extra?.deathPenalty),medical:copyOf(c.extra?.medical),equipment:copyOf(c.extra?.equipment)};
 c.hp=q.hpAfter;
 if(q.mortalAttack){if(!c.extra)c.extra={};c.extra.deathPenalty=q.penaltyAfter}
 if(q.resetStabilization)c.extra.medical={...c.extra.medical,stabilized:false};
 if(q.spAfter!==q.sp&&q.type!=='direct'){
  if(q.location==='head')c.head=copy.head;else c.bodyArmor=copy.bodyArmor;
  if(copy.extra?.equipment!==undefined&&c.extra)c.extra.equipment=copy.extra.equipment;
 }
 const after={hp:c.hp,head:c.head,bodyArmor:c.bodyArmor,deathPenalty:copyOf(c.extra?.deathPenalty)};
 return {ok:true,q,undo:{id:c.id,before,after},injury:q.bonus>0||q.forcedCritical?(q.location==='head'?'head':'body'):''};
}
// Takes a hit back, but only while nothing it touched has changed since.
function hitUndo(c,undo){
 if(!c||!undo||c.id!==undo.id)return false;
 const a=undo.after,b=undo.before;
 if(c.hp!==a.hp||c.head!==a.head||c.bodyArmor!==a.bodyArmor||JSON.stringify(c.extra?.deathPenalty)!==JSON.stringify(a.deathPenalty))return false;
 c.hp=b.hp;c.head=b.head;c.bodyArmor=b.bodyArmor;
 if(!b.hadExtra){delete c.extra;return true}
 for(const k of ['deathPenalty','medical','equipment']){if(b[k]===undefined)delete c.extra[k];else c.extra[k]=b[k]}
 return true;
}
function hitForm(c,l){
 l=l||lang();if(!c||!global.DamageApply?.quote)return null;
 const radio=(v,label)=>`<button type="button" role="radio" data-pc-hit="location" data-value="${v}" aria-checked="${hit.location===v}">${esc(label)}</button>`;
 const check=(k,label)=>`<button type="button" role="checkbox" data-pc-hit="${k}" aria-checked="${hit[k]===true}">${esc(label)}</button>`;
 return `<div class="pc-hit" data-pc-hit-root><div class="hud-hp-row"><label>${esc(tr(l,'hitRaw'))}<input type="number" inputmode="numeric" min="1" max="1000" step="1" data-pc-hit="raw" data-hp-amount placeholder="0" value="${esc(hit.raw)}"></label><div class="hud-hp-reasons pc-hit-set" role="radiogroup" aria-label="${esc(tr(l,'hitGroup'))}">${radio('body',`${tr(l,'hitBody')} · SP ${int(c.bodyArmor,0,1000)}`)}${radio('head',`${tr(l,'hitHead')} · SP ${int(c.head,0,1000)}`)}${radio('direct',tr(l,'hitDirect'))}</div></div><div class="hud-hp-row hud-hp-reasons pc-hit-set" role="group" aria-label="${esc(tr(l,'hitOptions'))}">${check('melee',tr(l,'hitMelee'))}${check('ap',tr(l,'hitAp'))}${check('crit',tr(l,'hitCrit'))}</div><p class="pc-hit-preview" data-pc-hit-preview aria-live="polite"></p><div class="hud-hp-row"><button type="button" class="btn small primary" data-pc-hit="apply">${esc(tr(l,'hitApply'))}</button><button type="button" class="btn ghost small" data-hud-jump="sheet-damage">${esc(tr(l,'hitFull'))}</button></div><div class="pc-hit-done" data-pc-hit-done role="status"></div></div>`;
}
// Brings the drawn form in line with the state without touching the number field the player is typing in.
function hitRefresh(){
 const doc=global.document,root=doc?.querySelector?.('[data-pc-hit-root]');if(!root)return;
 const c=global.App?.active?.(),l=lang();if(!c)return;
 const direct=hit.location==='direct';
 for(const b of root.querySelectorAll('[data-pc-hit="location"]')){
  b.setAttribute('aria-checked',String(b.dataset.value===hit.location));
  if(b.dataset.value==='body')b.textContent=`${tr(l,'hitBody')} · SP ${int(c.bodyArmor,0,1000)}`;
  if(b.dataset.value==='head')b.textContent=`${tr(l,'hitHead')} · SP ${int(c.head,0,1000)}`;
 }
 for(const k of ['melee','ap','crit']){const b=root.querySelector(`[data-pc-hit="${k}"]`);if(!b)continue;b.setAttribute('aria-checked',String(hit[k]===true));b.disabled=(k==='melee'&&direct)||(k==='ap'&&(direct||hit.melee))}
 const r=hitQuote(c,hit),preview=root.querySelector('[data-pc-hit-preview]'),apply=root.querySelector('[data-pc-hit="apply"]');
 if(preview)preview.textContent=r.ok?hitText(r.q,l):tr(l,r.reason==='manual'?'hitManual':'hitEmpty');
 if(apply)apply.disabled=!r.ok;
 const done=root.querySelector('[data-pc-hit-done]');
 if(done){
  const d=hit.done&&hit.done.undo.id===c.id?hit.done:null,html=d?`<span>${esc(tr(l,'hitDone'))}: ${esc(d.text)}</span><button type="button" class="btn ghost small" data-pc-hit="undo">${esc(tr(l,'hitUndo'))}</button>${d.injury?`<button type="button" class="btn small" data-pc-hit="injury">${esc(tr(l,'hitRollInjury'))}</button>`:''}`:'';
  if(done.dataset.shown!==html){done.innerHTML=html;done.dataset.shown=html}
 }
}
function hitClick(b){
 const A=global.App,c=A?.active?.(),l=lang(),kind=b.dataset.pcHit;if(!c)return;
 if(kind==='location'){hit.location=['body','head','direct'].includes(b.dataset.value)?b.dataset.value:'body';if(hit.location==='direct'){hit.melee=false;hit.ap=false}}
 else if(kind==='melee'){hit.melee=!hit.melee;if(hit.melee)hit.ap=false}
 else if(kind==='ap'||kind==='crit')hit[kind]=!hit[kind];
 else if(kind==='apply'){
  const r=hitApply(c,hit);
  if(r.ok){
   hit.done={undo:r.undo,text:hitText(r.q,l),injury:r.injury};
   // What belongs to one hit goes back to «off»; the next hit starts clean.
   hit.raw='';hit.melee=false;hit.ap=false;hit.crit=false;hit.location='body';
   const field=b.closest('[data-pc-hit-root]')?.querySelector('[data-pc-hit="raw"]');if(field)field.value='';
   const note=syncDeathBaseAll([c],l);A.save?.();A.render?.();A.notify?.([`${tr(l,'hitDone')}: ${hit.done.text}`,note].filter(Boolean).join('\n'));
  }
 }
 else if(kind==='undo'){
  const d=hit.done;hit.done=null;
  if(d&&hitUndo(c,d.undo)){A.save?.();A.render?.();A.notify?.(tr(l,'hitUndone'))}else A.notify?.(tr(l,'hitUndoStale'));
 }
 else if(kind==='injury'){
  const where=hit.done?.injury||'body';if(hit.done)hit.done.injury='';
  rollInjury(where);
 }
 hitRefresh();
}
// The injury tool is on the sheet already: choose the table, bring it into view and roll.
function rollInjury(where){
 const doc=global.document,find=()=>doc.querySelector('.sheet-layout [data-ci-root]');
 let root=find();if(!root)return;
 // The HP panel is in the dock and would cover the tool on a phone.
 doc.querySelector('[data-hud-hp][aria-expanded="true"]')?.click();
 const card=root.closest('[id]')||root,tab=card.id&&global.SheetTabs?.owner?.(card.id);
 if(tab&&tab!==global.SheetTabs?.shown?.())global.SheetTabs.select(tab,{scroll:false});
 global.DossierPanel?.reveal?.(root);
 const select=root.querySelector('[data-ci-field="location"]');
 if(select&&select.value!==where&&typeof global.Event==='function'){select.value=where;select.dispatchEvent(new global.Event('change',{bubbles:true}))}
 setTimeout(()=>{root=find();if(!root)return;const roll=root.querySelector('[data-ci-action="roll-injury"]');(roll||root).scrollIntoView?.({block:'center'});roll?.click()},60);
}

/* ---------- 5. The weapon card ---------- */
// The kind of rounds in the magazine (known from the reload receipt).
function loadedLine(w,l){let n='';try{n=global.ReloadTools?.loadedName?.(w,l)||''}catch{}return n?`<span class="pc-loaded">${esc(tr(l,'loaded'))} <b>${esc(n)}</b></span>`:''}

/* ---------- 6. Attacks of my character that are more than one shot ----------
   Aimed shot, burst, suppressive fire, unarmed damage and a thrown grenade used to be calculators on another page that
   knew nothing about the character. Here they are rolls of the sheet: the same STAT after armor, wounds, effects, the
   modifier and LUCK set for the next roll, and the magazine or the inventory pays for them. */
const sign=n=>(n<0?'−':'+')+Math.abs(n);
const d6=()=>1+Math.floor(Math.random()*6);
const key=(c,w)=>`${c?.id}|${w?.id}`;
const aims=new Map(),last=new Map(),AIMS=['head','item','leg'],MULT={smg:3,assault:4};
const weaponOf=(c,id)=>(Array.isArray(c?.extra?.weapons)?c.extra.weapons:[]).find(z=>z&&typeof z==='object'&&z.id===id)||null;
function aimSelect(c,w,l){
 if(!w?.id)return '';const cur=aims.get(key(c,w))||'';
 return `<label class="cx-range pc-aim" title="${esc(tr(l,'aimTitle'))}">${esc(tr(l,'aim'))}<select data-pc-aim="${esc(w.id)}"><option value="">${esc(tr(l,'aimNo'))}</option>${AIMS.map(a=>`<option value="${a}"${cur===a?' selected':''}>${esc(tr(l,'aim_'+a))} · −8</option>`).join('')}</select></label>`;
}
// Called by the sheet when an attack with this weapon is really rolled: the choice is used once.
function takeAim(c,w,l){
 const k=key(c,w),a=aims.get(k);aims.delete(k);last.delete(k);
 if(!AIMS.includes(a))return null;
 last.set(k,{kind:'aim',where:a});
 return {mod:-8,where:a,label:` · ${tr(l,'aimLabel')} ${tr(l,'aim_'+a)} (−8)`};
}
const autoType=w=>{let t='';try{t=global.CharacterExtra?.rangeType?.(w)||''}catch{}return t};
const canBurst=w=>{try{return !!global.WeaponAmmo?.canAutofire?.(w)&&!!global.WeaponAmmo?.tracks?.(w)}catch{return false}};
// Autofire has a range table of its own (p. 173); null where a burst cannot reach.
function autoDV(w,band){const v=global.CombatTools?.RANGE?.[autoType(w)]?.auto?.[band];return Number.isSafeInteger(v)?v:null}
function rangeNote(w,band,l){return canBurst(w)&&global.CombatTools?.RANGE?.[autoType(w)]?.auto?` · ${tr(l,'burstShort')} ${autoDV(w,band)===null?'—':'DV '+autoDV(w,band)}`:''}
// Burst damage: 2d6 times the margin over the DV, up to ×3 (SMG) or ×4 (assault rifle).
function burstResult(total,dv,max){
 if(!Number.isSafeInteger(dv)||dv<=0)return {hit:null,mult:0,max};
 const margin=total-dv;return margin>0?{hit:true,mult:Math.min(max,margin),max}:{hit:false,mult:0,max};
}
function burstDamage(dice,mult,max,l){
 const sum=dice[0]+dice[1],crit=dice[0]===6&&dice[1]===6?` / ${tr(l,'crit')}`:'';
 if(mult>0)return {total:sum*mult,detail:`(${dice[0]} + ${dice[1]}) × ${mult} = ${sum*mult}${crit}`};
 const table=[];for(let m=1;m<=max;m++)table.push(`×${m} = ${sum*m}`);
 return {total:sum,detail:`${dice[0]} + ${dice[1]} = ${sum}; ${tr(l,'burstTable')}: ${table.join(' · ')}${crit}`};
}
// Brawling and Martial Arts damage by BODY (p. 176): 1d6 up to 4, 2d6 for 5–6, 3d6 for 7–10, 4d6 from 11; a cyberarm gives 2d6 at least.
function unarmedDice(body,cyberarm){body=int(body,0,100);return Math.max(body<=4?1:body<=6?2:body<=10?3:4,cyberarm?2:1)}
function diceText(dice,l){const total=dice.reduce((a,b)=>a+b,0);return {total,detail:`${dice.join(' + ')} = ${total}${dice.filter(x=>x===6).length>=2?` / ${tr(l,'crit')}`:''}`}}
const hasCyberarm=c=>(Array.isArray(c?.extra?.items)?c.extra.items:[]).some(i=>i&&i.catalogId==='cyberware-cyberarm'&&num(i.quantity)>0);
const grenades=c=>(Array.isArray(c?.extra?.items)?c.extra.items:[]).filter(i=>i&&typeof i==='object'&&i.ammoType==='grenade'&&typeof i.id==='string'&&Number.isSafeInteger(i.quantity)&&i.quantity>0);
const THROW=[[0,6,16],[7,12,15],[13,25,15]];
function soloBonus(c){let s=null;try{s=global.RoleTools?.soloRollBonuses?.(c)||null}catch{}if(!s)return {ok:true,precision:0,fumble:false};if(!s.ok)return {ok:false};return {ok:true,precision:s.enabled?int(s.precision,0,10):0,fumble:s.enabled&&s.fumble===true}}
const statNow=(c,stat)=>{let v=null;try{v=global.DossierPanel?.statBase?.(c,stat)?.value}catch{}return Number.isFinite(Number(v))?Number(v):num(c?.stats?.[stat])};
/* One check through the sheet's own numbers. App.checkBonus already holds the STAT after armor, wounds, effects, the modifier
   and the LUCK set for the next roll; like every sheet roll this one then uses them up. */
function sheetCheck(c,o){
 const A=global.App;if(!A?.check||!A?.checkBonus)return null;
 let x=null;try{x=global.CharacterExtra?.init?.(c)||null}catch{}if(!x)return null;
 const level=int(o.level,0,10),bonus=num(A.checkBonus(c,o.stat,level,o.kind||'',o.skillKey||'')),base=statNow(c,o.stat);
 const luck=Math.min(int(x.luck,0,20),int(x.luckUse,0,20));x.luck=int(x.luck,0,20)-luck;x.luckUse=0;if(x.modifierHold!==true)x.modifier=0;
 const precision=o.solo?.precision||0,extra=int(o.extra,-100,100)+precision;
 const label=o.label+(precision?` · Precision Attack +${precision}`:'')+(luck?` · LUCK +${luck}`:'');
 return A.check(base,label,{wounds:false,dv:o.dv||0,skill:level,mod:bonus-base-level+extra,ignoreFumble:o.solo?.fumble===true});
}
function weaponModes(c,w,l){
 if(!w?.id||!c)return '';
 const r=last.get(key(c,w)),id=esc(w.id),auto=canBurst(w);let buttons='',result='';
 if(auto){
  let bonus=0;try{bonus=num(global.App?.checkBonus?.(c,'REF',int(c.skills?.Autofire,0,10),'ranged','Autofire'))+int(w.modifier,-100,100)+(soloBonus(c).precision||0)}catch{}
  const off=int(w.ammo,0,9999)<10?' disabled':'';
  buttons=`<button type="button" class="cx-button" data-pc-mode="burst" data-pc-weapon="${id}" title="${esc(tr(l,'burstTitle'))}"${off}>⬡ ${esc(tr(l,'burst'))} <b>${sign(bonus)}</b></button><button type="button" class="cx-button" data-pc-mode="suppress" data-pc-weapon="${id}" title="${esc(tr(l,'suppressTitle'))}"${off}>⬡ ${esc(tr(l,'suppress'))}</button>`;
 }
 if(r?.kind==='aim')result=`<p class="pc-mode-result" role="status">${esc(tr(l,'aimHint_'+r.where))}</p>`;
 else if(r?.kind==='suppress')result=`<p class="pc-mode-result" role="status">${esc(tr(l,'suppressDone',{total:r.total}))}</p>`;
 else if(r?.kind==='burst')result=`<p class="pc-mode-result" role="status">${esc(tr(l,r.hit===null?'burstOpen':r.hit?'burstHit':'burstMiss',r))}</p>${r.hit===false?'':`<button type="button" class="cx-button" data-pc-mode="burst-damage" data-pc-weapon="${id}">⬡ ${esc(tr(l,'burstDamage'))} 2d6${r.mult?' × '+r.mult:''}</button>`}`;
 return buttons||result?`<div class="pc-modes">${buttons?`<div class="cx-entry-actions">${buttons}</div>`:''}${result}</div>`:'';
}
function unarmed(c,l){
 if(!c)return '';
 const A=global.App,sk=c.skills||{},body=int(c.stats?.BODY,0,100),n=unarmedDice(body,hasCyberarm(c)),bonus=(stat,skill,kind)=>{try{return sign(num(A?.checkBonus?.(c,stat,int(sk[skill],0,10),kind,skill)))}catch{return ''}};
 const proxy=(skill,label)=>`<button type="button" class="cx-button" data-proxy-roll='[data-action="skill-roll"][data-skill="${skill}"]'>⬡ ${esc(label)} <b>${bonus('DEX',skill,'melee')}</b></button>`;
 const martial=int(sk['Martial Arts'],0,10)>0,list=grenades(c);
 let out=`<div class="cx-entry pc-unarmed" id="pc-unarmed"><div class="cx-entry-heading"><strong>${esc(tr(l,'unarmed'))}</strong></div><p class="cx-weapon-line"><span>${esc(tr(l,'bodyNote',{body}))} <b>${n}d6</b></span>${hasCyberarm(c)?'':`<span>${esc(tr(l,'cyberarm'))}</span>`}</p><div class="cx-entry-actions">${proxy('Brawling',tr(l,'brawl'))}<button type="button" class="cx-button" data-pc-mode="brawl-damage">⬡ ${esc(tr(l,'damageBtn'))} ${n}d6</button></div>`;
 if(martial)out+=`<div class="cx-entry-actions">${proxy('Martial Arts',tr(l,'martial'))}<button type="button" class="cx-button" data-pc-mode="martial-damage" title="${esc(tr(l,'halfSp'))}">⬡ ${esc(tr(l,'damageBtn'))} ${n}d6 · SP ÷ 2</button></div>`;
 if(list.length)out+=`<div class="cx-entry-actions"><label class="cx-range">${esc(tr(l,'grenade'))}<select data-pc-grenade>${list.map(g=>`<option value="${esc(g.id)}">${esc(g.name||tr(l,'grenade'))} · ${g.quantity}</option>`).join('')}</select></label><label class="cx-range">${esc(tr(l,'throwRange'))}<select data-pc-throw-range><option value="">—</option>${THROW.map(([a,b,dv],i)=>`<option value="${i}">${a}–${b} ${esc(tr(l,'meters'))} · DV ${dv}</option>`).join('')}</select></label><button type="button" class="cx-button" data-pc-mode="throw">⬡ ${esc(tr(l,'throwBtn'))} <b>${bonus('DEX','Athletics','ranged')}</b></button></div>`;
 return out+'</div>';
}
function show(label,text,total,dice){const A=global.App;A?.report?.(label,text,total,dice.map(v=>({v,s:6})),true);A?.notify?.(`${label}: ${text}`)}
function modeClick(b){
 const A=global.App,c=A?.active?.(),l=lang(),mode=b.dataset.pcMode;if(!c||!A)return;
 if(mode==='brawl-damage'||mode==='martial-damage'){
  const dice=Array.from({length:unarmedDice(c.stats?.BODY,hasCyberarm(c))},d6),r=diceText(dice,l);
  show(tr(l,mode==='brawl-damage'?'brawlLabel':'martialLabel'),r.detail+(mode==='martial-damage'?` · ${tr(l,'halfSp')}`:''),r.total,dice);return;
 }
 if(mode==='throw'){
  const box=b.closest('.pc-unarmed'),g=grenades(c).find(i=>i.id===box?.querySelector('[data-pc-grenade]')?.value),band=box?.querySelector('[data-pc-throw-range]')?.value;
  if(!g){A.notify?.(tr(l,'throwNone'));return}
  const dv=band!==''&&THROW[Number(band)]?THROW[Number(band)][2]:0;
  const out=sheetCheck(c,{stat:'DEX',level:int(c.skills?.Athletics,0,10),kind:'ranged',skillKey:'Athletics',label:`${tr(l,'throwLabel')}: ${g.name||tr(l,'grenade')} (${tr(l,'throwLeft',{n:g.quantity-1})})`,dv});
  if(!out)return;g.quantity-=1;A.save?.();A.render?.();return;
 }
 const w=weaponOf(c,b.dataset.pcWeapon);if(!w)return;const k=key(c,w),max=MULT[autoType(w)]||3;
 if(mode==='burst'||mode==='suppress'){
  if(!canBurst(w)||int(w.ammo,0,9999)<10){A.notify?.(tr(l,'burstNeed'));return}
  let dv=0;
  if(mode==='burst'){const pick=b.closest('.cx-weapon')?.querySelector('[data-cx-range]')?.value;if(pick!==undefined&&pick!==''){dv=autoDV(w,Number(pick));if(dv===null){A.notify?.(tr(l,'burstFar'));return}}}
  const solo=mode==='burst'?soloBonus(c):null;if(solo&&!solo.ok){A.notify?.(tr(l,'soloInvalid'));return}
  aims.delete(k);
  const out=sheetCheck(c,{stat:'REF',level:int(c.skills?.Autofire,0,10),kind:'ranged',skillKey:'Autofire',label:`${tr(l,mode==='burst'?'burstLabel':'suppressLabel')}: ${w.name||''}`,dv,extra:w.modifier,solo});
  if(!out)return;
  global.WeaponAmmo.spend(w,10);
  last.set(k,mode==='burst'?{kind:'burst',total:out.total,dv,...burstResult(out.total,dv,max)}:{kind:'suppress',total:out.total});
  A.save?.();A.render?.();return;
 }
 if(mode==='burst-damage'){
  const r=last.get(k);if(r?.kind!=='burst'||r.hit===false)return;
  const dice=[d6(),d6()],res=burstDamage(dice,r.mult,r.max,l);
  show(`${tr(l,'burstDamage')}: ${w.name||''}`,res.detail,res.total,dice);
 }
}

const API={loadedLine,aimSelect,takeAim,autoDV,rangeNote,burstResult,burstDamage,unarmedDice,weaponModes,unarmed,sheetCheck,markOf,scrollFix,keepPlace,condition,deathPlan,syncDeathBase,syncDeathBaseAll,deathTarget,statusLine,hitArgs,hitQuote,hitText,hitApply,hitUndo,hitForm,hitState:()=>hit,tr};
try{
 const doc=global.document;
 if(doc?.addEventListener)for(const type of ['pointerdown','click','change','input'])doc.addEventListener(type,remember,true);
 doc?.addEventListener?.('click',e=>{const b=e.target?.closest?.('[data-pc-go]');if(b){go(b.dataset.pcGo);return}const h=e.target?.closest?.('button[data-pc-hit]');if(h&&!h.disabled)hitClick(h)});
 doc?.addEventListener?.('click',e=>{const m=e.target?.closest?.('button[data-pc-mode]');if(m&&!m.disabled)modeClick(m)});
 doc?.addEventListener?.('change',e=>{const s=e.target;if(s?.dataset?.pcAim===undefined)return;const c=global.App?.active?.(),w=weaponOf(c,s.dataset.pcAim);if(!w)return;if(AIMS.includes(s.value))aims.set(key(c,w),s.value);else aims.delete(key(c,w))});
 doc?.addEventListener?.('input',e=>{if(e.target?.dataset?.pcHit==='raw'){hit.raw=String(e.target.value||'').slice(0,5);hitRefresh()}});
 // The form lives in the HP panel, which the sheet draws again on its own schedule.
 let timer=0;for(const type of ['click','change','input'])doc?.addEventListener?.(type,()=>{clearTimeout(timer);timer=setTimeout(hitRefresh,30)});
}catch{}
global.PlayCombat=API;
})(window);
