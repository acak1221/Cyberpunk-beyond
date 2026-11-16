/* Program effects on the NETRUN tab (window.NetrunEffects): what the programs of the deck change in the numbers, written down once.
   The table below holds only numbers that are already in this repo's catalog text (the unit test reads them back from it):
   Speedy Gonzalvez +2 Speed, Armor -4 brain damage, Shield (stops the first non-Black ICE brain-damage effect, then derezzes),
   Flak (ATK of a non-Black ICE attacker program is 0), «-1 NET Action next turn, never below 2» (Wisp, Vrizzbolt),
   and «once per run» for the three defenders. Boosters that add +2 to an ability stay in RolePlay.BOOST.
   What it adds on the tab:
   - «Скорость в сети»: Interface rank + a rezzed Speedy Gonzalvez + the own modifier, one roll on the console;
   - a strip of the effects that change the numbers now, each booster a switch «off for one roll»;
   - «Входящий урон»: damage taken is applied to the sheet with the defenders ticked in advance (Armor, Shield, Flak), consumed
     and visible in the damage line; damage to a program lowers its REZ and may derez or destroy it;
   - the pending «-1 NET Action» marker, applied by «New turn» (RolePlay.turnExtra) and cleared.
   Nothing here is stored outside the sheet except the «off for one roll» switches and the draft of the damage form (memory of the
   page). Own words only. */
