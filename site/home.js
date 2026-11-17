/* Home: for a returning person a compact «Continue» block comes first (the last character, the active campaign and whose
   turn it is, the state of the room, the last tool), for a first launch one welcome block with two ways in.
   What «last» means is remembered per device through UIMemory (home-char, home-view, home-campaign): never part of the archive.
   model() and the small helpers are pure and exported for tests; render() only builds a string. */
(function(global){
'use strict';
const doc=global.document;
const T={
 ru:{
  continueTitle:'Продолжить',lastChar:'Последний персонаж',open:'Открыть',rollDie:'Бросить кубик',hp:'HP',luck:'LUCK',
  serious:'Серьёзное ранение',mortal:'При смерти',campaign:'Кампания',round:n=>`Раунд ${n}`,turn:n=>`Ход: ${n}`,
  nobody:'В списке пока никого',openTracker:'Открыть трекер',nextTurn:'Следующий ход',room:'Комната',online:'на связи',offline:'нет связи',
  yourTurn:'ваш ход',openRoom:'Открыть комнату',lastView:n=>`Вы остановились: ${n}`,back:'Вернуться',
  turnMoved:'Ход передан.',undo:'Вернуть',
  chars:'Ваши персонажи',allChars:'Все персонажи',newChar:'Новый персонаж',quickChar:'Быстрое создание',
  heroKicker:'Первый запуск',heroTitle:'Добро пожаловать в Night City',heroLead:'Всё хранится только в вашем браузере, без аккаунтов и серверов. С чего начнём?',
  pathCreate:'Создать персонажа за две минуты',pathCreateSub:'Быстрый мастер: роль, характеристики и снаряжение.',
  pathJoin:'Присоединиться к игре по ссылке',pathJoinSub:'Ведущий пришлёт ссылку или код комнаты.',rulesLink:'Или откройте правила',
  rank:'ранг',untitled:'Без имени'
 },
 en:{
  continueTitle:'Continue',lastChar:'Last character',open:'Open',rollDie:'Roll a die',hp:'HP',luck:'LUCK',
  serious:'Seriously wounded',mortal:'Mortally wounded',campaign:'Campaign',round:n=>`Round ${n}`,turn:n=>`Turn: ${n}`,
  nobody:'Nobody in the list yet',openTracker:'Open tracker',nextTurn:'Next turn',room:'Room',online:'connected',offline:'offline',
  yourTurn:'your turn',openRoom:'Open the room',lastView:n=>`You left off at: ${n}`,back:'Go back',
  turnMoved:'Turn passed on.',undo:'Undo',
  chars:'Your characters',allChars:'All characters',newChar:'New character',quickChar:'Quick builder',
  heroKicker:'First launch',heroTitle:'Welcome to Night City',heroLead:'Everything stays in your browser: no accounts, no servers. Where to start?',
  pathCreate:'Create a character in two minutes',pathCreateSub:'A quick guide: role, STATS and gear.',
  pathJoin:'Join a game by link',pathJoinSub:'The Game Master will send you a link or a room code.',rulesLink:'Or open the rules',
  rank:'rank',untitled:'Untitled'
 }
};
const L=lang=>lang==='en'?'en':'ru';
const t=(lang,key)=>T[L(lang)][key];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=v=>{const n=Number(v);return Number.isFinite(n)?n:0};
const list=x=>Array.isArray(x)?x:[];
const id=v=>typeof v==='string'&&v.length>0&&v.length<=120?v:null;
// Views that the home page may offer as «go back»: not the home page itself, not a sheet (that has its own card), not settings.
const RETURN_VIEWS=['characters','rules','catalog','combat','net','medical','repair','gm','dice','campaigns','book','lifepath','room'];

const hpMax=c=>10+5*Math.ceil((num(c?.stats?.BODY)+num(c?.stats?.WILL))/2);
// The Wound State by HP, the same reading as the tracker: below 1 mortal, below half serious.
function wound(c){const hp=num(c?.hp),max=hpMax(c);return hp<1?'mortal':hp<Math.ceil(max/2)?'serious':''}
function luckOf(c){
 const max=Math.max(0,Math.min(20,Math.trunc(num(c?.stats?.LUCK))));
 const raw=c?.extra?.luck,now=raw===undefined||raw===null||raw===''||!Number.isFinite(Number(raw))?max:Math.max(0,Math.min(max,Math.trunc(Number(raw))));
 return {now,max};
}
// What the room pill says (Room.pill() markup): nothing joined, joined and online, joined and offline, and whether it is the player's turn.
function roomState(pill){
 const s=String(pill??'');
 if(!s||/data-room-pill\s+hidden/.test(s)||!/data-room-pill/.test(s))return null;
 const label=s.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
 return {online:/class="room-pill\s+ok/.test(s),turn:/room-pill[^"]*\bturn\b/.test(s),label:label.slice(0,60)};
}
function ordered(c){
 return [...list(c?.roster)].sort((a,b)=>{let n=num(b.initiative)-num(a.initiative);if(n)return n;const x=list(a.ties),y=list(b.ties);for(let i=0;i<Math.max(x.length,y.length);i++){n=num(y[i])-num(x[i]);if(n)return n}return num(a.order)-num(b.order)});
}
function campaignInfo(c,characters){
 const roster=ordered(c),i=Math.max(0,Math.trunc(num(c.turnIndex))),cur=roster[i]||null;
 const pc=cur?.kind==='pc'?list(characters).find(x=>x.id===cur.characterId):null;
 const name=cur?(pc?pc.name:cur.name)||'':'';
 return {id:c.id,name:String(c.name||'').slice(0,80),round:Math.max(1,Math.trunc(num(c.round))||1),count:roster.length,turnName:String(name).slice(0,60)};
}
/* input: {characters, campaigns, lastChar, lastCampaign, lastView, roomPill}. Never throws on odd data. */
function model(input){
 const characters=list(input?.characters).filter(c=>c&&typeof c==='object'&&typeof c.id==='string'),campaigns=list(input?.campaigns).filter(c=>c&&typeof c==='object'&&typeof c.id==='string');
 const out={first:!characters.length&&!campaigns.length,character:null,campaign:null,room:roomState(input?.roomPill),lastView:null};
 const ch=characters.find(c=>c.id===input?.lastChar)||characters[0];
 if(ch){const luck=luckOf(ch);out.character={id:ch.id,name:String(ch.name||''),role:String(ch.role||''),rank:Math.trunc(num(ch.rank)),hp:Math.trunc(num(ch.hp)),hpMax:hpMax(ch),wound:wound(ch),luck:luck.now,luckMax:luck.max}}
 const camp=campaigns.find(c=>c.id===input?.lastCampaign)||campaigns.find(c=>list(c.roster).length)||campaigns[0];
 if(camp)out.campaign=campaignInfo(camp,characters);
 if(RETURN_VIEWS.includes(input?.lastView))out.lastView=input.lastView;
 return out;
}

function mem(name,fallback,validate){try{return global.UIMemory?.get(name,fallback,validate)??fallback}catch{return fallback}}
function remember(name,value){try{global.UIMemory?.set(name,value)}catch{}}

function characterBlock(m,ctx,lang){
 const c=m.character;if(!c)return '';
 const name=c.name||t(lang,'untitled'),roleName=ctx.roleName?.(c)||c.role,state=c.wound?`<span class="home-chip home-chip-${c.wound}">${esc(t(lang,c.wound))}</span>`:'';
 const pct=c.hpMax>0?Math.max(0,Math.min(100,Math.round(c.hp/c.hpMax*100))):0;
 return `<article class="home-card home-char" aria-labelledby="home-char-name"><div class="home-card-kicker">${esc(t(lang,'lastChar'))}</div><h2 id="home-char-name">${esc(name)}</h2><p class="home-sub">${esc(roleName)}${c.rank?` · ${esc(t(lang,'rank'))} ${c.rank}`:''}</p><div class="home-stats"><span class="home-stat"><small>${esc(t(lang,'hp'))}</small><b>${c.hp}/${c.hpMax}</b></span><span class="home-stat"><small>${esc(t(lang,'luck'))}</small><b>${c.luck}/${c.luckMax}</b></span>${state}</div><div class="home-bar" role="img" aria-label="${esc(t(lang,'hp')+' '+c.hp+'/'+c.hpMax)}"><i style="width:${pct}%"></i></div><div class="home-actions"><button type="button" class="btn primary" data-action="open" data-id="${esc(c.id)}">${esc(t(lang,'open'))} <span aria-hidden="true">↗</span></button><button type="button" class="btn ghost" data-quick-dice-open>${esc(t(lang,'rollDie'))} <span aria-hidden="true">⬡</span></button></div></article>`;
}
function campaignBlock(m,lang){
 const c=m.campaign;if(!c)return '';
 const line=c.count?`${esc(t(lang,'round')(c.round))}${c.turnName?` · ${esc(t(lang,'turn')(c.turnName))}`:''}`:esc(t(lang,'nobody'));
 return `<article class="home-card home-camp" aria-labelledby="home-camp-name"><div class="home-card-kicker">${esc(t(lang,'campaign'))}</div><h2 id="home-camp-name">${esc(c.name||t(lang,'campaign'))}</h2><p class="home-sub" aria-live="polite">${line}</p><div class="home-actions"><button type="button" class="btn primary" data-home-campaign="${esc(c.id)}">${esc(t(lang,'openTracker'))} <span aria-hidden="true">↗</span></button>${c.count?`<button type="button" class="btn ghost" data-home-next="${esc(c.id)}">${esc(t(lang,'nextTurn'))} <span aria-hidden="true">→</span></button>`:''}</div></article>`;
}
function roomBlock(m,lang){
 const r=m.room;if(!r)return '';
 return `<div class="home-line home-room"><span class="home-dot${r.online?' on':''}" aria-hidden="true"></span><span><b>${esc(t(lang,'room'))}</b> · ${esc(t(lang,r.online?'online':'offline'))}${r.turn?` · ${esc(t(lang,'yourTurn'))}`:''}</span><button type="button" class="btn ghost small" data-action="navigate" data-view="room">${esc(t(lang,'openRoom'))}</button></div>`;
}
function lastViewBlock(m,ctx,lang){
 if(!m.lastView)return '';
 const label=ctx.viewLabel?.(m.lastView);if(!label||label===m.lastView)return '';
 return `<div class="home-line home-last"><span>${esc(t(lang,'lastView')(label))}</span><button type="button" class="btn ghost small" data-action="navigate" data-view="${esc(m.lastView)}">${esc(t(lang,'back'))}</button></div>`;
}
function rows(ctx,lang){
 const chars=list(ctx.state?.characters).slice(0,5);if(!chars.length)return '';
 return `<ul class="home-list">${chars.map(c=>`<li><button type="button" class="home-row" data-action="open" data-id="${esc(c.id)}"><span class="home-row-name">${esc(c.name||t(lang,'untitled'))}</span><span class="home-row-meta">${esc(ctx.roleName?.(c)||c.role||'')} · ${esc(t(lang,'hp'))} ${Math.trunc(num(c.hp))}/${hpMax(c)}</span></button></li>`).join('')}</ul>`;
}
function hero(lang){
 return `<section class="home-hero" aria-labelledby="home-hero-title"><div class="home-card-kicker">${esc(t(lang,'heroKicker'))}</div><h1 id="home-hero-title">${esc(t(lang,'heroTitle'))}</h1><p>${esc(t(lang,'heroLead'))}</p><div class="home-paths"><button type="button" class="home-path home-path-main" data-action="start-builder" data-method="streetrat"><strong>${esc(t(lang,'pathCreate'))}</strong><span>${esc(t(lang,'pathCreateSub'))}</span></button><button type="button" class="home-path" data-action="navigate" data-view="room"><strong>${esc(t(lang,'pathJoin'))}</strong><span>${esc(t(lang,'pathJoinSub'))}</span></button></div><button type="button" class="text-link home-rules" data-action="navigate" data-view="rules">${esc(t(lang,'rulesLink'))}</button></section>`;
}
/* ctx: {state, lang, roomPill, quick, strip, entry, guide, source, tour, roleName(c), viewLabel(view)}; the strings are the
   home page pieces app.js already builds. */
function render(ctx){
 if(!ctx||!ctx.state)return '';
 const lang=L(ctx.lang),m=model({characters:ctx.state.characters,campaigns:ctx.state.campaigns,lastChar:mem('home-char',null,id),lastCampaign:mem('home-campaign',null,id),lastView:mem('home-view',null,v=>typeof v==='string'),roomPill:ctx.roomPill});
 const top=m.first?hero(lang)+(ctx.tour||''):(/data-ob-intro/.test(ctx.tour||'')?ctx.tour:'')+
  `<section class="home-continue" aria-labelledby="home-continue-title"><h1 id="home-continue-title">${esc(t(lang,'continueTitle'))}</h1><div class="home-cards">${ctx.role==='gm'?campaignBlock(m,lang)+characterBlock(m,ctx,lang):characterBlock(m,ctx,lang)+campaignBlock(m,lang)}</div>${roomBlock(m,lang)}${lastViewBlock(m,ctx,lang)}</section>`;
 const mine=m.first?'':`<section class="home-chars" aria-labelledby="home-chars-title"><div class="home-head"><h2 id="home-chars-title">${esc(t(lang,'chars'))}</h2><button type="button" class="btn subtle" data-action="navigate" data-view="characters">${esc(t(lang,'allChars'))} <span aria-hidden="true">↗</span></button></div>${rows(ctx,lang)}<div class="home-actions"><button type="button" class="btn ghost" data-action="new">＋ ${esc(t(lang,'newChar'))}</button><button type="button" class="btn ghost" data-action="start-builder" data-method="streetrat">${esc(t(lang,'quickChar'))}</button></div></section>`;
 return `<div class="home">${top}${mine}<div class="quick-grid">${ctx.quick||''}</div>${ctx.strip||''}${ctx.entry||''}${ctx.guide||''}${ctx.source||''}</div>`;
}

// Remembers what was last open (called by app.js after every drawing) and asks the role once, on the home page.
function afterRender(info){
 const view=info?.view;
 if(view==='sheet'&&id(info.active))remember('home-char',info.active);
 else if(RETURN_VIEWS.includes(view))remember('home-view',view);
 if(view==='campaigns'){const sel=global.Campaigns?.selectedId?.();if(id(sel))remember('home-campaign',sel)}
 if(view==='overview')askRole();
}
/* When the role is asked. A person on the very first launch sees the welcome with its two paths and nothing on top of it;
   the question comes once they have made their first move (a character or a campaign exists). Someone who already had data
   before this version is not interrupted at all: they keep the player view and can change it in «More» or Settings. */
function askRole(){
 try{
  const R=global.RoleMode;if(!R||R.isSet?.()||R.asked?.())return false;
  const s=global.App?.getState?.()||{},empty=!list(s.characters).length&&!list(s.campaigns).length;
  if(empty){remember('home-welcomed',true);return false}
  if(mem('home-welcomed',false,v=>v===true)!==true){R.skip?.();return false}
  return R.firstRun?.(global.App?.lang?.()||'ru')===true;
 }catch{return false}
}
// «Next turn» from anywhere: opens the campaign tracker and presses its own button, so every guard of the tracker applies.
function nextTurn(campaignId){
 const A=global.App,C=global.Campaigns;
 const target=id(campaignId)||C?.selectedId?.()||mem('home-campaign',null,id)||list(A?.getState?.().campaigns).find(c=>list(c.roster).length)?.id;
 if(!target||!list(A?.getState?.().campaigns).some(c=>c.id===target)||!C?.select||!A?.setView)return false;
 C.select(target);A.setView('campaigns');
 const b=doc?.querySelector?.('[data-campaign-action="next"]');
 if(!b||b.disabled){return true}
 b.click();
 // The tracker is drawn again by that click; the focus goes to the same button, so it never falls to the page.
 try{doc.querySelector('[data-campaign-action="next"]')?.focus?.({preventScroll:true})}catch{}
 // The step can be taken back from the notice: it presses the tracker's own «previous turn» button.
 try{const l=A?.lang?.()==='en'?'en':'ru';A?.notifyAction?.(t(l,'turnMoved'),t(l,'undo'),()=>{C.select(target);A.setView('campaigns');const p=doc.querySelector('[data-campaign-action="prev"]');if(p&&!p.disabled)p.click();try{doc.querySelector('[data-campaign-action="next"]')?.focus?.({preventScroll:true})}catch{}})}catch{}
 return true;
}
function openCampaign(campaignId){
 const A=global.App,C=global.Campaigns;
 if(!id(campaignId)||!C?.select||!A?.setView||!list(A.getState?.().campaigns).some(c=>c.id===campaignId))return false;
 C.select(campaignId);remember('home-campaign',campaignId);A.setView('campaigns');
 try{doc.querySelector('#main-content')?.focus?.({preventScroll:true})}catch{}
 return true;
}
if(doc?.addEventListener)doc.addEventListener('click',e=>{
 const open=e.target?.closest?.('[data-home-campaign]'),next=e.target?.closest?.('[data-home-next]');
 if(open){openCampaign(open.getAttribute?.('data-home-campaign')||open.dataset?.homeCampaign);return}
 if(next)nextTurn(next.getAttribute?.('data-home-next')||next.dataset?.homeNext);
});

global.Home={askRole,model,render,afterRender,nextTurn,openCampaign,roomState,wound,hpMax,luckOf,RETURN_VIEWS,t};
})(typeof window!=='undefined'?window:globalThis);
