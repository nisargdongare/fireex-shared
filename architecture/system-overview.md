# FireEx System Overview

## Purpose

FireEx is a fire and smoke safety monitoring platform. It enables real-time detection of fire/smoke events, automated alerting, maintenance ticketing, and compliance tracking across buildings and departments.

---

## System Components

```
┌─────────────────────────────────────────────────────────────────────┐
│                        FIREEX PLATFORM                              │
│                                                                     │
│  ┌─────────────┐    ┌─────────────┐    ┌──────────────────────┐   │
│  │ Hardware    │    │  Hardware   │    │   Central Backend    │   │
│  │ Firmware    │◄──►│  Display UI │    │   (Fastify + Node)   │   │
│  │ (ESP32)     │    │ (ESP32-S3)  │    │                      │   │
│  └──────┬──────┘    └─────────────┘    │  ┌────────────────┐  │   │
│         │                              │  │  REST API      │  │   │
│         │ MQTT                         │  │  WebSocket     │  │   │
│         ▼                              │  │  MQTT Bridge   │  │   │
│  ┌─────────────┐                       │  └────────────────┘  │   │
│  │ MQTT Broker │◄─────────────────────►│                      │   │
│  │   (TBD)     │                       │  ┌────────────────┐  │   │
│  └─────────────┘                       │  │  PostgreSQL +  │  │   │
│                                        │  │  TimescaleDB   │  │   │
│                                        │  │  MongoDB       │  │   │
│                                        │  └────────────────┘  │   │
│                                        └──────────┬───────────┘   │
│                                                   │               │
│                              ┌────────────────────┤               │
│                              │                    │               │
│                     ┌────────▼────────┐  ┌────────▼────────┐     │
│                     │   Mobile App    │  │   Web Admin     │     │
│                     │ (React Native)  │  │   (Next.js)     │     │
│                     │                │  │                  │     │
│                     │ End User /      │  │ Super Admin /   │     │
│                     │ Technician      │  │ Dept Admin      │     │
│                     └─────────────────┘  └─────────────────┘     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Component Descriptions

### 1. Hardware Firmware (ESP32)
- Runs on each physical FireEx unit installed in a building
- Reads sensor data: smoke detector, temperature, CO level, humidity
- Controls actuators: buzzer, LED indicator, relay (for sprinkler/alarm integration)
- Communicates with backend via MQTT over WiFi
- Operates autonomously if network is unavailable (local alarm still triggers)
- Stores unit identity (device ID, building/room assignment) in flash

### 2. Hardware Display UI (ESP32-S3)
- Runs on a separate MCU within the same physical unit as the firmware
- Drives a 5" 800×480 capacitive touch display using LVGL over 40-pin RGB interface
- Shows live sensor readings, device status, active alerts
- PIN-protected access for technician configuration mode
- Communicates with the firmware MCU via UART or shared memory (TBD)
- Can show offline status when network is unavailable

### 3. Central Backend (Fastify + Node.js)
- Single backend service for all clients (mobile, web, hardware)
- Exposes REST API for CRUD operations and queries
- Exposes WebSocket for real-time event push to mobile and web clients
- Runs an MQTT bridge (subscribes to hardware topics, publishes commands)
- Reads/writes PostgreSQL (relational data), TimescaleDB (sensor time-series), MongoDB (document data)
- Handles OTP generation and verification (no passwords)
- Handles push notifications via FCM/APNs

### 4. Mobile App (React Native)
- Single app for both end users and service technicians
- Role is determined post-OTP by backend (user vs. technician)
- End users: see building status, receive alerts, view history
- Technicians: same as user + receive maintenance tickets, perform device inspections, update ticket status
- Receives real-time alerts via WebSocket and push notifications
- Works offline for read-only historical data (last known state cached)

### 5. Web Admin (Next.js)
- Single Next.js application, two admin roles separated by route and middleware
- **Super Admin**: manages all buildings, departments, devices, users across the whole system
- **Department Admin**: manages their own department's devices and users only
- Both roles authenticated via OTP
- Displays dashboards, device maps, alert history, maintenance reports

---

## Cross-Cutting Concerns

### Authentication
- All users (end users, technicians, both admin types) authenticate via SMS OTP
- Phone numbers are pre-registered — no self-signup flow
- After OTP verification, the backend returns a JWT with the user's role embedded
- Mobile and web store the JWT and refresh it silently

### Real-time Updates
- Hardware → Backend: MQTT
- Backend → Mobile/Web: WebSocket
- Emergency alerts additionally trigger: push notifications (FCM/APNs) + SMS

### Offline Behavior
- Hardware unit: operates autonomously, local alarm triggers without network
- Mobile app: shows last-cached state; cannot perform actions requiring backend
- Web admin: shows stale data indicators; no real-time updates until reconnected

### Multi-tenancy
- The system is multi-tenant at the department level
- A building belongs to one or more departments
- A department admin can only see and manage their own department's data
- Super admin has global visibility

---

## Physical Unit Layout

Each FireEx hardware unit contains:
- **ESP32** — main MCU handling sensors, actuators, WiFi/MQTT
- **ESP32-S3** — display MCU handling the 5" LVGL touchscreen
- Communication between the two MCUs: UART (TBD, see `decisions/architecture-decisions.md`)
- Sensors: photoelectric smoke sensor, temperature/humidity (DHT22 or SHT31), CO sensor (MQ-7 or similar)
- Actuators: buzzer, red/green LED, relay output (NO/NC for external alarm integration)
- Power: 12V DC input with battery backup (specifics TBD)
