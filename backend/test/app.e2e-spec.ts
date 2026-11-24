import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { WsAdapter } from '@nestjs/platform-ws';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { WebSocket } from 'ws';
import * as Y from 'yjs';
import { AppModule } from '../src/app.module.js';
import { CVORY_CONTRACT_VERSION } from '../src/common/contract/contract.constants.js';
import { GlobalHttpExceptionFilter } from '../src/common/filters/http-exception.filter.js';
import { toBase64 } from '../src/common/yjs/yjs-state.helper.js';
import { PrismaService } from '../src/infra/prisma/prisma.service.js';
import { RedisService } from '../src/infra/redis/redis.service.js';
import { MAIL_PROVIDER, type MailProvider, type SendOtpMailInput } from '../src/modules/mail/mail.provider.js';
import type { ServerSyncMessage } from '../src/modules/sync/sync.protocol.js';

interface StoredUser {
  id: string;
  email: string;
  createdAt: Date;
  lastLoginAt: Date | null;
}

interface StoredResume {
  id: string;
  userId: string;
  title: string;
  templateId: string;
  contractVersion: number;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface StoredClaim {
  id: string;
  userId: string;
  clientDraftId: string;
  resumeId: string;
  createdAt: Date;
}

interface StoredUpdate {
  id: bigint;
  resumeId: string;
  clientSeq: number;
  updateData: Buffer;
  createdAt: Date;
}

interface StoredSnapshot {
  resumeId: string;
  stateVector: Buffer;
  snapshotData: Buffer;
  updatedAt: Date;
}

function createInMemoryPrisma(): PrismaService {
  let seq = 1;
  let updateSeq = 1n;
  const users = new Map<string, StoredUser>();
  const resumes = new Map<string, StoredResume>();
  const claims = new Map<string, StoredClaim>();
  const updates: StoredUpdate[] = [];
  const snapshots = new Map<string, StoredSnapshot>();

  const db = {
    $queryRaw: async () => [1],
    user: {
      upsert: async ({ where }: { where: { email: string } }) => {
        for (const existing of users.values()) {
          if (existing.email === where.email) {
            existing.lastLoginAt = new Date();
            return existing;
          }
        }
        const created: StoredUser = {
          id: `user-${seq++}`,
          email: where.email,
          createdAt: new Date(),
          lastLoginAt: new Date(),
        };
        users.set(created.id, created);
        return created;
      },
      findUnique: async ({ where }: { where: { id: string } }) => users.get(where.id) ?? null,
    },
    resume: {
      findMany: async ({ where }: { where: { userId: string; deletedAt: null } }) =>
        [...resumes.values()]
          .filter((r) => r.userId === where.userId && r.deletedAt === null)
          .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()),
      findUnique: async ({ where }: { where: { id: string } }) => resumes.get(where.id) ?? null,
      create: async ({
        data,
      }: {
        data: { userId: string; title: string; templateId: string; contractVersion: number };
      }) => {
        const now = new Date();
        const created: StoredResume = {
          id: `res-${seq++}`,
          userId: data.userId,
          title: data.title,
          templateId: data.templateId,
          contractVersion: data.contractVersion,
          deletedAt: null,
          createdAt: now,
          updatedAt: now,
        };
        resumes.set(created.id, created);
        return created;
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<Pick<StoredResume, 'title' | 'templateId' | 'deletedAt' | 'updatedAt'>>;
      }) => {
        const existing = resumes.get(where.id);
        if (!existing) {
          throw new Error('Resume not found');
        }
        Object.assign(existing, data, { updatedAt: data.updatedAt ?? new Date() });
        return existing;
      },
    },
    resumeClaim: {
      findUnique: async ({
        where,
      }: {
        where: { userId_clientDraftId: { userId: string; clientDraftId: string } };
      }) => {
        const key = `${where.userId_clientDraftId.userId}:${where.userId_clientDraftId.clientDraftId}`;
        const claim = claims.get(key);
        if (!claim) {
          return null;
        }
        const resume = resumes.get(claim.resumeId);
        return resume ? { ...claim, resume } : null;
      },
      create: async ({
        data,
      }: {
        data: { userId: string; clientDraftId: string; resumeId: string };
      }) => {
        const created: StoredClaim = {
          id: `claim-${seq++}`,
          userId: data.userId,
          clientDraftId: data.clientDraftId,
          resumeId: data.resumeId,
          createdAt: new Date(),
        };
        claims.set(`${data.userId}:${data.clientDraftId}`, created);
        return created;
      },
    },
    resumeYjsUpdate: {
      findMany: async ({ where }: { where: { resumeId: string } }) =>
        updates.filter((u) => u.resumeId === where.resumeId),
      findFirst: async ({ where }: { where: { resumeId: string } }) => {
        const matched = updates.filter((u) => u.resumeId === where.resumeId);
        return matched.length > 0 ? matched[matched.length - 1] : null;
      },
      create: async ({
        data,
      }: {
        data: { resumeId: string; clientSeq: number; updateData: Buffer };
      }) => {
        const created: StoredUpdate = {
          id: updateSeq++,
          resumeId: data.resumeId,
          clientSeq: data.clientSeq,
          updateData: data.updateData,
          createdAt: new Date(),
        };
        updates.push(created);
        return created;
      },
      count: async ({ where }: { where: { resumeId: string } }) =>
        updates.filter((u) => u.resumeId === where.resumeId).length,
      deleteMany: async ({ where }: { where: { resumeId: string; id: { lt: bigint } } }) => {
        let removed = 0;
        for (let i = updates.length - 1; i >= 0; i -= 1) {
          if (updates[i].resumeId === where.resumeId && updates[i].id < where.id.lt) {
            updates.splice(i, 1);
            removed += 1;
          }
        }
        return { count: removed };
      },
    },
    resumeYjsSnapshot: {
      findUnique: async ({ where }: { where: { resumeId: string } }) =>
        snapshots.get(where.resumeId) ?? null,
      create: async ({
        data,
      }: {
        data: { resumeId: string; stateVector: Buffer; snapshotData: Buffer };
      }) => {
        const created: StoredSnapshot = { ...data, updatedAt: new Date() };
        snapshots.set(data.resumeId, created);
        return created;
      },
      upsert: async ({
        where,
        create,
      }: {
        where: { resumeId: string };
        create: { resumeId: string; stateVector: Buffer; snapshotData: Buffer };
      }) => {
        const stored: StoredSnapshot = { ...create, updatedAt: new Date() };
        snapshots.set(where.resumeId, stored);
        return stored;
      },
    },
    $transaction: async <T>(cb: (tx: unknown) => Promise<T>): Promise<T> => cb(db),
  };

  return db as unknown as PrismaService;
}

