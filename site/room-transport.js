/* Minimal MQTT 3.1.1 over WebSocket (QoS 0, retained messages) for live rooms.
   Public brokers act only as an encrypted mailbox: no accounts, no database, and
   several interchangeable brokers are used at once so no single one is required. */
(function(global){
'use strict';
const te=new TextEncoder(),td=new TextDecoder();
const DEFAULT_BROKERS=[
 {url:'wss://public.cloud.shiftr.io',username:'public',password:'public'},
 {url:'wss://broker.emqx.io:8084/mqtt'},
 {url:'wss://broker.hivemq.com:8884/mqtt'},
];
const KEEPALIVE=40;

function concat(parts){let n=0;for(const p of parts)n+=p.length;const out=new Uint8Array(n);let o=0;for(const p of parts){out.set(p,o);o+=p.length}return out}
function str(s){const b=te.encode(s);return concat([Uint8Array.of(b.length>>8,b.length&255),b])}
function varint(n){const out=[];do{let byte=n%128;n=Math.floor(n/128);if(n>0)byte|=128;out.push(byte)}while(n>0);return Uint8Array.from(out)}
function packet(type,flags,body){return concat([Uint8Array.of((type<<4)|flags),varint(body.length),body])}

const encode={
 connect({clientId,username,password,keepalive=KEEPALIVE}){
  let flags=0x02;const payload=[str(clientId)];
  if(username!==undefined){flags|=0x80;payload.push(str(username))}
  if(password!==undefined){flags|=0x40;payload.push(str(password))}
  return packet(1,0,concat([str('MQTT'),Uint8Array.of(4,flags,keepalive>>8,keepalive&255),...payload]));
 },
 publish(topic,payload,retain=false){return packet(3,retain?1:0,concat([str(topic),payload]))},
 subscribe(id,topic){return packet(8,2,concat([Uint8Array.of(id>>8,id&255),str(topic),Uint8Array.of(0)]))},
 ping(){return Uint8Array.of(0xC0,0)},
 disconnect(){return Uint8Array.of(0xE0,0)},
};

// Splits a byte stream into MQTT packets; keeps any partial packet for the next chunk.
function createParser(onPacket){
 let buf=new Uint8Array(0);
 return chunk=>{
  buf=buf.length?concat([buf,chunk]):chunk;
  for(;;){
   if(buf.length<2)return;
   let mult=1,len=0,i=1,byte;
   do{if(i>=buf.length)return;byte=buf[i++];len+=(byte&127)*mult;mult*=128;if(mult>128*128*128*128)throw Error('bad_length')}while(byte&128);
   if(buf.length<i+len)return;
   const type=buf[0]>>4,flags=buf[0]&15,body=buf.subarray(i,i+len);
   buf=buf.subarray(i+len);
   if(type===3){
    const tl=(body[0]<<8)|body[1],topic=td.decode(body.subarray(2,2+tl));
    let p=2+tl;if((flags>>1)&3)p+=2; // QoS>0 carries a packet id
    onPacket({type,topic,payload:body.slice(p),retain:!!(flags&1)});
   }else onPacket({type,flags,body:body.slice()});
  }
 };
}

// One broker connection with automatic reconnect.
function connectBroker(broker,{topic,onMessage,onStatus,WebSocketImpl}){
 let ws=null,timer=null,ping=null,closed=false,attempt=0,ready=false;
 const id='ncr'+Math.random().toString(36).slice(2,12)+Date.now().toString(36).slice(-6);
 function status(s){ready=s==='online';onStatus?.(broker.url,s)}
 function open(){
  if(closed)return;
  status('connecting');
  try{ws=new (WebSocketImpl||global.WebSocket)(broker.url,'mqtt')}catch{retry();return}
  ws.binaryType='arraybuffer';
  const parse=createParser(p=>{
   if(p.type===2){if(p.body[1]===0){attempt=0;status('online');ws.send(encode.subscribe(1,topic+'/#'))}else{status('refused');ws.close()}}
   else if(p.type===3)onMessage(p);
  });
  ws.onopen=()=>{ws.send(encode.connect({clientId:id,username:broker.username,password:broker.password}));clearInterval(ping);ping=setInterval(()=>{try{ws.readyState===1&&ws.send(encode.ping())}catch{}},KEEPALIVE*1000*0.75)};
  ws.onmessage=e=>{try{parse(new Uint8Array(e.data))}catch{try{ws.close()}catch{}}};
  ws.onclose=()=>{clearInterval(ping);if(!closed){status('offline');retry()}};
  ws.onerror=()=>{};
 }
 function retry(){clearTimeout(timer);attempt++;timer=setTimeout(open,Math.min(30000,1000*2**Math.min(attempt,5))+Math.random()*500)}
 open();
 return {
  url:broker.url,
  online:()=>ready&&ws?.readyState===1,
  send(bytes){if(ready&&ws?.readyState===1){ws.send(bytes);return true}return false},
  close(){closed=true;clearTimeout(timer);clearInterval(ping);try{if(ws?.readyState===1)ws.send(encode.disconnect());ws?.close()}catch{}},
  reconnectNow(){if(closed||ready)return;clearTimeout(timer);try{ws?.close()}catch{}open()},
 };
}

/* Connects to every broker at once; publishes everywhere and drops duplicate deliveries. */
function create({topic,brokers,onMessage,onStatus,WebSocketImpl}){
 const states=new Map(),conns=[];
 for(const b of (brokers&&brokers.length?brokers:DEFAULT_BROKERS))conns.push(connectBroker(b,{topic,WebSocketImpl,onMessage:p=>onMessage(p),onStatus:(url,s)=>{states.set(url,s);onStatus?.(summary())}}));
 function summary(){const total=conns.length,online=conns.filter(c=>c.online()).length;return {total,online,states:Object.fromEntries(states)}}
 return {
  publish(subtopic,bytes,retain=false){const pkt=encode.publish(topic+'/'+subtopic,bytes,retain);let sent=0;for(const c of conns)if(c.send(pkt))sent++;return sent},
  status:summary,
  close(){for(const c of conns)c.close()},
  wake(){for(const c of conns)c.reconnectNow()},
 };
}
global.RoomTransport={create,encode,createParser,DEFAULT_BROKERS};
})(typeof window!=='undefined'?window:globalThis);
