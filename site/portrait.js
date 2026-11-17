/* Character portraits: an image chosen by the player, cropped to a square and
   compressed in the browser. Stored on the character (extra.portrait, plus a tiny
   extra.portraitThumb for online rooms), so it travels with exports and backups. */
(function(global){
'use strict';
const doc=global.document;
const FULL=320,THUMB=72,MAX_FILE=20*1024*1024;
const T={ru:{upload:'Загрузить портрет',change:'Сменить портрет',avatar:'Создать аватар',remove:'Убрать',removeConfirm:'Убрать портрет персонажа?',bad:'Не удалось прочитать изображение. Выберите JPG, PNG или WebP.',big:'Файл слишком большой (больше 20 МБ).',saved:'Портрет сохранён.',replaced:'Портрет заменён.',removed:'Портрет убран.',undo:'Отменить',recrop:'Кадрировать',alt:'Портрет персонажа',
  cropTitle:'Кадрирование портрета',cropHelp:'Перетащите изображение, чтобы сдвинуть его. Масштаб меняется ползунком, щипком или клавишами «+» и «−». Стрелки сдвигают кадр.',cropArea:'Область кадрирования портрета',zoom:'Масштаб',zoomIn:'Увеличить',zoomOut:'Уменьшить',save:'Сохранить',cancel:'Отмена',
  avatarTitle:'Создать аватар',avatarHelp:'Рисунок строится из имени и роли персонажа. Нажмите «Другой узор», чтобы получить новый вариант.',avatarArea:'Предпросмотр аватара',shuffle:'Другой узор',stale:'Лист персонажа изменился, портрет не сохранён.'},
 en:{upload:'Upload portrait',change:'Change portrait',avatar:'Create avatar',remove:'Remove',removeConfirm:'Remove the character portrait?',bad:'Could not read the image. Choose a JPG, PNG or WebP file.',big:'The file is too large (over 20 MB).',saved:'Portrait saved.',replaced:'Portrait replaced.',removed:'Portrait removed.',undo:'Undo',recrop:'Adjust crop',alt:'Character portrait',
  cropTitle:'Crop portrait',cropHelp:'Drag the image to move it. Change the scale with the slider, a pinch, or the + and - keys. Arrow keys move the frame.',cropArea:'Portrait crop area',zoom:'Zoom',zoomIn:'Zoom in',zoomOut:'Zoom out',save:'Save',cancel:'Cancel',
  avatarTitle:'Create avatar',avatarHelp:'The picture is built from the character name and role. Press Another pattern for a new variant.',avatarArea:'Avatar preview',shuffle:'Another pattern',stale:'The character sheet changed, the portrait was not saved.'}};
const lang=()=>global.App?.lang?.()==='en'?'en':'ru';
const t=k=>T[lang()][k];
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// Only inline raster images are ever placed in an <img src>; nothing else is accepted.
function valid(src,max=200000){return typeof src==='string'&&src.length<=max&&/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(src)}
function src(c){const p=c?.extra?.portrait;return valid(p)?p:''}
function thumb(c){const p=c?.extra?.portraitThumb;return valid(p,16000)?p:''}
function html(c,cls,{small=false}={}){const s=small?(thumb(c)||src(c)):src(c);return s?`<img class="${esc(cls)}" src="${s}" alt="${esc(t('alt'))}" loading="lazy" decoding="async">`:''}
function editor(c){
 const s=src(c),initial=esc((c?.name||'?').trim().slice(0,1).toUpperCase()||'?');
 return `<div class="portrait-box"><div class="portrait-frame">${s?`<img src="${s}" alt="${esc(t('alt'))}">`:`<span aria-hidden="true">${initial}</span>`}</div><div class="portrait-actions"><button type="button" class="portrait-button" data-portrait-pick>${esc(s?t('change'):t('upload'))}</button><input type="file" accept="image/jpeg,image/png,image/webp,image/*" data-portrait-file hidden tabindex="-1" aria-hidden="true">${s?`<button type="button" class="portrait-button" data-portrait-recrop>${esc(t('recrop'))}</button>`:''}<button type="button" class="portrait-button" data-portrait-avatar>${esc(t('avatar'))}</button>${s?`<button type="button" class="portrait-button subtle" data-portrait-remove>${esc(t('remove'))}</button>`:''}</div></div>`;
}

// ---------- Pure crop maths. The view is a square window onto the image: zoom 1 shows the largest
// square that fits, zoom 4 shows a quarter of that side. The window is described by its centre. ----------
const MAXZ=4,BG='#1f1d1c',BIAS=0.3,ZSTEP=0.25; // ZSTEP: one press of + / - and of the zoom buttons
const fin=(n,d=0)=>Number.isFinite(n)?n:d;
const clamp=(n,lo,hi)=>hi<lo?(lo+hi)/2:Math.min(hi,Math.max(lo,n));
function clampZoom(z){return Math.min(MAXZ,Math.max(1,fin(z,1)))}
function sideOf(iw,ih,zoom){return Math.min(iw,ih)/clampZoom(zoom)}
function fit(iw,ih,zoom,cx,cy){
 const s=sideOf(iw,ih,zoom);
 return {zoom:clampZoom(zoom),cx:clamp(fin(cx,iw/2),s/2,iw-s/2),cy:clamp(fin(cy,ih/2),s/2,ih-s/2)};
}
// First view: the whole short side, nudged up like before so faces in tall photos are not cut off.
function initial(iw,ih){
 const side=Math.min(iw,ih),sy=Math.max(0,(ih-side)*BIAS);
 return fit(iw,ih,1,iw/2,sy+side/2);
}
function rect(iw,ih,st){
 const f=fit(iw,ih,st?.zoom,st?.cx,st?.cy),side=sideOf(iw,ih,f.zoom);
 return {sx:f.cx-side/2,sy:f.cy-side/2,side};
}
// A drag of dx,dy pixels on a view `view` pixels wide moves the image with the finger.
function panBy(iw,ih,st,dx,dy,view){
 const f=fit(iw,ih,st?.zoom,st?.cx,st?.cy),k=sideOf(iw,ih,f.zoom)/Math.max(1,fin(view,1));
 return fit(iw,ih,f.zoom,f.cx-fin(dx)*k,f.cy-fin(dy)*k);
}
function zoomTo(iw,ih,st,zoom){const f=fit(iw,ih,st?.zoom,st?.cx,st?.cy);return fit(iw,ih,zoom,f.cx,f.cy)}
function pinchZoom(startZoom,startDist,dist){return startDist>0&&dist>0?clampZoom(fin(startZoom,1)*dist/startDist):clampZoom(startZoom)}
// dx,dy are fractions of the view side that the image moves; dz is a zoom step.
function keyStep(key,shift){
 const k=shift?0.2:0.05;
 if(key==='ArrowLeft')return {dx:-k,dy:0,dz:0};
 if(key==='ArrowRight')return {dx:k,dy:0,dz:0};
 if(key==='ArrowUp')return {dx:0,dy:-k,dz:0};
 if(key==='ArrowDown')return {dx:0,dy:k,dz:0};
 if(key==='+'||key==='=')return {dx:0,dy:0,dz:ZSTEP};
 if(key==='-'||key==='_')return {dx:0,dy:0,dz:-ZSTEP};
 return null;
}
// An arrow moves the frame over the picture (the picture content moves the other way).
function applyKey(iw,ih,st,key,shift){
 const s=keyStep(key,shift);if(!s)return null;
 const f=fit(iw,ih,st?.zoom,st?.cx,st?.cy),side=sideOf(iw,ih,f.zoom);
 return fit(iw,ih,f.zoom+s.dz,f.cx+s.dx*side,f.cy+s.dy*side);
}
// Paints the chosen square on a flat neutral fill first: a transparent PNG or WebP
// would otherwise turn black when the result is saved as JPEG.
function paint(ctx,img,r,size){
 ctx.fillStyle=BG;ctx.fillRect(0,0,size,size);
 ctx.drawImage(img,r.sx,r.sy,r.side,r.side,0,0,size,size);
}

// ---------- Generated avatars: code-drawn pattern behind a role glyph, seeded so one name and role always give the same picture ----------
function hash(str){let h=2166136261>>>0;const s=String(str??'');for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)>>>0}return h>>>0}
function rng(seed){let a=seed>>>0;return()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296}}
const PATTERNS=['stripes','dots','tri','rings'];
// Glyphs live in a 0..100 box: p = polyline (closed when z), c = circle [x,y,r].
const GLYPHS={
 rockerboy:[{p:[[58,8],[30,56],[50,56],[42,92],[72,40],[52,40]],z:1}],
 solo:[{c:[50,50,30]},{c:[50,50,6]},{p:[[50,6],[50,30]]},{p:[[50,70],[50,94]]},{p:[[6,50],[30,50]]},{p:[[70,50],[94,50]]}],
 netrunner:[{p:[[50,8],[88,30],[88,70],[50,92],[12,70],[12,30]],z:1},{c:[50,50,10]},{p:[[50,40],[50,18]]},{p:[[41,55],[24,64]]},{p:[[59,55],[76,64]]}],
 tech:[{p:[[50,10],[84,30],[84,70],[50,90],[16,70],[16,30]],z:1},{c:[50,50,14]}],
 medtech:[{p:[[38,10],[62,10],[62,38],[90,38],[90,62],[62,62],[62,90],[38,90],[38,62],[10,62],[10,38],[38,38]],z:1}],
 media:[{p:[[8,50],[30,26],[70,26],[92,50],[70,74],[30,74]],z:1},{c:[50,50,15]},{c:[50,50,4]}],
 lawman:[{p:[[50,6],[61,38],[95,38],[67,58],[78,92],[50,71],[22,92],[33,58],[5,38],[39,38]],z:1}],
 exec:[{p:[[28,10],[72,10],[60,44],[72,92],[50,80],[28,92],[40,44]],z:1}],
 fixer:[{c:[50,50,38]},{p:[[50,24],[50,76]]},{p:[[34,38],[66,38]]},{p:[[34,62],[66,62]]}],
 nomad:[{c:[50,50,38]},{c:[50,50,9]},{p:[[50,12],[50,41]]},{p:[[16,68],[42,56]]},{p:[[84,68],[58,56]]}]
};
const GENERIC=[{c:[50,50,34]},{c:[50,50,8]}];
const has=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
function glyphOf(role){return typeof role==='string'&&has(GLYPHS,role)?GLYPHS[role]:GENERIC}
function seedOf(c,variant){return [c?.id||'',c?.name||'',c?.role||'',variant|0].join('|')}
// Everything random is decided here, so the drawing itself is a plain replay of this description.
function spec(seed,role){
 const r=rng(hash(seed)),hue=Math.floor(r()*360),hue2=(hue+30+Math.floor(r()*90))%360;
 const pattern=PATTERNS[Math.floor(r()*PATTERNS.length)],items=[];
 const n=pattern==='rings'?4:pattern==='stripes'?7:12;
 for(let i=0;i<n;i++)items.push({a:r(),b:r(),c:r()});
 return {hue,bg:[`hsl(${hue},45%,16%)`,`hsl(${hue2},50%,10%)`],tone:`hsl(${hue},60%,34%)`,glyphColor:`hsl(${hue},85%,72%)`,pattern,items,glyph:typeof role==='string'&&has(GLYPHS,role)?role:'',tilt:Math.floor(r()*40)-20};
}
function draw(ctx,sp,size){
 const g=ctx.createLinearGradient?.(0,0,size,size);
 if(g){g.addColorStop(0,sp.bg[0]);g.addColorStop(1,sp.bg[1]);ctx.fillStyle=g}else ctx.fillStyle=sp.bg[0];
 ctx.fillRect(0,0,size,size);
 ctx.globalAlpha=0.55;ctx.fillStyle=sp.tone;ctx.strokeStyle=sp.tone;ctx.lineWidth=Math.max(1,size/60);
 for(const it of sp.items){
  if(sp.pattern==='stripes'){const x=it.a*size*1.6-size*0.3,w=it.b*size*0.12+size*0.03;ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x-size*0.5+sp.tilt,size);ctx.lineTo(x-size*0.5+sp.tilt+w,size);ctx.lineTo(x+w,0);ctx.closePath();ctx.fill()}
  else if(sp.pattern==='dots'){ctx.beginPath();ctx.arc(it.a*size,it.b*size,size*(0.02+it.c*0.07),0,Math.PI*2);ctx.fill()}
  else if(sp.pattern==='tri'){const x=it.a*size,y=it.b*size,w=size*(0.1+it.c*0.2);ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+w,y+w*0.6);ctx.lineTo(x-w*0.3,y+w);ctx.closePath();ctx.fill()}
  else{ctx.beginPath();ctx.arc(size*(0.2+it.a*0.6),size*(0.2+it.b*0.6),size*(0.1+it.c*0.35),0,Math.PI*2);ctx.stroke()}
 }
 ctx.globalAlpha=1;
 const k=size*0.62/100,ox=size*0.19,oy=size*0.19;
 ctx.strokeStyle=sp.glyphColor;ctx.lineWidth=Math.max(2,size*0.035);ctx.lineJoin='round';ctx.lineCap='round';
 for(const sh of glyphOf(sp.glyph)){
  ctx.beginPath();
  if(sh.c){ctx.arc(ox+sh.c[0]*k,oy+sh.c[1]*k,sh.c[2]*k,0,Math.PI*2)}
  else{sh.p.forEach(([x,y],i)=>i?ctx.lineTo(ox+x*k,oy+y*k):ctx.moveTo(ox+x*k,oy+y*k));if(sh.z)ctx.closePath()}
  ctx.stroke();
 }
}

