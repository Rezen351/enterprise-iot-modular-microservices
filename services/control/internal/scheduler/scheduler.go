package scheduler

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/almuzky/iot/services/control/internal/model"
)

// Dispatcher is the command sink used by the scheduler (implemented by service).
type Dispatcher interface {
	Dispatch(ctx context.Context, nodeID, target, tagName string, value int, controlType, source string, scheduleID *string) (*model.Command, error)
	EnabledSchedules(ctx context.Context) ([]model.Schedule, error)
	SensorValue(nodeID, sourceKey string) (float64, bool)
	SetScheduleEnabled(ctx context.Context, id string, enabled bool) error
}

// Engine runs enabled schedules as independent goroutines and reconciles them
// against the database every reloadInterval. All automatic control (interval,
// schedule, threshold, duration, ramp) is executed here, server-side; the
// firmware only ever receives set_output.
type Engine struct {
	disp           Dispatcher
	reloadInterval time.Duration

	mu      sync.Mutex
	runners map[string]*runner // key: schedule ID
}

type runner struct {
	cancel context.CancelFunc
	sig    string // signature to detect definition changes
}

func New(disp Dispatcher) *Engine {
	return &Engine{
		disp:           disp,
		reloadInterval: 15 * time.Second,
		runners:        make(map[string]*runner),
	}
}

// Run blocks until ctx is cancelled, reconciling schedules periodically.
func (e *Engine) Run(ctx context.Context) {
	log.Println("[scheduler] engine started")
	e.reconcile(ctx)
	t := time.NewTicker(e.reloadInterval)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			log.Println("[scheduler] engine stopping")
			e.stopAll()
			return
		case <-t.C:
			e.reconcile(ctx)
		}
	}
}

func (e *Engine) reconcile(ctx context.Context) {
	list, err := e.disp.EnabledSchedules(ctx)
	if err != nil {
		log.Printf("[scheduler] load schedules failed: %v", err)
		return
	}

	e.mu.Lock()
	defer e.mu.Unlock()

	seen := make(map[string]bool, len(list))
	for _, sc := range list {
		seen[sc.ID] = true
		sig := sc.Type + "|" + sc.OutputName + "|" + string(sc.Params)
		if r, ok := e.runners[sc.ID]; ok {
			if r.sig == sig {
				continue // unchanged
			}
			r.cancel() // definition changed → restart
			delete(e.runners, sc.ID)
		}
		rctx, cancel := context.WithCancel(ctx)
		e.runners[sc.ID] = &runner{cancel: cancel, sig: sig}
		go e.runSchedule(rctx, sc)
		log.Printf("[scheduler] started schedule %s (%s) node=%s output=%s", sc.ID, sc.Type, sc.NodeID, sc.OutputName)
	}

	// Stop runners whose schedule was disabled/deleted.
	for id, r := range e.runners {
		if !seen[id] {
			r.cancel()
			delete(e.runners, id)
			log.Printf("[scheduler] stopped schedule %s", id)
		}
	}
}

func (e *Engine) stopAll() {
	e.mu.Lock()
	defer e.mu.Unlock()
	for id, r := range e.runners {
		r.cancel()
		delete(e.runners, id)
	}
}

// runSchedule dispatches based on the schedule type until ctx is cancelled.
func (e *Engine) runSchedule(ctx context.Context, sc model.Schedule) {
	switch sc.Type {
	case model.SchedInterval:
		e.runInterval(ctx, sc)
	case model.SchedDuration:
		e.runDuration(ctx, sc)
	case model.SchedSchedule:
		e.runTimeOfDay(ctx, sc)
	case model.SchedThreshold:
		e.runThreshold(ctx, sc)
	case model.SchedRamp:
		e.runRamp(ctx, sc)
	case model.SchedWindowPulse:
		e.runWindowPulse(ctx, sc)
	default:
		log.Printf("[scheduler] unknown schedule type %q (id=%s)", sc.Type, sc.ID)
	}
}

// ─── interval: ON on_sec / OFF off_sec, repeating ─────────────────────────────

func (e *Engine) runInterval(ctx context.Context, sc model.Schedule) {
	var p model.IntervalParams
	if err := json.Unmarshal(sc.Params, &p); err != nil {
		log.Printf("[scheduler] interval bad params id=%s: %v", sc.ID, err)
		return
	}
	if p.OnSec <= 0 || p.OffSec <= 0 {
		log.Printf("[scheduler] interval id=%s needs on_sec>0 and off_sec>0", sc.ID)
		return
	}
	valOn, valOff := p.ValueOn, p.ValueOff
	if valOn == 0 {
		valOn = 1
	}
	for {
		e.dispatch(ctx, sc, valOn)
		if !sleep(ctx, time.Duration(p.OnSec)*time.Second) {
			return
		}
		e.dispatch(ctx, sc, valOff)
		if !sleep(ctx, time.Duration(p.OffSec)*time.Second) {
			return
		}
	}
}

