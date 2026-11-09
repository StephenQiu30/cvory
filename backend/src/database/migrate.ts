import {Config} from '../config/config';
import {Database} from './database';
import {migrate} from './migrations';
async function main(): Promise<void> {
  const db = new Database(new Config());
  try {
    await migrate(db);
    const args = process.argv.slice(2);
    if (args.length && (args.length !== 2 || args[0] !== '--assign-legacy-to' || !args[1]))
      throw new Error('Use --assign-legacy-to <account id or email>.');
    if (args.length) {
      const count = await db.transaction(async (tx) => {
        const accounts = await db.rows(
          'SELECT id FROM accounts WHERE (id=? OR email=?) AND status=? FOR UPDATE',
          [args[1], args[1].trim().toLowerCase(), 'active'],
          tx,
        );
        if (accounts.length !== 1) throw new Error('Target must identify one active account.');
        const owner = String(accounts[0].id);
        const result = await db.run(
          "UPDATE cvs SET owner_id=? WHERE owner_id='legacy'",
          [owner],
          tx,
        );
        await db.run(
          "UPDATE cv_revisions r JOIN cvs c ON c.id=r.cv_id SET r.owner_id=? WHERE r.owner_id='legacy' AND c.owner_id=?",
          [owner, owner],
          tx,
        );
        return result.affectedRows;
      });
      process.stdout.write(`Explicitly assigned ${count} legacy CVs.\n`);
    }
    process.stdout.write('CVory migrations applied.\n');
  } finally {
    await db.onModuleDestroy();
  }
}
void main().catch(() => {
  process.stderr.write(
    'Migration failed. Restore the pre-migration backup before changing runtimes; verify schema and permissions.\n',
  );
  process.exitCode = 1;
});
