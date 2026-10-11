# FireEx Project Status

Last updated: 2026-10-12

---

## System-wide Status: IN DEVELOPMENT

`fireex-backend` has a working API layer with auth, devices, products, and a full ticket system. `fireex-ui` (Display UI) has full screen set implemented. All other sub-projects remain in planning/scaffolding phase.

---

## Sub-Project Status

### `fireex-backend` (Central Backend)
**Status:** In progress — core API complete
**Repo:** `~/Documents/Software_projects/fireex-backend`
**Port:** 4000

**What's done:**
- Framework: **Express** (not Fastify — early ADR was superseded)
- Database: MongoDB via Mongoose
- Auth: OTP flow (`/api/auth/otp/request`, `/otp/verify`, `/refresh`, `/logout`) + direct mobile login (`/api/users/login`) for dev
- JWT: role-aware payload — `user`/`serviceBody` get `organizations[]`, `serviceBoy` gets `orgId`
- Device API: list, by-floor, by-room, by-id — org-scoped access control
- Product API: list and detail
- **Ticket system** (new):
  - Types: `installation` (new device), `maintenance` (existing device)
  - Status: `open` → `in_progress` → `resolved` / `closed`
  - Role-enforced: `serviceBody` creates/manages, `serviceBoy` views/updates own tickets, `user` blocked (403)
  - Endpoints: `POST /api/tickets`, `GET /api/tickets/org/:orgId`, `PATCH /api/tickets/:ticketId`, `GET /api/tickets/assigned`, `PATCH /api/tickets/:ticketId/progress`, `GET /api/tickets/:ticketId`
- Roles: `user`, `serviceBody`, `serviceBoy` — all three working with correct JWT payloads
- Swagger UI at `/api/docs`
- Seed script (`scripts/seed.ts`) seeds products, orgs, users, devices, and 10 tickets

**Seed test users:**
| Mobile | Role | Notes |
|--------|------|-------|
| `8888888888` | `user` | John Doe |
| `9999999999` | `serviceBoy` | Priya Sharma — 10 tickets assigned |
| `7777777777` | `serviceBody` | Raj Kumar — dashboard user |
| `6666666666` | `user` | Arjun Verma |

**Next steps:**
1. MQTT bridge — connect/subscribe skeleton exists, message handlers (telemetry/alert/status/register/ack) not yet implemented
2. WebSocket broadcasting — plugin registered, no broadcast logic yet
3. Real SMS OTP delivery (currently logs to console in dev)
4. Cloud hosting decision

**Blockers:**
- SMS provider not chosen
- MQTT broker production choice pending

---

### `fireex-mobile` (React Native App, via Expo)
**Status:** Scaffolded — navigation + screens wired, needs backend running
**Repo:** `~/Documents/Software_projects/fireex-mobile`

**What's done:**
- Full route tree for `user` and `serviceBoy` (technician) roles
- Auth store (JWT in expo-secure-store), WebSocket client with reconnect/backoff
- Design tokens, all screens stubbed
- `npx tsc --noEmit`, lint, expo-doctor all clean

**Next steps:**
1. Point at running backend (`http://localhost:4000/api` in dev)
2. Wire ticket screens for `serviceBoy` role using new ticket endpoints
3. Visual polish: icons, animations
4. `expo-notifications` registration + backend device-token endpoint

**Blockers:**
- Depends on backend reachable locally

---

### `fireex-web` (Next.js Admin Dashboard)
**Status:** Not started

**Next steps:**
1. Create repo, init Next.js 14 (App Router, TypeScript, Tailwind, shadcn/ui)
2. Auth + role routing middleware
3. Login + OTP screens
4. Dashboard shell → ticket management for `serviceBody` role is the first priority feature

---

### `fireex-firmware` (ESP32 Hardware Firmware)
**Status:** In progress
**Repo:** `~/Documents/PlatformIO/Projects/fireex-firmware`

**What's done:**
- Dual-MCU structure (master sensors/actuators + slave display UI) on ESP32-S3-WROOM-1 N16R8
- UART link working: master sends state frames every 1s
- All 6 output GPIOs working
- PIN persistence in NVS, post-reboot boot flow

**Next steps:**
1. Wire real MQ2 ADC read (currently hardcoded)
2. Wire DHT22 temp/humidity
3. Implement MQTT client on master
4. Wire UART state frame → live g_model update on slave display

---

### `fireex-ui` (ESP32-S3 Display UI)
**Status:** In progress — all screens implemented
**Repo:** `fireex-firmware/src/slave`

**What's done:**
- Hardware bring-up complete (ST7265 LCD 800×480, GT911 touch, LVGL 8)
- All 25+ screens implemented
- PIN entry, session management, alarm pre-emption, sprinkler/factory-reset PIN-gating
- Maintenance code entry + UART flow designed

**Next steps:**
1. Wire UART receive → update `g_model` fields live
2. Wire UART send for silence/test/maintenance commands
3. End-to-end alarm pre-emption test with real firmware

---

## Key Open Decisions

| Decision | Status |
|----------|--------|
| Backend framework | **Resolved: Express** |
| Database | **Resolved: MongoDB only (ADR-012)** |
| CO sensor | **Resolved: no CO sensor; MQ2 only** |
| Display panel | **Resolved: ST7265 + GT911, 800×480** |
| MQTT broker (prod) | TBD |
| Cloud hosting | TBD |
| SMS provider | TBD |
| WiFi provisioning approach | TBD |

---

## Communication Notes

- `fireex-shared` is the single source of truth for all cross-project decisions
- All API changes must be reflected here before or alongside implementation
- All `id` fields from the backend are MongoDB ObjectId strings (24-char hex) — never UUIDs
- **2026-10-12: Ticket system implemented in backend.** Role model updated with `serviceBoy` (distinct from `serviceBody`). JWT payload is now role-dependent — see `data-models/users.md`.
