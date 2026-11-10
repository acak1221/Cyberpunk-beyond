/* Theme switch (Auto / Dark / Light) for the clean look. Light only applies with html.ui-native. */
(function(global){
'use strict';
const doc=global.document,root=doc.documentElement,KEY='nc-ui-theme',MODES=['auto','dark','light'];
const COLORS={dark:'#11110f',light:'#f2f2f4'};
function get(){try{const v=global.localStorage.getItem(KEY);return MODES.includes(v)?v:'auto'}catch{return 'auto'}}
function put(m){try{global.localStorage.setItem(KEY,m)}catch{}}
function prefersLight(){try{return !!(global.matchMedia&&global.matchMedia('(prefers-color-scheme: light)').matches)}catch{return false}}
function isLight(mode){return root.classList.contains('ui-native')&&(mode==='light'||(mode==='auto'&&prefersLight()))}
function paint(){
 const mode=get();
 for(const b of doc.querySelectorAll('[data-ui-theme]')){const on=b.dataset.uiTheme===mode;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on))}
}
function apply(){
 const mode=get(),light=isLight(mode);
 root.classList.toggle('ui-light',light);
 // The web fonts belong to the «Киберпанк» look only; the default look uses the fonts of the device and asks Google for nothing.
 if(!root.classList.contains('ui-native'))global.ncFonts?.();
 const meta=doc.querySelector('meta[name="theme-color"]');
 if(meta)meta.setAttribute('content',light?COLORS.light:COLORS.dark);
 paint();
}
function set(mode){if(!MODES.includes(mode))return false;put(mode);apply();return true}
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
global.ThemeSwitch={MODES,get,set,apply,isLight};
})(window);
