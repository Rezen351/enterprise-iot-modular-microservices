package main

import (
	"log"

	"github.com/almuzky/iot/services/webhook/internal/model"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
)

// =============================================================================
// SINGLE SOURCE OF TRUTH — webhook_db schema
// GORM AutoMigrate is the only authority for table definitions.
// infra/mariadb/webhook/init.sql is intentionally grant-only.
// =============================================================================

func runMigrations(dsn string) error {
	db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{})
	if err != nil {
		return err
	}
	if err := db.AutoMigrate(&model.WebhookSetting{}, &model.WebhookLog{}); err != nil {
		return err
	}
	log.Println("[migrate] webhook_db schema OK")
	return nil
}
