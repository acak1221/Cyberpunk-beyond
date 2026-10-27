const {test}=require('node:test'),assert=require('node:assert/strict');
global.window={};require('../public/game/character-extra.js');
const {init,supported}=window.CharacterExtra;
test('initialization refuses incompatible containers without mutating any data',()=>{
 for(const extra of [null,false,0,'',[],{life:null},{life:[]},{lifeTranslations:'later'},{items:[null]},{weapons:'later'}]){const c={extra,stats:{LUCK:6}},before=JSON.stringify(c);assert.equal(supported(c),false);assert.throws(()=>init(c),/unsupported_character_extra/);assert.equal(JSON.stringify(c),before)}
});
test('known empty values and unknown future fields are preserved rather than normalized away',()=>{
 const c={stats:{LUCK:6},extra:{life:{culture:'NC',future:{nested:true}},cash:null,nativeLevel:null,items:[{name:'legacy',future:{revision:8}}],future:'keep'}};const x=init(c);assert.equal(x.cash,null);assert.equal(x.nativeLevel,null);assert.deepEqual(x.life.future,{nested:true});assert.deepEqual(x.items[0].future,{revision:8});assert.equal(x.future,'keep');
});
