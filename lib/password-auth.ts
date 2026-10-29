import 'server-only';
import { Pool } from 'pg';
import { cookies } from 'next/headers';
import { createPasswordAuth } from './password-auth-core.mjs';
import { databaseConnectionString, postgresConnectionConfig } from './postgres-connection-config.mjs';
import { safeReturnTo, siteOrigin } from './supabase-auth-flow.mjs';

export const SESSION_COOKIE_NAME = 'nc_session';
let cachedUrl: string | undefined;
let cachedAuth: ReturnType<typeof createPasswordAuth> | null = null;
function service() {
 const url=databaseConnectionString(process.env);
 if(!url)return null;
 const config=postgresConnectionConfig(url);
 if(!config)return null;
 if(cachedAuth)return cachedUrl===url?cachedAuth:null;
 cachedUrl=url; cachedAuth=createPasswordAuth(new Pool(config)); return cachedAuth;
}
export async function readPasswordUserFromToken(token: string | null | undefined) {
 try { if(!token)return null; return await service()?.identity(token) ?? null; } catch { return null; }
}
async function currentToken() { return (await cookies()).get(SESSION_COOKIE_NAME)?.value; }
export async function getPasswordUser() { return readPasswordUserFromToken(await currentToken()); }
export async function getAccountOverview() {
 const token=await currentToken(), user=await readPasswordUserFromToken(token);
 if(!user)return null;
 if(!user.isOwner)return {userId:user.userId,username:user.username,isOwner:false,invites:[]};
 try { return await service()?.listInvites(token!) ?? null; } catch { return null; }
}
const header={'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'};
function redirect(url: string) { return new Response(null,{status:303,headers:{...header,Location:url}}); }
function page(path: string,lang: string,returnTo: string,notice: string) { const q=new URLSearchParams({lang,return_to:returnTo,notice}); return path+'?'+q; }
function allowedOrigin(request:Request) { try { const url=new URL(request.url); const expected=siteOrigin(process.env.APP_BASE_URL,request.url,process.env.NODE_ENV==='production'); const origin=request.headers.get('origin'); return !!expected && url.origin===expected && !!origin && origin===expected; } catch {return false;} }
async function fields(request:Request) { if(!allowedOrigin(request))return null; const kind=request.headers.get('content-type')?.split(';')[0]; if(kind!=='application/x-www-form-urlencoded')return null; const body=await request.text(); if(body.length>4096)return null; return new URLSearchParams(body); }
function parameters(f:URLSearchParams) { return {lang:f.get('lang')==='en'?'en':'ru',returnTo:safeReturnTo(f.get('return_to'))}; }
async function setSession(token:string,expires:number) { const store=await cookies(); store.set(SESSION_COOKIE_NAME,token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',expires:new Date(expires)}); }
async function clearSession() { const store=await cookies(); store.set(SESSION_COOKIE_NAME,'',{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:0}); }
export async function passwordLogin(request:Request) {
 const f=await fields(request); if(!f)return new Response('Forbidden',{status:403,headers:header});
 const {lang,returnTo}=parameters(f); try { const auth=service(), result=await auth?.login(f.get('username'),f.get('password')); if(result){await setSession(result.token,result.expires);return redirect(returnTo);} } catch {}
 return redirect(page('/auth/signin',lang,returnTo,'signin'));
}
export async function passwordRegister(request:Request) {
 const f=await fields(request); if(!f)return new Response('Forbidden',{status:403,headers:header});
 const {lang,returnTo}=parameters(f); try { const auth=service(),result=await auth?.register(f.get('username'),f.get('password'),f.get('invite_code'),process.env.OWNER_BOOTSTRAP_CODE); if(result){await setSession(result.token,result.expires);return redirect(returnTo);} } catch {}
 return redirect(page('/auth/signup',lang,returnTo,'signup'));
}
export async function passwordLogout(request:Request) {
 const f=await fields(request); if(!f)return new Response('Forbidden',{status:403,headers:header});
 const {lang}=parameters(f); try { const token=await currentToken(); if(token)await service()?.logout(token); } catch {} await clearSession(); return redirect(page('/auth/signin',lang,'/game/index.html','signedout'));
}
export async function passwordInvites(request:Request) {
 const f=await fields(request); if(!f)return new Response('Forbidden',{status:403,headers:header});
 const {lang}=parameters(f), token=await currentToken();
 try { const auth=service(); if(!auth||!token)return redirect(page('/auth/account',lang,'/game/index.html','invite_error'));
  if(f.get('action')==='create') { const code=await auth.createInvite(token); if(code) {
   const title=lang==='en'?'One-time invitation':'Одноразовый код приглашения';
   const text=lang==='en'?'Copy this code and share it privately. It expires in seven days and can be used once.':'Скопируйте код и передайте игроку лично. Он действует семь дней и может быть использован один раз.';
   const back=lang==='en'?'Back to account':'Вернуться в аккаунт';
   return new Response(`<!doctype html><html lang="${lang}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><body style="background:#10131a;color:#fff;font:18px system-ui;padding:2rem"><main style="max-width:44rem;margin:auto"><h1>${title}</h1><p>${text}</p><code style="display:block;overflow-wrap:anywhere;background:#252b39;padding:1rem;font-size:1.25rem">${code}</code><p><a style="color:#f9e829" href="/auth/account?lang=${lang}">${back}</a></p></main></body></html>`,{headers:{...header,'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"}});
  }} else if(f.get('action')==='revoke' && await auth.revokeInvite(token,f.get('invite_id')))return redirect(page('/auth/account',lang,'/game/index.html','revoked'));
 } catch {}
 return redirect(page('/auth/account',lang,'/game/index.html','invite_error'));
}
