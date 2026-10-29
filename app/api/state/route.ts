import { getIdentity, getDatabase } from "@platform-runtime";
import { createStateService } from "../../../lib/state-service.mjs";

export const dynamic = "force-dynamic";

function service() {
  // Identity is verified by the selected server runtime, never by request body.
  return createStateService({
    getIdentity,
    getDatabase,
  });
}
export async function GET(request: Request) { return service().get(request); }
export async function PUT(request: Request) { return service().put(request); }
