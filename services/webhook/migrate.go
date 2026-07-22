package main

import "database/sql"

func runMigrations(dsn string) error {
	db, err := sql.Open("mysql", dsn)
	if err != nil {
		return err
	}
	defer db.Close()

	schema := `
CREATE TABLE IF NOT EXISTS webhook_settings (
  id varchar(36) PRIMARY KEY,
  telegram_enabled tinyint(1) NOT NULL DEFAULT 0,
  telegram_target varchar(64) DEFAULT NULL,
  telegram_secret varchar(512) DEFAULT NULL,
  email_enabled tinyint(1) NOT NULL DEFAULT 0,
  email_target varchar(255) DEFAULT NULL,
  email_secret varchar(512) DEFAULT NULL,
  webhook_enabled tinyint(1) NOT NULL DEFAULT 0,
  webhook_url varchar(1024) DEFAULT NULL,
  webhook_secret varchar(512) DEFAULT NULL,
  updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by varchar(64) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS webhook_logs (
  id char(36) PRIMARY KEY,
  channel varchar(16) NOT NULL,
  target varchar(512) DEFAULT NULL,
  subject varchar(255) DEFAULT NULL,
  body text DEFAULT NULL,
  status varchar(16) NOT NULL DEFAULT 'queued',
  attempts int NOT NULL DEFAULT 0,
  error varchar(512) DEFAULT NULL,
  alert_id varchar(64) DEFAULT NULL,
  user_id varchar(64) DEFAULT NULL,
  created_at datetime DEFAULT CURRENT_TIMESTAMP,
  updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_channel_status (channel, status),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`

	_, err = db.Exec(schema)
	return err
}
