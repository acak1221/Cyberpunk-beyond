/* The name and handle generator: the word lists are the app's own and stay clean, the same random source always gives the
   same name, a tap fills the field through the event typing sends, and the previous text comes back step by step. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const site=path.join(__dirname,'..','site'),code=fs.readFileSync(path.join(site,'name-gen.js'),'utf8');
// A page: a document that remembers its listeners, optionally the icon set and the app's language. Math.random throws,
// so a test that forgets to pass its own source fails loudly.
function load({icons=false,lang=null,doc=true,hash='#/quick-builder'}={}){
 const listeners={},page={slots:[],observers:[]},root={};
 class Event{constructor(type,init){this.type=type;this.bubbles=!!init?.bubbles}}
 class MutationObserver{constructor(fn){this.fn=fn}observe(node,opt){page.observers.push({fn:this.fn,node,opt})}}
 const window={Event,MutationObserver,location:{hash},...(doc?{document:{documentElement:root,addEventListener:(k,f)=>{(listeners[k]||=[]).push(f)},querySelectorAll:q=>q==='.ng-slot'?page.slots:[]}}:{}),...(icons?{Icons:{dice:'<svg class="ico" aria-hidden="true"></svg>'}}:{}),...(lang?{App:{lang:()=>lang}}:{})};
 const math=Object.create(Math);math.random=()=>{throw new Error('Math.random was used')};
 vm.runInNewContext(code,{window,Math:math,Number,String,WeakMap});
 // drawn(...): the page was drawn again with these slots, and the browser told the observer.
 return {N:window.NameGen,listeners,page,root,window,drawn(...slots){page.slots=slots.map(x=>x.box);for(const o of page.observers)o.fn([])}};
}
// A random source that plays a script and then repeats its last value.
const seq=list=>{let i=0;const f=()=>list[Math.min(i++,list.length-1)];f.used=()=>i;return f};
// The index-th entry of a list of n entries, as a number for the source.
const at=(i,n)=>(i+0.5)/n;
// A slot as the page draws it: the field, the die, the undo button and the line for screen readers.
function slot({value='',kind='handle',lang='ru',maxLength=80,disabled=false,readOnly=false,id='',field=null}={}){
 const events=[],input={value,maxLength,disabled,readOnly,id,dataset:field?{quickField:field}:{},dispatchEvent:e=>{events.push(e);return true}};
 const die={dataset:{ng:kind,ngLang:lang},focused:0,focus(){this.focused++}},undo={dataset:{ngUndo:'',ngLang:lang},hidden:true},said={textContent:''};
 const box={input,querySelector:s=>s==='input'?input:s==='[data-ng]'?die:s==='[data-ng-undo]'?undo:s==='[data-ng-said]'?said:null};
 for(const b of [die,undo])b.closest=s=>s==='.ng-slot'?box:b;
 return {input,die,undo,said,events,box,click:b=>({type:'click',target:b})};
}

const N=load().N;
const ALL=Object.entries(N.LISTS).flatMap(([lang,lists])=>Object.entries(lists).map(([key,list])=>({lang,key,list})));

test('the lists: enough entries, no repeats, short clean words, Russian in Cyrillic and English in Latin',()=>{
 assert.deepEqual(Object.keys(N.LISTS.ru).sort(),['first','handle','last','prefix']);
 assert.deepEqual(Object.keys(N.LISTS.en).sort(),['adj','first','handle','last','prefix']);
 const least={first:40,last:40,handle:80,prefix:10,adj:30};
 for(const {lang,key,list} of ALL){
  assert.ok(list.length>=least[key],`${lang}.${key}: ${list.length}`);
  assert.equal(new Set(list.map(x=>x.toLowerCase())).size,list.length,`${lang}.${key} has a repeat`);
  for(const w of list){
   assert.equal(typeof w,'string');assert.equal(w,w.trim());assert.ok(w.length>=1&&w.length<=24,w);
   assert.match(w,lang==='ru'?/^[А-Яа-яЁё]+(?:[ -][А-Яа-яЁё]+)*$/:/^[A-Za-z]+(?:[ -][A-Za-z]+)*$/,`${lang}.${key}: ${w}`);
   assert.match(w,/^\p{Lu}/u,`${w} starts with a capital`);
  }
 }
});

test('no name, handle, corporation or gang of the setting is in the lists',()=>{
 // Parts of well-known names: anywhere inside an entry is a failure.
 const parts=['silverhand','blackhand','smasher','arasaka','militech','eurodyne','santiago','biotechnica','petrochem','zetatech','kang tao','maelstrom','valentino','tyger','voodoo','netwatch','bartmoss','cunningham','kusanagi','takemura','welles','vektor','palmer','alvarez','peralez','lazarus','soulkiller','trauma','nomad','netrunner','edgerunner','fixer','сильверхенд','сильверхэнд','блэкхенд','блэкхэнд','смэшер','арасака','милитех','евродин','сантьяго','биотехника','петрохем','мальстр','валентино','вуду','бартмосс','такэмура','такемура','уэллс','вектор','палмер','альварес','кочевник','нетраннер','фиксер'];
 // Short ones would also hit innocent words («Walter»), so these must not be a whole entry.
 const whole=['alt','rogue','spider','judy','panam','jackie','johnny','kerry','misty','morgan','lucy','rebecca','maine','david','adam','viktor','evelyn','dexter','mantis','sandevistan','kerenzikov','chrome','v','альт','роуг','паук','джуди','панам','джеки','джонни','керри','мисти','морган','люси','ребекка','мэйн','дэвид','адам','виктор','эвелин','хром','ви'];
 for(const {lang,key,list} of ALL)for(const w of list){
  const low=w.toLowerCase();
  for(const p of parts)assert.ok(!low.includes(p),`${lang}.${key}: «${w}» contains «${p}»`);
  assert.ok(!whole.includes(low),`${lang}.${key}: «${w}»`);
 }
});

test('no first name and surname add up to a well-known real person',()=>{
 // Each pair is a full name the generator must never hand out for an NPC. One half may be in the lists, not both.
 const people={
  ru:[['Роман','Абрамович'],['Юрий','Шевчук'],['Юрий','Ковальчук'],['Борис','Ковальчук'],['Кирилл','Ковальчук'],['Илья','Ковальчук'],['Юрий','Бойко'],['Олег','Бойко'],['Юрий','Мороз'],['Дарья','Мороз'],['Ева','Мендес'],['Вера','Вонг'],['Ян','Ходкевич'],['Лев','Берг'],['Марк','Фишер'],['Савва','Кулиш'],['Юрий','Швец'],['Виктор','Цой'],['Анита','Цой'],['Сергей','Цой'],['Евгений','Петросян'],['Тигран','Петросян'],['Серж','Саркисян'],['Надежда','Савченко'],['Брюс','Ли'],['Юлий','Ким'],['Ким','Новак'],['Александр','Новак'],['Диего','Коста'],['Олег','Кулик'],['Тарас','Шевчук'],['Марк','Рихтер'],['Святослав','Рихтер'],['Макс','Рихтер'],['Голда','Меир'],['Алла','Пугачёва']],
  en:[['Luka','Jovic'],['Luca','Jovic'],['Mia','Farrow'],['Kim','Novak'],['Cab','Calloway'],['Chinua','Achebe'],['Willy','Brandt'],['Joan','Fontaine'],['Jeanne','Moreau'],['Jonathan','Pryce'],['Michelle','Yeo'],['Ime','Udoka'],['Antonin','Dvorak'],['William','Thackeray'],['Christopher','Marlowe'],['Philip','Marlowe'],['Katy','Jurado'],['Mark','Strand'],['Rafa','Benitez'],['Diego','Costa'],['Hugo','Boss'],['Ada','Lovelace'],['Greta','Garbo'],['Idris','Elba'],['Uma','Thurman'],['Boris','Johnson'],['Vera','Wang'],['Eva','Mendes']],
 };
 for(const lang of ['ru','en']){
  const first=new Set(N.LISTS[lang].first),last=new Set(N.LISTS[lang].last);
  for(const [a,b] of people[lang])assert.ok(!(first.has(a)&&last.has(b)),`${lang}: the lists can make «${a} ${b}»`);
 }
 // The one a reviewer found, said out loud: no draw gives it.
 const R=N.LISTS.ru;
 for(let i=0;i<R.first.length;i++)for(let j=0;j<R.last.length;j++)assert.notEqual(N.personName('ru',seq([at(i,R.first.length),at(j,R.last.length)])),'Роман Абрамович');
});

test('pick: the ends of the list, and a broken source still gives an entry',()=>{
 const list=['a','b','c','d'];
 assert.equal(N.pick(list,()=>0),'a');assert.equal(N.pick(list,()=>0.999999),'d');assert.equal(N.pick(list,()=>0.5),'c');
 for(const bad of [()=>1,()=>-1,()=>NaN,()=>undefined,()=>'x',()=>Infinity,()=>{throw new Error('no')}])assert.ok(list.includes(N.pick(list,bad)));
 assert.equal(N.pick(list,()=>1),'d');assert.equal(N.pick(list,()=>-1),'a');
});

test('the same source gives the same name, in every shape, and Math.random is left alone',()=>{
 const R=N.LISTS.ru,E=N.LISTS.en;
 const cases=[
  [{kind:'handle',lang:'ru'},[0.1,at(3,R.handle.length)],R.handle[3],2],
  [{kind:'handle',lang:'ru'},[0.8,at(1,R.prefix.length),at(5,R.handle.length)],`${R.prefix[1]} ${R.handle[5]}`,3],
  [{kind:'handle',lang:'en'},[0.2,at(7,E.handle.length)],E.handle[7],2],
  [{kind:'handle',lang:'en'},[0.6,at(2,E.adj.length),at(0,E.handle.length)],`${E.adj[2]} ${E.handle[0]}`,3],
  [{kind:'handle',lang:'en'},[0.9,at(4,E.prefix.length),at(9,E.handle.length)],`${E.prefix[4]} ${E.handle[9]}`,3],
  [{kind:'npc',lang:'ru'},[0.1,at(6,R.first.length),at(8,R.last.length)],`${R.first[6]} ${R.last[8]}`,3],
  [{kind:'npc',lang:'en'},[0.5,at(1,E.first.length),at(2,E.last.length)],`${E.first[1]} ${E.last[2]}`,3],
  [{kind:'npc',lang:'ru'},[0.9,0.1,at(2,R.handle.length)],R.handle[2],3],
  [{kind:'npc',lang:'en'},[0.7,0.9,at(0,E.prefix.length),at(1,E.handle.length)],`${E.prefix[0]} ${E.handle[1]}`,4],
 ];
 for(const [opt,script,want,draws] of cases){
  const a=seq(script),b=seq(script);
  assert.equal(N.generate({...opt,rng:a}),want,JSON.stringify(opt)+script);
  assert.equal(N.generate({...opt,rng:b}),want);
  assert.equal(a.used(),draws,'the number of draws is fixed: '+want);
 }
 assert.equal(N.personName('en',seq([0,0])),`${E.first[0]} ${E.last[0]}`);
 assert.equal(N.handleName('ru',seq([0,0])),R.handle[0]);
});

test('names follow the language asked for; an unknown kind is a handle',()=>{
 let i=0;const rng=()=>(i=(i*7+3)%101)/101;
 for(let n=0;n<300;n++){
  assert.match(N.generate({kind:n%2?'npc':'handle',lang:'en',rng}),/^[A-Za-z -]+$/);
  for(const lang of ['ru',undefined,'de',null])assert.match(N.generate({kind:n%2?'npc':'handle',lang,rng}),/^[А-Яа-яЁё -]+$/);
 }
 for(const kind of ['x',undefined,null,'<img>'])assert.equal(N.generate({kind,lang:'ru',rng:seq([0,0])}),N.LISTS.ru.handle[0]);
});

test('a tap always changes the field, and a stuck source still ends',()=>{
 const R=N.LISTS.ru,first=R.handle[0],rng=seq([0,0,0,at(1,R.handle.length)]);
 assert.equal(N.generate({lang:'ru',rng,avoid:` ${first} `}),R.handle[1]);
 const stuck=seq([0]);
 assert.equal(N.generate({lang:'ru',rng:stuck,avoid:first}),first);
 assert.equal(stuck.used(),18,'nine tries of two draws, then it gives up');
 assert.equal(typeof N.generate({rng:()=>NaN}),'string');
});

test('the longest possible name fits, and a shorter limit cuts without a trailing space',()=>{
 const longest=list=>Math.max(...list.map(x=>x.length));
 for(const lang of ['ru','en']){
  const W=N.LISTS[lang];
  assert.ok(longest(W.first)+1+longest(W.last)<=N.MAX);
  assert.ok(Math.max(longest(W.prefix),longest(W.adj||['']))+1+longest(W.handle)<=N.MAX);
 }
 assert.equal(N.MAX,60);
 const E=N.LISTS.en,script=[0.6,at(E.adj.indexOf('Quiet'),E.adj.length),at(0,E.handle.length)];
 assert.equal(N.generate({lang:'en',rng:seq(script)}),'Quiet Rivet');
 assert.equal(N.generate({lang:'en',rng:seq(script),max:6}),'Quiet');
 assert.equal(N.generate({lang:'en',rng:seq(script),max:8}),'Quiet Ri');
 for(const max of [0,-1,NaN,undefined,null,'x',1e9])assert.equal(N.generate({lang:'en',rng:seq(script),max}),'Quiet Rivet',String(max));
});

test('the wording exists in both languages',()=>{
 assert.deepEqual(Object.keys(N.T.ru).sort(),Object.keys(N.T.en).sort());
 for(const l of ['ru','en']){
  for(const k of ['handle','npc','undo'])assert.ok(N.T[l][k].length>3);
  assert.ok(N.T[l].said('X').includes('X'));assert.ok(N.T[l].back('X').includes('X'));assert.ok(N.T[l].back('').length>3);assert.notEqual(N.T[l].back(''),N.T[l].back('X'));
 }
 assert.equal(N.T.ru.back(''),'Поле очищено');
});

test('markup: a wrapper, a named die, a hidden undo button and a status line; nothing from outside is echoed',()=>{
 assert.equal(N.open(),'<div class="ng-slot">');
 const ru=N.close('handle','ru');
 assert.equal(ru.match(/<button /g).length,2);
 assert.match(ru,/<button type="button" class="btn ghost ng-btn" data-ng="handle" data-ng-lang="ru" aria-label="Случайный позывной" title="Случайный позывной">/);
 assert.match(ru,/<button type="button" class="btn ghost ng-btn ng-undo" data-ng-undo data-ng-lang="ru" aria-label="Вернуть прежний текст" title="Вернуть прежний текст" hidden>/);
 assert.match(ru,/<span class="sr-only" role="status" data-ng-said><\/span><\/div>$/);
 assert.ok(ru.includes('<span aria-hidden="true">⚄</span>'),'a plain glyph when the icon set is absent');
 const en=N.close('npc','en');
 assert.ok(en.includes('data-ng="npc" data-ng-lang="en" aria-label="Random name"'));assert.ok(!/[А-Яа-яЁё]/.test(en));
 const odd=N.close('<img>','"><x');
 assert.ok(odd.includes('data-ng="handle" data-ng-lang="ru"'));assert.ok(!odd.includes('<img>')&&!odd.includes('<x'));
 assert.ok(load({icons:true}).N.close('handle','ru').includes('<svg class="ico" aria-hidden="true"></svg>'));
 // Without a language from the page, the app's own language decides.
 assert.ok(load({lang:'en'}).N.close('npc').includes('aria-label="Random name"'));
 assert.ok(load({lang:'ru'}).N.close('npc').includes('aria-label="Случайное имя"'));
 assert.ok(N.close('npc').includes('data-ng-lang="ru"'));
});

test('a tap fills the field, tells the page with an input event, and shows the undo button',()=>{
 const s=slot({value:'Моё имя'}),R=N.LISTS.ru;
 assert.equal(N.handle(s.click(s.die),seq([0,at(4,R.handle.length)])),true);
 assert.equal(s.input.value,R.handle[4]);
 assert.equal(s.events.length,1);assert.equal(s.events[0].type,'input');assert.equal(s.events[0].bubbles,true);
 assert.equal(s.undo.hidden,false);assert.equal(s.said.textContent,`Подставлено: ${R.handle[4]}`);
 N.handle(s.click(s.die),seq([0,at(5,R.handle.length)]));
 assert.equal(s.input.value,R.handle[5]);assert.equal(s.events.length,2);
 // Back one step at a time, down to what was typed.
 N.handle(s.click(s.undo));
 assert.equal(s.input.value,R.handle[4]);assert.equal(s.undo.hidden,false);assert.equal(s.die.focused,0);assert.equal(s.said.textContent,`Возвращено: ${R.handle[4]}`);
 N.handle(s.click(s.undo));
 assert.equal(s.input.value,'Моё имя');assert.equal(s.undo.hidden,true);assert.equal(s.die.focused,1,'the focus goes to the die before the button hides');
 assert.equal(s.events.length,4);
 assert.equal(N.handle(s.click(s.undo)),true);assert.equal(s.events.length,4,'nothing left to bring back');
 // An empty field comes back empty, and says so.
 const e=slot({lang:'en',kind:'npc'});
 N.handle(e.click(e.die),seq([0,0,0]));assert.equal(e.input.value,`${N.LISTS.en.first[0]} ${N.LISTS.en.last[0]}`);assert.equal(e.said.textContent,`Filled in: ${e.input.value}`);
 N.handle(e.click(e.undo));assert.equal(e.input.value,'');assert.equal(e.said.textContent,'Field cleared');
});

test('text typed over a generated name is not thrown away by undo: it becomes the next step back',()=>{
 const R=N.LISTS.ru,n=R.handle.length;
 const s=slot({value:'Искра',id:'typed-1'});
 N.handle(s.click(s.die),seq([0,at(7,n)]));
 s.input.value=R.handle[7]+'X';N.typed({target:s.input});
 N.handle(s.click(s.undo));
 assert.equal(s.input.value,'Искра');assert.equal(s.undo.hidden,false,'one more step: the typed text');assert.equal(s.die.focused,0);assert.equal(s.said.textContent,'Возвращено: Искра');
 N.handle(s.click(s.undo));
 assert.equal(s.input.value,R.handle[7]+'X');assert.equal(s.undo.hidden,true);assert.equal(s.die.focused,1);
 // The same when nothing told the module about the typing, and with more than one step below.
 const m=slot({value:'А',id:'typed-2'});
 N.handle(m.click(m.die),seq([0,at(1,n)]));N.handle(m.click(m.die),seq([0,at(2,n)]));
 m.input.value='Своё';
 const seen=[];while(!m.undo.hidden&&seen.length<10){N.handle(m.click(m.undo));seen.push(m.input.value)}
 assert.deepEqual(seen,[R.handle[1],'Своё','А']);
 // An untouched name, a field wiped clean, and a name retyped by hand to what is coming back: nothing to keep.
 const c=slot({value:'Было',id:'typed-3'});
 N.handle(c.click(c.die),seq([0,at(3,n)]));c.input.value='   ';N.handle(c.click(c.undo));
 assert.equal(c.input.value,'Было');assert.equal(c.undo.hidden,true);
 const r=slot({value:'Было',id:'typed-4'});
 N.handle(r.click(r.die),seq([0,at(3,n)]));r.input.value=' Было ';N.handle(r.click(r.undo));
 assert.equal(r.input.value,'Было');assert.equal(r.undo.hidden,true);
});

test('the steps back outlive the page being drawn again, and are dropped when the field comes back as another form',()=>{
 const P=load(),M=P.N,R=M.LISTS.ru,n=R.handle.length,G=R.handle[4];
 assert.equal(P.page.observers.length,1);assert.equal(P.page.observers[0].node,P.root);
 assert.equal(P.page.observers[0].opt.childList,true);assert.equal(P.page.observers[0].opt.subtree,true);
 const a=slot({value:'Моё имя',field:'name'});
 P.drawn(a);assert.equal(a.undo.hidden,true,'nothing to bring back yet');
 M.handle(a.click(a.die),seq([0,at(4,n)]));
 // The quick builder redraws on a role change: a new input with the same marks and the same text.
 const b=slot({value:G,field:'name'});
 P.drawn(b);assert.equal(b.undo.hidden,false,'the undo button is shown again');
 M.handle(b.click(b.die),seq([0,at(5,n)]));
 const c=slot({value:R.handle[5],field:'name'});P.drawn(c);
 M.handle(c.click(c.undo));assert.equal(c.input.value,G);assert.equal(c.undo.hidden,false);
 M.handle(c.click(c.undo));assert.equal(c.input.value,'Моё имя');assert.equal(c.undo.hidden,true);assert.equal(c.die.focused,1);
 // Nothing is left: the next drawing shows no undo button.
 const d=slot({value:'Моё имя',field:'name'});P.drawn(d);assert.equal(d.undo.hidden,true);
 // Typing after the tap is followed through the input event, so the redrawn field is still recognised,
 // and the typed text is still one step away. The page may trim what it stores.
 M.handle(d.click(d.die),seq([0,at(6,n)]));
 d.input.value=R.handle[6]+' Два ';P.listeners.input[0]({target:d.input});
 const e=slot({value:R.handle[6]+' Два',field:'name'});P.drawn(e);assert.equal(e.undo.hidden,false);
 M.handle(e.click(e.undo));assert.equal(e.input.value,'Моё имя');
 M.handle(e.click(e.undo));assert.equal(e.input.value,R.handle[6]+' Два');assert.equal(e.undo.hidden,true);
 // Another field, another page, or the same field holding something else: the old steps are not offered.
 const f=slot({value:'Старое',field:'name'});M.handle(f.click(f.die),seq([0,at(8,n)]));
 const other=slot({value:R.handle[8],field:'role'});P.drawn(other);assert.equal(other.undo.hidden,true,'another field');
 P.window.location.hash='#/builder';
 const away=slot({value:R.handle[8],field:'name'});P.drawn(away);assert.equal(away.undo.hidden,true,'another page');
 P.window.location.hash='#/quick-builder?x=1';
 const back=slot({value:R.handle[8],field:'name'});P.drawn(back);assert.equal(back.undo.hidden,false,'the same page, whatever follows the question mark');
 const fresh=slot({value:'Новый герой',field:'name'});P.drawn(fresh);assert.equal(fresh.undo.hidden,true,'a new form under the same address');
 // …and they are gone for good, not waiting for the old text to turn up again.
 const again=slot({value:R.handle[8],field:'name'});P.drawn(again);assert.equal(again.undo.hidden,true);
 assert.equal(M.handle(again.click(again.undo)),true);assert.equal(again.input.value,R.handle[8]);assert.equal(again.events.length,0);
 // A slot the page drew without a field or without the button is passed over.
 P.page.slots=[{querySelector:()=>null}];assert.doesNotThrow(()=>M.sync());
});

test('only a dozen fields are remembered at a time',()=>{
 const P=load(),M=P.N,n=M.LISTS.ru.handle.length,made=[];
 for(let i=0;i<14;i++){const s=slot({value:'start',id:'f'+i});M.handle(s.click(s.die),seq([0,at(i,n)]));made.push(s)}
 const shown=made.map((s,i)=>{const x=slot({value:M.LISTS.ru.handle[i],id:'f'+i});P.drawn(x);return !x.undo.hidden});
 assert.deepEqual(shown,[false,false,...Array(12).fill(true)]);
});

test('only twenty steps back are kept',()=>{
 const s=slot({value:'start'}),n=N.LISTS.ru.handle.length;
 for(let i=0;i<25;i++)N.handle(s.click(s.die),seq([0,at(i,n)]));
 let steps=0;while(!s.undo.hidden&&steps<100){N.handle(s.click(s.undo));steps++}
 assert.equal(steps,20);assert.equal(s.input.value,N.LISTS.ru.handle[4],'the oldest five steps were dropped');
});

test('guards: other events and other buttons are not ours, a locked field is left alone, the field limit is kept',()=>{
 const s=slot();
 assert.equal(N.handle({type:'input',target:s.die}),false);
 assert.equal(N.handle({type:'click',target:{closest:()=>null}}),false);
 assert.equal(N.handle({type:'click',target:null}),false);assert.equal(N.handle(null),false);
 assert.equal(N.handle({type:'click',target:{dataset:{ng:'handle'},closest(sel){return sel==='.ng-slot'?null:this}}}),false,'a button outside a slot');
 assert.equal(N.handle({type:'click',target:{dataset:{ng:'handle'},closest(sel){return sel==='.ng-slot'?{querySelector:()=>null}:this}}}),false,'a slot without a field');
 assert.equal(s.events.length,0);
 for(const lock of [{disabled:true},{readOnly:true}]){
  const x=slot({value:'keep',...lock});
  assert.equal(N.handle(x.click(x.die),seq([0,0])),true);assert.equal(x.input.value,'keep');assert.equal(x.events.length,0);assert.equal(x.undo.hidden,true);
 }
 const E=N.LISTS.en,script=[0.6,at(E.adj.indexOf('Quiet'),E.adj.length),0];
 const short=slot({lang:'en',maxLength:8});N.handle(short.click(short.die),seq(script));assert.equal(short.input.value,'Quiet Ri');
 // An input without maxlength reports -1.
 const free=slot({lang:'en',maxLength:-1});N.handle(free.click(free.die),seq(script));assert.equal(free.input.value,'Quiet Rivet');
 // The source can also be set once on the module, as the browser check does.
 const M=load().N,m=slot();M.rng=seq([0,0]);M.handle(m.click(m.die));assert.equal(m.input.value,M.LISTS.ru.handle[0]);
});

test('wiring: one click listener on the document, and the pure part works without a document',()=>{
 const page=load();
 assert.deepEqual(Object.keys(page.listeners).sort(),['click','input']);assert.equal(page.listeners.click.length,1);assert.equal(page.listeners.input.length,1);
 // Typing in a field this module never touched is none of its business.
 assert.doesNotThrow(()=>{page.listeners.input[0]({target:{value:'x'}});page.listeners.input[0]({target:null});page.listeners.input[0](null)});
 const s=slot();page.N.rng=seq([0,0]);page.listeners.click[0](s.click(s.die));assert.equal(s.input.value,page.N.LISTS.ru.handle[0]);
 const none=load({doc:false}),bare=none.N;
 assert.equal(bare.generate({lang:'en',rng:seq([0,0])}),bare.LISTS.en.handle[0]);
 assert.equal(none.page.observers.length,0);assert.doesNotThrow(()=>bare.sync());
});

test('registration: the script comes before the pages that use it, the stylesheet is linked, app.js is still last',()=>{
 const html=fs.readFileSync(path.join(site,'index.html'),'utf8'),scripts=[...html.matchAll(/<script src="([^"]+)"/g)].map(m=>m[1]);
 const me=scripts.indexOf('name-gen.js');assert.ok(me>=0);
 for(const user of ['builder.js','quick-builder.js','campaigns.js','npc-library.js','custom-content.js'])assert.ok(scripts.indexOf(user)>me,user);
 assert.equal(scripts.at(-1),'app.js');assert.equal(scripts.filter(x=>x==='name-gen.js').length,1);
 assert.equal(html.split('<link rel="stylesheet" href="name-gen.css">').length,2);
});

test('the stylesheet: in a narrow slot the field takes the whole row, so the buttons never cut a long name short',()=>{
 const css=fs.readFileSync(path.join(site,'name-gen.css'),'utf8');
 assert.match(css,/\.ng-slot \{[^}]*flex-wrap: wrap;[^}]*container-type: inline-size;[^}]*\}/);
 assert.match(css,/@container \(max-width: \d+px\) \{ \.ng-slot > \.field \{ flex-basis: 100%; \} \}/);
 assert.match(css,/\.ng-slot > \.ng-btn \{[^}]*flex: none;[^}]*width: 44px;[^}]*height: 44px;/);
 assert.ok(!css.includes('\r'));
});

test('the five name fields are wrapped, each with its kind, and only through optional calls',()=>{
 const O="${window.NameGen?.open?.()||''}<label class=\"field\">",src=f=>fs.readFileSync(path.join(site,f),'utf8');
 const want={'builder.js':['data-builder-field="name"',"</label>${window.NameGen?.close?.('handle',l)||''}"],'quick-builder.js':['data-quick-field="name"',"</label>${window.NameGen?.close?.('handle',lang(ctx))||''}"],'campaigns.js':['id="campaign-npc-name"',"</label>${window.NameGen?.close?.('npc',lang)||''}"],'npc-library.js':['data-nl-field="name"',"</label>${window.NameGen?.close?.('npc')||''}"]};
 for(const [file,[field,end]] of Object.entries(want)){
  const s=src(file),a=s.indexOf(O),f=s.indexOf(field,a),z=s.indexOf(end,f);
  assert.ok(a>=0&&f>a&&z>f,file);assert.ok(!s.slice(a+O.length,z).includes('<label'),file+': one label inside the slot');
  assert.equal(s.split('NameGen').length,3,file);
 }
 const cc=src('custom-content.js');
 assert.ok(cc.includes("${window.NameGen?.open?.()||''}${text(t.npcName,'name',d.name,NPC_NAME,` placeholder=\"${esc(t.npcNamePh)}\"`)}${window.NameGen?.close?.('npc')||''}"));
 assert.equal(cc.split('NameGen').length,3);
});

// The whole page, as tests/boot-order-app.test.cjs loads it: every script of index.html in order, with a small fake DOM.
const SCRIPTS=[...fs.readFileSync(path.join(site,'index.html'),'utf8').matchAll(/<script src="([^":?]+\.js)"><\/script>/g)].map(m=>m[1]);
const sheet=(id,name)=>({id,name,role:'solo',rank:4,stats:{INT:6,REF:7,DEX:6,TECH:6,COOL:6,WILL:6,LUCK:6,MOVE:6,BODY:8,EMP:6},skills:{Evasion:4},hp:45,humanity:60,head:11,bodyArmor:11});
// Loads every script of index.html in order, as the page does, with a small fake DOM. A script left out (or one that throws
// while loading) leaves its window.X undefined, like a module that failed to load in the bundle.
function boot({hash='#/overview',data={characters:[sheet('v1','Vee')],campaigns:[],lang:'ru'},skip=[],store=null,clock=null}={}){
 const listeners={},on=key=>(type,fn)=>{(listeners[key+':'+type]||(listeners[key+':'+type]=[])).push(fn)};
 const el=()=>{const e={innerHTML:'',textContent:'',hidden:false,dataset:{},style:{},children:[],classList:{add(){},remove(){},toggle(){},contains:()=>false},setAttribute(){},getAttribute:()=>null,removeAttribute(){},hasAttribute:()=>false,addEventListener:on('el'),removeEventListener(){},querySelector:()=>null,querySelectorAll:()=>[],appendChild:x=>x,append(){},remove(){},closest:()=>null,contains:()=>false,isConnected:true};return e};
 const app=el(),nodes={'#app':app,'#store-status':el()};app.addEventListener=on('app');let html='';app.writes=[];Object.defineProperty(app,'innerHTML',{get:()=>html,set:v=>{html=String(v);app.writes.push(html)}});
 const saved={'nightcity-red-v1':JSON.stringify(data)},storage={getItem:k=>Object.hasOwn(saved,k)?saved[k]:null,setItem:(k,v)=>{saved[k]=String(v)},removeItem:k=>{delete saved[k]},key:i=>Object.keys(saved)[i]??null,get length(){return Object.keys(saved).length}};
 const RealDate=Date,FakeDate=class extends RealDate{static now(){return clock?clock.now:RealDate.now()}};
 const w={document:{readyState:'complete',documentElement:el(),body:el(),head:el(),title:'',querySelector:s=>nodes[s]||null,querySelectorAll:()=>[],getElementById:id=>nodes['#'+id]||null,createElement:()=>el(),createTreeWalker:()=>({nextNode:()=>null}),addEventListener:on('doc'),removeEventListener(){},activeElement:null,visibilityState:'visible'},
  localStorage:storage,sessionStorage:storage,location:{hash,href:'http://x/'+hash,pathname:'/',search:'',origin:'http://x',reload(){}},history:{pushState(_,__,h){w.location.hash=h},replaceState(_,__,h){w.location.hash=h}},navigator:{userAgent:'node',language:'ru'},
  matchMedia:()=>({matches:false,addEventListener(){},addListener(){}}),MutationObserver:class{observe(){}disconnect(){}},addEventListener:on('win'),removeEventListener(){},setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,clearInterval(){},requestAnimationFrame:()=>0,scrollTo(){},confirm:()=>true,prompt(){},getComputedStyle:()=>({}),
  console:{log(){},warn(){},error(){}},Math,Date:FakeDate,JSON,Set,Map,WeakMap,WeakSet,Number,String,Array,Object,Promise,Symbol,RegExp,Error,TypeError,URL,URLSearchParams,TextEncoder,TextDecoder,Intl,crypto:{randomUUID:()=>'id-'+Math.random().toString(36).slice(2)}};
 w.window=w;w.globalThis=w;w.self=w;vm.createContext(w);
 for(const f of SCRIPTS){if(skip.includes(f)||f==='app.js')continue;try{vm.runInContext(fs.readFileSync(path.join(site,f),'utf8'),w,{filename:f})}catch{}}
 if(store)w.LocalStore=store;
 vm.runInContext(fs.readFileSync(path.join(site,'app.js'),'utf8')+'\n;window.__qa={state:()=>state};',w,{filename:'app.js'});
 const fire=(key,type,event)=>{for(const fn of listeners[key+':'+type]||[]){if(event.stopped)break;fn(event)}};
 // A click goes through the window capture listeners first, then the #app listener, as in the page.
 const click=(target,extra={})=>{const event={type:'click',target,detail:0,clientX:0,clientY:0,defaultPrevented:false,stopped:false,preventDefault(){this.defaultPrevented=true},stopImmediatePropagation(){this.stopped=true},...extra};fire('win','click',event);fire('app','click',event);return event};
 const button=dataset=>{const b={dataset,isConnected:true,hasAttribute:()=>false,matches:()=>false};b.closest=s=>s==='#app'?app:/\[data-action\]/.test(s)&&dataset.action?b:null;return b};
 const send=(type,target)=>{const event={type,target};fire('app',type,event);return event};
 return {w,app,saved,click,send,button,state:()=>w.__qa.state()};
}

test('in the page: both builders draw the die in the interface language, and without the module the field is as before',()=>{
 for(const [hash,field] of [['#/builder','data-builder-field="name"'],['#/quick-builder','data-quick-field="name"']])for(const lang of ['ru','en']){
  const data={characters:[sheet('v1','Vee')],campaigns:[],lang};
  const html=boot({hash,data}).app.innerHTML,i=html.indexOf('<div class="ng-slot"><label class="field">');
  assert.ok(i>=0,hash+' '+lang);
  const part=html.slice(i,html.indexOf('data-ng-said',i));
  assert.ok(part.includes(field),hash);assert.ok(part.includes(`data-ng="handle" data-ng-lang="${lang}" aria-label="${lang==='ru'?'Случайный позывной':'Random handle'}"`),hash+' '+lang);
  assert.equal(html.split('class="ng-slot"').length,2,'one slot on the step');
  const plain=boot({hash,data,skip:['name-gen.js']}).app.innerHTML;
  assert.ok(plain.includes(field));assert.ok(!plain.includes('ng-slot')&&!plain.includes('data-ng'),hash+' without the module');
  // Apart from the slot, the step is the same markup.
  assert.equal(html.replace('<div class="ng-slot">','').replace(/<button type="button" class="btn ghost ng-btn" data-ng=.*?data-ng-said><\/span><\/div>/,''),plain,hash+' '+lang);
 }
});
