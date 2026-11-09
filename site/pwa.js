/* Installable, offline-capable app shell. Only built copies (with data-build) register the worker. */
(function(global){
'use strict';
const doc=global.document;
let deferredPrompt=null,waiting=null,updateRequested=false;
const ru=()=>(doc.documentElement.lang||'ru')!=='en';

function toast(text,actionLabel,onAction){
 let box=doc.querySelector('#pwa-toast');
 if(!box){box=doc.createElement('div');box.id='pwa-toast';box.className='pwa-toast';box.setAttribute('role','status');doc.body.appendChild(box)}
 box.innerHTML='';
 const span=doc.createElement('span');span.textContent=text;box.appendChild(span);
 if(actionLabel){const b=doc.createElement('button');b.type='button';b.className='btn primary';b.textContent=actionLabel;b.addEventListener('click',onAction);box.appendChild(b)}
 const close=doc.createElement('button');close.type='button';close.className='pwa-toast-close';close.setAttribute('aria-label',ru()?'Закрыть':'Close');close.textContent='×';close.addEventListener('click',()=>{box.classList.remove('visible');if(waiting&&!updateRequested)chip()});box.appendChild(close);
 box.classList.add('visible');
}
// If another tab has already applied this update, the new version is active and a reload is enough.
function applyUpdate(){updateRequested=true;if(waiting&&waiting.state!=='installed')global.location.reload();else waiting?.postMessage('skip-waiting')}
// After the notice is dismissed a small chip stays until the update is applied.
function chip(){
 let b=doc.querySelector('#pwa-chip');
 if(!b){b=doc.createElement('button');b.id='pwa-chip';b.type='button';b.className='pwa-chip';b.addEventListener('click',applyUpdate);doc.body.appendChild(b)}
 b.textContent=ru()?'↻ Обновить':'↻ Update';b.title=ru()?'Доступна новая версия':'A new version is available';
}
function offerUpdate(worker){
 waiting=worker;
 toast(ru()?'Доступна новая версия помощника.':'A new version is available.',ru()?'Обновить':'Update',applyUpdate);
}
function register(){
 if(!('serviceWorker' in navigator)||!doc.documentElement.dataset.build)return;
 let reloading=false;
 // The very first install also fires controllerchange (clients.claim); reload only when the user asked to update.
 navigator.serviceWorker.addEventListener('controllerchange',()=>{if(reloading||!updateRequested)return;reloading=true;global.location.reload()});
 navigator.serviceWorker.register('sw.js').then(reg=>{
  if(reg.waiting&&navigator.serviceWorker.controller)offerUpdate(reg.waiting);
  reg.addEventListener('updatefound',()=>{
   const worker=reg.installing;if(!worker)return;
   worker.addEventListener('statechange',()=>{if(worker.state==='installed'&&navigator.serviceWorker.controller)offerUpdate(worker)});
  });
  // Check for a fresh version when the app regains focus (e.g. reopened on a phone).
  doc.addEventListener('visibilitychange',()=>{if(doc.visibilityState==='visible')reg.update().catch(()=>{})});
 }).catch(()=>{});
}
global.addEventListener('beforeinstallprompt',e=>{
 e.preventDefault();deferredPrompt=e;
 doc.documentElement.classList.add('pwa-installable');
 global.dispatchEvent(new CustomEvent('pwa-installable'));
});
global.addEventListener('appinstalled',()=>{deferredPrompt=null;doc.documentElement.classList.remove('pwa-installable')});
global.PWA={
 canInstall:()=>!!deferredPrompt,
 async install(){if(!deferredPrompt)return false;const e=deferredPrompt;deferredPrompt=null;doc.documentElement.classList.remove('pwa-installable');e.prompt();try{const r=await e.userChoice;return r?.outcome==='accepted'}catch{return false}},
 isStandalone:()=>global.matchMedia?.('(display-mode: standalone)').matches||global.navigator.standalone===true,
 // iPadOS reports itself as a Mac; touch support tells them apart. Used for the Home Screen storage hint.
 isIOS:()=>/iPad|iPhone|iPod/.test(global.navigator.userAgent||'')||global.navigator.platform==='MacIntel'&&global.navigator.maxTouchPoints>1,
};
if(doc.readyState==='complete')register();else global.addEventListener('load',register);
})(window);
