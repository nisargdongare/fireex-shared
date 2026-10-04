# FireEx REST API Contracts

Base URL: `https://api.fireex.example.com/api` (production TBD)
Dev URL: `http://localhost:3000/api`

All requests and responses use `Content-Type: application/json`.
Authentication: `Authorization: Bearer <access_token>` header on all protected routes.

---

## Authentication

### POST /api/auth/otp/request
Request an OTP to be sent to the user's phone number.

**Request:**
```json
{
  "phoneNumber": "+911234567890"
}
```

**Response 200:**
```json
{
  "success": true,
  "message": "OTP sent",
  "expiresInSeconds": 300
}
```

**Response 404** (phone number not registered):
```json
{ "error": "PHONE_NOT_REGISTERED" }
```

**Response 429** (rate limited):
```json
{ "error": "TOO_MANY_REQUESTS", "retryAfterSeconds": 60 }
```

---

### POST /api/auth/otp/verify
Verify the OTP and receive tokens.

**Request:**
```json
{
  "phoneNumber": "+911234567890",
  "otp": "492817"
}
```

**Response 200:**
```json
{
  "accessToken": "eyJ...",
  "refreshToken": "eyJ...",
  "user": {
    "id": "uuid",
    "fullName": "Ravi Kumar",
    "phoneNumber": "+911234567890",
    "role": "technician",
    "departmentId": "uuid"
  }
}
```

**Response 400:**
```json
{ "error": "INVALID_OTP" }
```

**Response 410:**
```json
{ "error": "OTP_EXPIRED" }
```

---

### POST /api/auth/refresh
Exchange a refresh token for a new access token.

**Request:**
```json
{ "refreshToken": "eyJ..." }
```

**Response 200:**
```json
{
  "accessToken": "eyJ...",
  "refreshToken": "eyJ..."
}
```

---

### POST /api/auth/logout
Revoke the current refresh token.

**Request:** (no body, uses Authorization header)

**Response 200:**
```json
{ "success": true }
```

---

## Users

### GET /api/users
List users. `super_admin` sees all; `dept_admin` sees only their department.

**Query params:** `role`, `departmentId`, `page`, `limit`, `search`

**Response 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "fullName": "Ravi Kumar",
      "phoneNumber": "+911234567890",
      "role": "technician",
      "departmentId": "uuid",
      "departmentName": "Fire Safety Dept A",
      "isActive": true,
      "createdAt": "2024-01-10T00:00:00Z"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 47 }
}
```

---

### POST /api/users
Register a new user.

**Access:** `super_admin`, `dept_admin` (dept_admin can only create `end_user` and `technician` in their dept)

**Request:**
```json
{
  "fullName": "Priya Singh",
  "phoneNumber": "+919876543210",
  "role": "technician",
  "departmentId": "uuid"
}
```

**Response 201:**
```json
{
  "id": "uuid",
  "fullName": "Priya Singh",
  "phoneNumber": "+919876543210",
  "role": "technician",
  "departmentId": "uuid",
  "isActive": true,
  "createdAt": "2024-01-15T10:00:00Z"
}
```

---

### PATCH /api/users/:id
Update user. `dept_admin` can update users in their dept (cannot change role to `super_admin` or `dept_admin`).

**Request (all fields optional):**
```json
{
  "fullName": "Priya Sharma",
  "isActive": false
}
```

---

## Devices

### GET /api/devices
**Query params:** `departmentId`, `roomId`, `status`, `page`, `limit`

**Response 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "deviceCode": "FX-0042",
      "serialNumber": "SN-ESP32-00042",
      "status": "online",
      "firmwareVersion": "1.2.3",
      "lastSeenAt": "2024-01-15T14:30:00Z",
      "room": {
        "id": "uuid",
        "name": "Server Room 3B",
        "floor": { "floorNumber": 3 },
        "building": { "name": "Block A" }
      }
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 12 }
}
```

---

### POST /api/devices
**Access:** `super_admin`

**Request:**
```json
{
  "deviceCode": "FX-0043",
  "serialNumber": "SN-ESP32-00043",
  "departmentId": "uuid",
  "roomId": "uuid"
}
```

**Response 201:** Device object

---

### GET /api/devices/:id/readings
Get time-series sensor readings.

**Query params:** `from` (ISO8601), `to` (ISO8601), `interval` (raw|1m|5m|1h|1d), `limit`

