const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const site=f=>fs.readFileSync(path.join(__dirname,'..','site',f),'utf8');

test('every sheet section the tabs rely on exists in the sheet markup',()=>{
 const markup=['app.js','character-extra.js','agent-notes.js'].map(site).join('\n');
 const css=site('theme.css'),tabs=site('sheet-tabs.js');
 const ids=new Set([...css.matchAll(/#(sheet-[a-z-]+|reload-tools-mount)/g)].map(m=>m[1]));
 for(const m of tabs.matchAll(/'((?:sheet-[a-z-]+)|reload-tools-mount)':'/g))ids.add(m[1]);
 assert.ok(ids.size>=12,'expected the tab map to reference the sheet sections');
 for(const id of ids)assert.match(markup,new RegExp(`id="${id}"`),`missing section #${id}`);
});

test('every tab has a matching visibility rule and a label in both languages',()=>{
 const css=site('theme.css'),tabs=site('sheet-tabs.js');
 const list=[...tabs.matchAll(/\['([a-z]+)','([^']+)','([^']+)','[^']+'\]/g)];
 assert.deepEqual(list.map(m=>m[1]),['main','skills','combat','gear','role','life','netrun','all']);
 for(const [,id,ru,en] of list){
  assert.ok(ru&&en&&(ru!==en||id==='netrun'),`tab ${id} needs RU and EN labels`);
  if(id!=='all')assert.match(css,new RegExp(`data-active-tab="${id}"\\] \\.sheet-primary`),`tab ${id} has no visibility rule`);
 }
});

test('quick rolls target buttons that the sheet actually renders',()=>{
 const markup=['app.js','character-extra.js'].map(site).join('\n'),tabs=site('sheet-tabs.js');
 assert.match(markup,/data-action="initiative-roll"/);
 assert.match(markup,/data-action="skill-roll" data-skill=/);
 assert.match(markup,/action\('death-save'/);
 for(const skill of ['Evasion','Brawling'])assert.match(markup,new RegExp(`\\['${skill}'`),`skill ${skill} missing from SKILLS`);
 assert.match(tabs,/\[data-cx-action="death-save"\]/);
});
