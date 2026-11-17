'use strict';
/* Deterministic waiting for the room tests.
   The room code does its work through short timers (setTimeout 0..24 ms) and the browser's crypto promises. A fixed sleep
   ("settle(30)") passes on a quiet machine and fails on a busy one, because the work was simply not finished yet.
   This helper counts exactly that pending work: crypto calls in flight and short timers not yet fired.
   settle() resolves when nothing of it is left (checked on three quiet turns in a row), however long that takes,
   and when something never finishes it fails loudly instead of letting an assertion guess.
   Timers longer than SHORT (debounces, grace periods) are not waited for unless the test asks for a real pause:
   settle(520) first sleeps 520 ms of real time, as before, and then waits for the pending work. */
const real = { setTimeout, clearTimeout };
const SHORT = 100, GIVE_UP = 30000;
const live = new Set();
let busy = 0;

function timeout(f, ms, ...args) {
  if ((Number(ms) || 0) > SHORT) return real.setTimeout(f, ms, ...args);
  const h = real.setTimeout(() => { live.delete(h); f(...args); }, ms);
  live.add(h);
  return h;
}
function clear(h) { live.delete(h); return real.clearTimeout(h); }

const nativeSubtle = globalThis.crypto.subtle;
const subtle = new Proxy(nativeSubtle, {
  get(target, key) {
    const value = Reflect.get(target, key, target);
    if (typeof value !== 'function') return value;
    return (...args) => {
      busy++;
      let result;
      try { result = value.apply(target, args); } catch (e) { busy--; throw e; }
      return Promise.resolve(result).then(x => { busy--; return x; }, e => { busy--; throw e; });
    };
  },
});
const crypto = {
  subtle,
  getRandomValues: a => globalThis.crypto.getRandomValues(a),
  randomUUID: () => globalThis.crypto.randomUUID(),
};

// A clock the page under test can be given as its Date: it follows the real clock until a test freezes it. Frozen, it moves
// only when the test lets time pass (settle(ms) and until() advance it), so rate limits and grace periods are measured on
// the messages sent and not on how busy the machine is.
let frozen = null, step = 0;
const read = () => { if (frozen === null) return Date.now(); const at = frozen; frozen += step; return at; };
class FakeDate extends Date {
  constructor(...a) { if (a.length) super(...a); else super(read()); }
  static now() { return read(); }
}
// freeze(): the clock stands still until the test lets time pass. freeze(at, 1): every reading is one millisecond later than
// the one before, so events stay in order without the machine's speed deciding how much time has passed between them.
const freeze = (at, each = 0) => { frozen = at === undefined || at === null ? Date.now() : at; step = each; };
const thaw = () => { frozen = null; step = 0; };
const pending = () => busy + live.size;
async function idle() {
  const start = Date.now();
  let calm = 0;
  while (calm < 3) {
    await new Promise(r => setImmediate(r));
    if (pending() === 0) calm++; else calm = 0;
    if (Date.now() - start > GIVE_UP) throw new Error('the room still has work in flight after ' + GIVE_UP + ' ms (' + busy + ' crypto calls, ' + live.size + ' short timers)');
  }
}
async function settle(ms = 0) {
  if (ms >= 250) await new Promise(r => real.setTimeout(r, ms));
  if (frozen !== null) frozen += ms;
  await idle();
}
// Waits for a condition that depends on real elapsed time (a debounce, a grace period): polls every 10 ms for up to 15 s.
async function until(f, what = 'condition', limit = 15000) {
  const start = Date.now();
  for (;;) {
    await idle();
    if (await f()) return;
    if (Date.now() - start > limit) throw new Error('timed out: ' + what);
    await new Promise(r => real.setTimeout(r, 10));
    if (frozen !== null) frozen += 10;
  }
}
module.exports = { Date: FakeDate, freeze, thaw, timeout, clear, crypto, settle, idle, pending, until };
