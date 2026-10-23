import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import { createApp } from '../src/app.js';
import { createConfig } from '../src/config.js';
import { createStore } from '../src/store.js';

const config = createConfig({
  REVIEWER_EMAIL: 'review@boz.zm',
  REVIEWER_PHONE: '+260770828570',
  REVIEWER_PASSWORD: 'reviewer-test-password',
  REVIEWER_OTP: '0000',
  REVIEWER_STAFF_NUMBER: '1000',
  REVIEWER_ACCOUNT_NUMBER: '0012062080023',
  JWT_SECRET: 'test-secret',
});

async function listen(app) {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  return {
    server,
    base: `http://127.0.0.1:${port}`,
  };
}

test('reviewer API', async (t) => {
  const app = createApp({ config, store: createStore(config) });
  const { server, base } = await listen(app);
  t.after(() => server.close());

  await t.test('health is outside the v1 prefix', async () => {
    const response = await fetch(`${base}/health`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.status, 'ok');
  });

  await t.test('rejects a wrong password', async () => {
    const response = await fetch(`${base}/v1/oauth/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'password',
        username: config.email,
        password: 'wrong-password',
      }),
    });
    assert.equal(response.status, 401);
    const body = await response.json();
    assert.equal(body.message, 'invalid_grant');
  });

  await t.test('logs the reviewer in and serves the account', async () => {
    const login = await fetch(`${base}/oauth/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'password',
        username: config.phone,
        password: 'reviewer-test-password',
        deviceId: 'device-1',
      }),
    });
    assert.equal(login.status, 200);
    const loginBody = await login.json();
    const token = loginBody.payload.access_token;
    assert.equal(typeof token, 'string');
    assert.equal(loginBody.payload.expires_in, 86400);

    const account = await fetch(`${base}/v1/account`, {
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(account.status, 200);
    const accountBody = await account.json();
    assert.equal(accountBody.payload.accountNumber, config.accountNumber);
    assert.equal(accountBody.payload.customerName, 'Test User');

    const banks = await fetch(`${base}/v1/banks?page=0&size=100`, {
      headers: { authorization: `Bearer ${token}` },
    });
    const banksBody = await banks.json();
    assert.ok(banksBody.payload.items.length >= 5);

    const limits = await fetch(`${base}/v1/transfer-limits/type-limits`, {
      headers: { authorization: `Bearer ${token}` },
    });
    const limitsBody = await limits.json();
    assert.equal(limitsBody.payload.items[0].transferType, 'INTRA');

    const history = await fetch(`${base}/v1/transactions/history?page=0&size=32`, {
      headers: { authorization: `Bearer ${token}` },
    });
    const historyBody = await history.json();
    assert.equal(typeof historyBody.payload.items[0].amount, 'number');
    assert.ok(!Number.isInteger(historyBody.payload.items[0].amount));

    const beneficiaries = await fetch(`${base}/v1/beneficiaries`, {
      headers: { authorization: `Bearer ${token}` },
    });
    const beneficiariesBody = await beneficiaries.json();
    assert.ok(Array.isArray(beneficiariesBody.payload.payload));

    const denied = await fetch(`${base}/v1/account`);
    assert.equal(denied.status, 401);
  });

  await t.test('accepts the reviewer OTP and rejects it for anyone else', async () => {
    const accepted = await fetch(`${base}/v1/otp/verify`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        otp: '0000',
        email: config.email,
      }),
    });
    assert.equal(accepted.status, 200);

    const rejected = await fetch(`${base}/v1/otp/verify`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        otp: '0000',
        email: 'someone@boz.zm',
      }),
    });
    assert.equal(rejected.status, 400);
  });
});
