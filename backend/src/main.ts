import {createApp} from './app';
import {Database} from './database/database';
import {Config} from './config/config';

async function main(): Promise<void> {
  const config = new Config();
  const app = await createApp(config);
  try {
    await app.get(Database).assertReady();
    await app.listen(config.port, '0.0.0.0');
  } catch (error) {
    await app.close();
    throw error;
  }
  process.stdout.write(
    `CVory Nest API listening on port ${config.port}. Schema application is explicit.\n`,
  );
}
void main().catch(() => {
  process.stderr.write(
    'CVory startup failed. Check configuration, database connectivity and the applied schema.\n',
  );
  process.exitCode = 1;
});
