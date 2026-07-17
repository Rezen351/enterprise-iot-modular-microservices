package service

import (
	"context"
	"database/sql"
	"errors"
	"testing"
	"time"

	"github.com/almuzky/iot/services/control/internal/model"
	"github.com/almuzky/iot/services/control/internal/repository"
	"github.com/almuzky/iot/services/control/internal/testdriver"
)

// ─── fakes ────────────────────────────────────────────────────────────────────

type fakePublisher struct {
	connected bool
	published []publishCall
	err       error
}

type publishCall struct {
	nodeID, target string
	value          int
	reqID          string
}

func (f *fakePublisher) PublishSetOutput(nodeID, target string, value int, reqID string) error {
	f.published = append(f.published, publishCall{nodeID, target, value, reqID})
	return f.err
}
func (f *fakePublisher) IsConnected() bool { return f.connected }

type fakeNATS struct{ published []string }

func (f *fakeNATS) Publish(subject string, data []byte) error {
	f.published = append(f.published, subject)
	return nil
}

func newTestService(t *testing.T, pub *fakePublisher, nats *fakeNATS) (*ControlService, *testdriver.FakeDB) {
	t.Helper()
	sqldb, fake := testdriver.Open()
	repo := repository.New(sqldb)
	src := &StaticActuatorSource{Targets: []model.ControlTarget{
		{NodeID: "n1", SourceKey: "pump", TagName: "Pump", Label: "Pump"},
	}}
	return New(repo, pub, nats, src), fake
}

func ptrInt(v int) *int { return &v }

// ─── manual commands ───────────────────────────────────────────────────────────

func TestHandleManualCommandSetState(t *testing.T) {
	pub := &fakePublisher{connected: true}
	nats := &fakeNATS{}
	svc, _ := newTestService(t, pub, nats)
	v := 1
	cmds, err := svc.HandleManualCommand(context.Background(), model.CommandRequest{
		NodeID: "n1", Type: model.TypeSetState, Output: "pump", Value: &v,
	}, "u1", nil)
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if len(cmds) != 1 || len(pub.published) != 1 {
		t.Fatalf("expected 1 command published, got %d", len(pub.published))
	}
	if cmds[0].Status != model.StatusSent {
		t.Fatalf("expected sent, got %s", cmds[0].Status)
	}
}

func TestHandleManualMissingNode(t *testing.T) {
	svc, _ := newTestService(t, &fakePublisher{connected: true}, &fakeNATS{})
	_, err := svc.HandleManualCommand(context.Background(), model.CommandRequest{Type: model.TypeSetState}, "u1", nil)
	if !errors.Is(err, ErrNodeRequired) {
		t.Fatalf("expected ErrNodeRequired, got %v", err)
	}
}

func TestHandleManualMissingOutput(t *testing.T) {
	svc, _ := newTestService(t, &fakePublisher{connected: true}, &fakeNATS{})
	v := 1
	_, err := svc.HandleManualCommand(context.Background(), model.CommandRequest{NodeID: "n1", Type: model.TypeSetState, Value: &v}, "u1", nil)
	if !errors.Is(err, ErrOutputRequired) {
		t.Fatalf("expected ErrOutputRequired, got %v", err)
	}
}

func TestHandleManualMissingValue(t *testing.T) {
	svc, _ := newTestService(t, &fakePublisher{connected: true}, &fakeNATS{})
	_, err := svc.HandleManualCommand(context.Background(), model.CommandRequest{NodeID: "n1", Type: model.TypeSetState, Output: "pump"}, "u1", nil)
	if !errors.Is(err, ErrValueRequired) {
		t.Fatalf("expected ErrValueRequired, got %v", err)
	}
}

func TestHandleManualValueOutOfRange(t *testing.T) {
	svc, _ := newTestService(t, &fakePublisher{connected: true}, &fakeNATS{})
	v := 999
	_, err := svc.HandleManualCommand(context.Background(), model.CommandRequest{NodeID: "n1", Type: model.TypeSetState, Output: "pump", Value: &v}, "u1", nil)
	if !errors.Is(err, ErrValueOutOfRange) {
		t.Fatalf("expected ErrValueOutOfRange, got %v", err)
	}
	v2 := -1
	_, err = svc.HandleManualCommand(context.Background(), model.CommandRequest{NodeID: "n1", Type: model.TypeSetState, Output: "pump", Value: &v2}, "u1", nil)
	if !errors.Is(err, ErrValueOutOfRange) {
		t.Fatalf("expected ErrValueOutOfRange for negative, got %v", err)
	}
}

