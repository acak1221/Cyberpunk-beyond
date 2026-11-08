/* Night Market stall generator. Corebook v1.22 "Night Markets" pp. 337–339 (six goods categories),
   price categories p. 385, item prices and pages from the app catalog (Night Market Appendix pp. 340–380).
   The printed per-category d-tables are NOT reproduced: items are drawn from the app's catalog entries
   for each category. Generated stock is kept in memory only (not saved). */
(function(){
'use strict';
// Book order of the six Night Market categories; index + 1 is the 1d6 face shown to the GM.
const CATEGORIES=Object.freeze([
 {id:'food',ru:'Еда и наркотики',en:'Food and Drugs'},
 {id:'electronics',ru:'Личная электроника',en:'Personal Electronics'},
 {id:'weapons',ru:'Оружие и броня',en:'Weapons and Armor'},
 {id:'cyberware',ru:'Киберимпланты',en:'Cyberware'},
 {id:'clothing',ru:'Одежда и fashionware',en:'Clothing and Fashionware'},
 {id:'survival',ru:'Снаряжение для выживания',en:'Survival Gear'}
]);
// Standard price categories, Corebook p. 385. Super Luxury is 10,000eb and up.
const PRICE_TIERS=Object.freeze([
 {id:'cheap',max:10,ru:'Cheap (дешёвое)',en:'Cheap'},
 {id:'everyday',max:20,ru:'Everyday (повседневное)',en:'Everyday'},
 {id:'costly',max:50,ru:'Costly (недешёвое)',en:'Costly'},
 {id:'premium',max:100,ru:'Premium (премиум)',en:'Premium'},
 {id:'expensive',max:500,ru:'Expensive (дорогое)',en:'Expensive'},
 {id:'veryexpensive',max:1000,ru:'Very Expensive (очень дорогое)',en:'Very Expensive'},
 {id:'luxury',max:5000,ru:'Luxury (роскошь)',en:'Luxury'},
 {id:'superluxury',max:Infinity,ru:'Super Luxury (без ограничения)',en:'Super Luxury (no cap)'}
]);
const ELECTRONICS=new Set(['agent','audio-recorder','braindance-viewer','bug-detector','chemical-analyzer','computer','cyberdeck-poor-quality','cyberdeck-standard-quality','cyberdeck-excellent-quality','disposable-cell-phone','homing-tracer','medscanner','radar-detector','radio-communicator','radio-scanner-music-player','scrambler-descrambler','smart-glasses','techscanner','video-camera','virtuality-goggles','memory-chips','pocket-amplifier','drum-synthesizer','electric-guitar-or-another-instrument'].map(x=>'gear-'+x));
const FOOD=new Set(['gear-kibble-pack','gear-mre','gear-food-stick']);
const NOT_SURVIVAL=new Set(['gear-vial-of-poison','gear-vial-of-biotoxin']);
const FASHIONWARE=new Set(['biomonitor','chemskin','emp-threading','light-tattoo','shift-tacts','skinwatch','techhair'].map(x=>'cyberware-'+x));
function categoryOf(item){
 if(!item||typeof item.price!=='number'||!Number.isFinite(item.price)||item.price<=0)return null;
 const c=item.category,id=item.id;
 if(c==='drugs'||FOOD.has(id))return 'food';
 if(c==='gear')return ELECTRONICS.has(id)?'electronics':NOT_SURVIVAL.has(id)?null:'survival';
 if(['weapon','armor','ammo','attachment'].includes(c))return 'weapons';
 if(c==='cyberware')return FASHIONWARE.has(id)?'clothing':'cyberware';
 if(c==='fashion')return 'clothing';
 // Programs, cyberdeck hardware and Black ICE are Personal Electronics stock (pp. 338–339).
 if(c==='programs')return 'electronics';
 return null;
}
function pool(category,cap,catalog){const list=Array.isArray(catalog)?catalog:(typeof window!=='undefined'&&Array.isArray(window.CATALOG)?window.CATALOG:[]);const max=tierMax(cap);return list.filter(i=>categoryOf(i)===category&&i.price<=max)}
function tierMax(id){return (PRICE_TIERS.find(t=>t.id===id)||PRICE_TIERS[PRICE_TIERS.length-1]).max}
function tierOf(price){return PRICE_TIERS.find(t=>price<=t.max)||PRICE_TIERS[PRICE_TIERS.length-1]}
function die(sides,rng){const n=1+Math.floor(rng()*sides);return Number.isInteger(n)&&n>=1&&n<=sides?n:1}
function int(v,min,max,fallback){const n=Number(v);return Number.isInteger(n)&&n>=min&&n<=max?n:fallback}
// Roll distinct categories on 1d6; duplicate faces are rerolled and recorded.
function rollCategories(count,rng=Math.random){count=int(count,1,6,2);const picked=[],rolls=[];let guard=0;while(picked.length<count&&guard++<500){const face=die(6,rng);rolls.push(face);const id=CATEGORIES[face-1].id;if(!picked.includes(id))picked.push(id)}for(const c of CATEGORIES)if(picked.length<count&&!picked.includes(c.id))picked.push(c.id);return {categories:picked,rolls}}
function pickItems(category,count,cap,rng=Math.random,catalog,exclude=[]){const avail=pool(category,cap,catalog).filter(i=>!exclude.includes(i.id)),out=[];count=Math.min(int(count,0,20,0),avail.length);while(out.length<count){const i=Math.floor(rng()*avail.length);out.push(avail.splice(Math.min(Math.max(i,0),avail.length-1),1)[0])}return out}
function generate(opts={},rng=Math.random,catalog){const cats=rollCategories(opts.categories,rng),cap=PRICE_TIERS.some(t=>t.id===opts.cap)?opts.cap:'superluxury',stalls=cats.categories.map(id=>{const count=opts.items==='d10'||opts.items===undefined?die(10,rng):int(opts.items,1,10,5);return {category:id,count,items:pickItems(id,count,cap,rng,catalog).map(i=>i.id)}});return {rolls:cats.rolls,cap,stalls}}
function rerollItem(market,stallIndex,itemIndex,rng=Math.random,catalog){const s=market?.stalls?.[stallIndex];if(!s||!Number.isInteger(itemIndex)||itemIndex<0||itemIndex>=s.items.length)return false;const next=pickItems(s.category,1,market.cap,rng,catalog,s.items)[0];if(!next)return false;s.items[itemIndex]=next.id;return true}
function rerollStall(market,stallIndex,rng=Math.random,catalog){const s=market?.stalls?.[stallIndex];if(!s)return false;s.items=pickItems(s.category,s.count,market.cap,rng,catalog).map(i=>i.id);return true}

const T={
 ru:{title:'НОЧНОЙ РЫНОК',source:'СТР. 337–340, 385',intro:'Быстро наполните ночной рынок товарами для сцены. Категории бросаются на 1d6 по шести категориям ночного рынка из книги (повторы перебрасываются); конкретные товары берутся из каталога приложения с ценами и страницами, а не из печатных таблиц.',cats:'Категорий',items:'Товаров в категории',d10:'1d10 на каждую',cap:'Ценовой потолок (связи фиксера)',generate:'Собрать рынок',empty:'Нажмите «Собрать рынок». Результат хранится только до перезагрузки страницы.',rolls:'Броски 1d6',stall:'Раздел',reroll:'Перебросить раздел',swap:'Заменить',none:'Под этот ценовой потолок в категории нет товаров.',short:'Товаров меньше, чем выпало: в каталоге под этот потолок их только',note:'Ночные рынки временные: стоимость, наличие и торг остаются за ведущим. Ночные рынки — стр. 337–339; способность фиксера Operator — стр. 159.',book:'Книга, стр. 337',price:'Цена',page:'стр.',list:'Список для игроков'},
 en:{title:'NIGHT MARKET',source:'PP. 337–340, 385',intro:'Quickly stock a Night Market for a scene. Categories are rolled on 1d6 over the book’s six Night Market categories (duplicates rerolled); the specific goods come from the app catalog with prices and pages, not from the printed tables.',cats:'Categories',items:'Items per category',d10:'1d10 each',cap:'Price cap (Fixer’s reach)',generate:'Build market',empty:'Press “Build market”. The result is kept only until the page reloads.',rolls:'1d6 rolls',stall:'Section',reroll:'Reroll section',swap:'Swap',none:'No goods in this category under the selected price cap.',short:'Fewer goods than rolled: the catalog only has',note:'Night Markets are temporary: availability, haggling and final prices are up to the GM. Night Markets: pp. 337–339; the Fixer’s Operator ability: p. 159.',book:'Corebook p. 337',price:'Price',page:'p.',list:'Player-facing list'}
};
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let settings={categories:2,items:'d10',cap:'superluxury'},market=null;
function byId(id){const list=typeof window!=='undefined'&&Array.isArray(window.CATALOG)?window.CATALOG:[];return list.find(i=>i.id===id)}
function opt(value,label,current){return `<option value="${esc(value)}"${String(value)===String(current)?' selected':''}>${esc(label)}</option>`}
function render(lang){
 const l=lang==='en'?'en':'ru',t=T[l];
 let html=`<section class="card night-market" data-nm-root data-lang="${l}"><div class="card-heading"><span>${esc(t.title)}</span><span>${esc(t.source)}</span></div><p class="nm-note">${esc(t.intro)}</p><div class="nm-grid"><label class="field">${esc(t.cats)}<select data-nm-field="categories">${[1,2,3,4,5,6].map(n=>opt(n,String(n),settings.categories)).join('')}</select></label><label class="field">${esc(t.items)}<select data-nm-field="items">${opt('d10',t.d10,settings.items)}${[1,2,3,4,5,6,7,8,9,10].map(n=>opt(n,String(n),settings.items)).join('')}</select></label><label class="field">${esc(t.cap)}<select data-nm-field="cap">${PRICE_TIERS.map(p=>opt(p.id,`${p[l]}${Number.isFinite(p.max)?' · ≤'+p.max+'eb':''}`,settings.cap)).join('')}</select></label></div><div class="nm-actions"><button type="button" class="btn primary" data-nm-action="generate">⬡ ${esc(t.generate)}</button><button class="rule-source" type="button" data-action="book-page" data-page="337">${esc(t.book)} ↗</button></div>`;
 if(!market)html+=`<p class="nm-note" role="status">${esc(t.empty)}</p>`;
 else{
  html+=`<p class="nm-rolls" role="status">${esc(t.rolls)}: ${market.rolls.map(n=>esc(n)).join(', ')}</p>`;
  html+=market.stalls.map((s,si)=>{const c=CATEGORIES.find(x=>x.id===s.category),items=s.items.map(byId).filter(Boolean);return `<div class="nm-stall"><div class="nm-stall-head"><strong>${esc(t.stall)} ${CATEGORIES.indexOf(c)+1}: ${esc(c[l])}</strong><button type="button" class="btn ghost" data-nm-action="stall" data-nm-stall="${si}">↻ ${esc(t.reroll)}</button></div>${items.length?`<ul class="nm-items">${items.map((i,ii)=>`<li><span class="nm-name">${esc(i.name[l]||i.name.en)}</span><span class="nm-price">${esc(i.price)}eb · ${esc(tierOf(i.price)[l].split(' (')[0])}</span><button class="rule-source" type="button" data-action="book-page" data-page="${esc(i.page)}">${esc(t.page)} ${esc(i.page)}</button><button type="button" class="btn ghost nm-swap" data-nm-action="item" data-nm-stall="${si}" data-nm-item="${ii}" aria-label="${esc(t.swap)}: ${esc(i.name[l]||i.name.en)}">↻</button></li>`).join('')}</ul>`:`<p class="nm-note">${esc(t.none)}</p>`}${items.length&&items.length<s.count?`<p class="nm-note">${esc(t.short)} ${items.length}.</p>`:''}</div>`}).join('');
  const plain=market.stalls.map(s=>{const c=CATEGORIES.find(x=>x.id===s.category);return `${c[l]}: ${s.items.map(byId).filter(Boolean).map(i=>`${i.name[l]||i.name.en} (${i.price}eb)`).join('; ')||'—'}`}).join('\n');
  html+=`<details class="nm-plain"><summary>${esc(t.list)}</summary><textarea readonly rows="5">${esc(plain)}</textarea></details>`;
 }
 return html+`<p class="nm-note">${esc(t.note)}</p></section>`;
}
function readSettings(root){const v=f=>root.querySelector(`[data-nm-field="${f}"]`)?.value;const items=v('items');settings={categories:int(v('categories'),1,6,2),items:items==='d10'?'d10':int(items,1,10,5),cap:PRICE_TIERS.some(p=>p.id===v('cap'))?v('cap'):'superluxury'}}
function handle(e,lang,rng=Math.random){
 const root=e?.target?.closest?.('[data-nm-root]');if(!root)return false;
 if(e.type==='change'){if(!e.target.dataset?.nmField)return false;readSettings(root);return true}
 const b=e.type==='click'&&e.target.closest('[data-nm-action]');if(!b)return false;
 readSettings(root);const a=b.dataset.nmAction;
 if(a==='generate')market=generate(settings,rng);
 else if(a==='stall'){if(!market||!rerollStall(market,int(b.dataset.nmStall,0,5,-1),rng))return true}
 else if(a==='item'){if(!market||!rerollItem(market,int(b.dataset.nmStall,0,5,-1),int(b.dataset.nmItem,0,19,-1),rng))return true}
 else return false;
 const l=lang||root.dataset.lang;if(typeof root.outerHTML==='string'&&root.isConnected!==false)root.outerHTML=render(l);
 return true;
}
function reset(){market=null;settings={categories:2,items:'d10',cap:'superluxury'}}
if(typeof document!=='undefined'&&document.addEventListener){for(const type of ['click','change'])document.addEventListener(type,e=>{handle(e)})}
window.NightMarket={CATEGORIES,PRICE_TIERS,categoryOf,pool,tierOf,rollCategories,pickItems,generate,rerollItem,rerollStall,render,handle,reset,get market(){return market}};
})();
