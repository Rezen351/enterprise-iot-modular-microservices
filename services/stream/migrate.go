package main

import (
	"log"
	"strings"

	"github.com/almuzky/iot/services/stream/internal/model"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
)

// =============================================================================
// SINGLE SOURCE OF TRUTH — stream_db schema
// GORM AutoMigrate is the only authority for table definitions.
// infra/mariadb/stream/init.sql only ensures the database exists.
// =============================================================================

func runMigrations(dsn string) error {
	db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{})
	if err != nil {
		return err
	}
	// AutoMigrate is idempotent in intent, but on some MariaDB/GORM
	// combinations it re-issues a bare CREATE TABLE that fails with
	// 1050 "Table already exists" when the schema is already present
	// (e.g. on a container restart). That is benign — treat it as
	// success rather than fatally killing the service.
	if err := db.AutoMigrate(&model.Stream{}, &model.Snapshot{}); err != nil {
		if isAlreadyExists(err) {
			log.Println("[migrate] stream_db schema already present (skipping)")
			return nil
		}
		return err
	}
	log.Println("[migrate] stream_db schema OK")
	return nil
}

// isAlreadyExists reports whether the error is a benign "table already
// exists" condition (MariaDB 1050 / "42S01").
func isAlreadyExists(err error) bool {
	if err == nil {
		return false
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "1050") ||
		strings.Contains(msg, "already exists") ||
		strings.Contains(msg, "42s01")
}
