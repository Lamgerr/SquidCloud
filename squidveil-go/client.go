package squidveil

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"
)

// Client is the SquidVeil API client. Construct with New or NewFromEnv.
//
// The zero value is not usable; always build via the constructors.
type Client struct {
	url               string
	token             string
	timeout           time.Duration
	maxRetries        int
	deviceFingerprint string
	http              *http.Client

	cacheTTL time.Duration
	cacheMu  sync.Mutex
	cache    map[string]cacheEntry
}

type cacheEntry struct {
	at    time.Time
	value any
}

// Option configures a Client.
type Option func(*Client)

// WithTimeout sets the per-request timeout (default 30s).
func WithTimeout(d time.Duration) Option {
	return func(c *Client) { c.timeout = d }
}

// WithMaxRetries sets retry count for 429/5xx/network failures (default 3).
func WithMaxRetries(n int) Option {
	return func(c *Client) { c.maxRetries = n }
}

// WithCacheTTL enables in-memory caching of resolved secrets.
func WithCacheTTL(d time.Duration) Option {
	return func(c *Client) { c.cacheTTL = d }
}

// WithDeviceFingerprint binds issued VeilRefs to this device.
func WithDeviceFingerprint(fp string) Option {
	return func(c *Client) { c.deviceFingerprint = fp }
}

// WithHTTPClient replaces the underlying HTTP client (e.g. for tests).
func WithHTTPClient(hc *http.Client) Option {
	return func(c *Client) { c.http = hc }
}

// New builds a client. URL is the base URL of the SquidVeil API; token is
// the access token (sv_...). Both are required.
func New(baseURL, token string, opts ...Option) (*Client, error) {
	if baseURL == "" {
		return nil, &Error{Code: "CONFIGURATION", Message: "baseURL is required"}
	}
	if token == "" {
		return nil, &Error{Code: "CONFIGURATION", Message: "token is required"}
	}
	c := &Client{
		url:        stringsTrimRight(baseURL, "/"),
		token:      token,
		timeout:    defaultTimeout,
		maxRetries: defaultMaxRetries,
		http:       &http.Client{Timeout: defaultTimeout},
		cache:      make(map[string]cacheEntry),
	}
	for _, o := range opts {
		o(c)
	}
	return c, nil
}

// NewFromEnv builds a client from SQUIDVEIL_URL and SQUIDVEIL_TOKEN.
func NewFromEnv(opts ...Option) (*Client, error) {
	return New(os.Getenv("SQUIDVEIL_URL"), os.Getenv("SQUIDVEIL_TOKEN"), opts...)
}

// String redacts the token.
func (c *Client) String() string {
	return fmt.Sprintf("<SquidVeilClient url=%s token=***>", c.url)
}

// ClearCache empties the secret cache.
func (c *Client) ClearCache() {
	c.cacheMu.Lock()
	defer c.cacheMu.Unlock()
	c.cache = make(map[string]cacheEntry)
}

func (c *Client) cacheGet(key string) (any, bool) {
	if c.cacheTTL <= 0 {
		return nil, false
	}
	c.cacheMu.Lock()
	defer c.cacheMu.Unlock()
	e, ok := c.cache[key]
	if !ok {
		return nil, false
	}
	if time.Since(e.at) > c.cacheTTL {
		delete(c.cache, key)
		return nil, false
	}
	return e.value, true
}

func (c *Client) cacheSet(key string, v any) {
	if c.cacheTTL <= 0 {
		return
	}
	c.cacheMu.Lock()
	defer c.cacheMu.Unlock()
	c.cache[key] = cacheEntry{at: time.Now(), value: v}
}

// Health pings the API.
func (c *Client) Health(ctx context.Context) (*Health, error) {
	var out struct {
		OK      bool   `json:"ok"`
		Service string `json:"service"`
		Version int    `json:"version"`
	}
	if err := c.do(ctx, http.MethodGet, "/health", nil, &out); err != nil {
		return nil, err
	}
	return &Health{OK: out.OK, Service: out.Service, Version: out.Version}, nil
}

// GetSecret resolves a secret value (latest version by default). Values are
// cached for the configured TTL; the value lives only on the returned struct.
func (c *Client) GetSecret(ctx context.Context, name string, version ...int) (*SecretValue, error) {
	v := 0
	if len(version) > 0 {
		v = version[0]
	}
	cacheKey := name + ":" + strconv.Itoa(v)
	if cached, ok := c.cacheGet(cacheKey); ok {
		return cached.(*SecretValue), nil
	}

	path := "/v1/secrets/" + url.PathEscape(name)
	if v > 0 {
		path += "?version=" + strconv.Itoa(v)
	}
	var out struct {
		Name       string `json:"name"`
		Value      string `json:"value"`
		Version    int    `json:"version"`
		SecretType string `json:"secret_type"`
	}
	if err := c.do(ctx, http.MethodGet, path, nil, &out); err != nil {
		return nil, err
	}
	result := &SecretValue{
		Name:       out.Name,
		Value:      out.Value,
		Version:    out.Version,
		SecretType: out.SecretType,
	}
	c.cacheSet(cacheKey, result)
	return result, nil
}

