const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),test=require('node:test'),assert=require('node:assert/strict');
// The tree editor and the run as the page uses them: through NetTools.render and NetTools.handle, with net-editor.js loaded next to it.
const site=f=>fs.readFileSync(path.join(__dirname,'../site',f),'utf8');
function load(withEditor=true){
 let n=0;const ctx={window:{confirm:()=>true},crypto:{randomUUID:()=>'id'+(++n)}};vm.createContext(ctx);vm.runInContext(site('net-tools.js'),ctx);if(withEditor)vm.runInContext(site('net-editor.js'),ctx);
 const N=ctx.window.NetTools,root={isConnected:true};
 const click=(op,extra={},disabled=false)=>{const button={isConnected:true,dataset:{net:op,...extra},closest:s=>s==='[data-net-root]'?root:null,getAttribute:k=>k==='aria-disabled'&&disabled?'true':null};return {type:'click',target:{closest:s=>s==='[data-net]'?button:null}}};
 const edit=(data,value,type='change')=>({type,target:{dataset:data,value,closest:()=>null}});
 return {ctx,N,E:ctx.window.NetEditor,click,edit};
}
const entry=(id,type,more={})=>({id,type,name:'',dv:8,state:type==='ice'?'waiting':'closed',preset:'',rez:0,maxRez:0,per:0,spd:0,atk:0,def:0,notes:'',...more});
// What a player saved before this feature: three floors in a row, no parent, no runAt.
const saved=()=>[{id:'old',name:'Old vault',access:'',notes:'',rank:4,modifier:0,dv:8,remaining:3,current:'1',floors:[
 {id:'f1',label:'1',branch:'',entries:[entry('p1','password')]},
 {id:'f2',label:'2',branch:'',entries:[entry('i1','ice',{name:'Hellhound',preset:'Hellhound',per:6,spd:6,atk:6,def:2,rez:20,maxRez:20})]},
 {id:'f3',label:'3',branch:'',entries:[]}]}];
function open(h,architectures=saved()){const x={lang:'ru',architectures,characters:[],isCurrent:(a,s)=>a===x.architectures&&s==='owner'};h.N.setScope('other');h.N.setScope('owner');h.N.handle(h.click('open',{id:architectures[0].id}),x);return x}
const order=a=>a.floors.map(f=>f.id+(f.parent===undefined?'':'<'+f.parent)).join(' ');

