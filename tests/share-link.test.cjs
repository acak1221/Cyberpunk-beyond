const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const plain=x=>JSON.parse(JSON.stringify(x));
function load(hash=''){
 let replaced=null;
 const document={documentElement:{lang:'ru'},readyState:'complete',addEventListener(){},createElement:()=>({})};
 const window={document,location:{hash,pathname:'/app/',search:'',origin:'https://example.test'},history:{replaceState:(a,b,u)=>{replaced=u}},addEventListener(){},navigator:{},btoa,atob,Blob,Response,CompressionStream,DecompressionStream,matchMedia:()=>({matches:false})};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..','site','share-link.js'),'utf8'),{window,TextEncoder,TextDecoder,Uint8Array,JSON,String,Array,Object,Error,Promise,Number,setTimeout,Event:class{}});
 return {S:window.ShareLink,replaced:()=>replaced};
}

test('a shared character survives the link round trip without pictures or private keys',async()=>{
 const {S}=load();
 const c={id:'v1',name:'Ви «Соло»',role:'solo',notes:'заметки '.repeat(50),extra:{portrait:'data:image/png;base64,AAAA',portraitThumb:'x',sourceKey:'room:1',luck:3}};
 const url=await S.link(c);
 assert.match(url,/^https:\/\/example\.test\/app\/#\/import\/z[A-Za-z0-9_-]+$/);
 assert.ok(url.length<500,'compressed link should be short: '+url.length);
 const back=await S.unpack(url.split('#/import/')[1]);
 assert.equal(back.format,'nightcity-red-character');
 assert.deepEqual(plain(back.character),{id:'v1',name:'Ви «Соло»',role:'solo',notes:c.notes,extra:{luck:3}});
 assert.equal(c.extra.portrait,'data:image/png;base64,AAAA'); // the original sheet is untouched
 await assert.rejects(()=>S.unpack('zAAAA'));
 await assert.rejects(()=>S.unpack('q123'));
});

test('opening an import link removes the sheet from the address bar before the app routes',()=>{
 const {replaced}=load('#/import/zABC');
 assert.equal(replaced(),'/app/#/characters');
});
