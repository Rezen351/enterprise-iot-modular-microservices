package repository

import (
	"context"
	"testing"
	"time"

	"github.com/almuzky/iot/services/audit/internal/model"
	"github.com/almuzky/iot/services/audit/internal/testdriver"
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

func TestListScansRows(t *testing.T) {
	store, fake := newTestStore(t)
	now := time.Now()
	fake.CountValue = 1
	fake.SetSelectRows([]testdriver.Row{
		testdriver.NewRow([]string{"id", "event", "payload", "received_at"}, "u1", "auth.login", `{"user_id":"x"}`, now),
	})
	logs, total, err := store.List(context.Background(), "", "", time.Time{}, time.Time{}, 10, 0)
	if err != nil {
		t.Fatalf("List err: %v", err)
	}
	if total != 1 {
		t.Fatalf("expected total 1, got %d", total)
	}
	if len(logs) != 1 || logs[0].Event != "auth.login" {
		t.Fatalf("unexpected logs: %+v", logs)
	}
}

func TestListFiltersEventSearch(t *testing.T) {
	store, fake := newTestStore(t)
	now := time.Now()
	fake.CountValue = 1
	fake.SetSelectRows([]testdriver.Row{
		testdriver.NewRow([]string{"id", "event", "payload", "received_at"}, "u2", "auth.logout", `{"user_id":"y"}`, now),
	})
	logs, total, err := store.List(context.Background(), "auth.login", "x", time.Time{}, time.Time{}, 10, 0)
	if err != nil {
		t.Fatalf("List err: %v", err)
	}
	_ = logs
	_ = total
}

func TestInsertCreates(t *testing.T) {
	store, fake := newTestStore(t)
	err := store.Insert(context.Background(), &model.AuditLog{ID: "u1", Event: "x", Payload: "p"})
	if err != nil {
		t.Fatalf("Insert err: %v", err)
	}
	if fake.ExecCallCount() < 1 {
		t.Fatalf("expected exec call")
	}
}

func TestSeenMsgIDFalse(t *testing.T) {
	store, fake := newTestStore(t)
	fake.CountValue = 0
	seen, err := store.SeenMsgID(context.Background(), "abc", "audit.log")
	if err != nil {
		t.Fatalf("SeenMsgID err: %v", err)
	}
	if seen {
		t.Fatalf("expected not seen")
	}
}

func TestSeenMsgIDTrue(t *testing.T) {
	store, fake := newTestStore(t)
	fake.CountValue = 1
	seen, err := store.SeenMsgID(context.Background(), "abc", "audit.log")
	if err != nil {
		t.Fatalf("SeenMsgID err: %v", err)
	}
	if !seen {
		t.Fatalf("expected seen")
	}
}

func TestMarkMsgID(t *testing.T) {
	store, fake := newTestStore(t)
	if err := store.MarkMsgID(context.Background(), "abc", "audit.log"); err != nil {
		t.Fatalf("MarkMsgID err: %v", err)
	}
	if fake.ExecCallCount() < 1 {
		t.Fatalf("expected exec call")
	}
}
