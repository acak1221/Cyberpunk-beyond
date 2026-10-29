import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rootCertificates } from 'node:tls';
import pg from 'pg';
import { databaseConnectionString, postgresConnectionConfig } from '../lib/postgres-connection-config.mjs';

test('explicit database URL takes precedence over marketplace configuration', () => {
  const explicit = 'postgres://user:password@primary.example.test/db';
  const marketplace = 'postgres://user:password@pooler.example.test:6543/db?sslmode=require&supa=base-pooler.x';
  assert.equal(databaseConnectionString({ DATABASE_URL: ` ${explicit} `, cyberpunk_POSTGRES_URL: marketplace }), explicit);
  assert.equal(databaseConnectionString({ DATABASE_URL: 'invalid', cyberpunk_POSTGRES_URL: marketplace }), 'invalid');
  assert.equal(postgresConnectionConfig(databaseConnectionString({ DATABASE_URL: 'invalid', cyberpunk_POSTGRES_URL: marketplace })), null);
  assert.equal(databaseConnectionString({ DATABASE_URL: ' ', cyberpunk_POSTGRES_URL: ` ${marketplace} ` }), marketplace);
  assert.equal(databaseConnectionString({}), null);
  const config = postgresConnectionConfig(databaseConnectionString({ cyberpunk_POSTGRES_URL: marketplace }));
  const client = new pg.Client(config);
  assert.equal(client.connectionParameters.ssl.rejectUnauthorized, true);
  assert.equal(client.connectionParameters.sslnegotiation, 'postgres');
});

test('database pool requires verified TLS and keeps a single connection', () => {
  for (const url of ['postgresql://user:secret@example.test:6543/db', 'postgresql://user:secret@example.test:6543/db?sslmode=require', 'postgresql://user:secret@example.test:6543/db?sslmode=verify-full']) {
    const config = postgresConnectionConfig(url);
    assert.equal(config.max, 1);
    assert.equal(config.ssl.rejectUnauthorized, true);
    assert.equal(new URL(config.connectionString).searchParams.has('sslmode'), false);
    const client = new pg.Client(config);
    assert.equal(client.connectionParameters.ssl.rejectUnauthorized, true);
    assert.equal(client.connectionParameters.ssl.checkServerIdentity, undefined);
    assert.equal(client.connectionParameters.sslnegotiation, 'postgres');
  }
});

test('a custom CA is restricted to the exact configured database hostname', () => {
  const url = 'postgresql://user:secret@pooler.example.test:6543/db?sslmode=require';
  const certificate = rootCertificates[0];
  const config = postgresConnectionConfig(url, { DATABASE_CA_CERT: certificate, DATABASE_CA_HOST: 'POOLER.EXAMPLE.TEST' });
  assert.ok(config);
  assert.equal(config.ssl.ca, certificate.trim());
  assert.equal(config.ssl.rejectUnauthorized, true);
  const client = new pg.Client(config);
  assert.equal(client.connectionParameters.ssl.ca, certificate.trim());
  assert.equal(client.connectionParameters.ssl.rejectUnauthorized, true);
  assert.equal(client.connectionParameters.ssl.checkServerIdentity, undefined);
  assert.equal(postgresConnectionConfig(url, { DATABASE_CA_CERT: certificate, DATABASE_CA_HOST: 'other.example.test' }), null);
  assert.equal(postgresConnectionConfig(url, { DATABASE_CA_CERT: certificate }), null);
  assert.equal(postgresConnectionConfig(url, { DATABASE_CA_HOST: 'pooler.example.test' }), null);
  assert.equal(postgresConnectionConfig(url, { DATABASE_CA_CERT: 'bad certificate', DATABASE_CA_HOST: 'pooler.example.test' }), null);
  assert.equal(postgresConnectionConfig(url, { DATABASE_CA_CERT: '', DATABASE_CA_HOST: 'pooler.example.test' }), null);
  assert.equal(postgresConnectionConfig(url, { DATABASE_CA_CERT: `${certificate}\n${certificate}`, DATABASE_CA_HOST: 'pooler.example.test' }), null);
  assert.equal(postgresConnectionConfig(url + '&sslrootcert=attacker', { DATABASE_CA_CERT: certificate, DATABASE_CA_HOST: 'pooler.example.test' }), null);
  assert.equal(postgresConnectionConfig('postgresql://user:secret@pooler.example.test.attacker.invalid/db', { DATABASE_CA_CERT: certificate, DATABASE_CA_HOST: 'pooler.example.test' }), null);
  assert.equal(postgresConnectionConfig(url).ssl.ca, undefined);
});
test('rejects connection options that can bypass TLS verification', () => {
  for (const suffix of ['sslmode=disable','sslmode=allow','sslmode=prefer','sslmode=no-verify','sslmode=verify-ca','ssl=false','sslrootcert=evil','sslkey=evil','sslcert=evil','sslnegotiation=direct','sslnegotiation=postgres','sslmode=require&sslnegotiation=direct','sslmode=verify-full&sslnegotiation=direct','ssl_min_protocol_version=TLSv1','SSLMODE=disable','USELIBPQCOMPAT=true','uselibpqcompat=true&sslmode=require','sslmode=require&sslmode=disable']) {
    assert.equal(postgresConnectionConfig('postgresql://user:secret@example.test/db?' + suffix), null, suffix);
  }
  assert.equal(postgresConnectionConfig('https://example.test'), null);
  assert.equal(postgresConnectionConfig(''), null);
});

test('environment settings cannot override verified TLS or negotiation', () => {
  const previousMode = process.env.PGSSLMODE;
  const previousNegotiation = process.env.PGSSLNEGOTIATION;
  try {
    process.env.PGSSLMODE = 'no-verify';
    process.env.PGSSLNEGOTIATION = 'direct';
    const client = new pg.Client(postgresConnectionConfig('postgresql://user:secret@example.test/db'));
    assert.equal(client.connectionParameters.ssl.rejectUnauthorized, true);
    assert.equal(client.connectionParameters.ssl.checkServerIdentity, undefined);
    assert.equal(client.connectionParameters.sslnegotiation, 'postgres');
  } finally {
    if (previousMode === undefined) delete process.env.PGSSLMODE;
    else process.env.PGSSLMODE = previousMode;
    if (previousNegotiation === undefined) delete process.env.PGSSLNEGOTIATION;
    else process.env.PGSSLNEGOTIATION = previousNegotiation;
  }
});
