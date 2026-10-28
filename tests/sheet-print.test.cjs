const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const code=fs.readFileSync('public/game/sheet-print.js','utf8');
function harness(values){
 const events={},children=[];
 const fields=values.map(value=>({value,classes:new Set(),classList:{add(x){this.owner.classes.add(x)},remove(x){this.owner.classes.delete(x)}},insertAdjacentElement(where,node){assert.equal(where,'afterend');children.push(node)}}));
 for(const field of fields)field.classList.owner=field;
 let sheet=true;
 const doc={querySelector:s=>s==='.sheet-layout'&&sheet?{querySelectorAll:s=>s==='textarea, input[type="text"], input:not([type])'?fields:[]}:null,createElement:()=>({className:'',textContent:'',attributes:{},setAttribute(k,v){this.attributes[k]=v},remove(){const i=children.indexOf(this);if(i>=0)children.splice(i,1)}})};
 const win={document:doc,addEventListener:(name,fn)=>{events[name]=fn}};
 vm.runInNewContext(code,{window:win});return {events,fields,children,noSheet(){sheet=false}};
}
test('print uses complete live multiline and single-line text and leaves the edited fields unchanged',()=>{
 const notes='One line\n<script>not markup</script>\n'+ 'Long note '.repeat(900),h=harness([notes,'second']);
 h.events.beforeprint();assert.equal(h.children.length,2);assert.equal(h.children[0].textContent,notes);assert.equal(h.children[0].attributes['aria-hidden'],'true');assert.equal(h.fields[0].value,notes);assert(h.fields[0].classes.has('sheet-print-source'));
 h.events.afterprint();assert.equal(h.children.length,0);assert.equal(h.fields[0].value,notes);assert.equal(h.fields[0].classes.size,0);
});
test('repeated print preparation replaces mirrors and a different page clears them',()=>{
 const h=harness(['old']);h.events.beforeprint();h.fields[0].value='new';h.events.beforeprint();assert.equal(h.children.length,1);assert.equal(h.children[0].textContent,'new');h.noSheet();h.events.beforeprint();assert.equal(h.children.length,0);assert.equal(h.fields[0].classes.size,0);h.events.afterprint();
});
