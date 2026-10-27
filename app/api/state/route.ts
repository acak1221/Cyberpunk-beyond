import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";
import { createStateService } from "../../../lib/state-service.mjs";

export const dynamic = "force-dynamic";

function service() {
  // Auth headers are provided by Sites dispatch. Never use a user ID from a request body.
  return createStateService({
    getIdentity: getChatGPTUser,
    getDatabase: () => env.DB,
  });
}
export async function GET(request: Request) { return service().get(request); }
export async function PUT(request: Request) { return service().put(request); }
