import assert from 'node:assert/strict';
import {after, before, test} from 'node:test';
import {randomUUID} from 'node:crypto';
import {createConnection} from 'mysql2/promise';
import {createApp} from '../src/app';
import {Config} from '../src/config/config';
import {Database} from '../src/database/database';
import {migrate} from '../src/database/migrations';

const base = process.env.CVORY_TEST_MYSQL_URL!;
const name = `cvory_nest_test_${randomUUID().replaceAll('-', '')}`;
const origin = 'http://127.0.0.1:1234';
let app: Awaited<ReturnType<typeof createApp>>;
let db: Database;
let admin: Awaited<ReturnType<typeof createConnection>>;
let url: string;
let githubId = '1001';
let login = 'resume-owner';
const external = {
  identity: async () => ({id: githubId, login, displayName: '无公开邮箱', avatar: null}),
  repositories: async () => ({repositories: [], nextPageToken: ''}),
};
async function start(session = '', link = false) {
  const response = await fetch(
    `${url}/api/account/github/${link ? 'link' : 'authorize'}?returnTo=%2Feditor%3Fcv%3Ddraft`,
    {
      method: link ? 'POST' : 'GET',
      redirect: 'manual',
      headers: {Origin: origin, Cookie: session},
    },
  );
  assert.equal(response.status, 303, await response.clone().text());
  const location = new URL(response.headers.get('location')!);
  assert.equal(location.origin, 'https://github.com');
  assert.equal(location.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(location.searchParams.get('code_challenge')?.length, 43);
  assert.equal(location.searchParams.get('scope'), 'read:user');
  return {
    state: location.searchParams.get('state')!,
    browser: response.headers.get('set-cookie')!.split(';')[0],
  };
}
async function callback(state: string, browser: string, session = '') {
  return fetch(`${url}/api/account/github/callback?state=${state}&code=isolated-code`, {
    redirect: 'manual',
    headers: {Cookie: `${browser}; ${session}`},
  });
}
before(async () => {
  const adminUrl = new URL(base);
  adminUrl.pathname = '/';
  admin = await createConnection(adminUrl.toString());
  await admin.query(`CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4`);
  const databaseUrl = new URL(base);
  databaseUrl.pathname = `/${name}`;
  app = await createApp(
    new Config({
      DATABASE_URL: databaseUrl.toString(),
      PUBLIC_APP_ORIGIN: origin,
      GITHUB_CLIENT_ID: 'test-id',
      GITHUB_CLIENT_SECRET: 'test-secret',
      LEGACY_REGISTRATION_ENABLED: 'true',
    }),
    external,
  );
  db = app.get(Database);
  await migrate(db);
  await app.listen(0, '127.0.0.1');
  url = await app.getUrl();
});
after(async () => {
  await app?.close();
  if (admin) {
    await admin.query(`DROP DATABASE IF EXISTS \`${name}\``);
    await admin.end();
  }
});

test('GitHub OAuth binds the browser, consumes state once and preserves numeric identity without email', async () => {
  const first = await start();
  assert.equal((await callback(first.state, '')).status, 400);
  const response = await callback(first.state, first.browser);
  assert.equal(response.status, 303, await response.clone().text());
  assert.equal(response.headers.get('location'), `${origin}/editor?cv=draft`);
  const session = response.headers
    .getSetCookie()
    .find((value) => value.startsWith('cvory_session='))!
    .split(';')[0];
  const account = await (await fetch(`${url}/api/account`, {headers: {Cookie: session}})).json();
  assert.equal(account.email, null);
  assert.equal(account.githubConnected, true);
  const [stored] = await db.rows('SELECT password_hash FROM accounts WHERE id=?', [account.id]);
  assert.equal(stored.password_hash, null);
  assert.equal((await callback(first.state, first.browser)).status, 400);
  login = 'renamed-owner';
  const next = await start();
  assert.equal((await callback(next.state, next.browser)).status, 303);
  const [identity] = await db.rows(
    'SELECT owner_id,login FROM account_identities WHERE provider_user_id=?',
    ['1001'],
  );
  assert.equal(identity.owner_id, account.id);
  assert.equal(identity.login, login);
});

test('linking requires the same live legacy session and never merges an existing GitHub owner', async () => {
  const registered = await fetch(`${url}/api/account:register`, {
    method: 'POST',
    headers: {Origin: origin, 'Content-Type': 'application/json'},
    body: JSON.stringify({email: 'legacy@example.test', password: 'legacy-password'}),
  });
  const session = registered.headers.getSetCookie()[0].split(';')[0];
  const account = await registered.json();
  assert.equal(
    (await fetch(`${url}/api/account/github/link`, {method: 'POST', headers: {Origin: origin}}))
      .status,
    401,
  );
  const conflict = await start(session, true);
  assert.equal((await callback(conflict.state, conflict.browser, session)).status, 409);
  githubId = '2002';
  const wrongSession = await start(session, true);
  assert.equal((await callback(wrongSession.state, wrongSession.browser)).status, 401);
  const valid = await start(session, true);
  assert.equal((await callback(valid.state, valid.browser, session)).status, 303);
  const [identity] = await db.rows(
    'SELECT owner_id FROM account_identities WHERE provider_user_id=?',
    ['2002'],
  );
  assert.equal(identity.owner_id, account.id);
  assert.equal((await callback(valid.state, valid.browser, session)).status, 400);
});

test('simultaneous restore retries create one independent copy', async () => {
  const authorization = await start();
  const login = await callback(authorization.state, authorization.browser);
  const session = login.headers
    .getSetCookie()
    .find((value) => value.startsWith('cvory_session='))!
    .split(';')[0];
  const call = async (path: string, method = 'GET', body?: unknown) =>
    fetch(`${url}/api${path}`, {
      method,
      headers: {Origin: origin, Cookie: session, 'Content-Type': 'application/json'},
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const source = await (await call('/cvs', 'POST', {displayName: '并发恢复来源'})).json();
  const history = await (await call(`/cvs/${source.id}/revisions`)).json();
  const body = {requestId: randomUUID()};
  const responses = await Promise.all(
    Array.from({length: 5}, () =>
      call(`/cvs/${source.id}/revisions/${history.revisions[0].id}:restore`, 'POST', body),
    ),
  );
  assert.deepEqual(
    responses.map((response) => response.status),
    [201, 201, 201, 201, 201],
  );
  const copies = await Promise.all(responses.map((response) => response.json()));
  assert.equal(new Set(copies.map((copy) => copy.id)).size, 1);
  assert.notEqual(copies[0].id, source.id);
});
