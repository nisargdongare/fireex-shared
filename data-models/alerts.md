# Data Model: Alerts

An alert is raised when a device detects a condition that exceeds a configured threshold. Alerts are the most critical data type in the system — they must propagate reliably across all channels and never be silently dropped.

---

## Alert Types

| Type | Trigger |
|------|---------|
| `smoke` | Smoke level exceeds `smoke_threshold` in device config |
| `co` | CO level exceeds `co_threshold_ppm` in device config |
| `temperature` | Temperature exceeds `temp_threshold_celsius` in device config |
| `device_offline` | Device stops reporting for longer than `offline_threshold` (default 2 min) |
| `battery_low` | Battery backup below 20% |
| `tamper` | Device physically tampered with (cover opened) — TBD sensor |
| `test` | Manually triggered test alarm (does not dispatch emergency notifications) |

---

## Alert Severity

| Severity | Types | Response |
|----------|-------|----------|
| `critical` | `smoke`, `co` | Immediate dispatch of push + SMS. Auto-create `critical` priority ticket. |
| `high` | `temperature`, `tamper` | Push notification + create `high` priority ticket. |
| `warning` | `device_offline`, `battery_low` | Push notification. Create `normal` priority ticket. |
| `info` | `test` | In-app notification only. No ticket created. |

---

## Alert Status Flow

```
active → acknowledged → resolved
  ↓
false_alarm (can be set during acknowledge step)
```

| Status | Description |
|--------|-------------|
| `active` | Alert is ongoing, unacknowledged |
| `acknowledged` | A technician or admin has acknowledged the alert |
| `resolved` | The underlying condition has cleared and the device is back to normal |
| `false_alarm` | Acknowledged as a false alarm (device malfunction, test spray, etc.) |

---

## PostgreSQL: `alerts` Table

```sql
CREATE TABLE alerts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id           UUID NOT NULL REFERENCES devices(id),
  type                VARCHAR(20) NOT NULL
                      CHECK (type IN ('smoke','co','temperature','device_offline','battery_low','tamper','test')),
  severity            VARCHAR(10) NOT NULL
                      CHECK (severity IN ('critical','high','warning','info')),
  status              VARCHAR(15) NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active','acknowledged','resolved','false_alarm')),
  triggered_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acknowledged_at     TIMESTAMPTZ,
  acknowledged_by     UUID REFERENCES users(id),
  resolved_at         TIMESTAMPTZ,
  resolved_by         UUID REFERENCES users(id),   -- can be NULL if auto-resolved by device
  sensor_values       JSONB NOT NULL,               -- snapshot of readings at trigger time
  threshold_values    JSONB NOT NULL,               -- snapshot of config thresholds at trigger time
  notes               TEXT,                         -- filled during acknowledge
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ON alerts (device_id, triggered_at DESC);
CREATE INDEX ON alerts (status) WHERE status = 'active';
```

### `sensor_values` JSONB example:
```json
{
  "smokeLevel": 0.87,
  "coPpm": 12.3,
  "temperatureCelsius": 42.1,
  "humidityPct": 55.0
}
```

### `threshold_values` JSONB example:
```json
{
  "smokeThreshold": 0.5,
  "coThresholdPpm": 50.0,
  "tempThresholdCelsius": 60.0
}
```

---

## PostgreSQL: `alert_notifications` Table

Tracks every notification sent for an alert:

```sql
CREATE TABLE alert_notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id        UUID NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
  channel         VARCHAR(20) NOT NULL
                  CHECK (channel IN ('push','sms','websocket','email')),
  recipient_id    UUID REFERENCES users(id),        -- NULL for broadcast
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivery_status VARCHAR(20) DEFAULT 'sent'
                  CHECK (delivery_status IN ('sent','delivered','failed')),
  error_message   TEXT
);
```

---

## Notification Routing Logic

When an alert is created:

1. **Identify affected scope**: get `department_id` from the device's room → floor → building → department chain
2. **Notify** all users in that department (role-filtered):
   - `critical` / `high`: notify `end_user`, `technician`, `dept_admin` in the department + all `super_admin`
   - `warning`: notify `technician`, `dept_admin` in the department + all `super_admin`
   - `info`: in-app only, no external channel

3. **Channel by severity**:

| Severity | WebSocket | Push Notification | SMS |
|----------|-----------|-------------------|-----|
| `critical` | ✓ | ✓ | ✓ (dept_admin + technicians) |
| `high` | ✓ | ✓ | ✗ |
| `warning` | ✓ | ✓ | ✗ |
| `info` | ✓ | ✗ | ✗ |

---

## Alert Auto-Resolution

- `smoke` and `co` alerts auto-resolve when the device sends a reading below threshold AND the alert has been acknowledged
- `device_offline` alerts auto-resolve when the device comes back online
- `battery_low` alerts auto-resolve when battery exceeds 25%
- `temperature` alerts are NOT auto-resolved — require manual acknowledgment

---

## WebSocket Event: `alert.new`

Sent to all subscribers of the affected department/building immediately when an alert is created:

```json
{
  "type": "alert.new",
  "payload": {
    "alertId": "uuid",
    "deviceId": "uuid",
    "deviceCode": "FX-0042",
    "roomName": "Server Room 3B",
    "buildingName": "Block A",
    "alertType": "smoke",
    "severity": "critical",
    "triggeredAt": "2024-01-15T14:32:00Z",
    "sensorValues": {
      "smokeLevel": 0.87
    }
  }
}
```

See `api-contracts/websocket-events.md` for all WebSocket event types.

---

## API: Alerts

| Endpoint | Access | Description |
|----------|--------|-------------|
| `GET /api/alerts` | technician+ | List alerts (filtered by scope and status) |
| `GET /api/alerts/active` | technician+ | List only active alerts for quick dashboard |
| `GET /api/alerts/:id` | technician+ | Get alert details |
| `POST /api/alerts/:id/acknowledge` | technician+ | Acknowledge alert |
| `POST /api/alerts/:id/resolve` | technician+ | Mark alert resolved |
| `POST /api/alerts/:id/false-alarm` | technician+ | Mark as false alarm |

See `api-contracts/rest-api.md` for full request/response shapes.
