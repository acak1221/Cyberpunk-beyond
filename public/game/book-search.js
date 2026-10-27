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
const searchTerm=x=>{const q=normalize(x),key=q.toLocaleLowerCase();if(Object.hasOwn(aliases,key))return aliases[key];const matches=new Map();for(const item of Array.isArray(window.CATALOG)?window.CATALOG:[]){const ru=item?.name?.ru,en=item?.name?.en;if(typeof ru!=='string'||typeof en!=='string'||!normalize(en)||normalize(ru).toLocaleLowerCase()!==key)continue;const text=normalize(en);matches.set(text.toLocaleLowerCase(),text)}return matches.size===1?matches.values().next().value:q};
Object.assign(W.ru,{start:'Поиск работает на вашем устройстве. Распространённые русские термины и точные названия из каталога ищутся по английским соответствиям; остальные запросы — буквально.',as:'Искать в оригинале'});
Object.assign(W.en,{start:'Search runs on your device. Common Russian terms and exact catalog names map to English; other queries are searched literally.',as:'Searched in the original as'});
async function loadPDF(bytes){const lib=await import('./vendor/pdfjs/pdf.min.mjs');lib.GlobalWorkerOptions.workerSrc=new URL('./vendor/pdfjs/pdf.worker.min.mjs',document.baseURI).href;return lib.getDocument({data:new Uint8Array(bytes),disableAutoFetch:true});}
function create(loader=loadPDF){let file=null,token=0,task=null,index=null,query='',term='',status={key:'start'},results=[];
 function cancel(){token++;if(task?.destroy)Promise.resolve(task.destroy()).catch(()=>{});task=null;if(status.key==='busy')status={key:'stopped'};}
 function setFile(next){cancel();file=next;index=null;query='';term='';results=[];status={key:'start'};}
 function snapshot(){return {query,term,status:{...status},results:results.map(r=>({...r}))};}
 async function search(input,onUpdate=()=>{}){cancel();query=normalize(input);term=searchTerm(query);results=[];if(query.length<2||query.length>120||!file){status={key:'need'};onUpdate();return}let generation=++token;const active=()=>generation===token;try{
  if(!index){status={key:'busy',page:0,total:0};onUpdate();const bytes=await file.arrayBuffer();if(!active())return;const loading=await loader(bytes);if(!active()){await loading.destroy?.();return}task=loading;const pdf=await loading.promise;if(!active())return;const pages=[];
   for(let p=2;p<=pdf.numPages;p++){if(!active())return;const page=await pdf.getPage(p),content=await page.getTextContent();if(!active())return;pages.push({page:p-1,text:normalize(content.items.map(x=>x.str||'').join(' '))});page.cleanup?.();if(p%5===0||p===pdf.numPages){status={key:'busy',page:p-1,total:pdf.numPages-1};onUpdate()}}
   if(!active())return;await loading.destroy?.();if(!active())return;task=null;index=pages;
  }
  const needle=term.toLocaleLowerCase(),matches=[];for(const p of index){let at=p.text.toLocaleLowerCase().indexOf(needle);if(at<0)continue;matches.push({page:p.page,snippet:(at>55?'…':'')+p.text.slice(Math.max(0,at-55),Math.min(p.text.length,at+needle.length+115))+(at+needle.length+115<p.text.length?'…':'')});}
  if(!active())return;results=matches.slice(0,100);status=matches.length?{key:'ready',count:matches.length}:{key:'none'};onUpdate();
 }catch{if(!active())return;const failed=task;task=null;if(failed?.destroy)Promise.resolve(failed.destroy()).catch(()=>{});index=null;status={key:'error'};onUpdate()}}
 return {setFile,cancel,search,snapshot};}
const engine=create();
function statusText(s,t,term,query){const alias=term&&term.toLocaleLowerCase()!==query.toLocaleLowerCase()?` · ${t.as}: ${term}`:'';if(s.key==='busy')return `${t.busy}: ${s.page}/${s.total||'…'}${alias}`;if(s.key==='ready')return `${t.ready}: ${s.count}${s.count>100?' · '+t.limit:''}${alias}`;return (t[s.key]||t.start)+(['none'].includes(s.key)?alias:'')}
function resultsHTML(s,t){return s.results.map(r=>`<article class="book-search-hit"><button type="button" class="rule-source" data-action="book-page" data-page="${r.page}">${esc(t.page)} ${r.page} ↗</button><p>${esc(r.snippet)}</p></article>`).join('')}
function render(lang){const t=W[lang==='en'?'en':'ru'],s=engine.snapshot();return `<section class="card book-search" data-book-search><div class="card-heading"><span>${esc(t.title)}</span><span>LOCAL PDF</span></div><p>${esc(t.start)}</p><label class="field">${esc(t.query)}<input data-bs-query type="search" maxlength="120" value="${esc(s.query)}"></label><div class="book-search-actions"><button type="button" class="btn primary" data-bs-action="search">${esc(t.search)}</button><button type="button" class="btn ghost" data-bs-action="cancel">${esc(t.cancel)}</button></div><p data-bs-status role="status">${esc(statusText(s.status,t,s.term,s.query))}</p><p class="muted">${esc(t.source)}</p><div data-bs-results>${resultsHTML(s,t)}</div></section>`}
function update(lang){const root=document.querySelector('[data-book-search]');if(!root)return;const t=W[lang==='en'?'en':'ru'],s=engine.snapshot(),status=root.querySelector('[data-bs-status]'),hits=root.querySelector('[data-bs-results]');if(status)status.textContent=statusText(s.status,t,s.term,s.query);if(hits)hits.innerHTML=resultsHTML(s,t);}
function handle(event,lang){if(event.type!=='click')return false;const button=event.target?.closest?.('[data-bs-action]');if(!button)return false;const root=button.closest('[data-book-search]');if(!root)return false;if(button.dataset.bsAction==='cancel'){engine.cancel();update(lang);return true}if(button.dataset.bsAction==='search'){engine.search(root.querySelector('[data-bs-query]')?.value||'',()=>update(document.documentElement.lang));return true}return false}
window.BookSearch={setFile:engine.setFile,render,handle,create,normalize,searchTerm};
})();
