/* The Skills list of the sheet: search, «hide zeroes» and grouping (by category, by STAT, A–Z). Search is ephemeral and does
   not alter character data. The grouping and «hide zeroes» are per-device preferences (UIMemory, never in the archive): they
   stay as they were when another sheet is opened. Grouping only moves the rows of the list in the page and puts headings
   between them; a Skill's specializations stay under their Skill. Pure helpers are exported for tests. */
(function(global){
'use strict';
let character=null,owner=null,epoch=null,query='';
const MODES=['category','stat','az'],GROUP_KEY='skill-group',ZERO_KEY='skill-hide-zero';
const STAT_ORDER=['INT','REF','DEX','TECH','COOL','WILL','LUCK','MOVE','BODY','EMP'];
const STAT_NAMES={INT:['Интеллект','Intelligence'],REF:['Рефлексы','Reflexes'],DEX:['Ловкость','Dexterity'],TECH:['Техника','Technique'],COOL:['Хладнокровие','Cool'],WILL:['Воля','Willpower'],LUCK:['Удача','Luck'],MOVE:['Скорость','Movement'],BODY:['Телосложение','Body'],EMP:['Эмпатия','Empathy']};
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const normalized=x=>String(x??'').normalize('NFKC').trim().toLocaleLowerCase();
const T={ru:{search:'Поиск навыков',placeholder:'Название или STAT',zero:'Скрыть нулевые',group:'Группировка',category:'По категориям',stat:'По STAT',az:'По алфавиту',note:'Специализации показаны под своим навыком; уровень меняется в разделе «Специализации».',shown:(a,b)=>`Показано ${a} из ${b}`,other:'Прочее'},
 en:{search:'Search skills',placeholder:'Name or STAT',zero:'Hide zeroes',group:'Group by',category:'By category',stat:'By STAT',az:'A–Z',note:'Specializations are listed under their skill; change their level in «Specializations».',shown:(a,b)=>`Showing ${a} of ${b}`,other:'Other'}};
const t=(l,k,...a)=>{const v=(T[l==='en'?'en':'ru'])[k];return typeof v==='function'?v(...a):v};
// ---------- per-device preferences ----------
const mem=()=>global.UIMemory;
const validMode=v=>MODES.includes(v);
// Without UIMemory (storage blocked, or a test) the choice is kept in this module for the visit.
let group='category',trained=false;
function readGroup(){try{if(typeof mem()?.get!=='function')return group;const v=mem().get(GROUP_KEY,'category',validMode);return validMode(v)?v:'category'}catch{return group}}
function readZero(){try{if(typeof mem()?.get!=='function')return trained;return mem().get(ZERO_KEY,false,v=>typeof v==='boolean')===true}catch{return trained}}
group=readGroup();trained=readZero();
function setGroup(v){group=validMode(v)?v:'category';try{mem()?.set?.(GROUP_KEY,group)}catch{}return group}
function setTrained(v){trained=v===true;try{mem()?.set?.(ZERO_KEY,trained)}catch{}return trained}
// ---------- pure ----------
// The category of a Skill by name; «Language (Other)» is looked up as «Language». Unknown names are «other».
function groupOf(name,ref){
 const list=Array.isArray(ref)?ref:Array.isArray(global.SkillReference?.SKILLS)?global.SkillReference.SKILLS:[];
 const n=String(name??''),base=n.replace(/\s*\([^)]*\)\s*$/,'');
 const row=list.find(r=>r?.[0]===n)||list.find(r=>r?.[0]===base);
 return typeof row?.[1]==='string'?row[1]:'other';
}
function categoryLabel(id,lang,groups){
 const g=groups||global.SkillReference?.GROUPS||{};
 return g[id]?.[lang==='en'?1:0]||t(lang,'other');
}
// rows: [{key, name, ru, stat, group, index}] -> [{id, label, items}]; «az» is one list without a heading.
// Within a group the book order (index) stays, except in «az» where the displayed name decides.
function order(rows,mode,lang,groups){
 const m=validMode(mode)?mode:'category',en=lang==='en',list=(Array.isArray(rows)?rows:[]).slice().sort((a,b)=>a.index-b.index);
 const name=r=>String(en?r.name:r.ru||r.name);
 if(m==='az')return [{id:'az',label:'',items:list.slice().sort((a,b)=>name(a).localeCompare(name(b),en?'en':'ru',{sensitivity:'base'})||a.index-b.index)}];
 const buckets=new Map();
 for(const r of list){const id=m==='stat'?(STAT_ORDER.includes(r.stat)?r.stat:'?'):(r.group||'other');if(!buckets.has(id))buckets.set(id,[]);buckets.get(id).push(r)}
 const keys=m==='stat'?[...STAT_ORDER,'?']:[...Object.keys(groups||global.SkillReference?.GROUPS||{}),'other'];
 const ordered=[...keys.filter(k=>buckets.has(k)),...[...buckets.keys()].filter(k=>!keys.includes(k))];
 return ordered.map(id=>({id,label:m==='stat'?(id==='?'?t(lang,'other'):`${id} · ${STAT_NAMES[id][en?1:0]}`):categoryLabel(id,lang,groups),items:buckets.get(id)}));
}
// Does a row pass the search and «hide zeroes»? `value` is the level as the sheet shows it.
function passes(row,words,hideZero){
 const text=normalized(row.search);
 return words.every(w=>text.includes(w))&&(!hideZero||(typeof row.value==='string'&&/^\d+$/.test(row.value.trim())&&Number(row.value)>0));
}
// «Hide zeroes» only means something once there is a trained Skill: on a fresh sheet (all zeroes) it would empty the list
// for good, so it is not applied there. `levels` are the level texts of the rows.
const isTrained=v=>typeof v==='string'&&/^\d+$/.test(v.trim())&&Number(v)>0;
function effectiveHideZero(levels,hideZero){return hideZero===true&&Array.isArray(levels)&&levels.some(isTrained)}
// ---------- markup ----------
function render(c,lang,scope,generation){
 if(c!==character||scope!==owner||generation!==epoch){character=c;owner=scope;epoch=generation;query=''}
 group=readGroup();trained=readZero();
 const l=lang==='en'?'en':'ru';
 return `<div class="sheet-skill-filter"><label class="field sf-search"><span class="sf-label">${t(l,'search')}</span><input type="search" data-skill-filter="query" value="${esc(query)}" placeholder="${t(l,'placeholder')}" autocomplete="off"></label><label class="sf-group"><span class="sf-label">${t(l,'group')}</span><select data-skill-filter="group">${MODES.map(m=>`<option value="${m}"${m===group?' selected':''}>${t(l,m)}</option>`).join('')}</select></label><label class="sf-zero"><input type="checkbox" data-skill-filter="trained" ${trained?'checked':''}> ${t(l,'zero')}</label><p class="sf-note">${t(l,'note')}</p><p data-skill-filter-count role="status" aria-live="polite"></p></div>`;
}
// ---------- the page ----------
const levelOf=row=>row.querySelector?.('input[data-skill]')?.value??row.dataset?.skillLevel;
// Puts the rows of the list in the order of the mode, with headings; only when the mode (or the language) changed since the last time.
function regroup(root,lang){
 const list=root?.querySelector?.('.skills-list');if(!list||typeof list.querySelectorAll!=='function'||typeof list.appendChild!=='function')return;
 const stamp=group+':'+(lang==='en'?'en':'ru');if(list.dataset.skillGrouped===stamp)return;
 const all=[...list.querySelectorAll('.skill-row')],mains=all.filter(r=>!r.classList?.contains('skill-spec-row')&&r.querySelector?.('input[data-skill]'));
 if(!mains.length)return;
 all.forEach((r,i)=>{if(r.dataset.skillIndex===undefined)r.dataset.skillIndex=String(i)});
 const specs=all.filter(r=>r.classList?.contains('skill-spec-row')),byParent=new Map();
 for(const s of specs){const p=s.dataset.specParent||'';if(!byParent.has(p))byParent.set(p,[]);byParent.get(p).push(s)}
 const info=mains.map(r=>{const key=r.querySelector('input[data-skill]').dataset.skill;return {key,name:key,ru:r.dataset.skillRu||key,stat:r.dataset.skillStat||'',group:groupOf(key),index:Number(r.dataset.skillIndex),row:r}});
 const used=new Set(info.map(i=>i.key)),loose=specs.filter(s=>!used.has(s.dataset.specParent||''));
 for(const h of [...list.querySelectorAll('.skill-group-head')])h.remove();
 const doc=list.ownerDocument||global.document,frag=[];
 for(const g of order(info,group,lang)){
  if(g.label){const h=doc.createElement('div');h.className='skill-group-head';h.dataset.skillHead=g.id;h.textContent=g.label;frag.push(h)}
  for(const it of g.items){frag.push(it.row);for(const s of byParent.get(it.key)||[])frag.push(s)}
 }
 for(const s of loose)frag.push(s);
 for(const el of frag)list.appendChild(el);
 list.dataset.skillGrouped=stamp;
}
function apply(root,lang){
 if(!root)return;
 regroup(root,lang);
 const words=normalized(query).split(/\s+/).filter(Boolean);let shown=0,total=0;
 const rows=[...root.querySelectorAll('.skill-row[data-skill-search]')],hide=effectiveHideZero(rows.map(levelOf),trained);
 for(const row of rows){
  total++;const yes=passes({search:row.dataset.skillSearch,value:levelOf(row)},words,hide);
  row.hidden=!yes;if(yes)shown++;
 }
 // A heading with nothing under it is hidden too.
 const heads=[...(root.querySelectorAll?.('.skill-group-head')||[])].filter(h=>h.classList?.contains?.('skill-group-head'));
 for(const h of heads){let n=h.nextElementSibling,any=false;while(n&&!n.classList?.contains('skill-group-head')){if(n.hidden!==true){any=true;break}n=n.nextElementSibling}h.hidden=!any}
 const count=root.querySelector('[data-skill-filter-count]');if(count)count.textContent=t(lang,'shown',shown,total);
}
function handle(e,c,lang,scope,generation){
 const el=e?.target,key=el?.dataset?.skillFilter;
 if(!['query','trained','group'].includes(key))return false;
 if(c!==character||scope!==owner||generation!==epoch)return true;
 const root=el.closest?.('.card');if(!root||root.isConnected!==true||el.isConnected!==true||root.querySelector(`[data-skill-filter="${key}"]`)!==el)return true;
 if(key==='query'){if(e.type==='change')return true;query=String(el.value||'').slice(0,120)}
 else if(key==='trained'){if(e.type==='input')return true;setTrained(!!el.checked)}
 else{if(e.type==='input')return true;setGroup(el.value);el.value=group}
 apply(root,lang);return true;
}
// A change of sheet or account clears the search; grouping and «hide zeroes» are the device's and stay.
function reset(root,c,lang,scope,generation){
 character=c;owner=scope;epoch=generation;query='';group=readGroup();trained=readZero();
 if(!root||root.isConnected!==true)return;
 const search=root.querySelector('[data-skill-filter="query"]'),checkbox=root.querySelector('[data-skill-filter="trained"]'),select=root.querySelector('[data-skill-filter="group"]');
 if(search)search.value='';if(checkbox)checkbox.checked=trained;if(select)select.value=group;apply(root,lang);
}
global.SkillFilter={render,apply,handle,reset,order,groupOf,passes,effectiveHideZero,MODES,state:()=>({query,group,trained})};
})(window);
