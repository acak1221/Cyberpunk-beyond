// Character list card extras (site/card-info.js): money and wound state.
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
function load() {
  const w = {}; w.window = w;
  vm.createContext(w);
  for (const f of ['wallet.js', 'card-info.js']) vm.runInContext(fs.readFileSync(__dirname + '/../site/' + f, 'utf8'), w);
  return w.CardInfo;
}

test('wound state follows the sheet thresholds', () => {
  const C = load();
  assert.equal(C.wound(45, 45), 'full');
  assert.equal(C.wound(44, 45), 'light');
  assert.equal(C.wound(22, 45), 'serious');
  assert.equal(C.wound(23, 45), 'light');
  assert.equal(C.wound(0, 45), 'mortal');
});

test('money is formatted with the wallet and an old save without money shows 0', () => {
  const C = load();
  assert.match(C.html({ hp: 45, extra: { cash: 1234567 } }, 'ru', 45), /1 234 567 eb/);
  assert.match(C.html({ hp: 45 }, 'en', 45), /0 eb/);
});

test('a healthy character has no wound line, a hurt one has it in the chosen language', () => {
  const C = load();
  assert.doesNotMatch(C.html({ hp: 45 }, 'ru', 45), /char-wound/);
  assert.match(C.html({ hp: 10 }, 'ru', 45), /Тяжёлое ранение/);
  assert.match(C.html({ hp: 0 }, 'en', 45), /Mortally wounded/);
});

test('files are registered', () => {
  const h = fs.readFileSync(__dirname + '/../site/index.html', 'utf8');
  assert.ok(h.includes('card-info.js') && h.includes('card-info.css'));
});
