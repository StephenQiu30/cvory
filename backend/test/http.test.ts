import assert from 'node:assert/strict';
import {before, after, test} from 'node:test';
import {randomUUID} from 'node:crypto';
import {createConnection} from 'mysql2/promise';
import {createApp} from '../src/app';
import {Config} from '../src/config/config';
import {Database} from '../src/database/database';
import {migrate} from '../src/database/migrations';

const base = process.env.CVORY_TEST_MYSQL_URL;
if (!base)
  throw new Error('CVORY_TEST_MYSQL_URL must point at a test-capable local MySQL account.');
const databaseName = `cvory_nest_test_${randomUUID().replaceAll('-', '')}`;
const origin = 'http://127.0.0.1:1234';
let app: Awaited<ReturnType<typeof createApp>>;
let db: Database;
let url: string;
let admin: Awaited<ReturnType<typeof createConnection>>;
let cookie: string;

async function request(path: string, method = 'GET', body?: unknown, session = cookie) {
  return fetch(`${url}/api${path}`, {
    method,
    headers: {Origin: origin, Cookie: session || '', 'Content-Type': 'application/json'},
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

before(async () => {
  const adminUrl = new URL(base);
  adminUrl.pathname = '/';
  admin = await createConnection(adminUrl.toString());
  await admin.query(`CREATE DATABASE \`${databaseName}\` CHARACTER SET utf8mb4`);
  const databaseUrl = new URL(base);
  databaseUrl.pathname = `/${databaseName}`;
  app = await createApp(
    new Config({
      DATABASE_URL: databaseUrl.toString(),
      PUBLIC_APP_ORIGIN: origin,
      LEGACY_REGISTRATION_ENABLED: 'true',
    }),
  );
  db = app.get(Database);
  await migrate(db);
  await app.listen(0, '127.0.0.1');
  url = await app.getUrl();
});

after(async () => {
  await app?.close();
  if (admin) {
    await admin.query(`DROP DATABASE IF EXISTS \`${databaseName}\``);
    await admin.end();
  }
});

test('Nest preserves account isolation, conditional saves and recoverable history over real MySQL', async () => {
  const register = await request('/account:register', 'POST', {
    email: 'owner@example.test',
    password: 'owner-password',
  });
  assert.equal(register.status, 201);
  cookie = register.headers.get('set-cookie')?.split(';')[0] || '';
  const account = await register.json();
  assert.equal(account.email, 'owner@example.test');
  assert.equal('passwordHash' in account, false);
  const created = await request('/cvs', 'POST', {displayName: '后端岗位'});
  assert.equal(created.status, 201, await created.clone().text());
  const cv = await created.json();
  const saved = await request(`/cvs/${cv.id}`, 'PATCH', {
    displayName: '后端岗位第二版',
    etag: cv.etag,
    updateMask: 'displayName',
  });
  assert.equal(saved.status, 200);
  assert.equal((await saved.json()).displayName, '后端岗位第二版');
  const stale = await request(`/cvs/${cv.id}`, 'PATCH', {displayName: '旧修改', etag: cv.etag});
  assert.equal(stale.status, 409);
  assert.equal((await stale.json()).error.status, 'ABORTED');
  const history = await request(`/cvs/${cv.id}/revisions`);
  const revisions = (await history.json()).revisions;
  assert.equal(revisions.length, 2);
  const restored = await request(`/cvs/${cv.id}/revisions/${revisions.at(-1).id}:restore`, 'POST', {
    requestId: '57a18049-0e41-4e68-9131-162f911c7368',
  });
  assert.equal(restored.status, 201);
  const copy = await restored.json();
  assert.notEqual(copy.id, cv.id);
  assert.equal(copy.displayName, '后端岗位');
  assert.equal((await (await request(`/cvs/${cv.id}`)).json()).displayName, '后端岗位第二版');
  const other = await request('/account:register', 'POST', {
    email: 'other@example.test',
    password: 'other-password',
  });
  const otherCookie = other.headers.get('set-cookie')?.split(';')[0] || '';
  assert.equal((await request(`/cvs/${cv.id}`, 'GET', undefined, otherCookie)).status, 404);
  assert.equal((await request(`/cvs/${cv.id}`, 'GET', undefined, '')).status, 401);
});

test('invalid rich text and cross-origin writes do not alter persisted CVs', async () => {
  const created = await request('/cvs', 'POST', {displayName: '保留正文'});
  assert.equal(created.status, 201, await created.clone().text());
  const cv = await created.json();
  const response = await request(`/cvs/${cv.id}`, 'PATCH', {
    etag: cv.etag,
    sections: [
      {
        id: 's',
        type: 'summary',
        title: '简介',
        content: {type: 'doc', content: [{type: 'text', text: 'test', marks: 3}]},
      },
    ],
  });
  assert.equal(response.status, 400);
  assert.equal((await (await request(`/cvs/${cv.id}`)).json()).etag, cv.etag);
  const crossOrigin = await fetch(`${url}/api/cvs`, {
    method: 'POST',
    headers: {Origin: 'https://evil.example', Cookie: cookie, 'Content-Type': 'application/json'},
    body: JSON.stringify({displayName: 'bad'}),
  });
  assert.equal(crossOrigin.status, 403);
});

test('rich text rejects invalid hierarchy, attributes and mark shapes without changing the saved version', async () => {
  const cv = await (await request('/cvs', 'POST', {displayName: '结构边界'})).json();
  const paragraph = {type: 'paragraph', content: [{type: 'text', text: '保留'}]};
  for (const content of [
    {type: {toString: null}},
    {type: 'text', text: '错误根'},
    {type: 'doc', content: [{type: 'text', text: '根下不能直接是文字'}]},
    {type: 'doc', content: [{type: 'paragraph', content: [{type: 'paragraph'}]}]},
    {type: 'doc', content: [{type: 'bulletList', content: [paragraph]}]},
    {type: 'doc', content: [{...paragraph, attrs: {onclick: 'run()'}}]},
    {
      type: 'doc',
      content: [
        {
          type: 'orderedList',
          attrs: {start: -1},
          content: [{type: 'listItem', content: [paragraph]}],
        },
      ],
    },
    {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {type: 'text', text: '标记', marks: [{type: 'bold', attrs: {style: 'color:red'}}]},
          ],
        },
      ],
    },
    {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: '链接',
              marks: [{type: 'link', attrs: {href: 'javascript:alert(1)'}}],
            },
          ],
        },
      ],
    },
    {type: 'doc', content: [{...paragraph, extra: 'unknown'}]},
  ]) {
    const response = await request(`/cvs/${cv.id}`, 'PATCH', {
      etag: cv.etag,
      sections: [{id: 's', type: 'summary', title: '简介', content}],
    });
    assert.equal(response.status, 400, JSON.stringify(content));
    assert.equal((await response.json()).error.status, 'INVALID_ARGUMENT');
    assert.equal((await (await request(`/cvs/${cv.id}`)).json()).etag, cv.etag);
  }
});

