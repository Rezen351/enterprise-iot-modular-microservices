package main

import (
	"log"
	"time"

	"gorm.io/driver/mysql"
	"gorm.io/gorm"
)

// =============================================================================
// SINGLE SOURCE OF TRUTH — control_db schema
// GORM AutoMigrate is the only authority for table definitions.
// infra/mariadb/control/init.sql is intentionally empty.
// =============================================================================

type gormControlMode struct {
	NodeID           string    `gorm:"column:node_id;type:varchar(100);not null;primaryKey"`
	OutputName       string    `gorm:"column:output_name;type:varchar(100);not null;primaryKey"`
	Mode             string    `gorm:"column:mode;type:varchar(8);not null;default:MANUAL"`
	PrevMode         *string   `gorm:"column:prev_mode;type:varchar(8)"`
	ActiveScheduleID *string   `gorm:"column:active_schedule_id;type:char(36)"`
	UpdatedAt        time.Time `gorm:"column:updated_at;autoUpdateTime"`
}

func (gormControlMode) TableName() string { return "control_modes" }

type gormSchedule struct {
	ID         string     `gorm:"column:id;type:char(36);primaryKey"`
	NodeID     string     `gorm:"column:node_id;type:varchar(100);not null;index"`
	OutputName string     `gorm:"column:output_name;type:varchar(100);not null"`
	TagName    string     `gorm:"column:tag_name;type:varchar(128)"`
	Type       string     `gorm:"column:type;type:varchar(16);not null"`
	Params     string     `gorm:"column:params;type:longtext"`
	Enabled    bool       `gorm:"column:enabled;not null;default:0"`
	NextRunAt  *time.Time `gorm:"column:next_run_at"`
	CreatedAt  time.Time  `gorm:"column:created_at;autoCreateTime"`
	UpdatedAt  time.Time  `gorm:"column:updated_at;autoUpdateTime"`
}

func (gormSchedule) TableName() string { return "schedules" }

type gormCommand struct {
	ID          string     `gorm:"column:id;type:char(36);primaryKey"`
	ReqID       string     `gorm:"column:req_id;type:varchar(64);index"`
	NodeID      string     `gorm:"column:node_id;type:varchar(100);not null;index"`
	Target      string     `gorm:"column:target;type:varchar(100)"`
	TagName     string     `gorm:"column:tag_name;type:varchar(128)"`
	ControlType string     `gorm:"column:control_type;type:varchar(24)"`
	Value       int        `gorm:"column:value;not null;default:0"`
	Source      string     `gorm:"column:source;type:varchar(16);not null;default:manual"`
	ScheduleID  *string    `gorm:"column:schedule_id;type:char(36)"`
	Status      string     `gorm:"column:status;type:varchar(16);not null;default:pending;index"`
	IssuedBy    string     `gorm:"column:issued_by;type:varchar(64)"`
	CreatedAt   time.Time  `gorm:"column:created_at;autoCreateTime;index"`
	AckedAt     *time.Time `gorm:"column:acked_at"`
}

func (gormCommand) TableName() string { return "commands" }

func runMigrations(dsn string) error {
	db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{})
	if err != nil {
		return err
	}
	if err := db.AutoMigrate(
		&gormControlMode{},
		&gormSchedule{},
		&gormCommand{},
	); err != nil {
		return err
	}
	log.Println("[migrate] control_db schema OK")
	return nil
}
