# Data Model: Users

All users in FireEx are pre-registered — there is no self-signup. A user's role is determined by their record in the database, set by an admin at registration time.

> **Database note (ADR-012):** All collections are MongoDB via Mongoose. `id` fields are MongoDB ObjectId strings (24-char hex). No database-level foreign key constraints — enforced in application code.

---

## Roles

| Role | App | Description |
|------|-----|-------------|
| `user` | Mobile | Client/end user. Belongs to one or more client orgs. Views device status and alerts for their orgs. |
| `serviceBody` | Web dashboard | Company dashboard user. Manages tickets, assigns serviceBoys, sees all org data. |
| `serviceBoy` | Mobile | Field technician employed by FireEx. Receives and action tickets. |

---

## MongoDB: `users` Collection

```ts
{
  _id:             ObjectId,
  mobileNumber:    string,      // 10-digit, unique index — login identifier
  appRole:         'user' | 'serviceBody' | 'serviceBoy',
  firstName:       string,
  lastName:        string,
  email?:          string,
  address?:        string,
  city?:           string,
  state?:          string,
  pincode?:        string,

  // For 'user' and 'serviceBody': the orgs they belong to (can be multiple)
  organizationIds: ObjectId[],  // ref: organisations

  // For 'serviceBoy' ONLY: their single employer org (FireEx company)
  // organizationIds is empty [] for serviceBoy
  orgId?:          ObjectId,    // ref: organisations

  isActive:        boolean,     // default true
  createdAt:       Date,
  updatedAt:       Date,
}
```

### Field Notes
- `mobileNumber`: 10-digit Indian mobile number (no country code). Unique index. Login identifier.
- `appRole`: single role per user, not composable.
- `organizationIds`: for `user` and `serviceBody` — the client organisations they belong to. Can belong to multiple.
- `orgId`: for `serviceBoy` only — the single FireEx company org they are employed by. `organizationIds` must be `[]` for serviceBoy.

---

## JWT Payload — Role-Dependent

After login (OTP or direct), the backend issues a JWT whose payload differs by role:

**`user` / `serviceBody`:**
```json
{
  "sub": "665f1a2b9e1c4a0012abcdef",
  "mobileNumber": "8888888888",
  "appRole": "user",
  "organizations": [
    { "_id": "665f...", "name": "FireEx Services HQ" },
    { "_id": "665f...", "name": "Emergency Response Unit Mumbai" }
  ],
  "iat": 1700000000,
  "exp": 1700000900
}
```

**`serviceBoy`:**
```json
{
  "sub": "665f1a2b9e1c4a0012abcdef",
  "mobileNumber": "9999999999",
  "appRole": "serviceBoy",
  "orgId": "665f1a2b9e1c4a0012abcd01",
  "iat": 1700000000,
  "exp": 1700000900
}
```

- `serviceBoy` gets `orgId` (their employer), NOT `organizations`.
- Access token expires: 15 minutes. Refresh token: 30 days.

---

## MongoDB: `otp_codes` Collection

```ts
{
  _id:        ObjectId,
  mobileNumber: string,   // indexed
  otp:        string,     // bcrypt hash of 6-digit OTP
  expiresAt:  Date,       // 5-minute window
  createdAt:  Date,
}
```

---

## MongoDB: `refresh_tokens` Collection

```ts
{
  _id:       ObjectId,
  userId:    ObjectId,   // ref: users
  token:     string,     // raw token value
  expiresAt: Date,       // 30 days
  createdAt: Date,
}
```

---

## MongoDB: `organisations` Collection

```ts
{
  _id:                ObjectId,
  name:               string,    // unique
  email?:             string,
  mobileNumber?:      string,
  address?:           string,
  city?:              string,
  state?:             string,
  pincode?:           string,
  registrationNumber?: string,
  gstNumber?:         string,
  website?:           string,
  description?:       string,
  buildingStructure?: [
    {
      floorsNo: number,
      name:     string,
      Rooms: [{ roomNumber: string, name: string }],
    }
  ],
  isActive:   boolean,
  createdAt:  Date,
  updatedAt:  Date,
}
```

---

## Role Capabilities Matrix

| Capability | `user` | `serviceBody` | `serviceBoy` |
|-----------|--------|--------------|-------------|
| View devices for their org | ✓ | ✓ | ✗ |
| Create tickets | ✗ | ✓ | ✗ |
| View org tickets (dashboard) | ✗ | ✓ | ✗ |
| Update ticket (assign, priority, status) | ✗ | ✓ | ✗ |
| View own assigned tickets | ✗ | ✗ | ✓ |
| Update own ticket progress (status/notes) | ✗ | ✗ | ✓ |
| View ticket detail | ✗ | ✓ (any) | ✓ (own only) |

---

## Seed Test Users

| Mobile | Role | Name |
|--------|------|------|
| `8888888888` | `user` | John Doe — both orgs |
| `9999999999` | `serviceBoy` | Priya Sharma — 10 tickets assigned |
| `7777777777` | `serviceBody` | Raj Kumar — created the tickets |
| `6666666666` | `user` | Arjun Verma — both orgs |
