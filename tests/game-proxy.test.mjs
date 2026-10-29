import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NextRequest } from 'next/server.js';
import { protectGameRequest } from '../lib/game-proxy.mjs';

const get = (path, cookie) => new NextRequest(`https://example.test${path}`, {
  headers: cookie ? { cookie } : undefined,
});
const check = async (token) => token === 'active';
const noCache = (response) => assert.match(response.headers.get('cache-control') || '', /private, no-store/);

test('anonymous game page redirects to sign-in without caching', async () => {
  const response = await protectGameRequest(get('/game/index.html'), 'nc_session', check);
  assert.equal(response.status, 307);
  assert.equal(response.headers.get('location'), 'https://example.test/auth/signin');
  noCache(response);
});

test('game scripts and styles require the verified active session', async () => {
  for (const path of ['/game/rules.js', '/game/catalog.js', '/game/styles.css']) {
    const denied = await protectGameRequest(get(path, 'nc_session=invalid'), 'nc_session', check);
    assert.equal(denied.status, 401);
    noCache(denied);
    const accepted = await protectGameRequest(get(path, 'nc_session=active'), 'nc_session', check);
    assert.equal(accepted.headers.get('x-middleware-next'), '1');
    noCache(accepted);
  }
});

test('session-store errors deny access even when a cookie is present', async () => {
  const response = await protectGameRequest(get('/game/rules.js', 'nc_session=active'), 'nc_session', async () => {
    throw new Error('database unavailable');
  });
  assert.equal(response.status, 401);
  noCache(response);
});
