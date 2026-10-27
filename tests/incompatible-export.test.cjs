const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const code=fs.readFileSync(path.join(__dirname,'../public/game/sync-adapter.js'),'utf8');
function node(){return {inert:false,innerHTML:'',listeners:{},setAttribute(){},addEventListener(k,fn){this.listeners[k]=fn},querySelector(){return null}}}
test('incompatible cloud export preserves original format and version inside complete snapshot',async()=>{
 const app=node(),mount=node(),status=node(),blobs=[],anchors=[];let hooks;
 const controller={getStatus:()=>({kind:'synced'}),getConflict:()=>null,scope:null,refresh(){}};
 const win={localStorage:{getItem:()=>null},addEventListener(){},CloudSync:{start:async h=>{hooks=h;return controller}}};
 const context={window:win,document:{querySelector:()=>null,createElement:()=>{const a={click(){this.clicked=true}};anchors.push(a);return a}},URL:{createObjectURL(blob){blobs.push(blob);return 'blob:test'},revokeObjectURL(){}},Blob,confirm:()=>true,setTimeout:()=>0,clearTimeout(){}};
 vm.runInNewContext(code,context);const adapter=win.SyncAdapter.create({app,mount,status,language:()=> 'en',read:()=>({characters:[],campaigns:[]}),apply(){}});await adapter.start();
 const original={format:'future-format',version:42,characters:[],campaigns:[],nested:{data:'intact'}};hooks.onIncompatibleRemote(original);status.listeners.click({target:{closest:()=>({dataset:{adapterAction:'download-incompatible'}})}});
 assert.equal(anchors[0].clicked,true);const exported=JSON.parse(await blobs[0].text());assert.equal(exported.format,'nightcity-red-backup');assert.equal(exported.version,1);assert.deepEqual(exported._completeSnapshot,original);
});
