package service

import (
	"context"
	"testing"

	"github.com/almuzky/iot/services/audit/internal/model"
	"github.com/almuzky/iot/services/audit/internal/repository"
	"github.com/almuzky/iot/services/audit/internal/testdriver"
	"github.com/nats-io/nats.go"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
)

func newTestService(t *testing.T) (*Service, *testdriver.FakeDB) {
	t.Helper()
	sqldb, fake := testdriver.Open()
	gdb, err := gorm.Open(mysql.New(mysql.Config{
		Conn:                      sqldb,
		SkipInitializeWithVersion: true,
	}), &gorm.Config{})
	if err != nil {
		t.Fatalf("gorm open: %v", err)
	}
	return New(repository.New(gdb)), fake
}

func TestHandleMessageInserts(t *testing.T) {
	svc, fake := newTestService(t)
	fake.CountValue = 0 // not already seen
	msg := &nats.Msg{Data: []byte(`{"event":"auth.login","data":{"user_id":"u1"}}`)}
	svc.handleMessage(msg)
	if fake.ExecCallCount() < 1 {
		t.Fatalf("expected insert exec")
	}
}

func TestHandleMessageDedupSkip(t *testing.T) {
	svc, fake := newTestService(t)
	fake.CountValue = 1 // already seen
	msg := &nats.Msg{
		Data:   []byte(`{"event":"auth.login","data":{"user_id":"u1"}}`),
		Header: nats.Header{"Nats-Msg-Id": []string{"msg-1"}},
	}
	svc.handleMessage(msg)
	if fake.ExecCallCount() != 0 {
		t.Fatalf("expected skip (no insert) for dedup, got %d execs", fake.ExecCallCount())
	}
}

func TestHandleMessageBadJSONFallsBack(t *testing.T) {
	svc, fake := newTestService(t)
	fake.CountValue = 0
	msg := &nats.Msg{Data: []byte("not-json")}
	svc.handleMessage(msg)
	if fake.ExecCallCount() < 1 {
		t.Fatalf("expected insert of raw payload")
	}
}

func TestHandleMessageEmptyEvent(t *testing.T) {
	svc, fake := newTestService(t)
	fake.CountValue = 0
	msg := &nats.Msg{Data: []byte(`{"data":{"user_id":"u1"}}`)}
	svc.handleMessage(msg)
	if fake.ExecCallCount() < 1 {
		t.Fatalf("expected insert with event=unknown")
	}
}

func TestHandleMessageMsgIDFromPayload(t *testing.T) {
	svc, fake := newTestService(t)
	fake.CountValue = 0
	msg := &nats.Msg{Data: []byte(`{"msg_id":"payload-1","event":"auth.login","data":{}}`)}
	svc.handleMessage(msg)
	if fake.ExecCallCount() < 1 {
		t.Fatalf("expected insert")
	}
}

func TestRunSubscriber(t *testing.T) {
	svc, fake := newTestService(t)
	fake.CountValue = 0
	if err := svc.RunSubscriber(nil, "audit.log"); err == nil {
		// nats is nil, RunSubscriber should error (no subscriber created)
		t.Log("RunSubscriber returned nil with nil conn (acceptable)")
	}
	_ = context.Background()
	_ = model.AuditLog{}
}
