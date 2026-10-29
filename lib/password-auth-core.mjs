import { createHash, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
const scrypt = promisify(scryptCallback);
const digest = value => createHash('sha256').update(value).digest('hex');
const randomToken = () => randomBytes(32).toString('base64url');
const userPattern = /^[A-Za-z0-9_.-]{3,32}$/;
const tokenPattern = /^[A-Za-z0-9_-]{43}$/;
const sessionAge = 30 * 86400000;
const inviteAge = 7 * 86400000;
const lock = 'SELECT pg_advisory_xact_lock(1313034819, 1380271188)';
const saltPattern = /^[a-f0-9]{32}$/;
const hashPattern = /^[a-f0-9]{64}$/;
const safeEqual = (a, b) => { const x=Buffer.from(a), y=Buffer.from(b); return x.length===y.length && timingSafeEqual(x,y); };
const validUsername = name => typeof name === 'string' && userPattern.test(name);
const validPassword = value => typeof value === 'string' && value.length >= 12 && value.length <= 128 && Buffer.byteLength(value, 'utf8') <= 512;
// OWASP's scrypt minimum for a 16 MiB work factor. Salt is unique per account.
async function passwordHash(password, salt) { return (await scrypt(password, Buffer.from(salt,'hex'), 32, {N:16384,r:8,p:5,maxmem:64*1024*1024})).toString('hex'); }
export function createPasswordAuth(pool, options = {}) {
 const now = () => (options.now ? options.now() : Date.now());
 async function transaction(fn) {
  const client=await pool.connect(); let active=false;
  try { await client.query('BEGIN'); active=true; await client.query(lock); const result=await fn(client); await client.query('COMMIT'); active=false; return result; }
  catch(e) { if(active) try { await client.query('ROLLBACK'); } catch {} throw e; }
  finally { client.release(); }
 }
 async function rate(key, max) {
  const stamp=now(); const windowMs=15*60000;
  const result=await pool.query(`INSERT INTO public.app_auth_limits(bucket,started_at,attempts) VALUES($1,$2,1)
    ON CONFLICT(bucket) DO UPDATE SET started_at=CASE WHEN app_auth_limits.started_at <= $3 THEN $2 ELSE app_auth_limits.started_at END,
    attempts=CASE WHEN app_auth_limits.started_at <= $3 THEN 1 ELSE app_auth_limits.attempts+1 END RETURNING attempts`, [digest(key),stamp,stamp-windowMs]);
  return Number(result.rows[0].attempts)<=max;
 }
 async function makeSession(client, accountId) {
  const token=randomToken(), expires=now()+sessionAge;
  await client.query('INSERT INTO public.app_sessions(token_hash,account_id,expires_at) VALUES($1,$2,$3)',[digest(token),accountId,expires]);
  return {token,expires};
 }
 async function register(username,password,inviteCode,bootstrapCode) {
  if(!validUsername(username)||!validPassword(password)||typeof inviteCode!=='string'||inviteCode.length>128) return null;
  if(!await rate('register:global',200)) return null;
  const name=username.toLowerCase(), code=inviteCode.trim();
  const canBootstrap=typeof bootstrapCode==='string' && bootstrapCode.length>=32 && safeEqual(code,bootstrapCode);
  if(!canBootstrap && !tokenPattern.test(code)) return null;
  // Avoid expensive password hashing when the code is clearly unusable.
  if(!canBootstrap) { const check=await pool.query('SELECT 1 FROM public.app_access_invites WHERE token_hash=$1 AND used_at IS NULL AND revoked_at IS NULL AND expires_at>$2',[digest(code),now()]); if(!check.rows.length)return null; }
  const salt=randomBytes(16).toString('hex'), hash=await passwordHash(password,salt), id=randomUUID();
  try { return await transaction(async client => {
   const stamp=now(); let owner=false;
   if(canBootstrap) { const found=await client.query('SELECT id FROM public.app_accounts WHERE is_owner = true'); if(found.rows.length)return null; owner=true; }
   else { const updated=await client.query('UPDATE public.app_access_invites SET used_at=$2 WHERE token_hash=$1 AND used_at IS NULL AND revoked_at IS NULL AND expires_at>$2 RETURNING id',[digest(code),stamp]); if(!updated.rows.length)return null; }
   await client.query('INSERT INTO public.app_accounts(id,username,password_salt,password_hash,is_owner,created_at) VALUES($1,$2,$3,$4,$5,$6)',[id,name,salt,hash,owner,stamp]);
   return makeSession(client,id);
  }); } catch(error) { if(error?.code==='23505')return null; throw error; }
 }
 async function login(username,password) {
  if(!validUsername(username)||!validPassword(password))return null;
  const name=username.toLowerCase();
  if(!await rate('login:global',400) || !await rate('login:user:'+name,10))return null;
  const found=await pool.query('SELECT id,password_salt,password_hash FROM public.app_accounts WHERE username=$1',[name]);
  const row=found.rows[0];
  const salt=row && saltPattern.test(row.password_salt) ? row.password_salt : '00000000000000000000000000000000';
  const expected=row && hashPattern.test(row.password_hash) ? row.password_hash : '0000000000000000000000000000000000000000000000000000000000000000';
  const actual=await passwordHash(password,salt);
  if(!row||!safeEqual(actual,expected))return null;
  return transaction(async client=>{ await client.query('DELETE FROM public.app_auth_limits WHERE bucket=$1',[digest('login:user:'+name)]); return makeSession(client,row.id); });
 }
 async function identity(token, client=pool) {
  if(typeof token!=='string'||!tokenPattern.test(token))return null;
  const result=await client.query('SELECT a.id,a.username,a.is_owner FROM public.app_sessions s JOIN public.app_accounts a ON a.id=s.account_id WHERE s.token_hash=$1 AND s.expires_at>$2',[digest(token),now()]);
  const row=result.rows[0]; return row ? {userId:row.id,username:row.username,isOwner:row.is_owner===true,email:'',displayName:row.username,fullName:null} : null;
 }
 async function logout(token) { if(typeof token==='string'&&tokenPattern.test(token))await pool.query('DELETE FROM public.app_sessions WHERE token_hash=$1',[digest(token)]); }
 async function listInvites(token) { const user=await identity(token); if(!user?.isOwner)return null; const result=await pool.query('SELECT id,created_at,expires_at,used_at,revoked_at FROM public.app_access_invites ORDER BY created_at DESC LIMIT 100'); return {userId:user.userId,username:user.username,isOwner:true,invites:result.rows.map(x=>({id:x.id,createdAt:Number(x.created_at),expiresAt:Number(x.expires_at),usedAt:x.used_at===null?null:Number(x.used_at),revokedAt:x.revoked_at===null?null:Number(x.revoked_at)}))}; }
 async function createInvite(token) { return transaction(async client=>{ const user=await identity(token,client); if(!user?.isOwner)return null; const count=await client.query('SELECT count(*) AS n FROM public.app_access_invites WHERE used_at IS NULL AND revoked_at IS NULL AND expires_at>$1',[now()]); if(Number(count.rows[0].n)>=100)return null; const code=randomToken(),stamp=now(); await client.query('INSERT INTO public.app_access_invites(id,token_hash,created_at,expires_at) VALUES($1,$2,$3,$4)',[randomUUID(),digest(code),stamp,stamp+inviteAge]); return code; }); }
 async function revokeInvite(token,id) { const user=await identity(token); if(!user?.isOwner||typeof id!=='string'||id.length>100)return false; const result=await pool.query('UPDATE public.app_access_invites SET revoked_at=$2 WHERE id=$1 AND revoked_at IS NULL AND used_at IS NULL',[id,now()]); return result.rowCount===1; }
 return {register,login,identity,logout,listInvites,createInvite,revokeInvite};
}
export {validUsername,validPassword};
