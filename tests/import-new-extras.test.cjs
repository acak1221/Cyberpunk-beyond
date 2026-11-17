// Hostile data in the optional fields of newer features is refused or cleaned on every way in: file import, backup restore,
// duplicate, share link and room sheet (the last two use importCharacter), and what the sheet saves is well formed.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const plain=x=>JSON.parse(JSON.stringify(x));
// The harness of the import tests, with the feature modules loaded as well.
const base=fs.readFileSync(__dirname+'/character-import-app.test.cjs','utf8');
const head=base.slice(base.indexOf('const stats='),base.indexOf('\ntest('));
const patched=head.replace("['character-extra.js','equipment-tools.js']","['character-extra.js','equipment-tools.js','agent-notes.js','weapon-attach.js','martial-arts.js','garage.js']");
assert.notEqual(patched,head,'harness patched');const patched2=patched.replace('window.qa={state:()=>state,','window.qa={valid:validateCharacter,state:()=>state,');assert.notEqual(patched2,patched);
const {harness,sheet}=new Function('require','__dirname','assert','plain','fs','vm',"const source=n=>fs.readFileSync(__dirname+'/../site/'+n,'utf8');"+patched2.replace(/^const source=.*\n/m,'').replace(/^const \{test\}.*\n/m,'')+"\nreturn {harness,sheet};")(require,__dirname,assert,plain,fs,require('node:vm'));

const HOSTILE={
 notesList:{notesList:'not a list'},
 notesRows:{notesList:[1,'x',null]},
 goals:{goals:{a:1}},
 contacts:{contacts:7},
 quality:{weapons:[{id:'w1',name:'Gun',quality:'legendary'}]},
 qualityType:{weapons:[{id:'w1',name:'Gun',quality:{x:1}}]},
 attachments:{weapons:[{id:'w1',name:'Gun',attachments:'scope'}]},
 attachmentsRows:{weapons:[{id:'w1',name:'Gun',attachments:[1,{},'x'.repeat(500)]}]},
 attachmentsMany:{weapons:[{id:'w1',name:'Gun',attachments:Array.from({length:60},(_,i)=>'a'+i)}]},
 linkedTo:{items:[{id:'i1',name:'Scope',linkedTo:{x:1}}]},
 linkedToLong:{items:[{id:'i1',name:'Scope',linkedTo:'x'.repeat(500)}]},
 cyberType:{cyberSlots:'lots'},
 cyberCost:{cyberSlots:{version:1,defaultCost:99,costs:{a:50,'__proto__':1}}},
 cyberCosts:{cyberSlots:{version:1,costs:[1,2]}},
 martialType:{martialArts:[1]},
 martialForms:{martialArts:{v:1,forms:'karate'}},
 martialRows:{martialArts:{v:1,forms:[1,{id:7}]}},
 quick:{quickRolls:'Handgun'},
 quickMany:{quickRolls:['a','b','c','d','e','f','g']},
 groups:{itemGroups:[1,{id:3}]},
 named:{namedModifiers:'x'},
 namedList:{namedModifiers:{version:1,list:'x'}},
 vehicles:{vehicles:[{id:'v1',name:{x:1}}]},
};

const GOOD={
 notesList:[{id:'n1',text:'a',at:1}],goals:[{id:'g1',text:'b'}],contacts:[{id:'c1',name:'Rogue'}],
 weapons:[{id:'w1',name:'Gun',quality:'excellent',attachments:['scope']}],items:[{id:'i1',name:'Scope',linkedTo:'w1'}],
 cyberSlots:{version:1,defaultCost:2,costs:{'cyberware-x':3}},martialArts:{v:1,forms:[]},quickRolls:['Handgun','Evasion'],
 itemGroups:[{id:'g',name:'Kit'}],namedModifiers:{version:1,list:[]},
};

test('a well formed sheet with every new field is accepted as it is',()=>{
 const h=harness();
 assert.equal(h.w.qa.valid(sheet('x',GOOD)),true);
 const r=h.App.importCharacter(sheet('good',GOOD),{sourceKey:'link:good'});assert.equal(r.ok,true);
 const c=h.chars()[0];assert.equal(c.extra.weapons[0].quality,'excellent');assert.deepEqual(plain(c.extra.cyberSlots),GOOD.cyberSlots);assert.deepEqual(plain(c.extra.quickRolls),['Handgun','Evasion']);
});

for(const [name,extra] of Object.entries(HOSTILE)){
 test('hostile '+name+': validateCharacter refuses it',()=>{const h=harness();assert.equal(h.w.qa.valid(sheet('x',extra)),false)});
 test('hostile '+name+': a share link or room sheet (importCharacter) is refused and nothing changes',()=>{
  const h=harness({characters:[sheet('a')]}),before=h.chars();
  const r=h.App.importCharacter(sheet('remote',extra),{sourceKey:'link:remote'});
  assert.equal(r.ok,false);assert.equal(r.reason,'invalid');assert.equal(h.chars(),before);assert.equal(h.saved.length,0);
 });
 test('hostile '+name+': a file import and a backup restore take nothing from it',async()=>{
  const h=harness({characters:[sheet('a')]});
  await h.change('import-file',sheet('remote',extra));
  assert.equal(h.chars().length,1,'file import');
  await h.change('import-backup',{format:'nightcity-red-backup',version:1,lang:'en',campaigns:[],characters:[sheet('b',extra)]});
  assert.equal(h.chars().some(c=>c.id==='b'||c.name==='b'),false,'backup restore');
 });
}

test('more item groups than the app allows (12) are refused',()=>{
 const h=harness(),many=Array.from({length:13},(_,i)=>({id:'g'+i,name:'G'+i}));
 assert.equal(h.w.qa.valid(sheet('x',{itemGroups:many})),false);
 assert.equal(h.w.qa.valid(sheet('x',{itemGroups:many.slice(0,12)})),true);
});
