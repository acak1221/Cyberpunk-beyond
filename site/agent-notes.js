/* Notes, goals and contacts of a character (an "agent" notebook).
   Stored on the character in extra.notesList, extra.goals and extra.contacts, so they are part of exports and backups.

   - Notes: several titled notes (extra.notesList, up to 100, 4000 characters each, pinned first). The old single
     "Notes" field of the sheet (c.notes) is never migrated: it is shown as the first note «Заметки» and edited in place.
   - Goals: optional kind, detail, priority and the date they were completed; open ones first, by priority; done ones
     in their own section.
   - Contacts: search, relation chips, sort, and a detail card for the one that is open.

   Every optional field is checked on the way in (cleanExtra) and on the way out (the clean* readers): old saves
   load unchanged and a broken backup cannot put anything odd on the page. */
(function(global){
'use strict';
const doc=global.document;
const MAX=60,TEXT=200,NOTE=500,NOTES_MAX=100,NOTE_TITLE=120,NOTE_TEXT=4000,LEGACY=20000,DETAIL=1000,SNIPPET=220;
const RELATIONS=[['friend','Друг','Friend'],['ally','Союзник','Ally'],['fixer','Фиксер','Fixer'],['employer','Работодатель','Employer'],['informant','Информатор','Informant'],['family','Семья','Family'],['lover','Любовь','Lover'],['rival','Соперник','Rival'],['enemy','Враг','Enemy'],['other','Другое','Other']];
const KINDS=[['personal','Личная','Personal'],['work','Работа','Job'],['long','Долгая','Long-term']];
const PRIORITIES=[['high','Высокий','High'],['mid','Обычный','Normal'],['low','Низкий','Low']];
const SORTS=[['name','По имени','By name'],['relation','По отношению','By relation'],['newest','Сначала новые','Newest first']];
const T={ru:{title:'КОНТАКТЫ И ЦЕЛИ',tag:'AGENT',contacts:'Контакты',noContacts:'Пока никого. Добавьте фиксера, друзей из жизненного пути или тех, кто вам должен.',addContact:'Добавить контакт',name:'Имя или позывной',who:'Кто это',whoPh:'Фиксер в Уотсоне',where:'Где найти',wherePh:'Бар «Afterlife», по вечерам',relation:'Отношение',notes:'Заметки',goals:'Цели и задания',noGoals:'Запишите, к чему стремится персонаж, и текущие заказы.',addGoal:'Добавить цель',goalPh:'Например: вернуть долг Ржавчине до пятницы',done:'Выполнено',remove:'Удалить',fromLife:'Взять из жизненного пути',lifeNone:'В жизненном пути нет друзей, врагов или любви, которых ещё нет в списке.',lifeAdded:'Добавлено из жизненного пути:',open:'активных',full:'Достигнут предел записей.',
 undo:'Вернуть',stale:'Лист уже изменился, действие не выполнено.',
 notesTitle:'ЗАМЕТКИ',notesTag:'NOTES',notesSearch:'Поиск по заметкам',legacyTitle:'Заметки',legacyEmpty:'Пусто. Откройте, чтобы написать.',untitled:'Без названия',noNotes:'Своих заметок пока нет. Добавьте первую: место, зацепку, список дел.',noMatches:'Ничего не найдено.',addNote:'Добавить заметку',editNote:'Открыть',pin:'Закрепить',unpin:'Открепить',pinned:'закреплена',noteTitle:'Название',noteText:'Текст',notePin:'Закрепить наверху',save:'Сохранить',cancel:'Отмена',newNote:'Новая заметка',mainNote:'Основная заметка листа',noteDeleted:'Заметка удалена.',goalDeleted:'Цель удалена.',contactDeleted:'Контакт удалён.',noteSaved:'Заметка сохранена.',
 more:'Подробности',kind:'Вид',priority:'Приоритет',detail:'Описание',kindNone:'не выбран',doneOn:'выполнено',doneSection:'Выполнено',goalOf:'Цель',
 search:'Поиск',contactSearch:'Поиск по контактам',sort:'Порядок',all:'Все',nobody:'Без имени',details:'Карточка контакта',close:'Закрыть',openContact:'Открыть карточку',filtered:'По этому запросу контактов нет.',shown:'Показано',discard:'Закрыть без сохранения? Введённый текст пропадёт.',doneDate:'Дата выполнения'},
 en:{title:'CONTACTS & GOALS',tag:'AGENT',contacts:'Contacts',noContacts:'Nobody yet. Add your fixer, friends from your lifepath or people who owe you.',addContact:'Add contact',name:'Name or handle',who:'Who they are',whoPh:'Fixer in Watson',where:'Where to find them',wherePh:'Afterlife bar, evenings',relation:'Relation',notes:'Notes',goals:'Goals & jobs',noGoals:'Write down what your character is after and current jobs.',addGoal:'Add goal',goalPh:'E.g. pay back Rust before Friday',done:'Done',remove:'Remove',fromLife:'Take from lifepath',lifeNone:'No lifepath friends, enemies or lovers that are not already listed.',lifeAdded:'Added from lifepath:',open:'open',full:'Entry limit reached.',
 undo:'Undo',stale:'The sheet has changed already, nothing was done.',
 notesTitle:'NOTES',notesTag:'NOTES',notesSearch:'Search notes',legacyTitle:'Notes',legacyEmpty:'Empty. Open it to write.',untitled:'Untitled',noNotes:'No notes of your own yet. Add the first one: a place, a lead, a to-do list.',noMatches:'Nothing found.',addNote:'Add note',editNote:'Open',pin:'Pin',unpin:'Unpin',pinned:'pinned',noteTitle:'Title',noteText:'Text',notePin:'Pin to the top',save:'Save',cancel:'Cancel',newNote:'New note',mainNote:'Main note of the sheet',noteDeleted:'Note deleted.',goalDeleted:'Goal deleted.',contactDeleted:'Contact deleted.',noteSaved:'Note saved.',
 more:'Details',kind:'Kind',priority:'Priority',detail:'Description',kindNone:'not set',doneOn:'done',doneSection:'Done',goalOf:'Goal',
 search:'Search',contactSearch:'Search contacts',sort:'Order',all:'All',nobody:'No name',details:'Contact card',close:'Close',openContact:'Open card',filtered:'No contacts match this search.',shown:'Shown',discard:'Close without saving? The text you typed will be lost.',doneDate:'Completion date'}};
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const lang=()=>global.App?.lang?.()==='en'?'en':'ru';
const t=k=>T[lang()][k];
const uid=()=>global.crypto?.randomUUID?.()||Date.now().toString(36)+Math.random().toString(36).slice(2);
const str=(v,n)=>typeof v==='string'?v.slice(0,n):'';
const isObj=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
const okId=v=>typeof v==='string'&&v.length>0&&v.length<=100;
const stamp=v=>typeof v==='number'&&Number.isFinite(v)&&v>0&&v<8.64e15?Math.floor(v):0;
const dateOk=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v));
const pad=n=>String(n).padStart(2,'0');
const today=(d=new Date())=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const has=(table,id)=>table.some(r=>r[0]===id);
const label=(table,id,ru)=>{const r=table.find(x=>x[0]===id);return r?(ru?r[1]:r[2]):''};
const norm=s=>String(s??'').toLowerCase().replace(/ё/g,'е').trim();
const sel=id=>`[data-agent-id="${String(id).replace(/["\\]/g,'\\$&')}"]`;

