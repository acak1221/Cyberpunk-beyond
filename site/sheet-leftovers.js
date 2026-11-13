/* Sheet leftovers: pure helpers and HTML strings only. No state, never writes to a character. */
(function(global){
'use strict';
const STATS=['INT','REF','DEX','TECH','COOL','WILL','LUCK','MOVE','BODY','EMP'];
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=x=>String(x??'').trim().normalize('NFKC').toLocaleLowerCase();
const isObj=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
const signed=n=>(n<0?'−':'+')+Math.abs(n);
const RULES=[
 [/^(language|язык)(?=\s|\(|$)/iu,'Language (Other)'],
 [/^(local expert|знание района|знание местности)(?=\s|\(|$)/iu,'Local Expert (Other)'],
 [/^(science|наука)(?=\s|\(|$)/iu,'Science']
];
function specParent(name){
 const n=norm(name);if(!n)return null;
 const labels=global.SKILL_LABELS||{};
 for(const k of Object.keys(labels)){if(norm(k)===n||norm(labels[k]&&labels[k].ru)===n)return k}
 for(const [re,key] of RULES)if(re.test(n))return key;
 if(global.CharacterExtra&&global.CharacterExtra.martialName&&global.CharacterExtra.martialName(String(name).trim().normalize('NFKC')))return 'Martial Arts';
 if(/^(play instrument|игра на инструменте|музыкальный инструмент)(?=\s|\(|$)/iu.test(n))return 'Play Instrument';
 return null;
}
function specLabel(name,parent){
 const s=String(name??'').trim();
 if(parent){const m=s.match(/^[^()]+\(([^()]+)\)\s*$/);if(m&&m[1].trim())return m[1].trim()}
 return s;
}
function isMartial(name){return !!(global.CharacterExtra&&global.CharacterExtra.martialName&&global.CharacterExtra.martialName(String(name||'').trim()))}
function specRows(c){
 const list=c&&isObj(c.extra)&&Array.isArray(c.extra.specializations)?c.extra.specializations:[];
 const out=[];
 list.forEach((s,index)=>{
  if(!isObj(s))return;
  const name=String(s.name||'').trim().slice(0,100);if(!name)return;
  const lv=Math.trunc(Number(s.level));
  out.push({index,id:s.id,name,stat:STATS.includes(s.stat)?s.stat:(s.stat===undefined?'INT':null),level:Number.isFinite(lv)?Math.max(0,Math.min(10,lv)):0,mult:Number(s.cost)===2||isMartial(name)?2:1,parent:specParent(name)});
 });
 return out;
}
function totalText(r,totalFn){
 if(!r.stat)return '—';
 let t;try{t=Number(totalFn(r.stat,r.level))}catch(e){t=NaN}
 return Number.isFinite(t)?signed(t):'—';
}
function rowHTML(r,lang,totalFn){
 const ru=lang!=='en',label=specLabel(r.name,r.parent),total=totalText(r,totalFn);
 const pl=r.parent&&global.SKILL_LABELS&&global.SKILL_LABELS[r.parent];
 const search=[r.name,pl?pl.en:'',pl?pl.ru:'',r.stat||'','специализация specialization'].join(' ');
 return `<div class="skill-row skill-spec-row" data-skill-search="${esc(search)}" data-skill-level="${r.level}" data-spec-id="${esc(r.id)}"><div><strong title="${esc(r.name)}">↳ ${esc(label)}</strong><small>${esc(r.stat||'?')} · ×${r.mult} · ${ru?'специализация':'specialization'}</small></div><span class="skill-spec-level" aria-label="${ru?'Уровень':'Level'} ${r.level}">${r.level}</span><button type="button" class="skill-roll" data-cx-action="roll-skill" data-cx-index="${r.index}" title="${esc('1d10 + '+(r.stat||'?')+' + '+r.name)}" aria-label="${esc((ru?'Бросок':'Roll')+': '+r.name+', '+total)}"><span aria-hidden="true">⬡</span><b data-spec-total="${r.index}">${esc(total)}</b></button></div>`;
}
function specRowsHTML(c,parentKey,lang,totalFn){
 return specRows(c).filter(r=>r.parent===parentKey).map(r=>rowHTML(r,lang,totalFn)).join('');
}
function otherSpecRowsHTML(c,lang,totalFn){
 return specRows(c).filter(r=>r.parent===null).map(r=>rowHTML(r,lang,totalFn)).join('');
}
function ipBalanceOf(c){
 const x=c&&c.extra;if(!isObj(x))return null;
 if(x.ipLog!==undefined&&!Array.isArray(x.ipLog))return null;
 const open=Number(x.ipOpening);let sum=Number.isFinite(open)?Math.trunc(open):0;
 for(const e of x.ipLog||[]){const d=Number(isObj(e)?e.delta:NaN);if(Number.isFinite(d))sum+=Math.trunc(d)}
 return sum;
}
function ipChipHTML(c,lang){
 const n=ipBalanceOf(c);if(n===null||!global.CharacterExtra)return '';
 const ru=lang!=='en',t=`${ru?'Опыт (IP)':'Improvement Points'}: ${n}. ${ru?'Открыть':'Open'}`;
 return `<button type="button" class="hud-chip hud-ip" data-hud-jump="sheet-ip" aria-label="${esc(t)}" title="${esc(t)}"><span aria-hidden="true">▲</span><small>IP</small><b>${n}</b></button>`;
}
const PART={wound:['ранение','wound'],effects:['эффекты','effects'],sheet:['модификатор','modifier'],luck:['LUCK','LUCK'],precision:['Precision Attack','Precision Attack'],threat:['Threat Detection','Threat Detection'],weapon:['оружие','weapon'],aim:['прицел','aimed'],reputation:['репутация','Reputation'],other:['прочее','other']};
function partsText(parts,mod,lang){
 if(!Array.isArray(parts)||!Number.isFinite(mod))return mod?' '+(mod>0?'+':'−')+' '+Math.abs(mod):'';
 const ru=lang!=='en',list=[];let sum=0;
 for(const p of parts){if(!isObj(p)||!Number.isSafeInteger(p.v)||p.v===0)continue;list.push({k:PART[p.k]?p.k:'other',v:p.v});sum+=p.v}
 if(mod-sum!==0)list.push({k:'other',v:mod-sum});
 return list.map(p=>` ${p.v<0?'−':'+'} ${Math.abs(p.v)} (${PART[p.k][ru?0:1]})`).join('');
}
global.SheetLeftovers={specParent,specLabel,specRows,specRowsHTML,otherSpecRowsHTML,ipBalanceOf,ipChipHTML,partsText};
})(window);
