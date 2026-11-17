/* Optional local Corebook reader. The PDF never leaves the browser. */
(function(){
let fileUrl='',filename='',page=1,currentFile=null;
// The book kept on this device (book-memory.js), only when the person asked for it: the opt-in flag, what is stored, a line of status.
let remember=false,rememberRead=false,memInfo=null,restoreStarted=false,hookSet=false,note='',lastRender=null,curLang='ru';
const t={ru:{title:'КНИГА ПРАВИЛ',lead:'Откройте свой PDF, чтобы сверять правила с оригиналом и переходить к страницам.',choose:'Выбрать PDF',replace:'Выбрать другой PDF',local:'Файл остаётся в вашем браузере и не загружается на сервер. После перезагрузки страницы его нужно выбрать снова — или включите ниже «Помнить мою книгу на этом устройстве».',localKept:'Файл остаётся в вашем браузере и не загружается на сервер. Эта книга сохранена на устройстве и откроется сама после перезагрузки.',empty:'Выберите Cyberpunk RED Corebook в формате PDF.',page:'Печатная страница',go:'Перейти',open:'Открыть в отдельной вкладке',offset:'Номера страниц соответствуют печатной книге; для вашего файла учитывается обложка.',unsupported:'Если просмотр PDF в браузере недоступен, откройте файл в отдельной вкладке.',invalid:'Выберите файл PDF.',pageTotal:'ПЕЧАТНАЯ СТРАНИЦА'},en:{title:'CORE RULEBOOK',lead:'Open your PDF to consult the original rules and jump to cited pages.',choose:'Choose PDF',replace:'Choose another PDF',local:'The file stays in your browser and is not uploaded. Select it again after reloading the page — or turn on “Remember my book on this device” below.',localKept:'The file stays in your browser and is not uploaded. This book is kept on the device and opens by itself after a reload.',empty:'Choose your Cyberpunk RED Corebook PDF.',page:'Printed page',go:'Go',open:'Open in a new tab',offset:'Page numbers refer to the printed book; the cover is accounted for in this PDF.',unsupported:'If your browser cannot preview this PDF, open it in a new tab.',invalid:'Choose a PDF file.',pageTotal:'PRINTED PAGE'}};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function viewURL(){return fileUrl+'#page='+(page+1)}
const BM=()=>window.BookMemory||null;
function readOptIn(){if(rememberRead)return;rememberRead=true;try{remember=!!BM()?.optedIn()}catch{remember=false}}
// Shown while the book screen is open: a stored book is read back once, and the size it takes is looked up.
function startRestore(){
 if(restoreStarted)return;restoreStarted=true;
 const bm=BM();if(!bm||!remember)return;
 bm.info().then(i=>{memInfo=i;rerender()});
 bm.load().then(rec=>{
  if(!rec||fileUrl)return;
  adopt(rec.blob,rec.name,rec.index);page=rec.page;note=bm.tx(curLang,'restored')+': '+rec.name;rerender();
 });
}
function adopt(blob,name,index){
 const typed=blob.type==='application/pdf'?blob:new Blob([blob],{type:'application/pdf'});
 window.BookSearch?.setFile(typed,index);
 if(fileUrl)URL.revokeObjectURL(fileUrl);fileUrl=URL.createObjectURL(typed);filename=name;currentFile=blob;
}
function hookIndex(){
 if(hookSet||!window.BookSearch?.setIndexHook)return;hookSet=true;
 window.BookSearch.setIndexHook(pages=>{const bm=BM();if(!remember||!currentFile||!bm)return;bm.saveIndex(pages).then(r=>{if(r.ok)return bm.info().then(i=>{memInfo=i;rerender()})})});
}
// Called after the screen has been drawn again from an event of this module, and when a stored book arrives.
function rerender(){if(!document.querySelector('[data-book-memory]'))return;try{(lastRender||window.App?.render)?.()}catch{}}
function say(lang,key,detail){note=BM()?BM().tx(lang,key)+(detail?': '+detail:''):''}
async function persist(file,lang){
 const bm=BM();if(!bm)return;
 const r=await bm.save(file);
 if(!r.ok){remember=false;bm.setOptIn(false);memInfo=null;
  // The earlier stored book is not the one on screen any more and nothing in the card could remove it now: erase it too.
  try{await bm.forget()}catch{}
  say(lang,r.reason==='big'?'big':'failed');rerender();return}
 const index=window.BookSearch?.getIndex?.();if(index)await bm.saveIndex(index);
 await bm.savePage(page);memInfo=await bm.info();say(lang,'saved');rerender();
}
function savePage(){if(remember&&fileUrl&&BM())BM().savePage(page)}
function render(lang,bookmarkContext){curLang=lang==='en'?'en':'ru';readOptIn();hookIndex();startRestore();const d=t[lang]||t.ru,keep=BM()?BM().card({remember,info:memInfo,supported:BM().supported(),lang,note}):'';return `<div class="page-header"><div><div class="overline">06 / ORIGINAL SOURCE</div><h1>${d.title}</h1><p>${d.lead}</p></div><label class="btn primary book-upload">↑ ${fileUrl?d.replace:d.choose}<input id="book-file" type="file" accept="application/pdf,.pdf" hidden></label></div><div class="book-hint"><span>✳</span><p>${remember&&memInfo?d.localKept:d.local}</p></div>${keep}<div class="book-toolbar"><label class="field">${d.page}<input id="book-page" type="number" min="1" max="457" value="${page}"></label><button class="btn ghost" data-book-action="go">${d.go} →</button>${fileUrl?`<span class="book-filename">${esc(filename)}</span><a class="btn ghost" href="${esc(viewURL())}" target="_blank" rel="noopener">${d.open} ↗</a>`:''}</div><p class="book-caption">${d.offset}</p>${window.BookToc?.render(lang)||''}${window.BookBookmarks?.render(bookmarkContext||{})||''}${fileUrl?(window.BookSearch?.render(lang)||''):''}${fileUrl?`<div class="book-frame"><iframe title="Cyberpunk RED Corebook" src="${esc(viewURL())}"></iframe></div><p class="book-caption">${d.unsupported}</p>`:`<div class="empty book-empty"><div class="empty-icon">▥</div><h3>${d.empty}</h3><label class="btn primary book-upload">↑ ${d.choose}<input id="book-file-empty" type="file" accept="application/pdf,.pdf" hidden></label><p>${d.local}</p></div>`}`}
function handle(e,lang,render,notify){if(window.BookSearch?.handle(e,lang))return true;const el=e.target,d=t[lang]||t.ru;if(e.type==='change'&&(el.id==='book-file'||el.id==='book-file-empty')){const file=el.files?.[0];if(!file)return true;if(file.type!=='application/pdf'&&!/\.pdf$/i.test(file.name)){notify(d.invalid);return true}window.BookSearch?.setFile(file);if(fileUrl)URL.revokeObjectURL(fileUrl);fileUrl=URL.createObjectURL(file);filename=file.name;currentFile=file;lastRender=render;note='';if(remember)persist(file,lang);render();return true}if(e.type==='change'&&el.id==='book-keep'){const bm=BM();if(!bm)return true;lastRender=render;note='';if(el.checked){remember=true;bm.setOptIn(true);if(currentFile)persist(currentFile,lang);else memInfo=null}else{remember=false;bm.setOptIn(false);memInfo=null;bm.forget().then(()=>{say(lang,'forgotten');rerender()})}render();document.querySelector('#book-keep')?.focus?.();return true}if(e.type==='click'&&el.closest('[data-book-action="forget"]')){if(typeof confirm==='function'&&!confirm(BM()?.tx(lang,'forgetConfirm')||''))return true;const bm=BM();lastRender=render;remember=false;memInfo=null;note='';bm?.setOptIn(false);bm?.forget().then(()=>{say(lang,'forgotten');rerender()});render();document.querySelector('#book-keep')?.focus?.();return true}if(e.type==='click'&&el.closest('[data-book-action="toc"]')){const b=el.closest('[data-book-action="toc"]');go(b.dataset.page);render();return true}if(e.type==='click'&&el.closest('[data-book-action="go"]')){page=Math.max(1,Math.min(457,Math.floor(Number(document.querySelector('#book-page')?.value)||1)));savePage();render();return true}return false}
function go(pageNumber){page=Math.max(1,Math.min(457,Math.floor(Number(pageNumber)||1)));savePage()}
window.Book={render,handle,go,getPage:()=>page,_test:{state:()=>({remember,fileUrl,filename,page,memInfo,note}),restore:()=>{restoreStarted=false;readOptIn();startRestore()}}};
})();
