/* Settings: one page (#/settings) for everything that used to be scattered over the menu and the dice page.
   Look, theme, language, role, dice sound, shaking and vibration, keeping the screen on, installing, the state of the backup,
   how much room the browser has left, the news, the introduction, the version, and a two-step «erase this device».

   Nothing is stored here: each control writes through the module that owns the setting (native.js, theme-switch.js,
   role-mode.js, dice-feel.js, keep-awake.js, transfer.js), so the menu, the dice page and this page always agree.
   The pure parts (key list, byte counts, the erase gate and the erase itself) are exported for tests. */
(function(global){
'use strict';
const doc=global.document;
const DAY=864e5;
// Everything this app keeps in the browser starts with one of these. Cache names (nc-red-…) are not storage keys.
const KEY_PATTERN=/^(nc-|nightcity-red)/;
const DATABASES=['nightcity-red-citymap','nc-room-identity'];
const WARN_AT=0.8;           // the share of the room that raises the warning
const FRESH_MS=DAY;          // a backup file counts as fresh for one day, if nothing changed since
const WORDS={ru:'СТЕРЕТЬ',en:'ERASE'};

const T={
 ru:{
  title:'Настройки',lead:'Всё, что можно подстроить под себя, собрано здесь. Настройки хранятся только в этом браузере и не попадают в резервные копии.',
  look:'Оформление',lookLabel:'Вид приложения',looks:{native:'Обычное',board:'Досье',cyber:'Киберпанк'},
  themeLabel:'Тема',themes:{auto:'Авто',dark:'Тёмная',light:'Светлая',black:'Чёрная'},themeHelp:'Чёрная тема полностью чёрная: на экранах OLED она экономит заряд.',
  mini:'Компактное меню',miniHelp:'На широком экране в меню остаются только значки.',
  people:'Язык и роль',langLabel:'Язык',roleHelp:'Роль только меняет, что показывать первым. Ваши данные от неё не зависят.',
  feel:'Кубики и отклик',shakeNo:'Недоступно: на этом устройстве нет датчика движения.',
  screen:'Экран и установка',awakeHelp:'Пока приложение открыто, экран не гаснет. Удобно, когда телефон лежит на столе.',awakeNo:'Этот браузер не умеет удерживать экран включённым.',
  install:'Установить приложение',installed:'Приложение уже установлено на это устройство.',installIOS:'На iPhone и iPad: нажмите «Поделиться» и выберите «На экран “Домой”».',installNo:'Сейчас установка недоступна: браузер её не предлагает.',
  data:'Копии и память',backupNever:'Копия в файл ещё не делалась.',backupLast:(d,n)=>`Последняя копия: ${d}${n?` (${n} дн. назад)`:' (сегодня)'}.`,backupDue:'Пора сделать новую копию.',backupNone:'Пока нечего сохранять: персонажей и кампаний нет.',
  download:'Скачать копию',transfer:'Перенос и копии',remind:'Напоминать о копии',remindOpts:{7:'Каждые 7 дней',14:'Каждые 14 дней',30:'Каждые 30 дней',0:'Не напоминать'},
  storage:'Память браузера',storageWait:'Считаю…',storageNo:'Браузер не сообщает, сколько места занято.',
  storageLine:(used,quota,pct)=>`Занято ${used} из ${quota} (${pct}).`,appData:b=>`Данные приложения: примерно ${b}.`,
  storageWarn:'Места почти не осталось. Скачайте копию и освободите место, иначе новые записи могут не сохраниться.',
  persistYes:'Браузер обещает не удалять данные сам.',persistNo:'Браузер может удалить данные, если на устройстве не хватит места.',persistAsk:'Попросить браузер хранить данные',persistGot:'Готово: браузер будет хранить данные.',persistDenied:'Браузер не согласился. Делайте копии почаще.',
  about:'О приложении',version:'Версия',build:'сборка',news:'Что нового',intro:'Показать знакомство снова',
  danger:'Стереть данные на этом устройстве',dangerHelp:'Удалит из этого браузера персонажей, кампании, заметки и настройки. Файлы копий, которые вы скачали, останутся у вас. Отменить стирание нельзя.',
  eraseOpen:'Стереть данные…',eraseStep:'Шаг 2 из 2: подтверждение',freshYes:d=>`Свежая копия есть: ${d}.`,freshNo:'Свежей копии нет: либо её не делали за последние сутки, либо после неё что-то изменилось.',
  tick:'У меня нет свежей копии, и я понимаю, что данные пропадут безвозвратно.',typeLabel:w=>`Введите слово «${w}», чтобы подтвердить`,go:'Стереть всё',cancel:'Отмена',
  refuse:'Сначала скачайте свежую копию или поставьте отметку выше.',erased:'Данные стёрты. Страница перезагрузится.',erasing:'Стираю…'
 },
 en:{
  title:'Settings',lead:'Everything you can adjust is gathered here. Settings stay in this browser only and are not part of backups.',
  look:'Appearance',lookLabel:'Look of the app',looks:{native:'Clean',board:'Dossier',cyber:'Cyberpunk'},
  themeLabel:'Theme',themes:{auto:'Auto',dark:'Dark',light:'Light',black:'Black'},themeHelp:'The black theme is fully black: on OLED screens it saves battery.',
  mini:'Compact menu',miniHelp:'On a wide screen the menu keeps only its icons.',
  people:'Language and role',langLabel:'Language',roleHelp:'The role only changes what is shown first. Your data does not depend on it.',
  feel:'Dice and feedback',shakeNo:'Unavailable: this device has no motion sensor.',
  screen:'Screen and install',awakeHelp:'While the app is open the screen stays lit. Handy when the phone lies on the table.',awakeNo:'This browser cannot keep the screen on.',
  install:'Install the app',installed:'The app is already installed on this device.',installIOS:'On iPhone and iPad: tap Share and choose “Add to Home Screen”.',installNo:'Installing is not available right now: the browser does not offer it.',
  data:'Backups and storage',backupNever:'No backup file has been made yet.',backupLast:(d,n)=>`Last backup: ${d}${n?` (${n} ${n===1?'day':'days'} ago)`:' (today)'}.`,backupDue:'Time for a fresh backup.',backupNone:'Nothing to save yet: there are no characters or campaigns.',
  download:'Download backup',transfer:'Transfer and backups',remind:'Remind me to back up',remindOpts:{7:'Every 7 days',14:'Every 14 days',30:'Every 30 days',0:'Do not remind'},
  storage:'Browser storage',storageWait:'Counting…',storageNo:'The browser does not say how much room is used.',
  storageLine:(used,quota,pct)=>`Used ${used} of ${quota} (${pct}).`,appData:b=>`App data: about ${b}.`,
  storageWarn:'Almost no room is left. Download a backup and free some space, or new changes may not be saved.',
  persistYes:'The browser promises not to delete the data on its own.',persistNo:'The browser may delete the data when the device runs low on space.',persistAsk:'Ask the browser to keep the data',persistGot:'Done: the browser will keep the data.',persistDenied:'The browser did not agree. Back up more often.',
  about:'About',version:'Version',build:'build',news:'What’s new',intro:'Show the introduction again',
  danger:'Erase data on this device',dangerHelp:'Removes characters, campaigns, notes and settings from this browser. Backup files you downloaded stay with you. Erasing cannot be undone.',
  eraseOpen:'Erase data…',eraseStep:'Step 2 of 2: confirm',freshYes:d=>`A fresh backup exists: ${d}.`,freshNo:'There is no fresh backup: none was made in the last day, or something changed after it.',
  tick:'I have no fresh backup, and I understand the data will be lost for good.',typeLabel:w=>`Type the word “${w}” to confirm`,go:'Erase everything',cancel:'Cancel',
  refuse:'First download a fresh backup or tick the box above.',erased:'Data erased. The page will reload.',erasing:'Erasing…'
 }
};
const L=lang=>lang==='en'?'en':'ru';
const t=(lang,k)=>T[L(lang)][k];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/* ---------- Pure helpers ---------- */
function appKeys(storage){
 const out=[];
 try{for(let i=0;i<storage.length;i++){const k=storage.key(i);if(typeof k==='string'&&KEY_PATTERN.test(k))out.push(k)}}catch{}
 return out;
}
// Two bytes per character is how browsers count localStorage; it is an estimate for the player, not an exact figure.
function appBytes(storage){
 let n=0;
 for(const k of appKeys(storage)){try{n+=(k.length+String(storage.getItem(k)??'').length)*2}catch{}}
 return n;
}
function formatBytes(n,lang){
 const ru=L(lang)==='ru',v=Math.max(0,Number(n)||0),u=ru?['Б','КБ','МБ','ГБ','ТБ']:['B','KB','MB','GB','TB'];
 let i=0,x=v;while(x>=1024&&i<u.length-1){x/=1024;i++}
 const s=i===0?String(Math.round(x)):(x>=100?x.toFixed(0):x>=10?x.toFixed(1):x.toFixed(2)).replace(/\.?0+$/,'');
 return (ru?s.replace('.',','):s)+' '+u[i];
}
function percent(usage,quota,lang){
 const p=quota>0?usage/quota*100:0,s=p>=10?p.toFixed(0):p>=1?p.toFixed(1):p.toFixed(2).replace(/0+$/,'').replace(/\.$/,'');
 return (L(lang)==='ru'?s.replace('.',','):s)+' %';
}
// 'warn' when the browser is close to its limit for this site.
function storageLevel(usage,quota){return quota>0&&usage/quota>=WARN_AT?'warn':'ok'}
// A backup file made in the last day, with nothing changed after it, is fresh. Without one the player must tick the box.
function eraseGate({at,changes=0,now=Date.now(),tick=false}={}){
 const made=typeof at==='number'&&Number.isFinite(at),fresh=made&&now-at>=0&&now-at<=FRESH_MS&&!(changes>0);
 return {fresh,allowed:fresh||tick===true};
}
const confirmWord=lang=>WORDS[L(lang)];
function confirmOk(typed){const s=String(typed??'').trim().toLocaleUpperCase();return s===WORDS.ru||s===WORDS.en}
// Removes only what this app stored. Cache names, other sites and the backup files the player downloaded are not touched.
function erase({storage=global.localStorage,indexedDB=global.indexedDB,session=global.sessionStorage}={}){
 const keys=appKeys(storage);let removed=0;
 for(const k of keys){try{storage.removeItem(k);removed++}catch{}}
 // Unsaved drafts (campaign notes, roll tables, the room's sent marker) live in the tab's session storage and survive a reload.
 let sessionRemoved=0;
 if(session)for(const k of appKeys(session)){try{session.removeItem(k);sessionRemoved++}catch{}}
 const dbs=[];
 for(const name of DATABASES){try{if(indexedDB?.deleteDatabase){indexedDB.deleteDatabase(name);dbs.push(name)}}catch{}}
 return {removed,keys,sessionRemoved,databases:dbs};
}
// After the erase the page is still alive until it reloads, and the store writes its last snapshot when the page is hidden.
// From here on this app's keys are not written any more, so the erased archive cannot come back.
let frozen=false,origSetItem=null;
function freezeWrites(proto=global.Storage?.prototype){
 frozen=true;
 try{
  if(proto&&!origSetItem){
   origSetItem=proto.setItem;
   proto.setItem=function(k,v){if(frozen&&typeof k==='string'&&KEY_PATTERN.test(k))return;return origSetItem.call(this,k,v)};
  }
 }catch{}
 return frozen;
}
const isFrozen=()=>frozen;
function backupInfo(){
 try{
  const s=global.Transfer?.status?.();if(!s)return null;
  return {at:typeof s.at==='number'?s.at:null,days:s.days,changes:Number(s.changes)||0,due:!!s.due,hasData:s.hasData!==false,remindDays:s.meta?.days};
 }catch{return null}
}

/* ---------- View ---------- */
// Memory of the page between redraws: the erase panel, the tick and what was typed.
const ui={erase:false,tick:false,typed:'',busy:false};
const seg=(label,items)=>`<div class="set-seg" role="group" aria-label="${esc(label)}">${items.join('')}</div>`;
const row=(id,title,help,control)=>`<div class="set-row"><div class="set-text"><strong id="${id}">${esc(title)}</strong>${help?`<span class="set-hint">${esc(help)}</span>`:''}</div><div class="set-control">${control}</div></div>`;
const card=(id,title,body,cls='')=>`<section class="card set-card ${cls}" aria-labelledby="${id}"><h2 id="${id}" class="set-title">${esc(title)}</h2>${body}</section>`;

function lookRow(lang){
 const now=global.NativeUI?.currentStyle?.()||'native';
 return row('set-look-l',t(lang,'lookLabel'),'',seg(t(lang,'lookLabel'),['native','board','cyber'].map(s=>`<button type="button" data-ui-style="${s}" aria-pressed="${now===s}"${now===s?' class="active"':''}>${esc(t(lang,'looks')[s])}</button>`)));
}
function themeRow(lang){
 const mode=global.ThemeSwitch?.get?.()||'auto',names=t(lang,'themes');
 const note=global.ThemeSwitch?.note?.(L(lang))||'';
 return row('set-theme-l',t(lang,'themeLabel'),t(lang,'themeHelp'),seg(t(lang,'themeLabel'),['auto','dark','light','black'].map(m=>`<button type="button" data-ui-theme="${m}" aria-pressed="${mode===m}"${mode===m?' class="active"':''}>${esc(names[m])}</button>`)))
  +`<p class="set-warn" id="set-theme-note" role="status" data-set-theme-note${note?'':' hidden'}>${esc(note)}</p>`;
}
function miniRow(lang){
 const on=!!global.ShellUI?.isMini?.();
 return `<div class="set-row set-desktop"><label class="set-check"><input type="checkbox" data-set-input="mini" ${on?'checked':''}><span><strong>${esc(t(lang,'mini'))}</strong><span class="set-hint">${esc(t(lang,'miniHelp'))}</span></span></label></div>`;
}
function langRow(lang){
 return row('set-lang-l',t(lang,'langLabel'),'',seg(t(lang,'langLabel'),['ru','en'].map(l=>`<button type="button" data-action="lang" data-lang="${l}" aria-pressed="${L(lang)===l}"${L(lang)===l?' class="active"':''}>${l==='ru'?'Русский':'English'}</button>`)));
}
function screenBody(lang){
 const K=global.KeepAwake;let awake='';
 if(K?.supported?.())awake=`<div class="set-row">${K.button(lang)}<span class="set-hint">${esc(t(lang,'awakeHelp'))}</span></div>`;
 else awake=`<p class="set-hint">${esc(t(lang,'awakeNo'))}</p>`;
 const P=global.PWA;let inst;
 if(P?.isStandalone?.())inst=`<p class="set-hint">${esc(t(lang,'installed'))}</p>`;
 else if(P?.canInstall?.())inst=`<div class="set-row"><button type="button" class="btn" data-shell="install">⤓ ${esc(t(lang,'install'))}</button></div>`;
 else if(P?.isIOS?.())inst=`<p class="set-hint">${esc(t(lang,'installIOS'))}</p>`;
 else inst=`<p class="set-hint">${esc(t(lang,'installNo'))}</p>`;
 return awake+inst;
}
function dateText(ms,lang){try{return new Date(ms).toLocaleDateString(L(lang)==='ru'?'ru-RU':'en-GB')}catch{return ''}}
function backupLine(lang,b){
 if(!b)return '';
 if(!b.hasData&&b.at===null)return t(lang,'backupNone');
 if(b.at===null)return t(lang,'backupNever')+(b.due?' '+t(lang,'backupDue'):'');
 return t(lang,'backupLast')(dateText(b.at,lang),b.days||0)+(b.due?' '+t(lang,'backupDue'):'');
}
function dataBody(lang){
 const b=backupInfo(),days=[7,14,30,0],cur=Number.isFinite(b?.remindDays)?b.remindDays:14;
 const opts=days.map(d=>`<option value="${d}"${d===cur?' selected':''}>${esc(t(lang,'remindOpts')[d])}</option>`).join('');
 const line=backupLine(lang,b);
 return `<div class="set-block">${line?`<p class="set-line${b?.due?' set-warn':''}" data-set-backup>${esc(line)}</p>`:''}<div class="set-actions"><button type="button" class="btn" data-action="export-backup">↓ ${esc(t(lang,'download'))}</button><button type="button" class="btn ghost" data-action="navigate" data-view="characters" data-xfer-open>${esc(t(lang,'transfer'))} →</button></div>${global.Transfer?`<label class="set-field"><span>${esc(t(lang,'remind'))}</span><select data-set-input="days">${opts}</select></label>`:''}</div>`
  +`<div class="set-block"><h3 class="set-sub">${esc(t(lang,'storage'))}</h3><p class="set-line" data-set-storage role="status">${esc(t(lang,'storageWait'))}</p></div>`;
}
function aboutBody(lang){
 const v=global.WhatsNew?.APP_VERSION||'2.0',b=doc?.documentElement?.dataset?.build||'';
 return `<p class="set-line" data-set-version>${esc(t(lang,'version'))} ${esc(v)}${b?` · ${esc(t(lang,'build'))} ${esc(b)}`:''}</p><div class="set-actions">${global.WhatsNew?`<button type="button" class="btn ghost" data-action="navigate" data-view="news">${esc(t(lang,'news'))}</button>`:''}${global.Onboarding?.showAgain?`<button type="button" class="btn ghost" data-set="intro">${esc(t(lang,'intro'))}</button>`:''}</div>`;
}
function dangerBody(lang){
 const help=`<p class="set-hint">${esc(t(lang,'dangerHelp'))}</p>`;
 if(!ui.erase)return help+`<div class="set-actions"><button type="button" class="btn danger" data-set="erase-open">${esc(t(lang,'eraseOpen'))}</button></div>`;
 const b=backupInfo(),g=eraseGate({at:b?.at,changes:b?.changes,tick:ui.tick}),w=confirmWord(lang);
 const fresh=eraseGate({at:b?.at,changes:b?.changes}).fresh;
 const ok=g.allowed&&confirmOk(ui.typed);
 return help+`<div class="set-erase" data-set-erase><h3 class="set-sub" id="set-erase-title" tabindex="-1">${esc(t(lang,'eraseStep'))}</h3><p class="set-line" data-set-fresh>${esc(fresh?t(lang,'freshYes')(dateText(b.at,lang)):t(lang,'freshNo'))}</p>${fresh?'':`<label class="set-check"><input type="checkbox" data-set-input="tick" ${ui.tick?'checked':''}><span>${esc(t(lang,'tick'))}</span></label>`}<div class="set-actions"><button type="button" class="btn ghost" data-action="export-backup">↓ ${esc(t(lang,'download'))}</button></div><label class="set-field"><span>${esc(t(lang,'typeLabel')(w))}</span><input type="text" data-set-input="typed" value="${esc(ui.typed)}" autocomplete="off" autocapitalize="characters" spellcheck="false"></label><p class="set-warn" role="alert" data-set-erase-msg hidden></p><div class="set-actions"><button type="button" class="btn danger" data-set="erase-go" ${ok?'':'disabled'}>${esc(t(lang,'go'))}</button><button type="button" class="btn ghost" data-set="erase-cancel">${esc(t(lang,'cancel'))}</button></div></div>`;
}
// Shaking needs a motion sensor. A desktop browser knows the motion API but never feels a shake, and its permission call answers «no»,
// so the switch would only snap back. The sensor is detected, not guessed from the pointer: a real reading (a number) proves it, an
// event with only nulls (what a desktop fires) proves its absence, iOS asks for permission, and until an event came the pointer decides.
const motion={seen:false,none:false};
try{global.addEventListener?.('devicemotion',e=>{const a=e&&e.accelerationIncludingGravity,r=e&&e.rotationRate;
 if([a?.x,a?.y,a?.z,r?.alpha,r?.beta,r?.gamma].some(v=>typeof v==='number'))motion.seen=true;else motion.none=true},{passive:true})}catch{}
function shakeUsable(){
 if(!global.DiceFeel?.supported?.())return false;
 if(motion.seen)return true;
 if(typeof global.DeviceMotionEvent?.requestPermission==='function')return true;
 if(motion.none)return false;
 try{if(typeof global.matchMedia==='function')return !!(global.matchMedia('(pointer: coarse)').matches||global.matchMedia('(any-pointer: coarse)').matches)}catch{}
 return true;
}
function feelControls(lang){
 const html=global.DiceFeel.controls(lang,{haptics:true});
 if(shakeUsable())return html;
 const name=esc(global.DiceFeel.t?.(lang,'shake')||''),why=esc(t(lang,'shakeNo'));
 return html.replace(/<label class="haptics-toggle"><input type="checkbox" data-dice-shake[^>]*>[^<]*<\/label>(<small class="dice-feel-help">[^<]*<\/small>)?/,
  `<label class="haptics-toggle set-unavailable"><input type="checkbox" disabled aria-describedby="set-shake-why" data-set-shake-na> ${name}</label><small class="dice-feel-help" id="set-shake-why">${why}</small>`);
}
function render(lang){
 lang=L(lang);
 const feel=global.DiceFeel?.controls?card('set-feel-h',t(lang,'feel'),feelControls(lang)):'';
 const html=`<div class="page-header"><div><div class="overline">SETTINGS</div><h1>${esc(t(lang,'title'))}</h1><p>${esc(t(lang,'lead'))}</p></div></div><div class="set-page">`
  +card('set-look-h',t(lang,'look'),lookRow(lang)+themeRow(lang)+miniRow(lang))
  +card('set-people-h',t(lang,'people'),langRow(lang)+(global.RoleMode?.switchHTML?row('set-role-l',global.RoleMode.t?.(lang,'switchLabel')||'',t(lang,'roleHelp'),global.RoleMode.switchHTML(lang)):''))
  +feel
  +card('set-screen-h',t(lang,'screen'),screenBody(lang))
  +card('set-data-h',t(lang,'data'),dataBody(lang))
  +card('set-about-h',t(lang,'about'),aboutBody(lang))
  +card('set-danger-h',t(lang,'danger'),dangerBody(lang),'set-danger')
  +'</div>';
 // The room left in the browser is asked for after the page is in the document.
 global.setTimeout?.(()=>fillStorage(lang),0);
 return html;
}

/* ---------- Storage figures ---------- */
async function storageText(lang,nav=global.navigator,storage=global.localStorage){
 const app=appBytes(storage);let out={level:'ok',text:'',persist:null};
 let est=null;
 try{est=await nav?.storage?.estimate?.()}catch{}
 if(!est||!Number.isFinite(est.quota)||!Number.isFinite(est.usage))return {level:'ok',text:t(lang,'storageNo')+' '+t(lang,'appData')(formatBytes(app,lang)),persist:null};
 out.level=storageLevel(est.usage,est.quota);
 out.text=t(lang,'storageLine')(formatBytes(est.usage,lang),formatBytes(est.quota,lang),percent(est.usage,est.quota,lang))+' '+t(lang,'appData')(formatBytes(app,lang));
 try{if(typeof nav?.storage?.persisted==='function')out.persist=!!(await nav.storage.persisted())}catch{}
 return out;
}
async function fillStorage(lang){
 const el=doc?.querySelector?.('[data-set-storage]');if(!el)return;
 const r=await storageText(lang);
 const now=doc.querySelector('[data-set-storage]');if(!now)return; // the page was left meanwhile
 now.textContent=r.text;now.classList.toggle('set-warn',r.level==='warn');
 let extra=now.parentElement?.querySelector?.('[data-set-storage-extra]');
 if(!extra){extra=doc.createElement('div');extra.setAttribute('data-set-storage-extra','');now.after(extra)}
 let html='';
 if(r.level==='warn')html+=`<p class="set-warn" role="alert">${esc(t(lang,'storageWarn'))}</p>`;
 if(r.persist===true)html+=`<p class="set-hint" tabindex="-1" data-set-persist-line>${esc(t(lang,'persistYes'))}</p>`;
 else if(r.persist===false)html+=`<p class="set-hint">${esc(t(lang,'persistNo'))}</p><div class="set-actions"><button type="button" class="btn ghost" data-set="persist">${esc(t(lang,'persistAsk'))}</button></div>`;
 extra.innerHTML=html;
}

/* ---------- Actions ---------- */
const pageLang=()=>{try{return L(global.App?.lang?.())}catch{return 'ru'}};
const onPage=()=>!!doc?.querySelector?.('.set-page');
function redraw(focus){
 try{global.App?.render?.()}catch{}
 if(focus)global.setTimeout?.(()=>{try{doc.querySelector(focus)?.focus?.({preventScroll:true})}catch{}},0);
}
function say(text){
 const m=doc?.querySelector?.('[data-set-erase-msg]');if(!m)return;
 m.textContent=text;m.hidden=!text;
}
function syncGo(){
 const go=doc?.querySelector?.('[data-set="erase-go"]');if(!go)return;
 const b=backupInfo(),g=eraseGate({at:b?.at,changes:b?.changes,tick:ui.tick});
 go.disabled=!(g.allowed&&confirmOk(ui.typed));
}
const wait=ms=>new Promise(r=>global.setTimeout(r,ms));
async function runErase(){
 if(ui.busy)return false;
 const lang=pageLang(),b=backupInfo(),g=eraseGate({at:b?.at,changes:b?.changes,tick:ui.tick});
 if(!g.allowed){say(t(lang,'refuse'));return false}
 if(!confirmOk(ui.typed))return false;
 ui.busy=true;say(t(lang,'erasing'));
 // A save that is still waiting in the store is written first, so it cannot come back after the erase.
 await wait(450);
 freezeWrites();
 erase({});
 ui.erase=false;ui.tick=false;ui.typed='';ui.busy=false;
 say(t(lang,'erased'));
 try{global.location.replace(global.location.pathname+global.location.search)}catch{}
 return true;
}
doc?.addEventListener?.('click',async e=>{
 const el=e.target?.closest?.('[data-set]');
 if(!el){
  // The app's own download action: the backup status and the erase gate follow it.
  if(e.target?.closest?.('[data-action="export-backup"]')&&onPage())global.setTimeout?.(()=>{if(onPage()&&!ui.busy)redraw()},500);
  return;
 }
 const what=el.dataset.set;
 if(what==='erase-open'){ui.erase=true;ui.tick=false;ui.typed='';redraw('#set-erase-title')}
 else if(what==='erase-cancel'){ui.erase=false;ui.tick=false;ui.typed='';redraw('[data-set="erase-open"]')}
 else if(what==='erase-go')runErase();
 else if(what==='intro'){global.Onboarding?.showAgain?.()}
 else if(what==='persist'){
  const lang=pageLang();let ok=false;
  try{ok=!!(await global.navigator.storage.persist())}catch{}
  global.App?.notify?.(t(lang,ok?'persistGot':'persistDenied'));
  // The row under the button is drawn again: the focus stays on the button, or on the line that took its place.
  await fillStorage(lang);
  try{(doc.querySelector('[data-set="persist"]')||doc.querySelector('[data-set-persist-line]'))?.focus?.({preventScroll:true})}catch{}
 }
});
doc?.addEventListener?.('change',e=>{
 const el=e.target?.closest?.('[data-set-input]');if(!el)return;
 const what=el.dataset.setInput;
 if(what==='mini'){global.ShellUI?.setMini?.(!!el.checked)}
 else if(what==='days'){global.Transfer?.setDays?.(el.value)}
 else if(what==='tick'){ui.tick=!!el.checked;syncGo()}
});
doc?.addEventListener?.('input',e=>{
 const el=e.target?.closest?.('[data-set-input="typed"]');if(!el)return;
 ui.typed=String(el.value||'').slice(0,40);syncGo();
});
// Escape cancels the second step of the erase, like any other dialog, and the focus goes back to the button that opened it.
doc?.addEventListener?.('keydown',e=>{
 if(e.key!=='Escape'||e.defaultPrevented||!ui.erase||ui.busy||!onPage())return;
 e.preventDefault?.();ui.erase=false;ui.tick=false;ui.typed='';redraw('[data-set="erase-open"]');
});
// Leaving the page closes the erase panel for the next visit.
const closeErase=()=>{if(!ui.busy){ui.erase=false;ui.tick=false;ui.typed=''}};
doc?.addEventListener?.('click',e=>{const n=e.target?.closest?.('[data-action="navigate"]');if(n&&n.dataset?.view!=='settings')closeErase()},true);
const leaving=()=>{if(!String(global.location?.hash||'').startsWith('#/settings'))closeErase()};
// The install offer can arrive after the page was drawn: the install row follows it.
for(const ev of ['beforeinstallprompt','appinstalled'])global.addEventListener?.(ev,()=>global.setTimeout?.(()=>{if(onPage()&&!ui.busy&&!ui.erase)redraw()},300));
global.addEventListener?.('hashchange',leaving);global.addEventListener?.('popstate',leaving);

global.Settings={T,t,render,freezeWrites,isFrozen,appKeys,appBytes,formatBytes,percent,storageLevel,storageText,eraseGate,confirmWord,confirmOk,erase,
 KEY_PATTERN,DATABASES,WARN_AT,FRESH_MS,WORDS,_test:{ui,runErase,fillStorage,backupLine,closeErase,shakeUsable,motion}};
})(typeof window!=='undefined'?window:globalThis);
