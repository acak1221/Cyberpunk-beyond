/* One filter row for every NPC list of the GM screen: a text box, tier chips and a source choice (book templates /
   your own library). The lists themselves (gm-tools.js, npc-library.js) mark each card with the attributes made by
   attrs(); this module only decides which cards are shown. The decision is a pure function (matches), the screen
   part hides or shows the cards already on the page without redrawing them, so typing never loses focus.
   The filter lives in memory only. Original UI text. */
(function(global){
'use strict';
const TIERS=Object.freeze(['mook','lieutenant','miniboss','boss']);
const SOURCES=Object.freeze(['all','book','library']);
const TIER_LABELS={ru:{mook:'Рядовой',lieutenant:'Лейтенант',miniboss:'Мини-босс',boss:'Босс'},en:{mook:'Mook',lieutenant:'Lieutenant',miniboss:'Mini boss',boss:'Boss'}};
const T={
 ru:{label:'Найти NPC',ph:'Имя или роль',tiers:'Уровень угрозы',source:'Откуда',all:'Все',book:'Из книги',library:'Моя библиотека',reset:'Сбросить фильтр',count:(n,m)=>`Показано ${n} из ${m}`,none:'Ничего не найдено'},
 en:{label:'Find an NPC',ph:'Name or role',tiers:'Threat level',source:'Source',all:'All',book:'Book',library:'My library',reset:'Reset filter',count:(n,m)=>`Showing ${n} of ${m}`,none:'Nothing found'}
};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const lang=l=>l==='en'||l==='ru'?l:(()=>{try{return global.App?.lang?.()==='en'?'en':'ru'}catch{return 'ru'}})();
const norm=v=>String(v??'').toLowerCase().replace(/ё/g,'е').replace(/\s+/g,' ').trim().slice(0,200);
function clean(f){
 const o=f&&typeof f==='object'?f:{};
 return {text:norm(o.text).slice(0,60),tiers:TIERS.filter(t=>Array.isArray(o.tiers)&&o.tiers.includes(t)),source:SOURCES.includes(o.source)?o.source:'all'};
}
let filter=clean({});
const isActive=f=>{const c=clean(f);return !!c.text||c.tiers.length>0||c.source!=='all'};
// item: {name:{ru,en}|string, tier?, source:'book'|'library', extra?}. Every typed word has to be found in the name, the role or the extra text.
function haystack(item){const n=item?.name;return norm([typeof n==='string'?n:`${n?.ru||''} ${n?.en||''}`,item?.extra||''].join(' '))}
function matches(item,f){
 if(!item||typeof item!=='object')return false;
 const c=clean(f);
 if(c.source!=='all'&&item.source!==c.source)return false;
 if(c.tiers.length&&!c.tiers.includes(item.tier))return false;
 if(c.text){const h=haystack(item);if(!c.text.split(' ').every(w=>h.includes(w)))return false}
 return true;
}
// Attributes for a card. The card is drawn already hidden when the current filter does not let it through.
function attrs(item){
 const hay=haystack(item),tier=TIERS.includes(item?.tier)?item.tier:'',src=item?.source==='library'?'library':'book';
 return ` data-nf-item data-nf-name="${esc(hay)}" data-nf-tier="${tier}" data-nf-src="${src}"${matches({...item,tier},filter)?'':' hidden'}`;
}
function fromNode(n){return {name:n.dataset?.nfName||'',tier:n.dataset?.nfTier||'',source:n.dataset?.nfSrc||'book'}}
function rowHTML(l){
 const L=lang(l),t=T[L],f=filter;
 return `<div class="nf-row" data-nf-root role="group" aria-label="${esc(t.label)}"><label class="field nf-text">${esc(t.label)}<input type="search" data-nf-text maxlength="60" placeholder="${esc(t.ph)}" value="${esc(f.text)}" autocomplete="off"></label><div class="nf-tiers" role="group" aria-label="${esc(t.tiers)}">${TIERS.map(k=>`<button type="button" class="nf-chip" data-nf-tier-chip="${k}" aria-pressed="${f.tiers.includes(k)}">${esc(TIER_LABELS[L][k])}</button>`).join('')}</div><label class="field nf-source">${esc(t.source)}<select data-nf-source>${SOURCES.map(k=>`<option value="${k}"${f.source===k?' selected':''}>${esc(t[k])}</option>`).join('')}</select></label><button type="button" class="btn ghost nf-reset" data-nf-reset${isActive(f)?'':' hidden'}>${esc(t.reset)}</button><p class="nf-count" data-nf-count role="status" aria-live="polite"></p></div>`;
}
// Shows or hides the cards on the page and writes the count. Returns {shown,total}.
function apply(root){
 const doc=root||(typeof document!=='undefined'?document:null);if(!doc||typeof doc.querySelectorAll!=='function')return {shown:0,total:0};
 let shown=0,total=0;
 doc.querySelectorAll('[data-nf-item]').forEach(n=>{total++;const ok=matches(fromNode(n),filter);n.hidden=!ok;if(ok)shown++});
 const L=lang(),t=T[L];
 doc.querySelectorAll('[data-nf-count]').forEach(n=>{n.textContent=isActive(filter)?(shown?t.count(shown,total):t.none):''});
 doc.querySelectorAll('[data-nf-reset]').forEach(n=>{n.hidden=!isActive(filter)});
 return {shown,total};
}
function syncRow(){
 if(typeof document==='undefined')return;
 document.querySelectorAll('[data-nf-tier-chip]').forEach(b=>b.setAttribute('aria-pressed',String(filter.tiers.includes(b.dataset.nfTierChip))));
 document.querySelectorAll('[data-nf-text]').forEach(i=>{if(i!==document.activeElement&&i.value!==filter.text)i.value=filter.text});
 document.querySelectorAll('[data-nf-source]').forEach(s=>{if(s.value!==filter.source)s.value=filter.source});
}
function set(next){filter=clean({...filter,...next});syncRow();return apply()}
function onEvent(e){
 const el=e?.target;if(!el||typeof el.closest!=='function')return false;
 if((e.type==='input'||e.type==='change')&&el.matches?.('[data-nf-text]')){set({text:el.value});return true}
 if(e.type==='change'&&el.matches?.('[data-nf-source]')){set({source:el.value});return true}
 if(e.type!=='click')return false;
 const chip=el.closest('[data-nf-tier-chip]');
 if(chip){const k=chip.dataset.nfTierChip,on=filter.tiers.includes(k);set({tiers:on?filter.tiers.filter(x=>x!==k):[...filter.tiers,k]});return true}
 if(el.closest('[data-nf-reset]')){set({text:'',tiers:[],source:'all'});try{document.querySelector('[data-nf-text]')?.focus?.()}catch{}return true}
 return false;
}
if(typeof document!=='undefined'&&document.addEventListener){for(const type of ['input','change','click'])document.addEventListener(type,onEvent)}
global.NpcFilter={TIERS,SOURCES,TIER_LABELS,clean,matches,haystack,attrs,rowHTML,apply,set,isActive,get:()=>({...filter,tiers:[...filter.tiers]}),reset(){filter=clean({});syncRow();return apply()},onEvent};
})(window);
