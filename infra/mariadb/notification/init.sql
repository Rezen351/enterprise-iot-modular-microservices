-- notification_db schema & data are managed by the Go service (AutoMigrate).
-- This file exists only so the Docker volume mount does not fail.

-- mysqld-exporter requires PROCESS + SLAVE MONITOR to scrape engine/perf schema.
GRANT PROCESS, SLAVE MONITOR ON *.* TO 'app'@'%';
FLUSH PRIVILEGES;