// ---------- Validation (pure) ----------
function cleanNote(x){
 if(!isObj(x)||!okId(x.id))return null;
 const o={id:x.id,title:str(x.title,NOTE_TITLE),text:str(x.text,NOTE_TEXT),pinned:x.pinned===true},at=stamp(x.at);
 if(at)o.at=at;return o;
}
function cleanGoal(x){
 if(!isObj(x)||!okId(x.id))return null;
 const o={id:x.id,text:str(x.text,TEXT),done:x.done===true};
 if(has(KINDS,x.kind))o.kind=x.kind;
 if(typeof x.detail==='string'&&x.detail)o.detail=x.detail.slice(0,DETAIL);
 if(has(PRIORITIES,x.priority))o.priority=x.priority;
 if(o.done&&dateOk(x.doneAt))o.doneAt=x.doneAt;
 return o;
}
function cleanContact(x){
 if(!isObj(x)||!okId(x.id))return null;
 const o={id:x.id,name:str(x.name,TEXT),who:str(x.who,TEXT),where:str(x.where,TEXT),relation:has(RELATIONS,x.relation)?x.relation:'other',notes:str(x.notes,NOTE)},at=stamp(x.at);
 if(at)o.at=at;return o;
}
function cleanList(list,fn,max){
 if(!Array.isArray(list))return [];
 const seen=new Set(),out=[];
 for(const x of list){const o=fn(x);if(!o||seen.has(o.id))continue;seen.add(o.id);out.push(o);if(out.length>=max)break}
 return out;
}
// For the safe import of a character: only the keys that are present come back, each checked. Use as
// Object.assign(extra,AgentNotes.cleanExtra(extra)).
function cleanExtra(extra){
 const e=isObj(extra)?extra:{},o={};
 if('notesList' in e)o.notesList=cleanList(e.notesList,cleanNote,NOTES_MAX);
 if('goals' in e)o.goals=cleanList(e.goals,cleanGoal,MAX);
 if('contacts' in e)o.contacts=cleanList(e.contacts,cleanContact,MAX);
 return o;
}
const notesList=c=>cleanList(c?.extra?.notesList,cleanNote,NOTES_MAX);
const contacts=c=>cleanList(c?.extra?.contacts,cleanContact,MAX);
const goals=c=>cleanList(c?.extra?.goals,cleanGoal,MAX);
// Hardening of what is stored (an imported or damaged save): rows that are not valid, repeated ids, rows over the cap
// and out-of-range fields are dropped or cut in place. Rows that are fine, with any keys of other features, stay as they are.
const OPT={notesList:['at'],goals:['kind','detail','priority','doneAt'],contacts:['at']};
const FIX={notesList:[cleanNote,NOTES_MAX],goals:[cleanGoal,MAX],contacts:[cleanContact,MAX]};
function normalize(c){
 if(!isObj(c?.extra))return false;
 let changed=false;
 for(const key of Object.keys(FIX)){
  if(!(key in c.extra))continue;
  const raw=c.extra[key],[fn,max]=FIX[key];
  if(!Array.isArray(raw)){c.extra[key]=[];changed=true;continue}
  const seen=new Set(),out=[];
  for(const x of raw){
   const o=fn(x);if(!o||seen.has(o.id)||out.length>=max){changed=true;continue}
   seen.add(o.id);
   for(const k of Object.keys(o))if(JSON.stringify(x[k])!==JSON.stringify(o[k])){x[k]=o[k];changed=true}
   for(const k of OPT[key])if(!(k in o)&&k in x){delete x[k];changed=true}
   out.push(x);
  }
  if(out.length!==raw.length||changed)c.extra[key]=out;
 }
 return changed;
}
function ensure(c,key){c.extra=isObj(c.extra)?c.extra:{};if(!Array.isArray(c.extra[key]))c.extra[key]=[];return c.extra[key]}
// The first note is the old single field of the sheet; it is only ever read and edited in place.
const legacyText=c=>typeof c?.notes==='string'?c.notes:'';

