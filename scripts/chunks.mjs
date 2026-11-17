// Which scripts the production build keeps out of the file that starts the app (nc-red.js) and loads the first time a
// screen needs them (site/lazy-chunks.js; scripts/build.mjs writes nc-<name>.js and the list the page reads).
//
// A script may only go here when nothing outside its chunk uses what it defines while the app starts or while another
// screen is open: not at load time, not through window.X?.y() in another screen's code, not through a name kept in a
// string (CombatDock reaches the combat calculators that way), and not to validate saved or imported data (NetTools and
// GMTools do that, so they stay in the core file). tests/lazy-chunks.test.cjs checks the parts of this that can be
// checked from the source; everything else was read by hand and is recorded next to each entry.
//
//   files  scripts of site/index.html, in any order (the build keeps index.html's order)
//   probe  a global the files define; the page knows the chunk has run when it exists
//   views  the screens (state.view) that need the chunk; it is loaded before any of them is drawn
//
// The stylesheets of these scripts stay in nc-red.css: moving them would change the order of the cascade.
export const CHUNKS = {
  // The PDF reader of the rules book. Only app.js reaches it: the screen itself (view 'book'), its bookmark and search
  // handlers (both return at once outside that screen) and the «open page» action, which waits for the chunk.
  book: { probe: 'Book', views: ['book'], files: ['book.js', 'book-search.js', 'book-toc.js', 'book-bookmarks.js', 'book-memory.js'] },
  // The «Complete Package» character builder. Its entry point is the choice screen, so both screens load it.
  builder: { probe: 'Builder', views: ['builder', 'builder-choice'], files: ['builder.js'] },
  // The cart of the shop. catalog.js and app.js use it only on the catalog screen and fall back to «no cart» without it.
  shop: { probe: 'ShopCart', views: ['catalog'], files: ['shop-cart.js'] },
  // Not here, on purpose: campaigns (campaign-io.js). Home.nextTurn() opens that screen and presses a button on it in the
  // same breath, which only works when the screen is drawn at once.
  // The repair bench (view 'repair') and the cyber-surgery planner (a card of view 'medical'). Both are reached only from
  // app.js, behind the screen test of their click handlers; the rest of those two screens (crafting, projects, medicine)
  // stays in the core file because the sheet and the calendar use it.
  workshop: { probe: 'RepairTools', views: ['repair', 'medical'], files: ['repair-tools.js', 'cyber-surgery.js'] },
  // The calculators of the combat screen. CombatDock picks them by name for that screen only. vehicle-tools.js is not
  // here on purpose: the vehicle panel of the sheet (garage.js) rolls collision damage through it.
  'combat-calc': { probe: 'HazardTools', views: ['combat'], files: ['autofire-tools.js', 'area-tools.js', 'grapple-tools.js', 'hazard-tools.js'] },
};
