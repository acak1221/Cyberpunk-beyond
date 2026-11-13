// Test helper: loads the catalog, CharacterExtra and DoseStock into an existing test context
// so pharmacy code can put doses into the inventory.
const fs = require('node:fs'), vm = require('node:vm');
module.exports = function loadDoseEnv(context) {
  for (const k of ['Date', 'Set', 'Math', 'JSON', 'Object', 'Array', 'Number', 'String']) if (!context[k]) context[k] = globalThis[k];
  if (!context.window) throw new Error('context needs window');
  for (const f of ['catalog.js', 'catalog-extra.js', 'character-extra.js', 'dose-stock.js'])
    vm.runInNewContext(fs.readFileSync(__dirname + '/../site/' + f, 'utf8'), context, { filename: f });
  return context.window.DoseStock;
};