function createInMemoryRedis(): RedisService {
  const store = new Map<string, string>();
  const client = {
    ping: async () => 'PONG',
    exists: async (key: string) => (store.has(key) ? 1 : 0),
    get: async (key: string) => store.get(key) ?? null,
    set: async (key: string, value: string) => {
      store.set(key, value);
      return 'OK';
    },
    incr: async (key: string) => {
      const next = Number(store.get(key) ?? '0') + 1;
      store.set(key, String(next));
      return next;
    },
    expire: async () => 1,
    del: async (...keys: string[]) => {
      for (const key of keys) {
        store.delete(key);
      }
      return keys.length;
    },
    quit: async () => 'OK',
  };
  return { client } as unknown as RedisService;
}

class WsTestClient {
  private readonly queue: ServerSyncMessage[] = [];
  private readonly waiters: Array<(msg: ServerSyncMessage) => void> = [];
  private closedResolve?: (code: number) => void;
  readonly closed: Promise<number>;

  private constructor(readonly socket: WebSocket) {
    this.closed = new Promise<number>((resolve) => {
      this.closedResolve = resolve;
    });
    socket.on('message', (data) => {
      const text = Buffer.isBuffer(data)
        ? data.toString('utf8')
        : Array.isArray(data)
          ? Buffer.concat(data).toString('utf8')
          : Buffer.from(data).toString('utf8');
      const parsed = JSON.parse(text) as ServerSyncMessage;
      const waiter = this.waiters.shift();
      if (waiter) {
        waiter(parsed);
      } else {
        this.queue.push(parsed);
      }
    });
    socket.on('close', (code) => {
      this.closedResolve?.(code);
    });
  }

