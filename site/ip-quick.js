/* Quick "+" next to a skill: raise it by one level, paying IP through the sheet's own advancement logic. */
(function(){
'use strict';
const T={ru:{title:'Повысить навык',balance:'Баланс IP',confirm:'Повысить',stale:'Данные изменились, повторите.',done:'Уровень повышен, IP списаны.',funds:'Не хватает IP'},
en:{title:'Raise skill',balance:'IP balance',confirm:'Improve',stale:'Data changed, try again.',done:'Level improved and IP spent.',funds:'Not enough IP'}};
const tx=l=>T[l==='en'?'en':'ru'];
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sel=id=>'skill|'+encodeURIComponent(id);
function quote(c,id,lang){const CX=window.CharacterExtra;if(!CX||!c||typeof id!=='string')return null;try{return CX.advancementQuote(c,sel(id),lang)}catch{return null}}
function button(c,skillId,lang){
 const q=quote(c,skillId,lang);if(!q)return '';
 if(!q.ok&&q.reason!=='funds')return '';
 const t=tx(lang),cost=q.ok?q.quote.cost:q.cost,bal=q.ok?q.quote.balance:q.balance,short=!q.ok;
 const tip=`${t.title}: ${cost} IP · ${t.balance}: ${bal}`;
 return `<button type="button" class="ipq-btn${short?' is-short':''}" data-ipq="${esc(skillId)}" title="${esc(tip)}" aria-label="${esc(tip)}">+</button>`;
}
function spend(c,skillId,lang,confirmFn){
 const t=tx(lang),q=quote(c,skillId,lang);if(!q||!q.ok)return {ok:false,message:q&&q.reason==='funds'?`${t.funds}: ${q.cost} IP / ${q.balance} IP`:t.stale};
 const k=q.quote;if(confirmFn&&!confirmFn(`${t.confirm} ${k.label}: ${k.level} → ${k.next}; ${k.cost} IP?`))return {ok:false,cancelled:true};
 const r=window.CharacterExtra.advance(c,sel(skillId),lang,q.signature);
 return r.ok?{ok:true,message:t.done}:{ok:false,message:t.stale};
}
function click(e){
 const b=e.target?.closest?.('[data-ipq]');if(!b)return;
 const app=window.App,c=app?.active?.();if(!c)return;
 const r=spend(c,b.dataset.ipq,app.lang?.(),m=>window.confirm(m));
 if(r.cancelled)return;
 if(r.ok){app.save();app.render()}
 app.notify?.(r.message);
}
window.IPQuick={button,spend};
if(typeof document!=='undefined')document.addEventListener('click',click);
})();