test('a saved architecture from before the feature validates, draws as a chain and is not rewritten by drawing',()=>{
 const h=load(),x=open(h),before=JSON.stringify(x.architectures);
 assert.equal(h.N.validArchitectures(x.architectures),true);
 const html=h.N.render(x);
 assert.equal((html.match(/<article class="net-floor net-ed-card"/g)||[]).length,3);assert.equal(html.includes('net-ed-branch"'),false,'a chain has no branches');
 assert.equal(html.includes('data-net="floor-up"'),false,'the tree replaces the flat list');assert.match(html,/data-net="run-mode-off" aria-pressed="true"/);
 assert.match(html,/data-net-floor="label" value="2" data-index="1"/);assert.match(html,/data-net="add-entry" data-index="2"/);
 assert.equal(JSON.stringify(x.architectures),before);
});
test('ed-add, ed-up and the move by two presses save and redraw, and keep the list the app holds',()=>{
 const h=load(),x=open(h),all=x.architectures,a=all[0],floors=a.floors;
 let r=h.N.handle(h.click('ed-add',{floor:'f2'}),x);assert.deepEqual({...r},{handled:true,dirty:true,rerender:true,notify:undefined});
 assert.equal(order(a),'f1< f2<f1 f3<f2 id1<f2');assert.equal(a.floors[3].label,'3');assert.equal(h.N.validArchitectures(all),true);
 assert.match(h.N.render(x),/class="net-ed-branch"/);
 r=h.N.handle(h.click('ed-up',{floor:'f2'}),x);assert.equal(r.dirty,true);assert.equal(order(a),'f2< f1<f2 f3<f1 id1<f1');
 assert.deepEqual({...h.N.handle(h.click('ed-up',{floor:'f2'},true),x)},{handled:true},'a button marked aria-disabled is swallowed');
 r=h.N.handle(h.click('ed-move',{floor:'id1'}),x);assert.equal(r.rerender,true);assert.equal(r.dirty,undefined);assert.match(h.N.render(x),/data-net="ed-move-here" data-floor="f3"/);
 r=h.N.handle(h.click('ed-move-here',{floor:'f3'}),x);assert.equal(r.dirty,true);assert.equal(r.notify,'Этаж перенесён.');assert.equal(order(a),'f2< f1<f2 f3<f1 id1<f3');
 assert.equal(x.architectures,all);assert.equal(all[0],a);assert.equal(a.floors,floors);assert.equal(h.N.validArchitectures(all),true);
 // Fields are still addressed by the place in the saved array, which is what the cards print.
 h.N.handle(h.edit({netFloor:'branch',index:'3'},'лаборатория'),x);assert.equal(a.floors[3].id,'id1');assert.equal(a.floors[3].branch,'лаборатория');
});
test('removing a floor after the confirmation moves the floors below it up; cancel and a changed form change nothing',()=>{
 const h=load(),x=open(h),a=x.architectures[0];h.N.handle(h.click('ed-add',{floor:'f1'}),x);
 assert.equal(order(a),'f1< f2<f1 f3<f2 id1<f1');const before=JSON.stringify(a);
 h.ctx.window.confirm=()=>false;assert.deepEqual({...h.N.handle(h.click('remove-floor',{index:'1',floor:'f2'}),x)},{handled:true});assert.equal(JSON.stringify(a),before);
 h.ctx.window.confirm=()=>{a.floors[2].label='typed meanwhile';return true};let r=h.N.handle(h.click('remove-floor',{index:'1',floor:'f2'}),x);assert.equal(r.dirty,undefined);assert.match(r.notify,/изменились/);assert.equal(a.floors.length,4);
 a.floors[2].label='3';h.ctx.window.confirm=()=>true;r=h.N.handle(h.click('remove-floor',{index:'1',floor:'f2'}),x);
 assert.equal(r.dirty,true);assert.equal(order(a),'f1< f3<f1 id1<f1');assert.deepEqual(a.floors.map(f=>f.label),['1','2','2']);assert.equal(h.N.validArchitectures(x.architectures),true);
 r=h.N.handle(h.click('remove-floor',{index:'0',floor:'f1'}),x);assert.equal(order(a),'f3< id1<f3','the first floor below becomes the entrance');
});
test('without net-editor.js a confirmed removal is the plain one and the flat list is drawn',()=>{
 const h=load(false),x=open(h),a=x.architectures[0];
 assert.match(h.N.render(x),/data-net="floor-up"/);assert.equal(h.N.render(x).includes('run-mode'),false);
 assert.deepEqual({...h.N.handle(h.click('ed-add',{floor:'f1'}),x)},{handled:true});assert.deepEqual({...h.N.handle(h.click('run-mode-on'),x)},{handled:true});
 h.N.handle(h.click('remove-floor',{index:'1'}),x);assert.equal(order(a),'f1 f3');h.N.handle(h.click('add-floor'),x);assert.equal(order(a),'f1 f3 id1');
});
test('add-floor the old way on a tree hangs the new floor under the last one',()=>{
 const h=load(),x=open(h),a=x.architectures[0];h.N.handle(h.click('ed-add',{floor:'f3'}),x);h.N.handle(h.click('add-floor'),x);
 assert.equal(order(a),'f1< f2<f1 f3<f2 id1<f3 id2<id1');assert.equal(h.N.validArchitectures(x.architectures),true);
});
test('run mode: the walk replaces the settings, steps are saved, and a change of scope leaves it',()=>{
 const h=load(),x=open(h),a=x.architectures[0];
 let r=h.N.handle(h.click('run-mode-on'),x);assert.deepEqual({...r},{handled:true,dirty:undefined,rerender:true,notify:undefined});
 let html=h.N.render(x);assert.match(html,/data-net-run-floor/);assert.equal(html.includes('data-net-field="name"'),false);assert.match(html,/data-net="run-mode-on" aria-pressed="true"/);assert.match(html,/data-net-combat="mode"/,'the calculator stays');
 assert.match(html,/NET-действия: 3 \/ 3/);h.N.handle(h.click('spend'),x);assert.match(h.N.render(x),/NET-действия: 2 \/ 3/);
 r=h.N.handle(h.click('run-go',{floor:'f2'}),x);assert.equal(r.dirty,true);assert.equal(a.runAt,'f2');assert.equal(a.current,'2');assert.equal(h.N.validArchitectures(x.architectures),true);
 assert.equal(order(a),'f1 f2 f3','walking writes no parents');
 // The state list of an ICE in the run is the editor's own control, addressed by place.
 html=h.N.render(x);assert.match(html,/<select data-net-entry="state" data-index="1" data-entry="0">/);
 h.N.handle(h.edit({netEntry:'state',index:'1',entry:'0'},'pursuing'),x);assert.equal(a.floors[1].entries[0].state,'pursuing');
 r=h.N.handle(h.click('run-rez',{floor:'f2',entry:'i1',delta:'-1'}),x);assert.equal(r.dirty,true);assert.equal(a.floors[1].entries[0].rez,19);
 h.N.setScope('someone-else');h.N.setScope('owner');h.N.handle(h.click('open',{id:'old'}),x);
 assert.equal(h.N.render(x).includes('data-net-run-floor'),false);assert.match(h.N.render(x),/data-net-field="name"/);
});
test('run-ice puts that ICE into the calculator below',()=>{
 const h=load(),x=open(h);h.N.handle(h.click('run-mode-on'),x);h.N.handle(h.click('run-go',{floor:'f2'}),x);
 assert.match(h.N.render(x),/<option value="program" selected>/);
 const r=h.N.handle(h.click('run-ice',{floor:'f2',entry:'i1'}),x);assert.equal(r.rerender,true);
 let html=h.N.render(x);assert.match(html,/<option value="encounter" selected>/);assert.match(html,/<option value="f2:i1" selected>/);assert.match(html,/ICE SPD <strong>6<\/strong>/);
 x.architectures[0].floors[1].entries[0].state='pursuing';h.N.handle(h.click('run-ice',{floor:'f2',entry:'i1'}),x);assert.match(h.N.render(x),/<option value="ice" selected>/);
 assert.deepEqual({...h.N.handle(h.click('run-ice',{floor:'f1',entry:'p1'}),x)},{handled:true},'not an ICE');
});
test('index.html loads the editor right after NetTools, before app.js, with its stylesheet',()=>{
 const html=site('index.html');
 assert.ok(html.includes('<script src="net-tools.js"></script><script src="net-editor.js"></script>'));assert.ok(html.indexOf('net-editor.js')<html.indexOf('<script src="app.js">'));
 assert.ok(html.includes('<link rel="stylesheet" href="net-editor.css">'));assert.ok(fs.existsSync(path.join(__dirname,'../site/net-editor.css')));
});
test('renaming a floor redraws on change, so the card heading and its button names follow; without the editor nothing is redrawn',()=>{
 let h=load(),x=open(h),a=x.architectures[0];
 let r=h.N.handle(h.edit({netFloor:'label',index:'2'},'Co','input'),x);assert.equal(r.dirty,true);assert.equal(!!r.rerender,false,'typing does not redraw under the cursor');
 r=h.N.handle(h.edit({netFloor:'label',index:'2'},'Core'),x);assert.equal(r.dirty,true);assert.equal(r.rerender,true);assert.equal(a.floors[2].label,'Core');
 const html=h.N.render(x);assert.match(html,/<h2 class="net-ed-title">Этаж 3 <span>· Core<\/span><\/h2>/);assert.match(html,/aria-label="Этаж 3 · Core"/);
 h=load(false);x=open(h);r=h.N.handle(h.edit({netFloor:'label',index:'2'},'Core'),x);assert.equal(r.dirty,true);assert.equal(r.rerender,false);
});
test('the stylesheet keeps the feature’s buttons at 44px in the board look, where buttons are 40px by default',()=>{
 const css=site('net-editor.css'),rule=css.split('\n').find(l=>l.startsWith('html.ui-native.ui-board .net-tools :is('));
 assert.ok(rule,'a rule at least as strong as the one in board.css');assert.match(rule,/min-height: 44px/);
 for(const s of ['.net-ed-btn','.net-ed-modes .btn','.net-ed-here','.net-run-path .btn','.net-run .net-actions .btn','.net-run-floor .btn','.net-run-map .btn'])assert.ok(rule.includes(s),s);
 assert.match(css,/\.net-tools \.net-run-floor \.net-actions \.btn \{ min-width: 44px; \}/);
});
