/* The inventory as cards: every thing has a type, a line from the catalog and the one action that matters for it.
   The cards change nothing themselves: their buttons carry the attributes the armor and cyberware handlers already read. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'..','site',f),'utf8');
function load({tools=true}={}){
 const window={};vm.runInNewContext(read('catalog.js'),{window});
 if(tools)window.EquipmentTools={starterArmorLocation:r=>r.starter===undefined?undefined:r.starter};
 vm.runInNewContext(read('inventory-cards.js')+'\n'+read('inventory-filter.js'),{window});
 return {window,C:window.InventoryCards,F:window.InventoryFilter};
}
const item=(catalogId,more={})=>({id:'r-'+catalogId,catalogId,name:catalogId,quantity:1,category:'equipment',...more});

test('a thing has the type the catalog gives it, or the category the player gave a thing written in by hand',()=>{
 const {C}=load();
 assert.equal(C.typeOf(item('armor-leathers')),'armor');assert.equal(C.typeOf(item('cyberware-neural-link')),'cyberware');
 assert.equal(C.typeOf(item('gear-agent')),'gear');assert.equal(C.typeOf(item('weapon-heavy-pistol')),'weapon');
 const ammo=C.typeOf({catalogId:[...load().window.CATALOG].find(x=>x.category==='ammo').id}),mod=C.typeOf({catalogId:[...load().window.CATALOG].find(x=>x.category==='attachment').id});
 assert.equal(ammo,'ammo');assert.equal(mod,'ammo');
 assert.equal(C.typeOf({name:'Своя вещь',category:'other'}),'other');assert.equal(C.typeOf({name:'Своя броня',category:'armor'}),'armor');
 assert.equal(C.typeOf({name:'x',category:'equipment'}),'gear');assert.equal(C.typeOf({catalogId:'no-such-thing'}),'gear');assert.equal(C.typeOf(null),'gear');
 for(const type of C.TYPES){assert.match(C.sign(type),new RegExp('data-inv-sign="'+type+'" aria-hidden="true"'));assert.ok(C.t('ru',type));assert.ok(C.t('en',type))}
 assert.deepEqual(Object.keys(C.T.ru).sort(),Object.keys(C.T.en).sort());
});

test('a card shows the line of the catalog with the page, in the language of the sheet',()=>{
 const {C}=load();
 assert.equal(C.line(item('armor-leathers'),'en'),'SP 4 · No armor penalty · p. 350');
 assert.match(C.line(item('armor-leathers'),'ru'),/^SP 4 · .* · стр\. 350$/);
 assert.equal(C.line({name:'Своя вещь'},'ru'),'');assert.equal(C.quick({},{name:'Своя вещь'},'ru'),'','a thing written in by hand has no line and no buttons');
 assert.match(C.quick({},item('gear-agent'),'ru'),/^<div class="inv-quick"><span class="inv-line">[^<]+<\/span><\/div>$/);
});

test('armor in the bag offers the head and the body; worn armor offers to come off; a spare piece offers the place left',()=>{
 const {C}=load(),it=item('armor-leathers'),bare={extra:{}};
 const off=C.actions(bare,it,'ru');
 assert.match(off,/data-eq-action="equip" data-eq-id="r-armor-leathers" data-eq-location="head">На голову</);assert.match(off,/data-eq-location="body">На тело</);assert.doesNotMatch(off,/unequip/);
 const worn={extra:{equipment:{armor:{body:{recordId:it.id,catalogId:it.catalogId}}}}};
 assert.deepEqual([...C.wornAt(worn,it)],['body']);
 const one=C.actions(worn,it,'ru');
 assert.match(one,/data-eq-action="unequip" data-eq-location="body">Снять с тела</);assert.doesNotMatch(one,/На голову/,'one piece covers one place');
 const two=C.actions(worn,{...it,quantity:2},'en');
 assert.match(two,/data-eq-action="equip" data-eq-id="r-armor-leathers" data-eq-location="head">On the head</);assert.match(two,/Take off the body/);
 // a piece of starter armor belongs to one place
 assert.match(C.actions(bare,{...it,starter:'head'},'ru'),/^<button[^>]*data-eq-location="head">На голову<\/button>$/);
 assert.equal(C.actions(bare,{...it,starter:false},'ru'),'','a record the armor rules do not accept gets no button');
 assert.equal(C.actions(bare,{...it,quantity:0},'ru'),'');
 // the suit covers both, the shield neither
 const suit=item('armor-bodyweight-suit');
 assert.match(C.actions(bare,suit,'ru'),/data-eq-action="equip" data-eq-id="r-armor-bodyweight-suit" data-eq-location="both">Надеть</);
 assert.match(C.actions({extra:{equipment:{armor:{head:{recordId:suit.id},body:{recordId:suit.id}}}}},suit,'ru'),/^<button[^>]*data-eq-action="unequip" data-eq-location="head">Снять<\/button>$/);
 assert.equal(C.actions(bare,item('armor-bulletproof-shield'),'ru'),'');
 assert.equal(C.actions(bare,{catalogId:'armor-leathers',quantity:1},'ru'),'','no record id, no button');
});

test('cyberware offers «Установить» until every copy is installed',()=>{
 const {C}=load(),it=item('cyberware-neural-link');
 assert.match(C.actions({extra:{}},it,'ru'),/data-eq-action="prepare" data-eq-id="r-cyberware-neural-link">Установить</);
 const done={extra:{equipment:{installs:[{recordId:it.id}]}}};
 assert.equal(C.installedCount(done,it),1);assert.equal(C.actions(done,it,'ru'),'');
 assert.match(C.actions(done,{...it,quantity:2},'ru'),/prepare/);
 assert.match(C.actions({extra:{equipment:{installs:[{recordId:it.id,removedAt:'2045-01-01'}]}}},it,'en'),/>Install</,'a removed implant can be installed again');
 assert.equal(C.actions({extra:{}},{...it,humanityLossIncluded:true},'ru'),'','installed at character creation');
 assert.equal(C.actions({extra:{}},item('gear-agent'),'ru'),'');
});

test('a weapon is a card of the same list with a way to its rolls, and names are text, never markup',()=>{
 const {C}=load(),c={extra:{weapons:[{id:'w1',catalogId:'weapon-heavy-pistol',name:'Heavy Pistol',damage:'3d6',rof:2,capacity:8,ammo:5,usesAmmo:true},{id:'w2',name:'<b>Нож</b>',damage:'1d6',rof:2},null,'x']}};
 const html=C.weaponRows(c,'ru',w=>w.id==='w1'?'Тяжёлый пистолет':'');
 assert.equal(html.split('data-inventory-row').length-1,2);
 assert.match(html,/data-inventory-type="weapon" data-inventory-other="Тяжёлый пистолет Тяжёлый пистолет Heavy Pistol"/);
 assert.match(html,/<strong>Тяжёлый пистолет<\/strong>/);assert.match(html,/Урон 3d6 · ROF 2 · магазин 5\/8 · стр\. 341/);
 assert.match(html,/data-hud-jump="sheet-weapons">К броскам →</);
 assert.match(html,/&lt;b&gt;Нож&lt;\/b&gt;/);assert.doesNotMatch(html,/<b>Нож/);assert.match(html,/Урон 1d6 · ROF 2</);
 assert.equal(C.weaponRows({},'ru'),'');assert.equal(C.weaponRows({extra:{weapons:'x'}},'ru'),'');
});

test('the armor and cyberware block is folded, and open while an installation waits or after the player opened it',()=>{
 const {C}=load();
 assert.equal(C.wrapEquipment('','ru'),'');
 assert.match(C.wrapEquipment('<div>armor</div>','ru'),/^<details class="inv-more" data-inv-more><summary><span>Броня, SP и установка имплантов: подробно<\/span>/);
 assert.match(C.wrapEquipment('<div data-eq-preview>confirm</div>','en'),/^<details class="inv-more" data-inv-more open><summary><span>Armor, SP and installing cyberware: in detail/);
 C._test.sticky(true);assert.match(C.wrapEquipment('<div>armor</div>','ru'),/data-inv-more open>/);
});

/* ---------- The chips ---------- */