// ─── duration: ON for total_sec once, then OFF (one-shot) ──────────────────────

func (e *Engine) runDuration(ctx context.Context, sc model.Schedule) {
	var p model.DurationParams
	if err := json.Unmarshal(sc.Params, &p); err != nil {
		log.Printf("[scheduler] duration bad params id=%s: %v", sc.ID, err)
		return
	}
	if p.TotalSec <= 0 {
		return
	}
	valOn, valOff := p.ValueOn, p.ValueOff
	if valOn == 0 {
		valOn = 1
	}
	e.dispatch(ctx, sc, valOn)
	if !sleep(ctx, time.Duration(p.TotalSec)*time.Second) {
		return
	}
	e.dispatch(ctx, sc, valOff)
	// One-shot: disable so it won't repeat on next reconcile.
	_ = e.disp.SetScheduleEnabled(context.Background(), sc.ID, false)
}

// ─── schedule: time-of-day ON/OFF (cron-like) ─────────────────────────────────

func (e *Engine) runTimeOfDay(ctx context.Context, sc model.Schedule) {
	var p model.ScheduleParams
	if err := json.Unmarshal(sc.Params, &p); err != nil {
		log.Printf("[scheduler] schedule bad params id=%s: %v", sc.ID, err)
		return
	}
	valOn, valOff := p.ValueOn, p.ValueOff
	if valOn == 0 {
		valOn = 1
	}
	t := time.NewTicker(30 * time.Second)
	defer t.Stop()
	last := -1 // last dispatched value (-1 = none)
	eval := func() {
		now := time.Now()
		if !dayActive(p.Days, int(now.Weekday())) {
			return
		}
		desired := valOff
		if inWindow(now, p.OnAt, p.OffAt) {
			desired = valOn
		}
		if desired != last {
			e.dispatch(ctx, sc, desired)
			last = desired
		}
	}
	eval()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			eval()
		}
	}
}

// ─── threshold: sensor value + hysteresis ─────────────────────────────────────

func (e *Engine) runThreshold(ctx context.Context, sc model.Schedule) {
	var p model.ThresholdParams
	if err := json.Unmarshal(sc.Params, &p); err != nil {
		log.Printf("[scheduler] threshold bad params id=%s: %v", sc.ID, err)
		return
	}
	if p.SourceKey == "" {
		log.Printf("[scheduler] threshold id=%s needs source_key", sc.ID)
		return
	}
	valOn, valOff := p.ValueOn, p.ValueOff
	if valOn == 0 {
		valOn = 1
	}
	t := time.NewTicker(5 * time.Second)
	defer t.Stop()
	state := valOff // start OFF
	e.dispatch(ctx, sc, state)
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			v, ok := e.disp.SensorValue(sc.NodeID, p.SourceKey)
			if !ok {
				continue
			}
			if state == valOff && v >= p.ThresholdHigh {
				state = valOn
				e.dispatch(ctx, sc, state)
			} else if state == valOn && v <= p.ThresholdLow {
				state = valOff
				e.dispatch(ctx, sc, state)
			}
		}
	}
}

// ─── ramp: PWM from → to over duration (one-shot) ─────────────────────────────

func (e *Engine) runRamp(ctx context.Context, sc model.Schedule) {
	var p model.RampParams
	if err := json.Unmarshal(sc.Params, &p); err != nil {
		log.Printf("[scheduler] ramp bad params id=%s: %v", sc.ID, err)
		return
	}
	steps := p.Steps
	if steps <= 0 {
		steps = 10
	}
	if p.DurationSec <= 0 {
		p.DurationSec = steps
	}
	stepDelay := time.Duration(float64(p.DurationSec)/float64(steps)*1000) * time.Millisecond
	for i := 0; i <= steps; i++ {
		val := p.From + (p.To-p.From)*i/steps
		e.dispatch(ctx, sc, val)
		if i < steps {
			if !sleep(ctx, stepDelay) {
				return
			}
		}
	}
	_ = e.disp.SetScheduleEnabled(context.Background(), sc.ID, false)
}