// ---------- Order and search (pure) ----------
function sortNotes(list){
 return list.map((n,i)=>[n,i]).sort((a,b)=>(b[0].pinned?1:0)-(a[0].pinned?1:0)||(b[0].at||0)-(a[0].at||0)||b[1]-a[1]).map(x=>x[0]);
}
function filterNotes(list,q){
 const s=norm(q);if(!s)return list;
 return list.filter(n=>(!n.legacy&&norm(n.title).includes(s))||norm(n.text).includes(s));
}
const PR={high:0,mid:1,low:2};
function splitGoals(list){
 const idx=new Map(list.map((g,i)=>[g,i])),open=list.filter(g=>!g.done).sort((a,b)=>PR[a.priority||'mid']-PR[b.priority||'mid']||idx.get(a)-idx.get(b));
 const done=list.filter(g=>g.done).sort((a,b)=>(b.doneAt||'').localeCompare(a.doneAt||'')||idx.get(b)-idx.get(a));
 return {open,done};
}
function filterContacts(list,{q='',rel='all'}={}){
 const s=norm(q);
 return list.filter(x=>(rel==='all'||x.relation===rel)&&(!s||[x.name,x.who,x.where,x.notes].some(v=>norm(v).includes(s))));
}
function sortContacts(list,mode,lg){
 const idx=new Map(list.map((x,i)=>[x,i])),loc=lg==='en'?'en':'ru';
 const byName=(a,b)=>{const x=a.name.trim(),y=b.name.trim();if(!x!==!y)return x?-1:1;return x.localeCompare(y,loc,{sensitivity:'base'})};
 const rank=x=>RELATIONS.findIndex(r=>r[0]===x.relation);
 const cmp=mode==='relation'?(a,b)=>rank(a)-rank(b)||byName(a,b)||idx.get(a)-idx.get(b)
  :mode==='newest'?(a,b)=>(b.at||0)-(a.at||0)||idx.get(b)-idx.get(a)
  :(a,b)=>byName(a,b)||idx.get(a)-idx.get(b);
 return [...list].sort(cmp);
}
function relationCounts(list){const n={};for(const x of list)n[x.relation]=(n[x.relation]||0)+1;return n}
// What print and share code may use: the extra notes, pinned first. The old field is printed by the sheet itself.
function printNotes(c){return sortNotes(notesList(c)).filter(n=>n.title||n.text.trim()).map(n=>({title:n.title,text:n.text,pinned:n.pinned}))}

// ---------- Changes (pure, on the character) ----------
function commitNote(c,d,now=Date.now()){
 if(d.legacy){c.notes=str(d.text,Math.max(LEGACY,legacyText(c).length));return 'saved'}
 const title=str(d.title,NOTE_TITLE).trim(),text=str(d.text,NOTE_TEXT),list=ensure(c,'notesList'),x=list.find(y=>y?.id===d.id);
 if(x){x.title=title;x.text=text;x.pinned=!!d.pinned;x.at=now;return 'saved'}
 if(d.isNew===false)return 'gone';
 if(!title&&!text.trim())return 'empty';
 if(list.length>=NOTES_MAX)return 'full';
 list.push({id:d.id,title,text,pinned:!!d.pinned,at:now});return 'saved';
}
function removeItem(c,key,id){
 const list=ensure(c,key),index=list.findIndex(x=>x?.id===id);
 if(index<0)return null;
 const [item]=list.splice(index,1);return {item,index};
}
function restoreItem(c,key,rec,max){
 const list=ensure(c,key);
 if(list.some(x=>x?.id===rec.item.id))return 'present';
 if(list.length>=max)return 'full';
 list.splice(Math.min(rec.index,list.length),0,rec.item);return 'ok';
}
function setGoalDone(g,done,now=new Date()){g.done=!!done;if(done)g.doneAt=today(now);else delete g.doneAt}

// ---------- View state (memory only) ----------
const ui={owner:'',nq:'',cq:'',rel:'all',sort:'name',sel:'',openDone:false,goalOpen:new Set()};
function sync(c){if(c&&normalize(c))global.App?.save?.();if(c&&ui.owner!==c.id){ui.owner=c.id;ui.nq='';ui.cq='';ui.rel='all';ui.sort='name';ui.sel='';ui.openDone=false;ui.goalOpen.clear()}}

function fmtIso(v){
 if(!dateOk(v))return '';
 try{return new Date(+v.slice(0,4),+v.slice(5,7)-1,+v.slice(8,10)).toLocaleDateString(lang()==='en'?'en-GB':'ru-RU')}catch{return v}
}
function fmtDate(at){
 if(!at)return '';
 try{return new Date(at).toLocaleDateString(lang()==='en'?'en-GB':'ru-RU')}catch{return ''}
}

