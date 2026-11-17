// A very small stand-in for the document, enough to drive the dialogs of the shell (more sheet, palette, quick dice, role dialog):
// elements that can be appended, removed and focused, a class list, and queries that the test answers itself.
const vm = require('node:vm'), fs = require('node:fs');
const camel = k => k.replace(/^data-/, '').replace(/-([a-z])/g, (_, c) => c.toUpperCase());
function makeDoc() {
  const doc = { activeElement: null, listeners: {}, queries: {}, all: [] };
  const classes = () => { const set = new Set(); return { add: (...c) => c.forEach(x => set.add(x)), remove: (...c) => c.forEach(x => set.delete(x)), contains: c => set.has(c), toggle: (c, on) => { if (on === undefined ? !set.has(c) : on) set.add(c); else set.delete(c); }, set }; };
  function el(tag = 'div') {
    const e = { tag, children: [], attrs: {}, dataset: {}, hidden: false, inert: false, isConnected: false, nodeType: 1, className: '', classList: classes(), queries: {}, _html: '', focused: 0,
      set innerHTML(v) { this._html = String(v); }, get innerHTML() { return this._html; },
      setAttribute(k, v) { this.attrs[k] = String(v); if (k.startsWith('data-')) this.dataset[camel(k)] = String(v); },
      getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }, hasAttribute(k) { return k in this.attrs; }, removeAttribute(k) { delete this.attrs[k]; },
      append(...n) { for (const x of n) { this.children.push(x); x.parent = this; x.isConnected = true; } }, appendChild(x) { this.append(x); return x; },
      remove() { this.isConnected = false; if (this.parent) this.parent.children = this.parent.children.filter(c => c !== this); },
      focus() { doc.activeElement = this; this.focused++; },
      contains(x) { for (let n = x; n; n = n.parent) if (n === this) return true; return false; },
      querySelector(sel) { const q = this.queries[sel]; return Array.isArray(q) ? q[0] || null : q || null; },
      querySelectorAll(sel) { const q = this.queries[sel]; return Array.isArray(q) ? q : q ? [q] : []; },
      closest(sel) { return this.closestMap?.[sel] || null; }, scrollIntoView() {}, getClientRects() { return [{}]; } };
    doc.all.push(e); return e;
  }
  doc.body = el('body'); doc.body.isConnected = true;
  doc.documentElement = el('html'); doc.documentElement.lang = 'ru';
  doc.createElement = el; doc.el = el;
  doc.querySelector = sel => { const q = doc.queries[sel]; return Array.isArray(q) ? q[0] || null : q || null; };
  doc.querySelectorAll = sel => { const q = doc.queries[sel]; return Array.isArray(q) ? q : q ? [q] : []; };
  doc.addEventListener = (type, fn) => { (doc.listeners[type] ||= []).push(fn); };
  doc.fire = (type, e) => { for (const f of doc.listeners[type] || []) f(e); return e; };
  return doc;
}
// Loads browser scripts into one window that shares the fake document.
function load(files, extra = {}) {
  const doc = makeDoc(), win = { document: doc, addEventListener() {}, matchMedia: () => ({ matches: false }), ...extra };
  win.window = win;
  const ctx = vm.createContext({ window: win, document: doc, console, Math, Date, JSON, Number, String, Array, Object, Map, Set, Promise, RegExp, Error, setTimeout, clearTimeout, ...extra.globals });
  for (const f of files) vm.runInContext(fs.readFileSync(__dirname + '/../site/' + f, 'utf8'), ctx);
  return { win, doc, ctx };
}
const key = (k, over = {}) => ({ key: k, prevented: 0, preventDefault() { this.prevented++; }, target: null, ...over });
module.exports = { makeDoc, load, key };
