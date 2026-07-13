-- ml_db (vision) schema is managed by the Python service at startup
-- (app.database.init_db -> CREATE TABLE IF NOT EXISTS). This file only
-- ensures the database exists so the SQLAlchemy DSN connection succeeds
-- before the Vision Service runs its migration. Do NOT add DDL/DML here.
CREATE DATABASE IF NOT EXISTS ml_db;
USE ml_db;

-- mysqld-exporter requires PROCESS + SLAVE MONITOR to scrape engine/perf schema.
GRANT PROCESS, SLAVE MONITOR ON *.* TO 'app'@'%';
FLUSH PRIVILEGES;
