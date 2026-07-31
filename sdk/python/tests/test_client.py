"""Unit tests for the squidveil Python SDK (no network required)."""

from __future__ import annotations

import io
import json
import unittest
import urllib.error
from unittest import mock

import squidveil
from squidveil import SquidVeilClient
from squidveil.errors import (
    AuthenticationError,
    NetworkError,
    NotFoundError,
    PermissionError,
    RateLimitedError,
    VeilRefError,
)


class FakeResponse:
    def __init__(self, status, body, headers=None):
        self.status = status
        self._body = json.dumps(body).encode()
        self.headers = headers or {}
        self._buf = io.BytesIO(self._body)

    def read(self):
        return self._body

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


class FakeHTTPError(urllib.error.HTTPError):
    def __init__(self, status, body, headers=None):
        self._body = json.dumps(body).encode()
        super().__init__(
            "https://aouqcwbdoyrccjcrhzzi.supabase.co/functions/v1/squidveil-api",
            status,
            f"HTTP {status}",
            headers or {},
            None,
        )

    def read(self):
        return self._body


def make_client(**kwargs):
    return SquidVeilClient(
        url="https://aouqcwbdoyrccjcrhzzi.supabase.co/functions/v1/squidveil-api",
        token="sv_testtoken",
        **kwargs,
    )


class TestErrors(unittest.TestCase):
    def _http_call(self, status, body, headers=None):
        exc = FakeHTTPError(status, body, headers)
        with mock.patch("urllib.request.urlopen", side_effect=exc):
            return make_client()

    def test_401_maps_to_authentication_error(self):
        with mock.patch("urllib.request.urlopen", side_effect=FakeHTTPError(401, {"error": "Invalid access token", "code": "INVALID_TOKEN"})):
            with self.assertRaises(AuthenticationError) as ctx:
                make_client().health()
        self.assertEqual(ctx.exception.code, "INVALID_TOKEN")

    def test_403_maps_to_permission_error(self):
        with mock.patch("urllib.request.urlopen", side_effect=FakeHTTPError(403, {"error": "Token cannot read", "code": "FORBIDDEN"})):
            with self.assertRaises(PermissionError) as ctx:
                make_client().health()
        self.assertEqual(ctx.exception.code, "FORBIDDEN")
        self.assertEqual(ctx.exception.status, 403)

    def test_404_maps_to_not_found(self):
        with mock.patch("urllib.request.urlopen", side_effect=FakeHTTPError(404, {"error": "Secret not found", "code": "NOT_FOUND"})):
            with self.assertRaises(NotFoundError) as ctx:
                make_client().health()
        self.assertEqual(ctx.exception.code, "NOT_FOUND")

    def test_consumed_maps_to_veilref_error(self):
        with mock.patch("urllib.request.urlopen", side_effect=FakeHTTPError(401, {"error": "VeilRef consumed (max uses reached)", "code": "CONSUMED"})):
            with self.assertRaises(VeilRefError) as ctx:
                make_client().health()
        self.assertEqual(ctx.exception.code, "CONSUMED")

    def test_429_maps_to_rate_limited_with_retry_after(self):
        with mock.patch("urllib.request.urlopen", side_effect=FakeHTTPError(429, {"error": "Too many requests", "code": "RATE_LIMITED"}, {"Retry-After": "2"})):
            with self.assertRaises(RateLimitedError) as ctx:
                make_client(max_retries=0).health()
        self.assertEqual(ctx.exception.retry_after, 2.0)

    def test_network_error_after_retries(self):
        exc = OSError("Connection refused")
        with mock.patch("urllib.request.urlopen", side_effect=exc):
            with mock.patch("time.sleep"):
                with self.assertRaises(NetworkError):
                    make_client().health()

    def test_5xx_retried_then_raised(self):
        calls = {"n": 0}

        def fake_urlopen(req, timeout=None):
            calls["n"] += 1
            if calls["n"] < 3:
                raise FakeHTTPError(503, {"error": "boom", "code": "SERVER_ERROR"})
            return FakeResponse(200, {"ok": True, "service": "squidveil-api", "version": 9})

        with mock.patch("urllib.request.urlopen", side_effect=fake_urlopen), mock.patch("time.sleep"):
            result = make_client(max_retries=3).health()
        self.assertEqual(result["ok"], True)
        self.assertEqual(calls["n"], 3)


