import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPostgresD1, translateSql, LOCK_SQL } from '../lib/postgres-d1.mjs';
import { createStateService, accountScope } from '../lib/state-service.mjs';

function mockPool(handler = async () => ({ rows: [], rowCount: 0 })) {
  const calls = [], releases = [];
  const query = async (sql, params) => { calls.push([sql, params]); return handler(sql, params); };
  return { calls, releases, query, async connect() { return { query, release(error) { releases.push(error); } }; } };
}

test('translates placeholders without changing quoted text or comments', () => {
  const source = `SELECT '?', "?", $$?$$, $tag$?$tag$, ? -- ?\n/* ? */ WHERE name = ? AND note = 'it''s ?'`;
  assert.deepEqual(translateSql(source), {sql:`SELECT '?', "?", $$?$$, $tag$?$tag$, $1 -- ?\n/* ? */ WHERE name = $2 AND note = 'it''s ?'`,parameters:2});
  assert.throws(() => translateSql("SELECT 'unfinished"), /Unterminated/);
});

test('converts the SQLite invitation insert to a conflict-safe PostgreSQL insert', () => {
  const input = "INSERT OR IGNORE INTO campaign_members (id,campaign_id,user_id,role,joined_at) SELECT ?,campaign_id,?,'player',? FROM campaign_invites WHERE token_hash=? AND used_by=? AND used_at=? AND revoked_at IS NULL AND expires_at>?";
  const actual = translateSql(input);
  assert.match(actual.sql, /^INSERT INTO campaign_members/);
  assert.match(actual.sql, /expires_at>\$7 ON CONFLICT DO NOTHING$/);
  assert.equal(actual.parameters, 7);
  assert.throws(() => translateSql('INSERT OR IGNORE INTO x VALUES (?); DELETE FROM x'), /Unsupported/);
});

test('first and all preserve bound data and adapt PostgreSQL results', async () => {
  const pool = mockPool(async () => ({rows:[{name:'one', revision:'9'}],rowCount:1}));
  const db = createPostgresD1(pool), statement = db.prepare('SELECT name,revision FROM x WHERE name=?').bind("O'Reilly");
  assert.deepEqual(await statement.first(), {name:'one',revision:'9'});
  assert.equal(await statement.first('name'), 'one');
  assert.deepEqual((await statement.all()).results, [{name:'one',revision:'9'}]);
  assert.equal(pool.calls[0][0], 'SELECT name,revision FROM x WHERE name=$1');
  assert.deepEqual(pool.calls[0][1], ["O'Reilly"]);
  assert.throws(() => db.prepare('SELECT ?').bind(), /bindings/);
  await assert.rejects(() => db.prepare('SELECT ?').first(), /not bound/);
  assert.equal(pool.releases.length, 0);
});

test('batch commits in order under the shared write lock and exposes row counts', async () => {
  const pool = mockPool(async sql => ({rows:[],rowCount:sql.startsWith('INSERT')?1:0}));
  const db = createPostgresD1(pool);
  const result = await db.batch([db.prepare('INSERT INTO x VALUES (?)').bind('a'),db.prepare('UPDATE x SET n=? WHERE id=?').bind(2,'a')]);
  assert.deepEqual(pool.calls.map(x=>x[0]), ['BEGIN',LOCK_SQL,'INSERT INTO x VALUES ($1)','UPDATE x SET n=$1 WHERE id=$2','COMMIT']);
  assert.deepEqual(result.map(x=>x.meta.changes), [1,0]);
  assert.equal(pool.releases.length, 1);
  assert.equal(pool.releases[0], undefined);
  const other = createPostgresD1(pool);
  await assert.rejects(() => db.batch([other.prepare('SELECT 1')]), /Invalid batch/);
});

test('failed batches roll back and damaged connections are discarded', async () => {
  const pool = mockPool(async sql => { if (sql === 'UPDATE x SET n=$1') throw new Error('write failed'); return {rows:[],rowCount:1}; });
  const db=createPostgresD1(pool);
  await assert.rejects(() => db.batch([db.prepare('INSERT INTO x VALUES (?)').bind(1),db.prepare('UPDATE x SET n=?').bind(2)]), /write failed/);
  assert.deepEqual(pool.calls.map(x=>x[0]), ['BEGIN',LOCK_SQL,'INSERT INTO x VALUES ($1)','UPDATE x SET n=$1','ROLLBACK']);
  assert.equal(pool.releases[0], undefined);
  const broken=mockPool(async sql=>{if(sql==='UPDATE x SET n=$1')throw new Error('write failed');if(sql==='ROLLBACK')throw new Error('rollback failed');return {rows:[],rowCount:1}});
  await assert.rejects(() => createPostgresD1(broken).prepare('UPDATE x SET n=?').bind(1).run(), /write failed/);
  assert.ok(broken.releases[0] instanceof Error);
});

test('existing state service retains optimistic revision and account isolation through the adapter', async () => {
  const rows = new Map();
  const pool=mockPool(async (sql, params=[])=>{
    if (sql === 'BEGIN'||sql===LOCK_SQL||sql==='COMMIT'||sql==='ROLLBACK') return {rows:[],rowCount:null};
    if (sql.startsWith('SELECT revision, state_json')) { const row=rows.get(params[0]); return {rows:row?[row]:[],rowCount:row?1:0}; }
    if (sql.startsWith('INSERT INTO user_states')) { const [user,encoded]=params;if(rows.has(user))return {rows:[],rowCount:0};rows.set(user,{revision:1,state_json:encoded});return {rows:[],rowCount:1}; }
    if (sql.startsWith('UPDATE user_states')) { const [encoded,,user,revision]=params;const row=rows.get(user);if(!row||row.revision!==revision)return {rows:[],rowCount:0};rows.set(user,{revision:revision+1,state_json:encoded});return {rows:[],rowCount:1}; }
    throw new Error('Unexpected SQL in test');
  });
  let user='person-a';const db=createPostgresD1(pool),service=createStateService({getIdentity:async()=>({userId:user}),getDatabase:()=>db});
  const state={characters:[],campaigns:[]},scope=await accountScope(user),request=(revision,requestedScope=scope)=>new Request('https://example.test/api/state',{method:'PUT',headers:{origin:'https://example.test','content-type':'application/json'},body:JSON.stringify({scope:requestedScope,revision,data:state})});
  assert.equal((await service.put(request(0))).status,201);
  assert.equal((await service.put(request(0))).status,409);
  assert.equal((await service.put(request(1))).status,200);
  user='person-b';assert.equal((await service.put(request(2))).status,409);
  const response=await service.get(new Request('https://example.test/api/state'));assert.equal((await response.json()).data,null);
  user='person-a';const original=await service.get(new Request('https://example.test/api/state'));assert.equal((await original.json()).revision,2);
});
