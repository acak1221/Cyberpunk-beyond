/* «Свои таблицы бросков»: roll tables the GM writes for their own table. Each table has a die from a short
   fixed list, entries with ranges on that die, and an optional group name. The card is drawn inside the GM tools
   group of gm-extras.js, right under the built-in random tables. No table text ships with the app: every entry is
   typed (or imported from a file) by the user.
   The tables live in state.gmExtras.rollTables, next to the clocks and the NPC library, so the full backup, its
   restore and the device-to-device transfer already carry them. A missing field means «no tables».
   The table being edited is also kept in sessionStorage until it is saved or cancelled, so a reload or a tab
   the phone threw out of memory does not lose the typed rows. It never leaves the tab.
   A roll goes through App.report, which puts it into the roll history and, in a room, into the feed: there is no
   new room message, so nothing new arrives from other devices. A table file is untrusted input: every table is
   rebuilt field by field, clipped and checked before it is offered, and nothing is stored until the user agrees. */
(function(global){
'use strict';
// A fixed list instead of free dice notation: the range checks and the room clips below rely on small totals.
const DICE=Object.freeze(['1d4','1d6','1d8','1d10','1d12','1d20','1d100','2d6','2d10','3d6']);
const MAX_TABLES=50,MAX_ENTRIES=100,MAX_NAME=60,MAX_GROUP=40,MAX_TEXT=160,MAX_TITLE=80;
// The tables are part of the main archive, which is written on every save and travels by transfer code:
// the budget keeps fifty long tables from eating the browser's storage quota.
const MAX_TOTAL=150000,MAX_SCAN=500,MAX_FILE_CHARS=400000;
const FORMAT='nightcity-red-roll-tables',VERSION=1;
const ID=/^[A-Za-z0-9_-]{1,32}$/;
const isObj=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function line(v,max){return typeof v==='string'?v.replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max):''}
// A whole number as typed in a field or read from a file; anything else is «not a number».
function whole(v){
 if(typeof v==='number')return Number.isSafeInteger(v)&&Math.abs(v)<=99999?v:null;
 if(typeof v==='string'&&/^-?\d{1,5}$/.test(v.trim()))return Number(v.trim());
 return null;
}
function dieInfo(die){
 if(typeof die!=='string'||!DICE.includes(die))return null;
 const [count,sides]=die.split('d').map(Number);
 return {count,sides,min:count,max:count*sides};
}

// ---------- data ----------
// Rebuilds a table from known fields only. It does not judge the ranges (check() does): a table from an old or
// hand-edited backup is kept as long as its shape is sound.
function cleanTable(raw){
 if(!isObj(raw))return null;
 const id=typeof raw.id==='string'&&ID.test(raw.id)?raw.id:null,name=line(raw.name,MAX_NAME);
 if(!id||!name||!dieInfo(raw.die)||!Array.isArray(raw.entries))return null;
 const entries=[];
 for(const e of raw.entries.slice(0,MAX_SCAN)){
  if(!isObj(e))continue;
  const from=whole(e.from),to=whole(e.to),text=line(e.text,MAX_TEXT);
  if(from===null||to===null||!text)continue;
  entries.push({from,to,text});
  if(entries.length>=MAX_ENTRIES)break;
 }
 if(!entries.length)return null;
 entries.sort((a,b)=>a.from-b.from||a.to-b.to);
 return {id,name,group:line(raw.group,MAX_GROUP),die:raw.die,entries};
}
/* Problems of a table. Errors (they block saving and import): no rows, a row without text, a value that is not
   a whole number, «from» above «to», a range outside the die, two rows claiming the same value. Gaps are values
   of the die nobody claims: only a warning, because a table may leave «nothing happens» results out. */
function check(table){
 const info=dieInfo(table?.die),rows=Array.isArray(table?.entries)?table.entries.slice(0,MAX_ENTRIES):[],errors=[],gaps=[];
 if(!info)return {errors:[{key:'die'}],gaps};
 if(!rows.length)return {errors:[{key:'empty'}],gaps};
 const owner=new Array(info.max+1).fill(0),seen=new Set();
 rows.forEach((e,i)=>{
  const row=i+1,from=whole(e?.from),to=whole(e?.to);
  if(!line(e?.text,MAX_TEXT))errors.push({key:'text',row});
  if(from===null||to===null){errors.push({key:'number',row});return}
  if(from>to){errors.push({key:'order',row});return}
  if(from<info.min||to>info.max)errors.push({key:'range',row});
  for(let v=Math.max(from,info.min);v<=Math.min(to,info.max);v++){
   if(!owner[v]){owner[v]=row;continue}
   const pair=owner[v]+'|'+row;
   if(!seen.has(pair)){seen.add(pair);errors.push({key:'overlap',row,rows:[owner[v],row],value:v})}
  }
 });
 for(let v=info.min;v<=info.max;v++){
  if(owner[v])continue;
  const last=gaps[gaps.length-1];
  if(last&&last[1]===v-1)last[1]=v;else gaps.push([v,v]);
 }
 return {errors,gaps};
}
function readTables(state){
 const raw=isObj(state)&&isObj(state.gmExtras)?state.gmExtras.rollTables:null;
 if(!Array.isArray(raw))return [];
 const out=[],seen=new Set();
 for(const x of raw.slice(0,MAX_SCAN)){
  const t=cleanTable(x);
  if(t&&!seen.has(t.id)){seen.add(t.id);out.push(t)}
  if(out.length>=MAX_TABLES)break;
 }
 return out;
}
// Writes only its own key, so the clocks and the NPC library in the same section are left alone.
function writeTables(state,list){
 if(!isObj(state)||!Array.isArray(list))return false;
 if(!isObj(state.gmExtras))state.gmExtras={};
 state.gmExtras.rollTables=list.slice(0,MAX_TABLES).map(cleanTable).filter(Boolean);
 return true;
}
const size=list=>JSON.stringify(list).length;
let idSeq=0;
function newId(){return 't'+Date.now().toString(36)+(idSeq++).toString(36)+Math.floor(Math.random()*46656).toString(36)}

// ---------- rolling ----------
// A misbehaving random source must not produce a face outside the die.
function face(sides,rng){const n=1+Math.floor(Number(rng())*sides);return n>=1&&n<=sides?n:1}
// The first matching row wins, so even a stored table with overlapping rows gives one answer.
function lookup(table,total){
 const rows=Array.isArray(table?.entries)?table.entries:[];
 return rows.find(e=>total>=e.from&&total<=e.to)||null;
}
// Dice are summed as they fall: this is a table lookup, not a check, so a 10 does not explode.
function roll(table,rng=Math.random){
 const info=dieInfo(table?.die);if(!info)return null;
 const dice=Array.from({length:info.count},()=>face(info.sides,rng)),total=dice.reduce((a,b)=>a+b,0);
 return {dice,total,entry:lookup(table,total)};
}
// n ranges in a row that cover min..max; the leftover values go to the first rows. With more rows than values
// each value gets one row and the rest stay empty for the user to deal with.
function spread(n,min,max){
 const out=[],span=max-min+1;n=Math.max(0,Math.min(MAX_ENTRIES,Math.trunc(Number(n))||0));
 if(!n||span<1)return out;
 const used=Math.min(n,span),base=Math.floor(span/used),extra=span%used;
 let v=min;
 for(let i=0;i<n;i++){
  if(i>=used){out.push(null);continue}
  const len=base+(i<extra?1:0);
  out.push([v,v+len-1]);v+=len;
 }
 return out;
}
/* «Add as a list»: one entry per line. A range in front is optional («3-4 Patrol», «3–4: Patrol», «5 Quiet»);
   a line without one gets empty range fields to be filled by spread(). A line that is only a range has no
   result text and is handed back in `bad`. */
function parseLines(text){
 const rows=[],bad=[];let more=0;
 for(const raw of (typeof text==='string'?text:'').slice(0,MAX_FILE_CHARS).split(/\r?\n/)){
  const s=line(raw,MAX_TEXT+40);if(!s)continue;
  if(rows.length>=MAX_ENTRIES){more++;continue}
  // Checked first: otherwise the dash of «4 -» would be taken for a result text.
  if(/^\d{1,3}\s*(?:[-–—]\s*\d{0,3})?\s*[:.)]?$/.test(s)){if(bad.length<20)bad.push(s.slice(0,40));continue}
  const m=/^(\d{1,3})(?:\s*[-–—]\s*(\d{1,3}))?(?:\s*[:.)]\s*|\s+)(\S.*)$/.exec(s);
  if(m){rows.push({from:m[1],to:m[2]||m[1],text:line(m[3],MAX_TEXT)});continue}
  rows.push({from:'',to:'',text:s.slice(0,MAX_TEXT)});
 }
 return {rows,bad,more};
}

