// Everyday words for catalog search: «патроны», «нож», «аптечка», «armor», «knife» ...
// Used by catalogMatches as an addition to the plain text search, never instead of it.
(function () {
  const cat = c => it => it.category === c;
  const ids = (...list) => it => list.includes(it.id);
  const idLike = re => it => re.test(it.id);
  // stems: a query matches when it starts with a stem and adds at most 3 letters (endings).
  const RULES = [
    { stems: ['патрон', 'боеприпас', 'пул', 'обойм', 'ammo', 'bullet', 'cartridge'], test: cat('ammo') },
    { stems: ['брон', 'бронежилет', 'бронекуртк', 'бронекостюм', 'жилет', 'armor', 'armour', 'kevlar', 'vest'], test: cat('armor') },
    { stems: ['куртк', 'jacket', 'leather'], test: ids('armor-leathers', 'armor-kevlar') },
    { stems: ['шлем', 'helmet'], test: ids('armor-light-armorjack', 'armor-medium-armorjack', 'armor-heavy-armorjack', 'armor-metalgear', 'armor-flak') },
    { stems: ['щит', 'shield'], test: idLike(/shield/) },
    { stems: ['нож', 'кинжал', 'knife', 'dagger', 'blade'], test: ids('weapon-light-melee-weapon') },
    { stems: ['меч', 'катана', 'sword', 'katana'], test: ids('weapon-medium-melee-weapon', 'weapon-heavy-melee-weapon', 'weapon-kendachi-mono-three') },
    { stems: ['дубин', 'baton', 'club'], test: ids('weapon-stun-baton', 'weapon-medium-melee-weapon') },
    { stems: ['гранат', 'grenade'], test: it => /grenade-launcher/.test(it.id) || ['ammo-flashbang-ammunition', 'ammo-smoke-ammunition', 'ammo-teargas-ammunition', 'ammo-incendiary-ammunition'].includes(it.id) },
    { stems: ['пистолет', 'pistol', 'handgun'], test: idLike(/pistol/) },
    { stems: ['винтовк', 'rifle'], test: idLike(/rifle/) },
    { stems: ['дробов', 'ружь', 'shotgun'], test: idLike(/shotgun/) },
    { stems: ['автомат', 'smg', 'submachine'], test: idLike(/smg|assault-rifle/) },
    { stems: ['оружи', 'weapon', 'gun'], test: cat('weapon') },
    { stems: ['аптечк', 'медпакет', 'medkit', 'first aid'], test: ids('gear-medtech-bag', 'gear-airhypo', 'gear-personal-carepak', 'gear-medscanner') },
    { stems: ['имплант', 'кибер', 'протез', 'implant', 'cyber', 'prosthe'], test: cat('cyberware') },
    { stems: ['прицел', 'scope', 'sight'], test: idLike(/scope/) },
    { stems: ['рация', 'рации', 'радио', 'radio'], test: idLike(/radio/) },
    { stems: ['телефон', 'phone'], test: idLike(/phone/) },
    { stems: ['отмычк', 'lockpick', 'lock pick'], test: ids('gear-lock-picking-set') },
    { stems: ['еда', 'еду', 'food', 'ration'], test: ids('gear-food-stick', 'gear-mre', 'gear-kibble-pack') },
  ];
  const norm = s => String(s || '').trim().toLocaleLowerCase().replace(/ё/g, 'е');
  const ruleFor = q => RULES.filter(r => r.stems.some(s => {
    const st = norm(s);
    return q.startsWith(st) && q.length <= st.length + 3;
  }));
  window.CatalogSearch = {
    RULES,
    // true when the everyday word in `query` points at this catalog item
    matches(query, item) {
      const q = norm(query);
      if (q.length < 3 || !item) return false;
      return ruleFor(q).some(r => r.test(item));
    },
  };
})();
