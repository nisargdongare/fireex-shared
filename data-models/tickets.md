# Data Model: Maintenance Tickets

Maintenance tickets track all device inspection, repair, and maintenance work. They are created either automatically (triggered by an alert) or manually by a department admin or super admin.

> **Database note (ADR-012):** All collections below are MongoDB collections accessed via Mongoose, not PostgreSQL tables. `id` fields are MongoDB ObjectId strings, not UUIDs. `ticket_checklist_items`, `ticket_comments`, and `ticket_attachments` are now embedded arrays on the ticket document itself — see below.

---

## Ticket Types

| Type | Description |
|------|-------------|
| `alert_response` | Created automatically when an alert is raised. Assigned to the on-call technician for the building. |
| `scheduled_maintenance` | Periodic inspection ticket (e.g., monthly device check). |
| `corrective_maintenance` | Created manually to fix a known issue that did not trigger an alert. |
| `installation` | Created when a new device needs to be installed or an existing one replaced. |

---

## Ticket Status Flow

```
open → assigned → in_progress → resolved
  ↓                    ↓
cancelled           pending_parts → in_progress → resolved
```

| Status | Description |
|--------|-------------|
| `open` | Ticket created, not yet assigned to a technician |
| `assigned` | Assigned to a technician, not yet started |
| `in_progress` | Technician has begun work |
| `pending_parts` | Paused, waiting for replacement parts |
| `resolved` | Work complete, device operational |
| `cancelled` | Ticket cancelled (false alarm, duplicate, etc.) |

---

## MongoDB: `tickets` Collection

```ts
{
  _id:               ObjectId,
  ticketNumber:      string,     // human-readable: "TKT-0042" — unique index
  type:              'alert_response' | 'scheduled_maintenance' | 'corrective_maintenance' | 'installation',
  status:            'open' | 'assigned' | 'in_progress' | 'pending_parts' | 'resolved' | 'cancelled',  // default 'open', indexed
  priority:          'low' | 'normal' | 'high' | 'critical',  // default 'normal'
  deviceId:          ObjectId,   // ref: devices, indexed
  alertId?:          ObjectId,   // ref: alerts — if triggered by an alert
  assignedTo?:       ObjectId,   // ref: users (technician), indexed
  createdBy:         ObjectId,   // ref: users
  title:             string,
  description?:      string,
  resolutionNotes?:  string,
  scheduledFor?:     Date,       // for scheduled maintenance
  startedAt?:        Date,
  resolvedAt?:       Date,
  dueAt?:            Date,
  checklist:         [ChecklistItem],    // embedded array, see below
  comments:          [TicketComment],    // embedded array, see below
  attachments:       [TicketAttachment], // embedded array, see below
  createdAt:         Date,
  updatedAt:         Date,
}
```

---

## Embedded: `ChecklistItem` (within `tickets.checklist[]`)

Each ticket has a checklist that the technician completes during the inspection. Previously a separate `ticket_checklist_items` table — now an embedded subdocument array, since checklist items are always fetched and updated together with their parent ticket (see `PATCH /api/tickets/:id`).

```ts
{
  _id:          ObjectId,    // Mongoose auto-generates a subdocument _id, used to target updates
  itemOrder:    number,
  label:        string,      // e.g. "Test smoke detector sensitivity"
  isRequired:   boolean,     // default true
  isChecked:    boolean,     // default false
  checkedAt?:   Date,
  checkedBy?:   ObjectId,    // ref: users
  notes?:       string,
}
```

### Default Checklist by Ticket Type

**`alert_response`:**
1. Device confirmed maintenance mode (pre-checked after technician enters code on device)
2. Inspect site for fire/smoke damage (visual inspection)
3. Inspect and clean MQ2 smoke sensor chamber
4. Check sprinkler valve status — if triggered, reset physical valve and restock water supply
5. Test device after resolution (buzzer, LEDs, exhaust fan, all sensors)
6. Reset device alarm state in backend

**`scheduled_maintenance`:**
1. Visual inspection of unit and mounting
2. Clean smoke sensor chamber
3. Test smoke detection (using test spray)
4. Test CO sensor response
5. Test buzzer and LED indicators
6. Check battery backup level
7. Verify WiFi connectivity and MQTT reporting
8. Document any wear or damage

**`installation`:**
1. Confirm mounting location approved
2. Mount device per installation guide
3. Connect power (12V DC)
4. Program device ID and credentials via USB serial
5. Verify device comes online (MQTT connection confirmed)
6. Test all sensors and actuators
7. Assign device to room in backend
8. Attach device label

---

## Embedded: `TicketComment` (within `tickets.comments[]`)

```ts
{
  _id:        ObjectId,
  authorId:   ObjectId,   // ref: users
  body:       string,
  createdAt:  Date,
}
```

---

## Embedded: `TicketAttachment` (within `tickets.attachments[]`)

Photos taken during inspection:

```ts
{
  _id:          ObjectId,
  uploadedBy:   ObjectId,   // ref: users
  fileUrl:      string,     // cloud storage URL
  fileType?:    string,     // image/jpeg, image/png, etc.
  createdAt:    Date,
}
```

---

## Ticket Number Generation

Format: `TKT-NNNN` (e.g., `TKT-0042`)
- Sequential 4-digit counter, zero-padded to 4 digits minimum
- Generated in backend at ticket creation (currently derived from collection document count; consider a dedicated counter document if concurrent creation becomes an issue, since MongoDB has no auto-increment sequence primitive), never by the client

---

## Priority Assignment Rules

| Scenario | Priority |
|----------|----------|
| Alert triggered (smoke/CO above threshold) | `critical` |
| Alert triggered (temperature threshold) | `high` |
| Device offline > 1 hour | `high` |
| Device offline < 1 hour | `normal` |
| Scheduled maintenance | `low` |
| Manual corrective | `normal` (admin can override) |

---

## API: Tickets

| Endpoint | Access | Description |
|----------|--------|-------------|
| `POST /api/tickets` | dept_admin+, system | Create a ticket |
| `GET /api/tickets` | technician+ | List tickets (technician sees assigned; admin sees dept) |
| `GET /api/tickets/:id` | technician+ | Get ticket details with checklist |
| `PATCH /api/tickets/:id` | technician (own) + admin | Update status, checklist, notes |
| `POST /api/tickets/:id/comments` | technician+ | Add comment |
| `POST /api/tickets/:id/attachments` | technician | Upload photo attachment |

See `api-contracts/rest-api.md` for full request/response shapes.
