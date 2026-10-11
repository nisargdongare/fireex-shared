# FireEx REST API Contracts

Base URL: `https://api.fireex.com/api` (production TBD)
Dev URL: `http://localhost:3000/api`
Swagger UI: `http://localhost:3000/api/docs`

All requests and responses use `Content-Type: application/json`.
Authentication: `Authorization: Bearer <access_token>` on all protected routes.

> All `id` fields are MongoDB ObjectId strings (24-char hex, e.g. `"665f1a2b9e1c4a0012abcdef"`).

---

## Response Envelope

**Success:**
```json
{ "success": true, "data": { ... } }
```

**Error:**
```json
{ "success": false, "error": "ERROR_CODE", "message": "Human-readable description" }
```

---

## Authentication (`/api/auth`)

### POST /api/auth/otp/request
Request OTP sent to the user's registered mobile number. Public — no JWT required.

**Request:**
```json
{ "mobileNumber": "8888888888" }
```
`mobileNumber` is 10 digits, no country code.

**Response 200:**
```json
{ "success": true, "message": "OTP sent successfully. Check your SMS." }
```

**Errors:** `400 VALIDATION_ERROR`, `404 PHONE_NOT_REGISTERED`, `500 INTERNAL_SERVER_ERROR`

---

### POST /api/auth/otp/verify
Verify OTP and receive JWT tokens. Public — no JWT required.

**Request:**
```json
{ "mobileNumber": "8888888888", "otp": "123456" }
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJ...",
    "refreshToken": "eyJ...",
    "user": {
      "_id": "665f1a2b9e1c4a0012abcdef",
      "mobileNumber": "8888888888",
      "appRole": "user",
      "firstName": "John",
      "lastName": "Doe",
      "organizations": [{ "_id": "...", "name": "FireEx Services" }],
      "email": "john@example.com",
      "isActive": true
    }
  }
}
```

**Errors:** `400 INVALID_OTP`, `400 OTP_EXPIRED`, `400 OTP_NOT_FOUND`, `403 USER_INACTIVE`, `404 PHONE_NOT_REGISTERED`

---

### POST /api/auth/refresh
Exchange a refresh token for a new access + refresh token pair. Public — no JWT required.

**Request:**
```json
{ "refreshToken": "eyJ..." }
```

**Response 200:**
```json
{ "success": true, "data": { "accessToken": "eyJ...", "refreshToken": "eyJ..." } }
```

**Errors:** `401 INVALID_REFRESH_TOKEN`, `401 REFRESH_TOKEN_EXPIRED`, `401 REFRESH_TOKEN_REVOKED`, `403 USER_INACTIVE`

---

### POST /api/auth/logout
Revoke a refresh token. **Requires JWT.**

**Request:**
```json
{ "refreshToken": "eyJ..." }
```

**Response 200:**
```json
{ "success": true, "message": "Logout successful" }
```

---

## Users (`/api/users`)

### POST /api/users/login
Direct login by mobile number — no OTP step. Returns user + JWT tokens. Public — no JWT required.
> Used for dev/test. The production login flow is OTP-based via `/api/auth/otp/request` + `/otp/verify`.

**Request:**
```json
{ "mobileNumber": "8888888888" }
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJ...",
    "refreshToken": "eyJ...",
    "user": {
      "_id": "...",
      "mobileNumber": "8888888888",
      "appRole": "user",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john@example.com",
      "address": "123 Main St",
      "city": "New Delhi",
      "state": "Delhi",
      "pincode": "110001",
      "organizations": [{ "_id": "...", "name": "FireEx Services" }],
      "isActive": true
    }
  }
}
```

**Errors:** `400 VALIDATION_ERROR`, `403 USER_INACTIVE`, `404 USER_NOT_FOUND`

---

### GET /api/users/me
Get the currently authenticated user's full profile. **Requires JWT.**

**Response 200:**
```json
{
  "success": true,
  "data": {
    "_id": "...",
    "mobileNumber": "8888888888",
    "appRole": "user",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "address": "123 Main St",
    "city": "New Delhi",
    "state": "Delhi",
    "pincode": "110001",
    "organizations": [{ "_id": "...", "name": "FireEx Services" }],
    "isActive": true
  }
}
```

---

## Devices (`/api/devices`)

All device endpoints **require JWT**. `orgId` can be passed as a query param; if omitted, the first org from the user's JWT `organizations[]` is used. Users can only access devices belonging to their own organizations.

### GET /api/devices
List all devices for an organization.

**Query params:** `orgId` (optional)

**Response 200:**
```json
{
  "success": true,
  "data": {
    "organization": {
      "_id": "...", "name": "FireEx Services", "email": "...", "mobileNumber": "...",
      "address": "...", "city": "...", "state": "...", "pincode": "...",
      "gstNumber": "...", "registrationNumber": "...", "isActive": true,
      "createdAt": "...", "updatedAt": "..."
    },
    "deviceList": [
      {
        "_id": "...",
        "deviceName": "Smoke Detector 1",
        "deviceType": "smoke_detector",
        "floor": { "floorsNo": 1, "name": "Ground Floor" },
        "room": { "roomNumber": "101", "name": "Main Office" },
        "status": "active",
        "location": "Near entrance",
        "serialNumber": "SN-001",
        "installationDate": "2024-01-01T00:00:00Z",
        "isActive": true,
        "createdAt": "...", "updatedAt": "..."
      }
    ]
  }
}
```

**Errors:** `400 ORG_ID_MISSING`, `400 INVALID_ORG_ID`, `403 FORBIDDEN`, `404 ORGANIZATION_NOT_FOUND`

---

### GET /api/devices/floor/:floorNumber
List all devices on a specific floor.

**Path:** `floorNumber` (integer)
**Query params:** `orgId` (optional)

**Response 200:** Same shape as `GET /api/devices`

**Errors:** `400 INVALID_FLOOR_NUMBER`, `400 ORG_ID_MISSING`, `403 FORBIDDEN`, `404 ORGANIZATION_NOT_FOUND`

---

### GET /api/devices/room/:roomNumber
List all devices in a specific room.

**Path:** `roomNumber` (string, e.g. `"101"`)
**Query params:** `orgId` (optional)

**Response 200:** Same shape as `GET /api/devices`

---

### GET /api/devices/:id
Get a specific device by its MongoDB ObjectId.

**Response 200:**
```json
{ "success": true, "data": { /* device object */ } }
```

**Errors:** `400 INVALID_DEVICE_ID`, `403 FORBIDDEN`, `404 DEVICE_NOT_FOUND`

---

## Products (`/api/products`) — Coming Soon

The `products` collection (device model catalog) is being added. It will expose:
- `GET /api/products` — list all product definitions
- `GET /api/products/:id` — get a specific product by ID

Products hold model-level data (modelNumber, hardwareVersions, latestSoftwareVersions, controls, features) shared across all physical units of the same model. IoT devices will fetch this on first boot when registering.

---

## Health

### GET /health
No auth required.

**Response 200:**
```json
{ "status": "ok", "timestamp": "2024-01-15T14:30:00Z" }
```