// ---------- Notes view ----------
function snippet(s){const x=String(s||'').trim();return x.length>SNIPPET?x.slice(0,SNIPPET).trimEnd()+'…':x}
function noteItems(c){
 const first={legacy:true,id:'legacy',title:t('legacyTitle'),text:legacyText(c),pinned:false};
 return [first,...sortNotes(notesList(c))];
}
function noteCard(n){
 const title=n.title||(n.legacy?t('legacyTitle'):t('untitled')),text=snippet(n.text);
 const pin=n.legacy?'':`<button type="button" class="agent-mini" data-agent-action="pin-note" aria-pressed="${n.pinned?'true':'false'}" aria-label="${esc((n.pinned?t('unpin'):t('pin'))+': '+title)}">${n.pinned?'★':'☆'}<span class="agent-mini-text">${esc(n.pinned?t('unpin'):t('pin'))}</span></button>`;
 const del=n.legacy?'':`<button type="button" class="agent-mini" data-agent-action="remove-note" aria-label="${esc(t('remove')+': '+title)}">✕<span class="agent-mini-text">${esc(t('remove'))}</span></button>`;
 return `<article class="agent-note${n.pinned?' pinned':''}${n.legacy?' legacy':''}" data-agent-id="${esc(n.id)}"><div class="agent-note-head"><h3>${esc(title)}</h3>${n.pinned?`<span class="agent-chip">★ ${esc(t('pinned'))}</span>`:''}${n.legacy?`<span class="agent-chip">${esc(t('mainNote'))}</span>`:''}<small>${esc(fmtDate(n.at))}</small></div>${text?`<p class="agent-note-text">${esc(text)}</p>`:`<p class="agent-note-text agent-empty">${esc(n.legacy?t('legacyEmpty'):'—')}</p>`}<div class="agent-note-actions"><button type="button" class="agent-mini" data-agent-action="edit-note" aria-label="${esc(t('editNote')+': '+title)}">✎<span class="agent-mini-text">${esc(t('editNote'))}</span></button>${pin}${del}</div></article>`;
}
function noteListHtml(c){
 const all=noteItems(c),list=filterNotes(all,ui.nq);
 const body=list.length?list.map(noteCard).join(''):`<p class="agent-empty">${esc(t('noMatches'))}</p>`;
 return (all.length===1&&!ui.nq?`<p class="agent-empty">${esc(t('noNotes'))}</p>`:'')+body;
}
function notesInner(c){
 return `<h2 class="agent-h">${esc(t('notesTitle'))} <small>${notesList(c).length+1}</small></h2><div class="agent-toolbar"><label class="field agent-search">${esc(t('notesSearch'))}<input type="search" data-agent-search="notes" maxlength="80" autocomplete="off" value="${esc(ui.nq)}"></label><button type="button" class="btn ghost" data-agent-action="add-note">＋ ${esc(t('addNote'))}</button></div><div class="agent-notes-list" data-agent-list="notes" aria-live="polite">${noteListHtml(c)}</div>`;
}
function noteDialogHtml(n,legacy){
 const head=legacy?t('legacyTitle'):n.title||n.text?t('editNote'):t('newNote');
 return `<form method="dialog" class="agent-dialog-form" data-agent-dialog-form><h2 id="agent-dialog-title">${esc(head)}</h2>${legacy?'':`<label class="field">${esc(t('noteTitle'))}<input name="title" maxlength="${NOTE_TITLE}" value="${esc(n.title||'')}"></label>`}<label class="field">${esc(t('noteText'))}<textarea name="text" rows="10" maxlength="${legacy?Math.max(LEGACY,String(n.text||'').length):NOTE_TEXT}">${esc(n.text||'')}</textarea></label>${legacy?'':`<label class="agent-checkline"><input type="checkbox" name="pinned" ${n.pinned?'checked':''}> ${esc(t('notePin'))}</label>`}<div class="agent-dialog-actions"><button type="button" class="btn secondary" data-agent-dialog="cancel">${esc(t('cancel'))}</button><button type="submit" class="btn">${esc(t('save'))}</button></div></form>`;
}

