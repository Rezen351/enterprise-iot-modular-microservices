package main

import (
	"log"
	"time"

	"gorm.io/driver/mysql"
	"gorm.io/gorm"
)

// =============================================================================
// SINGLE SOURCE OF TRUTH — module_db schema
// GORM AutoMigrate is the only authority for table definitions.
// infra/mariadb/module/init.sql is intentionally empty.
// =============================================================================

type gormModule struct {
	ID          string    `gorm:"column:id;type:char(36);primaryKey"`
	Name        string    `gorm:"column:name;type:varchar(100);uniqueIndex;not null"`
	Description string    `gorm:"column:description;type:varchar(255)"`
	Config      string    `gorm:"column:config;type:longtext"`
	CreatedAt   time.Time `gorm:"column:created_at;autoCreateTime"`
	UpdatedAt   time.Time `gorm:"column:updated_at;autoUpdateTime"`
}

func (gormModule) TableName() string { return "modules" }

type gormNode struct {
	ID           string     `gorm:"column:id;type:char(36);primaryKey"`
	NodeID       string     `gorm:"column:node_id;type:varchar(100);uniqueIndex;not null"`
	ModuleID     *string    `gorm:"column:module_id;type:char(36);index"`
	Name         string     `gorm:"column:name;type:varchar(100)"`
	MAC          string     `gorm:"column:mac;type:varchar(32)"`
	IP           string     `gorm:"column:ip;type:varchar(45)"`
	FWVersion    string     `gorm:"column:fw_version;type:varchar(32)"`
	Status       string     `gorm:"column:status;type:varchar(16);not null;default:unknown"`
	Paired       bool       `gorm:"column:paired;not null;default:0"`
	LastSeenAt   *time.Time `gorm:"column:last_seen_at"`
	DiscoveredAt time.Time  `gorm:"column:discovered_at;autoCreateTime"`
	CreatedAt    time.Time  `gorm:"column:created_at;autoCreateTime"`
	UpdatedAt    time.Time  `gorm:"column:updated_at;autoUpdateTime"`
}

func (gormNode) TableName() string { return "nodes" }

type gormNodeTag struct {
	ID          string    `gorm:"column:id;type:char(36);primaryKey"`
	NodeID      string    `gorm:"column:node_id;type:varchar(64);not null;uniqueIndex:uq_node_source"`
	SourceKey   string    `gorm:"column:source_key;type:varchar(128);not null;uniqueIndex:uq_node_source"`
	TagName     string    `gorm:"column:tag_name;type:varchar(128);not null"`
	DisplayName string    `gorm:"column:display_name;type:varchar(128)"`
	Unit        string    `gorm:"column:unit;type:varchar(32)"`
	DataType    string    `gorm:"column:data_type;type:varchar(16);default:float"`
	Enabled     bool      `gorm:"column:enabled;not null;default:true"`
	CreatedAt   time.Time `gorm:"column:created_at;autoCreateTime"`
	UpdatedAt   time.Time `gorm:"column:updated_at;autoUpdateTime"`
}

func (gormNodeTag) TableName() string { return "node_tags" }

func runMigrations(dsn string) error {
	db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{})
	if err != nil {
		return err
	}
	if err := db.AutoMigrate(&gormModule{}, &gormNode{}, &gormNodeTag{}); err != nil {
		return err
	}
	log.Println("[migrate] module_db schema OK")
	return nil
}
