package module

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// Tag is the telemetry tag-mapping entry managed by the Module Service. It is
// the single source of truth for which telemetry keys (sensors AND actuator
// outputs) are meaningful on a node — the same schema the Sensor/Analytics
// pages use. The Control Service reuses it so output control follows the exact
// same "attach a tag" flow as sensor monitoring.
type Tag struct {
	ID          string `json:"id"`
	NodeID      string `json:"node_id"`
	SourceKey   string `json:"source_key"` // telemetry dot-path, e.g. outputs.pump
	TagName     string `json:"tag_name"`   // friendly DB tag, e.g. mist_pump
	DisplayName string `json:"display_name"`
	Unit        string `json:"unit"`
	DataType    string `json:"data_type"` // float | int | bool
	Enabled     bool   `json:"enabled"`
}

// Client talks to the Module Service tags endpoint to discover controllable
// outputs (actuator tags) for a node.
type Client struct {
	baseURL string
	token   string
	http    *http.Client
}

// NewClient builds a Module Service client. token may be empty (dev mode where
// the Module Service does not enforce auth); callers pass the incoming request
// bearer token so the same identity is reused.
func NewClient(baseURL, token string) *Client {
	return &Client{
		baseURL: baseURL,
		token:   token,
		http:    &http.Client{Timeout: 10 * time.Second},
	}
}

func (c *Client) ListTags(nodeID string) ([]Tag, error) {
	if c.baseURL == "" {
		return nil, fmt.Errorf("module service url not configured")
	}
	url := fmt.Sprintf("%s/nodes/%s/tags", c.baseURL, nodeID)
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	if c.token != "" {
		req.Header.Set("Authorization", "Bearer "+c.token)
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("module service returned %d: %s", resp.StatusCode, string(body))
	}
	var out struct {
		Tags []Tag `json:"tags"`
	}
	if err := json.Unmarshal(body, &out); err != nil {
		return nil, err
	}
	return out.Tags, nil
}

// ListActuatorTags returns the actuator (kind="actuator") tags for a node — the
// controllable outputs the user explicitly mapped via the dashboard.
func (c *Client) ListActuatorTags(nodeID string) ([]Tag, error) {
	if c.baseURL == "" {
		return nil, fmt.Errorf("module service url not configured")
	}
	url := fmt.Sprintf("%s/nodes/%s/actuators", c.baseURL, nodeID)
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	if c.token != "" {
		req.Header.Set("Authorization", "Bearer "+c.token)
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("module service returned %d: %s", resp.StatusCode, string(body))
	}
	var out struct {
		Tags []Tag `json:"tags"`
	}
	if err := json.Unmarshal(body, &out); err != nil {
		return nil, err
	}
	return out.Tags, nil
}
