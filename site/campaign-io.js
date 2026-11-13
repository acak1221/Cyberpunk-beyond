/* Campaign transfer: a whole campaign (roster with NPCs, notes, Beat Chart, journal) and, when asked for, the progress
   clocks, the NPC library, the prepared NPCs of the GM tools and the sheets of the characters in the roster go into one
   JSON file and come back from one. A file is never trusted: every record is rebuilt field by field, a preview says
   what will be added, and nothing that is already here is replaced. A name that is taken gets a number. */
(function(global){
'use strict';
const FORMAT='nightcity-red-campaign',VERSION=1,MAX_FILE=16*1024*1024,MAX_CAMPAIGNS=50,MAX_ROSTER=2045,MAX_NOTES=100000,MAX_SHEETS=60,MAX_GM_NPCS=200,MAX_NAME=100;
const T={
 ru:{title:'ПЕРЕНОС КАМПАНИЙ',one:'ФАЙЛ КАМПАНИИ',lead:'Кампания целиком сохраняется в один файл: участники и NPC, заметки, план сценария и журнал. Файл можно открыть в другом браузере или передать другому ведущему.',
  exportAll:'Экспорт всех кампаний',exportOne:'Экспорт этой кампании',choose:'Импорт из файла',with:'Вместе с кампанией в файл попадут',oClocks:'Часы прогресса',oLibrary:'Библиотека NPC',oGmNpcs:'NPC из инструментов ведущего',oSheets:'Листы персонажей из списка участников',
  none:'Пока нет кампаний для экспорта.',exported:n=>`Файл сохранён. Кампаний в нём: ${n}.`,exportFail:'Не удалось сохранить файл.',exportBig:'Файл получается слишком большим. Снимите отметку «Листы персонажей» и повторите.',
  errBig:'Файл слишком большой: больше 16 МБ.',errJson:'Файл не читается: это не JSON.',errFormat:'Это не файл кампании Night City // RED.',errBackup:'Это полная резервная копия, а не файл кампании. Откройте «Персонажи» → «Данные», чтобы добавить данные из копии.',errNewer:'Файл создан более новой версией приложения. Обновите страницу и повторите.',errEmpty:'В файле нет записей, которые можно добавить.',errRead:'Не удалось прочитать файл.',
  preview:'ПРЕДПРОСМОТР ИМПОРТА',file:'Файл',safe:'Ничего не будет заменено или удалено: записи из файла добавятся рядом с вашими. Если название уже занято, новая запись получит номер.',
  campaigns:'Кампании',clocks:'Часы прогресса',library:'Библиотека NPC',gmNpcs:'NPC из инструментов ведущего',sheets:'Листы персонажей',
  as:'будет добавлена как',renamed:'название занято',roster:(p,n)=>`участников: ${p+n} (персонажей ${p}, NPC ${n})`,journal:n=>`журнал: ${n}`,beats:n=>`битов в плане: ${n}`,notes:n=>`заметки: ${n} зн.`,
  pcAdd:n=>`листов добавится: ${n}`,pcHave:n=>`связано с вашими листами: ${n}`,pcNone:n=>`без листа: ${n} (в списке будет «не привязан»)`,dropped:n=>`Пропущено непонятных записей: ${n}.`,
  stAdd:'добавится',stRename:n=>`добавится как «${n}»`,stSame:'уже есть у вас, пропущено',stLimit:'не поместится: достигнут предел',stBad:'не подходит, пропущено',stHave:n=>`уже есть у вас («${n}»), ваш лист не изменится`,stUnused:'не нужен выбранным кампаниям, пропущено',
  apply:'Добавить выбранное',cancel:'Отмена',nothing:'Ничего не выбрано.',done:(c,k,l,g,s)=>`Импорт завершён. Кампаний: ${c}, часов: ${k}, NPC в библиотеке: ${l}, NPC ведущего: ${g}, листов: ${s}.`,sheetFail:n=>` Листов не удалось добавить: ${n}.`,
  fail:'Не удалось сохранить импорт: в хранилище браузера не хватило места или редактирование приостановлено. Данные остались прежними.',cancelled:'Импорт отменён.',imported:'Кампания из файла',unnamed:'Без названия',include:'Добавить'},
 en:{title:'CAMPAIGN TRANSFER',one:'CAMPAIGN FILE',lead:'A whole campaign is saved into one file: participants and NPCs, notes, the scenario plan and the journal. The file can be opened in another browser or given to another Game Master.',
  exportAll:'Export all campaigns',exportOne:'Export this campaign',choose:'Import from a file',with:'Along with the campaign the file will hold',oClocks:'Progress clocks',oLibrary:'NPC library',oGmNpcs:'NPCs from the GM tools',oSheets:'Sheets of the characters in the roster',
  none:'No campaigns to export yet.',exported:n=>`File saved. Campaigns in it: ${n}.`,exportFail:'The file could not be saved.',exportBig:'The file would be too large. Untick “Sheets of the characters” and try again.',
  errBig:'The file is too large: over 16 MB.',errJson:'The file cannot be read: it is not JSON.',errFormat:'This is not a Night City // RED campaign file.',errBackup:'This is a full backup, not a campaign file. Open “Characters” → “Data” to add data from a backup.',errNewer:'The file was made by a newer version of the app. Reload the page and try again.',errEmpty:'The file has no records that can be added.',errRead:'The file could not be read.',
  preview:'IMPORT PREVIEW',file:'File',safe:'Nothing will be replaced or deleted: records from the file are added next to yours. When a name is taken, the new record gets a number.',
  campaigns:'Campaigns',clocks:'Progress clocks',library:'NPC library',gmNpcs:'NPCs from the GM tools',sheets:'Character sheets',
  as:'will be added as',renamed:'name is taken',roster:(p,n)=>`participants: ${p+n} (characters ${p}, NPCs ${n})`,journal:n=>`journal: ${n}`,beats:n=>`Beats in the plan: ${n}`,notes:n=>`notes: ${n} chars`,
  pcAdd:n=>`sheets to add: ${n}`,pcHave:n=>`linked to your sheets: ${n}`,pcNone:n=>`without a sheet: ${n} (shown as “not linked”)`,dropped:n=>`Unreadable records skipped: ${n}.`,
  stAdd:'will be added',stRename:n=>`will be added as “${n}”`,stSame:'you already have it, skipped',stLimit:'does not fit: the limit is reached',stBad:'not usable, skipped',stHave:n=>`you already have it (“${n}”), your sheet stays as it is`,stUnused:'not needed by the chosen campaigns, skipped',
  apply:'Add the selected',cancel:'Cancel',nothing:'Nothing is selected.',done:(c,k,l,g,s)=>`Import finished. Campaigns: ${c}, clocks: ${k}, library NPCs: ${l}, GM NPCs: ${g}, sheets: ${s}.`,sheetFail:n=>` Sheets that could not be added: ${n}.`,
  fail:'The import could not be saved: the browser storage is full or editing is paused. Your data is unchanged.',cancelled:'Import cancelled.',imported:'Campaign from a file',unnamed:'Untitled',include:'Add'},
};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const isObj=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
const copy=v=>JSON.parse(JSON.stringify(v));
const line=(v,max)=>typeof v==='string'?v.replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max):'';
const para=(v,max)=>typeof v==='string'?v.replace(/\r/g,'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,'').slice(0,max):'';
const num=v=>typeof v==='number'?v:typeof v==='string'&&/^\s*-?\d+(\.\d+)?\s*$/.test(v)?Number(v):NaN;
const int=(v,lo,hi,d)=>{const n=num(v);return Number.isFinite(n)?Math.min(hi,Math.max(lo,Math.trunc(n))):d};
const validId=v=>typeof v==='string'&&v.length>0&&v.length<=160&&!/[\u0000-\u001f]/.test(v);
const uid=()=>global.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
const shortId=p=>p+'-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8);
function freshId(taken,make=uid){let id=make();for(let i=2;taken.has(id);i++)id=make()+'-'+i;taken.add(id);return id}
const BAD_KEYS=new Set(['__proto__','constructor','prototype']);
// Fields this version does not know are kept only as inert data: short text, finite numbers, flags, shallow lists and objects.
function inert(v,depth=0,text=2000){
 if(typeof v==='string')return v.replace(/\u0000/g,'').slice(0,text);
 if(typeof v==='number')return Number.isFinite(v)?v:undefined;
 if(typeof v==='boolean'||v===null)return v;
 if(typeof v!=='object'||depth>=4)return undefined;
 if(Array.isArray(v))return v.slice(0,200).map(x=>inert(x,depth+1,text)).filter(x=>x!==undefined);
 const out={};for(const k of Object.keys(v).slice(0,40)){if(BAD_KEYS.has(k)||k.length>60)continue;const x=inert(v[k],depth+1,text);if(x!==undefined)out[k]=x}
 return out;
}
function extras(src,known,out){for(const k of Object.keys(src).slice(0,80)){if(known.has(k)||BAD_KEYS.has(k)||k.length>60)continue;const x=inert(src[k],1);if(x!==undefined)out[k]=x}return out}
const ROSTER_KEYS=new Set(['id','kind','characterId','name','ref','hp','maxHp','initiative','bonus','order','ties','held','out','dead','hidden','deathPenalty','sp','body','sourcePage','sourceTemplate','sourceLibrary','combatNote']);
function cleanRosterEntry(r,taken,index=0){
 if(!isObj(r)||!['pc','npc'].includes(r.kind))return null;
 const out=extras(r,ROSTER_KEYS,{});
 out.id=validId(r.id)&&!taken.has(r.id)?(taken.add(r.id),r.id):freshId(taken);out.kind=r.kind;
 if(r.kind==='pc')out.characterId=validId(r.characterId)?r.characterId:'';
 else{out.name=line(r.name,MAX_NAME)||'NPC';out.ref=int(r.ref,0,20,0);out.hp=int(r.hp,-999,999,0);const max=int(r.maxHp,0,999,NaN);if(Number.isFinite(max))out.maxHp=max}
 out.initiative=int(r.initiative,-999,999,0);
 const bonus=int(r.bonus,-99,99,0);if(bonus)out.bonus=bonus;
 const order=num(r.order);out.order=Number.isFinite(order)?order:index;
 if(Array.isArray(r.ties)){const ties=r.ties.filter(n=>Number.isInteger(n)&&n>=-999&&n<=999).slice(0,20);if(ties.length)out.ties=ties}
 for(const k of ['held','out','dead','hidden'])if(r[k]===true)out[k]=true;
 const pen=int(r.deathPenalty,0,99,0);if(pen)out.deathPenalty=pen;
 if(isObj(r.sp)){const h=int(r.sp.head,0,30,NaN),b=int(r.sp.body,0,30,NaN);if(Number.isFinite(h)&&Number.isFinite(b))out.sp={head:h,body:b}}
 const body=int(r.body,1,20,NaN);if(Number.isFinite(body)&&r.body!==undefined)out.body=body;
 const page=int(r.sourcePage,1,999,NaN);if(Number.isFinite(page)&&r.sourcePage!==undefined)out.sourcePage=page;
 const tpl=line(r.sourceTemplate,80);if(tpl)out.sourceTemplate=tpl;
 if(typeof r.sourceLibrary==='string'&&/^[A-Za-z0-9_-]{1,40}$/.test(r.sourceLibrary))out.sourceLibrary=r.sourceLibrary;
 if(isObj(r.combatNote)&&typeof r.combatNote.text==='string'){const text=para(r.combatNote.text,300);if(text)out.combatNote={version:1,text}}
 return out;
}
const CAMPAIGN_KEYS=new Set(['id','name','notes','roster','round','turnIndex','journal','beats','journalShared']);
// A campaign from a file, rebuilt: {campaign, dropped}. The id is kept only as a hint; apply() always gives a new one.
function cleanCampaign(c){
 if(!isObj(c))return null;
 let dropped=0;const out=extras(c,CAMPAIGN_KEYS,{}),ids=new Set(),raw=Array.isArray(c.roster)?c.roster:[];
 out.id=validId(c.id)?c.id:uid();out.name=line(c.name,MAX_NAME);out.notes=para(c.notes,MAX_NOTES);out.roster=[];
 raw.slice(0,MAX_ROSTER).forEach((r,i)=>{const x=cleanRosterEntry(r,ids,i);if(x)out.roster.push(x);else dropped++});dropped+=Math.max(0,raw.length-MAX_ROSTER);
 out.round=int(c.round,1,9999,1);out.turnIndex=int(c.turnIndex,0,Math.max(0,out.roster.length-1),0);
 const rawJournal=Array.isArray(c.journal)?c.journal:[],journal=global.Campaigns?.readJournal?.({journal:rawJournal})||[],jids=new Set();
 for(const e of journal){if(jids.has(e.id))e.id=freshId(jids);else jids.add(e.id)}
 dropped+=rawJournal.length-journal.length;if(journal.length)out.journal=journal;
 const rawBeats=Array.isArray(c.beats)?c.beats:[],beats=global.BeatChart?.read?.({beats:rawBeats})||[],bids=new Set();
 for(const b of beats){if(bids.has(b.id))b.id=freshId(bids);else bids.add(b.id)}
 dropped+=rawBeats.length-beats.length;if(beats.length)out.beats=beats;
 const shared=[];for(const id of Array.isArray(c.journalShared)?c.journalShared:[]){if(typeof id==='string'&&jids.has(id)&&!shared.includes(id))shared.push(id);if(shared.length>=20)break}
 if(shared.length)out.journalShared=shared;
 return {campaign:out,dropped};
}
// The same check app.js makes for a campaign in a snapshot.
const validCampaign=c=>!!(isObj(c)&&typeof c.id==='string'&&c.id&&typeof c.name==='string'&&Array.isArray(c.roster)&&c.roster.every(r=>isObj(r)&&typeof r.id==='string'&&r.id&&['pc','npc'].includes(r.kind)));
const campaignsOf=st=>(Array.isArray(st?.campaigns)?st.campaigns:[]).filter(c=>isObj(c)&&typeof c.id==='string');
const gmRoster=st=>isObj(st?.gmWorkspace)&&Array.isArray(st.gmWorkspace.roster)?st.gmWorkspace.roster:[];
const pcIds=list=>{const ids=new Set();for(const c of list)for(const r of Array.isArray(c.roster)?c.roster:[])if(r?.kind==='pc'&&typeof r.characterId==='string'&&r.characterId)ids.add(r.characterId);return ids};

// ---------- export ----------
function buildExport(state,opts={},now=Date.now()){
 const all=campaignsOf(state),list=Array.isArray(opts.campaignIds)?all.filter(c=>opts.campaignIds.includes(c.id)):all;
 const out={format:FORMAT,version:VERSION,exportedAt:new Date(now).toISOString(),campaigns:copy(list)};
 if(opts.clocks!==false){const k=global.GMExtras?.readClocks?.(state)||[];if(k.length)out.clocks=copy(k)}
 if(opts.library!==false){const l=global.NpcLibrary?.readLibrary?.(state)||[];if(l.length)out.library=copy(l)}
 if(opts.gmNpcs!==false){const g=gmRoster(state).filter(isObj);if(g.length)out.gmNpcs=copy(g)}
 if(opts.sheets!==false){const want=pcIds(list),s=(Array.isArray(state?.characters)?state.characters:[]).filter(c=>isObj(c)&&want.has(c.id)).slice(0,MAX_SHEETS);if(s.length)out.sheets=copy(s)}
 return out;
}
function fileName(list,now=Date.now()){
 const d=new Date(now),day=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
 const slug=list.length===1?String(list[0]?.name||'').replace(/[^\p{L}\p{N}]+/gu,'-').replace(/^-+|-+$/g,'').slice(0,40):'';
 return `nc-red-${list.length===1?'campaign':'campaigns'}${slug?'-'+slug:''}-${day}.json`;
}

// ---------- reading a file ----------
// {ok:true,bundle} or {ok:false,reason}. The bundle holds only rebuilt records.
function parse(text){
 if(typeof text!=='string')return {ok:false,reason:'read'};
 if(text.length>MAX_FILE)return {ok:false,reason:'big'};
 let data;try{data=JSON.parse(text)}catch{return {ok:false,reason:'json'}}
 if(!isObj(data))return {ok:false,reason:'format'};
 if(data.format!==FORMAT)return {ok:false,reason:data.format===undefined&&Array.isArray(data.characters)&&Array.isArray(data.campaigns)?'backup':'format'};
 if(!Number.isSafeInteger(data.version)||data.version<1)return {ok:false,reason:'format'};
 if(data.version>VERSION)return {ok:false,reason:'newer'};
 const bundle={campaigns:[],clocks:[],library:[],gmNpcs:[],sheets:[],dropped:0};
 const list=k=>Array.isArray(data[k])?data[k]:[];
 for(const c of list('campaigns').slice(0,MAX_CAMPAIGNS)){const x=cleanCampaign(c);if(x){bundle.campaigns.push(x.campaign);bundle.dropped+=x.dropped}else bundle.dropped++}
 bundle.dropped+=Math.max(0,list('campaigns').length-MAX_CAMPAIGNS);
 const X=global.GMExtras,L=global.NpcLibrary,G=global.GMTools;
 for(const c of list('clocks').slice(0,X?.MAX_CLOCKS||30)){const x=X?.cleanClock?.(c);if(x)bundle.clocks.push({name:x.name,size:x.size,filled:x.filled});else bundle.dropped++}
 for(const e of list('library').slice(0,L?.MAX||100)){const x=L?.cleanEntry?.(e);if(x)bundle.library.push(x);else bundle.dropped++}
 for(const n of list('gmNpcs').slice(0,MAX_GM_NPCS)){const x=isObj(n)?inert(n,0,5000):null,base=G?.initial?.();
  if(x&&base&&G.validWorkspace({...base,roster:[{...x,id:'check'}]}))bundle.gmNpcs.push({...x,id:validId(x.id)?x.id:uid()});else bundle.dropped++}
 for(const s of list('sheets').slice(0,MAX_SHEETS)){if(isObj(s)&&validId(s.id)&&typeof s.name==='string'&&typeof s.role==='string')bundle.sheets.push(s);else bundle.dropped++}
 if(!bundle.campaigns.length&&!bundle.clocks.length&&!bundle.library.length&&!bundle.gmNpcs.length)return {ok:false,reason:'empty'};
 return {ok:true,bundle};
}

// ---------- preview and import ----------
const nameKey=s=>String(s??'').trim().toLowerCase();
// A free name: the name itself, or the name with the first free number in brackets. `taken` holds lowercased names and is updated.
function uniqueName(name,taken,max=MAX_NAME){
 let out=name;
 for(let n=2;taken.has(nameKey(out));n++){const tail=` (${n})`;let base=name.slice(0,max-tail.length).trimEnd();if(/[\uD800-\uDBFF]$/.test(base))base=base.slice(0,-1);out=base+tail}
 taken.add(nameKey(out));return out;
}
const sameBut=(a,b,skip)=>{const strip=x=>{const y={...x};for(const k of skip)delete y[k];return JSON.stringify(Object.keys(y).sort().map(k=>[k,y[k]]))};return strip(a)===strip(b)};
// The record already here that an incoming one repeats: the same content under the same name, or under that name with a number
// (a copy an earlier import made).
const numbered=(have,name)=>{const a=String(have??''),b=String(name??''),i=a.lastIndexOf(' ('),base=a.slice(0,i);return i>0&&/ \(\d+\)$/.test(a)&&(base===b||(a.length>=60&&b.length>base.length&&b.startsWith(base)))};
const twinOf=(existing,x,skip)=>existing.find(e=>sameBut(e,x,skip)||(numbered(e.name,x.name)&&sameBut(e,x,[...skip,'name'])))||null;
const defaultSelect=bundle=>({campaigns:bundle.campaigns.map(()=>true),clocks:true,library:true,gmNpcs:true,sheets:true});
// What an import would do against the current data. Nothing is changed here; apply() follows the same plan.
function plan(bundle,state,select=defaultSelect(bundle),deps={}){
 const l=deps.lang==='en'?'en':'ru',t=T[l],findImport=deps.findImport||(()=>null),X=global.GMExtras,L=global.NpcLibrary;
 const out={campaigns:[],clocks:[],library:[],gmNpcs:[],sheets:[],dropped:bundle.dropped||0};
 // Sheets first: a roster place follows its sheet.
 const chosen=bundle.campaigns.filter((_,i)=>select.campaigns?.[i]!==false),needed=pcIds(chosen),local=new Set((Array.isArray(state?.characters)?state.characters:[]).filter(isObj).map(c=>c.id)),sheetFor=new Map();
 for(const s of bundle.sheets){
  const row={id:s.id,name:line(s.name,80)||t.unnamed,status:'unused',target:''};
  if(select.sheets!==false&&needed.has(s.id)&&!sheetFor.has(s.id)){let m=null;try{m=findImport(s)}catch{}if(m&&typeof m.id==='string'){row.status='have';row.target=m.id;row.targetName=line(m.name,80)||t.unnamed}else row.status='add';sheetFor.set(s.id,row)}
  out.sheets.push(row);
 }
 const names=new Set(campaignsOf(state).map(c=>nameKey(c.name)));
 bundle.campaigns.forEach((c,i)=>{
  const selected=select.campaigns?.[i]!==false,name=c.name||t.imported,finalName=selected?uniqueName(name,names):name,roster=c.roster;
  let add=0,have=0,none=0;for(const r of roster)if(r.kind==='pc'){const s=sheetFor.get(r.characterId);if(s?.status==='add')add++;else if(s?.status==='have'||local.has(r.characterId))have++;else none++}
  out.campaigns.push({index:i,selected,name,finalName,renamed:finalName!==name,pcs:roster.filter(r=>r.kind==='pc').length,npcs:roster.filter(r=>r.kind==='npc').length,journal:c.journal?.length||0,beats:c.beats?.length||0,notes:c.notes.length,pcAdd:add,pcHave:have,pcNone:none});
 });
 const section=(key,existing,limit,maxName,skip)=>{
  const taken=new Set(existing.map(x=>nameKey(x.name)));let count=existing.length;
  bundle[key].forEach((x,i)=>{
   const row={index:i,name:x.name,finalName:x.name,status:'add'};
   if(select[key]===false)row.status='off';
   else if(twinOf(existing,x,skip))row.status='same';
   else if(count>=limit)row.status='limit';
   else{count++;row.finalName=uniqueName(x.name,taken,maxName);if(row.finalName!==x.name)row.status='rename'}
   out[key].push(row);
  });
 };
 section('clocks',X?.readClocks?.(state)||[],X?.MAX_CLOCKS||30,X?.MAX_NAME||60,['id','shared']);
 section('library',L?.readLibrary?.(state)||[],L?.MAX||100,60,['id']);
 const ws=state?.gmWorkspace,wsOk=!!global.GMTools?.validWorkspace?.(ws);
 if(wsOk)section('gmNpcs',ws.roster,MAX_GM_NPCS,MAX_NAME,['id']);
 else bundle.gmNpcs.forEach((x,i)=>out.gmNpcs.push({index:i,name:x.name,finalName:x.name,status:select.gmNpcs===false?'off':'bad'}));
 const adds=k=>out[k].filter(r=>r.status==='add'||r.status==='rename').length;
 out.counts={campaigns:out.campaigns.filter(c=>c.selected).length,clocks:adds('clocks'),library:adds('library'),gmNpcs:adds('gmNpcs'),sheets:out.sheets.filter(s=>s.status==='add').length};
 out.total=out.counts.campaigns+out.counts.clocks+out.counts.library+out.counts.gmNpcs;
 return out;
}
/* Adds what the plan lists. `deps.getState` returns the live state (adding a sheet replaces the character list),
   `deps.importCharacter` / `deps.findImport` are the app's own sheet import. Returns {ok, counts, sheetFailed, undo}. */
function apply(bundle,select,deps={}){
 const getState=deps.getState||(()=>null),X=global.GMExtras,L=global.NpcLibrary,G=global.GMTools;
 let state=getState();if(!state||!Array.isArray(state.campaigns))return {ok:false,reason:'state'};
 const p=plan(bundle,state,select,deps);if(!p.total)return {ok:false,reason:'nothing'};
 const counts={campaigns:0,clocks:0,library:0,gmNpcs:0,sheets:0},sheetMap=new Map();let sheetFailed=0;
 for(const row of p.sheets){
  if(row.status==='have')sheetMap.set(row.id,row.target);
  else if(row.status==='add'){let r=null;try{r=deps.importCharacter?.(bundle.sheets.find(s=>s.id===row.id),{})}catch{}if(r?.ok&&typeof r.id==='string'){sheetMap.set(row.id,r.id);counts.sheets++}else sheetFailed++}
 }
 state=getState();
 const before={campaignIds:[],clocks:state.gmExtras?.clocks,library:state.gmExtras?.npcLibrary,hadExtras:state.gmExtras,gmIds:[]};
 // The library goes first: roster entries made from a preset follow it to its new id.
 const libMap=new Map();
 if(L&&p.library.some(r=>r.status==='add'||r.status==='rename'||r.status==='same')){
  const list=L.readLibrary(state),ids=new Set(list.map(x=>x.id));let changed=false;
  for(const row of p.library){const src=bundle.library[row.index];
   if(row.status==='same'){const twin=twinOf(list,src,['id']);if(twin)libMap.set(src.id,twin.id);continue}
   if(row.status!=='add'&&row.status!=='rename')continue;
   const e=L.cleanEntry({...src,id:freshId(ids,()=>shortId('npc')),name:row.finalName});if(!e)continue;
   list.push(e);libMap.set(src.id,e.id);counts.library++;changed=true}
  if(changed)L.writeLibrary(state,list);
 }
 if(X&&p.clocks.some(r=>r.status==='add'||r.status==='rename')){
  const list=X.readClocks(state),ids=new Set(list.map(x=>x.id));
  for(const row of p.clocks){if(row.status!=='add'&&row.status!=='rename')continue;const src=bundle.clocks[row.index],c=X.cleanClock({id:freshId(ids,()=>shortId('clk')),name:row.finalName,size:src.size,filled:src.filled,shared:false});if(c){list.push(c);counts.clocks++}}
  X.writeClocks(state,list);
 }
 const ws=state.gmWorkspace;
 if(G?.validWorkspace?.(ws)){
  const ids=new Set(ws.roster.map(n=>n.id)),start=ws.roster.length;
  for(const row of p.gmNpcs){if(row.status!=='add'&&row.status!=='rename')continue;const n={...copy(bundle.gmNpcs[row.index]),id:freshId(ids),name:row.finalName};ws.roster.push(n);before.gmIds.push(n.id);counts.gmNpcs++}
  if(!G.validWorkspace(ws)){ws.roster.length=start;before.gmIds=[];counts.gmNpcs=0}
 }
 const taken=new Set(state.campaigns.filter(isObj).map(c=>c.id)),localIds=new Set((state.characters||[]).filter(isObj).map(c=>c.id));
 for(const row of p.campaigns){
  if(!row.selected)continue;
  const c=copy(bundle.campaigns[row.index]);c.id=freshId(taken);c.name=row.finalName;
  for(const r of c.roster){
   if(r.kind==='pc'){const to=sheetMap.get(r.characterId);if(to)r.characterId=to;else if(!localIds.has(r.characterId)&&bundle.sheets.some(s=>s.id===r.characterId))r.characterId=''}
   if(isObj(r.ally)&&typeof r.ally.characterId==='string'){const to=sheetMap.get(r.ally.characterId);if(to)r.ally.characterId=to}
   if(r.sourceLibrary){const to=libMap.get(r.sourceLibrary);if(to)r.sourceLibrary=to;else delete r.sourceLibrary}
  }
  if(!validCampaign(c))continue;
  state.campaigns.push(c);before.campaignIds.push(c.id);counts.campaigns++;
 }
 const undo=()=>{
  const st=getState();if(!st)return;
  for(const id of before.campaignIds){const i=st.campaigns.findIndex(c=>c?.id===id);if(i>=0)st.campaigns.splice(i,1)}
  if(before.hadExtras===undefined)st.gmExtras=undefined;
  else if(isObj(st.gmExtras)){if(before.clocks===undefined)delete st.gmExtras.clocks;else st.gmExtras.clocks=before.clocks;if(before.library===undefined)delete st.gmExtras.npcLibrary;else st.gmExtras.npcLibrary=before.library}
  if(isObj(st.gmWorkspace)&&Array.isArray(st.gmWorkspace.roster))for(const id of before.gmIds){const i=st.gmWorkspace.roster.findIndex(n=>n?.id===id);if(i>=0)st.gmWorkspace.roster.splice(i,1)}
 };
 return {ok:true,counts,sheetFailed,undo};
}

// ---------- interface ----------
let ui={opts:{clocks:true,library:true,gmNpcs:true,sheets:true},pending:null,error:''};
const app=()=>global.App||null;
const appState=()=>{try{return app()?.getState?.()||null}catch{return null}};
const curLang=()=>{try{return app()?.lang?.()==='en'?'en':'ru'}catch{return 'ru'}};
const say=m=>{try{app()?.notify?.(m)}catch{}};
const check=(attr,key,on,label,disabled=false)=>`<label class="cio-check"><input type="checkbox" ${attr}="${esc(key)}"${on?' checked':''}${disabled?' disabled':''}><span>${label}</span></label>`;
function optionsHTML(t){return `<fieldset class="cio-opts"><legend>${esc(t.with)}</legend>${[['clocks',t.oClocks],['library',t.oLibrary],['gmNpcs',t.oGmNpcs],['sheets',t.oSheets]].map(([k,l])=>check('data-cio-opt',k,ui.opts[k]!==false,esc(l))).join('')}</fieldset>`}
function transferHTML(state,t,one){
 const any=campaignsOf(state).length>0;
 return `<section class="card cio-card" data-cio-card><div class="card-heading"><span>${esc(one?t.one:t.title)}</span><span>JSON</span></div><p class="muted">${esc(t.lead)}</p>${optionsHTML(t)}<div class="cio-actions">${one?`<button type="button" class="btn primary" data-cio-action="export-one" data-id="${esc(one.id)}">⬇ ${esc(t.exportOne)}</button>`:`<button type="button" class="btn primary" data-cio-action="export-all"${any?'':' disabled'}>⬇ ${esc(t.exportAll)}</button><button type="button" class="btn ghost" data-cio-action="choose">⬆ ${esc(t.choose)}</button>`}</div>${!one&&!any?`<p class="muted">${esc(t.none)}</p>`:''}${!one&&ui.error?`<p class="cio-error" role="alert">${esc(ui.error)}</p>`:''}</section>`;
}
function statusLabel(row,t){return row.status==='rename'?t.stRename(row.finalName):row.status==='same'?t.stSame:row.status==='limit'?t.stLimit:row.status==='bad'?t.stBad:t.stAdd}
function previewHTML(state,t,l){
 const pend=ui.pending;if(!pend)return '';
 const p=plan(pend.bundle,state,pend.select,{lang:l,findImport:app()?.findImport});
 const camp=c=>`<li class="cio-item${c.selected?'':' off'}">${check('data-cio-pick','c'+c.index,c.selected,`<b>${esc(c.name)}</b>`)}<div class="cio-detail">${c.selected&&c.renamed?`<p class="cio-rename">${esc(t.renamed)} — ${esc(t.as)} <b>«${esc(c.finalName)}»</b></p>`:''}<p>${esc([t.roster(c.pcs,c.npcs),t.journal(c.journal),t.beats(c.beats),t.notes(c.notes)].join(' · '))}</p>${c.pcs?`<p>${esc([c.pcAdd?t.pcAdd(c.pcAdd):'',c.pcHave?t.pcHave(c.pcHave):'',c.pcNone?t.pcNone(c.pcNone):''].filter(Boolean).join(' · '))}</p>`:''}</div></li>`;
 const rows=(key,title)=>p[key].length?`<div class="cio-section">${check('data-cio-pick',key,pend.select[key]!==false,`<b>${esc(title)}</b> <span class="cio-n">${p[key].length}</span>`)}${pend.select[key]!==false?`<ul class="cio-rows">${p[key].map(r=>`<li class="${r.status==='add'||r.status==='rename'?'':'skip'}"><span>${esc(r.name)}</span><small>${esc(statusLabel(r,t))}</small></li>`).join('')}</ul>`:''}</div>`:'';
 const sheets=pend.bundle.sheets.length?`<div class="cio-section">${check('data-cio-pick','sheets',pend.select.sheets!==false,`<b>${esc(t.sheets)}</b> <span class="cio-n">${pend.bundle.sheets.length}</span>`)}${pend.select.sheets!==false?`<ul class="cio-rows">${p.sheets.map(s=>`<li class="${s.status==='add'?'':'skip'}"><span>${esc(s.name)}</span><small>${esc(s.status==='add'?t.stAdd:s.status==='have'?t.stHave(s.targetName):t.stUnused)}</small></li>`).join('')}</ul>`:''}</div>`:'';
 return `<section class="card cio-preview" data-cio-preview aria-labelledby="cio-preview-title"><div class="card-heading"><span id="cio-preview-title" tabindex="-1">${esc(t.preview)}</span><span>${p.total+p.counts.sheets}</span></div><p class="cio-file"><b>${esc(t.file)}:</b> ${esc(pend.fileName)}</p><p class="cio-safe">${esc(t.safe)}</p>${p.campaigns.length?`<div class="cio-section"><p class="cio-sub">${esc(t.campaigns)} <span class="cio-n">${p.campaigns.length}</span></p><ul class="cio-list">${p.campaigns.map(camp).join('')}</ul></div>`:''}${sheets}${rows('clocks',t.clocks)}${rows('library',t.library)}${rows('gmNpcs',t.gmNpcs)}${p.dropped?`<p class="cio-warn">${esc(t.dropped(p.dropped))}</p>`:''}<div class="cio-actions"><button type="button" class="btn primary" data-cio-action="apply"${p.total?'':' disabled'}>＋ ${esc(t.apply)}</button><button type="button" class="btn ghost" data-cio-action="cancel">${esc(t.cancel)}</button></div>${p.total?'':`<p class="muted" role="status">${esc(t.nothing)}</p>`}</section>`;
}
// app.js passes the campaigns page through here: the transfer card (and the preview) under the list, the file card and
// the journal for players under an open campaign.
function decorate(html,state){
 try{
  if(!isObj(state))return html;
  const l=state?.lang==='en'?'en':'ru',t=T[l],m=/data-campaign-view="([^"]*)"/.exec(String(html)),open=m?campaignsOf(state).find(c=>esc(c.id)===m[1])||null:null;
  if(m&&!open)return html;
  return html+`<div class="cio" data-cio-root>${open?(global.RoomJournal?.panel?.(open,l)||'')+transferHTML(state,t,open):previewHTML(state,t,l)+transferHTML(state,t,null)}</div>`;
 }catch{return html}
}
function download(name,body){try{const doc=global.document,url=URL.createObjectURL(new Blob([body],{type:'application/json'})),a=doc.createElement('a');a.href=url;a.download=name;doc.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);return true}catch{return false}}
function exportNow(ids){
 const st=appState(),t=T[curLang()];if(!st)return false;
 const data=buildExport(st,{...ui.opts,...(ids?{campaignIds:ids}:{})});if(!data.campaigns.length){say(t.none);return false}
 let raw;try{raw=JSON.stringify(data,null,1)}catch{say(t.exportFail);return false}
 if(raw.length>MAX_FILE){say(t.exportBig);return false}
 const ok=download(fileName(data.campaigns),raw);say(ok?t.exported(data.campaigns.length):t.exportFail);return ok;
}
const ERRORS={big:'errBig',json:'errJson',format:'errFormat',backup:'errBackup',newer:'errNewer',empty:'errEmpty',read:'errRead'};
function rerender(focus){
 try{app()?.render?.()}catch{}
 const doc=global.document;if(!doc?.querySelector)return;
 const el=focus==='preview'?doc.querySelector('#cio-preview-title'):focus?doc.querySelector(`[data-cio-root] [data-cio-pick="${focus}"]`)||doc.querySelector('[data-cio-root] [data-cio-action="choose"]'):null;
 try{el?.focus?.();if(focus==='preview')el?.scrollIntoView?.({block:'start'})}catch{}
}
// Takes the text of a chosen file: an error under the buttons, or the preview.
function load(text,name){
 const r=parse(text),t=T[curLang()];
 if(!r.ok){ui.pending=null;ui.error=t[ERRORS[r.reason]||'errRead'];say(ui.error);rerender('choose');return false}
 ui.error='';ui.pending={bundle:r.bundle,fileName:line(name,120)||'campaign.json',select:defaultSelect(r.bundle)};rerender('preview');return true;
}
function chooseFile(){
 const doc=global.document,t=T[curLang()];if(!doc?.createElement)return;
 const input=doc.createElement('input');input.type='file';input.accept='application/json,.json';input.hidden=true;
 input.addEventListener('change',()=>{
  const file=input.files?.[0];input.remove();if(!file)return;
  if(file.size>MAX_FILE){ui.pending=null;ui.error=t.errBig;say(ui.error);rerender('choose');return}
  const fail=()=>{ui.pending=null;ui.error=t.errRead;say(ui.error);rerender('choose')};
  try{const reader=new global.FileReader();reader.onload=()=>load(String(reader.result??''),file.name);reader.onerror=fail;reader.readAsText(file)}catch{fail()}
 });
 doc.body.appendChild(input);input.click();
}
function applyNow(){
 const pend=ui.pending,a=app(),t=T[curLang()];if(!pend||!a)return false;
 const r=apply(pend.bundle,pend.select,{lang:curLang(),getState:appState,findImport:a.findImport,importCharacter:a.importCharacter});
 if(!r.ok){say(r.reason==='nothing'?t.nothing:t.fail);return false}
 ui.pending=null;ui.error='';
 const c=r.counts,text=t.done(c.campaigns,c.clocks,c.library,c.gmNpcs,c.sheets)+(r.sheetFailed?t.sheetFail(r.sheetFailed):'');
 let saved;try{saved=a.save()}catch{saved={ok:false}}
 // The write is checked: when it does not fit, everything added is taken back.
 Promise.resolve(saved).then(res=>{if(res&&res.ok===false){r.undo();try{a.save()}catch{}ui.error=t.fail;say(t.fail);rerender('choose')}},()=>{});
 say(text);rerender('choose');return true;
}
function onClick(e){
 const b=e?.target?.closest?.('[data-cio-action]');if(!b||b.disabled)return false;
 const a=b.dataset.cioAction;
 if(a==='export-all')exportNow(null);
 else if(a==='export-one')exportNow([b.dataset.id]);
 else if(a==='choose')chooseFile();
 else if(a==='apply')applyNow();
 else if(a==='cancel'){ui.pending=null;ui.error='';say(T[curLang()].cancelled);rerender('choose')}
 return true;
}
function onChange(e){
 const el=e?.target,d=el?.dataset;if(!d)return false;
 if(d.cioOpt!==undefined){if(d.cioOpt in ui.opts)ui.opts[d.cioOpt]=el.checked===true;return true}
 if(d.cioPick!==undefined&&ui.pending){
  const k=d.cioPick,sel=ui.pending.select;
  if(/^c\d+$/.test(k)){const i=Number(k.slice(1));if(i<sel.campaigns.length)sel.campaigns[i]=el.checked===true}
  else if(['clocks','library','gmNpcs','sheets'].includes(k))sel[k]=el.checked===true;
  rerender(k);return true;
 }
 return false;
}
const doc=global.document;
if(doc?.addEventListener){doc.addEventListener('click',onClick);doc.addEventListener('change',onChange)}
global.CampaignIO={FORMAT,VERSION,MAX_FILE,inert,cleanRosterEntry,cleanCampaign,validCampaign,buildExport,fileName,parse,uniqueName,defaultSelect,plan,apply,decorate,load,
 _test:{ui:()=>ui,reset:()=>{ui={opts:{clocks:true,library:true,gmNpcs:true,sheets:true},pending:null,error:''}},applyNow,onClick,onChange}};
})(typeof window!=='undefined'?window:globalThis);