func TestHandleManualToggle(t *testing.T) {
	pub := &fakePublisher{connected: true}
	svc, _ := newTestService(t, pub, &fakeNATS{})
	cmds, err := svc.HandleManualCommand(context.Background(), model.CommandRequest{NodeID: "n1", Type: model.TypeToggle, Output: "pump"}, "u1", nil)
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if cmds[0].Value != 1 {
		t.Fatalf("expected toggle ON (1), got %d", cmds[0].Value)
	}
}

func TestHandleManualPulse(t *testing.T) {
	pub := &fakePublisher{connected: true}
	svc, _ := newTestService(t, pub, &fakeNATS{})
	cmds, err := svc.HandleManualCommand(context.Background(), model.CommandRequest{NodeID: "n1", Type: model.TypePulse, Output: "pump"}, "u1", nil)
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if cmds[0].Value != 1 {
		t.Fatalf("expected pulse ON (1), got %d", cmds[0].Value)
	}
}

func TestHandleManualEmergencyStop(t *testing.T) {
	pub := &fakePublisher{connected: true}
	nats := &fakeNATS{}
	svc, fake := newTestService(t, pub, nats)
	fake.CountValue = 0
	cmds, err := svc.HandleManualCommand(context.Background(), model.CommandRequest{NodeID: "n1", Type: model.TypeEmergencyStop}, "u1", nil)
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if len(cmds) != 1 {
		t.Fatalf("expected 1 command for emergency stop, got %d", len(cmds))
	}
}

func TestHandleManualUnknownType(t *testing.T) {
	svc, _ := newTestService(t, &fakePublisher{connected: true}, &fakeNATS{})
	_, err := svc.HandleManualCommand(context.Background(), model.CommandRequest{NodeID: "n1", Type: "bogus"}, "u1", nil)
	if !errors.Is(err, ErrUnknownType) {
		t.Fatalf("expected ErrUnknownType, got %v", err)
	}
}

func TestHandleManualAutoModeRejected(t *testing.T) {
	pub := &fakePublisher{connected: true}
	svc, fake := newTestService(t, pub, &fakeNATS{})
	fake.SetSelectRows([]testdriver.Row{testdriver.NewRow([]string{"mode"}, "AUTO")})
	v := 1
	_, err := svc.HandleManualCommand(context.Background(), model.CommandRequest{NodeID: "n1", Type: model.TypeSetState, Output: "pump", Value: &v}, "u1", nil)
	if !errors.Is(err, ErrNodeAutoMode) {
		t.Fatalf("expected ErrNodeAutoMode, got %v", err)
	}
}

func TestHandleManualEmergencyModeRejected(t *testing.T) {
	pub := &fakePublisher{connected: true}
	svc, fake := newTestService(t, pub, &fakeNATS{})
	fake.SetSelectRows([]testdriver.Row{testdriver.NewRow([]string{"mode"}, "EMERGENCY")})
	v := 1
	_, err := svc.HandleManualCommand(context.Background(), model.CommandRequest{NodeID: "n1", Type: model.TypeSetState, Output: "pump", Value: &v}, "u1", nil)
	if !errors.Is(err, ErrNodeEmergency) {
		t.Fatalf("expected ErrNodeEmergency, got %v", err)
	}
}

func TestHandleManualMQTTUnavailable(t *testing.T) {
	pub := &fakePublisher{connected: false}
	svc, _ := newTestService(t, pub, &fakeNATS{})
	v := 1
	_, err := svc.HandleManualCommand(context.Background(), model.CommandRequest{NodeID: "n1", Type: model.TypeSetState, Output: "pump", Value: &v}, "u1", nil)
	if !errors.Is(err, ErrMQTTUnavailable) {
		t.Fatalf("expected ErrMQTTUnavailable, got %v", err)
	}
}

// ─── dispatch / confirm / telemetry ──────────────────────────────────────────────

