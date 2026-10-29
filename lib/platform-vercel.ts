// Vercel runtime. Never trust incoming identity headers: Supabase validates
// the user's session with the auth server before the services use it.
import 'server-only';
import { Pool } from 'pg';
import { getPasswordUser } from './password-auth';
import { createPostgresD1 } from './postgres-d1.mjs';
import { postgresConnectionConfig } from './postgres-connection-config.mjs';

let cachedUrl: string | undefined;
let database: ReturnType<typeof createPostgresD1> | null = null;

export const getIdentity = getPasswordUser;
export const authProvider = 'supabase';

export function getDatabase() {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) return null;
  // Use the Supabase transaction-pooler URL; TLS verification is mandatory.
  const config = postgresConnectionConfig(connectionString);
  if (!config) return null;
  if (database && cachedUrl === connectionString) return database;
  // A running instance never silently switches databases while requests are in
  // flight. A changed Vercel environment is applied by a fresh deployment.
  if (database) return null;
  const pool = new Pool(config);
  database = createPostgresD1(pool);
  cachedUrl = connectionString;
  return database;
}
