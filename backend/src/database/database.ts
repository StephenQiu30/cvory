import {Injectable, OnModuleDestroy} from '@nestjs/common';
import {createPool, Pool, PoolConnection, RowDataPacket, ResultSetHeader} from 'mysql2/promise';
import {ApiError} from '../common/errors';
import {Config} from '../config/config';

export type Row = RowDataPacket & Record<string, unknown>;
export type SqlValue = string | number | boolean | Date | Buffer | null;
export type Connection = Pool | PoolConnection;

@Injectable()
export class Database implements OnModuleDestroy {
  readonly pool: Pool;
  constructor(config: Config) {
    this.pool = createPool({
      uri: config.databaseUrl,
      timezone: 'Z',
      dateStrings: true,
      connectionLimit: 5,
      charset: 'utf8mb4',
    });
  }
  async rows(
    sql: string,
    values: SqlValue[] = [],
    connection: Connection = this.pool,
  ): Promise<Row[]> {
    const [rows] = await connection.execute<Row[]>(sql, values);
    return rows;
  }
  async run(
    sql: string,
    values: SqlValue[] = [],
    connection: Connection = this.pool,
  ): Promise<ResultSetHeader> {
    const [result] = await connection.execute<ResultSetHeader>(sql, values);
    return result;
  }
  async transaction<T>(operation: (connection: PoolConnection) => Promise<T>): Promise<T> {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const result = await operation(connection);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
  async assertReady(): Promise<void> {
    try {
      const migration = await this.rows('SELECT version FROM cvory_migrations WHERE version=?', [
        '005_image_storage',
      ]);
      if (!migration.length) throw new Error('Schema upgrade required.');
      const pending = await this.rows(
        "SELECT id FROM account_deletion_jobs WHERE status NOT IN ('completed','cancelled','done','succeeded') LIMIT 1",
      );
      if (pending.length) throw new ApiError(503, 'UNAVAILABLE', 'LIFECYCLE_RECOVERY_REQUIRED');
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(503, 'UNAVAILABLE', 'DATABASE_NOT_READY');
    }
  }
  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