// ListSecrets lists secrets visible to this token (path-scoped by policy).
func (c *Client) ListSecrets(ctx context.Context) ([]SecretMeta, error) {
	var out struct {
		Secrets []secretMetaJSON `json:"secrets"`
	}
	if err := c.do(ctx, http.MethodGet, "/v1/secrets", nil, &out); err != nil {
		return nil, err
	}
	metas := make([]SecretMeta, 0, len(out.Secrets))
	for _, s := range out.Secrets {
		metas = append(metas, s.toMeta())
	}
	return metas, nil
}

// ListVersions lists versions of a secret, newest first.
func (c *Client) ListVersions(ctx context.Context, name string) ([]VersionInfo, error) {
	var out struct {
		Versions []struct {
			VersionNumber int     `json:"version_number"`
			State         string  `json:"state"`
			CreatedBy     string  `json:"created_by"`
			CreatedAt     string  `json:"created_at"`
			DestroyedAt   *string `json:"destroyed_at"`
			KeyID         string  `json:"key_id"`
		} `json:"versions"`
	}
	if err := c.do(ctx, http.MethodGet, "/v1/secrets/"+url.PathEscape(name)+"/versions", nil, &out); err != nil {
		return nil, err
	}
	versions := make([]VersionInfo, 0, len(out.Versions))
	for _, v := range out.Versions {
		versions = append(versions, VersionInfo{
			VersionNumber: v.VersionNumber,
			State:         v.State,
			CreatedBy:     v.CreatedBy,
			CreatedAt:     v.CreatedAt,
			DestroyedAt:   v.DestroyedAt,
			KeyID:         v.KeyID,
		})
	}
	return versions, nil
}

// RotationStatus returns the rotation configuration for a secret.
func (c *Client) RotationStatus(ctx context.Context, name string) (*RotationStatus, error) {
	var out struct {
		Rotation struct {
			Enabled       bool    `json:"enabled"`
			IntervalDays  int     `json:"interval_days"`
			LastRotatedAt *string `json:"last_rotated_at"`
			NextRotatedAt *string `json:"next_rotation_at"`
			Source        string  `json:"source"`
		} `json:"rotation"`
	}
	if err := c.do(ctx, http.MethodGet, "/v1/secrets/"+url.PathEscape(name)+"/rotation", nil, &out); err != nil {
		return nil, err
	}
	return &RotationStatus{
		Enabled:       out.Rotation.Enabled,
		IntervalDays:  out.Rotation.IntervalDays,
		LastRotatedAt: out.Rotation.LastRotatedAt,
		NextRotatedAt: out.Rotation.NextRotatedAt,
		Source:        out.Rotation.Source,
	}, nil
}

// IssueVeilRef issues a signed VeilRef for a secret. Hand ref.JSON to the
// consumer — it is the only thing they need to verify or resolve once.
func (c *Client) IssueVeilRef(ctx context.Context, secretName string, opts VeilRefIssueOptions) (*VeilRef, error) {
	if opts.MaxUses <= 0 {
		opts.MaxUses = 1
	}
	if opts.RefTTL <= 0 {
		opts.RefTTL = 60
	}
	payload := map[string]any{
		"secret_name": secretName,
		"max_uses":    opts.MaxUses,
		"ref_ttl":     opts.RefTTL,
	}
	if len(opts.OpsAllowed) > 0 {
		payload["ops_allowed"] = opts.OpsAllowed
	}
	if opts.VersionSet {
		payload["version"] = opts.Version
	}
	var out struct {
		VeilRefJSON string `json:"veil_ref_json"`
	}
	if err := c.do(ctx, http.MethodPost, "/v1/veilref", payload, &out); err != nil {
		return nil, err
	}
	var ref map[string]any
	if err := json.Unmarshal([]byte(out.VeilRefJSON), &ref); err != nil {
		return nil, &Error{Code: "DECODE", Message: "failed to decode VeilRef"}
	}
	opsAllowed := make([]string, 0, len(opts.OpsAllowed))
	if oa, ok := ref["ops_allowed"].([]any); ok {
		for _, o := range oa {
			if s, ok := o.(string); ok {
				opsAllowed = append(opsAllowed, s)
			}
		}
	}
	return &VeilRef{
		RefID:         str(ref["ref_id"]),
		SecretName:    str(ref["secret_name"]),
		VersionNumber: intNum(ref["version_number"]),
		IssuedAt:      str(ref["issued_at"]),
		ExpiresAt:     str(ref["expires_at"]),
		UseCountMax:   intNum(ref["use_count_max"]),
		UseCountUsed:  intNum(ref["use_count_used"]),
		OpsAllowed:    opsAllowed,
		DeviceBound:   str(ref["device_bound"]) != "",
		JSON:          out.VeilRefJSON,
	}, nil
}

