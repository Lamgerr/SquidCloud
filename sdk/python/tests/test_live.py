"""Live integration tests against a deployed SquidVeil API.

Gated by ``SQUIDVEIL_LIVE=1`` so normal test runs stay offline:

    SQUIDVEIL_LIVE=1 SQUIDVEIL_URL=... SQUIDVEIL_TOKEN=sv_... python -m unittest tests.test_live
"""

from __future__ import annotations

import os
import unittest

from squidveil import SquidVeilClient
from squidveil.errors import NotFoundError, PermissionError, VeilRefError

LIVE = os.environ.get("SQUIDVEIL_LIVE") == "1"


@unittest.skipUnless(LIVE, "set SQUIDVEIL_LIVE=1 to run live integration tests")
class LiveTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = SquidVeilClient.from_env(cache_ttl=0, max_retries=2)

    def test_health(self):
        health = self.client.health()
        self.assertTrue(health["ok"])
        self.assertEqual(health["service"], "squidveil-api")

    def test_veilref_roundtrip(self):
        name = "sdk/live-test"
        try:
            self.client.create_secret(name, "super-secret-value")
        except Exception:
            pass
        ref = self.client.issue_veilref(name, max_uses=2, ref_ttl=120, ops_allowed=["resolve", "verify"])
        verified = self.client.verify_veilref(ref.json)
        self.assertTrue(verified.verified)
        resolved = self.client.resolve_veilref(ref.json)
        self.assertEqual(resolved.value, "super-secret-value")
        with self.assertRaises(VeilRefError) as ctx:
            self.client.resolve_veilref(ref.json)
        self.assertEqual(ctx.exception.code, "CONSUMED")

    def test_audit_chain(self):
        status = self.client.audit_verify()
        self.assertTrue(status.valid)
        self.assertGreater(status.checked, 0)

    def test_missing_secret_raises_not_found(self):
        with self.assertRaises(NotFoundError):
            self.client.get_secret("sdk/does-not-exist-xyz")


if __name__ == "__main__":
    unittest.main()
