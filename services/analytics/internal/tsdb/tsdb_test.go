package tsdb

import (
	"testing"
	"time"
)

func TestSourceForDuration(t *testing.T) {
	cases := []struct {
		d    time.Duration
		want string
	}{
		{time.Minute, "metrics_rollup"},
		{time.Hour, "metrics_rollup"},
		{2 * time.Hour, "metrics_hourly"},
		{24 * time.Hour, "metrics_hourly"},
		{48 * time.Hour, "metrics_daily"},
		{720 * time.Hour, "metrics_daily"},
	}
	for _, c := range cases {
		if got := sourceForDuration(c.d); got != c.want {
			t.Errorf("sourceForDuration(%s) = %s, want %s", c.d, got, c.want)
		}
	}
}

func TestDiscreteStep(t *testing.T) {
	cases := []struct {
		d    time.Duration
		want string
	}{
		{time.Hour, "1 minute"},
		{24 * time.Hour, "1 minute"},
		{7 * 24 * time.Hour, "15 minutes"},
		{30 * 24 * time.Hour, "1 hour"},
		{120 * 24 * time.Hour, "3 hours"},
	}
	for _, c := range cases {
		if got := discreteStep(c.d); got != c.want {
			t.Errorf("discreteStep(%s) = %s, want %s", c.d, got, c.want)
		}
	}
}

func TestResolutionSource(t *testing.T) {
	cases := []struct {
		res   string
		table string
		col   string
	}{
		{"raw", "metrics_rollup", "time"},
		{"hour", "metrics_hourly", "bucket"},
		{"day", "metrics_daily", "bucket"},
		{"", "metrics_daily", "bucket"},
		{"unknown", "metrics_daily", "bucket"},
	}
	for _, c := range cases {
		table, col := resolutionSource(c.res)
		if table != c.table || col != c.col {
			t.Errorf("resolutionSource(%q) = (%s,%s), want (%s,%s)", c.res, table, col, c.table, c.col)
		}
	}
}

func TestParseInterval(t *testing.T) {
	cases := []struct {
		in   string
		want time.Duration
	}{
		{"15m", 30 * time.Minute},
		{"30m", 30 * time.Minute},
		{"1h", time.Hour},
		{"6h", 6 * time.Hour},
		{"12h", 12 * time.Hour},
		{"24h", 24 * time.Hour},
		{"1d", 24 * time.Hour},
		{"7d", 7 * 24 * time.Hour},
		{"30d", 30 * 24 * time.Hour},
		{"90d", 90 * 24 * time.Hour},
		{"2h", 2 * time.Hour},
		{"garbage", time.Hour},
	}
	for _, c := range cases {
		if got := parseInterval(c.in); got != c.want {
			t.Errorf("parseInterval(%q) = %s, want %s", c.in, got, c.want)
		}
	}
}

func TestWindowForInterval(t *testing.T) {
	if got := WindowForInterval("1h"); got != time.Hour {
		t.Errorf("WindowForInterval(1h) = %s, want 1h", got)
	}
	if got := WindowForInterval("bogus"); got != time.Hour {
		t.Errorf("WindowForInterval(bogus) = %s, want 1h default", got)
	}
}
