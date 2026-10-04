# FireEx Project Status

Last updated: 2026-10-04

---

## System-wide Status: IN DEVELOPMENT

`fireex-ui` (Display UI) is in active development with hardware bring-up complete and full screen set implemented. All other sub-projects remain in planning/design phase.

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
**Status:** In progress
**Repo:** `5inchTFT` (PlatformIO, `~/Documents/PlatformIO/Projects/5inchTFT`)

**What's done:**
- ✅ Hardware bring-up complete: RGB LCD (ST7265, 800×480), GT911 touch, LVGL 8 stack
- ✅ Pin assignments confirmed and documented (`projects/hardware-ui.md`)
- ✅ DISP hardware mod documented (bodge-wire to GPIO6, active-LOW backlight)
- ✅ All 25+ screens implemented (`src/ui/screens/`)
- ✅ Screen manager (create-on-enter/destroy-on-leave), session management, theming
- ✅ Full model (`FireExModel g_model`) with all sensor, alarm, actuator, settings fields
- ✅ Widgets: status bar, keypad, on/off toggle, toast, value stepper
- ✅ PIN entry with lockout and first-run flow; NVS PIN storage
- ✅ Alarm pre-emption (Alert/Panic forces `scr_alarm` over any open screen)
- ✅ Sprinkler/factory-reset PIN-gating via `navigate_to_pin(callback)`
- ✅ Maintenance code entry + UART request/response flow designed

**Next steps:**
1. Wire UART receive from firmware MCU → update `g_model` fields live
2. Wire UART send for: `silence_request`, `test_alarm_request`, `maintenance_code`
3. Implement `g_model.link_ok()` using 3s frame timeout
4. Test alarm pre-emption end-to-end with real firmware
5. Test PIN lockout, session auto-exit, factory reset flow on device

**Blockers:**
- Firmware MCU (`fireex-firmware`) not started — UART integration depends on it
- UART protocol has a minor mismatch: shared docs include `co` field in state frame, but hardware has no CO sensor (MQ2 only). Shared docs updated to remove it.

---

## Key Open Decisions (Blocking or Time-Sensitive)

| Decision | Impact | Owner | Due |
|----------|--------|-------|-----|
| MQTT broker selection | Backend + firmware setup | TBD | TBD |
| Cloud hosting | Backend deployment | TBD | TBD |
| SMS provider | OTP in production | TBD | TBD |
| CO sensor model | Firmware sensor config | Hardware team | **Resolved: no separate CO sensor; MQ2 covers smoke + combustibles** |
| Smoke sensor model | Firmware sensor config | Hardware team | **Resolved: MQ2** |
| Display panel model | UI touch driver | Hardware team | **Resolved: ST7265 + GT911, 800×480 RGB, 40-pin header** |
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
