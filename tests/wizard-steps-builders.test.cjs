const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const code=name=>fs.readFileSync(__dirname+'/../site/'+name,'utf8');
function setup(){
 const m=code('app.js').match(/const SKILLS = \[[\s\S]*?\n\];/);assert(m);let seq=0;const w={},sandbox={window:w,confirm:()=>true,console,Math,Date,JSON,Set,Map,Number,String,Array,Object,Promise,WeakMap};
 sandbox.globalThis=sandbox;sandbox.crypto={randomUUID:()=>'id-'+(++seq)};vm.createContext(sandbox);vm.runInContext(m[0]+';window.testSkills=SKILLS;',sandbox);
 for(const name of ['rules.js','catalog.js','catalog-extra.js','equipment-tools.js','reload-tools.js','archetypes.js','wizard-steps.js','builder.js','quick-builder.js'])vm.runInContext(code(name),sandbox,{filename:name});
 return w;
}
let n=0;
function cctx(w,over={}){return {lang:'en',scopeId:'wz-'+(++n),skills:w.testSkills,roles:w.ROLES,...over}}
// ---- Complete Package helpers
function bInput(w,c,attr,key,value,type='input'){const ds={[attr]:key};if(attr==='data-builder-extra'){}const attrs={['data-'+attr.slice(5).replace(/[A-Z]/g,x=>'-'+x.toLowerCase())]:true};return w.Builder.handle({type,target:{value:String(value),dataset:{builderField:key,builderStat:key,builderSkill:key,builderSpecific:key},hasAttribute:k=>k===attr,closest:()=>null}},c)}
const bField=(w,c,k,v)=>bInput(w,c,'data-builder-field',k,v);
const bStat=(w,c,k,v)=>bInput(w,c,'data-builder-stat',k,v);
const bSkill=(w,c,k,v)=>bInput(w,c,'data-builder-skill',k,v);
const bSpec=(w,c,k,v)=>bInput(w,c,'data-builder-specific',k,v);
function bClick(w,c,action,data={}){const button={dataset:{builderAction:action,...data}};return w.Builder.handle({type:'click',target:{closest:s=>s==='[data-builder-action]'?button:null}},c)}
function fillStep0(w,c){bField(w,c,'name','Nova');bField(w,c,'native','English')}
function fillSkills(w,c){
 for(const s of w.testSkills)if(s[4])bSkill(w,c,s[0],2);
 for(const s of w.testSkills){if(w.Builder.analyze(c).skillSum>=86)break;if(s[3]!==1||s[4]||w.Builder.SPEC.includes(s[0]))continue;for(let v=1;v<=6&&w.Builder.analyze(c).skillSum<86;v++)bSkill(w,c,s[0],v)}
 assert.equal(w.Builder.analyze(c).skillSum,86);
}
test('Complete Package: Next on a fresh wizard stays on step 0 and focuses the handle',()=>{
 const w=setup(),c=cctx(w);let html=w.Builder.render(c);assert.doesNotMatch(html,/data-wizard-errors/);
 const r=bClick(w,c,'next');assert.equal(r.focus,'[data-builder-field="name"]');assert.equal(r.rerender,true);
 html=w.Builder.render(c);assert.match(html,/data-wizard-errors/);assert.match(html,/Enter a handle/);assert.match(html,/Enter your native language/);assert.match(html,/class="wz-error-link"/);assert.match(html,/data-builder-focus="\[data-builder-field=&quot;name&quot;\]"/);
 assert.match(html,/wz-step wz-todo active/);assert.match(html,/wz-locked/);
});
test('Complete Package: finished steps unlock the next ones; the skills step blocks Next',()=>{
 const w=setup(),c=cctx(w);w.Builder.render(c);fillStep0(w,c);
 assert.equal(bClick(w,c,'next').focus,undefined);assert.match(w.Builder.render(c),/02 \/ 04/);
 assert.equal(bClick(w,c,'next').focus,undefined);assert.match(w.Builder.render(c),/03 \/ 04/);
 const r=bClick(w,c,'next');assert.equal(r.focus,'[data-builder-meter="skills"]');assert.match(w.Builder.render(c),/03 \/ 04/,'still on the skills step');
 const strip=w.Builder.render(c).match(/<div class="builder-progress"[\s\S]*?<\/div>/)[0];
 assert.match(strip,/data-builder-step="0" class="wz-step wz-done"/);assert.match(strip,/data-builder-step="1" class="wz-step wz-done"/);assert.match(strip,/data-builder-step="2" class="wz-step wz-todo active"/);assert.match(strip,/data-builder-step="3" class="wz-step wz-locked" aria-disabled="true"/);
});
test('Complete Package: step buttons go back freely and forward only through finished steps',()=>{
 const w=setup(),c=cctx(w);w.Builder.render(c);fillStep0(w,c);bClick(w,c,'step',{builderStep:'2'});assert.match(w.Builder.render(c),/03 \/ 04/);
 const blocked=bClick(w,c,'step',{builderStep:'3'});assert.ok(blocked.focus);assert.match(w.Builder.render(c),/03 \/ 04/);
 bClick(w,c,'step',{builderStep:'0'});assert.match(w.Builder.render(c),/01 \/ 04/);
 bClick(w,c,'step',{builderStep:'2'});assert.match(w.Builder.render(c),/03 \/ 04/);
});
test('Complete Package: a specialization without a name points at its own field',()=>{
 const w=setup(),c=cctx(w);w.Builder.render(c);fillStep0(w,c);bSkill(w,c,'Science',2);
 const e=w.Builder.analyze(c).errors.find(x=>x.field==='[data-builder-specific="Science"]');assert.ok(e);
 bClick(w,c,'step',{builderStep:'2'});bClick(w,c,'step',{builderStep:'3'});
 assert.equal(w.Builder.analyze(c).errors.filter(x=>x.step===2)[0].field!==undefined,true);
});
test('Complete Package: a draft or autosave on a later step reopens on the first unfinished one',()=>{
 const w=setup();let stored={version:1,data:{name:'',native:'',role:'solo',step:3}};const c=cctx(w,{readDraft:()=>stored,saveDraft:x=>(stored=x,true)});
 assert.equal(bClick(w,c,'load').rerender,true);const html=w.Builder.render(c);assert.match(html,/01 \/ 04/);assert.match(html,/data-builder-field="name"/);
});
test('Complete Package: a valid review has no error list and shows stat and skill chips',()=>{
 const w=setup(),c=cctx(w);w.Builder.render(c);fillStep0(w,c);fillSkills(w,c);
 bClick(w,c,'step',{builderStep:'3'});const html=w.Builder.render(c);
 assert.match(html,/04 \/ 04/);assert.doesNotMatch(html,/builder-validation/);assert.match(html,/builder-success/);assert.match(html,/class="wz-review"/);assert.match(html,/<h3>STATs<\/h3>/);assert.match(html,/<h3>Skills<\/h3>/);assert.match(html,/<b>6<\/b>/);assert.doesNotMatch(html,/disabled>Create|data-builder-action="create" disabled/);
});
// ---- Quick builder helpers
function qEvent(w,c,attrs,value='',type='change',checked=false){const target={value,checked,hasAttribute:k=>Object.hasOwn(attrs,k),getAttribute:k=>attrs[k],closest:()=>null};return w.QuickBuilder.handle({target,type},c)}
function qAction(w,c,name,attrs={}){const button={getAttribute:k=>k==='data-quick-action'?name:attrs[k]};return w.QuickBuilder.handle({type:'click',target:{closest:()=>button}},c)}
const qctx=(w,role,method)=>({lang:'en',skills:w.testSkills,roles:w.ROLES,method,scopeId:'q-'+(++n),readDraft:()=>undefined,saveDraft:()=>true,createCharacter:x=>x.id});
function qFinish(w,c,role,choice){const t=w.Archetypes.getTemplate(role);qEvent(w,c,{'data-quick-field':'name'},'Nova','input');qEvent(w,c,{'data-quick-field':'native'},'English','input');
 if(role!=='solo')qEvent(w,c,{'data-quick-role':''},role);
 const rows=c.method==='streetrat'?1:10;for(let i=0;i<rows;i++)qEvent(w,c,{'data-quick-roll':String(i)},'1');
 for(const s of t.streetratSkills)if(s.needsSpecialty)qEvent(w,c,{'data-quick-specialty':s.name},'Test','input');
 for(const k of ['gear','outfit','cyberware'])t[k].forEach((it,i)=>{if(it.type==='choice')qEvent(w,c,{'data-quick-choice-section':k,'data-quick-choice-index':String(i)},String(choice?.[k]?.[i]??0))});
 qEvent(w,c,{'data-quick-confirm':'confirmGear'},'','change',true);qEvent(w,c,{'data-quick-confirm':'confirmCyber'},'','change',true)}
