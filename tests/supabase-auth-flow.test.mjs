import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeReturnTo, siteOrigin, displayNotice, verifiedIdentity, allowedEmail, secureCookieOptions, signIn, signUp, callback, signOut } from '../lib/supabase-auth-flow.mjs';

const post=(path,fields={},origin='https://game.example')=>new Request('https://game.example'+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(fields)});
const fields={email:'choom@example.com',password:'password123',lang:'en',return_to:'/game/index.html'};
function mock(){const calls=[];return {calls,create:async()=>({auth:{
  signInWithPassword:async x=>(calls.push(['login',x]),{error:null}),
  signUp:async x=>(calls.push(['signup',x]),{data:{session:null},error:null}),
  exchangeCodeForSession:async x=>(calls.push(['exchange',x]),{error:null}),
  signOut:async x=>(calls.push(['logout',x]),{error:null}),
  getUser:async()=>(calls.push(['getUser']),{data:{user:{id:'user-123',email:'choom@example.com',email_confirmed_at:'2026-01-01T00:00:00Z'}},error:null}),
  getSession:async()=>{throw new Error('Unverified session must not be used')}
}})}}
test('return paths are same-origin and restricted to game, with no open redirects or unsafe notices',()=>{
 for(const input of ['//evil.test','https://evil.test/','/\\evil.test','/auth/callback','/%2F%2Fevil.test','/game/other','\n//evil.test'])assert.equal(safeReturnTo(input),'/game/index.html');
 assert.equal(safeReturnTo('/game/index.html?x=1#section'),'/game/index.html?x=1#section');assert.equal(displayNotice('constructor','en'),'');assert.equal(displayNotice('__proto__','ru'),'');
});
test('signup callback origin requires configured secure origin, except local development',()=>{
 assert.equal(siteOrigin('https://example.com','https://evil.test/',true),'https://example.com');
 for(const input of ['http://example.com','https://u:p@example.com','https://example.com/path','https://example.com/?x=1'])assert.equal(siteOrigin(input,'https://example.com/',true),null);
 assert.equal(siteOrigin(undefined,'https://evil.test/',true),null);assert.equal(siteOrigin(undefined,'http://localhost:3000/',false),'http://localhost:3000');
});
test('cookies are server-only and secure in production while preserving deletion and expiration',()=>{
 const expires=new Date('2030-01-01T00:00:00Z');
 assert.deepEqual(secureCookieOptions({path:'/wrong',sameSite:'none',httpOnly:false,secure:false,expires,maxAge:0},true),{path:'/',sameSite:'lax',httpOnly:true,secure:true,expires,maxAge:0});
 assert.deepEqual(secureCookieOptions(undefined,false),{httpOnly:true,secure:false,sameSite:'lax',path:'/'});
});
test('identity calls server-verified getUser, never trusts a session or caller headers',async()=>{
 const m=mock(),identity=await verifiedIdentity(m.create,'CHOOM@example.com');assert.equal(identity.userId,'user-123');assert.deepEqual(m.calls.map(x=>x[0]),['getUser']);
 assert.equal(await verifiedIdentity(m.create,''),null);assert.equal(await verifiedIdentity(m.create,'someone@example.com'),null);
 assert.equal(await verifiedIdentity(async()=>({auth:{getUser:async()=>({data:{user:{id:'forged',email:'choom@example.com',email_confirmed_at:'2026-01-01T00:00:00Z'}},error:{message:'expired'}})}}),'choom@example.com'),null);
 assert.equal(await verifiedIdentity(async()=>({auth:{getUser:async()=>({data:{user:{id:'x',email:'choom@example.com',confirmed_at:'2026-01-01T00:00:00Z',user_metadata:{email_confirmed_at:'2026-01-01'}}},error:null})}}),'choom@example.com'),null);
 assert.equal(await verifiedIdentity(async()=>{throw new Error('not configured')},'choom@example.com'),null);
});
test('allowlist requires a configured, well-formed list and matches multiple confirmed addresses case-insensitively',()=>{
 assert.equal(allowedEmail('ChOoM@example.com','other@example.com, choom@EXAMPLE.com'),true);
 for(const list of [undefined,'','other@example.com','choom@example.com,','*,choom@example.com'])assert.equal(allowedEmail('choom@example.com',list),false);
 assert.equal(allowedEmail('other@example.com','other@example.com\nchoom@example.com'),true);
});
test('allowlist never folds Unicode compatibility characters or applies mailbox-provider alias rules',()=>{
 for(const address of ['ｃhoom@example.com','choom＠example.com','choom@ｅxample.com','\u212A@example.com','c\u043Eom@example.com','choom@exаmple.com','\u00a0choom@example.com'])assert.equal(allowedEmail(address,'choom@example.com'),false);
 assert.equal(allowedEmail('choom@example.com','ｃhoom@example.com'),false);
 assert.equal(allowedEmail('ch.oom@example.com','choom@example.com'),false);
 assert.equal(allowedEmail('choom+game@example.com','choom@example.com'),false);
 assert.equal(allowedEmail('ChOoM+Game@Example.COM','choom+game@example.com'),true);
 for(const address of ['.choom@example.com','choom..x@example.com','choom@-example.com','choom@example-.com'])assert.equal(allowedEmail(address,address),false);
});
test('credential input is ASCII-validated before trimming and sent in the same canonical form as allowlist checks',async()=>{
 const m=mock(),bad=await signIn(post('/auth/login',{...fields,email:'\u00a0choom@example.com'}),m.create,'choom@example.com');assert.match(bad.headers.get('location'),/notice=invalid/);assert.equal(m.calls.length,0);
 const ok=await signIn(post('/auth/login',{...fields,email:'  CHOOM@Example.COM '}),m.create,'choom@example.com');assert.equal(ok.headers.get('location'),'/game/index.html');assert.equal(m.calls[0][1].email,'choom@example.com');
});
test('same-origin login delegates credentials and responds without caching or leaking them',async()=>{
 const m=mock(),response=await signIn(post('/auth/login',fields),m.create,'choom@example.com');assert.equal(response.status,303);assert.equal(response.headers.get('location'),'/game/index.html');assert.match(response.headers.get('cache-control'),/no-store/);assert.equal(m.calls[0][1].email,fields.email);assert.equal(await response.text(),'');
 const rejected=await signIn(post('/auth/login',fields,'https://evil.example'),m.create,'choom@example.com');assert.equal(rejected.status,403);assert.equal(m.calls.length,2);
});
test('invalid login and upstream errors return generic messages, never a third-party redirect',async()=>{
 const m=mock(),bad=await signIn(post('/auth/login',{...fields,password:'x',return_to:'//evil.example'}),m.create,'choom@example.com');assert.equal(m.calls.length,0);assert.match(bad.headers.get('location'),/^\/auth\/signin\?/);assert.doesNotMatch(bad.headers.get('location'),/evil/);
 const failed=await signIn(post('/auth/login',fields),async()=>({auth:{signInWithPassword:async()=>({error:{message:'secret detail'}})}}),'choom@example.com');assert.doesNotMatch(failed.headers.get('location'),/secret/);assert.match(failed.headers.get('location'),/notice=signin/);
 const denied=await signIn(post('/auth/login',fields),m.create,'other@example.com');assert.match(denied.headers.get('location'),/notice=signin/);assert.equal(m.calls.length,0);
});
test('registration uses configured callback and retains no secrets in redirect',async()=>{
 const m=mock(),response=await signUp(post('/auth/register',{...fields,return_to:'//evil.example'}),m.create,'https://game.example',true,'choom@example.com');const call=m.calls[0][1];const cb=new URL(call.options.emailRedirectTo);assert.equal(cb.origin,'https://game.example');assert.equal(cb.pathname,'/auth/callback');assert.equal(cb.searchParams.get('return_to'),'/game/index.html');assert.match(response.headers.get('location'),/notice=email/);assert.doesNotMatch(response.headers.get('location'),/password|choom/);
 const unavailable=await signUp(post('/auth/register',fields),m.create,undefined,true,'choom@example.com');assert.match(unavailable.headers.get('location'),/notice=configured/);assert.equal(m.calls.length,1);
 const denied=await signUp(post('/auth/register',fields),m.create,'https://game.example',true,'other@example.com');assert.match(denied.headers.get('location'),/notice=email/);assert.equal(m.calls.length,1);
});
test('signup on a preview or alternate origin is rejected before writing PKCE cookies',async()=>{
 const m=mock(),response=await signUp(post('/auth/register',fields),m.create,'https://primary.example',true,'choom@example.com');
 assert.equal(m.calls.length,0);assert.equal(response.status,303);assert.match(response.headers.get('location'),/^\/auth\/signup\?/);assert.match(response.headers.get('location'),/notice=canonical/);assert.doesNotMatch(response.headers.get('location'),/password|choom/);
 const text=displayNotice('canonical','en');assert.match(text,/primary site address/);
});
test('unverified or unauthorised sessions are cleared after credential and callback exchange',async()=>{
 const calls=[],client={auth:{
  signInWithPassword:async()=>({error:null}),exchangeCodeForSession:async()=>({error:null}),
  getUser:async()=>({data:{user:{id:'unconfirmed',email:'choom@example.com',user_metadata:{email_confirmed_at:'2026-01-01'}}},error:null}),
  signOut:async opts=>(calls.push(opts),{error:null})
 }};
 const login=await signIn(post('/auth/login',fields),async()=>client,'choom@example.com');assert.match(login.headers.get('location'),/notice=signin/);
 const exchanged=await callback(new Request('https://game.example/auth/callback?code=valid&lang=en'),async()=>client,'choom@example.com');assert.match(exchanged.headers.get('location'),/notice=callback/);
 assert.deepEqual(calls,[{scope:'local'},{scope:'local'}]);
});
test('PKCE callback and local signout are fail-closed and disallow cross-origin writes',async()=>{
 const m=mock(),response=await callback(new Request('https://game.example/auth/callback?code=abc&return_to=%2F%2Fevil.example&lang=en'),m.create,'choom@example.com');assert.equal(response.headers.get('location'),'/game/index.html');assert.equal(m.calls[0][0],'exchange');
 const invalid=await callback(new Request('https://game.example/auth/callback?lang=en'),m.create,'choom@example.com');assert.match(invalid.headers.get('location'),/notice=callback/);
 assert.equal((await signOut(post('/auth/logout',{lang:'en'},'https://evil.example'),m.create)).status,403);
 const out=await signOut(post('/auth/logout',{lang:'en'}),m.create);assert.match(out.headers.get('location'),/notice=signedout/);assert.deepEqual(m.calls[2],['logout',{scope:'local'}]);
});
