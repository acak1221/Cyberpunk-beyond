import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createStateService, validState, MAX_BYTES} from '../lib/state-service.mjs';

function database(){const sql=new DatabaseSync(':memory:');sql.exec('CREATE TABLE user_states (user_id TEXT PRIMARY KEY, revision INTEGER NOT NULL, state_json TEXT NOT NULL, updated_at INTEGER NOT NULL)');return {prepare(q){return {bind(...args){return {async first(){return sql.prepare(q).get(...args)??null},async run(){const r=sql.prepare(q).run(...args);return {meta:{changes:Number(r.changes)}}}}}}},sql};}
const char=(id,name=id)=>({id,name,stats:{BODY:8,WILL:6},skills:{Athletics:2},hp:-3,humanity:-1,gear:'edited',notes:'x'});
const camp=(id,ref)=>({id,name:'Night City',roster:[{id:'combatant-1',kind:'pc',characterId:ref,initiative:12}],notes:'notes'});
const state=(id)=>({lang:'ru',characters:[char(id)],campaigns:[camp('campaign-'+id,id)],history:[]});
const origin='https://private.example';
function request(method,data,custom={}){let headers={'content-type':'application/json',origin,...custom};return new Request(origin+'/api/state',{method,headers,...(data===undefined?{}:{body:typeof data==='string'?data:JSON.stringify(data)})})}
function service(db,user){return createStateService({getIdentity:async()=>user===null?null:{userId:user},getDatabase:()=>db})}
const json=async r=>await r.json();
async function current(s){return json(await s.get(request('GET')))}
async function write(s,scope,revision,data,extra={}){return s.put(request('PUT',{scope,revision,data,...extra}))}