// ---------- Goals view ----------
function goalRow(x){
 const ru=lang()==='ru',kind=x.kind?label(KINDS,x.kind,ru):'',pr=x.priority||'mid',more=ui.goalOpen.has(x.id);
 const chips=`${kind?`<span class="agent-chip">${esc(kind)}</span>`:''}${pr!=='mid'?`<span class="agent-chip prio-${pr}">${esc(label(PRIORITIES,pr,ru))}</span>`:''}${x.done&&x.doneAt?`<span class="agent-chip">${esc(t('doneOn'))} ${esc(fmtIso(x.doneAt)||x.doneAt)}</span>`:''}`;
 return `<div class="agent-goal ${x.done?'done':''}" data-agent-id="${esc(x.id)}" data-priority="${pr}"><label class="agent-check"><input type="checkbox" data-agent-field="done" aria-label="${esc(t('done')+': '+(x.text||t('goalOf')))}" ${x.done?'checked':''}></label><input data-agent-field="text" maxlength="${TEXT}" placeholder="${esc(t('goalPh'))}" aria-label="${esc(t('goalOf'))}" value="${esc(x.text)}"><button type="button" class="agent-remove" data-agent-action="remove-goal" aria-label="${esc(t('remove')+': '+(x.text||t('goalOf')))}">✕</button>${chips?`<div class="agent-goal-meta">${chips}</div>`:''}<details class="agent-goal-more" data-agent-goal-more${more?' open':''}><summary>${esc(t('more'))}</summary><div class="agent-goal-grid"><label class="field">${esc(t('kind'))}<select data-agent-field="kind"><option value="">${esc(t('kindNone'))}</option>${KINDS.map(([id,r,e])=>`<option value="${id}" ${x.kind===id?'selected':''}>${esc(ru?r:e)}</option>`).join('')}</select></label><label class="field">${esc(t('priority'))}<select data-agent-field="priority">${PRIORITIES.map(([id,r,e])=>`<option value="${id}" ${pr===id?'selected':''}>${esc(ru?r:e)}</option>`).join('')}</select></label><label class="field agent-wide">${esc(t('detail'))}<textarea data-agent-field="detail" rows="2" maxlength="${DETAIL}">${esc(x.detail||'')}</textarea></label></div></details></div>`;
}
function goalsHtml(c){
 const gs=goals(c),{open,done}=splitGoals(gs);
 return `<h2 class="agent-h">${esc(t('goals'))} <small>${open.length} ${esc(t('open'))}</small></h2>${open.length?`<div class="agent-goals">${open.map(goalRow).join('')}</div>`:gs.length?'':`<p class="agent-empty">${esc(t('noGoals'))}</p>`}<button type="button" class="btn ghost" data-agent-action="add-goal">＋ ${esc(t('addGoal'))}</button>${done.length?`<details class="agent-done-section" data-agent-done-section${ui.openDone?' open':''}><summary>${esc(t('doneSection'))} <small>${done.length}</small></summary><div class="agent-goals">${done.map(goalRow).join('')}</div></details>`:''}`;
}

// ---------- Contacts view ----------
function contactForm(x){
 const ru=lang()==='ru';
 return `<div class="agent-contact" data-agent-id="${esc(x.id)}" data-relation="${esc(x.relation||'other')}"><div class="agent-contact-grid"><label class="field">${esc(t('name'))}<input data-agent-field="name" maxlength="${TEXT}" value="${esc(x.name)}"></label><label class="field">${esc(t('relation'))}<select data-agent-field="relation">${RELATIONS.map(([id,r,e])=>`<option value="${id}" ${x.relation===id?'selected':''}>${esc(ru?r:e)}</option>`).join('')}</select></label><label class="field">${esc(t('who'))}<input data-agent-field="who" maxlength="${TEXT}" placeholder="${esc(t('whoPh'))}" value="${esc(x.who)}"></label><label class="field">${esc(t('where'))}<input data-agent-field="where" maxlength="${TEXT}" placeholder="${esc(t('wherePh'))}" value="${esc(x.where)}"></label></div><label class="field">${esc(t('notes'))}<textarea data-agent-field="notes" maxlength="${NOTE}" rows="3">${esc(x.notes)}</textarea></label><div class="agent-buttons"><button type="button" class="agent-remove" data-agent-action="close-contact">${esc(t('close'))}</button><button type="button" class="agent-remove" data-agent-action="remove-contact" aria-label="${esc(t('remove')+': '+(x.name||t('nobody')))}">✕ ${esc(t('remove'))}</button></div></div>`;
}
function contactRowInner(x,opened){
 return `<button type="button" class="agent-contact-open" data-agent-action="open-contact" aria-expanded="${opened?'true':'false'}"><b>${esc(x.name||t('nobody'))}</b><span class="agent-chip">${esc(label(RELATIONS,x.relation,lang()==='ru'))}</span>${x.who?`<small>${esc(x.who)}</small>`:''}</button>`;
}
function detailHtml(x){
 return `<div class="agent-detail" data-agent-detail role="region" aria-label="${esc(t('details')+': '+(x.name||t('nobody')))}"><h3 class="agent-detail-title" data-agent-detail-title>${esc(x.name||t('nobody'))}</h3>${contactForm(x)}</div>`;
}
// The card of the open contact sits directly under its row, so it is never out of sight of the tapped item.
function contactItem(x){
 const opened=ui.sel===x.id;
 return `<div class="agent-contact-item${opened?' open':''}" data-agent-id="${esc(x.id)}" data-relation="${esc(x.relation)}">${contactRowInner(x,opened)}${opened?detailHtml(x):''}</div>`;
}
function contactListHtml(c){
 const all=contacts(c);
 if(!all.length)return `<p class="agent-empty">${esc(t('noContacts'))}</p>`;
 const list=sortContacts(filterContacts(all,{q:ui.cq,rel:ui.rel}),ui.sort,lang()),open=all.find(x=>x.id===ui.sel);
 // An open contact that the filter hides still shows its card, after the list.
 const hidden=open&&!list.some(x=>x.id===open.id)?detailHtml(open):'';
 return (list.length?list.map(contactItem).join(''):`<p class="agent-empty">${esc(t('filtered'))}</p>`)+hidden;
}
function chipsHtml(c){
 const all=contacts(c),n=relationCounts(all),ru=lang()==='ru';
 if(all.length<2)return '';
 const chip=(id,text,count)=>`<button type="button" class="agent-filter-chip" data-agent-action="rel-chip" data-agent-rel="${id}" aria-pressed="${ui.rel===id?'true':'false'}">${esc(text)} <small>${count}</small></button>`;
 return chip('all',t('all'),all.length)+RELATIONS.filter(r=>n[r[0]]).map(r=>chip(r[0],ru?r[1]:r[2],n[r[0]])).join('');
}
function contactsHtml(c){
 const all=contacts(c);
 const bar=all.length>1?`<div class="agent-toolbar"><label class="field agent-search">${esc(t('contactSearch'))}<input type="search" data-agent-search="contacts" maxlength="80" autocomplete="off" value="${esc(ui.cq)}"></label><label class="field">${esc(t('sort'))}<select data-agent-sort>${SORTS.map(([id,r,e])=>`<option value="${id}" ${ui.sort===id?'selected':''}>${esc(lang()==='ru'?r:e)}</option>`).join('')}</select></label></div><div class="agent-chips" data-agent-chips role="group" aria-label="${esc(t('relation'))}">${chipsHtml(c)}</div>`:'';
 return `<h2 class="agent-h">${esc(t('contacts'))} <small>${all.length}</small></h2>${bar}<div class="agent-contacts" data-agent-list="contacts">${contactListHtml(c)}</div><div class="agent-buttons"><button type="button" class="btn ghost" data-agent-action="add-contact">＋ ${esc(t('addContact'))}</button><button type="button" class="btn ghost" data-agent-action="from-life">⌁ ${esc(t('fromLife'))}</button></div>`;
}

