package squidveil

// SecretValue is a resolved secret value. The Value is only ever in memory
// on this struct — never logged or serialized by the SDK.
type SecretValue struct {
	Name       string
	Value      string
	Version    int
	SecretType string
}

// SecretMeta is secret metadata returned by the list endpoint.
type SecretMeta struct {
	ID                 string
	Name               string
	Description        string
	Labels             map[string]string
	SecretType         string
	RecoveryWindowDays int
	CreatedAt          string
	UpdatedAt          string
	DeletedAt          *string
}

// VeilRef is a signed reference issued for a secret. JSON is the exact blob
// to hand to a consumer — it is the only thing they need to verify or
// resolve the secret once.
type VeilRef struct {
	RefID         string
	SecretName    string
	VersionNumber int
	IssuedAt      string
	ExpiresAt     string
	UseCountMax   int
	UseCountUsed  int
	OpsAllowed    []string
	DeviceBound   bool
	JSON          string
}

// VeilRefIssueOptions configures IssueVeilRef.
type VeilRefIssueOptions struct {
	MaxUses    int
	RefTTL     int
	OpsAllowed []string
	Version    int
	VersionSet bool
}

// VerificationResult is the result of a VeilRef verify call.
type VerificationResult struct {
	Verified      bool
	SecretName    string
	VersionNumber int
}

// Resolution is the result of a VeilRef resolve call.
type Resolution struct {
	Value         string
	SecretName    string
	VersionNumber int
}

// AuditStatus is the result of the audit chain verification.
type AuditStatus struct {
	Valid   bool
	Checked int
	LastSeq int
}

// RotationStatus is the rotation configuration for a secret.
type RotationStatus struct {
	Enabled       bool
	IntervalDays  int
	LastRotatedAt *string
	NextRotatedAt *string
	Source        string
}

// VersionInfo is one secret version.
type VersionInfo struct {
	VersionNumber int
	State         string
	CreatedBy     string
	CreatedAt     string
	DestroyedAt   *string
	KeyID         string
}

// Health is the health endpoint payload.
type Health struct {
	OK      bool
	Service string
	Version int
}

type secretMetaJSON struct {
	ID                 string            `json:"id"`
	Name               string            `json:"name"`
	Description        string            `json:"description"`
	Labels             map[string]string `json:"labels"`
	SecretType         string            `json:"secret_type"`
	RecoveryWindowDays int               `json:"recovery_window_days"`
	CreatedAt          string            `json:"created_at"`
	UpdatedAt          string            `json:"updated_at"`
	DeletedAt          *string           `json:"deleted_at"`
}

func (s secretMetaJSON) toMeta() SecretMeta {
	return SecretMeta{
		ID:                 s.ID,
		Name:               s.Name,
		Description:        s.Description,
		Labels:             s.Labels,
		SecretType:         s.SecretType,
		RecoveryWindowDays: s.RecoveryWindowDays,
		CreatedAt:          s.CreatedAt,
		UpdatedAt:          s.UpdatedAt,
		DeletedAt:          s.DeletedAt,
	}
}