test('empty account, owner isolation, and full roster preservation',async()=>{
 const db=database(),a=service(db,'alice'),b=service(db,'bob'),empty=await current(a),emptyBob=await current(b);assert.equal(empty.revision,0);assert.equal(empty.data,null);assert.match(empty.scope,/^nc1_[a-f0-9]{64}$/);assert.equal(emptyBob.revision,0);assert.equal(emptyBob.data,null);assert.notEqual(emptyBob.scope,empty.scope);
 let put=await write(a,empty.scope,0,state('alice-char'),{userId:'bob'});assert.equal(put.status,201);assert.deepEqual(await json(put),{revision:1});assert.equal((await write(b,emptyBob.scope,0,state('bob-char'))).status,201);
 let alice=await current(a),bob=await current(b);assert.equal(alice.scope,empty.scope);assert.equal(bob.scope,emptyBob.scope);assert.equal(alice.data.characters[0].id,'alice-char');assert.equal(alice.data.characters[0].hp,-3);assert.equal(alice.data.characters[0].humanity,-1);assert.equal(alice.data.campaigns[0].roster[0].characterId,'alice-char');assert.equal(bob.data.characters[0].id,'bob-char');assert.equal((await a.get(request('GET'))).headers.get('cache-control'),'no-store');db.sql.close();
});
test('compare and swap: two devices cannot overwrite the same revision',async()=>{
 const db=database(),a=service(db,'alice'),scope=(await current(a)).scope;assert.equal((await write(a,scope,0,state('one'))).status,201);
 let results=await Promise.all([write(a,scope,1,state('two')),write(a,scope,1,state('three'))]);assert.deepEqual(results.map(x=>x.status).sort(),[200,409]);let conflict=results.find(x=>x.status===409);assert.deepEqual(await json(conflict),{error:'revision_conflict'});assert.equal((await write(a,scope,0,state('old'))).status,409);
 let saved=await current(a);assert.equal(saved.revision,2);assert(['two','three'].includes(saved.data.characters[0].id));assert.notEqual(saved.data.characters[0].id,'old');db.sql.close();
});
test('identity change after GET is blocked even with matching revision',async()=>{
 const db=database(),a=service(db,'alice'),b=service(db,'bob'),beforeA=await current(a),beforeB=await current(b);assert.equal(beforeA.revision,0);assert.equal(beforeB.revision,0);
 let incorrect=await write(b,beforeA.scope,0,state('private-alice'));assert.equal(incorrect.status,409);assert.deepEqual(await json(incorrect),{error:'account_changed'});assert.equal((await current(b)).data,null);
 assert.equal((await write(a,beforeA.scope,0,state('private-alice'))).status,201);assert.equal((await write(b,beforeB.scope,0,state('private-bob'))).status,201);
 let a1=await current(a),b1=await current(b);assert.equal(a1.revision,b1.revision);incorrect=await write(b,a1.scope,a1.revision,state('private-alice-updated'));assert.equal(incorrect.status,409);assert.deepEqual(await json(incorrect),{error:'account_changed'});
 let savedB=await current(b);assert.equal(savedB.revision,1);assert.equal(savedB.data.characters[0].id,'private-bob');
 let missing=await b.put(request('PUT',{revision:b1.revision,data:state('unsafe')}));assert.equal(missing.status,409);assert.deepEqual(await json(missing),{error:'account_changed'});assert.equal((await current(b)).data.characters[0].id,'private-bob');db.sql.close();
});
test('authentication and origin enforced before reading database',async()=>{
 const db=database(),anon=service(db,null),user=service(db,'alice'),scope=(await current(user)).scope;assert.equal((await anon.get(request('GET'))).status,401);assert.equal((await anon.put(request('PUT',{scope,revision:0,data:state('a')}))).status,401);
 assert.equal((await user.put(request('PUT',{scope,revision:0,data:state('a')},{origin:'https://evil.example'}))).status,403);assert.equal((await user.put(request('PUT',{scope,revision:0,data:state('a')},{origin:'null'}))).status,403);
 const missing=new Request(origin+'/api/state',{method:'PUT',headers:{'content-type':'application/json'},body:'{}'});assert.equal((await user.put(missing)).status,403);assert.equal((await user.put(request('PUT',{scope,revision:0,data:state('a')},{'content-type':'text/plain'}))).status,415);assert.equal((await current(user)).revision,0);db.sql.close();
});
test('reject malformed, oversized, duplicate IDs, prototype keys and deep state',async()=>{
 const db=database(),a=service(db,'alice'),scope=(await current(a)).scope;assert.equal((await a.put(request('PUT','{'))).status,400);
 let x=state('a');x.characters.push(char('a'));assert.equal((await write(a,scope,0,x)).status,400);x=state('a');x.extra=JSON.parse('{"__proto__":{"polluted":true}}');assert.equal((await write(a,scope,0,x)).status,400);x=state('a');let cursor=x;for(let i=0;i<34;i++){cursor.extra={};cursor=cursor.extra}assert.equal(validState(x),false);
 let huge=JSON.stringify({scope,revision:0,data:{characters:[],campaigns:[],payload:'a'.repeat(MAX_BYTES+1)}});assert.equal((await a.put(request('PUT',huge))).status,413);assert.equal((await write(a,scope,-1,state('a'))).status,400);assert.equal((await write(a,scope,Number.MAX_SAFE_INTEGER,state('a'))).status,400);assert.equal((await current(a)).revision,0);db.sql.close();
});
test('database availability produces explicit error and no fake success',async()=>{let db=database(),scope=(await current(service(db,'alice'))).scope,a=service(undefined,'alice');assert.equal((await a.get(request('GET'))).status,503);assert.equal((await write(a,scope,0,state('a'))).status,503);db.sql.close()});
test('account scope is stable, distinct, opaque, and never authorizes writes',async()=>{
 const db=database(),alice=service(db,'sensitive-account-id-alice'),bob=service(db,'sensitive-account-id-bob');const first=await current(alice),again=await current(alice),other=await current(bob);
 assert.equal(first.scope,again.scope);assert.notEqual(first.scope,other.scope);assert.match(first.scope,/^nc1_[a-f0-9]{64}$/);assert(!JSON.stringify(first).includes('sensitive-account-id-alice'));assert(!('email' in first));assert(!('userId' in first));
 const denied=await write(alice,other.scope,0,state('alice-only'),{userId:'sensitive-account-id-bob'});assert.equal(denied.status,409);assert.deepEqual(await json(denied),{error:'account_changed'});assert.equal((await current(alice)).data,null);assert.equal((await current(bob)).data,null);
 const put=await write(alice,first.scope,0,state('alice-only'),{userId:'sensitive-account-id-bob'});assert.equal(put.status,201);assert.equal((await current(bob)).data,null);assert.equal((await current(alice)).data.characters[0].id,'alice-only');const unauth=await service(db,null).get(request('GET'));assert.equal(unauth.status,401);assert(!('scope' in await json(unauth)));db.sql.close();
});
