/* Adapter for the existing SPA; every model write passes through CloudSync's Web Lock. */
(function(global){
'use strict';
const ALLOWED=new Set(['synced','pending','offline','unavailable','unknown']);
function clone(value){return JSON.parse(JSON.stringify(value))}
function create(options){
 let controller=null,started=false,latestStatus={kind:'connecting'},queue=[],working=false,halted=false,emergencyDrafts=[],draftHold=false,downloaded=false,repaintRequested=false,incompatibleRemote=null,lastNotifiedScope=null;
 const initialIssue=options.initialIssue||null;
 let warningAcknowledged=false;try{warningAcknowledged=global.localStorage?.getItem('nightcity-red-sync-warning-ack-v1')==='1'}catch{}
 const app=options.app, mount=options.mount, status=options.status;
 const lang=()=>options.language()==='en'?'en':'ru';
 const word=(ru,en)=>lang()==='en'?en:ru;
 const stateLabel=()=>queue.length||working?word('ИЗМЕНЕНИЯ ОЖИДАЮТ ЛОКАЛЬНОЙ ЗАПИСИ','WAITING FOR LOCAL SAVE'):latestStatus.kind==='synced'?word('СИНХРОНИЗИРОВАНО','SYNCED'):['pending','unknown'].includes(latestStatus.kind)?word('ЛОКАЛЬНО СОХРАНЕНО · ОЖИДАЕТ СИНХРОНИЗАЦИИ','SAVED LOCALLY · SYNC PENDING'):['offline','unavailable'].includes(latestStatus.kind)?word('СОХРАНЕНО ЛОКАЛЬНО · ОБЛАКО НЕДОСТУПНО','SAVED LOCALLY · CLOUD UNAVAILABLE'):word('РЕДАКТИРОВАНИЕ ПРИОСТАНОВЛЕНО','EDITING PAUSED');
 const canEdit=()=>started&&!!controller&&!halted&&!draftHold&&ALLOWED.has(latestStatus.kind)&&!controller.getConflict();
 function setPanelText(){
   const el=mount?.querySelector('.sync-status strong');
   if(el&&(queue.length||working)&&ALLOWED.has(latestStatus.kind))el.textContent=word('Изменения ожидают локальной записи','Waiting for local save');
   const label=document.querySelector('[data-app-save-status]');if(label)label.textContent=stateLabel();
 }
 function show(){
   const editable=canEdit();if(app){app.inert=!editable;app.setAttribute('aria-busy',String(!started||latestStatus.kind==='connecting'));}
   if(status){
    const draft=emergencyDrafts.length>0;
    let unsupportedRaw=null;if(latestStatus.kind==='unsupported'&&!initialIssue){try{unsupportedRaw=global.localStorage?.getItem('nightcity-red-v1')??null}catch{}}
    status.innerHTML=`${warningAcknowledged?'':`<p class="sync-adapter-note">${word('Перед работой закройте или обновите все старые вкладки сайта: прежняя версия не защищает совместную запись.','Close or reload all older site tabs before editing: older versions do not coordinate writes.')} <button type="button" data-adapter-action="dismiss-warning">${word('Понятно','Understood')}</button></p>`}${(!started||!controller||queue.length||working||draftHold||halted||!mount?.querySelector('.sync-status'))?`<p class="sync-adapter-state" role="status">${stateLabel()}</p>`:''}${latestStatus.kind==='signedout'?`<p class="sync-signin"><a href="/signin-with-chatgpt?return_to=%2Fgame%2Findex.html" target="_top">${word('Войти в аккаунт','Sign in')}</a></p>`:''}${latestStatus.kind==='unsupported'&&!initialIssue?`<div class="sync-adapter-draft" role="alert"><p>${word('Безопасное сохранение в этом браузере недоступно. Редактирование остановлено; исходная локальная копия не изменена.','Safe saving is unavailable in this browser. Editing is disabled; the original local copy has not been changed.')}</p>${typeof unsupportedRaw==='string'?`<button type="button" data-adapter-action="download-legacy">${word('Скачать исходные данные','Download original data')}</button>`:''}</div>`:''}${initialIssue?`<div class="sync-adapter-draft" role="alert"><p>${word('Локальные данные повреждены или несовместимы. Они не изменены; редактирование и синхронизация остановлены. Скачайте исходную копию для восстановления.','Local data is damaged or incompatible. It has not been changed; editing and sync are stopped. Download the original copy for recovery.')}</p>${typeof initialIssue.raw==='string'?`<button type="button" data-adapter-action="download-legacy">${word('Скачать исходные данные','Download original data')}</button>`:''}</div>`:''}${incompatibleRemote?`<div class="sync-adapter-draft" role="alert"><p>${word('Другая копия несовместима с этой версией и не применена к открытым данным. Скачайте её для проверки.','Another copy is incompatible with this version and was not applied to the open data. Download it for review.')}</p><button type="button" data-adapter-action="download-incompatible">${word('Скачать другую копию','Download other copy')}</button></div>`:''}${draft?`<div class="sync-adapter-draft" role="alert"><p>${word('Последние изменения ещё не подтверждены локальным хранилищем. Черновик остаётся в этой вкладке; скачайте копию до закрытия.','Recent edits have not been confirmed by local storage. The draft remains in this tab; download a copy before closing it.')}</p><button type="button" data-adapter-action="download">${word('Скачать черновик и историю снимков','Download draft and snapshot history')}</button>${draftHold?`<button type="button" data-adapter-action="review" ${downloaded&&!working&&!queue.length?'':'disabled'}>${word('Я скачал копию — перейти к разбору','I saved a copy — review the conflict')}</button>`:''}</div>`:''}`;
   }
   setPanelText();
   const currentScope=getScope();if(currentScope!==lastNotifiedScope){lastNotifiedScope=currentScope;options.onScopeChange?.(currentScope)}
 }
 function captureDraft(){
   try{let latest=clone(options.read());emergencyDrafts.push(...queue.map(item=>clone(item.snapshot)));if(!emergencyDrafts.length||JSON.stringify(emergencyDrafts[emergencyDrafts.length-1])!==JSON.stringify(latest))emergencyDrafts.push(latest);return true}catch{return false}
 }
 function failClosed(){
   if(!draftHold){captureDraft();draftHold=true;downloaded=false}halted=true;show();
 }
 function updateStatus(next){
   latestStatus=next||{kind:'error'};
   if(['conflict','account','backupError','unsupported','error','badData','tooLarge','unsupportedMedia','forbidden','signedout'].includes(latestStatus.kind)&&(queue.length||working))failClosed();
   show();
 }
 function apply(next){
   // An async refresh must never replace data the SPA has not durably saved.
   if(queue.length||working||draftHold){failClosed();throw Error('unsaved_memory_draft')}
   try{options.apply(clone(next))}catch(err){failClosed();throw err}
   show();
 }
 async function start(){
   show();
   if(initialIssue){latestStatus={kind:'badData'};started=true;halted=true;show();return null}
   try{
     controller=await global.CloudSync.start({mount,language:lang,read:()=>clone(options.read()),apply,validate:options.validate,onIncompatibleRemote:data=>{incompatibleRemote=clone(data);show()},onExternalApplyFailure:previous=>{emergencyDrafts.push(clone(previous));draftHold=true;halted=true;downloaded=false;show()},canApplyExternal:()=>canEdit()&&!working&&queue.length===0&&!draftHold&&!halted,onStatus:updateStatus,debounceMs:600});
     latestStatus=controller.getStatus();started=true;show();return controller;
   }catch(err){latestStatus={kind:'error'};started=true;halted=true;show();options.onFailure?.(err);return null}
 }
 function save(snapshot){
   let value;try{value=clone(snapshot)}catch(err){failClosed();options.onFailure?.(err);return Promise.resolve({ok:false,reason:'invalid'})}
   if(!canEdit()){emergencyDrafts.push(value);draftHold=true;halted=true;downloaded=false;show();return Promise.resolve({ok:false,reason:'blocked'})}
   return new Promise(resolve=>{queue.push({snapshot:value,resolve});show();drain()});
 }
 async function drain(){
   if(working||!controller||halted)return;working=true;show();
   while(queue.length&&!halted){
    let item=queue[0],result;
    try{result=await controller.save(item.snapshot)}catch(err){result={ok:false,reason:'error'};options.onFailure?.(err)}
    if(!result?.ok){
      // Keep every unsaved event snapshot in memory; current state may contain newer edits.
      emergencyDrafts.push(...queue.map(x=>clone(x.snapshot)));
      try{emergencyDrafts.push(clone(options.read()))}catch{}
      draftHold=true;halted=true;downloaded=false;
      for(const pending of queue)pending.resolve(result||{ok:false,reason:'error'});queue=[];options.onFailure?.(result);break;
    }
    queue.shift();item.resolve(result);show();
   }
   if(halted&&queue.length){
     emergencyDrafts.push(...queue.map(item=>clone(item.snapshot)));
     try{emergencyDrafts.push(clone(options.read()))}catch{}
     for(const pending of queue)pending.resolve({ok:false,reason:'blocked'});queue=[];
   }
   working=false;show();
   if(!halted&&repaintRequested&&queue.length===0){repaintRequested=false;await controller.refresh()}
 }
 function exportDraft(){
   if(!emergencyDrafts.length)return;
   let latest=clone(emergencyDrafts[emergencyDrafts.length-1]);
   const file={...latest,format:'nightcity-red-backup',version:1,_completeSnapshot:latest,unpersistedDrafts:clone(emergencyDrafts)};
   const u=URL.createObjectURL(new Blob([JSON.stringify(file,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=u;a.download='night-city-unsaved-drafts.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);downloaded=true;show();
 }
 status?.addEventListener('click',event=>{
  const a=event.target.closest('[data-adapter-action]')?.dataset.adapterAction;
  if(a==='dismiss-warning'){warningAcknowledged=true;try{global.localStorage?.setItem('nightcity-red-sync-warning-ack-v1','1')}catch{}show();return}
  if(a==='download')exportDraft();
  if(a==='download-legacy'){
    let raw=initialIssue?.raw;
    if(typeof raw!=='string'&&latestStatus.kind==='unsupported'){try{raw=global.localStorage?.getItem('nightcity-red-v1')}catch{raw=null}}
    if(typeof raw==='string'){const u=URL.createObjectURL(new Blob([raw],{type:'application/json'})),anchor=document.createElement('a');anchor.href=u;anchor.download='night-city-original-local.json';anchor.click();setTimeout(()=>URL.revokeObjectURL(u),1000)}
  }
  if(a==='download-incompatible'&&incompatibleRemote){
    const data=clone(incompatibleRemote),file={...data,format:'nightcity-red-backup',version:1,_completeSnapshot:clone(data)};const u=URL.createObjectURL(new Blob([JSON.stringify(file,null,2)],{type:'application/json'})),anchor=document.createElement('a');anchor.href=u;anchor.download='night-city-incompatible-cloud.json';anchor.click();setTimeout(()=>URL.revokeObjectURL(u),1000);
  }
  if(a==='review'&&draftHold&&downloaded&&!working&&!queue.length){
    if(!confirm(word('Вы скачали копию. Разрешить выбор другой версии? Черновик останется доступным в этой вкладке до закрытия.','You downloaded a copy. Allow choosing another version? The draft remains available in this tab until it closes.')))return;
    draftHold=false;halted=false;show();
  }
 });
 // While a draft is in flight or awaiting download, cloud conflict choices cannot replace it.
 mount?.addEventListener('click',event=>{
  const action=event.target.closest('[data-sync-action]')?.dataset.syncAction;
  if(['local','remote','mine','other'].includes(action)&&(queue.length||working||draftHold)){
    event.preventDefault();event.stopImmediatePropagation();
    if(!draftHold)failClosed();show();
  }
 },true);
 // inert covers normal interactions; capture also fails closed on browsers lacking inert support.
 for(const type of ['click','input','change','beforeinput','keydown','paste','drop','submit'])app?.addEventListener(type,event=>{if(!canEdit()){event.preventDefault();event.stopImmediatePropagation()}},true);
 global.addEventListener('beforeunload',event=>{if(queue.length||working||emergencyDrafts.length){event.preventDefault();event.returnValue='';return ''}});
 // A previously verified scope stays usable during a temporary connection failure,
 // but only while the shared local copy is still owned by that exact account.
 function getScope(){
  try{
   if(!started||!controller||!['synced','pending','offline','unavailable','unknown'].includes(latestStatus.kind)||controller.getConflict())return null;
   const scope=controller.scope;
   return typeof scope==='string'&&scope.length>=8&&scope.length<=512&&global.localStorage?.getItem('nightcity-red-sync-owner-v1')===scope?scope:null;
  }catch{return null}
 }
 return {start,save,canEdit,stateLabel,getScope,hasDraft:()=>emergencyDrafts.length>0,hasQueued:()=>!!(queue.length||working),refreshLanguage(){repaintRequested=true;if(!working&&!queue.length&&controller&&!draftHold){repaintRequested=false;controller.refresh()}},show};
}
global.SyncAdapter={create};
})(window);

