const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('book search Enter and page controls show results past page 100 and retain keyboard focus',async()=>{
 let script=fs.readFileSync('public/game/book-search.js','utf8');script=script.replace('const engine=create();','const engine=create(fakeLoader);');
 const status={textContent:''},hits={innerHTML:''},pagination={innerHTML:''},focus=[];
 const previous={dataset:{bsAction:'previous'},isConnected:true,disabled:false,focus(){focus.push('previous')}},next={dataset:{bsAction:'next'},isConnected:true,disabled:false,focus(){focus.push('next')}};
 const field={value:'finding',isConnected:true,matches:s=>s==='[data-bs-query]',closest:()=>root};
 const root={isConnected:true,querySelector:s=>s==='[data-bs-query]'?field:s==='[data-bs-status]'?status:s==='[data-bs-results]'?hits:s==='[data-bs-pagination]'?pagination:s==='[data-bs-action="next"]'?next:s==='[data-bs-action="previous"]'?previous:null};
 previous.closest=next.closest=()=>root;
 const fakeLoader=async()=>({promise:Promise.resolve({numPages:134,getPage:async n=>({getTextContent:async()=>({items:[{str:`Finding page ${n-1}`}]})})}),destroy(){}});
 const win={},doc={querySelector:()=>root,documentElement:{lang:'en'}};vm.runInNewContext(script,{window:win,document:doc,fakeLoader,Uint8Array,URL,Promise,Map,Set,Object,Array,String,Number});
 win.BookSearch.setFile({arrayBuffer:async()=>new Uint8Array([1]).buffer});let prevented=false;assert.equal(win.BookSearch.handle({type:'keydown',key:'Enter',target:field,preventDefault(){prevented=true}},'en'),true);assert(prevented);
 for(let i=0;i<40&&!status.textContent.includes('133');i++)await new Promise(resolve=>setImmediate(resolve));assert.match(status.textContent,/133/);assert.match(pagination.innerHTML,/Showing 1–25 \/ 133/);assert.match(hits.innerHTML,/data-page="1"/);
 for(let i=0;i<5;i++)assert(win.BookSearch.handle({type:'click',target:{closest:()=>next}},'en'));assert.match(pagination.innerHTML,/Showing 126–133 \/ 133/);assert.match(hits.innerHTML,/data-page="133"/);assert.equal(focus.at(-1),'next');
 assert(win.BookSearch.handle({type:'click',target:{closest:()=>previous}},'en'));assert.match(pagination.innerHTML,/Showing 101–125 \/ 133/);assert.match(hits.innerHTML,/data-page="101"/);
});
test('the app dispatches book key events only while the book is open',()=>{
 const events={},node=()=>({innerHTML:'',setAttribute(){},addEventListener:(k,f)=>events[k]=f}),nodes={'#app':node(),'#sync-root':node(),'#sync-adapter-status':node()};let calls=0;
 const win={ROLES:[],BookSearch:{handle(){calls++;return true}},Book:{handle:()=>false},Campaigns:{handle:()=>false},CombatTools:{handle:()=>false},NetTools:{setScope(){},validArchitectures:Array.isArray},SyncAdapter:{create(){return {start(){},getScope:()=> 'account',canEdit:()=>true,stateLabel:()=>'',save(){}}}},scrollTo(){}};
 const ctx={window:win,document:{querySelector:s=>nodes[s]||null,documentElement:{},title:''},localStorage:{getItem:()=>null},globalThis:{crypto:{randomUUID:()=> 'id'},addEventListener(){}},setTimeout:()=>0,clearTimeout(){},console,Math,Date,JSON,Set,Number,String,Array,Object,Promise,WeakMap};vm.createContext(ctx);vm.runInContext(fs.readFileSync('public/game/app.js','utf8')+'\nwindow.qaView=x=>{state.view=x};',ctx);
 win.qaView('overview');events.keydown({type:'keydown',key:'Enter'});assert.equal(calls,0);win.qaView('book');events.keydown({type:'keydown',key:'Enter'});assert.equal(calls,1);
});