// VerifyVeilRef verifies a VeilRef without revealing the secret value.
func (c *Client) VerifyVeilRef(ctx context.Context, veilRefJSON string) (*VerificationResult, error) {
	var out struct {
		Verified      bool   `json:"verified"`
		SecretName    string `json:"secret_name"`
		VersionNumber int    `json:"version_number"`
	}
	if err := c.do(ctx, http.MethodPost, "/v1/veilref/verify", map[string]any{"veil_ref_json": veilRefJSON}, &out); err != nil {
		return nil, err
	}
	return &VerificationResult{Verified: out.Verified, SecretName: out.SecretName, VersionNumber: out.VersionNumber}, nil
}

// ResolveVeilRef resolves a VeilRef into the secret value (consumes one use).
func (c *Client) ResolveVeilRef(ctx context.Context, veilRefJSON string) (*Resolution, error) {
	var out struct {
		Value         string `json:"value"`
		SecretName    string `json:"secret_name"`
		VersionNumber int    `json:"version_number"`
	}
	if err := c.do(ctx, http.MethodPost, "/v1/veilref/resolve", map[string]any{"veil_ref_json": veilRefJSON}, &out); err != nil {
		return nil, err
	}
	return &Resolution{Value: out.Value, SecretName: out.SecretName, VersionNumber: out.VersionNumber}, nil
}

// CreateSecret creates a secret with an initial value (version 1).
func (c *Client) CreateSecret(ctx context.Context, name, value string, secretType ...string) (*SecretMeta, error) {
	t := "opaque"
	if len(secretType) > 0 && secretType[0] != "" {
		t = secretType[0]
	}
	var out struct {
		Secret secretMetaJSON `json:"secret"`
	}
	if err := c.do(ctx, http.MethodPost, "/v1/secrets", map[string]any{
		"name": name, "value": value, "secret_type": t,
	}, &out); err != nil {
		return nil, err
	}
	meta := out.Secret.toMeta()
	return &meta, nil
}

// RotateSecret rotates a secret (auto-generates a value unless provided).
func (c *Client) RotateSecret(ctx context.Context, name string, value ...string) (bool, error) {
	var payload map[string]any
	if len(value) > 0 && value[0] != "" {
		payload = map[string]any{"value": value[0]}
	}
	var out struct {
		Rotated bool `json:"rotated"`
	}
	if err := c.do(ctx, http.MethodPost, "/v1/secrets/"+url.PathEscape(name)+"/rotate", payload, &out); err != nil {
		return false, err
	}
	return out.Rotated, nil
}

// ConfigureRotation enables/disables scheduled rotation for a secret.
func (c *Client) ConfigureRotation(ctx context.Context, name string, enabled bool, intervalDays int) error {
	return c.do(ctx, http.MethodPost, "/v1/secrets/"+url.PathEscape(name)+"/rotation", map[string]any{
		"enabled": enabled, "interval_days": intervalDays,
	}, nil)
}

// SoftDelete soft-deletes a secret (recoverable within its recovery window).
func (c *Client) SoftDelete(ctx context.Context, name string) error {
	return c.do(ctx, http.MethodDelete, "/v1/secrets/"+url.PathEscape(name), nil, nil)
}

// Undelete restores a soft-deleted secret.
func (c *Client) Undelete(ctx context.Context, name string) error {
	return c.do(ctx, http.MethodPost, "/v1/secrets/"+url.PathEscape(name)+"/undelete", map[string]any{}, nil)
}

// Destroy permanently destroys a soft-deleted secret. Irreversible.
func (c *Client) Destroy(ctx context.Context, name string) error {
	return c.do(ctx, http.MethodPost, "/v1/secrets/"+url.PathEscape(name)+"/destroy", map[string]any{}, nil)
}

// AuditVerify verifies the HMAC audit chain is intact.
func (c *Client) AuditVerify(ctx context.Context) (*AuditStatus, error) {
	var out struct {
		Valid   bool `json:"valid"`
		Checked int  `json:"checked"`
		LastSeq int  `json:"last_seq"`
	}
	if err := c.do(ctx, http.MethodGet, "/v1/audit/verify", nil, &out); err != nil {
		return nil, err
	}
	return &AuditStatus{Valid: out.Valid, Checked: out.Checked, LastSeq: out.LastSeq}, nil
}

func str(v any) string {
	if s, ok := v.(string); ok {
		return s
	}
	return ""
}

func intNum(v any) int {
	switch n := v.(type) {
	case float64:
		return int(n)
	case int:
		return n
	case json.Number:
		i, _ := n.Int64()
		return int(i)
	}
	return 0
}

func stringsTrimRight(s, cut string) string {
	return strings.TrimRight(s, cut)
}
