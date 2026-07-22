# Auth Service — Integration Guide

## Overview

The Auth Service is the central identity provider for the IoT microservices platform. It handles user registration, login, JWT-based session management, role-based access control (RBAC), and account administration.

| Property | Value |
|---|---|
| **Service** | `auth-svc` |
| **Port** | `8080` (configurable via `PORT`) |
| **Protocol** | HTTP/REST + NATS (outbound audit events) |
| **Database** | MariaDB `auth_db` (container: `mariadb-auth`) |
| **JWT Algorithm** | HS256 (shared secret across services) |
| **Default Roles** | `admin`, `operator`, `viewer` |
| **Dependencies** | MariaDB (auth_db), NATS (optional, for audit), Kong (API gateway) |
| **Health Check** | `GET /health` |

---

## REST API Endpoints

All routes are prefixed with `/auth` (Kong strips `/v1` prefix before forwarding).

### Response Envelope

Every response follows the standard contract defined in `docs/planning.md`:

- **Success (2xx):** `{ "success": true, "data": <payload> }`
- **Error (4xx/5xx):** `{ "success": false, "error": { "code": "<ERROR_CODE>", "message": "<english_message>" } }`

### Public Endpoints

#### `POST /auth/register`

Register a new user. The new user receives the default `viewer` role.

**Request Body:**
```json
{
  "username": "string (required)",
  "email": "string (required)",
  "password": "string (required, min 8 chars)"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "access_token": "string",
    "refresh_token": "string",
    "expires_in": 900
  }
}
```

**Error Codes:** `BAD_REQUEST` (missing fields, weak password), `CONFLICT` (email/username taken)

---

#### `POST /auth/login`

Authenticate with email or username.

**Request Body:**
```json
{
  "identifier": "string (email or username)",
  "email": "string (backward compatible)",
  "username": "string (backward compatible)",
  "password": "string (required)"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "access_token": "string",
    "refresh_token": "string",
    "expires_in": 900
  }
}
```

**Error Codes:** `UNAUTHORIZED` (invalid credentials), `FORBIDDEN` (inactive account)

---

#### `POST /auth/refresh`

Rotate a refresh token to obtain a new access/refresh pair.

**Request Body:**
```json
{
  "refresh_token": "string (required)"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "access_token": "string",
    "refresh_token": "string",
    "expires_in": 900
  }
}
```

**Error Codes:** `UNAUTHORIZED` (invalid or expired refresh token)

---

### Protected Endpoints (JWT Required)

All endpoints below require `Authorization: Bearer <access_token>` header.

#### `GET /auth/me`

Return the authenticated user's profile.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "username": "string",
    "email": "string",
    "roles": ["viewer"],
    "is_active": true,
    "last_login_at": "2026-01-01T00:00:00Z",
    "created_at": "2026-01-01T00:00:00Z"
  }
}
```

---

#### `PUT /auth/me`

Update the authenticated user's username and/or email.

**Request Body:**
```json
{
  "username": "string (optional)",
  "email": "string (optional)"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "username": "string",
    "email": "string",
    "roles": ["viewer"],
    "is_active": true,
    "last_login_at": "2026-01-01T00:00:00Z",
    "created_at": "2026-01-01T00:00:00Z"
  }
}
```

**Error Codes:** `BAD_REQUEST` (no fields provided), `CONFLICT` (email/username taken)

---

#### `PUT /auth/password`

Change the authenticated user's password. All active sessions are revoked on success.

**Request Body:**
```json
{
  "current_password": "string (required)",
  "new_password": "string (required, min 8 chars)"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "message": "password changed — please log in again"
  }
}
```

**Error Codes:** `UNAUTHORIZED` (wrong current password), `BAD_REQUEST` (weak new password)

---

#### `DELETE /auth/account`

Soft-delete the authenticated user's account. Requires password confirmation.

**Request Body:**
```json
{
  "password": "string (required)"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "message": "account deactivated successfully"
  }
}
```

**Error Codes:** `UNAUTHORIZED` (password confirmation failed)

---

#### `GET /auth/sessions`

List all active (non-revoked, non-expired) refresh token sessions for the authenticated user.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "sessions": [
      {
        "id": "uuid",
        "user_agent": "string",
        "ip_address": "string",
        "issued_at": "2026-01-01T00:00:00Z",
        "expires_at": "2026-01-08T00:00:00Z",
        "revoked_at": null
      }
    ],
    "count": 2
  }
}
```

---

#### `POST /auth/logout`

