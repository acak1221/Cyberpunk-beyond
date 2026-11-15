const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'..','site','char-tags.js'),'utf8');
const plain=x=>JSON.parse(JSON.stringify(x));

// A page small enough to hold in the hand: the bar, its chips, the status line, and one node per character card.
function load({app=true}={}){
 const listeners={},timers=[];
 const node=(extra={})=>({hidden:false,innerHTML:'',textContent:'',value:'',dataset:{},attrs:{},isConnected:true,focused:0,setAttribute(k,v){this.attrs[k]=v},focus(){this.focused++},...extra});
 const page={active:null,cards:[],buttons:[],status:node(),data:node(),groups:node(),body:node(),input:node({dataset:{charTags:'query'}})};
 const bar={querySelector:s=>s==='[data-char-tags-count]'?page.status:s==='datalist'?page.data:s==='[data-char-tags-groups]'?page.groups:s==='[data-char-tags-body]'?page.body:null,querySelectorAll:s=>s==='[data-char-tags]'?page.buttons:[]};
 const document={addEventListener(type,f){(listeners[type]||=[]).push(f)},get activeElement(){return page.active},
  querySelector:s=>s==='[data-char-tags-root]'?(page.noBar?null:bar):s==='[data-char-tags="query"]'?page.input:s==='[data-char-tags="folder-all"]'?page.buttons.find(b=>b.dataset.charTags==='folder-all')||null:null,
  querySelectorAll:s=>s==='[data-character-card]'?page.cards:[]};
 const saved=[],notices=[],state={view:'characters',lang:'ru',characters:[]};let renders=0,canEdit=true;
 const window={document};
 if(app)window.App={getState:()=>state,save:()=>saved.push(plain(state.characters)),render:()=>{renders++},notify:m=>notices.push(m),archive:{canEdit:()=>canEdit}};
 const ctx={window,setTimeout:(f,ms)=>{timers.push({f,ms});return timers.length},clearTimeout:id=>{if(timers[id-1])timers[id-1].f=()=>{}},console};
 vm.runInNewContext(source,ctx);
 const C=window.CharTags;
 // A card as apply() and commit() see it: the article, the box inside it, the line, and the two fields.
 const addCard=c=>{const line=node(),box={dataset:{charTagsCard:c.id},querySelector:s=>s==='[data-char-tags-line]'?line:null};
  const el=node({dataset:{characterCard:c.id},inside:[],querySelector:s=>s==='[data-char-tags-card]'?box:null,contains(n){return this.inside.includes(n)}});
  const field=name=>{const f=node({dataset:{charTagsField:name,charTagsId:c.id},closest:s=>s==='[data-char-tags-card]'?box:null});el.inside.push(f);return f};
  const card={el,box,line,folder:field('folder'),tags:field('tags')};page.cards.push(el);return card};
 const button=(kind,value='')=>{const b=node({dataset:{charTags:kind},value,closest:s=>s==='button[data-char-tags]'||s==='#app'||s==='button,summary,label,a'?b:null});page.buttons.push(b);return b};
 const fire=(type,e)=>{for(const f of listeners[type]||[])f(e)};
 return {C,page,state,saved,notices,timers,listeners,addCard,button,fire,renders:()=>renders,pause:()=>{canEdit=false},window};
}
const who=(id,name,extra)=>({id,name,role:'solo',...(extra===undefined?{}:{extra})});
const C=load().C;