// ---------- UI text ----------
const T={
 ru:{title:'СВОИ ТАБЛИЦЫ',count:n=>`${n} ИЗ ${MAX_TABLES}`,intro:'Составьте собственные таблицы и бросайте по ним одним нажатием. Результат попадает в историю бросков, а в комнате — в ленту. Таблицы входят в резервную копию.',none:'Своих таблиц пока нет.',noGroup:'Без группы',rows:n=>`строк: ${n}`,flagGaps:'есть пропуски',flagBad:'есть ошибки',
  roll:'Бросить',edit:'Изменить',toFile:'В файл',del:'Удалить',groupFile:'Группу в файл',add:'Новая таблица',allFile:'Все таблицы в файл',open:'Открыть файл таблиц',
  quiet:'Не показывать бросок игрокам',quietHint:'Пока отметка стоит, бросок по таблице остаётся в вашей истории и не попадает в ленту комнаты. После перезагрузки страницы отметка снимается.',quietDone:'только у вас',
  noEntry:n=>`Для ${n} нет записи.`,noEntryShort:'нет записи',labelWord:'Таблица',
  deleted:name=>`Таблица «${name}» удалена.`,imported:(a,u)=>`Таблицы из файла добавлены: новых — ${a}, заменено — ${u}.`,undo:'Вернуть',
  newTitle:'Новая таблица',editTitle:'Изменение таблицы',name:'Название',namePh:'Напр. «Встречи в порту»',group:'Группа',groupPh:'Необязательно',die:'Кубик',dieHint:(a,b)=>`Значения от ${a} до ${b}.`,entries:'Строки таблицы',
  rowN:n=>`Строка ${n}`,from:'От',to:'До',result:'Результат',rowDel:n=>`Удалить строку ${n}`,rowAdd:'Строка',spread:'Расставить диапазоны по порядку',rowsFull:`В таблице не больше ${MAX_ENTRIES} строк.`,
  bulk:'Добавить списком',bulkLabel:'Записи, по одной в строке',bulkHint:'Диапазон в начале строки необязателен: «3-4 Патруль». Строкам без диапазона его можно раздать кнопкой «Расставить диапазоны по порядку».',bulkAdd:'Добавить строки',bulkDone:(n,bad,more)=>`Добавлено строк: ${n}.`+(bad?` Без текста результата, пропущено: ${bad}.`:'')+(more?` Не поместилось: ${more}.`:''),
  pEmpty:'Добавьте хотя бы одну строку.',pText:n=>`Строка ${n}: впишите результат.`,pNumber:n=>`Строка ${n}: укажите «От» и «До» целыми числами.`,pOrder:n=>`Строка ${n}: «От» больше, чем «До».`,pRange:(n,a,b)=>`Строка ${n}: диапазон выходит за кубик (${a}–${b}).`,pOverlap:(a,b,v)=>`Строки ${a} и ${b} пересекаются на значении ${v}.`,pGaps:list=>`Нет результата для: ${list}. Сохранить таблицу можно: при таком броске приложение сообщит, что записи нет.`,pOk:'Все значения кубика заняты, пересечений нет.',
  save:'Сохранить',cancel:'Отмена',
  eName:'Укажите название таблицы.',eFix:'Таблица не сохранена: исправьте ошибки в строках, они перечислены над кнопками.',eFull:`Достигнут предел — ${MAX_TABLES} таблиц. Удалите лишние.`,eBig:'Таблицы занимают слишком много места. Сократите тексты или удалите лишние таблицы.',eStore:'Не удалось сохранить таблицу.',
  fSize:'Файл слишком большой для файла таблиц.',fJson:'Файл не читается: это не файл таблиц или он повреждён.',fFormat:'Это не файл таблиц бросков. Если это резервная копия, откройте её на странице «Персонажи»: «Файлы и резервные копии» → «Импорт копии».',fNewer:'Файл создан более новой версией приложения. Обновите приложение и откройте файл снова.',fEmpty:'В файле нет ни одной годной таблицы.',
  preview:'ФАЙЛ ТАБЛИЦ',untitled:'Без названия',plan:(a,u,s)=>`Новых: ${a} · заменит ваши: ${u} · без изменений: ${s}`,rejected:n=>`Не подошли и будут пропущены: ${n} (ошибки в диапазонах или повреждённые записи).`,overflow:n=>`Не поместятся: ${n}. Удалите лишние таблицы и откройте файл снова.`,tagNew:'новое',tagUpdate:'заменит',tagSame:'уже есть',tagOverflow:'не поместится',moreRows:n=>`…и ещё ${n}`,apply:'Добавить в свои таблицы',discard:'Отмена',nothing:'Добавлять нечего.'},
 en:{title:'CUSTOM TABLES',count:n=>`${n} OF ${MAX_TABLES}`,intro:'Write your own tables and roll on them with one press. The result goes to the roll history and, in a room, to the feed. The tables are part of the backup.',none:'No custom tables yet.',noGroup:'No group',rows:n=>`rows: ${n}`,flagGaps:'has gaps',flagBad:'has errors',
  roll:'Roll',edit:'Edit',toFile:'To file',del:'Delete',groupFile:'Group to file',add:'New table',allFile:'All tables to file',open:'Open a table file',
  quiet:'Do not show the roll to players',quietHint:'While this is ticked, a table roll stays in your own history and is not sent to the room feed. The tick is cleared when the page reloads.',quietDone:'only you',
  noEntry:n=>`No entry for ${n}.`,noEntryShort:'no entry',labelWord:'Table',
  deleted:name=>`Table “${name}” deleted.`,imported:(a,u)=>`Tables from the file added: ${a} new, ${u} replaced.`,undo:'Undo',
  newTitle:'New table',editTitle:'Edit table',name:'Name',namePh:'E.g. "Harbor encounters"',group:'Group',groupPh:'Optional',die:'Die',dieHint:(a,b)=>`Values from ${a} to ${b}.`,entries:'Table rows',
  rowN:n=>`Row ${n}`,from:'From',to:'To',result:'Result',rowDel:n=>`Delete row ${n}`,rowAdd:'Row',spread:'Spread the ranges in order',rowsFull:`A table holds up to ${MAX_ENTRIES} rows.`,
  bulk:'Add as a list',bulkLabel:'Entries, one per line',bulkHint:'A range at the start of a line is optional: "3-4 Patrol". Lines without a range can get one from the "Spread the ranges in order" button.',bulkAdd:'Add rows',bulkDone:(n,bad,more)=>`Rows added: ${n}.`+(bad?` Skipped, no result text: ${bad}.`:'')+(more?` Did not fit: ${more}.`:''),
  pEmpty:'Add at least one row.',pText:n=>`Row ${n}: write the result.`,pNumber:n=>`Row ${n}: "From" and "To" must be whole numbers.`,pOrder:n=>`Row ${n}: "From" is above "To".`,pRange:(n,a,b)=>`Row ${n}: the range is outside the die (${a}–${b}).`,pOverlap:(a,b,v)=>`Rows ${a} and ${b} overlap at ${v}.`,pGaps:list=>`No result for: ${list}. The table can still be saved: on such a roll the app will say there is no entry.`,pOk:'Every value of the die is taken and nothing overlaps.',
  save:'Save',cancel:'Cancel',
  eName:'Give the table a name.',eFix:'The table was not saved: fix the row errors listed above the buttons.',eFull:`Limit reached — ${MAX_TABLES} tables. Delete the ones you do not need.`,eBig:'The tables take too much space. Shorten the texts or delete tables you do not need.',eStore:'Could not save the table.',
  fSize:'The file is too large for a table file.',fJson:'The file cannot be read: it is not a table file, or it is damaged.',fFormat:'This is not a roll table file. If it is a backup, open it on the Characters page: “Files and backups” → “Import backup”.',fNewer:'The file was made by a newer version of the app. Update the app and open the file again.',fEmpty:'The file has no usable tables.',
  preview:'TABLE FILE',untitled:'Untitled',plan:(a,u,s)=>`New: ${a} · will replace yours: ${u} · unchanged: ${s}`,rejected:n=>`Unsuitable and will be skipped: ${n} (range errors or damaged entries).`,overflow:n=>`Will not fit: ${n}. Delete tables you do not need and open the file again.`,tagNew:'new',tagUpdate:'replaces',tagSame:'already here',tagOverflow:'will not fit',moreRows:n=>`…and ${n} more`,apply:'Add to my tables',discard:'Cancel',nothing:'Nothing to add.'}
};
const L=lang=>lang==='en'?'en':'ru';
// The two lines a roll leaves in the history and the room feed. The room clips a label at 80 and a detail at
// 200 characters; MAX_NAME and MAX_TEXT are chosen so that both always fit whole.
function label(name,lang){return `${T[L(lang)].labelWord}: ${line(name,MAX_NAME)}`}
function detail(result,die,lang){
 const t=T[L(lang)],d=result.dice,head=d.length>1?`${die}: ${d.join(' + ')} = ${result.total}`:`${die}: ${result.total}`;
 return `${head} · ${result.entry?result.entry.text:t.noEntryShort}`;
}

