package main

import (
	"log"

	"github.com/almuzky/iot/services/alert/internal/model"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
)

// =============================================================================
// SINGLE SOURCE OF TRUTH — alert_db schema
// GORM AutoMigrate is the only authority for table definitions.
// infra/mariadb/alert/init.sql is intentionally grant-only.
// =============================================================================

func runMigrations(dsn string) error {
	db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{})
	if err != nil {
		return err
	}
	if err := db.AutoMigrate(&model.Threshold{}, &model.Alert{}); err != nil {
		return err
	}
	log.Println("[migrate] alert_db schema OK")
	return nil
}