test('draft copies are bound to the expected signed-in owner in the create request', async () => {
  const before = await (await request('/cvs')).json();
  const response = await fetch(`${url}/api/cvs`, {
    method: 'POST',
    headers: {
      Origin: origin,
      Cookie: cookie,
      'Content-Type': 'application/json',
      'X-Cvory-Owner': 'another-owner',
    },
    body: JSON.stringify({displayName: 'private draft must not cross accounts'}),
  });
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error.details[0].reason, 'ACCOUNT_CHANGED');
  assert.deepEqual((await (await request('/cvs')).json()).cvs, before.cvs);
});

test('simultaneous saves commit one revision; restore retries are idempotent and migration reruns preserve data', async () => {
  const cv = await (await request('/cvs', 'POST', {displayName: '并发保存'})).json();
  const results = await Promise.all(
    ['A', 'B'].map((displayName) =>
      request(`/cvs/${cv.id}`, 'PATCH', {displayName, etag: cv.etag}),
    ),
  );
  assert.deepEqual(results.map((result) => result.status).sort(), [200, 409]);
  const history = await (await request(`/cvs/${cv.id}/revisions`)).json();
  assert.equal(history.retentionLimit, 50);
  assert.equal(history.revisions.length, 2);
  const revision = history.revisions.at(-1).id;
  const body = {requestId: 'd150ecdf-1297-431f-87b0-fcb3f0c12f64'};
  const first = await (
    await request(`/cvs/${cv.id}/revisions/${revision}:restore`, 'POST', body)
  ).json();
  const second = await (
    await request(`/cvs/${cv.id}/revisions/${revision}:restore`, 'POST', body)
  ).json();
  assert.equal(first.id, second.id);
  await migrate(db);
  assert.equal((await request(`/cvs/${cv.id}`)).status, 200);
});

