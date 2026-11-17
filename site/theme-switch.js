/* Theme switch (Auto / Dark / Light / Black) for the clean and dossier looks. Light and Black apply only with html.ui-native:
   the cyberpunk look has its own palette, and the switch says so instead of doing nothing in silence. */
(function(global){
'use strict';
const doc=global.document,root=doc.documentElement,KEY='nc-ui-theme',MODES=['auto','dark','light','black'];
const COLORS={dark:'#11110f',light:'#f2f2f4',black:'#000000'};
const NOTE={
 ru:'В «Киберпанке» своя палитра: светлая и чёрная темы там не действуют. Они работают в «Обычном» и «Досье».',
 en:'The Cyberpunk look has its own palette, so the light and black themes do not apply there. They work in the Clean and Dossier looks.'
};
function get(){try{const v=global.localStorage.getItem(KEY);return MODES.includes(v)?v:'auto'}catch{return 'auto'}}
function put(m){try{global.localStorage.setItem(KEY,m)}catch{}}
function prefersLight(){try{return !!(global.matchMedia&&global.matchMedia('(prefers-color-scheme: light)').matches)}catch{return false}}
function isLight(mode){return root.classList.contains('ui-native')&&(mode==='light'||(mode==='auto'&&prefersLight()))}
function isBlack(mode){return root.classList.contains('ui-native')&&mode==='black'}
// True when the chosen theme cannot show in the current look (cyberpunk keeps its own palette).
function ignoredHere(mode=get()){return !root.classList.contains('ui-native')&&(mode==='light'||mode==='black')}
function note(lang){return ignoredHere()?NOTE[lang==='en'?'en':'ru']:''}
function pageLang(){try{return global.App?.lang?.()==='en'?'en':'ru'}catch{return 'ru'}}
function paint(){
 const mode=get(),ignored=!root.classList.contains('ui-native'),text=ignored?NOTE[pageLang()]:'';
 // The note under the theme group follows the look and the theme at once, not only at the next redraw of the page.
 for(const n of doc.querySelectorAll('[data-set-theme-note]')){n.textContent=ignored&&(mode==='light'||mode==='black')?text:'';n.hidden=!n.textContent}
 for(const b of doc.querySelectorAll('[data-ui-theme]')){
  const on=b.dataset.uiTheme===mode;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));
  // In the cyberpunk look light and black cannot show: the button says so to a screen reader and points at the note.
  const off=ignored&&(b.dataset.uiTheme==='light'||b.dataset.uiTheme==='black');
  if(b.closest('.set-page')){
   if(off){b.setAttribute('aria-describedby','set-theme-note');b.dataset.ignored='1'}else{b.removeAttribute('aria-describedby');delete b.dataset.ignored}
  }
 }
}
function apply(){
 const mode=get(),light=isLight(mode),black=isBlack(mode);
 root.classList.toggle('ui-light',light);
 root.classList.toggle('ui-black',black);
 const meta=doc.querySelector('meta[name="theme-color"]');
 if(meta)meta.setAttribute('content',black?COLORS.black:light?COLORS.light:COLORS.dark);
 paint();
}
function set(mode){
 if(!MODES.includes(mode))return false;put(mode);apply();
 // A theme that the current look cannot show is not applied in silence: say why, in the page language.
 if(ignoredHere(mode)){try{const l=global.App?.lang?.()==='en'?'en':'ru';global.App?.notify?.(NOTE[l])}catch{}}
 return true;
}
doc.addEventListener('click',e=>{
 const t=e.target&&e.target.closest&&e.target.closest('[data-ui-theme]');
 if(t){set(t.dataset.uiTheme);return}
 if(e.target&&e.target.closest&&e.target.closest('[data-ui-style]'))global.setTimeout(apply,0);
});
try{const mq=global.matchMedia&&global.matchMedia('(prefers-color-scheme: light)');if(mq){const h=()=>{if(get()==='auto')apply()};mq.addEventListener?mq.addEventListener('change',h):mq.addListener&&mq.addListener(h)}}catch{}
let queued=false;
function schedule(){if(queued)return;queued=true;global.requestAnimationFrame(()=>{queued=false;paint()})}
function start(){apply();const app=doc.querySelector('#app');if(app)new MutationObserver(schedule).observe(app,{childList:true,subtree:true})}
if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',start);else start();
global.ThemeSwitch={MODES,get,set,apply,isLight,isBlack,ignoredHere,note,NOTE,COLORS};
})(window);
