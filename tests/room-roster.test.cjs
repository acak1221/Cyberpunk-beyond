// A player who is in the room is in the initiative without sending the sheet first; a participant whose player is
// online shows one HP number in the tracker — the player's own.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'..','site',f),'utf8');
const plain=x=>JSON.parse(JSON.stringify(x));
const zipOK=(()=>{try{new CompressionStream('deflate-raw');new DecompressionStream('deflate-raw');return true}catch{return false}})();

function loadRoom({lang='ru',timers=null}={}){
 const store=new Map(),listeners={},document={addEventListener(type,f){(listeners[type]||=[]).push(f)},querySelector:()=>null,querySelectorAll:()=>[],visibilityState:'visible'};
 const later=(f,ms)=>{if(timers&&ms>=1000){timers.push(f);return timers.length}const h=setTimeout(f,ms);if(ms>=1000)h.unref?.();return h};
 const window={document,localStorage:{getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)},crypto:globalThis.crypto,location:{hash:'',origin:'https://example.test',pathname:'/'},addEventListener(){},confirm:()=>true,navigator:{},btoa,atob,Response,Blob,ReadableStream,CompressionStream,DecompressionStream,ROLES:[]};
 const ctx={window,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,JSON,Math,Date,Number,String,Array,Object,Map,Set,Promise,Error,setTimeout:later,clearTimeout,setInterval,clearInterval,console};
 vm.runInNewContext(read('room-transport.js')+'\n'+read('room.js'),ctx);
 const R=window.Room._test,notices=[],sent=[];
 window.chars=[];window.camps=[];
 R.setApp({getState:()=>({lang,view:'room',characters:window.chars,campaigns:window.camps}),notify:m=>notices.push(m)});
 R.setTransport({publish:(sub,bytes)=>{sent.push({sub,bytes});return 1},close(){}});
 const press=async(action,data={})=>{for(const f of listeners.click||[])await f({target:{closest:sel=>sel==='[data-room-action]'?{dataset:{roomAction:action,...data}}:null}})};
 return {window,R,notices,sent,press};
}
const CODE='K7RQM2XAPZ9E',settle=()=>new Promise(ok=>setTimeout(ok,30));
const SUM={name:'Ви',role:'solo',rank:4,hp:45,max:45,humanity:60,luck:6,luckMax:6,head:11,body:11,ref:7,dex:6,rep:0};
async function table(){
 const maker=loadRoom().R,r=await maker.deriveRoom(CODE),keys={};
 for(const n of ['gm','ann','bob']){const key=await maker.newIdentity();keys[n]={key,id:key.fp+'.0000000'+Object.keys(keys).length}}
 const page=(n,role,extra={})=>{const p=loadRoom(extra.load);p.R.setKey(r.key);p.R.setIdentity(keys[n].key);p.R.setSession({code:CODE,role,name:n,memberId:keys[n].id,gmFp:keys.gm.key.fp,...(extra.session||{})},r.topic);return p};
 const msg=(from,t,d,sub='e')=>maker.signedEnvelope(keys[from].key,keys[from].id,r.topic,r.key,sub,t,d,Date.now(),Math.random().toString(16).slice(2,14));
 const give=async(to,bytes,sub='e')=>{await to.R.receive({topic:r.topic+'/'+sub,retain:false,payload:bytes});await settle()};
 const gm=page('gm','gm',{session:{campaignId:'c1',toasts:false}});
 gm.window.camps.push({id:'c1',name:'Ночной рейс',round:1,turnIndex:0,roster:[{id:'n1',kind:'npc',name:'Бандит',ref:6,hp:20,initiative:12,order:1}]});
 gm.window.App={save(){},render(){}};
 // A player's status as the GM page keeps it.
 const seat=(n,dev,cid,character)=>gm.R.members().set(keys[n].id,{name:n==='ann'?'Аня':'Борис',role:'player',fp:keys[n].key.fp,dev,cid,character,at:Date.now()});
 return {r,keys,page,msg,give,gm,seat};
}
const DEV_A='a'.repeat(16),DEV_B='b'.repeat(16);

