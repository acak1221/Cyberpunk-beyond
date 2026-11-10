/* Share a character as a link: the sheet is compressed into the part of the URL
   after #, which browsers never send to the server. Opening such a link asks
   before importing. Also draws QR codes (room invites) with a vendored MIT
   library that is loaded only when a QR code is needed. */
(function(global){
'use strict';
const doc=global.document,PREFIX='#/import/',te=new TextEncoder(),td=new TextDecoder();
const ru=()=>(doc.documentElement.lang||'ru')!=='en';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// A link may unpack to at most MAX_SHEET bytes of JSON, so a short crafted link cannot expand into megabytes.
const MAX_LINK=60000,MAX_SHEET=200000;
const T={ru:{damaged:'Ссылка на персонажа повреждена или обрезана.',tooBig:'Лист персонажа слишком большой для импорта.',noCharacter:'В ссылке нет персонажа.',title:'Импортировать персонажа?',titleSame:'Этот персонаж уже есть на устройстве',rank:'ранг',add:'Лист будет добавлен к вашим персонажам на этом устройстве.',inlink:'В ссылке',infile:'В файле',inroom:'От игрока',here:'На этом устройстве',newer:'новее',noTime:'время изменения неизвестно',
 incoming:s=>`Версия ${s==='file'?'в файле':s==='room'?'от игрока':'в ссылке'} новее: «Обновить» заменит ею лист на этом устройстве.`,local:s=>`Версия на этом устройстве новее. «Обновить» вернёт лист к более старой версии ${s==='file'?'из файла':s==='room'?'от игрока':'из ссылки'}. Нынешняя версия останется в удалённых персонажах на 30 дней.`,same:()=>'Это та же версия листа.',unknown:()=>'Неизвестно, какая версия новее: ни у одной из них не записано время изменения.',
 cancel:'Отмена',import:'Импортировать',update:'Обновить',copy:'Оставить обе',imported:'Персонаж импортирован.',updated:'Персонаж обновлён.',updatedKept:'Персонаж обновлён. Прежняя версия сохранена на 30 дней: «Персонажи» → «Удалённые персонажи».',copied:'Персонаж добавлен отдельным листом.',invalid:'Не удалось прочитать лист персонажа.',storage:'Не хватает места в браузере: персонаж не импортирован, ваши данные не изменились.',paused:'Редактирование приостановлено — персонаж не импортирован.',missing:'Лист на этом устройстве изменился. Повторите импорт.'},
 en:{damaged:'The character link is damaged or cut off.',tooBig:'The character sheet is too big to import.',noCharacter:'There is no character in this link.',title:'Import this character?',titleSame:'This character is already on this device',rank:'rank',add:'The sheet will be added to your characters on this device.',inlink:'In the link',infile:'In the file',inroom:'From the player',here:'On this device',newer:'newer',noTime:'edit time unknown',
 incoming:s=>`The version ${s==='room'?'from the player':'in the '+s} is newer: “Update” replaces the sheet on this device with it.`,local:s=>`The version on this device is newer. “Update” would roll the sheet back to the older version from the ${s==='room'?'player':s}. The current version stays in Deleted characters for 30 days.`,same:()=>'This is the same version of the sheet.',unknown:()=>'It is unknown which version is newer: neither has an edit time.',
 cancel:'Cancel',import:'Import',update:'Update',copy:'Keep both',imported:'Character imported.',updated:'Character updated.',updatedKept:'Character updated. The previous version is kept for 30 days: Characters → Deleted characters.',copied:'The character was added as a separate sheet.',invalid:'Could not read the character sheet.',storage:'Not enough browser storage: the character was not imported and your data is unchanged.',paused:'Editing is paused, so the character was not imported.',missing:'The sheet on this device changed. Import again.'}};
const t=k=>T[ru()?'ru':'en'][k];

function b64u(bytes){let s='';for(let i=0;i<bytes.length;i+=0x8000)s+=String.fromCharCode.apply(null,bytes.subarray(i,i+0x8000));return global.btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
function unb64u(s){const t=s.replace(/-/g,'+').replace(/_/g,'/');return Uint8Array.from(global.atob(t+'='.repeat((4-t.length%4)%4)),c=>c.charCodeAt(0))}
async function pipe(bytes,stream){return new Uint8Array(await new global.Response(new global.Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer())}

// 'z' = deflate-raw (all current browsers), 'j' = plain JSON fallback.
async function pack(obj){
 const json=te.encode(JSON.stringify(obj));
 if(global.CompressionStream){try{return 'z'+b64u(await pipe(json,new global.CompressionStream('deflate-raw')))}catch{}}
 return 'j'+b64u(json);
}
// Reads the decompressed stream piece by piece and stops as soon as it passes `limit` bytes. The packed bytes are handed over 1 KB
// at a time and only when asked for: given all at once, the browser unpacks everything before the first piece can be counted.
async function inflate(bytes,limit=MAX_SHEET){
 let at0=0;const source=new global.ReadableStream({pull(c){if(at0>=bytes.length)c.close();else c.enqueue(bytes.slice(at0,at0+=1024))}},{highWaterMark:0});
 const reader=source.pipeThrough(new global.DecompressionStream('deflate-raw')).getReader(),parts=[];let size=0;
 for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit){reader.cancel().catch(()=>{});throw Error('too_big')}parts.push(value)}
 const out=new Uint8Array(size);let at=0;for(const p of parts){out.set(p,at);at+=p.length}return out;
}
async function unpack(text){
 if(typeof text!=='string'||text.length>MAX_SHEET*4/3+4)throw Error('too_big');
 const kind=text[0],bytes=unb64u(text.slice(1));
 if(kind==='z'){if(!global.DecompressionStream)throw Error('no_decompress');return JSON.parse(td.decode(await inflate(bytes)))}
 if(kind==='j'){if(bytes.length>MAX_SHEET)throw Error('too_big');return JSON.parse(td.decode(bytes))}
 throw Error('bad_link');
}
// Pictures would make the link huge; the private import key is not shared.
function shareable(c){const copy=JSON.parse(JSON.stringify(c));if(copy.extra&&typeof copy.extra==='object'){delete copy.extra.portrait;delete copy.extra.portraitThumb;delete copy.extra.sourceKey}return copy}
function baseUrl(){return global.location.origin+global.location.pathname}
function payload(c){return {format:'nightcity-red-character',version:1,character:shareable(c)}}
async function link(c){return baseUrl()+PREFIX+await pack(payload(c))}

async function share(c){
 const App=global.App;if(!c)return;
 const data=payload(c),url=baseUrl()+PREFIX+await pack(data);
 if(url.length>MAX_LINK||te.encode(JSON.stringify(data)).length>MAX_SHEET){App?.notify?.(ru()?'Персонаж слишком большой для ссылки — используйте «Экспорт».':'This character is too big for a link — use Export.');return}
 if(global.navigator.share&&global.matchMedia?.('(pointer: coarse)').matches){try{await global.navigator.share({title:c.name||'Night City // RED',text:(ru()?'Персонаж для Cyberpunk RED: ':'Cyberpunk RED character: ')+(c.name||''),url});return}catch(e){if(e?.name==='AbortError')return}}
 try{await global.navigator.clipboard.writeText(url);App?.notify?.(ru()?'Ссылка на персонажа скопирована. Её можно открыть на другом устройстве — лист импортируется после подтверждения.':'Character link copied. Open it on another device to import the sheet after confirming.')}
 catch{global.prompt?.(ru()?'Ссылка на персонажа':'Character link',url)}
}

/* ---------- incoming links ---------- */
let pending=null;
function takeFromHash(){
 if(!global.location.hash.startsWith(PREFIX))return false;
 pending=global.location.hash.slice(PREFIX.length);
 // Drop the sheet from the address bar and history before the app reads the route.
 try{global.history.replaceState(null,'',global.location.pathname+global.location.search+'#/characters')}catch{global.location.hash='#/characters'}
 return true;
}
async function offerImport(){
 if(!pending||!global.App)return;
 const data=pending;pending=null;
 let obj;try{obj=await unpack(data)}catch(e){global.App.notify(t(e?.message==='too_big'?'tooBig':'damaged'));return}
 const c=obj?.format==='nightcity-red-character'?obj.character:obj;
 if(!c||typeof c!=='object'||Array.isArray(c)){global.App.notify(t('noCharacter'));return}
 return offer(c,{kind:'link'});
}
// A time more than five minutes ahead of this device's clock (a wrong clock or a crafted link) is not believed: it reads as unknown.
const editTime=c=>{const v=c?.extra?.updatedAt;return typeof v==='number'&&v>0&&v<=Date.now()+3e5?v:null};
// Text of a sheet that came from outside: anything that is not text or a number reads as empty.
const text=(v,n)=>(typeof v==='string'?v:typeof v==='number'?String(v):'').slice(0,n);
// Which copy was edited last: 'incoming', 'local', 'same', or 'unknown'. A sheet without an edit time has not been edited since
// edit times exist, so it counts as the older one; with neither time it is unknown.
function verdict(incoming,local){return incoming&&local?(incoming>local?'incoming':incoming<local?'local':'same'):incoming?'incoming':local?'local':'unknown'}
function roleName(id){const r=Array.isArray(global.ROLES)?global.ROLES.find(x=>x?.id===id):null;return r?.name?.[ru()?'ru':'en']||text(id,40)}
function when(ms){if(!ms)return t('noTime');try{return new Date(ms).toLocaleString(ru()?'ru-RU':'en-GB',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}catch{return new Date(ms).toISOString().slice(0,16).replace('T',' ')}}
function dialogHtml(c,match,kind){
 const stats=c.stats&&typeof c.stats==='object'?['INT','REF','DEX','TECH','COOL','WILL','LUCK','MOVE','BODY','EMP'].map(k=>`<span><small>${k}</small>${esc(Number(text(c.stats[k],8))||0)}</span>`).join(''):'';
 const head=`<h2>${t(match?'titleSame':'title')}</h2><p class="share-import-name"><b>${esc(text(c.name,80)||'—')}</b> · ${esc(roleName(c.role))}${Number(text(c.rank,4))?` · ${t('rank')} ${esc(Number(text(c.rank,4)))}`:''}</p><div class="share-import-stats">${stats}</div>`;
 if(!match)return `<form method="dialog">${head}<p class="muted">${t('add')}</p><div class="share-import-actions"><button value="cancel" class="btn ghost">${t('cancel')}</button><button value="new" class="btn primary">${t('import')}</button></div></form>`;
 const theirs=editTime(c),mine=match.updatedAt,v=verdict(theirs,mine),src=kind==='file'?'file':kind==='room'?'room':'link',name=text(match.name,80);
 const row=(label,ms,newer)=>`<div class="share-import-version${newer?' is-newer':''}"><span>${label}</span><b>${esc(when(ms))}</b>${newer?`<em>${t('newer')}</em>`:''}</div>`;
 return `<form method="dialog">${head}<div class="share-import-versions">${row(t('in'+src),theirs,v==='incoming')}${row(t('here')+(name&&name!==c.name?` · ${esc(ru()?'«'+name+'»':'“'+name+'”')}`:''),mine,v==='local')}</div><p class="share-import-verdict${v==='local'?' warn':''}">${esc(t(v)(src))}</p><div class="share-import-actions"><button value="cancel" class="btn ghost">${t('cancel')}</button><button value="copy" class="btn ghost">${t('copy')}</button><button value="update" class="btn ${v==='local'?'ghost':'primary'}">${t('update')}</button></div></form>`;
}
function finish(res,how,quiet){const App=global.App;if(res?.ok){if(!quiet)App.notify(t(how==='copy'?'copied':res.updated?(res.kept?'updatedKept':'updated'):'imported'))}else App.notify(t({too_big:'tooBig',storage:'storage',paused:'paused',missing:'missing'}[res?.reason]||'invalid'));return res}
// Which copy was edited last, for a sheet and the local match App.findImport found.
const compare=(c,match)=>verdict(editTime(c),match?.updatedAt);
// Asks before importing a sheet from a link. A sheet from a link or a file that is already on this device (same uid) is compared
// with the local one by edit time, and the player chooses: update it, keep both, or cancel. Resolves to the import result or null.
// kind 'room' is a sheet a player sent to the GM under `sourceKey`: it is not opened, the room reports the result itself (it gets
// {…result,how}), and the chosen sheet answers to that source from then on.
function offer(c,{kind='link',sourceKey:from=''}={}){
 const App=global.App;if(!App||!c||typeof c!=='object')return Promise.resolve(null);
 const room=kind==='room',open=!room,sourceKey=room?text(from,200):kind==='link'?'link:'+text(c.id||c.name,80):'',match=App.findImport?.(c,{sourceKey})||null;
 const done=(res,how,quiet)=>room?{...res,how}:finish(res,how,quiet);
 if(kind!=='link'&&!match)return Promise.resolve(done(App.importCharacter(c,room?{sourceKey}:{open}),'new',true));
 // A sheet whose fields are not what they should be must end in a notice, not in a dialog that never opens.
 let html;try{html=dialogHtml(c,match,kind)}catch{return Promise.resolve(done({ok:false,reason:'invalid'},'new'))}
 return new Promise(resolve=>{
  const dlg=doc.createElement('dialog');dlg.className='share-import';dlg.innerHTML=html;
  doc.body.appendChild(dlg);
  dlg.addEventListener('close',()=>{
   const how=dlg.returnValue;dlg.remove();
   const res=how==='new'?App.importCharacter(c,{sourceKey,open}):how==='update'&&match?App.importCharacter(c,{sourceKey,open,replace:match.id,rebind:room}):how==='copy'&&match?App.importCharacter(c,{open,copy:true,...(room&&match.by!=='source'?{sourceKey,rebind:true}:{})}):null;
   resolve(res?done(res,how):null);
  });
  if(typeof dlg.showModal==='function')dlg.showModal();
  else{const v=match?compare(c,match):'';dlg.returnValue=global.confirm(t(match?'titleSame':'title')+(match?'\n'+t(v)(kind==='file'?'file':room?'room':'link'):''))?(match?(v==='local'?'copy':'update'):'new'):'cancel';dlg.dispatchEvent(new Event('close'))}
 });
}
takeFromHash();
global.addEventListener('hashchange',()=>{if(takeFromHash())offerImport()});
if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',()=>setTimeout(offerImport,0));else setTimeout(offerImport,0);

/* ---------- QR codes ---------- */
let qrLib=null;
function loadQR(){
 if(global.qrcode)return Promise.resolve(global.qrcode);
 return qrLib||(qrLib=new Promise((resolve,reject)=>{const s=doc.createElement('script');s.src='vendor/qrcode/qrcode.js';s.onload=()=>global.qrcode?resolve(global.qrcode):reject(Error('qr'));s.onerror=()=>{qrLib=null;reject(Error('qr'))};doc.head.appendChild(s)}));
}
async function qrSvg(text,{label=''}={}){
 const lib=await loadQR(),qr=lib(0,'M');qr.addData(text);qr.make();
 const n=qr.getModuleCount(),m=4;let d='';
 for(let r=0;r<n;r++)for(let c=0;c<n;c++)if(qr.isDark(r,c))d+=`M${c+m} ${r+m}h1v1h-1z`;
 return `<svg class="qr" viewBox="0 0 ${n+2*m} ${n+2*m}" role="img" aria-label="${esc(label||'QR')}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}

global.ShareLink={share,link,pack,unpack,shareable,offer,compare,inflate,qrSvg,_test:{takeFromHash,b64u,unb64u,verdict,roleName,editTime,MAX_SHEET}};
})(window);
