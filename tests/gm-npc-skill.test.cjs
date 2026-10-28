const {test}=require('node:test'),assert=require('node:assert/strict');
global.window={};require('../public/game/gm-tools.js');const G=window.GMTools;
const template=id=>G.NPC_TEMPLATES.find(x=>x.id===id);
function rng(...values){let i=0;return ()=>{assert.ok(i<values.length,'unexpected random draw');return values[i++]}}
test('printed NPC skill bases include STAT and use the printed armored variant',()=>{
 const t=template('security-officer');assert.equal(G.npcSkillBase(t,'Athletics','base'),10);assert.equal(G.npcSkillBase(t,'Athletics','armored'),8);assert.equal(G.npcSkillBase(t,'Perception','armored'),G.npcSkillBase(t,'Perception','base'));assert.equal(G.npcSkillBase(t,'Tactics','base'),null);assert.equal(G.npcSkillBase(t,'missing','base'),null);
 const r=G.npcSkillRoll(t,'Athletics','armored',2,30,true,rng(0.4));assert.equal(r.base,8);assert.equal(r.wound,0);assert.equal(r.total,15);
});
test('wound states use strict HP thresholds and the modifier may explicitly omit wound penalty',()=>{
 const t=template('bodyguard');for(const [hp,penalty] of [[35,0],[18,0],[17,-2],[1,-2],[0,-4],[-1,-4]]){const r=G.npcSkillRoll(t,'Perception','base',0,hp,true,rng(0.4));assert.equal(r.wound,penalty)}
 assert.equal(G.npcSkillRoll(t,'Perception','base',0,0,false,rng(0.4)).wound,0);
});
test('critical 1 and 10 add or subtract one extra d10, without forced outcome',()=>{
 const t=template('bodyguard');let r=G.npcSkillRoll(t,'Perception','base',0,35,true,rng(0,0.9));assert.equal(r.first,1);assert.equal(r.extra,10);assert.equal(r.total,0);
 r=G.npcSkillRoll(t,'Perception','base',-2,35,true,rng(0.9,0));assert.equal(r.first,10);assert.equal(r.extra,1);assert.equal(r.total,18);
});
test('unknown skills, malformed values and invalid dice do not produce a result',()=>{
 const t=template('bodyguard');for(const [key,mode,mod,hp,wound] of [['Nope','base',0,35,true],['Perception','bad',0,35,true],['Perception','base','',35,true],['Perception','base',101,35,true],['Perception','base',0,NaN,true],['Perception','base',0,35,'yes']])assert.equal(G.npcSkillRoll(t,key,mode,mod,hp,wound,()=>{throw Error('must not roll')}),null);
 assert.equal(G.npcSkillRoll(t,'Perception','base',0,35,true,rng(1)),null);
});
test('both languages render skill and wound controls without modifying old NPCs',()=>{
 const n={id:'id',name:'NPC',template:'bodyguard',hp:20,notes:'private',future:{keep:true}},w=G.initial();w.roster=[n];const before=JSON.stringify(w);
 for(const lang of ['ru','en']){const html=G.render({workspace:w,lang});assert.match(html,/data-gm-skill/);assert.match(html,/data-npc-skill="wound" checked/);assert.match(html,lang==='ru'?/БРОСОК НАВЫКА NPC/:/NPC SKILL CHECK/);assert.doesNotMatch(html,/<option value="Tactics">/)}assert.equal(JSON.stringify(w),before);
});
function setup(){
 const w=G.initial(),n={id:'npc-1',name:'Guard',template:'security-officer',hp:19,notes:'',future:{keep:true}};w.roster=[n];let current=true;
 const inputs={key:{value:'Athletics'},mode:{value:'armored'},modifier:{value:'0'},wound:{checked:true}},out={textContent:''},root={isConnected:true,dataset:{npcId:n.id},querySelector(s){if(s==='[data-npc-skill-result]')return out;const match=s.match(/^\[data-npc-skill="(.+)"\]$/);return match?inputs[match[1]]:null}};
 const b={isConnected:true,dataset:{gm:'npc-skill-roll'},closest:s=>s==='[data-gm-skill]'?root:s==='[data-gm]'?b:null};const ctx={lang:'en',workspace:w,scope:'account',isCurrent:(workspace,scope)=>current&&workspace===w&&scope==='account'};
 return {w,n,inputs,out,root,b,ctx,stale(){current=false},click(){return G.handle({type:'click',target:b},ctx)}};
}
test('NPC skill roll displays exact breakdown without persisting any changes',()=>{
 const h=setup(),before=JSON.stringify(h.w),old=Math.random;Math.random=rng(0.4);try{const r=h.click();assert.equal(r.handled,true);assert.equal(r.dirty,undefined);assert.match(h.out.textContent,/Athletics: 8 \+ 0 − 2 \(wound\) \+ 1d10 5 = 11/);assert.equal(JSON.stringify(h.w),before)}finally{Math.random=old}
});
test('detached form, stale account and duplicate NPC IDs do not roll or change data',()=>{
 for(const mode of ['root','button','scope','duplicate']){const h=setup();if(mode==='root')h.root.isConnected=false;if(mode==='button')h.b.isConnected=false;if(mode==='scope')h.stale();if(mode==='duplicate')h.w.roster.push({...h.n});const before=JSON.stringify(h.w),old=Math.random;Math.random=()=>{throw Error('must not roll')};try{const r=h.click();assert.equal(r.handled,true);assert.match(r.notify,/changed/);assert.equal(h.out.textContent,'');assert.equal(JSON.stringify(h.w),before)}finally{Math.random=old}}
});
test('changing a skill input or current HP removes the stale visible result',()=>{
 const h=setup();h.out.textContent='old';const input={dataset:{npcSkill:'modifier'},closest:s=>s==='[data-gm-skill]'?h.root:null};assert.equal(G.handle({type:'input',target:input},h.ctx).handled,true);assert.equal(h.out.textContent,'');h.out.textContent='old';const hp={dataset:{gmNpc:'hp',gmIndex:'0'},value:'10',closest:s=>s==='.gm-card'?{querySelector:()=>h.out}:null};assert.equal(G.handle({type:'input',target:hp},h.ctx).dirty,true);assert.equal(h.out.textContent,'');assert.equal(h.n.hp,10);
});
