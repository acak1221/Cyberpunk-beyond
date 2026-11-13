const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const w={};vm.runInNewContext(fs.readFileSync(__dirname+'/../site/wizard-steps.js','utf8'),{window:w});
const W=w.WizardSteps,plain=x=>JSON.parse(JSON.stringify(x));
const err=(step,field,ru='r'+step+field,en='e'+step+field)=>({step,ru,en,field});

test('progress: no errors means every step before the last is done',()=>{
 const p=plain(W.progress([],4));assert.equal(p.reachable,3);assert.deepEqual(p.states,['done','done','done','ready']);
});
test('progress: the first unfinished step is the frontier, later steps are locked',()=>{
 const p=plain(W.progress([err(1,'a'),err(2,'b'),err(3,'c')],4));assert.equal(p.reachable,1);assert.deepEqual(p.states,['done','todo','locked','locked']);
 assert.deepEqual(plain(W.progress([err(3,'x')],5).states),['done','done','done','todo','locked']);
});
test('resolve: back is free, forward is capped at the frontier, values are clamped',()=>{
 const errs=[err(2,'f')];
 assert.deepEqual(plain(W.resolve(errs,4,3,0)),{step:0,blocked:false});
 assert.deepEqual(plain(W.resolve(errs,4,2,1)),{step:1,blocked:false});
 assert.deepEqual(plain(W.resolve(errs,4,0,2)),{step:2,blocked:false});
 assert.deepEqual(plain(W.resolve(errs,4,2,3)),{step:2,blocked:true});
 assert.deepEqual(plain(W.resolve(errs,4,0,9)),{step:2,blocked:true});
 assert.deepEqual(plain(W.resolve([],4,0,9)),{step:3,blocked:false});
 assert.deepEqual(plain(W.resolve(errs,4,2,-5)),{step:0,blocked:false});
});
test('stepErrors de-duplicates and firstField follows the order of the errors',()=>{
 const errs=[err(0,''),err(1,'#a','same','same'),err(1,'#b','same','same'),err(1,'#c','other','other')];
 assert.equal(W.stepErrors(errs,1).length,2);assert.equal(W.firstField(errs,1),'#a');assert.equal(W.firstField(errs,0),null);assert.equal(W.firstField(errs,2),null);
});
test('sel escapes quotes and backslashes',()=>{
 assert.equal(W.sel('data-x'),'[data-x]');assert.equal(W.sel('data-x','a'),'[data-x="a"]');assert.equal(W.sel('data-x','a"b\\c'),'[data-x="a\\"b\\\\c"]');assert.equal(W.sel('data-x',0),'[data-x="0"]');
});
test('listHTML escapes text and is empty for an empty list',()=>{
 assert.equal(W.listHTML('T',[]),'');
 const html=W.listHTML('<T>',[{label:'<b>x</b>',value:5},{label:'y',value:''},{label:'z',value:null}]);
 assert.ok(!html.includes('<b>x</b>'));assert.match(html,/&lt;T&gt;/);assert.match(html,/<b>5<\/b>/);assert.equal((html.match(/<b>/g)||[]).length,1);
});
function el(tag,extra={}){const attrs={...(extra.attrs||{})};return {tagName:tag,disabled:false,focused:0,scrolled:0,closest:s=>extra.hidden&&s==='[hidden]'?{}:null,hasAttribute:k=>k in attrs,setAttribute(k,v){attrs[k]=String(v)},removeAttribute(k){delete attrs[k]},getAttribute:k=>attrs[k],focus(){this.focused++},scrollIntoView(){this.scrolled++},attrs}}
function root(map){return {querySelector:s=>{if(s==='bad[')throw new Error('x');return map[s]||null},querySelectorAll:s=>s==='[data-wz-invalid]'?Object.values(map).filter(n=>'data-wz-invalid' in n.attrs):[]}}
test('focus: focuses the target, falls back to the errors box, sets tabindex on non-controls',()=>{
 const input=el('INPUT'),box=el('DIV'),hid=el('INPUT',{hidden:true}),meter=el('DIV');
 const r=root({'#in':input,'[data-wizard-errors]':box,'#hid':hid,'#meter':meter});
 assert.equal(W.focus(r,'#in'),true);assert.equal(input.focused,1);assert.equal(input.scrolled,1);assert.equal(input.attrs.tabindex,undefined);
 assert.equal(W.focus(r,'#hid'),true);assert.equal(hid.focused,0);assert.equal(box.focused,1);assert.equal(box.attrs.tabindex,'-1');
 assert.equal(W.focus(r,'bad['),true);assert.equal(box.focused,2);
 assert.equal(W.focus(r,'#meter'),true);assert.equal(meter.attrs.tabindex,'-1');
 assert.equal(W.focus(root({}),'#none'),false);
});
test('mark sets aria-invalid on controls only and clears it again',()=>{
 const a=el('INPUT'),b=el('SELECT'),d=el('DIV'),r=root({'#a':a,'#b':b,'#d':d});
 W.mark(r,['#a','#d','#none','bad[']);assert.equal(a.attrs['aria-invalid'],'true');assert.equal(d.attrs['aria-invalid'],undefined);
 W.mark(r,['#b']);assert.equal(a.attrs['aria-invalid'],undefined);assert.equal(b.attrs['aria-invalid'],'true');
 W.mark(r,[]);assert.equal(b.attrs['aria-invalid'],undefined);assert.equal(b.attrs['data-wz-invalid'],undefined);
});
