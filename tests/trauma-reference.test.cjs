const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const scope={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../public/game/rules.js'),'utf8'),scope);
const rules=scope.window.RULES;
const entry=id=>{const rows=rules.filter(r=>r.id===id);assert.equal(rows.length,1,id);return rows[0]};
const ids=['hospital-pricing','hospital-stay-payment','trauma-team-transfer','trauma-team-call','trauma-team-response','replacement-parts','found-cyberware','cyber-surgery-install'];
test('new treatment references are bilingual, uniquely identified and linked to printed pages',()=>{
 const page={ 'hospital-pricing':225,'hospital-stay-payment':225,'trauma-team-transfer':224,'trauma-team-call':224,'trauma-team-response':224,'replacement-parts':226,'found-cyberware':226,'cyber-surgery-install':226 };
 for(const id of ids){const r=entry(id);assert.equal(r.page,page[id]);for(const lang of ['ru','en'])for(const field of ['title','category','text'])assert.ok(r[field][lang].trim());}
 assert.equal(new Set(rules.map(r=>r.id)).size,rules.length);
});
test('hospital fees and recoverable body parts retain the price thresholds and distinctions',()=>{
 const h=entry('hospital-pricing').text.en;for(const v of ['DV 10 costs 50 eb','DV 13 costs 100 eb','DV 15 costs 500 eb','DV 17 or higher costs 1,000 eb'])assert.ok(h.includes(v),v);assert.match(h,/only for the highest DV/);assert.match(entry('hospital-stay-payment').text.en,/100 eb per night/);
 const r=entry('replacement-parts').text.en;assert.match(r,/no upgrade slots/);assert.match(r,/no Humanity Loss/);assert.match(r,/pay separately/);
});
test('Trauma Team coverage and automated call preserve prerequisites and timing',()=>{
 const c=entry('trauma-team-call').text.en;assert.match(c,/registered to an Agent linked to a Biomonitor/);assert.match(c,/HP is below BODY/);assert.match(c,/Critical Injury dismembers a body part/);assert.match(c,/normal call when injured takes an Action/i);assert.match(c,/1d6/);
 const plan=entry('trauma-team-transfer').text.en;assert.match(plan,/two friends at once/);assert.match(plan,/Silver charges hospital prices/);assert.match(plan,/Executive includes/);assert.match(entry('trauma-team-response').text.en,/cannot dodge bullets/);
});
test('cyberware recovery keeps the surgical limits, failure costs and exception',()=>{
 const h=entry('found-cyberware').text.en;assert.match(h,/Only a Medtech/);assert.match(h,/removable with an Action/);assert.match(h,/each take 4 hours/);assert.match(h,/destroys the cyberware and wastes 2 hours/);
 const s=entry('cyber-surgery-install').text.en;assert.match(s,/normal Humanity Loss/);assert.match(s,/only when.*Mall/);assert.match(s,/DV 13 for Mall, 15 for Clinic, and 17 for Hospital/);
});
test('Russian and English hospital queries find the same entries through the app fields',()=>{
 const search=q=>rules.filter(r=>[r.title.ru,r.title.en,r.text.ru,r.text.en,r.category.ru,r.category.en,String(r.page)].some(v=>String(v).toLocaleLowerCase().includes(q.toLocaleLowerCase()))).map(r=>r.id);
 for(const [ru,en,id] of [['стоимость лечения','treatment costs','hospital-pricing'],['утраченных частей','lost body parts','replacement-parts'],['извлечение киберимплантов','harvesting cyberware','found-cyberware']]){assert(search(ru).includes(id));assert(search(en).includes(id));}
});
