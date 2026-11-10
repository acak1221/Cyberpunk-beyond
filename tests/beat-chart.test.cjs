const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
global.window={};require('../site/beat-chart.js');
const B=window.BeatChart,source=f=>fs.readFileSync(__dirname+'/../site/'+f,'utf8');
const kinds=list=>list.map(b=>b.kind),chain=ks=>ks.map((kind,i)=>({id:'b'+i,kind,type:'',note:'',done:false})),codes=ks=>[...new Set(B.check(chain(ks)).map(x=>x[0]))];
const fake=(over={})=>({closest:s=>over[s]??null,dataset:{},hasAttribute:()=>false,...over.el});

test('every Beat of the book is listed once with a page inside the chapter (pp. 395–407)',()=>{
 const ids=new Set();let count=0;
 for(const [kind,list] of Object.entries(B.TYPES)){assert.ok(B.KINDS[kind]);for(const [id,ru,en,page] of list){count++;assert.ok(!ids.has(id),'duplicate '+id);ids.add(id);assert.ok(ru&&en&&ru!==en);assert.ok(page>=397&&page<=407,`${en}: page ${page}`)}}
 assert.deepEqual(Object.fromEntries(Object.entries(B.TYPES).map(([k,v])=>[k,v.length])),{hook:10,cliff:13,dev:29,climax:3,res:9});assert.equal(count,64);
});

test('a built chart starts with a Hook, alternates, and ends with Climax and Resolution',()=>{
 assert.deepEqual(kinds(B.build(4)),['hook','dev','cliff','dev','cliff','dev','climax','res'],'4 hours = 8 Beats of half an hour (p. 396)');
 assert.deepEqual(kinds(B.build(2)),['hook','dev','climax','res']);
 assert.deepEqual(kinds(B.build(3,'cliff')),['hook','cliff','dev','cliff','climax','res'],'after a quiet Hook the middle opens with action (p. 395)');
 for(const h of [2,3,4,5,6,8,12,'x',-1,99]){const chart=B.build(h);assert.deepEqual(B.check(chart),[],`hours ${h}`);assert.ok(chart.length<=B.MAX);assert.equal(new Set(chart.map(b=>b.id)).size,chart.length)}
});

test('the order rules are checked',()=>{
 assert.deepEqual(codes(['hook','dev','cliff','climax','res']),[]);
 assert.deepEqual(codes(['dev','cliff','climax','res']),['warnHook']);
 assert.deepEqual(codes(['hook','dev','cliff']),['warnEnd']);
 assert.deepEqual(codes(['hook','dev','climax']),['warnEnd'],'a Climax needs its Resolution');
 assert.deepEqual(codes(['hook','dev','dev','climax','res']),['warnTwice']);
 assert.deepEqual(codes(['hook','cliff','cliff','climax','res']),['warnTwice']);
 assert.deepEqual(codes(['hook','dev','hook','cliff','climax','res']),['warnMiddle']);
 assert.deepEqual(codes(['hook','res','dev','climax','res']),['warnMiddle']);
 assert.deepEqual(B.check([]),[]);
 assert.deepEqual(B.check(chain(['hook','dev','dev','climax','res'])),[['warnTwice',2]],'the second of the pair is the one flagged');
});

test('saved plans are read safely: unknown kinds dropped, text limited, unknown options cleared',()=>{
 const beats=B.read({beats:[{id:'a',kind:'hook',type:'crisis',note:'x'.repeat(999),done:true},{kind:'nope'},null,7,{id:'b',kind:'dev',type:'battle',note:5},...Array.from({length:60},()=>({kind:'cliff'}))]});
 assert.equal(beats.length,B.MAX);assert.deepEqual({...beats[0],note:beats[0].note.length},{id:'a',kind:'hook',type:'crisis',note:300,done:true});
 assert.deepEqual({kind:beats[1].kind,type:beats[1].type,note:beats[1].note,done:beats[1].done},{kind:'dev',type:'',note:'',done:false},'Battle is a Cliffhanger, not a Development');
 assert.deepEqual(B.read({}),[]);assert.deepEqual(B.read(null),[]);
});

