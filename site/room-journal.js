/* Shared session journal for the online room. The Game Master marks entries of the campaign journal
   (campaign.journalShared: ids of entries, optional) and they are sent to the players as one retained
   message of type 'journal' on the room subtopic 'j', signed like everything else in the room (room.js,
   PROTOCOL 3). Players only read. A page that does not know this type ignores it: the type and the
   subtopic are new, the envelope and the protocol number are not changed. */
(function(global){
'use strict';
const MAX_SHARED=20,MAX_TEXT=2000,MAX_BYTES=24000,TTL=12*3600*1000,RESEND=180000,HEAD=3,PREVIEW=220;
const T={
 ru:{title:'ЖУРНАЛ СЕССИИ',fromGM:'Записи публикует ведущий. Изменить их здесь нельзя.',more:n=>`Ещё записей: ${n}`,save:'Сохранить в файл',updated:'Ведущий обновил журнал сессии.',
  gmNone:'Игроки пока не видят ни одной записи. Откройте кампанию и отметьте записи в разделе «Журнал для игроков».',gmNoCampaign:'Чтобы показывать игрокам журнал, выберите выше кампанию для комнаты.',gmSees:n=>`Игроки видят записей: ${n}.`,
  pickTitle:'ЖУРНАЛ ДЛЯ ИГРОКОВ',pickHelp:'Отметьте записи журнала, которые увидят игроки в комнате «Игра онлайн». Игроки только читают: изменить или удалить запись у вас они не могут. Заметки ведущего и остальные записи остаются у вас.',pickEmpty:'В журнале кампании пока нет записей.',pickShow:'Показать игрокам',
  stNoRoom:'Комната не открыта. Отмеченные записи появятся у игроков, когда вы создадите комнату и выберете в ней эту кампанию.',stPlayer:'Вы в комнате как игрок. Публиковать записи может только ведущий комнаты.',stOther:'В комнате выбрана другая кампания. Чтобы игроки увидели эти записи, выберите эту кампанию на странице «Игра онлайн».',stLive:n=>`Комната открыта: игроки видят отмеченные записи (${n}).`,
  full:`Можно показать не больше ${MAX_SHARED} записей. Снимите отметку с другой записи.`,cut:(a,b)=>`Из-за объёма игрокам уйдут только ${a} самых новых записей из ${b}.`,auto:'авто',file:'журнал сессии',unknown:'Кампания'},
 en:{title:'SESSION JOURNAL',fromGM:'Entries are published by the Game Master. You cannot change them here.',more:n=>`More entries: ${n}`,save:'Save to a file',updated:'The Game Master updated the session journal.',
  gmNone:'Players do not see any entries yet. Open the campaign and mark entries under “Journal for players”.',gmNoCampaign:'To show the journal to players, choose a campaign for the room above.',gmSees:n=>`Players see entries: ${n}.`,
  pickTitle:'JOURNAL FOR PLAYERS',pickHelp:'Mark the journal entries players will see in the “Online play” room. Players only read: they cannot change or delete your entries. GM notes and the other entries stay with you.',pickEmpty:'The campaign journal has no entries yet.',pickShow:'Show to players',
  stNoRoom:'No room is open. Marked entries reach the players once you create a room and choose this campaign in it.',stPlayer:'You are in the room as a player. Only the Game Master of the room can publish entries.',stOther:'Another campaign is chosen in the room. To show these entries, choose this campaign on the “Online play” page.',stLive:n=>`The room is open: players see the marked entries (${n}).`,
  full:`No more than ${MAX_SHARED} entries can be shown. Unmark another entry first.`,cut:(a,b)=>`Because of their size only the ${a} newest of ${b} entries are sent to players.`,auto:'auto',file:'session journal',unknown:'Campaign'},
};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const enc=typeof TextEncoder!=='undefined'?new TextEncoder():null;
const size=s=>enc?enc.encode(s).length:s.length*3;
const clip=(v,n)=>typeof v==='string'?v.replace(/\u0000/g,'').slice(0,n):'';
const lang=()=>{try{return global.App?.lang?.()==='en'?'en':'ru'}catch{return 'ru'}};
const pad2=n=>String(n).padStart(2,'0');
function stamp(at){const d=new Date(at);return !at||isNaN(d)?'':`${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`}
const empty=()=>({campaign:'',list:[]});
let shown=empty(),shownAt=0,roomKey='',lastSent=null,sentAt=0,lastOnline=0,moreOpen=false;

// The campaign journal as campaigns.js reads it (the same limits), so the module also works on its own.
function entries(c){
 const read=global.Campaigns?.readJournal;if(typeof read==='function')return read(c);
 const out=[];for(const x of Array.isArray(c?.journal)?c.journal:[]){if(!x||typeof x!=='object'||Array.isArray(x))continue;const text=clip(x.text,MAX_TEXT);if(!text.trim())continue;const at=Number(x.at);out.push({id:typeof x.id==='string'&&x.id&&x.id.length<=160?x.id:'j'+out.length+'-'+(Number.isFinite(at)?at:0),at:Number.isFinite(at)?at:0,text,auto:x.auto===true});if(out.length>=300)break}
 return out;
}
// Ids of the entries marked for players: only entries that still exist, each once, at most MAX_SHARED.
function sharedIds(c){
 const have=new Set(entries(c).map(e=>e.id)),out=[];
 for(const id of Array.isArray(c?.journalShared)?c.journalShared:[]){if(typeof id==='string'&&id&&id.length<=160&&have.has(id)&&!out.includes(id))out.push(id);if(out.length>=MAX_SHARED)break}
 return out;
}
function setShared(c,id,on){
 if(!c||typeof c!=='object'||Array.isArray(c)||typeof id!=='string')return {ok:false,reason:'missing'};
 const ids=sharedIds(c),at=ids.indexOf(id);
 if(on){if(at<0){if(!entries(c).some(e=>e.id===id))return {ok:false,reason:'missing'};if(ids.length>=MAX_SHARED)return {ok:false,reason:'full'};ids.push(id)}}
 else if(at>=0)ids.splice(at,1);
 if(ids.length)c.journalShared=ids;else delete c.journalShared;
 return {ok:true,count:ids.length};
}
// What players receive: the campaign name and the marked entries, newest first. Entries that do not fit the size are left out, oldest first.
function payload(c){
 if(!c||typeof c!=='object')return {data:empty(),fit:0,total:0};
 const ids=new Set(sharedIds(c)),list=entries(c).filter(e=>ids.has(e.id)).map(e=>({at:Number.isFinite(e.at)&&e.at>0?Math.trunc(e.at):0,text:e.text})),total=list.length;
 const data={campaign:clip(c.name,80).replace(/\s+/g,' ').trim(),list};
 while(list.length&&size(JSON.stringify(data))>MAX_BYTES)list.pop();
 return {data,fit:list.length,total};
}
// Anything received is rebuilt from scratch: text and a time, nothing else.
function clean(d){
 const out=empty();if(!d||typeof d!=='object'||Array.isArray(d))return out;
 out.campaign=clip(d.campaign,80);
 for(const x of Array.isArray(d.list)?d.list.slice(0,MAX_SHARED):[]){if(!x||typeof x!=='object'||Array.isArray(x))continue;const text=clip(x.text,MAX_TEXT),at=Number(x.at);if(text.trim())out.list.push({at:Number.isFinite(at)&&at>0&&at<=Number.MAX_SAFE_INTEGER?Math.trunc(at):0,text})}
 return out;
}
const link=()=>{try{return global.Room?.journalLink||null}catch{return null}};
const whoIs=()=>{try{const w=link()?.who?.();return w&&typeof w==='object'?w:null}catch{return null}};
function sync(who){const k=who?String(who.room||''):'';if(k!==roomKey){roomKey=k;shown=empty();shownAt=0;lastSent=null;sentAt=0;lastOnline=0;moreOpen=false}}
const appState=()=>{try{return global.App?.getState?.()||null}catch{return null}};
const campaignOf=(st,id)=>id&&Array.isArray(st?.campaigns)?st.campaigns.find(c=>c&&typeof c==='object'&&c.id===id)||null:null;

// Called by room.js for the Game Master whenever it publishes its own state. Sends when the marked entries changed; `force`
// (a heartbeat or a new connection) repeats them now and then, so a relay that lost its copy gets one again. An empty journal
// is small and is repeated on every heartbeat, like the 'cleared' initiative and clocks: an earlier message put back on a
// relay by somebody else is then replaced, and entries the Game Master took back do not stay with players who join later.
function publish(force=false,now=Date.now()){
 const who=whoIs();sync(who);if(!who||who.role!=='gm')return false;
 const data=payload(campaignOf(appState(),who.campaignId)).data,s=JSON.stringify(data),online=Number(who.online)||0,grew=online>lastOnline;lastOnline=online;
 if(s===lastSent&&!(force&&(grew||!data.list.length||now-sentAt>=RESEND)))return false;
 lastSent=s;sentAt=now;
 try{Promise.resolve(link().send(data,now)).then(n=>{if(!n&&lastSent===s)lastSent=null},()=>{if(lastSent===s)lastSent=null})}catch{lastSent=null}
 return true;
}
// Called by room.js only for a message the trusted Game Master signed. True when the view has to be repainted.
function receive(d,at,retained=false,now=Date.now()){
 const who=whoIs();sync(who);if(!who||who.role==='gm')return false;
 const when=Number(at);if(!Number.isFinite(when)||when<shownAt||now-when>TTL)return false;
 const next=clean(d),before=JSON.stringify(shown),changed=JSON.stringify(next)!==before,fresh=next.list.length&&(next.list.length>shown.list.length||next.list[0].text!==shown.list[0]?.text);
 shownAt=when;shown=next;
 if(changed&&fresh&&!retained){try{global.App?.notify?.(T[lang()].updated)}catch{}}
 return changed;
}
const entryHTML=e=>`<article class="rj-entry">${stamp(e.at)?`<time>${esc(stamp(e.at))}</time>`:''}<p>${esc(e.text)}</p></article>`;
// The card on the room page: read-only for players, a summary of what is out for the Game Master.
function card(){
 const who=whoIs();sync(who);if(!who)return '';
 const t=T[lang()],gm=who.role==='gm',camp=gm?campaignOf(appState(),who.campaignId):null,data=gm?payload(camp).data:shown;
 if(!gm&&!data.list.length)return '';
 const head=data.list.slice(0,HEAD),rest=data.list.slice(HEAD);
 const body=data.list.length?`${data.campaign?`<p class="room-muted rj-campaign">${esc(data.campaign)}</p>`:''}<div class="rj-list">${head.map(entryHTML).join('')}</div>${rest.length?`<details class="rj-more" data-rj-more${moreOpen?' open':''}><summary>${esc(t.more(rest.length))}</summary><div class="rj-list">${rest.map(entryHTML).join('')}</div></details>`:''}`:'';
 const note=gm?(!camp?t.gmNoCampaign:data.list.length?t.gmSees(data.list.length):t.gmNone):t.fromGM;
 return `<section class="card room-journal" data-rj-card><div class="card-heading"><span>${esc(t.title)}</span><span data-nx>${data.list.length}</span></div><p class="room-muted">${esc(note)}</p>${body}${!gm?`<button type="button" class="btn ghost rj-save" data-rj-action="download">⬇ ${esc(t.save)}</button>`:''}</section>`;
}
function statusText(c,t){
 const who=whoIs(),p=payload(c),cut=p.fit<p.total?' '+t.cut(p.fit,p.total):'';
 if(!who)return t.stNoRoom;if(who.role!=='gm')return t.stPlayer;if(who.campaignId!==c.id)return t.stOther;return t.stLive(p.fit)+cut;
}
// The card under an open campaign where the Game Master marks what players see.
function panel(c,l){
 if(!c||typeof c!=='object'||typeof c.id!=='string')return '';
 const t=T[l==='en'?'en':'ru'],list=entries(c),ids=new Set(sharedIds(c));
 const row=e=>`<label class="rj-row"><input type="checkbox" data-rj-share="${esc(e.id)}"${ids.has(e.id)?' checked':''} aria-label="${esc(t.pickShow+': '+e.text.slice(0,60))}"><span class="rj-row-text"><time>${esc(stamp(e.at))}${e.auto?` · ${esc(t.auto)}`:''}</time><span>${esc(e.text.length>PREVIEW?e.text.slice(0,PREVIEW)+'…':e.text)}</span></span></label>`;
 return `<section class="card rj-pick" data-rj-pick="${esc(c.id)}"><div class="card-heading"><span>${esc(t.pickTitle)}</span><span data-rj-count>${ids.size} / ${MAX_SHARED}</span></div><p class="muted">${esc(t.pickHelp)}</p><p class="rj-status" role="status" data-rj-status>${esc(statusText(c,t))}</p>${list.length?`<div class="rj-rows" role="group" aria-label="${esc(t.pickShow)}">${list.map(row).join('')}</div>`:`<p class="muted">${esc(t.pickEmpty)}</p>`}</section>`;
}
function markdown(data,l){const t=T[l==='en'?'en':'ru'];let out=`# ${data.campaign||t.unknown} — ${t.file}\n\n`;for(const e of data.list.slice().reverse())out+=`- ${stamp(e.at)?`**${stamp(e.at)}** — `:''}${e.text.replace(/\r/g,'').replace(/\n+/g,'\n  ')}\n`;return out}
function download(name,body){try{const doc=global.document,url=URL.createObjectURL(new Blob([body],{type:'text/markdown;charset=utf-8'})),a=doc.createElement('a');a.href=url;a.download=name;doc.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);return true}catch{return false}}
function onChange(e){
 const box=e?.target;if(!box?.dataset||box.dataset.rjShare===undefined)return false;
 const root=box.closest?.('[data-rj-pick]'),c=campaignOf(appState(),root?.dataset?.rjPick),t=T[lang()];if(!c)return false;
 const r=setShared(c,box.dataset.rjShare,box.checked===true);
 if(!r.ok){box.checked=false;try{global.App?.notify?.(r.reason==='full'?t.full:t.pickEmpty)}catch{}return true}
 try{global.App.save()}catch{}
 const count=root.querySelector?.('[data-rj-count]'),status=root.querySelector?.('[data-rj-status]');
 if(count)count.textContent=`${r.count} / ${MAX_SHARED}`;if(status)status.textContent=statusText(c,t);
 return true;
}
function onClick(e){
 const b=e?.target?.closest?.('[data-rj-action]');if(!b)return false;
 if(b.dataset.rjAction==='download'&&shown.list.length)download('session-journal.md',markdown(shown,lang()));
 return true;
}
const doc=global.document;
if(doc?.addEventListener){
 doc.addEventListener('change',onChange);doc.addEventListener('click',onClick);
 // The list of older entries stays open across the live repaints of the room page.
 doc.addEventListener('toggle',e=>{if(e.target?.dataset?.rjMore!==undefined)moreOpen=e.target.open===true},true);
}
global.RoomJournal={MAX_SHARED,MAX_BYTES,TTL,entries,sharedIds,setShared,payload,clean,publish,receive,card,panel,markdown,onChange,
 _test:{shown:()=>shown,reset:()=>{roomKey='\u0000';sync(null)},state:()=>({lastSent,sentAt,shownAt})}};
})(typeof window!=='undefined'?window:globalThis);
