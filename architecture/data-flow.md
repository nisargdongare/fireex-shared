# FireEx Data Flow

This document describes how data moves through the FireEx system — from hardware sensors to databases to client applications.

> **Database note (ADR-012):** all persistence below is MongoDB (via Mongoose), not PostgreSQL/TimescaleDB. Flows are otherwise unchanged.

---

## 1. Sensor Reading Flow (Normal Operation)

```
ESP32 Firmware
    │
    │  Reads sensors every N seconds (configurable, default: 30s)
    │  Packages reading into MQTT payload
    ▼
MQTT Broker
    │
    │  Topic: fireex/devices/{deviceId}/telemetry
    ▼
Backend MQTT Bridge (Fastify service)
    │
    │  Validates payload
    │  Writes to MongoDB `sensor_readings` collection
    │  Updates device's `lastSeenAt` and `status` fields on the `devices` collection
    ▼
MongoDB
```

Mobile/Web clients query historical sensor data via REST:
```
Client → GET /api/devices/{deviceId}/readings?from=...&to=... → Backend → MongoDB (sensor_readings) → Client
```

---

## 2. Alert Flow (Smoke/Fire Detected)

```
ESP32 Firmware
    │
    │  Sensor threshold exceeded (smoke/CO/temp)
    │  Local alarm triggers immediately (buzzer, LED)
    │  Publishes alert MQTT message
    ▼
MQTT Broker
    │
    │  Topic: fireex/devices/{deviceId}/alert
    ▼
Backend MQTT Bridge
    │
    │  Creates an Alert document in MongoDB
    │  Broadcasts to all WebSocket subscribers for that building/dept
    │  Sends push notifications via FCM/APNs to relevant users
    │  Sends SMS to department admin and relevant technicians
    ▼
┌──────────────────────────────────────────────────────┐
│  Multiple parallel outputs:                          │
│                                                      │
│  MongoDB (alert document persisted)                  │
│  WebSocket → Mobile App (real-time alert banner)     │
│  WebSocket → Web Admin (real-time dashboard alert)   │
│  FCM/APNs → Mobile push notification (background)   │
│  SMS → Department admin + on-call technicians        │
└──────────────────────────────────────────────────────┘
```

Alert acknowledgment flow:
```
Technician (mobile app)
    │
    │  POST /api/alerts/{alertId}/acknowledge
    ▼
Backend
    │
    │  Updates alert status to "acknowledged" in MongoDB
    │  Publishes command to MQTT: fireex/devices/{deviceId}/command
    │  Broadcasts status update via WebSocket
    ▼
MQTT Broker → ESP32 Firmware (can silence local buzzer if configured)
```

---

## 3. Device Command Flow (Backend → Hardware)

```
Backend (API call or scheduled task)
    │
    │  Publishes to: fireex/devices/{deviceId}/command
    │  Payload: { "command": "test_alarm" | "silence" | "reboot" | "ota_update", ... }
    ▼
MQTT Broker
    ▼
ESP32 Firmware
    │
    │  Executes command
    │  Publishes acknowledgment to: fireex/devices/{deviceId}/ack
    ▼
MQTT Broker → Backend (logs command execution to MongoDB audit_logs)
```

---

## 4. Device Registration Flow (New Hardware Unit)

```
Super Admin (web admin)
    │
    │  POST /api/devices  (creates device record, generates deviceId + secret)
    ▼
Backend → MongoDB (device document created, status: "unprovisioned")
    │
    │  Super admin programs deviceId + MQTT credentials into ESP32 via
    │  USB serial during manufacturing / installation setup
    ▼
ESP32 Firmware
    │
    │  On first boot: connects to WiFi, connects to MQTT broker
    │  Publishes: fireex/devices/{deviceId}/register
    ▼
Backend
    │
    │  Validates deviceId, marks device as "online" in MongoDB
    │  Returns device config (sensor thresholds, reporting interval)
    ▼
ESP32 stores config in NVS flash
```

---

## 5. Authentication Flow (OTP)

```
User (mobile or web)
    │
    │  POST /api/auth/otp/request  { phoneNumber }
    ▼
Backend
    │
    │  Looks up phone number in MongoDB `users` collection
    │  If not found → reject (no self-signup)
    │  If found → generate 6-digit OTP, store with expiry (5 min) in `otp_codes`
    │  Send OTP via SMS provider
    ▼
SMS Provider → User's phone

User enters OTP
    │
    │  POST /api/auth/otp/verify  { phoneNumber, otp }
    ▼
Backend
    │
    │  Validates OTP
    │  Determines user role from user document
    │  Issues JWT access token (15 min) + refresh token (30 days)
    ▼
Client stores tokens (httpOnly cookie for web, MMKV for mobile)
```

---

## 6. Maintenance Ticket Flow

```
Trigger: alert acknowledged / scheduled maintenance / manual creation
    │
    │  POST /api/tickets  (created by system or admin)
    ▼
Backend → MongoDB (ticket document created, status: "open")
    │
    │  Assigns to technician (auto by building assignment or manual)
    │  Push notification to assigned technician
    ▼
Technician (mobile app)
    │
    │  Views ticket, navigates to device location
    │  Performs inspection, fills checklist on mobile app
    │  PATCH /api/tickets/{ticketId}  (status updates, checklist items)
    ▼
Backend → MongoDB (ticket document updated — checklist/comments/attachments are embedded arrays, updated in place)
    │
    │  If resolved → notifies department admin via WebSocket + push
    │  If parts needed → ticket status: "pending_parts"
    ▼
Department admin reviews on web admin dashboard
```

---

## 7. Real-time WebSocket Event Flow

```
Client (mobile or web)
    │
    │  Establishes WebSocket connection after auth
    │  Sends: { "type": "subscribe", "scope": "building" | "department" | "device", "id": "..." }
    ▼
Backend WebSocket handler
    │
    │  Registers subscription in memory (Map<scopeId, Set<ws>>)
    ▼
When relevant event occurs (alert, device status change, ticket update):
    │
    │  Backend finds all WebSocket connections subscribed to that scope
    │  Sends event payload to each connection
    ▼
Client receives event, updates UI state immediately
```

---

## Data Residency Summary

| Data type | Store | Retention |
|-----------|-------|-----------|
| User accounts, roles | MongoDB (`users`) | Permanent |
| Buildings, floors, rooms | MongoDB (`buildings`, `floors`, `rooms`) | Permanent |
| Device registry, config | MongoDB (`devices`, incl. embedded `config`) | Permanent |
| Sensor readings (time-series) | MongoDB (`sensor_readings`) | 1 year (configurable, via TTL index or scheduled cleanup) |
| Active alerts | MongoDB (`alerts`) | Permanent |
| Alert history | MongoDB (`alerts`) | Permanent |
| Maintenance tickets | MongoDB (`tickets`, incl. embedded checklist/comments/attachments) | Permanent |
| Device event logs | MongoDB (`device_logs`) | Permanent (configurable) |
| Audit logs | MongoDB (`audit_logs`) | 90 days (configurable) |
| Device config snapshots | MongoDB (`device_config_snapshots`) | Last 10 versions |
| OTP codes | MongoDB (`otp_codes`) | 5 minutes TTL |
| JWT refresh tokens | MongoDB (`refresh_tokens`) | 30 days |