test('the first Nest save of an existing legacy CV retains the pre-migration version', async () => {
  const cv = await (await request('/cvs', 'POST', {displayName: '迁移前正文'})).json();
  await db.run('DELETE FROM cv_revisions WHERE cv_id=?', [cv.id]);
  const saved = await request(`/cvs/${cv.id}`, 'PATCH', {displayName: '迁移后正文', etag: cv.etag});
  assert.equal(saved.status, 200);
  const history = await (await request(`/cvs/${cv.id}/revisions`)).json();
  assert.deepEqual(
    history.revisions.map((item: {document: {displayName: string}}) => item.document.displayName),
    ['迁移后正文', '迁移前正文'],
  );
  const invalid = await request(`/cvs/${cv.id}`, 'PATCH', {
    displayName: null,
    etag: (await saved.json()).etag,
  });
  assert.equal(invalid.status, 400);
});

test('concurrent retries with one requestId return the same CV rather than a missing resource', async () => {
  const body = {displayName: '幂等并发', requestId: randomUUID()};
  const responses = await Promise.all(Array.from({length: 5}, () => request('/cvs', 'POST', body)));
  assert.deepEqual(
    responses.map((response) => response.status),
    [201, 201, 201, 201, 201],
  );
  const cvs = await Promise.all(responses.map((response) => response.json()));
  assert.equal(new Set(cvs.map((cv) => cv.id)).size, 1);
});

test('a partially initialized baseline finishes every table before recording migration success', async () => {
  const partialName = `cvory_nest_test_${randomUUID().replaceAll('-', '')}`;
  await admin.query(`CREATE DATABASE \`${partialName}\``);
  const partialUrl = new URL(base!);
  partialUrl.pathname = `/${partialName}`;
  const partial = new Database(new Config({DATABASE_URL: partialUrl.toString()}));
  try {
    await partial.run(`CREATE TABLE accounts LIKE \`${databaseName}\`.accounts`);
    await migrate(partial);
    const tables = await partial.rows(
      "SELECT TABLE_NAME AS name FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name IN ('cvs','publications','account_sessions')",
    );
    assert.equal(tables.length, 3);
    await migrate(partial);
  } finally {
    await partial.onModuleDestroy();
    await admin.query(`DROP DATABASE IF EXISTS \`${partialName}\``);
  }
});

test('generated-client percent-encoded AIP verbs reach the same Nest handlers', async () => {
  const registered = await request('/account%3Aregister', 'POST', {
    email: 'encoded@example.test',
    password: 'encoded-password',
  });
  assert.equal(registered.status, 201);
  const cv = await (await request('/cvs', 'POST', {displayName: '编码动作'})).json();
  const history = await (await request(`/cvs/${cv.id}/revisions`)).json();
  const copied = await request(
    `/cvs/${cv.id}/revisions/${history.revisions[0].id}%3Arestore`,
    'POST',
    {requestId: randomUUID()},
  );
  assert.equal(copied.status, 201);
});

