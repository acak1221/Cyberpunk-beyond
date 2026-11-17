/* Night Market stall generator. Corebook v1.22 "Night Markets" pp. 337–339 (six goods categories),
   price categories p. 385, item prices and pages from the app catalog (Night Market Appendix pp. 340–380).
   The printed per-category d-tables are NOT reproduced: items are drawn from the app's catalog entries
   for each category. Generated stock is kept in memory only (not saved). */
(function(){
'use strict';
// Book order of the six Night Market categories; index + 1 is the 1d6 face shown to the GM.
const CATEGORIES=Object.freeze([
 {id:'food',ru:'Еда и наркотики',en:'Food and Drugs'},
 {id:'electronics',ru:'Личная электроника',en:'Personal Electronics'},
 {id:'weapons',ru:'Оружие и броня',en:'Weapons and Armor'},
 {id:'cyberware',ru:'Киберимпланты',en:'Cyberware'},
 {id:'clothing',ru:'Одежда и fashionware',en:'Clothing and Fashionware'},
 {id:'survival',ru:'Снаряжение для выживания',en:'Survival Gear'}
]);
// Standard price categories, Corebook p. 385. Super Luxury is 10,000eb and up.
const PRICE_TIERS=Object.freeze([
 {id:'cheap',max:10,ru:'Cheap (дешёвое)',en:'Cheap'},
 {id:'everyday',max:20,ru:'Everyday (повседневное)',en:'Everyday'},
 {id:'costly',max:50,ru:'Costly (недешёвое)',en:'Costly'},
 {id:'premium',max:100,ru:'Premium (премиум)',en:'Premium'},
 {id:'expensive',max:500,ru:'Expensive (дорогое)',en:'Expensive'},
 {id:'veryexpensive',max:1000,ru:'Very Expensive (очень дорогое)',en:'Very Expensive'},
 {id:'luxury',max:5000,ru:'Luxury (роскошь)',en:'Luxury'},
 {id:'superluxury',max:Infinity,ru:'Super Luxury (без ограничения)',en:'Super Luxury (no cap)'}
]);
const ELECTRONICS=new Set(['agent','audio-recorder','braindance-viewer','bug-detector','chemical-analyzer','computer','cyberdeck-poor-quality','cyberdeck-standard-quality','cyberdeck-excellent-quality','disposable-cell-phone','homing-tracer','medscanner','radar-detector','radio-communicator','radio-scanner-music-player','scrambler-descrambler','smart-glasses','techscanner','video-camera','virtuality-goggles','memory-chips','pocket-amplifier','drum-synthesizer','electric-guitar-or-another-instrument'].map(x=>'gear-'+x));
const FOOD=new Set(['gear-kibble-pack','gear-mre','gear-food-stick']);
const NOT_SURVIVAL=new Set(['gear-vial-of-poison','gear-vial-of-biotoxin']);
const FASHIONWARE=new Set(['biomonitor','chemskin','emp-threading','light-tattoo','shift-tacts','skinwatch','techhair'].map(x=>'cyberware-'+x));
function categoryOf(item){
 if(!item||typeof item.price!=='number'||!Number.isFinite(item.price)||item.price<=0)return null;
 const c=item.category,id=item.id;
 if(c==='drugs'||FOOD.has(id))return 'food';
 if(c==='gear')return ELECTRONICS.has(id)?'electronics':NOT_SURVIVAL.has(id)?null:'survival';
 if(['weapon','armor','ammo','attachment'].includes(c))return 'weapons';
 if(c==='cyberware')return FASHIONWARE.has(id)?'clothing':'cyberware';
 if(c==='fashion')return 'clothing';
 // Programs, cyberdeck hardware and Black ICE are Personal Electronics stock (pp. 338–339).
 if(c==='programs')return 'electronics';
 return null;
}
function pool(category,cap,catalog){const list=Array.isArray(catalog)?catalog:(typeof window!=='undefined'&&Array.isArray(window.CATALOG)?window.CATALOG:[]);const max=tierMax(cap);return list.filter(i=>categoryOf(i)===category&&i.price<=max)}
function tierMax(id){return (PRICE_TIERS.find(t=>t.id===id)||PRICE_TIERS[PRICE_TIERS.length-1]).max}
function tierOf(price){return PRICE_TIERS.find(t=>price<=t.max)||PRICE_TIERS[PRICE_TIERS.length-1]}
function die(sides,rng){const n=1+Math.floor(rng()*sides);return Number.isInteger(n)&&n>=1&&n<=sides?n:1}
function int(v,min,max,fallback){const n=Number(v);return Number.isInteger(n)&&n>=min&&n<=max?n:fallback}
// Roll distinct categories on 1d6; duplicate faces are rerolled and recorded.
function rollCategories(count,rng=Math.random){count=int(count,1,6,2);const picked=[],rolls=[];let guard=0;while(picked.length<count&&guard++<500){const face=die(6,rng);rolls.push(face);const id=CATEGORIES[face-1].id;if(!picked.includes(id))picked.push(id)}for(const c of CATEGORIES)if(picked.length<count&&!picked.includes(c.id))picked.push(c.id);return {categories:picked,rolls}}
function pickItems(category,count,cap,rng=Math.random,catalog,exclude=[]){const avail=pool(category,cap,catalog).filter(i=>!exclude.includes(i.id)),out=[];count=Math.min(int(count,0,20,0),avail.length);while(out.length<count){const i=Math.floor(rng()*avail.length);out.push(avail.splice(Math.min(Math.max(i,0),avail.length-1),1)[0])}return out}
function generate(opts={},rng=Math.random,catalog){const cats=rollCategories(opts.categories,rng),cap=PRICE_TIERS.some(t=>t.id===opts.cap)?opts.cap:'superluxury',stalls=cats.categories.map(id=>{const count=opts.items==='d10'||opts.items===undefined?die(10,rng):int(opts.items,1,10,5);return {category:id,count,items:pickItems(id,count,cap,rng,catalog).map(i=>i.id)}});return {rolls:cats.rolls,cap,stalls}}
function rerollItem(market,stallIndex,itemIndex,rng=Math.random,catalog){const s=market?.stalls?.[stallIndex];if(!s||!Number.isInteger(itemIndex)||itemIndex<0||itemIndex>=s.items.length)return false;const next=pickItems(s.category,1,market.cap,rng,catalog,s.items)[0];if(!next)return false;s.items[itemIndex]=next.id;return true}
function rerollStall(market,stallIndex,rng=Math.random,catalog){const s=market?.stalls?.[stallIndex];if(!s)return false;s.items=pickItems(s.category,s.count,market.cap,rng,catalog).map(i=>i.id);return true}

// ---------- Saved stalls ----------
/* A stall of the generated market can be kept in the GM data (state.gmExtras.nightMarkets, so the full backup and the
   device transfer carry it): at most 30 stalls of at most 40 lines. A line is a catalog item with its own price, which the
   GM may change, or a line whose catalog entry is gone (then the stored name is shown). Everything read back is rebuilt
   field by field. Stalls travel between devices as a file (format below), checked the same way before anything is kept. */
const MAX_STALLS=30,MAX_LINES=40,MAX_STALL_NAME=60,MAX_LINE_NAME=80,MAX_PRICE=9999999,MAX_TOTAL=250000,MAX_FILE_CHARS=400000,MAX_SCAN=200;
const FORMAT='nightcity-red-night-market',VERSION=1,STALLS_KEY='nightMarkets';
const SID=/^[A-Za-z0-9_-]{1,40}$/;
const isObj=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
function oneLine(v,max){return typeof v==='string'?v.replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max):''}
function wholePrice(v){let n=null;if(typeof v==='number')n=v;else if(typeof v==='string'&&/^\s*\d{1,7}\s*$/.test(v))n=Number(v);return Number.isSafeInteger(n)&&n>=0&&n<=MAX_PRICE?n:null}
function cleanLine(raw){
 if(!isObj(raw))return null;
 const item=typeof raw.item==='string'&&raw.item.length<=80?raw.item:'',name=oneLine(raw.name,MAX_LINE_NAME),price=wholePrice(raw.price);
 if((!item&&!name)||price===null)return null;
 return {...(item?{item}:{}),...(name?{name}:{}),price};
}
function cleanStall(raw){
 if(!isObj(raw)||typeof raw.id!=='string'||!SID.test(raw.id)||!CATEGORIES.some(c=>c.id===raw.category))return null;
 const lines=(Array.isArray(raw.lines)?raw.lines:[]).slice(0,MAX_LINES*2).map(cleanLine).filter(Boolean).slice(0,MAX_LINES);
 return {id:raw.id,name:oneLine(raw.name,MAX_STALL_NAME),category:raw.category,cap:PRICE_TIERS.some(t=>t.id===raw.cap)?raw.cap:'superluxury',lines};
}
function readStalls(state){
 const raw=isObj(state)&&isObj(state.gmExtras)?state.gmExtras[STALLS_KEY]:null;
 if(!Array.isArray(raw))return [];
 const out=[],seen=new Set();
 for(const x of raw.slice(0,MAX_SCAN)){const s=cleanStall(x);if(s&&!seen.has(s.id)){seen.add(s.id);out.push(s)}if(out.length>=MAX_STALLS)break}
 return out;
}
// Writes only its own key, so the clocks, tables and factions in the same section are left alone.
function writeStalls(state,list){
 if(!isObj(state)||!Array.isArray(list))return false;
 if(!isObj(state.gmExtras))state.gmExtras={};
 const clean=list.slice(0,MAX_STALLS).map(cleanStall).filter(Boolean);
 if(clean.length)state.gmExtras[STALLS_KEY]=clean;else delete state.gmExtras[STALLS_KEY];
 return true;
}
let idSeq=0;
function newStallId(){return 's'+Date.now().toString(36)+(idSeq++).toString(36)+Math.floor(Math.random()*46656).toString(36)}
function lineOfItem(i){return {item:i.id,name:oneLine(i.name?.en||i.name?.ru||i.id,MAX_LINE_NAME),price:i.price}}
const failed=key=>({ok:false,key});
const sidOf=v=>typeof v==='string'&&SID.test(v)?v:'';
const catalogList=catalog=>Array.isArray(catalog)?catalog:(typeof window!=='undefined'&&Array.isArray(window.CATALOG)?window.CATALOG:[]);
// Short tier label in the language asked for: the Russian text is the note in brackets, not the English tier name.
function tierLabel(tier,l){if(l==='en')return tier.en.split(' (')[0];const m=/\(([^)]+)\)/.exec(tier.ru);return m?m[1]:tier.ru}
// A stall of a generated market, as a record to keep; null when the market has no such stall or it is empty.
function stallFromMarket(m,index,lang,newId=newStallId,catalog){
 const s=m?.stalls?.[index];if(!s||!CATEGORIES.some(c=>c.id===s.category))return null;
 const all=catalogList(catalog);
 const lines=(Array.isArray(s.items)?s.items:[]).map(id=>all.find(i=>i&&i.id===id)).filter(i=>i&&Number.isSafeInteger(i.price)).slice(0,MAX_LINES).map(lineOfItem);
 if(!lines.length)return null;
 const l=lang==='en'?'en':'ru',cat=CATEGORIES.find(c=>c.id===s.category),cap=PRICE_TIERS.some(t=>t.id===m.cap)?m.cap:'superluxury',tier=PRICE_TIERS.find(t=>t.id===cap);
 return cleanStall({id:newId(),name:`${cat[l]} · ${tierLabel(tier,l)}`,category:s.category,cap,lines});
}
function keepStall(list,stall){
 const s=cleanStall(stall);if(!s)return failed('bad');
 if(list.length>=MAX_STALLS)return failed('full');
 if(list.some(x=>x.id===s.id))return failed('bad');
 return {ok:true,list:[...list,s],id:s.id};
}
// One change to one stall; fn gets a copy and returns nothing or a failure.
function editStall(list,id,fn){
 const i=list.findIndex(s=>s.id===id);if(i<0)return failed('stale');
 const copy={...list[i],lines:list[i].lines.map(x=>({...x}))},r=fn(copy);
 if(r&&r.ok===false)return r;
 const next=list.slice();next[i]=cleanStall(copy);
 return {ok:true,list:next,id};
}
const okIndex=(s,index)=>Number.isInteger(index)&&index>=0&&index<s.lines.length;
function renameStall(list,id,name){return editStall(list,id,s=>{s.name=oneLine(name,MAX_STALL_NAME)})}
function removeLine(list,id,index){return editStall(list,id,s=>{if(!okIndex(s,index))return failed('stale');s.lines.splice(index,1)})}
function setLinePrice(list,id,index,value){
 const price=wholePrice(value);if(price===null)return failed('badPrice');
 return editStall(list,id,s=>{if(!okIndex(s,index))return failed('stale');s.lines[index].price=price});
}
function rerollLine(list,id,index,rng=Math.random,catalog){
 return editStall(list,id,s=>{
  if(!okIndex(s,index))return failed('stale');
  const next=pickItems(s.category,1,s.cap,rng,catalog,s.lines.map(x=>x.item).filter(Boolean))[0];
  if(!next)return failed('noMore');
  s.lines[index]=lineOfItem(next);
 });
}
function addLine(list,id,itemId,catalog){
 const all=catalogList(catalog);
 return editStall(list,id,s=>{
  const item=all.find(i=>i&&i.id===itemId);
  if(!item||categoryOf(item)!==s.category)return failed('unknown');
  if(s.lines.length>=MAX_LINES)return failed('linesFull');
  if(s.lines.some(x=>x.item===item.id))return failed('dup');
  s.lines.push(lineOfItem(item));
 });
}
function duplicateStall(list,id,lang,newId=newStallId){
 const s=list.find(x=>x.id===id);if(!s)return failed('stale');
 if(list.length>=MAX_STALLS)return failed('full');
 const word=lang==='en'?'copy':'копия',copy=cleanStall({...s,id:newId(),name:oneLine(`${s.name} (${word})`,MAX_STALL_NAME)});
 return copy?{ok:true,list:[...list,copy],id:copy.id}:failed('bad');
}
function deleteStall(list,id){
 const s=list.find(x=>x.id===id);if(!s)return failed('stale');
 return {ok:true,list:list.filter(x=>x.id!==id),id,name:s.name};
}
const stallsSize=list=>JSON.stringify(list).length;
// ---- stall file ----
function buildFile(stalls,title,now=new Date()){
 return {format:FORMAT,version:VERSION,title:oneLine(title,MAX_STALL_NAME),exportedAt:now instanceof Date&&!isNaN(now)?now.toISOString():'',stalls:(Array.isArray(stalls)?stalls:[]).map(cleanStall).filter(Boolean).slice(0,MAX_STALLS)};
}
function parseFile(text){
 if(typeof text!=='string'||text.length>MAX_FILE_CHARS)return {ok:false,reason:'size'};
 let raw;try{raw=JSON.parse(text)}catch{return {ok:false,reason:'json'}}
 if(!isObj(raw)||raw.format!==FORMAT||!Array.isArray(raw.stalls))return {ok:false,reason:'format'};
 if(typeof raw.version==='number'&&raw.version>VERSION)return {ok:false,reason:'newer'};
 const stalls=[],rejected=[],seen=new Set();
 for(const x of raw.stalls.slice(0,MAX_SCAN)){
  const s=cleanStall(x);
  if(!s)rejected.push({name:oneLine(isObj(x)?x.name:'',MAX_STALL_NAME),reason:'broken'});
  else if(seen.has(s.id))rejected.push({name:s.name,reason:'twice'});
  else{seen.add(s.id);stalls.push(s)}
 }
 if(!stalls.length)return {ok:false,reason:'empty',rejected};
 return {ok:true,title:oneLine(raw.title,MAX_STALL_NAME),stalls,rejected};
}
// What an import would do, stall by stall. A stall with a known id replaces yours; the same content is skipped.
function planImport(current,pack){
 const rows=[];let list=current.slice(),added=0,updated=0,same=0,overflow=0;
 for(const s of pack.stalls){
  const old=list.find(x=>x.id===s.id);
  if(old&&JSON.stringify(old)===JSON.stringify(s)){same++;rows.push({stall:s,status:'same'});continue}
  const next=old?list.map(x=>x.id===s.id?s:x):[...list,s];
  if((!old&&list.length>=MAX_STALLS)||stallsSize(next)>MAX_TOTAL){overflow++;rows.push({stall:s,status:'overflow'});continue}
  list=next;if(old)updated++;else added++;
  rows.push({stall:s,status:old?'update':'new'});
 }
 return {rows,list,added,updated,same,overflow};
}