Revoke all active refresh tokens for the authenticated user.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "message": "logged out successfully"
  }
}
```

---

### Admin Endpoints (JWT + `admin` Role Required)

#### `GET /auth/users`

List all non-deleted users with their roles.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "uuid",
        "username": "string",
        "email": "string",
        "roles": ["admin"],
        "is_active": true,
        "last_login_at": "2026-01-01T00:00:00Z",
        "created_at": "2026-01-01T00:00:00Z"
      }
    ],
    "count": 1
  }
}
```

---

#### `GET /auth/roles`

List all defined roles in the system.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "roles": [
      {
        "id": "role-admin-001",
        "name": "admin",
        "description": "Full access to all resources",
        "created_at": "2026-01-01T00:00:00Z"
      }
    ]
  }
}
```

---

#### `GET /auth/users/{id}`

Get a single user by ID.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "username": "string",
    "email": "string",
    "roles": ["admin"],
    "is_active": true,
    "last_login_at": "2026-01-01T00:00:00Z",
    "created_at": "2026-01-01T00:00:00Z"
  }
}
```

**Error Codes:** `NOT_FOUND`

---

#### `PUT /auth/users/{id}`

Update a target user's active status and/or roles. Cannot modify self.

**Request Body:**
```json
{
  "is_active": false,
  "roles": ["operator", "viewer"]
}
```

**Response (200):** Updated user summary (same shape as `UserSummary`)

**Error Codes:** `NOT_FOUND`, `FORBIDDEN` (cannot modify self), `CONFLICT` (cannot deactivate last admin), `BAD_REQUEST` (invalid role name)

---

#### `DELETE /auth/users/{id}`

Soft-delete a user. Cannot delete self or the last active admin.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "message": "user deleted"
  }
}
```

**Error Codes:** `NOT_FOUND`, `FORBIDDEN` (cannot delete self), `CONFLICT` (cannot delete last admin)

---

## Input Contracts

The Auth Service does not consume external webhooks or inbound NATS events. It is a pure request-response service that receives all input via HTTP from:

- **Dashboard** (via Kong): user registration, login, profile management, admin actions
- **Other Services** (via Kong): same REST endpoints; no service-to-service HTTP calls directly to Auth

> **Note:** Other services in this project validate JWT tokens locally using the shared `JWT_SECRET` (HS256). They do **not** need to call Auth Service to verify tokens. See Integration Steps below.

---

## Output Contracts

### NATS Events (Outbound Audit)

The Auth Service publishes audit events to NATS when NATS is available. If NATS is unreachable at startup, audit events are silently skipped (non-fatal).

| Subject | Event Payload `event` | Fields |
|---|---|---|
| `audit.log` | `auth.register` | `user_id`, `username`, `ip` |
| `audit.log` | `auth.login` | `user_id`, `username`, `ip` |
| `audit.log` | `auth.login.failed` | `identifier`, `ip` |
| `audit.log` | `auth.refresh` | `user_id`, `ip` |
| `audit.log` | `auth.logout` | `user_id`, `ip` |
| `audit.log` | `auth.profile.updated` | `user_id`, `ip` |
| `audit.log` | `auth.password.changed` | `user_id`, `ip` |
| `audit.log` | `auth.account.deleted` | `user_id`, `ip` |
| `audit.log` | `auth.admin.user.updated` | `actor_id`, `target_id` |
| `audit.log` | `auth.admin.user.deleted` | `actor_id`, `target_id` |

**Payload format:**
```json
{
  "event": "auth.login",
  "data": {
    "user_id": "uuid",
    "username": "string",
    "ip": "string"
  }
}
```

---

## Integration Steps

### 1. Configure Kong Routing

All traffic to Auth Service goes through Kong. Ensure the following routes exist in `infra/kong/kong.yml`:

```yaml
routes:
  - name: auth
    paths:
      - /v1/auth
    service: auth
    plugins:
      - name: rate-limiting
        config:
          minute: 300
          policy: local
      - name: cors
```

The Auth Service health endpoint is also exposed:
```yaml
routes:
  - name: auth-health
    paths:
      - /v1/auth/health
    service: auth
    methods:
      - GET
```

### 2. Obtain JWT Tokens

1. **Register or login** via `POST /auth/register` or `POST /auth/login`.
2. Extract `access_token` and `refresh_token` from the `data` object.
3. Store `refresh_token` securely (HTTP-only cookie or secure storage).

### 3. Validate JWT Locally (Shared Secret)

Because the Auth Service uses **HS256** with a shared `JWT_SECRET`, any service can validate tokens locally without calling Auth Service:

```go
import "github.com/golang-jwt/jwt/v5"

