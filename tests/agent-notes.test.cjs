const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'..','site','agent-notes.js'),'utf8');
const plain=x=>JSON.parse(JSON.stringify(x));

// One page with a fake document: it keeps the listeners, the focused selectors and the inner HTML of the blocks.
function load({lang='ru',scope='account',confirm}={}){
 const listeners={},focused=[],blocks={'#sheet-agent':{innerHTML:'',focus(){focused.push('#sheet-agent')}},'#sheet-agent-notes':{innerHTML:'',focus(){focused.push('#sheet-agent-notes')}},'[data-agent-list="contacts"]':{innerHTML:''},'[data-agent-chips]':{innerHTML:''},'[data-agent-list="notes"]':{innerHTML:''},'[data-field="notes"]':{value:'старая заметка'},'[data-agent-detail-title]':{textContent:''},'[data-agent-id="legacy"] .agent-note-text':{textContent:'',classList:{toggle(){}}}};
 const dialogs=[];
 const document={body:{appendChild(){}},createElement:()=>{const L={},el={L,innerHTML:'',attrs:{},removed:false,closed:false,fields:{title:{value:''},text:{value:''},pinned:{checked:false}},setAttribute(k,v){this.attrs[k]=v},addEventListener(k,f){L[k]=f},showModal(){},close(){this.closed=true},remove(){this.removed=true},querySelector(q){if(q==='form')return {elements:el.fields};const m=q.match(/\[name="(\w+)"\]/);return m&&el.fields[m[1]]?{focus(){}}:null}};dialogs.push(el);return el},addEventListener:(k,f)=>{listeners[k]=f},querySelector:s=>{if(blocks[s])return blocks[s];return {focus(){focused.push(s)}}}};
 const notices=[],actions=[];let saves=0,c=null,sc=scope;
 const window={document,confirm,crypto:{randomUUID:(()=>{let n=0;return()=>'id'+(++n)})()},App:{lang:()=>lang,active:()=>c,save:()=>{saves++},notify:m=>notices.push(m),notifyAction:(m,l,run)=>actions.push({m,l,run}),editScope:()=>sc}};
 const ctx={window,globalThis:window,Date,JSON,Math,Number,String,Array,Object,Set,Map};vm.createContext(ctx);vm.runInContext(src,ctx);
 return {dialogs,A:window.AgentNotes,T:window.AgentNotes._test,listeners,focused,notices,actions,blocks,saves:()=>saves,setChar:x=>{c=x},setScope:s=>{sc=s}};
}
const click=(h,action,id,extra={})=>{const row=id?{dataset:{agentId:id}}:null,b={dataset:{agentAction:action,...extra},closest:s=>s==='[data-agent-id]'?row:null};h.listeners.click({target:{closest:s=>s==='[data-agent-action]'?b:null}})};
const base=()=>({id:'c1',name:'Vee',notes:'старая заметка',extra:{}});

