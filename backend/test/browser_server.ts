/** Local fixture only: real HTTP/MySQL; the GitHub network boundary is simulated. */
import {createHash, randomUUID} from 'node:crypto';
import {createConnection} from 'mysql2/promise';
import {createApp} from '../src/app';
import {Config} from '../src/config/config';
import {Database} from '../src/database/database';
import {migrate} from '../src/database/migrations';

async function main(): Promise<void> {
  const base = process.env.CVORY_TEST_MYSQL_URL;
  if (!base) throw new Error('CVORY_TEST_MYSQL_URL is required.');
  const adminUrl = new URL(base);
  adminUrl.pathname = '/';
  const admin = await createConnection(adminUrl.toString());
  const name = `cvory_nest_test_${randomUUID().replaceAll('-', '')}`;
  await admin.query(`CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4`);
  const url = new URL(base);
  url.pathname = `/${name}`;
  const config = new Config({
    DATABASE_URL: url.toString(),
    PUBLIC_APP_ORIGIN: process.env.CVORY_TEST_ORIGIN || 'http://127.0.0.1:3123',
    GITHUB_CLIENT_ID: 'isolated-test',
    GITHUB_CLIENT_SECRET: 'isolated-test',
    LEGACY_REGISTRATION_ENABLED: 'true',
    PORT: '4323',
  });
  const app = await createApp(config, {
    identity: async (code) => ({
      id: String(Number.parseInt(createHash('sha256').update(code).digest('hex').slice(0, 12), 16)),
      login: 'cvory-fixture',
      displayName: 'GitHub 测试用户',
      avatar: null,
    }),
    repositories: async () => ({
      repositories: [
        {
          id: '123',
          name: 'resume-project',
          fullName: 'cvory-fixture/resume-project',
          url: 'https://github.com/cvory-fixture/resume-project',
          description: '公开仓库模拟边界',
          language: 'TypeScript',
          stars: 12,
          fork: false,
          updateTime: new Date().toISOString(),
        },
      ],
      nextPageToken: '',
    }),
  });
  await migrate(app.get(Database));
  await app.listen(config.port, '127.0.0.1');
  let closing = false;
  const stop = async () => {
    if (closing) return;
    closing = true;
    try {
      await app.close();
      await admin.query(`DROP DATABASE IF EXISTS \`${name}\``);
      await admin.end();
    } finally {
      process.exit(0);
    }
  };
  process.on('SIGINT', () => {
    void stop();
  });
  process.on('SIGTERM', () => {
    void stop();
  });
  process.stdout.write(
    `Isolated Nest browser fixture on 127.0.0.1:${config.port}. GitHub is simulated.\n`,
  );
}
void main().catch(() => {
  process.stderr.write('Browser fixture failed.\n');
  process.exitCode = 1;
});
