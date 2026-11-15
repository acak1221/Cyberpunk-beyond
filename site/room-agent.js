/* «Агент»: an in-world feed the Game Master writes for the players of a room: jobs, news, wanted notices, events and
   places with a rating. Entries live on the campaign (campaign.agentFeed, optional), so they are saved, backed up and
   exported with it. Each entry is a draft until the Game Master publishes it; only published entries leave the device,
   as one retained message of type 'agent' on the room subtopic 'a', signed like everything else in the room (room.js).
   Players only read. A page that does not know this type ignores it: the type and the subtopic are new, the envelope
   and the protocol number are not changed. No content is shipped with the app: every word of an entry is the Game
   Master's own. (Not to be confused with agent-notes.js, the contacts and goals on a character sheet.) */
(function(global){
'use strict';
const KINDS=['job','news','wanted','event','place'];
const MAX_ENTRIES=60,MAX_PUBLISHED=30,MAX_TITLE=80,MAX_TEXT=500,MAX_BYTES=32000,TTL=12*3600*1000,RESEND=180000,HEAD=5;
const ID=/^[A-Za-z0-9_-]{1,40}$/;
const T={
 ru:{title:'АГЕНТ',kinds:{job:'Заказ',news:'Новости',wanted:'Розыск',event:'Событие',place:'Место'},
  fromGM:'Ленту ведёт ведущий. Изменить записи здесь нельзя.',more:n=>`Ещё записей: ${n}`,stars:n=>`Оценка: ${n} из 5`,
  toastOne:(k,s)=>`Агент · ${k}: ${s}`,toastMany:n=>`Агент: новых записей — ${n}`,
  gmNoCampaign:'Чтобы вести ленту, выберите выше кампанию для комнаты.',gmNone:'Игроки пока не видят ни одной записи. Откройте кампанию и опубликуйте запись в разделе «Агент».',gmSees:(n,m)=>`Игроки видят записей: ${n}. Черновиков: ${m}.`,
  editTitle:'АГЕНТ: ЛЕНТА ДЛЯ ИГРОКОВ',count:n=>`опубликовано ${n} / ${MAX_PUBLISHED}`,
  help:'Пишите записи от лица города: заказы, новости, розыск, события и места. Черновики видите только вы. Запись появится у игроков в комнате «Игра онлайн», когда вы нажмёте «Опубликовать».',
  stNoRoom:'Комната не открыта. Опубликованные записи появятся у игроков, когда вы создадите комнату и выберете в ней эту кампанию.',stPlayer:'Вы в комнате как игрок. Публиковать записи может только ведущий комнаты.',stOther:'В комнате выбрана другая кампания. Чтобы игроки увидели эти записи, выберите эту кампанию на странице «Игра онлайн».',stLive:n=>`Комната открыта: игроки видят записей — ${n}.`,
  cut:(a,b)=>`Из-за объёма игрокам уйдут только ${a} самых новых записей из ${b}.`,
  kind:'Вид записи',rating:'Оценка места',ratingOpt:n=>`${n} из 5`,heading:'Заголовок',headingPh:'Коротко, одной строкой',text:'Текст',textPh:'Что узнают игроки',
  add:'Добавить в черновики',saveEdit:'Сохранить изменения',cancel:'Отмена',editing:'Вы изменяете запись.',
  drafts:n=>`Черновики (${n})`,published:n=>`Опубликовано (${n})`,noDrafts:'Черновиков нет.',noPublished:'Игрокам пока ничего не открыто.',
  publish:'Опубликовать',hide:'Скрыть от игроков',edit:'Изменить',del:'Удалить',
  needTitle:'Введите заголовок записи.',fullPub:`Игрокам можно открыть не больше ${MAX_PUBLISHED} записей. Скройте одну из опубликованных.`,fullAll:`В ленте не больше ${MAX_ENTRIES} записей. Удалите ненужные.`,
  gone:'Этой записи уже нет.',deleted:'Запись удалена.',undo:'Отменить',noUndo:'Вернуть запись не получилось: лента изменилась.'},
 en:{title:'AGENT',kinds:{job:'Job',news:'News',wanted:'Wanted',event:'Event',place:'Place'},
  fromGM:'The feed is run by the Game Master. You cannot change entries here.',more:n=>`More entries: ${n}`,stars:n=>`Rating: ${n} out of 5`,
  toastOne:(k,s)=>`Agent · ${k}: ${s}`,toastMany:n=>`Agent: new entries — ${n}`,
  gmNoCampaign:'To run the feed, choose a campaign for the room above.',gmNone:'Players do not see any entries yet. Open the campaign and publish an entry under “Agent”.',gmSees:(n,m)=>`Players see entries: ${n}. Drafts: ${m}.`,
  editTitle:'AGENT: FEED FOR PLAYERS',count:n=>`published ${n} / ${MAX_PUBLISHED}`,
  help:'Write entries in the voice of the city: jobs, news, wanted notices, events and places. Only you see drafts. An entry reaches the players in the “Online play” room once you press “Publish”.',
  stNoRoom:'No room is open. Published entries reach the players once you create a room and choose this campaign in it.',stPlayer:'You are in the room as a player. Only the Game Master of the room can publish entries.',stOther:'Another campaign is chosen in the room. To show these entries, choose this campaign on the “Online play” page.',stLive:n=>`The room is open: players see entries — ${n}.`,
  cut:(a,b)=>`Because of their size only the ${a} newest of ${b} entries are sent to players.`,
  kind:'Kind of entry',rating:'Rating of the place',ratingOpt:n=>`${n} out of 5`,heading:'Title',headingPh:'Short, one line',text:'Text',textPh:'What the players learn',
  add:'Add to drafts',saveEdit:'Save changes',cancel:'Cancel',editing:'You are changing an entry.',
  drafts:n=>`Drafts (${n})`,published:n=>`Published (${n})`,noDrafts:'No drafts.',noPublished:'Nothing is open to the players yet.',
  publish:'Publish',hide:'Hide from players',edit:'Edit',del:'Delete',
  needTitle:'Enter a title for the entry.',fullPub:`No more than ${MAX_PUBLISHED} entries can be open to players. Hide one of the published entries first.`,fullAll:`The feed holds no more than ${MAX_ENTRIES} entries. Delete the ones you do not need.`,
  gone:'This entry is no longer there.',deleted:'The entry is deleted.',undo:'Undo',noUndo:'The entry could not be put back: the feed has changed.'},
};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const enc=typeof TextEncoder!=='undefined'?new TextEncoder():null;
const size=s=>enc?enc.encode(s).length:s.length*3;
const isObj=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
// A title is one line; a text keeps its line breaks and loses every other control character.
const line=(v,n)=>typeof v==='string'?v.replace(/[\u0000-\u001f\u007f\u2028\u2029]/g,' ').replace(/\s+/g,' ').trim().slice(0,n).trim():'';
const para=(v,n)=>typeof v==='string'?v.replace(/\t/g,' ').replace(/[\u2028\u2029]/g,'\n').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g,'').replace(/\n{3,}/g,'\n\n').trim().slice(0,n).trim():'';
const time=v=>{const n=Number(v);return Number.isFinite(n)&&n>0&&n<=Number.MAX_SAFE_INTEGER?Math.trunc(n):0};
const rate=v=>{const n=Math.round(Number(v));return Number.isFinite(n)&&n>=1&&n<=5?n:3};
const kindOf=v=>KINDS.includes(v)?v:'news';
const lang=()=>{try{return global.App?.lang?.()==='en'?'en':'ru'}catch{return 'ru'}};
const pad2=n=>String(n).padStart(2,'0');
function stamp(at){const d=new Date(at);return !at||isNaN(d)?'':`${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`}
const empty=()=>({campaign:'',list:[]});
const blank=()=>({campaignId:'',editId:'',kind:'job',title:'',text:'',rating:3});
let shown=empty(),shownAt=0,roomKey='',lastSent=null,sentAt=0,lastOnline=0,moreOpen=false,form=blank();
function newId(taken){for(;;){const id='a'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8).padEnd(6,'0');if(!taken.has(id))return id}}