test('malformed JSON and oversized request bodies produce actionable Google errors', async () => {
  const malformed = await fetch(`${url}/api/cvs`, {
    method: 'POST',
    headers: {Origin: origin, Cookie: cookie, 'Content-Type': 'application/json'},
    body: '{broken',
  });
  assert.equal(malformed.status, 400);
  assert.equal((await malformed.json()).error.status, 'INVALID_ARGUMENT');
  const oversized = await fetch(`${url}/api/cvs`, {
    method: 'POST',
    headers: {Origin: origin, Cookie: cookie, 'Content-Type': 'application/json'},
    body: JSON.stringify({displayName: 'x'.repeat(4194305)}),
  });
  assert.equal(oversized.status, 413);
  assert.equal((await oversized.json()).error.status, 'RESOURCE_EXHAUSTED');
});

test('unknown structured fields are rejected instead of silently removed from a saved CV', async () => {
  const cv = await (await request('/cvs', 'POST', {displayName: '字段保留'})).json();
  const response = await request(`/cvs/${cv.id}`, 'PATCH', {
    etag: cv.etag,
    profile: {...cv.profile, unsupportedField: 'must-not-disappear'},
  });
  assert.equal(response.status, 400);
  assert.equal((await (await request(`/cvs/${cv.id}`)).json()).etag, cv.etag);
});

