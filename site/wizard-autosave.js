// Autosave for the three creation wizards.
//
// A wizard keeps its state in memory, so a page reload (or a phone unloading a background tab) used to throw the
// unfinished character away. Here every change is written to this device's storage and the wizard picks it up when
// it opens. The explicit «Save draft / Load draft» buttons and their record in the app state stay as they were:
// this is a separate, device-only copy, kept per storage scope and per method.
//
//   { version: 1, scopes: { <scopeId>: { complete|streetrat|edgerunner: { at, data } } } }
(function (global) {
  'use strict';

  const KEY = 'nc-wizard-autosave-v1', METHODS = ['complete', 'streetrat', 'edgerunner'], MAX_BYTES = 200000;
  const TITLES = { complete: 'Complete Package', streetrat: 'Streetrat', edgerunner: 'Edgerunner' };
  // Steps the player walks through before the «created» page.
  const STEPS = { complete: 4, streetrat: 5, edgerunner: 5 };
  const isObject = x => x !== null && typeof x === 'object' && !Array.isArray(x);
  const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const scopeKey = scope => String(scope ?? 'unbound').slice(0, 512);
  let storage = null;
  try { storage = global.localStorage || null; } catch { storage = null; }

  function load(store) {
    try {
      const raw = (store || storage)?.getItem(KEY);
      const all = raw ? JSON.parse(raw) : null;
      return isObject(all) && all.version === 1 && isObject(all.scopes) ? all : { version: 1, scopes: {} };
    } catch { return { version: 1, scopes: {} }; }
  }
  function store(all, target) {
    try {
      const text = JSON.stringify(all);
      if (text.length > MAX_BYTES) return false;
      (target || storage).setItem(KEY, text);
      return true;
    } catch { return false; }
  }

  // -> the saved wizard state, or null. The wizard validates it again before using it.
  function read(scope, method, options) {
    if (!METHODS.includes(method)) return null;
    const entry = load(options?.storage).scopes[scopeKey(scope)]?.[method];
    return isObject(entry) && isObject(entry.data) ? entry.data : null;
  }
  function write(scope, method, data, options) {
    if (!METHODS.includes(method) || !isObject(data)) return false;
    let copy;
    try { copy = JSON.parse(JSON.stringify(data)); } catch { return false; }
    const all = load(options?.storage), key = scopeKey(scope);
    if (!isObject(all.scopes[key])) all.scopes[key] = {};
    all.scopes[key][method] = { at: String(options?.at || new Date().toISOString()), data: copy };
    return store(all, options?.storage);
  }
  function clear(scope, method, options) {
    const all = load(options?.storage), key = scopeKey(scope);
    if (!isObject(all.scopes[key]) || !(method in all.scopes[key])) return false;
    delete all.scopes[key][method];
    if (!Object.keys(all.scopes[key]).length) delete all.scopes[key];
    return store(all, options?.storage);
  }

  // What can be continued in this scope, newest first: [{ method, title, name, step, steps, at }].
  function list(scope, options) {
    const saved = load(options?.storage).scopes[scopeKey(scope)];
    if (!isObject(saved)) return [];
    return METHODS.filter(m => isObject(saved[m]) && isObject(saved[m].data)).map(m => {
      const d = saved[m].data, step = Number(d.step);
      return {
        method: m, title: TITLES[m], name: typeof d.name === 'string' ? d.name.trim().slice(0, 80) : '',
        step: Number.isInteger(step) && step >= 0 ? Math.min(STEPS[m], step + 1) : 1, steps: STEPS[m], at: String(saved[m].at || '')
      };
    }).sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  }

  // A row of «Continue draft» buttons for the Characters page and the method choice. They use the app's own
  // «start-builder» action: the wizard restores the autosaved state when it opens.
  function offerHTML(scope, lang, options) {
    const drafts = list(scope, options), ru = lang !== 'en';
    if (!drafts.length) return '';
    return `<div class="wizard-drafts" role="group" aria-label="${ru ? 'Незавершённые персонажи' : 'Unfinished characters'}">${drafts.map(d =>
      `<button type="button" class="btn ghost wizard-draft" data-action="start-builder" data-method="${d.method}"><b>${ru ? 'Продолжить черновик' : 'Continue draft'}: ${esc(d.name || (ru ? 'без имени' : 'unnamed'))}</b><small>${esc(d.title)} · ${ru ? `шаг ${d.step} из ${d.steps}` : `step ${d.step} of ${d.steps}`}</small></button>`).join('')}</div>`;
  }
  // Streetrat and Edgerunner share one page; after a reload the page has to know which of the two was open.
  const QUICK_KEY = 'nc-wizard-quick-method';
  function rememberQuick(method, options) { try { if (['streetrat', 'edgerunner'].includes(method)) (options?.storage || storage).setItem(QUICK_KEY, method); } catch { /* storage is optional */ } }
  function quickMethod(options) { try { const m = (options?.storage || storage)?.getItem(QUICK_KEY); return ['streetrat', 'edgerunner'].includes(m) ? m : null; } catch { return null; } }
  const note = lang => lang === 'en' ? 'The draft is saved automatically on this device.' : 'Черновик сохраняется автоматически на этом устройстве.';

  global.WizardAutosave = { KEY, METHODS, read, write, clear, list, offerHTML, note, rememberQuick, quickMethod };
})(window);
