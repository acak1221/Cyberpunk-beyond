const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'..','site',f),'utf8');
const plain=x=>JSON.parse(JSON.stringify(x));

function loadRoom(){
 const listeners={},store=new Map();
 const document={addEventListener(t,f){(listeners[t]||(listeners[t]=[])).push(f)},querySelector:()=>null,visibilityState:'visible'};
 const window={document,localStorage:{getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)},crypto:globalThis.crypto,location:{hash:'',origin:'https://example.test',pathname:'/'},addEventListener(){},navigator:{}};
 const ctx={window,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,JSON,Math,Date,Number,String,Array,Object,Map,Set,Promise,Error,setTimeout,clearTimeout,setInterval,clearInterval,console};
 vm.runInNewContext(read('room-transport.js')+'\n'+read('room.js'),ctx);
 return window;
}

test('room codes are 12 unambiguous characters and survive formatting',()=>{
 const R=loadRoom().Room._test;
 for(let i=0;i<50;i++){const c=R.newCode();assert.match(c,/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{12}$/);assert.equal(R.normalizeCode(R.formatCode(c)),c);assert.equal(R.normalizeCode(R.formatCode(c).toLowerCase()),c)}
 for(const bad of ['', 'ABCD', 'O0OO-1111-IIII', 'ABCD-EFGH-JKMNP', null])assert.equal(R.normalizeCode(bad),null);
});

test('a room code derives a stable private topic and a key that only it can open',async()=>{
 const R=loadRoom().Room._test;
 const a=await R.deriveRoom('K7RQM2XAPZ9E'),b=await R.deriveRoom('K7RQM2XAPZ9E'),c=await R.deriveRoom('K7RQM2XAPZ9F');
 assert.equal(a.topic,b.topic);assert.notEqual(a.topic,c.topic);assert.match(a.topic,/^ncred\/v1\/[0-9a-f]{24}$/);assert.ok(!a.topic.includes('K7RQ'));
 R.setKey(a.key);const sealed=await R.seal({hello:'мир'});
 assert.deepEqual(plain(await R.open(sealed)),{hello:'мир'});
 R.setKey(c.key);await assert.rejects(()=>R.open(sealed));
});

test('shared character summaries carry only numbers and short text',()=>{
 const R=loadRoom().Room._test;
 const s=R.characterSummary({name:'Ви',role:'solo',rank:4,hp:20,humanity:60,head:11,bodyArmor:12,stats:{BODY:8,WILL:6,LUCK:6,REF:7,DEX:6},extra:{luck:3},notes:'secret',extra2:{x:1}});
 assert.deepEqual(plain(s),{name:'Ви',role:'solo',rank:4,hp:20,max:45,humanity:60,luck:3,luckMax:6,head:11,body:12,ref:7,dex:6});
 const dirty=R.cleanSummary({name:'<img src=x onerror=alert(1)>'.repeat(10),hp:'1e9',max:-5,role:{evil:true},luck:'7',extra:'drop me'});
 assert.equal(dirty.name.length,60);assert.equal(dirty.hp,9999);assert.equal(dirty.max,1);assert.equal(dirty.role,'[object Object]'.slice(0,20));assert.equal(dirty.luck,7);assert.equal('extra' in dirty,false);
 assert.equal(R.cleanSummary(null),null);assert.equal(R.cleanSummary([1,2]),null);
});

// In-memory MQTT broker speaking the same wire format, to test the client without a network.
function fakeNetwork(T){
 const subs=new Set(),retained=new Map();
 function deliver(sock,topic,payload,retain){if(sock.readyState===1)sock.onmessage?.({data:T.encode.publish(topic,payload,retain).buffer})}
 class FakeSocket{
  constructor(url,proto){this.url=url;this.protocol=proto;this.readyState=0;this.filters=[];setTimeout(()=>{this.readyState=1;this.onopen?.()},0);
   this.parse=T.createParser(p=>{
    if(p.type===1)this.onmessage?.({data:Uint8Array.of(0x20,2,0,0).buffer});
    else if(p.type===8){const len=(p.body[2]<<8)|p.body[3],filter=new TextDecoder().decode(p.body.subarray(4,4+len));this.filters.push(filter.replace(/\/#$/,''));subs.add(this);
     for(const [topic,payload] of retained)if(this.filters.some(f=>topic.startsWith(f+'/')))deliver(this,topic,payload,true)}
    else if(p.type===3){if(p.retain){p.payload.length?retained.set(p.topic,p.payload):retained.delete(p.topic)}for(const s of subs)if(s.filters.some(f=>p.topic.startsWith(f+'/')))deliver(s,p.topic,p.payload,false)}
   });}
  send(bytes){this.parse(bytes)}
  close(){this.readyState=3;subs.delete(this);this.onclose?.()}
 }
 return {FakeSocket,retained};
}
const wait=ms=>new Promise(r=>setTimeout(r,ms));

test('transport publishes, keeps retained state for late joiners and clears it',async()=>{
 const T=loadRoom().RoomTransport,net=fakeNetwork(T),got={a:[],b:[]};
 const brokers=[{url:'ws://one'}];
 const a=T.create({topic:'ncred/v1/room',brokers,WebSocketImpl:net.FakeSocket,onMessage:p=>got.a.push(p)});
 await wait(20);assert.equal(a.status().online,1);
 a.publish('m/alice',new TextEncoder().encode('hello'),true);
 a.publish('e',new TextEncoder().encode('roll'),false);
 await wait(10);
 const b=T.create({topic:'ncred/v1/room',brokers,WebSocketImpl:net.FakeSocket,onMessage:p=>got.b.push(p)});
 await wait(20);
 assert.deepEqual(got.b.map(p=>[p.topic,new TextDecoder().decode(p.payload),p.retain]),[['ncred/v1/room/m/alice','hello',true]]);
 b.publish('e',new TextEncoder().encode('from b'));await wait(10);
 assert.ok(got.a.some(p=>p.topic==='ncred/v1/room/e'&&new TextDecoder().decode(p.payload)==='from b'&&!p.retain));
 a.publish('m/alice',new Uint8Array(0),true);await wait(10);
 assert.equal(net.retained.has('ncred/v1/room/m/alice'),false);
 assert.ok(got.b.some(p=>p.topic==='ncred/v1/room/m/alice'&&p.payload.length===0));
 a.close();b.close();
});

test('the MQTT parser handles packets split across and packed into frames',()=>{
 const T=loadRoom().RoomTransport,out=[];const parse=T.createParser(p=>out.push(p));
 const big=new Uint8Array(300).fill(65),one=T.encode.publish('t/x',big),two=T.encode.publish('t/y',Uint8Array.of(1,2,3),true);
 const all=new Uint8Array(one.length+two.length);all.set(one);all.set(two,one.length);
 parse(all.subarray(0,5));parse(all.subarray(5,200));parse(all.subarray(200));
 assert.deepEqual(out.map(p=>[p.topic,p.payload.length,p.retain]),[['t/x',300,false],['t/y',3,true]]);
});
