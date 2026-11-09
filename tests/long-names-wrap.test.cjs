'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const site=f=>fs.readFileSync(path.join(__dirname,'../site',f),'utf8');
// Flat list of [selector, declarations] for the top-level and @media rules of a stylesheet.
function rules(css){
 const out=[];css=css.replace(/\/\*[\s\S]*?\*\//g,'');
 for(const m of css.matchAll(/([^{}@]+)\{([^{}]*)\}/g))out.push([m[1].trim(),m[2]]);
 return out;
}
const decl=(body,prop)=>{const m=new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`).exec(body);return m?m[1].trim():null};
const ORDER=[...site('index.html').matchAll(/<link rel="stylesheet" href="([^":]+\.css)"/g)].map(m=>m[1]);

test('headings wrap long handles and campaign names instead of widening the page',()=>{
 const r=rules(site('styles.css')).find(([sel,body])=>sel.split(',').map(s=>s.trim()).join()==='h1,h2,h3,h4'&&decl(body,'overflow-wrap'));
 assert.ok(r,'a base rule for h1–h4 sets overflow-wrap');
 // "anywhere" (not "break-word") also lowers the min-content width, which flex and grid parents
 // (the phone page header, campaign cards) need to stay inside the screen.
 assert.equal(decl(r[1],'overflow-wrap'),'anywhere');
});
test('no stylesheet switches heading wrapping back off',()=>{
 for(const f of ORDER)for(const [sel,body] of rules(site(f))){
  const v=decl(body,'overflow-wrap')||decl(body,'word-wrap');
  if(v&&v!=='anywhere'&&v!=='break-word')assert.doesNotMatch(sel,/(^|[\s,>])h[1-4](?![\w-])/,`${f}: ${sel} sets overflow-wrap:${v} on a heading`);
  // Headings that hold a character or campaign name must never be forced onto one line.
  if(decl(body,'white-space')==='nowrap')for(const s of sel.split(','))assert.doesNotMatch(s.trim(),/(page-header|sheet-title|campaign-card|char-body)\s+h[1-4]$/,`${f}: ${s.trim()} keeps a name on one line`);
 }
});
test('names in room rosters wrap in every look',()=>{
 const theme=rules(site('theme.css'));
 for(const want of ['.room-member-head strong','.room-char b','.room-order li span','.room-clock b']){
  const r=theme.find(([sel,body])=>sel.split(',').map(s=>s.trim()).includes(want)&&decl(body,'overflow-wrap')==='anywhere');
  assert.ok(r,want);
 }
 assert.ok(ORDER.indexOf('theme.css')>ORDER.indexOf('room.css'),'theme.css loads after room.css');
});
test('clean look: a long page pill moves under the title instead of widening the card',()=>{
 const native=rules(site('native.css'));
 const head=native.find(([sel])=>sel==='html.ui-native .card-heading');
 assert.equal(decl(head[1],'flex-wrap'),'wrap');
 const title=native.find(([sel])=>sel==='html.ui-native .card-heading > span:first-child');
 assert.match(decl(title[1],'flex'),/^1 1 0/,'the title takes the free width first, so short pills stay on its line');
 const pill=native.find(([sel])=>sel==='html.ui-native .nx-page');
 assert.equal(decl(pill[1],'white-space'),'nowrap','a page list is never split inside the pill');
});
