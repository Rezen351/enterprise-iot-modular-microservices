// Package trace provides helpers for propagating an end-to-end saga/correlation
// trace identifier across processes.
//
// Standard used across the platform (see planning.md §"Metrics & Observability"):
//   - HTTP inbound/outbound: header "X-Trace-Id"  (W3C-style trace id)
//   - NATS publish/consume:  header "Trace-Id"
//   - Logs: always echo the trace id so spans can be correlated in one search.
//
// A trace id is a UUIDv4. When none is supplied by a caller we generate one so
// that every span is individually addressable.
package trace

import (
	"encoding/hex"
	"net/http"
	"os"
	"strings"

	"github.com/google/uuid"
)

// HeaderHTTP is the HTTP header used to carry the trace id on the wire.
const HeaderHTTP = "X-Trace-Id"

// HeaderNATS is the NATS message header used to carry the trace id.
const HeaderNATS = "Trace-Id"

// propagationEnv allows the platform to force-disable trace id generation in
// environments that do not want random ids (unset = enabled).
var forceEnabled = true

func init() {
	if v := os.Getenv("TRACE_PROPAGATION"); v != "" {
		forceEnabled = !strings.EqualFold(v, "false") && !strings.EqualFold(v, "0")
	}
}

// New generates a fresh trace id (UUIDv4, no dashes — compact W3C-ish form).
func New() string {
	return strings.ReplaceAll(uuid.NewString(), "-", "")
}

// FromHTTP extracts the trace id from an inbound HTTP request, generating a new
// one when absent. The returned id is safe to propagate downstream.
func FromHTTP(r *http.Request) string {
	if !forceEnabled {
		return ""
	}
	if v := r.Header.Get(HeaderHTTP); v != "" {
		return v
	}
	return New()
}

// ToHTTP writes the trace id onto an outbound HTTP request. When tid is empty a
// new id is generated so the downstream span is always addressable.
func ToHTTP(req *http.Request, tid string) string {
	if tid == "" {
		tid = New()
	}
	req.Header.Set(HeaderHTTP, tid)
	return tid
}

// FromNATS extracts the trace id from a NATS message header map, generating a
// new one when absent.
func FromNATS(headers map[string][]string) string {
	if !forceEnabled {
		return ""
	}
	if v := firstHeader(headers, HeaderNATS); v != "" {
		return v
	}
	return New()
}

// ToNATS returns the header map to attach to an outbound NATS publish so the
// trace id propagates. When tid is empty a new id is generated.
func ToNATS(tid string) map[string][]string {
	if tid == "" {
		tid = New()
	}
	return map[string][]string{HeaderNATS: {tid}}
}

// firstHeader performs a case-insensitive lookup on a NATS header map
// (nats.go lower-cases header keys when reading, but be defensive).
func firstHeader(headers map[string][]string, key string) string {
	if headers == nil {
		return ""
	}
	if v, ok := headers[key]; ok && len(v) > 0 {
		return v[0]
	}
	lk := strings.ToLower(key)
	for k, v := range headers {
		if strings.ToLower(k) == lk && len(v) > 0 {
			return v[0]
		}
	}
	return ""
}

// IsValid reports whether tid looks like a usable trace id (non-empty, sane
// length). Used to sanitize caller-supplied ids before logging them.
func IsValid(tid string) bool {
	if len(tid) == 0 || len(tid) > 128 {
		return false
	}
	for _, c := range tid {
		if (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F') ||
			(c >= '0' && c <= '9') || c == '-' {
			continue
		}
		return false
	}
	return true
}

// Sanitize returns tid unchanged when valid, otherwise a freshly generated id.
// This prevents a malicious/garbage upstream header from polluting log fields.
func Sanitize(tid string) string {
	if IsValid(tid) {
		return tid
	}
	return New()
}

// ShortHex returns a short, human-friendly prefix of an arbitrary id for logs.
func ShortHex(s string) string {
	s = strings.TrimPrefix(s, "0x")
	if len(s) > 8 {
		s = s[:8]
	}
	if _, err := hex.DecodeString(s); err != nil {
		return tid8(s)
	}
	return s
}

func tid8(s string) string {
	if len(s) > 8 {
		return s[:8]
	}
	return s
}
