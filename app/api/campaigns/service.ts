import { getIdentity, getDatabase } from '@platform-runtime';
import { createCampaignService } from '../../../lib/campaign-service.mjs';
export function handleCampaign(request: Request) {
  return createCampaignService({getIdentity,getDatabase}).handle(request);
}
