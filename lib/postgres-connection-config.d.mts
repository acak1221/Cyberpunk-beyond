import type { PoolConfig } from 'pg';

export function postgresConnectionConfig(input: unknown): PoolConfig | null;
