/* CVory's complete MySQL schema. Keep all application DDL in this file.
   Apply with `pnpm db:schema` and startup never executes schema changes. */

CREATE TABLE IF NOT EXISTS account_action_tokens (
  id VARCHAR(36) NOT NULL,
  owner_id VARCHAR(36) NOT NULL,
  purpose VARCHAR(24) NOT NULL,
  target_email VARCHAR(254) NOT NULL,
  token_hash VARCHAR(64) NOT NULL,
  created_at DATETIME NOT NULL,
  expires_at DATETIME NOT NULL,
  consumed_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_account_action_tokens_hash (token_hash),
  KEY ix_account_action_tokens_expires_at (expires_at),
  KEY ix_account_action_tokens_owner_id (owner_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS account_deletion_jobs (
  id VARCHAR(36) NOT NULL,
  owner_id VARCHAR(36) NOT NULL,
  status VARCHAR(16) NOT NULL,
  attempts INT NOT NULL,
  next_attempt_at DATETIME NOT NULL,
  lease_until DATETIME NULL,
  created_at DATETIME NOT NULL,
  completed_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_account_deletion_jobs_owner (owner_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS account_mail_jobs (
  id VARCHAR(36) NOT NULL,
  owner_id VARCHAR(36) NOT NULL,
  action_token_id VARCHAR(36) NULL,
  status VARCHAR(16) NOT NULL,
  attempts INT NOT NULL,
  encrypted_payload BLOB NULL,
  created_at DATETIME NOT NULL,
  expires_at DATETIME NOT NULL,
  next_attempt_at DATETIME NULL,
  lease_until DATETIME NULL,
  PRIMARY KEY (id),
  KEY ix_account_mail_jobs_owner_id (owner_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS account_mail_limits (
  `key` VARCHAR(64) NOT NULL,
  count INT NOT NULL,
  expires_at DATETIME NOT NULL,
  PRIMARY KEY (`key`),
  KEY ix_account_mail_limits_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS account_sessions (
  token_hash VARCHAR(64) NOT NULL,
  owner_id VARCHAR(36) NOT NULL,
  expires_at DATETIME NOT NULL,
  PRIMARY KEY (token_hash),
  KEY ix_account_sessions_owner_id (owner_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS accounts (
  id VARCHAR(36) NOT NULL,
  email VARCHAR(254) NULL,
  password_hash VARCHAR(256) NULL,
  display_name VARCHAR(80) NOT NULL,
  avatar MEDIUMTEXT NULL,
  public_id VARCHAR(36) NOT NULL,
  email_verified_at DATETIME NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'active',
  delete_requested_at DATETIME NULL,
  purge_after DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_accounts_email (email),
  UNIQUE KEY uq_accounts_public_id (public_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS cvs (
  id VARCHAR(36) NOT NULL,
  owner_id VARCHAR(36) NOT NULL DEFAULT 'legacy',
  display_name VARCHAR(255) NOT NULL,
  etag VARCHAR(64) NOT NULL,
  profile JSON NOT NULL,
  sections JSON NOT NULL,
  style_settings JSON NOT NULL,
  create_time DATETIME NOT NULL,
  update_time DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY ix_cvs_owner_id (owner_id),
  KEY ix_cvs_id (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS publication_reviews (
  id VARCHAR(36) NOT NULL,
  owner_id VARCHAR(36) NOT NULL,
  source_id VARCHAR(36) NOT NULL,
  source_name VARCHAR(255) NOT NULL,
  document JSON NOT NULL,
  expires_at DATETIME NOT NULL,
  source_etag VARCHAR(64) NULL,
  base_version BIGINT UNSIGNED NULL,
  PRIMARY KEY (id),
  KEY ix_publication_reviews_owner_id (owner_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS publications (
  owner_id VARCHAR(36) NOT NULL,
  source_id VARCHAR(36) NOT NULL,
  source_name VARCHAR(255) NOT NULL,
  document JSON NOT NULL,
  update_time DATETIME NOT NULL,
  PRIMARY KEY (owner_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS style_presets (
  id VARCHAR(36) NOT NULL,
  owner_id VARCHAR(36) NOT NULL,
  display_name VARCHAR(80) NOT NULL,
  settings JSON NOT NULL,
  PRIMARY KEY (id),
  KEY ix_style_presets_owner_id (owner_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS account_identities (
  provider VARCHAR(20) NOT NULL,
  provider_user_id VARCHAR(40) NOT NULL,
  owner_id VARCHAR(36) NOT NULL,
  login VARCHAR(100) NOT NULL,
  PRIMARY KEY (provider, provider_user_id),
  UNIQUE KEY uq_account_identities_owner_provider (owner_id, provider)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS oauth_challenges (
  state_hash CHAR(64) NOT NULL,
  browser_hash CHAR(64) NOT NULL,
  verifier VARCHAR(128) NOT NULL,
  return_path VARCHAR(2048) NOT NULL,
  owner_id VARCHAR(36) NULL,
  session_hash CHAR(64) NULL,
  expires_at DATETIME(6) NOT NULL,
  PRIMARY KEY (state_hash),
  KEY ix_oauth_challenges_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS nest_auth_attempts (
  `key` CHAR(64) NOT NULL,
  count INT NOT NULL,
  expires_at DATETIME(6) NOT NULL,
  PRIMARY KEY (`key`),
  KEY ix_nest_auth_attempts_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS cv_revisions (
  id VARCHAR(36) NOT NULL,
  cv_id VARCHAR(36) NOT NULL,
  owner_id VARCHAR(36) NOT NULL,
  etag VARCHAR(64) NOT NULL,
  snapshot JSON NOT NULL,
  created_at DATETIME(6) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_cv_revisions_cv_etag (cv_id, etag),
  KEY ix_cv_revisions_owner_cv (owner_id, cv_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS publication_heads (
  owner_id VARCHAR(36) NOT NULL,
  revision BIGINT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (owner_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS github_featured_projects (
  owner_id VARCHAR(36) NOT NULL,
  repository_id VARCHAR(20) NOT NULL,
  repository JSON NOT NULL,
  contribution VARCHAR(2000) NOT NULL,
  display_order TINYINT UNSIGNED NOT NULL,
  update_time DATETIME(6) NOT NULL,
  PRIMARY KEY (owner_id, repository_id),
  KEY ix_github_featured_projects_owner_order (owner_id, display_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ai_provider_configs (
  owner_id VARCHAR(36) NOT NULL,
  provider VARCHAR(20) NOT NULL,
  model_id VARCHAR(200) NOT NULL,
  key_ciphertext TEXT NOT NULL,
  key_iv CHAR(16) NOT NULL,
  key_tag CHAR(24) NOT NULL,
  key_suffix CHAR(4) NOT NULL,
  update_time DATETIME(6) NOT NULL,
  PRIMARY KEY (owner_id, provider)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ai_usage_records (
  id VARCHAR(36) NOT NULL,
  owner_id VARCHAR(36) NOT NULL,
  request_id VARCHAR(36) NOT NULL,
  provider VARCHAR(20) NOT NULL,
  model_id VARCHAR(200) NOT NULL,
  operation VARCHAR(24) NOT NULL,
  prompt_version VARCHAR(40) NOT NULL,
  input_chars INT UNSIGNED NOT NULL,
  status VARCHAR(16) NOT NULL,
  input_tokens INT UNSIGNED NULL,
  output_tokens INT UNSIGNED NULL,
  provider_request_id VARCHAR(200) NULL,
  create_time DATETIME(6) NOT NULL,
  expire_time DATETIME(6) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ai_usage_owner_request (owner_id, request_id),
  KEY ix_ai_usage_owner_create (owner_id, create_time),
  KEY ix_ai_usage_expire_time (expire_time),
  KEY ix_ai_usage_running_create (status, create_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ai_reports (
  id VARCHAR(36) NOT NULL,
  owner_id VARCHAR(36) NOT NULL,
  cv_id VARCHAR(36) NOT NULL,
  cv_etag VARCHAR(64) NOT NULL,
  payload_ciphertext MEDIUMTEXT NOT NULL,
  payload_iv CHAR(16) NOT NULL,
  payload_tag CHAR(24) NOT NULL,
  status VARCHAR(16) NOT NULL,
  create_time DATETIME(6) NOT NULL,
  expire_time DATETIME(6) NOT NULL,
  PRIMARY KEY (id),
  KEY ix_ai_reports_owner_create (owner_id, create_time),
  KEY ix_ai_reports_expire_time (expire_time),
  KEY ix_ai_reports_running_create (status, create_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS delivery_preferences (
  owner_id VARCHAR(36) NOT NULL,
  include_keywords JSON NOT NULL,
  exclude_keywords JSON NOT NULL,
  cities JSON NOT NULL,
  salary_min_k SMALLINT UNSIGNED NULL,
  salary_max_k SMALLINT UNSIGNED NULL,
  excluded_companies JSON NOT NULL,
  greeting_template VARCHAR(2000) NOT NULL,
  update_time DATETIME(6) NOT NULL,
  PRIMARY KEY (owner_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS delivery_jobs (
  id VARCHAR(36) NOT NULL,
  owner_id VARCHAR(36) NOT NULL,
  title VARCHAR(200) NOT NULL,
  company VARCHAR(200) NOT NULL,
  city VARCHAR(120) NOT NULL,
  salary_min_k SMALLINT UNSIGNED NULL,
  salary_max_k SMALLINT UNSIGNED NULL,
  description MEDIUMTEXT NOT NULL,
  source_url VARCHAR(2048) NULL,
  create_time DATETIME(6) NOT NULL,
  PRIMARY KEY (id),
  KEY ix_delivery_jobs_owner_create (owner_id, create_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS delivery_tasks (
  id VARCHAR(36) NOT NULL,
  owner_id VARCHAR(36) NOT NULL,
  request_id VARCHAR(36) NOT NULL,
  request_fingerprint CHAR(64) NOT NULL,
  cv_id VARCHAR(36) NOT NULL,
  cv_etag VARCHAR(64) NOT NULL,
  cv_name VARCHAR(255) NOT NULL,
  cv_fingerprint CHAR(64) NOT NULL,
  cv_snapshot MEDIUMTEXT NOT NULL,
  task_snapshot MEDIUMTEXT NOT NULL,
  status VARCHAR(16) NOT NULL,
  create_time DATETIME(6) NOT NULL,
  simulation_time DATETIME(6) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_delivery_tasks_owner_request (owner_id, request_id),
  KEY ix_delivery_tasks_owner_create (owner_id, create_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Compatible additive changes for databases created by the previous application.
ALTER TABLE cvs ADD COLUMN owner_id VARCHAR(36) NOT NULL DEFAULT 'legacy';
ALTER TABLE accounts ADD COLUMN email_verified_at DATETIME NULL;
ALTER TABLE accounts ADD COLUMN status VARCHAR(16) NOT NULL DEFAULT 'active';
ALTER TABLE accounts ADD COLUMN delete_requested_at DATETIME NULL;
ALTER TABLE accounts ADD COLUMN purge_after DATETIME NULL;
ALTER TABLE accounts MODIFY COLUMN email VARCHAR(254) NULL;
ALTER TABLE accounts MODIFY COLUMN password_hash VARCHAR(256) NULL;
ALTER TABLE accounts MODIFY COLUMN avatar MEDIUMTEXT NULL;
ALTER TABLE publication_reviews ADD COLUMN source_etag VARCHAR(64) NULL;
ALTER TABLE publication_reviews ADD COLUMN base_version BIGINT UNSIGNED NULL;