function inner(c){
 return `<div class="card-heading"><span>${esc(t('title'))}</span><span>${esc(t('tag'))}</span></div><div class="agent-columns"><div data-agent-goals>${goalsHtml(c)}</div><div data-agent-contacts>${contactsHtml(c)}</div></div><div class="agent-notes" id="sheet-agent-notes" tabindex="-1">${notesInner(c)}</div>`;
}
function render(c){sync(c);return `<section class="card agent-card" id="sheet-agent" tabindex="-1">${inner(c)}</section>`}

// ---------- Painting ----------
function focusIt(sel){
 const el=(sel&&doc.querySelector(sel))||null;
 if(el?.focus){el.focus();return true}
 return false;
}
function repaint(c,focusSel){
 const el=doc.querySelector('#sheet-agent');
 if(el){el.innerHTML=inner(c);if(!focusIt(focusSel)&&focusSel)el.focus?.()}
}
function repaintNotes(c,focusSel){
 const el=doc.querySelector('#sheet-agent-notes');
 if(el){el.innerHTML=notesInner(c);if(!focusIt(focusSel)&&focusSel)el.focus?.()}
}
// Editing a field of the open card updates its row and heading in place: a repaint on blur could replace the very
// button the next click is aimed at, and would drop the focus from the neighbouring field.
function refreshContact(x){
 const row=doc.querySelector(`.agent-contact-item${sel(x.id)}`);
 if(row){const b=row.querySelector?.('.agent-contact-open');if(b)b.outerHTML=contactRowInner(x,ui.sel===x.id);if(row.dataset)row.dataset.relation=x.relation}
 const h=doc.querySelector('[data-agent-detail-title]');if(h)h.textContent=x.name||t('nobody');
 const r=doc.querySelector('[data-agent-detail]');
 if(r?.setAttribute)r.setAttribute('aria-label',t('details')+': '+(x.name||t('nobody')));
}
function repaintChips(c){const ch=doc.querySelector('[data-agent-chips]');if(ch)ch.innerHTML=chipsHtml(c)}
function repaintLists(c){
 const l=doc.querySelector('[data-agent-list="contacts"]');if(l)l.innerHTML=contactListHtml(c);
 const ch=doc.querySelector('[data-agent-chips]');if(ch)ch.innerHTML=chipsHtml(c);
}