// The feed as stored, rebuilt from the known fields. An entry without a usable id gets one made from its place in the
// list, so the same broken save reads the same way every time and a button drawn from one reading still finds its entry.
function read(c){
 const out=[],ids=new Set();
 for(const x of Array.isArray(c?.agentFeed)?c.agentFeed:[]){
  if(!isObj(x))continue;const title=line(x.title,MAX_TITLE);if(!title)continue;
  let id=typeof x.id==='string'&&ID.test(x.id)&&!ids.has(x.id)?x.id:'';
  for(let n=out.length;!id;n++){const made='fix-'+n;if(!ids.has(made))id=made}
  ids.add(id);
  const kind=kindOf(x.kind),e={id,kind,title,text:para(x.text,MAX_TEXT)};
  if(kind==='place')e.rating=rate(x.rating);
  e.at=time(x.at);
  if(x.pub===true){e.pub=true;e.pubAt=time(x.pubAt)}
  out.push(e);if(out.length>=MAX_ENTRIES)break;
 }
 // A save made by hand or brought in from a file may flag more entries as published than the limit. The editor shows and
 // a message carries only that many, so the rest would be entries the Game Master cannot see and that slide out to the
 // players later. The newest publications keep the flag; the others come back as drafts, in plain sight.
 const pub=out.filter(e=>e.pub);
 if(pub.length>MAX_PUBLISHED)for(const e of pub.sort((a,b)=>b.pubAt-a.pubAt).slice(MAX_PUBLISHED)){delete e.pub;delete e.pubAt}
 return out;
}
// An emptied feed leaves no field behind, so a campaign that never used the feed stays as it was.
function store(c,list){if(list.length)c.agentFeed=list;else delete c.agentFeed}
function add(c,fields,now=Date.now()){
 if(!isObj(c))return {ok:false,reason:'missing'};
 const title=line(fields?.title,MAX_TITLE);if(!title)return {ok:false,reason:'empty'};
 const list=read(c);if(list.length>=MAX_ENTRIES)return {ok:false,reason:'full'};
 const kind=kindOf(fields.kind),e={id:newId(new Set(list.map(x=>x.id))),kind,title,text:para(fields.text,MAX_TEXT)};
 if(kind==='place')e.rating=rate(fields.rating);
 e.at=time(now);list.unshift(e);store(c,list);
 return {ok:true,id:e.id};
}
// Changing an entry keeps whether it is published: players then simply see the new wording.
function update(c,id,fields,now=Date.now()){
 if(!isObj(c))return {ok:false,reason:'missing'};
 const list=read(c),e=list.find(x=>x.id===id);if(!e)return {ok:false,reason:'missing'};
 const title=line(fields?.title,MAX_TITLE);if(!title)return {ok:false,reason:'empty'};
 e.kind=kindOf(fields.kind);e.title=title;e.text=para(fields.text,MAX_TEXT);
 if(e.kind==='place')e.rating=rate(fields.rating);else delete e.rating;
 e.at=time(now);store(c,list);
 return {ok:true,id};
}
function setPublished(c,id,on,now=Date.now()){
 if(!isObj(c))return {ok:false,reason:'missing'};
 const list=read(c),e=list.find(x=>x.id===id);if(!e)return {ok:false,reason:'missing'};
 if(on&&!e.pub){if(list.filter(x=>x.pub).length>=MAX_PUBLISHED)return {ok:false,reason:'full'};e.pub=true;e.pubAt=time(now)}
 else if(!on){delete e.pub;delete e.pubAt}
 store(c,list);
 return {ok:true,count:list.filter(x=>x.pub).length};
}
function remove(c,id){
 if(!isObj(c))return {ok:false,reason:'missing'};
 const list=read(c),index=list.findIndex(x=>x.id===id);if(index<0)return {ok:false,reason:'missing'};
 const [entry]=list.splice(index,1);store(c,list);
 return {ok:true,entry,index};
}
// Undo of a deletion: the entry goes back where it was, unless the feed has filled up or took the id meanwhile.
function restore(c,entry,index){
 if(!isObj(c))return {ok:false,reason:'missing'};
 const back=read({agentFeed:[entry]})[0],list=read(c);
 if(!back||back.id!==entry?.id||list.some(x=>x.id===back.id))return {ok:false,reason:'missing'};
 if(list.length>=MAX_ENTRIES)return {ok:false,reason:'full'};
 if(back.pub&&list.filter(x=>x.pub).length>=MAX_PUBLISHED){delete back.pub;delete back.pubAt}
 const at=Number.isInteger(index)?Math.max(0,Math.min(index,list.length)):0;list.splice(at,0,back);store(c,list);
 return {ok:true,id:back.id};
}
const publishedOf=list=>list.filter(e=>e.pub).sort((a,b)=>b.pubAt-a.pubAt).slice(0,MAX_PUBLISHED);
// What players receive: the campaign name and the published entries, newest publication first. Drafts never leave the
// device. Entries that do not fit the size are left out, oldest first.
function payload(c){
 if(!isObj(c))return {data:empty(),fit:0,total:0};
 const list=publishedOf(read(c)).map(e=>({id:e.id,k:e.kind,title:e.title,text:e.text,at:e.pubAt,...(e.kind==='place'?{r:e.rating}:{})})),total=list.length;
 const data={campaign:line(c.name,80),list};
 while(list.length&&size(JSON.stringify(data))>MAX_BYTES)list.pop();
 return {data,fit:list.length,total};
}
// Anything received is rebuilt from scratch: a well-formed id, a known kind, clipped text, a rating only for a place.
function clean(d){
 const out=empty();if(!isObj(d))return out;
 out.campaign=line(d.campaign,80);
 const ids=new Set();
 for(const x of Array.isArray(d.list)?d.list.slice(0,MAX_PUBLISHED):[]){
  if(!isObj(x)||typeof x.id!=='string'||!ID.test(x.id)||ids.has(x.id))continue;
  const title=line(x.title,MAX_TITLE);if(!title)continue;
  ids.add(x.id);const k=kindOf(x.k),e={id:x.id,k,title,text:para(x.text,MAX_TEXT),at:time(x.at)};
  if(k==='place')e.r=rate(x.r);
  out.list.push(e);
 }
 return out;
}
const link=()=>{try{return global.Room?.agentLink||null}catch{return null}};
const whoIs=()=>{try{const w=link()?.who?.();return w&&typeof w==='object'?w:null}catch{return null}};
function sync(who){const k=who?String(who.room||''):'';if(k!==roomKey){roomKey=k;shown=empty();shownAt=0;lastSent=null;sentAt=0;lastOnline=0;moreOpen=false}}
const appState=()=>{try{return global.App?.getState?.()||null}catch{return null}};
const campaignOf=(st,id)=>id&&Array.isArray(st?.campaigns)?st.campaigns.find(c=>c&&typeof c==='object'&&c.id===id)||null:null;
const say=m=>{try{global.App?.notify?.(m)}catch{}};

