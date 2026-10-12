# FireEx REST API Contracts

Base URL (dev): `http://localhost:4000/api`
Swagger UI: `http://localhost:4000/api/docs`

All requests/responses use `Content-Type: application/json`.
Authentication: `Authorization: Bearer <access_token>` on all protected routes.

> All `id` fields are MongoDB ObjectId strings (24-char hex).

---

## Response Envelope

**Success:**
```json
{ "success": true, "data": { ... } }
```

**Error:**
```json
{ "success": false, "error": "ERROR_CODE", "message": "..." }
```

---

## Auth (`/api/auth`)

### POST /api/auth/otp/request
Public. Sends OTP to registered mobile.
```json
// Request
{ "mobileNumber": "8888888888" }
// Response 200
{ "success": true, "message": "OTP sent successfully. Check your SMS." }
```
Errors: `400 VALIDATION_ERROR`, `404 PHONE_NOT_REGISTERED`

---

### POST /api/auth/otp/verify
Public. Verify OTP, receive JWT tokens.
```json
// Request
{ "mobileNumber": "8888888888", "otp": "123456" }
```
Response shape same as `/api/users/login` (see below).
Errors: `400 INVALID_OTP`, `400 OTP_EXPIRED`, `403 USER_INACTIVE`, `404 PHONE_NOT_REGISTERED`

---

### POST /api/auth/refresh
Public. Exchange refresh token for new token pair.
```json
{ "refreshToken": "eyJ..." }
```
Response: `{ "success": true, "data": { "accessToken": "...", "refreshToken": "..." } }`

---

### POST /api/auth/logout
**Requires JWT.** Revokes refresh token.
```json
{ "refreshToken": "eyJ..." }
```

---

## Users (`/api/users`)

### POST /api/users/login
Public (dev convenience — no OTP). Login by mobile number.
```json
// Request
{ "mobileNumber": "8888888888" }

// Response 200 — user / serviceBody role
{
  "success": true,
  "data": {
    "accessToken": "eyJ...",
    "refreshToken": "eyJ...",
    "user": {
      "_id": "...", "mobileNumber": "8888888888", "appRole": "user",
      "firstName": "John", "lastName": "Doe",
      "email": "...", "address": "...", "city": "...", "state": "...", "pincode": "...",
      "organizations": [{ "_id": "...", "name": "FireEx Services HQ" }],
      "isActive": true
    }
  }
}

// Response 200 — serviceBoy role (orgId instead of organizations)
{
  "success": true,
  "data": {
    "accessToken": "eyJ...",
    "refreshToken": "eyJ...",
    "user": {
      "_id": "...", "mobileNumber": "9999999999", "appRole": "serviceBoy",
      "firstName": "Priya", "lastName": "Sharma",
      "orgId": "...",
      "isActive": true
    }
  }
}
```
Errors: `400 VALIDATION_ERROR`, `403 USER_INACTIVE`, `404 USER_NOT_FOUND`

---

### GET /api/users/me
**Requires JWT.** Returns authenticated user's profile.

---

## Devices (`/api/devices`)

### POST /api/devices/register
**No auth required** (IoT/mobile BLE provisioning endpoint).
Derives `orgId`, `floor`, `room` from the linked installation ticket. Auto-generates `udn`.
```json
// Request
{ "productId": "...", "ticketId": "..." }

// Response 201
{
  "success": true,
  "data": {
    "_id": "...",
    "udn": "54293",
    "deviceName": "FireEx Smoke Detector Pro",
    "floor": { "floorsNo": 1, "name": "Ground Floor" },
    "room": { "roomNumber": "104", "name": "Staircase Area" },
    "status": "active"
  }
}
```
Errors: `409 TICKET_ALREADY_USED`, `404 TICKET_NOT_FOUND`, `404 PRODUCT_NOT_FOUND`, `400 PRODUCT_INACTIVE`, `400 TICKET_MISSING_FLOOR`, `400 TICKET_MISSING_ROOM`

---

### POST /api/devices/maintenance/verify
**No auth required** (IoT device endpoint).
Verifies a 6-digit maintenance code, sets device to `maintenance` status, updates linked ticket to `in_progress`.
```json
// Request
{ "code": "482931" }
// Response 200
{ "success": true, "data": { "verified": true, "deviceId": "...", "maintenanceDurationMinutes": 60, "maintenanceEndsAt": "..." } }
```

---

