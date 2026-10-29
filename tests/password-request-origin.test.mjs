import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allowedPasswordRequestOrigin } from '../lib/password-request-origin.mjs';

const base = 'https://game.example';
const check = (headers = {}, url = base + '/auth/login', configured = base, production = true) =>
  allowedPasswordRequestOrigin(new Request(url, {method:'POST', headers}), configured, production);

test('accepts exact Origin or same-origin fetch metadata when Origin is suppressed', () => {
  assert.equal(check({Origin:base}), true);
  assert.equal(check({Origin:base,'Sec-Fetch-Site':'same-origin'}), true);
  assert.equal(check({'Sec-Fetch-Site':'same-origin'}), true);
  assert.equal(check({Origin:'null','Sec-Fetch-Site':'same-origin'}), true);
});

test('fails closed for foreign, contradictory or missing origin evidence', () => {
  for (const headers of [
    {}, {Origin:'null'}, {'Sec-Fetch-Site':'cross-site'}, {'Sec-Fetch-Site':'same-site'},
    {Origin:'https://attacker.example','Sec-Fetch-Site':'same-origin'},
    {Origin:base,'Sec-Fetch-Site':'cross-site'}, {Origin:base,'Sec-Fetch-Site':'same-site'},
    {Origin:'https://game.example.evil.test'}, {Referer:base+'/auth/signin'},
  ]) assert.equal(check(headers), false, JSON.stringify(headers));
});

test('enforces the configured canonical origin and production HTTPS', () => {
  assert.equal(check({Origin:base},'https://alternate.example/auth/login'), false);
  assert.equal(check({Origin:base},base+'/auth/login',null), false);
  assert.equal(check({Origin:'http://localhost:3000'},'http://localhost:3000/auth/login',null,false), true);
  assert.equal(check({'Sec-Fetch-Site':'same-origin'},'http://localhost:3000/auth/login',null,false), true);
  assert.equal(check({'Sec-Fetch-Site':'same-origin'},'http://localhost:3000/auth/login',null,true), false);
});
