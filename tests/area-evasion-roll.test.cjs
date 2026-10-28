const {test}=require('node:test'),assert=require('node:assert/strict');
global.window={};require('../public/game/area-tools.js');const A=window.AreaTools;
function values(rng){let i=0;return ()=>{assert.ok(i<rng.length,'unexpected random draw');return rng[i++]}}
test('Evasion requires REF 8 and uses a single extra die for natural 1 and 10',()=>{
 const input={ref:8,dex:6,skill:4,modifier:-2};
 assert.deepEqual(A.areaEvasion(input,values([0,.9])),{stat:6,skill:4,modifier:-2,first:1,extra:10,total:-1});
 assert.deepEqual(A.areaEvasion(input,values([.9,.4])),{stat:6,skill:4,modifier:-2,first:10,extra:5,total:23});
 assert.equal(A.areaEvasion({...input,ref:7},values([])),null);
 assert.equal(A.areaEvasion({...input,skill:''},values([])),null);
 assert.equal(A.areaEvasion(input,()=>1),null);
 assert.equal(A.resolveTarget({type:'blast',attack:-100,hit:true,damage:5,sixes:0,target:{ref:8,dodge:'yes',evasion:-109,sp:0,cover:0}}).status,'hit');
});
function ui(){
 const fields=Object.fromEntries(Object.entries({name:'Target',ref:'8',dodge:'no',evasion:'0','evasion-dex':'6','evasion-skill':'4','evasion-mod':'0',sp:'11',cover:'0'}).map(([key,value])=>[`[data-area-${key}]`,{value}]));
 const rowResult={textContent:''};fields['[data-area-evasion-result]']=rowResult;
 const row={isConnected:true,querySelector:s=>fields[s]||null};const output={textContent:'',innerHTML:''},container={querySelectorAll:()=>[row]};
 const vals={'[data-area-type]':'blast','[data-area-attack]':'18','[data-area-dv]':'13','[data-area-dice]':'6,6,4,4'};
 const root={querySelector:s=>s==='[data-area-targets]'?container:s==='[data-area-result]'?output:{value:vals[s]}};
 function click(action,connected=true){const b={dataset:{areaAction:action},isConnected:connected,closest:s=>s==='[data-area-root]'?root:s==='[data-area-target]'?row:null};return A.handle({type:'click',target:{closest:s=>s==='[data-area-action]'?b:null}},'en')}
 return {fields,rowResult,output,click};
}
test('target dodge rolls into the selected row, showing its dice and leaving other inputs intact',()=>{
 const h=ui(),old=Math.random;Math.random=values([.4]);try{h.click('roll-evasion')}finally{Math.random=old}
 assert.equal(h.fields['[data-area-evasion]'].value,'15');assert.equal(h.fields['[data-area-dodge]'].value,'yes');assert.match(h.rowResult.textContent,/DEX 6 \+ Evasion 4 \+ 0 \+ 1d10 5 = 15/);
 assert.equal(h.fields['[data-area-sp]'].value,'11');h.click('calculate');assert.match(h.output.innerHTML,/Target hit/);
});
test('changed dodge inputs invalidate the recorded roll; explicit manual mode keeps the total',()=>{
 const h=ui(),old=Math.random;Math.random=values([.4]);try{h.click('roll-evasion')}finally{Math.random=old}
 h.fields['[data-area-evasion-dex]'].value='7';h.click('calculate');assert.match(h.output.innerHTML,/Evasion inputs changed/);assert.doesNotMatch(h.output.innerHTML,/Target hit/);
 h.click('manual-evasion');assert.equal(h.fields['[data-area-evasion]'].value,'15');h.click('calculate');assert.match(h.output.innerHTML,/Target hit/);
});
test('manual edits replace roll provenance; invalid or detached rolls do not consume dice or change the target',()=>{
 let h=ui(),old=Math.random;Math.random=values([.4]);try{h.click('roll-evasion')}finally{Math.random=old}
 h.fields['[data-area-evasion]'].value='30';h.fields['[data-area-evasion-dex]'].value='7';h.click('calculate');assert.match(h.output.innerHTML,/Dodge succeeded/);
 h=ui();h.fields['[data-area-ref]'].value='7';Math.random=values([]);try{h.click('roll-evasion');h.click('roll-evasion',false)}finally{Math.random=old}
 assert.match(h.rowResult.textContent,/REF 8/);assert.equal(h.fields['[data-area-evasion]'].value,'0');assert.equal(h.fields['[data-area-dodge]'].value,'no');
});
test('both languages provide a manual and rolled Evasion workflow',()=>{for(const lang of ['ru','en']){const html=A.render(lang);assert.match(html,/data-area-action="roll-evasion"/);assert.match(html,/data-area-action="manual-evasion"/);assert.match(html,/data-area-evasion-dex/);}});