func ValidateToken(tokenString, secret string) (*Claims, error) {
    claims := &Claims{}
    _, err := jwt.ParseWithClaims(tokenString, claims, func(t *jwt.Token) (interface{}, error) {
        if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
            return nil, errors.New("unexpected signing method")
        }
        return []byte(secret), nil
    })
    return claims, err
}
```

**JWT Claims Structure:**
```go
type Claims struct {
    UserID   string   `json:"uid"`
    Username string   `json:"username"`
    Roles    []string `json:"roles"`
    jwt.RegisteredClaims
}
```

Extract roles from claims for RBAC decisions.

### 4. Authenticated Requests

Include the access token in the `Authorization` header:

```
Authorization: Bearer <access_token>
```

Kong forwards the request to the Auth Service (or the target service, which validates the token independently).

### 5. Refresh Flow

When the access token expires:

1. Call `POST /auth/refresh` with the `refresh_token`.
2. The service returns a new `access_token` + `refresh_token` pair.
3. The old refresh token is revoked (rotation pattern).

### 6. RBAC Enforcement

Services should enforce RBAC by inspecting the `roles` array in JWT claims. The Auth Service defines three roles:

| Role | Permissions |
|---|---|
| `admin` | Full access to all resources |
| `operator` | Manage devices and view telemetry |
| `viewer` | Read-only access to telemetry and alerts |

### 7. Audit Event Consumption

Subscribe to `audit.log` on NATS to consume Auth audit events:

```go
nc.Subscribe("audit.log", func(msg *nats.Msg) {
    // handle audit event
})
```

### 8. Admin User Management

To perform admin operations, obtain a token from an admin user and include it in requests to `/auth/users`, `/auth/roles`, etc. The `RequireRole("admin")` middleware protects these routes.

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | No | `8080` | HTTP listen port |
| `DB_DSN` | No | `auth_user:auth_pass@tcp(mariadb-auth:3306)/auth_db?parseTime=true&charset=utf8mb4` | MariaDB DSN |
| `JWT_SECRET` | **Yes** | — | HMAC secret for JWT signing/verification (must be shared across services) |
| `JWT_EXPIRY` | No | `15m` | Access token TTL (Go duration format) |
| `REFRESH_EXPIRY` | No | `168h` | Refresh token TTL (Go duration format) |
| `NATS_URL` | No | `nats://nats:4222` | NATS server URL for audit events |
| `ADMIN_USERNAME` | No | `admin` | Default admin username (seeded on first startup) |
| `ADMIN_EMAIL` | No | `admin@smartfarm.local` | Default admin email |
| `ADMIN_PASSWORD` | No | `admin1234` | Default admin password |

> **Security Note:** Change `ADMIN_PASSWORD` after the first deployment. In production, omit `ADMIN_PASSWORD` to skip admin seeding if an admin already exists.

---

## Database Schema Overview

The Auth Service uses MariaDB `auth_db` with six tables, managed via GORM AutoMigrate on startup.

### `users`

| Column | Type | Constraints |
|---|---|---|
| `id` | `CHAR(36)` | Primary Key |
| `username` | `VARCHAR(100)` | Unique, Not Null |
| `email` | `VARCHAR(255)` | Unique, Not Null |
| `password_hash` | `VARCHAR(255)` | Not Null |
| `is_active` | `TINYINT(1)` | Default 1 |
| `last_login_at` | `DATETIME` | Nullable |
| `created_at` | `DATETIME` | Auto-create |
| `updated_at` | `DATETIME` | Auto-update |
| `deleted_at` | `DATETIME` | Index, Nullable (soft delete) |

### `roles`

| Column | Type | Constraints |
|---|---|---|
| `id` | `CHAR(36)` | Primary Key |
| `name` | `VARCHAR(50)` | Unique, Not Null |
| `description` | `VARCHAR(255)` | Nullable |
| `created_at` | `DATETIME` | Auto-create |

### `permissions`

| Column | Type | Constraints |
|---|---|---|
| `id` | `CHAR(36)` | Primary Key |
| `resource` | `VARCHAR(100)` | Not Null |
| `action` | `VARCHAR(50)` | Not Null |
| `description` | `VARCHAR(255)` | Nullable |
| `created_at` | `DATETIME` | Auto-create |

### `user_roles` (Join Table)