// ---------- Saving ----------
function loadImage(file){
 if(global.createImageBitmap)return global.createImageBitmap(file).catch(()=>viaElement(file));
 return viaElement(file);
}
function decode(url,revoke){return new Promise((resolve,reject)=>{const img=new Image(),done=()=>{if(revoke)URL.revokeObjectURL(url)};img.onload=()=>{done();resolve(img)};img.onerror=()=>{done();reject(Error('decode'))};img.src=url})}
function viaElement(file){return decode(URL.createObjectURL(file),true)}
function render(size,quality,fn){
 const canvas=doc.createElement('canvas');canvas.width=size;canvas.height=size;
 const ctx=canvas.getContext('2d');ctx.imageSmoothingQuality='high';fn(ctx,size);
 return canvas.toDataURL('image/jpeg',quality);
}
// Errors go inside an open dialog (the page notice would sit under its backdrop).
function say(msg){
 const box=dlg?.el?.querySelector?.('[data-portrait-error]');
 if(box){box.textContent=msg;box.hidden=false;return}
 global.App?.notify?.(msg);
}
function snapshot(c){return {p:c?.extra?.portrait,t:c?.extra?.portraitThumb}}
function restore(c,prev){
 if(global.App.active()!==c)return;
 c.extra=c.extra&&typeof c.extra==='object'?c.extra:{};
 if(prev.p)c.extra.portrait=prev.p;else delete c.extra.portrait;
 if(prev.t)c.extra.portraitThumb=prev.t;else delete c.extra.portraitThumb;
 global.App.save();global.App.render();focusEditor('[data-portrait-pick]');
}
function announce(msg,c,prev){
 const A=global.App;
 if(typeof A.notifyAction==='function')A.notifyAction(msg,t('undo'),()=>restore(c,prev));else A.notify(msg);
}
// `fn(ctx,size)` paints one square picture; the same painter makes the full image and the small one.
function commit(c,fn){
 let full=render(FULL,0.82,fn);
 if(!valid(full))full=render(FULL,0.6,fn);
 if(!valid(full)){say(t('bad'));return false}
 if(global.App.active()!==c){say(t('stale'));return false}
 const small=render(THUMB,0.7,fn),prev=snapshot(c);
 c.extra=c.extra&&typeof c.extra==='object'?c.extra:{};
 c.extra.portrait=full;
 if(valid(small,16000))c.extra.portraitThumb=small;else delete c.extra.portraitThumb;
 global.App.save();global.App.render();announce(t(prev.p?'replaced':'saved'),c,prev);
 return true;
}
function focusEditor(sel){
 const el=(sel&&doc.querySelector?.(sel))||doc.querySelector?.('[data-portrait-pick]');
 el?.focus?.();
}