test('an initiative roll from a player without a sheet at the GM\'s adds their row from the room, once',async()=>{
 const {keys,msg,give,gm,seat}=await table();seat('ann',DEV_A,'v1',{...SUM});
 await give(gm,await msg('ann','roll',{who:'Аня',character:'Ви',label:'Инициатива',detail:'',total:15,init:true,cid:'v1'}));
 const roster=gm.window.camps[0].roster;assert.equal(roster.length,2);
 const row=roster.find(x=>x.own);assert.deepEqual(plain({...row,id:'',order:0}),{id:'',kind:'npc',own:DEV_A+':v1',name:'Ви',ref:7,hp:45,maxHp:45,initiative:15,order:0,ties:[]});
 assert.match(gm.notices.at(-1),/^Добавлен в трекер из комнаты: Ви — 15$/);
 // The turn stays with whoever had it, although the new row sorts first.
 assert.equal(gm.window.camps[0].turnIndex,1);
 // What the room sees: the row is a player's own row, so that player's page can say «Ваш ход».
 const order=gm.R.combatPayload().order;assert.deepEqual(plain(order),[{name:'Ви',pc:true,own:DEV_A+':v1',init:15,current:false},{name:'Бандит',pc:false,init:12,current:true}]);
 // A second roll changes the same row.
 await give(gm,await msg('ann','roll',{who:'Аня',label:'Инициатива',detail:'',total:9,init:true,cid:'v1'}));
 assert.equal(roster.length,2);assert.equal(row.initiative,9);assert.match(gm.notices.at(-1),/^Инициатива записана в трекер: Ви — 9$/);
 // A roll for a character the member is not in the room with adds nothing; neither does a roll from someone without a character.
 await give(gm,await msg('ann','roll',{who:'Аня',label:'Инициатива',detail:'',total:20,init:true,cid:'other'}));
 seat('bob',DEV_B,'',null);await give(gm,await msg('bob','roll',{who:'Борис',label:'Инициатива',detail:'',total:20,init:true,cid:'j1'}));
 assert.equal(roster.length,2);
 // Hidden by mistake, the player's own row still goes to the room.
 row.hidden=true;assert.equal(gm.R.combatPayload().order.length,2);
});

test('the player\'s page knows a row from the room is theirs',async()=>{
 const {page}=await table(),ann=page('ann','player',{session:{characterId:'v1'}}),dev=ann.R.deviceId();
 assert.equal(ann.R.isMine({pc:true,own:dev+':v1',name:'Кто-то'}),true);
 assert.equal(ann.R.isMine({pc:true,own:DEV_B+':v1',name:'Ви'}),false);
 assert.equal(ann.R.isMine({pc:false,name:'Ви'}),false);
});

test('without a campaign for the room the GM is told once why initiative goes nowhere',async()=>{
 const {keys,msg,give,gm,seat}=await table();seat('ann',DEV_A,'v1',{...SUM});gm.R.session().campaignId='';
 for(let i=0;i<2;i++)await give(gm,await msg('ann','roll',{who:'Аня',label:'Инициатива',detail:'',total:15,init:true,cid:'v1'}));
 assert.equal(gm.notices.filter(n=>/не выбрана кампания/.test(n)).length,1);assert.equal(gm.window.camps[0].roster.length,1);
});

test('«В трекер» adds an online player from the room; the list shows only those not there yet',async()=>{
 const {keys,gm,seat}=await table();seat('ann',DEV_A,'v1',{...SUM});seat('bob',DEV_B,'j1',{...SUM,name:'Джонни',hp:38,max:40,ref:6});
 const camp=gm.window.camps[0];
 let card=gm.window.Room.rosterCard(camp);assert.match(card,/Игроки в комнате/);assert.match(card,/Ви/);assert.match(card,/Джонни/);assert.match(card,/REF 6 · HP 38\/40/);
 assert.equal(gm.window.Room.rosterCard({id:'other',roster:[]}),'','only in the campaign linked to the room');
 await gm.press('roster-add',{id:keys.bob.id});
 assert.equal(camp.roster.length,2);assert.equal(camp.roster[1].own,DEV_B+':j1');assert.equal(camp.roster[1].name,'Джонни');assert.equal(camp.roster[1].hp,38);
 await gm.press('roster-add',{id:keys.bob.id});assert.equal(camp.roster.length,2,'not twice');
 card=gm.window.Room.rosterCard(camp);assert.match(card,/Ви/);assert.doesNotMatch(card,/Джонни/);
 // The row follows the player's status, and the tracker shows that number read-only while the player is online.
 gm.R.members().get(keys.bob.id).character.hp=20;gm.R.syncRows(keys.bob.id);assert.equal(camp.roster[1].hp,20);
 assert.deepEqual(plain(gm.window.Room.liveRow(camp.roster[1],null)),{hp:20,max:40,title:'HP ведёт сам игрок на своём листе. Чтобы изменить — нажмите «Выдать».'});
 assert.equal(gm.window.Room.liveText(camp.roster[1]),'♥ 20/40 в комнате');
 assert.equal(gm.window.Room.grantLink.memberFor(camp.roster[1]),keys.bob.id);
 gm.R.members().get(keys.bob.id).at=Date.now()-10*60000;
 assert.equal(gm.window.Room.liveRow(camp.roster[1],null),null);assert.equal(gm.window.Room.liveText(camp.roster[1]),'из комнаты · не в сети');
 // A player's page offers none of this.
 const {page}=await table(),ann=page('ann','player');assert.equal(ann.window.Room.rosterCard(camp),'');assert.equal(ann.window.Room.liveRow(camp.roster[1],null),null);
});

