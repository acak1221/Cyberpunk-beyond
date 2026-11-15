/* Folders and tags for characters. On the «Персонажи» page a sheet can be put in a folder and given a few free tags;
   above the list there is a search by name and chips that leave only one folder or only the sheets with the picked tags.

   What is stored: extra.folder (a string) and extra.tags (a list of strings) on the character itself, so a link, a file
   and a backup carry them. Both are optional; a sheet without them behaves as before. A folder is not a thing of its
   own: it exists while at least one character names it, so there is nothing to rename or delete in bulk.

   Sorting a sheet is not an edit of the character. app.js leaves these two fields out when it decides whether a sheet
   changed, so filing a sheet never makes it "newer" than the player's own copy. The price: "merge from a backup"
   sees two copies that differ only by folder or tags as the same version and brings the new folder across only once
   the sheet is really edited. A full restore, a link and a file carry it at once.

   The online room never carries them: room.js removes both before a sheet is sent and again when one arrives.

   A folder and tags belong to the device they were set on. A sheet that arrives as something new brings the sender's;
   a sheet that updates a copy already here never changes how the receiver filed that copy.

   The filter (search text, picked folder, picked tags) lives in memory only. It hides cards in place and never redraws
   the page, so the search field keeps the focus and the caret while the player types. */