// ---------- table file ----------
function buildFile(tables,title,now=new Date()){
 return {format:FORMAT,version:VERSION,title:line(title,MAX_TITLE),exportedAt:now instanceof Date&&!isNaN(now)?now.toISOString():'',tables:(Array.isArray(tables)?tables:[]).map(cleanTable).filter(Boolean).slice(0,MAX_TABLES)};
}
function parseFile(text){
 if(typeof text!=='string'||text.length>MAX_FILE_CHARS)return {ok:false,reason:'size'};
 let raw;try{raw=JSON.parse(text)}catch{return {ok:false,reason:'json'}}
 if(!isObj(raw)||raw.format!==FORMAT||!Array.isArray(raw.tables))return {ok:false,reason:'format'};
 if(typeof raw.version==='number'&&raw.version>VERSION)return {ok:false,reason:'newer'};
 const tables=[],rejected=[],seen=new Set();
 for(const x of raw.tables.slice(0,MAX_SCAN)){
  const t=cleanTable(x),name=line(isObj(x)?x.name:'',MAX_NAME);
  // A table with range errors would have to be repaired by hand anyway: it is refused whole, not half-imported.
  if(!t)rejected.push({name,reason:'broken'});
  else if(seen.has(t.id))rejected.push({name,reason:'twice'});
  else if(check(t).errors.length)rejected.push({name,reason:'ranges'});
  else{seen.add(t.id);tables.push(t)}
 }
 if(!tables.length)return {ok:false,reason:'empty',rejected};
 return {ok:true,title:line(raw.title,MAX_TITLE),tables,rejected};
}
// What an import would do, table by table. A table with a known id replaces yours; the same content is skipped.
function planImport(current,pack){
 const rows=[];let list=current.slice(),added=0,updated=0,same=0,overflow=0;
 for(const t of pack.tables){
  const old=list.find(x=>x.id===t.id);
  if(old&&JSON.stringify(old)===JSON.stringify(t)){same++;rows.push({table:t,status:'same'});continue}
  const next=old?list.map(x=>x.id===t.id?t:x):[...list,t];
  if((!old&&list.length>=MAX_TABLES)||size(next)>MAX_TOTAL){overflow++;rows.push({table:t,status:'overflow'});continue}
  list=next;if(old)updated++;else added++;
  rows.push({table:t,status:old?'update':'new'});
 }
 return {rows,list,added,updated,same,overflow};
}
function applyImport(current,pack){const p=planImport(current,pack);return {list:p.list,added:p.added,updated:p.updated}}

