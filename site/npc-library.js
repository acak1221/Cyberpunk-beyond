/* GM NPC library: reusable custom NPCs saved in state.gmExtras.npcLibrary (cap 100). An entry can be
   copied N times into a campaign roster as kind:'npc' with auto-numbered names. Original UI text. */
(function(){
'use strict';
const MAX=100,MAX_NAME=60,MAX_WEAPONS=300,MAX_NOTES=500,MAX_COPIES=20,MAX_ROSTER=2045;
const T={
 ru:{title:'Библиотека NPC',sub:'СВОИ ПРОТИВНИКИ',intro:'Сохраняйте заготовки противников и добавляйте их в бой пачкой: имена нумеруются сами («Ганк 1», «Ганк 2»…). Данные хранятся в этом браузере.',empty:'Библиотека пуста. Создайте первую заготовку ниже.',name:'Название',namePh:'Например, Ганк',ref:'REF',body:'BODY',will:'WILL',hp:'HP',calc:'HP из BODY/WILL',head:'Броня головы (SP)',torso:'Броня тела (SP)',weapons:'Оружие (текстом)',weaponsPh:'Пистолет 2d6, нож 1d6…',skills:'Навыки для бросков',skillsPh:'Пистолеты 10\nУклонение 7',skillsHelp:'По одному в строке: название и итог (характеристика + навык), как в книжных шаблонах.',attacks:'Атаки',attacksPh:'Тяжёлый пистолет 10 3d6',attacksHelp:'По одной в строке: название, итог атаки и урон в кубиках (например 3d6).',badLine:l=>`Не удалось разобрать строку: «${l}».`,rollAttack:'атака',rollDamage:'урон',notes:'Заметки',save:'Сохранить',create:'Создать NPC',cancel:'Отмена',edit:'Изменить',clone:'Клонировать',del:'Удалить',sure:'Точно удалить?',copy:'(копия)',campaign:'Кампания',count:'Сколько',addTo:'Добавить в кампанию',noCampaign:'Нет кампаний — создайте её в разделе «Кампании»',full:'Библиотека заполнена (100)',needName:'Нужно название',added:(n,c)=>`Добавлено в «${c}»: ${n}`,rosterFull:'Ростер кампании переполнен',sp:'SP',editing:'Редактирование'},
 en:{title:'NPC library',sub:'YOUR OWN OPPONENTS',intro:'Save opponent presets and drop them into a fight in batches: names number themselves (“Goon 1”, “Goon 2”…). Data stays in this browser.',empty:'The library is empty. Create the first preset below.',name:'Name',namePh:'e.g. Goon',ref:'REF',body:'BODY',will:'WILL',hp:'HP',calc:'HP from BODY/WILL',head:'Head armor (SP)',torso:'Body armor (SP)',weapons:'Weapons (free text)',weaponsPh:'Pistol 2d6, knife 1d6…',skills:'Skills to roll',skillsPh:'Handgun 10\nEvasion 7',skillsHelp:'One per line: the name and the total (STAT + Skill), as in the book templates.',attacks:'Attacks',attacksPh:'Heavy Pistol 10 3d6',attacksHelp:'One per line: the name, the attack total and the damage dice (for example 3d6).',badLine:l=>`Could not read the line: “${l}”.`,rollAttack:'attack',rollDamage:'damage',notes:'Notes',save:'Save',create:'New NPC',cancel:'Cancel',edit:'Edit',clone:'Clone',del:'Delete',sure:'Really delete?',copy:'(copy)',campaign:'Campaign',count:'How many',addTo:'Add to campaign',noCampaign:'No campaigns yet — create one in Campaigns',full:'Library is full (100)',needName:'A name is required',added:(n,c)=>`Added to “${c}”: ${n}`,rosterFull:'Campaign roster is full',sp:'SP',editing:'Editing'}
};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function line(v,max){return typeof v==='string'?v.replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max):''}
function para(v,max){return typeof v==='string'?v.replace(/\r/g,'').replace(/[\u0000-\u0009\u000b\u000c\u000e-\u001f\u007f]/g,'').trim().slice(0,max):''}
function int(v,lo,hi,d){const n=typeof v==='number'?v:typeof v==='string'&&/^\s*-?\d+\s*$/.test(v)?Number(v):NaN;return Number.isFinite(n)?Math.min(hi,Math.max(lo,Math.trunc(n))):d}
function hpFromStats(body,will){const b=int(body,1,20,NaN),w=int(will,1,20,NaN);return Number.isFinite(b)&&Number.isFinite(w)?10+5*Math.ceil((b+w)/2):null}
let seq=0;
function newId(){return 'npc-'+Date.now().toString(36)+'-'+(seq++).toString(36)+Math.floor(Math.random()*1296).toString(36)}
// Skills and attacks a preset can roll: {name, base} and {name, base, damage}. `base` is the whole bonus (STAT + Skill).
const MAX_SKILLS=12,MAX_ATTACKS=6,MAX_ITEM=40,DICE=/^(\d{1,2})d(6|10)$/;
function cleanSkills(v){const out=[];for(const x of Array.isArray(v)?v:[]){const name=line(x?.name,MAX_ITEM),base=int(x?.base,0,40,NaN);if(name&&Number.isFinite(base))out.push({name,base});if(out.length>=MAX_SKILLS)break}return out}
function cleanAttacks(v){const out=[];for(const x of Array.isArray(v)?v:[]){const name=line(x?.name,MAX_ITEM),base=int(x?.base,0,40,NaN),damage=typeof x?.damage==='string'?x.damage.trim().toLowerCase():'';if(name&&Number.isFinite(base)&&DICE.test(damage)&&Number(DICE.exec(damage)[1])>=1)out.push({name,base,damage});if(out.length>=MAX_ATTACKS)break}return out}
// The form takes them as lines of text: «Handgun 10», «Heavy Pistol 10 3d6». Lines that cannot be read are returned in `bad`.
function parseLines(text,pattern,make,max){const list=[],bad=[];for(const raw of String(text??'').split('\n')){const l=line(raw,90);if(!l)continue;const m=pattern.exec(l),item=m?make(m):null;if(item&&item.name&&list.length<max)list.push(item);else bad.push(l)}return {list,bad}}
const parseSkills=text=>parseLines(text,/^(.+?)[\s:+]+(\d{1,2})$/,m=>({name:line(m[1],MAX_ITEM),base:int(m[2],0,40,0)}),MAX_SKILLS);
const parseAttacks=text=>parseLines(text,/^(.+?)[\s:+]+(\d{1,2})[\s,;]+(\d{1,2}d(?:6|10))$/i,m=>({name:line(m[1],MAX_ITEM),base:int(m[2],0,40,0),damage:m[3].toLowerCase()}),MAX_ATTACKS);
const skillsText=list=>cleanSkills(list).map(x=>`${x.name} ${x.base}`).join('\n'),attacksText=list=>cleanAttacks(list).map(x=>`${x.name} ${x.base} ${x.damage}`).join('\n');
function cleanEntry(e){
 if(!e||typeof e!=='object'||Array.isArray(e))return null;
 const id=typeof e.id==='string'&&/^[A-Za-z0-9_-]{1,40}$/.test(e.id)?e.id:null,name=line(e.name,MAX_NAME);
 if(!id||!name)return null;
 const o={id,name,ref:int(e.ref,0,20,6),hp:int(e.hp,0,999,30),head:int(e.head,0,30,0),torso:int(e.torso,0,30,0),weapons:para(e.weapons,MAX_WEAPONS),notes:para(e.notes,MAX_NOTES)};
 const b=int(e.body,0,20,0),w=int(e.will,0,20,0);if(b)o.body=b;if(w)o.will=w;
 const skills=cleanSkills(e.skills),attacks=cleanAttacks(e.attacks);if(skills.length)o.skills=skills;if(attacks.length)o.attacks=attacks;
 return o;
}
function readLibrary(state){
 const raw=state&&state.gmExtras&&typeof state.gmExtras==='object'&&!Array.isArray(state.gmExtras)?state.gmExtras.npcLibrary:null;
 if(!Array.isArray(raw))return [];
 const out=[],seen=new Set();
 for(const e of raw){const x=cleanEntry(e);if(x&&!seen.has(x.id)){seen.add(x.id);out.push(x)}if(out.length>=MAX)break}
 return out;
}
function writeLibrary(state,list){
 if(!state||typeof state!=='object')return false;
 if(!state.gmExtras||typeof state.gmExtras!=='object'||Array.isArray(state.gmExtras))state.gmExtras={};
 state.gmExtras.npcLibrary=list.map(cleanEntry).filter(Boolean).slice(0,MAX);
 return true;
}
// Opponents from «Свои материалы» (custom-content.js): shown after the library's own presets, read-only here.
function customEntries(){try{return (window.CustomContent?.npcEntries?.()||[]).map(cleanEntry).filter(Boolean)}catch(_){return []}}
function findEntry(id){return readLibrary(appState()).find(x=>x.id===id)||customEntries().find(x=>x.id===id)}
function addEntry(list,draft,id=newId()){if(list.length>=MAX)return {list,ok:false,reason:'full'};const e=cleanEntry({...draft,id});if(!e)return {list,ok:false,reason:'name'};return {list:[...list,e],ok:true,entry:e}}
function updateEntry(list,id,draft){const e=cleanEntry({...draft,id});if(!e)return {list,ok:false,reason:'name'};if(!list.some(x=>x.id===id))return {list,ok:false,reason:'missing'};return {list:list.map(x=>x.id===id?e:x),ok:true,entry:e}}
function removeEntry(list,id){const out=list.filter(x=>x.id!==id);return {list:out,ok:out.length!==list.length}}
function cloneEntry(list,id,lang,newid=newId()){
 const src=list.find(x=>x.id===id);if(!src)return {list,ok:false,reason:'missing'};
 if(list.length>=MAX)return {list,ok:false,reason:'full'};
 const suffix=' '+T[lang==='en'?'en':'ru'].copy,name=src.name.slice(0,MAX_NAME-suffix.length).trim()+suffix;
 const e=cleanEntry({...src,id:newid,name});const i=list.findIndex(x=>x.id===id);
 const out=list.slice();out.splice(i+1,0,e);return {list:out,ok:true,entry:e};
}
// Names "Base 1".."Base N", continuing after the highest number already used for the same base.
function numberedNames(base,count,roster){
 const b=line(base,MAX_NAME),n=int(count,1,MAX_COPIES,1),re=new RegExp('^'+b.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+' (\\d+)$');
 let max=0;for(const r of Array.isArray(roster)?roster:[]){const m=r&&r.kind==='npc'&&typeof r.name==='string'?re.exec(r.name):null;if(m)max=Math.max(max,Number(m[1])||0)}
 return Array.from({length:n},(_,i)=>`${b} ${max+i+1}`);
}
function combatNote(e,lang){
 const t=T[lang==='en'?'en':'ru'],parts=[];
 if(e.head||e.torso)parts.push(`${t.sp} ${e.head}/${e.torso}`);
 if(e.attacks?.length)parts.push(e.attacks.map(a=>`${a.name} +${a.base} ${a.damage}`).join('; '));
 if(e.weapons)parts.push(e.weapons.replace(/\s*\n\s*/g,'; '));
 if(e.notes)parts.push(e.notes.replace(/\s*\n\s*/g,' '));
 return parts.join(' · ').slice(0,300);
}
function rosterEntries(e,count,roster,lang,uid,now=Date.now()){
 const names=numberedNames(e.name,count,roster),note=combatNote(e,lang);
 return names.map((name,i)=>{const r={id:uid(),kind:'npc',name,ref:e.ref,hp:e.hp,maxHp:e.hp,initiative:0,order:now+i,sourceLibrary:e.id};if(note)r.combatNote={version:1,text:note};
  // Armor and BODY travel with the combatant, for damage and Death Saves in the tracker.
  if(e.head||e.torso)r.sp={head:e.head,body:e.torso};if(e.body)r.body=e.body;return r});
}
function addToCampaign(campaign,e,count,lang,uid,now){
 if(!campaign||!Array.isArray(campaign.roster))return {ok:false,reason:'campaign',added:[]};
 const n=int(count,1,MAX_COPIES,1);
 if(campaign.roster.length+n>MAX_ROSTER)return {ok:false,reason:'roster',added:[]};
 const added=rosterEntries(e,n,campaign.roster,lang,uid,now);
 for(const r of added)campaign.roster.push(r);
 return {ok:true,added};
}

// ---------- UI ----------
let ui={editing:null,draft:null,armed:null,pickCampaign:{}};
const EMPTY=()=>({name:'',ref:6,body:'',will:'',hp:30,head:0,torso:0,weapons:'',notes:'',skillsText:'',attacksText:''});
function appState(){return typeof window!=='undefined'&&window.App&&typeof window.App.getState==='function'?window.App.getState():null}
function numField(l,key,v,min,max){return `<label class="field">${esc(l)}<input type="number" inputmode="numeric" min="${min}" max="${max}" data-nl-field="${key}" value="${esc(v)}"></label>`}
function formHtml(t){
 const d=ui.draft;if(!d)return `<button type="button" class="btn primary" data-nl-action="new">＋ ${esc(t.create)}</button>`;
 return `<div class="nl-form" data-nl-form>${ui.editing?`<p class="overline">${esc(t.editing)}</p>`:''}<label class="field">${esc(t.name)}<input type="text" maxlength="${MAX_NAME}" data-nl-field="name" placeholder="${esc(t.namePh)}" value="${esc(d.name)}"></label><div class="nl-grid">${numField(t.ref,'ref',d.ref,0,20)}${numField(t.body,'body',d.body,0,20)}${numField(t.will,'will',d.will,0,20)}${numField(t.hp,'hp',d.hp,0,999)}${numField(t.head,'head',d.head,0,30)}${numField(t.torso,'torso',d.torso,0,30)}</div><div class="nl-row"><button type="button" class="btn ghost" data-nl-action="calc">${esc(t.calc)}</button></div><label class="field">${esc(t.skills)}<textarea rows="3" maxlength="700" data-nl-field="skillsText" placeholder="${esc(t.skillsPh)}">${esc(d.skillsText)}</textarea><small class="gx-note">${esc(t.skillsHelp)}</small></label><label class="field">${esc(t.attacks)}<textarea rows="2" maxlength="500" data-nl-field="attacksText" placeholder="${esc(t.attacksPh)}">${esc(d.attacksText)}</textarea><small class="gx-note">${esc(t.attacksHelp)}</small></label><label class="field">${esc(t.weapons)}<textarea rows="2" maxlength="${MAX_WEAPONS}" data-nl-field="weapons" placeholder="${esc(t.weaponsPh)}">${esc(d.weapons)}</textarea></label><label class="field">${esc(t.notes)}<textarea rows="3" maxlength="${MAX_NOTES}" data-nl-field="notes">${esc(d.notes)}</textarea></label><div class="nl-row"><button type="button" class="btn primary" data-nl-action="save">${esc(t.save)}</button><button type="button" class="btn ghost" data-nl-action="cancel">${esc(t.cancel)}</button></div></div>`;
}
function entryHtml(e,t,campaigns,custom){
 const pick=ui.pickCampaign[e.id]||{},sel=campaigns.some(c=>c.id===pick.id)?pick.id:(campaigns[0]?.id||'');
 const stats=`${t.ref} ${e.ref} · ${t.hp} ${e.hp}${e.body||e.will?` · ${t.body}/${t.will} ${e.body||'–'}/${e.will||'–'}`:''} · ${t.sp} ${e.head}/${e.torso}`;
 const add=campaigns.length?`<div class="nl-add"><label class="field">${esc(t.campaign)}<select data-nl-pick="${esc(e.id)}">${campaigns.map(c=>`<option value="${esc(c.id)}"${c.id===sel?' selected':''}>${esc(c.name||'—')}</option>`).join('')}</select></label><label class="field">${esc(t.count)}<input type="number" inputmode="numeric" min="1" max="${MAX_COPIES}" value="${esc(pick.count||1)}" data-nl-count="${esc(e.id)}"></label><button type="button" class="btn ghost" data-nl-action="add" data-nl-id="${esc(e.id)}">${esc(t.addTo)}</button></div>`:`<p class="gx-note">${esc(t.noCampaign)}</p>`;
 return `<div class="nl-entry" data-nl-entry="${esc(e.id)}"><div class="nl-head"><strong>${esc(e.name)}</strong><span class="gx-mono">${esc(stats)}</span></div>${e.skills?.length||e.attacks?.length?`<div class="nl-row nl-rolls">${(e.attacks||[]).map((a,i)=>`<span class="nl-attack"><button type="button" class="btn ghost" data-nl-action="roll-attack" data-nl-id="${esc(e.id)}" data-nl-i="${i}">⬡ ${esc(a.name)} +${a.base}</button><button type="button" class="btn ghost" data-nl-action="roll-damage" data-nl-id="${esc(e.id)}" data-nl-i="${i}">${esc(t.rollDamage)} ${esc(a.damage)}</button></span>`).join('')}${(e.skills||[]).map((x,i)=>`<button type="button" class="btn ghost" data-nl-action="roll-skill" data-nl-id="${esc(e.id)}" data-nl-i="${i}">⬡ ${esc(x.name)} +${x.base}</button>`).join('')}</div>`:''}${e.weapons?`<p class="nl-text">${esc(e.weapons)}</p>`:''}${e.notes?`<p class="nl-text muted">${esc(e.notes)}</p>`:''}${custom?`<div class="nl-row nl-custom"><span class="badge cc-mark">${t===T.ru?'Своё':'Custom'}</span><span class="gx-note">${t===T.ru?'Из «Своих материалов». Изменить можно на странице каталога.':'From “My content”. Edit it on the catalog page.'}</span></div>`:`<div class="nl-row"><button type="button" class="btn ghost" data-nl-action="edit" data-nl-id="${esc(e.id)}">${esc(t.edit)}</button><button type="button" class="btn ghost" data-nl-action="clone" data-nl-id="${esc(e.id)}">${esc(t.clone)}</button><button type="button" class="btn ghost nl-del${ui.armed===e.id?' armed':''}" data-nl-action="del" data-nl-id="${esc(e.id)}">${esc(ui.armed===e.id?t.sure:t.del)}</button></div>`}${add}</div>`;
}
function render(lang){
 const l=lang==='en'?'en':'ru',t=T[l],st=appState(),list=readLibrary(st),campaigns=st&&Array.isArray(st.campaigns)?st.campaigns.filter(c=>c&&typeof c.id==='string'&&Array.isArray(c.roster)):[],custom=customEntries().filter(c=>!list.some(e=>e.id===c.id));
 return `<section class="card gx-card nl-card" id="gx-npcs" data-gx-section="npcs" data-nl-root data-lang="${l}"><div class="card-heading"><span>${esc(t.title)}</span><span>${esc(t.sub)} · ${list.length}/${MAX}</span></div><p class="gx-note">${esc(t.intro)}</p>${list.length||custom.length?`<div class="nl-list">${list.map(e=>entryHtml(e,t,campaigns)).join('')}${custom.map(e=>entryHtml(e,t,campaigns,true)).join('')}</div>`:`<p class="gx-note">${esc(t.empty)}</p>`}${list.length>=MAX&&!ui.draft?`<p class="gx-note">${esc(t.full)}</p>`:formHtml(t)}</section>`;
}
function notify(m){try{window.App.notify(m)}catch(_){}}
function commit(fn){const st=appState();if(!st)return null;const r=fn(readLibrary(st));if(!r.ok)return r;writeLibrary(st,r.list);try{window.App.save()}catch(_){}return r}
function rerender(root,lang){
 const l=lang||(typeof window!=='undefined'&&window.App?.lang?.())||root.dataset?.lang;
 if(typeof root.outerHTML!=='string'||root.isConnected===false)return;
 root.outerHTML=render(l);
}
function act(a,b,root,lang){
 const t=T[lang==='en'?'en':'ru'],id=b?.dataset?.nlId;
 if(a!=='del')ui.armed=null;
 switch(a){
  case 'new':ui.editing=null;ui.draft=EMPTY();return true;
  case 'cancel':ui.editing=null;ui.draft=null;return true;
  case 'calc':{const h=hpFromStats(ui.draft?.body,ui.draft?.will);if(h!==null&&ui.draft)ui.draft.hp=h;return true}
  case 'edit':{const e=readLibrary(appState()).find(x=>x.id===id);if(e){ui.editing=id;ui.draft={...EMPTY(),...e,body:e.body||'',will:e.will||'',skillsText:skillsText(e.skills),attacksText:attacksText(e.attacks)}}return true}
  case 'roll-skill':case 'roll-attack':case 'roll-damage':{
   const e=findEntry(id),i=int(b.dataset.nlI,0,20,-1),item=a==='roll-skill'?e?.skills?.[i]:e?.attacks?.[i];if(!item)return true;
   // An NPC's roll is its own: the wounds of the sheet that happens to be open do not apply.
   try{if(a==='roll-damage'){const m=DICE.exec(item.damage),total=window.App.dice(Number(m[1]),Number(m[2]),`${e.name} · ${item.name} · ${t.rollDamage}`);if(Number.isFinite(total))notify(`${e.name} · ${item.name}: ${t.rollDamage} ${item.damage} = ${total}`)}else window.App.check(item.base,`${e.name} · ${item.name}${a==='roll-attack'?' · '+t.rollAttack:''}`,{wounds:false})}catch(_){}
   return false}
  case 'save':{
   const d=ui.draft;if(!d)return true;
   const skills=parseSkills(d.skillsText),attacks=parseAttacks(d.attacksText),bad=[...skills.bad,...attacks.bad];
   if(bad.length){notify(t.badLine(bad[0]));return true}
   const r=commit(list=>ui.editing?updateEntry(list,ui.editing,{...d,skills:skills.list,attacks:attacks.list}):addEntry(list,{...d,skills:skills.list,attacks:attacks.list}));
   if(!r)return true;
   if(!r.ok){notify(r.reason==='name'?t.needName:r.reason==='full'?t.full:t.empty);return true}
   ui.editing=null;ui.draft=null;return true}
  case 'clone':{const r=commit(list=>cloneEntry(list,id,lang));if(r&&!r.ok&&r.reason==='full')notify(t.full);return true}
  case 'del':if(ui.armed!==id){ui.armed=id;return true}ui.armed=null;commit(list=>removeEntry(list,id));return true;
  case 'add':{
   const st=appState(),e=findEntry(id),box=b.closest?.('[data-nl-entry]');
   const cid=box?.querySelector?.('[data-nl-pick]')?.value,count=box?.querySelector?.('[data-nl-count]')?.value;
   const c=st&&Array.isArray(st.campaigns)?st.campaigns.find(x=>x&&x.id===cid):null;
   if(!e||!c)return true;
   ui.pickCampaign[id]={id:cid,count:int(count,1,MAX_COPIES,1)};
   const uid=()=>globalThis.crypto?.randomUUID?.()||Date.now()+'-'+Math.random().toString(36).slice(2);
   const r=addToCampaign(c,e,count,lang,uid);
   if(!r.ok){notify(t.rosterFull);return true}
   try{window.App.save()}catch(_){}
   notify(t.added(r.added.map(x=>x.name).join(', '),c.name||'—'));return true}
 }
 return false;
}
function handle(e,lang){
 const target=e?.target,root=target?.closest?.('[data-nl-root]');
 if(!root||root.isConnected===false)return false;
 const l=lang||window.App?.lang?.()||root.dataset?.lang||'ru',ds=target.dataset||{};
 if(e.type==='input'||e.type==='change'){
  if(ds.nlField&&ui.draft){ui.draft[ds.nlField]=ds.nlField==='name'?line(target.value,MAX_NAME):target.value;return true}
  if(ds.nlPick!==undefined){const p=ui.pickCampaign[ds.nlPick]||(ui.pickCampaign[ds.nlPick]={});p.id=target.value;return true}
  if(ds.nlCount!==undefined){const p=ui.pickCampaign[ds.nlCount]||(ui.pickCampaign[ds.nlCount]={});p.count=int(target.value,1,MAX_COPIES,1);return true}
  return false;
 }
 if(e.type!=='click')return false;
 const b=target.closest('[data-nl-action]');if(!b)return false;
 if(!act(b.dataset.nlAction,b,root,l))return false;
 rerender(root,l);return true;
}
function reset(){ui={editing:null,draft:null,armed:null,pickCampaign:{}}}
if(typeof document!=='undefined'&&document.addEventListener){for(const type of ['click','change','input'])document.addEventListener(type,e=>{handle(e)})}
window.NpcLibrary={parseSkills,parseAttacks,cleanSkills,cleanAttacks,MAX,MAX_COPIES,cleanEntry,readLibrary,writeLibrary,addEntry,updateEntry,removeEntry,cloneEntry,numberedNames,hpFromStats,rosterEntries,addToCampaign,combatNote,render,handle,reset};
})();
