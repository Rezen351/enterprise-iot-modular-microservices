package repository

import (
	"context"
	"testing"
	"time"

	"github.com/almuzky/iot/services/webhook/internal/model"
	"github.com/almuzky/iot/services/webhook/internal/testdriver"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
)

func newTestStore(t *testing.T) (*Store, *testdriver.FakeDB) {
	t.Helper()
	sqldb, fake := testdriver.Open()
	gdb, err := gorm.Open(mysql.New(mysql.Config{
		Conn:                      sqldb,
		SkipInitializeWithVersion: true,
	}), &gorm.Config{})
	if err != nil {
		t.Fatalf("gorm open: %v", err)
	}
	return New(gdb), fake
}

func TestGetSettingsReturnsExisting(t *testing.T) {
	store, fake := newTestStore(t)
	now := time.Now()
	fake.SetSelectRows([]testdriver.Row{
		testdriver.NewRow([]string{"id", "telegram_enabled", "telegram_target", "updated_at"}, "singleton", 1, "123456", now),
	})
	st, err := store.GetSettings(context.Background())
	if err != nil {
		t.Fatalf("GetSettings err: %v", err)
	}
	if st.ID != model.SettingsID || st.TelegramTarget != "123456" {
		t.Fatalf("unexpected settings: %+v", st)
	}
}

func TestUpsertSettingsPersists(t *testing.T) {
	store, fake := newTestStore(t)
	fake.RowsAff = 1
	err := store.UpsertSettings(context.Background(), &model.WebhookSetting{TelegramEnabled: true, TelegramTarget: "123456"})
	if err != nil {
		t.Fatalf("UpsertSettings err: %v", err)
	}
	if fake.ExecCallCount() < 1 {
		t.Fatalf("expected exec call for upsert")
	}
}

func TestCreateLog(t *testing.T) {
	store, fake := newTestStore(t)
	fake.RowsAff = 1
	l := &model.WebhookLog{ID: "lid-1", Channel: "telegram", Status: "queued"}
	if err := store.CreateLog(context.Background(), l); err != nil {
		t.Fatalf("CreateLog err: %v", err)
	}
	if fake.ExecCallCount() < 1 {
		t.Fatalf("expected exec call for create log")
	}
}

func TestUpdateLog(t *testing.T) {
	store, fake := newTestStore(t)
	fake.RowsAff = 1
	err := store.UpdateLog(context.Background(), "lid-1", 1, "sent", "")
	if err != nil {
		t.Fatalf("UpdateLog err: %v", err)
	}
	if fake.ExecCallCount() < 1 {
		t.Fatalf("expected exec call for update log")
	}
}

func TestListLogsDefault(t *testing.T) {
	store, fake := newTestStore(t)
	now := time.Now()
	fake.CountValue = 2
	fake.SetSelectRows([]testdriver.Row{
		testdriver.NewRow([]string{"id", "channel", "status", "created_at"}, "lid-1", "email", "sent", now),
		testdriver.NewRow([]string{"id", "channel", "status", "created_at"}, "lid-2", "telegram", "queued", now),
	})
	logs, total, err := store.ListLogs(context.Background(), LogFilter{}, 50, 0)
	if err != nil {
		t.Fatalf("ListLogs err: %v", err)
	}
	if total != 2 {
		t.Fatalf("expected total 2, got %d", total)
	}
	if len(logs) != 2 {
		t.Fatalf("expected 2 logs, got %d", len(logs))
	}
}

func TestListLogsFilterChannel(t *testing.T) {
	store, fake := newTestStore(t)
	now := time.Now()
	fake.CountValue = 1
	fake.SetSelectRows([]testdriver.Row{
		testdriver.NewRow([]string{"id", "channel", "status", "created_at"}, "lid-1", "email", "sent", now),
	})
	_, total, err := store.ListLogs(context.Background(), LogFilter{Channel: "email"}, 50, 0)
	if err != nil {
		t.Fatalf("ListLogs err: %v", err)
	}
	if total != 1 {
		t.Fatalf("expected total 1, got %d", total)
	}
}
