/* Local-only PDF text search. No PDF bytes or search queries are sent to the server. */
(function(){
'use strict';
const W={ru:{title:'ПОИСК ПО КНИГЕ',query:'Текст для поиска',search:'Найти в PDF',cancel:'Остановить',start:'Поиск выполняется в выбранном PDF на вашем устройстве. Оригинальный текст книги — на английском.',busy:'Чтение страницы',ready:'Найдено страниц',none:'Совпадений не найдено.',need:'Введите запрос длиной от 2 до 120 символов.',error:'Не удалось прочитать текст PDF. Проверьте файл или попробуйте снова.',stopped:'Поиск остановлен.',page:'Страница',limit:'Показаны первые 100 страниц.',source:'Находки содержат извлечённый текст; расположение слов может отличаться от страницы.'},en:{title:'SEARCH THE BOOK',query:'Search text',search:'Search PDF',cancel:'Stop',start:'Search runs in the selected PDF on your device. The original book text is in English.',busy:'Reading page',ready:'Pages found',none:'No matches found.',need:'Enter a query between 2 and 120 characters.',error:'Unable to read PDF text. Check the file or try again.',stopped:'Search stopped.',page:'Page',limit:'Showing the first 100 pages.',source:'Results use extracted text; word order may differ from the page.'}};
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const normalize=x=>String(x??'').replace(/\s+/gu,' ').trim();
// Exact, curated translations of common game terms; other text is searched literally.
const aliases=Object.freeze({
 'автоматический огонь':'Autofire','очередь':'Autofire','подавляющий огонь':'Suppressive Fire',
 'броня':'armor','броню':'armor','укрытие':'cover','уклонение':'Evasion','уворот':'Evasion',
 'боевые искусства':'Martial Arts','рукопашный бой':'Brawling','захват':'Grapple','удушение':'Choke','бросок противника':'Throw',
 'атака':'attack','попадание':'hit','урон':'damage','ранение':'injury','критическое ранение':'Critical Injury',
 'критические ранения':'Critical Injuries','спасбросок от смерти':'Death Save','смертельное ранение':'Mortally Wounded',
 'тяжёлое ранение':'Seriously Wounded','тяжелое ранение':'Seriously Wounded','здоровье':'Hit Points','лечение':'healing',
 'первая помощь':'First Aid','киберпсихоз':'Cyberpsychosis','человечность':'Humanity','кибернетика':'Cyberware',
 'киберимпланты':'Cyberware','импланты':'Cyberware','киберрука':'Cyberarm','кибернога':'Cyberleg','киберглаз':'Cybereye',
 'нетраннинг':'Netrunning','нетраннер':'Netrunner','кибердека':'Cyberdeck','программа':'Program','архитектура сети':'NET Architecture',
 'оружие':'weapon','пистолет':'pistol','револьвер':'revolver','пистолет-пулемёт':'SMG','пистолет-пулемет':'SMG',
 'дробовик':'shotgun','штурмовая винтовка':'assault rifle','снайперская винтовка':'sniper rifle','гранатомёт':'grenade launcher',
 'гранатомет':'grenade launcher','граната':'grenade','ракета':'rocket','боеприпасы':'ammunition','патроны':'ammunition',
 'перезарядка':'reload','магазин оружия':'magazine','взрывчатка':'explosives','взрыв':'explosive','дробь':'shotgun shell',
 'навык':'skill','навыки':'skills','характеристика':'STAT','инициатива':'initiative','действие':'action','движение':'movement',
 'удача':'LUCK','телосложение':'BODY','эмпатия':'EMP','рефлексы':'REF','ловкость':'DEX','сила воли':'WILL',
 'транспорт':'vehicle','вождение':'driving','таран':'ramming','манёвр':'maneuver','маневр':'maneuver',
 'ремонт':'repair','изготовление':'fabrication','изобретение':'invention','улучшение':'upgrade','снаряжение':'gear',
 'образ жизни':'lifestyle','жильё':'housing','жилье':'housing','аренда':'rent','заработок':'Hustle','валюта':'eurobuck',
 'рокербой':'Rockerboy','соло':'Solo','техник':'Tech','медтех':'Medtech','медиа':'Media','корпорат':'Exec',
 'законник':'Lawman','фиксeр':'Fixer','фиксер':'Fixer','номад':'Nomad','персонаж':'character','ведущий':'GM'
});
// Only exact translated names are mapped. Multiple different English candidates remain literal.
// Normalizing ё and spacing around slashes lets users type the same Russian name naturally.
const lookupKey=x=>normalize(x).toLocaleLowerCase().replace(/ё/g,'е').replace(/\s*\/\s*/g,'/');
const aliasIndex=new Map();
for(const [ru,en] of Object.entries(aliases)){const k=lookupKey(ru),previous=aliasIndex.get(k);aliasIndex.set(k,previous===undefined||previous===en?en:null)}
const searchTerm=x=>{const q=normalize(x),key=lookupKey(q);if(aliasIndex.has(key))return aliasIndex.get(key)||q;const matches=new Map();
 const add=(ru,en)=>{if(typeof ru!=='string'||typeof en!=='string'||!normalize(ru)||!normalize(en)||lookupKey(ru)!==key)return;const text=normalize(en);matches.set(text.toLocaleLowerCase(),text)};
 for(const item of Array.isArray(window.CATALOG)?window.CATALOG:[])add(item?.name?.ru,item?.name?.en);
 for(const skill of Array.isArray(window.SKILL_REFERENCE)?window.SKILL_REFERENCE:[])add(skill?.ruName,skill?.name);
 for(const role of Array.isArray(window.ROLES)?window.ROLES:[])add(role?.name?.ru,role?.name?.en);
 for(const chapter of Array.isArray(window.BookToc?.chapters)?window.BookToc.chapters:[]){if(!Array.isArray(chapter))continue;add(chapter[1],chapter[2]);for(const section of Array.isArray(chapter[3])?chapter[3]:[])if(Array.isArray(section))add(section[1],section[2])}
 return matches.size===1?matches.values().next().value:q};
Object.assign(W.ru,{start:'Поиск работает на вашем устройстве. Точные русские названия навыков, ролей, разделов и предметов ищутся по английским соответствиям, если перевод однозначен; остальные запросы — буквально.',as:'Искать в оригинале'});
Object.assign(W.en,{start:'Search runs on your device. Exact Russian names of skills, roles, sections and equipment map to English when unambiguous; other queries are searched literally.',as:'Searched in the original as'});
Object.assign(W.ru,{previous:'Предыдущие',next:'Следующие',shown:'Показаны'});
Object.assign(W.en,{previous:'Previous',next:'Next',shown:'Showing'});
const RESULT_PAGE_SIZE=25;
async function loadPDF(bytes){const lib=await import('./vendor/pdfjs/pdf.min.mjs');lib.GlobalWorkerOptions.workerSrc=new URL('./vendor/pdfjs/pdf.worker.min.mjs',document.baseURI).href;return lib.getDocument({data:new Uint8Array(bytes),disableAutoFetch:true});}
function create(loader=loadPDF){let file=null,token=0,task=null,index=null,query='',term='',status={key:'start'},results=[],offset=0;
 function cancel(){token++;if(task?.destroy)Promise.resolve(task.destroy()).catch(()=>{});task=null;if(status.key==='busy')status={key:'stopped'};}
 function setFile(next){cancel();file=next;index=null;query='';term='';results=[];offset=0;status={key:'start'};}
 function snapshot(){return {query,term,status:{...status},offset,total:results.length,results:results.slice(offset,offset+RESULT_PAGE_SIZE).map(r=>({...r}))};}
 function move(delta){if(status.key!=='ready'||![-1,1].includes(delta))return false;const next=offset+delta*RESULT_PAGE_SIZE;if(next<0||next>=results.length)return false;offset=next;return true}
 async function search(input,onUpdate=()=>{}){cancel();query=normalize(input);term=searchTerm(query);results=[];offset=0;if(query.length<2||query.length>120||!file){status={key:'need'};onUpdate();return}let generation=++token;const active=()=>generation===token;try{
  if(!index){status={key:'busy',page:0,total:0};onUpdate();const bytes=await file.arrayBuffer();if(!active())return;const loading=await loader(bytes);if(!active()){await loading.destroy?.();return}task=loading;const pdf=await loading.promise;if(!active())return;const pages=[];
   for(let p=2;p<=pdf.numPages;p++){if(!active())return;const page=await pdf.getPage(p),content=await page.getTextContent();if(!active())return;pages.push({page:p-1,text:normalize(content.items.map(x=>x.str||'').join(' '))});page.cleanup?.();if(p%5===0||p===pdf.numPages){status={key:'busy',page:p-1,total:pdf.numPages-1};onUpdate()}}
   if(!active())return;await loading.destroy?.();if(!active())return;task=null;index=pages;
  }
  const needle=term.toLocaleLowerCase(),matches=[];for(const p of index){let at=p.text.toLocaleLowerCase().indexOf(needle);if(at<0)continue;matches.push({page:p.page,snippet:(at>55?'…':'')+p.text.slice(Math.max(0,at-55),Math.min(p.text.length,at+needle.length+115))+(at+needle.length+115<p.text.length?'…':'')});}
  if(!active())return;results=matches;status=matches.length?{key:'ready',count:matches.length}:{key:'none'};onUpdate();
 }catch{if(!active())return;const failed=task;task=null;if(failed?.destroy)Promise.resolve(failed.destroy()).catch(()=>{});index=null;status={key:'error'};onUpdate()}}
 return {setFile,cancel,search,snapshot,move};}
const engine=create();
function statusText(s,t,term,query){const alias=term&&term.toLocaleLowerCase()!==query.toLocaleLowerCase()?` · ${t.as}: ${term}`:'';if(s.key==='busy')return `${t.busy}: ${s.page}/${s.total||'…'}${alias}`;if(s.key==='ready')return `${t.ready}: ${s.count}${alias}`;return (t[s.key]||t.start)+(['none'].includes(s.key)?alias:'')}
function resultsHTML(s,t){return s.results.map(r=>`<article class="book-search-hit"><button type="button" class="rule-source" data-action="book-page" data-page="${r.page}">${esc(t.page)} ${r.page} ↗</button><p>${esc(r.snippet)}</p></article>`).join('')}
function paginationHTML(s,t){if(s.total<=RESULT_PAGE_SIZE||s.status.key!=='ready')return '';return `<div class="book-search-actions" aria-label="${esc(t.ready)}"><button type="button" class="btn ghost" data-bs-action="previous" ${s.offset===0?'disabled':''}>${esc(t.previous)}</button><span role="status">${esc(t.shown)} ${s.offset+1}–${s.offset+s.results.length} / ${s.total}</span><button type="button" class="btn ghost" data-bs-action="next" ${s.offset+s.results.length>=s.total?'disabled':''}>${esc(t.next)}</button></div>`}
function render(lang){const t=W[lang==='en'?'en':'ru'],s=engine.snapshot();return `<section class="card book-search" data-book-search><div class="card-heading"><span>${esc(t.title)}</span><span>LOCAL PDF</span></div><p>${esc(t.start)}</p><label class="field">${esc(t.query)}<input data-bs-query type="search" maxlength="120" value="${esc(s.query)}"></label><div class="book-search-actions"><button type="button" class="btn primary" data-bs-action="search">${esc(t.search)}</button><button type="button" class="btn ghost" data-bs-action="cancel">${esc(t.cancel)}</button></div><p data-bs-status role="status">${esc(statusText(s.status,t,s.term,s.query))}</p><p class="muted">${esc(t.source)}</p><div data-bs-results>${resultsHTML(s,t)}</div><div data-bs-pagination>${paginationHTML(s,t)}</div></section>`}
function update(lang){const root=document.querySelector('[data-book-search]');if(!root)return;const t=W[lang==='en'?'en':'ru'],s=engine.snapshot(),status=root.querySelector('[data-bs-status]'),hits=root.querySelector('[data-bs-results]'),pagination=root.querySelector('[data-bs-pagination]');if(status)status.textContent=statusText(s.status,t,s.term,s.query);if(hits)hits.innerHTML=resultsHTML(s,t);if(pagination)pagination.innerHTML=paginationHTML(s,t);}
function handle(event,lang){if(event.type==='keydown'&&event.key==='Enter'&&!event.isComposing&&event.target?.matches?.('[data-bs-query]')){const field=event.target,root=field.closest?.('[data-book-search]');if(!root||root.isConnected===false||field.isConnected===false)return true;event.preventDefault();engine.search(field.value||'',()=>update(document.documentElement.lang));return true}if(event.type!=='click')return false;const button=event.target?.closest?.('[data-bs-action]');if(!button)return false;const root=button.closest('[data-book-search]');if(!root||root.isConnected===false||button.isConnected===false)return false;if(button.dataset.bsAction==='cancel'){engine.cancel();update(lang);return true}if(button.dataset.bsAction==='search'){engine.search(root.querySelector('[data-bs-query]')?.value||'',()=>update(document.documentElement.lang));return true}if(button.dataset.bsAction==='previous'||button.dataset.bsAction==='next'){const direction=button.dataset.bsAction;engine.move(direction==='next'?1:-1);update(lang);const next=root.querySelector(`[data-bs-action="${direction}"]`),other=root.querySelector(`[data-bs-action="${direction==='next'?'previous':'next'}"]`);(next&&!next.disabled?next:other)?.focus?.();return true}return false}
window.BookSearch={setFile:engine.setFile,render,handle,create,normalize,searchTerm};
})();