function sheet(F,list){
 const rows=list.map(([name,type,category])=>{const fields={name:{value:name},category:{value:category||'equipment'},notes:{value:''}};return {dataset:{inventoryOther:'',...(type?{inventoryType:type}:{})},hidden:false,querySelector:s=>fields[s.match(/data-cx-key="([^"]+)"/)?.[1]]}});
 const chips=['all','weapon','armor','cyberware','gear','ammo','other'].map(v=>{const b={textContent:''},cls=new Set(),attrs={};return {value:v,dataset:{inventoryFilter:'type'},isConnected:true,count:b,cls,attrs,querySelector:()=>b,setAttribute:(k,x)=>{attrs[k]=x},classList:{toggle:(n,on)=>on?cls.add(n):cls.delete(n)}}});
 const count={textContent:''},root={isConnected:true,querySelectorAll:s=>s==='[data-inventory-row]'?rows:chips,querySelector:s=>s==='[data-inventory-filter-count]'?count:null};
 for(const c of chips)c.closest=()=>root;
 return {rows,chips,count,root,chip:v=>chips.find(c=>c.value===v)};
}

test('the chips count each type, show one type at a time and work together with the search',()=>{
 const {F}=load(),c={},h=sheet(F,[['Пистолет','weapon'],['Кожа','armor'],['Нейросвязь','cyberware'],['Агент','gear'],['Старая запись','', 'armor'],['Без типа','','other']]);
 const html=F.render(c,'ru','a',1);
 assert.equal(html.split('data-inventory-filter="type"').length-1,7);assert.match(html,/value="all" aria-pressed="true"/);assert.match(html,/value="armor" aria-pressed="false"><span class="inv-sign" data-inv-sign="armor"/);
 assert.doesNotMatch(html,/<select/);
 F.apply(h.root,'ru');
 assert.deepEqual(h.chips.map(x=>x.count.textContent),['6','1','2','1','1','0','1']);assert.equal(h.chip('ammo').cls.has('empty'),true);assert.equal(h.chip('all').cls.has('empty'),false);
 assert.equal(F.handle({type:'click',target:h.chip('armor')},c,'ru','a',1),true);
 assert.deepEqual(h.rows.map(r=>r.hidden),[true,false,true,true,false,true],'a row without a type is read by its category');
 assert.equal(h.chip('armor').attrs['aria-pressed'],'true');assert.equal(h.chip('all').attrs['aria-pressed'],'false');assert.equal(h.count.textContent,'Показано 2 из 6');
 assert.match(F.render(c,'ru','a',1),/value="armor" aria-pressed="true"/,'the choice survives a redraw of the same sheet');
 assert.match(F.render({},'ru','a',1),/value="all" aria-pressed="true"/,'and does not follow to another sheet');
});

test('a page without the cards module still filters by the category of a row',()=>{
 const window={};vm.runInNewContext(read('inventory-filter.js'),{window});
 const F=window.InventoryFilter,h=sheet(F,[['A','', 'armor'],['B','', 'equipment']]),c={};
 assert.match(F.render(c,'en','a',1),/<span>Armor<\/span>/);
 F.handle({type:'click',target:h.chip('gear')},c,'en','a',1);assert.deepEqual(h.rows.map(r=>r.hidden),[true,false]);assert.equal(h.count.textContent,'Showing 1 of 2');
});

/* ---------- Groups (item-groups.js) ---------- */

test('the weapon cards come one by one with their records, and a card says which group it is in',()=>{
 const {C,window}=load(),c={extra:{weapons:[{id:'w1',name:'Knife',damage:'1d6',rof:2},null,{id:'w2',name:'Club',damage:'2d6',rof:1,group:'g-bag'}]}};
 const list=C.weaponList(c,'ru',w=>w.name);
 assert.equal(list.length,2);assert.equal(list[0].record,c.extra.weapons[0]);assert.equal(list[1].record,c.extra.weapons[2]);
 assert.equal(C.weaponRows(c,'ru',w=>w.name),list.map(x=>x.html).join(''));
 assert.deepEqual([...C.weaponList({},'ru')],[]);assert.deepEqual([...C.weaponList({extra:{weapons:'x'}},'ru')],[]);
 // Without the groups module a card has no group and no select: it is the card it was.
 for(const x of list){assert.match(x.html,/data-inventory-row data-inventory-group="" data-inventory-type="weapon"/);assert.doesNotMatch(x.html,/<select/)}
 window.ItemGroups={groupOf:(_,w)=>w.group||'',field:(_,kind,w)=>`<label data-test-field="${kind}:${w.id}"></label>`};
 const html=C.weaponRow(c,c.extra.weapons[2],'ru','Club');
 assert.match(html,/data-inventory-group="g-bag" data-inventory-type="weapon"/);assert.match(html,/<span class="inv-actions"><label data-test-field="weapons:w2"><\/label><button type="button" class="cx-button inv-act" data-hud-jump="sheet-weapons">/);
});
