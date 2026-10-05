# FireEx Project Status

Last updated: 2026-10-05

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
**Status:** In progress
**Repo:** `~/Documents/PlatformIO/Projects/fireex-firmware` (PlatformIO, ESP32-S3)

**What's done:**
- ✅ Dual-MCU structure: master (sensors/actuators) + slave (display UI) on ESP32-S3-WROOM-1 N16R8
- ✅ UART link working: master sends state frames every 1s; slave sends output commands
- ✅ All 6 output GPIOs defined and working: solenoid (18), buzzer (7), smoke sensor (6), tube light (17), door lock (15), power fan (16)
- ✅ Output toggle → immediate UART command → master drives GPIO (no Save required)
- ✅ PIN persistence in NVS (`Preferences`, namespace `"session"`) — survives reboots
- ✅ Post-reboot boot flow: splash → PIN entry screen when PIN already set
- ✅ Display Outputs screen: 7 toggles (tube light, door lock, power fan, smoke sensor, buzzer, exhaust fan, solenoid valve)
- ✅ Menu lock button: returns to Home and re-requires PIN to re-enter

**Next steps:**
1. Wire real MQ2 ADC read on master (smoke value currently hardcoded 0.0)
2. Wire DHT22 temp/humidity read on master
3. Implement MQTT client on master (WiFi + telemetry publish)
4. Wire UART state frame → live update of all g_model fields on slave display
5. Test alarm pre-emption end-to-end with real firmware

**Blockers:**
- MQTT broker not set up yet (backend not started)

---

### `fireex-ui` (ESP32-S3 Display UI)
**Status:** In progress
**Repo:** `fireex-firmware/src/slave` (merged into firmware repo, `~/Documents/PlatformIO/Projects/fireex-firmware`)

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
