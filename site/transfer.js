/* Moving the whole archive between devices and keeping copies ("Перенос и копии").
   - plan(): what an archive would add, update or leave alone, worked out before anything is written.
   - reminder: remembers how much changed since the last backup file and asks for a new one after N days or N changes.
   - device to device: a one-time pairing code and the room transport (room-transport.js).
     Why not chunked QR codes: reading them needs a camera decoder, which Safari and Firefox do not have built in and the app
     may not add as a dependency, and an archive with portraits is hundreds of kilobytes — hundreds of QR frames.
     The transport is already here, works in every browser, and the brokers only ever see ciphertext: the code never leaves
     the two devices, and both the AES-GCM key and the mailbox name come out of PBKDF2 over it.
     Failure is safe because a transfer only ever delivers a file into memory: nothing is written until every chunk has
     arrived, the SHA-256 of the whole matches, the archive parses, and the user has seen the preview and chosen what to do.
   Everything that writes goes through window.App.archive (app.js), which keeps a snapshot for undo and reverts on a failed write. */
(function(global){
'use strict';
const META_KEY='nightcity-red-transfer-v1';
const CHANGES_DUE=40,SNOOZE_DAYS=3,DAY=864e5,DAY_CHOICES=[7,14,30,0];
const ALPHABET='23456789ABCDEFGHJKMNPQRSTUVWXYZ',CODE_LENGTH=12;
const SECTION_KEYS=['netArchitectures','gmWorkspace','gmExtras'];
const MAX_BYTES=64*1024*1024,MAX_CHUNKS=20000;
const te=new TextEncoder(),td=new TextDecoder();

/* ---------- plan: pure ---------- */
// JSON with sorted keys, so two copies of the same record compare equal whatever order their fields were written in.
function canon(v){
 if(v===null||typeof v!=='object')return JSON.stringify(v)??'null';
 if(Array.isArray(v))return '['+v.map(canon).join(',')+']';
 return '{'+Object.keys(v).filter(k=>v[k]!==undefined).sort().map(k=>JSON.stringify(k)+':'+canon(v[k])).join(',')+'}';
}
const isObj=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
const defaultUid=c=>typeof c?.extra?.uid==='string'&&c.extra.uid?c.extra.uid:typeof c?.id==='string'?c.id:'';
const defaultEditTime=c=>{const t=c?.extra?.updatedAt;return Number.isFinite(t)&&t>0?t:null};
const defaultBlank=(key,v)=>v==null||Array.isArray(v)&&!v.length||isObj(v)&&!Object.keys(v).length;
// A sheet without what differs between devices by design: its local id and the note of where it was imported from.
function sheetBody(c,uid){const {id,...rest}=c||{};const extra=isObj(rest.extra)?{...rest.extra}:{};delete extra.sourceKey;extra.uid=uid;return canon({...rest,extra})}
// A campaign without local ids; player characters are named by their sheet uid so the same campaign matches on both devices.
function campaignBody(k,uidOf){const {id,...rest}=k||{};return canon({...rest,notes:rest.notes||'',roster:(Array.isArray(rest.roster)?rest.roster:[]).map(r=>{const {id:rid,...entry}=r||{};return entry.kind==='pc'?{...entry,characterId:uidOf(entry.characterId)}:entry})})}
const label=v=>typeof v==='string'&&v.trim()?v.trim().slice(0,80):'';

function plan(local,incoming,helpers={}){
 const uid=helpers.uid||defaultUid,editTime=helpers.editTime||defaultEditTime,shape=helpers.shape||(c=>c),blank=helpers.blank||defaultBlank,campaignOk=helpers.campaignOk||(()=>true);
 const mine=Array.isArray(local?.characters)?local.characters:[],theirs=Array.isArray(incoming?.characters)?incoming.characters:[];
 const byUid=new Map();for(const c of mine){const u=uid(c);if(u&&!byUid.has(u))byUid.set(u,c)}
 const used=new Set(),characters=theirs.map((c,index)=>{
  const u=uid(c),match=u&&!used.has(u)?byUid.get(u):null,name=label(c?.name);
  if(!match)return {index,name,kind:'new'};
  used.add(u);
  const here=editTime(match),there=editTime(c);
  // One edit time means one version: an older file's sheet differs from its opened copy only by the defaults filled in on opening.
  if(here&&here===there||sheetBody(shape(match),u)===sheetBody(shape(c),u))return {index,name,kind:'same',localId:match.id};
  // The copy edited later wins; a sheet with no edit time is the older one.
  return {index,name,kind:here&&(!there||here>there)?'keep':'update',localId:match.id};
 });
 const localOnly=mine.filter(c=>!used.has(uid(c))).map(c=>label(c?.name));
 const mineUid=new Map(mine.map(c=>[c.id,uid(c)])),theirUid=new Map(theirs.map(c=>[c.id,uid(c)]));
 const myCampaigns=Array.isArray(local?.campaigns)?local.campaigns:[],bodies=new Set(myCampaigns.map(k=>campaignBody(k,id=>mineUid.get(id)||''))),names=new Set(myCampaigns.map(k=>label(k?.name)));
 const campaigns=(Array.isArray(incoming?.campaigns)?incoming.campaigns:[]).map((k,index)=>{
  const name=label(k?.name);
  if(!campaignOk(k))return {index,name,kind:'skip'};
  // A player character that only exists on this device keeps its place: its id is its own name there.
  if(bodies.has(campaignBody(k,id=>theirUid.get(id)||mineUid.get(id)||'')))return {index,name,kind:'same'};
  return {index,name,kind:names.has(name)?'copy':'new'};
 });
 const sections=[];
 for(const key of SECTION_KEYS){
  const theirsValue=incoming?.[key],mineValue=local?.[key];
  if(theirsValue===undefined||blank(key,theirsValue))continue;
  sections.push({key,kind:canon(theirsValue)===canon(mineValue)?'same':blank(key,mineValue)?'fill':'keep'});
 }
 const count=(list,kind)=>list.filter(x=>x.kind===kind).length;
 const counts={add:count(characters,'new'),update:count(characters,'update'),same:count(characters,'same'),keep:count(characters,'keep'),
  campaignsAdd:count(campaigns,'new')+count(campaigns,'copy'),campaignsCopy:count(campaigns,'copy'),campaignsSame:count(campaigns,'same'),campaignsSkip:count(campaigns,'skip'),
  sectionsFill:count(sections,'fill'),sectionsKeep:count(sections,'keep'),localOnly:localOnly.length,
  incomingCharacters:theirs.length,incomingCampaigns:campaigns.length,localCharacters:mine.length,localCampaigns:myCampaigns.length};
 const changes=counts.add+counts.update+counts.campaignsAdd+counts.sectionsFill;
 // The signature lets the app refuse a plan that no longer matches the data (edited in another tab since the preview).
 const sig=canon([characters.map(c=>[c.kind,c.localId||'']),campaigns.map(c=>c.kind),sections.map(s=>[s.key,s.kind])]);
 return {characters,campaigns,sections,localOnly,counts,changes,sig};
}

/* ---------- reminder ---------- */
function hash(s){let h=0x811c9dc5;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,0x01000193)}return (h>>>0).toString(36)+'.'+s.length}
function storage(){try{return global.localStorage||null}catch{return null}}
function cleanMeta(x){
 const out={changes:0,sig:'',backupSeen:'',snoozeUntil:0,days:14,sentAt:0,receivedAt:0};
 if(!isObj(x))return out;
 if(Number.isSafeInteger(x.changes)&&x.changes>=0)out.changes=Math.min(x.changes,1e6);
 if(typeof x.sig==='string')out.sig=x.sig.slice(0,40);
 if(typeof x.backupSeen==='string')out.backupSeen=x.backupSeen.slice(0,40);
 for(const k of ['snoozeUntil','sentAt','receivedAt'])if(Number.isFinite(x[k])&&x[k]>0)out[k]=x[k];
 if(DAY_CHOICES.includes(x.days))out.days=x.days;
 return out;
}
function readMeta(){try{return cleanMeta(JSON.parse(storage()?.getItem(META_KEY)||'null'))}catch{return cleanMeta(null)}}
function writeMeta(m){try{storage()?.setItem(META_KEY,JSON.stringify(m));return true}catch{return false}}
// The part of a snapshot a backup is for. Dice history and the language do not count as changes.
function dataSig(snapshot){try{return hash(JSON.stringify([snapshot?.characters,snapshot?.campaigns,snapshot?.netArchitectures,snapshot?.gmWorkspace,snapshot?.gmExtras]))}catch{return ''}}
// A new backup file starts the count again.
function syncBackup(meta,last){const seen=typeof last==='string'?last.slice(0,40):'';if(meta.backupSeen!==seen){meta.backupSeen=seen;meta.changes=0;meta.snoozeUntil=0;return true}return false}
function lastBackupRaw(){try{return global.App?.archive?.lastBackup?.()||storage()?.getItem('nightcity-red-last-backup-v1')||null}catch{return null}}
// Called by the store after every write that reached the browser.
function noteChange(snapshot){
 const sig=dataSig(snapshot);if(!sig)return false;
 const meta=readMeta(),reset=syncBackup(meta,lastBackupRaw());
 if(meta.sig===sig){if(reset)writeMeta(meta);return false}
 // The first write this module sees is the starting point, not a change.
 const counted=!!meta.sig;if(counted)meta.changes++;
 meta.sig=sig;writeMeta(meta);return counted;
}
// Pure: is a reminder due? `risk` (the browser may evict the data) halves the wait.
function reminder({last=null,meta=cleanMeta(null),now=Date.now(),hasData=true,risk=false}={}){
 const at=typeof last==='string'&&!Number.isNaN(Date.parse(last))?Date.parse(last):null,days=at===null?null:Math.max(0,Math.floor((now-at)/DAY));
 const limit=meta.days?(risk?Math.min(meta.days,7):meta.days):0,snoozed=meta.snoozeUntil>now,off=meta.days===0;
 let reason=null;
 if(hasData&&!off){
  if(at===null)reason='never';
  else if(days>=limit)reason='days';
  else if(meta.changes>=CHANGES_DUE)reason='changes';
 }
 return {at,days,changes:meta.changes,limit,off,snoozed,reason,due:!!reason&&!snoozed};
}
function status(){
 const meta=readMeta(),last=lastBackupRaw();if(syncBackup(meta,last))writeMeta(meta);
 let hasData=true,risk=false;
 try{const s=global.App?.getState?.();if(s)hasData=!!(s.characters?.length||s.campaigns?.length);risk=!!global.App?.archive?.atRisk?.()}catch{}
 return {...reminder({last,meta,hasData,risk}),meta,hasData,risk};
}
function snooze(now=Date.now()){const meta=readMeta();meta.snoozeUntil=now+SNOOZE_DAYS*DAY;return writeMeta(meta)}
function setDays(days){const n=Number(days);if(!DAY_CHOICES.includes(n))return false;const meta=readMeta();meta.days=n;meta.snoozeUntil=0;return writeMeta(meta)}