test('the plan renders with page links and names the problems in both languages',()=>{
 const c={beats:chain(['hook','dev','dev','climax','res'])};c.beats[0].type='crisis';c.beats[1].note='<b>Встреча</b>';
 const ru=B.render(c,'ru'),en=B.render(c,'en');
 assert.match(ru,/Битов: 5 · около 2\.5 ч игры/);assert.match(ru,/Развитие и клиффхэнгер должны чередоваться/);assert.match(en,/Developments and Cliffhangers must alternate/);
 assert.match(ru,/<option value="crisis" selected>Кризис · стр\. 397<\/option>/);assert.match(ru,/data-action="book-page" data-page="397"/);
 assert.match(ru,/value="&lt;b&gt;Встреча&lt;\/b&gt;"/);assert.doesNotMatch(ru,/<b>Встреча/);
 assert.equal((ru.match(/class="beat beat-/g)||[]).length,5);assert.equal((ru.match(/ flagged"/g)||[]).length,1);
 assert.match(B.render({beats:chain(['hook','dev','climax','res'])},'ru'),/Порядок битов соответствует схеме/);
 assert.match(B.render({},'en'),/No plan yet/);
});

test('editing changes campaign.beats and asks for a save',()=>{
 const c={beats:chain(['hook','dev','climax','res'])},root={querySelector:()=>({value:'3'})};
 const at=(i,el={})=>({target:{closest:s=>s==='[data-beat-root]'?root:s==='[data-beat]'?{dataset:{beat:'b'+i}}:s==='[data-beat-action]'&&el.action?{dataset:{beatAction:el.action}}:null,dataset:el.field?{beatField:el.field}:{},hasAttribute:()=>false,value:el.value,checked:el.checked}});
 assert.deepEqual(B.handle({type:'change',...at(1,{field:'kind',value:'cliff'})},c,'ru'),{handled:true,dirty:true,rerender:true});assert.equal(c.beats[1].kind,'cliff');
 assert.deepEqual(B.handle({type:'input',...at(1,{field:'note',value:'Погоня по крышам'})},c,'ru'),{handled:true,dirty:true,rerender:false},'typing saves without redrawing the field');assert.equal(c.beats[1].note,'Погоня по крышам');
 B.handle({type:'change',...at(1,{field:'type',value:'chase'})},c,'ru');assert.equal(c.beats[1].type,'chase');
 B.handle({type:'change',...at(1,{field:'kind',value:'dev'})},c,'ru');assert.equal(c.beats[1].type,'','a new kind clears the option of the old one');
 B.handle({type:'change',...at(0,{field:'done',checked:true})},c,'ru');assert.equal(c.beats[0].done,true);
 B.handle({type:'click',...at(1,{action:'down'})},c,'ru');assert.deepEqual(kinds(c.beats),['hook','climax','dev','res']);
 B.handle({type:'click',...at(1,{action:'up'})},c,'ru');assert.deepEqual(kinds(c.beats),['hook','dev','climax','res']);
 B.handle({type:'click',...at(1,{action:'remove'})},c,'ru');assert.deepEqual(kinds(c.beats),['hook','climax','res']);
 B.handle({type:'click',...at(-1,{action:'add'})},c,'ru');assert.equal(c.beats.at(-1).kind,'dev');
 global.confirm=()=>false;B.handle({type:'click',...at(-1,{action:'build'})},c,'ru');assert.equal(c.beats.length,4,'a refused confirm keeps the plan');
 global.confirm=()=>true;B.handle({type:'click',...at(-1,{action:'build'})},c,'ru');assert.deepEqual(kinds(c.beats),['hook','dev','cliff','dev','climax','res']);
 assert.deepEqual(B.handle({type:'click',target:{closest:()=>null}},c,'ru'),{handled:false});
});

test('the campaign page shows the plan and saves its changes',()=>{
 const camp=source('campaigns.js');
 assert.match(source('index.html'),/<script src="beat-chart\.js"><\/script><script src="campaigns\.js">/);
 assert.match(camp,/\$\{window\.BeatChart\?\.render\?\.\(c,lang\)\|\|''\}\$\{journalHTML\(c,t\)\}/);
 assert.match(camp,/window\.BeatChart\?\.owns\?\.\(e\)&&!el\.closest\?\.\('\[data-action="book-page"\]'\)\)\{if\(!current\(\)\)return stale\(\);/);
});
