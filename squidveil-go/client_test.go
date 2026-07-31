package squidveil

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"
)

func newTestClient(t *testing.T, handler http.HandlerFunc) (*Client, *httptest.Server) {
	t.Helper()
	srv := httptest.NewServer(handler)
	c, err := New(srv.URL, "sv_testtoken", WithMaxRetries(2), WithTimeout(5*time.Second))
	if err != nil {
		t.Fatalf("New: %v", err)
	}
	return c, srv
}

func writeJSON(t *testing.T, w http.ResponseWriter, status int, body any) {
	t.Helper()
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

func TestNewRequiresURLAndToken(t *testing.T) {
	if _, err := New("", "tok"); err == nil {
		t.Fatal("expected error for empty URL")
	}
	if _, err := New("https://x", ""); err == nil {
		t.Fatal("expected error for empty token")
	}
}

func TestStringRedactsToken(t *testing.T) {
	c, _ := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {
		writeJSON(t, w, 200, map[string]any{"ok": true})
	})
	s := c.String()
	if contains(s, "sv_testtoken") {
		t.Fatalf("String() leaked token: %s", s)
	}
}

func TestHealth(t *testing.T) {
	c, srv := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/health" {
			t.Errorf("path = %q", r.URL.Path)
		}
		if got := r.Header.Get("Authorization"); got != "Bearer sv_testtoken" {
			t.Errorf("Authorization = %q", got)
		}
		if got := r.Header.Get("User-Agent"); got != "squidveil-go/0.1.0" {
			t.Errorf("User-Agent = %q", got)
		}
		writeJSON(t, w, 200, map[string]any{"ok": true, "service": "squidveil-api", "version": 9})
	})
	defer srv.Close()

	h, err := c.Health(context.Background())
	if err != nil {
		t.Fatalf("Health: %v", err)
	}
	if !h.OK || h.Service != "squidveil-api" || h.Version != 9 {
		t.Fatalf("unexpected health: %+v", h)
	}
}

func TestGetSecretParsesAndCaches(t *testing.T) {
	var calls atomic.Int64
	c, srv := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		if r.URL.EscapedPath() != "/v1/secrets/prod%2Fdb" {
			t.Errorf("path = %q", r.URL.EscapedPath())
		}
		writeJSON(t, w, 200, map[string]any{
			"success": true, "name": "prod/db", "value": "s3cret", "version": 3, "secret_type": "opaque",
		})
	})
	defer srv.Close()
	c.cacheTTL = time.Minute

	first, err := c.GetSecret(context.Background(), "prod/db")
	if err != nil {
		t.Fatalf("GetSecret: %v", err)
	}
	second, err := c.GetSecret(context.Background(), "prod/db")
	if err != nil {
		t.Fatalf("GetSecret: %v", err)
	}
	if first.Value != "s3cret" || second.Value != "s3cret" {
		t.Fatalf("unexpected values: %+v %+v", first, second)
	}
	if calls.Load() != 1 {
		t.Fatalf("expected 1 network call, got %d", calls.Load())
	}
}

func TestGetSecretURLEncoding(t *testing.T) {
	var gotPath string
	c, srv := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.EscapedPath() + "?" + r.URL.RawQuery
		writeJSON(t, w, 200, map[string]any{
			"success": true, "name": "a/b", "value": "v", "version": 2, "secret_type": "opaque",
		})
	})
	defer srv.Close()
	_, err := c.GetSecret(context.Background(), "a/b", 2)
	if err != nil {
		t.Fatalf("GetSecret: %v", err)
	}
	if gotPath != "/v1/secrets/a%2Fb?version=2" {
		t.Fatalf("path = %q", gotPath)
	}
}