/* ---------- pairing code and encryption ---------- */
function subtle(){return (global.crypto||globalThis.crypto).subtle}
function randomBytes(n){return (global.crypto||globalThis.crypto).getRandomValues(new Uint8Array(n))}
function newCode(){
 let out='';
 // Rejection sampling keeps every character equally likely (31 symbols do not divide 256).
 while(out.length<CODE_LENGTH)for(const b of randomBytes(24)){if(b<248&&out.length<CODE_LENGTH)out+=ALPHABET[b%31]}
 return out;
}
function normalizeCode(v){
 if(typeof v!=='string')return null;
 const s=v.toUpperCase().replace(/[\s\-–—._]/g,'');
 return s.length===CODE_LENGTH&&[...s].every(ch=>ALPHABET.includes(ch))?s:null;
}
function formatCode(c){return String(c).replace(/(.{4})(?=.)/g,'$1-')}
const hex=bytes=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
// One slow derivation gives both the key and the mailbox name, so the name cannot be used to guess the code quickly.
async function derive(code,iterations=200000){
 const base=await subtle().importKey('raw',te.encode(code),'PBKDF2',false,['deriveBits']);
 const bits=new Uint8Array(await subtle().deriveBits({name:'PBKDF2',hash:'SHA-256',salt:te.encode('nightcity-red/transfer/v1'),iterations},base,384));
 const key=await subtle().importKey('raw',bits.slice(0,32),{name:'AES-GCM'},false,['encrypt','decrypt']);
 return {key,topic:'ncred/x1/'+hex(bits.slice(32,48))};
}
// The direction ("s" from the sender, "r" from the receiver) is bound into every message, so one cannot be replayed as the other.
async function seal(key,dir,plain){
 const iv=randomBytes(12),ct=new Uint8Array(await subtle().encrypt({name:'AES-GCM',iv,additionalData:te.encode(dir)},key,plain));
 const out=new Uint8Array(12+ct.length);out.set(iv);out.set(ct,12);return out;
}
async function unseal(key,dir,bytes){
 if(!(bytes instanceof Uint8Array)||bytes.length<29)throw Error('short');
 return new Uint8Array(await subtle().decrypt({name:'AES-GCM',iv:bytes.subarray(0,12),additionalData:te.encode(dir)},key,bytes.subarray(12)));
}
async function sha256(bytes){return hex(new Uint8Array(await subtle().digest('SHA-256',bytes)))}
function canGzip(){return typeof global.CompressionStream==='function'&&typeof global.DecompressionStream==='function'&&typeof global.Response==='function'&&typeof global.Blob==='function'}
async function pipe(bytes,stream){return new Uint8Array(await new global.Response(new global.Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer())}
const gzip=bytes=>pipe(bytes,new global.CompressionStream('gzip'));
const gunzip=bytes=>pipe(bytes,new global.DecompressionStream('gzip'));
const control=obj=>{const body=te.encode(JSON.stringify(obj)),out=new Uint8Array(1+body.length);out[0]=0;out.set(body,1);return out};
function chunkFrame(index,data){const out=new Uint8Array(5+data.length);out[0]=1;out[1]=index>>>24;out[2]=(index>>>16)&255;out[3]=(index>>>8)&255;out[4]=index&255;out.set(data,5);return out}

/* ---------- one transfer ----------
   send:    wait for "hello" -> "meta" -> answer every "need" with the chunks asked for -> "done".
   receive: "hello" until "meta" arrives -> ask for chunks a window at a time, again for any that did not arrive ->
            check the hash -> "done". Public brokers deliver at most once, so the receiver drives and re-asks.
   The first receiver to say hello owns the code; the session ends for good after done, a failure or a cancel. */
const DEFAULTS={chunkSize:12000,windowSize:8,helloEvery:2500,helloLimit:45000,retryEvery:3000,stallLimit:12,idleLimit:90000,waitLimit:600000,iterations:200000};
function createSession(options){
 const o={...DEFAULTS,...options},role=o.role==='send'?'send':'receive',out=role==='send'?'s':'r',inn=role==='send'?'r':'s';
 const timers=o.timers||{set:(f,ms)=>global.setTimeout(f,ms),clear:id=>global.clearTimeout(id)};
 let state={phase:'connecting',done:0,total:0,reason:null},closed=false,transport=null,key=null,topic='',online=0,queue=Promise.resolve();
 let sid='',chunks=[],meta=null,have=null,got=0,stalls=0,helloTimer=null,retryTimer=null,idleTimer=null,limitTimer=null,sentUpTo=0,windowIds=[],body=null,gz=false,result=null;
 const set=patch=>{state={...state,...patch};try{o.onState?.({...state})}catch{}};
 const stop=()=>{closed=true;for(const t of [helloTimer,retryTimer,idleTimer,limitTimer])if(t)timers.clear(t);try{transport?.close()}catch{}transport=null};
 const fail=reason=>{if(closed)return;stop();set({phase:'failed',reason})};
 const send=async frame=>{if(closed||!transport||!key)return 0;try{return transport.publish(out,await seal(key,out,frame))}catch{return 0}};
 const idle=()=>{if(idleTimer)timers.clear(idleTimer);idleTimer=timers.set(()=>fail('timeout'),o.idleLimit)};

 async function onHello(m){
  if(typeof m.sid!=='string'||m.sid.length<8||m.sid.length>64)return;
  if(sid&&m.sid!==sid)return; // the code is already taken by another receiver
  if(!sid){
   sid=m.sid;gz=m.gz===true&&canGzip();
   const plain=o.payload,packed=gz?await gzip(plain):plain;
   if(closed)return;
   chunks=[];for(let i=0;i<packed.length;i+=o.chunkSize)chunks.push(packed.subarray(i,i+o.chunkSize));
   if(!chunks.length||chunks.length>MAX_CHUNKS){fail('toobig');return}
   body={t:'meta',sid,n:chunks.length,size:plain.length,packed:packed.length,gz,hash:await sha256(plain),summary:o.summary||null};
   if(closed)return;
   if(limitTimer){timers.clear(limitTimer);limitTimer=null}
   set({phase:'transferring',done:0,total:chunks.length});
  }
  if(!body)return;
  idle();await send(control(body));
 }
 const sentAt=[];
 async function onNeed(m){
  if(m.sid!==sid||!body||!Array.isArray(m.ids)||m.ids.length>64)return;
  idle();
  for(const i of m.ids){
   if(closed)return;
   if(!Number.isInteger(i)||i<0||i>=chunks.length)continue;
   // The same request arrives once per broker: a chunk sent a moment ago is not sent again for its copies.
   const now=Date.now();if(sentAt[i]&&now-sentAt[i]<(o.resendGap??Math.min(1200,o.retryEvery/2)))continue;sentAt[i]=now;
   await send(chunkFrame(i,chunks[i]));
   if(i+1>sentUpTo)sentUpTo=i+1;
  }
  // What the receiver asks for next shows how far it has got: everything before the lowest missing chunk has arrived.
  const low=Math.min(...m.ids.filter(Number.isInteger));
  if(Number.isFinite(low)&&low>state.done)set({done:Math.min(low,chunks.length)});
 }
 function ask(){
  if(closed||!meta)return;
  const ids=[];for(let i=0;i<meta.n&&ids.length<o.windowSize;i++)if(!have[i])ids.push(i);
  if(!ids.length)return;
  windowIds=ids;
  send(control({t:'need',sid,ids}));
  if(retryTimer)timers.clear(retryTimer);
  const seen=got;
  retryTimer=timers.set(()=>{if(closed)return;if(got===seen){if(++stalls>o.stallLimit){fail('stalled');return}}else stalls=0;ask()},o.retryEvery);
 }
 async function finish(){
  if(retryTimer){timers.clear(retryTimer);retryTimer=null}
  try{
   let n=0;for(const c of have)n+=c.length;
   if(n!==meta.packed)throw Error('size');
   let all=new Uint8Array(n),p=0;for(const c of have){all.set(c,p);p+=c.length}
   if(meta.gz)all=await gunzip(all);
   if(all.length!==meta.size||await sha256(all)!==meta.hash)throw Error('hash');
   result=all;
  }catch{fail('corrupt');return}
  if(closed)return;
  await send(control({t:'done',sid}));await send(control({t:'done',sid}));
  stop();set({phase:'done',done:meta.n,total:meta.n});
 }
 function onMeta(m){
  if(m.sid!==sid||meta)return;
  const ok=Number.isInteger(m.n)&&m.n>0&&m.n<=MAX_CHUNKS&&Number.isInteger(m.size)&&m.size>0&&m.size<=MAX_BYTES&&Number.isInteger(m.packed)&&m.packed>0&&m.packed<=MAX_BYTES&&typeof m.hash==='string'&&/^[0-9a-f]{64}$/.test(m.hash)&&(m.gz!==true||canGzip());
  if(!ok){fail('corrupt');return}
  meta={n:m.n,size:m.size,packed:m.packed,gz:m.gz===true,hash:m.hash,summary:isObj(m.summary)?m.summary:null};
  have=new Array(meta.n).fill(null);got=0;
  if(helloTimer){timers.clear(helloTimer);helloTimer=null}
  if(limitTimer){timers.clear(limitTimer);limitTimer=null}
  set({phase:'transferring',done:0,total:meta.n,summary:meta.summary});
  ask();
 }
 function onChunk(plain){
  if(!meta||plain.length<6)return;
  const i=((plain[1]<<24)|(plain[2]<<16)|(plain[3]<<8)|plain[4])>>>0;
  if(i>=meta.n||have[i])return;
  have[i]=plain.slice(5);got++;stalls=0;
  set({done:got});
  if(got===meta.n){finish();return}
  // The window is complete: ask for the next one without waiting for the retry timer.
  if(windowIds.every(k=>have[k]))ask();
 }
 async function handle(packet){
  if(closed||!packet||typeof packet.topic!=='string'||packet.topic!==topic+'/'+inn)return;
  let plain;try{plain=await unseal(key,inn,packet.payload)}catch{return} // not ours, or damaged: the retry asks again
  if(closed||!plain.length)return;
  if(plain[0]===1){if(role==='receive')onChunk(plain);return}
  let m;try{m=JSON.parse(td.decode(plain.subarray(1)))}catch{return}
  if(!isObj(m))return;
  if(m.t==='cancel'&&m.sid===sid&&sid){fail('peer');return}
  if(role==='send'){
   if(m.t==='hello')await onHello(m);
   else if(m.t==='need')await onNeed(m);
   else if(m.t==='done'&&m.sid===sid&&body){stop();set({phase:'done',done:chunks.length,total:chunks.length})}
  }else if(m.t==='meta')onMeta(m);
 }
 function hello(){
  if(closed||meta)return;
  if(online>0)send(control({t:'hello',sid,gz:canGzip()}));
  helloTimer=timers.set(hello,o.helloEvery);
 }
 async function start(){
  try{
   const code=normalizeCode(o.code);if(!code){fail('code');return}
   const d=await derive(code,o.iterations);if(closed)return;
   key=d.key;topic=d.topic;
   if(role==='receive')sid=hex(randomBytes(12));
   const factory=o.transport||global.RoomTransport?.create;
   if(typeof factory!=='function'){fail('offline');return}
   transport=factory({topic,brokers:o.brokers,WebSocketImpl:o.WebSocketImpl,
    onMessage:p=>{queue=queue.then(()=>handle(p)).catch(()=>{})},
    onStatus:s=>{if(closed)return;const was=online;online=Number(s?.online)||0;if(state.phase==='connecting'&&online>0){set({phase:'waiting'});if(role==='receive'&&!was){if(helloTimer)timers.clear(helloTimer);hello()}}}});
   // A sender waits ten minutes for the other device; a receiver gives up sooner, because a wrong code looks like silence.
   limitTimer=timers.set(()=>fail(role==='send'?'timeout':online>0?'nopeer':'offline'),role==='send'?o.waitLimit:o.helloLimit);
   if(role==='receive')hello();
   // A sender that reaches no broker at all says so instead of showing a code nobody can use.
   else helloTimer=timers.set(()=>{if(state.phase==='connecting')fail('offline')},o.helloLimit);
  }catch{fail('offline')}
 }
 start();
 return {
  state:()=>({...state}),
  role,
  result:()=>result,
  wake(){try{transport?.wake?.()}catch{}},
  // Tells the other device and stops. Safe at any moment: the receiver has not written anything yet.
  cancel(){
   if(closed)return;
   const t=transport,k=key;closed=true;transport=null;
   for(const x of [helloTimer,retryTimer,idleTimer,limitTimer])if(x)timers.clear(x);
   set({phase:'cancelled'});
   if(!t)return;
   (k&&sid?seal(k,out,control({t:'cancel',sid})).then(b=>{t.publish(out,b)}):Promise.resolve()).catch(()=>{}).finally(()=>{try{t.close()}catch{}});
  },
 };
}

/* ---------- interface ---------- */
let ui={incoming:null,busy:false,note:null,arm:false,mode:null,codeError:'',session:null,xfer:null,code:'',undo:null};
const lang=()=>{try{return global.App?.lang?.()==='en'?'en':'ru'}catch{return 'ru'}};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function words(l){const ru=l!=='en',w=(a,b)=>ru?a:b;return {ru,w}}
function plural(n,l,one,few,many,enOne,enMany){
 if(l==='en')return n+' '+(n===1?enOne:enMany);
 const a=n%10,b=n%100;return n+' '+(a===1&&b!==11?one:a>=2&&a<=4&&(b<12||b>14)?few:many);
}
const chars=(n,l)=>plural(n,l,'персонаж','персонажа','персонажей','character','characters');
const camps=(n,l)=>plural(n,l,'кампания','кампании','кампаний','campaign','campaigns');
const changesText=(n,l)=>plural(n,l,'изменение','изменения','изменений','change','changes');
function names(list,l){const shown=list.slice(0,6).map(n=>n||(l==='en'?'unnamed':'без имени')),rest=list.length-shown.length;return shown.map(esc).join(', ')+(rest>0?(l==='en'?` and ${rest} more`:` и ещё ${rest}`):'')}
const dateText=(at,l)=>new Date(at).toLocaleDateString(l==='en'?'en-GB':'ru-RU');
const sectionLabel=(key,l)=>({netArchitectures:l==='en'?'NET architectures':'NET-архитектуры',gmWorkspace:l==='en'?'GM workspace':'рабочее место ГМа',gmExtras:l==='en'?'GM clocks and tables':'часы и таблицы ГМа'}[key]||key);

function statusLine(s,l){
 const {w}=words(l);
 const when=s.at===null?w('Копия в файл ещё не делалась.','No backup file has been made yet.'):w(`Последняя копия в файл: ${dateText(s.at,l)}`,`Last backup file: ${dateText(s.at,l)}`)+(s.days?w(` (${plural(s.days,l,'день','дня','дней')} назад)`,` (${plural(s.days,l,'','','','day','days')} ago)`):w(' (сегодня)',' (today)'))+'.';
 const since=s.at!==null&&s.changes?' '+w(`С тех пор: ${changesText(s.changes,l)}.`,`Since then: ${changesText(s.changes,l)}.`):'';
 return when+since;
}
// The overview strip. Same look and the same download action as the strip it stands in for; it also counts changes and can wait.
function strip(l,hint=''){
 const s=status();if(!s.hasData)return '';
 const {w}=words(l==='en'?'en':'ru');l=l==='en'?'en':'ru';
 const why=s.due?(s.reason==='changes'?w('Пора обновить копию: накопилось много изменений.','Time for a fresh backup: a lot has changed.'):s.reason==='days'?w('Пора обновить копию.','Time for a fresh backup.'):''):'';
 return `<div class="backup-strip ${s.due?'warn':''}" data-xfer-strip><div class="source-symbol">${s.due?'!':'✓'}</div><div><strong>${w('РЕЗЕРВНАЯ КОПИЯ','BACKUP')}</strong><p>${esc(statusLine(s,l))} ${why?esc(why)+' ':''}${w('Данные хранятся только в этом браузере — сохраните файл, чтобы не потерять персонажей и перенести их на другое устройство.','Data lives only in this browser — save a file so you never lose characters and can move them to another device.')}</p>${hint||''}<p class="xfer-strip-links"><button type="button" class="hint-link" data-action="navigate" data-view="characters" data-xfer-open>${w('Перенос и копии','Transfer and backups')} →</button>${s.due?`<button type="button" class="hint-link" data-xfer="snooze">${w(`Напомнить через ${SNOOZE_DAYS} дня`,`Remind me in ${SNOOZE_DAYS} days`)}</button>`:''}</p></div><button class="btn ${s.due?'primary':'ghost'}" data-action="export-backup">↓ ${w('Скачать копию','Download backup')}</button></div>`;
}

// Custom items and opponents travel next to the main archive (`customContent`); they are only ever added, never replaced or removed.
function customPlan(data){try{return global.CustomContent?.backupPlan?.(data)||null}catch{return null}}
function previewHtml(l){
 const inc=ui.incoming,{w}=words(l);if(!inc)return '';
 const head=inc.source==='device'?w('Получено с другого устройства','Received from the other device'):w('Файл','File')+(inc.name?` «${esc(inc.name)}»`:'');
 if(inc.error)return `<div class="xfer-preview" data-xfer-preview tabindex="-1"><h3>${head}</h3><p class="xfer-error" role="alert">${esc(inc.error)}</p><div class="xfer-actions"><button type="button" class="btn ghost" data-xfer="discard">${w('Закрыть','Close')}</button></div></div>`;
 const p=inc.plan,c=p.counts,pick=kind=>p.characters.filter(x=>x.kind===kind).map(x=>x.name),row=(mark,text)=>`<li><span class="xfer-mark" aria-hidden="true">${mark}</span><span>${text}</span></li>`;
 const add=[];
 if(c.add)add.push(row('+',w(`Добавятся: ${chars(c.add,l)} — `,`Will be added: ${chars(c.add,l)} — `)+names(pick('new'),l)));
 if(c.update)add.push(row('↻',w(`Обновятся до версии из архива (она изменена позже): ${chars(c.update,l)} — `,`Will be updated to the archive's version (it was edited later): ${chars(c.update,l)} — `)+names(pick('update'),l)));
 if(c.keep)add.push(row('•',w(`Останутся как здесь (на этом устройстве они изменены позже): ${chars(c.keep,l)} — `,`Will stay as they are here (edited later on this device): ${chars(c.keep,l)} — `)+names(pick('keep'),l)));
 if(c.same)add.push(row('=',w(`Уже есть без отличий: ${chars(c.same,l)}.`,`Already here, identical: ${chars(c.same,l)}.`)));
 if(c.campaignsAdd)add.push(row('+',w(`Добавятся: ${camps(c.campaignsAdd,l)}`,`Will be added: ${camps(c.campaignsAdd,l)}`)+' — '+names(p.campaigns.filter(x=>x.kind==='new'||x.kind==='copy').map(x=>x.name),l)+(c.campaignsCopy?w(`. Из них отдельной копией (кампания с таким названием здесь уже есть и отличается): ${c.campaignsCopy}`,`. Of these, as a separate copy (a campaign with that name is already here and differs): ${c.campaignsCopy}`):'')+'.'));
 if(c.campaignsSame)add.push(row('=',w(`Уже есть без отличий: ${camps(c.campaignsSame,l)}.`,`Already here, identical: ${camps(c.campaignsSame,l)}.`)));
 const fill=p.sections.filter(s=>s.kind==='fill').map(s=>sectionLabel(s.key,l)),keep=p.sections.filter(s=>s.kind==='keep').map(s=>sectionLabel(s.key,l));
 if(fill.length)add.push(row('+',w('Заполнятся разделы, которые здесь пусты: ','Sections that are empty here will be filled: ')+esc(fill.join(', '))+'.'));
 if(keep.length)add.push(row('•',w('Не изменятся (здесь уже есть свои данные): ','Will not change (this device has its own data): ')+esc(keep.join(', '))+'.'));
 const cc=inc.error?null:customPlan(inc.data);
 if(cc?.added)add.push(row('+',w(`Добавятся свои материалы (предметы и противники): ${cc.added}.`,`Custom content (items and opponents) will be added: ${cc.added}.`)));
 if(cc?.kept)add.push(row('•',w(`Свои материалы, которые здесь уже есть в другой версии, останутся как здесь: ${cc.kept}.`,`Custom content that is already here in another version will stay as it is here: ${cc.kept}.`)));
 if(cc?.overflow)add.push(row('!',w(`Свои материалы, для которых не хватит места, будут пропущены: ${cc.overflow}.`,`Custom content there is no room for will be skipped: ${cc.overflow}.`)));
 const skipped=inc.skipped+c.campaignsSkip;
 if(skipped)add.push(row('!',w(`Не читаются и будут пропущены: ${skipped} (в архиве они остаются без изменений).`,`Cannot be read and will be skipped: ${skipped} (they stay unchanged in the archive).`)));
 if(!p.changes&&!cc?.added)add.push(row('✓',w('Добавлять нечего: всё из архива здесь уже есть.','Nothing to add: everything in the archive is already here.')));
 const rep=[row('→',w(`Сейчас здесь: ${chars(c.localCharacters,l)}, ${camps(c.localCampaigns,l)}. Станет: ${chars(c.incomingCharacters,l)}, ${camps(c.incomingCampaigns,l)}.`,`Here now: ${chars(c.localCharacters,l)}, ${camps(c.localCampaigns,l)}. After: ${chars(c.incomingCharacters,l)}, ${camps(c.incomingCampaigns,l)}.`))];
 if(c.localOnly)rep.push(row('−',w(`Исчезнут с этого устройства (в архиве их нет): ${chars(c.localOnly,l)} — `,`Will disappear from this device (not in the archive): ${chars(c.localOnly,l)} — `)+names(p.localOnly,l)));
 rep.push(row('•',w('Настройки, заметки ГМа, NET-архитектуры и закладки тоже возьмутся из архива. Текущие данные сохранятся снимком, замену можно отменить.','Settings, GM notes, NET architectures and bookmarks also come from the archive. The current data is kept as a snapshot, so the replacement can be undone.')));
 if(cc&&(cc.added||cc.kept||cc.same))rep.push(row('•',w(`Свои материалы (предметы и противники) не заменяются: ваши останутся, из архива добавятся новые — ${cc.added}.`,`Custom content (items and opponents) is not replaced: yours stay, new entries from the archive are added — ${cc.added}.`)));
 const empty=!c.incomingCharacters&&!c.incomingCampaigns;
 const made=inc.savedAt?w(` Данные от ${dateText(inc.savedAt,l)}.`,` Data as of ${dateText(inc.savedAt,l)}.`):'';
 return `<div class="xfer-preview" data-xfer-preview tabindex="-1"><h3>${head}</h3><p>${w('В архиве','The archive holds')}: ${chars(c.incomingCharacters,l)}, ${camps(c.incomingCampaigns,l)}.${made} ${w('Пока ничего не изменено — выберите, что сделать.','Nothing has been changed yet — choose what to do.')}</p>
<div class="xfer-options"><div class="xfer-option"><h4>${w('Добавить к моим данным','Add to my data')}</h4><ul class="xfer-list">${add.join('')}</ul><button type="button" class="btn primary" data-xfer="apply-add"${(p.changes||cc?.added)&&!ui.busy?'':' disabled'}>${w('Добавить и обновить','Add and update')}</button></div>
<div class="xfer-option"><h4>${w('Заменить все мои данные','Replace all my data')}</h4><ul class="xfer-list">${rep.join('')}</ul>${empty?`<p class="xfer-error">${w('В архиве нет ни персонажей, ни кампаний — заменять данные пустым архивом нельзя.','The archive has no characters or campaigns — replacing the data with an empty archive is not allowed.')}</p>`:ui.arm?`<p class="xfer-error" role="alert">${w('Все текущие данные на этом устройстве будут заменены. Продолжить?','All current data on this device will be replaced. Continue?')}</p><div class="xfer-actions"><button type="button" class="btn xfer-danger" data-xfer="apply-replace"${ui.busy?' disabled':''}>${w('Да, заменить всё','Yes, replace everything')}</button><button type="button" class="btn ghost" data-xfer="disarm">${w('Нет','No')}</button></div>`:`<button type="button" class="btn ghost" data-xfer="arm"${ui.busy?' disabled':''}>${w('Заменить всё…','Replace everything…')}</button>`}</div></div>
<div class="xfer-actions"><button type="button" class="btn ghost" data-xfer="discard">${w('Отмена — ничего не менять','Cancel — change nothing')}</button></div></div>`;
}
function failText(reason,role,l){
 const {w}=words(l);
 return ({
  code:w('В коде должно быть 12 знаков: цифры 2–9 и латинские буквы без I, L, O.','The code is 12 characters: digits 2–9 and Latin letters without I, L, O.'),
  nopeer:w('Отправляющее устройство не ответило. Проверьте код и убедитесь, что на нём открыт экран с кодом, затем попробуйте ещё раз.','The sending device did not answer. Check the code, make sure its code screen is open, then try again.'),
  offline:w('Нет связи с сервером-посредником. Проверьте интернет и попробуйте ещё раз — или перенесите данные файлом.','Could not reach the relay. Check the internet connection and try again — or move the data as a file.'),
  timeout:role==='send'?w('Второе устройство не подключилось или перестало отвечать. Код больше не действует — получите новый.','The other device did not connect or stopped answering. The code is no longer valid — get a new one.'):w('Отправляющее устройство перестало отвечать.','The sending device stopped answering.'),
  stalled:w('Связь оборвалась, архив получен не полностью. На этом устройстве ничего не изменено. Попробуйте ещё раз с новым кодом.','The connection dropped and the archive did not arrive in full. Nothing was changed on this device. Try again with a new code.'),
  corrupt:w('Архив пришёл повреждённым и отброшен. На этом устройстве ничего не изменено. Попробуйте ещё раз с новым кодом.','The archive arrived damaged and was dropped. Nothing was changed on this device. Try again with a new code.'),
  peer:w('Перенос отменён на другом устройстве. Здесь ничего не изменено.','The transfer was cancelled on the other device. Nothing was changed here.'),
  toobig:w('Архив слишком велик для переноса по коду. Перенесите его файлом.','The archive is too large to move by code. Move it as a file.'),
  empty:w('На этом устройстве пока нечего отправлять.','There is nothing to send from this device yet.'),
 })[reason]||w('Перенос не удался. На принимающем устройстве ничего не изменено.','The transfer failed. Nothing was changed on the receiving device.');
}
function progressHtml(x,l){
 const {w}=words(l),pct=x.total?Math.min(100,Math.round(x.done/x.total*100)):0;
 return `<p class="xfer-progress" data-xfer-progress><progress max="100" value="${pct}" aria-label="${w('Ход переноса','Transfer progress')}"></progress> <span>${pct}%</span></p>`;
}
function deviceHtml(l){
 const {w}=words(l),x=ui.xfer;
 const intro=`<p class="xfer-intro">${w('Весь архив переносится напрямую с одного устройства на другое по одноразовому коду. Нужен интернет на обоих устройствах. Данные шифруются на вашем устройстве: сервер-посредник видит только шифр и ничего не хранит.','The whole archive goes straight from one device to the other with a one-time code. Both devices need internet. The data is encrypted on your device: the relay only sees ciphertext and stores nothing.')}</p>`;
 if(!x)return intro+`<div class="xfer-actions"><button type="button" class="btn ghost" data-xfer="send">↑ ${w('Отправить с этого устройства','Send from this device')}</button><button type="button" class="btn ghost" data-xfer="receive">↓ ${w('Принять на это устройство','Receive on this device')}</button></div>`;
 const live=`<div class="xfer-live" role="status" aria-live="polite" data-xfer-live tabindex="-1">`;
 if(x.role==='send'){
  if(x.phase==='done')return intro+live+`<p><b>✓ ${w('Архив передан.','The archive was sent.')}</b> ${w('На втором устройстве осталось выбрать, добавить данные или заменить ими всё. Здесь ничего не изменилось.','On the other device, choose whether to add the data or replace everything with it. Nothing changed here.')}</p></div><div class="xfer-actions"><button type="button" class="btn ghost" data-xfer="close">${w('Готово','Done')}</button></div>`;
  if(x.phase==='failed')return intro+live+`<p class="xfer-error">${esc(failText(x.reason,'send',l))}</p></div><div class="xfer-actions"><button type="button" class="btn primary" data-xfer="send">${w('Получить новый код','Get a new code')}</button><button type="button" class="btn ghost" data-xfer="close">${w('Закрыть','Close')}</button></div>`;
  const state=x.phase==='connecting'?w('Подключение…','Connecting…'):x.phase==='waiting'?w('Жду второе устройство…','Waiting for the other device…'):w('Передаю архив…','Sending the archive…');
  return intro+`<div class="xfer-code-box"><span class="xfer-code-label">${w('Одноразовый код','One-time code')}</span><output class="xfer-code" aria-label="${w('Код','Code')} ${esc(x.code.split('').join(' '))}">${esc(formatCode(x.code))}</output><button type="button" class="btn small ghost" data-xfer="copy-code">${w('Скопировать','Copy')}</button></div><p>${w('На втором устройстве откройте «Персонажи» → «Перенос и копии» → «Принять на это устройство» и введите код. Не закрывайте эту страницу, пока перенос не закончится. Код действует 10 минут и только один раз.','On the other device open Characters → Transfer and backups → Receive on this device and enter the code. Keep this page open until the transfer ends. The code works for 10 minutes and only once.')}</p>`+live+`<p>${state}</p>${x.phase==='transferring'?progressHtml(x,l):''}</div><div class="xfer-actions"><button type="button" class="btn ghost" data-xfer="cancel">${w('Отменить перенос','Cancel transfer')}</button></div>`;
 }
 if(x.phase==='entry'||x.phase==='failed')return intro+`<div class="xfer-entry"><label for="xfer-code">${w('Код с отправляющего устройства','Code from the sending device')}</label><div class="xfer-entry-row"><input id="xfer-code" class="xfer-code-input" type="text" inputmode="text" autocomplete="off" autocapitalize="characters" autocorrect="off" spellcheck="false" maxlength="20" placeholder="XXXX-XXXX-XXXX" value="${esc(ui.code)}" aria-describedby="xfer-code-help"><button type="button" class="btn primary" data-xfer="connect">${w('Подключиться','Connect')}</button></div><p id="xfer-code-help" class="${x.phase==='failed'||ui.codeError?'xfer-error':'muted'}"${x.phase==='failed'||ui.codeError?' role="alert"':''}>${esc(x.phase==='failed'?failText(x.reason,'receive',l):ui.codeError||w('Получение ничего не меняет сразу: сначала вы увидите, что пришло.','Receiving changes nothing right away: you will first see what arrived.'))}</p></div><div class="xfer-actions"><button type="button" class="btn ghost" data-xfer="close">${w('Закрыть','Close')}</button></div>`;
 if(x.phase==='done')return intro+live+`<p><b>✓ ${w('Архив получен целиком и проверен.','The archive arrived in full and was verified.')}</b> ${w('Выберите выше, что с ним сделать.','Choose above what to do with it.')}</p></div><div class="xfer-actions"><button type="button" class="btn ghost" data-xfer="close">${w('Закрыть','Close')}</button></div>`;
 const state=x.phase==='connecting'?w('Подключение…','Connecting…'):x.phase==='waiting'?w('Ищу отправляющее устройство…','Looking for the sending device…'):w('Принимаю архив…','Receiving the archive…');
 return intro+live+`<p>${state}</p>${x.phase==='transferring'?progressHtml(x,l):''}</div><div class="xfer-actions"><button type="button" class="btn ghost" data-xfer="cancel">${w('Отменить перенос','Cancel transfer')}</button></div>`;
}
function bodyHtml(l){
 const {w}=words(l),s=status(),paused=global.App?.archive?.canEdit?.()===false;
 const note=ui.note?`<div class="xfer-note ${ui.note.kind==='error'?'xfer-error':''}" role="${ui.note.kind==='error'?'alert':'status'}" data-xfer-note tabindex="-1"><span>${esc(ui.note.text)}</span>${ui.undo?`<button type="button" class="btn small primary" data-xfer="undo">${w('Отменить','Undo')}</button>`:''}<button type="button" class="btn small ghost" data-xfer="dismiss-note">${w('Скрыть','Hide')}</button></div>`:'';
 const due=s.due?`<p class="xfer-due">${s.reason==='never'?w('Копии ещё нет. Скачайте файл — это единственная защита от потери данных браузера.','There is no backup yet. Download a file — it is the only protection against losing browser data.'):s.reason==='changes'?w('С последней копии накопилось много изменений — пора скачать новую.','A lot has changed since the last backup — time to download a new one.'):w('Последняя копия уже старая — пора скачать новую.','The last backup is getting old — time to download a new one.')} <button type="button" class="hint-link" data-xfer="snooze">${w(`Напомнить через ${SNOOZE_DAYS} дня`,`Remind me in ${SNOOZE_DAYS} days`)}</button></p>`:'';
 const opts=DAY_CHOICES.map(d=>`<option value="${d}"${s.meta.days===d?' selected':''}>${d?w(`раз в ${d} дней`,`every ${d} days`):w('не напоминать','never')}</option>`).join('');
 return `${note}<div class="set-aside-group"><h3>${w('Копия в файл','Backup file')}</h3><p class="muted" data-xfer-status>${esc(statusLine(s,l))}</p>${due}<div class="xfer-actions"><button type="button" class="btn ${s.due?'primary':'ghost'}" data-action="export-backup">↓ ${w('Скачать весь архив одним файлом','Download the whole archive as one file')}</button><label class="btn ghost xfer-file${paused?' disabled':''}"><span>↑ ${w('Открыть файл архива…','Open an archive file…')}</span><input type="file" accept="application/json,.json" data-xfer-file class="xfer-file-input"${paused?' disabled':''}></label></div><p class="muted">${w('В файле — персонажи, кампании, данные ГМа, NET-архитектуры, закладки и настройки. Открытие файла ничего не меняет: сначала вы увидите, что будет добавлено или заменено.','The file holds characters, campaigns, GM data, NET architectures, bookmarks and settings. Opening a file changes nothing: you first see what would be added or replaced.')}</p><label class="xfer-remind"><span>${w('Напоминать о копии','Remind me to back up')}</span><select data-xfer-days>${opts}</select></label></div>${previewHtml(l)}<div class="set-aside-group"><h3>${w('С устройства на устройство','Device to device')}</h3>${deviceHtml(l)}</div>`;
}
function render(l){
 l=l==='en'?'en':'ru';const {w}=words(l);
 return `<section class="card set-aside xfer" id="transfer" data-transfer-root><div class="card-heading"><span>${w('Перенос и копии','Transfer and backups')}</span><span>TRANSFER</span></div><div data-xfer-body>${bodyHtml(l)}</div></section>`;
}
function doc(){return global.document}
function paint(focus){
 const d=doc(),body=d?.querySelector?.('[data-transfer-root] [data-xfer-body]');if(!body)return false;
 body.innerHTML=bodyHtml(lang());
 if(focus){const el=body.querySelector(focus);try{el?.focus?.({preventScroll:false})}catch{}}
 return true;
}
function paintProgress(){
 const d=doc(),box=d?.querySelector?.('[data-transfer-root] [data-xfer-progress]'),x=ui.xfer;
 if(!box||!x?.total)return paint();
 const pct=Math.min(100,Math.round(x.done/x.total*100)),bar=box.querySelector('progress'),text=box.querySelector('span');
 if(bar)bar.value=pct;if(text)text.textContent=pct+'%';return true;
}
function note(text,kind='ok',undo=null){ui.note={text,kind};ui.undo=undo}

// Reads an archive (parsed JSON) and works out what it would do. Nothing is written.
function inspect(data,source,name=''){
 const l=lang(),{w}=words(l),api=global.App?.archive;
 const bad=text=>({source,name,error:text});
 if(!api)return bad(w('Приложение ещё загружается. Попробуйте ещё раз.','The app is still loading. Try again.'));
 if(isObj(data)&&(data.format==='nightcity-red-character'||data.character&&!Array.isArray(data.characters)))return bad(w('Это файл одного персонажа, а не архив. Добавьте его через «Файлы и резервные копии» → «Импорт персонажа» вверху страницы.','This is a single character file, not an archive. Add it with “Files and backups” → “Import character” at the top of the page.'));
 let read=null;try{read=api.read(data)}catch{}
 if(read?.newer)return bad(w('Архив сохранён более новой версией приложения. Обновите страницу на этом устройстве и попробуйте ещё раз.','The archive was saved by a newer version of the app. Reload the page on this device and try again.'));
 if(!read||!read.snapshot)return bad(w('Это не архив Night City // RED, или файл повреждён. Ничего не изменено.','This is not a Night City // RED archive, or the file is damaged. Nothing was changed.'));
 let p;try{p=plan(api.snapshot(),read.snapshot,api.helpers?.()||{})}catch{return bad(w('Архив не удалось разобрать. Ничего не изменено.','The archive could not be read. Nothing was changed.'))}
 const savedAt=Number.isFinite(data?.savedAt)&&data.savedAt>0?data.savedAt:null;
 return {source,name,data,plan:p,skipped:Array.isArray(read.items)?read.items.length:0,savedAt};
}
function resultText(r,l){
 const {w}=words(l);
 if(r?.ok)return null;
 return ({newer:w('Архив сохранён более новой версией приложения.','The archive was saved by a newer version of the app.'),
  paused:w('Редактирование сейчас приостановлено — данные не изменены.','Editing is paused right now — nothing was changed.'),
  stale:w('Данные на этом устройстве изменились, пока был открыт предпросмотр. Проверьте его ещё раз.','The data on this device changed while the preview was open. Please check it again.'),
  storage:w('В браузере не хватает места. Данные остались как были.','The browser is out of room. The data is as it was.'),
  cancelled:w('Отменено. Данные остались как были.','Cancelled. The data is as it was.'),
  empty:w('В архиве нет читаемых персонажей и кампаний.','The archive has no readable characters or campaigns.'),
 })[r?.reason]||w('Не получилось. Данные остались как были.','That did not work. The data is as it was.');
}
function apply(mode){
 const inc=ui.incoming,api=global.App?.archive,l=lang(),{w}=words(l);
 if(!inc||inc.error||!api||ui.busy)return;
 ui.busy=true;let r;
 try{r=mode==='replace'?api.replace(inc.data,inc.plan.sig):api.merge(inc.data,inc.plan.sig)}catch{r={ok:false}}
 // Custom content is added once the main archive is in, or when the archive had nothing else to add.
 const want=customPlan(inc.data);let cc=null;
 if(want?.added&&(r?.ok||mode!=='replace'&&r?.reason==='empty'))try{cc=global.CustomContent.restoreFromBackup(inc.data,{quiet:true})}catch{}
 const ccText=!want?.added?'':cc?.changed?' '+w(`Свои материалы: добавлено ${cc.changed}.`,`Custom content: ${cc.changed} added.`):' '+w('Свои материалы добавить не удалось: в браузере не хватает места.','Custom content could not be added: the browser is out of room.');
 if(cc?.changed)try{global.App?.render?.()}catch{}
 ui.busy=false;ui.arm=false;
 if(!r?.ok&&cc?.changed){ui.incoming=null;note(ccText.trim(),'ok');paint('[data-xfer-note]');return}
 if(!r?.ok){
  if(r?.reason==='stale'){const again=inspect(inc.data,inc.source,inc.name);ui.incoming=again}
  note(resultText(r,l),'error');paint('[data-xfer-note]');return;
 }
 const c=inc.plan.counts;
 ui.incoming=null;
 if(inc.source==='device'){const meta=readMeta();meta.receivedAt=Date.now();writeMeta(meta);if(ui.xfer?.phase==='done')ui.xfer=null}
 note((mode==='replace'?w(`Все данные заменены архивом: ${chars(c.incomingCharacters,l)}, ${camps(c.incomingCampaigns,l)}.`,`All data was replaced with the archive: ${chars(c.incomingCharacters,l)}, ${camps(c.incomingCampaigns,l)}.`)
  :w(`Готово. Добавлено: ${chars(c.add,l)}, ${camps(c.campaignsAdd,l)}. Обновлено: ${chars(c.update,l)}.`,`Done. Added: ${chars(c.add,l)}, ${camps(c.campaignsAdd,l)}. Updated: ${chars(c.update,l)}.`)+(r.undo?'':' '+w('Отменить это действие нельзя: для снимка не хватило места.','This cannot be undone: there was no room for a snapshot.')))+ccText,'ok',r.undo||null);
 // The app has re-rendered the page; the block is new, so paint it and move focus to the result.
 paint('[data-xfer-note]');
}
function sessionState(s){
 const x=ui.xfer;if(!x)return;
 const was=x.phase;Object.assign(x,{phase:s.phase,done:s.done,total:s.total,reason:s.reason});
 const l=lang(),{w}=words(l);
 if(s.phase==='done'&&x.role==='receive'){
  let data=null;try{data=JSON.parse(td.decode(ui.session.result()))}catch{}
  ui.session=null;
  ui.incoming=data===null?{source:'device',name:'',error:w('Полученный архив не читается. Ничего не изменено.','The received archive cannot be read. Nothing was changed.')}:inspect(data,'device');
  ui.arm=false;
  if(!paint('[data-xfer-preview]'))try{global.App?.notify?.(w('Архив получен. Откройте «Персонажи» → «Перенос и копии», чтобы выбрать, что с ним сделать.','The archive has arrived. Open Characters → Transfer and backups to choose what to do with it.'))}catch{}
  return;
 }
 if(s.phase==='done'&&x.role==='send'){const meta=readMeta();meta.sentAt=Date.now();writeMeta(meta);ui.session=null}
 if(s.phase==='failed'||s.phase==='cancelled')ui.session=null;
 if(s.phase==='failed'&&x.role==='receive'&&!doc()?.querySelector?.('[data-transfer-root]'))try{global.App?.notify?.(failText(s.reason,'receive',l))}catch{}
 if(s.phase==='transferring'&&was==='transferring')paintProgress();else paint(s.phase==='failed'||s.phase==='done'?'[data-xfer-live], #xfer-code':null);
}
function customPart(){try{return global.CustomContent?.backupPart?.()||{}}catch{return {}}}
function startSend(){
 const api=global.App?.archive;
 if(!api)return;
 let snapshot;try{snapshot=api.snapshot()}catch{return}
 if(!snapshot?.characters?.length&&!snapshot?.campaigns?.length){ui.xfer={role:'send',phase:'failed',reason:'empty',code:'',done:0,total:0};paint('[data-xfer-live]');return}
 const payload=te.encode(JSON.stringify({format:'nightcity-red-backup',version:1,savedAt:Date.now(),_completeSnapshot:snapshot,...customPart()}));
 if(payload.length>MAX_BYTES){ui.xfer={role:'send',phase:'failed',reason:'toobig',code:'',done:0,total:0};paint('[data-xfer-live]');return}
 const code=newCode();
 ui.xfer={role:'send',phase:'connecting',code,done:0,total:0,reason:null};
 const mine=ui.xfer;ui.session=createSession({role:'send',code,payload,summary:{characters:snapshot.characters.length,campaigns:snapshot.campaigns.length},onState:s=>{if(ui.xfer===mine)sessionState(s)}});
 paint('[data-xfer-live]');
}
function startReceive(raw){
 const code=normalizeCode(raw),l=lang();
 ui.code=String(raw||'').slice(0,20);
 if(!code){ui.codeError=failText('code','receive',l);ui.xfer={role:'receive',phase:'entry',done:0,total:0};paint('#xfer-code');return}
 ui.codeError='';
 ui.xfer={role:'receive',phase:'connecting',code,done:0,total:0,reason:null};
 const mine=ui.xfer;ui.session=createSession({role:'receive',code,onState:s=>{if(ui.xfer===mine)sessionState(s)}});
 paint('[data-xfer-live]');
}
function endSession(){try{ui.session?.cancel()}catch{}ui.session=null}
function onClick(e){
 const t=e.target,l=lang(),{w}=words(l);
 if(t?.closest?.('[data-xfer-open]')){const run=()=>{const el=doc().querySelector('[data-transfer-root]');if(el){try{el.scrollIntoView({block:'start'})}catch{}try{el.querySelector('[data-action="export-backup"]')?.focus?.({preventScroll:true})}catch{}}};(global.requestAnimationFrame||(f=>global.setTimeout(f,0)))(run);return}
 // The app's own download action: the last-backup line here must follow it.
 if(t?.closest?.('[data-action="export-backup"]')){global.setTimeout(()=>{status();if(ui.note?.kind!=='error'&&!ui.undo)ui.note=null;paint()},0);return}
 const b=t?.closest?.('[data-xfer]');if(!b||b.disabled)return;
 const a=b.dataset.xfer;
 if(a==='snooze'){snooze();if(!paint()||b.closest('[data-xfer-strip]'))try{global.App?.render?.()}catch{}return}
 if(!b.closest('[data-transfer-root]'))return;
 if(a==='discard'){ui.incoming=null;ui.arm=false;if(ui.xfer?.role==='receive'&&ui.xfer.phase==='done')ui.xfer=null;paint('[data-xfer-status]')}
 else if(a==='arm'){ui.arm=true;paint('[data-xfer="apply-replace"]')}
 else if(a==='disarm'){ui.arm=false;paint('[data-xfer="arm"]')}
 else if(a==='apply-add')apply('add');
 else if(a==='apply-replace')apply('replace');
 else if(a==='dismiss-note'){ui.note=null;ui.undo=null;paint('[data-xfer-status]')}
 else if(a==='undo'){
  // Undo puts back the copy made before the import, so anything edited since goes too: say so every time.
  if(!global.confirm(w('Вернуть данные к состоянию до импорта? Всё, что вы изменили после него, тоже будет отменено.','Put the data back to what it was before the import? Anything you changed after it will be undone too.')))return;
  const id=ui.undo;ui.undo=null;ui.note=null;let r;try{r=global.App?.archive?.undo?.(id)}catch{}if(r===false)note(w('Снимок для отмены не найден.','The snapshot for undo was not found.'),'error');else note(w('Отменено: данные возвращены к состоянию до импорта.','Undone: the data is back to what it was before the import.'));paint('[data-xfer-note]')}
 else if(a==='send'){endSession();startSend()}
 else if(a==='receive'){endSession();ui.code='';ui.codeError='';ui.xfer={role:'receive',phase:'entry',done:0,total:0};paint('#xfer-code')}
 else if(a==='connect'){const input=doc().querySelector('#xfer-code');startReceive(input?.value||'')}
 else if(a==='cancel'||a==='close'){endSession();ui.xfer=null;paint('[data-xfer="send"]')}
 else if(a==='copy-code'){const code=formatCode(ui.xfer?.code||'');try{global.navigator?.clipboard?.writeText?.(code)?.then?.(()=>{b.textContent=w('Скопировано','Copied')},()=>{})}catch{}}
}
async function onChange(e){
 const t=e.target;if(!t?.closest?.('[data-transfer-root]'))return;
 if(t.matches?.('[data-xfer-days]')){setDays(t.value);paint('[data-xfer-days]');return}
 if(!t.matches?.('[data-xfer-file]'))return;
 const file=t.files?.[0],l=lang(),{w}=words(l);if(!file)return;
 let next;
 if(file.size>MAX_BYTES)next={source:'file',name:file.name,error:w('Файл слишком большой для архива.','The file is too large to be an archive.')};
 else{
  let data,ok=true;try{data=JSON.parse(await file.text())}catch{ok=false}
  next=ok?inspect(data,'file',file.name):{source:'file',name:file.name,error:w('Файл не читается как архив: это не JSON или он повреждён. Ничего не изменено.','The file cannot be read as an archive: it is not JSON or it is damaged. Nothing was changed.')};
 }
 try{t.value=''}catch{}
 ui.incoming=next;ui.arm=false;ui.note=null;ui.undo=null;
 paint('[data-xfer-preview]');
}
function onKey(e){if(e.key==='Enter'&&e.target?.id==='xfer-code'){e.preventDefault?.();startReceive(e.target.value)}}
function bind(){
 const d=doc();if(!d?.addEventListener)return;
 d.addEventListener('click',onClick);
 d.addEventListener('change',e=>{onChange(e)});
 d.addEventListener('keydown',onKey);
 d.addEventListener('visibilitychange',()=>{if(d.visibilityState==='visible')ui.session?.wake?.()});
 // Leaving the page ends a transfer cleanly; the receiver has written nothing, so nothing is lost.
 global.addEventListener?.('pagehide',()=>{try{ui.session?.cancel()}catch{}});
}
bind();

global.Transfer={render,strip,status,noteChange,snooze,setDays,plan,reminder,createSession,
 _test:{canon,newCode,normalizeCode,formatCode,derive,seal,unseal,cleanMeta,dataSig,inspect,META_KEY,CHANGES_DUE,ui:()=>ui,reset(){endSession();ui={incoming:null,busy:false,note:null,arm:false,mode:null,codeError:'',session:null,xfer:null,code:'',undo:null}},onClick,onChange}};
})(typeof window!=='undefined'?window:globalThis);
