# Project: FireEx Backend (`fireex-backend`)

## Overview

The central Fastify + Node.js backend serves all FireEx clients: mobile app, web admin, and hardware devices (via MQTT bridge). It is the single source of truth for all business logic.

**Status:** Not started (as of 2024-10-04)
**Repo:** TBD
**Port (dev):** 3000

---

## Service Architecture

```
fireex-backend/
  src/
    app.ts                  ← Fastify app factory
    server.ts               ← Entry point, starts server
    config/
      env.ts                ← Zod-validated env config
      database.ts           ← DB connection setup
    plugins/
      auth.ts               ← JWT verification plugin
      websocket.ts          ← WebSocket plugin setup
      mqtt.ts               ← MQTT bridge plugin
    routes/
      auth/
        otp.ts              ← POST /auth/otp/request, /verify, /refresh, /logout
      users/
        index.ts            ← CRUD for users
      devices/
        index.ts            ← CRUD for devices
        readings.ts         ← GET /devices/:id/readings
        commands.ts         ← POST /devices/:id/command
      alerts/
        index.ts            ← CRUD for alerts
      tickets/
        index.ts            ← CRUD for tickets
        checklist.ts        ← PATCH checklist items
        attachments.ts      ← POST/GET attachments
      buildings/
        index.ts            ← CRUD for buildings
      floors/
        index.ts
      rooms/
        index.ts
    services/
      auth.service.ts       ← OTP generation, verification, JWT issuance
      alert.service.ts      ← Alert creation, notification dispatch
      notification.service.ts ← Push + SMS dispatch
      websocket.service.ts  ← WS event broadcasting
      mqtt.service.ts       ← MQTT publish helpers
      ticket.service.ts     ← Ticket creation, checklist management
    mqtt/
      handlers/
        telemetry.handler.ts
        alert.handler.ts
        status.handler.ts
        register.handler.ts
        ack.handler.ts
      publisher.ts          ← Publish commands and config to devices
    db/
      prisma/
        schema.prisma       ← PostgreSQL + TimescaleDB schema
        migrations/
      mongo/
        models/             ← Mongoose models
    middleware/
      role-guard.ts         ← Role-based access control decorator
      rate-limiter.ts
    utils/
      otp.ts                ← OTP generation/hashing
      pagination.ts
      errors.ts
    types/
      index.ts              ← Shared TypeScript types
```

---

## Environment Variables (Required)

```bash
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://user:pass@localhost:5432/fireex
MONGODB_URI=mongodb://localhost:27017/fireex
MQTT_BROKER_URL=mqtt://localhost:1883
MQTT_USERNAME=backend
MQTT_PASSWORD=secret
JWT_ACCESS_SECRET=<32+ chars>
JWT_REFRESH_SECRET=<32+ chars>
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=30d
SMS_PROVIDER=twilio          # or aws_sns
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_FROM_NUMBER=+1...
FCM_SERVER_KEY=...
APNS_KEY_ID=...
APNS_TEAM_ID=...
APNS_KEY_PATH=./certs/apns.p8
```

---

## Database Setup

### PostgreSQL + TimescaleDB
- Managed by Prisma (schema definition + migrations)
- TimescaleDB extension must be installed on the PostgreSQL instance
- The `sensor_readings` table is created as a TimescaleDB hypertable manually (not in Prisma schema, done in a migration SQL file)
- All UUID primary keys use `gen_random_uuid()`

### MongoDB
- Managed by Mongoose
- Collections: `device_config_snapshots`, `audit_logs`
- No strict schema enforcement at DB level — Mongoose schemas handle this

---

## Authentication Flow (Server Side)

1. `POST /api/auth/otp/request`:
   - Look up user by phone number
   - If not found → 404 `PHONE_NOT_REGISTERED`
   - Generate 6-digit OTP, bcrypt-hash it, store with 5-min expiry
   - Call SMS service to deliver OTP
   - Return `{ success: true, expiresInSeconds: 300 }`

2. `POST /api/auth/otp/verify`:
   - Find latest unused, non-expired OTP for that phone number
   - Compare submitted OTP against stored hash
   - On match: mark OTP as used, issue access token (15m) + refresh token (30d)
   - Embed `{ sub, phone, role, departmentId }` in JWT payload
   - Return tokens + user object

3. Authenticated requests:
   - Fastify auth plugin verifies JWT on every protected route
   - Decoded JWT payload attached to `request.user`
   - Route handlers use `request.user.role` for authorization

---

## MQTT Bridge (Server Side)

The MQTT bridge runs as a Fastify plugin that starts alongside the HTTP server:

1. **On startup**: connect to MQTT broker, subscribe to `fireex/+/telemetry`, `fireex/+/alert`, `fireex/+/status`, `fireex/+/register`, `fireex/+/ack`
2. **On `telemetry`**: write to TimescaleDB `sensor_readings`, update `devices.last_seen_at` and `devices.status = 'online'`
3. **On `alert`**: create alert record in PostgreSQL, call `alert.service.ts` to dispatch notifications
4. **On `status` (online=false)**: set `devices.status = 'offline'`, broadcast `device.status_changed` WebSocket event
5. **On `register`**: validate device, mark as online, publish config to `fireex/{deviceId}/config`
6. **On `ack`**: log command execution result in MongoDB audit log

---

## WebSocket Event Broadcasting

- Uses `@fastify/websocket`
- In-memory subscription map: `Map<scopeId, Set<WebSocket>>`
- When scope is `department`, all device/alert events for that department are routed to subscribers
- When scope is `global` (super_admin), all events are forwarded
- Dead connections are cleaned up on socket close/error events

---

## Role-Based Access Control

Implemented as a Fastify decorator `fastify.rbac(allowedRoles: string[])`:

```typescript
fastify.get('/api/devices', { preHandler: fastify.rbac(['dept_admin', 'super_admin']) }, handler)
```

Additionally, for `dept_admin`, all queries are automatically scoped to `WHERE department_id = request.user.departmentId` in Prisma queries.

---

## Key Decisions (See Also `decisions/architecture-decisions.md`)

- Fastify chosen over Express for performance and first-class TypeScript support
- Zod used for runtime payload validation (not just TypeScript types)
- TimescaleDB used for sensor_readings because continuous aggregates and time-bucket queries are core requirements
- MongoDB used for audit logs and config snapshots because they are document-shaped and schema-flexible
- OTPs stored hashed (bcrypt) — raw OTP is never stored, even temporarily
