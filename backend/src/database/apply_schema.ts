import {Config} from '../config/config';
import {Database} from './database';
import {applySchema} from './schema';

async function main(): Promise<void> {
  const database = new Database(new Config());
  try {
    await applySchema(database.pool);
    process.stdout.write('CVory schema applied.\n');
  } finally {
    await database.onModuleDestroy();
  }
}

void main().catch(() => {
  process.stderr.write(
    'Schema application failed. Check database access and schema compatibility.\n',
  );
  process.exitCode = 1;
});
