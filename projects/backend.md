# Project: FireEx Backend (`fireex-backend`)

## Overview

The central Fastify + Node.js backend serves all FireEx clients: mobile app, web admin, and hardware devices (via MQTT bridge). It is the single source of truth for all business logic.

**Status:** In progress (as of 2026-10-06)
**Repo:** `~/Documents/Software_projects/fireex-backend`
**Port (dev):** 3000

> **Database note (ADR-012):** the persistence layer is **MongoDB only**, accessed via Mongoose. PostgreSQL, Prisma, and TimescaleDB have been removed from the stack — see `decisions/architecture-decisions.md` for the full rationale and trade-offs.

---

## Service Architecture

```
fireex-backend/
  src/
    app.ts                  ← Fastify app factory
    server.ts               ← Entry point, starts server
    config/
      env.ts                ← Zod-validated env config
      database.ts           ← Mongo connection setup (connectMongo/disconnectAll)
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
        index.ts            ← GET readings, GET logs, POST command (device CRUD TBD)
      alerts/
        index.ts            ← List/get/acknowledge/resolve/false-alarm for alerts
      tickets/
        index.ts            ← CRUD for tickets, checklist updates, comments, attachments
      buildings/
        index.ts            ← CRUD for buildings + floors
      floors/
        index.ts            ← Rooms under a floor
      rooms/
        index.ts            ← Get/update/delete a room
    services/
      auth.service.ts       ← OTP generation, verification, JWT issuance (TBD extraction from routes)
      alert.service.ts      ← Alert creation, notification dispatch (TBD)
      notification.service.ts ← Push + SMS dispatch (TBD)
      websocket.service.ts  ← WS event broadcasting (TBD)
      mqtt.service.ts       ← MQTT publish helpers (TBD)
      ticket.service.ts     ← Ticket creation, checklist management (TBD)
    mqtt/
      handlers/
        telemetry.handler.ts  ← TBD — not yet implemented
        alert.handler.ts      ← TBD — not yet implemented
        status.handler.ts     ← TBD — not yet implemented
        register.handler.ts   ← TBD — not yet implemented
        ack.handler.ts        ← TBD — not yet implemented
      publisher.ts          ← Publish commands and config to devices (TBD)
    db/
      mongo/
        models/             ← All Mongoose models — the entire data layer
          Department.ts
          User.ts
          OtpCode.ts
          RefreshToken.ts
          Building.ts
          Floor.ts
          Room.ts
          Device.ts         ← includes embedded `config` subdocument (was device_configs table)
          Alert.ts          ← includes embedded `notifications` array (was alert_notifications table)
          Ticket.ts         ← includes embedded `checklist`, `comments`, `attachments` arrays
          DeviceLog.ts
          SensorReading.ts  ← was a TimescaleDB hypertable, now a plain Mongo collection
          AuditLog.ts
          DeviceConfigSnapshot.ts
          index.ts          ← barrel export
    middleware/
      role-guard.ts         ← Role-based access control decorator (`fastify.rbac`)
      rate-limiter.ts       ← TBD (rate limiting currently only via @fastify/rate-limit globally)
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

`DATABASE_URL` (PostgreSQL) no longer exists — removed along with Prisma/TimescaleDB per ADR-012.

---

## Database Setup

### MongoDB (the only database)
- Managed entirely by Mongoose — no Prisma, no PostgreSQL, no TimescaleDB
- All collections live in one MongoDB instance/database, pointed to by `MONGODB_URI`
- Collections: `departments`, `users`, `otp_codes`, `refresh_tokens`, `buildings`, `floors`, `rooms`, `devices`, `alerts`, `tickets`, `device_logs`, `sensor_readings`, `audit_logs`, `device_config_snapshots`
- No strict schema enforcement at the DB engine level — Mongoose schemas (with `enum`, `required`, etc.) are the only validation layer; there are no database-level `CHECK` or `FOREIGN KEY` constraints
- All primary keys are MongoDB's default `ObjectId` — no manual UUID generation

---

## Authentication Flow (Server Side)

1. `POST /api/auth/otp/request`:
   - Look up user by phone number (`User.findOne({ phoneNumber })`)
   - If not found → 404 `PHONE_NOT_REGISTERED`
   - Generate 6-digit OTP, bcrypt-hash it, store in `otp_codes` with 5-min expiry
   - Call SMS service to deliver OTP (currently logged to console in dev — TODO: wire real SMS)
   - Return `{ success: true, expiresInSeconds: 300 }`

2. `POST /api/auth/otp/verify`:
   - Find latest unused, non-expired OTP for that phone number
   - Compare submitted OTP against stored hash
   - On match: mark OTP as used, issue access token (15m) + refresh token (30d)
   - Embed `{ sub, phone, role, departmentId }` in JWT payload — `sub` and `departmentId` are MongoDB ObjectId strings
   - Return tokens + user object

3. Authenticated requests:
   - Fastify auth plugin verifies JWT on every protected route
   - Decoded JWT payload attached to `request.user`
   - Route handlers use `request.user.role` for authorization

---

## MQTT Bridge (Server Side)

The MQTT bridge runs as a Fastify plugin that starts alongside the HTTP server. **Currently only connects and subscribes — message handlers are not yet implemented** (see `mqtt/handlers/` TBD above).

Planned behavior once handlers are implemented:

1. **On startup**: connect to MQTT broker, subscribe to `fireex/+/telemetry`, `fireex/+/alert`, `fireex/+/status`, `fireex/+/register`, `fireex/+/ack`
2. **On `telemetry`**: write to `sensor_readings` collection, update `devices.lastSeenAt` and `devices.status = 'online'`
3. **On `alert`**: create an `Alert` document, call `alert.service.ts` to dispatch notifications
4. **On `status` (online=false)**: set `devices.status = 'offline'`, broadcast `device.status_changed` WebSocket event
5. **On `register`**: validate device, mark as online, publish config to `fireex/{deviceId}/config`
6. **On `ack`**: log command execution result to the `audit_logs` collection

---

## WebSocket Event Broadcasting

- Uses `@fastify/websocket`
- In-memory subscription map: `Map<scopeId, Set<WebSocket>>`
- When scope is `department`, all device/alert events for that department are routed to subscribers
- When scope is `global` (super_admin), all events are forwarded
- Dead connections are cleaned up on socket close/error events
- **Not yet implemented** — plugin registers `@fastify/websocket` but no event broadcasting logic exists yet

---

## Role-Based Access Control

Implemented as a Fastify decorator `fastify.rbac(allowedRoles: string[])`:

```typescript
fastify.get('/api/devices', { preHandler: [fastify.authenticate, fastify.rbac(['dept_admin', 'super_admin'])] }, handler)
```

Additionally, for `dept_admin`, queries are scoped in application code to `{ departmentId: request.user.departmentId }` Mongoose filters (there is no database-level row-security equivalent, since MongoDB has no RLS feature — this must be applied consistently in every handler).

---

## Key Decisions (See Also `decisions/architecture-decisions.md`)

- Fastify chosen over Express for performance and first-class TypeScript support
- Zod used for runtime payload validation (not just TypeScript types)
- **MongoDB-only persistence (ADR-012)** — PostgreSQL, Prisma, and TimescaleDB were dropped in favor of a single-database architecture. `sensor_readings` and `device_logs` are plain MongoDB collections with compound indexes rather than a TimescaleDB hypertable / SQL table.
- OTPs stored hashed (bcrypt) — raw OTP is never stored, even temporarily