// Called by room.js for the Game Master whenever it publishes its own state. Sends when the published entries changed;
// `force` (a heartbeat or a new connection) repeats them now and then, so a relay that lost its copy gets one again. An
// empty feed is small and is repeated on every heartbeat: an earlier message put back on a relay by somebody else is then
// replaced, and entries the Game Master hid do not stay with players who join later.
function publish(force=false,now=Date.now()){
 const who=whoIs();sync(who);if(!who||who.role!=='gm')return false;
 const data=payload(campaignOf(appState(),who.campaignId)).data,s=JSON.stringify(data),online=Number(who.online)||0,grew=online>lastOnline;lastOnline=online;
 if(s===lastSent&&!(force&&(grew||!data.list.length||now-sentAt>=RESEND)))return false;
 lastSent=s;sentAt=now;
 try{Promise.resolve(link().send(data,now)).then(n=>{if(!n&&lastSent===s)lastSent=null},()=>{if(lastSent===s)lastSent=null})}catch{lastSent=null}
 return true;
}
// Called by room.js only for a message the trusted Game Master signed. True when the view has to be repainted. A live
// message that brings an entry this page has not shown yet is announced; a copy kept by a relay and a reworded entry are not.
function receive(d,at,retained=false,now=Date.now()){
 const who=whoIs();sync(who);if(!who||who.role==='gm')return false;
 const when=Number(at);if(!Number.isFinite(when)||when<shownAt||now-when>TTL)return false;
 const next=clean(d),changed=JSON.stringify(next)!==JSON.stringify(shown),known=new Set(shown.list.map(e=>e.id)),fresh=next.list.filter(e=>!known.has(e.id));
 shownAt=when;shown=next;
 if(fresh.length&&!retained){const t=T[lang()];say(fresh.length===1?t.toastOne(t.kinds[fresh[0].k],fresh[0].title):t.toastMany(fresh.length))}
 return changed;
}
const starsHTML=(r,t)=>`<span class="ra-stars" role="img" aria-label="${esc(t.stars(r))}">${'★'.repeat(r)}${'☆'.repeat(5-r)}</span>`;
// One entry, the same for the room card and the editor lists. `e` is in the shape that goes over the wire.
const entryHTML=(e,t,extra='')=>`<article class="ra-item ra-k-${e.k}"><div class="ra-head"><span class="ra-chip">${esc(t.kinds[e.k])}</span>${e.k==='place'?starsHTML(e.r,t):''}${stamp(e.at)?`<time>${esc(stamp(e.at))}</time>`:''}</div><strong class="ra-title">${esc(e.title)}</strong>${e.text?`<p>${esc(e.text)}</p>`:''}${extra}</article>`;
// The card on the room page: read-only for players, a mirror of what is out for the Game Master.
function card(){
 const who=whoIs();sync(who);if(!who)return '';
 const t=T[lang()],gm=who.role==='gm',camp=gm?campaignOf(appState(),who.campaignId):null,data=gm?payload(camp).data:shown;
 if(!gm&&!data.list.length)return '';
 const head=data.list.slice(0,HEAD),rest=data.list.slice(HEAD),one=e=>entryHTML(e,t);
 // The summary has an id because room.js repaints the whole page on every message and puts the keyboard focus back only on an element it can find again by id.
 const body=data.list.length?`${data.campaign?`<p class="room-muted ra-campaign">${esc(data.campaign)}</p>`:''}<div class="ra-list">${head.map(one).join('')}</div>${rest.length?`<details class="ra-more" data-ra-more${moreOpen?' open':''}><summary id="ra-more-toggle">${esc(t.more(rest.length))}</summary><div class="ra-list">${rest.map(one).join('')}</div></details>`:''}`:'';
 const note=gm?(!camp?t.gmNoCampaign:data.list.length?t.gmSees(data.list.length,read(camp).filter(e=>!e.pub).length):t.gmNone):t.fromGM;
 return `<section class="card ra-card" data-ra-card><div class="card-heading"><span>${esc(t.title)}</span><span data-nx>${data.list.length}</span></div><p class="room-muted">${esc(note)}</p>${body}</section>`;
}
function statusText(c,t){
 const who=whoIs(),p=payload(c),cut=p.fit<p.total?' '+t.cut(p.fit,p.total):'';
 if(!who)return t.stNoRoom;if(who.role!=='gm')return t.stPlayer;if(who.campaignId!==c.id)return t.stOther;return t.stLive(p.fit)+cut;
}
// What is typed into the form is kept here, so a repaint of the whole page (a save, a message from the room) does not lose it.
function formFor(id){if(form.campaignId!==id){form=blank();form.campaignId=id}return form}
// The card under an open campaign where the Game Master writes, publishes and hides entries.
function panel(c,l){
 if(!isObj(c)||typeof c.id!=='string'||!c.id)return '';
 const t=T[l==='en'?'en':'ru'],list=read(c),f=formFor(c.id);
 if(f.editId&&!list.some(e=>e.id===f.editId))f.editId='';
 const drafts=list.filter(e=>!e.pub),pub=publishedOf(list);
 const btn=(act,e,label,cls)=>`<button type="button" class="btn ${cls}" data-ra-action="${act}" data-id="${esc(e.id)}" aria-label="${esc(label+': '+e.title)}">${esc(label)}</button>`;
 const row=e=>`<div data-ra-item="${esc(e.id)}">${entryHTML({id:e.id,k:e.kind,title:e.title,text:e.text,at:e.pub?e.pubAt:e.at,r:e.rating},t,`<div class="ra-actions">${e.pub?btn('unpublish',e,t.hide,'ghost'):btn('publish',e,t.publish,'primary')}${btn('edit',e,t.edit,'ghost')}${btn('delete',e,t.del,'ghost')}</div>`)}</div>`;
 // The groups are second-level headings: the page of an open campaign has only its h1 above them, and a card title is not a heading.
 const group=(key,title,items,none)=>`<div class="ra-group"><h2 class="ra-sub" tabindex="-1" data-ra-group="${key}">${esc(title)}</h2>${items.length?`<div class="ra-list">${items.map(row).join('')}</div>`:`<p class="muted">${esc(none)}</p>`}</div>`;
 const formHTML=`<div class="ra-form">${f.editId?`<p class="ra-editing">${esc(t.editing)}</p>`:''}<label class="field ra-f-kind">${esc(t.kind)}<select id="ra-kind" data-ra-field="kind">${KINDS.map(k=>`<option value="${k}"${f.kind===k?' selected':''}>${esc(t.kinds[k])}</option>`).join('')}</select></label>`
  +`<label class="field ra-f-rating" data-ra-rating${f.kind==='place'?'':' hidden'}>${esc(t.rating)}<select id="ra-rating" data-ra-field="rating">${[1,2,3,4,5].map(n=>`<option value="${n}"${f.rating===n?' selected':''}>${esc(t.ratingOpt(n))}</option>`).join('')}</select></label>`
  +`<label class="field ra-f-title">${esc(t.heading)}<input id="ra-title" data-ra-field="title" maxlength="${MAX_TITLE}" autocomplete="off" placeholder="${esc(t.headingPh)}" value="${esc(f.title)}"></label>`
  +`<label class="field ra-f-text">${esc(t.text)}<textarea id="ra-text" data-ra-field="text" rows="3" maxlength="${MAX_TEXT}" placeholder="${esc(t.textPh)}">${f.text?'\n'+esc(f.text):''}</textarea></label>`
  +`<div class="ra-actions ra-f-actions"><button type="button" class="btn primary" data-ra-action="save">${esc(f.editId?t.saveEdit:t.add)}</button>${f.editId?`<button type="button" class="btn ghost" data-ra-action="cancel">${esc(t.cancel)}</button>`:''}</div></div>`;
 // The help has a class of its own: the native look folds any long `p.muted` to two lines, and the folded part is what says that drafts stay private.
 return `<section class="card ra-edit" data-ra-edit="${esc(c.id)}"><div class="card-heading"><span>${esc(t.editTitle)}</span><span data-ra-count>${esc(t.count(pub.length))}</span></div><p class="ra-help">${esc(t.help)}</p><p class="ra-status" role="status" data-ra-status>${esc(statusText(c,t))}</p>${formHTML}${group('drafts',t.drafts(drafts.length),drafts,t.noDrafts)}${group('published',t.published(pub.length),pub,t.noPublished)}</section>`;
}