(function(global){
'use strict';
// More chips than CHIPS_MAX in one group are not drawn; those folders and tags are still found by the search field.
const LIMITS=Object.freeze({FOLDER_MAX:40,TAG_MAX:24,TAGS_MAX:8,QUERY_MAX:80,CHIPS_MAX:40});
const T={
 ru:{region:'Поиск и фильтр персонажей',search:'Поиск по имени',searchHint:'Имя, папка или метка',folders:'Папки',tags:'Метки',all:'Все',none:'Без папки',
  shown:'Показано {n} из {m}',nothing:'Никого не найдено. Измените запрос или сбросьте фильтр.',reset:'Сбросить фильтр',
  edit:'Папка и метки',folder:'Папка',folderIs:'Папка:',tagsAre:'Метки:',untitled:'Без имени',
  hint:'Через запятую, до 8 меток. Пустое поле убирает метки.',paused:'Сейчас изменения не сохраняются. Папка и метки остались прежними.'},
 en:{region:'Find and filter characters',search:'Search by name',searchHint:'Name, folder or tag',folders:'Folders',tags:'Tags',all:'All',none:'No folder',
  shown:'Showing {n} of {m}',nothing:'No one found. Change the search or reset the filter.',reset:'Reset filter',
  edit:'Folder and tags',folder:'Folder',folderIs:'Folder:',tagsAre:'Tags:',untitled:'Untitled',
  hint:'Separate with commas, up to 8 tags. An empty field removes the tags.',paused:'Changes are not being saved right now. The folder and tags stay as they were.'},
};
const L=lang=>lang==='en'?'en':'ru',t=(lang,k)=>T[L(lang)][k]??T.ru[k]??k;
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const isObject=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);

/* One line of plain text: no control, format or direction-changing characters (a name that flips the reading order of
   the line next to it is an old trick), no runs of spaces, no longer than `max`, and never half of a two-unit character.
   The two joiners stay, because some scripts and many emoji are written with them. The blank letters (Hangul fillers,
   the empty Braille cell) go as well: they are ordinary characters to the browser, but a folder named with them would be
   a chip with nothing on it. A text with nothing left to see is no text at all. */
const BLANK='\u115F\u1160\u3164\uFFA0\u2800';
const UNSEEN=new RegExp('[\\p{Cc}\\p{Cf}\\p{Cs}\\p{Zl}\\p{Zp}'+BLANK+']','gu'),INK=new RegExp('[^\\p{Z}\\p{Cc}\\p{Cf}\\p{Cs}\\p{M}'+BLANK+']','u');
function clean(text,max=LIMITS.FOLDER_MAX){
 if(typeof text!=='string')return '';
 let s=text.length>4000?text.slice(0,4000):text;
 try{s=s.normalize('NFC')}catch{}
 s=s.replace(UNSEEN,ch=>ch==='\u200C'||ch==='\u200D'?ch:' ').replace(/\s+/g,' ').trim();
 if(s.length>max){s=s.slice(0,max);if(/[\uD800-\uDBFF]$/.test(s))s=s.slice(0,-1);s=s.trim()}
 return INK.test(s)?s:'';
}
/* Two spellings of one folder or tag ("Банда" and "банда") are the same thing; this is what they are compared by.
   The joiners are left out here, so two names that look alike and differ only by a hidden one are one folder. */
function key(text){let s=clean(text,400);try{s=s.normalize('NFKC')}catch{}return s.toLowerCase().replace(/[\u200C\u200D]/g,'')}
const cleanTag=x=>typeof x==='string'?clean(clean(x.replace(/[,;]/g,' '),400).replace(/^(?:#\s*)+/,''),LIMITS.TAG_MAX):'';
// A list of tags as it is stored: cleaned, without repeats (the first spelling stays), in the order given, at most TAGS_MAX.
function cleanTags(list){
 const out=[],seen=new Set();if(!Array.isArray(list))return out;
 for(let i=0;i<list.length&&i<200&&out.length<LIMITS.TAGS_MAX;i++){const tag=cleanTag(list[i]),k=key(tag);if(!tag||seen.has(k))continue;seen.add(k);out.push(tag)}
 return out;
}
// What the player typed into the tags field: tags are separated by commas, semicolons or new lines.
function parseTags(text){return typeof text==='string'?cleanTags(text.slice(0,4000).split(/[,;\n\r]+/)):[]}
// The only way the stored fields are read. Whatever a hand-edited backup holds there, the answer is a string and a list of strings.
function read(c){
 const x=isObject(c)&&isObject(c.extra)?c.extra:null;
 return {folder:x?clean(x.folder,LIMITS.FOLDER_MAX):'',tags:x?cleanTags(x.tags):[]};
}
const same=(a,b)=>a.length===b.length&&a.every((x,i)=>x===b[i]);
/* Writes a folder and tags to a character; a field left out of `patch` is not touched. Tags may be the typed text or a list.
   An emptied field removes its key, so a sheet that was never sorted and one that was un-sorted look the same in a file. */
function set(c,patch){
 if(!isObject(c)||!isObject(patch))return false;
 if(c.extra!==undefined&&!isObject(c.extra))return false;
 const raw=c.extra||{};let changed=false;
 const write=(k,v,empty)=>{if(empty)delete c.extra[k];else{if(!c.extra)c.extra={};c.extra[k]=v}changed=true};
 if('folder' in patch){const v=clean(patch.folder,LIMITS.FOLDER_MAX);if(v?raw.folder!==v:'folder' in raw)write('folder',v,!v)}
 if('tags' in patch){const v=typeof patch.tags==='string'?parseTags(patch.tags):cleanTags(patch.tags);if(v.length?!(Array.isArray(raw.tags)&&same(v,raw.tags)):'tags' in raw)write('tags',v,!v.length)}
 return changed;
}
/* For a sheet that arrives from outside (app.js importSheet); `extra` is what came and is put right in place.
   A new sheet keeps the folder and tags it brought, cleaned. A sheet that lands on a copy already here (`update`) gets
   the folder and tags of that copy, whatever it brought: how the receiver filed their copy is theirs. Otherwise every
   fresh link from a player would move the sheet out of the GM's folder and drop the GM's tags, and since filing is not
   an edit, no previous version would go to the bin to bring them back. */
function keep(extra,oldExtra,update=isObject(oldExtra)){
 try{
  if(!isObject(extra))return;
  const r=read({extra:update?oldExtra:extra});
  if(r.folder)extra.folder=r.folder;else delete extra.folder;
  if(r.tags.length)extra.tags=r.tags;else delete extra.tags;
 }catch{}
}
const byLabel=(a,b)=>a.label.localeCompare(b.label,undefined,{sensitivity:'base',numeric:true})||(a.key<b.key?-1:a.key>b.key?1:0);
// Every folder and tag in use with the number of characters that have it; the label is the spelling met first in the list.
function index(characters){
 const folders=new Map(),tags=new Map();let none=0,total=0;
 const add=(map,label)=>{const k=key(label),e=map.get(k);if(e)e.count++;else map.set(k,{key:k,label,count:1})};
 for(const c of Array.isArray(characters)?characters:[]){
  if(!isObject(c))continue;total++;const r=read(c);
  if(r.folder)add(folders,r.folder);else none++;
  for(const tag of r.tags)add(tags,tag);
 }
 return {folders:[...folders.values()].sort(byLabel),tags:[...tags.values()].sort(byLabel),none,total};
}
/* Does a character pass the filter {query, folder, tags}? Every word of the query must be somewhere in the name, the
   folder or the tags; folder null means any, '' means "in no folder"; every picked tag must be on the sheet.
   The page draws a tag as "#tag", so a word typed with the # in front is looked for without it. */
function matches(c,filter){
 if(!isObject(c))return false;
 const f=filter||{},r=read(c);
 if(f.folder!==null&&f.folder!==undefined&&key(r.folder)!==f.folder)return false;
 const picked=f.tags&&typeof f.tags==='object'&&typeof f.tags[Symbol.iterator]==='function'?[...f.tags]:[];
 if(picked.length){const own=new Set(r.tags.map(key));if(!picked.every(k=>own.has(k)))return false}
 const words=key(typeof f.query==='string'?f.query.slice(0,LIMITS.QUERY_MAX):'').split(' ').map(w=>w.replace(/^#+/,'')).filter(Boolean);
 if(!words.length)return true;
 const hay=key([typeof c.name==='string'?c.name.slice(0,200):'',r.folder,...r.tags].join(' '));
 return words.every(w=>hay.includes(w));
}

/* The filter of the page. `owner` is whose data the page shows: another account or device scope starts with a clean filter.
   `list` is the list the bar was last drawn for; `open` remembers which editors are unfolded, so a redraw of the page
   (a change of language, a copy made) does not fold the one the player is typing in. */
let owner,query='',folder=null,tags=new Set(),list=[],open=new Set(),seq=0;
function reset(){query='';folder=null;tags=new Set()}
const active=()=>!!query||folder!==null||tags.size>0;
const filter=()=>({query,folder,tags});
// A picked folder or tag that no character has any more would leave an empty list with nothing to un-press.
function prune(idx){
 if(folder!==null&&(folder===''?!(idx.none&&idx.folders.length):!idx.folders.some(f=>f.key===folder)))folder=null;
 for(const k of [...tags])if(!idx.tags.some(x=>x.key===k))tags.delete(k);
}
const cut=(items,picked)=>items.length<=LIMITS.CHIPS_MAX?items:[...items].sort((a,b)=>(picked(b)-picked(a))||b.count-a.count||byLabel(a,b)).slice(0,LIMITS.CHIPS_MAX).sort(byLabel);
const chip=(kind,value,label,count,pressed)=>`<button type="button" class="char-tags-chip" data-char-tags="${kind}" value="${esc(value)}" aria-pressed="${pressed?'true':'false'}"><span>${esc(label)}</span><b>${count}</b></button>`;
function groups(idx,lang){
 let out='';
 if(idx.folders.length)out+=`<div class="char-tags-chips" role="group" aria-label="${esc(t(lang,'folders'))}">${chip('folder-all','',t(lang,'all'),idx.total,folder===null)}${cut(idx.folders,f=>f.key===folder?1:0).map(f=>chip('folder',f.key,f.label,f.count,folder===f.key)).join('')}${idx.none?chip('folder-none','',t(lang,'none'),idx.none,folder===''):''}</div>`;
 if(idx.tags.length)out+=`<div class="char-tags-chips" role="group" aria-label="${esc(t(lang,'tags'))}">${cut(idx.tags,x=>tags.has(x.key)?1:0).map(x=>chip('tag',x.key,'#'+x.label,x.count,tags.has(x.key))).join('')}</div>`;
 return out;
}
const options=idx=>idx.folders.map(f=>`<option value="${esc(f.label)}"></option>`).join('');
// One character has nothing to search or filter among; the bar appears with the second one or with the first folder or tag.
const wanted=idx=>idx.total>=2||idx.folders.length>0||idx.tags.length>0;
function statusText(shown,total,lang){return !active()?'':shown?t(lang,'shown').replace('{n}',shown).replace('{m}',total):t(lang,'nothing')}
/* The bar above the list. The list of folder names for the editors (a datalist) is always there, the rest only when it
   has something to do. The number in the status line is filled in by apply(), which sees the cards. */
function toolbar(characters,lang,scope){
 if(scope!==owner){owner=scope;reset();open=new Set()}
 list=Array.isArray(characters)?characters:[];seq=0;
 const idx=index(list);prune(idx);
 for(const id of [...open])if(!list.some(c=>isObject(c)&&c.id===id))open.delete(id);
 const shown=list.filter(c=>matches(c,filter())).length;
 return `<div class="char-tags-bar" data-char-tags-root><datalist id="char-tags-folders">${options(idx)}</datalist><section class="char-tags-body" data-char-tags-body aria-label="${esc(t(lang,'region'))}"${wanted(idx)?'':' hidden'}><label class="field char-tags-search"><span>${esc(t(lang,'search'))}</span><input type="search" data-char-tags="query" maxlength="${LIMITS.QUERY_MAX}" autocomplete="off" enterkeyhint="search" placeholder="${esc(t(lang,'searchHint'))}" value="${esc(query)}"></label><div class="char-tags-groups" data-char-tags-groups>${groups(idx,lang)}</div><div class="char-tags-status"><p data-char-tags-count role="status" aria-live="polite">${esc(statusText(shown,idx.total,lang))}</p><button type="button" class="btn small ghost" data-char-tags="reset"${active()?'':' hidden'}>${esc(t(lang,'reset'))}</button></div></section></div>`;
}
function lineHTML(r,lang){
 return (r.folder?`<span class="char-tags-folder"><span class="char-tags-sr">${esc(t(lang,'folderIs'))} </span><span aria-hidden="true">▤ </span>${esc(r.folder)}</span>`:'')+(r.tags.length?`<span class="char-tags-sr">${esc(t(lang,'tagsAre'))} </span>`+r.tags.map(x=>`<span class="char-tags-tag">#${esc(x)}</span>`).join(' '):'');
}
/* What a card on the «Персонажи» page gets: the folder and tags as a line of text, and a folded editor with two fields.
   There is one editor per card, so its name for a screen reader carries the name of the character. */
function card(c,lang){
 if(!isObject(c)||typeof c.id!=='string'||!c.id)return '';
 const r=read(c),n=++seq,id=esc(c.id),name=typeof c.name==='string'&&c.name?c.name.slice(0,200):t(lang,'untitled'),has=r.folder||r.tags.length;
 return `<div class="char-tags" data-char-tags-card="${id}"><p class="char-tags-line" data-char-tags-line${has?'':' hidden'}>${lineHTML(r,lang)}</p><details class="char-tags-edit" data-char-tags-edit${open.has(c.id)?' open':''}><summary class="btn text-button" aria-label="${esc(t(lang,'edit')+': '+name)}">${esc(t(lang,'edit'))} <span aria-hidden="true">▾</span></summary><div class="char-tags-fields"><label class="field"><span>${esc(t(lang,'folder'))}</span><input type="text" data-char-tags-field="folder" data-char-tags-id="${id}" maxlength="${LIMITS.FOLDER_MAX}" list="char-tags-folders" autocomplete="off" value="${esc(r.folder)}"></label><label class="field"><span>${esc(t(lang,'tags'))}</span><input type="text" data-char-tags-field="tags" data-char-tags-id="${id}" maxlength="220" autocomplete="off" autocapitalize="none" aria-describedby="char-tags-hint-${n}" value="${esc(r.tags.join(', '))}"></label><small class="char-tags-hint" id="char-tags-hint-${n}">${esc(t(lang,'hint'))}</small></div></details></div>`;
}

const doc=global.document;
const pageLang=()=>{try{return global.App?.getState?.()?.lang}catch{return undefined}};
const characterOf=id=>{const found=list.filter(c=>isObject(c)&&c.id===id);return found.length===1?found[0]:null};
/* Shows and hides the cards by the filter and brings the chips, the status line and the reset button in step with it.
   The card that holds the focus is never hidden: a sheet must not vanish from under the hands of the player who is
   re-filing it. It leaves the list with the next press of a chip, when the focus has moved on. */
function apply(root,lang){
 const scope=root?.querySelector?root:doc;if(!scope?.querySelector)return;
 const bar=scope.querySelector('[data-char-tags-root]');if(!bar)return;
 const f=filter(),on=active(),focus=doc?.activeElement||null;let shown=0,total=0;
 for(const el of scope.querySelectorAll('[data-character-card]')||[]){
  if(!el.querySelector?.('[data-char-tags-card]'))continue; // the three cards of the first page have no folder line and are not filtered
  total++;const c=characterOf(el.dataset?.characterCard),hide=on&&!(c&&matches(c,f))&&!(focus&&el.contains?.(focus));
  if(el.hidden!==hide)el.hidden=hide;if(!hide)shown++;
 }
 for(const b of bar.querySelectorAll('[data-char-tags]')||[]){
  const kind=b.dataset?.charTags,pressed=kind==='folder-all'?folder===null:kind==='folder-none'?folder==='':kind==='folder'?folder===b.value:kind==='tag'?tags.has(b.value):null;
  if(pressed!==null)b.setAttribute('aria-pressed',pressed?'true':'false');
  else if(kind==='reset'&&b.hidden!==!on)b.hidden=!on;
 }
 const status=bar.querySelector('[data-char-tags-count]'),text=statusText(shown,total,lang);
 if(status&&status.textContent!==text)status.textContent=text;
}
/* After a folder or tags changed: the line on the card, the list of folder names and the chips are drawn again, each
   inside its own box. The search field is never replaced, and neither is the page: the next field keeps the focus. */
function repaintCard(box,c,lang){const line=box?.querySelector?.('[data-char-tags-line]');if(!line)return;const r=read(c);line.innerHTML=lineHTML(r,lang);line.hidden=!(r.folder||r.tags.length)}
function repaintBar(lang){
 const bar=doc?.querySelector?.('[data-char-tags-root]');if(!bar)return;
 const idx=index(list);prune(idx);
 const data=bar.querySelector('datalist'),box=bar.querySelector('[data-char-tags-groups]'),body=bar.querySelector('[data-char-tags-body]');
 if(data)data.innerHTML=options(idx);if(box)box.innerHTML=groups(idx,lang);if(body)body.hidden=!wanted(idx);
 apply(doc,lang);
}
/* A change in a field is usually noticed when the player presses something else: the field loses the focus first. If the
   page changed shape at that moment, the press would be lost: a redrawn chip is gone from under the finger, and a new
   folder line or a new row of chips pushes every card below it down, so «Открыть» on the next card is no longer where
   it was pressed. So while a press on anything pressable is on its way, the sheet is saved at once but everything that
   is drawn waits for the click (app.js does the same for the whole page, with the same rule for what a press is).
   `pending` is what waits: the language and the cards whose line is to be drawn again. */
let held=false,holdTimer=0,pending=null;
function repaint(job){for(const [box,c] of job.cards)repaintCard(box,c,job.lang);repaintBar(job.lang)}
function release(){held=false;clearTimeout(holdTimer);if(pending!==null){const job=pending;pending=null;repaint(job)}}
function hold(e){
 const el=e?.target;
 if(e?.button!==0||!el?.closest?.('#app')||!el.closest('button,summary,label,a'))return;
 held=true;clearTimeout(holdTimer);holdTimer=setTimeout(release,1500);
}
// The chips are drawn anew after a waiting redraw, so the chip that was pressed is a new node; the focus goes to it,
// or to a neighbour that stays when its folder or tag is gone. Without this the focus would fall back to the top of the page.
function refocus(kind,value){
 const all=[...(doc?.querySelector?.('[data-char-tags-root]')?.querySelectorAll?.('[data-char-tags]')||[])],is=k=>x=>x.dataset?.charTags===k;
 (all.find(x=>x.dataset?.charTags===kind&&String(x.value??'')===value)||all.find(is('folder-all'))||all.find(is('query')))?.focus?.();
}
function commit(el){
 const App=global.App,box=el?.closest?.('[data-char-tags-card]'),field=el?.dataset?.charTagsField;
 if(!App||!box||(field!=='folder'&&field!=='tags')||el.isConnected===false)return false;
 let state;try{state=App.getState?.()}catch{return false}
 if(!state||state.view!=='characters'||!Array.isArray(state.characters))return false;
 const id=box.dataset?.charTagsCard,found=state.characters.filter(c=>isObject(c)&&c.id===id);
 if(found.length!==1)return false;
 const c=found[0],lang=state.lang,shownNow=()=>{const r=read(c);return field==='folder'?r.folder:r.tags.join(', ')};
 // A page that is not allowed to save (another tab took over, the storage is paused) puts the old text back instead of showing a change that will not stay.
 if(App.archive?.canEdit?.()===false){el.value=shownNow();App.notify?.(t(lang,'paused'));return false}
 list=state.characters;
 const changed=set(c,{[field]:String(el.value??'')});
 el.value=shownNow();
 if(!changed)return false;
 App.save?.();
 if(!held)repaint({lang,cards:[[box,c]]});
 else if(pending!==null){pending.lang=lang;pending.cards.push([box,c])}
 else pending={lang,cards:[[box,c]]};
 return true;
}
function press(b){
 const kind=b?.dataset?.charTags,lang=pageLang();
 if(kind==='folder-all')folder=null;
 else if(kind==='folder-none')folder=folder===''?null:'';
 else if(kind==='folder'){const k=String(b.value??'');folder=folder===k?null:k}
 else if(kind==='tag'){const k=String(b.value??'');if(tags.has(k))tags.delete(k);else tags.add(k)}
 else if(kind==='reset'){
  // The button hides itself, so the focus goes to a neighbour that stays: the «Все» chip, or the search field when there are no folders.
  reset();const input=doc?.querySelector?.('[data-char-tags="query"]');if(input)input.value='';
  (doc?.querySelector?.('[data-char-tags="folder-all"]')||input)?.focus?.();
 }
 else return false;
 // A redraw that waited for this press goes first: it may drop a folder that has just been emptied.
 if(pending!==null){release();if(kind!=='reset')refocus(kind,String(b.value??''))}else{held=false;clearTimeout(holdTimer);apply(doc,lang)}
 return true;
}
function typed(el){query=String(el?.value??'').slice(0,LIMITS.QUERY_MAX);apply(doc,pageLang())}

doc?.addEventListener?.('mousedown',hold,true);
doc?.addEventListener?.('mouseup',()=>{if(held)setTimeout(release,0)},true);
doc?.addEventListener?.('click',e=>{const b=e.target?.closest?.('button[data-char-tags]');if(b)press(b)});
doc?.addEventListener?.('input',e=>{if(e.target?.matches?.('[data-char-tags="query"]'))typed(e.target)});
// A search field has its own "clear" cross, and some browsers report it only as a `search` event.
doc?.addEventListener?.('search',e=>{if(e.target?.matches?.('[data-char-tags="query"]'))typed(e.target)});
doc?.addEventListener?.('change',e=>{if(e.target?.matches?.('[data-char-tags-field]'))commit(e.target)});
// Enter in a field files the sheet at once instead of waiting for the field to lose the focus.
doc?.addEventListener?.('keydown',e=>{if(e.key==='Enter'&&!e.isComposing&&e.target?.matches?.('[data-char-tags-field]')){e.preventDefault?.();commit(e.target)}});
doc?.addEventListener?.('toggle',e=>{const box=e.target?.matches?.('[data-char-tags-edit]')?e.target.closest('[data-char-tags-card]'):null,id=box?.dataset?.charTagsCard;if(!id)return;if(e.target.open)open.add(id);else open.delete(id)},true);

global.CharTags={LIMITS,T,t,clean,key,parseTags,read,set,keep,index,matches,toolbar,card,apply,reset,
 _test:{state:()=>({owner,query,folder,tags:[...tags],open:[...open],held,pending:pending!==null}),commit,press,typed,hold,release}};
})(typeof window!=='undefined'?window:globalThis);