test('configured history retention is enforced and no-op saves do not add revisions', async () => {
  const bounded = await createApp(
    new Config({
      DATABASE_URL: app.get(Config).databaseUrl,
      PUBLIC_APP_ORIGIN: origin,
      CV_HISTORY_LIMIT: '2',
    }),
  );
  try {
    await bounded.listen(0, '127.0.0.1');
    const endpoint = await bounded.getUrl();
    const call = async (path: string, method = 'GET', body?: unknown) =>
      fetch(`${endpoint}/api${path}`, {
        method,
        headers: {Origin: origin, Cookie: cookie, 'Content-Type': 'application/json'},
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    let cv = await (await call('/cvs', 'POST', {displayName: '限额0'})).json();
    for (let index = 1; index <= 3; index++)
      cv = await (
        await call(`/cvs/${cv.id}`, 'PATCH', {displayName: `限额${index}`, etag: cv.etag})
      ).json();
    const before = await (await call(`/cvs/${cv.id}/revisions`)).json();
    assert.equal(before.retentionLimit, 2);
    assert.equal(before.revisions.length, 2);
    assert.deepEqual(
      before.revisions.map((item: {document: {displayName: string}}) => item.document.displayName),
      ['限额3', '限额2'],
    );
    await call(`/cvs/${cv.id}`, 'PATCH', {displayName: cv.displayName, etag: cv.etag});
    assert.deepEqual(await (await call(`/cvs/${cv.id}/revisions`)).json(), before);
  } finally {
    await bounded.close();
  }
});

test('copying a maximum-length CV name remains valid', async () => {
  const cv = await (await request('/cvs', 'POST', {displayName: '简'.repeat(255)})).json();
  const response = await request(`/cvs/${cv.id}:copy`, 'POST');
  assert.equal(response.status, 201);
  assert.equal((await response.json()).displayName.length, 255);
});

test('an existing Python session and scrypt account remain usable without adopting legacy CVs', async () => {
  const owner = randomUUID();
  const token = randomUUID();
  const {digest} = await import('../src/common/credentials');
  const hash =
    '000102030405060708090a0b0c0d0e0f:089422f08af6b623ad2fb74fb1ff842b6eb7aa3d41155b3d2646420f8db7a033ac4e66b276ca4fd87805e3bd3596933d13d6c8657f2fd18f8d3e787f57b251a7';
  await db.run(
    'INSERT INTO accounts(id,email,password_hash,display_name,public_id,status) VALUES (?,?,?,?,?,?)',
    [owner, 'python@example.test', hash, 'Python 存量用户', randomUUID(), 'active'],
  );
  await db.run(
    'INSERT INTO account_sessions(token_hash,owner_id,expires_at) VALUES (?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 1 DAY))',
    [digest(token), owner],
  );
  const session = `cvory_session=${token}`;
  assert.equal((await request('/account', 'GET', undefined, session)).status, 200);
  const loggedIn = await request(
    '/account:login',
    'POST',
    {email: 'python@example.test', password: 'compatibility-password'},
    '',
  );
  assert.equal(loggedIn.status, 200);
  const cv = await (await request('/cvs', 'POST', {displayName: '未认领'}, session)).json();
  await db.run('UPDATE cvs SET owner_id=? WHERE id=?', ['legacy', cv.id]);
  assert.equal((await request(`/cvs/${cv.id}`, 'GET', undefined, session)).status, 404);
  assert.equal((await (await request('/cvs', 'GET', undefined, session)).json()).totalSize, 0);
  const [stored] = await db.rows('SELECT password_hash FROM accounts WHERE id=?', [owner]);
  assert.equal(stored.password_hash, hash);
});

test('DTO validation identifies invalid fields without echoing private input', async () => {
  const response = await request('/cvs', 'POST', {displayName: ''});
  assert.equal(response.status, 400);
  const error = (await response.json()).error;
  const detail = error.details.find(
    (item: {'@type': string}) => item['@type'] === 'type.googleapis.com/google.rpc.BadRequest',
  );
  assert.equal(detail?.fieldViolations[0]?.field, 'displayName');
});

test('Nest replaces profile, presets and public projection without exposing hidden fields', async () => {
  const account = await (await request('/account')).json();
  const profile = await request('/account', 'PATCH', {displayName: 'Nest 资料', avatar: null});
  assert.equal(profile.status, 200);
  assert.equal((await profile.json()).displayName, 'Nest 资料');
  const cv = await (
    await request('/cvs', 'POST', {
      displayName: '公开来源',
      profile: {fullName: '示例姓名', email: 'PRIVATE_EMAIL', hiddenFields: ['email']},
      sections: [
        {id: 'public', type: 'summary', title: '简介', content: '公开正文'},
        {
          id: 'private',
          type: 'summary',
          title: '隐藏模块',
          content: 'PRIVATE_SECTION',
          visible: false,
        },
      ],
    })
  ).json();
  const preset = await request('/presets', 'POST', {
    id: '',
    displayName: '我的样式',
    settings: cv.styleSettings,
  });
  assert.equal(preset.status, 201);
  const style = await preset.json();
  assert.equal((await (await request('/presets')).json())[0].id, style.id);
  const preview = await request('/publication:preview', 'POST', {
    sourceId: cv.id,
    etag: cv.etag,
    fields: ['email'],
    sectionIds: ['public', 'private'],
  });
  assert.equal(preview.status, 201);
  const review = await preview.json();
  assert.equal(JSON.stringify(review.document).includes('PRIVATE_'), false);
  assert.equal((await request('/publication:publish', 'POST', {reviewId: review.id})).status, 403);
  await db.run('UPDATE accounts SET email_verified_at=UTC_TIMESTAMP() WHERE id=?', [account.id]);
  const published = await request('/publication:publish', 'POST', {reviewId: review.id});
  assert.equal(published.status, 201);
  const publication = await published.json();
  const anonymous = await request(`/public/${account.publicId}`, 'GET', undefined, '');
  assert.equal(anonymous.status, 200);
  assert.equal(JSON.stringify(await anonymous.json()).includes('PRIVATE_'), false);
  assert.equal((await request(`/cvs/${cv.id}`, 'DELETE', undefined)).status, 400);
  assert.equal((await request(`/publication?etag=${publication.etag}`, 'DELETE')).status, 204);
  assert.equal((await request(`/public/${account.publicId}`, 'GET', undefined, '')).status, 404);
});

test('PDF export rejects stale snapshots and legacy password changes revoke other sessions', async () => {
  const cv = await (await request('/cvs', 'POST', {displayName: 'PDF快照'})).json();
  assert.equal((await request(`/cvs/${cv.id}/pdf?etag=stale`)).status, 409);
  const otherLogin = await request(
    '/account:login',
    'POST',
    {email: 'owner@example.test', password: 'owner-password'},
    '',
  );
  const otherCookie = otherLogin.headers.get('set-cookie')?.split(';')[0] || '';
  const changed = await request('/account:changePassword', 'POST', {
    password: 'owner-password',
    newPassword: 'owner-password-next',
  });
  assert.equal(changed.status, 200);
  assert.equal((await request('/account', 'GET', undefined, cookie)).status, 200);
  assert.equal((await request('/account', 'GET', undefined, otherCookie)).status, 401);
});

test('real photos survive normalization, persistence and backup while malformed images are rejected', async () => {
  const {default: sharp} = await import('sharp');
  const {randomBytes} = await import('node:crypto');
  const bytes = await sharp(randomBytes(900 * 900 * 3), {
    raw: {width: 900, height: 900, channels: 3},
  })
    .jpeg({quality: 80})
    .toBuffer();
  assert.ok(bytes.length > 65535 && bytes.length < 2097152);
  const image = `data:image/jpeg;base64,${bytes.toString('base64')}`;
  const account = await request('/account', 'PATCH', {displayName: '照片账户', avatar: image});
  assert.equal(account.status, 200);
  assert.equal((await account.json()).avatar, image);
  const cv = await (
    await request('/cvs', 'POST', {
      displayName: '照片简历',
      profile: {fullName: '照片用户', avatarUrl: image},
    })
  ).json();
  assert.equal(cv.profile.avatarUrl, image);
  const photo = await request(`/cvs/${cv.id}/avatar`);
  assert.equal(photo.status, 200);
  assert.deepEqual(Buffer.from(await photo.arrayBuffer()), bytes);
  const invalid = await request(`/cvs/${cv.id}`, 'PATCH', {
    etag: cv.etag,
    profile: {...cv.profile, avatarUrl: 'data:image/png;base64,bm90LWFuLWltYWdl'},
  });
  assert.equal(invalid.status, 400);
  assert.equal((await (await request(`/cvs/${cv.id}`)).json()).etag, cv.etag);
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(bytes)], {type: 'image/jpeg'}), 'photo.jpg');
  const upload = await fetch(`${url}/api/cvs/${cv.id}/avatar`, {
    method: 'POST',
    headers: {Origin: origin, Cookie: cookie},
    body: form,
  });
  assert.equal(upload.status, 201);
});

