# Data Model: Tickets

Tickets are created by `serviceBody` (company dashboard users) to assign work to a `serviceBoy` (field technician). Two types: installing a new device, or maintaining an existing one.

> **Database note (ADR-012):** MongoDB collection via Mongoose. All `id` fields are ObjectId strings.

---

## Ticket Types

| Type | Description |
|------|-------------|
| `installation` | A new device needs to be installed at a location. No `deviceId` — the device doesn't exist yet. `productId` specifies which product model to install. `floor` + `room` describe where to install. |
| `maintenance` | An existing device needs inspection, repair, or servicing. `deviceId` references the existing device. |

---

## Ticket Status

| Status | Description |
|--------|-------------|
| `open` | Created, not yet started |
| `in_progress` | serviceBoy has started work |
| `resolved` | Work complete — `resolvedAt` is auto-set |
| `closed` | Administratively closed by serviceBody |

Status transitions:
- `serviceBody` can set any status via `PATCH /api/tickets/:id`
- `serviceBoy` can only move to `in_progress` or `resolved` on their own ticket via `PATCH /api/tickets/:id/progress`

---

## MongoDB: `tickets` Collection

```ts
{
  _id:          ObjectId,
  orgId:        ObjectId,    // ref: organisations — the client org this ticket is for
  deviceId?:    ObjectId,    // ref: devices — present for 'maintenance', absent for 'installation'
  productId?:   ObjectId,    // ref: products — present for 'installation'; the product model to be provisioned
  assignedTo?:  ObjectId,    // ref: users (serviceBoy)
  createdBy:    ObjectId,    // ref: users (serviceBody who created the ticket)

  type:         'installation' | 'maintenance',
  status:       'open' | 'in_progress' | 'resolved' | 'closed',   // default 'open'
  priority:     'low' | 'medium' | 'high' | 'critical',           // default 'medium'

  title:        string,
  description?: string,

  floor?: { floorsNo: number, name: string },
  room?:  { roomNumber: string, name: string },

  scheduledAt?: Date,
  resolvedAt?:  Date,    // auto-set when status changes to 'resolved'
  notes?:       string,

  isActive:     boolean,   // default true (soft-delete guard)
  createdAt:    Date,
  updatedAt:    Date,
}
```

### Indexes
- `{ orgId, status }` — org dashboard queries
- `{ assignedTo, status }` — serviceBoy assigned list
- `{ createdBy }` — audit queries

---

## API: Tickets — Role-Enforced

### serviceBody (dashboard) endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/tickets` | Create a ticket (installation or maintenance) |
| `GET` | `/api/tickets/org/:orgId` | All tickets for an org |
| `PATCH` | `/api/tickets/:ticketId` | Update: assign serviceBoy, priority, status, title, description, scheduledAt, notes |
| `GET` | `/api/tickets/:ticketId` | View any ticket detail |

`user` role → **403 Forbidden** on all the above.

### serviceBoy (field technician) endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/tickets/assigned` | Own assigned tickets — userId from JWT, no path param |
| `PATCH` | `/api/tickets/:ticketId/progress` | Update status (`in_progress` or `resolved`) + notes. Only works on tickets assigned to them. |
| `GET` | `/api/tickets/:ticketId` | View detail of a ticket assigned to them only |

`user` role → **403 Forbidden** on all the above.

---

## GET /api/tickets/:ticketId — Response Shape

The detail endpoint populates all refs and reshapes keys for clarity:

```json
{
  "_id": "...",
  "type": "installation",
  "status": "open",
  "priority": "high",
  "title": "Install smoke detector near main staircase",
  "description": "...",
  "floor": { "floorsNo": 1, "name": "Ground Floor" },
  "room": { "roomNumber": "104", "name": "Staircase Area" },
  "scheduledAt": "...",
  "resolvedAt": null,
  "notes": "...",
  "isActive": true,
  "createdAt": "...",
  "updatedAt": "...",

  "org": {
    "_id": "...",
    "name": "FireEx Services HQ",
    "city": "New Delhi",
    "address": "789 Fire Station Road"
  },

  "product": {
    "_id": "...",
    "modelNumber": "FX-SD-100",
    "name": "FireEx Smoke Detector Pro",
    "productType": "Optical Smoke Detector",
    "category": "smoke_detector"
  },

  "device": null,

  "assignedTo": {
    "_id": "...",
    "firstName": "Priya",
    "lastName": "Sharma",
    "mobileNumber": "9999999999"
  },

  "createdBy": {
    "_id": "...",
    "firstName": "Admin",
    "lastName": "FireEx"
  },

  "wifiNetworks": [
    { "ssid": "DONGARE", "password": "12345678" },
    { "ssid": "FireEx-HQ-Guest", "password": "guest@2024" }
  ]
}
```

**Key notes:**
- `orgId` → renamed to `org` (populated)
- `productId` → renamed to `product` (populated); null for maintenance tickets
- `deviceId` → renamed to `device` (populated); null for installation tickets
- `wifiNetworks` — derived from `org.wifiCredentials`; exposes `ssid` and `password` only (no `username`)

---

## Seed Data

10 tickets seeded, all assigned to Priya Sharma (`9999999999`, serviceBoy):

Per org (×2 orgs = 10 total):
- `installation` / priority `high` / status `open` — install smoke detector (productId: FX-SD-100)
- `installation` / priority `medium` / status `in_progress` — install sprinkler controller (productId: FX-SP-300)
- `maintenance` / priority `low` / status `open` — Smoke Detector inspection
- `maintenance` / priority `medium` / status `open` — Heat Detector inspection
- `maintenance` / priority `high` / status `in_progress` — Alarm Panel (false alarm note)

Creator: Admin FireEx (`5555555555`, serviceBody).
