"""SquidVeil error hierarchy.

All API failures raise :class:`SquidVeilError` (or a subclass). Every error
carries a stable ``code`` that matches the server's error code
(``CONSUMED``, ``EXPIRED``, ``BAD_SIGNATURE``, ``FORBIDDEN``, ...) plus the
HTTP status. Codes are stable across SDK versions — match on them, not on
messages.

Errors never contain secret values or access tokens.
"""

from __future__ import annotations

from typing import Optional


class SquidVeilError(Exception):
    """Base class for all SquidVeil SDK errors."""

    def __init__(self, message: str, code: str = "ERROR", status: Optional[int] = None) -> None:
        super().__init__(message)
        self.message = message
        self.code = code
        self.status = status

    def __str__(self) -> str:
        if self.status:
            return f"{self.code} ({self.status}): {self.message}"
        return f"{self.code}: {self.message}"


class ConfigurationError(SquidVeilError):
    """Invalid client configuration (missing URL/token, bad timeout, ...)."""

    def __init__(self, message: str) -> None:
        super().__init__(message, code="CONFIGURATION")


class AuthenticationError(SquidVeilError):
    """401-class: missing, invalid, revoked, or expired access token."""


class PermissionError(SquidVeilError):
    """403-class: the token lacks a capability for the requested path."""

    def __init__(self, message: str, code: str = "FORBIDDEN") -> None:
        super().__init__(message, code=code, status=403)


class NotFoundError(SquidVeilError):
    """404-class: secret, policy, token, or version does not exist."""


class VeilRefError(SquidVeilError):
    """VeilRef-specific failure: consumed, expired, bad signature, device mismatch."""

    def __init__(self, message: str, code: str, status: Optional[int] = None) -> None:
        super().__init__(message, code=code, status=status)


class RateLimitedError(SquidVeilError):
    """429: too many requests. Check ``retry_after`` for the suggested wait."""

    def __init__(self, message: str, retry_after: Optional[float] = None) -> None:
        super().__init__(message, code="RATE_LIMITED", status=429)
        self.retry_after = retry_after


class ServerError(SquidVeilError):
    """5xx: transient server failure. Safe to retry with backoff."""

    def __init__(self, message: str, code: str = "SERVER_ERROR", status: Optional[int] = None) -> None:
        super().__init__(message, code=code, status=status)


class NetworkError(SquidVeilError):
    """Connection-level failure (DNS, refused, timeout). Safe to retry."""

    def __init__(self, message: str) -> None:
        super().__init__(message, code="NETWORK")