class TestAuth(unittest.TestCase):
    def test_bearer_header_sent(self):
        captured = {}

        def fake_urlopen(req, timeout=None):
            captured["headers"] = {k.lower(): v for k, v in req.header_items()}
            captured["method"] = req.get_method()
            return FakeResponse(200, {"ok": True, "service": "squidveil-api", "version": 9})

        with mock.patch("urllib.request.urlopen", side_effect=fake_urlopen):
            make_client().health()
        self.assertEqual(captured["headers"]["authorization"], "Bearer sv_testtoken")
        self.assertEqual(captured["headers"]["user-agent"], "squidveil-python/0.1.0")
        self.assertEqual(captured["method"], "GET")

    def test_device_header_sent_when_configured(self):
        captured = {}

        def fake_urlopen(req, timeout=None):
            captured["headers"] = {k.lower(): v for k, v in req.header_items()}
            return FakeResponse(200, {"ok": True})

        with mock.patch("urllib.request.urlopen", side_effect=fake_urlopen):
            make_client(device_fingerprint="dev-1").health()
        self.assertEqual(captured["headers"]["x-squidveil-device"], "dev-1")

    def test_token_from_env(self):
        captured = {}

        def fake_urlopen(req, timeout=None):
            captured["headers"] = {k.lower(): v for k, v in req.header_items()}
            return FakeResponse(200, {"ok": True})

        with mock.patch.dict("os.environ", {"SQUIDVEIL_TOKEN": "sv_envtoken"}):
            client = SquidVeilClient(url="https://aouqcwbdoyrccjcrhzzi.supabase.co/functions/v1/squidveil-api")
            with mock.patch("urllib.request.urlopen", side_effect=fake_urlopen):
                client.health()
        self.assertEqual(captured["headers"]["authorization"], "Bearer sv_envtoken")

    def test_missing_token_raises_configuration_error(self):
        with mock.patch.dict("os.environ", {}, clear=True):
            with self.assertRaises(squidveil.ConfigurationError):
                SquidVeilClient(url="https://aouqcwbdoyrccjcrhzzi.supabase.co/functions/v1/squidveil-api")

    def test_repr_redacts_token(self):
        client = make_client()
        self.assertNotIn("sv_testtoken", repr(client))
        self.assertIn("***", repr(client))


class TestSecrets(unittest.TestCase):
    def test_get_secret_parses_value(self):
        body = {"success": True, "name": "prod/db", "value": "s3cret", "version": 3, "secret_type": "opaque"}
        with mock.patch("urllib.request.urlopen", return_value=FakeResponse(200, body)):
            result = make_client().get_secret("prod/db")
        self.assertEqual(result.value, "s3cret")
        self.assertEqual(result.version_number, 3)
        self.assertEqual(result.name, "prod/db")

    def test_get_secret_quotes_name(self):
        captured = {}

        def fake_urlopen(req, timeout=None):
            captured["url"] = req.full_url
            return FakeResponse(200, {"success": True, "name": "a/b", "value": "v", "version": 1, "secret_type": "opaque"})

        with mock.patch("urllib.request.urlopen", side_effect=fake_urlopen):
            make_client().get_secret("a/b", version=2)
        self.assertIn("/v1/secrets/a%2Fb?version=2", captured["url"])

    def test_cache_serves_without_network(self):
        body = {"success": True, "name": "prod/db", "value": "s3cret", "version": 1, "secret_type": "opaque"}
        client = make_client(cache_ttl=60)
        with mock.patch("urllib.request.urlopen", return_value=FakeResponse(200, body)):
            first = client.get_secret("prod/db")
        self.assertEqual(first.value, "s3cret")
        with mock.patch("urllib.request.urlopen", side_effect=AssertionError("should not hit network")):
            second = client.get_secret("prod/db")
        self.assertEqual(second.value, "s3cret")
        client.clear_cache()
        with mock.patch("urllib.request.urlopen", side_effect=AssertionError("cache cleared")):
            self.assertRaises(AssertionError, client.get_secret, "prod/db")

    def test_issue_veilref_parses(self):
        ref_json = json.dumps({
            "ref_id": "abc123", "secret_name": "prod/db", "version_number": 2,
            "device_bound": "", "issued_at": "t0", "expires_at": "t1",
            "use_count_max": 1, "use_count_used": 0, "ops_allowed": ["resolve"],
            "hmac": "deadbeef",
        })
        body = {"success": True, "veil_ref_json": ref_json, "ref_id": "abc123"}
        with mock.patch("urllib.request.urlopen", return_value=FakeResponse(201, body)):
            ref = make_client().issue_veilref("prod/db", max_uses=1, ref_ttl=300)
        self.assertEqual(ref.ref_id, "abc123")
        self.assertEqual(ref.version_number, 2)
        self.assertIn("deadbeef", ref.json)

    def test_audit_verify_parses(self):
        with mock.patch("urllib.request.urlopen", return_value=FakeResponse(200, {"success": True, "valid": True, "checked": 40, "last_seq": 51})):
            status = make_client().audit_verify()
        self.assertTrue(status.valid)
        self.assertEqual(status.checked, 40)
        self.assertEqual(status.last_seq, 51)


if __name__ == "__main__":
    unittest.main()
