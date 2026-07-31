package squidveil

import (
	"context"
	"os"
	"testing"
)

// Live integration tests against a deployed SquidVeil API. Gated by
// SQUIDVEIL_LIVE=1 so normal test runs stay offline:
//
//	SQUIDVEIL_LIVE=1 SQUIDVEIL_URL=... SQUIDVEIL_TOKEN=sv_... go test -run Live
func TestLive(t *testing.T) {
	if os.Getenv("SQUIDVEIL_LIVE") != "1" {
		t.Skip("set SQUIDVEIL_LIVE=1 to run live integration tests")
	}
	ctx := context.Background()
	c, err := NewFromEnv()
	if err != nil {
		t.Fatalf("NewFromEnv: %v", err)
	}

	h, err := c.Health(ctx)
	if err != nil {
		t.Fatalf("Health: %v", err)
	}
	if !h.OK || h.Service != "squidveil-api" {
		t.Fatalf("unexpected health: %+v", h)
	}

	status, err := c.AuditVerify(ctx)
	if err != nil {
		t.Fatalf("AuditVerify: %v", err)
	}
	if !status.Valid || status.Checked == 0 {
		t.Fatalf("audit chain invalid: %+v", status)
	}

	ref, err := c.IssueVeilRef(ctx, "test/api-key", VeilRefIssueOptions{
		MaxUses: 2, RefTTL: 120, OpsAllowed: []string{"resolve", "verify"},
	})
	if err != nil {
		t.Fatalf("IssueVeilRef: %v", err)
	}

	verified, err := c.VerifyVeilRef(ctx, ref.JSON)
	if err != nil {
		t.Fatalf("VerifyVeilRef: %v", err)
	}
	if !verified.Verified {
		t.Fatal("not verified")
	}

	resolved, err := c.ResolveVeilRef(ctx, ref.JSON)
	if err != nil {
		t.Fatalf("ResolveVeilRef: %v", err)
	}
	if resolved.Value == "" {
		t.Fatal("empty value")
	}

	if _, err := c.ResolveVeilRef(ctx, ref.JSON); err == nil {
		t.Fatal("expected CONSUMED on 3rd use")
	} else if !IsVeilRefConsumed(err) {
		t.Fatalf("expected CONSUMED, got %v", err)
	}
}
