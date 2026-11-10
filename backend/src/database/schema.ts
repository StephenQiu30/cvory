import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {Pool, RowDataPacket} from 'mysql2/promise';

function isAlreadyPresent(error: unknown): boolean {
  if (!(error instanceof Error) || !('code' in error)) return false;
  return error.code === 'ER_DUP_FIELDNAME' || error.code === 'ER_DUP_KEYNAME';
}

export async function applySchema(pool: Pool): Promise<void> {
  const connection = await pool.getConnection();
  let lockAcquired = false;
  try {
    const [lockRows] = await connection.query<RowDataPacket[]>(
      "SELECT GET_LOCK(CONCAT(DATABASE(), ':cvory-schema'), 10) AS acquired",
    );
    if (Number(lockRows[0]?.acquired) !== 1) throw new Error('Schema application is busy.');
    lockAcquired = true;

    const sql = await readFile(join(process.cwd(), 'schema.sql'), 'utf8');
    const statements = sql
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*--.*$/gm, '')
      .split(';')
      .map((statement) => statement.trim())
      .filter(Boolean);
    for (const statement of statements) {
      try {
        await connection.query(statement);
      } catch (error) {
        if (statement.startsWith('ALTER TABLE') && isAlreadyPresent(error)) continue;
        throw error;
      }
    }
  } finally {
    try {
      if (lockAcquired)
        await connection.query("DO RELEASE_LOCK(CONCAT(DATABASE(), ':cvory-schema'))");
    } finally {
      connection.release();
    }
  }
}
