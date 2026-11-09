/* Share a character as a link: the sheet is compressed into the part of the URL
   after #, which browsers never send to the server. Opening such a link asks
   before importing. Also draws QR codes (room invites) with a vendored MIT
   library that is loaded only when a QR code is needed. */
(function(global){
'use strict';
const doc=global.document,PREFIX='#/import/',te=new TextEncoder(),td=new TextDecoder();
const ru=()=>(doc.documentElement.lang||'ru')!=='en';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const MAX_LINK=60000;

function b64u(bytes){let s='';for(let i=0;i<bytes.length;i+=0x8000)s+=String.fromCharCode.apply(null,bytes.subarray(i,i+0x8000));return global.btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
function unb64u(s){const t=s.replace(/-/g,'+').replace(/_/g,'/');return Uint8Array.from(global.atob(t+'='.repeat((4-t.length%4)%4)),c=>c.charCodeAt(0))}
async function pipe(bytes,stream){return new Uint8Array(await new global.Response(new global.Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer())}

// 'z' = deflate-raw (all current browsers), 'j' = plain JSON fallback.
async function pack(obj){
 const json=te.encode(JSON.stringify(obj));
 if(global.CompressionStream){try{return 'z'+b64u(await pipe(json,new global.CompressionStream('deflate-raw')))}catch{}}
 return 'j'+b64u(json);
}
async function unpack(text){
 const kind=text[0],bytes=unb64u(text.slice(1));
 if(kind==='z'){if(!global.DecompressionStream)throw Error('no_decompress');return JSON.parse(td.decode(await pipe(bytes,new global.DecompressionStream('deflate-raw'))))}
 if(kind==='j')return JSON.parse(td.decode(bytes));
 throw Error('bad_link');
}
// Pictures would make the link huge; the private import key is not shared.
function shareable(c){const copy=JSON.parse(JSON.stringify(c));if(copy.extra&&typeof copy.extra==='object'){delete copy.extra.portrait;delete copy.extra.portraitThumb;delete copy.extra.sourceKey}return copy}
function baseUrl(){return global.location.origin+global.location.pathname}
async function link(c){return baseUrl()+PREFIX+await pack({format:'nightcity-red-character',version:1,character:shareable(c)})}

async function share(c){
 const App=global.App;if(!c)return;
 const url=await link(c);
 if(url.length>MAX_LINK){App?.notify?.(ru()?'Персонаж слишком большой для ссылки — используйте «Экспорт».':'This character is too big for a link — use Export.');return}
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
 let obj;try{obj=await unpack(data)}catch{global.App.notify(ru()?'Ссылка на персонажа повреждена или обрезана.':'The character link is damaged or cut off.');return}
 const c=obj?.format==='nightcity-red-character'?obj.character:obj;
 if(!c||typeof c!=='object'||Array.isArray(c)){global.App.notify(ru()?'В ссылке нет персонажа.':'There is no character in this link.');return}
 const dlg=doc.createElement('dialog');dlg.className='share-import';
 const stats=c.stats&&typeof c.stats==='object'?['INT','REF','DEX','TECH','COOL','WILL','LUCK','MOVE','BODY','EMP'].map(k=>`<span><small>${k}</small>${esc(Number(c.stats[k])||0)}</span>`).join(''):'';
 dlg.innerHTML=`<form method="dialog"><h2>${ru()?'Импортировать персонажа?':'Import this character?'}</h2><p class="share-import-name"><b>${esc(String(c.name||'—').slice(0,80))}</b> · ${esc(String(c.role||'').slice(0,20))}${c.rank?` · ${ru()?'ранг':'rank'} ${esc(Number(c.rank)||0)}`:''}</p><div class="share-import-stats">${stats}</div><p class="muted">${ru()?'Лист будет добавлен к вашим персонажам на этом устройстве. Если вы уже открывали эту ссылку, лист обновится.':'The sheet will be added to your characters on this device. If you opened this link before, the sheet is updated.'}</p><div class="share-import-actions"><button value="cancel" class="btn ghost">${ru()?'Отмена':'Cancel'}</button><button value="ok" class="btn primary">${ru()?'Импортировать':'Import'}</button></div></form>`;
 doc.body.appendChild(dlg);
 dlg.addEventListener('close',()=>{
  if(dlg.returnValue==='ok'){const res=global.App.importCharacter(c,{sourceKey:'link:'+String(c.id||c.name||'').slice(0,80),open:true});global.App.notify(res?.ok?(res.updated?(ru()?'Персонаж обновлён.':'Character updated.'):(ru()?'Персонаж импортирован.':'Character imported.')):(ru()?'Не удалось прочитать лист персонажа.':'Could not read the character sheet.'))}
  dlg.remove();
 });
 if(typeof dlg.showModal==='function')dlg.showModal();else if(global.confirm(ru()?'Импортировать персонажа?':'Import this character?')){dlg.returnValue='ok';dlg.dispatchEvent(new Event('close'))}
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

global.ShareLink={share,link,pack,unpack,shareable,qrSvg,_test:{takeFromHash,b64u,unb64u}};
})(window);