test('publication rejects changed source or stale publication versions and protects its source from deletion', async () => {
  const cv = await (
    await request('/cvs', 'POST', {
      displayName: '公开并发',
      profile: {fullName: '公开用户'},
      sections: [{id: 'text', type: 'summary', title: '简介', content: '公开正文'}],
    })
  ).json();
  const selection = {sourceId: cv.id, etag: cv.etag, fields: [], sectionIds: ['text']};
  const review = await (await request('/publication:preview', 'POST', selection)).json();
  const newer = await (
    await request(`/cvs/${cv.id}`, 'PATCH', {etag: cv.etag, displayName: '公开并发修改'})
  ).json();
  assert.equal((await request('/publication:publish', 'POST', {reviewId: review.id})).status, 409);
  const next = {...selection, etag: newer.etag};
  const [a, b] = await Promise.all([
    request('/publication:preview', 'POST', next),
    request('/publication:preview', 'POST', next),
  ]);
  const first = await a.json(),
    second = await b.json();
  const published = await request('/publication:publish', 'POST', {reviewId: first.id});
  assert.equal(published.status, 201);
  const status = await published.json();
  assert.equal((await request('/publication:publish', 'POST', {reviewId: second.id})).status, 409);
  const blocked = await fetch(`${url}/api/cvs/${cv.id}`, {
    method: 'DELETE',
    headers: {Origin: origin, Cookie: cookie, 'If-Match': newer.etag},
  });
  assert.equal(blocked.status, 400);
  assert.equal((await request('/publication?etag=0', 'DELETE')).status, 409);
  assert.equal((await request(`/publication?etag=${status.etag}`, 'DELETE')).status, 204);
});

