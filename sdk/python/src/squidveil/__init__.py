"""squidveil — official Python SDK for SquidVeil."""

from .client import SquidVeilClient
from .errors import (
    AuthenticationError,
    ConfigurationError,
    NetworkError,
    NotFoundError,
    PermissionError,
    RateLimitedError,
    ServerError,
    SquidVeilError,
    VeilRefError,
)
from .models import (
    AuditStatus,
    Resolution,
    RotationStatus,
    SecretMeta,
    SecretValue,
    VeilRef,
    VerificationResult,
    VersionInfo,
)

__version__ = "0.1.0"

__all__ = [
    "SquidVeilClient",
    "SquidVeilError",
    "AuthenticationError",
    "ConfigurationError",
    "NetworkError",
    "NotFoundError",
    "PermissionError",
    "RateLimitedError",
    "ServerError",
    "VeilRefError",
    "AuditStatus",
    "Resolution",
    "RotationStatus",
    "SecretMeta",
    "SecretValue",
    "VeilRef",
    "VerificationResult",
    "VersionInfo",
    "__version__",
]
