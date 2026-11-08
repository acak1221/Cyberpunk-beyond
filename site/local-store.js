/* Local-only storage for Night City // RED.
   Everything lives in this browser's localStorage: no accounts, no server.
   Keeps the small adapter contract app.js was written against
   (start/save/canEdit/getScope/stateLabel/hasQueued/hasDraft/refreshLanguage). */
(function(global){
'use strict';
const KEY='nightcity-red-v1';
const RECOVERY_KEY='nightcity-red-v1:recovery';
const BACKUP_AT_KEY='nightcity-red-last-backup-v1';
const SCOPE='local';
const DELAY=200;

function create(options){
 const app=options.app,status=options.status;
 const lang=()=>options.language?.()==='en'?'en':'ru';
 const word=(ru,en)=>lang()==='en'?en:ru;
 let started=false,pending=null,timer=null,lastWritten=null,failed=false,issue=options.initialIssue||null,paused=false;

 function notifyFailure(){try{options.onFailure?.()}catch{}}
 function write(snapshot){
  let raw;
  try{raw=JSON.stringify(snapshot)}catch{failed=true;notifyFailure();paint();return {ok:false,reason:'serialize'}}
  try{global.localStorage.setItem(KEY,raw);lastWritten=raw;failed=false;paint();return {ok:true}}
  catch{failed=true;notifyFailure();paint();return {ok:false,reason:'storage'}}
 }
 function flush(){
  if(timer){clearTimeout(timer);timer=null}
  if(!pending)return {ok:true};
  const job=pending;pending=null;
  const result=write(job.snapshot);
  for(const resolve of job.waiters)resolve(result);
  return result;
 }
 function save(snapshot){
  if(paused)return Promise.resolve({ok:false,reason:'paused'});
  // Copy now so later in-place edits cannot change what this call saves.
  let copy;try{copy=JSON.parse(JSON.stringify(snapshot))}catch{notifyFailure();return Promise.resolve({ok:false,reason:'serialize'})}
  return new Promise(resolve=>{
   if(pending){pending.snapshot=copy;pending.waiters.push(resolve)}
   else pending={snapshot:copy,waiters:[resolve]};
   if(timer)clearTimeout(timer);
   timer=setTimeout(flush,DELAY);
   paint();
  });
 }
 function stateLabel(){
  if(paused)return word('РЕДАКТИРОВАНИЕ ПРИОСТАНОВЛЕНО','EDITING PAUSED');
  if(failed)return word('ОШИБКА СОХРАНЕНИЯ','SAVE FAILED');
  if(pending)return word('СОХРАНЕНИЕ…','SAVING…');
  return word('СОХРАНЕНО В БРАУЗЕРЕ','SAVED IN BROWSER');
 }
 function download(raw,name){
  try{
   const blob=new Blob([raw],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
   a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }catch{}
 }
 function paint(){
  const label=document.querySelector('[data-app-save-status]');if(label)label.textContent=stateLabel();
  if(app){app.inert=!started||paused;app.setAttribute('aria-busy',String(!started))}
  if(!status)return;
  if(!issue){status.hidden=true;status.innerHTML='';return}
  status.hidden=false;
  status.innerHTML=`<div class="store-issue" role="alert"><p>${word(
   paused?'Сохранённые в браузере данные не распознаны, а сделать их резервную копию не удалось. Скачайте исходный файл, затем начните заново.':'Сохранённые в браузере данные не распознаны. Исходная копия отложена в резерв — её можно скачать и проверить.',
   paused?'Saved browser data could not be read and could not be set aside automatically. Download the original, then start fresh.':'Saved browser data could not be read. The original copy was set aside and can be downloaded for inspection.'
  )}</p><div class="store-issue-actions"><button type="button" class="btn ghost" data-store-action="download-issue">${word('Скачать исходные данные','Download original data')}</button>${paused?`<button type="button" class="btn primary" data-store-action="reset">${word('Начать заново','Start fresh')}</button>`:`<button type="button" class="btn ghost" data-store-action="dismiss">${word('Скрыть','Dismiss')}</button>`}</div></div>`;
 }
 function onStatusClick(e){
  const button=e.target.closest?.('[data-store-action]');if(!button)return;
  const action=button.dataset.storeAction;
  if(action==='download-issue'&&issue)download(issue.raw??'',`nightcity-red-original-${new Date().toISOString().slice(0,10)}.json`);
  if(action==='dismiss'){issue=null;paint()}
  if(action==='reset'){
   if(!global.confirm(word('Заменить нераспознанные данные пустым архивом? Скачайте исходный файл заранее.','Replace the unreadable data with an empty archive? Download the original first.')))return;
   paused=false;issue=null;
   try{global.localStorage.removeItem(KEY)}catch{}
   paint();
   options.onScopeChange?.(SCOPE);
  }
 }
 function setAside(){
  // Never overwrite unreadable data silently: keep the first unreadable copy.
  if(!issue||typeof issue.raw!=='string')return true;
  try{
   const existing=global.localStorage.getItem(RECOVERY_KEY);
   if(existing===null)global.localStorage.setItem(RECOVERY_KEY,issue.raw);
   return true;
  }catch{return false}
 }
 function onStorage(e){
  if(e.key!==KEY||e.storageArea!==global.localStorage||e.newValue===null||e.newValue===lastWritten)return;
  let next;try{next=JSON.parse(e.newValue)}catch{return}
  if(!options.validate||!options.validate(next))return;
  if(pending){timer&&clearTimeout(timer);timer=null;const job=pending;pending=null;for(const resolve of job.waiters)resolve({ok:false,reason:'replaced'})}
  lastWritten=e.newValue;
  try{options.apply(next);options.onExternalChange?.()}catch{}
 }
 function start(){
  if(started)return;
  started=true;
  if(issue&&!setAside())paused=true;
  status?.addEventListener('click',onStatusClick);
  global.addEventListener?.('storage',onStorage);
  global.addEventListener?.('pagehide',flush);
  global.document?.addEventListener?.('visibilitychange',()=>{if(global.document.visibilityState==='hidden')flush()});
  try{global.navigator?.storage?.persist?.().catch(()=>{})}catch{}
  paint();
  options.onScopeChange?.(SCOPE);
 }
 return {
  start,save,flush,stateLabel,
  canEdit:()=>started&&!paused,
  getScope:()=>started&&!paused?SCOPE:null,
  hasDraft:()=>false,
  hasQueued(){flush();return false},
  refreshLanguage(){paint()},
  markBackup(){try{global.localStorage.setItem(BACKUP_AT_KEY,new Date().toISOString())}catch{}},
  lastBackup(){try{return global.localStorage.getItem(BACKUP_AT_KEY)}catch{return null}},
 };
}
global.LocalStore={create,KEY};
})(typeof window!=='undefined'?window:globalThis);
