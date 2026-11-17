/* Cyberware option slots and foundations.
   A foundation (Cyberarm, Cyberleg, Cybereye, Cyberaudio Suite, Neural Link, a Chipware Socket, a Sensor Array)
   has a number of option slots; an option takes some of them and needs a foundation of the right family.
   The numbers are not typed in from memory: every one of them is a number that the catalog's own description of
   that item already states, and the `text` / `req` fields below quote the fragment (tests/cyber-slots.test.cjs reads
   each of them back from window.CATALOG). Where the catalog text gives no cost for an option, the cost is a setting
   of this app (default 1) that the player can change per option; the panel says so.
   At load the numbers are also written to the catalog entries as stats.optionSlots / stats.slotCost / stats.requires,
   so other modules and custom items (custom-content.js) share one shape.
   Saved data: nothing changes in old saves. New optional fields: extra.equipment.installs[i].host (the key of the
   foundation an option was put into) and extra.cyberSlots = {version:1, defaultCost, costs:{catalogId:n}}.
   Humanity rules are not touched here. Original wording. */
(function(root){
'use strict';
const W=root.window||root;
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const isObject=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const P='cyberware-';

// Foundations: slots, family (kind) and the catalog fragment that states the number.
const FOUNDATIONS={
 'neural-link':{slots:5,kind:'neural',text:'5 option slots'},
 'cybereye':{slots:3,kind:'eye',text:'3 option slots'},
 'cyberaudio-suite':{slots:3,kind:'audio',text:'3 audio option slots'},
 'cyberarm':{slots:4,kind:'arm',text:'4 Cyberarm/Cyberlimb option slots'},
 'cyberleg':{slots:3,kind:'leg',text:'3 Cyberleg/Cyberlimb option slots'},
 'sensor-array':{slots:5,kind:'audio',text:'five additional Cyberaudio Options'},
 'chipware-socket':{slots:1,kind:'chip',text:'Socket for one chip'},
};
const NEURAL=['neural-link'],EYE=['cybereye'],AUDIO=['cyberaudio-suite'],ARM=['cyberarm'],LEG=['cyberleg'],SOCKET=['chipware-socket'];
// Options: requires (foundation ids, catalog text names them), cost + text (fragment with the number) when the catalog states it,
// standalone when the text says it may be the only cyberware in a meat limb, costFrom when the cost follows from a foundation's slots.
const OPTIONS={
 'braindance-recorder':{requires:NEURAL},'chipware-socket':{requires:NEURAL},'interface-plugs':{requires:NEURAL},
 'kerenzikov':{requires:NEURAL},'sandevistan':{requires:NEURAL},
 'subdermal-grip':{requires:NEURAL,cost:1,text:'takes a Neuralware option slot'},
 'chemical-analyzer-chip':{requires:SOCKET,cost:1,costFrom:'chipware-socket'},'memory-chip':{requires:SOCKET,cost:1,costFrom:'chipware-socket'},
 'olfactory-boost':{requires:SOCKET,cost:1,costFrom:'chipware-socket'},'pain-editor':{requires:SOCKET,cost:1,costFrom:'chipware-socket'},
 'tactile-boost':{requires:SOCKET,cost:1,costFrom:'chipware-socket'},'skill-chip':{requires:SOCKET,cost:1,costFrom:'chipware-socket'},
 'anti-dazzle':{requires:EYE},'chyron':{requires:EYE,cost:1,text:'uses an option slot'},'color-shift':{requires:EYE},
 'dartgun-cybereye':{requires:EYE,cost:3,text:'takes 3 option slots'},'image-enhance':{requires:EYE},
 'low-light-infrared-uv':{requires:EYE,cost:2,text:'2 slots in each eye'},'microoptics':{requires:EYE,cost:1,text:'uses an option slot'},
 'microvideo':{requires:EYE,cost:2,text:'2 slots'},'radiation-detector':{requires:EYE},'targeting-scope':{requires:EYE},
 'teleoptics':{requires:EYE},'virtuality':{requires:EYE},
 'amplified-hearing':{requires:AUDIO},'audio-recorder-implant':{requires:AUDIO,cost:1,text:'1 option slot'},
 'internal-agent':{requires:AUDIO,cost:1,text:'1 slot'},'level-damper':{requires:AUDIO},'voice-stress-analyzer':{requires:AUDIO},
 'homing-tracer-implant':{requires:AUDIO},'radio-communicator-implant':{requires:AUDIO,cost:1,text:'uses an option slot'},
 'radio-scanner-implant':{requires:AUDIO,cost:1,text:'1 slot'},'radar-detector-implant':{requires:AUDIO,cost:1,text:'1 option slot'},
 'scrambler-implant':{requires:AUDIO,cost:1,text:'1 slot'},'bug-detector':{requires:AUDIO,cost:1,text:'takes 1 option slot'},
 'sensor-array':{requires:AUDIO,cost:0,text:'uses no slot in it'},
 'cyberdeck':{requires:ARM,cost:3,text:'uses 3 Cyberarm slots'},
 'grapple-hand':{requires:ARM},'quick-change-mount':{requires:ARM},
 'popup-grenade-launcher':{requires:ARM,cost:2,text:'2 slots'},'popup-melee-weapon':{requires:ARM,cost:2,text:'2 slots'},
 'popup-shield':{requires:ARM,cost:3,text:'3 slots'},'popup-ranged-weapon':{requires:ARM,cost:2,text:'2 slots'},
 'medscanner-implant':{requires:ARM,cost:2,text:'2 slots'},'shoulder-cam':{requires:ARM,cost:2,text:'2 slots'},
 'techscanner-implant':{requires:ARM,cost:2,text:'2 slots'},
 'big-knucks':{requires:ARM,standalone:true},'rippers':{requires:ARM,standalone:true},'scratchers':{requires:ARM,standalone:true},
 'slice-n-dice':{requires:ARM,standalone:true},'tool-hand':{requires:ARM,standalone:true},'wolvers':{requires:ARM,standalone:true},
 'standard-hand':{requires:ARM,cost:0,text:'no Cyberarm option slot',standalone:true},
 'standard-foot':{requires:LEG,cost:0,text:'no Cyberleg option slot',standalone:true},
 'grip-foot':{requires:LEG},'skate-foot':{requires:LEG},'web-foot':{requires:LEG},'talon-foot':{requires:LEG,standalone:true},
 'jump-booster':{requires:LEG,cost:2,text:'2 option slots'},
 'gills':{pool:'internal',cost:1,text:'1 internal body option slot'},'toxin-binders':{pool:'internal',cost:1,text:'1 internal body option slot'},
 'midnight-lady':{pool:'internal',cost:1,text:'1 internal cyberware option slot'},'mr-studd':{pool:'internal',cost:1,text:'1 internal cyberware option slot'},
 'plastic-covering':{requires:['cyberarm','cyberleg'],cost:0,text:'no option slot'},
 'realskinn-covering':{requires:['cyberarm','cyberleg'],cost:0,text:'no option slot'},
 'superchrome-covering':{requires:['cyberarm','cyberleg'],cost:0,text:'no option slot'},
};
// Only-one groups. text is the catalog fragment when the catalog says so; the Linear Frames group comes from the product plan.
const GROUPS={
 speedware:{members:['kerenzikov','sandevistan'],text:'only one speedware'},
 'linear-frame':{members:['implanted-linear-frame-beta','implanted-linear-frame-sigma']},
 'cyberaudio-suite':{members:['cyberaudio-suite'],text:'Only one Cyberaudio Suite'},
 'artificial-shoulder-mount':{members:['artificial-shoulder-mount'],text:'Only one mount'},
 'multioptic-mount':{members:['multioptic-mount'],text:'only one MultiOptic Mount'},
 'sensor-array':{members:['sensor-array'],text:'Only one Sensor Array'},
};
// How many of a limb/eye foundation the body takes: the catalog speaks of two eyes, two legs, and mounts that carry more.
const LIMITS={'cybereye':{base:2,mount:'multioptic-mount',extra:5,text:'Mounts up to five additional Cybereyes',baseText:'requires two Cybereyes'},
 'cyberarm':{base:2,mount:'artificial-shoulder-mount',extra:2,text:'Allows two additional Cyberarms'},
 'cyberleg':{base:2,baseText:'Requires two paired Cyberlegs'}};
const full=id=>P+id;
const GROUP_OF={};for(const g of Object.keys(GROUPS))for(const m of GROUPS[g].members)GROUP_OF[full(m)]=g;
const SPEC_FOUNDATIONS={},SPEC_OPTIONS={};
for(const k of Object.keys(FOUNDATIONS))SPEC_FOUNDATIONS[full(k)]={...FOUNDATIONS[k]};
for(const k of Object.keys(OPTIONS)){const o=OPTIONS[k];SPEC_OPTIONS[full(k)]={...o,requires:(o.requires||[]).map(full),costFrom:o.costFrom?full(o.costFrom):undefined}}

/* ---------- catalog ---------- */
const catalog=()=>Array.isArray(W.CATALOG)?W.CATALOG:[];
const findItem=id=>catalog().find(x=>x&&x.id===id)||null;
const ID_RE=/^[A-Za-z0-9_-]{1,64}$/;
function int(v,lo,hi){const n=typeof v==='number'?v:typeof v==='string'&&/^\s*-?\d{1,6}\s*$/.test(v)?Number(v):NaN;return Number.isSafeInteger(n)&&n>=lo&&n<=hi?n:null}
// Writes stats.optionSlots / slotCost / requires into the catalog entries (idempotent; entries that already carry a value are kept).
function applyToCatalog(list){
 const items=Array.isArray(list)?list:catalog();let n=0;
 for(const it of items){
  if(!it||it.category!=='cyberware'||it.custom===true||!isObject(it.stats))continue;
  const f=SPEC_FOUNDATIONS[it.id],o=SPEC_OPTIONS[it.id];
  if(f&&it.stats.optionSlots===undefined){it.stats.optionSlots=f.slots;n++}
  if(o){
   if(o.requires.length&&it.stats.requires===undefined){it.stats.requires=o.requires.slice();n++}
   if(o.pool&&it.stats.pool===undefined){it.stats.pool=o.pool;n++}
   if(o.cost!==undefined&&it.stats.slotCost===undefined){it.stats.slotCost=o.cost;n++}
  }
 }
 return n;
}
const name=(id,lang)=>{const it=findItem(id);const nm=it?.name;return (typeof nm==='string'?nm:nm?.[lang==='en'?'en':'ru']||nm?.en||nm?.ru)||String(id).replace(/^cyberware-/,'').replace(/-/g,' ')};
const L=lang=>lang==='en'?'en':'ru';

/* ---------- item facts ---------- */
// The family of a foundation: a fixed word for catalog foundations, the item's own id for custom ones.
function kindOf(id){return SPEC_FOUNDATIONS[id]?.kind||id}
function slotsOf(item){const n=int(item?.stats?.optionSlots,1,50);return n===null?0:n}
// Only foundations that exist: an option whose foundation was deleted is a plain item, not an uninstallable one.
function requiresOf(item){const r=item?.stats?.requires;if(!Array.isArray(r))return [];return r.filter(x=>typeof x==='string'&&ID_RE.test(x)&&slotsOf(findItem(x))>0).slice(0,3)}
function poolOf(item){return item?.category==='cyberware'&&item.stats?.pool==='internal'?'internal':null}
// Options the catalog calls paired: one copy per eye or leg.
function isPaired(item){const opt=isOption(item),txt=/pair(ed|ing)/i.test(String(item?.details?.en||''));return opt&&txt}
function groupOf(item){return item&&own(GROUP_OF,item.id)?GROUP_OF[item.id]:null}
function isStandalone(item){return !!item&&SPEC_OPTIONS[item.id]?.standalone===true||item?.stats?.standalone===true}
function isFoundation(item){return item?.category==='cyberware'&&slotsOf(item)>0}
function isOption(item){return item?.category==='cyberware'&&(requiresOf(item).length>0||poolOf(item)!==null)}

/* ---------- saved settings ---------- */
const DEFAULT_COST=1,MAX_COST=5,MAX_MANUAL=4,MAX_INTERNAL=10;
function extraOf(c){const x=c?.extra;return isObject(x)?x:null}
// {defaultCost, costs} read defensively: anything unreadable falls back to the default.
function settings(c){
 const s=extraOf(c)?.cyberSlots;const out={defaultCost:DEFAULT_COST,costs:{},manual:{},internalSlots:null};
 if(!isObject(s)||s.version!==1)return out;
 const d=int(s.defaultCost,0,MAX_COST);if(d!==null)out.defaultCost=d;
 if(isObject(s.costs))for(const k of Object.keys(s.costs).slice(0,400)){const v=int(s.costs[k],0,MAX_COST);if(v!==null&&ID_RE.test(k)&&k!=='__proto__')out.costs[k]=v}
 if(isObject(s.manual))for(const k of Object.keys(s.manual).slice(0,100)){const v=int(s.manual[k],1,MAX_MANUAL);if(v!==null&&ID_RE.test(k)&&k!=='__proto__')out.manual[k]=v}
 const q=int(s.internalSlots,0,MAX_INTERNAL);if(q!==null)out.internalSlots=q;
 return out;
}
// Where a cost comes from, for the panel: 'catalog' (stated by the item's text), 'custom' (typed by the player on the item), 'user', 'default'.
function costOf(item,st){
 const stated=int(item?.stats?.slotCost,0,50);
 if(stated!==null)return {cost:stated,source:item.custom===true?'custom':'catalog'};
 if(own(st.costs,item?.id))return {cost:st.costs[item.id],source:'user'};
 return {cost:st.defaultCost,source:'default'};
}
function writable(c){const x=c?.extra;if(x===undefined)return true;return isObject(x)&&(x.cyberSlots===undefined||(isObject(x.cyberSlots)&&x.cyberSlots.version===1))}
function ensureSettings(c){
 if(!writable(c))return null;if(c.extra===undefined)c.extra={};
 if(c.extra.cyberSlots===undefined)c.extra.cyberSlots={version:1,defaultCost:DEFAULT_COST,costs:{}};
 const s=c.extra.cyberSlots;if(!isObject(s.costs))s.costs={};if(int(s.defaultCost,0,MAX_COST)===null)s.defaultCost=DEFAULT_COST;return s;
}
function setCost(c,catalogId,value){
 const item=findItem(catalogId),n=int(value,0,MAX_COST);
 if(!item||!isOption(item)||n===null||int(item.stats.slotCost,0,50)!==null)return {ok:false,reason:'invalid'};
 const s=ensureSettings(c);if(!s)return {ok:false,reason:'foreign'};
 if(n===settings(c).defaultCost&&!own(s.costs,catalogId))return {ok:true,dirty:false};
 s.costs[catalogId]=n;return {ok:true,dirty:true};
}
// Foundations the player already has but that were not installed with the tool (an older save, a hand-kept item): counted by hand.
function setManual(c,catalogId,value){
 const item=findItem(catalogId),n=int(value,0,MAX_MANUAL);
 if(!item||!isFoundation(item)||n===null)return {ok:false,reason:'invalid'};
 const s=ensureSettings(c);if(!s)return {ok:false,reason:'foreign'};
 if(!isObject(s.manual))s.manual={};
 const had=own(s.manual,catalogId)?int(s.manual[catalogId],1,MAX_MANUAL)||0:0;if(had===n)return {ok:true,dirty:false};
 if(n===0)delete s.manual[catalogId];else s.manual[catalogId]=n;return {ok:true,dirty:true};
}
// How many internal body option slots the body has: no number in the catalog, so the player enters it ('' = not tracked).
function setInternal(c,value){
 const n=value===''||value===null?null:int(value,0,MAX_INTERNAL);if(n===null&&value!==''&&value!==null)return {ok:false,reason:'invalid'};
 const s=ensureSettings(c);if(!s)return {ok:false,reason:'foreign'};
 const had=int(s.internalSlots,0,MAX_INTERNAL);if(had===n)return {ok:true,dirty:false};
 if(n===null)delete s.internalSlots;else s.internalSlots=n;return {ok:true,dirty:true};
}
function setDefaultCost(c,value){
 const n=int(value,0,MAX_COST);if(n===null)return {ok:false,reason:'invalid'};
 const s=ensureSettings(c);if(!s)return {ok:false,reason:'foreign'};
 if(s.defaultCost===n)return {ok:true,dirty:false};s.defaultCost=n;return {ok:true,dirty:true};
}

/* ---------- what is installed ---------- */
// Every installed copy: installs made with the equipment tool, then starting implants (humanityLossIncluded). {key, catalogId, host}.
function instances(c,skip){
 const out=[],x=extraOf(c)||{},installs=x.equipment?.installs,items=x.items;
 const man=settings(c).manual;for(const k of Object.keys(man))for(let j=0;j<man[k];j++)out.push({key:'m:'+k+':'+j,catalogId:k,host:null});
 if(Array.isArray(installs))for(const i of installs){if(isObject(i)&&!i.removedAt&&typeof i.id==='string'&&i.id&&typeof i.catalogId==='string')out.push({key:'i:'+i.id,catalogId:i.catalogId,host:typeof i.host==='string'?i.host:null})}
 if(Array.isArray(items))for(const r of items){
  if(!isObject(r)||r.humanityLossIncluded!==true||typeof r.id!=='string'||!r.id||typeof r.catalogId!=='string')continue;
  const q=int(r.quantity,1,99999)||1;for(let k=0;k<Math.min(q,10);k++)out.push({key:'r:'+r.id+':'+k,catalogId:r.catalogId,host:null});
 }
 const seen=new Set(),drop=skip&&typeof skip.has==='function'?skip:new Set();
 return out.filter(v=>!drop.has(v.key)&&!seen.has(v.key)&&seen.add(v.key)&&findItem(v.catalogId)?.category==='cyberware');
}
// The kinds an option can sit in.
const hostKinds=item=>new Set([...requiresOf(item).map(kindOf),...(poolOf(item)?[poolOf(item)]:[])]);
// Puts every installed option into a foundation. hosts: [{key,catalogId,kind,capacity,used,free,options:[{key,catalogId,cost,source}]}],
// loose: options with no place: reason 'standalone' (a meat limb, allowed), 'overflow' (no room, an old save), 'noHost' (no foundation).
function layout(c,skip,extra){
 const st=settings(c),inst=instances(c,skip).concat(Array.isArray(extra)?extra:[]),hosts=[];
 for(const i of inst){const it=findItem(i.catalogId),n=slotsOf(it);if(n>0)hosts.push({key:i.key,catalogId:i.catalogId,kind:kindOf(i.catalogId),capacity:n,used:0,options:[]})}
 if(st.internalSlots!==null)hosts.push({key:'pool:internal',catalogId:null,kind:'internal',pool:true,capacity:st.internalSlots,used:0,options:[]});
 const loose=[];
 // options that remember their foundation are placed first, so a stored choice is stable
 const order=inst.map((v,ix)=>[v,ix]).sort((a,b)=>(a[0].host?0:1)-(b[0].host?0:1)||a[1]-b[1]).map(v=>v[0]);
 for(const i of order){
  const it=findItem(i.catalogId);if(!isOption(it))continue;
  const {cost,source}=costOf(it,st),kinds=hostKinds(it),cands=hosts.filter(h=>h.key!==i.key&&kinds.has(h.kind));
  const room=h=>h.capacity-h.used>=cost;
  let pick=i.host&&cands.find(h=>h.key===i.host&&room(h))||null;
  if(!pick){let best=-1;for(const h of cands)if(room(h)&&h.capacity-h.used>best){best=h.capacity-h.used;pick=h}}
  if(pick){pick.used+=cost;pick.options.push({key:i.key,catalogId:i.catalogId,cost,source})}
  else loose.push({key:i.key,catalogId:i.catalogId,cost,source,reason:isStandalone(it)?'standalone':poolOf(it)&&st.internalSlots===null?'noPool':cands.length?'overflow':'noHost'});
 }
 for(const h of hosts)h.free=Math.max(0,h.capacity-h.used);
 return {hosts,loose};
}

/* ---------- checking an install ---------- */
const plural=(n,l,one,few,many)=>{if(l==='en')return n===1?one:many;const a=Math.abs(n)%100,b=a%10;return a>10&&a<20?many:b===1?one:b>=2&&b<=4?few:many};
const T={
 ru:{
  noFoundation:(n,h)=>`«${n}» нельзя установить: сначала нужна основа — ${h}.`,
  noFreeSlot:(n,h,cost,free)=>`Нет свободных слотов: «${n}» занимает ${cost}, а в подходящей основе (${h}) свободно не больше ${free}. Освободите слоты или поставьте ещё одну основу.`,
  oneOnly:(n,o)=>`«${n}» можно поставить только один раз из этой группы, а «${o}» уже стоит.`,
  hasOptions:(n,o)=>`В «${n}» установлены опции: ${o}. Сначала уберите их.`,
  limbLimit:(n,have,max,mount)=>`«${n}»: уже установлено ${have} из ${max}.${mount?` Больше позволяет «${mount}».`:''}`,
  free:'свободно',of:'из',slots:'слотов',slot1:'слот',used:'занято',
 },
 en:{
  noFoundation:(n,h)=>`“${n}” cannot be installed yet: it needs a foundation first — ${h}.`,
  noFreeSlot:(n,h,cost,free)=>`No free slot: “${n}” takes ${cost}, and the most free in a suitable foundation (${h}) is ${free}. Free some slots or install another foundation.`,
  oneOnly:(n,o)=>`Only one item of this group can be installed, and “${o}” already is, so “${n}” is refused.`,
  hasOptions:(n,o)=>`“${n}” still holds options: ${o}. Remove them first.`,
  limbLimit:(n,have,max,mount)=>`“${n}”: ${have} of ${max} are already installed.${mount?` “${mount}” allows more.`:''}`,
  free:'free',of:'of',slots:'slots',slot1:'slot',used:'used',
 },
};
const INTERNAL_NAME={ru:'Внутренние слоты тела',en:'Internal body slots'};
const hostNames=(item,lang)=>{const a=requiresOf(item).map(id=>name(id,lang));if(poolOf(item))a.push(INTERNAL_NAME[L(lang)].toLowerCase());return a.join(' / ')};
// How many copies of a limb/eye foundation the body takes (catalog: two, plus what a mount carries), or null for other items.
function limbLimit(c,item,skip){
 const spec=item&&typeof item.id==='string'&&own(LIMITS,item.id.replace(/^cyberware-/,''))?LIMITS[item.id.replace(/^cyberware-/,'')]:null;if(!spec||item.custom===true)return null;
 const inst=instances(c,skip);let max=spec.base;
 const mount=spec.mount?full(spec.mount):null,hasMount=!!mount&&inst.some(i=>i.catalogId===mount);
 if(hasMount)max+=spec.extra;
 return {max,have:inst.filter(i=>i.catalogId===item.id).length,mount:hasMount?null:mount};
}
// Can this catalog item be installed now? {ok:true, host, cost, loose} or {ok:false, reason, message, conflicts?, replaceable?}.
// opts: {host: key of the chosen foundation, skip: Set of instance keys to treat as already removed, lang}.
function check(c,catalogId,opts={}){
 const lang=L(opts.lang),t=T[lang],item=findItem(catalogId);
 if(!item||item.category!=='cyberware')return {ok:true,host:null,cost:0,loose:false,tracked:false};
 const nm=name(catalogId,lang),skip=opts.skip&&typeof opts.skip.has==='function'?opts.skip:new Set();
 const g=groupOf(item);
 if(g){
  const same=instances(c,skip).filter(i=>groupOf(findItem(i.catalogId))===g);
  if(same.length){return {ok:false,reason:'oneOnly',message:t.oneOnly(nm,name(same[0].catalogId,lang)),conflicts:same.map(i=>i.key),replaceable:same.every(i=>i.key.startsWith('i:')),replaces:same.map(i=>name(i.catalogId,lang))}}
 }
 const lim=limbLimit(c,item,skip);
 if(lim&&lim.have>=lim.max)return {ok:false,reason:'limbLimit',message:t.limbLimit(nm,lim.have,lim.max,lim.mount?name(lim.mount,lang):'')};
 if(!isOption(item))return {ok:true,host:null,cost:0,loose:false,tracked:isFoundation(item)};
 const st=settings(c),{cost}=costOf(item,st),lay=layout(c,skip),kinds=hostKinds(item),cands=lay.hosts.filter(h=>kinds.has(h.kind));
 if(!cands.length){
  if(isStandalone(item)||poolOf(item))return {ok:true,host:null,cost,loose:true,tracked:!poolOf(item)};
  return {ok:false,reason:'noFoundation',message:t.noFoundation(nm,hostNames(item,lang))};
 }
 const most=Math.max(...cands.map(x=>x.free)),refuse=()=>({ok:false,reason:'noFreeSlot',message:t.noFreeSlot(nm,hostNames(item,lang),cost,most)});
 let fit=cands.filter(h=>h.free>=cost);
 if(opts.host)fit=fit.filter(x=>x.key===opts.host);
 fit.sort((a,b)=>b.free-a.free);
 // The install is placed in a foundation only when the layout drawn after saving still holds every other option.
 const overflowNow=lay.loose.filter(o=>o.reason==='overflow').length;
 for(const h of fit){
  const sim=layout(c,skip,[{key:'n:new',catalogId,host:h.key}]);
  const placed=sim.hosts.some(x=>x.key===h.key&&x.options.some(o=>o.key==='n:new'));
  if(placed&&sim.loose.filter(o=>o.reason==='overflow').length<=overflowNow)return {ok:true,host:h.key,cost,loose:false,tracked:true};
 }
 if(isStandalone(item))return {ok:true,host:null,cost,loose:true,tracked:true};
 return refuse();
}
// The foundations an item could go into right now (for a choice when there are several).
function hostChoices(c,catalogId,lang){
 const item=findItem(catalogId);if(!isOption(item))return [];
 const {cost}=costOf(item,settings(c)),kinds=hostKinds(item),l=L(lang);
 const lay=layout(c),n={};
 return lay.hosts.filter(h=>!h.pool&&kinds.has(h.kind)&&h.free>=cost).map(h=>{n[h.catalogId]=(n[h.catalogId]||0)+1;return {key:h.key,label:`${name(h.catalogId,l)} #${n[h.catalogId]} (${h.free} ${T[l].free})`,free:h.free}});
}
// A message when removing this install would leave options without their foundation, or null.
function removalBlock(c,installId,lang){
 const key='i:'+installId,h=layout(c).hosts.find(x=>x.key===key);
 if(!h||!h.options.length)return null;const l=L(lang);
 return T[l].hasOptions(name(h.catalogId,l),h.options.map(o=>name(o.catalogId,l)).join(', '));
}

/* ---------- the panel ---------- */
const D={
 ru:{title:'СЛОТЫ ОПЦИЙ',hint:'Основа держит опции в слотах. Установка опции без свободного подходящего слота отклоняется. Стоимость в слотах берётся из описания предмета; если там её нет — из вашей настройки ниже.',
  usedOf:(u,n)=>`занято ${u} из ${n}`,freeN:n=>n?`свободно ${n}`:'свободных слотов нет',none:'пусто',cost:n=>`${n} ${plural(n,'ru','слот','слота','слотов')}`,
  settings:'Настройки слотов',setCost:'Стоимость в слотах (ваша настройка)',defaultCost:'Стоимость опции по умолчанию',defaultHelp:'Применяется к опциям, у которых в описании нет числа слотов. Для каждой опции её можно изменить отдельно.',
  costsTitle:'Стоимость установленных опций',manualTitle:'Основы, которые уже есть у персонажа',manualHelp:'Если основа стоит в старой записи или учтена вручную, укажите её здесь: опции смогут занять её слоты. Humanity это не меняет.',manualLabel:'Уже есть',
  internalTitle:'Внутренние слоты тела',internalHelp:'В описаниях внутренних опций число слотов тела не названо. Укажите его сами; пока поле пустое, такие опции не считаются.',internalNone:'не учитывать',
  loose:'Вне основ',standalone:'на живой конечности — слот не занят',overflow:'не хватает слотов — проверьте запись вручную',noHost:'основа не найдена — проверьте запись вручную',noPool:'укажите число внутренних слотов в настройках — пока не считается',
  pairedNote:n=>`Парная опция «${n}»: установлен один экземпляр. Для пары нужен второй, в другом глазу или ноге.`,
  noteFound:n=>`Основа: ${n} ${plural(n,'ru','слот','слота','слотов')} опций.`,noteNeeds:(h,c)=>`Нужна основа: ${h}. Занимает: ${c} ${plural(c,'ru','слот','слота','слотов')}.`,noteFree:n=>`Свободных подходящих слотов: ${n}.`,
  noteReplace:o=>`Уже стоит «${o}». Установка заменит его: старый имплант уберут только после вашего подтверждения.`,costLabel:'Стоимость в слотах',
  into:'Установить в',userCost:'ваша настройка',stated:'из описания',custom:'своя запись',def:'по умолчанию'},
 en:{title:'OPTION SLOTS',hint:'A foundation holds its options in slots. An option with no free matching slot is refused. The slot cost comes from the item’s own description; where it gives none, from your setting below.',
  usedOf:(u,n)=>`${u} of ${n} used`,freeN:n=>n?`${n} free`:'no free slots',none:'empty',cost:n=>`${n} ${plural(n,'en','slot','','slots')}`,
  settings:'Slot settings',setCost:'Slot cost (your setting)',defaultCost:'Default option cost',defaultHelp:'Used for options whose description gives no slot number. You can change it for each option separately.',
  costsTitle:'Cost of installed options',manualTitle:'Foundations the character already has',manualHelp:'If a foundation sits in an older record or is tracked by hand, enter it here so options can use its slots. This does not change Humanity.',manualLabel:'Already owned',
  internalTitle:'Internal body slots',internalHelp:'The internal options’ descriptions do not name how many body slots there are. Enter your own number; while it is empty, such options are not counted.',internalNone:'not tracked',
  loose:'Outside foundations',standalone:'on a meat limb — no slot used',overflow:'not enough slots — check this entry by hand',noHost:'no foundation found — check this entry by hand',noPool:'set the internal slot count in the settings — not counted yet',
  pairedNote:n=>`Paired option “${n}”: one copy is installed. A pair needs a second one, in the other eye or leg.`,
  noteFound:n=>`Foundation: ${n} option ${plural(n,'en','slot','','slots')}.`,noteNeeds:(h,c)=>`Needs a foundation: ${h}. Takes ${c} ${plural(c,'en','slot','','slots')}.`,noteFree:n=>`Matching free slots: ${n}.`,
  noteReplace:o=>`“${o}” is already installed. Installing this replaces it: the old implant is removed only after you confirm.`,costLabel:'Slot cost',
  into:'Install into',userCost:'your setting',stated:'from the description',custom:'custom entry',def:'default'},
};
const SRC={catalog:'stated',custom:'custom',user:'userCost',default:'def'};
const numOptions=(max,cur,first)=>(first?[`<option value=""${cur===null?' selected':''}>${esc(first)}</option>`]:[]).concat(Array.from({length:max+1},(_,n)=>`<option value="${n}"${n===cur?' selected':''}>${n}</option>`)).join('');
function costSelect(o,lang,t){
 return `<label class="cs-field">${esc(name(o.catalogId,lang))}<select class="cs-cost" data-cs-cost="${esc(o.catalogId)}" aria-label="${esc(t.setCost+': '+name(o.catalogId,lang))}">${numOptions(MAX_COST,o.cost)}</select></label>`;
}
function renderPanel(c,lang){
 const l=L(lang),t=D[l],lay=layout(c);
 if(!catalog().some(isFoundation))return '';
 const st=settings(c);
 const dots=h=>{let s='';for(let i=0;i<h.capacity;i++)s+=`<i class="${i<h.used?'on':''}"></i>`;return `<span class="cs-dots" aria-hidden="true">${s}</span>`};
 const hname=h=>h.pool?INTERNAL_NAME[l]:name(h.catalogId,l);
 const optRow=o=>`<li class="cs-opt"><span class="cs-name">${esc(name(o.catalogId,l))}</span><span class="cs-cost-text">${esc(t.cost(o.cost))} · <small>${esc(t[SRC[o.source]])}</small></span></li>`;
 const cards=lay.hosts.map(h=>`<div class="cs-host${h.free===0?' full':''}" data-cs-host="${esc(h.key)}"><div class="cs-head"><strong>${esc(hname(h))}</strong><span class="cs-count">${esc(t.usedOf(h.used,h.capacity))} · ${esc(t.freeN(h.free))}</span></div>${dots(h)}${h.options.length?`<ul class="cs-opts">${h.options.map(optRow).join('')}</ul>`:`<p class="cs-empty">${esc(t.none)}</p>`}</div>`).join('');
 const loose=lay.loose.length?`<div class="cs-host cs-loose"><div class="cs-head"><strong>${esc(t.loose)}</strong></div><ul class="cs-opts">${lay.loose.map(o=>`<li class="cs-opt"><span class="cs-name">${esc(name(o.catalogId,l))}</span><span class="cs-cost-text"><small>${esc(t[o.reason])}</small></span></li>`).join('')}</ul></div>`:'';
 // paired options with an odd number of copies
 const counts={};for(const h of lay.hosts)for(const o of h.options)counts[o.catalogId]=(counts[o.catalogId]||0)+1;for(const o of lay.loose)counts[o.catalogId]=(counts[o.catalogId]||0)+1;
 const pairs=Object.keys(counts).filter(k=>counts[k]%2===1&&isPaired(findItem(k))).map(k=>`<p class="cs-note">${esc(t.pairedNote(name(k,l)))}</p>`).join('');
 const editable=[];for(const h of lay.hosts)for(const o of h.options)if((o.source==='user'||o.source==='default')&&!editable.some(x=>x.catalogId===o.catalogId))editable.push(o);
 const costs=editable.length?`<h4>${esc(t.costsTitle)}</h4><div class="cs-fields">${editable.map(o=>costSelect(o,l,t)).join('')}</div>`:'';
 const manual=catalog().filter(isFoundation).map(x=>`<label class="cs-field">${esc(name(x.id,l))}<select data-cs-manual="${esc(x.id)}" aria-label="${esc(t.manualLabel+': '+name(x.id,l))}">${numOptions(MAX_MANUAL,st.manual[x.id]||0)}</select></label>`).join('');
 return `<div class="cs-panel" data-cs-panel tabindex="-1"><h3>${esc(t.title)}</h3><p class="et-hint">${esc(t.hint)}</p>${cards}${loose}${pairs}<details class="et-more cs-settings"><summary>${esc(t.settings)}</summary><div class="cs-fields"><label class="cs-field">${esc(t.defaultCost)}<select data-cs-default>${numOptions(MAX_COST,st.defaultCost)}</select></label></div><p class="et-hint">${esc(t.defaultHelp)}</p>${costs}<h4>${esc(t.internalTitle)}</h4><div class="cs-fields"><label class="cs-field">${esc(t.internalTitle)}<select data-cs-internal>${numOptions(MAX_INTERNAL,st.internalSlots,t.internalNone)}</select></label></div><p class="et-hint">${esc(t.internalHelp)}</p><h4>${esc(t.manualTitle)}</h4><div class="cs-fields">${manual}</div><p class="et-hint">${esc(t.manualHelp)}</p></details></div>`;
}
// A short note under an item that is not installed yet, or ''. States whether the install would be refused or replace something.
function rowNote(c,item,lang){
 if(!item||item.category!=='cyberware')return '';const l=L(lang),t=D[l];
 const r=check(c,item.id,{lang:l});
 const warn=!r.ok?(r.reason==='oneOnly'&&r.replaceable?t.noteReplace(r.replaces[0]):r.message):'';
 const warnHTML=warn?`<p class="et-hint cs-note cs-warn">${esc(warn)}</p>`:'';
 if(isOption(item)){
  const {cost,source}=costOf(item,settings(c)),kinds=hostKinds(item),free=layout(c).hosts.filter(h=>kinds.has(h.kind)).reduce((a,h)=>Math.max(a,h.free),0);
  const sel=(source==='user'||source==='default')?`<label class="cs-field">${esc(t.costLabel)}<select data-cs-cost="${esc(item.id)}" aria-label="${esc(t.setCost+': '+name(item.id,l))}">${numOptions(MAX_COST,cost)}</select></label>`:'';
  return `<p class="et-hint cs-note">${esc(t.noteNeeds(hostNames(item,l),cost))} ${esc(t.noteFree(free))}</p>${warnHTML}${sel}`;
 }
 if(isFoundation(item))return `<p class="et-hint cs-note">${esc(t.noteFound(slotsOf(item)))}</p>${warnHTML}`;
 return warnHTML;
}
function hostSelect(c,catalogId,lang){
 const ch=hostChoices(c,catalogId,lang);if(ch.length<2)return '';const t=D[L(lang)];
 return `<label>${esc(t.into)}<select data-eq-host>${ch.map(x=>`<option value="${esc(x.key)}">${esc(x.label)}</option>`).join('')}</select></label>`;
}
// A change event from the panel's selects. {handled, dirty, rerender, notify}.
function handleChange(el,c,lang){
 if(!el||!c)return {handled:false};
 const res=r=>({handled:true,dirty:r.ok&&r.dirty===true,rerender:true});
 if(el.dataset?.csCost!==undefined)return res(setCost(c,el.dataset.csCost,el.value));
 if(el.dataset?.csDefault!==undefined)return res(setDefaultCost(c,el.value));
 if(el.dataset?.csManual!==undefined)return res(setManual(c,el.dataset.csManual,el.value));
 if(el.dataset?.csInternal!==undefined)return res(setInternal(c,el.value));
 return {handled:false};
}
// Foundations for a choice list: [{id,name}] (catalog and custom).
function foundations(lang){return catalog().filter(x=>isFoundation(x)).map(x=>({id:x.id,name:name(x.id,lang)}))}

try{applyToCatalog()}catch{}
W.CyberSlots={FOUNDATIONS,OPTIONS,GROUPS,LIMITS,SPEC_FOUNDATIONS,SPEC_OPTIONS,applyToCatalog,slotsOf,requiresOf,poolOf,isPaired,groupOf,isFoundation,isOption,kindOf,settings,costOf,setCost,setDefaultCost,setManual,setInternal,instances,layout,limbLimit,check,hostChoices,removalBlock,renderPanel,rowNote,hostSelect,handleChange,foundations};
})(typeof window!=='undefined'?window:globalThis);
