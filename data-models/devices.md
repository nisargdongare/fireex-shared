# Data Model: Devices

A FireEx device is a physical hardware unit installed in a building. The backend tracks devices per organisation, with floor and room as embedded subdocuments.

> **Note:** Previous docs described fields like `deviceCode`, `departmentId`, `roomId`, `config` subdocument, and states like `unprovisioned`/`alarming`/`decommissioned`. Those are **planned future fields**. The current implemented schema is documented below.

---

## MongoDB: `devices` Collection

```ts
{
  _id:               ObjectId,
  orgId:             ObjectId,   // ref: organisations — required
  productId:         ObjectId,   // ref: products — required; the product model this device is an instance of
  ticketId?:         ObjectId,   // ref: tickets — set when device is registered via POST /api/devices/register (BLE provisioning flow)
  udn:               string,     // Unique Device Number — auto-generated 5-digit string, unique across all devices
  deviceName:        string,     // copied from product.name at registration time
  floor: {
    floorsNo:        number,     // required
    name:            string,     // required
  },
  room: {
    roomNumber:      string,     // required
    name:            string,     // required
  },
  status:            'active' | 'inactive' | 'maintenance',  // default 'active'
  location?:         string,
  installationDate?: Date,
  isActive:          boolean,    // default true
  createdAt:         Date,
  updatedAt:         Date,
}
```

**Indexes:**
- `(orgId, floor.floorsNo)` — compound
- `(orgId, room.roomNumber)` — compound
- `ticketId` — unique sparse (one device per ticket)

---

## Products

Products represent the catalog of FireEx device models — specs, hardware/software versions, controls, and features. The `productId` on a device links it to its product definition.

See [data-models/devices.md] and `GET /api/products` for the full product schema.

**Key product fields exposed in device/ticket responses:**

| Field | Description |
|-------|-------------|
| `modelNumber` | BLE manufacturer data string (e.g. `FX-SD-100`) — used by mobile app to validate physical device during BLE pairing |
| `name` | Display name (e.g. "FireEx Smoke Detector Pro") |
| `productType` | Free text description (e.g. "Optical Smoke Detector") |
| `category` | Enum: `smoke_detector`, `heat_detector`, `sprinkler`, `alarm`, `camera`, `extinguisher`, `other` |

---

## Device Registration (BLE Provisioning Flow)

When a service boy provisions a new device via the mobile app:

1. Mobile app calls `GET /api/tickets/:ticketId` to get ticket details (includes `product.modelNumber` for BLE validation and `wifiNetworks` for WiFi provisioning).
2. Service boy scans the physical device via BLE — app validates `modelNumber` matches manufacturer data.
3. After BLE pairing and WiFi config, mobile app calls `POST /api/devices/register` with `{ productId, ticketId }`.
4. Backend creates the device, sets `ticketId` on it (unique sparse index prevents double-registration).

**To check if a ticket has already been used to register a device:**
```js
db.devices.findOne({ ticketId: ObjectId("...") })
// Returns document → ticket already used; null → ticket is unused
```

### POST /api/devices/register
No auth required (IoT/mobile endpoint).
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

**Error codes:**
| Code | Status | Meaning |
|------|--------|---------|
| `TICKET_ALREADY_USED` | 409 | A device already exists with this `ticketId` |
| `TICKET_NOT_FOUND` | 404 | |
| `PRODUCT_NOT_FOUND` | 404 | |
| `PRODUCT_INACTIVE` | 400 | |
| `ORGANIZATION_NOT_FOUND` | 404 | |
| `TICKET_MISSING_FLOOR` | 400 | Ticket has no floor — required for device placement |
| `TICKET_MISSING_ROOM` | 400 | Ticket has no room — required for device placement |

---

## Device Status

| Status | Description |
|--------|-------------|
| `active` | Device is operational |
| `inactive` | Device is not in service |
| `maintenance` | Device is temporarily offline for maintenance |

---

## API: Device Endpoints

| Endpoint | Auth | Description |
|----------|------|-------------|
| `POST /api/devices/register` | None | Register a new device via BLE provisioning (uses ticketId) |
| `POST /api/devices/maintenance/verify` | None | IoT device verifies a 6-digit maintenance code |
| `GET /api/devices` | JWT | List all devices for an org |
| `GET /api/devices/:id` | JWT | Get a specific device by ID (populates productId) |

All authenticated device endpoints require a valid JWT. `orgId` can be passed as a query param or falls back to the first org in the user's `organizations[]` from the JWT.

---

## Seed Data

10 devices seeded (5 per org), all created directly (no `ticketId` — not via provisioning flow):

Per org:
- FX-SD-100 Smoke Detector Pro — Ground Floor, Room 101 — status `active`
- FX-HT-200 Heat Detector Elite — Ground Floor, Room 102 — status `active`
- FX-AL-400 Alarm Panel — Ground Floor, Room 103 — status `active`
- FX-SP-300 Sprinkler Controller — First Floor, Room 201 — status `active`
- FX-SD-100 Smoke Detector Pro — First Floor, Room 202 — status `maintenance`
