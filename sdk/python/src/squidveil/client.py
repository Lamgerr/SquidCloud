"""SquidVeil Python SDK — official client.

Zero runtime dependencies, typed errors, retries with jittered backoff,
optional TTL caching, and no secret ever written to logs.

Quick start:

    import os
    from squidveil import SquidVeilClient

    client = SquidVeilClient.from_env()
    secret = client.get_secret("prod/db-password")     # cached for cache_ttl
    print(secret.value)                                # in memory only

    ref = client.issue_veilref("prod/db-password", max_uses=1, ref_ttl=300)
    # hand ref.json to the consumer
    resolved = client.resolve_veilref(ref.json)        # one-shot on the consumer side
"""

from __future__ import annotations

import os
import threading
import time
from typing import Any, Dict, List, Optional

from ._http import request
from .errors import ConfigurationError
from .models import (
    AuditStatus,
    Resolution,
    RotationStatus,
    SecretMeta,
    SecretValue,
    VeilRef,
    VerificationResult,
    VersionInfo,
    _secret_meta_from_json,
)

DEFAULT_TIMEOUT = 30.0
DEFAULT_MAX_RETRIES = 3
DEFAULT_CACHE_TTL = 0.0
ENV_URL = "SQUIDVEIL_URL"
ENV_TOKEN = "SQUIDVEIL_TOKEN"


class _TTLCache:
    def __init__(self, ttl: float) -> None:
        self._ttl = ttl
        self._items: Dict[str, tuple[float, Any]] = {}
        self._lock = threading.Lock()

    def get(self, key: str) -> Any:
        if self._ttl <= 0:
            return None
        with self._lock:
            item = self._items.get(key)
        if item is None:
            return None
        ts, value = item
        if time.monotonic() - ts > self._ttl:
            with self._lock:
                self._items.pop(key, None)
            return None
        return value

    def set(self, key: str, value: Any) -> None:
        if self._ttl <= 0:
            return
        with self._lock:
            self._items[key] = (time.monotonic(), value)

    def clear(self) -> None:
        with self._lock:
            self._items.clear()


