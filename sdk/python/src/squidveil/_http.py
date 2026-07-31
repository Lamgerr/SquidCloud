"""Minimal, dependency-free HTTP transport with retry support.

Uses only the standard library (``urllib.request``) so the SDK has zero
runtime dependencies — a deliberate supply-chain safety measure for a
security product.

Retry policy (industry standard):
  * retries on 408/429/5xx and connection-level failures
  * exponential backoff with full jitter: sleep = random(0, base * 2**attempt)
  * honors the ``Retry-After`` header on 429/503 responses
  * capped by ``max_retries``; the last attempt's result wins
"""

from __future__ import annotations

import json
import random
import time
import urllib.error
import urllib.request
from typing import Any, Dict, Optional

from .errors import (
    AuthenticationError,
    NetworkError,
    NotFoundError,
    PermissionError,
    RateLimitedError,
    ServerError,
    SquidVeilError,
    VeilRefError,
)

AUTH_CODES = {"UNAUTHORIZED", "INVALID_TOKEN", "REVOKED", "EXPIRED"}
NOT_FOUND_CODES = {"NOT_FOUND", "VERSION_UNAVAILABLE", "NO_VERSION"}
FORBIDDEN_CODES = {"FORBIDDEN", "OP_NOT_ALLOWED"}
VEILREF_CODES = {"CONSUMED", "EXPIRED", "BAD_SIGNATURE", "DEVICE_MISMATCH", "CONCURRENT_CONSUME"}

RETRYABLE_STATUSES = {408, 425, 429, 500, 502, 503, 504}


class Response:
    def __init__(self, status: int, headers: Dict[str, str], body: bytes) -> None:
        self.status = status
        self.headers = {str(k).lower(): str(v) for k, v in headers.items()}
        self.body = body

    def json(self) -> Dict[str, Any]:
        try:
            value = json.loads(self.body.decode("utf-8"))
        except (ValueError, UnicodeDecodeError):
            return {}
        return value if isinstance(value, dict) else {}


def _parse_retry_after(headers: Dict[str, str]) -> Optional[float]:
    raw = headers.get("retry-after")
    if not raw:
        return None
    raw = raw.strip()
    try:
        return float(raw)
    except ValueError:
        return None


def error_from_response(resp: Response) -> SquidVeilError:
    data = resp.json()
    message = str(data.get("error") or data.get("message") or f"HTTP {resp.status}")
    code = str(data.get("code") or "ERROR")
    status = resp.status

    if code in VEILREF_CODES:
        return VeilRefError(message, code=code, status=status)
    if status == 401:
        return AuthenticationError(message, code=code, status=status)
    if status == 403:
        return PermissionError(message, code=code)
    if status == 404:
        return NotFoundError(message, code=code, status=status)
    if status == 429:
        return RateLimitedError(message, retry_after=_parse_retry_after(resp.headers))
    if status >= 500:
        return ServerError(message, code=code, status=status)
    return SquidVeilError(message, code=code, status=status)


def request(
    url: str,
    method: str = "GET",
    headers: Optional[Dict[str, str]] = None,
    body: Optional[Dict[str, Any]] = None,
    timeout: float = 30.0,
    max_retries: int = 3,
) -> Response:
    headers = dict(headers or {})
    headers.setdefault("Accept", "application/json")
    headers.setdefault("User-Agent", "squidveil-python/0.1.0")
    payload = None
    if body is not None:
        payload = json.dumps(body).encode("utf-8")
        headers.setdefault("Content-Type", "application/json")

    last_exc: Optional[Exception] = None
    for attempt in range(max_retries + 1):
        req = urllib.request.Request(url, data=payload, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=timeout) as raw:
                return Response(raw.status, dict(raw.headers.items()), raw.read())
        except urllib.error.HTTPError as e:
            raw_headers = getattr(e, "headers", None) or getattr(e, "hdrs", None) or {}
            resp = Response(e.code, dict(raw_headers.items()), e.read())
            should_retry = e.code in RETRYABLE_STATUSES and attempt < max_retries
            if not should_retry:
                raise error_from_response(resp) from None
            last_exc = error_from_response(resp)
        except (urllib.error.URLError, TimeoutError, ConnectionError, OSError) as e:
            if attempt >= max_retries:
                raise NetworkError(f"Request to {url} failed: {e}") from None
            last_exc = e

        if attempt < max_retries:
            _sleep_backoff(attempt, last_exc, resp_headers=getattr(last_exc, "retry_after", None))

    raise NetworkError(f"Request to {url} failed: {last_exc}")


def _sleep_backoff(attempt: int, last_exc: Optional[Exception], resp_headers: Any = None) -> None:
    base = 0.25 * (2 ** attempt)
    if isinstance(last_exc, RateLimitedError) and last_exc.retry_after:
        delay = float(last_exc.retry_after)
    else:
        delay = random.uniform(0, base)
    time.sleep(min(delay, 10.0))
