# FireEx Tech Stack

All stack choices below are confirmed unless marked **TBD**.

---

## Backend (`fireex-backend`)

| Layer | Choice | Notes |
|-------|--------|-------|
| Runtime | Node.js (LTS) | |
| Framework | Fastify | Chosen for performance and plugin architecture over Express |
| REST API | Fastify routes | JSON over HTTPS |
| WebSocket | Fastify WebSocket plugin (`@fastify/websocket`) | Real-time push to clients |
| MQTT bridge | `mqtt` npm package | Subscribes to hardware topics, publishes commands |
| Auth | JWT (access + refresh tokens) | Issued after OTP verification |
| OTP delivery | SMS via provider TBD (Twilio / AWS SNS) | |
| Push notifications | FCM (Android) + APNs (iOS) via `firebase-admin` | |
| Database | **MongoDB (single database for everything)** | See ADR-012. All data — users, devices, buildings, tickets, alerts, sensor readings, audit logs, config snapshots — lives in MongoDB. No PostgreSQL, no TimescaleDB. |
| ORM/Query | Mongoose | All collections are Mongoose schemas/models under `src/db/mongo/models/` |
| Time-series storage | Plain MongoDB collection (`sensor_readings`) | Compound index on `(deviceId, time DESC)`. Time-bucket aggregation done via the Mongo aggregation pipeline. Can upgrade to MongoDB's native `timeseries` collection type later if volume demands it. |
| Validation | Zod | Schema validation on all incoming payloads |
| Testing | Jest + Supertest | |
| Process manager | PM2 | Production |
| Containerization | Docker | TBD for deployment |

---

## Mobile App (`fireex-mobile`)

| Layer | Choice | Notes |
|-------|--------|-------|
| Framework | React Native via Expo (managed workflow, SDK 57) | **Decided 2026-10-07** — switched from bare RN for simpler builds, OTA updates (EAS), and Expo Go iteration during early dev |
| Language | TypeScript | |
| Navigation | Expo Router (file-based) | **Switched from React Navigation v6** — idiomatic for Expo, built on React Navigation internally. Route groups: `(auth)`, `(app)/(user)`, `(app)/(technician)` |
| State management | Zustand | Lightweight, no boilerplate |
| API client | Axios | REST calls, with interceptor-based access-token refresh |
| Real-time | WebSocket (native `WebSocket` API) | Alert push; reconnect with backoff per `api-contracts/websocket-events.md` |
| Push notifications | `expo-notifications` | **Switched from React Native Firebase** — Expo-maintained, handles FCM (Android) + APNs (iOS). Remote push needs a dev build (unavailable in Expo Go on Android since SDK 53); local notifications work in Expo Go |
| Local storage | `expo-secure-store` (tokens) + `@react-native-async-storage/async-storage` (general persisted state, via Zustand `persist`) | **Switched from MMKV** — MMKV is third-party, not in Expo's docs, and needs a dev build; Expo's own storage guide recommends this pairing instead |
| Forms | React Hook Form + Zod | |
| Styling | StyleSheet (fixed light design system — no dark mode in the current design) | Design tokens in `src/constants/theme.ts` mirror the Figma/canvas spec in `projects/mobile-app.md` |
| Testing | Jest + React Native Testing Library | Not yet set up |

> Expo SDK APIs change every release — any session working on `fireex-mobile` should check `docs.expo.dev/versions/v<major>.0.0/` before assuming an API from training data, per the project's `AGENTS.md`.

> Note: all IDs returned by the backend (`id` fields in API responses) are now MongoDB ObjectId strings (24-char hex), not UUIDs. No client-side format assumptions (e.g. UUID regex validation) should be made on these fields.

---

## Web Admin (`fireex-web`)

| Layer | Choice | Notes |
|-------|--------|-------|
| Framework | Next.js 14+ (App Router) | |
| Language | TypeScript | |
| Styling | Tailwind CSS | |
| Component library | shadcn/ui | Built on Radix UI primitives |
| State management | Zustand (client), React Query (server state) | |
| API client | Axios or fetch + React Query | |
| Real-time | WebSocket (native browser API) | Alert push |
| Auth | JWT stored in httpOnly cookie | Handled by Next.js middleware |
| Forms | React Hook Form + Zod | |
| Charts/dashboards | Recharts or Chart.js | TBD |
| Testing | Jest + React Testing Library + Playwright (E2E) | |

> Note: same ObjectId-string caveat as mobile — see above.

---

## Hardware Firmware (`fireex-firmware`)

| Layer | Choice | Notes |
|-------|--------|-------|
| MCU | ESP32 (Xtensa LX6 dual-core) | |
| Framework | Arduino + PlatformIO | C/C++ |
| WiFi/MQTT | `PubSubClient` or `AsyncMqttClient` | MQTT over WiFi |
| OTA updates | Arduino OTA or ESP-IDF OTA | TBD |
| NVS/flash storage | `Preferences` library | Device ID, config, calibration |
| Sensors | DHT22/SHT31 (temp/humidity), MQ-7 (CO), photoelectric smoke | |
| Actuators | GPIO-driven buzzer, LED, relay | |
| Watchdog | Hardware WDT + software WDT | |
| Communication with UI MCU | UART (Serial2) | TBD |

---

## Hardware Display UI (`fireex-ui`)

| Layer | Choice | Notes |
|-------|--------|-------|
| MCU | ESP32-S3 | Has hardware RGB LCD interface |
| Framework | Arduino + PlatformIO | C (with some C++) |
| Display library | LVGL v8.x | |
| Display driver | Custom driver via 40-pin RGB parallel interface | 800×480 5" capacitive touch |
| Touch driver | FT5x06 or GT911 over I2C | TBD based on panel |
| Communication with firmware MCU | UART (Serial1) | TBD |
| PIN protection | 6-digit PIN, stored in NVS | Technician configuration mode |
| Font rendering | LVGL built-in font engine | |

---

## Infrastructure & DevOps

| Concern | Choice | Notes |
|---------|--------|-------|
| MQTT broker | TBD | Mosquitto (self-hosted) or HiveMQ Cloud or EMQX |
| Cloud/hosting | TBD | AWS / GCP / DigitalOcean |
| CI/CD | TBD | GitHub Actions |
| Secrets management | TBD | AWS Secrets Manager or .env vault |
| Monitoring | TBD | |
| Database hosting | TBD | Managed MongoDB (e.g. MongoDB Atlas) — no longer need a managed Postgres/TimescaleDB instance, see ADR-012 |

---

## Language & Version Policy

- **Node.js**: LTS (currently v20.x)
- **TypeScript**: 5.x, strict mode on all projects
- **React Native**: Latest stable
- **Next.js**: 14.x or later (App Router only, no Pages Router)
- **LVGL**: 8.x (not 9.x yet — API stability)
- **PlatformIO**: Latest stable