// ---------- Dialog for a note ----------
let dlg=null;
function closeDialog(restore){
 const d=dlg;dlg=null;if(!d)return;
 try{d.el.close?.()}catch{}
 d.el.remove?.();
 if(restore!==false&&!focusIt(d.back))focusIt('#sheet-agent-notes');
}
function openNote(c,id,back,isNew){
 if(!doc?.createElement)return;
 closeDialog(false);
 const legacy=id==='legacy',list=notesList(c),found=legacy?null:list.find(x=>x.id===id);
 // A note that is gone (deleted, undo pending) is not opened again as a blank one under the same id.
 if(!legacy&&!found&&!isNew)return;
 const n=legacy?{id:'legacy',title:'',text:legacyText(c)}:found||{id:id||uid(),title:'',text:'',pinned:false};
 const el=doc.createElement('dialog');el.className='agent-dialog';el.setAttribute('aria-labelledby','agent-dialog-title');
 el.innerHTML=noteDialogHtml(n,legacy);
 const scope=global.App?.editScope?.();
 const finish=()=>closeDialog();
 const field=name=>el.querySelector('form')?.elements?.[name];
 const first={title:field('title')?.value??'',text:field('text')?.value??'',pinned:!!field('pinned')?.checked};
 const dirty=()=>(field('title')?.value??'')!==first.title||(field('text')?.value??'')!==first.text||!!field('pinned')?.checked!==first.pinned;
 // Closing never drops typed text silently: a backdrop click does nothing, Escape and Cancel ask first.
 const leave=()=>{if(dirty()&&typeof global.confirm==='function'&&!global.confirm(t('discard')))return;finish()};
 el.addEventListener('cancel',e=>{e.preventDefault();leave()});
 el.addEventListener('click',e=>{if(e.target?.closest?.('[data-agent-dialog="cancel"]'))leave()});
 el.addEventListener('submit',e=>{
  e.preventDefault();
  if(global.App?.active?.()!==c||(scope!==undefined&&global.App?.editScope?.()!==scope)){finish();global.App?.notify?.(t('stale'));return}
  const f=el.querySelector('form'),val=name=>f?.elements?.[name];
  const res=commitNote(c,{id:n.id,legacy,isNew:!legacy&&!found,title:val('title')?.value,text:val('text')?.value,pinned:!!val('pinned')?.checked});
  if(res==='full'){global.App?.notify?.(t('full'));return}
  if(res==='gone'){finish();global.App?.notify?.(t('stale'));return}
  if(res==='saved'){
   global.App?.save?.();
   if(legacy){const ta=doc.querySelector('[data-field="notes"]');if(ta&&ta.value!==legacyText(c))ta.value=legacyText(c)}
   dlg=null;try{el.close?.()}catch{}el.remove?.();
   repaintNotes(c,`${sel(n.id)} [data-agent-action="edit-note"]`);
   if(!doc.querySelector(`${sel(n.id)} [data-agent-action="edit-note"]`))focusIt('[data-agent-action="add-note"]');
   return;
  }
  finish();
 });
 doc.body.appendChild(el);
 dlg={el,back};
 if(typeof el.showModal==='function')el.showModal();else el.setAttribute('open','');
 (el.querySelector('[name="title"]')||el.querySelector('[name="text"]'))?.focus?.();
}

// ---------- Undo ----------
function deleted(c,key,rec,msg,max,after){
 const app=global.App,scope=app?.editScope?.();
 app.save();after();
 if(typeof app.notifyAction!=='function'){app.notify?.(msg);return}
 app.notifyAction(msg,t('undo'),()=>{
  if(app.active?.()!==c||(scope!==undefined&&app.editScope?.()!==scope)){app.notify?.(t('stale'));return}
  const r=restoreItem(c,key,rec,max);
  if(r==='full'){app.notify?.(t('full'));return}
  if(r==='ok'){app.save();after()}
 });
}

// Lifepath people, read from the generated lifepath record if present.
function lifePeople(c){
 const life=c?.extra?.life,out=[];if(!life||typeof life!=='object')return out;
 const pick=(list,relation)=>{if(!Array.isArray(list))return;for(const p of list){const name=typeof p==='string'?p:(p?.name||p?.who||p?.relationship||p?.description);if(typeof name==='string'&&name.trim())out.push({name:name.trim().slice(0,TEXT),relation,notes:typeof p==='object'?str([p.detail,p.what,p.cause,p.reason,p.feeling,p.tragedy].filter(x=>typeof x==='string').join(' · '),NOTE):''})}};
 pick(life.friends,'friend');pick(life.enemies,'enemy');pick(life.lovers||life.loveAffairs||life.romance,'lover');
 return out;
}

