const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const site=path.join(__dirname,'..','site');
test('user-facing strings no longer mention accounts from the removed sign-in layer',()=>{
 for(const f of fs.readdirSync(site).filter(f=>f.endsWith('.js'))){
  const s=fs.readFileSync(path.join(site,f),'utf8');
  assert.ok(!/Аккаунт|Учётная запись|account identity|Account or sheet|campaign members|участникам кампании/.test(s),f+' still mentions accounts');
 }
});
test('every builder view has a translated breadcrumb title',()=>{
 const s=fs.readFileSync(path.join(site,'app.js'),'utf8');
 for(const key of ['builder-choice','quick-builder'])assert.equal(s.split(`'${key}':`).length-1,2,key+' needs RU and EN titles');
});