const T={
 ru:{title:'НОЧНОЙ РЫНОК',source:'СТР. 337–340, 385',intro:'Быстро наполните ночной рынок товарами для сцены. Категории бросаются на 1d6 по шести категориям ночного рынка из книги (повторы перебрасываются); конкретные товары берутся из каталога приложения с ценами и страницами, а не из печатных таблиц.',cats:'Категорий',items:'Товаров в категории',d10:'1d10 на каждую',cap:'Ценовой потолок (связи фиксера)',generate:'Собрать рынок',empty:'Нажмите «Собрать рынок». Результат хранится только до перезагрузки страницы.',rolls:'Броски 1d6',stall:'Раздел',reroll:'Перебросить раздел',swap:'Заменить',none:'Под этот ценовой потолок в категории нет товаров.',short:'Товаров меньше, чем выпало: в каталоге под этот потолок их только',note:'Ночные рынки временные: стоимость, наличие и торг остаются за ведущим. Ночные рынки — стр. 337–339; способность фиксера Operator — стр. 159.',book:'Книга, стр. 337',price:'Цена',page:'стр.',list:'Список для игроков'},
 en:{title:'NIGHT MARKET',source:'PP. 337–340, 385',intro:'Quickly stock a Night Market for a scene. Categories are rolled on 1d6 over the book’s six Night Market categories (duplicates rerolled); the specific goods come from the app catalog with prices and pages, not from the printed tables.',cats:'Categories',items:'Items per category',d10:'1d10 each',cap:'Price cap (Fixer’s reach)',generate:'Build market',empty:'Press “Build market”. The result is kept only until the page reloads.',rolls:'1d6 rolls',stall:'Section',reroll:'Reroll section',swap:'Swap',none:'No goods in this category under the selected price cap.',short:'Fewer goods than rolled: the catalog only has',note:'Night Markets are temporary: availability, haggling and final prices are up to the GM. Night Markets: pp. 337–339; the Fixer’s Operator ability: p. 159.',book:'Corebook p. 337',price:'Price',page:'p.',list:'Player-facing list'}
};
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let settings={categories:2,items:'d10',cap:'superluxury'},market=null;
function byId(id){const list=typeof window!=='undefined'&&Array.isArray(window.CATALOG)?window.CATALOG:[];return list.find(i=>i.id===id)}
function opt(value,label,current){return `<option value="${esc(value)}"${String(value)===String(current)?' selected':''}>${esc(label)}</option>`}

