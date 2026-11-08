/* Ephemeral sheet filter: does not alter character data or saved state. */
(function(global){
'use strict';
let character=null,owner=null,epoch=null,query='',trained=false;
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const normalized=x=>String(x??'').normalize('NFKC').trim().toLocaleLowerCase();
function render(c,lang,scope,generation){
 if(c!==character||scope!==owner||generation!==epoch){character=c;owner=scope;epoch=generation;query='';trained=false}
 const ru=lang!=='en';
 return `<div class="sheet-skill-filter"><label class="field">${ru?'Поиск базовых навыков':'Search base skills'}<input type="search" data-skill-filter="query" value="${esc(query)}" placeholder="${ru?'Название или STAT':'Name or STAT'}" autocomplete="off"></label><label><input type="checkbox" data-skill-filter="trained" ${trained?'checked':''}> ${ru?'Только изученные':'Trained only'}</label><p>${ru?'Отдельные специализации находятся ниже по листу.':'Separate specializations are further down the sheet.'}</p><p data-skill-filter-count role="status" aria-live="polite"></p></div>`;
}
function apply(root,lang){
 if(!root)return;
 const words=normalized(query).split(/\s+/).filter(Boolean);let shown=0,total=0;
 for(const row of root.querySelectorAll('.skill-row[data-skill-search]')){
  total++;const text=normalized(row.dataset.skillSearch),value=row.querySelector('input[data-skill]')?.value;
  const yes=words.every(w=>text.includes(w))&&(!trained||(typeof value==='string'&&/^\d+$/.test(value.trim())&&Number(value)>0));
  row.hidden=!yes;if(yes)shown++;
 }
 const count=root.querySelector('[data-skill-filter-count]');if(count)count.textContent=lang==='en'?`Showing ${shown} of ${total}`:`Показано ${shown} из ${total}`;
}
function handle(e,c,lang,scope,generation){
 const el=e?.target,key=el?.dataset?.skillFilter;
 if(!['query','trained'].includes(key))return false;
 if(c!==character||scope!==owner||generation!==epoch)return true;
 const root=el.closest?.('.card');if(!root||root.isConnected!==true||el.isConnected!==true||root.querySelector(`[data-skill-filter="${key}"]`)!==el)return true;
 if(key==='query')query=String(el.value||'').slice(0,120);else trained=!!el.checked;
 apply(root,lang);return true;
}
function reset(root,c,lang,scope,generation){
 character=c;owner=scope;epoch=generation;query='';trained=false;
 if(!root||root.isConnected!==true)return;
 const search=root.querySelector('[data-skill-filter="query"]'),checkbox=root.querySelector('[data-skill-filter="trained"]');
 if(search)search.value='';if(checkbox)checkbox.checked=false;apply(root,lang);
}
global.SkillFilter={render,apply,handle,reset};
})(window);