class SquidVeilClient:
    """Client for the SquidVeil REST API.

    Args:
        url: Base URL of the SquidVeil API (e.g. ``https://host/functions/v1/squidveil-api``).
        token: Access token (``sv_...``). Defaults to ``SQUIDVEIL_TOKEN`` env var.
        timeout: Per-request timeout in seconds.
        max_retries: Retries on 429/5xx/network failures (exponential backoff with jitter).
        cache_ttl: Cache resolved secrets for this many seconds (0 disables).
        device_fingerprint: Optional device identifier for device-bound VeilRefs.
    """

    def __init__(
        self,
        url: str,
        token: Optional[str] = None,
        timeout: float = DEFAULT_TIMEOUT,
        max_retries: int = DEFAULT_MAX_RETRIES,
        cache_ttl: float = DEFAULT_CACHE_TTL,
        device_fingerprint: Optional[str] = None,
    ) -> None:
        self.url = (url or os.environ.get(ENV_URL) or "").rstrip("/")
        if not self.url:
            raise ConfigurationError(f"url is required (or set {ENV_URL})")
        self.token = token or os.environ.get(ENV_TOKEN) or ""
        if not self.token:
            raise ConfigurationError(f"token is required (or set {ENV_TOKEN})")
        if timeout <= 0:
            raise ConfigurationError("timeout must be positive")
        if max_retries < 0:
            raise ConfigurationError("max_retries must be >= 0")
        if cache_ttl < 0:
            raise ConfigurationError("cache_ttl must be >= 0")
        self.timeout = float(timeout)
        self.max_retries = int(max_retries)
        self.device_fingerprint = device_fingerprint
        self._cache = _TTLCache(float(cache_ttl))

    @classmethod
    def from_env(cls, **kwargs: Any) -> "SquidVeilClient":
        """Build a client from ``SQUIDVEIL_URL`` and ``SQUIDVEIL_TOKEN``."""
        return cls(url=os.environ.get(ENV_URL, ""), token=os.environ.get(ENV_TOKEN), **kwargs)

    def __repr__(self) -> str:
        return f"<SquidVeilClient url={self.url!r} token=***>"

    @property
    def cache_enabled(self) -> bool:
        return self._cache._ttl > 0

    def clear_cache(self) -> None:
        self._cache.clear()

    def _headers(self, extra: Optional[Dict[str, str]] = None) -> Dict[str, str]:
        headers = {"Authorization": f"Bearer {self.token}"}
        if self.device_fingerprint:
            headers["x-squidveil-device"] = self.device_fingerprint
        if extra:
            headers.update(extra)
        return headers

    def _request(self, method: str, path: str, body: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        resp = request(
            self.url + path,
            method=method,
            headers=self._headers(),
            body=body,
            timeout=self.timeout,
            max_retries=self.max_retries,
        )
        return resp.json()

    def health(self) -> Dict[str, Any]:
        """Ping the API. Returns the raw health payload (service/version)."""
        return self._request("GET", "/health")

    # ----------------------------------------------------------
    # Secrets (consumer surface)
    # ----------------------------------------------------------

    def get_secret(self, name: str, version: Optional[int] = None) -> SecretValue:
        """Resolve a secret value (latest version by default).

        Values are cached for ``cache_ttl`` seconds when enabled. The value
        is returned only in the :class:`SecretValue` object — it is never
        included in logs or exception messages.
        """
        cache_key = f"{name}:{version if version is not None else 'latest'}"
        cached = self._cache.get(cache_key)
        if cached is not None:
            return cached

        query = f"?version={version}" if version is not None else ""
        data = self._request("GET", f"/v1/secrets/{self._quote(name)}{query}")
        result = SecretValue(
            name=str(data.get("name", name)),
            value=str(data.get("value", "")),
            version_number=int(data.get("version", 0)),
            secret_type=str(data.get("secret_type", "opaque")),
        )
        self._cache.set(cache_key, result)
        return result

    def list_secrets(self) -> List[SecretMeta]:
        """List secrets visible to this token (path-scoped by policy)."""
        data = self._request("GET", "/v1/secrets")
        return [_secret_meta_from_json(s) for s in data.get("secrets", [])]

    def list_versions(self, name: str) -> List[VersionInfo]:
        """List versions of a secret, newest first."""
        data = self._request("GET", f"/v1/secrets/{self._quote(name)}/versions")
        return [
            VersionInfo(
                version_number=int(v.get("version_number", 0)),
                state=str(v.get("state", "")),
                created_by=str(v.get("created_by", "")),
                created_at=str(v.get("created_at", "")),
                destroyed_at=v.get("destroyed_at"),
                key_id=str(v.get("key_id", "")),
            )
            for v in data.get("versions", [])
        ]

    def rotation_status(self, name: str) -> RotationStatus:
        """Get rotation configuration for a secret."""
        data = self._request("GET", f"/v1/secrets/{self._quote(name)}/rotation")
        r = data.get("rotation", {})
        return RotationStatus(
            enabled=bool(r.get("enabled", False)),
            interval_days=int(r.get("interval_days", 30)),
            last_rotated_at=r.get("last_rotated_at"),
            next_rotation_at=r.get("next_rotation_at"),
            source=str(r.get("source", "auto_generated")),
        )

    # ----------------------------------------------------------
    # VeilRefs (consumer handoff)
    # ----------------------------------------------------------

    def issue_veilref(
        self,
        secret_name: str,
        max_uses: int = 1,
        ref_ttl: int = 60,
        ops_allowed: Optional[List[str]] = None,
        version: Optional[int] = None,
    ) -> VeilRef:
        """Issue a signed VeilRef for a secret.

        Hand ``ref.json`` to the consumer — it is the only thing they need
        to verify or resolve the secret once.
        """
        body: Dict[str, Any] = {
            "secret_name": secret_name,
            "max_uses": max_uses,
            "ref_ttl": ref_ttl,
        }
        if ops_allowed is not None:
            body["ops_allowed"] = ops_allowed
        if version is not None:
            body["version"] = version
        data = self._request("POST", "/v1/veilref", body)
        ref_data = data.get("veil_ref_json")
        import json as _json

        ref = _json.loads(ref_data) if isinstance(ref_data, str) else {}
        return VeilRef(
            ref_id=str(ref.get("ref_id", "")),
            secret_name=str(ref.get("secret_name", "")),
            version_number=int(ref.get("version_number", 0)),
            issued_at=str(ref.get("issued_at", "")),
            expires_at=str(ref.get("expires_at", "")),
            use_count_max=int(ref.get("use_count_max", 0)),
            use_count_used=int(ref.get("use_count_used", 0)),
            ops_allowed=list(ref.get("ops_allowed", [])),
            json=str(ref_data),
            device_bound=bool(ref.get("device_bound")),
        )

    def verify_veilref(self, veil_ref_json: str) -> VerificationResult:
        """Verify a VeilRef without revealing the secret value.

        Safe to call from browser-side code; returns only a boolean.
        """
        data = self._request("POST", "/v1/veilref/verify", {"veil_ref_json": veil_ref_json})
        return VerificationResult(
            verified=bool(data.get("verified", False)),
            secret_name=str(data.get("secret_name", "")),
            version_number=int(data.get("version_number", 0)),
        )

    def resolve_veilref(self, veil_ref_json: str) -> Resolution:
        """Resolve a VeilRef into the secret value (consumes one use)."""
        data = self._request("POST", "/v1/veilref/resolve", {"veil_ref_json": veil_ref_json})
        return Resolution(
            value=str(data.get("value", "")),
            secret_name=str(data.get("secret_name", "")),
            version_number=int(data.get("version_number", 0)),
        )

    # ----------------------------------------------------------
    # Administration
    # ----------------------------------------------------------

    def create_secret(self, name: str, value: str, secret_type: str = "opaque", description: str = "") -> SecretMeta:
        """Create a secret with an initial value (version 1)."""
        data = self._request(
            "POST",
            "/v1/secrets",
            {"name": name, "value": value, "secret_type": secret_type, "description": description},
        )
        return _secret_meta_from_json(data.get("secret", {}))

    def rotate_secret(self, name: str, value: Optional[str] = None) -> bool:
        """Rotate a secret (auto-generates a value unless provided)."""
        body = {"value": value} if value is not None else {}
        data = self._request("POST", f"/v1/secrets/{self._quote(name)}/rotate", body)
        return bool(data.get("rotated", False))

    def configure_rotation(self, name: str, enabled: bool, interval_days: int = 30) -> RotationStatus:
        """Enable/disable scheduled rotation for a secret."""
        data = self._request(
            "POST",
            f"/v1/secrets/{self._quote(name)}/rotation",
            {"enabled": enabled, "interval_days": interval_days},
        )
        r = data.get("rotation", {})
        return RotationStatus(
            enabled=bool(r.get("enabled", enabled)),
            interval_days=int(r.get("interval_days", interval_days)),
            last_rotated_at=None,
            next_rotation_at=None,
            source="",
        )

    def soft_delete(self, name: str) -> bool:
        """Soft-delete a secret (recoverable within its recovery window)."""
        data = self._request("DELETE", f"/v1/secrets/{self._quote(name)}")
        return bool(data.get("deleted_at"))

    def undelete(self, name: str) -> bool:
        """Restore a soft-deleted secret."""
        data = self._request("POST", f"/v1/secrets/{self._quote(name)}/undelete", {})
        return data.get("secret", {}).get("deleted_at") is None

    def destroy(self, name: str) -> bool:
        """Permanently destroy a soft-deleted secret. Irreversible."""
        data = self._request("POST", f"/v1/secrets/{self._quote(name)}/destroy", {})
        return bool(data.get("destroyed", False))

    def audit_verify(self) -> AuditStatus:
        """Verify the HMAC audit chain is intact."""
        data = self._request("GET", "/v1/audit/verify")
        return AuditStatus(
            valid=bool(data.get("valid", False)),
            checked=int(data.get("checked", 0)),
            last_seq=int(data.get("last_seq", 0)),
        )

    @staticmethod
    def _quote(name: str) -> str:
        from urllib.parse import quote

        return quote(name, safe="")