func TestErrors(t *testing.T) {
	cases := []struct {
		name          string
		status        int
		code          string
		wantCode      string
		isNotFound    bool
		isPermission  bool
		isRateLimited bool
	}{
		{"not_found", 404, "NOT_FOUND", "NOT_FOUND", true, false, false},
		{"forbidden", 403, "FORBIDDEN", "FORBIDDEN", false, true, false},
		{"rate_limited", 429, "RATE_LIMITED", "RATE_LIMITED", false, false, true},
		{"consumed", 401, "CONSUMED", "CONSUMED", false, false, false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			c, srv := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {
				writeJSON(t, w, tc.status, map[string]any{"error": "boom", "code": tc.code})
			})
			defer srv.Close()
			_, err := c.Health(context.Background())
			e, ok := err.(*Error)
			if !ok {
				t.Fatalf("expected *Error, got %T", err)
			}
			if e.Code != tc.wantCode {
				t.Fatalf("code = %q, want %q", e.Code, tc.wantCode)
			}
			if e.Status != tc.status {
				t.Fatalf("status = %d, want %d", e.Status, tc.status)
			}
			if tc.isNotFound && !IsNotFound(err) {
				t.Fatal("IsNotFound = false")
			}
			if tc.isPermission && !IsPermission(err) {
				t.Fatal("IsPermission = false")
			}
			if tc.isRateLimited && !IsRateLimited(err) {
				t.Fatal("IsRateLimited = false")
			}
			if tc.code == "CONSUMED" && !IsVeilRefConsumed(err) {
				t.Fatal("IsVeilRefConsumed = false")
			}
		})
	}
}

func TestRetryThenSuccess(t *testing.T) {
	var calls atomic.Int64
	c, srv := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {
		if calls.Add(1) < 3 {
			writeJSON(t, w, 503, map[string]any{"error": "boom", "code": "SERVER_ERROR"})
			return
		}
		writeJSON(t, w, 200, map[string]any{"ok": true, "service": "squidveil-api", "version": 9})
	})
	defer srv.Close()

	h, err := c.Health(context.Background())
	if err != nil {
		t.Fatalf("Health: %v", err)
	}
	if !h.OK {
		t.Fatal("not ok")
	}
	if calls.Load() != 3 {
		t.Fatalf("calls = %d, want 3", calls.Load())
	}
}

func TestIssueAndResolveVeilRef(t *testing.T) {
	refJSON, _ := json.Marshal(map[string]any{
		"ref_id": "abc123", "secret_name": "prod/db", "version_number": 2,
		"device_bound": "", "issued_at": "t0", "expires_at": "t1",
		"use_count_max": 1, "use_count_used": 0, "ops_allowed": []string{"resolve"},
		"hmac": "deadbeef",
	})
	c, srv := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/v1/veilref":
			writeJSON(t, w, 201, map[string]any{"success": true, "veil_ref_json": string(refJSON), "ref_id": "abc123"})
		case "/v1/veilref/resolve":
			writeJSON(t, w, 200, map[string]any{
				"success": true, "value": "resolved-value", "secret_name": "prod/db", "version_number": 2,
			})
		default:
			t.Errorf("unexpected path %q", r.URL.Path)
		}
	})
	defer srv.Close()

	ref, err := c.IssueVeilRef(context.Background(), "prod/db", VeilRefIssueOptions{MaxUses: 1, RefTTL: 300})
	if err != nil {
		t.Fatalf("IssueVeilRef: %v", err)
	}
	if ref.RefID != "abc123" || ref.VersionNumber != 2 || ref.UseCountMax != 1 {
		t.Fatalf("unexpected ref: %+v", ref)
	}
	if !contains(ref.JSON, "deadbeef") {
		t.Fatal("JSON missing hmac")
	}

	res, err := c.ResolveVeilRef(context.Background(), ref.JSON)
	if err != nil {
		t.Fatalf("ResolveVeilRef: %v", err)
	}
	if res.Value != "resolved-value" {
		t.Fatalf("value = %q", res.Value)
	}
}

func TestAuditVerify(t *testing.T) {
	c, srv := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {
		writeJSON(t, w, 200, map[string]any{"success": true, "valid": true, "checked": 48, "last_seq": 59})
	})
	defer srv.Close()
	status, err := c.AuditVerify(context.Background())
	if err != nil {
		t.Fatalf("AuditVerify: %v", err)
	}
	if !status.Valid || status.Checked != 48 || status.LastSeq != 59 {
		t.Fatalf("unexpected: %+v", status)
	}
}

func contains(s, sub string) bool {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return true
		}
	}
	return false
}
