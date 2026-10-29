// Framework-independent authentication decisions. Identity always comes from
// Supabase's server-verified user, never from user-supplied request headers.
const GAME='/game/index.html';
const FALLBACK='/auth/signin';
// ASCII dot-atom addresses only. No Unicode normalization, Gmail-specific
// dot/plus handling, or mailbox-provider alias rules are applied.
const EMAIL=/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/;
const messages={
 ru:{invalid:'Проверьте адрес электронной почты и пароль.',signin:'Не удалось войти. Проверьте данные и попробуйте снова.',signup:'Не удалось создать аккаунт. Попробуйте позже.',email:'Проверьте почту и подтвердите регистрацию.',callback:'Ссылка недействительна или устарела. Повторите вход.',configured:'Регистрация временно недоступна: адрес сайта не настроен.',canonical:'Зарегистрироваться можно только на основном адресе сайта. Перейдите туда и заполните форму заново.',signedout:'Вы вышли из аккаунта.'},
 en:{invalid:'Check your email address and password.',signin:'Unable to sign in. Check your details and try again.',signup:'Unable to create the account. Please try again later.',email:'Check your email to confirm registration.',callback:'The link is invalid or has expired. Please sign in again.',configured:'Registration is temporarily unavailable: the site address is not configured.',canonical:'Registration is available only on the primary site address. Open it and fill in the form again.',signedout:'You have signed out.'}
};
export const language=v=>v==='en'?'en':'ru';
export function safeReturnTo(input){
 if(typeof input!=='string'||!input.startsWith('/')||input.startsWith('//')||/[\\\x00-\x1f\x7f]/.test(input))return GAME;
 try{const u=new URL(input,'https://local.invalid');if(u.origin!=='https://local.invalid'||!['/',GAME].includes(u.pathname))return GAME;return u.pathname+u.search+u.hash}catch{return GAME}
}
export function siteOrigin(value,requestUrl,production=true){
 try{if(value){const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.pathname!=='/'||u.search||u.hash)return null;return u.origin}if(!production){const u=new URL(requestUrl);if(['localhost','127.0.0.1','[::1]'].includes(u.hostname)&&['http:','https:'].includes(u.protocol))return u.origin}}catch{}return null;
}
export function isSameOrigin(request){try{const o=request.headers.get('origin');return !!o&&o!=='null'&&new URL(o).origin===new URL(request.url).origin}catch{return false}}
// Sessions are read only by server-side routes, so browser JavaScript need not
// access these cookies. Preserve Supabase's expiry/maxAge for refresh and logout.
export function secureCookieOptions(options,production=true){return {...(options&&typeof options==='object'?options:{}),httpOnly:true,secure:production===true,sameSite:'lax',path:'/'};}
function redirect(path){return new Response(null,{status:303,headers:{Location:path,'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'}})}
function page(path,lang,returnTo,key){const q=new URLSearchParams({lang,return_to:returnTo});if(key)q.set('notice',key);return `${path}?${q}`}
function normalizedEmail(value){
 if(typeof value!=='string'||/[^\x00-\x7f]/.test(value))return null;
 const email=value.trim();if(email.length>254||!EMAIL.test(email))return null;
 const [local,domain]=email.split('@'),labels=domain.split('.');
 if(local.length>64||local.startsWith('.')||local.endsWith('.')||local.includes('..')||labels.some(label=>label.length>63||label.startsWith('-')||label.endsWith('-')))return null;
 // Supabase Auth stores and matches email identities in lowercase. Restricting
 // input to ASCII ensures this cannot equate Unicode compatibility characters.
 return email.toLowerCase();
}
export function allowedEmail(email,allowlist){const needle=normalizedEmail(email);if(!needle||typeof allowlist!=='string'||!allowlist.trim())return false;const entries=allowlist.split(/[\n,]/).map(x=>normalizedEmail(x));return entries.length>0&&entries.length<=100&&entries.every(Boolean)&&entries.includes(needle)}
function validCredentials(email,password){return normalizedEmail(email)!==null&&typeof password==='string'&&password.length>=8&&password.length<=72}
function formValues(form){return {email:String(form.get('email')||''),password:form.get('password'),lang:language(form.get('lang')),returnTo:safeReturnTo(form.get('return_to'))}}
export function displayNotice(key,lang){const dict=messages[language(lang)];return typeof key==='string'&&Object.hasOwn(dict,key)?dict[key]:''}
export async function verifiedIdentity(createClient,allowlist=process.env.SITE_ALLOWED_EMAILS){
 try{const client=await createClient(),{data,error}=await client.auth.getUser(),user=data?.user;if(error||!user||typeof user.id!=='string'||!user.id||user.id.length>160||!allowedEmail(user.email,allowlist)||typeof user.email_confirmed_at!=='string'||!Number.isFinite(Date.parse(user.email_confirmed_at)))return null;const email=user.email;return {userId:user.id,email,displayName:email,fullName:null}}catch{return null}
}
async function clearSession(client){try{await client.auth.signOut({scope:'local'})}catch{}}
export async function signIn(request,createClient,allowlist=process.env.SITE_ALLOWED_EMAILS){
 if(!isSameOrigin(request))return new Response('Forbidden',{status:403,headers:{'Cache-Control':'no-store'}});
 let fields;try{fields=formValues(await request.formData())}catch{return redirect(page(FALLBACK,'ru',GAME,'invalid'))}
 const {email,password,lang,returnTo}=fields;if(!validCredentials(email,password))return redirect(page(FALLBACK,lang,returnTo,'invalid'));
 if(!allowedEmail(email,allowlist))return redirect(page(FALLBACK,lang,returnTo,'signin'));
 try{const client=await createClient();const {error}=await client.auth.signInWithPassword({email:normalizedEmail(email),password});if(error)return redirect(page(FALLBACK,lang,returnTo,'signin'));if(!await verifiedIdentity(async()=>client,allowlist)){await clearSession(client);return redirect(page(FALLBACK,lang,returnTo,'signin'))}return redirect(returnTo)}catch{return redirect(page(FALLBACK,lang,returnTo,'signin'))}
}
export async function signUp(request,createClient,baseUrl,production=true,allowlist=process.env.SITE_ALLOWED_EMAILS){
 if(!isSameOrigin(request))return new Response('Forbidden',{status:403,headers:{'Cache-Control':'no-store'}});
 let fields;try{fields=formValues(await request.formData())}catch{return redirect(page('/auth/signup','ru',GAME,'invalid'))}
 const {email,password,lang,returnTo}=fields;if(!validCredentials(email,password))return redirect(page('/auth/signup',lang,returnTo,'invalid'));
 const origin=siteOrigin(baseUrl,request.url,production);if(!origin||typeof allowlist!=='string'||!allowlist.trim())return redirect(page('/auth/signup',lang,returnTo,'configured'));
 // The PKCE verifier is stored in an origin-bound cookie. Starting on a
 // preview or alternate hostname and returning to the canonical hostname would
 // strand the verifier and make email confirmation impossible.
 let requestOrigin;try{requestOrigin=new URL(request.url).origin}catch{return redirect(page('/auth/signup',lang,returnTo,'configured'))}
 if(requestOrigin!==origin)return redirect(page('/auth/signup',lang,returnTo,'canonical'));
 if(!allowedEmail(email,allowlist))return redirect(page(FALLBACK,lang,returnTo,'email'));
 const callback=new URL('/auth/callback',origin);callback.searchParams.set('return_to',returnTo);callback.searchParams.set('lang',lang);
 try{const client=await createClient();const {data,error}=await client.auth.signUp({email:normalizedEmail(email),password,options:{emailRedirectTo:callback.href}});if(error)return redirect(page('/auth/signup',lang,returnTo,'signup'));if(data?.session){if(!await verifiedIdentity(async()=>client,allowlist)){await clearSession(client);return redirect(page(FALLBACK,lang,returnTo,'email'))}return redirect(returnTo)}return redirect(page(FALLBACK,lang,returnTo,'email'))}catch{return redirect(page('/auth/signup',lang,returnTo,'signup'))}
}
export async function callback(request,createClient,allowlist=process.env.SITE_ALLOWED_EMAILS){
 const u=new URL(request.url),lang=language(u.searchParams.get('lang')),returnTo=safeReturnTo(u.searchParams.get('return_to')),code=u.searchParams.get('code');
 if(!code||code.length>4096)return redirect(page(FALLBACK,lang,returnTo,'callback'));
 try{const client=await createClient();const {error}=await client.auth.exchangeCodeForSession(code);if(error)return redirect(page(FALLBACK,lang,returnTo,'callback'));if(!await verifiedIdentity(async()=>client,allowlist)){await clearSession(client);return redirect(page(FALLBACK,lang,returnTo,'callback'))}return redirect(returnTo)}catch{return redirect(page(FALLBACK,lang,returnTo,'callback'))}
}
export async function signOut(request,createClient){
 if(!isSameOrigin(request))return new Response('Forbidden',{status:403,headers:{'Cache-Control':'no-store'}});
 let lang='ru';try{const form=await request.formData();lang=language(form.get('lang'))}catch{}
 try{const client=await createClient();const {error}=await client.auth.signOut({scope:'local'});if(error)return redirect(page(FALLBACK,lang,GAME,'signin'));return redirect(page(FALLBACK,lang,GAME,'signedout'))}catch{return redirect(page(FALLBACK,lang,GAME,'signin'))}
}
