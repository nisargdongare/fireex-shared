# Data Model: Users

All users in FireEx are pre-registered — there is no self-signup. A user's role is determined by their record in the database, set by an admin at registration time.

---

## Roles

| Role | Description |
|------|-------------|
| `end_user` | Building occupant or resident. Can view status and alerts for their assigned building(s). |
| `technician` | Service technician. Can view and action maintenance tickets, perform device inspections. |
| `dept_admin` | Department administrator. Manages users, devices, and buildings within their department. |
| `super_admin` | System-wide administrator. Full access to everything. |

---

## PostgreSQL: `users` Table

```sql
CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number    VARCHAR(20) NOT NULL UNIQUE,  -- E.164 format: +1234567890
  full_name       VARCHAR(255) NOT NULL,
  role            VARCHAR(20) NOT NULL CHECK (role IN ('end_user', 'technician', 'dept_admin', 'super_admin')),
  department_id   UUID REFERENCES departments(id) ON DELETE SET NULL,  -- NULL for super_admin
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_by      UUID REFERENCES users(id),    -- which admin registered this user
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Field Notes
- `phone_number`: stored in E.164 format (e.g., `+911234567890`). This is the login identifier.
- `role`: a single role per user. Roles are not composable — a technician cannot also be a dept_admin.
- `department_id`: required for `end_user`, `technician`, `dept_admin`. NULL for `super_admin`.
- `is_active`: soft-delete / deactivation mechanism. Deactivated users cannot log in.

---

## PostgreSQL: `otp_codes` Table

```sql
CREATE TABLE otp_codes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code            CHAR(6) NOT NULL,
  expires_at      TIMESTAMPTZ NOT NULL,
  used_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

- OTPs expire in 5 minutes
- Once used, `used_at` is set and the code cannot be reused
- Max 3 active OTPs per user at a time (rate limiting at API level)

---

## PostgreSQL: `refresh_tokens` Table

```sql
CREATE TABLE refresh_tokens (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash      VARCHAR(255) NOT NULL UNIQUE,  -- bcrypt hash of the token
  device_id       VARCHAR(255),                  -- optional: mobile device identifier
  expires_at      TIMESTAMPTZ NOT NULL,
  revoked_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

- Refresh tokens expire in 30 days
- Revoking a token sets `revoked_at`; backend checks this on every refresh
- `device_id` allows "log out this device" functionality

---

## PostgreSQL: `departments` Table

```sql
CREATE TABLE departments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(255) NOT NULL,
  code            VARCHAR(50) NOT NULL UNIQUE,   -- short identifier e.g. "FIRE_DEPT_A"
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## JWT Payload Structure

After OTP verification, the backend issues a JWT with this payload:

```json
{
  "sub": "user-uuid",
  "phone": "+911234567890",
  "role": "technician",
  "departmentId": "dept-uuid",
  "iat": 1700000000,
  "exp": 1700000900
}
```

- Access token expires: 15 minutes
- Refresh token expires: 30 days (stored as httpOnly cookie on web, MMKV on mobile)

---

## API: User Management (Super Admin Only)

| Endpoint | Description |
|----------|-------------|
| `POST /api/users` | Register a new user |
| `GET /api/users` | List all users (filterable by role, department) |
| `GET /api/users/:id` | Get user by ID |
| `PATCH /api/users/:id` | Update user details or role |
| `DELETE /api/users/:id` | Deactivate user (soft delete, sets `is_active = false`) |

See `api-contracts/rest-api.md` for full request/response shapes.

---

## Role Capabilities Matrix

| Capability | end_user | technician | dept_admin | super_admin |
|-----------|----------|-----------|------------|-------------|
| View building/device status | ✓ (own dept) | ✓ (own dept) | ✓ (own dept) | ✓ (all) |
| Receive alerts | ✓ (own dept) | ✓ (own dept) | ✓ (own dept) | ✓ (all) |
| View alert history | ✓ (own dept) | ✓ (own dept) | ✓ (own dept) | ✓ (all) |
| View maintenance tickets | ✗ | ✓ (assigned) | ✓ (own dept) | ✓ (all) |
| Update ticket status | ✗ | ✓ (assigned) | ✗ | ✓ (all) |
| Manage devices | ✗ | ✗ | ✓ (own dept) | ✓ (all) |
| Manage users | ✗ | ✗ | ✓ (own dept) | ✓ (all) |
| Manage departments | ✗ | ✗ | ✗ | ✓ |
| System configuration | ✗ | ✗ | ✗ | ✓ |
