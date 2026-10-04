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
| Primary DB | PostgreSQL | Users, devices, buildings, tickets, alerts |
| Time-series DB | TimescaleDB (PostgreSQL extension) | Sensor readings hypertable |
| Document DB | MongoDB | Flexible document storage (audit logs, config snapshots) |
| ORM/Query | Prisma (PostgreSQL) + Mongoose (MongoDB) | |
| Validation | Zod | Schema validation on all incoming payloads |
| Testing | Jest + Supertest | |
| Process manager | PM2 | Production |
| Containerization | Docker | TBD for deployment |

---

## Mobile App (`fireex-mobile`)

| Layer | Choice | Notes |
|-------|--------|-------|
| Framework | React Native (bare, not Expo) | TBD whether to use Expo managed workflow |
| Language | TypeScript | |
| Navigation | React Navigation v6 | Stack + Bottom Tab navigators |
| State management | Zustand | Lightweight, no boilerplate |
| API client | Axios | REST calls |
| Real-time | WebSocket (native `WebSocket` API or `socket.io-client`) | Alert push |
| Push notifications | React Native Firebase | FCM + APNs |
| Local storage | MMKV | Fast key-value, replaces AsyncStorage |
| Forms | React Hook Form + Zod | |
| Styling | StyleSheet + NativeWind (TailwindCSS for RN) | TBD |
| Testing | Jest + React Native Testing Library | |

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
| Database hosting | TBD | Managed Postgres with TimescaleDB extension |

---

## Language & Version Policy

- **Node.js**: LTS (currently v20.x)
- **TypeScript**: 5.x, strict mode on all projects
- **React Native**: Latest stable
- **Next.js**: 14.x or later (App Router only, no Pages Router)
- **LVGL**: 8.x (not 9.x yet — API stability)
- **PlatformIO**: Latest stable
