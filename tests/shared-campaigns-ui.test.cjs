const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../public/game/shared-campaigns.js'),'utf8');
function setup(fetch){
 const handlers={},root={innerHTML:'',addEventListener:(type,fn)=>handlers[type]=fn,querySelector:s=>s==='#shared-character'?{value:'char-1'}:null};
 const box={window:{},document:{querySelector:s=>s==='#shared-campaigns'?root:null},location:{hash:'',pathname:'/game/index.html',search:'',origin:'https://site.test'},history:{replaceState(){}},navigator:{onLine:true},confirm:()=>true,fetch,Date,console};
 vm.runInNewContext(source,box);let scope='scope-a';const opts={scope,lang:'en',getScope:()=>scope,characters:[{id:'char-1',name:'<Nova>',role:'solo',hp:31,stats:{INT:7,BODY:5},notes:'GM secret',extra:{life:'private',items:['secret']}}]};
 box.window.SharedCampaigns.mount(opts);
 return {box,root,opts,setScope:s=>scope=s,async click(action,id){await handlers.click({target:{closest:()=>({dataset:{shared:action,...id?{id}:{} }})},stopPropagation(){}})},input(id,value){handlers.input({target:{id,value}})}};
}
const response=(body,status=200)=>({ok:status>=200&&status<300,status,json:async()=>body});
test('publishing a character sends only the explicitly described projection and escapes names',async()=>{
 let sent,fetch=async(url,options)=>{
  if(options.method==='GET'&&url==='/api/campaigns')return response({scope:'scope-a',campaigns:[{id:'c',name:'<script>',role:'owner'}]});
  if(options.method==='GET'&&url==='/api/campaigns/c')return response({scope:'scope-a',id:'c',name:'<script>',role:'owner',revision:1,shared:{},members:[{id:'m',role:'owner',mine:true}]});
  if(options.method==='GET'&&url.endsWith('/notes'))return response({scope:'scope-a',notes:'',revision:1});
  if(options.method==='GET'&&url.endsWith('/invites'))return response({scope:'scope-a',invites:[]});
  if(options.method==='GET'&&url.endsWith('/shares'))return response({scope:'scope-a',shares:[]});
  if(options.method==='POST'&&url.endsWith('/shares')){sent=JSON.parse(options.body);return response({id:'s',revision:1},201)}
  throw Error(url);
 };
 let x=setup(fetch);await x.click('toggle');assert(x.root.innerHTML.includes('&lt;script&gt;'));assert(!x.root.innerHTML.includes('<script>'));await x.click('open','c');await x.click('publish');
 assert.equal(sent.scope,'scope-a');assert.deepEqual(Object.keys(sent.data).sort(),['hp','name','role','stats']);assert.equal(sent.data.name,'<Nova>');assert(!JSON.stringify(sent).includes('private'));assert(!JSON.stringify(sent).includes('secret'));
});
test('late server response from a different account cannot be displayed',async()=>{
 let release;let x=setup(()=>new Promise(resolve=>release=resolve));let pending=x.click('toggle');x.setScope('scope-b');release(response({scope:'scope-a',campaigns:[{id:'c',name:'Private campaign',role:'owner'}]}));await pending;assert(!x.root.innerHTML.includes('Private campaign'));assert(x.root.innerHTML.includes('Sign in and wait'));
});
test('scope-less successful GET is rejected and untrusted names are never inserted as markup',async()=>{
 let x=setup(async()=>response({campaigns:[{id:'c',name:'<img src=x>',role:'owner'}]}));await x.click('toggle');assert(!x.root.innerHTML.includes('<img src=x>'));assert(x.root.innerHTML.includes('Sign in and wait'));
});
test('a revision conflict preserves all unsaved GM forms on screen for copying',async()=>{
 let fetch=async(url,options)=>{
  if(options.method==='GET'&&url==='/api/campaigns')return response({scope:'scope-a',campaigns:[]});
  if(options.method==='GET'&&url==='/api/campaigns/c')return response({scope:'scope-a',id:'c',name:'Before',role:'owner',revision:1,shared:{description:'Before'},members:[{id:'m',role:'owner',mine:true}]});
  if(options.method==='GET'&&url.endsWith('/notes'))return response({scope:'scope-a',notes:'Before',revision:1});
  if(options.method==='GET'&&url.endsWith('/invites'))return response({scope:'scope-a',invites:[]});
  if(options.method==='GET'&&url.endsWith('/shares'))return response({scope:'scope-a',shares:[]});
  if(options.method==='PUT'&&url.endsWith('/notes'))return response({error:'revision_conflict'},409);
  throw Error(url);
 };
 let x=setup(fetch);await x.click('toggle');await x.click('open','c');x.input('shared-name','unsaved campaign');x.input('shared-description','unsaved shared');x.input('shared-notes','unsaved private');await x.click('save-notes');
 assert(x.root.innerHTML.includes('unsaved campaign'));assert(x.root.innerHTML.includes('unsaved shared'));assert(x.root.innerHTML.includes('unsaved private'));assert(x.root.innerHTML.includes('newer version'));
});
