const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const scope = {window: {}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'public', 'game', 'rules.js'), 'utf8'), scope);
const rules = scope.window.RULES;
const entry = id => { const matches = rules.filter(r => r.id === id); assert.equal(matches.length, 1, id); return matches[0]; };

test('practical references are uniquely identified, bilingual, searchable and sourced', () => {
  const ids = ['retry-check','complementary-skill','extra-time-check','untrained-skill','conceal-vs-perception','endurance-vs-resist','skill-driving','knowledge-specialties','social-skills','security-skills','repair-item-low','repair-item-high','repair-vehicle-table','repair-failure','cover-material-hp','cover-thickness','shield-actions','human-shields'];
  for (const id of ids) {
    const r = entry(id);
    assert(Number.isInteger(r.page) && r.page >= 129 && r.page <= 184, id);
    for (const lang of ['ru','en']) for (const field of ['category','title','text']) assert(r[field][lang].trim().length > 0, `${id} ${field}.${lang}`);
  }
  assert.equal(entry('repair-item-low').page, 140);
  assert.equal(entry('cover-material-hp').page, 182);
  assert.equal(entry('human-shields').page, 184);
});

test('repair references preserve DV, time and failure distinctions', () => {
  const low = entry('repair-item-low').text.en;
  for (const expected of ['DV 9 and 1 hour','DV 13 and 6 hours','DV 17 and 1 day']) assert(low.includes(expected), expected);
  const high = entry('repair-item-high').text.en;
  for (const expected of ['DV 21 and 1 week','DV 24 and 2 weeks','DV 29 and 1 month','per 10,000 eb']) assert(high.includes(expected), expected);
  const vehicle = entry('repair-vehicle-table').text.en;
  for (const expected of ['DV 9 and 3 hours','DV 13 and 1 day','DV 17 and 1 week']) assert(vehicle.includes(expected), expected);
  assert.match(entry('repair-failure').text.en, /halfway.*start over/);
});

test('check and cover references retain critical restrictions', () => {
  assert.match(entry('retry-check').text.en, /chances improve/);
  assert.match(entry('complementary-skill').text.en, /do not stack/);
  assert.match(entry('extra-time-check').text.en, /four times.*single \+1/);
  assert.match(entry('cover-material-hp').text.en, /steel 50 \/ 25/);
  assert.match(entry('cover-material-hp').text.en, /wood 20 \/ 5/);
  assert.match(entry('cover-thickness').text.en, /Cyberarm or BODY 10/);
});