// ---------- in-memory UI state (only the open form is kept, see keepDraft) ----------
const freshUi=()=>({draft:null,error:null,bulk:'',bulkNote:null,preview:null,fileError:null,undo:null,last:null,quiet:false});
let ui=freshUi();
/* The open form survives a reload: a table of a hundred typed rows must not vanish with a pull-to-refresh.
   sessionStorage is enough (same tab, gone when the tab is closed) and keeps half-typed text out of the archive
   and out of backups. What is read back is rebuilt field by field like everything else that comes from storage. */
const DRAFT_KEY='nc-rtb-draft-v1',MAX_BULK_KEPT=20000;
let kept=false;
function tabStore(){try{return global.sessionStorage||null}catch{return null}}
// Unlike line(), spaces are left alone: this is text in the middle of being typed.
const typed=(v,max)=>typeof v==='string'?v.replace(/[\u0000-\u001f\u007f]/g,' ').slice(0,max):'';
function cleanDraft(raw){
 if(!isObj(raw)||!Array.isArray(raw.rows))return null;
 const id=typeof raw.id==='string'&&ID.test(raw.id)?raw.id:null,num=v=>typeof v==='string'&&/^-?\d{0,5}$/.test(v)?v:'';
 const rows=raw.rows.slice(0,MAX_SCAN).filter(isObj).slice(0,MAX_ENTRIES).map(r=>({from:num(r.from),to:num(r.to),text:typed(r.text,MAX_TEXT)}));
 return {id,name:typed(raw.name,MAX_NAME),group:typed(raw.group,MAX_GROUP),die:dieInfo(raw.die)?raw.die:'1d6',rows};
}
function keepDraft(){
 if(!ui.draft&&!kept)return;
 const s=tabStore();if(!s)return;
 try{
  if(ui.draft){s.setItem(DRAFT_KEY,JSON.stringify({v:1,draft:ui.draft,bulk:ui.bulk.length<=MAX_BULK_KEPT?ui.bulk:''}));kept=true}
  else{s.removeItem(DRAFT_KEY);kept=false}
 }catch{}
}
function loadDraft(){
 try{
  const raw=tabStore()?.getItem(DRAFT_KEY);if(typeof raw!=='string'||raw.length>MAX_FILE_CHARS)return;
  const saved=JSON.parse(raw),d=isObj(saved)&&saved.v===1?cleanDraft(saved.draft):null;
  if(d){ui.draft=d;ui.bulk=typeof saved.bulk==='string'?saved.bulk.slice(0,MAX_BULK_KEPT):'';kept=true}
 }catch{}
}
function appState(){try{return typeof global.App?.getState==='function'?global.App.getState():null}catch{return null}}
function tables(){return readTables(appState())}
function commit(list){
 const st=appState();if(!st||!writeTables(st,list))return false;
 try{global.App.save()}catch{}
 return true;
}
function roomActive(){try{return global.Room?.active?.()===true}catch{return false}}
/* «Вернуть» puts a whole earlier list back, so it is only honest while the stored tables are still exactly what
   the delete or the import left behind. If they were changed from outside this card in the meantime (a backup
   restored, a transfer from another device), the offer is withdrawn instead of overwriting the newer tables. */
const mark=()=>JSON.stringify(tables());
function liveUndo(){if(ui.undo&&ui.undo.after!==mark())ui.undo=null;return ui.undo}

