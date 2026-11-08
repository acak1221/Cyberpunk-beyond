/* View-only inventory search; character records and saved state are never changed. */
(function(global){
'use strict';
let character=null,owner=null,epoch=null,query='',category='all';
const categories=['all','equipment','cyberware','armor','other'];
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const normalized=x=>String(x??'').normalize('NFKC').trim().toLocaleLowerCase();
function render(c,lang,scope,generation){
 if(c!==character||scope!==owner||generation!==epoch){character=c;owner=scope;epoch=generation;query='';category='all'}
 const ru=lang!=='en',labels=ru?['Все категории','Снаряжение','Киберимпланты','Броня','Другое']:['All categories','Equipment','Cyberware','Armor','Other'];
 return `<div class="inventory-filter"><label class="field">${ru?'Поиск по инвентарю':'Search inventory'}<input type="search" data-inventory-filter="query" maxlength="120" value="${esc(query)}" placeholder="${ru?'Название или заметки':'Name or notes'}" autocomplete="off"></label><label class="field">${ru?'Категория':'Category'}<select data-inventory-filter="category">${categories.map((v,i)=>`<option value="${v}"${v===category?' selected':''}>${labels[i]}</option>`).join('')}</select></label><p data-inventory-filter-count role="status" aria-live="polite"></p></div>`;
}
function apply(root,lang){
 if(!root)return;
 const words=normalized(query).split(/\s+/).filter(Boolean);let shown=0,total=0;
 for(const row of root.querySelectorAll('[data-inventory-row]')){
  total++;const name=row.querySelector('[data-cx-list="items"][data-cx-key="name"]')?.value||'',notes=row.querySelector('[data-cx-list="items"][data-cx-key="notes"]')?.value||'',kind=row.querySelector('[data-cx-list="items"][data-cx-key="category"]')?.value||'';
  const text=normalized([name,notes,row.dataset.inventoryOther||''].join(' '));const yes=(category==='all'||category===kind)&&words.every(word=>text.includes(word));row.hidden=!yes;if(yes)shown++;
 }
 const count=root.querySelector('[data-inventory-filter-count]');if(count)count.textContent=lang==='en'?`Showing ${shown} of ${total}`:`Показано ${shown} из ${total}`;
}
function handle(e,c,lang,scope,generation){
 const el=e?.target,key=el?.dataset?.inventoryFilter,rowEdit=el?.dataset?.cxList==='items'&&['name','notes','category'].includes(el?.dataset?.cxKey);
 if(!['query','category'].includes(key)&&!rowEdit)return false;
 if(c!==character||scope!==owner||generation!==epoch)return !!key;
 const root=el.closest?.('#sheet-items');if(!root||root.isConnected!==true||el.isConnected!==true)return !!key;
 // Keep the edited row visible while typing; re-filter only when the edit is committed.
 if(rowEdit){if(e.type==='change')apply(root,lang);return false}
 if(root.querySelector(`[data-inventory-filter="${key}"]`)!==el)return true;
 if(key==='query')query=String(el.value||'').slice(0,120);else category=categories.includes(el.value)?el.value:'all';
 apply(root,lang);return true;
}
function reset(root,c,lang,scope,generation){character=c;owner=scope;epoch=generation;query='';category='all';if(!root||root.isConnected!==true)return;const a=root.querySelector('[data-inventory-filter="query"]'),b=root.querySelector('[data-inventory-filter="category"]');if(a)a.value='';if(b)b.value='all';apply(root,lang)}
global.InventoryFilter={render,apply,handle,reset};
})(window);
