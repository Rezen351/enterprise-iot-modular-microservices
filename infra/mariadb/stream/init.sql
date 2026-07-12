-- stream_db seed data is managed entirely by the Go stream service (migrate.go).
-- GORM AutoMigrate is the single source of truth for the `streams` table DDL.
-- This file only ensures the database exists so the DSN connection succeeds
-- before the Stream Service runs its migration. Do NOT add DDL/DML here.
CREATE DATABASE IF NOT EXISTS stream_db;
USE stream_db;
