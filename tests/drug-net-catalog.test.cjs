const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..','public','game'),w={};w.window=w;vm.createContext(w);for(const f of ['catalog.js','catalog-extra.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),w,{filename:f});
const item=id=>{const x=w.CATALOG.find(r=>r.id===id);assert.ok(x,id);return x};
test('street drugs expose primary duration, resistance and clinically distinct addiction effects in both languages',()=>{
 const cases=[['black-lace',50,24,17,/REF.*2/i,/REF.*2/i],['blue-glass',20,4,15,/Action/i,/Action/i],['boost',50,24,17,/INT.*2/i,/INT.*2/i],['smash',10,4,15,/Dance.*Contortionist.*Conversation.*Human Perception.*Persuasion.*Acting/i,/Dance.*Contortionist.*Conversation.*Human Perception.*Persuasion.*Acting/i],['synthcoke',20,4,15,/REF.*2/i,/REF.*2/i]];
 for(const [id,price,hours,dv,ru,en] of cases){const x=item('extra-drug-'+id);assert.equal(x.price,price);assert.equal(x.stats.durationHours,hours);assert.equal(x.stats.secondaryDV,dv);assert.match(x.details.ru,ru);assert.match(x.details.en,en);for(const l of ['ru','en']){assert.match(x.details[l],/WILL.*Resist Torture\/Drugs.*1d10/);assert.match(x.details[l],new RegExp('DV'+dv));}assert.ok([357,358].includes(x.page));}
});
test('network fire damage and forced jack out include their ongoing and exit consequences',()=>{
 for(const id of ['extra-program-hellbolt','extra-ice-hellhound']){const x=item(id);assert.match(x.details.ru,/2 HP/);assert.match(x.details.en,/2 HP/);assert.match(x.details.ru,/действи/i);assert.match(x.details.en,/Meat Action/);assert.match(x.details.en,/not stack/);}
 for(const id of ['extra-program-deckkrash','extra-ice-giant']){const x=item(id);assert.match(x.details.ru,/Black ICE/);assert.match(x.details.en,/Black ICE/);assert.match(x.details.en,/encountered/);}assert.match(item('extra-ice-giant').details.en,/excluding this Giant/);
});
