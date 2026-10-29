import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {createPasswordAuth} from '../lib/password-auth-core.mjs';

const bootstrap='bootstrap_secret_0123456789abcdef123456789';
function poolFor(db){const query=async(sql,values=[])=>{const result=await db.query(sql,values);return {...result,rowCount:result.affectedRows??result.rows.length};};return {query,async connect(){return {query,release(){}}}};}

test('password accounts, one-use invitations, role access, expiry, rate limits and revocation',async()=>{
 const db=new PGlite();let now=1800000000000;
 try {
  await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO PUBLIC, anon, authenticated');
  await db.exec(await readFile(new URL('../supabase/migrations/20261029183325_account_access.sql',import.meta.url),'utf8'));
  for(const table of ['app_accounts','app_sessions','app_access_invites','app_auth_limits']){
   const permissions=await db.query(`SELECT has_table_privilege('anon',$1,'SELECT') AS allowed`,[`public.${table}`]);assert.equal(permissions.rows[0].allowed,false);
   const rls=await db.query('SELECT relrowsecurity FROM pg_class WHERE relname=$1',[table]);assert.equal(rls.rows[0].relrowsecurity,true);
  }
  const auth=createPasswordAuth(poolFor(db),{now:()=>now});
  assert.equal(await auth.register('attacker','long secure password','wrong',bootstrap),null);
  const owner=await auth.register('Owner','long secure password',bootstrap,bootstrap);assert.ok(owner?.token);
  assert.equal((await auth.identity(owner.token)).isOwner,true);
  assert.equal(await auth.register('otherowner','long secure password',bootstrap,bootstrap),null);
  const invite=await auth.createInvite(owner.token);assert.ok(invite);
  assert.equal((await auth.listInvites(owner.token)).invites.length,1);
  assert.equal(await auth.identity(invite),null);
  const player=await auth.register('player','player long password',invite,bootstrap);assert.ok(player?.token);
  assert.equal(await auth.register('player2','player long password',invite,bootstrap),null);
  assert.equal((await auth.identity(player.token)).isOwner,false);
  assert.equal(await auth.createInvite(player.token),null);
  assert.equal(await auth.listInvites(player.token),null);
  assert.equal(await auth.login('player','incorrect password'),null);
  const playerLogin=await auth.login('PLAYER','player long password');assert.ok(playerLogin?.token);
  await auth.logout(playerLogin.token);assert.equal(await auth.identity(playerLogin.token),null);
  const code2=await auth.createInvite(owner.token);const listing=await auth.listInvites(owner.token);
  const fresh=listing.invites.find(x=>x.usedAt===null);assert.ok(fresh);
  assert.equal(await auth.revokeInvite(player.token,fresh.id),false);
  assert.equal(await auth.revokeInvite(owner.token,fresh.id),true);
  assert.equal(await auth.register('revoked','long secure password',code2,bootstrap),null);
  const code3=await auth.createInvite(owner.token);now+=8*86400000;
  assert.equal(await auth.register('expired','long secure password',code3,bootstrap),null);
  const code4=await auth.createInvite(owner.token);
  // A uniqueness failure rolls back consumption of the invitation.
  assert.equal(await auth.register('owner','long secure password',code4,bootstrap),null);
  assert.ok(await auth.register('newplayer','long secure password',code4,bootstrap));
  for(let n=0;n<10;n++)assert.equal(await auth.login('player','incorrect password'),null);
  assert.equal(await auth.login('player','player long password'),null);
  now+=16*60000;assert.ok(await auth.login('player','player long password'));
  now+=31*86400000;assert.equal(await auth.identity(owner.token),null);
 } finally {await db.close()}
});
