-- alert_db schema & data are managed entirely by the Go alert service (AutoMigrate).
-- Do NOT add DDL (CREATE TABLE) or DML (INSERT) here.
-- This file exists only so the Docker volume mount does not fail.

-- mysqld-exporter requires PROCESS + SLAVE MONITOR to scrape engine/perf schema.
GRANT PROCESS, SLAVE MONITOR ON *.* TO 'app'@'%';
FLUSH PRIVILEGES;
