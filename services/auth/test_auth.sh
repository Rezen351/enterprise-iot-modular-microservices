#!/usr/bin/env bash
# =============================================================================
# Auth Service — Integration Test (via Kong API Gateway)
# Semua request melewati Kong port 8000, bukan langsung ke service port 8080.
# Tests: health, register, login, profile management, password change,
#        session management, logout, account deletion.
# =============================================================================
set -uo pipefail

BASE="http://localhost:8000"
PASS=0
FAIL=0

_pass() { echo "  ✅ PASS — $*"; PASS=$((PASS+1)); }
_fail() { echo "  ❌ FAIL — $*"; FAIL=$((FAIL+1)); }
_info() { echo "  ℹ️   $*"; }

echo ""
echo "=== Auth Service — Integration Test ==="
echo ""

# ── 1. Health ─────────────────────────────────────────────────────────────────
echo "1. GET /health"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/health")
[ "$STATUS" = "200" ] && _pass "HTTP 200" || _fail "HTTP $STATUS (expected 200)"

# ── 2. Register ───────────────────────────────────────────────────────────────
echo ""
echo "2. POST /auth/register"
REG=$(curl -s -X POST "$BASE/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","email":"test@example.com","password":"password123"}')
ACCESS_TOKEN=$(echo "$REG" | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)
REFRESH_TOKEN=$(echo "$REG" | grep -o '"refresh_token":"[^"]*"' | cut -d'"' -f4)
if [ -n "$ACCESS_TOKEN" ]; then
  _pass "Token pair received"
  _info "Access token: ${ACCESS_TOKEN:0:30}..."
else
  _fail "No access_token in response: $REG"
fi

# ── 3. Register duplicate ─────────────────────────────────────────────────────
echo ""
echo "3. POST /auth/register (duplicate email)"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"username":"other","email":"test@example.com","password":"password123"}')
[ "$STATUS" = "409" ] && _pass "HTTP 409 Conflict" || _fail "HTTP $STATUS (expected 409)"

# ── 4. Login ──────────────────────────────────────────────────────────────────
echo ""
echo "4. POST /auth/login"
LOGIN=$(curl -s -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}')
LOGIN_TOKEN=$(echo "$LOGIN" | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)
LOGIN_REFRESH=$(echo "$LOGIN" | grep -o '"refresh_token":"[^"]*"' | cut -d'"' -f4)
[ -n "$LOGIN_TOKEN" ] && _pass "Login successful — token pair received" || _fail "Login failed: $LOGIN"

# ── 5. Login wrong password ───────────────────────────────────────────────────
echo ""
echo "5. POST /auth/login (wrong password)"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"wrongpass"}')
[ "$STATUS" = "401" ] && _pass "HTTP 401 Unauthorized" || _fail "HTTP $STATUS (expected 401)"

# ── 6. GET /auth/me ───────────────────────────────────────────────────────────
echo ""
echo "6. GET /auth/me (valid token)"
ME=$(curl -s "$BASE/auth/me" -H "Authorization: Bearer $LOGIN_TOKEN")
USERNAME=$(echo "$ME" | grep -o '"username":"[^"]*"' | cut -d'"' -f4)
[ "$USERNAME" = "testuser" ] && _pass "Me endpoint returns correct user" || _fail "Unexpected response: $ME"

# ── 7. GET /auth/me no token ──────────────────────────────────────────────────
echo ""
echo "7. GET /auth/me (no token)"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/auth/me")
[ "$STATUS" = "401" ] && _pass "HTTP 401 without token" || _fail "HTTP $STATUS (expected 401)"

# ── 8. Update profile (username) ──────────────────────────────────────────────
echo ""
echo "8. PUT /auth/me (update username)"
UPD=$(curl -s -X PUT "$BASE/auth/me" \
  -H "Authorization: Bearer $LOGIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser_updated"}')
NEW_USERNAME=$(echo "$UPD" | grep -o '"username":"[^"]*"' | cut -d'"' -f4)
[ "$NEW_USERNAME" = "testuser_updated" ] && _pass "Username updated to testuser_updated" || _fail "Update failed: $UPD"

# ── 9. Update profile (empty body) ────────────────────────────────────────────
echo ""
echo "9. PUT /auth/me (empty body — should fail)"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "$BASE/auth/me" \
  -H "Authorization: Bearer $LOGIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}')
[ "$STATUS" = "400" ] && _pass "HTTP 400 for empty update" || _fail "HTTP $STATUS (expected 400)"

# ── 10. Change password (wrong current) ───────────────────────────────────────
echo ""
echo "10. PUT /auth/password (wrong current password)"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "$BASE/auth/password" \
  -H "Authorization: Bearer $LOGIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"current_password":"wrongpass","new_password":"newpassword123"}')
[ "$STATUS" = "401" ] && _pass "HTTP 401 — wrong current password rejected" || _fail "HTTP $STATUS (expected 401)"

# ── 11. Change password (weak new password) ───────────────────────────────────
echo ""
echo "11. PUT /auth/password (weak new password)"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "$BASE/auth/password" \
  -H "Authorization: Bearer $LOGIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"current_password":"password123","new_password":"weak"}')
