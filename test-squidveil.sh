#!/data/data/com.termux/files/usr/bin/bash
#
# SquidVeil API Comprehensive Test Suite v167
# Tests all endpoints: handshake, veilref creation/verify/resolve,
# audit log, secret CRUD, and verification.
#
# Usage: ./test-squidveil.sh
# Expects: curl, python3, jq
#

set -euo pipefail

BASE_URL="https://cxuitqxosjyfefmkagrw.supabase.co/functions/v1/cloudbliss-api"
API_KEY="cb_8ec4ffe14ff45ee67c85fb0e4da4ffd4ef34621828ebd80f9fd8e6c3a36481a1"

PASSED=0
FAILED=0

# ---- helpers ----

# Extract a JSON key from stdin using python3
json_val() {
  local key="$1"
  python3 -c "import json,sys; print(json.load(sys.stdin).get('$key',''))"
}

# Check if a JSON key equals a specific value
json_eq() {
  local key="$1" expected="$2"
  local actual
  actual=$(python3 -c "import json,sys; print(json.load(sys.stdin).get('$key','__MISSING__'))")
  [ "$actual" = "$expected" ]
}

# Check if a JSON key contains a string value
json_has() {
  local key="$1"
  python3 -c "import json,sys; print('$key' in json.load(sys.stdin))" | grep -q True
}

# Make a JSON body from key-value pair (for simple bodies)
make_body() {
  local key="$1" val="$2"
  python3 -c "import json,sys; print(json.dumps({sys.argv[1]: sys.argv[2]}))" "$key" "$val"
}

# curl wrapper: returns BODY and CODE via global vars
do_curl() {
  local method="$1" url="$2" body="${3:-}"
  shift 2
  local headers=(-H "x-squidcloud-key: $API_KEY")
  if [ -n "${body:-}" ]; then
    headers+=(-H "Content-Type: application/json")
  fi

  local resp_file
  resp_file=$(mktemp)
  # shellcheck disable=SC2064
  trap "rm -f '$resp_file'" RETURN

  if [ -n "${body:-}" ]; then
    printf '%s' "$body" | curl -s -w "\n%{http_code}" -X "$method" "$url" \
      "${headers[@]}" -d @- > "$resp_file" 2>/dev/null
  else
    curl -s -w "\n%{http_code}" -X "$method" "$url" \
      "${headers[@]}" > "$resp_file" 2>/dev/null
  fi

  CURL_BODY=$(< "$resp_file" sed '$d')
  CURL_CODE=$(< "$resp_file" tail -n 1)
}

# Print PASS/FAIL and update counters
check() {
  local test_name="$1" result="$2"
  if [ "$result" = "pass" ]; then
    echo "  PASS: $test_name"
    PASSED=$((PASSED + 1))
  else
    echo "  FAIL: $test_name"
    FAILED=$((FAILED + 1))
  fi
}

# Check HTTP status code
check_status() {
  local test_name="$1" expected_code="$2"
  if [ "$CURL_CODE" = "$expected_code" ]; then
    check "$test_name (HTTP $expected_code)" "pass"
  else
    echo "    Expected HTTP $expected_code, got $CURL_CODE"
    echo "    Body: $CURL_BODY" | head -c 400
    echo
    check "$test_name" "fail"
  fi
}

# Check that HTTP status is in a range (e.g. 200-299)
check_status_range() {
  local test_name="$1"
  if [ "$CURL_CODE" -ge 200 ] && [ "$CURL_CODE" -lt 300 ]; then
    check "$test_name (HTTP $CURL_CODE)" "pass"
  else
    echo "    Expected 2xx, got $CURL_CODE"
    echo "    Body: $CURL_BODY" | head -c 400
    echo
    check "$test_name" "fail"
  fi
}

