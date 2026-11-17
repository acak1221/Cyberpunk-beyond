/* Martial Arts, Cyberpunk RED Corebook pp. 178–180. Read-only reference. */
(function(){
'use strict';
const moves=[
 {form:'Shared',name:['Recovery','Восстановление'],page:179,req:['Any form; at least 1 rank in its Martial Arts skill.','Любая форма; минимум 1 ранг её навыка Martial Arts.'],effect:['When you use the Get Up Action, beat DV13 with a Martial Arts Special Move Resolution. On success the Get Up Action did not cost an Action.','Когда используете действие Get Up, превзойдите DV13 проверкой специального приёма. При успехе Get Up не затратил действие.']},
 {form:'Aikido',name:['Disarming Combination','Обезоруживающая комбинация'],page:179,req:['Hit the same target with a Brawling Attack and a Martial Arts Attack this turn.','В этом ходу попадите по одной цели атакой Brawling и атакой Martial Arts.'],effect:['Once per turn, beat DV15. One object in the target’s hands is either in your hands or on the floor.','Раз за ход превзойдите DV15. Один предмет в руках цели оказывается у вас в руках или на полу.']},
 {form:'Aikido',name:['Iron Grip','Железная хватка'],page:179,req:['You have successfully grabbed a target not already affected by Iron Grip.','Вы успешно захватили цель, на которую ещё не действует Iron Grip.'],effect:['Once per turn, use an Action and beat DV15. Until the grapple ends, the target takes an additional −2 to escape attempts and cannot make ranged attacks.','Раз за ход потратьте действие и превзойдите DV15. До окончания захвата цель получает дополнительный штраф −2 к попыткам вырваться и не может совершать дальние атаки.']},
 {form:'Karate',name:['Armor Breaking Combination','Комбинация для разрушения брони'],page:179,req:['Hit the same target with a Melee Weapon and a Martial Arts Attack this turn.','В этом ходу попадите по одной цели оружием ближнего боя и атакой Martial Arts.'],effect:['Once per turn, beat DV15. All armor worn by that target loses an additional 2 SP.','Раз за ход превзойдите DV15. Вся надетая на цель броня дополнительно теряет 2 SP.']},
 {form:'Karate',name:['Bone Breaking Strike','Удар, ломающий кости'],page:179,req:['WILL 8 or higher.','WILL 8 или выше.'],effect:['Instead of two attacks, use an Action against one target in melee range. On a hit, deal Martial Arts damage and inflict Broken Ribs if absent. Declare a −8 check to aim at the head: inflict Cracked Skull instead, after damage, if absent.','Вместо двух атак потратьте действие против одной цели в ближнем бою. При попадании нанесите урон Martial Arts и, если его ещё нет, ранение Broken Ribs. Можно объявить удар в голову со штрафом −8: вместо него после расчёта урона нанесите Cracked Skull, если его ещё нет.']},
 {form:'Judo',name:['Counter Throw','Контрбросок'],page:179,req:['You dodged all melee attacks directed at you since your last turn.','Вы уклонились от всех атак ближнего боя, направленных против вас с вашего последнего хода.'],effect:['Once per turn, use an Action and beat DV15. Throw one target in melee range whose attack you dodged; the throw cannot be avoided and requires no grapple.','Раз за ход потратьте действие и превзойдите DV15. Бросьте одну цель в ближнем бою, от атаки которой вы уклонились; броска нельзя избежать, захват не требуется.']},
 {form:'Judo',name:['Grab Escape','Освобождение от захвата'],page:179,req:['Hit a target grappling you with two melee attacks this turn.','В этом ходу дважды попадите атаками ближнего боя по удерживающей вас цели.'],effect:['Once per turn, beat DV15. Escape that target’s grapple and inflict Broken Arm, if absent; choose the arm.','Раз за ход превзойдите DV15. Вырвитесь из захвата этой цели и нанесите ей Broken Arm, если такого ранения ещё нет; руку выбираете вы.']},
 {form:'Taekwondo',name:['Pressure Point Strike','Удар по болевой точке'],page:180,req:['WILL 8 or higher.','WILL 8 или выше.'],effect:['Instead of two attacks, use an Action against one target in melee range. On a hit, deal Martial Arts damage and inflict Spinal Injury if absent. Declare a −8 check to aim at the head: inflict Brain Injury instead, if absent.','Вместо двух атак потратьте действие против одной цели в ближнем бою. При попадании нанесите урон Martial Arts и, если его ещё нет, Spinal Injury. Можно объявить удар в голову со штрафом −8: вместо него нанесите Brain Injury, если его ещё нет.']},
 {form:'Taekwondo',name:['Flying Kick','Удар ногой в прыжке'],page:180,req:['MOVE 8 or higher; already moved at least 4 m/yd this turn.','MOVE 8 или выше; в этом ходу вы уже переместились минимум на 4 м/ярда.'],effect:['Instead of two attacks, use an Action and all remaining movement to move in a straight line to a target up to 4 m/yd away. On a hit, deal Martial Arts damage to the body, knock the target prone and remove them from any vehicle without a fully enclosed cabin.','Вместо двух атак потратьте действие и всё оставшееся движение, чтобы переместиться по прямой к цели не далее 4 м/ярдов. При попадании нанесите урон Martial Arts в тело, повалите цель и снимите её с транспорта без полностью закрытой кабины.']}
];
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function reference(lang){const ru=lang!=='en',i=ru?1:0;return `<section class="card" style="margin-top:24px"><div class="card-heading"><span>${ru?'БОЕВЫЕ ИСКУССТВА':'MARTIAL ARTS'}</span><span>${ru?'СТР.':'PP.'} 178–180</span></div><p>${ru?'Атаки Martial Arts: ROF 2, требуется минимум 1 ранг навыка. Урон зависит от BODY: до 4 — 1d6; 5–6 — 2d6; 7–10 — 3d6; 11+ — 4d6. Игнорируется половина SP брони; округляйте учитываемую половину вверх.':'Martial Arts attacks have ROF 2 and require at least 1 skill rank. Damage by BODY: 4 or less — 1d6; 5–6 — 2d6; 7–10 — 3d6; 11+ — 4d6. Ignore half the armor SP; round the remaining half up.'}</p><p>${ru?'Проверка приёма: DEX + навык выбранной формы + 1d10 против DEX + Evasion + 1d10 защитника либо указанной DV. Для приёма нужен хотя бы 1 ранг его формы; прицельные удары доступны только там, где указано. Требования и результаты проверяются вручную.':'Special Move Resolution: DEX + the form’s skill + 1d10 versus the defender’s DEX + Evasion + 1d10, or the specified DV. At least 1 rank in the move’s form is required; aimed shots are allowed only where stated. Check requirements and outcomes manually.'}</p>${moves.map(m=>`<details style="border-top:1px solid #504a43;padding:10px 0"><summary><strong>${esc(m.form)} · ${esc(m.name[i])}</strong> <small>${ru?'стр.':'p.'} ${m.page}</small></summary><p><strong>${ru?'Условие:':'Requirement:'}</strong> ${esc(m.req[i])}</p><p>${esc(m.effect[i])}</p><button type="button" class="btn" data-action="book-page" data-page="${m.page}">${ru?'Открыть страницу книги':'Open book page'} ↗</button></details>`).join('')}</section>`}
/* ---------- the character's own forms and moves: extra.martialArts = {v:1, forms:[{id, moves:[ids]}]} ----------
   The reference above stays as it was. This part lets a sheet say which forms the character knows and which moves they
   have learned, checks every move against its requirement (the numbers come from the requirement text of the move) and
   hands the known moves to the combat dock (MartialArts.known / renderKnown). Old saves have no such field: nothing
   changes for them until a form is ticked. A saved value of an unknown shape is never written over. */
const FORMS=[
 {id:'aikido',en:'Aikido',ru:'Айкидо',match:/aikido|айкидо/i},
 {id:'karate',en:'Karate',ru:'Каратэ',match:/karate|карате|каратэ/i},
 {id:'judo',en:'Judo',ru:'Дзюдо',match:/judo|дзюдо/i},
 {id:'taekwondo',en:'Taekwondo',ru:'Тхэквондо',match:/taekwondo|тхэквондо|тэквондо/i}
];
// Per move: a stable id, the DV its check beats (the same number the text states), a STAT threshold and whether the
// requirement also has a condition that only the table can judge. Every number is pinned to the move text in the tests.
const META={
 'Recovery':{id:'recovery',dv:13},
 'Disarming Combination':{id:'disarming-combination',dv:15,situ:true},
 'Iron Grip':{id:'iron-grip',dv:15,situ:true},
 'Armor Breaking Combination':{id:'armor-breaking-combination',dv:15,situ:true},
 'Bone Breaking Strike':{id:'bone-breaking-strike',stat:['WILL',8]},
 'Counter Throw':{id:'counter-throw',dv:15,situ:true},
 'Grab Escape':{id:'grab-escape',dv:15,situ:true},
 'Pressure Point Strike':{id:'pressure-point-strike',stat:['WILL',8]},
 'Flying Kick':{id:'flying-kick',stat:['MOVE',8],situ:true}
};
for(const m of moves){const k=META[m.name[0]];m.id=k.id;m.formId=m.form==='Shared'?null:m.form.toLowerCase();m.dv=k.dv||null;m.check={skill:1,stat:k.stat?k.stat.slice():null,situational:k.situ===true}}
const isObj=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
const int=(v,lo,hi)=>{if(v===null||v===''||typeof v==='boolean')return null;const n=Number(v);return Number.isInteger(n)&&n>=lo&&n<=hi?n:null};
const formById=id=>typeof id==='string'?FORMS.find(f=>f.id===id)||null:null;
const moveById=id=>typeof id==='string'?moves.find(m=>m.id===id)||null:null;
const allowed=(formId,moveId)=>{const m=moveById(moveId);return !!m&&(m.formId===null||m.formId===formId)};
const copy=v=>v===undefined?undefined:JSON.parse(JSON.stringify(v));
const extraOf=c=>isObj(c)&&isObj(c.extra)?c.extra:null;
// A saved value, rebuilt from a whitelist: known forms once each, known moves of that form (or shared) once each, in book order.
function clean(raw){
 if(!isObj(raw)||raw.v!==1||!Array.isArray(raw.forms))return null;
 const out=[];
 for(const f of raw.forms){
  if(!isObj(f))continue;const form=formById(f.id);if(!form||out.some(x=>x.id===form.id))continue;
  const ids=Array.isArray(f.moves)?f.moves:[];
  out.push({id:form.id,moves:moves.filter(m=>ids.includes(m.id)&&allowed(form.id,m.id)).map(m=>m.id)});
 }
 out.sort((a,b)=>FORMS.findIndex(f=>f.id===a.id)-FORMS.findIndex(f=>f.id===b.id));
 return {v:1,forms:out};
}
// The character's record; an empty one when there is none; null when a value of an unknown shape sits there.
function read(c){const x=extraOf(c);if(!x||x.martialArts===undefined)return {v:1,forms:[]};return clean(x.martialArts)}
function mutate(c,change){
 if(!isObj(c))return {ok:false,reason:'stale'};
 if(c.extra!==undefined&&c.extra!==null&&!isObj(c.extra))return {ok:false,reason:'foreign'};
 const cur=read(c);if(!cur)return {ok:false,reason:'foreign'};
 const before=copy(extraOf(c)?.martialArts),next=change(copy(cur));
 if(!next)return {ok:false,reason:'invalid'};
 const fin=clean(next);if(!fin)return {ok:false,reason:'invalid'};
 if(JSON.stringify(fin)===JSON.stringify(cur)&&before!==undefined)return {ok:false,reason:'same'};
 if(!isObj(c.extra))c.extra={};
 c.extra.martialArts=fin;
 return {ok:true,before,after:copy(fin)};
}
function setForm(c,formId,on){
 if(!formById(formId))return {ok:false,reason:'form'};
 return mutate(c,d=>{const has=d.forms.some(f=>f.id===formId);if(on&&!has)d.forms.push({id:formId,moves:[]});if(!on)d.forms=d.forms.filter(f=>f.id!==formId);return d});
}
function setMove(c,formId,moveId,on){
 if(!formById(formId)||!allowed(formId,moveId))return {ok:false,reason:'move'};
 return mutate(c,d=>{const f=d.forms.find(x=>x.id===formId);if(!f)return null;f.moves=f.moves.filter(x=>x!==moveId);if(on)f.moves.push(moveId);return d});
}
// Puts back what setForm / setMove replaced (the value before, or no value at all).
function restore(c,before){
 if(!isObj(c))return {ok:false,reason:'stale'};
 if(c.extra!==undefined&&c.extra!==null&&!isObj(c.extra))return {ok:false,reason:'foreign'};
 if(before===undefined){if(isObj(c.extra))delete c.extra.martialArts;return {ok:true}}
 const fin=clean(before);if(!fin)return {ok:false,reason:'invalid'};
 if(!isObj(c.extra))c.extra={};c.extra.martialArts=fin;return {ok:true};
}
const statNow=(c,stat)=>{let v=null;try{v=window.DossierPanel?.statBase?.(c,stat)?.value}catch{}const n=Number(v);return Number.isFinite(n)?n:(int(c?.stats?.[stat],0,100)??0)};
/* The rank the character has in a form: the best of a specialization named after the form, a plain «Martial Arts»
   specialization and the Martial Arts skill of the sheet. */
function formRank(c,formId){
 const form=formById(formId),list=Array.isArray(extraOf(c)?.specializations)?c.extra.specializations:[];
 let best=int(c?.skills?.['Martial Arts'],0,10)||0;
 for(const s of list){
  if(!isObj(s)||typeof s.name!=='string')continue;const lv=int(s.level,0,10);if(lv===null)continue;
  const name=s.name.trim();if(((form&&form.match.test(name))||/^(?:martial arts|боевые искусства)$/i.test(name))&&lv>best)best=lv;
 }
 return best;
}
// «Any form» (a shared move) counts the best form the character knows, or the plain skill when no form is ticked.
function rankFor(c,m){
 if(m.formId!==null)return formRank(c,m.formId);
 const d=read(c)||{forms:[]};return d.forms.reduce((a,f)=>Math.max(a,formRank(c,f.id)),formRank(c,null));
}
/* One move against the sheet. items: the numeric requirements {kind:'skill'|'stat', stat?, need, have, ok};
   status: 'met' (numbers fit, nothing else to judge), 'check' (numbers fit, a condition is left to the table), 'unmet'. */
function evaluate(c,moveId,formId){
 const m=moveById(moveId);if(!m)return null;
 const rank=rankFor(c,m),items=[{kind:'skill',need:m.check.skill,have:rank,ok:rank>=m.check.skill}];
 if(m.check.stat){const [stat,need]=m.check.stat,have=statNow(c,stat);items.push({kind:'stat',stat,need,have,ok:have>=need})}
 const numeric=items.every(i=>i.ok);
 return {id:m.id,rank,items,situational:m.check.situational,status:!numeric?'unmet':m.check.situational?'check':'met'};
}
// The moves the character has learned, in book order, once each: for the combat dock and the block below.
function known(c){
 const d=read(c);if(!d)return [];const out=[],seen=new Set();
 for(const m of moves){
  const f=d.forms.find(x=>x.moves.includes(m.id));if(!f||seen.has(m.id))continue;seen.add(m.id);
  const e=evaluate(c,m.id,f.id);
  out.push({id:m.id,form:m.form,formId:m.formId||f.id,index:moves.indexOf(m),name:m.name,page:m.page,req:m.req,effect:m.effect,dv:m.dv,rank:e.rank,items:e.items,situational:e.situational,status:e.status});
 }
 return out;
}
/* The sheet the block is about: the open sheet, or, on the combat page where none is open, the one picked in the list
   (the only character when there is just one). */
let picked=null;
function characters(){try{const l=window.App?.getState?.()?.characters;return Array.isArray(l)?l.filter(x=>isObj(x)&&typeof x.id==='string'):[]}catch{return []}}
function subject(){
 let c=null;try{c=window.App?.active?.()||null}catch{}
 if(isObj(c))return c;
 const list=characters();return list.find(x=>x.id===picked)||(list.length===1?list[0]:null);
}
const MSG={
 ru:{mine:'ВАШИ ПРИЁМЫ',lead:'Отметьте формы, которые знает персонаж, и приёмы, которые он выучил. Числовые условия сверяются с листом; остальное проверяется за столом.',noChar:'Создайте персонажа, чтобы отметить его приёмы.',pick:'Персонаж',pickNone:'Выберите персонажа',rank:'Ранг',known:'Известные приёмы',none:'Приёмов пока не отмечено.',met:'Условия выполнены',check:'Числа подходят; остальное — по ситуации',unmet:'Не хватает',skillNeed:n=>`ранга формы ${n}+`,have:n=>`у вас ${n}`,roll:'Проверка',rollTitle:'DEX + навык формы + 1d10',untrained:'Для приёма нужен хотя бы 1 ранг формы.',stale:'Лист изменился. Отметьте приём заново.',foreign:'В листе есть запись приёмов неизвестного формата. Она не тронута.',undo:'Вернуть',formOn:n=>`Форма добавлена: ${n}`,formOff:n=>`Форма убрана: ${n}`,moveOn:n=>`Приём выучен: ${n}`,moveOff:n=>`Приём убран: ${n}`,dv:'DV',page:'стр.',any:'любая форма'},
 en:{mine:'YOUR MOVES',lead:'Tick the forms the character knows and the moves they have learned. Numeric requirements are checked against the sheet; the rest is judged at the table.',noChar:'Create a character to mark their moves.',pick:'Character',pickNone:'Choose a character',rank:'Rank',known:'Known moves',none:'No moves marked yet.',met:'Requirements met',check:'Numbers fit; the rest depends on the situation',unmet:'Missing',skillNeed:n=>`form rank ${n}+`,have:n=>`you have ${n}`,roll:'Check',rollTitle:'DEX + the form’s skill + 1d10',untrained:'The move needs at least 1 rank in its form.',stale:'The sheet changed. Mark the move again.',foreign:'The sheet holds a moves record of an unknown format. It was left untouched.',undo:'Undo',formOn:n=>`Form added: ${n}`,formOff:n=>`Form removed: ${n}`,moveOn:n=>`Move learned: ${n}`,moveOff:n=>`Move removed: ${n}`,dv:'DV',page:'p.',any:'any form'}
};
const L=lang=>MSG[lang==='en'?'en':'ru'];
const formName=(id,lang)=>formById(id)?.[lang==='en'?'en':'ru']||'';
// «Missing: form rank 1+ (you have 0), WILL 8+ (you have 6)» for the numeric requirements that fail.
function missing(items,lang){const t=L(lang);return items.filter(i=>!i.ok).map(i=>`${i.kind==='skill'?t.skillNeed(i.need):`${i.stat} ${i.need}+`} (${t.have(i.have)})`).join(', ')}
function statusText(k,lang){const t=L(lang);return k.status==='unmet'?`${t.unmet}: ${missing(k.items,lang)}`:t[k.status]}
const badge=(k,lang)=>`<span class="ma-badge ma-st-${k.status}" data-ma-status="${k.status}">${k.status==='unmet'?'✕':k.status==='met'?'✓':'?'} ${esc(statusText(k,lang))}</span>`;
function knownRows(c,lang){
 const t=L(lang),i=lang==='en'?0:1,list=known(c);
 if(!list.length)return `<p class="ma-empty">${esc(t.none)}</p>`;
 return `<ul class="ma-list">${list.map(k=>{const form=k.form==='Shared'?'':formName(k.formId,lang);return `<li class="ma-row"><div class="ma-name"><strong>${esc(k.name[i])}</strong> <small>${esc(form)}${form?' · ':''}${esc(t.page)} ${k.page}${k.dv?` · ${esc(t.dv)} ${k.dv}`:''}</small></div>${badge(k,lang)}<p class="ma-req">${esc(k.req[i])}</p><button type="button" class="btn ma-roll" data-ma-roll="${esc(k.id)}"${k.status==='unmet'?' disabled':''} title="${esc(k.status==='unmet'?statusText(k,lang):t.rollTitle)}">⬡ ${esc(t.roll)}</button></li>`}).join('')}</ul>`;
}
// The block for the combat dock: the known moves with a check button each. Empty text when nothing is known.
function renderKnown(c,lang){
 if(!isObj(c)||!known(c).length)return '';
 const t=L(lang);return `<section class="ma-known" data-ma-known aria-label="${esc(t.known)}"><h3>${esc(t.known)}</h3>${knownRows(c,lang)}</section>`;
}
function mine(lang){
 const t=L(lang),i=lang==='en'?0:1,c=subject(),list=characters();let openSheet=null;try{openSheet=window.App?.active?.()||null}catch{}
 const d=isObj(c)?read(c):null,head=`<div class="card-heading"><span>${esc(t.mine)}</span><span aria-label="${esc(t.mine)}: ${d?d.forms.length:0} / ${FORMS.length}">${d?d.forms.length:0}/${FORMS.length}</span></div>`;
 const pick=!openSheet&&list.length>1?`<label class="field ma-pick">${esc(t.pick)}<select data-ma-pick>${isObj(c)?'':`<option value="" selected>${esc(t.pickNone)}</option>`}${list.map(x=>`<option value="${esc(x.id)}"${isObj(c)&&x.id===c.id?' selected':''}>${esc(x.name||x.id)}</option>`).join('')}</select></label>`:'';
 if(!isObj(c)||typeof c.id!=='string')return `<section class="card ma-mine" data-ma-root>${head}${pick||`<p>${esc(t.noChar)}</p>`}</section>`;
 if(!d)return `<section class="card ma-mine" data-ma-root data-ma-char="${esc(c.id)}">${head}${pick}<p role="status">${esc(t.foreign)}</p></section>`;
 const forms=FORMS.map(f=>{
  const has=d.forms.find(x=>x.id===f.id);
  let body='';
  if(has)body=`<ul class="ma-moves">${moves.filter(m=>m.formId===null||m.formId===f.id).map(m=>{const on=has.moves.includes(m.id),e=evaluate(c,m.id,f.id);return `<li class="ma-move"><label class="ma-check"><input type="checkbox" data-ma-move="${m.id}" data-ma-in="${f.id}"${on?' checked':''}><span>${esc(m.name[i])}${m.formId===null?` <small>(${esc(t.any)})</small>`:''}</span></label>${badge(e,lang)}</li>`}).join('')}</ul>`;
  return `<fieldset class="ma-form"><legend><label class="ma-check"><input type="checkbox" data-ma-form="${f.id}"${has?' checked':''}><span>${esc(formName(f.id,lang))}</span></label> <small>${esc(t.rank)} ${formRank(c,f.id)}</small></legend>${body}</fieldset>`;
 }).join('');
 return `<section class="card ma-mine" data-ma-root data-ma-char="${esc(c.id)}">${head}${pick}<p class="ma-lead">${esc(t.lead)}</p>${forms}${renderKnown(c,lang)}</section>`;
}
function render(lang){return mine(lang)+reference(lang)}
/* ---------- events ---------- */
const app=()=>window.App||null;
const langNow=()=>{try{return app()?.lang?.()==='en'?'en':'ru'}catch{return 'ru'}};
const say=m=>{try{app()?.notify?.(m)}catch{}};
// After the sheet is drawn again the same control gets the focus back; if it is gone, the first control of the block.
function focusBack(sel){try{const el=document.querySelector(sel);if(el&&!el.disabled){el.focus();return}document.querySelector('[data-ma-root] input,[data-ma-root] select,[data-ma-root] button')?.focus?.()}catch{}}
function selectorOf(el){const f=el.dataset?.maForm,m=el.dataset?.maMove;return f?`input[data-ma-form="${f}"]`:`input[data-ma-move="${m}"][data-ma-in="${el.dataset.maIn}"]`}
function onChange(e){
 const el=e.target;
 if(el?.matches?.('select[data-ma-pick]')){
  if(!characters().some(x=>x.id===el.value))return;
  picked=el.value;app()?.render?.();focusBack('select[data-ma-pick]');return;
 }
 if(!el?.matches?.('input[data-ma-form],input[data-ma-move]'))return;
 const A=app(),l=langNow(),t=L(l),root=el.closest?.('[data-ma-root]'),c=subject(),sel=selectorOf(el);
 if(!A||!c||!root||root.dataset.maChar!==c.id){say(t.stale);A?.render?.();return}
 const on=el.checked===true,formId=el.dataset.maForm||el.dataset.maIn,moveId=el.dataset.maMove;
 const r=moveId?setMove(c,formId,moveId,on):setForm(c,formId,on);
 if(!r.ok){say(r.reason==='foreign'?t.foreign:t.stale);A.render?.();focusBack(sel);return}
 A.save?.();A.render?.();focusBack(sel);
 const name=moveId?moveById(moveId).name[l==='en'?0:1]:formName(formId,l),msg=(moveId?(on?t.moveOn:t.moveOff):(on?t.formOn:t.formOff))(name);
 const back=()=>{
  const owner=A.getState?.()?.characters?.find?.(x=>x&&x.id===c.id);
  if(!owner||!restore(owner,r.before).ok){say(t.stale);return}
  A.save?.();A.render?.();focusBack(sel);
 };
 if(typeof A.notifyAction==='function')A.notifyAction(msg,t.undo,back);else say(msg);
}
// One check of a known move: DEX + the rank in its form through the sheet's own numbers, against the DV the move states.
function rollMove(c,id,lang){
 const A=app(),k=known(c).find(x=>x.id===id);
 if(!A||typeof A.check!=='function'||!k)return {ok:false,reason:'stale'};
 if(k.rank<1)return {ok:false,reason:'rank'};
 if(k.status==='unmet')return {ok:false,reason:'unmet'};
 const stat=statNow(c,'DEX');let bonus=stat+k.rank;
 try{const b=Number(A.checkBonus?.(c,'DEX',k.rank,'melee','Martial Arts'));if(Number.isFinite(b))bonus=b}catch{}
 const form=k.form==='Shared'?'':formName(k.formId,lang),label=`${k.name[lang==='en'?0:1]}${form?' · '+form:''}`;
 try{A.check(stat,label,{wounds:false,dv:k.dv||0,skill:k.rank,mod:bonus-stat-k.rank})}catch{return {ok:false,reason:'stale'}}
 return {ok:true};
}
function onClick(e){
 const b=e.target?.closest?.('button[data-ma-roll]');if(!b||b.disabled)return;
 const A=app(),l=langNow(),t=L(l),c=subject();
 const r=c?rollMove(c,b.dataset.maRoll,l):{ok:false,reason:'stale'};
 if(!r.ok)say(r.reason==='rank'||r.reason==='unmet'?(r.reason==='rank'?t.untrained:statusText(known(c).find(x=>x.id===b.dataset.maRoll)||{status:'unmet',items:[]},l)):t.stale);
}
if(typeof document!=='undefined'&&document?.addEventListener){document.addEventListener('change',onChange);document.addEventListener('click',onClick)}
window.MartialArts={render,moves,reference,subject,forms:FORMS,clean,read,setForm,setMove,restore,evaluate,formRank,known,renderKnown,rollMove};
})();
