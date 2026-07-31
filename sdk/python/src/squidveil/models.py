"""Response models for the SquidVeil SDK."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional


@dataclass(frozen=True)
class SecretValue:
    """A resolved secret value.

    The value is only ever present in memory on this object — never logged,
    never serialized by the SDK.
    """

    name: str
    value: str
    version_number: int
    secret_type: str


@dataclass(frozen=True)
class SecretMeta:
    """Secret metadata returned by the list endpoint."""

    id: str
    name: str
    description: str
    labels: Dict[str, str]
    secret_type: str
    recovery_window_days: int
    created_at: str
    updated_at: str
    deleted_at: Optional[str] = None


@dataclass(frozen=True)
class VeilRef:
    """A signed VeilRef issued for a secret.

    ``json`` is the exact JSON blob to hand to a consumer (it contains the
    HMAC). The consumer passes it back as ``veil_ref_json`` to
    :meth:`SquidVeilClient.verify_veilref` or
    :meth:`SquidVeilClient.resolve_veilref`.
    """

    ref_id: str
    secret_name: str
    version_number: int
    issued_at: str
    expires_at: str
    use_count_max: int
    use_count_used: int
    ops_allowed: List[str]
    json: str
    device_bound: bool = False


@dataclass(frozen=True)
class VerificationResult:
    """Result of a VeilRef verify call."""

    verified: bool
    secret_name: str
    version_number: int


@dataclass(frozen=True)
class Resolution:
    """Result of a VeilRef resolve call."""

    value: str
    secret_name: str
    version_number: int


@dataclass(frozen=True)
class AuditStatus:
    """Result of the audit chain verification."""

    valid: bool
    checked: int
    last_seq: int


@dataclass(frozen=True)
class RotationStatus:
    """Rotation configuration and state for a secret."""

    enabled: bool
    interval_days: int
    last_rotated_at: Optional[str]
    next_rotation_at: Optional[str]
    source: str


@dataclass(frozen=True)
class VersionInfo:
    """One secret version."""

    version_number: int
    state: str
    created_by: str
    created_at: str
    destroyed_at: Optional[str]
    key_id: str


def _secret_meta_from_json(data: Dict[str, Any]) -> SecretMeta:
    return SecretMeta(
        id=str(data.get("id", "")),
        name=str(data.get("name", "")),
        description=str(data.get("description", "") or ""),
        labels=dict(data.get("labels") or {}),
        secret_type=str(data.get("secret_type", "")),
        recovery_window_days=int(data.get("recovery_window_days", 0)),
        created_at=str(data.get("created_at", "")),
        updated_at=str(data.get("updated_at", "")),
        deleted_at=data.get("deleted_at"),
    )