func TestOnConfirm(t *testing.T) {
	svc, _ := newTestService(t, &fakePublisher{connected: true}, &fakeNATS{})
	svc.OnConfirm("n1", "req-1", "pump", 1)
}

func TestOnTelemetry(t *testing.T) {
	svc, _ := newTestService(t, &fakePublisher{connected: true}, &fakeNATS{})
	payload := `{"telemetry":{"outputs":{"pump":5,"fan":0}}}`
	svc.OnTelemetry("n1", []byte(payload))
	outs := svc.GetOutputs("n1")
	if len(outs) != 2 {
		t.Fatalf("expected 2 firmware outputs, got %d", len(outs))
	}
	v, ok := svc.SensorValue("n1", "telemetry.outputs.pump")
	if !ok || v != 5 {
		t.Fatalf("expected sensor value 5, got %v ok=%v", v, ok)
	}
}

func TestOnTelemetryBadJSON(t *testing.T) {
	svc, _ := newTestService(t, &fakePublisher{connected: true}, &fakeNATS{})
	svc.OnTelemetry("n1", []byte("not-json"))
	if len(svc.GetOutputs("n1")) != 0 {
		t.Fatalf("expected no outputs from bad json")
	}
}

func TestGetOutputsEmpty(t *testing.T) {
	svc, _ := newTestService(t, &fakePublisher{connected: true}, &fakeNATS{})
	if len(svc.GetOutputs("ghost")) != 0 {
		t.Fatalf("expected empty outputs for unknown node")
	}
}

// ─── targets / modes ────────────────────────────────────────────────────────────

func TestListTargets(t *testing.T) {
	svc, _ := newTestService(t, &fakePublisher{connected: true}, &fakeNATS{})
	targets, err := svc.ListTargets(context.Background(), "n1", nil)
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if len(targets) != 1 {
		t.Fatalf("expected 1 target, got %d", len(targets))
	}
}

func TestSetModeInvalid(t *testing.T) {
	svc, _ := newTestService(t, &fakePublisher{connected: true}, &fakeNATS{})
	if err := svc.SetMode(context.Background(), "n1", "pump", model.ModeRequest{Mode: "bogus"}); err == nil {
		t.Fatalf("expected error for invalid mode")
	}
}

func TestSetModeOK(t *testing.T) {
	svc, _ := newTestService(t, &fakePublisher{connected: true}, &fakeNATS{})
	if err := svc.SetMode(context.Background(), "n1", "pump", model.ModeRequest{Mode: "auto"}); err != nil {
		t.Fatalf("err: %v", err)
	}
}

func TestGetModeDefaultManual(t *testing.T) {
	svc, fake := newTestService(t, &fakePublisher{connected: true}, &fakeNATS{})
	fake.QueryErr = sql.ErrNoRows
	m, err := svc.GetMode(context.Background(), "n1", "pump")
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if m != model.ModeManual {
		t.Fatalf("expected default MANUAL, got %s", m)
	}
}

func TestGetNodeModeDefaultAuto(t *testing.T) {
	svc, fake := newTestService(t, &fakePublisher{connected: true}, &fakeNATS{})
	fake.QueryErr = sql.ErrNoRows
	m := svc.GetNodeMode(context.Background(), "n1")
	if m != model.ModeAuto {
		t.Fatalf("expected default AUTO, got %s", m)
	}
}

func TestSetNodeModeInvalid(t *testing.T) {
	svc, _ := newTestService(t, &fakePublisher{connected: true}, &fakeNATS{})
	if err := svc.SetNodeMode(context.Background(), "n1", "bogus"); err == nil {
		t.Fatalf("expected error for invalid node mode")
	}
}

func TestSetNodeModeEmergency(t *testing.T) {
	svc, _ := newTestService(t, &fakePublisher{connected: true}, &fakeNATS{})
	if err := svc.SetNodeMode(context.Background(), "n1", "emergency"); err != nil {
		t.Fatalf("err: %v", err)
	}
}

func TestResumeNode(t *testing.T) {
	svc, _ := newTestService(t, &fakePublisher{connected: true}, &fakeNATS{})
	m, err := svc.ResumeNode(context.Background(), "n1")
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if m != model.ModeAuto {
		t.Fatalf("expected AUTO after resume, got %s", m)
	}
}