// ---------- Saved stalls: texts and drawing ----------
const S={
 ru:{title:'Сохранённые прилавки',count:(n)=>`${n} из ${MAX_STALLS}`,intro:'Прилавки хранятся в данных ведущего на этом устройстве и попадают в резервную копию. Строку можно заменить, убрать или добавить из каталога, а цену поправить.',none:'Пока ничего не сохранено. Нажмите «Сохранить прилавок» у раздела собранного рынка.',
  save:'Сохранить прилавок',name:'Название прилавка',lines:n=>`строк: ${n} из ${MAX_LINES}`,empty:'В прилавке нет строк.',price:'Цена, eb',reroll:'Заменить на другой товар',remove:'Убрать строку',pick:'Добавить товар из каталога',add:'Добавить',dup:'Дублировать',del:'Удалить',file:'В файл',allFile:'Все прилавки в файл',open:'Открыть файл прилавков',
  saved:n=>`Прилавок сохранён: ${n}.`,deleted:n=>`Прилавок «${n}» удалён.`,restored:n=>`Прилавок «${n}» возвращён.`,copied:n=>`Копия создана: ${n}.`,imported:(a,u)=>`Прилавки из файла добавлены: новых — ${a}, заменено — ${u}.`,undo:'Вернуть',
  full:`Можно хранить не больше ${MAX_STALLS} прилавков. Удалите один из них.`,linesFull:`В прилавке не больше ${MAX_LINES} строк.`,noMore:'В этой категории под потолок цены больше нет других товаров.',lineDup:'Этот товар уже есть в прилавке.',badPrice:`Укажите цену целым числом от 0 до ${MAX_PRICE}.`,unknown:'Этого товара нет в этой категории каталога.',stale:'Данные изменились. Повторите действие.',emptyStall:'В этом разделе нет товаров, сохранять нечего.',noStore:'Хранилище недоступно, сохранить не получилось.',
  fSize:'Файл слишком большой.',fJson:'Не удалось прочитать файл: это не файл прилавков.',fFormat:'Это не файл прилавков Night City // RED.',fNewer:'Файл сделан более новой версией приложения.',fEmpty:'В файле нет подходящих прилавков.',
  preview:'Что будет добавлено из файла',tagNew:'новый',tagUpdate:'заменит',tagSame:'уже есть',tagOverflow:'не поместится',plan:(a,u,s)=>`Новых: ${a}, заменят ваши: ${u}, без изменений: ${s}.`,rejected:n=>`Пропущено повреждённых или повторных: ${n}.`,apply:'Добавить',discard:'Не добавлять',untitled:'Без названия',unnamed:'Прилавок без названия',sum:'Прилавок'},
 en:{title:'Saved stalls',count:(n)=>`${n} of ${MAX_STALLS}`,intro:'Stalls are kept in the GM data on this device and are part of the backup. A line can be replaced, removed or added from the catalog, and its price can be changed.',none:'Nothing saved yet. Press “Save stall” on a section of a built market.',
  save:'Save stall',name:'Stall name',lines:n=>`lines: ${n} of ${MAX_LINES}`,empty:'This stall has no lines.',price:'Price, eb',reroll:'Replace with another item',remove:'Remove line',pick:'Add an item from the catalog',add:'Add',dup:'Duplicate',del:'Delete',file:'To file',allFile:'All stalls to file',open:'Open stalls file',
  saved:n=>`Stall saved: ${n}.`,deleted:n=>`Stall “${n}” deleted.`,restored:n=>`Stall “${n}” restored.`,copied:n=>`Copy created: ${n}.`,imported:(a,u)=>`Stalls from the file added: ${a} new, ${u} replaced.`,undo:'Undo',
  full:`At most ${MAX_STALLS} stalls can be kept. Delete one of them.`,linesFull:`A stall holds at most ${MAX_LINES} lines.`,noMore:'This category has no other goods under the price cap.',lineDup:'This item is already in the stall.',badPrice:`Enter the price as a whole number from 0 to ${MAX_PRICE}.`,unknown:'This item is not in this catalog category.',stale:'The data changed. Repeat the action.',emptyStall:'This section has no goods, nothing to save.',noStore:'Storage is unavailable, nothing was saved.',
  fSize:'The file is too large.',fJson:'Could not read the file: it is not a stalls file.',fFormat:'This is not a Night City // RED stalls file.',fNewer:'The file was made by a newer version of the app.',fEmpty:'The file has no usable stalls.',
  preview:'What the file would add',tagNew:'new',tagUpdate:'replaces',tagSame:'already here',tagOverflow:'does not fit',plan:(a,u,s)=>`New: ${a}, replacing yours: ${u}, unchanged: ${s}.`,rejected:n=>`Skipped as broken or repeated: ${n}.`,apply:'Add',discard:'Do not add',untitled:'Untitled',unnamed:'Unnamed stall',sum:'Stall'}
};
const sText=(l,k,...a)=>{const v=S[l==='en'?'en':'ru'][k];return typeof v==='function'?v(...a):v};
const fileErr=(l,r)=>sText(l,{size:'fSize',json:'fJson',format:'fFormat',newer:'fNewer',empty:'fEmpty'}[r]||'fJson');
let sui={open:new Set(),preview:null,fileError:null};
function appState(){try{return typeof window!=='undefined'&&typeof window.App?.getState==='function'?window.App.getState():null}catch{return null}}
const saved=()=>readStalls(appState());
const mark=()=>JSON.stringify(saved());
function commitStalls(list){const st=appState();if(!st||!writeStalls(st,list))return false;try{window.App.save()}catch{}return true}
function say(m){try{window.App?.notify?.(m)}catch{}}
function sayUndo(m,l,undo){try{if(typeof window.App?.notifyAction==='function'){window.App.notifyAction(m,sText(l,'undo'),undo);return}}catch{}say(m)}
const cat=id=>CATEGORIES.find(c=>c.id===id)||CATEGORIES[0];
function lineView(ln,l){const i=ln.item?byId(ln.item):null;return {name:i?(i.name[l]||i.name.en):(ln.name||ln.item||'?'),page:i?i.page:null,item:i}}
function stallHtml(s,l){
 const c=cat(s.category),id=esc(s.id),all=catalogList().filter(i=>categoryOf(i)===s.category&&!s.lines.some(x=>x.item===i.id)).sort((a,b)=>(a.name[l]||a.name.en).localeCompare(b.name[l]||b.name.en));
 const nm=s.name||sText(l,'unnamed'),btn=(a,text,extra='',cls='ghost')=>`<button type="button" class="btn ${cls}" data-nm-s="${a}" data-nm-id="${id}"${extra} aria-label="${esc(text)}: ${esc(nm)}">${esc(text)}</button>`;
 const rows=s.lines.map((ln,i)=>{const v=lineView(ln,l);return `<li><span class="nm-name">${esc(v.name)}</span><label class="nm-price-field"><span class="nm-hidden">${esc(sText(l,'price'))}: ${esc(v.name)}</span><input type="number" inputmode="numeric" min="0" max="${MAX_PRICE}" step="1" value="${ln.price}" data-nm-sfield="price" data-nm-id="${id}" data-nm-line="${i}"><span aria-hidden="true">eb</span></label>${v.page?`<button class="rule-source" type="button" data-action="book-page" data-page="${esc(v.page)}">${esc(l==='en'?'p.':'стр.')} ${esc(v.page)}</button>`:''}<button type="button" class="btn ghost nm-swap" data-nm-s="line-reroll" data-nm-id="${id}" data-nm-line="${i}" aria-label="${esc(sText(l,'reroll'))}: ${esc(v.name)}">↻</button><button type="button" class="btn ghost nm-swap" data-nm-s="line-remove" data-nm-id="${id}" data-nm-line="${i}" aria-label="${esc(sText(l,'remove'))}: ${esc(v.name)}">✕</button></li>`}).join('');
 return `<details class="nm-saved-stall" data-nm-open="${id}"${sui.open.has(s.id)?' open':''}><summary><span data-nm-sum="${id}">${esc(nm)}</span> · ${esc(c[l])} · ${esc(sText(l,'lines',s.lines.length))}</summary><label class="field">${esc(sText(l,'name'))}<input type="text" maxlength="${MAX_STALL_NAME}" value="${esc(s.name)}" data-nm-sfield="name" data-nm-id="${id}" autocomplete="off"></label>${s.lines.length?`<ul class="nm-items nm-saved-items">${rows}</ul>`:`<p class="nm-note">${esc(sText(l,'empty'))}</p>`}${all.length&&s.lines.length<MAX_LINES?`<div class="nm-add"><label class="field">${esc(sText(l,'pick'))}<select data-nm-add-pick="${id}">${all.map(i=>`<option value="${esc(i.id)}">${esc(i.name[l]||i.name.en)} · ${esc(i.price)}eb</option>`).join('')}</select></label><button type="button" class="btn" data-nm-s="line-add" data-nm-id="${id}">${esc(sText(l,'add'))}</button></div>`:''}<div class="nm-actions">${btn('dup',sText(l,'dup'))}${btn('export',sText(l,'file'))}${btn('del',sText(l,'del'))}</div></details>`;
}
function previewHtml(list,l){
 const p=sui.preview;if(!p)return '';
 const plan=planImport(list,p),tag={new:'tagNew',update:'tagUpdate',same:'tagSame',overflow:'tagOverflow'};
 return `<div class="nm-preview" data-nm-preview role="group" aria-label="${esc(sText(l,'preview'))}"><p class="nm-rolls">${esc(sText(l,'preview'))}: ${esc(p.title||sText(l,'untitled'))}</p><p class="nm-note">${esc(sText(l,'plan',plan.added,plan.updated,plan.same))}</p>${p.rejected.length?`<p class="nm-note">${esc(sText(l,'rejected',p.rejected.length))}</p>`:''}<ul class="nm-plan">${plan.rows.slice(0,40).map(r=>`<li><span class="nm-tag nm-${r.status}">${esc(sText(l,tag[r.status]))}</span> ${esc(r.stall.name||sText(l,'unnamed'))} · ${esc(cat(r.stall.category)[l])}</li>`).join('')}</ul><div class="nm-actions"><button type="button" class="btn primary" data-nm-s="apply"${plan.added+plan.updated?'':' disabled'}>${esc(sText(l,'apply'))}</button><button type="button" class="btn ghost" data-nm-s="discard">${esc(sText(l,'discard'))}</button></div></div>`;
}
function savedHtml(l){
 if(!appState())return '';
 const list=saved();
 return `<div class="nm-saved" data-nm-saved><h3 class="nm-saved-title">${esc(sText(l,'title'))} · ${esc(sText(l,'count',list.length))}</h3><p class="nm-note">${esc(sText(l,'intro'))}</p>${list.length?list.map(s=>stallHtml(s,l)).join(''):`<p class="nm-note" role="status">${esc(sText(l,'none'))}</p>`}<div class="nm-actions"><button type="button" class="btn ghost" data-nm-s="export-all"${list.length?'':' disabled'}>${esc(sText(l,'allFile'))}</button><button type="button" class="btn ghost" data-nm-s="import">${esc(sText(l,'open'))}</button><input type="file" accept=".json,application/json" class="nm-hidden" data-nm-file tabindex="-1" aria-hidden="true" aria-label="${esc(sText(l,'import'))}"></div>${sui.fileError?`<p class="nm-note nm-error" role="alert">${esc(fileErr(l,sui.fileError))}</p>`:''}${previewHtml(list,l)}</div>`;
}
function download(raw,name){
 try{const blob=new Blob([raw],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);return true}catch{return false}
}
function exportStalls(list,title){
 if(!list.length)return false;
 return download(JSON.stringify(buildFile(list,title),null,2),'night-city-night-market-'+new Date().toISOString().slice(0,10)+'.json');
}
function setFocus(sel){if(!sel||typeof document==='undefined')return;try{document.querySelector(sel)?.focus?.({preventScroll:false})}catch{}}
const R='[data-nm-root] ';
function redraw(root,l,focus){if(root&&typeof root.outerHTML==='string'&&root.isConnected!==false)root.outerHTML=render(l);setFocus(focus)}
// Puts a changed list into storage; says why when it could not.
function applyList(r,l){
 if(!r.ok){say(sText(l,{full:'full',linesFull:'linesFull',noMore:'noMore',dup:'lineDup',badPrice:'badPrice',unknown:'unknown',stale:'stale',bad:'stale'}[r.key]||'stale'));return false}
 if(!commitStalls(r.list)){say(sText(l,'noStore'));return false}
 return true;
}
// An event of the saved-stalls part of the card. null means «not mine», so the generator's own handler goes on.
function handleSaved(e,root,lang,rng){
 const t=e.target,l=lang==='en'?'en':'ru',sel=(a,id,line)=>`${R}[data-nm-s="${a}"][data-nm-id="${id}"]${line===undefined?'':`[data-nm-line="${line}"]`}`;
 if(e.type==='change'){
  if(t.dataset?.nmFile!==undefined){
   const file=t.files?.[0];if(!file)return true;
   const show=()=>{const now=(typeof document!=='undefined'&&document.querySelector?.('[data-nm-root]'))||root;redraw(now,l,sui.fileError?R+'.nm-error':R+'[data-nm-preview] .btn')};
   if(Number(file.size)>MAX_FILE_CHARS*4){sui.preview=null;sui.fileError='size';show();return true}
   Promise.resolve().then(()=>file.text()).then(text=>{const p=parseFile(text);if(p.ok){sui.preview=p;sui.fileError=null}else{sui.preview=null;sui.fileError=p.reason}show()},()=>{sui.preview=null;sui.fileError='json';show()});
   return true;
  }
  const f=t.dataset?.nmSfield;if(!f)return null;
  const id=sidOf(t.dataset.nmId),line=Math.trunc(Number(t.dataset.nmLine)),list=saved();
  if(f==='name'){const r=renameStall(list,id,t.value);if(applyList(r,l)){const s=r.list.find(x=>x.id===id),n=root.querySelector?.(`[data-nm-sum="${id}"]`);if(n&&s)n.textContent=s.name||sText(l,'unnamed')}else redraw(root,l);return true}
  if(f==='price'){const r=setLinePrice(list,id,line,t.value);if(!applyList(r,l))redraw(root,l,`${R}[data-nm-sfield="price"][data-nm-id="${id}"][data-nm-line="${line}"]`);return true}
  return null;
 }
 if(e.type!=='click')return null;
 const b=t.closest?.('[data-nm-s]');if(!b||!b.dataset?.nmS||b.disabled)return null;
 const a=b.dataset.nmS,id=sidOf(b.dataset.nmId),line=Math.trunc(Number(b.dataset.nmLine)),list=saved();
 if(a==='save'){
  const s=stallFromMarket(market,int(b.dataset.nmStall,0,5,-1),l);
  if(!s){say(sText(l,'emptyStall'));return true}
  const r=keepStall(list,s);if(!applyList(r,l))return true;
  sui.open.add(s.id);say(sText(l,'saved',s.name));redraw(root,l,`${R}[data-nm-open="${s.id}"] summary`);return true;
 }
 if(a==='line-remove'){const r=removeLine(list,id,line);if(applyList(r,l))redraw(root,l,`${R}[data-nm-open="${id}"] summary`);else redraw(root,l);return true}
 if(a==='line-reroll'){const r=rerollLine(list,id,line,rng);if(applyList(r,l))redraw(root,l,sel('line-reroll',id,line));else redraw(root,l);return true}
 if(a==='line-add'){
  const pick=b.closest('[data-nm-open]')?.querySelector?.('[data-nm-add-pick]')||root.querySelector?.(`[data-nm-add-pick="${id}"]`),r=addLine(list,id,pick?.value);
  if(applyList(r,l))redraw(root,l,`${R}[data-nm-add-pick="${id}"]`);else redraw(root,l);return true;
 }
 if(a==='dup'){const r=duplicateStall(list,id,l);if(applyList(r,l)){const s=r.list.find(x=>x.id===r.id);sui.open.add(r.id);say(sText(l,'copied',s.name));redraw(root,l,`${R}[data-nm-open="${r.id}"] summary`)}return true}
 if(a==='del'){
  const r=deleteStall(list,id);if(!applyList(r,l))return true;
  sui.open.delete(id);const after=mark();
  sayUndo(sText(l,'deleted',r.name),l,()=>{
   if(mark()!==after){say(sText(l,'stale'));return}
   if(commitStalls(list)){say(sText(l,'restored',r.name));try{window.App?.render?.()}catch{}}
  });
  redraw(root,l,R+'[data-nm-s="import"]');return true;
 }
 if(a==='export'){const s=list.find(x=>x.id===id);if(s)exportStalls([s],s.name);return true}
 if(a==='export-all'){exportStalls(list,'');return true}
 if(a==='import'){root.querySelector?.('[data-nm-file]')?.click?.();return true}
 if(a==='discard'){sui.preview=null;redraw(root,l,R+'[data-nm-s="import"]');return true}
 if(a==='apply'){
  const p=sui.preview;sui.preview=null;if(!p){redraw(root,l);return true}
  const plan=planImport(list,p);
  if(plan.added+plan.updated>0&&commitStalls(plan.list)){
   const after=mark();
   sayUndo(sText(l,'imported',plan.added,plan.updated),l,()=>{if(mark()!==after){say(sText(l,'stale'));return}if(commitStalls(list)){try{window.App?.render?.()}catch{}}});
  }
  redraw(root,l,R+'[data-nm-s="import"]');return true;
 }
 return null;
}
function render(lang){
 const l=lang==='en'?'en':'ru',t=T[l];
 let html=`<section class="card night-market" data-nm-root data-lang="${l}"><div class="card-heading"><span>${esc(t.title)}</span><span>${esc(t.source)}</span></div><p class="nm-note">${esc(t.intro)}</p><div class="nm-grid"><label class="field">${esc(t.cats)}<select data-nm-field="categories">${[1,2,3,4,5,6].map(n=>opt(n,String(n),settings.categories)).join('')}</select></label><label class="field">${esc(t.items)}<select data-nm-field="items">${opt('d10',t.d10,settings.items)}${[1,2,3,4,5,6,7,8,9,10].map(n=>opt(n,String(n),settings.items)).join('')}</select></label><label class="field">${esc(t.cap)}<select data-nm-field="cap">${PRICE_TIERS.map(p=>opt(p.id,`${p[l]}${Number.isFinite(p.max)?' · ≤'+p.max+'eb':''}`,settings.cap)).join('')}</select></label></div><div class="nm-actions"><button type="button" class="btn primary" data-nm-action="generate">⬡ ${esc(t.generate)}</button><button class="rule-source" type="button" data-action="book-page" data-page="337">${esc(t.book)} ↗</button></div>`;
 if(!market)html+=`<p class="nm-note" role="status">${esc(t.empty)}</p>`;
 else{
  html+=`<p class="nm-rolls" role="status">${esc(t.rolls)}: ${market.rolls.map(n=>esc(n)).join(', ')}</p>`;
  html+=market.stalls.map((s,si)=>{const c=CATEGORIES.find(x=>x.id===s.category),items=s.items.map(byId).filter(Boolean);return `<div class="nm-stall"><div class="nm-stall-head"><strong>${esc(t.stall)} ${CATEGORIES.indexOf(c)+1}: ${esc(c[l])}</strong><span class="nm-stall-tools">${appState()?`<button type="button" class="btn ghost" data-nm-s="save" data-nm-stall="${si}" aria-label="${esc(sText(l,'save'))}: ${esc(c[l])}">${esc(sText(l,'save'))}</button>`:''}<button type="button" class="btn ghost" data-nm-action="stall" data-nm-stall="${si}">↻ ${esc(t.reroll)}</button></span></div>${items.length?`<ul class="nm-items">${items.map((i,ii)=>`<li><span class="nm-name">${esc(i.name[l]||i.name.en)}</span><span class="nm-price">${esc(i.price)}eb · ${esc(tierOf(i.price)[l].split(' (')[0])}</span><button class="rule-source" type="button" data-action="book-page" data-page="${esc(i.page)}">${esc(t.page)} ${esc(i.page)}</button>${window.GMTable?.giveButton?.({item:i.id,note:'market'},l)||''}<button type="button" class="btn ghost nm-swap" data-nm-action="item" data-nm-stall="${si}" data-nm-item="${ii}" aria-label="${esc(t.swap)}: ${esc(i.name[l]||i.name.en)}">↻</button></li>`).join('')}</ul>`:`<p class="nm-note">${esc(t.none)}</p>`}${items.length&&items.length<s.count?`<p class="nm-note">${esc(t.short)} ${items.length}.</p>`:''}</div>`}).join('');
  const plain=market.stalls.map(s=>{const c=CATEGORIES.find(x=>x.id===s.category);return `${c[l]}: ${s.items.map(byId).filter(Boolean).map(i=>`${i.name[l]||i.name.en} (${i.price}eb)`).join('; ')||'—'}`}).join('\n');
  html+=`<details class="nm-plain"><summary>${esc(t.list)}</summary><textarea readonly rows="5">${esc(plain)}</textarea></details>`;
 }
 return html+savedHtml(l)+`<p class="nm-note">${esc(t.note)}</p></section>`;
}
function readSettings(root){const v=f=>root.querySelector(`[data-nm-field="${f}"]`)?.value;const items=v('items');settings={categories:int(v('categories'),1,6,2),items:items==='d10'?'d10':int(items,1,10,5),cap:PRICE_TIERS.some(p=>p.id===v('cap'))?v('cap'):'superluxury'}}
function handle(e,lang,rng=Math.random){
 const root=e?.target?.closest?.('[data-nm-root]');if(!root)return false;
 {const done=handleSaved(e,root,lang||root.dataset?.lang,rng);if(done!==null)return done}
 if(e.type==='change'){if(!e.target.dataset?.nmField)return false;readSettings(root);return true}
 const b=e.type==='click'&&e.target.closest('[data-nm-action]');if(!b)return false;
 readSettings(root);const a=b.dataset.nmAction;
 if(a==='generate')market=generate(settings,rng);
 else if(a==='stall'){if(!market||!rerollStall(market,int(b.dataset.nmStall,0,5,-1),rng))return true}
 else if(a==='item'){if(!market||!rerollItem(market,int(b.dataset.nmStall,0,5,-1),int(b.dataset.nmItem,0,19,-1),rng))return true}
 else return false;
 storeMarket();
 const l=lang||root.dataset.lang;if(typeof root.outerHTML==='string'&&root.isConnected!==false)root.outerHTML=render(l);
 return true;
}
function reset(){market=null;settings={categories:2,items:'d10',cap:'superluxury'};storeMarket()}
// The generated market stays on this device between reloads, so prep done before the session is not lost.
const MARKET_KEY='nc-night-market-v1';
function storeMarket(){try{if(market)window.localStorage?.setItem(MARKET_KEY,JSON.stringify({v:1,market,settings}));else window.localStorage?.removeItem(MARKET_KEY)}catch(_){}}
function loadMarket(){const before={market,settings};try{const saved=JSON.parse(window.localStorage?.getItem(MARKET_KEY)||'null');if(!saved||saved.v!==1||!saved.market||typeof saved.market!=='object')return;market=saved.market;if(saved.settings&&typeof saved.settings==='object')settings={...settings,...saved.settings};if(typeof render('ru')!=='string')throw new Error('unreadable')}catch(_){market=before.market;settings=before.settings}}
loadMarket();
if(typeof document!=='undefined'&&document.addEventListener){for(const type of ['click','change'])document.addEventListener(type,e=>{handle(e)})}
if(typeof document!=='undefined'&&document.addEventListener)document.addEventListener('toggle',e=>{const el=e.target,id=el?.dataset?.nmOpen;if(!id||!el.matches?.('details'))return;if(el.open)sui.open.add(id);else sui.open.delete(id)},true);
window.NightMarket={tierLabel,CATEGORIES,PRICE_TIERS,MAX_STALLS,MAX_LINES,FORMAT,VERSION,STALLS_KEY,S,categoryOf,pool,tierOf,rollCategories,pickItems,generate,rerollItem,rerollStall,render,handle,reset,cleanStall,readStalls,writeStalls,stallFromMarket,keepStall,renameStall,removeLine,setLinePrice,rerollLine,addLine,duplicateStall,deleteStall,buildFile,parseFile,planImport,get ui(){return sui},get market(){return market}};
})();