// ─── window_pulse: interval ON/OFF pulse that only runs while inside ──────────
// a time-of-day window (on_at..off_at, optional days). Outside the window
// the output is forced OFF. Combines a day/night schedule with a repeating
// pulse within that window. Dispatches only on state changes, so a long
// on/off phase (minutes) costs ~1 eval/sec and zero extra MQTT traffic.

func (e *Engine) runWindowPulse(ctx context.Context, sc model.Schedule) {
	var p model.WindowPulseParams
	if err := json.Unmarshal(sc.Params, &p); err != nil {
		log.Printf("[scheduler] window_pulse bad params id=%s: %v", sc.ID, err)
		return
	}
	if p.OnAt == "" || p.OffAt == "" {
		log.Printf("[scheduler] window_pulse id=%s needs on_at & off_at", sc.ID)
		return
	}
	valOn, valOff := p.ValueOn, p.ValueOff
	if valOn == 0 {
		valOn = 1
	}

	t := time.NewTicker(1 * time.Second)
	defer t.Stop()

	var windowOn bool    // currently inside the active window?
	var phaseIsOn bool    // current pulse phase is ON?
	var phaseStart time.Time
	lastVal := -1

	enterWindow := func(now time.Time) {
		windowOn = true
		phaseIsOn = true
		phaseStart = now
		e.dispatch(ctx, sc, valOn)
		lastVal = valOn
	}
	leaveWindow := func() {
		windowOn = false
		if lastVal != valOff {
			e.dispatch(ctx, sc, valOff)
			lastVal = valOff
		}
	}

	for {
		select {
		case <-ctx.Done():
			return
		case now := <-t.C:
			if !dayActive(p.Days, int(now.Weekday())) {
				if windowOn {
					leaveWindow()
				}
				continue
			}
			inside := inWindow(now, p.OnAt, p.OffAt)
			if !inside {
				if windowOn {
					leaveWindow()
				}
				continue
			}
			// Inside the window.
			if !windowOn {
				enterWindow(now)
				continue
			}
			// Already inside: advance the pulse unless an invalid pulse was set.
			if p.OnSec <= 0 || p.OffSec <= 0 {
				// No valid pulse → hold ON for the whole window (enter already sent it).
				continue
			}
			phaseDur := time.Duration(p.OffSec) * time.Second
			if phaseIsOn {
				phaseDur = time.Duration(p.OnSec) * time.Second
			}
			if now.Sub(phaseStart) >= phaseDur {
				phaseIsOn = !phaseIsOn
				phaseStart = now
				v := valOff
				if phaseIsOn {
					v = valOn
				}
				e.dispatch(ctx, sc, v)
				lastVal = v
			}
		}
	}
}

// ─── helpers ──────────────────────────────────────────────────────────────────

func (e *Engine) dispatch(ctx context.Context, sc model.Schedule, value int) {
	id := sc.ID
	bg, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if _, err := e.disp.Dispatch(bg, sc.NodeID, sc.OutputName, sc.TagName, value, sc.Type, model.SourceSchedule, &id); err != nil {
		log.Printf("[scheduler] dispatch failed id=%s node=%s output=%s val=%d: %v",
			sc.ID, sc.NodeID, sc.OutputName, value, err)
	}
}

// sleep waits for d or returns false if ctx is cancelled first.
func sleep(ctx context.Context, d time.Duration) bool {
	t := time.NewTimer(d)
	defer t.Stop()
	select {
	case <-ctx.Done():
		return false
	case <-t.C:
		return true
	}
}

func dayActive(days []int, weekday int) bool {
	if len(days) == 0 {
		return true
	}
	for _, d := range days {
		if d == weekday {
			return true
		}
	}
	return false
}

// inWindow reports whether now (HH:MM) falls within [onAt, offAt). Supports
// windows that wrap past midnight (e.g. on 20:00, off 06:00).
func inWindow(now time.Time, onAt, offAt string) bool {
	on, ok1 := parseHHMM(onAt)
	off, ok2 := parseHHMM(offAt)
	if !ok1 || !ok2 {
		return false
	}
	cur := now.Hour()*60 + now.Minute()
	if on == off {
		return false
	}
	if on < off {
		return cur >= on && cur < off
	}
	// wraps midnight
	return cur >= on || cur < off
}

func parseHHMM(s string) (int, bool) {
	var h, m int
	if n, err := fmt.Sscanf(s, "%d:%d", &h, &m); err != nil || n != 2 {
		return 0, false
	}
	if h < 0 || h > 23 || m < 0 || m > 59 {
		return 0, false
	}
	return h*60 + m, true
}