test('clean: one tidy line, no control or direction characters, cut without splitting a character',()=>{
 assert.equal(C.clean('  Банда \t Шестой\n улицы  '),'Банда Шестой улицы');
 assert.equal(C.clean('a\u0000b\u202Ec\u2066d\u200Fe\u2028f'),'a b c d e f');
 assert.equal(C.clean('\u202E\u200B'),'');
 for(const x of [undefined,null,5,{},[],true,()=>1])assert.equal(C.clean(x),'');
 assert.equal(C.clean('x'.repeat(100)).length,40);
 const cut=C.clean('x'.repeat(39)+'\uD83D\uDE00tail');assert.equal(cut,'x'.repeat(39),'half of an emoji is not kept');
 assert.equal(C.clean('x'.repeat(38)+'\uD83D\uDE00tail'),'x'.repeat(38)+'\uD83D\uDE00');
 assert.equal(C.clean('abcdef',3),'abc');
 assert.equal(C.clean('e\u0301'),'\u00E9','the same letter typed two ways is stored one way');
});
test('clean: nothing invisible gets through, and a text with nothing to see is empty',()=>{
 // An Arabic letter mark, the Mongolian vowel separator, a soft hyphen, a tag character, half of a pair: none of them stays.
 for(const hidden of ['\u061C','\u180E','\u00AD','\u{E0001}','\u{E0041}','\uFFF9','\u2061','\uD800','\uDC00'])assert.equal(C.clean('a'+hidden+'b'),'a b',hidden.codePointAt(0).toString(16));
 // Letters and signs that draw nothing, alone or together with spaces and joiners.
 for(const blank of ['\u3164','\u115F','\u1160','\uFFA0','\u2800','\u3164\u2800 \u3164','\u200D','\u200C\u200D','\u0301','\uFE0F','\u3000','\u00A0\u2003'])assert.equal(C.clean(blank),'',[...blank].map(x=>x.codePointAt(0).toString(16)).join(' '));
 assert.equal(C.clean('a\u3164b'),'a b');assert.equal(C.clean('\u2800Банда\u2800'),'Банда');
 // What is written with joiners stays as it was written.
 const family='\u{1F468}\u200D\u{1F469}\u200D\u{1F467}',persian='\u0645\u06CC\u200C\u062E\u0648\u0627\u0647\u0645';
 assert.equal(C.clean(family),family);assert.equal(C.clean(persian),persian);assert.equal(C.clean('\u{1F600}'),'\u{1F600}');assert.equal(C.clean('\u2764\uFE0F'),'\u2764\uFE0F');
 // Two folders that look the same are one folder, and an invisible one is none.
 assert.equal(C.key('a\u200Cb'),C.key('ab'));assert.equal(C.key('Бан\u061Cда'),C.key('бан да'));
 const idx=C.index([who('a','A',{folder:'\u3164',tags:['\u2800','\u{E0020}','ok']}),who('b','B',{folder:'x\u200Dy'}),who('c','C',{folder:'xy'})]);
 assert.deepEqual(plain(idx.folders.map(f=>[f.key,f.count])),[['xy',2]]);assert.deepEqual(plain(idx.tags.map(x=>x.key)),['ok']);assert.equal(idx.none,1);
 assert.equal(C.set(who('d','D'),{folder:'\u3164'}),false,'nothing to see, nothing to store');
});
test('key: spellings that differ by case or width are one folder',()=>{
 assert.equal(C.key('Банда'),C.key('  банда '));assert.equal(C.key('\uFF21\uFF22'),'ab');assert.notEqual(C.key('Банда'),C.key('Банды'));assert.equal(C.key(7),'');
});
test('parseTags: commas, semicolons and new lines separate; # is dropped; repeats, empties and extras go',()=>{
 assert.deepEqual(plain(C.parseTags('стрелок, #долг;  ##нетраннер\nбосс')),['стрелок','долг','нетраннер','босс']);
 assert.deepEqual(plain(C.parseTags('Долг, долг, ДОЛГ, , #, ;')),['Долг'],'the first spelling stays');
 assert.equal(C.parseTags(Array.from({length:20},(_,i)=>'t'+i).join(',')).length,8);
 assert.equal(C.parseTags('y'.repeat(60))[0].length,24);
 for(const x of [undefined,null,5,{},['a']])assert.deepEqual(plain(C.parseTags(x)),[]);
});
test('read: whatever is stored, the answer is a string and a list of strings',()=>{
 const empty={folder:'',tags:[]};
 for(const c of [undefined,null,5,'x',[],{},{extra:null},{extra:[]},{extra:'x'},{extra:{folder:5,tags:'a,b'}},{extra:{folder:{a:1},tags:{0:'a',length:1}}},{extra:{folder:['a'],tags:[1,null,{},['x'],'']}}])assert.deepEqual(plain(C.read(c)),empty);
 assert.deepEqual(plain(C.read({extra:{folder:'  Банда  ',tags:['a',5,'#b','a','c,d',null]}})),{folder:'Банда',tags:['a','b','c d']});
 assert.equal(C.read({extra:{tags:Array.from({length:100000},(_,i)=>'t'+i)}}).tags.length,8,'a huge list is not walked to the end');
 const trap={extra:{get folder(){return 'ok'},tags:new Proxy([],{get:(t,k)=>k==='length'?3:k==='0'?'a':Reflect.get(t,k)})}};
 assert.equal(C.read(trap).folder,'ok');
});
test('set: writes clean values, removes emptied keys, makes extra only when needed, reports a real change only',()=>{
 const c=who('a','Vee',{items:[{id:'i1',name:'Radio'}],future:{nested:['kept']},uid:'a',updatedAt:5}),rest=()=>{const {folder,tags,...x}=c.extra;return JSON.stringify(x)},before=rest();
 assert.equal(C.set(c,{folder:'  Банда  '}),true);assert.equal(c.extra.folder,'Банда');assert.equal('tags' in c.extra,false);
 assert.equal(C.set(c,{folder:'Банда'}),false,'the same folder is not a change');
 assert.equal(C.set(c,{tags:'#долг, стрелок'}),true);assert.deepEqual(plain(c.extra.tags),['долг','стрелок']);assert.equal(c.extra.folder,'Банда','a field left out is not touched');
 assert.equal(C.set(c,{tags:['долг','стрелок']}),false);assert.equal(C.set(c,{tags:'долг,стрелок'}),false);
 assert.equal(C.set(c,{folder:'',tags:''}),true);assert.equal('folder' in c.extra,false);assert.equal('tags' in c.extra,false);
 assert.equal(C.set(c,{folder:'',tags:[]}),false);assert.equal(rest(),before,'nothing else in extra moved');
 const bare=who('b','Rook');assert.equal(C.set(bare,{folder:'',tags:''}),false);assert.equal('extra' in bare,false,'nothing to write, no extra made');
 assert.equal(C.set(bare,{folder:'X'}),true);assert.deepEqual(plain(bare.extra),{folder:'X'});
 const odd=who('c','Odd',{folder:7,tags:'x'});assert.equal(C.set(odd,{folder:'',tags:''}),true,'a wrong shape is cleared');assert.deepEqual(plain(odd.extra),{});
 for(const bad of [who('d','D',[]),who('e','E','text'),who('f','F',null)]){const was=JSON.stringify(bad);assert.equal(C.set(bad,{folder:'X'}),false);assert.equal(JSON.stringify(bad),was)}
 assert.equal(C.set(null,{folder:'X'}),false);assert.equal(C.set(who('g','G'),null),false);
});
test('keep: a new sheet brings its folder and tags, an update never changes how the receiver filed their copy',()=>{
 const mine=()=>({folder:'Мои',tags:['долг','босс']});
 let x={items:[]};C.keep(x,mine());assert.deepEqual(plain(x),{items:[],folder:'Мои',tags:['долг','босс']});
 // Whatever the incoming sheet says about a folder or tags (another folder, an empty one, one field only, junk), the local ones stay, both of them.
 for(const came of [{folder:' Чужая ',tags:['#a','a','b']},{folder:''},{folder:'Только папка'},{tags:['x']},{tags:[]},{tags:null},{folder:{a:1}},{folder:7,tags:'nope'},{folder:null,tags:null}]){
  x={n:1,...came};C.keep(x,mine());assert.deepEqual(plain(x),{n:1,folder:'Мои',tags:['долг','босс']},JSON.stringify(came));
 }
 // A local copy that is in no folder stays in no folder.
 x={n:1,folder:'Чужая',tags:['a']};C.keep(x,{uid:'u'});assert.deepEqual(plain(x),{n:1});
 x={n:1,folder:'Чужая'};C.keep(x,{folder:{},tags:[5]});assert.deepEqual(plain(x),{n:1},'wrong shapes in the old copy are not carried over');
 x={n:1,folder:'Чужая'};C.keep(x,null,true);assert.deepEqual(plain(x),{n:1},'an update of a copy without extra is still an update');
 // A new sheet: what it brought is kept, cleaned and cut to size.
 x={folder:' Чужая ',tags:['#a','a','b']};C.keep(x,undefined);assert.deepEqual(plain(x),{folder:'Чужая',tags:['a','b']});
 x={folder:' Чужая '};C.keep(x,{folder:'Мои'},false);assert.deepEqual(plain(x),{folder:'Чужая'});
 x={folder:7,tags:'nope',n:1};C.keep(x,undefined);assert.deepEqual(plain(x),{n:1},'wrong shapes are removed, not replaced');
 x={n:1};C.keep(x,undefined);assert.deepEqual(plain(x),{n:1});
 x={tags:Array.from({length:50},(_,i)=>'t'.repeat(40)+i)};C.keep(x,null);assert.equal(x.tags.length,1,'cut to 24 characters they are all one tag');assert.equal(x.tags[0].length,24);
 for(const a of [null,undefined,5,'x',[]])for(const b of [null,undefined,5,[],{}])for(const u of [undefined,true,false])assert.doesNotThrow(()=>C.keep(a,b,u));
});
test('index: counts by folder and tag without regard to case, sorted by name',()=>{
 const list=[who('a','A',{folder:'Яма',tags:['долг','Босс']}),who('b','B',{folder:'банда',tags:['ДОЛГ']}),who('c','C',{folder:'Банда'}),who('d','D'),null,'x',who('e','E',{folder:5})];
 const idx=plain(C.index(list));
 assert.deepEqual(idx.folders,[{key:'банда',label:'банда',count:2},{key:'яма',label:'Яма',count:1}]);
 assert.deepEqual(idx.tags,[{key:'босс',label:'Босс',count:1},{key:'долг',label:'долг',count:2}]);
 assert.equal(idx.none,2);assert.equal(idx.total,5);
 assert.deepEqual(plain(C.index(undefined)),{folders:[],tags:[],none:0,total:0});
});
test('matches: words of the search across name, folder and tags; one folder; all picked tags',()=>{
 const v=who('a','Vee Смит',{folder:'Банда Шестой',tags:['долг','стрелок']}),bare=who('b','');
 assert.equal(C.matches(v,{}),true);assert.equal(C.matches(v,null),true);
 for(const q of ['vee','СМИТ vee','шест','долг ve','  стрел  '])assert.equal(C.matches(v,{query:q}),true,q);
 for(const q of ['rook','vee босс'])assert.equal(C.matches(v,{query:q}),false,q);
 assert.equal(C.matches(v,{folder:C.key('банда шестой')}),true);assert.equal(C.matches(v,{folder:'другая'}),false);assert.equal(C.matches(v,{folder:''}),false);
 assert.equal(C.matches(bare,{folder:''}),true,'the «no folder» choice');assert.equal(C.matches(bare,{folder:null}),true);
 assert.equal(C.matches(v,{tags:new Set(['долг','стрелок'])}),true);assert.equal(C.matches(v,{tags:new Set(['долг','босс'])}),false,'tags combine with AND');assert.equal(C.matches(v,{tags:['долг']}),true);
 assert.equal(C.matches(bare,{query:''}),true);assert.equal(C.matches(bare,{query:'без'}),false,'the placeholder name of an unnamed sheet is not searched');
 assert.equal(C.matches(null,{}),false);assert.equal(C.matches({name:5,extra:'x'},{query:'5'}),false);
 // A tag is drawn as "#долг" on the page, so that is how it gets typed into the search.
 for(const q of ['#долг','#ДОЛГ vee','##стрел','# долг','#шест'])assert.equal(C.matches(v,{query:q}),true,q);
 assert.equal(C.matches(v,{query:'#босс'}),false);assert.equal(C.matches(v,{query:'#'}),true,'a lone # asks for nothing');
});
test('toolbar: search, labelled chip groups, a status line and the folder list; nothing to filter, nothing shown',()=>{
 const h=load(),list=[who('a','A',{folder:'Банда',tags:['долг']}),who('b','B'),who('c','C',{folder:'банда'})];
 const html=h.C.toolbar(list,'ru','me');
 assert.match(html,/^<div class="char-tags-bar" data-char-tags-root>/);
 assert.match(html,/<datalist id="char-tags-folders"><option value="Банда"><\/option><\/datalist>/);
 assert.match(html,/<section[^>]*aria-label="Поиск и фильтр персонажей">/);assert.doesNotMatch(html,/<section[^>]* hidden/);
 assert.match(html,/<input type="search" data-char-tags="query" maxlength="80"[^>]*value="">/);
 assert.match(html,/role="group" aria-label="Папки">.*data-char-tags="folder-all" value="" aria-pressed="true"><span>Все<\/span><b>3<\/b>.*data-char-tags="folder" value="банда" aria-pressed="false"><span>Банда<\/span><b>2<\/b>.*data-char-tags="folder-none" value="" aria-pressed="false"><span>Без папки<\/span><b>1<\/b>/);
 assert.match(html,/role="group" aria-label="Метки">.*data-char-tags="tag" value="долг" aria-pressed="false"><span>#долг<\/span><b>1<\/b>/);
 assert.match(html,/<p data-char-tags-count role="status" aria-live="polite"><\/p>/);assert.match(html,/data-char-tags="reset" hidden>Сбросить фильтр</);
 assert.doesNotMatch(html,/data-(action|field|stat|skill)=/,'nothing app.js would take for its own control');
 const en=h.C.toolbar(list,'en','me');assert.match(en,/aria-label="Folders"/);assert.match(en,/Search by name/);assert.match(en,/No folder/);
 const two=h.C.toolbar([who('a','A'),who('b','B')],'ru','me');assert.doesNotMatch(two,/<section[^>]* hidden/);assert.doesNotMatch(two,/role="group"/,'no chips without folders and tags');
 const one=h.C.toolbar([who('a','A')],'ru','me');assert.match(one,/<section[^>]* hidden>/);assert.match(one,/<datalist id="char-tags-folders"><\/datalist>/);
 assert.doesNotMatch(h.C.toolbar([who('a','A',{folder:'X'}),who('b','B',{folder:'x'})],'ru','me'),/folder-none/,'«Без папки» only when someone has no folder');
 assert.doesNotThrow(()=>h.C.toolbar(null,'ru','me'));
});
test('toolbar and card: every piece of user text is escaped, everywhere it lands',()=>{
 const h=load(),evil='<img src=x onerror=1>',c=who('a"><b>','<i>Vee</i>"',{folder:evil,tags:['"quoted"','<b>&']});
 const html=h.C.toolbar([c,who('b','B')],'ru','me')+h.C.card(c,'ru');
 assert.doesNotMatch(html,/<img|<i>|<b>&|"quoted"|a"><b>/);
 assert.match(html,/<option value="&lt;img src=x onerror=1&gt;">/);assert.match(html,/value="&lt;img src=x onerror=1&gt;"/);
 assert.match(html,/aria-label="Папка и метки: &lt;i&gt;Vee&lt;\/i&gt;&quot;"/);assert.match(html,/#&quot;quoted&quot;/);assert.match(html,/data-char-tags-card="a&quot;&gt;&lt;b&gt;"/);
});
test('card: a line only when there is something to say, an editor with the stored values and a name of its own',()=>{
 const h=load();h.C.toolbar([],'ru','me');
 const bare=h.C.card(who('a','Vee'),'ru');
 assert.match(bare,/<p class="char-tags-line" data-char-tags-line hidden><\/p>/);assert.match(bare,/<summary class="btn text-button" aria-label="Папка и метки: Vee">/);
 assert.match(bare,/data-char-tags-field="folder" data-char-tags-id="a" maxlength="40" list="char-tags-folders"[^>]*value=""/);
 const full=h.C.card(who('b','Rook',{folder:' Банда ',tags:['#долг','босс']}),'en');
 assert.match(full,/<p class="char-tags-line" data-char-tags-line><span class="char-tags-folder"><span class="char-tags-sr">Folder: <\/span>.*Банда<\/span><span class="char-tags-sr">Tags: <\/span><span class="char-tags-tag">#долг<\/span> <span class="char-tags-tag">#босс<\/span><\/p>/);
 assert.match(full,/data-char-tags-field="tags"[^>]*value="долг, босс"/);assert.match(full,/aria-label="Folder and tags: Rook"/);
 const ids=[bare,full].map(x=>/aria-describedby="(char-tags-hint-\d+)"/.exec(x)[1]);assert.notEqual(ids[0],ids[1]);for(const [i,x] of [bare,full].entries())assert.ok(x.includes(`id="${ids[i]}"`));
 assert.match(h.C.card(who('c',''),'ru'),/aria-label="Папка и метки: Без имени"/);
 assert.doesNotMatch(full,/data-(action|field|stat|skill)=/);
 for(const bad of [null,{},{id:5},{id:''}])assert.equal(h.C.card(bad,'ru'),'');
});
test('apply: hides what does not pass, never the card that holds the focus, and keeps chips, status and reset in step',()=>{
 const h=load(),list=[who('a','Vee',{folder:'Банда',tags:['долг']}),who('b','Rook',{folder:'Корпы'}),who('c','Jackie')];
 h.C.toolbar(list,'ru','me');const cards=list.map(h.addCard),all=h.button('folder-all'),gang=h.button('folder','банда'),none=h.button('folder-none'),debt=h.button('tag','долг'),reset=h.button('reset');reset.hidden=true;
 const overview={dataset:{characterCard:'a'},hidden:false,querySelector:()=>null,contains:()=>false};h.page.cards.push(overview);
 const shown=()=>cards.map(c=>c.el.hidden?'-':'+').join('');
 h.C.apply(h.window.document,'ru');assert.equal(shown(),'+++');assert.equal(h.page.status.textContent,'');assert.equal(reset.hidden,true);assert.equal(all.attrs['aria-pressed'],'true');
 h.C._test.press(gang);assert.equal(shown(),'+--');assert.equal(h.page.status.textContent,'Показано 1 из 3');assert.equal(reset.hidden,false);assert.equal(gang.attrs['aria-pressed'],'true');assert.equal(all.attrs['aria-pressed'],'false');
 assert.equal(overview.hidden,false,'a card without the folder line is not this module\'s to hide');
 h.C._test.press(gang);assert.equal(shown(),'+++','the picked chip pressed again shows everyone');
 h.C._test.press(none);assert.equal(shown(),'--+');h.C._test.press(all);assert.equal(shown(),'+++');
 h.C._test.press(debt);assert.equal(shown(),'+--');assert.equal(debt.attrs['aria-pressed'],'true');
 h.page.active=cards[1].folder;h.C.apply(h.window.document,'en');assert.equal(shown(),'++-','the card being edited stays');assert.equal(h.page.status.textContent,'Showing 2 of 3');
 h.page.active=null;h.C._test.press(debt);
 h.page.input.value='nobody';h.C._test.typed(h.page.input);assert.equal(shown(),'---');assert.equal(h.page.status.textContent,'Никого не найдено. Измените запрос или сбросьте фильтр.');
 h.page.input.value='ROOK';h.fire('input',{target:{...h.page.input,matches:s=>s==='[data-char-tags="query"]'}});assert.equal(shown(),'-+-');
 h.fire('click',{target:reset});assert.equal(shown(),'+++');assert.equal(reset.hidden,true);assert.equal(h.page.input.value,'');assert.equal(all.focused,1,'the focus moves off the button that hides itself');
 assert.deepEqual(plain(h.C._test.state()),{owner:'me',query:'',folder:null,tags:[],open:[],held:false,pending:false});
 h.page.noBar=true;assert.doesNotThrow(()=>h.C.apply(h.window.document,'ru'));assert.doesNotThrow(()=>h.C.apply(null,'ru'));
});
test('the filter survives a redraw and a change of language, and starts clean for another owner',()=>{
 const h=load(),list=[who('a','Vee',{folder:'Банда',tags:['долг']}),who('b','Rook',{tags:['босс']})];
 h.C.toolbar(list,'ru','me');h.C._test.press(h.button('folder','банда'));h.C._test.press(h.button('tag','долг'));h.page.input.value='ve';h.C._test.typed(h.page.input);
 const en=h.C.toolbar(list,'en','me');
 assert.match(en,/data-char-tags="folder" value="банда" aria-pressed="true"/);assert.match(en,/data-char-tags="tag" value="долг" aria-pressed="true"/);assert.match(en,/value="ve"/);assert.match(en,/Showing 1 of 2/);assert.match(en,/data-char-tags="reset">Reset filter/);
 // The folder and the tag are gone from every sheet: the choice goes with them, the typed text stays.
 delete list[0].extra.folder;delete list[0].extra.tags;h.C.toolbar(list,'ru','me');
 assert.deepEqual(plain(h.C._test.state()).tags,[]);assert.equal(h.C._test.state().folder,null);assert.equal(h.C._test.state().query,'ve');
 h.C.toolbar(list,'ru','someone else');assert.equal(h.C._test.state().query,'');assert.equal(h.C._test.state().owner,'someone else');
 h.page.input.value='x';h.C._test.typed(h.page.input);h.C.reset();assert.equal(h.C._test.state().query,'');
});
test('commit: files the sheet, saves once, repaints in place and never redraws the page',()=>{
 const h=load(),a=who('a','Vee',{uid:'a'}),b=who('b','Rook');h.state.characters=[a,b];
 h.C.toolbar(h.state.characters,'ru','me');const ca=h.addCard(a);h.addCard(b);
 ca.folder.value='  Банда  ';ca.folder.matches=s=>s==='[data-char-tags-field]';h.fire('change',{target:ca.folder});
 assert.equal(a.extra.folder,'Банда');assert.equal(ca.folder.value,'Банда','the field shows what was stored');assert.equal(h.saved.length,1);assert.equal(h.renders(),0);
 assert.match(ca.line.innerHTML,/Банда/);assert.equal(ca.line.hidden,false);
 assert.match(h.page.groups.innerHTML,/data-char-tags="folder" value="банда"/);assert.match(h.page.data.innerHTML,/<option value="Банда">/);assert.equal(h.page.body.hidden,false);
 ca.tags.value='#долг, стрелок, долг';assert.equal(h.C._test.commit(ca.tags),true);assert.deepEqual(plain(a.extra.tags),['долг','стрелок']);assert.equal(ca.tags.value,'долг, стрелок');assert.equal(h.saved.length,2);
 assert.equal(h.C._test.commit(ca.tags),false,'nothing changed, nothing saved');assert.equal(h.saved.length,2);
 ca.folder.value='';ca.tags.value='';h.C._test.commit(ca.folder);h.C._test.commit(ca.tags);assert.deepEqual(plain(a.extra),{uid:'a'});assert.equal(ca.line.hidden,true);assert.equal(h.page.groups.innerHTML,'');
});
test('commit refuses a stale page: another view, a detached field, no such character, two of them, a paused store',()=>{
 for(const kind of ['view','detached','missing','twice','paused','field','noapp']){
  const h=load({app:kind!=='noapp'}),a=who('a','Vee',{folder:'Было'});h.state.characters=kind==='missing'?[]:kind==='twice'?[a,{...a}]:[a];
  h.C.toolbar([a],'ru','me');const ca=h.addCard(a);ca.folder.value='Стало';
  if(kind==='view')h.state.view='sheet';if(kind==='detached')ca.folder.isConnected=false;if(kind==='paused')h.pause();if(kind==='field')ca.folder.dataset.charTagsField='name';
  assert.equal(h.C._test.commit(ca.folder),false,kind);assert.equal(a.extra.folder,'Было',kind);assert.equal(h.saved.length,0,kind);
  if(kind==='paused'){assert.equal(ca.folder.value,'Было','the old text is back');assert.match(h.notices[0],/не сохраняются/)}
 }
});
test('a press on a chip is not lost: the chips are redrawn only after the click that was on its way',()=>{
 const h=load(),a=who('a','Vee',{folder:'Банда'}),b=who('b','Rook');h.state.characters=[a,b];
 h.C.toolbar(h.state.characters,'ru','me');const ca=h.addCard(a),cb=h.addCard(b),gang=h.button('folder','банда');
 h.page.groups.innerHTML='old chips';
 h.fire('mousedown',{button:0,target:gang});assert.equal(h.C._test.state().held,true);
 cb.folder.value='Корпы';assert.equal(h.C._test.commit(cb.folder),true);
 assert.equal(h.page.groups.innerHTML,'old chips','the button under the finger is still there');assert.equal(h.C._test.state().pending,true);
 assert.equal(b.extra.folder,'Корпы');assert.equal(h.saved.length,1,'the sheet is saved at once');assert.equal(cb.line.innerHTML,'','the line that would push the cards down waits too');
 h.fire('click',{target:gang});
 assert.match(h.page.groups.innerHTML,/value="корпы"/);assert.match(h.page.groups.innerHTML,/value="банда" aria-pressed="true"/);assert.equal(h.C._test.state().held,false);assert.equal(h.C._test.state().pending,false);
 assert.match(cb.line.innerHTML,/Корпы/);assert.equal(ca.el.hidden,false);assert.equal(cb.el.hidden,true);
 assert.equal(gang.focused,1,'the chip drawn in place of the pressed one gets the focus');
 // A press without anything waiting redraws no chip and moves no focus.
 h.fire('mousedown',{button:0,target:gang});h.fire('click',{target:gang});assert.equal(gang.focused,1);h.fire('click',{target:gang});
 // The press that never becomes a click (the finger slid off): the redraw comes with the safety timer.
 h.fire('mousedown',{button:0,target:gang});ca.folder.value='Новая';h.C._test.commit(ca.folder);assert.doesNotMatch(h.page.groups.innerHTML,/новая/);
 h.timers.at(-1).f();assert.match(h.page.groups.innerHTML,/новая/);assert.equal(h.C._test.state().folder,null,'the emptied folder is no longer picked');
 // A press elsewhere, or with another mouse button, holds nothing.
 h.fire('mousedown',{button:2,target:gang});assert.equal(h.C._test.state().held,false);
 h.fire('mousedown',{button:0,target:{closest:()=>null}});assert.equal(h.C._test.state().held,false);
 // The pressed chip stood for a folder that the waiting change has just emptied: the focus goes to «Все», which stays.
 const all=h.button('folder-all'),fresh=h.button('folder','новая');
 h.fire('mousedown',{button:0,target:fresh});ca.folder.value='';h.C._test.commit(ca.folder);
 h.page.buttons.splice(h.page.buttons.indexOf(fresh),1); // what the redraw does to the chip of a folder that is gone
 h.fire('click',{target:fresh});assert.equal(all.focused,1);assert.equal(h.C._test.state().folder,null);assert.equal(fresh.focused,0);
});
test('a press on a button of another card is not lost either: the sheet is saved, and nothing moves until the click has landed',()=>{
 const h=load(),a=who('a','Vee'),b=who('b','Rook');h.state.characters=[a,b];
 h.C.toolbar(h.state.characters,'ru','me');const ca=h.addCard(a),cb=h.addCard(b);
 // «Открыть» on the next card: a button of the page, not of this module.
 const pressable=inApp=>{const el={closest:s=>(s==='#app'&&inApp)||s==='button,summary,label,a'?el:null};return el};
 h.fire('mousedown',{button:0,target:pressable(true)});assert.equal(h.C._test.state().held,true);
 ca.folder.value='Банда';assert.equal(h.C._test.commit(ca.folder),true);
 assert.equal(a.extra.folder,'Банда');assert.equal(h.saved.length,1);
 assert.equal(ca.line.innerHTML,'');assert.equal(ca.line.hidden,false);assert.equal(h.page.groups.innerHTML,'','no line and no row of chips yet: the button under the finger stays where it is');
 cb.tags.value='долг';assert.equal(h.C._test.commit(cb.tags),true);assert.equal(h.saved.length,2);assert.equal(cb.line.innerHTML,'');
 // The press ends; the click handlers of the page run first, then everything that waited is drawn, for both cards.
 const before=h.timers.length;h.fire('mouseup',{});assert.equal(h.timers.length,before+1);assert.equal(h.timers.at(-1).ms,0);assert.equal(h.page.groups.innerHTML,'');
 h.timers.at(-1).f();
 assert.match(ca.line.innerHTML,/Банда/);assert.match(cb.line.innerHTML,/#долг/);assert.match(h.page.groups.innerHTML,/value="банда"/);assert.match(h.page.groups.innerHTML,/value="долг"/);
 assert.deepEqual([h.C._test.state().held,h.C._test.state().pending],[false,false]);assert.equal(h.renders(),0);
 // Without a press on its way (Enter, Tab) the change is drawn at once.
 ca.folder.value='Яма';h.C._test.commit(ca.folder);assert.match(ca.line.innerHTML,/Яма/);
 // A press on a plain field, or on a button outside the page (a dialog of the browser shell), holds nothing.
 h.fire('mousedown',{button:0,target:{closest:s=>s==='#app'?{}:null}});assert.equal(h.C._test.state().held,false);
 h.fire('mousedown',{button:0,target:pressable(false)});assert.equal(h.C._test.state().held,false);
 h.fire('mouseup',{});assert.equal(h.timers.length,before+1,'nothing held, nothing scheduled');
});
test('Enter files the field at once, and an opened editor stays open across a redraw',()=>{
 const h=load(),a=who('a','Vee');h.state.characters=[a];h.C.toolbar(h.state.characters,'ru','me');const ca=h.addCard(a);
 let stopped=0;ca.folder.value='Банда';ca.folder.matches=s=>s==='[data-char-tags-field]';
 h.fire('keydown',{key:'Enter',target:ca.folder,preventDefault:()=>stopped++});assert.equal(a.extra.folder,'Банда');assert.equal(stopped,1);
 h.fire('keydown',{key:'a',target:ca.folder});h.fire('keydown',{key:'Enter',isComposing:true,target:ca.folder});assert.equal(h.saved.length,1);
 const details={open:true,matches:s=>s==='[data-char-tags-edit]',closest:()=>ca.box};
 h.fire('toggle',{target:details});assert.match(h.C.card(a,'ru'),/<details class="char-tags-edit" data-char-tags-edit open>/);
 details.open=false;h.fire('toggle',{target:details});assert.doesNotMatch(h.C.card(a,'ru'),/data-char-tags-edit open/);
 details.open=true;h.fire('toggle',{target:details});h.C.toolbar([],'ru','me');assert.equal(h.C._test.state().open.length,0,'a character that is gone is forgotten');
});
test('more folders than fit: the picked one and the biggest keep their chips',()=>{
 const h=load(),list=Array.from({length:60},(_,i)=>who('c'+i,'N'+i,{folder:'F'+String(i).padStart(2,'0')}));list.push(who('x','X',{folder:'F59'}));
 h.C.toolbar(list,'ru','me');h.C._test.press(h.button('folder','f58'));
 const html=h.C.toolbar(list,'ru','me'),n=(html.match(/data-char-tags="folder"/g)||[]).length;
 assert.equal(n,h.C.LIMITS.CHIPS_MAX);assert.match(html,/value="f58" aria-pressed="true"/);assert.match(html,/value="f59"/);assert.equal((html.match(/<option /g)||[]).length,60,'the editor still offers every folder');
});
test('strings: both languages have the same set, Russian is formal, and the module loads without a page',()=>{
 assert.deepEqual(Object.keys(C.T.ru).sort(),Object.keys(C.T.en).sort());
 for(const [k,v] of Object.entries(C.T.ru)){assert.ok(typeof v==='string'&&v.length>0,k);assert.ok(/[а-яё]/i.test(v),k);assert.doesNotMatch(v,/(^|[^а-яё])(ты|тебя|тебе|твой|твои|твою|измени|сбрось|найди)([^а-яё]|$)/i,k)}
 for(const [k,v] of Object.entries(C.T.en))assert.doesNotMatch(v,/[а-яё]/i,k);
 assert.equal(C.t('en','reset'),'Reset filter');assert.equal(C.t('xx','reset'),'Сбросить фильтр');assert.equal(C.t('ru','nope'),'nope');
 const ctx={};vm.runInNewContext(source,ctx);assert.equal(typeof ctx.CharTags.read,'function');assert.doesNotThrow(()=>ctx.CharTags.apply(null,'ru'));
 assert.deepEqual(plain(C.LIMITS),{FOLDER_MAX:40,TAG_MAX:24,TAGS_MAX:8,QUERY_MAX:80,CHIPS_MAX:40});
});
