package main

import (
	"log"

	"github.com/almuzky/iot/services/dlq/internal/model"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
)

// runMigrations is the single source of truth for the dlq_messages schema.
// It lives inside the audit database (mariadb-audit) — see ADR-006 for the
// rationale (DLQ is an audit/observability artifact, not a new domain DB).
func runMigrations(dsn string) error {
	db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{})
	if err != nil {
		return err
	}
	if err := db.AutoMigrate(&model.DLQMessage{}); err != nil {
		return err
	}
	log.Println("[migrate] dlq_messages schema OK")
	return nil
}
