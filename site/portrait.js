/* Character portraits: an image chosen by the player, cropped to a square and
   compressed in the browser. Stored on the character (extra.portrait, plus a tiny
   extra.portraitThumb for online rooms), so it travels with exports and backups. */
(function(global){
'use strict';
const doc=global.document;
const FULL=320,THUMB=72,MAX_FILE=20*1024*1024;
const T={ru:{upload:'Загрузить портрет',change:'Сменить портрет',remove:'Убрать',removeConfirm:'Убрать портрет персонажа?',bad:'Не удалось прочитать изображение. Выберите JPG, PNG или WebP.',big:'Файл слишком большой (больше 20 МБ).',saved:'Портрет сохранён.',alt:'Портрет персонажа'},
 en:{upload:'Upload portrait',change:'Change portrait',remove:'Remove',removeConfirm:'Remove the character portrait?',bad:'Could not read the image. Choose a JPG, PNG or WebP file.',big:'The file is too large (over 20 MB).',saved:'Portrait saved.',alt:'Character portrait'}};
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
 return `<div class="portrait-box"><div class="portrait-frame">${s?`<img src="${s}" alt="${esc(t('alt'))}">`:`<span aria-hidden="true">${initial}</span>`}</div><div class="portrait-actions"><label class="portrait-button">${esc(s?t('change'):t('upload'))}<input type="file" accept="image/jpeg,image/png,image/webp,image/*" data-portrait-file hidden></label>${s?`<button type="button" class="portrait-button subtle" data-portrait-remove>${esc(t('remove'))}</button>`:''}</div></div>`;
}

function loadImage(file){
 if(global.createImageBitmap)return global.createImageBitmap(file).catch(()=>viaElement(file));
 return viaElement(file);
}
function viaElement(file){return new Promise((resolve,reject)=>{const url=URL.createObjectURL(file),img=new Image();img.onload=()=>{URL.revokeObjectURL(url);resolve(img)};img.onerror=()=>{URL.revokeObjectURL(url);reject(Error('decode'))};img.src=url})}
function square(img,size,quality){
 const w=img.width,h=img.height,side=Math.min(w,h),canvas=doc.createElement('canvas');
 canvas.width=size;canvas.height=size;
 const ctx=canvas.getContext('2d');ctx.imageSmoothingQuality='high';
 // Centre crop, nudged up a little so faces in portrait photos are not cut off.
 const sx=(w-side)/2,sy=Math.max(0,(h-side)*0.3);
 ctx.drawImage(img,sx,sy,side,side,0,0,size,size);
 return canvas.toDataURL('image/jpeg',quality);
}
async function attach(file){
 const c=global.App?.active?.();if(!c||!file)return;
 if(file.size>MAX_FILE){global.App.notify(t('big'));return}
 let img;try{img=await loadImage(file)}catch{global.App.notify(t('bad'));return}
 const full=square(img,FULL,0.82),small=square(img,THUMB,0.7);
 img.close?.();
 if(!valid(full)){global.App.notify(t('bad'));return}
 if(global.App.active()!==c)return; // the sheet changed while the image was loading
 c.extra=c.extra&&typeof c.extra==='object'?c.extra:{};
 c.extra.portrait=full;
 if(valid(small,16000))c.extra.portraitThumb=small;else delete c.extra.portraitThumb;
 global.App.save();global.App.render();global.App.notify(t('saved'));
}
doc.addEventListener('change',e=>{const input=e.target.closest?.('[data-portrait-file]');if(!input)return;const file=input.files?.[0];input.value='';attach(file)});
doc.addEventListener('click',e=>{
 if(!e.target.closest?.('[data-portrait-remove]'))return;
 const c=global.App?.active?.();if(!c?.extra||!global.confirm(t('removeConfirm')))return;
 delete c.extra.portrait;delete c.extra.portraitThumb;global.App.save();global.App.render();
});
global.Portrait={valid,src,thumb,html,editor};
})(window);
