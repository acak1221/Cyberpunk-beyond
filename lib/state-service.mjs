// Dependencies are injected so this exact service can be tested against a local SQLite D1 adapter.
// Production route supplies Sites-authenticated identity and Cloudflare D1; no client identity is trusted.
const MAX_BYTES = 1024 * 1024;
const MAX_NODES = 80000;
const MAX_DEPTH = 32;
const MAX_STRING = 100000;
// The client can record up to 10,000 dated rest days. Keep the server's
// per-array bound aligned so valid medical records remain saveable.
const MAX_ARRAY = 10000;
const LIMITS = Object.freeze({characters: 200, campaigns: 100, history: 100});
const forbiddenKeys = new Set(['__proto__','constructor','prototype']);
const isObject = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const response = (body,status=200) => Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const validId = value => typeof value === 'string' && value.length > 0 && value.length <= 160;
const SCOPE_PREFIX = 'nightcity-red:site-account-scope:v1\0';
export async function accountScope(userId){
  // Domain-separated stable account label; not a credential or authorization token.
  const bytes = new TextEncoder().encode(SCOPE_PREFIX + userId);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return 'nc1_' + Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2,'0')).join('');
}

function inspectTree(root){
  const stack=[[root,0]];let nodes=0;
  while(stack.length){
    const [v,depth]=stack.pop(); if(++nodes>MAX_NODES || depth>MAX_DEPTH) return false;
    if(typeof v==='string' && v.length>MAX_STRING) return false;
    if(typeof v==='number' && !Number.isFinite(v)) return false;
    if(!v || typeof v!=='object') continue;
    if(Array.isArray(v)){ if(v.length>MAX_ARRAY) return false; for(const x of v) stack.push([x,depth+1]); }
    else { const keys=Object.keys(v); if(keys.length>1000) return false; for(const k of keys){if(k.length>200||forbiddenKeys.has(k))return false;stack.push([v[k],depth+1]);} }
  }
  return true;
}
export function validState(state){
  if(!isObject(state)||!Array.isArray(state.characters)||!Array.isArray(state.campaigns))return false;
  if(state.characters.length>LIMITS.characters||state.campaigns.length>LIMITS.campaigns)return false;
  if(state.history!==undefined&&(!Array.isArray(state.history)||state.history.length>LIMITS.history))return false;
  if(state.lang!==undefined&&!['ru','en'].includes(state.lang))return false;
  const chars=new Set();for(const c of state.characters){
    if(!isObject(c)||!validId(c.id)||chars.has(c.id)||typeof c.name!=='string'||!isObject(c.stats)||!isObject(c.skills))return false;
    chars.add(c.id);
  }
  const camps=new Set();for(const c of state.campaigns){
    if(!isObject(c)||!validId(c.id)||camps.has(c.id)||typeof c.name!=='string'||!Array.isArray(c.roster)||c.roster.length>500)return false;
    camps.add(c.id);const roster=new Set();for(const r of c.roster){if(!isObject(r)||!validId(r.id)||roster.has(r.id)||!['pc','npc'].includes(r.kind))return false;roster.add(r.id)}
  }
  return inspectTree(state);
}
async function limitedJSON(request){
  const advertised=Number(request.headers.get('content-length'));
  if(Number.isFinite(advertised)&&advertised>MAX_BYTES)return {error:'too_large',status:413};
  if(!request.body)return {error:'invalid_json',status:400};
  const reader=request.body.getReader(),decoder=new TextDecoder('utf-8',{fatal:true});let total=0,body='';
  try{while(true){let {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>MAX_BYTES){await reader.cancel();return {error:'too_large',status:413}}body+=decoder.decode(value,{stream:true})}body+=decoder.decode();return {value:JSON.parse(body)}}catch{return {error:'invalid_json',status:400}}finally{reader.releaseLock()}
}
function sameOrigin(request){
  const origin=request.headers.get('origin');
  // PUT from the first-party browser sends Origin. No missing or opaque origins are accepted.
  if(!origin||origin==='null')return false;
  try{return new URL(origin).origin===new URL(request.url).origin}catch{return false}
}
export function createStateService({getIdentity,getDatabase}){
  async function identity(){let user=await getIdentity();return validId(user?.userId)?user.userId:null}
  async function get(request){
    try{const userId=await identity();if(!userId)return response({error:'authentication_required'},401);const db=getDatabase();if(!db)return response({error:'database_unavailable'},503);
      const row=await db.prepare('SELECT revision, state_json FROM user_states WHERE user_id = ?').bind(userId).first();
      const scope=await accountScope(userId);
      if(!row)return response({scope,revision:0,data:null});
      const revision=Number(row.revision),data=JSON.parse(row.state_json);if(!Number.isSafeInteger(revision)||revision<1||!validState(data))return response({error:'stored_state_invalid'},500);
      return response({scope,revision,data});
    }catch{return response({error:'service_unavailable'},503)}
  }
  async function put(request){
    try{const userId=await identity();if(!userId)return response({error:'authentication_required'},401);
      if(!sameOrigin(request))return response({error:'invalid_origin'},403);
      if(!/^application\/json(?:\s*;|\s*$)/i.test(request.headers.get('content-type')||''))return response({error:'unsupported_media_type'},415);
      const body=await limitedJSON(request);if(body.error)return response({error:body.error},body.status);
      const input=body.value;
      if(!isObject(input))return response({error:'invalid_state'},400);
      // Bind this write to the same signed-in account that supplied the most recent GET.
      // The scope is a concurrency precondition only: userId always comes from Sites auth.
      if(input.scope!==await accountScope(userId))return response({error:'account_changed'},409);
      if(!Number.isSafeInteger(input.revision)||input.revision<0||input.revision>=Number.MAX_SAFE_INTEGER||!validState(input.data))return response({error:'invalid_state'},400);
      const db=getDatabase();if(!db)return response({error:'database_unavailable'},503);
      const encoded=JSON.stringify(input.data),at=Date.now();let result;
      if(input.revision===0){
        result=await db.prepare('INSERT INTO user_states (user_id, revision, state_json, updated_at) VALUES (?, 1, ?, ?) ON CONFLICT(user_id) DO NOTHING').bind(userId,encoded,at).run();
      }else{
        result=await db.prepare('UPDATE user_states SET revision = revision + 1, state_json = ?, updated_at = ? WHERE user_id = ? AND revision = ?').bind(encoded,at,userId,input.revision).run();
      }
      if(Number(result?.meta?.changes)!==1)return response({error:'revision_conflict'},409);
      return response({revision:input.revision+1},input.revision===0?201:200);
    }catch{return response({error:'service_unavailable'},503)}
  }
  return {get,put};
}
export { MAX_BYTES };