### GET /api/devices
**Requires JWT.** List all devices for an org.
**Query:** `?orgId=` (optional — defaults to first org in JWT)
**Response:** `{ "success": true, "data": { "organization": {...}, "deviceList": [...] } }`

---

### GET /api/devices/:id
**Requires JWT.** Single device by ObjectId. Populates `productId` with full product details.

Errors: `403 FORBIDDEN`, `404 DEVICE_NOT_FOUND`, `400 INVALID_DEVICE_ID`

---

## Products (`/api/products`)

Public catalog of device model definitions.

### GET /api/products
List all active products.

### GET /api/products/:id
Single product by ObjectId.

---

## Tickets (`/api/tickets`)

All endpoints **require JWT**. Access is role-enforced — `user` role gets **403** on all ticket endpoints.

### POST /api/tickets
**Role: `serviceBody` only.** Create a ticket.
```json
// Request
{
  "orgId": "...",
  "type": "installation",           // or "maintenance"
  "title": "Install smoke detector near staircase",
  "priority": "high",               // low | medium | high | critical (default: medium)
  "productId": "...",               // required for installation — product model to provision
  "deviceId": "...",                // required for maintenance; omit for installation
  "assignedTo": "...",              // serviceBoy userId (optional at creation)
  "description": "...",
  "floor": { "floorsNo": 1, "name": "Ground Floor" },
  "room": { "roomNumber": "104", "name": "Staircase Area" },
  "scheduledAt": "2026-10-15T09:00:00Z",
  "notes": "..."
}
// Response 201
{ "success": true, "data": { /* ticket document */ } }
```

---

### GET /api/tickets/org/:orgId
**Role: `serviceBody` only.** All active tickets for an org (dashboard view).
Populates: `assignedTo` (name, mobile), `deviceId` (name, udn), `createdBy` (name).

---

### PATCH /api/tickets/:ticketId
**Role: `serviceBody` only.** Update any ticket field.
```json
{
  "assignedTo": "...",    // serviceBoy userId
  "status": "in_progress",
  "priority": "critical",
  "title": "...",
  "description": "...",
  "scheduledAt": "2026-10-15T09:00:00Z",
  "notes": "..."
}
```

---

### GET /api/tickets/assigned
**Role: `serviceBoy` only.** Returns all tickets assigned to the authenticated serviceBoy. No path param — userId comes from JWT `sub`.

---

### PATCH /api/tickets/:ticketId/progress
**Role: `serviceBoy` only.** serviceBoy updates status/notes on a ticket assigned to them.
```json
{
  "status": "in_progress",   // or "resolved"
  "notes": "..."
}
```
Returns `403` if the ticket is not assigned to this serviceBoy.
`resolvedAt` is auto-set when status = `resolved`.

---

### GET /api/tickets/:ticketId
**Role: `serviceBody` or `serviceBoy`.** Get ticket detail.
- `serviceBody` can view any ticket.
- `serviceBoy` can only view tickets assigned to them (403 otherwise).

**Response shape** (keys are renamed from raw DB fields for clarity):
```json
{
  "_id": "...",
  "type": "installation",
  "status": "open",
  "priority": "high",
  "title": "...",
  "floor": { "floorsNo": 1, "name": "Ground Floor" },
  "room": { "roomNumber": "104", "name": "Staircase Area" },
  "scheduledAt": "...",
  "isActive": true,

  "org": { "_id": "...", "name": "...", "city": "...", "address": "..." },

  "product": {
    "_id": "...",
    "modelNumber": "FX-SD-100",
    "name": "FireEx Smoke Detector Pro",
    "productType": "Optical Smoke Detector",
    "category": "smoke_detector"
  },

  "device": null,

  "assignedTo": { "_id": "...", "firstName": "Priya", "lastName": "Sharma", "mobileNumber": "9999999999" },
  "createdBy": { "_id": "...", "firstName": "Admin", "lastName": "FireEx" },

  "wifiNetworks": [
    { "ssid": "DONGARE", "password": "12345678" },
    { "ssid": "FireEx-HQ-Guest", "password": "guest@2024" }
  ]
}
```

> `orgId` → `org`, `productId` → `product`, `deviceId` → `device` (all populated). `wifiNetworks` comes from the org's `wifiCredentials` — exposes `ssid` + `password` only.

---

## Health

### GET /health
No auth. `{ "status": "ok", "timestamp": "..." }`