// ---------- drawing ----------
const gapText=gaps=>gaps.map(([a,b])=>a===b?String(a):`${a}–${b}`).join(', ');
function problemsHtml(d,t){
 const info=dieInfo(d.die),c=check({die:d.die,entries:d.rows}),out=[];
 for(const e of c.errors.slice(0,12)){
  const text=e.key==='empty'?t.pEmpty:e.key==='text'?t.pText(e.row):e.key==='number'?t.pNumber(e.row):e.key==='order'?t.pOrder(e.row):e.key==='range'?t.pRange(e.row,info.min,info.max):e.key==='overlap'?t.pOverlap(e.rows[0],e.rows[1],e.value):'';
  if(text)out.push(`<li class="rtb-bad">${esc(text)}</li>`);
 }
 if(c.errors.length>12)out.push(`<li class="rtb-bad">${esc(t.moreRows(c.errors.length-12))}</li>`);
 if(d.rows.length&&c.gaps.length)out.push(`<li class="rtb-gap">${esc(t.pGaps(gapText(c.gaps)))}</li>`);
 if(!out.length)out.push(`<li class="rtb-fine">${esc(t.pOk)}</li>`);
 return `<ul class="rtb-problems">${out.join('')}</ul>`;
}
function resultHtml(r,t){
 const dice=r.dice.map(v=>`<span class="rtb-face">${esc(v)}</span>`).join('<span aria-hidden="true">+</span>');
 return `<p class="rtb-result" role="status" aria-live="polite"><span class="rtb-dice">${dice}${r.dice.length>1?`<span class="rtb-sum">= ${esc(r.total)}</span>`:''}</span><strong>${esc(r.text||t.noEntry(r.total))}</strong>${r.quiet?`<span class="rtb-meta">${esc(t.quietDone)}</span>`:''}</p>`;
}
function tableHtml(x,t){
 const c=check(x),id=esc(x.id),nm=esc(x.name);
 // The table name is added to each button's name, so a screen reader does not hear ten identical «Roll».
 const b=(a,text,cls)=>`<button type="button" class="btn ${cls}" data-rtb-action="${a}" data-rtb-id="${id}" aria-label="${esc(text)}: ${nm}">${esc(text)}</button>`;
 const flag=c.errors.length?`<span class="rtb-flag">${esc(t.flagBad)}</span>`:c.gaps.length?`<span class="rtb-flag">${esc(t.flagGaps)}</span>`:'';
 return `<li class="rtb-table"><div class="rtb-head"><strong>${nm}</strong><span class="rtb-die">${esc(x.die)}</span><span class="rtb-meta">${esc(t.rows(x.entries.length))}</span>${flag}</div><div class="rtb-actions">${b('roll',t.roll,'primary')}${b('edit',t.edit,'ghost')}${b('export',t.toFile,'ghost')}${b('del',t.del,'ghost')}</div>${ui.last&&ui.last.id===x.id?resultHtml(ui.last,t):''}</li>`;
}
function listHtml(list,t){
 if(!list.length)return `<p class="rtb-note">${esc(t.none)}</p>`;
 const groups=new Map();
 for(const x of list){if(!groups.has(x.group))groups.set(x.group,[]);groups.get(x.group).push(x)}
 const names=[...groups.keys()].sort((a,b)=>a===''?-1:b===''?1:a.localeCompare(b));
 const heads=names.length>1||names[0]!=='';
 return names.map(g=>`<div class="rtb-group">${heads?`<div class="rtb-group-head"><h4>${esc(g||t.noGroup)}</h4>${g?`<button type="button" class="btn ghost" data-rtb-action="export-group" data-rtb-group="${esc(g)}" aria-label="${esc(t.groupFile)}: ${esc(g)}"><span aria-hidden="true">↓ </span>${esc(t.groupFile)}</button>`:''}</div>`:''}<ul class="rtb-list">${groups.get(g).map(x=>tableHtml(x,t)).join('')}</ul></div>`).join('');
}
function fileErrorText(t,reason){return {size:t.fSize,json:t.fJson,format:t.fFormat,newer:t.fNewer,empty:t.fEmpty}[reason]||t.fJson}
function previewHtml(list,t){
 const p=ui.preview;if(!p)return '';
 const plan=planImport(list,p),can=plan.added+plan.updated>0,tag={new:t.tagNew,update:t.tagUpdate,same:t.tagSame,overflow:t.tagOverflow};
 const rows=plan.rows.slice(0,40).map(r=>`<li><span class="rtb-tag rtb-${r.status}">${esc(tag[r.status])}</span><span>${esc(r.table.name)} · ${esc(r.table.die)}${r.table.group?` · ${esc(r.table.group)}`:''}</span></li>`).join('')+(plan.rows.length>40?`<li><span>${esc(t.moreRows(plan.rows.length-40))}</span></li>`:'');
 return `<div class="rtb-preview" data-rtb-preview><p class="overline">${esc(t.preview)}</p><h4>${esc(p.title||t.untitled)}</h4><p class="rtb-text">${esc(t.plan(plan.added,plan.updated,plan.same))}</p>${plan.overflow?`<p class="rtb-text rtb-warn">${esc(t.overflow(plan.overflow))}</p>`:''}${p.rejected.length?`<p class="rtb-text rtb-warn">${esc(t.rejected(p.rejected.length))}</p>`:''}<ul class="rtb-plan">${rows}</ul>${can?'':`<p class="rtb-text">${esc(t.nothing)}</p>`}<div class="rtb-row">${can?`<button type="button" class="btn primary" data-rtb-action="apply">${esc(t.apply)}</button>`:''}<button type="button" class="btn ghost" data-rtb-action="discard">${esc(t.discard)}</button></div></div>`;
}
function toolsHtml(list,t){
 let h=`<div class="rtb-row"><button type="button" class="btn primary" data-rtb-action="new"><span aria-hidden="true">+ </span>${esc(t.add)}</button><button type="button" class="btn ghost" data-rtb-action="export-all"${list.length?'':' disabled'}><span aria-hidden="true">↓ </span>${esc(t.allFile)}</button><label class="btn ghost rtb-file"><span><span aria-hidden="true">↑ </span>${esc(t.open)}</span><input type="file" accept="application/json,.json" data-rtb-file class="rtb-file-input"></label></div>`;
 // Only shown in a room: outside one there is nobody to hide the roll from.
 if(roomActive()&&list.length)h+=`<label class="rtb-check"><input type="checkbox" data-rtb-field="quiet"${ui.quiet?' checked':''}><span>${esc(t.quiet)}</span></label><p class="rtb-note">${esc(t.quietHint)}</p>`;
 if(ui.fileError)h+=`<p class="rtb-error" role="alert" tabindex="-1">${esc(fileErrorText(t,ui.fileError))}</p>`;
 return h;
}
function rowHtml(r,i,info,t){
 const n=i+1,num=(f,text)=>`<label class="field rtb-f">${esc(text)}<input type="number" inputmode="numeric" step="1" min="${info.min}" max="${info.max}" data-rtb-field="${f}" data-rtb-row="${i}" value="${esc(r[f])}"></label>`;
 return `<fieldset class="rtb-entry"><legend class="rtb-hidden">${esc(t.rowN(n))}</legend>${num('from',t.from)}${num('to',t.to)}<label class="field rtb-f rtb-wide">${esc(t.result)}<input type="text" maxlength="${MAX_TEXT}" data-rtb-field="text" data-rtb-row="${i}" value="${esc(r.text)}" autocomplete="off"></label><button type="button" class="btn ghost rtb-x" data-rtb-action="row-del" data-rtb-row="${i}" aria-label="${esc(t.rowDel(n))}">✕</button></fieldset>`;
}
function errorText(t,key){return {name:t.eName,fix:t.eFix,full:t.eFull,big:t.eBig,store:t.eStore}[key]||t.eStore}
function editorHtml(list,t){
 const d=ui.draft,info=dieInfo(d.die),groups=[...new Set(list.map(x=>x.group).filter(Boolean))],full=d.rows.length>=MAX_ENTRIES;
 let h=`<div class="rtb-form" data-rtb-form><h4 class="rtb-form-title">${esc(d.id?t.editTitle:t.newTitle)}</h4>`;
 h+=`<label class="field">${esc(t.name)}<input type="text" data-rtb-field="name" maxlength="${MAX_NAME}" value="${esc(d.name)}" placeholder="${esc(t.namePh)}" autocomplete="off"></label>`;
 h+=`<div class="rtb-two"><label class="field">${esc(t.group)}<input type="text" data-rtb-field="group" maxlength="${MAX_GROUP}" value="${esc(d.group)}" placeholder="${esc(t.groupPh)}" autocomplete="off"${groups.length?' list="rtb-groups"':''}></label><label class="field">${esc(t.die)}<select data-rtb-field="die">${DICE.map(x=>`<option value="${x}"${x===d.die?' selected':''}>${x}</option>`).join('')}</select></label></div>`;
 if(groups.length)h+=`<datalist id="rtb-groups">${groups.map(g=>`<option value="${esc(g)}"></option>`).join('')}</datalist>`;
 h+=`<p class="rtb-note">${esc(t.dieHint(info.min,info.max))}</p><p class="overline rtb-over">${esc(t.entries)} · ${d.rows.length}</p>`;
 h+=`<div class="rtb-entries">${d.rows.map((r,i)=>rowHtml(r,i,info,t)).join('')}</div>`;
 h+=`<div class="rtb-row"><button type="button" class="btn ghost" data-rtb-action="row-add"${full?' disabled':''}><span aria-hidden="true">+ </span>${esc(t.rowAdd)}</button><button type="button" class="btn ghost" data-rtb-action="spread"${d.rows.length?'':' disabled'}>${esc(t.spread)}</button></div>`;
 if(full)h+=`<p class="rtb-note">${esc(t.rowsFull)}</p>`;
 h+=`<details class="rtb-bulk"${ui.bulk?' open':''}><summary>${esc(t.bulk)}</summary><label class="field">${esc(t.bulkLabel)}<textarea rows="5" data-rtb-field="bulk" spellcheck="false">${esc(ui.bulk)}</textarea></label><p class="rtb-note">${esc(t.bulkHint)}</p><div class="rtb-row"><button type="button" class="btn ghost" data-rtb-action="bulk-add"${full?' disabled':''}>${esc(t.bulkAdd)}</button></div></details>`;
 if(ui.bulkNote)h+=`<p class="rtb-note" role="status">${esc(t.bulkDone(ui.bulkNote.added,ui.bulkNote.bad,ui.bulkNote.more))}</p>`;
 h+=`<div data-rtb-problems role="status" aria-live="polite">${problemsHtml(d,t)}</div>`;
 if(ui.error)h+=`<p class="rtb-error" role="alert" tabindex="-1">${esc(errorText(t,ui.error))}</p>`;
 return h+`<div class="rtb-row"><button type="button" class="btn primary" data-rtb-action="save">${esc(t.save)}</button><button type="button" class="btn ghost" data-rtb-action="cancel">${esc(t.cancel)}</button></div></div>`;
}
function undoHtml(t){
 const u=liveUndo();if(!u)return '';
 return `<p class="rtb-undo" role="status">${esc(u.kind==='import'?t.imported(u.added,u.updated):t.deleted(u.name))} <button type="button" class="btn ghost" data-rtb-action="undo">${esc(t.undo)}</button></p>`;
}
function render(lang){
 const l=L(lang),t=T[l],list=tables();
 let h=`<section class="card gx-card rtb-card" data-rtb-root data-lang="${l}"><div class="card-heading"><span>${esc(t.title)}</span><span>${esc(t.count(list.length))}</span></div>`;
 // The editor takes the card over: one thing to do at a time, and no «delete» next to the table being edited.
 if(ui.draft)return h+editorHtml(list,t)+'</section>';
 h+=`<p class="rtb-note">${esc(t.intro)}</p>${undoHtml(t)}${listHtml(list,t)}${toolsHtml(list,t)}${previewHtml(list,t)}`;
 return h+'</section>';
}
/* A result as the «recent results» list of gm-extras.js draws it. The entry was saved on this device and is read
   back from storage, so it is checked again here; an empty string tells gm-extras to drop it. The markup keeps
   to span/strong so that the «to journal» button of gm-extras turns it into one readable line. */
