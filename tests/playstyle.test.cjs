const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=f=>fs.readFileSync(__dirname+'/../site/'+f,'utf8');
function load(active){
 const listeners={},saves=[];const award={value:'group'};
 const document={documentElement:{lang:'ru'},addEventListener:(t,fn)=>{listeners[t]=fn},querySelector:s=>s==='.sheet-layout [data-cx-award="style"]'?award:null};
 const window={document,App:{active:()=>active,save:()=>saves.push(1)}};
 vm.runInNewContext(source('playstyle.js'),{window});
 return {P:window.Playstyle,listeners,saves,award};
}
const withPicks=picks=>({extra:{playstyle:{version:1,picks}}});
const plain=x=>JSON.parse(JSON.stringify(x));

test('four styles, 24 statements, five marks (p. 409)',()=>{
 const {P}=load();
 assert.deepEqual(plain(P.STYLES.map(s=>[s[0],s[3].length])),[['warrior',7],['socializer',6],['explorer',6],['roleplayer',5]]);assert.equal(P.MAX,5);
 for(const [, ru,en,list] of P.STYLES){assert.ok(ru&&en);for(const pair of list){assert.equal(pair.length,2);assert.ok(pair[0]&&pair[1]&&pair[0]!==pair[1])}}
});

test('the style with the most marks is primary, the next secondary',()=>{
 const {P}=load();
 const r=P.result(withPicks(['warrior:0','warrior:2','warrior:5','explorer:1','roleplayer:4']));
 assert.equal(r.primary,'warrior');assert.equal(r.done,true);assert.equal(r.tie,false);assert.deepEqual(plain(r.counts),{warrior:3,socializer:0,explorer:1,roleplayer:1});
 assert.equal(r.secondary,'explorer','level styles keep the book order of the boxes here');
 const tie=P.result(withPicks(['warrior:0','warrior:1','socializer:0','socializer:1','explorer:0']));assert.equal(tie.tie,true);assert.match(P.summary(withPicks(tie.picks),'ru'),/поровну/);
 const one=P.result(withPicks(['roleplayer:0','roleplayer:1','roleplayer:2','roleplayer:3','roleplayer:4']));assert.equal(one.primary,'roleplayer');assert.equal(one.secondary,null);
 assert.match(P.summary(withPicks(r.picks),'en'),/Marked 5 of 5\. Primary style: Warrior \(3\)\. Secondary: Explorer \(1\)\./);
});

test('unfinished and damaged answers give no style',()=>{
 const {P}=load();
 assert.equal(P.result(withPicks(['warrior:0','warrior:1'])).done,false);assert.equal(P.summary(withPicks(['warrior:0']),'ru'),'Отмечено 1 из 5.');
 for(const bad of [null,{},{extra:{playstyle:null}},{extra:{playstyle:{version:2,picks:['warrior:0']}}},{extra:{playstyle:{version:1,picks:'warrior:0'}}}])assert.deepEqual(plain(P.picks(bad)),[]);
 assert.deepEqual(plain(P.picks(withPicks(['warrior:0','warrior:0','warrior:99','nope:1',5,'explorer:5','socializer:0','socializer:1','socializer:2','socializer:3','socializer:4']))),['warrior:0','explorer:5','socializer:0','socializer:1','socializer:2'],'duplicates and unknown keys are dropped, five at most');
});

test('marking saves at once, stops at five and sets the award column',()=>{
 const c={extra:{}},h=load(c);
 const boxes=new Map(),root={querySelectorAll:()=>[...boxes.values()],querySelector:()=>out},out={textContent:''};
 const box=key=>{if(!boxes.has(key))boxes.set(key,{dataset:{playstylePick:key},checked:false,disabled:false,closest:s=>s==='[data-playstyle-pick]'?boxes.get(key):s==='[data-playstyle-root]'?root:null});return boxes.get(key)};
 const mark=(key,on=true)=>{const b=box(key);b.checked=on;h.listeners.change({target:b})};
 for(const k of ['explorer:0','explorer:1','explorer:2','warrior:0'])mark(k);
 assert.equal(c.extra.playstyle.picks.length,4);assert.equal(h.award.value,'group','not finished yet');assert.equal(h.saves.length,4);
 mark('warrior:1');assert.equal(h.award.value,'explorer');assert.match(out.textContent,/Основной стиль: Исследователь \(3\)\. Вторичный: Воин \(2\)/);
 box('roleplayer:0');mark('roleplayer:0');assert.equal(box('roleplayer:0').checked,false,'a sixth mark is refused');assert.equal(c.extra.playstyle.picks.length,5);
 mark('explorer:0',false);assert.equal(c.extra.playstyle.picks.length,4);assert.equal(box('roleplayer:0').disabled,false,'boxes open again');
});

test('the quiz sits on the sheet next to the session award',()=>{
 const sheet=source('character-extra.js');
 assert.match(source('index.html'),/<script src="playstyle\.js"><\/script><script src="character-extra\.js">/);
 assert.match(sheet,/\$\{window\.Playstyle\?\.render\?\.\(c,l\)\|\|''\}<details data-cx-ip-award>/);
 assert.match(sheet,/done&&ps\.primary===v\?' selected':''/);
 const {P}=load();const html=P.render(withPicks(['warrior:0','warrior:1','warrior:2','warrior:3','warrior:4']),'ru');
 assert.equal((html.match(/data-playstyle-pick=/g)||[]).length,24);assert.equal((html.match(/ checked/g)||[]).length,5);assert.equal((html.match(/ disabled/g)||[]).length,19);assert.match(html,/data-page="409"/);
});