(function(global){
'use strict';
const doc=global.document;
const T={
 ru:{
  speed:'Скорость в сети',speedRoll:'Бросок скорости',speedParts:'Interface',speedHint:'Не тратит NET-действие. Бросок: ранг Interface плюс бонус Speedy Gonzalvez и свой модификатор.',
  fx:'Что сейчас меняет числа',offOne:'Выключить на один бросок',offTag:'выкл. на 1 бросок',
  wound:'Штраф от ранений и эффектов листа',own:'Свой модификатор',
  speedy:'Скорость',armor:'−4 к урону мозгу, один раз за забег',shield:'блокирует первый урон мозгу не от Black ICE, затем Derezzed',flak:'ATK атакующих программ не-Black ICE равен 0',
  pending:'−1 NET-действие на следующий ход',pendingHint:'Метка: «Новый ход» применит её и снимет. Не меньше двух действий.',cutNow:n=>`В этом ходу на ${n} NET-действие меньше (не меньше двух).`,
  pendingSet:'Метка поставлена: «Новый ход» отнимет одно NET-действие (не меньше двух).',pendingClear:'Метка снята.',
  dmg:'Входящий урон',dmgLead:'Урон, полученный в сети, ложится на лист. Защитные программы отмечены заранее: снимите отметку, если защита не сработала.',
  amount:'Урон',to:'Куда',toBrain:'В мозг (HP)',toProgram:'В программу (REZ)',src:'Источник',srcProgram:'Программа (не Black ICE)',srcIce:'Black ICE',srcWisp:'Black ICE Wisp',srcVrizz:'Программа Vrizzbolt',
  program:'Какая программа',noProgram:'На деке нет программ с REZ.',destroy:'Это Black ICE, уничтожающий программу при Derezzed (Dragon, Killer, Sabertooth)',
  defenders:'Защита',penaltyBox:'Поставить метку: −1 NET-действие на следующий ход',
  shieldPick:'блокирует урон и отключается',armorPick:'−4 к урону',flakPick:'ATK входящей программы был 0',shieldNA:'не работает против Black ICE',
  apply:'Применить к листу',needAmount:'Введите урон от 1 до 999.',idle:'Введите урон, и здесь появится расчёт.',noHp:'У листа нет числа HP: примените урон вручную.',
  prevBrain:(a,steps,taken,b,af)=>`Урон ${a}${steps}. В мозг: ${taken}. HP ${b} → ${af}.`,
  prevProg:(a,name,b,af,note)=>`Урон ${a} по ${name}: REZ ${b} → ${af}${note?' ('+note+')':''}.`,
  stShield:'Shield блокирует урон и отключается',stArmor:'Armor −4',stFlak:'Flak: ATK 0',stPenalty:'метка −1 NET-действие',
  derezzed:'Derezzed',destroyed:'Уничтожена',
  done:t=>`Применено. ${t}`,stale:'Данные изменились. Проверьте расчёт и повторите.',undo:'Отменить',restored:'Возвращено.',
  note:'Критические ранения, Death Save и стабилизацию ведите отдельно: здесь меняются только HP, защитные программы и REZ.'
 },
 en:{
  speed:'Net speed',speedRoll:'Roll speed',speedParts:'Interface',speedHint:'Spends no NET Action. The roll is Interface rank plus a Speedy Gonzalvez bonus and your own modifier.',
  fx:'What changes the numbers now',offOne:'Switch off for one roll',offTag:'off for 1 roll',
  wound:'Wound penalty and sheet effects',own:'Own modifier',
  speedy:'Speed',armor:'−4 brain damage, once per run',shield:'stops the first non-Black ICE brain damage, then Derezzed',flak:'ATK of non-Black ICE attacker programs is 0',
  pending:'−1 NET Action next turn',pendingHint:'A marker: “New turn” applies it and clears it. Never below two Actions.',cutNow:n=>`This turn has ${n} NET Action less (never below two).`,
  pendingSet:'Marker set: “New turn” takes one NET Action off (never below two).',pendingClear:'Marker cleared.',
  dmg:'Incoming damage',dmgLead:'Damage you took in the net goes onto the sheet. Defender programs are ticked in advance: untick one if its protection did not apply.',
  amount:'Damage',to:'To',toBrain:'The brain (HP)',toProgram:'A program (REZ)',src:'Source',srcProgram:'A program (not Black ICE)',srcIce:'Black ICE',srcWisp:'Black ICE Wisp',srcVrizz:'Program Vrizzbolt',
  program:'Which program',noProgram:'No program with REZ on the deck.',destroy:'A Black ICE that destroys a program when it derezzes (Dragon, Killer, Sabertooth)',
  defenders:'Defences',penaltyBox:'Set the marker: −1 NET Action next turn',
  shieldPick:'blocks the damage and derezzes',armorPick:'−4 damage',flakPick:'ATK of the incoming program was 0',shieldNA:'does not work against Black ICE',
  apply:'Apply to the sheet',needAmount:'Enter damage from 1 to 999.',idle:'Type the damage and the calculation will appear here.',noHp:'The sheet has no HP number: apply the damage by hand.',
  prevBrain:(a,steps,taken,b,af)=>`Damage ${a}${steps}. To the brain: ${taken}. HP ${b} → ${af}.`,
  prevProg:(a,name,b,af,note)=>`Damage ${a} to ${name}: REZ ${b} → ${af}${note?' ('+note+')':''}.`,
  stShield:'Shield blocks the damage and derezzes',stArmor:'Armor −4',stFlak:'Flak: ATK 0',stPenalty:'marker −1 NET Action',
  derezzed:'Derezzed',destroyed:'Destroyed',
  done:t=>`Applied. ${t}`,stale:'Data changed. Check the numbers and try again.',undo:'Undo',restored:'Restored.',
  note:'Critical Injuries, Death Saves and stabilization are tracked separately: only HP, defender programs and REZ change here.'
 }
};
// ---------- the table: numbers that are already in the repo ----------
const SPEEDY='extra-program-speedy-gonzalvez',ARMOR='extra-program-armor',SHIELD='extra-program-shield',FLAK='extra-program-flak';
const TABLE=Object.freeze({
 [SPEEDY]:Object.freeze({kind:'speed',value:2}),
 [ARMOR]:Object.freeze({kind:'defender',brain:4,once:true}),
 [SHIELD]:Object.freeze({kind:'defender',block:true,derez:true,once:true}),
 [FLAK]:Object.freeze({kind:'defender',zeroAtk:true,once:true})
});
// the effects that take NET Actions away next turn (how many) and the floor of the count
const NET_CUT=Object.freeze({'extra-ice-wisp':1,'extra-program-vrizzbolt':1});
const NET_FLOOR=2;
const isOnce=id=>TABLE[id]?.once===true;

const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const obj=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
const lng=l=>l==='en'?'en':'ru';
const RP=()=>global.RolePlay,app=()=>global.App;
const langNow=()=>lng(app()?.lang?.());
const rankOf=c=>{try{return Number(global.NetrunTab?.interfaceRank?.(c))||0}catch{return 0}};
const signed=n=>(n<0?'−':'+')+Math.abs(n);
const clone=x=>JSON.parse(JSON.stringify(x));
const say=m=>{if(m)try{app()?.notify?.(m)}catch{}};
const focusTag=k=>String(k).replace(/[^\w-]/g,'');
function hash(s){let h=5381;for(let i=0;i<s.length;i++)h=((h<<5)+h+s.charCodeAt(i))|0;return (h>>>0).toString(36)}

// ---------- the entries of the decks ----------
function entries(c){
 const out=[],decks=c?.extra?.cyberdecks?.decks;if(!Array.isArray(decks))return out;
 for(const d of decks)if(obj(d)&&Array.isArray(d.entries))for(const e of d.entries)if(obj(e))out.push({deck:d,entry:e,s:RP()?.progState?.(e)||null});
 return out;
}
const nameOf=(e,l)=>String(e?.name?.[l]||e?.name?.en||e?.catalogId||'');
// the first rezzed, not yet used copy of each defender
function defenders(c){
 const out={};
 for(const x of entries(c)){const t=TABLE[x.entry.catalogId];if(t?.kind==='defender'&&!out[x.entry.catalogId]&&x.s?.active&&x.entry.spent!==true)out[x.entry.catalogId]=x}
 return out;
}
function boosters(c){
 const out=[],seen=new Set(),B=RP()?.BOOST||{};
 for(const x of entries(c))if(B[x.entry.catalogId]&&x.s?.active&&!seen.has(x.entry.catalogId)){seen.add(x.entry.catalogId);out.push({id:x.entry.catalogId,ability:B[x.entry.catalogId],entry:x.entry})}
 return out;
}

// ---------- switched off for one roll (memory of the page) ----------
const skips=new Map();
const skipSet=c=>{let s=skips.get(c?.id);if(!s){s=new Set();skips.set(c?.id,s)}return s};
const skipList=c=>[...skipSet(c)];
function toggleSkip(c,key){const s=skipSet(c);if(s.has(key))s.delete(key);else s.add(key);return s.has(key)}
function consume(c,keys){const s=skipSet(c);for(const k of Array.isArray(keys)?keys:[])s.delete(k)}

// ---------- speed ----------
function sheetMod(c){
 try{const m=app()?.rollMods?.(c);const w=Number(m?.wound),e=Number(m?.effect);return (Number.isFinite(w)?w:0)+(Number.isFinite(e)?e:0)}catch{return 0}
}
function speedInfo(c,rank,skip){
 const off=Array.isArray(skip)?skip:[],names=[],offNames=[];
 for(const x of entries(c))if(x.entry.catalogId===SPEEDY&&x.s?.active){
  const n=String(x.entry.name?.en||SPEEDY);
  if(off.includes(SPEEDY)){if(!offNames.includes(n))offNames.push(n)}else if(!names.includes(n))names.push(n);
 }
 // the same program does not stack with itself: one bonus however many copies are rezzed
 const bonus=names.length?TABLE[SPEEDY].value:0,mod=RP()?.netMod?.(c)??0,sheet=sheetMod(c);
 return {rank,bonus,names,offNames,mod,sheet,total:rank+bonus+mod+sheet,base:rank+bonus};
}
function speedLabel(i,l){
 return `Speed (Interface ${i.rank}${i.bonus?` + ${i.names.join(', ')} ${i.bonus}`:''}${i.offNames.length?`; ${i.offNames.join(', ')} ${lng(l)==='ru'?'выкл.':'off'}`:''})`;
}
function speedRoll(){
 const A=app(),c=A?.active?.(),rank=rankOf(c);if(!c||!rank)return false;
 const l=langNow(),i=speedInfo(c,rank,skipList(c)),label=speedLabel(i,l);
 const out=A.check(i.base,label,{dv:0,mod:i.mod,parts:i.mod?[{k:'sheet',v:i.mod}]:undefined});
 if(i.offNames.length)consume(c,[SPEEDY]);
 try{global.NetrunConsole?.setLast?.({kind:'speed',label,total:out?.total,beat:null,dv:0,noVerdict:true})}catch{}
 try{global.NetrunConsole?.refresh?.()}catch{}
 return {label,out,info:i};
}

// ---------- the pending «-1 NET Action» marker ----------
const pendingOn=c=>Number(c?.extra?.roleTools?.netrunner?.values?.netPenalty)>0;
const setPending=(c,on)=>RP().withRun(c.extra,{netPenalty:on?1:undefined});

// ---------- incoming damage ----------
const SRC=['program','ice','extra-ice-wisp','extra-program-vrizzbolt'];
const srcIsIce=s=>s==='ice'||String(s).startsWith('extra-ice-');
/* o: {amount, to:'brain'|'program', src, entryId, off:[catalogId], destroy, penalty}. Pure: nothing is changed.
   -> {ok:true, text, ...} | {ok:false, message, offered}. `offered` lists the defenders that could take part (the checkboxes). */
function planDamage(c,o,l){
 const t=T[lng(l)],hasHp=Number.isFinite(Number(c?.hp));
 const amount=Number.isSafeInteger(o.amount)&&o.amount>=1&&o.amount<=999?o.amount:0,off=Array.isArray(o.off)?o.off:[];
 const vsIce=srcIsIce(o.src),def=defenders(c),offered=[];
 const flakX=!vsIce&&def[FLAK]&&!off.includes(FLAK)?def[FLAK]:null;
 if(o.to==='program'){
  if(!vsIce&&def[FLAK])offered.push({id:FLAK,x:def[FLAK],ticked:!off.includes(FLAK),label:t.flakPick});
  const x=entries(c).find(z=>z.entry.id===o.entryId&&z.s&&!z.s.destroyed);
  if(!x)return {ok:false,message:t.noProgram,offered};
  if(!amount)return {ok:false,message:t.needAmount,offered};
  const before=x.s.rez,after=Math.max(0,before-amount),derez=after===0&&before>0,gone=derez&&o.destroy===true;
  const note=[gone?t.destroyed:derez?t.derezzed:'',flakX?t.stFlak:''].filter(Boolean).join('; ');
  return {ok:true,to:'program',amount,entryId:x.entry.id,before,after,derez,gone,flak:flakX,offered,penalty:false,text:t.prevProg(amount,nameOf(x.entry,lng(l)),before,after,note)};
 }
 const shield=def[SHIELD],armor=def[ARMOR];
 const shieldOn=!!shield&&!vsIce&&!off.includes(SHIELD),armorOn=!!armor&&!shieldOn&&!off.includes(ARMOR);
 if(shield)offered.push({id:SHIELD,x:shield,ticked:shieldOn,label:vsIce?t.shieldNA:t.shieldPick,disabled:vsIce});
 if(armor)offered.push({id:ARMOR,x:armor,ticked:!off.includes(ARMOR),label:t.armorPick});
 if(!vsIce&&def[FLAK])offered.push({id:FLAK,x:def[FLAK],ticked:!off.includes(FLAK),label:t.flakPick});
 if(!amount)return {ok:false,message:t.needAmount,offered};
 if(!hasHp)return {ok:false,message:t.noHp,offered};
 const steps=[];let taken=amount;
 if(shieldOn){taken=0;steps.push(t.stShield)}
 else if(armorOn){taken=Math.max(0,amount-TABLE[ARMOR].brain);steps.push(t.stArmor)}
 if(flakX)steps.push(t.stFlak);
 // a blocked effect is stopped whole: the marker is not set then (the box can still be ticked by hand through the strip)
 const pen=o.penalty===true&&NET_CUT[o.src]>0&&!shieldOn;
 if(pen)steps.push(t.stPenalty);
 const before=Math.trunc(Number(c.hp)),after=Math.max(0,before-taken);
 return {ok:true,to:'brain',amount,taken,before,after,shield:shieldOn?shield:null,armor:armorOn?armor:null,flak:flakX,offered,penalty:pen,
  text:t.prevBrain(amount,steps.length?` (${steps.join(', ')})`:'',taken,before,after)};
}
// what a damage application changes: HP, the decks, the medical record, the netrunner values
const snapC=c=>JSON.stringify({hp:c?.hp??null,cd:c?.extra?.cyberdecks??null,med:c?.extra?.medical??null,rt:c?.extra?.roleTools?.netrunner??null});
function restoreC(c,before){
 const b=JSON.parse(before);if(!obj(c.extra))c.extra={};
 if(b.hp!==null)c.hp=b.hp;
 if(b.cd===null)delete c.extra.cyberdecks;else c.extra.cyberdecks=b.cd;
 if(b.med===null)delete c.extra.medical;else c.extra.medical=b.med;
 if(b.rt===null){if(obj(c.extra.roleTools))delete c.extra.roleTools.netrunner}else c.extra.roleTools={...(obj(c.extra.roleTools)?c.extra.roleTools:{}),netrunner:b.rt};
}
/* Writes a planned damage into the sheet: HP or REZ, the defenders it used (marked used; Shield derezzed), the pending marker.
   -> {ok:true, message, before, after} | {ok:false, message}. The sheet changes only when the new deck data passes deckState. */
function applyDamage(c,plan,l){
 const t=T[lng(l)];if(!plan?.ok)return {ok:false,message:plan?.message||t.stale};
 const before=snapC(c);
 let cd;
 if(obj(c.extra?.cyberdecks)){try{cd=clone(c.extra.cyberdecks)}catch{return {ok:false,message:t.stale}}}
 let touched=false;// the deck data is validated only when an entry was really changed: plain HP damage must not depend on it
 const find=id=>{for(const d of cd?.decks||[])for(const e of d.entries||[])if(e.id===id)return e;return null};
 const mark=(x,fn)=>{const e=x&&find(x.entry.id);if(!e)return false;fn(e);touched=true;return true};
 let extra={...(obj(c.extra)?c.extra:{})},hp=c.hp;
 if(plan.to==='brain'){
  hp=plan.after;
  if(plan.taken>0&&obj(extra.medical)&&extra.medical.stabilized===true)extra.medical={...extra.medical,stabilized:false};
  if(plan.shield&&!mark(plan.shield,e=>{e.spent=true;e.down=true;e.rez=0;delete e.active}))return {ok:false,message:t.stale};
  if(plan.armor&&!mark(plan.armor,e=>{e.spent=true}))return {ok:false,message:t.stale};
 }else{
  const e=find(plan.entryId);if(!e)return {ok:false,message:t.stale};touched=true;
  if(plan.gone){delete e.active;delete e.down;delete e.rez;e.destroyed=true}
  else if(plan.derez){e.rez=0;e.down=true;delete e.active}
  else e.rez=plan.after;
 }
 if(plan.flak&&!mark(plan.flak,e=>{e.spent=true}))return {ok:false,message:t.stale};
 if(cd&&touched){
  if(global.RoleTools?.deckState?.({extra:{cyberdecks:cd}}).kind!=='ok')return {ok:false,message:t.stale};
  extra.cyberdecks=cd;
 }
 if(plan.penalty)extra=RP().withRun(extra,{netPenalty:1});
 if(plan.to==='brain')c.hp=hp;
 c.extra=extra;
 return {ok:true,before,after:snapC(c),message:plan.text};
}

// ---------- the page memory of the damage form ----------
const forms=new Map();
function formFor(c){
 let f=forms.get(c?.id);
 if(!f){f={open:false,amount:'',to:'brain',src:'program',entryId:'',off:[],destroy:false,penalty:undefined,line:''};forms.set(c?.id,f)}
 return f;
}
const amountOf=f=>{const s=String(f.amount??'').trim();return /^\d{1,3}$/.test(s)?Number(s):0};
const programs=c=>entries(c).filter(x=>x.s&&!x.s.destroyed);
function formPlan(c,f,l){
 const cur=f.entryId&&programs(c).some(x=>x.entry.id===f.entryId)?f.entryId:programs(c)[0]?.entry.id||'';
 const penalty=f.penalty===undefined?NET_CUT[f.src]>0:f.penalty;
 return planDamage(c,{amount:amountOf(f),to:f.to,src:f.src,entryId:cur,off:f.off,destroy:f.destroy,penalty},l);
}

// ---------- drawing ----------
function stripHtml(c,l,rank){
 const t=T[l],items=[],skip=skipSet(c),n=RP()?.netLeft?.(c,rank)||{};
 const sw=(on,key,focus,name,val,tag,aria)=>`<li><button type="button" class="nx-chip" role="switch" aria-checked="${on}" data-nx-act="skip" data-nx-key="${esc(key)}" data-nx-focus="${esc(focus)}" aria-label="${esc(aria)}"><span class="nx-name">${esc(name)}</span><b>${esc(val)}</b><small>${esc(tag)}${on?'':' · '+esc(t.offTag)}</small></button></li>`;
 for(const b of boosters(c)){const nm=String(b.entry.name?.en||b.id);items.push(sw(!skip.has(b.id),b.id,'sk-'+focusTag(b.id),nm,'+2',b.ability,`${nm}, +2 ${b.ability}. ${t.offOne}`))}
 const sp=entries(c).find(x=>x.entry.catalogId===SPEEDY&&x.s?.active);
 if(sp){const nm=String(sp.entry.name?.en||SPEEDY),v='+'+TABLE[SPEEDY].value;items.push(sw(!skip.has(SPEEDY),SPEEDY,'sk-speedy',nm,v,t.speedy,`${nm}, ${v} ${t.speedy}. ${t.offOne}`))}
 const def=defenders(c);
 for(const [id,txt] of [[ARMOR,t.armor],[SHIELD,t.shield],[FLAK,t.flak]])if(def[id])items.push(`<li><span class="nx-chip nx-static"><span class="nx-name">${esc(String(def[id].entry.name?.en||id))}</span><small>${esc(txt)}</small></span></li>`);
 const sheet=sheetMod(c);
 if(sheet)items.push(`<li><span class="nx-chip nx-static"><span class="nx-name">${esc(t.wound)}</span><b>${signed(sheet)}</b></span></li>`);
 const mod=RP()?.netMod?.(c)??0;
 if(mod)items.push(`<li><span class="nx-chip nx-static"><span class="nx-name">${esc(t.own)}</span><b>${signed(mod)}</b></span></li>`);
 if(n.cut)items.push(`<li><span class="nx-chip nx-static"><span class="nx-name">${esc(t.cutNow(n.cut))}</span></span></li>`);
 items.push(`<li><button type="button" class="nx-chip" role="switch" aria-checked="${pendingOn(c)}" data-nx-act="pending" data-nx-focus="pending" aria-describedby="nx-pend-hint"><span class="nx-name">${esc(t.pending)}</span></button></li>`);
 return `<div class="nx-strip" data-nx-strip><div class="nx-label" id="nx-fx-title">${esc(t.fx)}</div><ul class="nx-chips" aria-labelledby="nx-fx-title">${items.join('')}</ul><p class="nx-hint" id="nx-pend-hint">${esc(t.pendingHint)}</p></div>`;
}
function speedHtml(c,l,rank){
 const t=T[l],i=speedInfo(c,rank,skipList(c)),parts=[`${t.speedParts} ${rank}`,i.bonus?`${i.names.join(', ')} ${i.bonus}`:'',i.mod?`${t.own} ${signed(i.mod)}`:'',i.sheet?signed(i.sheet):''].filter(Boolean).join(' + ');
 return `<div class="nx-speed" data-nx-speed><div class="nx-speed-text"><b>${esc(t.speed)}</b> <em>${signed(i.total)}</em><small>${esc(parts)}</small></div><button type="button" class="nc-btn" data-nx-act="speed-roll" data-nx-focus="speed" aria-label="${esc(`${t.speedRoll}, ${signed(i.total)}`)}">${esc(t.speedRoll)}</button></div><p class="nx-hint">${esc(t.speedHint)}</p>`;
}
const srcLabel=(s,t)=>s==='ice'?t.srcIce:s==='extra-ice-wisp'?t.srcWisp:s==='extra-program-vrizzbolt'?t.srcVrizz:t.srcProgram;
const stampOf=(c,f)=>hash(snapC(c)+JSON.stringify({a:f.amount,t:f.to,s:f.src,e:f.entryId,o:f.off,d:f.destroy,p:f.penalty}));
function previewHtml(c,f,l){
 const t=T[l],p=formPlan(c,f,l);
 if(!p.ok){const idle=p.message===t.needAmount&&String(f.amount??'').trim()==='';return `<div class="nx-preview" data-nx-preview role="status"><p class="nx-line${idle?' nx-idle':''}">${esc(idle?t.idle:p.message)}</p><button type="button" class="nc-btn nc-primary" data-nx-act="apply" data-nx-focus="apply" aria-disabled="true">${esc(t.apply)}</button></div>`}
 return `<div class="nx-preview" data-nx-preview role="status"><p class="nx-line">${esc(p.text)}</p><button type="button" class="nc-btn nc-primary" data-nx-act="apply" data-nx-focus="apply" data-nx-stamp="${esc(stampOf(c,f))}">${esc(t.apply)}</button></div>`;
}
function damageHtml(c,l){
 const t=T[l],f=formFor(c),p=formPlan(c,f,l),progs=programs(c);
 const opt=(v,lab,cur)=>`<option value="${esc(v)}"${v===cur?' selected':''}>${esc(lab)}</option>`;
 let h=`<details class="nx-dmg" data-nx-dmg${f.open?' open':''}><summary>${esc(t.dmg)}</summary><p class="nx-hint">${esc(t.dmgLead)}</p><div class="nx-form">`;
 h+=`<label class="nc-field">${esc(t.amount)}<input type="number" inputmode="numeric" min="1" max="999" data-nx-f="amount" value="${esc(f.amount)}"></label>`;
 h+=`<label class="nc-field">${esc(t.to)}<select data-nx-f="to">${opt('brain',t.toBrain,f.to)}${opt('program',t.toProgram,f.to)}</select></label>`;
 h+=`<label class="nc-field">${esc(t.src)}<select data-nx-f="src">${SRC.map(s=>opt(s,srcLabel(s,t),f.src)).join('')}</select></label>`;
 if(f.to==='program'){
  const cur=f.entryId&&progs.some(x=>x.entry.id===f.entryId)?f.entryId:progs[0]?.entry.id||'';
  h+=progs.length?`<label class="nc-field">${esc(t.program)}<select data-nx-f="entry">${progs.map(x=>opt(x.entry.id,`${nameOf(x.entry,l)} · REZ ${x.s.rez}/${x.s.max}`,cur)).join('')}</select></label>`:`<p class="nx-hint">${esc(t.noProgram)}</p>`;
  h+=`<label class="nx-check"><input type="checkbox" data-nx-f="destroy"${f.destroy?' checked':''}> <span>${esc(t.destroy)}</span></label>`;
 }
 h+='</div>';
 if(p.offered?.length)h+=`<fieldset class="nx-defs"><legend>${esc(t.defenders)}</legend>${p.offered.map(o=>`<label class="nx-check"><input type="checkbox" data-nx-f="def" data-nx-def="${esc(o.id)}"${o.ticked&&!o.disabled?' checked':''}${o.disabled?' disabled':''}> <span><b>${esc(nameOf(o.x.entry,l))}</b> · ${esc(o.label)}</span></label>`).join('')}</fieldset>`;
 if(NET_CUT[f.src]>0&&f.to==='brain')h+=`<label class="nx-check"><input type="checkbox" data-nx-f="penalty"${f.penalty===undefined||f.penalty?' checked':''}> <span>${esc(t.penaltyBox)}</span></label>`;
 h+=previewHtml(c,f,l);
 if(f.line)h+=`<p class="nx-done" data-nx-done role="status" tabindex="-1">${esc(f.line)}</p>`;
 return h+`<p class="nx-hint">${esc(t.note)}</p></details>`;
}
function render(c,lang){
 const rank=rankOf(c);if(!rank||!obj(c))return {speed:'',strip:'',damage:''};
 const l=lng(lang);
 return {speed:speedHtml(c,l,rank),strip:stripHtml(c,l,rank),damage:damageHtml(c,l)};
}

// ---------- redraw ----------
function repaintDamage(focus){
 const c=app()?.active?.(),root=doc?.querySelector?.('[data-nx-dmg]');if(!c||!root)return;
 const box=doc.createElement('div');box.innerHTML=damageHtml(c,langNow());const next=box.firstElementChild;if(!next)return;
 root.replaceWith(next);
 if(focus)try{setTimeout(()=>{try{doc.querySelector(focus)?.focus?.({preventScroll:true})}catch{}},0)}catch{}
}
function repaintPreview(){
 const c=app()?.active?.(),root=doc?.querySelector?.('[data-nx-preview]');if(!c||!root)return;
 const box=doc.createElement('div');box.innerHTML=previewHtml(c,formFor(c),langNow());const next=box.firstElementChild;if(next&&typeof next.innerHTML==='string')root.innerHTML=next.innerHTML;else if(next)root.replaceWith(next);
}
const refreshConsole=()=>{try{global.NetrunConsole?.refresh?.()}catch{}};

// ---------- actions ----------
function pendingToggle(){
 const A=app(),c=A?.active?.();if(!c||!rankOf(c))return false;
 const t=T[langNow()],on=!pendingOn(c);
 c.extra=setPending(c,on);try{A.save?.()}catch{}
 refreshConsole();say(on?t.pendingSet:t.pendingClear);return true;
}
function apply(btn){
 const A=app(),c=A?.active?.();if(!c||!rankOf(c))return false;
 const l=langNow(),t=T[l],f=formFor(c);
 if(btn?.getAttribute?.('aria-disabled')==='true'||!btn?.dataset?.nxStamp){say(formPlan(c,f,l).message||t.needAmount);return false}
 if(btn.dataset.nxStamp!==stampOf(c,f)){say(t.stale);repaintDamage();return false}
 const r=applyDamage(c,formPlan(c,f,l),l);
 if(!r.ok){say(r.message);repaintDamage();return false}
 f.line=t.done(r.message);f.amount='';f.off=[];f.penalty=undefined;f.destroy=false;
 try{A.save?.()}catch{}
 refreshConsole();try{global.NetrunDeck?.redraw?.()}catch{}
 try{setTimeout(()=>{try{doc.querySelector('[data-nx-done]')?.focus?.({preventScroll:true})}catch{}},0)}catch{}
 const cid=c.id,before=r.before,after=r.after,undo=()=>{
  const ch=A.getState?.()?.characters?.find?.(z=>z&&z.id===cid);
  if(!ch||snapC(ch)!==after){say(t.stale);return}
  restoreC(ch,before);try{A.save?.()}catch{}
  const fm=forms.get(cid);if(fm)fm.line='';
  if(A.active?.()?.id===cid){refreshConsole();try{global.NetrunDeck?.redraw?.()}catch{}}else A.render?.();
  say(t.restored);
  try{setTimeout(()=>{try{doc.querySelector('[data-nx-dmg] summary')?.focus?.({preventScroll:true})}catch{}},0)}catch{}
 };
 try{if(typeof A.notifyAction==='function'){A.notifyAction(f.line,t.undo,undo);return true}}catch{}
 say(f.line);return true;
}
function onClick(e){
 const b=e.target?.closest?.('[data-nx-act]');if(!b||!b.closest('[data-nc-root]'))return;
 const act=b.dataset.nxAct,c=app()?.active?.();if(!c)return;
 if(act==='skip'){toggleSkip(c,b.dataset.nxKey);refreshConsole();return}
 if(act==='pending'){pendingToggle();return}
 if(act==='speed-roll'){speedRoll();return}
 if(act==='apply')apply(b);
}
function readForm(c,el){
 const f=formFor(c),k=el.dataset.nxF;
 f.line='';
 if(k==='amount')f.amount=String(el.value).replace(/[^\d]/g,'').slice(0,3);
 else if(k==='to'){f.to=el.value==='program'?'program':'brain';f.off=[]}
 else if(k==='src'){f.src=SRC.includes(el.value)?el.value:'program';f.penalty=undefined}
 else if(k==='entry')f.entryId=String(el.value);
 else if(k==='destroy')f.destroy=el.checked===true;
 else if(k==='penalty')f.penalty=el.checked===true;
 else if(k==='def'){const id=el.dataset.nxDef;if(id){const s=new Set(f.off);if(el.checked)s.delete(id);else s.add(id);f.off=[...s]}}
 return f;
}
function onInput(e){
 const el=e.target?.closest?.('[data-nx-f="amount"]');if(!el)return;
 const c=app()?.active?.();if(!c)return;
 readForm(c,el);repaintPreview();
}
function onChange(e){
 const el=e.target?.closest?.('[data-nx-f]');if(!el||el.dataset.nxF==='amount')return;
 const c=app()?.active?.();if(!c)return;
 readForm(c,el);
 repaintDamage(`[data-nx-dmg] [data-nx-f="${el.dataset.nxF}"]${el.dataset.nxDef?`[data-nx-def="${focusTag(el.dataset.nxDef)}"]`:''}`);
}
function onToggle(e){
 const d=e.target;if(!d?.matches?.('[data-nx-dmg]'))return;
 const c=app()?.active?.();if(c)formFor(c).open=d.open===true;
}
if(doc?.addEventListener){
 doc.addEventListener('click',onClick);
 doc.addEventListener('input',onInput);
 doc.addEventListener('change',onChange);
 doc.addEventListener('toggle',onToggle,true);
}
global.NetrunEffects={TABLE,NET_CUT,NET_FLOOR,SRC,T,isOnce,entries,defenders,boosters,skipList,toggleSkip,consume,speedInfo,speedLabel,speedRoll,pendingOn,setPending,planDamage,applyDamage,snapC,restoreC,render,formFor,srcIsIce,amountOf,formPlan,SPEEDY,ARMOR,SHIELD,FLAK};
})(window);
