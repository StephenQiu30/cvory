import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {Database} from './database';

/** Explicit command only: the API process never creates or changes tables. */
export async function migrate(db: Database): Promise<void> {
  const connection = await db.pool.getConnection();
  try {
    const [lock] = await connection.query(
      "SELECT GET_LOCK(CONCAT(DATABASE(), ':cvory-migrate'), 10) AS acquired",
    );
    if ((lock as Array<{acquired: number}>)[0].acquired !== 1)
      throw new Error('Migration already running.');
    await connection.query(
      'CREATE TABLE IF NOT EXISTS cvory_migrations (version VARCHAR(64) PRIMARY KEY, applied_at DATETIME(6) NOT NULL)',
    );
    const applied = await db.rows('SELECT version FROM cvory_migrations', [], connection);
    const versions = new Set(applied.map((row) => String(row.version)));

    // The retained SQL baseline also upgrades pre-account schemas without Python.
    for (const [table, additions] of Object.entries({
      cvs: {owner_id: "VARCHAR(36) NOT NULL DEFAULT 'legacy'"},
      accounts: {
        email_verified_at: 'DATETIME NULL',
        status: "VARCHAR(16) NOT NULL DEFAULT 'active'",
        delete_requested_at: 'DATETIME NULL',
        purge_after: 'DATETIME NULL',
      },
    })) {
      const columns = await db.rows(
        'SELECT COLUMN_NAME AS column_name FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=?',
        [table],
        connection,
      );
      if (!columns.length) continue;
      for (const [column, definition] of Object.entries(additions))
        if (!columns.some((row) => row.column_name === column))
          await connection.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
    if (!versions.has('000_legacy')) {
      const sql = await readFile(join(process.cwd(), 'migrations/000_legacy_schema.sql'), 'utf8');
      for (const statement of sql
        .split(';')
        .map((item) => item.trim())
        .filter(Boolean)) {
        const index = /^CREATE INDEX (\w+) ON (\w+)/.exec(statement);
        if (index) {
          const present = await db.rows(
            'SELECT INDEX_NAME FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name=? AND index_name=?',
            [index[2], index[1]],
            connection,
          );
          if (present.length) continue;
        }
        await connection.query(statement);
      }
    }
    if (!versions.has('000_legacy'))
      await db.run(
        'INSERT INTO cvory_migrations VALUES (?, UTC_TIMESTAMP(6))',
        ['000_legacy'],
        connection,
      );
    if (!versions.has('003_nest_identity')) {
      await connection.query(
        'ALTER TABLE accounts MODIFY email VARCHAR(254) NULL, MODIFY password_hash VARCHAR(256) NULL',
      );
      await connection.query(
        'CREATE TABLE IF NOT EXISTS account_identities (provider VARCHAR(20) NOT NULL, provider_user_id VARCHAR(40) NOT NULL, owner_id VARCHAR(36) NOT NULL, login VARCHAR(100) NOT NULL, PRIMARY KEY(provider,provider_user_id), UNIQUE KEY owner_provider(owner_id,provider))',
      );
      await connection.query(
        'CREATE TABLE IF NOT EXISTS oauth_challenges (state_hash CHAR(64) PRIMARY KEY,browser_hash CHAR(64) NOT NULL,verifier VARCHAR(128) NOT NULL,return_path VARCHAR(2048) NOT NULL,owner_id VARCHAR(36) NULL,session_hash CHAR(64) NULL,expires_at DATETIME(6) NOT NULL,INDEX(expires_at))',
      );
      await connection.query(
        'CREATE TABLE IF NOT EXISTS nest_auth_attempts (`key` CHAR(64) PRIMARY KEY,count INT NOT NULL,expires_at DATETIME(6) NOT NULL,INDEX(expires_at))',
      );
      await connection.query(
        'CREATE TABLE IF NOT EXISTS cv_revisions (id VARCHAR(36) PRIMARY KEY,cv_id VARCHAR(36) NOT NULL,owner_id VARCHAR(36) NOT NULL,etag VARCHAR(64) NOT NULL,snapshot JSON NOT NULL,created_at DATETIME(6) NOT NULL,UNIQUE KEY cv_etag(cv_id,etag),INDEX owner_cv(owner_id,cv_id,created_at))',
      );
      await db.run(
        'INSERT INTO cvory_migrations VALUES (?,UTC_TIMESTAMP(6))',
        ['003_nest_identity'],
        connection,
      );
    }
    if (!versions.has('004_publication_conditions')) {
      await connection.query(
        'CREATE TABLE IF NOT EXISTS publication_heads(owner_id VARCHAR(36) PRIMARY KEY,revision BIGINT UNSIGNED NOT NULL DEFAULT 0)',
      );
      for (const [column, definition] of [
        ['source_etag', 'VARCHAR(64) NULL'],
        ['base_version', 'BIGINT UNSIGNED NULL'],
      ]) {
        const present = await db.rows(
          'SELECT COLUMN_NAME FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=? AND column_name=?',
          ['publication_reviews', column],
          connection,
        );
        if (!present.length)
          await connection.query(
            `ALTER TABLE publication_reviews ADD COLUMN ${column} ${definition}`,
          );
      }
      await db.run(
        'INSERT INTO cvory_migrations VALUES (?,UTC_TIMESTAMP(6))',
        ['004_publication_conditions'],
        connection,
      );
    }

    if (!versions.has('005_image_storage')) {
      await connection.query('ALTER TABLE accounts MODIFY avatar MEDIUMTEXT NULL');
      await db.run(
        'INSERT INTO cvory_migrations VALUES (?,UTC_TIMESTAMP(6))',
        ['005_image_storage'],
        connection,
      );
    }

    if (!versions.has('006_github_featured_projects')) {
      await connection.query(
        'CREATE TABLE IF NOT EXISTS github_featured_projects(owner_id VARCHAR(36) NOT NULL,repository_id VARCHAR(20) NOT NULL,repository JSON NOT NULL,contribution VARCHAR(2000) NOT NULL,display_order TINYINT UNSIGNED NOT NULL,update_time DATETIME(6) NOT NULL,PRIMARY KEY(owner_id,repository_id),INDEX owner_order(owner_id,display_order))',
      );
      await db.run(
        'INSERT INTO cvory_migrations VALUES (?,UTC_TIMESTAMP(6))',
        ['006_github_featured_projects'],
        connection,
      );
    }

    if (!versions.has('007_ai_resume_analysis')) {
      await connection.query(
        'CREATE TABLE IF NOT EXISTS ai_provider_configs(owner_id VARCHAR(36) NOT NULL,provider VARCHAR(20) NOT NULL,model_id VARCHAR(200) NOT NULL,key_ciphertext TEXT NOT NULL,key_iv CHAR(16) NOT NULL,key_tag CHAR(24) NOT NULL,key_suffix CHAR(4) NOT NULL,update_time DATETIME(6) NOT NULL,PRIMARY KEY(owner_id,provider))',
      );
      await connection.query(
        'CREATE TABLE IF NOT EXISTS ai_usage_records(id VARCHAR(36) PRIMARY KEY,owner_id VARCHAR(36) NOT NULL,request_id VARCHAR(36) NOT NULL,provider VARCHAR(20) NOT NULL,model_id VARCHAR(200) NOT NULL,operation VARCHAR(24) NOT NULL,prompt_version VARCHAR(40) NOT NULL,input_chars INT UNSIGNED NOT NULL,status VARCHAR(16) NOT NULL,input_tokens INT UNSIGNED NULL,output_tokens INT UNSIGNED NULL,provider_request_id VARCHAR(200) NULL,create_time DATETIME(6) NOT NULL,expire_time DATETIME(6) NOT NULL,UNIQUE KEY owner_request(owner_id,request_id),INDEX owner_create(owner_id,create_time),INDEX expire_time(expire_time),INDEX running_create(status,create_time))',
      );
      await connection.query(
        'CREATE TABLE IF NOT EXISTS ai_reports(id VARCHAR(36) PRIMARY KEY,owner_id VARCHAR(36) NOT NULL,cv_id VARCHAR(36) NOT NULL,cv_etag VARCHAR(64) NOT NULL,payload_ciphertext MEDIUMTEXT NOT NULL,payload_iv CHAR(16) NOT NULL,payload_tag CHAR(24) NOT NULL,status VARCHAR(16) NOT NULL,create_time DATETIME(6) NOT NULL,expire_time DATETIME(6) NOT NULL,INDEX owner_create(owner_id,create_time),INDEX expire_time(expire_time),INDEX running_create(status,create_time))',
      );
      await db.run(
        'INSERT INTO cvory_migrations VALUES (?,UTC_TIMESTAMP(6))',
        ['007_ai_resume_analysis'],
        connection,
      );
    }

    if (!versions.has('008_delivery_preparation')) {
      await connection.query(
        'CREATE TABLE IF NOT EXISTS delivery_preferences(owner_id VARCHAR(36) PRIMARY KEY,include_keywords JSON NOT NULL,exclude_keywords JSON NOT NULL,cities JSON NOT NULL,salary_min_k SMALLINT UNSIGNED NULL,salary_max_k SMALLINT UNSIGNED NULL,excluded_companies JSON NOT NULL,greeting_template VARCHAR(2000) NOT NULL,update_time DATETIME(6) NOT NULL)',
      );
      await connection.query(
        'CREATE TABLE IF NOT EXISTS delivery_jobs(id VARCHAR(36) PRIMARY KEY,owner_id VARCHAR(36) NOT NULL,title VARCHAR(200) NOT NULL,company VARCHAR(200) NOT NULL,city VARCHAR(120) NOT NULL,salary_min_k SMALLINT UNSIGNED NULL,salary_max_k SMALLINT UNSIGNED NULL,description MEDIUMTEXT NOT NULL,source_url VARCHAR(2048) NULL,create_time DATETIME(6) NOT NULL,INDEX owner_create(owner_id,create_time))',
      );
      await connection.query(
        'CREATE TABLE IF NOT EXISTS delivery_tasks(id VARCHAR(36) PRIMARY KEY,owner_id VARCHAR(36) NOT NULL,request_id VARCHAR(36) NOT NULL,request_fingerprint CHAR(64) NOT NULL,cv_id VARCHAR(36) NOT NULL,cv_etag VARCHAR(64) NOT NULL,cv_name VARCHAR(255) NOT NULL,cv_fingerprint CHAR(64) NOT NULL,cv_snapshot MEDIUMTEXT NOT NULL,task_snapshot MEDIUMTEXT NOT NULL,status VARCHAR(16) NOT NULL,create_time DATETIME(6) NOT NULL,simulation_time DATETIME(6) NULL,UNIQUE KEY owner_request(owner_id,request_id),INDEX owner_create(owner_id,create_time))',
      );
      await db.run(
        'INSERT INTO cvory_migrations VALUES (?,UTC_TIMESTAMP(6))',
        ['008_delivery_preparation'],
        connection,
      );
    }
  } finally {
    await connection.query("DO RELEASE_LOCK(CONCAT(DATABASE(), ':cvory-migrate'))");
    connection.release();
  }
}
