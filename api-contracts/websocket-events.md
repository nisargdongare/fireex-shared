# FireEx WebSocket Events

The backend pushes real-time events to connected clients (mobile app and web admin) over WebSocket.

WebSocket endpoint: `wss://api.fireex.example.com/ws`
Auth: pass `Authorization: Bearer <accessToken>` as a query param on connection: `?token=<accessToken>`

---

## Connection Lifecycle

### Client → Server: Subscribe
After connecting, the client sends a subscription message to define which scope it wants events for:

```json
{
  "type": "subscribe",
  "scope": "department",
  "id": "dept-uuid"
}
```

Valid scopes:
| Scope | `id` value | Who uses it |
|-------|-----------|-------------|
| `department` | department UUID | dept_admin, technicians, end users |
| `building` | building UUID | when viewing a specific building |
| `device` | device UUID | when viewing a specific device's detail |
| `global` | — | super_admin only (receives all events) |

A client can hold multiple subscriptions simultaneously.

### Client → Server: Unsubscribe
```json
{
  "type": "unsubscribe",
  "scope": "building",
  "id": "building-uuid"
}
```

### Client → Server: Ping (keepalive)
```json
{ "type": "ping" }
```

### Server → Client: Pong
```json
{ "type": "pong", "timestamp": "2024-01-15T14:32:00Z" }
```

---

## Server → Client Events

All events share this envelope:
```json
{
  "type": "<event.type>",
  "scope": "department",
  "scopeId": "dept-uuid",
  "timestamp": "2024-01-15T14:32:00Z",
  "payload": { ... }
}
```

---

### `alert.new`
Fired immediately when a new alert is created.

```json
{
  "type": "alert.new",
  "scope": "department",
  "scopeId": "dept-uuid",
  "timestamp": "2024-01-15T14:32:00Z",
  "payload": {
    "alertId": "uuid",
    "alertType": "smoke",
    "severity": "critical",
    "deviceId": "uuid",
    "deviceCode": "FX-0042",
    "roomId": "uuid",
    "roomName": "Server Room 3B",
    "floorNumber": 3,
    "buildingName": "Block A",
    "triggeredAt": "2024-01-15T14:32:00Z",
    "sensorValues": {
      "smokeLevel": 0.87,
      "temperatureCelsius": 42.1
    }
  }
}
```

---

### `alert.updated`
Fired when an alert is acknowledged, resolved, or marked false alarm.

```json
{
  "type": "alert.updated",
  "payload": {
    "alertId": "uuid",
    "previousStatus": "active",
    "newStatus": "acknowledged",
    "updatedBy": {
      "id": "uuid",
      "fullName": "Ravi Kumar"
    },
    "notes": "Investigating now"
  }
}
```

---

### `device.status_changed`
Fired when a device transitions between status states.

```json
{
  "type": "device.status_changed",
  "payload": {
    "deviceId": "uuid",
    "deviceCode": "FX-0042",
    "previousStatus": "online",
    "newStatus": "offline",
    "roomName": "Server Room 3B",
    "buildingName": "Block A"
  }
}
```

---

### `device.telemetry`
Fired when a device sends a new sensor reading (throttled — at most once per 30s per device to avoid flooding). Only relevant for `device`-scoped subscriptions.

```json
{
  "type": "device.telemetry",
  "scope": "device",
  "scopeId": "device-uuid",
  "payload": {
    "deviceId": "uuid",
    "time": "2024-01-15T14:32:00Z",
    "smokeLevel": 0.12,
    "coPpm": 8.4,
    "temperatureCelsius": 23.5,
    "humidityPct": 52.0,
    "wifiRssi": -65
  }
}
```

---

### `ticket.created`
Fired when a new maintenance ticket is created for the department.

```json
{
  "type": "ticket.created",
  "payload": {
    "ticketId": "uuid",
    "ticketNumber": "TKT-2024-0042",
    "type": "alert_response",
    "priority": "critical",
    "title": "Smoke alert — Server Room 3B",
    "deviceCode": "FX-0042",
    "assignedTo": {
      "id": "uuid",
      "fullName": "Ravi Kumar"
    }
  }
}
```

---

### `ticket.updated`
Fired when a ticket's status or checklist changes.

```json
{
  "type": "ticket.updated",
  "payload": {
    "ticketId": "uuid",
    "ticketNumber": "TKT-2024-0042",
    "previousStatus": "assigned",
    "newStatus": "in_progress",
    "updatedBy": {
      "id": "uuid",
      "fullName": "Ravi Kumar"
    }
  }
}
```

---

### `ticket.resolved`
Fired when a ticket is marked resolved — separate from `ticket.updated` because it's a high-visibility event.

```json
{
  "type": "ticket.resolved",
  "payload": {
    "ticketId": "uuid",
    "ticketNumber": "TKT-2024-0042",
    "resolvedBy": {
      "id": "uuid",
      "fullName": "Ravi Kumar"
    },
    "resolutionNotes": "Sensor cleaned and reset. Back to normal."
  }
}
```

---

### `system.announcement`
Broadcast to all connected clients. Used for maintenance windows, system notices.

```json
{
  "type": "system.announcement",
  "payload": {
    "title": "Scheduled Maintenance",
    "message": "System will be unavailable from 02:00–03:00 IST on 20 Jan.",
    "severity": "info"
  }
}
```

---

## Error Events (Server → Client)

```json
{
  "type": "error",
  "code": "UNAUTHORIZED",
  "message": "Token expired. Please reconnect with a fresh token."
}
```

Common error codes: `UNAUTHORIZED`, `FORBIDDEN`, `INVALID_SCOPE`, `INTERNAL_ERROR`

---

## Client Implementation Notes

- Reconnect on disconnect with exponential backoff (1s, 2s, 4s, 8s, max 30s)
- Re-subscribe to all previous scopes after reconnect
- On mobile: close WebSocket when app goes to background; reconnect on foreground
- The backend drops subscriptions when a client disconnects — client must re-subscribe
- Push notifications serve as the offline fallback for `critical` and `high` severity alerts
