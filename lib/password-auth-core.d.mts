export interface Identity {userId:string;username:string;isOwner:boolean;email:string;displayName:string;fullName:null}
export interface Invite {id:string;createdAt:number;expiresAt:number;usedAt:number|null;revokedAt:number|null}
export interface AccountOverview {userId:string;username:string;isOwner:boolean;invites:Invite[]}
export interface AuthService {
 register(username:string|null,password:string|null,inviteCode:string|null,bootstrapCode:string|undefined):Promise<{token:string;expires:number}|null>;
 login(username:string|null,password:string|null):Promise<{token:string;expires:number}|null>;
 identity(token:string):Promise<Identity|null>;
 logout(token:string):Promise<void>;
 listInvites(token:string):Promise<AccountOverview|null>;
 createInvite(token:string):Promise<string|null>;
 revokeInvite(token:string,id:string|null):Promise<boolean>;
}
export function createPasswordAuth(pool:unknown,options?:{now?:()=>number}):AuthService;
export function validUsername(name:unknown):boolean;
export function validPassword(value:unknown):boolean;