// ---------- Dialog (shared by crop and avatar) ----------
let dlg=null;
const VIEW=280;
function closeDialog(restore){
 const d=dlg;dlg=null;if(!d)return;
 try{d.el.close?.()}catch{}
 d.el.remove?.();d.onClose?.();
 if(restore!==false)focusEditor(d.back);
}
function dialogHtml(title,help,areaLabel,extra){
 return `<form method="dialog" class="portrait-form"><h2 id="portrait-dlg-title">${esc(title)}</h2><p class="portrait-help" id="portrait-dlg-help">${esc(help)}</p><p class="portrait-error" role="alert" data-portrait-error hidden></p><canvas class="portrait-canvas" width="${VIEW}" height="${VIEW}" tabindex="0" role="img" aria-label="${esc(areaLabel)}" aria-describedby="portrait-dlg-help" data-portrait-canvas></canvas>${extra}<div class="portrait-dlg-actions"><button type="button" class="portrait-btn subtle" data-portrait-cancel>${esc(t('cancel'))}</button><button type="submit" class="portrait-btn primary" data-portrait-save>${esc(t('save'))}</button></div></form>`;
}
function openDialog({title,help,areaLabel,extra,back,setup,onSave}){
 if(!doc?.createElement)return;
 closeDialog(false);
 const el=doc.createElement('dialog');
 el.className='portrait-dialog';el.setAttribute?.('aria-labelledby','portrait-dlg-title');
 el.innerHTML=dialogHtml(title,help,areaLabel,extra);
 const c=global.App?.active?.();
 const d={el,back,onClose:null};
 el.addEventListener('cancel',e=>{e.preventDefault();closeDialog()});
 el.addEventListener('click',e=>{if(e.target?.closest?.('[data-portrait-cancel]'))closeDialog()});
 el.addEventListener('submit',e=>{
  e.preventDefault();
  if(global.App?.active?.()!==c){closeDialog();global.App?.notify?.(t('stale'));return}
  if(onSave()){dlg=null;try{el.close?.()}catch{}el.remove?.();d.onClose?.();focusEditor('[data-portrait-pick]')}
 });
 // Tab stays inside the dialog.
 el.addEventListener('keydown',e=>{
  if(e.key!=='Tab')return;
  const list=[...el.querySelectorAll('button,input,canvas[tabindex]')].filter(x=>!x.disabled);
  if(!list.length)return;
  const first=list[0],last=list[list.length-1],act=doc.activeElement;
  if(e.shiftKey&&(act===first||!el.contains(act))){e.preventDefault();last.focus()}
  else if(!e.shiftKey&&(act===last||!el.contains(act))){e.preventDefault();first.focus()}
 });
 dlg=d;
 doc.body.appendChild(el);
 if(typeof el.showModal==='function')el.showModal();else el.setAttribute('open','');
 setup(el,d);
 el.querySelector('[data-portrait-canvas]')?.focus?.();
}