**Response 200:**
```json
{
  "deviceId": "uuid",
  "interval": "5m",
  "data": [
    {
      "time": "2024-01-15T14:00:00Z",
      "smokeLevel": 0.12,
      "coPpm": 8.4,
      "temperatureCelsius": 23.5,
      "humidityPct": 52.0,
      "wifiRssi": -65
    }
  ]
}
```

---

### POST /api/devices/:id/command
Send a command to a device.

**Access:** `dept_admin+`

**Request:**
```json
{
  "command": "test_alarm",
  "params": {}
}
```

Valid commands: `test_alarm`, `silence_alarm`, `reboot`, `sync_config`

**Response 202:**
```json
{
  "commandId": "uuid",
  "status": "queued",
  "message": "Command sent to device via MQTT"
}
```

---

## Alerts

### GET /api/alerts
**Query params:** `status`, `severity`, `deviceId`, `departmentId`, `from`, `to`, `page`, `limit`

**Response 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "type": "smoke",
      "severity": "critical",
      "status": "active",
      "triggeredAt": "2024-01-15T14:32:00Z",
      "device": {
        "id": "uuid",
        "deviceCode": "FX-0042",
        "room": { "name": "Server Room 3B", "building": { "name": "Block A" } }
      },
      "sensorValues": { "smokeLevel": 0.87 }
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 3 }
}
```

---

### POST /api/alerts/:id/acknowledge
**Request:**
```json
{
  "notes": "Investigated — steam from coffee machine triggered sensor. Cleaning unit."
}
```

**Response 200:** Updated alert object

---

### POST /api/alerts/:id/resolve
**Request:**
```json
{
  "notes": "Sensor cleaned and reset. Back to normal."
}
```

---

## Tickets

### GET /api/tickets
**Query params:** `status`, `type`, `priority`, `assignedTo`, `deviceId`, `page`, `limit`

**Response 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "ticketNumber": "TKT-2024-0042",
      "type": "alert_response",
      "status": "assigned",
      "priority": "critical",
      "title": "Smoke alert — Server Room 3B",
      "assignedTo": {
        "id": "uuid",
        "fullName": "Ravi Kumar"
      },
      "device": {
        "deviceCode": "FX-0042",
        "room": { "name": "Server Room 3B" }
      },
      "createdAt": "2024-01-15T14:32:00Z"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 8 }
}
```

---

### GET /api/tickets/:id
Returns full ticket including checklist items and comments.

**Response 200:**
```json
{
  "id": "uuid",
  "ticketNumber": "TKT-2024-0042",
  "type": "alert_response",
  "status": "in_progress",
  "priority": "critical",
  "title": "Smoke alert — Server Room 3B",
  "description": "Critical smoke alert triggered at 14:32. Device FX-0042.",
  "device": { "id": "uuid", "deviceCode": "FX-0042" },
  "alert": { "id": "uuid", "type": "smoke", "triggeredAt": "2024-01-15T14:32:00Z" },
  "assignedTo": { "id": "uuid", "fullName": "Ravi Kumar" },
  "checklist": [
    {
      "id": "uuid",
      "itemOrder": 1,
      "label": "Verify alarm condition",
      "isRequired": true,
      "isChecked": true,
      "checkedAt": "2024-01-15T14:45:00Z"
    }
  ],
  "comments": [],
  "createdAt": "2024-01-15T14:32:00Z"
}
```

---

### PATCH /api/tickets/:id
Update ticket status, checklist, notes.

**Request:**
```json
{
  "status": "in_progress",
  "checklistItems": [
    { "id": "uuid", "isChecked": true, "notes": "Steam confirmed from break room." }
  ],
  "resolutionNotes": "Steam from adjacent break room. Sensor cleaned."
}
```

---

## Buildings

### GET /api/buildings
**Response 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Block A",
      "address": "123 Industrial Area",
      "city": "Mumbai",
      "deviceCount": 24,
      "activeAlertCount": 1
    }
  ]
}
```

---

### GET /api/buildings/:id/floors
**Response 200:**
```json
{
  "buildingId": "uuid",
  "floors": [
    {
      "id": "uuid",
      "floorNumber": 3,
      "floorName": "Third Floor",
      "roomCount": 8,
      "deviceCount": 12
    }
  ]
}
```

---

## Error Response Format

All error responses follow this shape:
```json
{
  "error": "ERROR_CODE",
  "message": "Human readable description",
  "details": {}
}
```

Common error codes: `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION_ERROR`, `INVALID_OTP`, `OTP_EXPIRED`, `PHONE_NOT_REGISTERED`, `TOO_MANY_REQUESTS`, `INTERNAL_ERROR`
