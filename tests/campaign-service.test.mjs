import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {createCampaignService} from '../lib/campaign-service.mjs';
import {accountScope} from '../lib/state-service.mjs';

function database(){
 const sql=new DatabaseSync(':memory:');sql.exec(readFileSync(new URL('../drizzle/0001_lucky_micromacro.sql',import.meta.url),'utf8').replaceAll('--> statement-breakpoint',''));sql.exec(readFileSync(new URL('../drizzle/0002_bumpy_vanisher.sql',import.meta.url),'utf8').replaceAll('--> statement-breakpoint',''));
 function prepare(q){return {bind(...args){return {async first(){return sql.prepare(q).get(...args)??null},async all(){return {results:sql.prepare(q).all(...args)}},async run(){return {meta:{changes:Number(sql.prepare(q).run(...args).changes)}}}, _run(){return {meta:{changes:Number(sql.prepare(q).run(...args).changes)}}}}}}}
 return {prepare,async batch(statements){sql.exec('BEGIN');try{let out=statements.map(x=>x._run());sql.exec('COMMIT');return out}catch(e){sql.exec('ROLLBACK');throw e}},sql};
}
const origin='https://private.example', call=(service,path,method='GET',body,headers={})=>service.handle(new Request(origin+'/api/campaigns'+path,{method,headers:{origin,'content-type':'application/json',...headers},...(body===undefined?{}:{body:JSON.stringify(body)})}));
const S=(db,user,time=()=>1000)=>createCampaignService({getIdentity:async()=>user?{userId:user}:null,getDatabase:()=>db,now:time});
const j=async r=>r.json();
async function setup(){let db=database(),a=S(db,'alice'),b=S(db,'bob'),c=S(db,'charlie'),sa=await accountScope('alice'),sb=await accountScope('bob'),sc=await accountScope('charlie');let created=await j(await call(a,'','POST',{scope:sa,name:'Crew'}));return {db,a,b,c,sa,sb,sc,id:created.id,owner:created.memberId};}
async function invite(x){return j(await call(x.a,`/${x.id}/invites`,'POST',{scope:x.sa}))}
async function join(x,invite,user=x.b,scope=x.sb){return call(user,'/join','POST',{scope,token:invite.token})}

