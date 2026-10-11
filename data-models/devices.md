# Data Model: Devices

A FireEx device is a physical hardware unit installed in a building. The backend tracks devices per organisation, with floor and room as embedded subdocuments.

> **Note:** Previous docs described fields like `deviceCode`, `departmentId`, `roomId`, `config` subdocument, and states like `unprovisioned`/`alarming`/`decommissioned`. Those are **planned future fields**. The current implemented schema is documented below.

---

## MongoDB: `devices` Collection

```ts
{
  _id:              ObjectId,
  orgId:            ObjectId,   // ref: organisations — required
  deviceName:       string,     // required
  deviceType:       string,     // enum — required (see below)
  floor: {
    floorsNo:       number,     // required
    name:           string,     // required
  },
  room: {
    roomNumber:     string,     // required
    name:           string,     // required
  },
  status:           'active' | 'inactive' | 'maintenance',  // default 'active'
  location?:        string,
  serialNumber?:    string,     // unique (sparse — allows null)
  installationDate?: Date,
  isActive:         boolean,    // default true
  createdAt:        Date,
  updatedAt:        Date,
}
```

**`deviceType` enum values:**
`smoke_detector`, `heat_detector`, `sprinkler`, `alarm`, `camera`, `extinguisher`, `other`

**Indexes:**
- `(orgId, floor.floorsNo)` — compound
- `(orgId, room.roomNumber)` — compound
- `serialNumber` — unique sparse

---

## Products (Planned)

Products will represent the catalog of FireEx device models — their specs, hardware versions, software versions, controls, and features. These are "ideal" definitions shared across all physical units of the same model.

IoT devices will fetch the product catalog on first boot and reference a `productId` when registering as a device entry. The `products` collection and `Product` model are being added as the next backend feature.

---

## Device Status

| Status | Description |
|--------|-------------|
| `active` | Device is operational |
| `inactive` | Device is not in service |
| `maintenance` | Device is temporarily offline for maintenance |

---

## API: Device Endpoints (Implemented)

| Endpoint | Auth | Description |
|----------|------|-------------|
| `GET /api/devices?orgId=` | JWT | List all devices for an org |
| `GET /api/devices/floor/:floorNumber?orgId=` | JWT | List devices on a specific floor |
| `GET /api/devices/room/:roomNumber?orgId=` | JWT | List devices in a specific room |
| `GET /api/devices/:id` | JWT | Get a specific device by ID |

All device endpoints require a valid JWT. `orgId` can be passed as a query param or falls back to the first org in the user's `organizations[]` from the JWT. Users can only access devices belonging to their own organizations.

---

## Seed Data

`db.ts` seeds 1 default device on startup if the database is empty:
- Type: `smoke_detector`
- Floor: Ground Floor (floorsNo: 1)
- Room: Main Office (101)
- Linked to the default seeded organisation
