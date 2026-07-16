package main

import (
	"log"

	"github.com/almuzky/iot/services/notification/internal/model"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// =============================================================================
// SINGLE SOURCE OF TRUTH — notification_db schema
// GORM AutoMigrate is the only authority for table definitions.
// infra/mariadb/notification/init.sql is intentionally grant-only.
// =============================================================================

func runMigrations(dsn string) error {
	db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Warn),
	})
	if err != nil {
		return err
	}
	if err := db.AutoMigrate(&model.NotificationSetting{}, &model.NotificationLog{}); err != nil {
		return err
	}
	log.Println("[migrate] notification_db schema OK")
	return nil
}
