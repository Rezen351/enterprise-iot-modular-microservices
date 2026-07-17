package main

import (
	"log"

	"github.com/almuzky/iot/services/audit/internal/model"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
)

// =============================================================================
// SINGLE SOURCE OF TRUTH — audit_db schema
// GORM AutoMigrate is the only authority for table definitions.
// infra/mariadb/audit/init.sql is intentionally empty.
// =============================================================================

func runMigrations(dsn string) error {
	db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{})
	if err != nil {
		return err
	}
	if err := db.AutoMigrate(&model.AuditLog{}, &model.ProcessedMsg{}); err != nil {
		return err
	}
	log.Println("[migrate] audit_db schema OK")
	return nil
}
