package middleware

import (
	"net/http"
	"strconv"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var auditMetrics = struct {
	httpRequestsTotal   *prometheus.CounterVec
	httpRequestDuration *prometheus.HistogramVec
	httpRequestsInflight prometheus.Gauge
}{
	httpRequestsTotal: promauto.NewCounterVec(prometheus.CounterOpts{
		Namespace: "audit",
		Name:      "http_requests_total",
		Help:      "Total number of HTTP requests processed by the audit service.",
	}, []string{"method", "path", "status"}),

	httpRequestDuration: promauto.NewHistogramVec(prometheus.HistogramOpts{
		Namespace: "audit",
		Name:      "http_request_duration_seconds",
		Help:      "HTTP request latency distribution.",
		Buckets:   []float64{.005, .01, .025, .05, .1, .25, .5, 1, 2.5, 5},
	}, []string{"method", "path"}),

	httpRequestsInflight: promauto.NewGauge(prometheus.GaugeOpts{
		Namespace: "audit",
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
		auditMetrics.httpRequestsInflight.Inc()
		defer auditMetrics.httpRequestsInflight.Dec()

		start := time.Now()
		rw := &responseWriter{ResponseWriter: w, statusCode: http.StatusOK}
		next.ServeHTTP(rw, r)

		duration := time.Since(start).Seconds()
		status := strconv.Itoa(rw.statusCode)
		path := normalizePath(r.URL.Path)

		auditMetrics.httpRequestsTotal.WithLabelValues(r.Method, path, status).Inc()
		auditMetrics.httpRequestDuration.WithLabelValues(r.Method, path).Observe(duration)
	})
}

func normalizePath(p string) string {
	switch p {
	case "/health":
		return "/health"
	case "/metrics":
		return "/metrics"
	case "/audit/logs":
		return "/audit/logs"
	}
	return "/unknown"
}
