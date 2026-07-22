package model

import "time"

const SettingsID = "singleton"

type WebhookSetting struct {
	ID              string    `gorm:"column:id;type:varchar(36);primaryKey"`
	TelegramEnabled bool      `gorm:"column:telegram_enabled;not null;default:false"`
	TelegramTarget  string    `gorm:"column:telegram_target;type:varchar(64)"`
	TelegramSecret  string    `gorm:"column:telegram_secret;type:varchar(512)"`
	EmailEnabled    bool      `gorm:"column:email_enabled;not null;default:false"`
	EmailTarget     string    `gorm:"column:email_target;type:varchar(255)"`
	EmailSecret     string    `gorm:"column:email_secret;type:varchar(512)"`
	WebhookEnabled  bool      `gorm:"column:webhook_enabled;not null;default:false"`
	WebhookURL      string    `gorm:"column:webhook_url;type:varchar(1024)"`
	WebhookSecret   string    `gorm:"column:webhook_secret;type:varchar(512)"`
	UpdatedAt       time.Time `gorm:"column:updated_at;autoUpdateTime"`
	UpdatedBy       string    `gorm:"column:updated_by;type:varchar(64)"`
}

func (WebhookSetting) TableName() string { return "webhook_settings" }

type ChannelSettings struct {
	Enabled bool   `json:"enabled"`
	Target  string `json:"target"`
}

type ChannelInput struct {
	Enabled bool   `json:"enabled"`
	Target  string `json:"target"`
	Secret  string `json:"secret"`
}

type SettingsPatch struct {
	Telegram ChannelInput `json:"telegram"`
	Email    ChannelInput `json:"email"`
	Webhook  ChannelInput `json:"webhook"`
}

type SettingsDTO struct {
	Telegram ChannelSettings `json:"telegram"`
	Email    ChannelSettings `json:"email"`
	Webhook  ChannelSettings `json:"webhook"`
}

type WebhookLog struct {
	ID        string    `gorm:"column:id;type:char(36);primaryKey"`
	Channel   string    `gorm:"column:channel;type:varchar(16);not null;index"`
	Target    string    `gorm:"column:target;type:varchar(512)"`
	Subject   string    `gorm:"column:subject;type:varchar(255)"`
	Body      string    `gorm:"column:body;type:text"`
	Status    string    `gorm:"column:status;type:varchar(16);not null;default:queued"`
	Attempts  int       `gorm:"column:attempts;not null;default:0"`
	Error     string    `gorm:"column:error;type:varchar(512)"`
	AlertID   string    `gorm:"column:alert_id;type:varchar(64)"`
	UserID    string    `gorm:"column:user_id;type:varchar(64)"`
	CreatedAt time.Time `gorm:"column:created_at;autoCreateTime"`
	UpdatedAt time.Time `gorm:"column:updated_at;autoUpdateTime"`
}

func (WebhookLog) TableName() string { return "webhook_logs" }

type LogDTO struct {
	ID        string    `json:"id"`
	Channel   string    `json:"channel"`
	Target    string    `json:"target"`
	Subject   string    `json:"subject"`
	Body      string    `json:"body"`
	Status    string    `json:"status"`
	Attempts  int       `json:"attempts"`
	Error     string    `json:"error"`
	AlertID   string    `json:"alert_id"`
	UserID    string    `json:"user_id"`
	CreatedAt time.Time `json:"created_at"`
}

func ToLogDTO(l WebhookLog) LogDTO {
	return LogDTO{
		ID:        l.ID,
		Channel:   l.Channel,
		Target:    l.Target,
		Subject:   l.Subject,
		Body:      l.Body,
		Status:    l.Status,
		Attempts:  l.Attempts,
		Error:     l.Error,
		AlertID:   l.AlertID,
		UserID:    l.UserID,
		CreatedAt: l.CreatedAt,
	}
}