test('when the sheet arrives, the row from the room becomes that character\'s row and keeps its initiative',{skip:!zipOK},async()=>{
 const {keys,msg,give,gm,seat,page}=await table(),ann=page('ann','player',{session:{characterId:'v1'}}),dev=ann.R.deviceId();
 const V={id:'v1',name:'Ви',role:'solo',rank:4,hp:45,stats:{BODY:8,WILL:6,REF:7}};ann.window.chars.push(V);
 seat('ann',dev,'v1',{...SUM});
 await give(gm,await msg('ann','roll',{who:'Аня',label:'Инициатива',detail:'',total:15,init:true,cid:'v1'}));
 const camp=gm.window.camps[0],rowId=camp.roster.find(x=>x.own).id;
 gm.window.App={save(){},render(){},importCharacter(c,{sourceKey}){gm.window.chars.push({...c,id:'copy1',extra:{sourceKey}});return {ok:true,id:'copy1'}}};
 await gm.R.ensureGMKeys();ann.R.members().set(keys.gm.id,{name:'Мастер',role:'gm',fp:keys.gm.key.fp,pub:plain(gm.R.gmPub()),sheets:'zj',at:Date.now()});
 await ann.R.sendSheet();await settle();for(const m of ann.sent.splice(0))await give(gm,m.bytes,m.sub);
 assert.equal(gm.R.incoming().length,1);await gm.R.acceptSheet(0);
 assert.deepEqual(plain(camp.roster.map(r=>({id:r.id===rowId?'same':r.id,kind:r.kind,characterId:r.characterId,initiative:r.initiative,own:r.own}))),[{id:'n1',kind:'npc',initiative:12},{id:'same',kind:'pc',characterId:'copy1',initiative:15}]);
 // The next roll lands on the same row, now through the sheet.
 await give(gm,await msg('ann','roll',{who:'Аня',label:'Инициатива',detail:'',total:11,init:true,cid:'v1'}));
 assert.equal(camp.roster.length,2);assert.equal(camp.roster[1].initiative,11);
 assert.deepEqual(plain(gm.R.combatPayload().order.find(x=>x.pc)),{name:'Ви',pc:true,own:dev+':v1',init:11,current:false});
});

test('a player is told when the initiative roll cannot reach the tracker',async()=>{
 const timers=[],{keys,page}=await table(),ann=page('ann','player',{session:{characterId:'v1'},load:{timers}});
 ann.R.members().set(keys.gm.id,{name:'Мастер',role:'gm',fp:keys.gm.key.fp,at:Date.now()});
 ann.window.Room.roll({label:'Инициатива',detail:'',total:12,character:'Джонни',initiative:true,characterId:'j1'});
 assert.match(ann.notices.at(-1),/выберите этого персонажа на странице «Игра онлайн»/);
 ann.window.Room.roll({label:'Инициатива',detail:'',total:12,character:'Ви',initiative:true,characterId:'v1'});
 const before=ann.notices.length;for(const f of timers.splice(0))f();
 assert.equal(ann.notices.length,before+1);assert.match(ann.notices.at(-1),/пока нет в трекере ведущего/);
 const en=page('ann','player',{session:{characterId:'v1'},load:{lang:'en'}});en.window.Room.roll({label:'Initiative',detail:'',total:12,initiative:true,characterId:'x'});
 assert.match(en.notices.at(-1),/choose this character on the “Online play” page/);
});