// ─── schedules ──────────────────────────────────────────────────────────────────

func TestCreateSchedule(t *testing.T) {
	svc, _ := newTestService(t, &fakePublisher{connected: true}, &fakeNATS{})
	sc, err := svc.CreateSchedule(context.Background(), model.ScheduleRequest{NodeID: "n1", OutputName: "pump", Type: "interval"})
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if sc.ID == "" {
		t.Fatalf("expected schedule id")
	}
}

func TestCreateScheduleMissingNode(t *testing.T) {
	svc, _ := newTestService(t, &fakePublisher{connected: true}, &fakeNATS{})
	_, err := svc.CreateSchedule(context.Background(), model.ScheduleRequest{OutputName: "pump"})
	if !errors.Is(err, ErrNodeRequired) {
		t.Fatalf("expected ErrNodeRequired, got %v", err)
	}
}

func TestCreateScheduleMissingOutput(t *testing.T) {
	svc, _ := newTestService(t, &fakePublisher{connected: true}, &fakeNATS{})
	_, err := svc.CreateSchedule(context.Background(), model.ScheduleRequest{NodeID: "n1"})
	if !errors.Is(err, ErrOutputRequired) {
		t.Fatalf("expected ErrOutputRequired, got %v", err)
	}
}

func TestGetScheduleNotFound(t *testing.T) {
	svc, fake := newTestService(t, &fakePublisher{connected: true}, &fakeNATS{})
	fake.QueryErr = sql.ErrNoRows
	_, err := svc.GetSchedule(context.Background(), "missing")
	if !errors.Is(err, ErrScheduleNotFound) {
		t.Fatalf("expected ErrScheduleNotFound, got %v", err)
	}
}

func TestUpdateScheduleNotFound(t *testing.T) {
	svc, fake := newTestService(t, &fakePublisher{connected: true}, &fakeNATS{})
	fake.QueryErr = sql.ErrNoRows
	_, err := svc.UpdateSchedule(context.Background(), "missing", model.ScheduleRequest{OutputName: "pump"})
	if !errors.Is(err, ErrScheduleNotFound) {
		t.Fatalf("expected ErrScheduleNotFound, got %v", err)
	}
}

func TestDeleteScheduleNotFound(t *testing.T) {
	svc, fake := newTestService(t, &fakePublisher{connected: true}, &fakeNATS{})
	fake.ExecErr = sql.ErrNoRows
	err := svc.DeleteSchedule(context.Background(), "missing")
	if !errors.Is(err, ErrScheduleNotFound) {
		t.Fatalf("expected ErrScheduleNotFound, got %v", err)
	}
}

func TestSetScheduleEnabledNotFound(t *testing.T) {
	svc, fake := newTestService(t, &fakePublisher{connected: true}, &fakeNATS{})
	fake.ExecErr = sql.ErrNoRows
	err := svc.SetScheduleEnabled(context.Background(), "missing", true)
	if !errors.Is(err, ErrScheduleNotFound) {
		t.Fatalf("expected ErrScheduleNotFound, got %v", err)
	}
}

func schedRow(id, node, out, tag, typ string, enabled bool) testdriver.Row {
	now := time.Now()
	return testdriver.NewRow(
		[]string{"id", "node_id", "output_name", "tag_name", "type", "params", "enabled", "next_run_at", "created_at", "updated_at"},
		id, node, out, tag, typ, "{}", enabled, now, now, now,
	)
}

func cmdRow() testdriver.Row {
	now := time.Now()
	return testdriver.NewRow(
		[]string{"id", "req_id", "node_id", "target", "tag_name", "control_type", "value", "source", "schedule_id", "status", "issued_by", "created_at", "acked_at"},
		"c1", "r1", "n1", "pump", "Pump", "set_state", 1, "manual", nil, "sent", "u1", now, nil,
	)
}

func TestListSchedules(t *testing.T) {
	svc, fake := newTestService(t, &fakePublisher{connected: true}, &fakeNATS{})
	fake.SetResponse("from schedules", []testdriver.Row{schedRow("s1", "n1", "pump", "Pump", "interval", true)})
	scs, err := svc.ListSchedules(context.Background(), "n1")
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if len(scs) != 1 {
		t.Fatalf("expected 1 schedule, got %d", len(scs))
	}
}

