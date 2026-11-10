/* The effects layer (effects.js: Critical Injuries, cyberware, street drugs) for the tools that roll for a
   character taken from a sheet: medicine, cybersurgery, pharmacy, therapy, repairs and NET combat.
   A tool asks what the effects give to one check of that character and gets the number, the sources it is
   made of, a tail for the label of the roll and a line for its own result. With numbers typed by hand a tool
   passes no character and gets nothing.
   Wound penalties are not part of this: the tools leave them to the «modifier» field, and so does this
   module, so nothing is counted twice. An effect that switches the Seriously Wounded penalty off is only
   mentioned, so the player does not type that penalty in. Situational effects stay reminders. */
(function(){
'use strict';
const isObject=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
const whole=v=>typeof v==='number'&&Number.isSafeInteger(v);
const signed=n=>(n<0?'−':'+')+Math.abs(n);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const own=(o,k)=>isObject(o)&&typeof k==='string'&&Object.hasOwn(o,k)&&whole(o[k])?o[k]:0;
const NONE=Object.freeze({mod:0,parts:Object.freeze([]),reminders:Object.freeze([]),ignoreSerious:false});
/* What the effects in force give to one check of character `c`.
   opts: skill = the Skill rolled (as on the sheet), stat = the STAT rolled, kind = 'melee' | 'ranged' for an attack.
   Returns {mod, parts:[{name:{ru,en}, value}], reminders:[{name:{ru,en}, note:[ru,en]}], ignoreSerious}.
   The parts always add up to mod, and mod is what Effects.checkModifier says. */
function detail(c,opts){
 const E=globalThis.window?.Effects;
 if(!isObject(c)||typeof E?.collect!=='function'||typeof E?.checkModifier!=='function')return NONE;
 const o=isObject(opts)?opts:{},skill=typeof o.skill==='string'?o.skill:'',stat=typeof o.stat==='string'?o.stat:'',kind=o.kind==='melee'||o.kind==='ranged'?o.kind:'';
 let total,mod;
 try{total=E.collect(c);mod=E.checkModifier(c,kind,skill,stat)}catch{return NONE}
 if(!isObject(total)||!Array.isArray(total.sources)||!whole(mod))return NONE;
 const parts=[],reminders=[];let sum=0,implant=null;
 for(const s of total.sources){
  if(!isObject(s)||!isObject(s.parts))continue;
  const p=s.parts,name={ru:String(s.name?.ru||s.name?.en||''),en:String(s.name?.en||s.name?.ru||'')};
  let value=0;
  if(s.kind==='injury')value=own(p,'all')+(kind?own(p,kind):0);
  else if(s.kind==='drug')value=own(p.stats,stat)+own(p.skills,skill);
  else if(s.kind==='cyber'){
   // The same Skill bonus from two implants does not stack: only the larger one counts.
   const bonus=own(p.skills,skill);
   if(bonus&&(!implant||bonus>implant.value)){if(implant){sum-=implant.value;parts.splice(parts.indexOf(implant),1)}implant={name,value:bonus};parts.push(implant);sum+=bonus}
  }
  if(value){parts.push({name,value});sum+=value}
  if(Array.isArray(s.note)&&s.note.length===2&&(s.kind==='injury'||s.kind==='drug'))reminders.push({name,note:[String(s.note[0]),String(s.note[1])]});
  if(p.ignoreSerious===true)reminders.push({name,note:['штраф тяжёлого ранения не действует — не вносите его в модификатор','no Seriously Wounded penalty — do not enter it in the modifier']});
 }
 if(sum!==mod)parts.push({name:{ru:'Прочие эффекты',en:'Other effects'},value:mod-sum});
 return {mod,parts,reminders,ignoreSerious:total.ignoreSerious===true};
}
const mod=(c,opts)=>detail(c,opts).mod;
// A manual modifier with the effects added, kept inside the range every tool accepts. Anything that is not a whole number is returned untouched, so the tool's own validation still speaks.
function apply(modifier,c,opts){if(!whole(modifier))return modifier;return Math.max(-100,Math.min(100,modifier+mod(c,opts)))}
const lang2=lang=>lang==='en'?'en':'ru';
const partsText=(d,l)=>d.parts.map(p=>`${p.name[l]} ${signed(p.value)}`).join('; ');
// A tail for the label of a roll, the way the sheet writes it: « · эффекты −2».
function label(c,opts,lang){const n=mod(c,opts);return n?(lang2(lang)==='ru'?' · эффекты ':' · effects ')+signed(n):''}
// One plain line: «Эффекты листа: −2 (Сотрясение −2). Уже в броске.» Empty when nothing acts on the check.
function text(c,opts,lang){
 const d=detail(c,opts),l=lang2(lang),ru=l==='ru';if(!d.parts.length&&!d.reminders.length)return '';
 const out=[];
 if(d.parts.length)out.push(`${ru?'Эффекты листа':'Sheet effects'}: ${d.mod?signed(d.mod):'0'} (${partsText(d,l)}). ${ru?'Уже в броске — не вносите в модификатор.':'Already in the roll — do not enter it in the modifier.'}`);
 if(d.reminders.length)out.push(`${ru?'Помните':'Keep in mind'}: ${d.reminders.map(r=>`${r.name[l]} — ${r.note[ru?0:1]}`).join('; ')}.`);
 return out.join(' ');
}
// The same for a page (opts.when = [ru, en], a condition under which the tool applies it): a small block with the number, its sources and the reminders.
function html(c,opts,lang){
 const d=detail(c,opts),l=lang2(lang),ru=l==='ru',when=Array.isArray(opts?.when)&&opts.when.length===2?opts.when:null;if(!d.parts.length&&!d.reminders.length)return '';
 let h=`<div class="tool-effects" data-tool-effects="${d.mod}" role="note">`;
 if(d.parts.length)h+=`<p class="tool-effects-sum"><strong>${ru?'Эффекты листа':'Sheet effects'}: <span class="tool-effects-value">${d.mod?signed(d.mod):'0'}</span></strong> <span class="tool-effects-hint">${ru?'уже в броске — не вносите в модификатор':'already in the roll — do not enter it in the modifier'}${when?' · '+esc(when[ru?0:1]):''}</span></p><ul class="tool-effects-parts">${d.parts.map(p=>`<li>${esc(p.name[l])} <b>${signed(p.value)}</b></li>`).join('')}</ul>`;
 if(d.reminders.length)h+=`<p class="tool-effects-remind"><span>${ru?'Помните':'Keep in mind'}:</span> ${d.reminders.map(r=>`${esc(r.name[l])} — ${esc(r.note[ru?0:1])}`).join('; ')}</p>`;
 return h+'</div>';
}
/* Everything a tool needs for one roll. With no character (numbers typed by hand) every piece is empty.
   mod = the number; add(n) = n with the effects; label = tail for the roll label; line = '\n…' for the result text. */
function use(c,opts,lang){
 const d=isObject(c)?detail(c,opts):NONE,l=lang2(lang),n=d.mod;
 return {mod:n,parts:d.parts,add:value=>whole(value)?Math.max(-100,Math.min(100,value+n)):value,
  label:n?(l==='ru'?' · эффекты ':' · effects ')+signed(n):'',
  line:d.parts.length?`\n${l==='ru'?'Эффекты листа':'Sheet effects'}: ${n?signed(n):'0'} (${partsText(d,l)})`:''};
}
window.ToolEffects={detail,mod,apply,label,text,html,use};
})();