| Column | Type | Constraints |
|---|---|---|
| `user_id` | `CHAR(36)` | Primary Key (composite) |
| `role_id` | `CHAR(36)` | Primary Key (composite) |

### `role_permissions` (Join Table)

| Column | Type | Constraints |
|---|---|---|
| `role_id` | `CHAR(36)` | Primary Key (composite) |
| `permission_id` | `CHAR(36)` | Primary Key (composite) |

### `refresh_tokens`

| Column | Type | Constraints |
|---|---|---|
| `id` | `CHAR(36)` | Primary Key |
| `user_id` | `CHAR(36)` | Index, Not Null |
| `token_hash` | `VARCHAR(255)` | Unique, Not Null |
| `issued_at` | `DATETIME` | Auto-create |
| `expires_at` | `DATETIME` | Index, Not Null |
| `revoked_at` | `DATETIME` | Nullable |
| `user_agent` | `VARCHAR(255)` | Nullable |
| `ip_address` | `VARCHAR(45)` | Nullable |

### Seed Data (Static)

The service seeds the following reference data on every startup (idempotent, `INSERT IGNORE`):

**Roles:**
- `role-admin-001` → `admin`
- `role-operator-001` → `operator`
- `role-viewer-001` → `viewer`

**Permissions:**
- `perm-tel-read` → `telemetry:read`
- `perm-tel-write` → `telemetry:write`
- `perm-ctrl-read` → `control:read`
- `perm-ctrl-write` → `control:write`
- `perm-alert-read` → `alert:read`
- `perm-alert-ack` → `alert:ack`
- `perm-user-admin` → `users:admin`
- `perm-stream-read` → `stream:read`

**Role-Permission Mappings:**
- `admin` → all 8 permissions
- `operator` → all except `user:admin`
- `viewer` → read-only (`telemetry:read`, `control:read`, `alert:read`, `stream:read`)

---

## Example curl Commands

Replace `AUTH_URL` with the Kong-proxied URL (e.g., `http://localhost:8000/v1/auth`) or direct service URL.

### Register a New User

```bash
curl -X POST http://localhost:8000/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "johndoe",
    "email": "john@example.com",
    "password": "SecurePass123"
  }'
```

### Login

```bash
curl -X POST http://localhost:8000/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "john@example.com",
    "password": "SecurePass123"
  }'
```

### Refresh Token

```bash
curl -X POST http://localhost:8000/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }'
```

### Get Current Profile

```bash
curl -X GET http://localhost:8000/v1/auth/me \
  -H "Authorization: Bearer <access_token>"
```

### Update Profile

```bash
curl -X PUT http://localhost:8000/v1/auth/me \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "johndoe_updated"
  }'
```

### Change Password

```bash
curl -X PUT http://localhost:8000/v1/auth/password \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "current_password": "SecurePass123",
    "new_password": "NewSecurePass456"
  }'
```

### List Active Sessions

```bash
curl -X GET http://localhost:8000/v1/auth/sessions \
  -H "Authorization: Bearer <access_token>"
```

### Logout

```bash
curl -X POST http://localhost:8000/v1/auth/logout \
  -H "Authorization: Bearer <access_token>"
```

### Admin: List Users

```bash
curl -X GET http://localhost:8000/v1/auth/users \
  -H "Authorization: Bearer <admin_access_token>"
```

### Admin: List Roles

```bash
curl -X GET http://localhost:8000/v1/auth/roles \
  -H "Authorization: Bearer <admin_access_token>"
```

### Admin: Update User

```bash
curl -X PUT http://localhost:8000/v1/auth/users/<user_id> \
  -H "Authorization: Bearer <admin_access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "is_active": false,
    "roles": ["operator"]
  }'
```

### Admin: Delete User

```bash
curl -X DELETE http://localhost:8000/v1/auth/users/<user_id> \
  -H "Authorization: Bearer <admin_access_token>"
```

---

## Notes

- **Token Rotation:** Refresh tokens are single-use. Each `/auth/refresh` call revokes the old token and issues a new one.
- **Password Storage:** Passwords are hashed with bcrypt (`DefaultCost`). The raw password is never stored or returned.
- **Soft Delete:** User deletion is soft-only (`deleted_at` timestamp). The user record remains in the database for audit purposes.
- **Data Retention:** A background cron job runs daily at 02:00 to delete expired refresh tokens (>1 day past expiry) and weekly on Sundays at 03:00 to soft-delete users inactive for >365 days.
- **Correlation IDs:** Kong injects `X-Request-ID`; the Auth Service propagates it via context for distributed tracing.