const doc=global.document;
const find=q=>{try{return doc?.querySelector?.(q)||null}catch{return null}};
const focusOn=q=>{try{find(q)?.focus?.()}catch{}};
const commit=()=>{try{global.App?.save?.()}catch{}try{global.App?.render?.()}catch{}};
// Typing only updates the kept form; the page is not repainted, so the caret stays where it is.
function onInput(e){
 const el=e?.target,name=el?.dataset?.raField;if(!name)return false;
 const root=el.closest?.('[data-ra-edit]'),id=root?.dataset?.raEdit;if(!id)return false;
 const f=formFor(id),v=String(el.value??'');
 if(name==='kind'){f.kind=kindOf(v);const box=root.querySelector?.('[data-ra-rating]');if(box)box.hidden=f.kind!=='place'}
 else if(name==='rating')f.rating=rate(v);
 else if(name==='title')f.title=v.slice(0,MAX_TITLE);
 else if(name==='text')f.text=v.slice(0,MAX_TEXT);
 return true;
}
function onClick(e){
 const b=e?.target?.closest?.('[data-ra-action]');if(!b)return false;
 const root=b.closest?.('[data-ra-edit]'),cid=root?.dataset?.raEdit,c=campaignOf(appState(),cid),t=T[lang()];if(!c)return false;
 const act=b.dataset.raAction,id=b.dataset.id||'',f=formFor(cid),item=`[data-ra-edit] [data-ra-item="${ID.test(id)?id:''}"] button`;
 if(act==='save'){
  // The fields themselves are the last word: a browser may fill them without an input event.
  for(const name of ['kind','rating','title','text']){const el=root.querySelector?.(`[data-ra-field="${name}"]`);if(el)onInput({target:el})}
  const editing=f.editId,r=editing?update(c,editing,f):add(c,f);
  if(!r.ok){say(r.reason==='empty'?t.needTitle:r.reason==='full'?t.fullAll:t.gone);if(r.reason==='missing'){form=blank();commit()}else focusOn('#ra-title');return true}
  form=blank();form.campaignId=cid;commit();focusOn(editing?`[data-ra-edit] [data-ra-item="${r.id}"] button`:'#ra-title');
 }else if(act==='cancel'){
  const was=f.editId;form=blank();form.campaignId=cid;try{global.App?.render?.()}catch{}focusOn(`[data-ra-edit] [data-ra-item="${was}"] [data-ra-action="edit"]`);
 }else if(act==='publish'||act==='unpublish'){
  const r=setPublished(c,id,act==='publish');
  if(!r.ok){say(r.reason==='full'?t.fullPub:t.gone);if(r.reason!=='full')commit();return true}
  commit();focusOn(item);
 }else if(act==='edit'){
  const x=read(c).find(v=>v.id===id);if(!x){say(t.gone);commit();return true}
  form={campaignId:cid,editId:x.id,kind:x.kind,title:x.title,text:x.text,rating:x.rating||3};try{global.App?.render?.()}catch{}focusOn('#ra-title');
 }else if(act==='delete'){
  const r=remove(c,id);if(!r.ok){say(t.gone);commit();return true}
  if(f.editId===id){form=blank();form.campaignId=cid}
  commit();focusOn(`[data-ra-edit] [data-ra-group="${r.entry.pub?'published':'drafts'}"]`);
  // The deletion can be taken back while the notice is on the screen; the campaign is looked up again, it may be gone by then.
  const undo=()=>{const again=campaignOf(appState(),cid),back=again?restore(again,r.entry,r.index):{ok:false};if(!back.ok){say(t.noUndo);return}commit();focusOn(`[data-ra-edit] [data-ra-item="${back.id}"] button`)};
  try{if(typeof global.App?.notifyAction==='function')global.App.notifyAction(t.deleted,t.undo,undo);else say(t.deleted)}catch{}
 }
 return true;
}
if(doc?.addEventListener){
 doc.addEventListener('click',onClick);doc.addEventListener('input',onInput);doc.addEventListener('change',onInput);
 // The list of older entries stays open across the live repaints of the room page.
 doc.addEventListener('toggle',e=>{if(e.target?.dataset?.raMore!==undefined)moreOpen=e.target.open===true},true);
}
global.RoomAgent={KINDS,MAX_ENTRIES,MAX_PUBLISHED,MAX_TITLE,MAX_TEXT,MAX_BYTES,TTL,RESEND,HEAD,T,read,add,update,setPublished,remove,restore,payload,clean,publish,receive,card,panel,onClick,onInput,
 // The Game Master role came (back) to this device: whoever held it in between sent a feed of their own, so the next
 // publish goes out even when this device's feed has not changed since it last sent it.
 forget(){lastSent=null;sentAt=0},
 _test:{shown:()=>shown,form:()=>form,reset:()=>{roomKey='\u0000';sync(null);form=blank()},state:()=>({lastSent,sentAt,shownAt})}};
})(typeof window!=='undefined'?window:globalThis);
