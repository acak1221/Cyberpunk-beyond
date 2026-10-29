import type { PoolConfig } from 'pg';

export function postgresConnectionConfig(input: unknown): PoolConfig | null;
export function databaseConnectionString(env: Record<string, string | undefined>): string | null;
