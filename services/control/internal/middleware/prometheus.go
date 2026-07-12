package middleware

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var controlMetrics = struct {
	httpRequestsTotal    *prometheus.CounterVec
	httpRequestDuration  *prometheus.HistogramVec
	httpRequestsInFlight prometheus.Gauge
}{
	httpRequestsTotal: promauto.NewCounterVec(prometheus.CounterOpts{
		Namespace: "control",
		Name:      "http_requests_total",
		Help:      "Total number of HTTP requests processed by the control service.",
	}, []string{"method", "path", "status"}),

	httpRequestDuration: promauto.NewHistogramVec(prometheus.HistogramOpts{
		Namespace: "control",
		Name:      "http_request_duration_seconds",
		Help:      "HTTP request latency distribution.",
		Buckets:   []float64{.005, .01, .025, .05, .1, .25, .5, 1, 2.5, 5},
	}, []string{"method", "path"}),

	httpRequestsInFlight: promauto.NewGauge(prometheus.GaugeOpts{
		Namespace: "control",
		Name:      "http_requests_in_flight",
		Help:      "Current number of HTTP requests being processed.",
	}),
}

type responseWriter struct {
	http.ResponseWriter
	statusCode int
	written    bool
}

func (rw *responseWriter) WriteHeader(code int) {
	if !rw.written {
		rw.statusCode = code
		rw.written = true
		rw.ResponseWriter.WriteHeader(code)
	}
}

// PrometheusMiddleware instruments every HTTP request.
func PrometheusMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/metrics" {
			next.ServeHTTP(w, r)
			return
		}
		controlMetrics.httpRequestsInFlight.Inc()
		defer controlMetrics.httpRequestsInFlight.Dec()

		start := time.Now()
		rw := &responseWriter{ResponseWriter: w, statusCode: http.StatusOK}
		next.ServeHTTP(rw, r)

		duration := time.Since(start).Seconds()
		status := strconv.Itoa(rw.statusCode)
		path := normalizePath(r.URL.Path)

		controlMetrics.httpRequestsTotal.WithLabelValues(r.Method, path, status).Inc()
		controlMetrics.httpRequestDuration.WithLabelValues(r.Method, path).Observe(duration)
	})
}

// normalizePath collapses dynamic segments to keep label cardinality bounded.
func normalizePath(p string) string {
	known := map[string]bool{
		"/health":            true,
		"/metrics":           true,
		"/control/command":   true,
		"/control/commands":  true,
		"/control/targets":   true,
		"/control/schedules": true,
		"/control/modes":     true,
	}
	if known[p] {
		return p
	}
	switch {
	case strings.HasPrefix(p, "/control/schedules/"):
		return "/control/schedules/{id}"
	case strings.HasPrefix(p, "/control/modes/"):
		return "/control/modes/{node}/{output}"
	}
	return "/unknown"
}