// ---------- Events ----------
function onClick(e){
 const b=e.target?.closest?.('[data-agent-action]');if(!b)return;
 const app=global.App,c=app?.active?.();if(!c)return;
 sync(c);
 const a=b.dataset.agentAction,id=b.closest('[data-agent-id]')?.dataset.agentId;
 if(a==='add-contact'){
  const list=ensure(c,'contacts');if(list.length>=MAX){app.notify(t('full'));return}
  const x={id:uid(),name:'',who:'',where:'',relation:'fixer',notes:'',at:Date.now()};list.push(x);ui.sel=x.id;ui.cq='';ui.rel='all';app.save();repaint(c,`${sel(x.id)} [data-agent-field="name"]`);
 }else if(a==='add-goal'){
  const list=ensure(c,'goals');if(list.length>=MAX){app.notify(t('full'));return}
  const x={id:uid(),text:'',done:false};list.push(x);app.save();repaint(c,`${sel(x.id)} [data-agent-field="text"]`);
 }else if(a==='remove-goal'){
  const rec=removeItem(c,'goals',id);if(rec)deleted(c,'goals',rec,t('goalDeleted'),MAX,()=>repaint(c,'[data-agent-action="add-goal"]'));
 }else if(a==='remove-contact'){
  const rec=removeItem(c,'contacts',id);if(rec){if(ui.sel===id)ui.sel='';deleted(c,'contacts',rec,t('contactDeleted'),MAX,()=>repaint(c,'[data-agent-action="add-contact"]'))}
 }else if(a==='open-contact'){
  ui.sel=ui.sel===id?'':id;repaint(c,ui.sel?`[data-agent-detail] [data-agent-field="name"]`:`${sel(id)} [data-agent-action="open-contact"]`);
 }else if(a==='close-contact'){
  const back=ui.sel;ui.sel='';repaint(c,`${sel(back)} [data-agent-action="open-contact"]`);
 }else if(a==='rel-chip'){
  const rel=b.dataset.agentRel;ui.rel=rel==='all'||has(RELATIONS,rel)?rel:'all';repaint(c,`[data-agent-rel="${ui.rel}"]`);
 }else if(a==='from-life'){
  const list=ensure(c,'contacts'),known=new Set(list.map(x=>String(x?.name||'').toLowerCase())),fresh=lifePeople(c).filter(p=>!known.has(p.name.toLowerCase())).slice(0,Math.max(0,MAX-list.length));
  if(!fresh.length){app.notify(t('lifeNone'));return}
  const now=Date.now();
  for(const p of fresh)list.push({id:uid(),name:p.name,who:'',where:'',relation:p.relation,notes:p.notes,at:now});
  app.save();repaint(c);app.notify(`${t('lifeAdded')} ${fresh.map(p=>p.name).join(', ')}`);
 }else if(a==='add-note'){
  if(notesList(c).length>=NOTES_MAX){app.notify(t('full'));return}
  openNote(c,uid(),'[data-agent-action="add-note"]',true);
 }else if(a==='edit-note'){
  openNote(c,id,`${sel(id)} [data-agent-action="edit-note"]`);
 }else if(a==='pin-note'){
  const x=ensure(c,'notesList').find(y=>y?.id===id);if(!x)return;
  x.pinned=x.pinned!==true;app.save();repaintNotes(c,`${sel(id)} [data-agent-action="pin-note"]`);
 }else if(a==='remove-note'){
  const rec=removeItem(c,'notesList',id);if(rec)deleted(c,'notesList',rec,t('noteDeleted'),NOTES_MAX,()=>repaintNotes(c,'[data-agent-action="add-note"]'));
 }
}
// Text is saved on change (blur) so typing is never interrupted by a repaint.
function onChange(e){
 const s=e.target?.closest?.('[data-agent-sort]');
 if(s){const c=global.App?.active?.();if(!c)return;sync(c);ui.sort=has(SORTS,s.value)?s.value:'name';repaint(c,'[data-agent-sort]');return}
 const f=e.target?.closest?.('[data-agent-field]');if(!f)return;
 const c=global.App?.active?.();if(!c)return;
 sync(c);
 const row=f.closest('[data-agent-id]'),id=row?.dataset.agentId,field=f.dataset.agentField;
 const isGoal=row?.classList.contains('agent-goal'),list=ensure(c,isGoal?'goals':'contacts'),x=list.find(y=>y?.id===id);if(!x)return;
 if(isGoal){
  if(field==='done'){setGoalDone(x,f.checked);if(f.checked)ui.openDone=true;global.App.save();repaint(c,`${sel(id)} [data-agent-field="done"]`);return}
  if(field==='kind'){if(has(KINDS,f.value))x.kind=f.value;else delete x.kind;global.App.save();repaint(c,`${sel(id)} [data-agent-field="kind"]`);return}
  if(field==='priority'){x.priority=has(PRIORITIES,f.value)?f.value:'mid';global.App.save();repaint(c,`${sel(id)} [data-agent-field="priority"]`);return}
  if(field==='text')x.text=str(f.value,TEXT);
  else if(field==='detail')x.detail=str(f.value,DETAIL);
  else return;
 }else{
  if(field==='relation'){x.relation=has(RELATIONS,f.value)?f.value:'other';row.dataset.relation=x.relation}
  else if(['name','who','where'].includes(field))x[field]=str(f.value,TEXT);
  else if(field==='notes')x.notes=str(f.value,NOTE);
  else return;
  global.App.save();refreshContact(x);if(field==='relation')repaintChips(c);return;
 }
 global.App.save();
}
function onInput(e){
 const ta=e.target?.closest?.('[data-field="notes"]');
 if(ta){const p=doc.querySelector('[data-agent-id="legacy"] .agent-note-text');if(p){const x=snippet(ta.value);p.textContent=x||t('legacyEmpty');p.classList?.toggle('agent-empty',!x)}return}
 const f=e.target?.closest?.('[data-agent-search]');if(!f)return;
 const c=global.App?.active?.();if(!c)return;
 sync(c);
 if(f.dataset.agentSearch==='notes'){ui.nq=String(f.value||'').slice(0,80);const l=doc.querySelector('[data-agent-list="notes"]');if(l)l.innerHTML=noteListHtml(c)}
 else{ui.cq=String(f.value||'').slice(0,80);repaintLists(c)}
}
function onToggle(e){
 const d=e.target;if(!d?.matches)return;
 if(d.matches('[data-agent-goal-more]')){const id=d.closest('[data-agent-id]')?.dataset.agentId;if(id){if(d.open)ui.goalOpen.add(id);else ui.goalOpen.delete(id)}}
 else if(d.matches('[data-agent-done-section]'))ui.openDone=!!d.open;
}
if(doc?.addEventListener){
 doc.addEventListener('click',onClick);doc.addEventListener('change',onChange);doc.addEventListener('input',onInput);doc.addEventListener('toggle',onToggle,true);
}
global.AgentNotes={render,contacts,goals,notesList,printNotes,cleanExtra,cleanNote,cleanGoal,cleanContact,sortNotes,filterNotes,splitGoals,filterContacts,sortContacts,relationCounts,commitNote,removeItem,restoreItem,setGoalDone,legacyText,
 LIMITS:{contacts:MAX,goals:MAX,notes:NOTES_MAX,noteTitle:NOTE_TITLE,noteText:NOTE_TEXT,detail:DETAIL},
 _test:{ui,onClick,onChange,onInput,onToggle,noteDialogHtml,noteListHtml,goalsHtml,contactsHtml,today,closeDialog}};
})(typeof window!=='undefined'?window:globalThis);
