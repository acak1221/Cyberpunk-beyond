import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../../chatgpt-auth';
import { createCampaignService } from '../../../lib/campaign-service.mjs';
export function handleCampaign(request: Request) {
  return createCampaignService({getIdentity:getChatGPTUser,getDatabase:()=>env.DB}).handle(request);
}
