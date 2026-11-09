
CREATE TABLE IF NOT EXISTS account_action_tokens (
	id VARCHAR(36) NOT NULL,
	owner_id VARCHAR(36) NOT NULL,
	purpose VARCHAR(24) NOT NULL,
	target_email VARCHAR(254) NOT NULL,
	token_hash VARCHAR(64) NOT NULL,
	created_at DATETIME NOT NULL,
	expires_at DATETIME NOT NULL,
	consumed_at DATETIME,
	PRIMARY KEY (id),
	UNIQUE (token_hash)
)

;
CREATE INDEX ix_account_action_tokens_expires_at ON account_action_tokens (expires_at);
CREATE INDEX ix_account_action_tokens_owner_id ON account_action_tokens (owner_id);

CREATE TABLE IF NOT EXISTS account_deletion_jobs (
	id VARCHAR(36) NOT NULL,
	owner_id VARCHAR(36) NOT NULL,
	status VARCHAR(16) NOT NULL,
	attempts INTEGER NOT NULL,
	next_attempt_at DATETIME NOT NULL,
	lease_until DATETIME,
	created_at DATETIME NOT NULL,
	completed_at DATETIME,
	PRIMARY KEY (id),
	UNIQUE (owner_id)
)

;

CREATE TABLE IF NOT EXISTS account_mail_jobs (
	id VARCHAR(36) NOT NULL,
	owner_id VARCHAR(36) NOT NULL,
	action_token_id VARCHAR(36),
	status VARCHAR(16) NOT NULL,
	attempts INTEGER NOT NULL,
	encrypted_payload BLOB,
	created_at DATETIME NOT NULL,
	expires_at DATETIME NOT NULL,
	next_attempt_at DATETIME,
	lease_until DATETIME,
	PRIMARY KEY (id)
)

;
CREATE INDEX ix_account_mail_jobs_owner_id ON account_mail_jobs (owner_id);

CREATE TABLE IF NOT EXISTS account_mail_limits (
	`key` VARCHAR(64) NOT NULL,
	count INTEGER NOT NULL,
	expires_at DATETIME NOT NULL,
	PRIMARY KEY (`key`)
)

;
CREATE INDEX ix_account_mail_limits_expires_at ON account_mail_limits (expires_at);

CREATE TABLE IF NOT EXISTS account_sessions (
	token_hash VARCHAR(64) NOT NULL,
	owner_id VARCHAR(36) NOT NULL,
	expires_at DATETIME NOT NULL,
	PRIMARY KEY (token_hash)
)

;
CREATE INDEX ix_account_sessions_owner_id ON account_sessions (owner_id);

CREATE TABLE IF NOT EXISTS accounts (
	id VARCHAR(36) NOT NULL,
	email VARCHAR(254) NOT NULL,
	password_hash VARCHAR(256) NOT NULL,
	display_name VARCHAR(80) NOT NULL,
	avatar TEXT,
	public_id VARCHAR(36) NOT NULL,
	email_verified_at DATETIME,
	status VARCHAR(16) NOT NULL DEFAULT 'active',
	delete_requested_at DATETIME,
	purge_after DATETIME,
	PRIMARY KEY (id),
	UNIQUE (email),
	UNIQUE (public_id)
)

;

CREATE TABLE IF NOT EXISTS cvs (
	id VARCHAR(36) NOT NULL,
	owner_id VARCHAR(36) NOT NULL,
	display_name VARCHAR(255) NOT NULL,
	etag VARCHAR(64) NOT NULL,
	profile JSON NOT NULL,
	sections JSON NOT NULL,
	style_settings JSON NOT NULL,
	create_time DATETIME NOT NULL,
	update_time DATETIME NOT NULL,
	PRIMARY KEY (id)
)

;
CREATE INDEX ix_cvs_owner_id ON cvs (owner_id);
CREATE INDEX ix_cvs_id ON cvs (id);

CREATE TABLE IF NOT EXISTS publication_reviews (
	id VARCHAR(36) NOT NULL,
	owner_id VARCHAR(36) NOT NULL,
	source_id VARCHAR(36) NOT NULL,
	source_name VARCHAR(255) NOT NULL,
	document JSON NOT NULL,
	expires_at DATETIME NOT NULL,
	PRIMARY KEY (id)
)

;
CREATE INDEX ix_publication_reviews_owner_id ON publication_reviews (owner_id);

CREATE TABLE IF NOT EXISTS publications (
	owner_id VARCHAR(36) NOT NULL,
	source_id VARCHAR(36) NOT NULL,
	source_name VARCHAR(255) NOT NULL,
	document JSON NOT NULL,
	update_time DATETIME NOT NULL,
	PRIMARY KEY (owner_id)
)

;

CREATE TABLE IF NOT EXISTS style_presets (
	id VARCHAR(36) NOT NULL,
	owner_id VARCHAR(36) NOT NULL,
	display_name VARCHAR(80) NOT NULL,
	settings JSON NOT NULL,
	PRIMARY KEY (id)
)

;
CREATE INDEX ix_style_presets_owner_id ON style_presets (owner_id);
