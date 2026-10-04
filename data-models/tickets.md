# Data Model: Maintenance Tickets

Maintenance tickets track all device inspection, repair, and maintenance work. They are created either automatically (triggered by an alert) or manually by a department admin or super admin.

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

## PostgreSQL: `tickets` Table

```sql
CREATE TABLE tickets (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number       VARCHAR(20) NOT NULL UNIQUE,   -- human-readable: "TCKT-4821"
  type                VARCHAR(30) NOT NULL
                      CHECK (type IN ('alert_response','scheduled_maintenance','corrective_maintenance','installation')),
  status              VARCHAR(20) NOT NULL DEFAULT 'open'
                      CHECK (status IN ('open','assigned','in_progress','pending_parts','resolved','cancelled')),
  priority            VARCHAR(10) NOT NULL DEFAULT 'normal'
                      CHECK (priority IN ('low','normal','high','critical')),
  device_id           UUID NOT NULL REFERENCES devices(id),
  alert_id            UUID REFERENCES alerts(id),    -- if triggered by an alert
  assigned_to         UUID REFERENCES users(id),     -- technician
  created_by          UUID NOT NULL REFERENCES users(id),
  title               VARCHAR(255) NOT NULL,
  description         TEXT,
  resolution_notes    TEXT,
  scheduled_for       TIMESTAMPTZ,                   -- for scheduled maintenance
  started_at          TIMESTAMPTZ,
  resolved_at         TIMESTAMPTZ,
  due_at              TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## PostgreSQL: `ticket_checklist_items` Table

Each ticket has a checklist that the technician completes during the inspection:

```sql
CREATE TABLE ticket_checklist_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id       UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  item_order      SMALLINT NOT NULL,
  label           VARCHAR(255) NOT NULL,        -- e.g. "Test smoke detector sensitivity"
  is_required     BOOLEAN NOT NULL DEFAULT true,
  is_checked      BOOLEAN NOT NULL DEFAULT false,
  checked_at      TIMESTAMPTZ,
  checked_by      UUID REFERENCES users(id),
  notes           TEXT
);
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

## PostgreSQL: `ticket_comments` Table

```sql
CREATE TABLE ticket_comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id   UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  author_id   UUID NOT NULL REFERENCES users(id),
  body        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## PostgreSQL: `ticket_attachments` Table

Photos taken during inspection:

```sql
CREATE TABLE ticket_attachments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id       UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  uploaded_by     UUID NOT NULL REFERENCES users(id),
  file_url        TEXT NOT NULL,            -- cloud storage URL
  file_type       VARCHAR(50),              -- image/jpeg, image/png, etc.
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## Ticket Number Generation

Format: `TCKT-NNNN` (e.g., `TCKT-4821`)
- Sequential 4-digit counter, no year prefix
- Zero-padded to 4 digits minimum
- Generated in backend at ticket creation, never by the client

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
