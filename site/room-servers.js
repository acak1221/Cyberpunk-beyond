/* The «Серверы» section of the online room: which relay servers the room talks to.
   The three public relays of room-transport.js are used out of the box. Here the person can switch one of them off, add servers
   of their own (secure web sockets only, no login or key inside the address) and try each one before relying on it.
   Nothing is contacted until a test button is pressed (and then only that one address); the list is kept in this browser.
   The page that owns the room (room.js) asks for brokers() when it connects and draws card() into its view. */
(function(global){
'use strict';
const KEY='nightcity-red-room-servers-v1',LEGACY_KEY='nightcity-red-room-brokers';
const MAX_CUSTOM=5,MAX_URL=200,TEST_MS=6000;
const T={
 ru:{title:'Серверы',lead:'Комната передаёт только зашифрованные сообщения через публичные серверы-ретрансляторы. Все включённые серверы работают одновременно: достаточно, чтобы отвечал хотя бы один.',seen:'Сервер видит, что устройство подключилось, и тип сообщения (он указан в названии канала), но не содержимое.',def:'по умолчанию',own:'свой',off:'выключен',online:'на связи',connecting:'подключение…',offline:'нет связи',refused:'сервер отказал',idle:'не подключён',test:'Проверить',testing:'Проверяем…',turnOff:'Отключить',turnOn:'Включить',remove:'Убрать',addLabel:'Добавить свой сервер (wss://…)',addPh:'wss://example.org/mqtt',add:'Добавить',reset:'Вернуть серверы по умолчанию',applied:'Изменения применяются сразу; в комнате соединение перезапустится.',added:'Сервер добавлен',removed:'Сервер убран',switchedOff:'Сервер отключён',switchedOn:'Сервер включён',resetDone:'Серверы по умолчанию восстановлены',already:'Уже стоят серверы по умолчанию',
  ok:'Ответил за {ms} мс',slow:'Не ответил за {s} с',refusedTest:'Сервер отказал в подключении',open:'Не удалось открыть соединение',proto:'Ответ не похож на сервер сообщений',
  e_empty:'Введите адрес, начиная с wss://',e_scheme:'Нужен защищённый адрес wss:// (ws:// и https:// не подходят)',e_credentials:'В адресе не должно быть логина, пароля или ключа',e_invalid:'Это не похоже на адрес сервера',e_long:'Адрес слишком длинный',e_dup:'Такой сервер уже в списке',e_many:'Можно добавить не больше {n} своих серверов',e_last:'Должен остаться хотя бы один включённый сервер',oldList:'Список задан старым способом — он продолжает работать как есть.'},
 en:{title:'Servers',lead:'The room sends only encrypted messages, through public relay servers. Every enabled server is used at the same time: it is enough that one of them answers.',seen:'A server sees that a device connected and the type of each message (it is part of the channel name), but not what is inside.',def:'default',own:'yours',off:'off',online:'online',connecting:'connecting…',offline:'no connection',refused:'refused',idle:'not connected',test:'Test',testing:'Testing…',turnOff:'Turn off',turnOn:'Turn on',remove:'Remove',addLabel:'Add your own server (wss://…)',addPh:'wss://example.org/mqtt',add:'Add',reset:'Reset to default servers',applied:'Changes apply at once; inside a room the connection restarts.',added:'Server added',removed:'Server removed',switchedOff:'Server turned off',switchedOn:'Server turned on',resetDone:'Default servers restored',already:'The default servers are already in use',
  ok:'Answered in {ms} ms',slow:'No answer in {s} s',refusedTest:'The server refused the connection',open:'Could not open a connection',proto:'The reply does not look like a message server',
  e_empty:'Enter an address starting with wss://',e_scheme:'A secure wss:// address is needed (ws:// and https:// do not work)',e_credentials:'The address must not contain a login, password or key',e_invalid:'This does not look like a server address',e_long:'The address is too long',e_dup:'This server is already in the list',e_many:'You can add at most {n} servers of your own',e_last:'At least one server must stay on',oldList:'The list was set the old way and keeps working as it is.'},
};
const lang=l=>l==='en'?'en':'ru';
const tx=(l,k,v)=>String((T[lang(l)][k]??T.ru[k]??k)).replace(/\{(\w+)\}/g,(m,n)=>v&&n in v?v[n]:m);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const CRED_QUERY=/(^|[?&])(token|key|apikey|api_key|access_token|auth|authorization|password|passwd|pwd|secret|sig|signature)=/i;

const defaults=()=>(global.RoomTransport?.DEFAULT_BROKERS||[]).map(b=>({...b}));
const defaultUrls=()=>defaults().map(b=>b.url);
const sameUrl=(a,b)=>String(a).toLowerCase()===String(b).toLowerCase();

// An address typed by a person. {ok:true,url} with the address in its stored form, or {ok:false,reason}.
function validate(input,existing=[]){
 const raw=typeof input==='string'?input.trim():'';
 if(!raw)return {ok:false,reason:'empty'};
 if(raw.length>MAX_URL)return {ok:false,reason:'long'};
 if(/\s/.test(raw))return {ok:false,reason:'invalid'};
 const scheme=/^([a-z][a-z0-9+.-]*):/i.exec(raw);
 if(!scheme)return {ok:false,reason:'scheme'};
 if(scheme[1].toLowerCase()!=='wss')return {ok:false,reason:'scheme'};
 let u;try{u=new URL(raw)}catch{return {ok:false,reason:'invalid'}}
 if(u.protocol!=='wss:')return {ok:false,reason:'scheme'};
 if(u.username||u.password||/^wss:\/\/[^/?#]*@/i.test(raw))return {ok:false,reason:'credentials'};
 if(!/^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)*[a-z0-9]([a-z0-9-]*[a-z0-9])?$/i.test(u.hostname)&&!/^\[[0-9a-f:.]+\]$/i.test(u.hostname))return {ok:false,reason:'invalid'};
 if(u.hash)return {ok:false,reason:'invalid'};
 if(CRED_QUERY.test(u.search))return {ok:false,reason:'credentials'};
 const url='wss://'+u.host+(u.pathname==='/'?'':u.pathname)+u.search;
 if([...existing,...defaultUrls()].some(x=>sameUrl(x,url)))return {ok:false,reason:'dup',url};
 return {ok:true,url};
}

/* What is kept: {v:1, custom:[{url}], off:[default urls switched off]}. Anything else in the key is ignored. */
function clean(x){
 if(!x||typeof x!=='object'||Array.isArray(x))return {custom:[],off:[]};
 const known=defaultUrls(),custom=[],off=[];
 for(const c of Array.isArray(x.custom)?x.custom.slice(0,MAX_CUSTOM*2):[]){
  const url=typeof c==='string'?c:c&&typeof c.url==='string'?c.url:'';
  if(!url||url.length>MAX_URL)continue;
  // A saved address is checked again, so a hand-edited value cannot put an insecure or credential-bearing address into use.
  // An entry carried over from the older console list keeps its own form (ws:// and login included): it worked before and must go on working.
  if(c&&typeof c==='object'&&c.kept===true&&/^wss?:\/\/[^\s#]+$/i.test(url)&&!custom.some(k=>sameUrl(k.url,url))&&!defaultUrls().some(k=>sameUrl(k,url))){
   custom.push({url,kept:true,...(typeof c.username==='string'&&c.username.length<=200?{username:c.username}:{}),...(typeof c.password==='string'&&c.password.length<=200?{password:c.password}:{})});
   if(custom.length>=MAX_CUSTOM)break;continue;
  }
  const v=validate(url,custom.map(k=>k.url));
  if(v.ok)custom.push({url:v.url});
  if(custom.length>=MAX_CUSTOM)break;
 }
 for(const o of Array.isArray(x.off)?x.off:[])if(typeof o==='string'&&known.some(k=>sameUrl(k,o))&&!off.includes(known.find(k=>sameUrl(k,o))))off.push(known.find(k=>sameUrl(k,o)));
 if(off.length>=known.length&&!custom.length)off.length=0; // never all of them off (own servers count as enabled ones)
 return {custom,off};
}
// The list the room used before this section existed: a JSON array of {url,username?,password?} set from the console.
function legacy(storage){
 try{const b=JSON.parse(storage.getItem(LEGACY_KEY)||'null');if(Array.isArray(b)&&b.length&&b.every(x=>x&&typeof x.url==='string'&&/^wss?:\/\//.test(x.url)))return b.map(x=>({url:x.url,...(typeof x.username==='string'?{username:x.username}:{}),...(typeof x.password==='string'?{password:x.password}:{})}))}catch{}
 return null;
}
function stored(storage){try{const raw=storage.getItem(KEY);if(raw===null||raw===undefined)return null;return JSON.parse(raw)}catch{return null}}
// What the settings screen shows: {custom, off, old}. `old` is true while only the older list exists.
function load(storage){
 const s=stored(storage);
 if(s&&typeof s==='object'&&!Array.isArray(s))return {...clean(s),old:false};
 const l=legacy(storage);
 if(l){
  const known=defaultUrls();
  return {custom:l.filter(b=>!known.some(k=>sameUrl(k,b.url))).slice(0,MAX_CUSTOM).map(b=>({url:b.url,kept:true,...(b.username!==undefined?{username:b.username}:{}),...(b.password!==undefined?{password:b.password}:{})})),off:known.filter(k=>!l.some(b=>sameUrl(b.url,k))),old:true};
 }
 return {custom:[],off:[],old:false};
}
// The brokers the room connects to, or null for the defaults (the transport's own list).
function brokers(storage){
 const s=stored(storage);
 if(s&&typeof s==='object'&&!Array.isArray(s)){
  const cfg=clean(s);if(!cfg.custom.length&&!cfg.off.length)return null;
  const list=[...defaults().filter(b=>!cfg.off.includes(b.url)),...cfg.custom.map(c=>({url:c.url,...(c.username!==undefined?{username:c.username}:{}),...(c.password!==undefined?{password:c.password}:{})}))];
  return list.length?list:null;
 }
 return legacy(storage);
}
function save(storage,cfg){
 const c=clean(cfg);
 try{
  if(!c.custom.length&&!c.off.length)storage.removeItem(KEY);
  else storage.setItem(KEY,JSON.stringify({v:1,custom:c.custom,off:c.off}));
  storage.removeItem(LEGACY_KEY);
  return true;
 }catch{return false}
}
function reset(storage){try{storage.removeItem(KEY);storage.removeItem(LEGACY_KEY);return true}catch{return false}}

// Changes of the list. Each returns {ok,cfg} or {ok:false,reason}.
function addCustom(cfg,input){
 if(cfg.custom.length>=MAX_CUSTOM)return {ok:false,reason:'many'};
 const v=validate(input,cfg.custom.map(c=>c.url));
 if(!v.ok)return v;
 return {ok:true,url:v.url,cfg:{...cfg,old:false,custom:[...cfg.custom,{url:v.url}]}};
}
function removeCustom(cfg,url){return {ok:true,cfg:{...cfg,old:false,custom:cfg.custom.filter(c=>!sameUrl(c.url,url))}}}
function setDefault(cfg,url,on){
 const known=defaultUrls().find(k=>sameUrl(k,url));if(!known)return {ok:false,reason:'invalid'};
 const off=on?cfg.off.filter(o=>o!==known):[...new Set([...cfg.off,known])];
 // Switching the last enabled server off leaves nothing to connect to.
 if(!on&&defaultUrls().every(k=>off.includes(k))&&!cfg.custom.length)return {ok:false,reason:'last'};
 return {ok:true,cfg:{...cfg,old:false,off}};
}

/* One connection attempt to one address: open the socket, say hello in MQTT and wait for the answer. Nothing is subscribed or
   published. Resolves {ok:true,ms} or {ok:false,reason:'timeout'|'refused'|'open'|'proto'}. */
function test(broker,opts={}){
 const b=typeof broker==='string'?{url:broker}:broker,Impl=opts.WebSocketImpl||global.WebSocket,now=opts.now||(()=>Date.now()),limit=opts.timeoutMs||TEST_MS;
 const T0=now(),set=opts.setTimeout||((f,ms)=>setTimeout(f,ms)),clr=opts.clearTimeout||(id=>clearTimeout(id));
 return new Promise(resolve=>{
  let done=false,ws=null,timer=null;
  const fin=r=>{if(done)return;done=true;clr(timer);try{if(ws){ws.onopen=ws.onmessage=ws.onerror=ws.onclose=null;ws.close()}}catch{}resolve(r)};
  if(!b||typeof b.url!=='string'||!Impl){resolve({ok:false,reason:'open'});return}
  try{ws=new Impl(b.url,'mqtt')}catch{resolve({ok:false,reason:'open'});return}
  try{ws.binaryType='arraybuffer'}catch{}
  const parse=global.RoomTransport.createParser(p=>{if(p.type===2)fin(p.body&&p.body[1]===0?{ok:true,ms:Math.max(0,now()-T0)}:{ok:false,reason:'refused'})});
  const id='ncrt'+Math.random().toString(36).slice(2,10);
  ws.onopen=()=>{try{ws.send(global.RoomTransport.encode.connect({clientId:id,username:b.username,password:b.password,keepalive:30}))}catch{fin({ok:false,reason:'open'})}};
  ws.onmessage=e=>{try{parse(new Uint8Array(e.data))}catch{fin({ok:false,reason:'proto'})}};
  ws.onerror=()=>fin({ok:false,reason:'open'});
  ws.onclose=()=>fin({ok:false,reason:'open'});
  timer=set(()=>fin({ok:false,reason:'timeout'}),limit);
 });
}

/* ---- the card ---- */
const results=new Map(),running=new Set();let message=null;
const key=u=>String(u).toLowerCase();
function note(kind,text){message={kind,text}}
function takeMessage(){const m=message;return m}
function clearMessage(){message=null}
function setResult(url,r){results.set(key(url),{...r,at:Date.now()});running.delete(key(url))}
function startTest(url){running.add(key(url));results.delete(key(url))}
const isRunning=url=>running.has(key(url));
function hostLabel(url){try{const u=new URL(url);return u.host+(u.pathname==='/'?'':u.pathname)}catch{return String(url).slice(0,60)}}
function resultText(l,r){
 if(!r)return '';
 if(r.ok)return tx(l,'ok',{ms:r.ms});
 return r.reason==='timeout'?tx(l,'slow',{s:TEST_MS/1000}):r.reason==='refused'?tx(l,'refusedTest'):r.reason==='proto'?tx(l,'proto'):tx(l,'open');
}
function stateOf(url,states,connected){
 if(!connected)return 'idle';
 const s=states&&states[url];
 return s==='online'||s==='connecting'||s==='refused'||s==='offline'?s:'connecting';
}
/* opts: {lang, storage, states:{url:state}|null (live states of the room's connections), connected:boolean} */
function card(opts){
 const l=lang(opts.lang),cfg=load(opts.storage),connected=!!opts.connected;
 const rows=[];let n=0;
 const row=(b,kind)=>{
  const url=b.url,off=kind==='def'&&cfg.off.includes(url),st=off?'off':stateOf(url,opts.states,connected),r=results.get(key(url)),busy=running.has(key(url)),i=n++;
  const dot=st==='online'?'on':st==='refused'||st==='offline'?'bad':'';
  const label=tx(l,kind==='def'?'def':'own');
  const lastEnabled=kind==='def'&&!off&&!cfg.custom.length&&defaultUrls().filter(k=>!cfg.off.includes(k)).length<=1;
  rows.push(`<li class="rs-row" data-state="${esc(st)}"><span class="room-dot ${dot}" aria-hidden="true"></span><div class="rs-name"><b>${esc(hostLabel(url))}</b><small>${esc(label)} · ${esc(tx(l,st))}${r?' · '+esc(resultText(l,r)):''}</small></div><div class="rs-actions"><button type="button" class="btn ghost small" data-room-action="srv-test" data-url="${esc(url)}" data-room-field="srv-test-${i}" ${busy?'aria-busy="true"':''}>${esc(tx(l,busy?'testing':'test'))}</button>${kind==='def'?`<button type="button" class="btn ghost small" data-room-action="srv-default" data-url="${esc(url)}" data-on="${off?'1':'0'}" data-room-field="srv-switch-${i}" ${lastEnabled?'disabled':''}>${esc(tx(l,off?'turnOn':'turnOff'))}</button>`:`<button type="button" class="btn ghost small" data-room-action="srv-remove" data-url="${esc(url)}" data-room-field="srv-remove-${i}">${esc(tx(l,'remove'))}</button>`}</div></li>`);
 };
 for(const b of defaults())row(b,'def');
 for(const c of cfg.custom)row(c,'own');
 const m=message;
 const msg=`<p class="rs-msg ${m?esc(m.kind):''}" role="${m&&m.kind==='bad'?'alert':'status'}" data-rs-msg>${m?esc(m.text):''}</p>`;
 return `<section class="card room-servers" data-room-servers><div class="card-heading"><span>${esc(tx(l,'title'))}</span><span>RELAYS</span></div><p>${esc(tx(l,'lead'))}</p><p class="room-muted">${esc(tx(l,'seen'))}</p><ul class="rs-list">${rows.join('')}</ul>${cfg.old?`<p class="room-muted">${esc(tx(l,'oldList'))}</p>`:''}<div class="rs-add"><label class="field">${esc(tx(l,'addLabel'))}<input id="room-server-url" type="url" inputmode="url" maxlength="${MAX_URL}" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${esc(tx(l,'addPh'))}"></label><button type="button" class="btn primary" data-room-action="srv-add" data-room-field="srv-add">${esc(tx(l,'add'))}</button></div>${msg}<div class="rs-foot"><button type="button" class="btn ghost" data-room-action="srv-reset" data-room-field="srv-reset">${esc(tx(l,'reset'))}</button><small class="room-muted">${esc(tx(l,'applied'))}</small></div></section>`;
}

global.RoomServers={KEY,LEGACY_KEY,MAX_CUSTOM,TEXT:T,validate,clean,load,brokers,save,reset,addCustom,removeCustom,setDefault,test,card,tx,note,takeMessage,clearMessage,startTest,isRunning,setResult,hostLabel,resultText,stateOf};
})(typeof window!=='undefined'?window:globalThis);
