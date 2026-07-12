package main

import (
	"log"

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
	if err := db.AutoMigrate(&model.Stream{}, &model.Snapshot{}); err != nil {
		return err
	}
	log.Println("[migrate] stream_db schema OK")
	return nil
}
