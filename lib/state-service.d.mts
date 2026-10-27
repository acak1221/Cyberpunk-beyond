export type StateIdentity = { userId: string } | null;
export function createStateService(options: {getIdentity: () => Promise<StateIdentity>; getDatabase: () => D1Database | undefined}): {get(request: Request): Promise<Response>; put(request: Request): Promise<Response>};
export function validState(state: unknown): boolean;
export const MAX_BYTES: number;
