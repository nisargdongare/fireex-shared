# FireEx Project Status

Last updated: 2026-10-06

---

## System-wide Status: IN DEVELOPMENT

`fireex-ui` (Display UI) is in active development with hardware bring-up complete and full screen set implemented. `fireex-backend` has a working route layer against MongoDB. All other sub-projects remain in planning/design phase.

---

## Sub-Project Status

### `fireex-backend` (Central Backend)
**Status:** In progress
**Repo:** `~/Documents/Software_projects/fireex-backend`

**What's done:**
- Architecture: Fastify + Node.js + **MongoDB only** (via Mongoose) — see ADR-012. PostgreSQL/Prisma/TimescaleDB were dropped in favor of a single-database architecture.
- API contracts documented (`api-contracts/rest-api.md`, `websocket-events.md`, `mqtt-topics.md`)
- Data models designed and implemented as Mongoose schemas (`data-models/`, `src/db/mongo/models/`)
- Service structure planned (`projects/backend.md`)
- Auth routes implemented: OTP request/verify, refresh, logout (SMS dispatch still a TODO — logs OTP to console in dev)
- Route handlers implemented for: users, devices (readings/logs/command), alerts, tickets, buildings, floors, rooms
- RBAC decorator (`fastify.rbac`) and JWT auth plugin (`fastify.authenticate`) wired

**Next steps:**
1. `npm install` to pull in dependencies (now includes `dotenv`, `fastify-plugin`, no longer includes `prisma`/`@prisma/client`)
2. Set up MongoDB (local Docker or Atlas) and populate `.env` from `.env.example`
3. Set up MQTT broker (Mosquitto local Docker)
4. Implement MQTT message handlers (`mqtt/handlers/*` — currently only connect/subscribe exists, no telemetry/alert/status/register/ack processing yet)
5. Wire real SMS provider for OTP delivery
6. Implement WebSocket event broadcasting (plugin registered, no broadcast logic yet)
7. Extract route logic into `services/*.service.ts` as routes grow (currently business logic lives directly in route handlers)

**Blockers:**
- Cloud hosting decision pending (needed before production setup)
- SMS provider not chosen (needed for OTP in production; can mock in dev)
- MQTT broker production choice pending (use local Mosquitto for dev)

---

### `fireex-mobile` (React Native App, via Expo)
**Status:** Scaffolded — navigation + screens wired, needs backend running + visual polish
**Repo:** `~/Documents/Software_projects/fireex-mobile`

**What's done:**
- Expo SDK 57 project scaffolded (TypeScript, Expo Router, React Compiler on)
- Decided: Expo managed workflow (not bare RN), Expo Router (not React Navigation v6), expo-secure-store + AsyncStorage (not MMKV), expo-notifications (not RN Firebase) — see `architecture/tech-stack.md` for rationale
- Full route tree created for both roles, matching `projects/mobile-app.md` 1:1:
  - `(auth)`: login, OTP verify (6-digit auto-advance)
  - `(app)/(user)`: dashboard/rooms, room devices, device detail (live telemetry via WebSocket, optimistic controls), settings, profile, support chat triage
  - `(app)/(technician)`: ticket list, ticket detail (maintenance-code flow + new-device variant), in-progress checklist, add-device BLE+bottom-sheet flow, profile
  - `(app)/emergency/[alertId]`: full-screen red alert, outside tab chrome
- Auth store (JWT in expo-secure-store, auto-refresh via axios interceptor), app store (AsyncStorage-persisted), WebSocket client with reconnect/backoff and foreground/background lifecycle handling
- Design tokens (`src/constants/theme.ts`) mirror the design canvas colors/typography/status-badge system
- `npx tsc --noEmit`, `npx expo lint`, `npx expo-doctor` all clean; `npx expo start --web` boots and bundles with 0 errors
- `.mcp.json` added, pointing at `fireex-shared`'s MCP server
- `.nvmrc` pinned to Node v22.21.1 (SDK 57 requires ≥20.19.4; machine's nvm default of 20.18.0 doesn't qualify)

**Next steps:**
1. Get `fireex-backend` running locally and point the app's `API_BASE_URL` at it; most screens currently call real endpoints but have never hit a live backend
2. Visual polish pass: real stroke-SVG icons (room/device/wrench — currently colored placeholder squares), `pulseRedRing`/`pulseOrange` status animations, BLE pulse animation on Add Device
3. Rooms currently derived client-side by grouping `/api/devices` by `room.id` — no dedicated `/api/rooms` endpoint exists yet; revisit if the backend adds one
4. Wire `expo-notifications` registration + backend device-token endpoint (not yet implemented on either side)
5. Decide on and wire a BLE library for the real Add Device scan step (currently a static mock list)
6. Jest + React Native Testing Library setup (not started)

**Blockers:**
- Depends on backend running + reachable (currently points at `http://localhost:3000/api` in dev)
- Note: all `id` fields from the backend are MongoDB ObjectId strings, not UUIDs — mobile types already reflect this

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
- Note: all `id` fields from the backend are now MongoDB ObjectId strings, not UUIDs — don't assume UUID format client-side

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
- MQTT broker not set up yet (backend MQTT handlers also not yet implemented)

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
| Backend database | Persistence layer | — | **Resolved: MongoDB only, see ADR-012** |
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

1. **Backend auth** — done (OTP request/verify/refresh/logout implemented against MongoDB)
2. **Backend MQTT bridge** — connect/subscribe done; message handlers (telemetry/alert/status/register/ack) still needed before firmware dev can integrate end-to-end
3. **Firmware telemetry + alerts** — can test against local MQTT + dev backend once handlers above exist
4. **Mobile auth flow** — unblocks mobile feature development
5. **Web admin auth + dashboard** — unblocks admin portal development
6. **Display UI main screen** — can start in parallel once hardware is available
7. **All features in parallel** once foundations are in place

---

## Communication / Coordination Notes

- This repo (`fireex-shared`) is the single source of truth for all cross-project decisions
- All API changes must be reflected here before or alongside implementation
- Hardware-related decisions (sensor models, pin assignments) should be confirmed by the hardware team and recorded in `decisions/architecture-decisions.md`
- **2026-10-06: Backend persistence layer changed from PostgreSQL+TimescaleDB+MongoDB to MongoDB-only.** See ADR-012. All data-model docs, the REST API contract, system overview, and data-flow docs were updated to match. Any client project (mobile, web) that assumed UUID-format IDs from earlier doc versions should expect MongoDB ObjectId strings instead.