test('private notes and shared data are isolated by authentication and campaign membership',async()=>{
 let x=await setup(),p=`/${x.id}`;assert.equal((await call(S(x.db,null),p)).status,401);assert.equal((await call(x.b,p)).status,404);assert.equal((await call(x.b,p+'/notes')).status,404);assert.equal((await call(x.b,p+'/shares')).status,404);
 assert.equal((await call(x.a,p+'/notes','PUT',{scope:x.sa,revision:1,notes:'GM SECRET'})).status,200);let code=await invite(x);assert.equal((await join(x,code)).status,200);
 let details=await j(await call(x.b,p));assert.equal(details.role,'player');assert.equal(details.members.length,2);assert(!JSON.stringify(details).includes('GM SECRET'));assert(!JSON.stringify(details).includes('alice'));assert.equal((await call(x.b,p+'/notes')).status,404);assert.equal((await call(x.b,p+'/invites')).status,404);assert.equal((await call(x.b,p+'/invites','POST',{scope:x.sb})).status,404);assert.equal((await call(x.b,p,'PUT',{scope:x.sb,revision:1,name:'Stolen',shared:{}})).status,404);assert.equal((await call(x.b,p,'DELETE',{scope:x.sb})).status,404);
 let own=await j(await call(x.a,p+'/notes'));assert.equal(own.notes,'GM SECRET');assert.equal(own.revision,2);x.db.sql.close();
});
test('invite is single-use, secret stored only as hash, owner can revoke, expiry enforced',async()=>{
 let x=await setup(),p=`/${x.id}`,a=await invite(x),stored=x.db.sql.prepare('select * from campaign_invites where id=?').get(a.id);assert.notEqual(stored.token_hash,a.token);assert(!JSON.stringify(stored).includes(a.token));let list=await j(await call(x.a,p+'/invites'));assert(!JSON.stringify(list).includes(a.token));assert.equal((await call(x.b,p+'/invites','DELETE',{scope:x.sb,inviteId:a.id})).status,404);
 let results=await Promise.all([join(x,a),join(x,a,x.c,x.sc)]);assert.deepEqual(results.map(r=>r.status).sort(),[200,404]);assert.equal((await join(x,a)).status,404);let next=await invite(x);assert.equal((await call(x.a,p+'/invites','DELETE',{scope:x.sa,inviteId:next.id})).status,200);assert.equal((await join(x,next,x.c,x.sc)).status,404);
 let expire=await invite(x);let late=S(x.db,'charlie',()=>expire.expiresAt+1);assert.equal((await join(x,expire,late,x.sc)).status,404);x.db.sql.close();
});
test('replaying an invite at the same timestamp cannot restore removed membership or consume it for an existing member',async()=>{
 let x=await setup(),p=`/${x.id}`,code=await invite(x);
 assert.equal((await join(x,code)).status,200);
 let member=await j(await call(x.b,p));
 assert.equal((await call(x.a,p+'/members','DELETE',{scope:x.sa,memberId:member.memberId})).status,200);
 assert.equal((await join(x,code)).status,404);
 assert.equal((await call(x.b,p)).status,404);
 let unused=await invite(x);
 assert.equal((await join(x,unused,x.a,x.sa)).status,404);
 assert.equal((await join(x,unused,x.c,x.sc)).status,200);
 assert.equal((await call(x.c,p)).status,200);x.db.sql.close();
});
test('removing a player revokes outstanding invitations and active invitations remain visible and bounded',async()=>{
 let x=await setup(),p=`/${x.id}`;await join(x,await invite(x));let member=await j(await call(x.b,p));let stale=await invite(x);
 assert.equal((await call(x.a,p+'/members','DELETE',{scope:x.sa,memberId:member.memberId})).status,200);
 assert.equal((await join(x,stale,x.c,x.sc)).status,404);
 let items=[];for(let i=0;i<50;i++)items.push(await invite(x));
 assert.equal((await call(x.a,p+'/invites','POST',{scope:x.sa})).status,429);
 let list=await j(await call(x.a,p+'/invites'));assert.equal(list.invites.filter(i=>!i.revokedAt&&!i.usedAt&&i.expiresAt>1000).length,50);
 assert.equal((await call(x.a,p+'/invites','DELETE',{scope:x.sa,inviteId:items[0].id})).status,200);
 assert.equal((await call(x.a,p+'/invites','POST',{scope:x.sa})).status,201);x.db.sql.close();
});
test('campaign and notes use distinct CAS revisions with no lost edits',async()=>{
 let x=await setup(),p=`/${x.id}`;let inputs=[{scope:x.sa,revision:1,name:'A',shared:{round:1}},{scope:x.sa,revision:1,name:'B',shared:{round:2}}];let r=await Promise.all(inputs.map(v=>call(x.a,p,'PUT',v)));assert.deepEqual(r.map(v=>v.status).sort(),[200,409]);let d=await j(await call(x.a,p));assert.equal(d.revision,2);assert(['A','B'].includes(d.name));
 r=await Promise.all(['a','b'].map(notes=>call(x.a,p+'/notes','PUT',{scope:x.sa,revision:1,notes})));assert.deepEqual(r.map(v=>v.status).sort(),[200,409]);assert.equal((await j(await call(x.a,p))).revision,2);assert.equal((await j(await call(x.a,p+'/notes'))).revision,2);x.db.sql.close();
});
test('player shares are explicit, author-only and individually revisioned; removal deletes their shares',async()=>{
 let x=await setup(),p=`/${x.id}`;await join(x,await invite(x));let detail=await j(await call(x.b,p));let s=await j(await call(x.b,p+'/shares','POST',{scope:x.sb,data:{name:'V',hp:25}}));let owner=await j(await call(x.a,p+'/shares'));assert.equal(owner.shares[0].mine,false);assert.deepEqual(owner.shares[0].data,{name:'V',hp:25});assert.equal((await call(x.a,p+'/shares/'+s.id,'PUT',{scope:x.sa,revision:1,data:{name:'hijacked'}})).status,404);
 let r=await Promise.all([20,19].map(hp=>call(x.b,p+'/shares/'+s.id,'PUT',{scope:x.sb,revision:1,data:{name:'V',hp}})));assert.deepEqual(r.map(v=>v.status).sort(),[200,409]);assert.equal((await call(x.b,p+'/shares/'+s.id,'DELETE',{scope:x.sb,revision:1})).status,409);
 assert.equal((await call(x.c,p+'/members','DELETE',{scope:x.sc,memberId:detail.memberId})).status,404);assert.equal((await call(x.b,p+'/members','DELETE',{scope:x.sb,memberId:x.owner})).status,404);assert.equal((await call(x.b,p+'/members','DELETE',{scope:x.sb,memberId:detail.memberId})).status,200);assert.equal((await call(x.b,p)).status,404);assert.deepEqual((await j(await call(x.a,p+'/shares'))).shares,[]);x.db.sql.close();
});
test('origin, account-switch, bounds, malformed input and owner delete fail closed',async()=>{
 let x=await setup(),p=`/${x.id}`;assert.equal((await call(x.a,p,'PUT',{scope:x.sa,revision:1,name:'X',shared:{}},{origin:'https://evil.example'})).status,403);assert.equal((await call(x.b,p+'/shares','POST',{scope:x.sa,data:{}})).status,409);assert.equal((await call(x.a,p,'PUT',{scope:x.sa,revision:1,name:'X',shared:{huge:'x'.repeat(40000)}})).status,400);assert.equal((await call(x.a,p,'PUT',{scope:x.sa,revision:1,name:'X',shared:JSON.parse('{"__proto__":{"bad":1}}')})).status,400);
 let inv=await invite(x);await join(x,inv);assert.equal((await call(x.a,p,'DELETE',{scope:x.sa})).status,200);assert.equal((await call(x.a,p)).status,404);assert.equal((await call(x.b,p)).status,404);for(let t of ['shared_campaigns','campaign_members','campaign_invites','campaign_shares'])assert.equal(x.db.sql.prepare(`select count(*) as n from ${t}`).get().n,0);x.db.sql.close();
});
