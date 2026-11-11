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
 ru:{dead:'Персонаж мёртв',hitTitle:'Попадание по мне',hitRaw:'Урон',hitBody:'Тело',hitHead:'Голова',hitDirect:'Мимо брони',hitMelee:'Оружие ближнего боя: SP ÷ 2',hitAp:'Бронебойный',hitCrit:'Крит. ранение +5',hitApply:'Применить',hitFull:'Полный расчёт',hitEmpty:'Введите урон с кубиков атакующего.',hitManual:'Этот случай считается в полном расчёте.',hitBlocked:'Броня остановила удар',hitToHp:'По HP',hitHeadX:'голова ×{n}',hitInjury:'ранение +{n}',hitDeath:'штраф Death Save {from} → {to}',hitForced:'при смерти: каждое попадание даёт критическое ранение',hitUnstable:'стабилизация сброшена',hitDone:'Записано',hitUndo:'Отменить',hitUndone:'Попадание отменено.',hitUndoStale:'Лист уже изменился: отменить попадание нельзя.',hitRollInjury:'Бросить критическое ранение',hitGroup:'Куда попали',hitOptions:'Особенности этого попадания',
  deadFix:'Исправить запись',unconscious:'Без сознания',unconsciousGo:'К медицине',mortal:'При смерти',mortalText:'−4 ко всем проверкам · MOVE −6 · Death Save в начале каждого хода',serious:'Тяжело ранен',seriousText:'−2 ко всем проверкам',seriousOff:'штраф снят действующим эффектом',deathSave:'Спасбросок от смерти',
  deathBase:'Базовый штраф Death Save: {from} → {to} (критические ранения)'},
 en:{dead:'The character is dead',hitTitle:'A hit on me',hitRaw:'Damage',hitBody:'Body',hitHead:'Head',hitDirect:'Past armor',hitMelee:'Melee weapon: SP ÷ 2',hitAp:'Armor-piercing',hitCrit:'Crit. Injury +5',hitApply:'Apply',hitFull:'Full calculation',hitEmpty:'Enter the damage from the attacker’s dice.',hitManual:'This case is worked out in the full calculation.',hitBlocked:'The armor stopped the hit',hitToHp:'To HP',hitHeadX:'head ×{n}',hitInjury:'injury +{n}',hitDeath:'Death Save penalty {from} → {to}',hitForced:'mortally wounded: every hit gives a Critical Injury',hitUnstable:'stabilization is lost',hitDone:'Recorded',hitUndo:'Undo',hitUndone:'The hit was undone.',hitUndoStale:'The sheet has changed since: the hit cannot be undone.',hitRollInjury:'Roll the Critical Injury',hitGroup:'Where it hit',hitOptions:'What is special about this hit',
  deadFix:'Correct the record',unconscious:'Unconscious',unconsciousGo:'To Medicine',mortal:'Mortally wounded',mortalText:'−4 to all checks · MOVE −6 · Death Save at the start of each turn',serious:'Seriously wounded',seriousText:'−2 to all checks',seriousOff:'the penalty is removed by an effect in force',deathSave:'Death Save',
  deathBase:'Base Death Save Penalty: {from} → {to} (Critical Injuries)'},
};
const tr=(l,k,vars)=>{let s=(T[l==='en'?'en':'ru'][k]??k);if(vars)for(const [a,b] of Object.entries(vars))s=s.replace('{'+a+'}',String(b));return s};

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

const API={markOf,scrollFix,keepPlace,condition,deathPlan,syncDeathBase,syncDeathBaseAll,deathTarget,statusLine,hitArgs,hitQuote,hitText,hitApply,hitUndo,hitForm,hitState:()=>hit,tr};
try{
 const doc=global.document;
 if(doc?.addEventListener)for(const type of ['pointerdown','click','change','input'])doc.addEventListener(type,remember,true);
 doc?.addEventListener?.('click',e=>{const b=e.target?.closest?.('[data-pc-go]');if(b){go(b.dataset.pcGo);return}const h=e.target?.closest?.('button[data-pc-hit]');if(h&&!h.disabled)hitClick(h)});
 doc?.addEventListener?.('input',e=>{if(e.target?.dataset?.pcHit==='raw'){hit.raw=String(e.target.value||'').slice(0,5);hitRefresh()}});
 // The form lives in the HP panel, which the sheet draws again on its own schedule.
 let timer=0;for(const type of ['click','change','input'])doc?.addEventListener?.(type,()=>{clearTimeout(timer);timer=setTimeout(hitRefresh,30)});
}catch{}
global.PlayCombat=API;
})(window);