function entryHtml(c,lang){
 if(!isObj(c))return '';
 const t=T[L(lang)],info=dieInfo(c.die),name=line(c.name,MAX_NAME),text=line(c.text,MAX_TEXT);
 if(!info||!name||!Array.isArray(c.dice)||c.dice.length!==info.count)return '';
 let sum=0;for(const v of c.dice){if(!Number.isInteger(v)||v<1||v>info.sides)return '';sum+=v}
 if(c.total!==sum)return '';
 return `<div class="gx-entry rtb-log"><span class="overline">${esc(t.labelWord)}: ${esc(name)}</span><div class="gx-oracle-row"><span class="gx-mono">${esc(c.die)}:${info.count>1?' '+c.dice.join(' + ')+' =':''}</span><span class="gx-die rtb-total">${sum}</span><strong>${esc(text||t.noEntry(sum))}</strong></div></div>`;
}

// ---------- events ----------
function download(raw,name){
 try{const blob=new Blob([raw],{type:'application/json'}),url=URL.createObjectURL(blob),a=global.document.createElement('a');a.href=url;a.download=name;global.document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);return true}catch{return false}
}
function exportFile(list,title){
 if(!list.length)return false;
 return download(JSON.stringify(buildFile(list,title),null,2),'night-city-roll-tables-'+new Date().toISOString().slice(0,10)+'.json');
}
function redraw(root,lang,focus){
 if(root&&typeof root.outerHTML==='string'&&root.isConnected!==false)root.outerHTML=render(lang);
 setFocus(focus);
}
function setFocus(sel){if(!sel)return;try{global.document?.querySelector?.(sel)?.focus?.({preventScroll:false})}catch{}}
const R='[data-rtb-root] ';
const draftOf=x=>({id:x.id,name:x.name,group:x.group,die:x.die,rows:x.entries.map(e=>({from:String(e.from),to:String(e.to),text:e.text}))});
function applySpread(d){
 const info=dieInfo(d.die),s=spread(d.rows.length,info.min,info.max);
 d.rows.forEach((r,i)=>{r.from=s[i]?String(s[i][0]):'';r.to=s[i]?String(s[i][1]):''});
}
/* One pressed button. Returns {draw, focus}: draw false means the card is already up to date. */
function act(a,b,lang,rng){
 const ds=b?.dataset||{},id=typeof ds.rtbId==='string'&&ID.test(ds.rtbId)?ds.rtbId:null,t=T[lang],d=ui.draft;
 const rollBtn=x=>`${R}[data-rtb-action="roll"][data-rtb-id="${x}"]`,row=Math.trunc(Number(ds.rtbRow));
 switch(a){
  case 'new':ui=Object.assign(freshUi(),{quiet:ui.quiet,last:ui.last,draft:{id:null,name:'',group:'',die:'1d6',rows:[]}});return {draw:true,focus:R+'[data-rtb-field="name"]'};
  case 'edit':{const x=tables().find(y=>y.id===id);if(!x)return {draw:true};ui=Object.assign(freshUi(),{quiet:ui.quiet,last:ui.last,draft:draftOf(x)});return {draw:true,focus:R+'[data-rtb-field="name"]'}}
  case 'cancel':{const back=d?.id;ui.draft=null;ui.error=null;ui.bulk='';ui.bulkNote=null;return {draw:true,focus:back?`${R}[data-rtb-action="edit"][data-rtb-id="${back}"]`:R+'[data-rtb-action="new"]'}}
  case 'row-add':{
   if(!d||d.rows.length>=MAX_ENTRIES)return {draw:true};
   // The next row continues where the last one stopped, which is what a table read top to bottom needs.
   const info=dieInfo(d.die),last=d.rows[d.rows.length-1],prev=last?whole(last.to):info.min-1,v=prev===null||prev>=info.max?'':String(Math.max(info.min,prev+1));
   d.rows.push({from:v,to:v,text:''});ui.bulkNote=null;
   return {draw:true,focus:`${R}[data-rtb-field="${v?'text':'from'}"][data-rtb-row="${d.rows.length-1}"]`};
  }
  case 'row-del':if(!d||!(row>=0&&row<d.rows.length))return {draw:true};d.rows.splice(row,1);ui.bulkNote=null;return {draw:true,focus:R+'[data-rtb-action="row-add"]'};
  case 'spread':if(d){applySpread(d);ui.bulkNote=null}return {draw:true,focus:R+'[data-rtb-action="spread"]'};
  case 'bulk-add':{
   if(!d)return {draw:true};
   const p=parseLines(ui.bulk),room=MAX_ENTRIES-d.rows.length,add=p.rows.slice(0,room);
   d.rows.push(...add);ui.bulk='';ui.bulkNote={added:add.length,bad:p.bad.length,more:p.more+p.rows.length-add.length};
   // A pasted list with no ranges at all can only mean «in this order»: spread it right away.
   if(d.rows.length&&d.rows.every(r=>r.from===''&&r.to===''))applySpread(d);
   return {draw:true,focus:R+'[data-rtb-action="spread"]'};
  }
  case 'save':{
   if(!d)return {draw:true};
   const list=tables(),cand={id:d.id||newId(),name:d.name,group:d.group,die:d.die,entries:d.rows},clean=cleanTable(cand);
   if(!line(d.name,MAX_NAME))ui.error='name';
   else if(check(cand).errors.length||!clean)ui.error='fix';
   else{
    const old=list.some(x=>x.id===clean.id),next=old?list.map(x=>x.id===clean.id?clean:x):[...list,clean];
    if(!old&&list.length>=MAX_TABLES)ui.error='full';
    else if(size(next)>MAX_TOTAL)ui.error='big';
    else if(!commit(next))ui.error='store';
    else{ui.draft=null;ui.error=null;ui.bulk='';ui.bulkNote=null;ui.undo=null;if(ui.last?.id===clean.id)ui.last=null;return {draw:true,focus:rollBtn(clean.id)}}
   }
   return {draw:true,focus:R+'.rtb-error'};
  }
  case 'roll':{
   const x=tables().find(y=>y.id===id),r=x?roll(x,rng):null;if(!r)return {draw:true};
   const text=r.entry?r.entry.text:'',quiet=ui.quiet&&roomActive(),lab=label(x.name,lang),det=detail(r,x.die,lang),sides=dieInfo(x.die).sides;
   ui.last={id:x.id,dice:r.dice,total:r.total,text,quiet};
   // The public way: history + room feed in one call (through GmRolls when the GM has chosen hidden rolls, the result then stays in the GM-only list). The quiet way writes the history only.
   try{if(quiet&&global.GmRolls?.mode?.()!=='hidden')global.RollHistory?.add?.({label:lab,detail:det,total:r.total});else if(typeof global.GmRolls?.emit==='function')global.GmRolls.emit(lab,det,r.total,r.dice.map(v=>({v,s:sides})));else global.App?.report?.(lab,det,r.total,r.dice.map(v=>({v,s:sides})))}catch{}
   // gm-extras redraws its whole group (this card included) when it takes the result into «recent results».
   try{global.GMExtras?.push?.({kind:'custom',custom:{name:x.name,die:x.die,dice:r.dice,total:r.total,text}})}catch{}
   return {draw:true,pushed:true,focus:rollBtn(x.id)};
  }
  case 'del':{
   const list=tables(),x=list.find(y=>y.id===id);if(!x)return {draw:true};
   // One press and an «undo» bar with the previous list, instead of a second confirming press.
   if(commit(list.filter(y=>y.id!==id))){ui.undo={kind:'del',list,name:x.name,after:mark()};if(ui.last?.id===id)ui.last=null}
   return {draw:true,focus:R+'[data-rtb-action="undo"]'};
  }
  case 'undo':if(liveUndo()&&commit(ui.undo.list))ui.undo=null;return {draw:true,focus:R+'[data-rtb-action="new"]'};
  case 'export':{const x=tables().find(y=>y.id===id);if(x)exportFile([x],x.name);return {draw:false}}
  case 'export-group':{const g=line(ds.rtbGroup,MAX_GROUP),list=tables().filter(x=>x.group===g);if(g)exportFile(list,g);return {draw:false}}
  case 'export-all':exportFile(tables(),'');return {draw:false};
  case 'apply':{
   const p=ui.preview;ui.preview=null;if(!p)return {draw:true};
   const list=tables(),r=applyImport(list,p);
   if(r.added+r.updated>0&&commit(r.list))ui.undo={kind:'import',list,added:r.added,updated:r.updated,after:mark()};
   return {draw:true,focus:ui.undo?R+'[data-rtb-action="undo"]':R+'.rtb-file-input'};
  }
  case 'discard':ui.preview=null;return {draw:true,focus:R+'.rtb-file-input'};
 }
 return null;
}
function openFile(text){
 const p=parseFile(text);
 if(p.ok){ui.preview=p;ui.fileError=null}else{ui.preview=null;ui.fileError=p.reason}
}
// Every handled event may have changed the open form, so the copy kept for this tab is refreshed after each.
function handle(e,lang,rng=Math.random){const done=handleEvent(e,lang,rng);if(done)keepDraft();return done}
function handleEvent(e,lang,rng){
 const target=e?.target,root=target?.closest?.('[data-rtb-root]');
 // A field that a redraw has already replaced can still fire a late event: ignore it.
 if(!root||root.isConnected===false)return false;
 let appLang=null;try{appLang=global.App?.lang?.()}catch{}
 const l=L(lang||appLang||root.dataset?.lang),f=target.dataset?.rtbField,d=ui.draft;
 if(e.type==='input'){
  if(!d||!f)return false;
  // Every keystroke lands in the draft at once: gm-extras may redraw this card at any moment, and a redraw
  // must never lose what was typed.
  const v=String(target.value??''),i=Math.trunc(Number(target.dataset.rtbRow)),r=d.rows[i];
  if(f==='name')d.name=v.slice(0,MAX_NAME);
  else if(f==='group')d.group=v.slice(0,MAX_GROUP);
  else if(f==='bulk'){ui.bulk=v.slice(0,MAX_FILE_CHARS);return true}
  else if((f==='from'||f==='to')&&r)r[f]=v.trim().slice(0,6);
  else if(f==='text'&&r)r.text=v.slice(0,MAX_TEXT);
  else return false;
  // Only the list of problems is refreshed, so the caret and the focus stay where the user is typing.
  const box=root.querySelector?.('[data-rtb-problems]');if(box)box.innerHTML=problemsHtml(d,T[l]);
  return true;
 }
 if(e.type==='change'){
  if(target.dataset?.rtbFile!==undefined){
   const file=target.files?.[0];if(!file)return false;
   const show=()=>{const now=global.document?.querySelector?.('[data-rtb-root]')||root;redraw(now,l,ui.fileError?R+'.rtb-error':R+'[data-rtb-preview] .btn')};
   if(Number(file.size)>MAX_FILE_CHARS*4){ui.preview=null;ui.fileError='size';show();return true}
   Promise.resolve().then(()=>file.text()).then(text=>{openFile(text);show()},()=>{ui.preview=null;ui.fileError='json';show()});
   return true;
  }
  if(f==='quiet'){ui.quiet=!!target.checked;return true}
  if(f==='die'&&d){if(dieInfo(target.value))d.die=target.value;redraw(root,l,R+'[data-rtb-field="die"]');return true}
  return false;
 }
 if(e.type!=='click')return false;
 const b=target.closest('[data-rtb-action]');if(!b||b.disabled)return false;
 const r=act(b.dataset.rtbAction,b,l,rng);if(!r)return false;
 // After a roll gm-extras may already have drawn this card anew; then only the focus is left to restore.
 const now=r.pushed?global.document?.querySelector?.('[data-rtb-root]'):null;
 if(r.draw&&!(now&&now!==root))redraw(root,l,r.focus);else setFocus(r.focus);
 return true;
}
function reset(){ui=freshUi();keepDraft()}
loadDraft();

if(global.document?.addEventListener)for(const type of ['click','change','input'])global.document.addEventListener(type,e=>{handle(e)});
global.RollTables={DICE,MAX_TABLES,MAX_ENTRIES,MAX_NAME,MAX_GROUP,MAX_TEXT,MAX_TOTAL,MAX_FILE_CHARS,FORMAT,VERSION,T,
 dieInfo,cleanTable,check,readTables,writeTables,lookup,roll,spread,parseLines,label,detail,buildFile,parseFile,planImport,applyImport,
 cleanDraft,render,entryHtml,handle,openFile,reset,get ui(){return ui}};
})(typeof window!=='undefined'?window:globalThis);