function openCrop(img,c){
 const iw=img.width,ih=img.height;
 if(!(iw>0&&ih>0)){img.close?.();global.App.notify(t('bad'));return}
 let st=initial(iw,ih);
 const slider=`<div class="portrait-zoom"><button type="button" class="portrait-btn" data-portrait-zoom="-1" aria-label="${esc(t('zoomOut'))}">−</button><input type="range" min="100" max="${MAXZ*100}" step="1" value="100" aria-label="${esc(t('zoom'))}" data-portrait-range><button type="button" class="portrait-btn" data-portrait-zoom="1" aria-label="${esc(t('zoomIn'))}">+</button></div>`;
 openDialog({title:t('cropTitle'),help:t('cropHelp'),areaLabel:t('cropArea'),extra:slider,back:'[data-portrait-pick]',
  onSave:()=>commit(c,(ctx,size)=>paint(ctx,img,rect(iw,ih,st),size)),
  setup(el,d){
   d.onClose=()=>{img.close?.()};
   const cv=el.querySelector('[data-portrait-canvas]'),range=el.querySelector('[data-portrait-range]'),ctx=cv.getContext?.('2d');
   const redraw=()=>{if(ctx){paint(ctx,img,rect(iw,ih,st),VIEW);drawMask(ctx,VIEW)}if(range)range.value=String(Math.round(st.zoom*100))};
   const pts=new Map();let last=null,pinch=null;
   cv.addEventListener('pointerdown',e=>{try{cv.setPointerCapture?.(e.pointerId)}catch{}pts.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(pts.size===2){const [a,b]=[...pts.values()];pinch={d:Math.hypot(a.x-b.x,a.y-b.y),z:st.zoom};last=null}
    else{last={x:e.clientX,y:e.clientY};pinch=null}});
   cv.addEventListener('pointermove',e=>{
    if(!pts.has(e.pointerId))return;pts.set(e.pointerId,{x:e.clientX,y:e.clientY});
    const w=cv.getBoundingClientRect?.().width||VIEW;
    if(pts.size>=2&&pinch){const [a,b]=[...pts.values()];st=zoomTo(iw,ih,st,pinchZoom(pinch.z,pinch.d,Math.hypot(a.x-b.x,a.y-b.y)))}
    else if(last){st=panBy(iw,ih,st,e.clientX-last.x,e.clientY-last.y,w);last={x:e.clientX,y:e.clientY}}
    redraw();
   });
   const up=e=>{pts.delete(e.pointerId);pinch=null;const r=[...pts.values()][0];last=r?{x:r.x,y:r.y}:null};
   cv.addEventListener('pointerup',up);cv.addEventListener('pointercancel',up);
   cv.addEventListener('wheel',e=>{e.preventDefault();st=zoomTo(iw,ih,st,st.zoom*(e.deltaY<0?1.1:1/1.1));redraw()},{passive:false});
   cv.addEventListener('keydown',e=>{const n=applyKey(iw,ih,st,e.key,e.shiftKey);if(!n)return;e.preventDefault();st=n;redraw()});
   range?.addEventListener('input',()=>{st=zoomTo(iw,ih,st,Number(range.value)/100);redraw()});
   el.addEventListener('click',e=>{const z=e.target?.closest?.('[data-portrait-zoom]');if(!z)return;st=zoomTo(iw,ih,st,st.zoom+Number(z.getAttribute('data-portrait-zoom'))*ZSTEP);redraw()});
   redraw();
  }});
}
// Square mask: the saved picture is the whole canvas; a thin frame and thirds show it.
function drawMask(ctx,size){
 ctx.save?.();ctx.strokeStyle='rgba(255,255,255,.85)';ctx.lineWidth=2;ctx.strokeRect(1,1,size-2,size-2);
 ctx.lineWidth=1;ctx.strokeStyle='rgba(255,255,255,.35)';ctx.beginPath();
 for(const f of [1/3,2/3]){ctx.moveTo(size*f,0);ctx.lineTo(size*f,size);ctx.moveTo(0,size*f);ctx.lineTo(size,size*f)}
 ctx.stroke();ctx.restore?.();
}

