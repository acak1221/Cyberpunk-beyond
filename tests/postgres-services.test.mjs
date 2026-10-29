import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { createPostgresD1 } from '../lib/postgres-d1.mjs';
import { createStateService, accountScope } from '../lib/state-service.mjs';
import { createCampaignService } from '../lib/campaign-service.mjs';

// Local in-memory PostgreSQL engine only; no user or hosted database is opened.
function poolFor(db) {
  const query = (sql, values = []) => db.query(sql, values);
  return {query, async connect(){return {query, release(){}}}};
}

test('migration also succeeds when Supabase client roles do not exist locally', async () => {
  const pg = new PGlite();
  try {
    await pg.exec(await readFile(new URL('../supabase/migrations/20261029183320_initial_application.sql', import.meta.url), 'utf8'));
    const rows=await pg.query("SELECT relrowsecurity FROM pg_class WHERE relname='user_states'");
    assert.equal(rows.rows[0].relrowsecurity,true);
  } finally { await pg.close(); }
});

test('migration and existing state/campaign services execute against PostgreSQL', async () => {
  const pg = new PGlite();
  try {
    // Supabase commonly has these roles and default grants before migrations run.
    await pg.exec('CREATE ROLE anon; CREATE ROLE authenticated; ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO PUBLIC, anon, authenticated');
    await pg.exec(await readFile(new URL('../supabase/migrations/20261029183320_initial_application.sql', import.meta.url), 'utf8'));
    const tables=await pg.query("SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('user_states','shared_campaigns','campaign_members','campaign_invites','campaign_shares') ORDER BY relname");
    assert.equal(tables.rows.length,5);
    assert.ok(tables.rows.every(x=>x.relrowsecurity===true));
    for (const role of ['anon','authenticated']) for (const table of tables.rows) {
      const privileges=await pg.query('SELECT has_table_privilege($1, $2, $3) AS allowed',[role,`public.${table.relname}`,'SELECT']);
      assert.equal(privileges.rows[0].allowed,false,`${role} can read ${table.relname}`);
    }
    const columns=await pg.query("SELECT data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='shared_campaigns' AND column_name='updated_at'");
    assert.equal(columns.rows[0].data_type,'bigint');

    const database=createPostgresD1(poolFor(pg)); let user='site-owner';
    const state=createStateService({getIdentity:async()=>({userId:user}),getDatabase:()=>database});
    const stateData={characters:[],campaigns:[]}, scope=await accountScope(user);
    const put=(revision)=>new Request('https://local.test/api/state',{method:'PUT',headers:{origin:'https://local.test','content-type':'application/json'},body:JSON.stringify({scope,revision,data:stateData})});
    assert.equal((await state.put(put(0))).status,201);
    assert.equal((await state.put(put(0))).status,409);
    assert.equal((await state.put(put(1))).status,200);
    assert.equal((await (await state.get(new Request('https://local.test/api/state'))).json()).revision,2);

    const campaigns=createCampaignService({getIdentity:async()=>({userId:user}),getDatabase:()=>database,now:()=>1761750000000});
    const call=async (path,method='GET',data={})=>campaigns.handle(new Request(`https://local.test/api/campaigns${path}`,method==='GET'?{}:{method,headers:{origin:'https://local.test','content-type':'application/json'},body:JSON.stringify({...data,scope:await accountScope(user)})}));
    const created=await call('','POST',{name:'Night City'});assert.equal(created.status,201);const campaign=await created.json();
    const invited=await call(`/${campaign.id}/invites`,'POST');assert.equal(invited.status,201);const invitation=await invited.json();
    user='player-a';const joined=await call('/join','POST',{token:invitation.token});assert.equal(joined.status,200);
    assert.equal((await call(`/${campaign.id}/notes`)).status,404);
    user='player-b';assert.equal((await call('/join','POST',{token:invitation.token})).status,404);
    user='site-owner';assert.equal((await call(`/${campaign.id}/notes`)).status,200);
    const updated=await call(`/${campaign.id}`,'PUT',{name:'Night City',revision:1,shared:{scene:'Test'}});assert.equal(updated.status,200);
    assert.equal((await call(`/${campaign.id}`,'PUT',{name:'Night City',revision:1,shared:{}})).status,409);

    await pg.exec('CREATE ROLE test_public; GRANT USAGE ON SCHEMA public TO test_public; GRANT SELECT ON public.user_states TO test_public; SET ROLE test_public');
    const protectedRows=await pg.query('SELECT * FROM public.user_states');assert.equal(protectedRows.rows.length,0);
    await pg.exec('RESET ROLE');

    // A failed D1-style batch must roll the earlier insert back.
    await pg.exec('CREATE TABLE atomic_test (id text PRIMARY KEY)');
    await assert.rejects(()=>database.batch([database.prepare('INSERT INTO atomic_test VALUES (?)').bind('x'),database.prepare('INSERT INTO atomic_test VALUES (?)').bind('x')]));
    assert.equal((await pg.query('SELECT * FROM atomic_test')).rows.length,0);
  } finally { await pg.close(); }
});
