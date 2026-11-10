const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(__dirname+'/../site/npc-library.js','utf8');
const plain=x=>JSON.parse(JSON.stringify(x));
function load(){
 const calls=[],state={gmExtras:{},campaigns:[{id:'k',name:'Job',roster:[]}]};
 const window={App:{getState:()=>state,save(){calls.push(['save'])},notify:m=>calls.push(['notify',m]),lang:()=>'ru',check:(base,label,opts)=>{calls.push(['check',base,label,opts]);return {total:base+5}},dice:(n,s,label)=>{calls.push(['dice',n,s,label]);return n*3}}};
 // A fresh copy for every test: the module keeps its form state.
 vm.runInNewContext(source,{window,Date,Math,globalThis:{}});
 return {N:window.NpcLibrary,state,calls};
}
const click=(N,action,data={},root={isConnected:true,dataset:{lang:'ru'},outerHTML:''})=>N.handle({type:'click',target:{closest:s=>s==='[data-nl-root]'?root:s==='[data-nl-action]'?{dataset:{nlAction:action,...data},closest:()=>null}:null,dataset:{}}},'ru');
const type=(N,field,value,root={isConnected:true,dataset:{lang:'ru'}})=>N.handle({type:'input',target:{closest:s=>s==='[data-nl-root]'?root:null,dataset:{nlField:field},value}},'ru');

test('skills and attacks are read from lines of text',()=>{
 const {N}=load();
 assert.deepEqual(plain(N.parseSkills('Пистолеты 10\n  Уклонение: 7 \n\nLocal Expert (Home) +5')),{list:[{name:'Пистолеты',base:10},{name:'Уклонение',base:7},{name:'Local Expert (Home)',base:5}],bad:[]});
 assert.deepEqual(plain(N.parseAttacks('Тяжёлый пистолет 10 3d6\nAssault Rifle +12, 5D6\nНож 9 1d6')),{list:[{name:'Тяжёлый пистолет',base:10,damage:'3d6'},{name:'Assault Rifle',base:12,damage:'5d6'},{name:'Нож',base:9,damage:'1d6'}],bad:[]});
 assert.deepEqual(plain(N.parseSkills('Просто текст\nПистолеты 10').bad),['Просто текст']);
 assert.deepEqual(plain(N.parseAttacks('Пистолет 10\nПистолет 10 3d8\nПистолет 3d6').bad),['Пистолет 10','Пистолет 10 3d8','Пистолет 3d6'],'an attack needs a total and d6 or d10 damage');
 assert.equal(N.parseSkills(Array.from({length:30},(_,i)=>'Skill '+i+' 5').join('\n')).list.length,12);
});

test('stored presets keep only well-formed skills and attacks, and old presets still load',()=>{
 const {N}=load();
 const e=N.cleanEntry({id:'a',name:'Ганк',ref:6,hp:30,skills:[{name:'Пистолеты',base:10},{name:'',base:3},{name:'x',base:'много'},null],attacks:[{name:'Пистолет',base:10,damage:'3D6'},{name:'Плохой',base:10,damage:'drop table'},{name:'Ноль',base:5,damage:'0d6'}]});
 assert.deepEqual(plain(e.skills),[{name:'Пистолеты',base:10}]);assert.deepEqual(plain(e.attacks),[{name:'Пистолет',base:10,damage:'3d6'}]);
 const old=N.cleanEntry({id:'b',name:'Старый',ref:5,hp:20,weapons:'нож'});assert.equal('skills' in old,false);assert.equal('attacks' in old,false);assert.equal(old.weapons,'нож');
});

test('saving a preset parses the lines; an unreadable line stops the save and says which',()=>{
 const {N,state,calls}=load();
 click(N,'new');type(N,'name','Ганк');type(N,'skillsText','Пистолеты 10\nчто-то');type(N,'attacksText','Пистолет 10 3d6');
 click(N,'save');
 assert.equal((state.gmExtras.npcLibrary||[]).length,0);assert.deepEqual(calls.filter(c=>c[0]==='notify').map(c=>c[1]),['Не удалось разобрать строку: «что-то».']);
 type(N,'skillsText','Пистолеты 10\nУклонение 7');click(N,'save');
 const saved=state.gmExtras.npcLibrary[0];
 assert.deepEqual(plain(saved.skills),[{name:'Пистолеты',base:10},{name:'Уклонение',base:7}]);assert.deepEqual(plain(saved.attacks),[{name:'Пистолет',base:10,damage:'3d6'}]);
 assert.equal('skillsText' in saved,false,'the form text is not stored');
 const html=N.render('ru');assert.match(html,/data-nl-action="roll-attack"[^>]*>⬡ Пистолет \+10</);assert.match(html,/data-nl-action="roll-damage"[^>]*>урон 3d6</);assert.match(html,/data-nl-action="roll-skill"[^>]*data-nl-i="1">⬡ Уклонение \+7</);
 click(N,'edit',{nlId:saved.id});assert.match(N.render('ru'),/data-nl-field="skillsText"[^>]*>Пистолеты 10\nУклонение 7<\/textarea>/);
});

test('roll buttons roll for the NPC, without the open sheet\'s wound penalty',()=>{
 const {N,state,calls}=load();
 state.gmExtras.npcLibrary=[{id:'a',name:'Ганк',ref:6,hp:30,head:7,torso:7,body:6,skills:[{name:'Уклонение',base:7}],attacks:[{name:'Пистолет',base:10,damage:'3d6'}]}];
 click(N,'roll-skill',{nlId:'a',nlI:'0'});click(N,'roll-attack',{nlId:'a',nlI:'0'});click(N,'roll-damage',{nlId:'a',nlI:'0'});click(N,'roll-skill',{nlId:'a',nlI:'5'});click(N,'roll-skill',{nlId:'zzz',nlI:'0'});
 assert.deepEqual(plain(calls.filter(c=>c[0]==='check')),[['check',7,'Ганк · Уклонение',{wounds:false}],['check',10,'Ганк · Пистолет · атака',{wounds:false}]]);
 assert.deepEqual(plain(calls.filter(c=>c[0]==='dice')),[['dice',3,6,'Ганк · Пистолет · урон']]);
 assert.deepEqual(calls.filter(c=>c[0]==='notify').map(c=>c[1]),['Ганк · Пистолет: урон 3d6 = 9']);
 assert.equal(calls.some(c=>c[0]==='save'),false,'rolling changes nothing');
});

test('added to a campaign, the combatant carries its attacks in the note and its armor and BODY as data',()=>{
 const {N}=load(),e=N.cleanEntry({id:'a',name:'Ганк',ref:6,hp:30,head:7,torso:11,body:6,attacks:[{name:'Пистолет',base:10,damage:'3d6'}],weapons:'граната'});
 let n=0;const rows=N.rosterEntries(e,2,[],'ru',()=>'id'+(++n),1000);
 assert.deepEqual(plain(rows.map(r=>r.name)),['Ганк 1','Ганк 2']);
 assert.equal(rows[0].combatNote.text,'SP 7/11 · Пистолет +10 3d6 · граната');
 assert.deepEqual(plain(rows[0].sp),{head:7,body:11});assert.equal(rows[0].body,6);
 const bare=N.rosterEntries(N.cleanEntry({id:'b',name:'Прохожий',ref:4,hp:20}),1,[],'ru',()=>'x',1)[0];assert.equal('sp' in bare,false);assert.equal('body' in bare,false);
});
