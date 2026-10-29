// Sites/Cloudflare runtime. Production identity comes from the trusted Sites
// dispatch, and D1 is bound by the hosting platform.
import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../app/chatgpt-auth';

export const getIdentity = getChatGPTUser;
export const getDatabase = () => env.DB;
export const authProvider = 'sites';
