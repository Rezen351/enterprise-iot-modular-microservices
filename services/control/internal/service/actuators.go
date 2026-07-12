package service

import (
	"context"

	"github.com/almuzky/iot/services/control/internal/model"
	"github.com/almuzky/iot/services/control/internal/module"
)

// moduleActuatorSource adapts the Module Service actuator-tag client to the
// ActuatorSource interface. Actuator tags (kind="actuator") are the
// controllable outputs the user explicitly mapped — separate from sensor
// telemetry tags.
type moduleActuatorSource struct {
	client *module.Client
}

// NewModuleActuatorSource builds an ActuatorSource backed by the Module Service
// tag-mapping. token is the incoming request bearer token (reused for auth; in
// dev it may be empty).
func NewModuleActuatorSource(baseURL, token string) ActuatorSource {
	return &moduleActuatorSource{client: module.NewClient(baseURL, token)}
}

// GetActuators returns the actuator tags for a node (kind="actuator"). SourceKey
// is the firmware output name (e.g. "pump") and is what the Control Service
// publishes to MQTT; TagName is the friendly DB tag.
func (m *moduleActuatorSource) GetActuators(ctx context.Context, nodeID string) ([]model.ControlTarget, error) {
	tags, err := m.client.ListActuatorTags(nodeID)
	if err != nil {
		return nil, err
	}
	out := make([]model.ControlTarget, 0, len(tags))
	for _, t := range tags {
		if !t.Enabled {
			continue
		}
		out = append(out, tagToTarget(t))
	}
	return out, nil
}

// StaticActuatorSource lets the dashboard inject the exact tag set it rendered,
// keeping manual commands consistent with what the user saw on screen.
type StaticActuatorSource struct {
	Targets []model.ControlTarget
}

func (s *StaticActuatorSource) GetActuators(ctx context.Context, nodeID string) ([]model.ControlTarget, error) {
	out := make([]model.ControlTarget, 0, len(s.Targets))
	for _, t := range s.Targets {
		if t.NodeID == "" || t.NodeID == nodeID {
			out = append(out, t)
		}
	}
	return out, nil
}

func tagToTarget(t module.Tag) model.ControlTarget {
	label := t.DisplayName
	if label == "" {
		label = t.TagName
	}
	if label == "" {
		label = t.SourceKey
	}
	outType := model.OutDigital
	if t.DataType == "int" {
		outType = model.OutPWM
	}
	return model.ControlTarget{
		ID:         t.ID,
		NodeID:     t.NodeID,
		SourceKey:  t.SourceKey,
		TagName:    t.TagName,
		Label:      label,
		OutputType: outType,
	}
}

// isActuatorKey reports whether a telemetry dot-path is an actuator output.
// Firmware publishes outputs under telemetry.outputs.<name>; the SourceKey
// stored in the tag-mapping is exactly that path.
func isActuatorKey(key string) bool {
	const prefix = "outputs."
	if len(key) <= len(prefix) {
		return false
	}
	return key[:len(prefix)] == prefix
}
