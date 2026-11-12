// Remembers who the shop buys for, per device. Safe when storage is blocked or the character is gone.
(function () {
  const KEY = 'nc-shop-buyer';
  const store = () => { try { return window.localStorage || null; } catch { return null; } };
  window.ShopMemory = {
    KEY,
    set(id) {
      const s = store();
      try { if (!s) return; if (id) s.setItem(KEY, String(id)); else s.removeItem(KEY); } catch { /* storage blocked */ }
    },
    // The remembered id, only when a character with that id still exists in `characters`; otherwise ''.
    get(characters) {
      const s = store();
      let id = '';
      try { id = (s && s.getItem(KEY)) || ''; } catch { id = ''; }
      return id && (characters || []).some(c => c && c.id === id) ? id : '';
    },
  };
})();