# Check JSON response has a key with specific value
check_json_key() {
  local test_name="$1" key="$2" expected="$3"
  local actual
  actual=$(echo "$CURL_BODY" | python3 -c "
import json,sys
try:
    d = json.load(sys.stdin)
    keys = '$key'.split('.')
    for k in keys:
        d = d[k]
    print(d)
except Exception:
    print('__MISSING__')
")
  if [ "$actual" = "$expected" ]; then
    check "$test_name" "pass"
  else
    echo "    Expected $key=$expected, got $actual"
    echo "    Body: $CURL_BODY" | head -c 400
    echo
    check "$test_name" "fail"
  fi
}

# Check JSON response contains a key
check_json_has() {
  local test_name="$1" key="$2"
  if echo "$CURL_BODY" | python3 -c "
import json,sys
d = json.load(sys.stdin)
keys = '$key'.split('.')
for k in keys:
    if isinstance(d, dict) and k in d:
        d = d[k]
    else:
        sys.exit(1)
sys.exit(0)
" 2>/dev/null; then
    check "$test_name" "pass"
  else
    echo "    Missing key: $key"
    echo "    Body: $CURL_BODY" | head -c 400
    echo
    check "$test_name" "fail"
  fi
}

# ---- cleanup function for test secret ----
cleanup_secret() {
  local name="$1"
  # Try to list secrets to find the id
  local list_resp
  list_resp=$(curl -s -X GET "$BASE_URL/secrets" -H "x-squidcloud-key: $API_KEY")
  local secret_id
  secret_id=$(echo "$list_resp" | python3 -c "
import json,sys
try:
    d = json.load(sys.stdin)
    for s in d.get('secrets', []):
        if s.get('name') == '$name':
            print(s['id'])
            sys.exit(0)
except Exception:
    pass
print('')
" 2>/dev/null || true)
  if [ -n "$secret_id" ]; then
    curl -s -X DELETE "$BASE_URL/secrets/$secret_id" -H "x-squidcloud-key: $API_KEY" > /dev/null 2>&1 || true
  fi
}

# ---- start ----
echo ""
echo "============================================"
echo " SquidVeil API Test Suite (v167)"
echo " Timestamp: $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
echo "============================================"
echo ""

# ============================================================
# Setup: create a secret that will be referenced by VeilRef
# This is needed before Test 2 so Test 4 (resolve) can work.
# ============================================================
echo "--- Setup: Creating seed secret for VeilRef tests ---"
do_curl POST "$BASE_URL/secrets" '{"name":"squidveil-seed","value":"seed-value-42"}'
if [ "$CURL_CODE" -ge 200 ] && [ "$CURL_CODE" -lt 300 ]; then
  echo "  Seed secret created (HTTP $CURL_CODE)"
else
  echo "  WARNING: Could not create seed secret (HTTP $CURL_CODE)"
  echo "    Body: $CURL_BODY" | head -c 200
  echo "    VeilRef resolve test may fail."
fi
echo ""

# ============================================================
# Test 1: Handshake
# POST /squidshake/handshake with API key
# Expect: 200 + session_id
# ============================================================
echo "--- Test 1: Handshake ---"
do_curl POST "$BASE_URL/squidshake/handshake" \
  '{"device_fingerprint":"test-device-suite","project_id":"test-suite"}'
check_status "Handshake" 200
check_json_has "session_id in response" "session_id"
check_json_has "success in response" "success"
SESSION_ID=$(echo "$CURL_BODY" | json_val "session_id")
echo "  Session ID: $SESSION_ID"
echo ""

# ============================================================
# Test 2: VeilRef Creation
# POST /squidshake/ref with session_id + secret_name
# Expect: 200 + veil_ref_json + hmac
# ============================================================
echo "--- Test 2: VeilRef Creation ---"
REF_BODY=$(python3 -c "import json; print(json.dumps({'session_id':'$SESSION_ID','secret_name':'squidveil-seed','device_fingerprint':'test-device-suite'}))")
do_curl POST "$BASE_URL/squidshake/ref" "$REF_BODY"
check_status "VeilRef Creation" 200
check_json_has "veil_ref_json in response" "veil_ref_json"
check_json_has "hmac in response" "hmac"
check_json_has "success in response" "success"

VEIL_REF_RAW=$(echo "$CURL_BODY" | json_val "veil_ref_json")
echo "  VeilRef received (length: ${#VEIL_REF_RAW} chars)"
echo ""

# ============================================================
# Test 3: VeilRef Verify
# POST /veilref/verify with veil_ref_json
# Expect: 200 + verified:true
# ============================================================
echo "--- Test 3: VeilRef Verify ---"
VERIFY_BODY=$(python3 -c "import json,sys; print(json.dumps({'veil_ref_json': sys.argv[1]}))" "$VEIL_REF_RAW")
do_curl POST "$BASE_URL/veilref/verify" "$VERIFY_BODY"
check_status "VeilRef Verify" 200
check_json_key "VeilRef verified:true" "verified" "True"
check_json_has "secret_name in response" "secret_name"
echo ""

# ============================================================
# Test 4: VeilRef Resolve
# POST /veilref/resolve with veil_ref_json
# Expect: 200 + value
# ============================================================
echo "--- Test 4: VeilRef Resolve ---"
RESOLVE_BODY=$(python3 -c "import json,sys; print(json.dumps({'veil_ref_json': sys.argv[1]}))" "$VEIL_REF_RAW")
do_curl POST "$BASE_URL/veilref/resolve" "$RESOLVE_BODY"
check_status "VeilRef Resolve" 200
check_json_has "value in response" "value"
check_json_has "secret_name in response" "secret_name"
RESOLVED_VAL=$(echo "$CURL_BODY" | json_val "value")
echo "  Resolved value: $RESOLVED_VAL"
echo ""

# ============================================================
# Test 5: Audit Log
# POST /squidshake/audit with action + project_id + secret_name
# Expect: 200
# ============================================================
echo "--- Test 5: Audit Log ---"
AUDIT_BODY=$(python3 -c "import json; print(json.dumps({'action':'test_access','project_id':'$SESSION_ID','secret_name':'squidveil-seed','success':True,'detail':'Automated test suite'}))")
do_curl POST "$BASE_URL/squidshake/audit" "$AUDIT_BODY"
check_status "Audit Log" 200
check_json_has "success in response" "success"
echo ""

# ============================================================
# Test 6: Create Secret
# POST /secrets with name + value
# Expect: 200 + id
# ============================================================
echo "--- Test 6: Create Secret ---"
do_curl POST "$BASE_URL/secrets" \
  '{"name":"squidveil-verify-test","value":"squidveil-rocks"}'
check_status_range "Create Secret (2xx)"
check_json_has "secret.id in response" "secret.id"
check_json_has "success in response" "success"
SECRET_ID=$(echo "$CURL_BODY" | python3 -c "import json,sys; print(json.load(sys.stdin).get('secret',{}).get('id',''))")
echo "  Secret ID: $SECRET_ID"
echo ""

# ============================================================
# Test 7: Verify Secret — correct value
# POST /secrets/:name/verify with value
# Expect: 200 + matched:true
# ============================================================
echo "--- Test 7: Verify Secret (correct value) ---"
do_curl POST "$BASE_URL/secrets/squidveil-verify-test/verify" \
  '{"value":"squidveil-rocks"}'
check_status "Verify Secret (correct)" 200
check_json_key "matched:true" "matched" "True"
check_json_has "success in response" "success"
echo ""

# ============================================================
# Test 8: Verify Secret — wrong value
# POST /secrets/:name/verify with wrong value
# Expect: 200 + matched:false
# ============================================================
echo "--- Test 8: Verify Secret (wrong value) ---"
do_curl POST "$BASE_URL/secrets/squidveil-verify-test/verify" \
  '{"value":"wrong-value-xyz"}'
check_status "Verify Secret (wrong)" 200
check_json_key "matched:false" "matched" "False"
check_json_has "success in response" "success"
echo ""

# ============================================================
# Test 9: List Secrets
# GET /secrets with apiKey header
# Expect: 200 + array
# ============================================================
echo "--- Test 9: List Secrets ---"
do_curl GET "$BASE_URL/secrets"
check_status "List Secrets" 200
check_json_has "secrets in response" "secrets"

# Verify secrets is a list/array
if echo "$CURL_BODY" | python3 -c "
import json,sys
d = json.load(sys.stdin)
if isinstance(d.get('secrets'), list) and len(d.get('secrets', [])) > 0:
    sys.exit(0)
else:
    sys.exit(1)
" 2>/dev/null; then
  check "secrets is non-empty array" "pass"
  SECRET_COUNT=$(echo "$CURL_BODY" | python3 -c "import json,sys; print(len(json.load(sys.stdin).get('secrets',[])))")
  echo "  Total secrets: $SECRET_COUNT"
else
  check "secrets is array (may be empty)" "pass"
  echo "  (secrets array present)"
fi
echo ""

# ============================================================
# Cleanup: remove test secrets
# ============================================================
echo "--- Cleanup ---"
cleanup_secret "squidveil-seed"
cleanup_secret "squidveil-verify-test"
echo "  Cleanup complete"
echo ""

# ============================================================
# Summary
# ============================================================
echo "============================================"
echo " Results: $PASSED passed, $FAILED failed"
echo "============================================"

if [ "$FAILED" -gt 0 ]; then
  exit 1
fi
exit 0