  static connect(url: string): Promise<WsTestClient> {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(url);
      socket.once('open', () => resolve(new WsTestClient(socket)));
      socket.once('error', reject);
    });
  }

  send(payload: Record<string, unknown>): void {
    this.socket.send(JSON.stringify(payload));
  }

  nextMessage(): Promise<ServerSyncMessage> {
    const queued = this.queue.shift();
    if (queued) {
      return Promise.resolve(queued);
    }
    return new Promise((resolve) => {
      this.waiters.push(resolve);
    });
  }

  close(): void {
    this.socket.close();
  }
}

describe('CVory Backend HTTP + WS Sync (e2e)', () => {
  let app: INestApplication;
  let baseUrl: string;
  let wsUrl: string;
  const sentMails: SendOtpMailInput[] = [];

  beforeAll(async () => {
    process.env.DATABASE_URL = 'postgresql://test:test@127.0.0.1:5432/test';
    process.env.REDIS_URL = 'redis://127.0.0.1:6379';
    process.env.JWT_ACCESS_SECRET = 'e2e-access-secret-key-min-32-chars!!';
    process.env.JWT_REFRESH_SECRET = 'e2e-refresh-secret-key-min-32-chars!';

    const fakeMailProvider: MailProvider = {
      sendOtpCode: async (input: SendOtpMailInput) => {
        sentMails.push(input);
      },
    };

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(createInMemoryPrisma())
      .overrideProvider(RedisService)
      .useValue(createInMemoryRedis())
      .overrideProvider(MAIL_PROVIDER)
      .useValue(fakeMailProvider)
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new GlobalHttpExceptionFilter());
    app.useWebSocketAdapter(new WsAdapter(app));

    await app.listen(0, '127.0.0.1');
    const url = await app.getUrl();
    baseUrl = url.replace('[::1]', '127.0.0.1');
    wsUrl = `${baseUrl.replace('http://', 'ws://')}/ws/sync`;
  });

  afterAll(async () => {
    await app.close();
  });

  async function loginAs(email: string): Promise<{ accessToken: string; refreshToken: string }> {
    await request(baseUrl).post('/api/auth/otp/send').send({ email }).expect(200);
    const mail = sentMails[sentMails.length - 1];
    const verifyRes = await request(baseUrl)
      .post('/api/auth/otp/verify')
      .send({ email, code: mail.code })
      .expect(200);

    return {
      accessToken: verifyRes.body.accessToken as string,
      refreshToken: verifyRes.body.refreshToken as string,
    };
  }

  it('covers health, OTP auth, idempotent claim, dual-device WS ACK sync, delete tombstone, and logout revocation', async () => {
    await request(baseUrl).get('/api/health').expect(200);
    await request(baseUrl).get('/api/health/ready').expect(200);

    const alice = await loginAs('alice@163.com');
    const bob = await loginAs('bob@163.com');

    // Reject unsupported contract & invalid templateId (CASE-CV-11).
    await request(baseUrl)
      .post('/api/resumes')
      .set('Authorization', `Bearer ${alice.accessToken}`)
      .send({
        title: '非法模板',
        templateId: 'unknown-template',
        contractVersion: CVORY_CONTRACT_VERSION,
      })
      .expect(400);

    // Idempotent guest draft claim (AC-CV-08).
    const initialDoc = new Y.Doc();
    initialDoc.getText('name').insert(0, '张简序');
    const initialUpdateBase64 = toBase64(Y.encodeStateAsUpdate(initialDoc));

    const claim1 = await request(baseUrl)
      .post('/api/resumes/claim')
      .set('Authorization', `Bearer ${alice.accessToken}`)
      .send({
        clientDraftId: 'guest-draft-01',
        title: '前端工程师',
        templateId: 'classic-single',
        contractVersion: CVORY_CONTRACT_VERSION,
        initialUpdateBase64,
        clientSeq: 1,
      })
      .expect(200);

    const resumeId = claim1.body.resume.id as string;
    expect(claim1.body.alreadyClaimed).toBe(false);

    const claimRetry = await request(baseUrl)
      .post('/api/resumes/claim')
      .set('Authorization', `Bearer ${alice.accessToken}`)
      .send({
        clientDraftId: 'guest-draft-01',
        title: '前端工程师',
        templateId: 'classic-single',
        contractVersion: CVORY_CONTRACT_VERSION,
        initialUpdateBase64,
        clientSeq: 1,
      })
      .expect(200);
    expect(claimRetry.body.alreadyClaimed).toBe(true);
    expect(claimRetry.body.resume.id).toBe(resumeId);

    // Cross-account isolation (Bob cannot read Alice's resume).
    await request(baseUrl)
      .get(`/api/resumes/${resumeId}`)
      .set('Authorization', `Bearer ${bob.accessToken}`)
      .expect(403);

    // Dual-device real WebSocket sync (Device A & Device B).
    const deviceA = await WsTestClient.connect(wsUrl);
    const deviceB = await WsTestClient.connect(wsUrl);

    deviceA.send({ type: 'AUTH', accessToken: alice.accessToken });
    deviceB.send({ type: 'AUTH', accessToken: alice.accessToken });
    expect((await deviceA.nextMessage()).type).toBe('AUTH_OK');
    expect((await deviceB.nextMessage()).type).toBe('AUTH_OK');

    deviceA.send({ type: 'JOIN', resumeId, contractVersion: CVORY_CONTRACT_VERSION });
    deviceB.send({ type: 'JOIN', resumeId, contractVersion: CVORY_CONTRACT_VERSION });

    const syncA = await deviceA.nextMessage();
    const syncB = await deviceB.nextMessage();
    expect(syncA.type).toBe('SYNC_STATE');
    expect(syncB.type).toBe('SYNC_STATE');

    // Device A edits and sends UPDATE -> gets ACK, Device B gets REMOTE_UPDATE and converges.
    const docA = new Y.Doc();
    const docB = new Y.Doc();
    if (syncA.type === 'SYNC_STATE') {
      Y.applyUpdate(docA, Buffer.from(syncA.updateBase64, 'base64'));
    }
    if (syncB.type === 'SYNC_STATE') {
      Y.applyUpdate(docB, Buffer.from(syncB.updateBase64, 'base64'));
    }

    const deltaPromise = new Promise<Uint8Array>((resolve) => {
      docA.once('update', (update: Uint8Array) => resolve(update));
    });
    docA.getText('name').insert(3, ' · 高级');
    const deltaBytes = await deltaPromise;

    deviceA.send({
      type: 'UPDATE',
      resumeId,
      contractVersion: CVORY_CONTRACT_VERSION,
      clientSeq: 2,
      updateBase64: toBase64(deltaBytes),
    });

    const ackMsg = await deviceA.nextMessage();
    expect(ackMsg.type).toBe('ACK');
    if (ackMsg.type === 'ACK') {
      expect(ackMsg.clientSeq).toBe(2);
    }

    const remoteMsg = await deviceB.nextMessage();
    expect(remoteMsg.type).toBe('REMOTE_UPDATE');
    if (remoteMsg.type === 'REMOTE_UPDATE') {
      Y.applyUpdate(docB, Buffer.from(remoteMsg.updateBase64, 'base64'));
    }
    expect(docB.getText('name').toJSON()).toBe('张简序 · 高级');

    // Soft-delete tombstone broadcasts DOC_DELETED to connected devices & returns 410 Gone.
    await request(baseUrl)
      .delete(`/api/resumes/${resumeId}`)
      .set('Authorization', `Bearer ${alice.accessToken}`)
      .expect(200);

    const deletedA = await deviceA.nextMessage();
    const deletedB = await deviceB.nextMessage();
    expect(deletedA.type).toBe('DOC_DELETED');
    expect(deletedB.type).toBe('DOC_DELETED');

    await request(baseUrl)
      .get(`/api/resumes/${resumeId}`)
      .set('Authorization', `Bearer ${alice.accessToken}`)
      .expect(410);

    // Logout revokes JWT and closes active WS sockets with 4401 (AC-CV-07).
    await request(baseUrl)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${alice.accessToken}`)
      .send({ refreshToken: alice.refreshToken })
      .expect(200);

    expect(await deviceA.closed).toBe(4401);
    expect(await deviceB.closed).toBe(4401);

    await request(baseUrl)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${alice.accessToken}`)
      .expect(401);

    initialDoc.destroy();
    docA.destroy();
    docB.destroy();
  });
});
