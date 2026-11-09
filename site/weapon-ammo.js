/* Per-weapon ammo counter + quick spend buttons for the sheet weapon rows.
   Uses the same data as the sheet (extra.weapons[].ammo / capacity) and the existing ReloadTools flow. */
(function(){
'use strict';
const T={ru:{shot:'−1',shotTitle:'Один выстрел: −1 патрон',burst:'Очередь −10',burstTitle:'Очередь из автоматического оружия: −10 патронов',reload:'Перезарядить',reloadTitle:'Перезарядка из запаса патронов (тот же инструмент, что в разделе перезарядки)',empty:'Магазин пуст',low:'Мало патронов',need:'Недостаточно патронов в магазине.',spent:'Потрачено патронов',left:'осталось',counter:'Патроны в магазине'},
en:{shot:'−1',shotTitle:'Single shot: −1 round',burst:'Burst −10',burstTitle:'Autofire burst: −10 rounds',reload:'Reload',reloadTitle:'Reload from ammo stock (same tool as the reload section)',empty:'Magazine empty',low:'Low ammo',need:'Not enough rounds in the magazine.',spent:'Rounds spent',left:'left',counter:'Rounds in magazine'}};
const AUTO_IDS=new Set(['weapon-smg','weapon-heavy-smg','weapon-assault-rifle','weapon-tsunami-arms-helix']);
const MELEE=new Set(['Melee Weapon','Brawling','Martial Arts']);
const BURST=10;
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const tx=l=>T[l==='en'?'en':'ru'];
const int=(n,a,b)=>{n=Math.trunc(Number(n));return Number.isFinite(n)?Math.min(b,Math.max(a,n)):a};
function tracks(w){if(!w||typeof w!=='object')return false;if(MELEE.has(w.skill))return false;if(typeof w.usesAmmo==='boolean')return w.usesAmmo;const cat=window.CATALOG?.find?.(z=>z.id===w.catalogId);return !!cat?.stats?.ammo||int(w.capacity,0,9999)>0}
function canAutofire(w){if(!w)return false;if(w.autofire===true)return true;if(w.skill==='Autofire'||AUTO_IDS.has(w.catalogId))return true;return /autofire|авто(?:матич|огон)|очеред/i.test(String(w.notes||''))}
// Spend n rounds; never goes below zero and never mutates on refusal.
function spend(w,n){const cur=int(w?.ammo,0,9999),k=int(n,1,9999);if(!w||!tracks(w))return {ok:false,reason:'untracked',ammo:cur};if(cur<k)return {ok:false,reason:'need',ammo:cur};w.ammo=cur-k;return {ok:true,ammo:w.ammo,spent:k}}
function row(c,w,lang){
 if(!tracks(w)||!w.id)return '';
 const t=tx(lang),cap=int(w.capacity,0,9999),cur=int(w.ammo,0,9999),empty=cur===0,low=!empty&&cap>0&&cur<=Math.ceil(cap/4),pct=cap>0?Math.min(100,Math.round(cur/cap*100)):(cur>0?100:0);
 const id=esc(w.id),state=empty?'empty':low?'low':'ok';
 const canReload=!!window.ReloadTools?.weaponProfile?.(w);
 return `<div class="wa-row" data-wa-state="${state}"><span class="wa-counter" role="img" aria-label="${esc(t.counter)}: ${cur}${cap?'/'+cap:''}" style="--wa-pct:${pct}"><i class="wa-ring" aria-hidden="true"></i><b>${cur}${cap?'<small>/'+cap+'</small>':''}</b></span>${empty?`<span class="wa-warn" role="status">${esc(t.empty)}</span>`:low?`<span class="wa-warn wa-low">${esc(t.low)}</span>`:''}<button type="button" class="cx-button wa-btn" data-wa="shot" data-wa-id="${id}" title="${esc(t.shotTitle)}" ${cur<1?'disabled':''}>${esc(t.shot)}</button>${canAutofire(w)?`<button type="button" class="cx-button wa-btn" data-wa="burst" data-wa-id="${id}" title="${esc(t.burstTitle)}" ${cur<BURST?'disabled':''}>${esc(t.burst)}</button>`:''}${canReload?`<button type="button" class="cx-button wa-btn" data-reload="quick" data-weapon-id="${id}" title="${esc(t.reloadTitle)}">${esc(t.reload)}</button>`:''}</div>`;
}
function click(e){
 const b=e.target?.closest?.('[data-wa]');if(!b)return;
 const app=window.App,c=app?.active?.();if(!c)return;
 const w=(c.extra?.weapons||[]).find(z=>z&&z.id===b.dataset.waId),t=tx(app.lang?.());if(!w)return;
 const r=spend(w,b.dataset.wa==='burst'?BURST:1);
 if(!r.ok){app.notify?.(t.need);return}
 app.save();app.render();app.notify?.(`${t.spent}: ${r.spent}, ${t.left} ${r.ammo}`);
}
window.WeaponAmmo={row,spend,tracks,canAutofire,BURST};
if(typeof document!=='undefined')document.addEventListener('click',click);
})();