test('validators: notes, goals and contacts are cleaned, the rest of a save is left alone',()=>{
 const {A}=load();
 const out=plain(A.cleanExtra({other:1,notesList:[{id:'a',title:'T'.repeat(500),text:'x'.repeat(9000),pinned:'yes',at:'now'},{id:'a',title:'dup'},{title:'noid'},null,'x',{id:7},{id:'b',pinned:true,at:5}],goals:[{id:'g',text:'t',done:true,kind:'bogus',priority:'urgent',detail:7,doneAt:'31/02/2020'},{id:'h',text:'t',done:true,kind:'work',priority:'high',detail:'d',doneAt:'2026-05-04'},{id:'i',done:false,doneAt:'2026-05-04'}],contacts:[{id:'c',name:5,relation:'nope',at:-4},{id:'d',name:'N',relation:'ally',at:12.7}]}));
 assert.deepEqual(Object.keys(out).sort(),['contacts','goals','notesList']);
 assert.equal(out.notesList.length,2);assert.equal(out.notesList[0].title.length,120);assert.equal(out.notesList[0].text.length,4000);assert.equal(out.notesList[0].pinned,false);assert.equal('at' in out.notesList[0],false);
 assert.deepEqual(out.notesList[1],{id:'b',title:'',text:'',pinned:true,at:5});
 assert.deepEqual(out.goals[0],{id:'g',text:'t',done:true});
 assert.deepEqual(out.goals[1],{id:'h',text:'t',done:true,kind:'work',detail:'d',priority:'high',doneAt:'2026-05-04'});
 assert.deepEqual(out.goals[2],{id:'i',text:'',done:false},'a date without done is dropped');
 assert.equal(out.contacts[0].relation,'other');assert.equal(out.contacts[0].name,'');assert.equal('at' in out.contacts[0],false);assert.equal(out.contacts[1].at,12);
 assert.deepEqual(plain(A.cleanExtra({})),{});assert.deepEqual(plain(A.cleanExtra(null)),{});assert.deepEqual(plain(A.cleanExtra({notesList:'bad'})),{notesList:[]});
});
test('validators cap the lists: 100 notes, 60 goals and contacts',()=>{
 const {A}=load(),many=n=>Array.from({length:n},(_,i)=>({id:'i'+i}));
 const o=A.cleanExtra({notesList:many(150),goals:many(90),contacts:many(90)});
 assert.equal(o.notesList.length,100);assert.equal(o.goals.length,60);assert.equal(o.contacts.length,60);
});
test('old saves read the same: goals and contacts without the new fields',()=>{
 const {A}=load(),c={extra:{goals:[{id:'g',text:'долг',done:false}],contacts:[{id:'k',name:'Рэй',who:'фиксер',where:'бар',relation:'fixer',notes:'n'}]}};
 assert.deepEqual(plain(A.goals(c)),[{id:'g',text:'долг',done:false}]);
 assert.deepEqual(plain(A.contacts(c)),[{id:'k',name:'Рэй',who:'фиксер',where:'бар',relation:'fixer',notes:'n'}]);
 assert.deepEqual(plain(A.notesList(c)),[]);assert.deepEqual(plain(A.notesList({})),[]);assert.deepEqual(plain(A.contacts(null)),[]);
});
test('notes: pinned first, newest first, search in title and text',()=>{
 const {A}=load(),l=[{id:'a',title:'Старая',text:'',pinned:false,at:1},{id:'b',title:'Новая',text:'Адрес в Уотсоне',pinned:false,at:9},{id:'c',title:'Важная',text:'',pinned:true,at:2},{id:'d',title:'Без даты',text:'',pinned:false}];
 assert.deepEqual(A.sortNotes(l).map(n=>n.id),['c','b','a','d']);
 assert.deepEqual(A.filterNotes(l,'уотсон').map(n=>n.id),['b']);assert.deepEqual(A.filterNotes(l,'ВАЖНАЯ').map(n=>n.id),['c']);assert.equal(A.filterNotes(l,'  ').length,4);
 assert.deepEqual(A.filterNotes([{id:'x',title:'Ёж',text:''}],'еж').map(n=>n.id),['x'],'ё equals е');
});
test('commitNote: new, edit, empty, full, and the old field edited in place',()=>{
 const {A}=load(),c=base();
 assert.equal(A.commitNote(c,{id:'n1',title:'  Дело  ',text:'текст',pinned:true},100),'saved');
 assert.deepEqual(plain(c.extra.notesList),[{id:'n1',title:'Дело',text:'текст',pinned:true,at:100}]);
 assert.equal(A.commitNote(c,{id:'n1',title:'Дело 2',text:'x'.repeat(5000),pinned:false},200),'saved');assert.equal(c.extra.notesList[0].text.length,4000);assert.equal(c.extra.notesList[0].at,200);assert.equal(c.extra.notesList.length,1);
 assert.equal(A.commitNote(c,{id:'n2',title:' ',text:'  '}),'empty');assert.equal(c.extra.notesList.length,1);
 assert.equal(A.commitNote(c,{id:'old',legacy:true,text:'новый текст'}),'saved');assert.equal(c.notes,'новый текст');assert.equal(c.extra.notesList.length,1,'the old field is not a list item');
 const long='y'.repeat(25000),d=base();d.notes=long;A.commitNote(d,{legacy:true,text:long});assert.equal(d.notes.length,25000,'a long old note is not cut');
 const f={extra:{notesList:Array.from({length:100},(_,i)=>({id:'i'+i}))}};assert.equal(A.commitNote(f,{id:'new',title:'t',text:''}),'full');assert.equal(f.extra.notesList.length,100);
});
test('goals: open first by priority, done in their own list by date; done date set and cleared',()=>{
 const {A}=load(),gs=[{id:'a',text:'',done:false,priority:'low'},{id:'b',text:'',done:false},{id:'c',text:'',done:true,doneAt:'2026-01-01'},{id:'d',text:'',done:false,priority:'high'},{id:'e',text:'',done:true,doneAt:'2026-03-01'},{id:'f',text:'',done:false}];
 const s=A.splitGoals(gs);assert.deepEqual(s.open.map(g=>g.id),['d','b','f','a']);assert.deepEqual(s.done.map(g=>g.id),['e','c']);
 const g={id:'x',done:false};A.setGoalDone(g,true,new Date(2026,4,4));assert.deepEqual(g,{id:'x',done:true,doneAt:'2026-05-04'});A.setGoalDone(g,false);assert.deepEqual(g,{id:'x',done:false});
});
test('contacts: search, relation filter, three sorts',()=>{
 const {A}=load(),cs=[{id:'1',name:'Борис',who:'механик',where:'гараж',relation:'ally',notes:'',at:5},{id:'2',name:'Аня',who:'',where:'Afterlife',relation:'fixer',notes:'',at:9},{id:'3',name:'',who:'',where:'',relation:'enemy',notes:'долг',at:1},{id:'4',name:'Вика',who:'',where:'',relation:'ally',notes:''}];
 assert.deepEqual(plain(A.sortContacts(cs,'name','ru').map(x=>x.id)),['2','1','4','3'],'nameless last');
 assert.deepEqual(plain(A.sortContacts(cs,'relation','ru').map(x=>x.id)),['1','4','2','3']);
 assert.deepEqual(plain(A.sortContacts(cs,'newest','ru').map(x=>x.id)),['2','1','3','4'],'no date counts as oldest');
 assert.deepEqual(A.filterContacts(cs,{q:'afterlife'}).map(x=>x.id),['2']);assert.deepEqual(A.filterContacts(cs,{q:'долг'}).map(x=>x.id),['3']);assert.deepEqual(A.filterContacts(cs,{rel:'ally'}).map(x=>x.id),['1','4']);assert.deepEqual(A.filterContacts(cs,{rel:'ally',q:'вик'}).map(x=>x.id),['4']);
 assert.deepEqual(plain(A.relationCounts(cs)),{ally:2,fixer:1,enemy:1});
});
test('render: the old note is the first note «Заметки», own notes follow pinned first; everything is escaped',()=>{
 const h=load(),c=base();c.extra.notesList=[{id:'a',title:'<b>x</b>',text:'t',pinned:false,at:1},{id:'b',title:'Закреп',text:'',pinned:true,at:0}];h.setChar(c);
 const html=h.A.render(c);
 assert.match(html,/id="sheet-agent"/);assert.match(html,/id="sheet-agent-notes"/);
 assert.ok(html.indexOf('data-agent-id="legacy"')<html.indexOf('data-agent-id="b"')&&html.indexOf('data-agent-id="b"')<html.indexOf('data-agent-id="a"'));
 assert.match(html,/<h3>Заметки<\/h3>/);assert.match(html,/старая заметка/);assert.doesNotMatch(html,/<b>x<\/b>/);assert.match(html,/&lt;b&gt;x&lt;\/b&gt;/);
 const legacy=html.match(/<article[^>]*data-agent-id="legacy".*?<\/article>/s)[0];assert.doesNotMatch(legacy,/remove-note|pin-note/,'the old note cannot be deleted or pinned');
 const en=load({lang:'en'});en.setChar(c);assert.match(en.A.render(c),/<h3>Notes<\/h3>/);assert.match(en.A.render(c),/Add note/);
 const empty=load(),e=base();e.notes='';empty.setChar(e);assert.match(empty.A.render(e),/Пусто\. Откройте/);
});
test('render: a bad save does not break the page',()=>{
 const h=load(),c={id:'z',notes:42,extra:{notesList:[null,5,{id:'q',title:{},text:[]}],goals:'x',contacts:[{id:'c',name:{}}]}};h.setChar(c);
 assert.doesNotThrow(()=>h.A.render(c));assert.doesNotMatch(h.A.render(c),/undefined|\[object/);
});
test('pin and delete a note with undo; undo is refused after the sheet changed',()=>{
 const h=load(),c=base();c.extra.notesList=[{id:'a',title:'A',text:'',pinned:false,at:1},{id:'b',title:'B',text:'',pinned:false,at:2}];h.setChar(c);h.A.render(c);
 click(h,'pin-note','a');assert.equal(c.extra.notesList[0].pinned,true);assert.ok(h.saves()>0);assert.match(h.focused.at(-1),/data-agent-id="a".*pin-note/,'focus stays on the same button');
 click(h,'pin-note','a');assert.equal(c.extra.notesList[0].pinned,false);
 click(h,'remove-note','a');assert.deepEqual(c.extra.notesList.map(n=>n.id),['b']);assert.equal(h.actions.length,1);assert.equal(h.actions[0].l,'Вернуть');assert.match(h.focused.at(-1),/add-note/,'focus goes to a stable button');
 h.actions[0].run();assert.deepEqual(c.extra.notesList.map(n=>n.id),['a','b'],'back at its place');
 click(h,'remove-note','b');const undo=h.actions.at(-1);h.setScope('other');undo.run();assert.deepEqual(c.extra.notesList.map(n=>n.id),['a']);assert.match(h.notices.at(-1),/уже изменился/);
 h.setScope('account');h.setChar({id:'other'});undo.run();assert.deepEqual(c.extra.notesList.map(n=>n.id),['a'],'another sheet is open');
});
test('goal flow: add, finish (date, moves to done, focus kept), set priority, delete with undo',()=>{
 const h=load(),c=base();h.setChar(c);h.A.render(c);
 click(h,'add-goal');assert.equal(c.extra.goals.length,1);const id=c.extra.goals[0].id;assert.match(h.focused.at(-1),/data-agent-field="text"/);
 const change=(f,extra)=>{const el={value:'',checked:false,dataset:{agentField:f},...extra,closest:s=>s==='[data-agent-id]'?{dataset:{agentId:id},classList:{contains:k=>k==='agent-goal'}}:null};h.listeners.change({target:{closest:s=>s==='[data-agent-field]'?el:null}})};
 change('text',{value:'Вернуть долг'});assert.equal(c.extra.goals[0].text,'Вернуть долг');
 change('priority',{value:'high'});assert.equal(c.extra.goals[0].priority,'high');
 change('kind',{value:'work'});assert.equal(c.extra.goals[0].kind,'work');change('kind',{value:''});assert.equal('kind' in c.extra.goals[0],false);
 change('priority',{value:'evil'});assert.equal(c.extra.goals[0].priority,'mid','an unknown value falls back');
 change('done',{checked:true});assert.equal(c.extra.goals[0].done,true);assert.match(c.extra.goals[0].doneAt,/^\d{4}-\d\d-\d\d$/);assert.match(h.focused.at(-1),/data-agent-field="done"/);
 assert.match(h.blocks['#sheet-agent'].innerHTML,/data-agent-done-section/);
 change('done',{checked:false});assert.equal('doneAt' in c.extra.goals[0],false);
 click(h,'remove-goal',id);assert.equal(c.extra.goals.length,0);h.actions.at(-1).run();assert.equal(c.extra.goals.length,1);
});
test('contact flow: the detail card, search and chips filter the list, sort, add and delete with undo',()=>{
 const h=load(),c=base();c.extra.contacts=[{id:'k1',name:'Борис',who:'механик',where:'',relation:'ally',notes:''},{id:'k2',name:'Аня',who:'',where:'',relation:'fixer',notes:''}];h.setChar(c);
 const html=h.A.render(c);assert.match(html,/data-agent-search="contacts"/);assert.match(html,/data-agent-sort/);assert.match(html,/data-agent-rel="ally"/);assert.doesNotMatch(html,/data-agent-detail/);
 click(h,'open-contact','k1');assert.match(h.blocks['#sheet-agent'].innerHTML,/data-agent-detail/);assert.match(h.blocks['#sheet-agent'].innerHTML,/value="Борис"/);assert.match(h.focused.at(-1),/data-agent-detail.*name/);
 click(h,'close-contact','k1');assert.doesNotMatch(h.blocks['#sheet-agent'].innerHTML,/data-agent-detail/);assert.match(h.focused.at(-1),/data-agent-id="k1".*open-contact/,'focus returns to the row');
 const type=v=>h.listeners.input({target:{closest:s=>s==='[data-agent-search]'?{dataset:{agentSearch:'contacts'},value:v}:null}});
 type('аня');assert.match(h.blocks['[data-agent-list="contacts"]'].innerHTML,/Аня/);assert.doesNotMatch(h.blocks['[data-agent-list="contacts"]'].innerHTML,/Борис/);
 type('zzz');assert.match(h.blocks['[data-agent-list="contacts"]'].innerHTML,/нет\./);type('');
 click(h,'rel-chip',null,{agentRel:'ally'});assert.equal(h.T.ui.rel,'ally');const list=h.T.contactsHtml(c).match(/data-agent-list="contacts">.*?<\/div><\/div>/s)[0];assert.match(list,/Борис/);assert.doesNotMatch(list,/Аня/);
 click(h,'rel-chip',null,{agentRel:'bogus'});assert.equal(h.T.ui.rel,'all');
 h.listeners.change({target:{closest:s=>s==='[data-agent-sort]'?{value:'newest'}:null}});assert.equal(h.T.ui.sort,'newest');
 h.listeners.change({target:{closest:s=>s==='[data-agent-sort]'?{value:'weird'}:null}});assert.equal(h.T.ui.sort,'name');
 click(h,'add-contact');assert.equal(c.extra.contacts.length,3);const nu=c.extra.contacts[2];assert.ok(nu.at>0);assert.equal(h.T.ui.sel,nu.id);
 click(h,'remove-contact',nu.id);assert.equal(c.extra.contacts.length,2);assert.equal(h.T.ui.sel,'');h.actions.at(-1).run();assert.equal(c.extra.contacts.length,3);
});
test('switching to another character resets search, filter and the open card',()=>{
 const h=load(),a=base(),b={id:'c2',name:'Rook',notes:'',extra:{}};h.A.render(a);h.T.ui.cq='x';h.T.ui.sel='k';h.A.render(b);assert.equal(h.T.ui.cq,'');assert.equal(h.T.ui.sel,'');
});
test('note dialog markup: titled field for own notes, none for the old field, escaped',()=>{
 const h=load(),own=h.T.noteDialogHtml({id:'a',title:'"><i>',text:'</textarea>',pinned:true},false),old=h.T.noteDialogHtml({id:'legacy',title:'',text:'abc'},true);
 assert.match(own,/name="title"/);assert.match(own,/name="pinned" checked/);assert.match(own,/maxlength="4000"/);assert.doesNotMatch(own,/<i>/);assert.equal((own.match(/<\/textarea>/g)||[]).length,1);
 assert.doesNotMatch(old,/name="title"|name="pinned"/);assert.match(old,/maxlength="20000"/);assert.match(old,/<h2 id="agent-dialog-title">Заметки/);
});
test('printNotes: extra notes only, pinned first, empty ones skipped',()=>{
 const {A}=load(),c={notes:'old',extra:{notesList:[{id:'a',title:'',text:'',pinned:false},{id:'b',title:'B',text:'x',pinned:false,at:1},{id:'c',title:'C',text:'',pinned:true}]}};
 assert.deepEqual(plain(A.printNotes(c)),[{title:'C',text:'',pinned:true},{title:'B',text:'x',pinned:false}]);
});
test('files: both languages for every string, LF only, touch targets, registered in index.html',()=>{
 const m=src.match(/const T=\{ru:\{(.*?)\},\n en:\{(.*?)\}\};\nconst esc/s);assert.ok(m);
 const keys=s=>[...s.matchAll(/(?:^|,)([a-zA-Z]+):'/g)].map(x=>x[1]).sort();
 assert.deepEqual(keys(m[1]),keys(m[2]));
 const css=fs.readFileSync(path.join(__dirname,'..','site','agent-notes.css'),'utf8'),html=fs.readFileSync(path.join(__dirname,'..','site','index.html'),'utf8');
 for(const s of [src,css])assert.equal(s.includes('\r'),false);
 assert.match(css,/min-height: 44px/);assert.match(html,/href="agent-notes\.css"/);assert.match(html,/src="agent-notes\.js"/);
 const scripts=[...html.matchAll(/<script src="([^"]+)"/g)].map(x=>x[1]);assert.equal(scripts.at(-1),'app.js');
});

const ev=()=>({preventDefault(){}});
const submit=d=>d.L.submit(ev());
test('dialog: a new note is saved from the form, an empty one is not created, focus returns to the opener',()=>{
 const h=load(),c=base();h.setChar(c);h.A.render(c);
 click(h,'add-note');assert.equal(h.dialogs.length,1);const d=h.dialogs[0];assert.match(d.innerHTML,/name="title"/);
 d.fields.title.value='  Адрес  ';d.fields.text.value='Уотсон';d.fields.pinned.checked=true;submit(d);
 assert.equal(c.extra.notesList.length,1);assert.equal(c.extra.notesList[0].title,'Адрес');assert.equal(c.extra.notesList[0].pinned,true);assert.ok(h.saves()>0);assert.equal(d.removed,true);
 assert.match(h.focused.at(-1),/edit-note|add-note/);
 click(h,'add-note');const e=h.dialogs[1];submit(e);assert.equal(c.extra.notesList.length,1,'an empty note is not created');assert.equal(e.removed,true);
});
test('dialog: the old field is edited in place and the sheet textarea is refreshed',()=>{
 const h=load(),c=base();h.setChar(c);h.A.render(c);click(h,'edit-note','legacy');const d=h.dialogs[0];assert.doesNotMatch(d.innerHTML,/name="title"/);
 d.fields.text.value='новый текст';submit(d);assert.equal(c.notes,'новый текст');assert.equal(h.blocks['[data-field="notes"]'].value,'новый текст');assert.equal(c.extra.notesList,undefined);
});
test('dialog: stale sheet on save, a deleted note and a missing id never create a note',()=>{
 const h=load(),c=base();c.extra.notesList=[{id:'a',title:'A',text:'x',pinned:false,at:1}];h.setChar(c);h.A.render(c);
 click(h,'edit-note','a');const d=h.dialogs[0];d.fields.text.value='y';h.setScope('other');submit(d);assert.equal(c.extra.notesList[0].text,'x');assert.match(h.notices.at(-1),/уже изменился/);assert.equal(d.removed,true);
 h.setScope('account');click(h,'edit-note','a');const e=h.dialogs[1];e.fields.text.value='z';click(h,'remove-note','a');assert.equal(c.extra.notesList.length,0);
 submit(e);assert.equal(c.extra.notesList.length,0,'the deleted note is not re-created under its id');assert.match(h.notices.at(-1),/уже изменился/);
 h.actions.at(-1).run();assert.equal(c.extra.notesList[0].text,'x','undo brings the original text back');
 const n=h.dialogs.length;click(h,'edit-note','ghost');assert.equal(h.dialogs.length,n,'no blank dialog for an id that is gone');
});
test('dialog: typed text is not dropped silently (backdrop ignored, Escape and Cancel ask)',()=>{
 let answer=false,asked=0;const h=load({confirm:()=>{asked++;return answer}}),c=base();h.setChar(c);h.A.render(c);
 click(h,'add-note');const d=h.dialogs[0];d.fields.text.value='длинный текст';
 d.L.click({target:d});assert.equal(d.removed,false,'a click on the backdrop does nothing');assert.equal(asked,0);
 d.L.cancel(ev());assert.equal(d.removed,false);assert.equal(asked,1);
 d.L.click({target:{closest:q=>q.includes('cancel')?{}:null}});assert.equal(d.removed,false);assert.equal(asked,2);
 answer=true;d.L.cancel(ev());assert.equal(d.removed,true);assert.equal(c.extra.notesList,undefined);
 click(h,'add-note');const e=h.dialogs[1];e.L.cancel(ev());assert.equal(e.removed,true,'an untouched dialog closes without asking');assert.equal(asked,3);
});
test('stored data is cleaned when the sheet is shown: invalid rows, repeats and rows over the cap go, other keys stay',()=>{
 const h=load(),c=base();
 c.extra.notesList=[{id:'a',title:'T'.repeat(300),text:'x',keep:1},{id:'a'},null,...Array.from({length:150},(_,i)=>({id:'n'+i}))];
 c.extra.goals=[{id:'g',text:'t',done:false,doneAt:'2026-01-01',kind:'zzz',other:'k'}];c.extra.contacts='bad';h.setChar(c);
 h.A.render(c);
 assert.equal(c.extra.notesList.length,100);assert.equal(c.extra.notesList[0].title.length,120);assert.equal(c.extra.notesList[0].keep,1);
 assert.deepEqual(plain(c.extra.goals),[{id:'g',text:'t',done:false,other:'k'}]);assert.deepEqual(plain(c.extra.contacts),[]);assert.ok(h.saves()>0);
 const n=h.saves();h.A.render(c);assert.equal(h.saves(),n,'a clean save is not rewritten');
 const clean=base();clean.extra={goals:[{id:'g',text:'t',done:false}],contacts:[{id:'k',name:'A',who:'',where:'',relation:'ally',notes:''}]};h.setChar(clean);const m=h.saves();h.A.render(clean);assert.equal(h.saves(),m);
});
test('the search never matches the old note just by its label',()=>{
 const {A}=load();assert.equal(A.filterNotes([{legacy:true,title:'Заметки',text:'абв'}],'заметки').length,0);assert.equal(A.filterNotes([{legacy:true,title:'Заметки',text:'абв'}],'абв').length,1);
});
test('the old note card follows the sheet textarea while typing',()=>{
 const h=load(),c=base();h.setChar(c);h.A.render(c);
 h.listeners.input({target:{closest:q=>q==='[data-field="notes"]'?{value:'правка'}:null}});assert.equal(h.blocks['[data-agent-id="legacy"] .agent-note-text'].textContent,'правка');
});
test('contacts: the card sits under its row with the name as heading; editing updates in place without a repaint',()=>{
 const h=load(),c=base();c.extra.contacts=[{id:'k1',name:'Борис',who:'',where:'',relation:'ally',notes:''},{id:'k2',name:'Аня',who:'',where:'',relation:'fixer',notes:''}];h.setChar(c);h.A.render(c);
 click(h,'open-contact','k1');const html=h.T.contactsHtml(c);
 const at=html.indexOf('data-agent-id="k1"'),det=html.indexOf('data-agent-detail-title>Борис</h3>'),next=html.indexOf('class="agent-buttons"');assert.ok(at>0&&det>at&&det<next,'card follows its own row, inside the list');
 assert.equal((html.match(/data-agent-detail /g)||[]).length,1);
 h.blocks['[data-agent-list="contacts"]'].innerHTML='SENTINEL';
 const f={dataset:{agentField:'name'},value:'Борис Б',closest:q=>q==='[data-agent-field]'?f:q==='[data-agent-id]'?{dataset:{agentId:'k1'},classList:{contains:()=>false}}:null};
 h.listeners.change({target:f});assert.equal(c.extra.contacts[0].name,'Борис Б');assert.equal(h.blocks['[data-agent-list="contacts"]'].innerHTML,'SENTINEL','the list is not replaced on blur');assert.equal(h.blocks['[data-agent-detail-title]'].textContent,'Борис Б');
 h.T.ui.rel='enemy';assert.match(h.T.contactsHtml(c),/data-agent-detail-title>Борис/,'a card hidden by the filter still shows');
});
test('lifepath import stamps the date; the done section and goal details remember their state',()=>{
 const h=load(),c=base();c.extra.life={friends:['Рэй'],enemies:[{name:'Ким'}]};h.setChar(c);h.A.render(c);
 click(h,'from-life');assert.equal(c.extra.contacts.length,2);assert.ok(c.extra.contacts.every(x=>x.at>0));click(h,'from-life');assert.equal(c.extra.contacts.length,2);
 const det=(open,id)=>({matches:q=>q==='[data-agent-goal-more]'&&!!id||q==='[data-agent-done-section]'&&!id,open,closest:()=>({dataset:{agentId:id}})});
 h.listeners.toggle({target:det(true)});assert.equal(h.T.ui.openDone,true);h.listeners.toggle({target:det(false)});assert.equal(h.T.ui.openDone,false);
 h.listeners.toggle({target:det(true,'g1')});assert.ok(h.T.ui.goalOpen.has('g1'));h.listeners.toggle({target:det(false,'g1')});assert.equal(h.T.ui.goalOpen.has('g1'),false);
});
test('goal fields: kind, priority and detail are saved; the done date is shown in the note format',()=>{
 const h=load(),c=base();c.extra.goals=[{id:'g1',text:'a',done:false},{id:'g2',text:'b',done:true,doneAt:'2026-05-04'}];h.setChar(c);
 assert.match(h.A.render(c),/выполнено 04\.05\.2026/);assert.doesNotMatch(h.A.render(c),/2026-05-04/);
 const set=(field,value)=>{const f={dataset:{agentField:field},value,checked:false,closest:q=>q==='[data-agent-field]'?f:q==='[data-agent-id]'?{dataset:{agentId:'g1'},classList:{contains:k=>k==='agent-goal'}}:null};h.listeners.change({target:f})};
 set('kind','work');set('priority','high');set('detail','подробно');assert.equal(c.extra.goals[0].kind,'work');assert.equal(c.extra.goals[0].priority,'high');assert.equal(c.extra.goals[0].detail,'подробно');
 set('kind','');assert.equal('kind' in c.extra.goals[0],false);set('priority','bogus');assert.equal(c.extra.goals[0].priority,'mid');
});
test('css: no hard-coded priority colour, board buttons stay 44 px, labels stay visible on phones, headings are h2/h3',()=>{
 const css=fs.readFileSync(path.join(__dirname,'..','site','agent-notes.css'),'utf8');
 assert.doesNotMatch(css,/#ff9b8f/);assert.doesNotMatch(css,/prio-low[^}]*opacity/);assert.match(css,/html\.ui-native \.agent-card \.btn\.btn/);assert.doesNotMatch(css,/agent-mini-text \{ position/);
 assert.doesNotMatch(src,/<h4/);assert.match(src,/<h2 class="agent-h">/);
});
