package mediamtx

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"
)

// Client wraps the MediaMTX Control API (v3). It registers/removes path
// configurations (config/paths) and reads runtime path status (paths).
//
// Endpoints used (MediaMTX v3):
//   - POST   /v3/config/paths/add/{name}    — persist a path config (source pull)
//   - DELETE /v3/config/paths/delete/{name} — remove a path config
//   - GET    /v3/paths/get/{name}           — runtime state (idle/waiting/running/ready)
//   - PATCH  /v3/config/paths/patch/{name}  — update a path (e.g. record on/off)
//
// The HTTP/HLS server (separate port) serves single-frame snapshots at
// /{name}/snapshot, used for snapshot capture.
type Client struct {
	baseURL  string // Control API (v3), e.g. http://mediamtx:9997
	httpURL  string // HTTP/HLS server, e.g. http://mediamtx:8888
	httpCl   *http.Client
}

func New(baseURL string) *Client {
	return &Client{
		baseURL: baseURL,
		httpCl:  &http.Client{Timeout: 15 * time.Second},
	}
}

// WithHTTPURL sets the MediaMTX HTTP/HLS server base URL used for snapshots.
func (c *Client) WithHTTPURL(u string) *Client {
	c.httpURL = u
	return c
}

// addPathConf is the request body for config/paths/add. Only the fields we set.
type addPathConf struct {
	Source                    string `json:"source"`
	SourceOnDemand            bool   `json:"sourceOnDemand"`
	SourceOnDemandStartTimeout string `json:"sourceOnDemandStartTimeout"`
	SourceOnDemandCloseAfter  string `json:"sourceOnDemandCloseAfter"`
	Record                    bool   `json:"record"`
}

// pathGetResponse is a subset of the runtime Path object returned by /v3/paths/get.
// MediaMTX v3 does not expose a single "state" field; the runtime state is
// derived from online/ready/available, so all three are captured here.
// NOTE: `source` is a JSON object, so it is intentionally omitted here to
// avoid an unmarshal error on the whole response.
type pathGetResponse struct {
	Name      string `json:"name"`
	State     string `json:"state"`
	Ready     bool   `json:"ready"`
	Available bool   `json:"available"`
	Online    bool   `json:"online"`
	Tracks    []any  `json:"tracks"`
}

// AddPath registers a path config that pulls `source` on demand.
func (c *Client) AddPath(ctx context.Context, name, source string) error {
	body, _ := json.Marshal(addPathConf{
		Source:                    source,
		SourceOnDemand:            true,
		SourceOnDemandStartTimeout: "10s",
		SourceOnDemandCloseAfter:  "10s",
		Record:                    false,
	})
	url := fmt.Sprintf("%s/v3/config/paths/add/%s", c.baseURL, name)
	if err := c.do(ctx, http.MethodPost, url, body); err != nil {
		return fmt.Errorf("mediamtx add path %q: %w", name, err)
	}
	return nil
}

// RemovePath deletes a previously registered path config.
func (c *Client) RemovePath(ctx context.Context, name string) error {
	url := fmt.Sprintf("%s/v3/config/paths/delete/%s", c.baseURL, name)
	// 404 is acceptable (already gone) — treat as success.
	if err := c.do(ctx, http.MethodDelete, url, nil); err != nil {
		if IsNotFound(err) {
			return nil
		}
		return fmt.Errorf("mediamtx remove path %q: %w", name, err)
	}
	return nil
}

// GetPathStatus returns the runtime state string for a path ("unknown" on miss/error).
func (c *Client) GetPathStatus(ctx context.Context, name string) string {
	url := fmt.Sprintf("%s/v3/paths/get/%s", c.baseURL, name)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return "unknown"
	}
	resp, err := c.httpCl.Do(req)
	if err != nil {
		return "unknown"
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusNotFound {
		return "idle"
	}
	if resp.StatusCode != http.StatusOK {
		return "unknown"
	}
	data, _ := io.ReadAll(resp.Body)
	var p pathGetResponse
	if err := json.Unmarshal(data, &p); err != nil {
		return "unknown"
	}

	// Derive a state string from MediaMTX v3 fields.
	// State is only present on older builds; otherwise infer it.
	if p.State != "" {
		return p.State
	}
	switch {
	case p.Ready:
		return "ready"
	case p.Available || p.Online:
		return "waiting"
	default:
		return "idle"
	}
}

// apiError carries the HTTP status for NotFound detection.
type apiError struct {
	status int
	msg    string
}

func (e *apiError) Error() string { return e.msg }

func IsNotFound(err error) bool {
	if e, ok := err.(*apiError); ok {
		return e.status == http.StatusNotFound
	}
	return false
}

func (c *Client) do(ctx context.Context, method, url string, body []byte) error {
	var rdr io.Reader
	if body != nil {
		rdr = bytes.NewReader(body)
	}
	req, err := http.NewRequestWithContext(ctx, method, url, rdr)
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.httpCl.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		return nil
	}
	b, _ := io.ReadAll(resp.Body)
	msg := string(bytes.TrimSpace(b))
	if msg == "" {
		msg = fmt.Sprintf("status %d", resp.StatusCode)
	}
	log.Printf("[mediamtx] %s %s -> %d: %s", method, url, resp.StatusCode, msg)
	return &apiError{status: resp.StatusCode, msg: msg}
}

// SetRecord toggles MediaMTX recording for a path via the v3 config patch API.
func (c *Client) SetRecord(ctx context.Context, name string, enabled bool) error {
	body, _ := json.Marshal(map[string]any{"record": enabled})
	url := fmt.Sprintf("%s/v3/config/paths/patch/%s", c.baseURL, name)
	return c.do(ctx, http.MethodPatch, url, body)
}

// CaptureSnapshot grabs the current frame of a path from MediaMTX's HTTP
// server (/${name}/snapshot). It follows redirects and returns the JPEG bytes
// plus the content type. Returns an error if the stream is not currently
// producing frames (MediaMTX answers with 500 in that case).
func (c *Client) CaptureSnapshot(ctx context.Context, name string) ([]byte, string, error) {
	if c.httpURL == "" {
		return nil, "", fmt.Errorf("mediamtx HTTP URL not configured")
	}
	url := fmt.Sprintf("%s/%s/snapshot", c.httpURL, name)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, "", err
	}
	resp, err := c.httpCl.Do(req)
	if err != nil {
		return nil, "", fmt.Errorf("mediamtx snapshot request: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, "", fmt.Errorf("mediamtx snapshot failed (status %d) — stream may not be live", resp.StatusCode)
	}
	ct := resp.Header.Get("Content-Type")
	if ct == "" || len(ct) < 5 || ct[:5] != "image" {
		return nil, "", fmt.Errorf("mediamtx snapshot returned non-image content (%q)", ct)
	}
	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, "", err
	}
	if len(data) == 0 {
		return nil, "", fmt.Errorf("mediamtx snapshot returned empty body")
	}
	return data, ct, nil
}
