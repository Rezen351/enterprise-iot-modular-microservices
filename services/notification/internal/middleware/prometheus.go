package middleware

import (
	"net/http"
	"strconv"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var notificationMetrics = struct {
	httpRequestsTotal    *prometheus.CounterVec
	httpRequestDuration  *prometheus.HistogramVec
	httpRequestsInflight prometheus.Gauge
}{
	httpRequestsTotal: promauto.NewCounterVec(prometheus.CounterOpts{
		Namespace: "notification",
		Name:      "http_requests_total",
		Help:      "Total number of HTTP requests processed by the notification service.",
	}, []string{"method", "path", "status"}),

	httpRequestDuration: promauto.NewHistogramVec(prometheus.HistogramOpts{
		Namespace: "notification",
		Name:      "http_request_duration_seconds",
		Help:      "HTTP request latency distribution.",
		Buckets:   []float64{.005, .01, .025, .05, .1, .25, .5, 1, 2.5, 5},
	}, []string{"method", "path"}),

	httpRequestsInflight: promauto.NewGauge(prometheus.GaugeOpts{
		Namespace: "notification",
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
		notificationMetrics.httpRequestsInflight.Inc()
		defer notificationMetrics.httpRequestsInflight.Dec()

		start := time.Now()
		rw := &responseWriter{ResponseWriter: w, statusCode: http.StatusOK}
		next.ServeHTTP(rw, r)

		duration := time.Since(start).Seconds()
		status := strconv.Itoa(rw.statusCode)
		path := normalizePath(r.URL.Path)

		notificationMetrics.httpRequestsTotal.WithLabelValues(r.Method, path, status).Inc()
		notificationMetrics.httpRequestDuration.WithLabelValues(r.Method, path).Observe(duration)
	})
}

func normalizePath(p string) string {
	switch {
	case p == "/health":
		return "/health"
	case p == "/metrics":
		return "/metrics"
	case len(p) >= len("/notifications/settings") && p[:len("/notifications/settings")] == "/notifications/settings":
		return "/notifications/settings"
	case len(p) >= len("/notifications/logs") && p[:len("/notifications/logs")] == "/notifications/logs":
		return "/notifications/logs"
	case len(p) >= len("/notifications/test") && p[:len("/notifications/test")] == "/notifications/test":
		return "/notifications/test"
	}
	return "/unknown"
}