[ "$STATUS" = "400" ] && _pass "HTTP 400 — weak password rejected" || _fail "HTTP $STATUS (expected 400)"

# ── 12. Change password (success) ─────────────────────────────────────────────
echo ""
echo "12. PUT /auth/password (success)"
CHPW=$(curl -s -X PUT "$BASE/auth/password" \
  -H "Authorization: Bearer $LOGIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"current_password":"password123","new_password":"newpassword123"}')
STATUS=$(echo "$CHPW" | grep -o '"message"' | head -1)
[ -n "$STATUS" ] && _pass "Password changed successfully" || _fail "Expected message, got: $CHPW"

# ── 13. Login with new password (re-login required after password change) ──────
echo ""
echo "13. POST /auth/login (with new password — re-login after password change)"
LOGIN2=$(curl -s -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"newpassword123"}')
NEW_ACCESS=$(echo "$LOGIN2" | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)
NEW_REFRESH=$(echo "$LOGIN2" | grep -o '"refresh_token":"[^"]*"' | cut -d'"' -f4)
[ -n "$NEW_ACCESS" ] && _pass "Login with new password successful" || _fail "Login failed: $LOGIN2"

# ── 14. GET /auth/sessions ────────────────────────────────────────────────────
echo ""
echo "14. GET /auth/sessions"
SESSIONS=$(curl -s "$BASE/auth/sessions" -H "Authorization: Bearer $NEW_ACCESS")
COUNT=$(echo "$SESSIONS" | grep -o '"count":[0-9]*' | cut -d':' -f2)
if [ -n "$COUNT" ] && [ "$COUNT" -ge 1 ]; then
  _pass "Sessions returned — count: $COUNT"
else
  _fail "Unexpected response: $SESSIONS"
fi

# ── 15. Refresh token (success) ───────────────────────────────────────────────
echo ""
echo "15. POST /auth/refresh"
REFRESH_RESP=$(curl -s -X POST "$BASE/auth/refresh" \
  -H "Content-Type: application/json" \
  -d "{\"refresh_token\":\"$NEW_REFRESH\"}")
NEW_REFRESH2=$(echo "$REFRESH_RESP" | grep -o '"refresh_token":"[^"]*"' | cut -d'"' -f4)
FINAL_TOKEN=$(echo "$REFRESH_RESP" | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)
[ -n "$NEW_REFRESH2" ] && _pass "Token refresh successful — new token pair received" || _fail "Refresh failed: $REFRESH_RESP"

# ── 16. Refresh old token (should fail — rotation) ────────────────────────────
echo ""
echo "16. POST /auth/refresh (reuse old refresh token — should fail)"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/auth/refresh" \
  -H "Content-Type: application/json" \
  -d "{\"refresh_token\":\"$NEW_REFRESH\"}")
[ "$STATUS" = "401" ] && _pass "HTTP 401 — old token correctly rejected (rotation works)" || _fail "HTTP $STATUS (expected 401)"


# ── 17. Delete account (wrong password) ───────────────────────────────────────
echo ""
echo "17. DELETE /auth/account (wrong password)"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$BASE/auth/account" \
  -H "Authorization: Bearer $FINAL_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"password":"wrongpass"}')
[ "$STATUS" = "401" ] && _pass "HTTP 401 — wrong password rejected for account deletion" || _fail "HTTP $STATUS (expected 401)"

# ── 18. Delete account (success) ──────────────────────────────────────────────
echo ""
echo "18. DELETE /auth/account (success)"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$BASE/auth/account" \
  -H "Authorization: Bearer $FINAL_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"password":"newpassword123"}')
[ "$STATUS" = "200" ] && _pass "Account deactivated successfully" || _fail "HTTP $STATUS (expected 200)"

# ── 19. Login after account deletion (should fail) ────────────────────────────
echo ""
echo "19. POST /auth/login (after account deletion — should fail)"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"newpassword123"}')
[ "$STATUS" = "401" ] && _pass "HTTP 401 — deleted account cannot login" || _fail "HTTP $STATUS (expected 401)"

# ── 20. Logout ────────────────────────────────────────────────────────────────
# Re-register for logout test
echo ""
echo "20. POST /auth/logout"
REG2=$(curl -s -X POST "$BASE/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"username":"logoutuser","email":"logout@example.com","password":"password123"}')
LOGOUT_TOKEN=$(echo "$REG2" | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/auth/logout" \
  -H "Authorization: Bearer $LOGOUT_TOKEN")
[ "$STATUS" = "200" ] && _pass "Logout successful" || _fail "HTTP $STATUS (expected 200)"

# ── 21. Delete logoutuser account (cleanup) ──────────────────────────────────
echo ""
echo "21. DELETE /auth/account (cleanup logoutuser)"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$BASE/auth/account" \
  -H "Authorization: Bearer $LOGOUT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"password":"password123"}')
[ "$STATUS" = "200" ] && _pass "Logout user account deleted successfully" || _fail "HTTP $STATUS (expected 200)"

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "=== Test selesai: $PASS passed, $FAIL failed ==="
echo ""
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
