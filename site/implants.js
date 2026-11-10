/* Cyberware that changes the sheet, and cyberware that is switched on.
   Sheet-changing implants (BODY, SP) are applied with one tap and every change is written down in
   extra.implants, so the same tap takes it back exactly. Switched-on cyberware (Sandevistan, the air
   supply) is a toggle with its time left and its cooldown; while a Sandevistan runs, the effects layer
   adds its Initiative bonus. Game time is counted by hand: the app does not know how long a scene lasts.
   Corebook: Sandevistan p. 112; Linear Frames p. 116; Grafted Muscle, Independent Air Supply p. 363;
   Skin Weave, Subdermal Armor p. 364.
   Saved shape (all optional): extra.implants = {version:1, seq, applied:{key:{catalogId,kind,seq,...}},
   body:{base,set}, active:{catalogId:{state,left}}}. Anything else in there is left alone. */
(function(){
'use strict';
// kind 'body': add = BODY bonus with a ceiling, set = BODY becomes at least this. kind 'sp': SP on head and body.
const SHEET={
 'cyberware-grafted-muscle-and-bone-lace':{kind:'body',add:2,cap:10,page:363},
 'cyberware-implanted-linear-frame-sigma':{kind:'body',set:12,page:116,needs:['Нужны BODY 6 и укрепление мышц и костей','Needs BODY 6 and Grafted Muscle and Bone Lace']},
 'cyberware-implanted-linear-frame-beta':{kind:'body',set:14,page:116,needs:['Нужны BODY 8 и два укрепления мышц и костей','Needs BODY 8 and two Grafted Muscle and Bone Lace']},
 'cyberware-skin-weave':{kind:'sp',sp:7,page:364},
 'cyberware-subdermal-armor':{kind:'sp',sp:11,page:364},
};
// unit = what the running time is counted in; duration in units; cooldown in minutes.
const TIMED={
 'cyberware-sandevistan':{unit:'round',duration:20,cooldown:60,initiative:3,page:112,steps:[1],cool:[1,10],
  on:['Включить (Action)','Switch on (Action)'],
  hint:['+3 к инициативе на минуту — это 20 раундов. Потом час перезарядки. Включили посреди боя — прибавьте +3 к своей инициативе в трекере.','+3 Initiative for a minute, which is 20 Rounds. Then an hour of cooldown. Switched on mid-fight? Add +3 to your Initiative in the tracker.'],
  cooling:['Перезарядка','Cooldown']},
 'cyberware-independent-air-supply':{unit:'minute',duration:30,cooldown:60,page:363,steps:[1,5],cool:[10],
  on:['Дышать из баллона','Breathe from the tank'],
  hint:['Воздуха на 30 минут. Пустой баллон наполняется час; сменить его на полный — Action (нажмите «Готов»).','30 minutes of air. An empty tank refills in an hour; swapping in a full one is an Action (press “Ready”).'],
  cooling:['Наполняется','Refilling']},
};
const LOCS=['head','body'];
const isObject=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
function int(v,min,max){if(typeof v!=='number'&&!(typeof v==='string'&&/^-?\d+$/.test(v.trim())))return null;const n=Number(v);return Number.isSafeInteger(n)&&n>=min&&n<=max?n:null}
function catalogItem(id){return (Array.isArray(globalThis.window?.CATALOG)?globalThis.window.CATALOG:[]).find(x=>x?.id===id)||null}
function itemName(id,lang){const name=catalogItem(id)?.name;return typeof name==='string'?name:name?.[lang==='en'?'en':'ru']||name?.en||String(id).replace(/^cyberware-/,'')}
const hpMax=c=>10+5*Math.ceil(((Number(c?.stats?.BODY)||0)+(Number(c?.stats?.WILL)||0))/2);

/* ---------- reading ---------- */
// The saved record, or null when it is missing or in a shape this version does not know.
function data(c){const x=c?.extra?.implants;return isObject(x)&&x.version===1?x:null}
// True when extra.implants holds something we must not write over.
function foreign(c){const x=c?.extra;if(x===undefined||x===null)return false;if(!isObject(x))return true;return x.implants!==undefined&&!data(c)}
function appliedMap(c){const a=data(c)?.applied;return isObject(a)?a:{}}
function appliedEntry(c,key){const a=appliedMap(c);const r=own(a,key)?a[key]:null;return isObject(r)&&typeof r.catalogId==='string'&&own(SHEET,r.catalogId)&&SHEET[r.catalogId].kind===r.kind?r:null}
// Every installed copy of a known implant: {key, catalogId}. Installed through the equipment tool, or part of a starting pack.
function instances(c,table){
 const out=[],x=isObject(c?.extra)?c.extra:{},installs=x.equipment?.installs,items=x.items;
 if(Array.isArray(installs))for(const i of installs){if(isObject(i)&&!i.removedAt&&typeof i.id==='string'&&i.id&&typeof i.catalogId==='string'&&own(table,i.catalogId))out.push({key:'i:'+i.id,catalogId:i.catalogId})}
 if(Array.isArray(items))for(const r of items){
  if(!isObject(r)||r.humanityLossIncluded!==true||typeof r.id!=='string'||!r.id||typeof r.catalogId!=='string'||!own(table,r.catalogId))continue;
  const n=Math.min(4,int(r.quantity,1,99999)||1);for(let k=0;k<n;k++)out.push({key:'r:'+r.id+':'+k,catalogId:r.catalogId});
 }
 const seen=new Set();return out.filter(v=>!seen.has(v.key)&&seen.add(v.key));
}
const sheetInstances=c=>instances(c,SHEET);
// Switched-on cyberware the character has, one entry per kind.
function timedInstalled(c){const seen=new Set();return instances(c,TIMED).filter(v=>!seen.has(v.catalogId)&&seen.add(v.catalogId)).map(v=>v.catalogId)}
// {state:'ready'|'active'|'cooldown', left} for a switched-on implant; unknown saved values read as ready.
function timedState(c,id){
 const spec=own(TIMED,id)?TIMED[id]:null,r=data(c)?.active,row=isObject(r)&&own(r,id)?r[id]:null;
 if(!spec||!isObject(row))return {state:'ready',left:0};
 if(row.state==='active'){const left=int(row.left,1,spec.duration);return left?{state:'active',left}:{state:'ready',left:0}}
 if(row.state==='cooldown'){const left=int(row.left,1,spec.cooldown);return left?{state:'cooldown',left}:{state:'ready',left:0}}
 return {state:'ready',left:0};
}
const isActive=(c,id)=>timedState(c,id).state==='active';
// BODY the applied implants give on top of `base`: bonuses first (each up to its ceiling), then frames.
function bodyFrom(base,ids){
 let b=base;const trail=[];
 const ordered=[...ids.filter(id=>SHEET[id]?.add),...ids.filter(id=>SHEET[id]?.set).sort((x,y)=>SHEET[x].set-SHEET[y].set)];
 for(const id of ordered){const s=SHEET[id],from=b;if(s.add)b=b>=s.cap?b:Math.min(s.cap,b+s.add);else b=Math.max(b,s.set);trail.push({catalogId:id,from,to:b})}
 return {value:b,trail};
}
function appliedBodyIds(c){return Object.keys(appliedMap(c)).map(k=>appliedEntry(c,k)).filter(r=>r&&r.kind==='body').sort((a,b)=>(Number(a.seq)||0)-(Number(b.seq)||0)).map(r=>r.catalogId)}
// What the sheet's BODY is made of right now, or null when no BODY implant is applied.
function bodyRecord(c){
 const d=data(c),b=d?.body,ids=appliedBodyIds(c);if(!ids.length||!isObject(b))return null;
 const base=int(b.base,0,20),set=int(b.set,0,20),cur=int(c?.stats?.BODY,0,20);if(base===null||set===null||cur===null)return null;
 // BODY edited by hand since the last tap: the edit belongs to the base. Not under a Linear Frame: there the sheet
 // value is the frame's, not base + bonus, so the difference says nothing about the base and the base is kept.
 const framed=bodyFrom(base,ids).trail.some(t=>SHEET[t.catalogId].set&&t.to>t.from);
 const shifted=framed?base:Math.max(0,Math.min(20,base+(cur-set)));
 return {base:shifted,current:cur,...bodyFrom(shifted,ids)};
}

/* ---------- writing ---------- */
function ensure(c){
 if(!isObject(c.extra))c.extra={};
 if(!data(c))c.extra.implants={version:1,seq:0,applied:{},active:{}};
 const d=c.extra.implants;if(!isObject(d.applied))d.applied={};if(!isObject(d.active))d.active={};if(int(d.seq,0,1e9)===null)d.seq=0;
 return d;
}
function tidy(c){const d=data(c);if(!d)return;if(isObject(d.applied)&&!Object.keys(d.applied).some(k=>appliedEntry(c,k)?.kind==='body'))delete d.body}
// Max HP follows BODY: a character at full HP stays full, and nobody is left above the new maximum.
function followHp(c,oldMax){const hp=Number(c.hp),max=hpMax(c);if(!Number.isFinite(hp)||max===oldMax)return null;const next=hp===oldMax?max:hp>max?max:hp;if(next===hp)return null;c.hp=next;return [hp,next]}
function writeBody(c,d,baseNow){
 const oldMax=hpMax(c),before=int(c.stats.BODY,0,20),ids=appliedBodyIds(c);
 const value=ids.length?bodyFrom(baseNow,ids).value:baseNow;
 c.stats.BODY=value;if(ids.length)d.body={base:baseNow,set:value};else delete d.body;
 return {from:before,to:value,hp:followHp(c,oldMax)};
}
const fail=(ru,en,lang)=>({ok:false,notify:lang==='en'?en:ru});
function slotWorn(c,loc){const a=c?.extra?.equipment?.armor;return isObject(a)&&a[loc]!==undefined&&a[loc]!==null}
const spGet=(c,loc)=>int(loc==='head'?c.head:c.bodyArmor,0,1000);
const spSet=(c,loc,v)=>{if(loc==='head')c.head=v;else c.bodyArmor=v};
// The highest SP an applied implant has written to this location, 0 when none has.
function spAt(c,loc){let best=0;for(const k of Object.keys(appliedMap(c))){const r=appliedEntry(c,k),to=r&&r.kind==='sp'&&isObject(r.sp?.[loc])?int(r.sp[loc].to,0,1000):null;if(to>best)best=to}return best}
// The location is recorded for this implant, but its SP is gone from the sheet (armor was worn over it and taken off).
function spLost(c,row,loc){const to=isObject(row?.sp?.[loc])?int(row.sp[loc].to,1,1000):null;return to!==null&&!slotWorn(c,loc)&&spGet(c,loc)===0&&to===spAt(c,loc)}
// Called by the equipment tool after armor comes off: the implant's SP is what is left on that location.
function afterUnequip(c,locs){
 if(!isObject(c)||foreign(c)||!Array.isArray(locs))return false;let changed=false;
 for(const loc of locs){if(!LOCS.includes(loc)||slotWorn(c,loc))continue;const sp=spAt(c,loc),cur=spGet(c,loc);if(sp>0&&cur!==null&&cur<sp){spSet(c,loc,sp);changed=true}}
 return changed;
}
const locName=(loc,lang)=>lang==='en'?(loc==='head'?'head':'body'):(loc==='head'?'голова':'тело');

function apply(c,key,lang){
 const l=lang==='en'?'en':'ru';
 if(!isObject(c)||!isObject(c.stats)||foreign(c))return fail('Запись об имплантах в неизвестном формате; лист не изменён.','The implant record is in an unknown format; the sheet was not changed.',l);
 const inst=sheetInstances(c).find(v=>v.key===key);if(!inst)return fail('Этот имплант не установлен.','That implant is not installed.',l);
 const spec=SHEET[inst.catalogId],had=appliedEntry(c,key),name=itemName(inst.catalogId,l);
 if(spec.kind==='body'){
  if(had)return fail('Уже учтено на листе.','Already applied to the sheet.',l);
  const cur=int(c.stats.BODY,0,20);if(cur===null)return fail('Проверьте BODY на листе.','Check BODY on the sheet.',l);
  const prior=bodyRecord(c),base=prior?prior.base:cur;
  if(bodyFrom(base,[...appliedBodyIds(c),inst.catalogId]).value===(prior?prior.value:base))return fail(`${name}: BODY уже ${cur}, имплант его не поднимет.`,`${name}: BODY is already ${cur}; this implant would not raise it.`,l);
  const d=ensure(c);d.seq=(int(d.seq,0,1e9)||0)+1;d.applied[key]={catalogId:inst.catalogId,kind:'body',seq:d.seq};
  const w=writeBody(c,d,base);d.applied[key].body=[w.from,w.to];if(w.hp)d.applied[key].hp=w.hp;
  return {ok:true,dirty:true,notify:`${name}: BODY ${w.from} → ${w.to}`+(w.hp?`, HP ${w.hp[0]} → ${w.hp[1]}`:'')};
 }
 // SP: only where no armor piece is tracked in the slot and the implant is the higher value.
 const done=isObject(had?.sp)?had.sp:{},changes={},skipped=[];
 for(const loc of LOCS){
  if(isObject(done[loc])){if(spLost(c,had,loc))changes[loc]={from:0,to:int(done[loc].to,1,1000),again:true};continue}
  const cur=spGet(c,loc);
  if(cur===null){skipped.push(l==='ru'?`${locName(loc,l)}: проверьте SP`:`${locName(loc,l)}: check SP`);continue}
  if(slotWorn(c,loc)){skipped.push(l==='ru'?`${locName(loc,l)}: надета броня SP ${cur} — ${cur>=spec.sp?'она выше или равна':'снимите её, чтобы записать SP импланта'}`:`${locName(loc,l)}: armor SP ${cur} is worn — ${cur>=spec.sp?'it is as high or higher':'take it off to record the implant’s SP'}`);continue}
  if(cur>=spec.sp){skipped.push(l==='ru'?`${locName(loc,l)}: SP уже ${cur}`:`${locName(loc,l)}: SP is already ${cur}`);continue}
  changes[loc]={from:cur,to:spec.sp};
 }
 if(!Object.keys(changes).length)return fail(`${name}: менять нечего.${skipped.length?' '+skipped.join('; ')+'.':''}`,`${name}: nothing to change.${skipped.length?' '+skipped.join('; ')+'.':''}`,l);
 const d=ensure(c);if(Object.values(changes).some(ch=>!ch.again))d.seq=(int(d.seq,0,1e9)||0)+1;
 const row=had||(d.applied[key]={catalogId:inst.catalogId,kind:'sp',seq:d.seq,sp:{}});if(!isObject(row.sp))row.sp={};
 for(const [loc,ch] of Object.entries(changes)){if(!ch.again)row.sp[loc]={...ch,seq:d.seq};spSet(c,loc,ch.to)}
 const text=Object.entries(changes).map(([loc,ch])=>`${locName(loc,l)} SP ${ch.from} → ${ch.to}`).join(', ');
 return {ok:true,dirty:true,notify:`${name}: ${text}`+(skipped.length?`. ${l==='ru'?'Не изменено':'Not changed'}: ${skipped.join('; ')}`:'')};
}
// A BODY bonus that was typed into BODY by hand before this card existed: the sheet stays as it is, and the
// implant is written down as applied with the base worked out backwards, so it is not added a second time.
function adoptBase(c,key){
 const inst=sheetInstances(c).find(v=>v.key===key),spec=inst&&SHEET[inst.catalogId];if(!spec?.add||appliedEntry(c,key)||foreign(c))return null;
 const cur=int(c?.stats?.BODY,0,20);if(cur===null)return null;
 const prior=bodyRecord(c),base=(prior?prior.base:cur)-spec.add;
 return base>=1&&bodyFrom(base,[...appliedBodyIds(c),inst.catalogId]).value===cur?{base,cur,catalogId:inst.catalogId}:null;
}
function adopt(c,key,lang){
 const l=lang==='en'?'en':'ru';
 if(!isObject(c)||!isObject(c.stats)||foreign(c))return fail('Запись об имплантах в неизвестном формате; лист не изменён.','The implant record is in an unknown format; the sheet was not changed.',l);
 const inst=sheetInstances(c).find(v=>v.key===key);if(!inst)return fail('Этот имплант не установлен.','That implant is not installed.',l);
 if(appliedEntry(c,key))return fail('Уже учтено на листе.','Already applied to the sheet.',l);
 const a=adoptBase(c,key),name=itemName(inst.catalogId,l);
 if(!a)return fail(`${name}: BODY на листе не мог получиться с этим имплантом. Поправьте BODY вручную.`,`${name}: the BODY on the sheet could not have come from this implant. Correct BODY by hand.`,l);
 const d=ensure(c);d.seq=(int(d.seq,0,1e9)||0)+1;
 d.applied[key]={catalogId:a.catalogId,kind:'body',seq:d.seq,body:[a.cur,a.cur],adopted:true};d.body={base:a.base,set:a.cur};
 return {ok:true,dirty:true,notify:l==='ru'?`${name}: отмечено, что BODY ${a.cur} уже включает имплант (без него ${a.base}). Лист не изменён.`:`${name}: noted that BODY ${a.cur} already includes the implant (${a.base} without it). The sheet was not changed.`};
}
function undo(c,key,lang){
 const l=lang==='en'?'en':'ru';
 if(!isObject(c)||!isObject(c.stats)||foreign(c))return fail('Запись об имплантах в неизвестном формате; лист не изменён.','The implant record is in an unknown format; the sheet was not changed.',l);
 const row=appliedEntry(c,key);if(!row)return fail('Отменять нечего.','Nothing to undo.',l);
 const d=data(c),name=itemName(row.catalogId,l);
 if(row.kind==='body'){
  const prior=bodyRecord(c);if(!prior)return fail('Проверьте BODY на листе.','Check BODY on the sheet.',l);
  delete d.applied[key];const w=writeBody(c,d,prior.base);tidy(c);
  return {ok:true,dirty:true,notify:`${name}: ${l==='ru'?'отменено':'undone'}, BODY ${w.from} → ${w.to}`+(w.hp?`, HP ${w.hp[0]} → ${w.hp[1]}`:'')};
 }
 const mine=isObject(row.sp)?row.sp:{},parts=[];
 // A later implant raised the same location from our value: taking ours back first would lose its starting point.
 for(const loc of LOCS){if(!isObject(mine[loc]))continue;const later=Object.keys(appliedMap(c)).map(k=>appliedEntry(c,k)).find(r=>r&&r!==row&&r.kind==='sp'&&isObject(r.sp?.[loc])&&(Number(r.sp[loc].seq)||0)>(Number(mine[loc].seq)||0));if(later)return fail(`Сначала отмените «${itemName(later.catalogId,l)}»: он записан поверх.`,`Undo “${itemName(later.catalogId,l)}” first: it was applied on top.`,l)}
 for(const loc of LOCS){
  const ch=mine[loc];if(!isObject(ch))continue;
  const from=int(ch.from,0,1000),to=int(ch.to,0,1000),cur=spGet(c,loc);
  if(from===null||to===null||cur===null||slotWorn(c,loc)||cur>to){parts.push(l==='ru'?`${locName(loc,l)}: SP ${cur??'?'} не тронут (сейчас там другая броня)`:`${locName(loc,l)}: SP ${cur??'?'} left as is (other armor is there now)`);continue}
  spSet(c,loc,from);parts.push(`${locName(loc,l)} SP ${cur} → ${from}`);
 }
 delete d.applied[key];tidy(c);
 return {ok:true,dirty:true,notify:`${name}: ${l==='ru'?'отменено':'undone'}, ${parts.join(', ')}`};
}
// Switched-on cyberware. op: on, tick (running time passes), off, cool (cooldown minutes pass), ready.
function timed(c,id,op,amount,lang){
 const l=lang==='en'?'en':'ru',spec=own(TIMED,id)?TIMED[id]:null;
 if(!isObject(c)||!spec||foreign(c))return fail('Запись об имплантах в неизвестном формате; лист не изменён.','The implant record is in an unknown format; the sheet was not changed.',l);
 if(!timedInstalled(c).includes(id))return fail('Этот имплант не установлен.','That implant is not installed.',l);
 const st=timedState(c,id),name=itemName(id,l),n=int(amount,1,1000)||1;
 const put=row=>{const d=ensure(c);if(row)d.active[id]=row;else delete d.active[id]};
 const cooling=()=>{put({state:'cooldown',left:spec.cooldown});return {ok:true,dirty:true,notify:`${name}: ${l==='ru'?`выключен, ${spec.cooling[0].toLowerCase()} ${spec.cooldown} мин`:`off, ${spec.cooling[1].toLowerCase()} ${spec.cooldown} min`}`}};
 if(op==='on'){
  if(st.state==='active')return fail('Уже включён.','Already on.',l);
  if(st.state==='cooldown')return fail(`${name}: ${spec.cooling[0].toLowerCase()}, ещё ${st.left} мин.`,`${name}: ${spec.cooling[1].toLowerCase()}, ${st.left} min left.`,l);
  put({state:'active',left:spec.duration});
  return {ok:true,dirty:true,notify:`${name}: ${l==='ru'?'включён':'on'}`+(spec.initiative?`, ${l==='ru'?`+${spec.initiative} к инициативе`:`+${spec.initiative} Initiative`}`:'')};
 }
 if(op==='tick'){if(st.state!=='active')return fail('Имплант не включён.','The implant is not on.',l);const left=st.left-n;if(left<=0)return cooling();put({state:'active',left});return {ok:true,dirty:true}}
 if(op==='off'){if(st.state!=='active')return fail('Имплант не включён.','The implant is not on.',l);return cooling()}
 if(op==='cool'){if(st.state!=='cooldown')return fail('Перезарядка не идёт.','No cooldown is running.',l);const left=st.left-n;if(left<=0){put(null);return {ok:true,dirty:true,notify:`${name}: ${l==='ru'?'готов':'ready'}`}}put({state:'cooldown',left});return {ok:true,dirty:true}}
 if(op==='ready'){if(st.state==='ready')return fail('Уже готов.','Already ready.',l);put(null);return {ok:true,dirty:true,notify:`${name}: ${l==='ru'?'готов':'ready'}`}}
 return {ok:false};
}

/* ---------- effects layer ---------- */
function timedNote(c,id){
 const spec=TIMED[id],st=timedState(c,id),u=spec.unit==='round'?['раунд.','Rounds']:['мин','min'];
 if(st.state==='active')return [`включён, осталось ${st.left} ${u[0]}`,`on, ${st.left} ${u[1]} left`];
 if(st.state==='cooldown')return [`${spec.cooling[0].toLowerCase()}, ещё ${st.left} мин`,`${spec.cooling[1].toLowerCase()}, ${st.left} min left`];
 return spec.initiative?[`готов: включение (Action) даёт +${spec.initiative} к инициативе на минуту`,`ready: switching on (an Action) gives +${spec.initiative} Initiative for a minute`]:['готов','ready'];
}
function sheetNote(c,id){
 const rows=Object.keys(appliedMap(c)).map(k=>appliedEntry(c,k)).filter(r=>r&&r.catalogId===id);if(!rows.length)return null;
 if(SHEET[id].kind==='body'){const rec=bodyRecord(c);return rec?[`учтено на листе: BODY ${rec.base} → ${rec.current}`,`applied to the sheet: BODY ${rec.base} → ${rec.current}`]:null}
 const locs=LOCS.filter(loc=>rows.some(r=>isObject(r.sp?.[loc])));if(!locs.length)return null;
 return [`SP ${SHEET[id].sp} записан на листе (${locs.map(x=>locName(x,'ru')).join(', ')}); в каждой зоне действует наибольший SP`,`SP ${SHEET[id].sp} is written on the sheet (${locs.map(x=>locName(x,'en')).join(', ')}); the highest SP in each location counts`];
}
// Called by Effects.collect: adds the running Sandevistan to Initiative and rewrites the reminders this module has made good on.
function contribute(c,total){
 if(!isObject(total)||!Array.isArray(total.sources))return;
 const table=globalThis.window?.Effects?.CYBER||{},find=id=>total.sources.find(s=>s&&s.kind==='cyber'&&own(table,id)&&s.parts===table[id]);
 for(const id of timedInstalled(c)){
  const spec=TIMED[id],on=isActive(c,id);if(!spec.initiative&&!find(id))continue;
  if(on&&spec.initiative)total.initiative=(Number(total.initiative)||0)+spec.initiative;
  const src={kind:'cyber',name:{ru:itemName(id,'ru'),en:itemName(id,'en')},parts:on&&spec.initiative?{initiative:spec.initiative}:{},note:timedNote(c,id)},old=find(id);
  if(old)total.sources[total.sources.indexOf(old)]=src;else total.sources.push(src);
 }
 for(const id of Object.keys(SHEET)){const old=find(id),note=old&&sheetNote(c,id);if(note)total.sources[total.sources.indexOf(old)]={...old,parts:{},note}}
}

/* ---------- rendering ---------- */
let focusKey='';
const btn=(op,key,label,cls,extra)=>`<button type="button" class="btn ${cls||'ghost'} small imp-btn" data-action="implant" data-imp-op="${op}" data-imp-key="${esc(key)}"${extra||''}>${esc(label)}</button>`;
function describe(id,l){
 const s=SHEET[id],ru=l==='ru';
 if(s.add)return ru?`BODY +${s.add}, но не выше ${s.cap}`:`BODY +${s.add}, up to ${s.cap}`;
 if(s.set)return ru?`BODY становится ${s.set}`:`BODY becomes ${s.set}`;
 return ru?`SP ${s.sp} на голове и теле, если там нет брони выше`:`SP ${s.sp} on head and body unless higher armor is there`;
}
function recordLines(c,key,l){
 const row=appliedEntry(c,key),ru=l==='ru';if(!row)return [];
 if(row.kind==='body'){
  const out=[];if(row.adopted===true)out.push(ru?'BODY на листе уже включал имплант':'BODY on the sheet already included the implant');
  else if(Array.isArray(row.body)&&row.body.length===2)out.push(`BODY ${esc(row.body[0])} → ${esc(row.body[1])}`);
  if(Array.isArray(row.hp)&&row.hp.length===2)out.push(`HP ${esc(row.hp[0])} → ${esc(row.hp[1])}`);
  return out;
 }
 return LOCS.map(loc=>{const ch=row.sp?.[loc];return isObject(ch)?`${esc(locName(loc,l))}: SP ${esc(ch.from)} → ${esc(ch.to)}`:`${esc(locName(loc,l))}: ${ru?'не менялось':'not changed'}`});
}
// The sheet-changing implants: one row per installed copy, with the change it made and the tap that takes it back.
function render(c,lang){
 if(!isObject(c))return '';
 const l=lang==='en'?'en':'ru',ru=l==='ru',list=sheetInstances(c),keys=new Set(list.map(v=>v.key));
 const orphans=Object.keys(appliedMap(c)).filter(k=>!keys.has(k)&&appliedEntry(c,k));
 if(!list.length&&!orphans.length)return '';
 if(foreign(c))return `<section class="card imp-root" id="sheet-implants"><div class="card-heading"><span>${ru?'Импланты, меняющие лист':'Cyberware that changes the sheet'}</span><span>CYBERWARE</span></div><p class="imp-hint">${ru?'Запись об имплантах сохранена в неизвестном формате. Данные не тронуты; меняйте BODY и SP вручную.':'The implant record is saved in an unknown format. The data is untouched; change BODY and SP by hand.'}</p></section>`;
 const row=(key,id,gone)=>{
  const on=!!appliedEntry(c,key),s=SHEET[id],lines=recordLines(c,key,l);
  const missing=on&&s.kind==='sp'&&LOCS.some(loc=>!isObject(appliedEntry(c,key).sp?.[loc])&&!slotWorn(c,loc)&&spGet(c,loc)!==null&&spGet(c,loc)<s.sp);
  const lost=on&&s.kind==='sp'?LOCS.filter(loc=>spLost(c,appliedEntry(c,key),loc)):[],partial=missing||lost.length>0;
  const canAdopt=!on&&!gone&&!!adoptBase(c,key);
  return `<div class="imp-row${on?' is-on':''}" data-imp-row="${esc(key)}"><div class="imp-main"><strong>${esc(itemName(id,l))}</strong><span class="imp-state">${on?(ru?'Учтено на листе':'Applied to the sheet'):(ru?'Не учтено':'Not applied')}</span><small>${esc(describe(id,l))} · ${ru?'стр.':'p.'} ${s.page}${s.needs?' · '+esc(s.needs[ru?0:1]):''}</small>${gone?`<small class="imp-warn">${ru?'Имплант снят, а его изменение ещё на листе — отмените его.':'The implant was removed but its change is still on the sheet — undo it.'}</small>`:''}${lost.length?`<small class="imp-warn">${esc(ru?`SP импланта пропал с листа (${lost.map(x=>locName(x,l)).join(', ')}: сейчас 0) — верните его.`:`The implant’s SP is gone from the sheet (${lost.map(x=>locName(x,l)).join(', ')}: 0 now) — put it back.`)}</small>`:''}${canAdopt?`<small class="imp-note">${ru?'Уже подняли BODY вручную? Нажмите «Уже в BODY», и бонус не прибавится второй раз.':'Already raised BODY by hand? Press “Already in BODY” and the bonus will not be added twice.'}</small>`:''}${lines.length?`<ul class="imp-record" aria-label="${ru?'Что изменено':'What was changed'}">${lines.map(x=>`<li>${x}</li>`).join('')}</ul>`:''}</div><div class="imp-actions">${on?btn('undo',key,ru?'Отменить':'Undo','ghost',` aria-label="${esc((ru?'Отменить: ':'Undo: ')+itemName(id,l))}"`):''}${!gone&&(!on||partial)?btn('apply',key,on?(missing?(ru?'Дописать SP':'Add the SP'):(ru?'Вернуть SP':'Restore the SP')):(ru?'Применить':'Apply'),'primary',` aria-label="${esc((ru?'Применить к листу: ':'Apply to the sheet: ')+itemName(id,l))}"`):''}${canAdopt?btn('adopt',key,ru?'Уже в BODY':'Already in BODY','ghost',` aria-label="${esc((ru?'BODY на листе уже включает имплант: ':'BODY on the sheet already includes: ')+itemName(id,l))}"`):''}</div></div>`;
 };
 const rec=bodyRecord(c);
 const trail=rec?`<p class="imp-trail" data-imp-trail><b>BODY ${rec.base}</b> ${ru?'(без имплантов)':'(without implants)'}${rec.trail.map(t=>` → ${esc(itemName(t.catalogId,l))}: <b>${t.to}</b>`).join('')}${rec.current!==rec.value?` · ${ru?`на листе сейчас ${rec.current}`:`the sheet says ${rec.current}`}`:''}</p>`:'';
 return `<section class="card imp-root" id="sheet-implants"><div class="card-heading"><span>${ru?'Импланты, меняющие лист':'Cyberware that changes the sheet'}</span><span>CYBERWARE</span></div><p class="imp-hint">${ru?'Одно нажатие меняет BODY или SP на листе и записывает, что было. «Отменить» возвращает прежние значения. Макс. HP и Death Save следуют за BODY.':'One tap changes BODY or SP on the sheet and writes down what was there. “Undo” puts the old values back. Max HP and the Death Save follow BODY.'}</p>${trail}${list.map(v=>row(v.key,v.catalogId,false)).join('')}${orphans.map(k=>row(k,appliedEntry(c,k).catalogId,true)).join('')}</section>`;
}
// Switched-on cyberware: state, time left and the buttons that move it. Empty when the character has none.
function renderActive(c,lang){
 if(!isObject(c)||foreign(c))return '';
 const l=lang==='en'?'en':'ru',ru=l==='ru',i=ru?0:1,ids=timedInstalled(c);if(!ids.length)return '';
 const rows=ids.map(id=>{
  const spec=TIMED[id],st=timedState(c,id),unit=spec.unit==='round'?(ru?'раунд.':'Rounds'):(ru?'мин':'min'),minute=ru?'мин':'min';
  const total=st.state==='active'?spec.duration:spec.cooldown,pct=st.state==='ready'?0:Math.round(st.left/total*100);
  const label=st.state==='active'?(ru?'Включён':'On'):st.state==='cooldown'?spec.cooling[i]:(ru?'Готов':'Ready');
  const left=st.state==='active'?`${ru?'осталось':'left'}: <b>${st.left}</b> ${unit}`:st.state==='cooldown'?`${ru?'ещё':'left'}: <b>${st.left}</b> ${minute}`:'';
  const buttons=st.state==='ready'?btn('on',id,spec.on[i],'primary',' aria-pressed="false"')
   :st.state==='active'?spec.steps.map(n=>btn('tick',id,`−${n} ${unit}`,'ghost',` data-imp-n="${n}" aria-label="${esc(ru?`Прошло: ${n} ${unit}`:`Passed: ${n} ${unit}`)}"`)).join('')+btn('off',id,ru?'Выключить':'Switch off','primary',' aria-pressed="true"')
   :spec.cool.map(n=>btn('cool',id,`−${n} ${minute}`,'ghost',` data-imp-n="${n}" aria-label="${esc(ru?`Прошло минут: ${n}`:`Minutes passed: ${n}`)}"`)).join('')+btn('ready',id,ru?'Готов':'Ready','ghost');
  return `<div class="imp-row imp-timed" data-imp-timed="${esc(id)}" data-imp-state="${st.state}"><div class="imp-main"><strong>${esc(itemName(id,l))}</strong><span class="imp-state" role="status">${esc(label)}${left?' · '+left:''}</span>${st.state==='active'&&spec.initiative?`<span class="imp-bonus">${ru?`+${spec.initiative} к инициативе`:`+${spec.initiative} Initiative`}</span>`:''}${st.state!=='ready'?`<span class="imp-bar" aria-hidden="true"><i style="width:${pct}%"></i></span>`:''}<small>${esc(spec.hint[i])} ${ru?'Стр.':'P.'} ${spec.page}.</small></div><div class="imp-actions">${buttons}</div></div>`;
 }).join('');
 return `<section class="card imp-root imp-active" id="sheet-implants-active"><div class="card-heading"><span>${ru?'Включаемые импланты':'Switched-on cyberware'}</span><span>CYBERWARE</span></div>${rows}</section>`;
}
// BODY or SP was typed into the sheet: draw the card again so the BODY chain and the buttons match the sheet.
function refresh(c,lang){
 const doc=globalThis.document,el=doc?.getElementById?.('sheet-implants');if(!el||(doc.activeElement&&el.contains?.(doc.activeElement)))return false;
 const html=render(c,lang);if(!html)return false;el.outerHTML=html;return true;
}
// One click from the sheet. `ds` is the button's dataset. Returns {dirty, notify}.
function act(c,ds,lang){
 const op=ds?.impOp,key=typeof ds?.impKey==='string'?ds.impKey:'';let r;
 if(op==='apply')r=apply(c,key,lang);else if(op==='undo')r=undo(c,key,lang);else if(op==='adopt')r=adopt(c,key,lang);
 else if(['on','tick','off','cool','ready'].includes(op))r=timed(c,key,op,ds.impN,lang);else return {ok:false};
 // The sheet is drawn again after a change: put the keyboard focus back on the same row.
 if(r.dirty){focusKey=key;try{globalThis.setTimeout?.(()=>{const k=focusKey;focusKey='';const doc=globalThis.document;if(!doc?.querySelectorAll||(doc.activeElement&&doc.activeElement!==doc.body))return;for(const el of doc.querySelectorAll('[data-action="implant"]')){if(el.dataset.impKey===k){el.focus({preventScroll:true});break}}},0)}catch{}}
 return r;
}
window.Implants={SHEET,TIMED,instances:sheetInstances,timedInstalled,timedState,isActive,bodyFrom,bodyRecord,spAt,afterUnequip,apply,adopt,undo,timed,refresh,contribute,render,renderActive,act};
})();
