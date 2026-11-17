/* NET architecture generator: «Сгенерировать» in the list of architectures (net-tools.js asks this module for the controls and for the draft).

   What it makes: an ordinary, fully editable architecture (the saved shape of NetTools: floors with parents, records, ICE statistics),
   never a separate kind of object. The Game Master reads it, changes it and plays it like one made by hand.

   What it uses, and nothing else: the floor-count bands of the three architecture sizes (3–6 / 7–12 / 13–18 floors), the DV steps
   of a password, node or file (6, 8, 10, 12), the Black ICE table of NetTools and the NET Demons (REZ, Interface, NET Actions,
   Combat Number), all from this repository's catalog and tables. The three difficulty levels and the way the pieces are placed are
   the app's OWN simple rules (a seeded random generator, the same seed gives the same draft); they are not rules of the book, and the
   text of the draft says so. The generator ends with a check against NetTools.validArchitectures, so a draft that does not fit the saved
   shape is never handed out. Own words; no rulebook text. */
(function(global){
'use strict';
const T={
 ru:{label:'Сложность заготовки',levels:{easy:'Лёгкая',standard:'Средняя',hard:'Тяжёлая'},floors:(a,b)=>`${a}–${b} этажей`,
  help:'Заготовку собирает приложение по своим простым правилам, а не по книге: число этажей, DV и ICE берутся из справочника, всё остальное можно править.',
  name:(lvl,n)=>`Заготовка: ${lvl.toLowerCase()}, ${n} эт.`,
  branch:d=>`Ответвление от этажа ${d}`,password:'Пароль',file:'Файл',control:'Узел управления',goal:'Файл — цель забега',
  controlNote:'Что именно он контролирует, впишите сами.',demonNote:(rez,i,act,cn)=>`NET Demon по справочнику: REZ ${rez}; Interface ${i}; NET-действий ${act}; Combat Number ${cn}. Как он действует, решает ведущий.`,
  notes:(lvl,seed)=>`Создано генератором приложения: уровень «${lvl}», зерно ${seed}. Это правила приложения, а не книги: число этажей, DV пароля, файла и узла, ICE и демоны взяты из справочника, а расстановка по этажам случайная. Проверьте заготовку и поправьте её перед игрой.`},
 en:{label:'Draft difficulty',levels:{easy:'Easy',standard:'Standard',hard:'Hard'},floors:(a,b)=>`${a}–${b} floors`,
  help:'The draft is built by the app’s own simple rules, not the book’s: the floor count, the DVs and the ICE come from the reference, and everything can be edited.',
  name:(lvl,n)=>`Draft: ${lvl.toLowerCase()}, ${n} fl.`,
  branch:d=>`Branch from floor ${d}`,password:'Password',file:'File',control:'Control node',goal:'File — the goal of the run',
  controlNote:'Write down what it controls yourself.',demonNote:(rez,i,act,cn)=>`NET Demon from the reference: REZ ${rez}; Interface ${i}; NET Actions ${act}; Combat Number ${cn}. The GM decides how it acts.`,
  notes:(lvl,seed)=>`Made by the app’s generator: level “${lvl}”, seed ${seed}. These are the app’s own rules, not the book’s: the floor count, the DV of a password, file or node, the ICE and the demons come from the reference, and the placement on the floors is random. Check the draft and adjust it before play.`}
};
// The three levels are the app's own. `size` names the architecture size whose floor-count band is used; `dvs` are positions in the DV steps of the
// catalog (0 = lowest); `iceRez` is the highest REZ of a Black ICE that may be placed; `ice` the chance of ICE on a floor below the entrance.
const LEVELS=Object.freeze({
 easy:{size:'small',dvs:[0,1],iceRez:15,ice:0.35,controls:1,demons:[]},
 standard:{size:'medium',dvs:[1,2],iceRez:25,ice:0.5,controls:2,demons:['imp']},
 hard:{size:'large',dvs:[2,3],iceRez:999,ice:0.65,controls:3,demons:['efreet','balron']}
});
const ORDER=Object.freeze(['easy','standard','hard']);
// What the repository lists, read from the catalog when it is there (with the same numbers as fallback).
const FALLBACK={bands:{small:[3,6],medium:[7,12],large:[13,18]},dvs:[6,8,10,12],demons:{imp:[15,3,2,14],efreet:[25,4,3,14],balron:[30,7,4,14]}};
function catalog(){return Array.isArray(global.CATALOG)?global.CATALOG:[]}
function bands(){
 const out={...FALLBACK.bands};
 for(const k of Object.keys(out)){
  const p=catalog().find(x=>x&&x.id==='extra-net-architecture-'+k&&x.stats?.type==='architecture'),m=/(\d+)\s*[–-]\s*(\d+)/.exec(String(p?.name?.en||''));
  if(m&&+m[1]>=1&&+m[2]>=+m[1]&&+m[2]<=100)out[k]=[+m[1],+m[2]];
 }
 return out;
}
function dvSteps(){
 const found=catalog().filter(x=>x&&x.stats?.type==='net-feature'&&Number.isInteger(x.stats.dv)&&x.stats.dv>=0&&x.stats.dv<=999).map(x=>x.stats.dv).sort((a,b)=>a-b);
 const set=[...new Set(found)];
 // The levels read the steps by place: use the four steps the app knows when the catalog has all of them, never a shifted list.
 if(FALLBACK.dvs.every(v=>set.includes(v)))return FALLBACK.dvs.slice();
 return set.length>=4?set.slice(0,4):FALLBACK.dvs.slice();
}
function demons(){
 const out={};
 for(const [k,v] of Object.entries(FALLBACK.demons))out[k]={rez:v[0],interface:v[1],netActions:v[2],combatNumber:v[3],name:k[0].toUpperCase()+k.slice(1)};
 for(const k of Object.keys(out)){
  const p=catalog().find(x=>x&&x.id==='extra-net-demon-'+k&&x.stats?.type==='demon'),s=p?.stats;
  if(s&&[s.rez,s.interface,s.netActions,s.combatNumber].every(n=>Number.isInteger(n)&&n>=0&&n<=999)){out[k]={rez:s.rez,interface:s.interface,netActions:s.netActions,combatNumber:s.combatNumber,name:out[k].name}}
 }
 return out;
}
// Black ICE the level allows, weakest first (by REZ, then by name so the order is stable).
function icePool(level){
 const table=global.NetTools?.ICE||{},top=LEVELS[level].iceRez;
 return Object.entries(table).filter(([,v])=>Array.isArray(v)&&v[4]<=top).sort((a,b)=>a[1][4]-b[1][4]||(a[0]<b[0]?-1:1));
}
// Small seeded generator (mulberry32): the same seed always gives the same draft.
function mulberry32(seed){let s=(Number(seed)>>>0)||0;return function(){s=(s+0x6D2B79F5)>>>0;let t=s;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296}}
const between=(rng,lo,hi)=>lo+Math.floor(rng()*(hi-lo+1));
function newSeed(){let r=Math.floor(Math.random()*4294967296);try{const a=new Uint32Array(1);global.crypto.getRandomValues(a);r=a[0]}catch{}return r>>>0||1}

/* generate({difficulty, seed, lang}) -> an architecture in the saved shape of NetTools, or null when NetTools is not there.
   The floors are an explicit tree (parent on every floor, '' for the entrance) and the array is in top-down order.
   The main line is always the longest one, so the architecture has one definite deepest floor. */
function generate(opts={}){
 const NT=global.NetTools;if(!NT||typeof NT.newArchitecture!=='function'||typeof NT.newFloor!=='function'||typeof NT.newEntry!=='function')return null;
 const lang=opts.lang==='ru'?'ru':'en',z=T[lang],level=Object.hasOwn(LEVELS,opts.difficulty)?opts.difficulty:'standard',L=LEVELS[level];
 const seed=Number.isSafeInteger(opts.seed)&&opts.seed>=0&&opts.seed<=4294967295?opts.seed:newSeed(),rng=mulberry32(seed);
 const band=bands()[L.size],steps=dvSteps(),count=between(rng,band[0],band[1]);
 // --- the shape: a main line of at least three floors, the rest as short branches hung under floors from the second one on
 let mainLen=Math.min(count,Math.max(3,Math.ceil(count*0.6)));
 const nodes=[];
 for(let i=0;i<mainLen;i++)nodes.push({floor:NT.newFloor(i+1),depth:i+1,parent:i?nodes[i-1]:null,kids:0,main:true});
 let rest=count-mainLen;
 while(rest>0){
  // A branch floor stays above the deepest main floor, so the main line keeps the only deepest floor; a floor has at most two floors below it.
  const spots=nodes.filter(n=>n.depth>=2&&n.depth<=mainLen-2&&n.kids<2);
  if(!spots.length){const last=nodes.filter(n=>n.main).at(-1);const n={floor:NT.newFloor(last.depth+1),depth:last.depth+1,parent:last,kids:0,main:true};last.kids++;nodes.push(n);mainLen++;rest--;continue}
  const at=spots[Math.floor(rng()*spots.length)],n={floor:NT.newFloor(at.depth+1),depth:at.depth+1,parent:at,kids:0,main:false};
  if(at.kids>0)n.floor.branch=z.branch(at.depth);
  at.kids++;nodes.push(n);rest--;
 }
 for(const n of nodes)n.floor.parent=n.parent?n.parent.floor.id:'';
 // The array is left in top-down order (every floor before the floors below it, a branch after the line it leaves), as the editor keeps it.
 const order=[],kids=new Map(nodes.map(n=>[n,[]]));for(const n of nodes)if(n.parent)kids.get(n.parent).push(n);
 for(const stack=[nodes[0]];stack.length;){const n=stack.pop();order.push(n);const k=kids.get(n);for(let i=k.length-1;i>=0;i--)stack.push(k[i])}
 const deepest=Math.max(...nodes.map(n=>n.depth)),goal=nodes.find(n=>n.depth===deepest);
 // --- the records
 // The DV climbs with the depth between the two steps of the level; now and then a floor is a step easier or harder, never outside the level.
 const dvAt=depth=>{const lo=L.dvs[0],hi=Math.min(L.dvs[1],steps.length-1),ratio=deepest>1?(depth-1)/(deepest-1):0;let pos=lo+Math.round(ratio*(hi-lo));if(rng()<0.2)pos+=rng()<0.5?-1:1;return steps[Math.max(lo,Math.min(hi,pos))]};
 const add=(n,patch)=>{if(n.floor.entries.length>=50)return null;const e=Object.assign(NT.newEntry(),patch);n.floor.entries.push(e);return e};
 const lock=(n,type,dv,name)=>add(n,{type,dv,name,state:'closed'});
 const ice=(n)=>{
  const pool=icePool(level);if(!pool.length)return null;
  const ratio=deepest>1?(n.depth-1)/(deepest-1):0,span=Math.max(1,Math.round(pool.length*(0.35+0.65*ratio))),[name,v]=pool[Math.floor(rng()*span)];
  return add(n,{type:'ice',name,preset:name,per:v[0],spd:v[1],atk:v[2],def:v[3],maxRez:v[4],rez:v[4],state:'waiting',dv:0});
 };
 nodes.forEach(n=>{
  if(n.depth===1){lock(n,'password',steps[L.dvs[0]],z.password);return}
  if(n===goal)return;
  if(rng()<0.55){const file=rng()>=0.7;lock(n,file?'file':'password',dvAt(n.depth),file?z.file:z.password)}
  if(rng()<L.ice)ice(n);
 });
 // The goal floor: the file of the run behind the highest DV of the level, and a demon on harder levels.
 lock(goal,'password',steps[L.dvs[1]],z.password);lock(goal,'file',steps[L.dvs[1]],z.goal);
 const demonKey=L.demons.length&&rng()<(level==='hard'?1:0.25)?L.demons[Math.floor(rng()*L.demons.length)]:'';
 if(demonKey){const d=demons()[demonKey];if(d)add(goal,{type:'other',name:d.name,dv:0,state:'closed',notes:z.demonNote(d.rez,d.interface,d.netActions,d.combatNumber)})}
 // Control nodes: a few, never on the entrance, spread over the lower floors.
 const lower=nodes.filter(n=>n.depth>=2);for(let i=lower.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[lower[i],lower[j]]=[lower[j],lower[i]]}
 const hosts=lower.slice(0,L.controls);
 for(const n of hosts)add(n,{type:'control',name:z.control,dv:dvAt(n.depth),state:'closed',notes:z.controlNote});
 // A floor below the entrance is never empty.
 for(const n of nodes)if(n.depth>1&&!n.floor.entries.length)lock(n,'password',dvAt(n.depth),z.password);
 // --- the architecture
 const a=NT.newArchitecture(lang),lvl=z.levels[level];
 a.name=z.name(lvl,count);a.notes=z.notes(lvl,seed);a.current='1';a.floors=order.map(n=>n.floor);
 return typeof NT.validArchitectures==='function'&&!NT.validArchitectures([a])?null:a;
}

/* ---------- The controls the list shows ---------- */
let level='standard';
try{const v=global.localStorage?.getItem('nc-net-gen-level');if(Object.hasOwn(LEVELS,v))level=v}catch{}
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function controlsHtml(l){
 const lang=l==='ru'?'ru':'en',z=T[lang],b=bands();
 return `<label class="field net-gen-field">${esc(z.label)}<select data-net-gen="difficulty">${ORDER.map(k=>`<option value="${k}"${k===level?' selected':''}>${esc(z.levels[k])} · ${esc(z.floors(...b[LEVELS[k].size]))}</option>`).join('')}</select></label><p class="net-note net-gen-help">${esc(z.help)}</p>`;
}
function change(el){
 const v=String(el?.value??'');
 if(Object.hasOwn(LEVELS,v)){level=v;try{global.localStorage?.setItem('nc-net-gen-level',v)}catch{}}
 return {handled:true};
}
// A new draft in the language of the page, at the level chosen in the list.
const make=l=>generate({difficulty:level,lang:l==='ru'?'ru':'en'});

global.NetGenerator={LEVELS,ORDER,T,bands,dvSteps,demons,icePool,mulberry32,generate,make,controlsHtml,change,level:()=>level,setLevel:v=>change({value:v})};
})(window);