test('three legacy disk photos load in one list without exhausting the image processor', async () => {
  if (!cookie) {
    const registration = await request(
      '/account:register',
      'POST',
      {email: 'legacy-photos@example.test', password: 'legacy-photos-password'},
      '',
    );
    cookie = registration.headers.get('set-cookie')?.split(';')[0] || '';
  }
  const {mkdtemp, mkdir, writeFile, rm} = await import('node:fs/promises');
  const {tmpdir} = await import('node:os');
  const {join} = await import('node:path');
  const {default: sharp} = await import('sharp');
  const directory = await mkdtemp(join(tmpdir(), 'cvory-legacy-photos-'));
  const legacyApp = await createApp(
    new Config({
      DATABASE_URL: app.get(Config).databaseUrl,
      PUBLIC_APP_ORIGIN: origin,
      DATA_DIR: directory,
    }),
  );
  try {
    await mkdir(join(directory, 'avatars'));
    const image = await sharp({create: {width: 10, height: 10, channels: 3, background: '#fff'}})
      .jpeg()
      .toBuffer();
    const ids: string[] = [];
    for (let index = 0; index < 3; index++) {
      const cv = await (await request('/cvs', 'POST', {displayName: `旧照片${index}`})).json();
      ids.push(cv.id);
      await writeFile(join(directory, 'avatars', `${cv.id}.jpg`), image);
      await db.run("UPDATE cvs SET profile=JSON_SET(profile, '$.avatar_url', ?) WHERE id=?", [
        `/api/cvs/${cv.id}/avatar`,
        cv.id,
      ]);
    }
    await legacyApp.listen(0, '127.0.0.1');
    const response = await fetch(`${await legacyApp.getUrl()}/api/cvs?pageSize=100`, {
      headers: {Cookie: cookie},
    });
    assert.equal(response.status, 200, await response.clone().text());
    const body = await response.json();
    assert.equal(
      body.cvs.filter(
        (cv: {id: string; profile: {avatarUrl: string}}) =>
          ids.includes(cv.id) && cv.profile.avatarUrl.startsWith('data:image/jpeg;base64,'),
      ).length,
      3,
    );
  } finally {
    await legacyApp.close();
    await rm(directory, {recursive: true, force: true});
  }
});

test('readiness refuses pending legacy deletion work instead of silently abandoning it', async () => {
  assert.equal((await request('/health', 'GET', undefined, '')).status, 200);
  const id = randomUUID(),
    owner = (await (await request('/account')).json()).id;
  await db.run(
    'INSERT INTO account_deletion_jobs(id,owner_id,status,attempts,next_attempt_at,created_at) VALUES (?,?,?,0,UTC_TIMESTAMP(),UTC_TIMESTAMP())',
    [id, owner, 'pending'],
  );
  try {
    const health = await request('/health', 'GET', undefined, '');
    assert.equal(health.status, 503);
    assert.equal((await health.json()).error.details[0].reason, 'LIFECYCLE_RECOVERY_REQUIRED');
  } finally {
    await db.run('DELETE FROM account_deletion_jobs WHERE id=?', [id]);
  }
  assert.equal((await request('/health', 'GET', undefined, '')).status, 200);
});

test('pre-account CV schema upgrades in TypeScript and preserves unclaimed ownership', async () => {
  const name = `cvory_nest_test_${randomUUID().replaceAll('-', '')}`;
  await admin.query(`CREATE DATABASE \`${name}\``);
  const databaseUrl = new URL(base!);
  databaseUrl.pathname = `/${name}`;
  const older = new Database(new Config({DATABASE_URL: databaseUrl.toString()}));
  try {
    await older.run(`CREATE TABLE cvs LIKE \`${databaseName}\`.cvs`);
    await older.run('ALTER TABLE cvs DROP COLUMN owner_id');
    const id = randomUUID();
    await older.run(
      "INSERT INTO cvs(id,display_name,etag,profile,sections,style_settings,create_time,update_time) VALUES (?,?,?,'{}','[]','{}',UTC_TIMESTAMP(),UTC_TIMESTAMP())",
      [id, '旧schema', 'legacy-etag'],
    );
    await migrate(older);
    await migrate(older);
    const [row] = await older.rows('SELECT owner_id,etag FROM cvs WHERE id=?', [id]);
    assert.equal(row.owner_id, 'legacy');
    assert.equal(row.etag, 'legacy-etag');
  } finally {
    await older.onModuleDestroy();
    await admin.query(`DROP DATABASE IF EXISTS \`${name}\``);
  }
});
