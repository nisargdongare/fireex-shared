# FireEx Project Status

Last updated: 2024-10-04

---

## System-wide Status: PRE-DEVELOPMENT

All sub-projects are in planning/design phase. No code has been written yet. This document records the current state and what needs to happen next.

---

## Sub-Project Status

### `fireex-backend` (Central Backend)
**Status:** Not started
**Repo:** Not created

**What's done:**
- Architecture designed (Fastify + Node.js + PostgreSQL + TimescaleDB + MongoDB)
- API contracts documented (`api-contracts/rest-api.md`, `websocket-events.md`, `mqtt-topics.md`)
- Data models designed (`data-models/`)
- Service structure planned (`projects/backend.md`)

**Next steps:**
1. Create repo `fireex-backend`
2. Initialize PlatformIO project with TypeScript + Fastify
3. Set up PostgreSQL + TimescaleDB (local Docker dev environment)
4. Set up MongoDB (local Docker)
5. Set up MQTT broker (Mosquitto local Docker)
6. Implement auth (OTP request + verify + JWT)
7. Implement device registration + MQTT bridge basics
8. Implement alert handling

**Blockers:**
- Cloud hosting decision pending (needed before production setup)
- SMS provider not chosen (needed for OTP in production; can mock in dev)
- MQTT broker production choice pending (use local Mosquitto for dev)

---

### `fireex-mobile` (React Native App)
**Status:** Not started
**Repo:** Not created

**What's done:**
- Screen designs and navigation structure documented (`projects/mobile-app.md`)
- API contracts available for integration planning

**Next steps:**
1. Create repo `fireex-mobile`
2. Initialize React Native project (bare workflow, TypeScript)
3. Set up navigation structure (React Navigation)
4. Set up Zustand stores
5. Implement auth screens (phone number + OTP)
6. Implement role-based home screen routing
7. Connect to backend auth API

**Blockers:**
- Depends on backend auth endpoints being live (can mock in early dev)

---

### `fireex-web` (Next.js Admin)
**Status:** Not started
**Repo:** Not created

**What's done:**
- Route structure and screen designs documented (`projects/web-admin.md`)
- API contracts available for integration planning

**Next steps:**
1. Create repo `fireex-web`
2. Initialize Next.js 14 project (App Router, TypeScript, Tailwind)
3. Install shadcn/ui
4. Set up middleware for auth + role routing
5. Implement login + OTP screens
6. Implement dashboard layout (sidebar + header shell)
7. Implement alerts list + detail

**Blockers:**
- Depends on backend auth endpoints being live (can mock in early dev)

---

### `fireex-firmware` (ESP32 Hardware Firmware)
**Status:** Not started
**Repo:** Not created

**What's done:**
- Hardware config and firmware architecture documented (`projects/hardware-firmware.md`)
- MQTT topic structure defined (`api-contracts/mqtt-topics.md`)
- Sensor/actuator pin assignments drafted (TBD final from hardware schematic)

**Next steps:**
1. Create repo `fireex-firmware`
2. Initialize PlatformIO project for ESP32
3. Set up WiFi connection manager
4. Set up MQTT client (PubSubClient or AsyncMqttClient — decide first)
5. Implement sensor reads (smoke, CO, temp/humidity)
6. Implement telemetry publish
7. Implement threshold-based alert publish
8. Implement buzzer/LED/relay actuator control

**Blockers:**
- Hardware schematic not finalized (pin assignments TBD)
- CO sensor model not decided
- Smoke sensor model not decided
- MQTT library choice not decided (PubSubClient vs AsyncMqttClient)

---

### `fireex-ui` (ESP32-S3 Display UI)
**Status:** Not started
**Repo:** Not created

**What's done:**
- Screen designs and LVGL architecture documented (`projects/hardware-ui.md`)
- UART protocol with firmware MCU defined

**Next steps:**
1. Create repo `fireex-ui`
2. Initialize PlatformIO project for ESP32-S3
3. Set up LVGL with RGB LCD driver
4. Set up capacitive touch driver
5. Implement main status screen with live sensor values
6. Implement UART receive from firmware MCU
7. Implement alarm/alert screen

**Blockers:**
- Display panel model not finalized (affects touch driver choice: FT5x06 or GT911)
- Hardware schematic not finalized (RGB pin assignments)
- Physical hardware units not yet available for testing

---

## Key Open Decisions (Blocking or Time-Sensitive)

| Decision | Impact | Owner | Due |
|----------|--------|-------|-----|
| MQTT broker selection | Backend + firmware setup | TBD | TBD |
| Cloud hosting | Backend deployment | TBD | TBD |
| SMS provider | OTP in production | TBD | TBD |
| CO sensor model | Firmware sensor config | Hardware team | TBD |
| Smoke sensor model | Firmware sensor config | Hardware team | TBD |
| Display panel model | UI touch driver | Hardware team | TBD |
| WiFi provisioning approach | Firmware onboarding UX | TBD | TBD |

---

## Development Priority Order

Recommended order to maximize parallel progress:

1. **Backend auth** — everything else depends on it
2. **Backend MQTT bridge** — firmware dev can proceed once this is ready
3. **Firmware telemetry + alerts** — can test against local MQTT + dev backend
4. **Mobile auth flow** — unblocks mobile feature development
5. **Web admin auth + dashboard** — unblocks admin portal development
6. **Display UI main screen** — can start in parallel once hardware is available
7. **All features in parallel** once foundations are in place

---

## Communication / Coordination Notes

- This repo (`fireex-shared`) is the single source of truth for all cross-project decisions
- All API changes must be reflected here before or alongside implementation
- Hardware-related decisions (sensor models, pin assignments) should be confirmed by the hardware team and recorded in `decisions/architecture-decisions.md`
