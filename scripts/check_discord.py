#!/usr/bin/env python3
"""Verify a Discord ID against the stored secret DISCORD_ID in SquidVeil."""

import argparse
import os
import sys
import urllib.request
import urllib.error
import json

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://aouqcwbdoyrccjcrhzzi.supabase.co")
API_BASE = f"{SUPABASE_URL}/functions/v1/cloudbliss-api"
SECRET_NAME = "DISCORD_ID"


def main():
    parser = argparse.ArgumentParser(description="Verify a Discord ID against SquidVeil secrets")
    parser.add_argument("discord_id", nargs="?", help="Discord ID to verify")
    parser.add_argument("--api-key", help="SquidCloud API key (or set SQUIDCLOUD_API_KEY env var)")
    parser.add_argument("--api-url", default=API_BASE, help="CloudBliss API base URL")
    args = parser.parse_args()

    api_key = args.api_key or os.environ.get("SQUIDCLOUD_API_KEY")
    if not api_key:
        api_key = input("Enter your SquidCloud API key: ").strip()
        if not api_key:
            print("Error: API key is required", file=sys.stderr)
            sys.exit(1)

    discord_id = args.discord_id
    if not discord_id:
        discord_id = input("Enter the Discord ID to verify: ").strip()
        if not discord_id:
            print("Error: Discord ID is required", file=sys.stderr)
            sys.exit(1)

    url = f"{args.api_url.rstrip('/')}/secrets/{SECRET_NAME}/verify"
    payload = json.dumps({"value": discord_id}).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "X-SquidCloud-Key": api_key,
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        print(f"Error {e.code}: {body}", file=sys.stderr)
        sys.exit(1)
    except urllib.error.URLError as e:
        print(f"Network error: {e.reason}", file=sys.stderr)
        sys.exit(1)

    if data.get("matched"):
        print("MATCHED")
        sys.exit(0)
    else:
        print("NOT_MATCHED")
        sys.exit(1)


if __name__ == "__main__":
    main()
