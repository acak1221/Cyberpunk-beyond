import type { PoolConfig } from 'pg';

export function postgresConnectionConfig(input: unknown, env?: Record<string, string | undefined>): PoolConfig | null;
export function databaseConnectionString(env: Record<string, string | undefined>): string | null;
