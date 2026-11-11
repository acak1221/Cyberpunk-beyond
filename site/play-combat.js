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
 ru:{dead:'Персонаж мёртв',deadFix:'Исправить запись',unconscious:'Без сознания',unconsciousGo:'К медицине',mortal:'При смерти',mortalText:'−4 ко всем проверкам · MOVE −6 · Death Save в начале каждого хода',serious:'Тяжело ранен',seriousText:'−2 ко всем проверкам',seriousOff:'штраф снят действующим эффектом',deathSave:'Спасбросок от смерти',
  deathBase:'Базовый штраф Death Save: {from} → {to} (критические ранения)'},
 en:{dead:'The character is dead',deadFix:'Correct the record',unconscious:'Unconscious',unconsciousGo:'To Medicine',mortal:'Mortally wounded',mortalText:'−4 to all checks · MOVE −6 · Death Save at the start of each turn',serious:'Seriously wounded',seriousText:'−2 to all checks',seriousOff:'the penalty is removed by an effect in force',deathSave:'Death Save',
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

const API={markOf,scrollFix,keepPlace,condition,deathPlan,syncDeathBase,syncDeathBaseAll,deathTarget,statusLine,tr};
try{
 const doc=global.document;
 if(doc?.addEventListener)for(const type of ['pointerdown','click','change','input'])doc.addEventListener(type,remember,true);
 doc?.addEventListener?.('click',e=>{const b=e.target?.closest?.('[data-pc-go]');if(b)go(b.dataset.pcGo)});
}catch{}
global.PlayCombat=API;
})(window);