function openAvatar(c){
 let variant=0;
 const make=()=>spec(seedOf(c,variant),c?.role);
 const extra=`<div class="portrait-zoom"><button type="button" class="portrait-btn" data-portrait-shuffle>${esc(t('shuffle'))}</button></div>`;
 openDialog({title:t('avatarTitle'),help:t('avatarHelp'),areaLabel:t('avatarArea'),extra,back:'[data-portrait-avatar]',
  onSave:()=>{const sp=make();return commit(c,(ctx,size)=>draw(ctx,sp,size))},
  setup(el){
   const cv=el.querySelector('[data-portrait-canvas]'),ctx=cv.getContext?.('2d');
   const redraw=()=>{if(ctx)draw(ctx,make(),VIEW)};
   el.addEventListener('click',e=>{if(e.target?.closest?.('[data-portrait-shuffle]')){variant++;redraw()}});
   cv.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();variant++;redraw()}});
   redraw();
  }});
}

async function attach(file){
 const c=global.App?.active?.();if(!c||!file)return;
 if(file.size>MAX_FILE){global.App.notify(t('big'));return}
 let img;try{img=await loadImage(file)}catch{global.App.notify(t('bad'));return}
 if(global.App.active()!==c){img.close?.();return} // the sheet changed while the image was loading
 openCrop(img,c);
}
async function recrop(){
 const c=global.App?.active?.(),s=src(c);if(!s)return;
 let img;try{img=await decode(s,false)}catch{global.App.notify(t('bad'));return}
 if(global.App.active()!==c)return;
 openCrop(img,c);
}
doc.addEventListener('change',e=>{const input=e.target.closest?.('[data-portrait-file]');if(!input)return;const file=input.files?.[0];input.value='';attach(file)});
doc.addEventListener('click',e=>{
 const pick=e.target.closest?.('[data-portrait-pick]');
 if(pick){pick.parentElement?.querySelector?.('[data-portrait-file]')?.click();return}
 if(e.target.closest?.('[data-portrait-recrop]')){recrop();return}
 if(e.target.closest?.('[data-portrait-avatar]')){const c=global.App?.active?.();if(c)openAvatar(c);return}
 if(!e.target.closest?.('[data-portrait-remove]'))return;
 const c=global.App?.active?.();if(!c?.extra||!global.confirm(t('removeConfirm')))return;
 const prev=snapshot(c);delete c.extra.portrait;delete c.extra.portraitThumb;global.App.save();global.App.render();focusEditor('[data-portrait-pick]');announce(t('removed'),c,prev);
});
global.Portrait={valid,src,thumb,html,editor,
 crop:{MAXZ,ZSTEP,BG,clampZoom,sideOf,fit,initial,rect,panBy,zoomTo,pinchZoom,keyStep,applyKey,paint},
 avatar:{hash,rng,seedOf,spec,draw,glyphOf,GLYPHS,PATTERNS}};
})(window);