test('Quick: Next on a fresh Streetrat stays on step 0, then step 1 without a roll focuses the roll',()=>{
 const w=setup(),c=qctx(w,'solo','streetrat');w.QuickBuilder.render(c);
 assert.equal(qAction(w,c,'next').focus,'[data-quick-field="name"]');
 qEvent(w,c,{'data-quick-field':'name'},'Nova','input');qEvent(w,c,{'data-quick-field':'native'},'English','input');
 assert.equal(qAction(w,c,'next').focus,undefined);
 const r=qAction(w,c,'next');assert.equal(r.focus,'[data-quick-roll="0"]');
 const html=w.QuickBuilder.render(c);assert.match(html,/Check this step/);assert.match(html,/class="wz-error-link"/);assert.match(html,/wz-locked/);
});
test('Quick: Edgerunner points at the first missing roll',()=>{
 const w=setup(),c=qctx(w,'solo','edgerunner');w.QuickBuilder.render(c);qEvent(w,c,{'data-quick-field':'name'},'Nova','input');qEvent(w,c,{'data-quick-field':'native'},'English','input');
 for(let i=0;i<4;i++)qEvent(w,c,{'data-quick-roll':String(i)},'3');
 qAction(w,c,'next');assert.equal(qAction(w,c,'next').focus,'[data-quick-roll="4"]');
});
test('Quick: ammunition mismatch and missing confirmation point at the right controls',()=>{
 const w=setup(),c=qctx(w,'tech','streetrat');w.QuickBuilder.render(c);qFinish(w,c,'tech',{gear:{0:0,1:1}});
 const errs=w.QuickBuilder.analyze(c).errors;assert.equal(errs.find(e=>/matching/.test(e.en)).field,'[data-quick-choice-section="gear"][data-quick-choice-index="1"]');
 qEvent(w,c,{'data-quick-choice-section':'gear','data-quick-choice-index':'1'},'0');qEvent(w,c,{'data-quick-confirm':'confirmGear'},'','change',false);
 assert.equal(w.QuickBuilder.analyze(c).errors[0].field,'[data-quick-confirm="confirmGear"]');
});
test('Quick: the review lists skills, loaded weapons, gear and cyberware and no error links',()=>{
 const w=setup(),c=qctx(w,'solo','streetrat');w.QuickBuilder.render(c);qFinish(w,c,'solo');
 qAction(w,c,'step',{'data-quick-step':'4'});const html=w.QuickBuilder.render(c);
 assert.match(html,/05 \/ 05/);assert.match(html,/<h3>Skills<\/h3>/);assert.match(html,/<h3>Weapons<\/h3>/);assert.match(html,/25\/25 loaded/);assert.match(html,/<h3>Gear and clothing<\/h3>/);assert.match(html,/<h3>Cyberware<\/h3>/);assert.doesNotMatch(html,/wz-error-link|quick-error-link/);
 const ru=w.QuickBuilder.render({...c,lang:'ru'});assert.match(ru,/в магазине 25\/25/);
});
test('Quick: typing keeps the strip and the errors box current without replacing the field',()=>{
 const w=setup(),c=qctx(w,'solo','streetrat');w.QuickBuilder.render(c);qAction(w,c,'next');
 const nodes={};let strip={outerHTML:'old'},box={innerHTML:'old'};const root={querySelector:s=>s==='[data-quick-progress]'?strip:s==='[data-quick-errors]'?box:null,querySelectorAll:()=>[]};
 w.QuickBuilder.refresh(root,c);assert.match(strip.outerHTML,/data-quick-progress/);assert.match(box.innerHTML,/data-wizard-errors/);
 qEvent(w,c,{'data-quick-field':'name'},'Nova','input');qEvent(w,c,{'data-quick-field':'native'},'English','input');w.QuickBuilder.refresh(root,c);assert.equal(box.innerHTML,'');
});
