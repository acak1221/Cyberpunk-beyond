/* Local-only storage for Night City // RED.
   Everything lives in this browser's localStorage: no accounts, no server.
   Keeps the small adapter contract app.js was written against
   (start/save/canEdit/getScope/stateLabel/hasQueued/hasDraft/refreshLanguage). */
(function(global){
'use strict';
const KEY='nightcity-red-v1';
// Unreadable archives are set aside under dated keys (KEY:recovery:<ms>); the bare key is the single copy older versions kept.
const RECOVERY_KEY='nightcity-red-v1:recovery';
// Automatic snapshots of the data as it was before a full restore (KEY:before-restore:<ms>). One is kept: the older ones go once
// the restored data is written.
const BEFORE_RESTORE_KEY='nightcity-red-v1:before-restore';
// What this tab had not yet written when another tab replaced the data (KEY:other-tab:<ms>). The newest few are kept.
const OTHER_TAB_KEY='nightcity-red-v1:other-tab';
const BACKUP_AT_KEY='nightcity-red-last-backup-v1';
// One tab at a time writes (Web Locks): the others show the data and offer «Открыть здесь».
const LOCK_NAME='nightcity-red-writer-v1';
const LOCK_RETRY=150,MAX_OTHER_TAB=3;
const SCOPE='local';
const DELAY=200;
const MAX_COPIES=5,MAX_COPY_CHARS=3e6;

function create(options){
 const app=options.app,status=options.status;
 const lang=()=>options.language?.()==='en'?'en':'ru';
 const word=(ru,en)=>lang()==='en'?en:ru;
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let started=false,pending=null,timer=null,lastWritten=null,failed=false,issue=options.initialIssue||null,paused=false,persistence='unknown';
 // follower: another tab holds the write lock, so this one only shows the data. notice: the last edit another tab made this tab lose.
 let follower=false,leader=false,queued=false,notice=null,pushedOut=false;
 // erased: the archive was removed (by «Стереть данные» here or in another tab). From then on this tab writes nothing, so the
 // erased data cannot come back; only a reload leaves this state. hadArchive: the archive key existed when this tab started.
 let erased=false,hadArchive=false;
 const archiveGone=()=>{try{return (hadArchive||lastWritten!==null)&&global.localStorage.getItem(KEY)===null}catch{return false}};
 function markErased(){
  if(erased)return;
  erased=true;drop('erased');unsaved=null;failed=false;notice=null;
  paint();refocus();
 }
 // The last snapshot the browser had no room for. It is written again by the next flush (also when the page is hidden or closed),
 // so freeing space saves the edits that failed; forget() drops it when the caller puts the stored data back instead.
 let unsaved=null;
 const kind=()=>issue?.kind||'unreadable';

 function notifyFailure(){try{options.onFailure?.()}catch{}}
 function write(snapshot){
  if(erased||archiveGone()){markErased();return {ok:false,reason:'erased'}}
  let raw;
  try{raw=JSON.stringify(snapshot)}catch{failed=true;notifyFailure();paint();return {ok:false,reason:'serialize'}}
  try{global.localStorage.setItem(KEY,raw);lastWritten=raw;failed=false;unsaved=null;paint();try{global.Transfer?.noteChange?.(snapshot)}catch{}return {ok:true}}
  catch{failed=true;unsaved=snapshot;notifyFailure();paint();return {ok:false,reason:'storage'}}
 }
 // A quiet second try: no failure notice, the first failure already showed one.
 function retry(){
  if(!unsaved||paused)return {ok:true};
  if(erased||archiveGone()){markErased();return {ok:false,reason:'erased'}}
  try{const raw=JSON.stringify(unsaved);global.localStorage.setItem(KEY,raw);lastWritten=raw;failed=false;unsaved=null;paint();return {ok:true}}
  catch{return {ok:false,reason:'storage'}}
 }
 function forget(){if(!unsaved)return;unsaved=null;failed=false;paint()}
 function flush(){
  if(timer){clearTimeout(timer);timer=null}
  if(!pending)return retry();
  const job=pending;pending=null;
  const result=write(job.snapshot);
  for(const resolve of job.waiters)resolve(result);
  return result;
 }
 function drop(reason){if(timer){clearTimeout(timer);timer=null}if(!pending)return;const job=pending;pending=null;for(const resolve of job.waiters)resolve({ok:false,reason})}
 function save(snapshot){
  if(erased)return Promise.resolve({ok:false,reason:'erased'});
  if(paused)return Promise.resolve({ok:false,reason:'paused'});
  if(follower)return Promise.resolve({ok:false,reason:'follower'});
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
  if(erased)return word('ДАННЫЕ СТЁРТЫ','DATA ERASED');
  if(paused)return word('РЕДАКТИРОВАНИЕ ПРИОСТАНОВЛЕНО','EDITING PAUSED');
  if(follower)return word('ТОЛЬКО ПРОСМОТР: ОТКРЫТО В ДРУГОЙ ВКЛАДКЕ','VIEW ONLY: OPEN IN ANOTHER TAB');
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
 // Set-aside copies: unreadable archives and the snapshot taken before a full restore.
 function copyKind(k){if(k===RECOVERY_KEY)return {kind:'recovery',at:null};for(const [prefix,kind] of [[RECOVERY_KEY+':','recovery'],[BEFORE_RESTORE_KEY+':','before-restore'],[OTHER_TAB_KEY+':','other-tab']])if(typeof k==='string'&&k.startsWith(prefix)){const at=Number(k.slice(prefix.length));return {kind,at:Number.isSafeInteger(at)&&at>0?at:null}}return null}
 function copies(){
  const out=[];
  try{const ls=global.localStorage;for(let i=0;i<ls.length;i++){const id=ls.key(i),info=copyKind(id);if(!info)continue;const raw=ls.getItem(id);if(typeof raw==='string')out.push({id,...info,size:raw.length})}}catch{}
  return out.sort((a,b)=>(b.at||0)-(a.at||0));
 }
 function readCopy(id){if(!copyKind(id))return null;try{return global.localStorage.getItem(id)}catch{return null}}
 function removeCopy(id){if(!copyKind(id))return false;try{global.localStorage.removeItem(id);return true}catch{return false}}
 // A key newer than every copy of this kind (also when several are made within one millisecond or older ones were just removed),
 // so the order of the copies by their number is the order they were made in.
 function freeKey(prefix){let at=Date.now();for(const c of copies())if(c.id.startsWith(prefix+':')&&c.at!==null&&c.at>=at)at=c.at+1;while(readCopy(prefix+':'+at)!==null)at++;return prefix+':'+at}
 // Returns the new copy's id, or false when the browser has no room for it. An older snapshot stays next to the new one until the
 // caller has written the replacement and calls dropOlderBeforeRestore: a restore that does not fit must not cost the snapshot
 // the user already had.
 function keepBeforeRestore(raw){
  if(typeof raw!=='string')return false;
  const id=freeKey(BEFORE_RESTORE_KEY);
  try{global.localStorage.setItem(id,raw)}catch{return false}
  return id;
 }
 function dropOlderBeforeRestore(id){
  if(copyKind(id)?.kind!=='before-restore'||readCopy(id)===null)return;
  for(const c of copies())if(c.kind==='before-restore'&&c.id!==id)removeCopy(c.id);
 }
 // True when `chars` more characters fit in the browser right now.
 function hasRoom(chars){
  const probe=KEY+':probe',n=Math.max(0,Math.ceil(Number(chars)||0));
  try{global.localStorage.setItem(probe,'x'.repeat(n));global.localStorage.removeItem(probe);return true}
  catch{try{global.localStorage.removeItem(probe)}catch{}return false}
 }
 // The edit this tab was about to write when another tab replaced the data: kept next to the other set-aside copies, so it can
 // still be read, downloaded and added back. The oldest of these copies makes room for the new one. Returns the copy's id or false.
 function keepOtherTab(snapshot){
  let raw;try{raw=JSON.stringify(snapshot)}catch{return false}
  if(typeof raw!=='string')return false;
  const old=copies().filter(c=>c.kind==='other-tab');
  pushedOut=false;
  while(old.length>=MAX_OTHER_TAB){const c=old.pop();removeCopy(c.id);pushedOut=true}
  const id=freeKey(OTHER_TAB_KEY);
  try{global.localStorage.setItem(id,raw)}catch{return false}
  return id;
 }
 function setAside(){
  // Never overwrite unreadable data silently: keep every distinct unreadable copy, within a bounded count and size.
  if(!issue||kind()!=='unreadable'||typeof issue.raw!=='string')return true;
  const kept=copies().filter(c=>c.kind==='recovery'),same=kept.find(c=>readCopy(c.id)===issue.raw);
  if(same){issue.copy=same.id;return true}
  if(kept.length>=MAX_COPIES||kept.reduce((n,c)=>n+c.size,0)+issue.raw.length>MAX_COPY_CHARS)return false;
  const id=freeKey(RECOVERY_KEY);
  try{global.localStorage.setItem(id,issue.raw);issue.copy=id;return true}catch{return false}
 }
 function partList(){
  const s=issue?.summary||{},names=list=>list.length?' — '+list.slice(0,3).map(n=>word('«'+(n||'без имени')+'»','“'+(n||'unnamed')+'”')).join(', ')+(list.length>3?'…':''):'',parts=[];
  if(s.characters?.length)parts.push(word('персонажи','characters')+': '+s.characters.length+names(s.characters));
  if(s.campaigns?.length)parts.push(word('кампании','campaigns')+': '+s.campaigns.length+names(s.campaigns));
  if(s.sections)parts.push(word('другие разделы','other sections')+': '+s.sections);
  return parts.join('; ');
 }
 function message(){
  if(kind()==='newer')return word('Данные в этом браузере сохранены более новой версией приложения. Чтобы ничего не потерять, редактирование приостановлено — обновите страницу.','The data in this browser was saved by a newer version of the app. Editing is paused so nothing is lost — reload the page.');
  if(kind()==='partial')return word(`Часть сохранённых данных не читается (${partList()}). Всё остальное открыто. Нечитаемые записи отложены без изменений — они на странице «Персонажи», в разделе «Корзина и отложенные данные».`,`Some saved data could not be read (${partList()}). Everything else is open. The unreadable records were set aside unchanged — see Bin and set-aside data on the Characters page.`);
  if(paused)return word('Сохранённые в браузере данные не распознаны, а отложить их копию не удалось: не хватает места или уже хранится 5 отложенных копий. Редактирование приостановлено. Скачайте исходный файл, затем начните заново.','Saved browser data could not be read and could not be set aside: storage is full or 5 set-aside copies are already kept. Editing is paused. Download the original, then start fresh.');
  return word('Сохранённые в браузере данные не распознаны. Исходная копия отложена в резерв в этом браузере — её можно скачать сейчас или позже на странице «Персонажи», в разделе «Корзина и отложенные данные».','Saved browser data could not be read. The original copy was set aside in this browser — download it now or later from Bin and set-aside data on the Characters page.');
 }
 function noticeMessage(){
  if(!notice)return '';
  const more=notice.pushed?word(' Самая старая из прежних копий «изменено в другой вкладке» удалена: хранится не больше трёх.',' The oldest earlier «changed in another tab» copy was removed: at most three are kept.'):'';
  return noticeText()+more;
 }
 function noticeText(){
  return notice.id?word('Изменено в другой вкладке. Ваша последняя правка здесь не успела сохраниться и могла пропасть, поэтому её копию мы отложили. Скачайте её сейчас или найдите позже на странице «Персонажи», в разделе «Корзина и отложенные данные».','Changed in another tab. Your last edit here had not been saved yet and could be lost, so a copy of it was set aside. Download it now or find it later on the Characters page, under Bin and set-aside data.')
   :word('Изменено в другой вкладке. Ваша последняя правка здесь не успела сохраниться, а отложить её копию не удалось: не хватает места. Повторите правку.','Changed in another tab. Your last edit here had not been saved yet, and a copy could not be set aside because storage is full. Please make the edit again.');
 }
 function followerMessage(){return word('Приложение уже открыто в другой вкладке, поэтому здесь можно только смотреть: правки сохраняет та вкладка. Закройте её или нажмите «Открыть здесь» — тогда править можно будет в этой вкладке, а в другой останется просмотр.','The app is already open in another tab, so this one is view only: that tab saves the edits. Close it, or press “Open here” — then you can edit in this tab and the other one becomes view only.')}
 function extraPanels(){
  let html='';
  if(notice)html+=`<div class="store-issue store-other-tab" role="status"><p>${esc(noticeMessage())}</p><div class="store-issue-actions">${notice.id?`<button type="button" class="btn ghost" data-store-action="download-notice">${word('Скачать копию правки','Download the edit')}</button>`:''}<button type="button" class="btn primary" data-store-action="dismiss-notice">${word('Понятно','Got it')}</button></div></div>`;
  if(follower)html+=`<div class="store-issue store-follower" role="status"><p>${esc(followerMessage())}</p><div class="store-issue-actions"><button type="button" class="btn primary" data-store-action="take-over">${word('Открыть здесь','Open here')}</button></div></div>`;
  return html;
 }
 function paint(){
  const label=document.querySelector('[data-app-save-status]');if(label)label.textContent=stateLabel();
  if(app){app.inert=!started||paused||erased;app.setAttribute('aria-busy',String(!started))}
  if(!status)return;
  if(erased){status.hidden=false;status.innerHTML=`<div class="store-issue store-erased" role="alert"><p>${esc(word('Данные стёрты в другой вкладке — обновите страницу.','Data was erased in another tab — reload the page.'))}</p><div class="store-issue-actions"><button type="button" class="btn primary" data-store-action="reload">${word('Обновить страницу','Reload page')}</button></div></div>`;return}
  if(!issue){const extra=extraPanels();status.hidden=!extra;status.innerHTML=extra;return}
  status.hidden=false;
  const downloadButton=`<button type="button" class="btn ghost" data-store-action="download-issue">${word('Скачать исходные данные','Download original data')}</button>`;
  const actions=kind()==='newer'?`<button type="button" class="btn primary" data-store-action="reload">${word('Обновить страницу','Reload page')}</button>${downloadButton}`:paused?`${downloadButton}<button type="button" class="btn primary" data-store-action="reset">${word('Начать заново','Start fresh')}</button>`:`${downloadButton}<button type="button" class="btn ghost" data-store-action="dismiss">${word('Скрыть','Dismiss')}</button>`;
  status.innerHTML=`<div class="store-issue" role="alert"><p>${esc(message())}</p><div class="store-issue-actions">${actions}</div></div>`+extraPanels();
 }
 // Focus must not fall to the page when the button that was pressed goes away with its panel.
 function refocus(){try{const next=status?.querySelector?.('button');if(next){next.focus();return}const h=document.querySelector('h1')||document.querySelector('main');if(h){if(!h.hasAttribute('tabindex'))h.setAttribute('tabindex','-1');h.focus()}}catch{}}
 function onStatusClick(e){
  const button=e.target.closest?.('[data-store-action]');if(!button)return;
  const action=button.dataset.storeAction;
  if(action==='download-issue'&&issue)download(issue.raw??'',`nightcity-red-original-${new Date().toISOString().slice(0,10)}.json`);
  if(action==='dismiss'){issue=null;paint()}
  if(action==='dismiss-notice'){notice=null;paint();refocus()}
  if(action==='download-notice'&&notice?.id){const raw=readCopy(notice.id);if(raw!==null)download(raw,`nightcity-red-other-tab-${new Date().toISOString().slice(0,10)}.json`)}
  if(action==='take-over')takeOver();
  if(action==='reload'){try{global.location.reload()}catch{}}
  if(action==='reset'){
   if(!global.confirm(word('Заменить нераспознанные данные пустым архивом? Скачайте исходный файл заранее.','Replace the unreadable data with an empty archive? Download the original first.')))return;
   paused=false;issue=null;unsaved=null;failed=false;lastWritten=null;hadArchive=false;
   try{global.localStorage.removeItem(KEY)}catch{}
   paint();
   options.onScopeChange?.(SCOPE);
  }
 }
 function onStorage(e){
  if(e.storageArea&&e.storageArea!==global.localStorage)return;
  // The archive key was removed (or the whole storage cleared) in another tab: that is an erase, never an edit to follow.
  if((e.key===KEY&&e.newValue===null)||e.key===null){if(!issue||kind()!=='newer')markErased();return}
  if(e.key!==KEY||e.newValue===null)return;
  if(erased)return;
  takeExternal(e.newValue);
 }
 // The data was written by another tab: this tab shows it. An edit this tab had queued is not simply discarded: it is set aside.
 function takeExternal(raw){
  if(typeof raw!=='string'||raw===lastWritten)return;
  let next;try{next=JSON.parse(raw)}catch{return}
  // A newer app version in another tab wrote this: stop writing here so this tab cannot overwrite it with older data.
  if(options.isNewer?.(next)){drop('paused');unsaved=null;paused=true;issue={kind:'newer',raw};paint();return}
  if(!options.validate||!options.validate(next))return;
  const unsent=[pending?.snapshot,unsaved].filter(x=>x&&JSON.stringify(x)!==raw);
  if(unsent.length){
   const id=keepOtherTab(unsent[0]);
   notice={kind:'other-tab',id:id||'',pushed:!!id&&pushedOut};
   if(id)try{options.onSetAside?.(id)}catch{}
  }
  drop('replaced');unsaved=null;failed=false;
  lastWritten=raw;
  try{options.apply(next);options.onExternalChange?.()}catch{}
  if(notice)paint();
 }
 /* One tab writes at a time. The first tab takes a lock that lives as long as the page; the others wait for it and meanwhile
    only show the data (they follow what the writing tab saves). When the writing tab closes, the next one takes over and first
    reads what was saved. «Открыть здесь» takes the lock from the other tab on purpose. Where Web Locks do not exist nothing changes. */
 const locks=()=>options.locks||global.navigator?.locks||null;
 function becomeLeader(){
  leader=true;
  if(!follower)return;
  follower=false;
  try{const raw=global.localStorage.getItem(KEY);if(raw!==null)takeExternal(raw)}catch{}
  options.onScopeChange?.(SCOPE);paint();refocus();
 }
 function becomeFollower(){
  leader=false;
  if(!follower){follower=true;if(pending){const job=pending;pending=null;if(timer){clearTimeout(timer);timer=null}
   // An edit accepted before this tab knew it was not the writer is kept, not lost: it is set aside and the person is told.
   let same=false;try{same=JSON.stringify(job.snapshot)===global.localStorage.getItem(KEY)}catch{}
   if(!same){const id=keepOtherTab(job.snapshot);notice={kind:'other-tab',id:id||'',pushed:!!id&&pushedOut};if(id)try{options.onSetAside?.(id)}catch{}}
   for(const resolve of job.waiters)resolve({ok:false,reason:'follower'})}options.onScopeChange?.(null);paint()}
  waitForLock();
 }
 function hold(lock){if(!lock)return undefined;becomeLeader();return new Promise(()=>{})}
 function lost(error){
  // The lock was taken from this tab by «Открыть здесь» in another: what is queued here goes out first, then this tab only shows.
  if(!started||!(error&&error.name==='AbortError'))return;
  flush();becomeFollower();
 }
 function waitForLock(){
  const l=locks();if(!l||queued)return;
  queued=true;
  try{Promise.resolve(l.request(LOCK_NAME,lock=>{queued=false;return hold(lock)})).catch(e=>{queued=false;lost(e)})}catch{queued=false}
 }
 function claimLeadership(){
  const l=locks();if(!l||typeof l.request!=='function')return;
  const attempt=left=>{
   try{Promise.resolve(l.request(LOCK_NAME,{ifAvailable:true},lock=>{
    if(!lock){if(left>0)setTimeout(()=>attempt(left-1),LOCK_RETRY);else becomeFollower();return undefined}
    return hold(lock);
   })).catch(lost)}catch{}
  };
  // A reload hands the lock over a moment late: ask again once before calling this tab a follower.
  attempt(1);
 }
 function takeOver(){
  const l=locks();if(!l||!follower)return;
  try{Promise.resolve(l.request(LOCK_NAME,{steal:true},lock=>hold(lock))).catch(lost)}catch{}
 }
 // Ask the browser not to evict this site's storage; Safari and Chrome may still decline for a site that is not installed.
 function checkPersistence(){
  let answer;
  try{
   const s=global.navigator?.storage;
   if(!s?.persist){persistence='unsupported';answer=Promise.resolve()}
   else{persistence='pending';answer=Promise.resolve(s.persisted?s.persisted():false).then(p=>p||s.persist()).then(p=>{persistence=p===true?'granted':'denied'},()=>{persistence='denied'})}
  }catch{persistence='unsupported';answer=Promise.resolve()}
  answer.then(()=>{try{options.onPersistence?.(persistence)}catch{}});
 }
 function start(){
  if(started)return;
  started=true;
  try{hadArchive=global.localStorage.getItem(KEY)!==null}catch{}
  if(issue&&(kind()==='newer'||!setAside()))paused=true;
  status?.addEventListener('click',onStatusClick);
  global.addEventListener?.('storage',onStorage);
  global.addEventListener?.('pagehide',flush);
  global.document?.addEventListener?.('visibilitychange',()=>{if(global.document.visibilityState==='hidden')flush()});
  checkPersistence();
  paint();
  options.onScopeChange?.(SCOPE);
  claimLeadership();
 }
 return {
  start,save,flush,forget,stateLabel,download,copies,readCopy,removeCopy,keepBeforeRestore,dropOlderBeforeRestore,hasRoom,
  canEdit:()=>started&&!paused&&!follower&&!erased,
  getScope:()=>started&&!paused&&!follower&&!erased?SCOPE:null,
  isFollower:()=>follower,
  halt:markErased,
  isErased:()=>erased,
  takeOver,
  notice:()=>notice?{...notice}:null,
  hasDraft:()=>false,
  hasQueued(){flush();return false},
  refreshLanguage(){paint()},
  persistence:()=>persistence,
  markBackup(){try{global.localStorage.setItem(BACKUP_AT_KEY,new Date().toISOString())}catch{}},
  lastBackup(){try{return global.localStorage.getItem(BACKUP_AT_KEY)}catch{return null}},
 };
}
global.LocalStore={create,KEY,OTHER_TAB_KEY,LOCK_NAME};
})(typeof window!=='undefined'?window:globalThis);
