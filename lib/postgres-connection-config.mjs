// The server's database connection must always verify the TLS certificate.
// pg-connection-string can override a supplied ssl object from query params,
// so reject unsafe knobs and remove the harmless sslmode before handing it on.
export function postgresConnectionConfig(input) {
  if (typeof input !== 'string' || !input.trim()) return null;
  let url;
  try { url = new URL(input.trim()); } catch { return null; }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname) return null;
  if (url.searchParams.getAll('sslmode').some(mode => !['require', 'verify-full'].includes(mode))) return null;
  for (const key of url.searchParams.keys()) {
    const lower = key.toLowerCase();
    if ((lower.startsWith('ssl') && key !== 'sslmode') || lower === 'uselibpqcompat') return null;
  }
  url.searchParams.delete('sslmode');
  return { connectionString: url.toString(), max: 1, idleTimeoutMillis: 20000,
    connectionTimeoutMillis: 10000, sslnegotiation: 'postgres', ssl: { rejectUnauthorized: true } };
}
