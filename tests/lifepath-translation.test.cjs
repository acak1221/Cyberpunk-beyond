const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),test=require('node:test'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..','public','game');
function setup(){const s={console,Math,Date,confirm:()=>true,crypto:{randomUUID:()=>Math.random().toString(36)}};s.window=s;vm.createContext(s);for(const f of ['lifepath.js','character-extra.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),s,{filename:f});return s}
test('generated Lifepath switches languages and preserves manual edits and legacy data',()=>{
 const s=setup(),p=s.Lifepath,c={role:'solo',rank:4,stats:{LUCK:6},skills:{},extra:{life:{friends:'A manually written friend'}}};
 assert.equal(p.setChoice('culture',1),true);assert.equal(p.setChoice('personality',1),true);
 assert.equal(p.applyToCharacter(c,'ru').ok,true);assert.equal(c.extra.life.culture,'Северная Америка');
 assert.equal(p.displayField(c,'culture','en'),'North America');
 assert(s.CharacterExtra.render(c,'en').includes('value="North America"'));assert(s.CharacterExtra.render(c,'ru').includes('value="Северная Америка"'));
 assert.equal(p.displayField(c,'friends','en'),'A manually written friend');
 assert.equal(p.applyToCharacter(c,'en').ok,true);assert.equal(c.extra.life.culture,'North America');assert.equal(p.displayField(c,'culture','ru'),'Северная Америка');
 s.CharacterExtra.handle({type:'input',target:{dataset:{cxField:'life.culture'},type:'text',value:'My own background'}},c,'en');
 assert.equal(p.displayField(c,'culture','ru'),'My own background');assert.equal(p.applyToCharacter(c,'ru').reason,'overwrite');
 assert.equal(p.applyToCharacter(c,'ru',true).ok,true);assert.equal(p.displayField(c,'culture','en'),'North America');
 assert.equal(p.displayField({extra:{life:{culture:'Legacy original'}}},'culture','en'),'Legacy original');
});
test('role Lifepath carries both translations and respects manual edits',()=>{
 const s=setup(),p=s.Lifepath,c={role:'solo',rank:4,stats:{LUCK:6},skills:{},extra:{}};
 p.handle({type:'change',target:{value:'solo',hasAttribute:k=>k==='data-lpr-role'}},'ru',[]);
 p.rollAllRole('solo');assert.equal(p.applyRole(c,'ru',true).ok,true);
 const ru=p.displayField(c,'roleHistory','ru'),en=p.displayField(c,'roleHistory','en');assert(ru&&en&&ru!==en);
 assert.equal(p.applyRole(c,'en',false).ok,true);assert.equal(p.displayField(c,'roleHistory','ru'),ru);
 c.extra.life.roleHistory='Custom role history';assert.equal(p.displayField(c,'roleHistory','ru'),'Custom role history');assert.equal(p.applyRole(c,'ru',false).reason,'overwrite');
});
test('unsaved generator and character target reset across account scopes while same scope preserves them',()=>{
 const s=setup(),p=s.Lifepath,characters=[{id:'shared-id',name:'Private character',role:'solo'}];
 p.setScope('account-a');
 p.setChoice('culture',1);
 p.handle({type:'change',target:{value:'shared-id',hasAttribute:k=>k==='data-lp-target'}},'en',characters);
 p.handle({type:'input',target:{value:'Private native language',hasAttribute:k=>k==='data-lp-native'}},'en',characters);
 p.handle({type:'change',target:{value:'solo',hasAttribute:k=>k==='data-lpr-role'}},'en',characters);
 p.rollAllRole('solo');
 assert.equal(p.resultText('culture','en'),'North America');assert(p.roleText('solo','en'));assert(p.render('en',characters).includes('Private native language'));
 p.setScope('account-a');assert.equal(p.resultText('culture','en'),'North America');assert(p.roleText('solo','en'));
 p.setScope('account-b');assert.equal(p.resultText('culture','en'),'');assert.equal(p.roleText('solo','en'),'');
 let html=p.render('en',characters);assert(!html.includes('Private native language'));assert(!html.includes('Character: Private character'));
 p.setChoice('culture',2);p.setScope(null);assert.equal(p.resultText('culture','en'),'');
});
