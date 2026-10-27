import {accountScope} from './state-service.mjs';
const res=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const validId=s=>typeof s==='string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
const validName=s=>typeof s==='string' && s.trim().length>0 && s.length<=100;
const validRevision=n=>Number.isSafeInteger(n)&&n>=1&&n<Number.MAX_SAFE_INTEGER;
const HEX=b=>Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');
async function hash(s){return HEX(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))))}
function validData(obj){
 if(!obj||typeof obj!=='object'||Array.isArray(obj))return false;
 let json;try{json=JSON.stringify(obj)}catch{return false}if(new TextEncoder().encode(json).length>32768)return false;
 let q=[[obj,0]],count=0;while(q.length){let [v,d]=q.pop();if(++count>5000||d>12)return false;if(typeof v==='number'&&!Number.isFinite(v))return false;if(typeof v==='string'&&v.length>8000)return false;if(v&&typeof v==='object'){if(Object.keys(v).length>500)return false;for(const [k,x] of Object.entries(v)){if(['__proto__','constructor','prototype'].includes(k)||k.length>120)return false;q.push([x,d+1])}}}return true;
}
async function readBody(req){
 const length=Number(req.headers.get('content-length'));if(Number.isFinite(length)&&length>131072)return {error:'too_large',status:413};
 if(!req.body)return {error:'invalid_json',status:400};let n=0,s='';const reader=req.body.getReader(),dec=new TextDecoder('utf-8',{fatal:true});
 try{while(true){const {done,value}=await reader.read();if(done)break;n+=value.length;if(n>131072){await reader.cancel();return {error:'too_large',status:413}}s+=dec.decode(value,{stream:true})}s+=dec.decode();return {body:JSON.parse(s)}}catch{return {error:'invalid_json',status:400}}finally{reader.releaseLock()}
}
function sameOrigin(req){try{let o=req.headers.get('origin');return !!o&&o!=='null'&&new URL(o).origin===new URL(req.url).origin}catch{return false}}
const dataError=()=>res({error:'invalid_data'},400), missing=()=>res({error:'not_found'},404), conflict=()=>res({error:'revision_conflict'},409);
export function createCampaignService({getIdentity,getDatabase,now=()=>Date.now()}){
 async function handle(req){try{
  const person=await getIdentity(),user=person?.userId;if(typeof user!=='string'||!user||user.length>160)return res({error:'authentication_required'},401);
  const db=getDatabase();if(!db)return res({error:'database_unavailable'},503);
  const path=new URL(req.url).pathname.split('/').filter(Boolean);if(path[0]!=='api'||path[1]!=='campaigns')return missing();const parts=path.slice(2),method=req.method;
  const scope=await accountScope(user);let body={};if(method!=='GET'){
   if(!sameOrigin(req))return res({error:'invalid_origin'},403);if(!/^application\/json(?:\s*;|\s*$)/i.test(req.headers.get('content-type')||''))return res({error:'unsupported_media_type'},415);
   let parsed=await readBody(req);if(parsed.error)return res({error:parsed.error},parsed.status);body=parsed.body;if(!body||typeof body!=='object'||Array.isArray(body))return dataError();if(body.scope!==scope)return res({error:'account_changed'},409);
  }
  const first=async(q,...v)=>db.prepare(q).bind(...v).first(), all=async(q,...v)=>{let x=await db.prepare(q).bind(...v).all();return x.results||[]}, run=async(q,...v)=>db.prepare(q).bind(...v).run();
  const changed=x=>Number(x?.meta?.changes)===1, current=now();
  if(parts.length===0&&method==='GET'){
   let rows=await all('SELECT c.id,c.name,c.revision,c.updated_at,m.role FROM shared_campaigns c JOIN campaign_members m ON m.campaign_id=c.id WHERE m.user_id=? ORDER BY c.updated_at DESC',user);
   return res({scope,campaigns:rows.map(x=>({id:x.id,name:x.name,revision:Number(x.revision),role:x.role,updatedAt:Number(x.updated_at)}))});
  }
  if(parts.length===0&&method==='POST'){
   if(!validName(body.name))return dataError();const id=crypto.randomUUID(),memberId=crypto.randomUUID(),name=body.name.trim();
   await db.batch([db.prepare('INSERT INTO shared_campaigns (id,owner_id,name,revision,shared_json,notes_revision,notes,created_at,updated_at) VALUES (?,?,?,1,?,1,?,?,?)').bind(id,user,name,'{}','',current,current),db.prepare('INSERT INTO campaign_members (id,campaign_id,user_id,role,joined_at) VALUES (?,?,?,\'owner\',?)').bind(memberId,id,user,current)]);
   return res({id,name,revision:1,shared:{},role:'owner',memberId},201);
  }
  if(parts.length===1&&parts[0]==='join'&&method==='POST'){
   if(typeof body.token!=='string'||!/^[0-9a-f]{64}$/.test(body.token))return dataError();const h=await hash(body.token),memberId=crypto.randomUUID(),joinNonce=crypto.randomUUID();
   // A fresh operation nonce binds the INSERT to this exact UPDATE, even if a
   // token is replayed at the same millisecond after membership was removed.
   // Existing members do not consume an invitation intended for another player.
   let out=await db.batch([db.prepare('UPDATE campaign_invites SET used_by=?,used_at=? WHERE token_hash=? AND used_by IS NULL AND revoked_at IS NULL AND expires_at>? AND EXISTS (SELECT 1 FROM shared_campaigns WHERE id=campaign_invites.campaign_id) AND NOT EXISTS (SELECT 1 FROM campaign_members WHERE campaign_id=campaign_invites.campaign_id AND user_id=?)').bind(joinNonce,current,h,current,user),db.prepare("INSERT OR IGNORE INTO campaign_members (id,campaign_id,user_id,role,joined_at) SELECT ?,campaign_id,?,'player',? FROM campaign_invites WHERE token_hash=? AND used_by=? AND used_at=? AND revoked_at IS NULL AND expires_at>?").bind(memberId,user,current,h,joinNonce,current,current)]);
   if(!changed(out[0]))return res({error:'invalid_or_used_invite'},404);
   const invitation=await first('SELECT campaign_id FROM campaign_invites WHERE token_hash=? AND used_by=?',h,joinNonce);if(!invitation)return res({error:'service_unavailable'},503);return res({campaignId:invitation.campaign_id});
  }
  const id=parts[0];if(!validId(id))return missing();
  if(parts.length===1&&method==='GET'){
   const row=await first('SELECT c.id,c.name,c.revision,c.shared_json,m.id AS member_id,m.role FROM shared_campaigns c JOIN campaign_members m ON m.campaign_id=c.id WHERE c.id=? AND m.user_id=?',id,user);if(!row)return missing();
   const members=await all('SELECT id,user_id,role FROM campaign_members WHERE campaign_id=? AND EXISTS (SELECT 1 FROM campaign_members WHERE campaign_id=? AND user_id=?) ORDER BY joined_at,id',id,id,user);
   let shared;try{shared=JSON.parse(row.shared_json)}catch{return res({error:'stored_data_invalid'},500)}if(!validData(shared))return res({error:'stored_data_invalid'},500);
   return res({scope,id:row.id,name:row.name,revision:Number(row.revision),shared,role:row.role,memberId:row.member_id,members:members.map(m=>({id:m.id,role:m.role,mine:m.user_id===user}))});
  }
  if(parts.length===1&&method==='PUT'){
   if(!validName(body.name)||!validRevision(body.revision)||!validData(body.shared))return dataError();
   const out=await run('UPDATE shared_campaigns SET name=?,shared_json=?,revision=revision+1,updated_at=? WHERE id=? AND owner_id=? AND revision=?',body.name.trim(),JSON.stringify(body.shared),current,id,user,body.revision);if(changed(out))return res({revision:body.revision+1});
   if(!await first('SELECT id FROM shared_campaigns WHERE id=? AND owner_id=?',id,user))return missing();return conflict();
  }
  if(parts.length===1&&method==='DELETE'){
   const out=await db.batch([db.prepare('DELETE FROM campaign_shares WHERE campaign_id=? AND EXISTS (SELECT 1 FROM shared_campaigns WHERE id=? AND owner_id=?)').bind(id,id,user),db.prepare('DELETE FROM campaign_invites WHERE campaign_id=? AND EXISTS (SELECT 1 FROM shared_campaigns WHERE id=? AND owner_id=?)').bind(id,id,user),db.prepare('DELETE FROM campaign_members WHERE campaign_id=? AND EXISTS (SELECT 1 FROM shared_campaigns WHERE id=? AND owner_id=?)').bind(id,id,user),db.prepare('DELETE FROM shared_campaigns WHERE id=? AND owner_id=?').bind(id,user)]);return changed(out[3])?res({ok:true}):missing();
  }
  if(parts.length===2&&parts[1]==='notes'&&method==='GET'){
   const row=await first('SELECT notes,notes_revision FROM shared_campaigns WHERE id=? AND owner_id=?',id,user);return row?res({scope,notes:row.notes,revision:Number(row.notes_revision)}):missing();
  }
  if(parts.length===2&&parts[1]==='notes'&&method==='PUT'){
   if(typeof body.notes!=='string'||body.notes.length>50000||!validRevision(body.revision))return dataError();
   const out=await run('UPDATE shared_campaigns SET notes=?,notes_revision=notes_revision+1 WHERE id=? AND owner_id=? AND notes_revision=?',body.notes,id,user,body.revision);if(changed(out))return res({revision:body.revision+1});if(!await first('SELECT id FROM shared_campaigns WHERE id=? AND owner_id=?',id,user))return missing();return conflict();
  }
  if(parts.length===2&&parts[1]==='invites'&&method==='GET'){
   if(!await first('SELECT id FROM shared_campaigns WHERE id=? AND owner_id=?',id,user))return missing();let rows=await all('SELECT id,expires_at,used_at,revoked_at FROM campaign_invites WHERE campaign_id=? ORDER BY (used_at IS NULL AND revoked_at IS NULL AND expires_at>?) DESC,expires_at DESC LIMIT 100',id,current);
   return res({scope,invites:rows.map(x=>({id:x.id,expiresAt:Number(x.expires_at),usedAt:x.used_at===null?null:Number(x.used_at),revokedAt:x.revoked_at===null?null:Number(x.revoked_at)}))});
  }
  if(parts.length===2&&parts[1]==='invites'&&method==='POST'){
   const token=HEX(crypto.getRandomValues(new Uint8Array(32))),h=await hash(token),inviteId=crypto.randomUUID(),expiresAt=current+7*24*60*60*1000;
   const out=await run('INSERT INTO campaign_invites (id,campaign_id,token_hash,expires_at) SELECT ?,id,?,? FROM shared_campaigns WHERE id=? AND owner_id=? AND (SELECT COUNT(*) FROM campaign_invites WHERE campaign_id=? AND used_at IS NULL AND revoked_at IS NULL AND expires_at>?)<50',inviteId,h,expiresAt,id,user,id,current);if(changed(out))return res({id:inviteId,token,expiresAt},201);if(!await first('SELECT id FROM shared_campaigns WHERE id=? AND owner_id=?',id,user))return missing();return res({error:'invite_limit'},429);
  }
  if(parts.length===2&&parts[1]==='invites'&&method==='DELETE'){
   if(!validId(body.inviteId))return dataError();const out=await run('UPDATE campaign_invites SET revoked_at=? WHERE id=? AND campaign_id=? AND revoked_at IS NULL AND EXISTS (SELECT 1 FROM shared_campaigns WHERE id=? AND owner_id=?)',current,body.inviteId,id,id,user);return changed(out)?res({ok:true}):missing();
  }
  if(parts.length===2&&parts[1]==='members'&&method==='DELETE'){
   if(!validId(body.memberId))return dataError();
   const out=await db.batch([db.prepare("UPDATE campaign_invites SET revoked_at=? WHERE campaign_id=? AND used_by IS NULL AND revoked_at IS NULL AND EXISTS (SELECT 1 FROM shared_campaigns WHERE id=? AND owner_id=?) AND EXISTS (SELECT 1 FROM campaign_members WHERE id=? AND campaign_id=? AND role='player')").bind(current,id,id,user,body.memberId,id),db.prepare("DELETE FROM campaign_shares WHERE campaign_id=? AND user_id=(SELECT user_id FROM campaign_members WHERE id=? AND campaign_id=? AND role='player' AND (user_id=? OR EXISTS (SELECT 1 FROM shared_campaigns WHERE id=? AND owner_id=?)))").bind(id,body.memberId,id,user,id,user),db.prepare("DELETE FROM campaign_members WHERE id=? AND campaign_id=? AND role='player' AND (user_id=? OR EXISTS (SELECT 1 FROM shared_campaigns WHERE id=? AND owner_id=?))").bind(body.memberId,id,user,id,user)]);return changed(out[2])?res({ok:true}):missing();
  }
  if(parts.length===2&&parts[1]==='shares'&&method==='GET'){
   if(!await first('SELECT id FROM campaign_members WHERE campaign_id=? AND user_id=?',id,user))return missing();let rows=await all('SELECT s.id,s.user_id,s.revision,s.data_json,s.updated_at,m.id AS member_id FROM campaign_shares s JOIN campaign_members m ON m.campaign_id=s.campaign_id AND m.user_id=s.user_id WHERE s.campaign_id=? AND EXISTS (SELECT 1 FROM campaign_members WHERE campaign_id=? AND user_id=?) ORDER BY s.updated_at,s.id',id,id,user);let shares=[];
   for(let x of rows){let data;try{data=JSON.parse(x.data_json)}catch{return res({error:'stored_data_invalid'},500)}if(!validData(data))return res({error:'stored_data_invalid'},500);shares.push({id:x.id,memberId:x.member_id,revision:Number(x.revision),data,mine:x.user_id===user,updatedAt:Number(x.updated_at)})}return res({scope,shares});
  }
  if(parts.length===2&&parts[1]==='shares'&&method==='POST'){
   if(!validData(body.data))return dataError();const shareId=crypto.randomUUID();const out=await run('INSERT INTO campaign_shares (id,campaign_id,user_id,revision,data_json,updated_at) SELECT ?,campaign_id,user_id,1,?,? FROM campaign_members WHERE campaign_id=? AND user_id=?',shareId,JSON.stringify(body.data),current,id,user);return changed(out)?res({id:shareId,revision:1},201):missing();
  }
  if(parts.length===3&&parts[1]==='shares'&&validId(parts[2])&&(method==='PUT'||method==='DELETE')){
   if(!validRevision(body.revision)||(method==='PUT'&&!validData(body.data)))return dataError();const shareId=parts[2];
   let out=method==='PUT'?await run('UPDATE campaign_shares SET data_json=?,revision=revision+1,updated_at=? WHERE id=? AND campaign_id=? AND user_id=? AND revision=? AND EXISTS (SELECT 1 FROM campaign_members WHERE campaign_id=? AND user_id=?)',JSON.stringify(body.data),current,shareId,id,user,body.revision,id,user):await run('DELETE FROM campaign_shares WHERE id=? AND campaign_id=? AND user_id=? AND revision=? AND EXISTS (SELECT 1 FROM campaign_members WHERE campaign_id=? AND user_id=?)',shareId,id,user,body.revision,id,user);
   if(changed(out))return method==='PUT'?res({revision:body.revision+1}):res({ok:true});if(!await first('SELECT id FROM campaign_shares WHERE id=? AND campaign_id=? AND user_id=? AND EXISTS (SELECT 1 FROM campaign_members WHERE campaign_id=? AND user_id=?)',shareId,id,user,id,user))return missing();return conflict();
  }
  return missing();
 }catch{return res({error:'service_unavailable'},503)}}
 return {handle};
}

