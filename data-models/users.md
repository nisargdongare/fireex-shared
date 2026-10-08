# Data Model: Users

All users in FireEx are pre-registered — there is no self-signup. A user's role is determined by their record in the database, set by an admin at registration time.

> **Database note (ADR-012):** All collections below are MongoDB collections accessed via Mongoose, not PostgreSQL tables. `id` fields are MongoDB ObjectId strings, not UUIDs. Foreign-key-style fields (`departmentId`, `createdBy`, etc.) are ObjectId references, validated and populated in application code — there is no database-level `FOREIGN KEY` constraint.

---

## Roles

| Role | Description |
|------|-------------|
| `end_user` | Building occupant or resident. Can view status and alerts for their assigned building(s). |
| `technician` | Service technician. Can view and action maintenance tickets, perform device inspections. |
| `dept_admin` | Department administrator. Manages users, devices, and buildings within their department. |
| `super_admin` | System-wide administrator. Full access to everything. |

---

## MongoDB: `users` Collection

```ts
{
  _id:            ObjectId,
  phoneNumber:    string,     // E.164 format: +1234567890 — unique index
  fullName:       string,
  email?:         string,     // optional; shown on Profile screen
  role:           'end_user' | 'technician' | 'dept_admin' | 'super_admin',
  departmentId?:  ObjectId,   // ref: departments — NULL for super_admin
  designation?:   string,     // job title e.g. "Senior Fire Safety Officer"
  employeeId?:    string,     // org employee ID shown on Profile screen
  site?:          string,     // physical site / campus name
  householdRole?: 'owner' | 'member',  // for building-level membership
  isActive:       boolean,    // default true
  createdBy?:     ObjectId,   // ref: users — which admin registered this user
  createdAt:      Date,
  updatedAt:      Date,
}
```

### Field Notes
- `phoneNumber`: stored in E.164 format (e.g., `+911234567890`). This is the login identifier and is shown with "Verified" badge on Profile screen. Unique index enforced via Mongoose schema + a unique MongoDB index.
- `role`: a single role per user. Roles are not composable — a technician cannot also be a dept_admin.
- `departmentId`: required for `end_user`, `technician`, `dept_admin`. Absent for `super_admin`.
- `designation`, `employeeId`, `site`: confirmed from Profile screen WORK DETAILS section.
- `email`: shown in CONTACT section of Profile screen; optional.
- `householdRole`: `owner` or `member` — determines whether the user can invite others to the building group. Shown in Profile ACCESS section.
- `isActive`: soft-delete / deactivation mechanism. Deactivated users cannot log in.

---

## MongoDB: `otp_codes` Collection

```ts
{
  _id:        ObjectId,
  userId:     ObjectId,   // ref: users, indexed
  code:       string,     // bcrypt hash, 6-digit OTP
  expiresAt:  Date,
  usedAt?:    Date,
  createdAt:  Date,
}
```

- OTPs expire in 5 minutes
- Once used, `usedAt` is set and the code cannot be reused
- Max 3 active OTPs per user at a time (rate limiting at API level, enforced in application code)

---

## MongoDB: `refresh_tokens` Collection

```ts
{
  _id:         ObjectId,
  userId:      ObjectId,   // ref: users, indexed
  tokenHash:   string,     // bcrypt hash of the token — unique index
  deviceId?:   string,     // optional: mobile device identifier
  expiresAt:   Date,
  revokedAt?:  Date,
  createdAt:   Date,
}
```

- Refresh tokens expire in 30 days
- Revoking a token sets `revokedAt`; backend checks this on every refresh
- `deviceId` allows "log out this device" functionality

---

## MongoDB: `departments` Collection

```ts
{
  _id:        ObjectId,
  name:       string,
  code:       string,    // short identifier e.g. "FIRE_DEPT_A" — unique index
  isActive:   boolean,   // default true
  createdAt:  Date,
  updatedAt:  Date,
}
```

---

## JWT Payload Structure

After OTP verification, the backend issues a JWT with this payload:

```json
{
  "sub": "665f1a2b9e1c4a0012abcdef",
  "phone": "+911234567890",
  "role": "technician",
  "departmentId": "665f1a2b9e1c4a0012abcd01",
  "iat": 1700000000,
  "exp": 1700000900
}
```

- `sub` and `departmentId` are MongoDB ObjectId strings (24-char hex), not UUIDs.
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
| `DELETE /api/users/:id` | Deactivate user (soft delete, sets `isActive = false`) |

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
