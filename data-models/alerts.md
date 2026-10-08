# Data Model: Alerts

An alert is raised when a device detects a condition that exceeds a configured threshold. Alerts are the most critical data type in the system — they must propagate reliably across all channels and never be silently dropped.

> **Database note (ADR-012):** All collections below are MongoDB collections accessed via Mongoose, not PostgreSQL tables. `id` fields are MongoDB ObjectId strings, not UUIDs. `alert_notifications` (previously a separate table) is now an embedded array on the alert document itself — see below.

---

## Alert Types

| Type | Trigger |
|------|---------|
| `smoke` | Smoke level exceeds `smokeThreshold` in device config |
| `co` | CO level exceeds `coThresholdPpm` in device config |
| `temperature` | Temperature exceeds `tempThresholdCelsius` in device config |
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

## MongoDB: `alerts` Collection

```ts
{
  _id:               ObjectId,
  deviceId:          ObjectId,   // ref: devices, indexed
  type:              'smoke' | 'co' | 'temperature' | 'device_offline' | 'battery_low' | 'tamper' | 'test',
  severity:          'critical' | 'high' | 'warning' | 'info',
  status:            'active' | 'acknowledged' | 'resolved' | 'false_alarm',  // default 'active', indexed
  triggeredAt:       Date,
  acknowledgedAt?:   Date,
  acknowledgedBy?:   ObjectId,   // ref: users
  resolvedAt?:       Date,
  resolvedBy?:       ObjectId,   // ref: users — can be absent if auto-resolved by device
  sensorValues:      Mixed,      // snapshot of readings at trigger time
  thresholdValues:   Mixed,      // snapshot of config thresholds at trigger time
  notes?:            string,     // filled during acknowledge
  notifications:     [AlertNotification],  // embedded array, see below
  createdAt:         Date,
  updatedAt:         Date,
}
```

Compound index on `(deviceId, triggeredAt DESC)`. Index on `status` for fast active-alert lookups.

### `sensorValues` example:
```json
{
  "smokeLevel": 0.87,
  "coPpm": 12.3,
  "temperatureCelsius": 42.1,
  "humidityPct": 55.0
}
```

### `thresholdValues` example:
```json
{
  "smokeThreshold": 0.5,
  "coThresholdPpm": 50.0,
  "tempThresholdCelsius": 60.0
}
```

---

## Embedded: `AlertNotification` (within `alerts.notifications[]`)

Tracks every notification sent for an alert. Previously a separate `alert_notifications` table — now an embedded subdocument array, since notifications are always read/written alongside their parent alert and never queried independently.

```ts
{
  channel:         'push' | 'sms' | 'websocket' | 'email',
  recipientId?:    ObjectId,   // ref: users — absent for broadcast
  sentAt:          Date,
  deliveryStatus:  'sent' | 'delivered' | 'failed',  // default 'sent'
  errorMessage?:   string,
}
```

---

## Notification Routing Logic

When an alert is created:

1. **Identify affected scope**: get `departmentId` from the device's room → floor → building → department chain
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
    "alertId": "665f1a2b9e1c4a0012abc111",
    "deviceId": "665f1a2b9e1c4a0012abc222",
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