func TestEnabledSchedules(t *testing.T) {
	svc, fake := newTestService(t, &fakePublisher{connected: true}, &fakeNATS{})
	fake.SetResponse("from schedules", []testdriver.Row{schedRow("s1", "n1", "pump", "Pump", "interval", true)})
	fake.SetResponse("output_name = '*'", []testdriver.Row{testdriver.NewRow([]string{"node_id", "mode"}, "n1", model.ModeAuto)})
	out, err := svc.EnabledSchedules(context.Background())
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if len(out) != 1 {
		t.Fatalf("expected 1 enabled schedule in AUTO, got %d", len(out))
	}
}

func TestEnabledSchedulesManualPaused(t *testing.T) {
	svc, fake := newTestService(t, &fakePublisher{connected: true}, &fakeNATS{})
	fake.SetResponse("from schedules", []testdriver.Row{schedRow("s1", "n1", "pump", "Pump", "interval", true)})
	fake.SetResponse("output_name = '*'", []testdriver.Row{testdriver.NewRow([]string{"node_id", "mode"}, "n1", model.ModeManual)})
	out, err := svc.EnabledSchedules(context.Background())
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if len(out) != 0 {
		t.Fatalf("expected 0 enabled schedules when node in MANUAL, got %d", len(out))
	}
}

// ─── commands / misc ────────────────────────────────────────────────────────────

func TestListCommands(t *testing.T) {
	svc, fake := newTestService(t, &fakePublisher{connected: true}, &fakeNATS{})
	fake.SetResponse("from commands", []testdriver.Row{cmdRow()})
	cmds, err := svc.ListCommands(context.Background(), "n1", 10)
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if len(cmds) != 1 {
		t.Fatalf("expected 1 command, got %d", len(cmds))
	}
}

func TestTimeoutStale(t *testing.T) {
	svc, _ := newTestService(t, &fakePublisher{connected: true}, &fakeNATS{})
	svc.TimeoutStale(context.Background(), 0)
}

func TestSetGetPublisherAndScheduler(t *testing.T) {
	svc, _ := newTestService(t, &fakePublisher{connected: true}, &fakeNATS{})
	svc.SetPublisher(&fakePublisher{connected: true})
	svc.SetActuatorSource(&StaticActuatorSource{})
	svc.SetScheduler(nil)
	svc.notifyScheduler()
}

func TestResolvePathAndToFloatCover(t *testing.T) {
	if _, ok := resolvePath(map[string]interface{}{"a": map[string]interface{}{"b": 1}}, "a.b"); !ok {
		t.Fatalf("expected path resolved")
	}
	if _, ok := resolvePath(map[string]interface{}{"a": 1}, "a.b"); ok {
		t.Fatalf("expected path not resolved")
	}
	if v, ok := toFloat(1); !ok || v != 1 {
		t.Fatalf("expected 1")
	}
	if v, ok := toFloat(true); !ok || v != 1 {
		t.Fatalf("expected 1 from bool")
	}
	if _, ok := toFloat("x"); ok {
		t.Fatalf("expected false for string")
	}
	if v, ok := toInt(float64(3)); !ok || v != 3 {
		t.Fatalf("expected 3")
	}
}

func TestResumeNode(t *testing.T) {
	svc, fake := newTestService(t, &fakePublisher{connected: true}, &fakeNATS{})
	fake.SetResponse("prev_mode", []testdriver.Row{testdriver.NewRow([]string{"prev_mode"}, "")})
	m, err := svc.ResumeNode(context.Background(), "n1")
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if m != model.ModeAuto {
		t.Fatalf("expected AUTO after resume (no prev), got %s", m)
	}
}

func TestGetNodeModeMap(t *testing.T) {
	svc, fake := newTestService(t, &fakePublisher{connected: true}, &fakeNATS{})
	fake.SetResponse("output_name = '*'", []testdriver.Row{testdriver.NewRow([]string{"node_id", "mode"}, "n1", model.ModeEmergency)})
	m, err := svc.GetNodeMode(context.Background(), "n1")
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if m != model.ModeEmergency {
		t.Fatalf("expected EMERGENCY, got %s", m)
	}
	_ = ptrInt
}
