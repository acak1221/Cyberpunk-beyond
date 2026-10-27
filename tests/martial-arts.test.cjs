const {test}=require('node:test');
const assert=require('node:assert/strict');
global.window={};
require('../public/game/martial-arts.js');
const {moves,render}=window.MartialArts;
test('all corebook forms and moves have bilingual descriptions and source pages',()=>{
 assert.equal(moves.length,9);
 assert.deepEqual([...new Set(moves.map(m=>m.form))],['Shared','Aikido','Karate','Judo','Taekwondo']);
 for(const move of moves){assert.ok([179,180].includes(move.page));for(const field of ['name','req','effect'])assert.ok(move[field].every(x=>x.length>5));}
});
test('combat reference links to source and shows essential rule thresholds in both languages',()=>{
 for(const lang of ['ru','en']){const html=render(lang);assert.match(html,/1d6/);assert.match(html,/2d6/);assert.match(html,/3d6/);assert.match(html,/4d6/);assert.equal((html.match(/data-action="book-page"/g)||[]).length,9);assert.match(html,/DV13/);assert.match(html,/DV15/);assert.match(html,/−8/);}
});
