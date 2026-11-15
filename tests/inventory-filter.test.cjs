const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function setup(){const win={};vm.runInNewContext(fs.readFileSync('site/inventory-filter.js','utf8'),{window:win});const rows=[['Аптечка','First aid kit','equipment','medicine'],['Броня','Light Armorjack','armor',''],['Собственный предмет','','other','полезный инструмент']].map(([name,other,category,notes])=>{const fields={name:{value:name},category:{value:category},notes:{value:notes}};return {dataset:{inventoryOther:other},hidden:false,fields,querySelector:s=>fields[s.match(/data-cx-key="([^"]+)"/)?.[1]]}});const count={textContent:''},fields={};const root={isConnected:true,querySelectorAll:()=>rows,querySelector:s=>s==='[data-inventory-filter-count]'?count:s.includes('"query"')?fields.query:s.includes('"category"')?fields.category:null};return {filter:win.InventoryFilter,rows,count,root,fields}}
function event(h,key,value){const target={dataset:{inventoryFilter:key},value,isConnected:true,closest:()=>h.root};h.fields[key]=target;return {target}}
test('searches live names, bilingual catalog names and notes with a category filter',()=>{const h=setup(),c={};h.filter.render(c,'ru','account',1);h.filter.handle(event(h,'query','first aid'),c,'ru','account',1);assert.deepEqual(h.rows.map(r=>r.hidden),[false,true,true]);assert.equal(h.count.textContent,'Показано 1 из 3');h.filter.handle(event(h,'category','armor'),c,'en','account',1);assert.deepEqual(h.rows.map(r=>r.hidden),[true,true,true]);h.filter.handle(event(h,'query',''),c,'en','account',1);assert.deepEqual(h.rows.map(r=>r.hidden),[true,false,true]);assert.equal(h.count.textContent,'Showing 1 of 3');h.filter.handle(event(h,'category','all'),c,'en','account',1);h.filter.handle(event(h,'query','полезный'),c,'en','account',1);assert.deepEqual(h.rows.map(r=>r.hidden),[true,true,false])});
test('filter never edits records and remains local to character, scope and generation',()=>{const h=setup(),c={items:[{name:'Original',quantity:2}]},before=JSON.stringify(c);h.filter.render(c,'en','a',1);h.filter.handle(event(h,'query','armor'),c,'en','a',1);assert.equal(JSON.stringify(c),before);assert.match(h.filter.render(c,'ru','a',1),/value="armor"/);h.filter.render(c,'ru','a',2);h.filter.apply(h.root,'ru');assert.deepEqual(h.rows.map(r=>r.hidden),[false,false,false]);h.filter.handle(event(h,'query','<b>'),c,'en','a',2);assert.match(h.filter.render(c,'en','a',2),/value="&lt;b&gt;"/);h.filter.render({},'en','a',2);h.filter.apply(h.root,'en');assert.equal(h.count.textContent,'Showing 3 of 3')});
test('scope reset restores every row and stale or detached events cannot change active filter',()=>{const h=setup(),c={};h.filter.render(c,'en','a',1);const old=event(h,'query','armor');h.filter.handle(old,c,'en','a',1);h.filter.reset(h.root,c,'en','b',2);assert.equal(h.fields.query.value,'');assert.deepEqual(h.rows.map(r=>r.hidden),[false,false,false]);old.target.isConnected=false;h.filter.handle(old,c,'en','b',2);assert.match(h.filter.render(c,'en','b',2),/data-inventory-filter="query" maxlength="120" value=""/);h.filter.handle(event(h,'query','medicine'),c,'en','a',1);assert.doesNotMatch(h.filter.render(c,'en','b',2),/value="medicine"/)});
test('editing a visible item refreshes the view without swallowing the edit',()=>{const h=setup(),c={};h.filter.render(c,'en','a',1);h.filter.handle(event(h,'query','medicine'),c,'en','a',1);h.rows[0].fields.notes.value='changed';const target={dataset:{cxList:'items',cxKey:'notes'},isConnected:true,closest:()=>h.root};assert.equal(h.filter.handle({type:'input',target},c,'en','a',1),false);assert.equal(h.rows[0].hidden,false);assert.equal(h.filter.handle({type:'change',target},c,'en','a',1),false);assert.equal(h.rows[0].hidden,true)});

/* ---------- The group chips (item-groups.js) ---------- */
// A sheet with rows that say their group, the chips of the groups, and the click listener the module puts on the document.
function groupSetup(groups=['g-bag','g-car']){
 const listeners={},win={document:{addEventListener:(type,fn)=>{listeners[type]=fn}}};vm.runInNewContext(fs.readFileSync('site/inventory-filter.js','utf8'),{window:win});
 const after=[];win.ItemGroups={groups:()=>groups.map(id=>({id,name:id})),has:(c,id)=>groups.includes(id),chips:(c,lang,picked)=>'<div data-test-chips="'+picked+'"></div>',afterFilter:(root,state)=>after.push({...state})};
 const rows=[['Пистолет','weapon','g-bag'],['Кожа','armor','g-bag'],['Кевлар','armor',''],['Агент','gear','g-car'],['Старая запись','gear',undefined]].map(([name,type,g])=>{const fields={name:{value:name},category:{value:'equipment'},notes:{value:''}};return {dataset:{inventoryOther:'',inventoryType:type,...(g===undefined?{}:{inventoryGroup:g})},hidden:false,querySelector:s=>fields[s.match(/data-cx-key="([^"]+)"/)?.[1]]}});
 const chip=(kind,value)=>{const b={textContent:''},attrs={};return {value,dataset:{inventoryFilter:kind},count:b,attrs,querySelector:()=>b,setAttribute:(k,x)=>{attrs[k]=x},classList:{toggle(){}}}};
 const typeChips=['all','weapon','armor','cyberware','gear','ammo','other'].map(v=>chip('type',v)),groupChips=['none',...groups].map(v=>chip('group',v));
 const count={textContent:''},fields={},root={isConnected:true,querySelectorAll:s=>s==='[data-inventory-row]'?rows:s.includes('"group"')?groupChips:typeChips,querySelector:s=>s==='[data-inventory-filter-count]'?count:s.includes('"query"')?fields.query:null};
 const press=c=>{c.closest=s=>s==='#sheet-items'?root:c;listeners.click({target:c})};
 return {filter:win.InventoryFilter,win,rows,root,count,fields,after,groups,press,type:v=>typeChips.find(c=>c.value===v),group:v=>groupChips.find(c=>c.value===v),hidden:()=>rows.map(r=>r.hidden)};
}
test('group chips count every group and «Без группы», show one group at a time, and work with the type chips and the search',()=>{
 const h=groupSetup(),c={};
 assert.match(h.filter.render(c,'ru','a',1),/<\/div><div data-test-chips="all"><\/div><label class="field">Поиск по инвентарю/,'the group chips sit right under the type chips');
 h.filter.apply(h.root,'ru');
 assert.deepEqual(['none','g-bag','g-car'].map(v=>h.group(v).count.textContent),['2','2','1'],'a row with no group, or drawn without the attribute, is «Без группы»');
 assert.deepEqual(h.type('all').count.textContent,'5');assert.deepEqual(h.after.at(-1),{query:false,group:'all',filtered:false});
 h.press(h.group('g-bag'));
 assert.deepEqual(h.hidden(),[false,false,true,true,true]);assert.equal(h.group('g-bag').attrs['aria-pressed'],'true');assert.equal(h.group('none').attrs['aria-pressed'],'false');assert.equal(h.count.textContent,'Показано 2 из 5');
 assert.deepEqual(h.after.at(-1),{query:false,group:'g-bag',filtered:true});assert.equal(h.filter._group(),'g-bag');
 assert.deepEqual(['none','g-bag','g-car'].map(v=>h.group(v).count.textContent),['2','2','1'],'the counts are of everything, not of what is shown');
 h.press(h.type('armor'));assert.deepEqual(h.hidden(),[true,false,true,true,true],'a group and a type together');
 h.press(h.type('armor'));
 const q={dataset:{inventoryFilter:'query'},value:'пист',isConnected:true,closest:()=>h.root};h.fields.query=q;
 assert.equal(h.filter.handle({type:'input',target:q},c,'ru','a',1),true);assert.deepEqual(h.hidden(),[false,true,true,true,true]);assert.deepEqual(h.after.at(-1),{query:true,group:'g-bag',filtered:true});
 q.value='';h.filter.handle({type:'input',target:q},c,'ru','a',1);
 assert.match(h.filter.render(c,'ru','a',1),/data-test-chips="g-bag"/,'the choice survives a redraw of the same sheet');
 h.press(h.group('none'));assert.deepEqual(h.hidden(),[true,true,false,true,false]);
 h.press(h.group('none'));assert.deepEqual(h.hidden(),[false,false,false,false,false],'pressing the pressed chip again shows everything');assert.equal(h.filter._group(),'all');
});
test('a picked group does not outlive the group, the sheet, the scope or the page generation',()=>{
 const h=groupSetup(),c={};h.filter.render(c,'ru','a',1);
 h.press(h.group('g-car'));assert.equal(h.filter._group(),'g-car');
 h.groups.pop();assert.match(h.filter.render(c,'ru','a',1),/data-test-chips="all"/,'the group was deleted');h.filter.apply(h.root,'ru');assert.deepEqual(h.hidden(),[false,false,false,false,false]);
 h.press(h.group('none'));h.groups.length=0;assert.match(h.filter.render(c,'ru','a',1),/data-test-chips="all"/,'«Без группы» means nothing when there are no groups');
 for(const [who,scope,generation] of [[{},'b',1],[c,'x',1],[c,'b',2]]){h.groups.push('g-bag');h.filter.render(c,'ru','b',1);h.press(h.group('g-bag'));assert.equal(h.filter._group(),'g-bag');h.filter.render(who,'ru',scope,generation);assert.equal(h.filter._group(),'all');h.groups.length=0}
 h.groups.push('g-bag');h.filter.render(c,'ru','z',9);h.press(h.group('g-bag'));h.filter.reset(h.root,c,'ru','z',9);assert.equal(h.filter._group(),'all');assert.deepEqual(h.hidden(),[false,false,false,false,false]);
 // A value that is not a known group cannot stay picked through a forged chip.
 h.press({value:'g-forged',dataset:{inventoryFilter:'group'}});assert.match(h.filter.render(c,'ru','z',9),/data-test-chips="all"/);
});
test('without the groups module the filter draws and filters exactly as before',()=>{
 const h=groupSetup();delete h.win.ItemGroups;const c={};
 const html=h.filter.render(c,'ru','a',1);assert.doesNotMatch(html,/data-test-chips|inventory-groups|undefined/);assert.match(html,/<\/button><\/div><label class="field">Поиск по инвентарю/);
 h.filter.apply(h.root,'ru');assert.deepEqual(h.hidden(),[false,false,false,false,false]);assert.equal(h.count.textContent,'Показано 5 из 5');assert.equal(h.after.length,0);
 h.press(h.type('armor'));assert.deepEqual(h.hidden(),[true,false,false,true,true]);
});
