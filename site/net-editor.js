/* The NET architecture as a tree, and a run through it floor by floor (rules: corebook pp. 197–211).
   NetTools (net-tools.js) stays the only entry point for app.js: it asks this module for markup and forwards
   the clicks whose name starts with "ed-" or "run-". Without this file NetTools shows its flat list as before.

   The saved shape is the one NetTools already validates. Two optional fields are added:
   floor.parent (id of the floor above, '' for the entrance) and architecture.runAt (the floor the Netrunner is on).
   Data saved before this feature has neither and is read as one straight line in array order, which is the old
   meaning. Nothing is written while reading or drawing; parents are written on the first structural edit. */
(function(){
'use strict';
const T={
 ru:{editor:'Редактор',run:'Проход',modes:'Режим работы с архитектурой',floor:'Этаж',structure:'Структура',
  up:'Выше',upFull:'поменять местами с этажом выше',down:'Ниже',downFull:'поменять местами с этажом ниже',
  prev:'Ветка раньше',prevFull:'поставить эту ветку раньше соседней',next:'Ветка позже',nextFull:'поставить эту ветку позже соседней',
  add:'Этаж ниже',addFull:'добавить этаж ниже; второй этаж ниже начинает ветку',
  move:'Перенести…',moveFull:'перенести под другой этаж вместе со всем, что ниже',moveCancel:'Отменить перенос',
  here:'Сюда',hereFull:'перенести выбранный этаж сюда',remove:'Удалить этаж',
  pick:n=>`Выберите этаж, под который перенести «Этаж ${n}» вместе со всем, что ниже: на подходящих этажах есть кнопка «Сюда». Записи этажей на время выбора скрыты.`,noTarget:'перенести некуда: все остальные этажи ниже этого или он уже на своём месте',
  moved:'Этаж перенесён.',limit:'Достигнут предел количества записей.',empty:'В архитектуре пока нет этажей.',addFirst:'Добавить этаж',
  branchOf:n=>`Ветка от этажа ${n}`,entrances:'Вход',treeHelp:'Этажи идут сверху вниз. Если под этажом их несколько, каждая ветка показана со сдвигом и линией слева. Удаление этажа поднимает всё, что было ниже, на его место.',
  types:{password:'Пароль',file:'Файл',control:'Узел управления',ice:'Black ICE',other:'Другое'},
  states:{closed:'Закрыто',open:'Открыто',other:'Другое',waiting:'Ожидает',pursuing:'Преследует',derezzed:'Derezzed',destroyed:'Уничтожен'},
  runTitle:'ПРОХОД ПО АРХИТЕКТУРЕ',unnamed:'Без названия',modifier:'модификатор',actions:'NET-действия',newTurn:'Новый ход',spend:'Потратить 1 действие',refund:'Вернуть 1 действие',
  path:'Путь от входа',here2:'Вы здесь',emptyFloor:'На этом этаже ничего не записано.',state:'Состояние',
  roll:dv=>`Бросить Interface против DV ${dv}`,markOpen:'Отметить: открыто',markClosed:'Закрыть снова',
  rolled:(r,ok)=>`Interface + 1d10: ${r.total} ${ok?'>':'≤'} DV ${r.dv}. ${ok?'Успех: отмечено «Открыто». Если это ошибка, нажмите «Закрыть снова».':'Не выше DV: состояние не изменилось.'}`,
  rezDown:'REZ −1',rezUp:'REZ +1',toCombat:'В калькулятор боя',
  goUp:n=>`↑ Этаж ${n}`,goDown:n=>`↓ Этаж ${n}`,toStart:'В начало',move2:'Куда дальше',deepest:'Глубже этажей нет.',
  locked:'На этаже закрытый пароль: пройти глубже можно после него. Кнопки всё равно работают — решает ведущий.',
  map:'КАРТА',mapHelp:'Нажмите на этаж, чтобы поставить на него нетраннера.',
  resetAll:'Сбросить защиту',resetHelp:'Открытые пароли, файлы и узлы снова закрываются; ICE, кроме уничтоженного, возвращается в ожидание с полным REZ.',
  resetDone:'Защита сброшена.',resetNone:'Сбрасывать нечего: всё уже в исходном состоянии.',undo:'Вернуть как было',undone:'Состояние возвращено.',undoStale:'Данные изменились: вернуть прежнее состояние уже нельзя.',
  rollLabel:(type,n,dv)=>`Interface · ${type} · этаж ${n} · DV ${dv}`},
 en:{editor:'Editor',run:'Run',modes:'How to work with the architecture',floor:'Floor',structure:'Structure',
  up:'Up',upFull:'swap with the floor above',down:'Down',downFull:'swap with the floor below',
  prev:'Branch earlier',prevFull:'put this branch before its neighbour',next:'Branch later',nextFull:'put this branch after its neighbour',
  add:'Floor below',addFull:'add a floor below; a second floor below starts a branch',
  move:'Move…',moveFull:'move under another floor together with everything below',moveCancel:'Cancel the move',
  here:'Here',hereFull:'move the chosen floor here',remove:'Remove floor',
  pick:n=>`Choose the floor to move “Floor ${n}” under, together with everything below it: suitable floors have a “Here” button. The records of the floors are hidden while you choose.`,noTarget:'nowhere to move it: every other floor is below this one, or it is already in its place',
  moved:'Floor moved.',limit:'The record limit has been reached.',empty:'This architecture has no floors yet.',addFirst:'Add floor',
  branchOf:n=>`Branch from floor ${n}`,entrances:'Entrance',treeHelp:'Floors go from top to bottom. Where a floor has several floors below it, each branch is shifted and has a line on its left. Removing a floor lifts everything below it into its place.',
  types:{password:'Password',file:'File',control:'Control node',ice:'Black ICE',other:'Other'},
  states:{closed:'Closed',open:'Open',other:'Other',waiting:'Lying in wait',pursuing:'Pursuing',derezzed:'Derezzed',destroyed:'Destroyed'},
  runTitle:'RUNNING THE ARCHITECTURE',unnamed:'Untitled',modifier:'modifier',actions:'NET Actions',newTurn:'New turn',spend:'Spend 1 action',refund:'Refund 1 action',
  path:'Path from the entrance',here2:'You are here',emptyFloor:'Nothing is recorded on this floor.',state:'State',
  roll:dv=>`Roll Interface against DV ${dv}`,markOpen:'Mark as open',markClosed:'Close again',
  rolled:(r,ok)=>`Interface + 1d10: ${r.total} ${ok?'>':'≤'} DV ${r.dv}. ${ok?'Success: marked “Open”. If that is wrong, press “Close again”.':'Not above the DV: the state did not change.'}`,
  rezDown:'REZ −1',rezUp:'REZ +1',toCombat:'To the combat calculator',
  goUp:n=>`↑ Floor ${n}`,goDown:n=>`↓ Floor ${n}`,toStart:'To the start',move2:'Where next',deepest:'There are no deeper floors.',
  locked:'This floor has a closed password: going deeper comes after it. The buttons still work — the GM decides.',
  map:'MAP',mapHelp:'Press a floor to put the Netrunner on it.',
  resetAll:'Reset the defences',resetHelp:'Open passwords, files and nodes close again; ICE, unless destroyed, goes back to waiting with full REZ.',
  resetDone:'Defences reset.',resetNone:'Nothing to reset: everything is already in its starting state.',undo:'Put it back',undone:'State restored.',undoStale:'The data has changed: the earlier state can no longer be put back.',
  rollLabel:(type,n,dv)=>`Interface · ${type.toLowerCase()} · floor ${n} · DV ${dv}`}
};
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clamp=(v,min,max)=>Math.min(max,Math.max(min,Number.isFinite(Number(v))?Math.trunc(Number(v)):min));
const lang=l=>l==='ru'?'ru':'en';
const LOCKS=['password','file','control'];
// Run mode, pick mode, the last roll line and the one-step undo are session state: they are never saved.
let runId=null,moving=null,rollNote=null,resetUndo=null;

function preorder(roots){const out=[],stack=[...roots].reverse();while(stack.length){const n=stack.pop();out.push(n);for(let i=n.children.length-1;i>=0;i--)stack.push(n.children[i])}return out}
// Reads the floors as a tree and never changes them. A parent that is missing, unknown, the floor itself or part
// of a loop is replaced by "the previous floor in the array", so data touched by an older copy of the app
// (which knows nothing about parents) still draws, and nothing here can throw or run forever.
function tree(a){
 const list=[],nodes=new Map();
 (Array.isArray(a?.floors)?a.floors:[]).forEach((floor,index)=>{if(!floor||typeof floor!=='object'||nodes.has(floor.id))return;const n={floor,index,depth:1,parent:null,children:[]};list.push(n);nodes.set(floor.id,n)});
 const explicit=list.some(n=>typeof n.floor.parent==='string');
 const loops=(candidate,n)=>{for(let x=candidate;x;x=x.parent)if(x===n)return true;return false};
 list.forEach((n,k)=>{
  const p=n.floor.parent;if(explicit&&p==='')return;
  const named=explicit&&typeof p==='string'?nodes.get(p):null,previous=k>0?list[k-1]:null;
  if(named&&!loops(named,n))n.parent=named;else if(previous&&!loops(previous,n))n.parent=previous;
 });
 const roots=[];for(const n of list)(n.parent?n.parent.children:roots).push(n);
 const flat=preorder(roots);for(const n of flat)n.depth=n.parent?n.parent.depth+1:1;
 return {roots,nodes,list:flat,order:flat.map(n=>n.floor)};
}
// Writes down what tree() reads, so that later edits have explicit parents to change.
function materialize(a){const t=tree(a);for(const n of t.list)n.floor.parent=n.parent?n.parent.floor.id:'';return t}
// Every structural edit goes through here. The array object and the floor objects are kept (NetTools and app.js
// compare them by reference), the array is left in top-down order so older versions and the ICE picker of the
// combat calculator still see a sensible list, and a label that was just the floor number follows the new depth.
// A refused edit puts the parents back exactly, so "not possible" changes nothing at all.
function structural(a,change){
 if(!a||!Array.isArray(a.floors))return false;
 const saved=a.floors.map(f=>f&&typeof f==='object'?[f,Object.hasOwn(f,'parent'),f.parent]:null);
 const t=materialize(a),before=new Map(t.list.map(n=>[n.floor,n.depth]));
 let out=false;try{out=change(t)}catch{out=false}
 if(!out){for(const s of saved)if(s){if(s[1])s[0].parent=s[2];else delete s[0].parent}return false}
 const order=Array.isArray(out)?out:tree(a).order;
 a.floors.splice(0,a.floors.length,...order);
 for(const n of tree(a).list){const was=before.get(n.floor);if(was!==undefined&&n.floor.label===String(was))n.floor.label=String(n.depth)}
 return true;
}
function blankFloor(label){const made=window.NetTools?.newFloor?.(label);return made||{id:globalThis.crypto?.randomUUID?.()||Date.now()+'-'+Math.random().toString(36).slice(2),label:String(label),branch:'',entries:[]}}
function addChild(a,id){
 if(!a||!Array.isArray(a.floors)||a.floors.length>=100)return false;
 return structural(a,t=>{const n=t.nodes.get(id);if(!n)return false;a.floors.push({...blankFloor(n.depth+1),parent:n.floor.id});return true});
}
// The floor and the one above it exchange places. The other branches of the upper floor stay attached to that
// place in the tree, so they end up under the floor that moved up.
function lift(t,n){
 const p=n?.parent;if(!p)return false;
 const siblings=p.children.filter(c=>c!==n),below=[...n.children],above=p.floor.parent;
 for(const c of siblings)c.floor.parent=n.floor.id;for(const c of below)c.floor.parent=p.floor.id;
 n.floor.parent=above;p.floor.parent=n.floor.id;return true;
}
function swapUp(a,id){return structural(a,t=>lift(t,t.nodes.get(id)))}
function swapDown(a,id){return structural(a,t=>lift(t,t.nodes.get(id)?.children[0]))}
function shift(a,id,step){
 return structural(a,t=>{const n=t.nodes.get(id);if(!n||(step!==1&&step!==-1))return false;const row=n.parent?n.parent.children:t.roots,i=row.indexOf(n),j=i+step;if(j<0||j>=row.length)return false;[row[i],row[j]]=[row[j],row[i]];return preorder(t.roots).map(x=>x.floor)});
}
const inside=(n,top)=>{for(let x=n;x;x=x.parent)if(x===top)return true;return false};
// A floor may go under any floor that is not itself or below it; moving it to where it already is makes no sense.
function canMove(t,n,target){if(!n||!target||inside(target,n))return false;return !(n.parent===target&&target.children[target.children.length-1]===n)}
function reparent(a,id,targetId){
 return structural(a,t=>{const n=t.nodes.get(id),target=t.nodes.get(targetId);if(!canMove(t,n,target))return false;const row=n.parent?n.parent.children:t.roots;row.splice(row.indexOf(n),1);target.children.push(n);n.floor.parent=target.floor.id;return preorder(t.roots).map(x=>x.floor)});
}
// Removing a floor must not lose what is below it: the floors below move up to the removed floor's parent.
// When the entrance itself is removed, the first floor below becomes the entrance and the others hang under it,
// because the editor keeps one entrance.
function removeFloor(a,f){
 let near='';const ok=structural(a,t=>{
  const n=f&&t.nodes.get(f.id);if(!n||n.floor!==f)return false;
  if(!n.parent&&t.roots.length===1&&n.children.length){const first=n.children[0];first.floor.parent='';for(const c of n.children.slice(1))c.floor.parent=first.floor.id}
  else for(const c of n.children)c.floor.parent=f.parent;
  if(a.runAt===f.id)a.runAt=n.parent?n.parent.floor.id:'';
  near=n.parent?n.parent.floor.id:n.children[0]?.floor.id||t.roots.find(x=>x!==n)?.floor.id||'';
  a.floors.splice(a.floors.indexOf(f),1);return true;
 });
 // The pressed button went away with its card: the keyboard continues on the floor that took its place.
 if(ok)focusLater(near?`[data-net="ed-add"][data-floor="${attr(near)}"]`:'[data-net="add-floor"]');
 return ok;
}
// The plain "add floor" of NetTools appends a floor without a parent. Once an architecture has explicit parents,
// that floor is hung under the floor before it, which is where a reader would expect it.
function adopt(a){
 if(!a||!Array.isArray(a.floors)||!a.floors.some(f=>typeof f?.parent==='string'))return false;
 let changed=false;a.floors.forEach((f,k)=>{if(f&&typeof f==='object'&&typeof f.parent!=='string'){f.parent=k>0&&a.floors[k-1]?.id||'';changed=true}});return changed;
}
// "The last Netrunner left": what was opened closes again and ICE that still exists goes back to waiting.
// Destroyed ICE and states the GM named "other" are the GM's own bookkeeping and are left alone.
function resetDefenses(a){
 if(!a||!Array.isArray(a.floors))return 0;const items=[];
 for(const f of a.floors)for(const e of Array.isArray(f?.entries)?f.entries:[]){
  if(!e||typeof e!=='object')continue;
  const was={floorId:f.id,entryId:e.id,type:e.type,state:e.state,rez:e.rez};
  if(e.type==='ice'){if(['waiting','pursuing','derezzed'].includes(e.state)&&(e.state!=='waiting'||e.rez!==e.maxRez)){e.state='waiting';e.rez=clamp(e.maxRez,0,999);items.push({...was,afterState:e.state,afterRez:e.rez})}}
  else if(e.state==='open'){e.state='closed';items.push({...was,afterState:e.state,afterRez:e.rez})}
 }
 resetUndo=items.length?{archId:a.id,items}:null;return items.length;
}
// The undo is only an undo while every record it would touch is still exactly as the reset left it. Once the GM
// has changed any of them (REZ, state, type, or removed it), putting the old values back would overwrite newer
// work with no way back, so the undo is refused as a whole, the same way the combat undo of NetTools is.
function undoEntries(a){
 if(!a||!resetUndo||resetUndo.archId!==a.id)return null;const found=[];
 for(const it of resetUndo.items){const e=a.floors?.find(f=>f?.id===it.floorId)?.entries?.find(x=>x?.id===it.entryId);if(!e||e.type!==it.type||e.state!==it.afterState||e.rez!==it.afterRez)return null;found.push([e,it])}
 return found;
}
function undoReset(a){
 const found=undoEntries(a);if(!found)return false;
 for(const [e,it] of found){e.state=it.state;e.rez=it.rez}
 resetUndo=null;return true;
}
function reset(){runId=null;moving=null;rollNote=null;resetUndo=null}
const running=a=>!!a&&runId!==null&&a.id===runId;
// The floors the Netrunner has stood on (architecture.seen): what is shown to a player in a room by default.
function remember(a,id){if(!Array.isArray(a.seen))a.seen=[];if(!a.seen.includes(id)){a.seen.push(id);if(a.seen.length>100)a.seen.shift()}}
const at=(a,t)=>t.nodes.get(a.runAt)||t.roots[0]||null;
const entriesOf=f=>Array.isArray(f?.entries)?f.entries.filter(e=>e&&typeof e==='object'):[];
// After a move, a step, a successful roll, an undo or a removal the button that was pressed is gone, so focus is
// placed by hand once app.js has redrawn; otherwise the keyboard would start again from the top of the page.
// With "card" the whole floor card of that button is brought on screen as well, for when the page changed height.
function focusLater(selector,card){try{if(typeof document==='undefined'||typeof setTimeout!=='function')return;setTimeout(()=>{try{const el=document.querySelector(selector);el?.focus?.();if(card)el?.closest?.('.net-ed-card')?.scrollIntoView?.({block:'nearest'})}catch{}},0)}catch{}}
const attr=x=>String(x).replace(/["\\]/g,'\\$&');

function chip(e,z){
 const state=z.states[e.state]||z.states.other;
 const text=e.type==='ice'?`${e.name||'Black ICE'} · REZ ${clamp(e.rez,0,999)} · ${state}`:`${e.name||z.types[e.type]||z.types.other}${LOCKS.includes(e.type)?' · DV '+clamp(e.dv,0,999):''} · ${state}`;
 return `<li class="net-ed-chip" data-state="${esc(e.state)}">${esc(text)}</li>`;
}
const chips=(f,z)=>{const list=entriesOf(f);return list.length?`<ul class="net-ed-chips">${list.map(e=>chip(e,z)).join('')}</ul>`:''};
// A floor with one floor below continues the same list, so a plain chain is not pushed sideways. Two or more
// floors below open one nested list each. Past four levels the shift stops, or a phone would scroll sideways.
function nest(roots,z,card){
 const chain=(n,level)=>{let h='';for(let x=n;x;){h+=`<li>${card(x)}</li>`;if(x.children.length===1)x=x.children[0];else{if(x.children.length>1)h+=fork(x.children,x,level);x=null}}return h};
 const fork=(children,parent,level)=>`<li class="net-ed-fork">${children.map(c=>`<ul class="net-ed-branch${level>=4?' flat':''}" aria-label="${esc(parent?z.branchOf(parent.depth):z.entrances)}">${chain(c,level+1)}</ul>`).join('')}</li>`;
 return roots.length===1?chain(roots[0],0):roots.length?fork(roots,null,0):'';
}
function toggleHtml(a,l){
 const z=T[lang(l)],run=running(a);
 return `<div class="net-ed-modes" role="group" aria-label="${esc(z.modes)}"><button type="button" class="btn ghost" data-net="run-mode-off" aria-pressed="${!run}">${esc(z.editor)}</button><button type="button" class="btn ghost" data-net="run-mode-on" aria-pressed="${run}">${esc(z.run)}</button></div>`;
}
function editHtml(a,l,floorBody){
 const z=T[lang(l)],t=tree(a);
 if(!t.list.length)return `<p class="net-note">${esc(z.empty)}</p><button type="button" class="btn ghost" data-net="add-floor">＋ ${esc(z.addFirst)}</button>`;
 const picked=moving&&moving.archId===a.id?t.nodes.get(moving.floorId):null;
 const tool=(op,n,glyph,text,full,off,more='')=>`<button type="button" class="btn ghost net-ed-btn" data-net="${op}" data-floor="${esc(n.floor.id)}" ${more} aria-label="${esc(`${z.floor} ${n.depth}: ${full}`)}" title="${esc(full)}"${off?' aria-disabled="true"':''}><span aria-hidden="true">${glyph}</span><span class="net-ed-txt">${esc(text)}</span></button>`;
 // While a target is being chosen every card shrinks to its heading: the record forms are long (thousands of
 // pixels on a phone), and the «Сюда» buttons must be reachable without scrolling or tabbing through them.
 // The instruction sits in the card being moved, next to the button that cancels, so it is where the eyes are.
 const card=n=>{
  const f=n.floor,row=n.parent?n.parent.children:t.roots,i=row.indexOf(n),label=String(f.label??''),mine=picked===n;
  let bar=tool('ed-up',n,'↑',z.up,z.upFull,!n.parent)+tool('ed-down',n,'↓',z.down,z.downFull,!n.children.length);
  if(row.length>1)bar+=tool('ed-prev',n,'⇡',z.prev,z.prevFull,i===0)+tool('ed-next',n,'⇣',z.next,z.nextFull,i===row.length-1);
  const stuck=!mine&&!t.list.some(x=>canMove(t,n,x));
  bar+=tool('ed-add',n,'＋',z.add,z.addFull,false)+tool('ed-move',n,'⇄',mine?z.moveCancel:z.move,mine?z.moveCancel:stuck?z.noTarget:z.moveFull,stuck,`aria-pressed="${mine}"`)+tool('remove-floor',n,'✕',z.remove,z.remove,false,`data-index="${n.index}"`);
  const target=picked&&canMove(t,picked,n)?`<button type="button" class="btn net-ed-here" data-net="ed-move-here" data-floor="${esc(f.id)}" aria-label="${esc(`${z.floor} ${n.depth}: ${z.hereFull}`)}">${esc(z.here)}</button>`:'';
  return `<article class="net-floor net-ed-card${mine?' is-moving':''}" aria-label="${esc(`${z.floor} ${n.depth}${label&&label!==String(n.depth)?' · '+label:''}`)}"><div class="net-ed-head"><h2 class="net-ed-title">${esc(z.floor)} ${n.depth}${label&&label!==String(n.depth)?` <span>· ${esc(label)}</span>`:''}</h2>${f.branch?`<p class="net-ed-branch-note">${esc(f.branch)}</p>`:''}${chips(f,z)}</div>${mine?`<p class="net-ed-pick" role="status">${esc(z.pick(n.depth))}</p>`:''}${picked&&!mine?'':`<div class="net-ed-bar" role="group" aria-label="${esc(`${z.structure}: ${z.floor} ${n.depth}`)}">${bar}</div>`}${target}${picked?'':typeof floorBody==='function'?floorBody(f,n.index):''}</article>`;
 };
 return `<p class="net-note">${esc(z.treeHelp)}</p><ul class="net-ed-tree${picked?' is-picking':''}">${nest(t.roots,z,card)}</ul>`;
}
function runEntry(e,j,n,z,a){
 const f=n.floor,ids=`data-floor="${esc(f.id)}" data-entry="${esc(e.id)}"`,ice=e.type==='ice',state=z.states[e.state]||z.states.other,name=e.name||(ice?'Black ICE':z.types[e.type]||z.types.other),lock=LOCKS.includes(e.type);
 let h=`<li class="net-run-entry"><div class="net-run-entry-head"><span class="net-run-type">${esc(z.types[e.type]||z.types.other)}</span><strong>${esc(name)}</strong>${lock?`<span class="net-run-dv">DV ${clamp(e.dv,0,999)}</span>`:''}<span class="net-ed-chip" data-state="${esc(e.state)}">${esc(state)}</span></div>`;
 if(e.notes)h+=`<p class="net-note net-run-notes">${esc(e.notes)}</p>`;
 if(ice){
  h+=`<p class="net-run-stats">PER ${clamp(e.per,0,999)} · SPD ${clamp(e.spd,0,999)} · ATK ${clamp(e.atk,0,999)} · DEF ${clamp(e.def,0,999)} · <span data-net-run-rez>REZ <strong>${clamp(e.rez,0,999)}</strong> / ${clamp(e.maxRez,0,999)}</span></p>`;
  h+=`<div class="net-actions"><button type="button" class="btn ghost" data-net="run-rez" data-delta="-1" ${ids} aria-label="${esc(z.rezDown+': '+name)}">−1</button><button type="button" class="btn ghost" data-net="run-rez" data-delta="1" ${ids} aria-label="${esc(z.rezUp+': '+name)}">+1</button><button type="button" class="btn ghost" data-net="run-ice" ${ids}>${esc(z.toCombat)}</button></div>`;
  h+=`<label class="field">${esc(z.state)}<select data-net-entry="state" data-index="${n.index}" data-entry="${j}">${['waiting','pursuing','derezzed','destroyed','other'].map(v=>`<option value="${v}" ${v===e.state?'selected':''}>${esc(z.states[v])}</option>`).join('')}</select></label>`;
 }else{
  h+=`<div class="net-actions">${lock&&e.state!=='open'?`<button type="button" class="btn" data-net="run-roll" ${ids} aria-label="${esc(z.roll(clamp(e.dv,0,999))+': '+name)}">${esc(z.roll(clamp(e.dv,0,999)))}</button>`:''}<button type="button" class="btn ghost" data-net="run-toggle" ${ids} aria-label="${esc((e.state==='open'?z.markClosed:z.markOpen)+': '+name)}">${esc(e.state==='open'?z.markClosed:z.markOpen)}</button></div>`;
 }
 if(rollNote&&rollNote.entryId===e.id&&rollNote.floorId===f.id)h+=`<div class="net-result" role="status">${esc(rollNote.text)}</div>`;
 h+=window.RoomNetrun?.entryHtml?.(a,f,e,j,n.index,z===T.ru?'ru':'en')||'';
 return h+'</li>';
}
function runHtml(a,l,info={}){
 const z=T[lang(l)],t=tree(a),n=at(a,t);
 let h=`${info.linkHtml||''}${info.roomHtml||''}<section class="card net-run"><div class="card-heading"><span>${esc(z.runTitle)}</span><span>${t.list.length}</span></div><p class="net-run-status"><strong>${esc(a.name||z.unnamed)}</strong> · Interface ${clamp(info.rank??a.rank,1,10)} · ${esc(z.modifier)} ${clamp(info.modifier??a.modifier,-99,99)}${info.runner?` · ${esc(info.runner)}`:''}</p><p class="net-run-status"><strong>${esc(z.actions)}: ${clamp(info.remaining,0,99)} / ${clamp(info.actions,0,99)}</strong></p><div class="net-actions"><button type="button" class="btn ghost" data-net="reset">${esc(z.newTurn)}</button><button type="button" class="btn ghost" data-net="spend">${esc(z.spend)}</button><button type="button" class="btn ghost" data-net="refund">${esc(z.refund)}</button></div>`;
 if(!n)return h+`<p class="net-note">${esc(z.empty)}</p></section>`;
 const trail=[];for(let x=n;x;x=x.parent)trail.unshift(x);
 h+=`<nav class="net-run-nav" aria-label="${esc(z.path)}"><p class="net-note" aria-hidden="true">${esc(z.path)}</p><ol class="net-run-path">${trail.map(x=>`<li><button type="button" class="btn ghost" data-net="run-go" data-floor="${esc(x.floor.id)}"${x===n?' aria-current="step"':''}>${esc(z.floor)} ${x.depth}</button></li>`).join('')}</ol></nav></section>`;
 const f=n.floor,label=String(f.label??''),list=entriesOf(f),real=Array.isArray(f.entries)?f.entries:[];
 h+=`<div class="net-run-cols"><section class="card net-run-floor" tabindex="-1" data-net-run-floor aria-label="${esc(`${z.floor} ${n.depth}`)}"><div class="card-heading"><span>${esc(z.here2)}</span><span>${n.depth} / ${t.list.reduce((m,x)=>Math.max(m,x.depth),1)}</span></div><h2 class="net-run-name">${esc(z.floor)} ${n.depth}${label&&label!==String(n.depth)?` · ${esc(label)}`:''}</h2>${f.branch?`<p class="net-ed-branch-note">${esc(f.branch)}</p>`:''}${window.RoomNetrun?.floorHtml?.(a,f,n.index,z===T.ru?'ru':'en')||''}`;
 h+=list.length?`<ul class="net-run-entries">${list.map(e=>runEntry(e,real.indexOf(e),n,z,a)).join('')}</ul>`:`<p class="net-note">${esc(z.emptyFloor)}</p>`;
 if(n.children.length&&list.some(e=>e.type==='password'&&e.state!=='open'))h+=`<p class="net-note net-run-locked">${esc(z.locked)}</p>`;
 h+=`<div class="net-run-move" role="group" aria-label="${esc(z.move2)}">${n.parent?`<button type="button" class="btn ghost" data-net="run-go" data-floor="${esc(n.parent.floor.id)}">${esc(z.goUp(n.parent.depth))}</button>`:''}${n.children.map(c=>`<button type="button" class="btn" data-net="run-go" data-floor="${esc(c.floor.id)}">${esc(z.goDown(c.depth)+(c.floor.branch?' · '+c.floor.branch:c.floor.label&&c.floor.label!==String(c.depth)?' · '+c.floor.label:''))}</button>`).join('')}${n.parent?`<button type="button" class="btn ghost" data-net="run-start">${esc(z.toStart)}</button>`:''}</div>${n.children.length?'':`<p class="net-note">${esc(z.deepest)}</p>`}</section>`;
 const line=x=>{const lab=String(x.floor.label??'');return `<button type="button" class="net-run-line" data-net="run-go" data-floor="${esc(x.floor.id)}"${x===n?' aria-current="location"':''}><span class="net-run-line-name">${x===n?'<span aria-hidden="true">▶ </span>':''}${esc(z.floor)} ${x.depth}${lab&&lab!==String(x.depth)?' · '+esc(lab):''}${x.floor.branch?' · '+esc(x.floor.branch):''}</span></button>${chips(x.floor,z)}`};
 h+=`<section class="card net-run-map"><div class="card-heading"><span>${esc(z.map)}</span><span>${t.list.length}</span></div><p class="net-note">${esc(z.mapHelp)}</p><ul class="net-ed-tree">${nest(t.roots,z,line)}</ul><p class="net-note">${esc(z.resetHelp)}</p><div class="net-actions"><button type="button" class="btn ghost" data-net="run-reset">${esc(z.resetAll)}</button>${undoEntries(a)?`<button type="button" class="btn ghost" data-net="run-reset-undo">${esc(z.undo)}</button>`:''}</div></section></div>`;
 return h;
}
// Returns what NetTools should pass on to app.js, or null when the press means nothing (unknown floor, a move
// that is not possible, a button marked aria-disabled). Such buttons stay focusable on purpose, so the keyboard
// does not lose its place; they are simply ignored here.
function handle(op,b,a,l,ctx){
 if(!a||typeof a!=='object'||!Array.isArray(a.floors)||typeof op!=='string')return null;
 if(b?.getAttribute?.('aria-disabled')==='true')return null;
 const z=T[lang(l)],id=b?.dataset?.floor,done={dirty:true,rerender:true};
 if(op==='run-mode-on'||op==='run-mode-off'){runId=op==='run-mode-on'?a.id:null;moving=null;rollNote=null;return {rerender:true}}
 if(op==='ed-add'){if(a.floors.length>=100)return {notify:z.limit};return addChild(a,id)?done:null}
 if(op==='ed-up')return swapUp(a,id)?done:null;
 if(op==='ed-down')return swapDown(a,id)?done:null;
 if(op==='ed-prev')return shift(a,id,-1)?done:null;
 if(op==='ed-next')return shift(a,id,1)?done:null;
 if(op==='ed-move'){
  const t=tree(a),n=t.nodes.get(id),mine=!!moving&&moving.archId===a.id&&moving.floorId===id;if(!n||(!mine&&!t.list.some(x=>canMove(t,n,x))))return null;
  // The cards change height when the forms are hidden or come back, so the pressed button is brought back into view.
  moving=mine?null:{archId:a.id,floorId:id};focusLater(`[data-net="ed-move"][data-floor="${attr(id)}"]`,!mine);return {rerender:true};
 }
 if(op==='ed-move-here'){if(!moving||moving.archId!==a.id)return null;const from=moving.floorId;if(!reparent(a,from,id))return null;moving=null;focusLater(`[data-net="ed-move"][data-floor="${attr(from)}"]`);return {...done,notify:z.moved}}
 // «Показать нетраннеру» (room-netrun.js): sharing, stopping and the proposals under the calculator's damage.
 if(op==='run-rn-share'||op==='run-rn-stop'||op==='run-rn-prop'||op==='run-rn-net')return window.RoomNetrun?.act?.(op,b,a,l)||null;
 const t=tree(a);
 if(op==='run-go'||op==='run-start'){
  const n=op==='run-start'?t.roots[0]:t.nodes.get(id);if(!n)return null;
  // The old "current floor" text field is kept in step, so the editor and older versions agree with the run,
  // but only while it holds what a step would have written (nothing, or the label or number of the floor the
  // Netrunner was on). Anything else is the GM's own wording and is left as it is.
  const was=at(a,t),own=typeof a.current==='string'?a.current:'';
  if(own===''||(was&&(own===String(was.floor.label||was.depth)||own===String(was.depth))))a.current=String(n.floor.label||n.depth).slice(0,200);
  if(op==='run-start')a.seen=[];a.runAt=n.floor.id;remember(a,n.floor.id);rollNote=null;focusLater('[data-net-run-floor]');return done;
 }
 if(op==='run-reset'){const count=resetDefenses(a);rollNote=null;return count?{...done,notify:z.resetDone}:{rerender:true,notify:z.resetNone}}
 if(op==='run-reset-undo'){
  if(!resetUndo||resetUndo.archId!==a.id)return null;
  if(!undoReset(a)){resetUndo=null;focusLater('[data-net="run-reset"]');return {rerender:true,notify:z.undoStale}}
  focusLater('[data-net="run-reset"]');return {...done,notify:z.undone};
 }
 const n=t.nodes.get(id),e=n&&entriesOf(n.floor).find(x=>x.id===b?.dataset?.entry);if(!e)return null;
 if(op==='run-rn-ok'||op==='run-rn-no')return window.RoomNetrun?.verdict?.(op==='run-rn-ok',a,n.floor,e,b?.dataset?.roll)||null;
 if(op==='run-toggle'){if(e.type==='ice')return null;e.state=e.state==='open'?'closed':'open';rollNote=null;return done}
 if(op==='run-roll'){
  if(!LOCKS.includes(e.type)||e.state==='open'||typeof window.NetTools?.check!=='function')return null;
  const lk=window.NetLink?.roll?.(a,e,ctx?.characters,l,`${z.types[e.type].toLowerCase()} · ${z.floor.toLowerCase()} ${n.depth}`);
  if(lk){
   if(!lk.ok)return {rerender:true,notify:lk.message};
   if(lk.beat){e.state='open';focusLater(`[data-net="run-toggle"][data-floor="${attr(n.floor.id)}"][data-entry="${attr(e.id)}"]`)}
   rollNote={floorId:n.floor.id,entryId:e.id,text:z.rolled({total:lk.total,dv:lk.dv},lk.beat)};return {dirty:true,rerender:true};
  }
  // Without a linked runner the desk's own NET Action counter is spent, as the sheet's counter is for a linked one (NetTools.deskCheck).
  // The roll goes to the shared feed when a room is open, so its label is made of fixed words and numbers only:
  // the GM's names and notes for the architecture must not reach the players this way.
  const dv=clamp(e.dv,0,999),u=typeof window.NetTools.deskCheck==='function'?window.NetTools.deskCheck(a,dv,z.rollLabel(z.types[e.type],n.depth,dv),lang(l)):null;
  if(u&&!u.ok)return {rerender:true,notify:u.message};
  const r=u?u.r:window.NetTools.check(a.rank,a.modifier,e.dv);
  if(!u)window.Rolls?.check?.(z.rollLabel(z.types[e.type],n.depth,r.dv),r,lang(l));
  if(r.success){e.state='open';focusLater(`[data-net="run-toggle"][data-floor="${attr(n.floor.id)}"][data-entry="${attr(e.id)}"]`)}rollNote={floorId:n.floor.id,entryId:e.id,text:z.rolled(r,r.success)};return {dirty:r.success||!!u,rerender:true};
 }
 if(e.type!=='ice')return null;
 if(op==='run-rez'){
  const delta=Number(b.dataset.delta);if(delta!==1&&delta!==-1)return null;// REZ does not grow past the maximum of the record. A record without a maximum, or one already above it, is the GM's own number and is not cut.
  const now=clamp(e.rez,0,999),max=clamp(e.maxRez,0,999),top=max>0?Math.max(max,now):999,next=clamp(now+delta,0,top);if(next===e.rez)return null;
  // REZ falling to 0 derezzes the ICE; REZ coming back above 0 on a derezzed one brings it back to waiting (the state reset does the same), so the chip, the map, the player's view and the reset always agree with the number. A destroyed ICE or the GM's own «other» state is not touched.
  e.rez=next;if(next===0&&(e.state==='waiting'||e.state==='pursuing'))e.state='derezzed';else if(next>0&&e.state==='derezzed')e.state='waiting';return done;
 }
 if(op==='run-ice'){focusLater('[data-net-combat="mode"]');return {rerender:true,ice:{key:encodeURIComponent(n.floor.id)+':'+encodeURIComponent(e.id),mode:e.state==='waiting'?'encounter':'ice'}}}
 return null;
}
window.NetEditor={tree,materialize,addChild,swapUp,swapDown,shift,reparent,removeFloor,adopt,resetDefenses,undoReset,running,toggleHtml,editHtml,runHtml,handle,reset};
})();
