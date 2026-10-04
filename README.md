# FireEx Shared Knowledge Base

This repository is the **central AI context store** for the entire FireEx platform — a fire and smoke safety system. Every sub-project in the FireEx ecosystem reads this repo at the start of each Claude dev session to ensure architectural consistency, shared data models, and API contracts are never re-explained.

---

## What is FireEx?

FireEx is a fire and smoke safety monitoring platform consisting of:

- **IoT hardware units** installed in buildings (ESP32-based, with sensors and actuators)
- **A central backend** that receives sensor data via MQTT and serves mobile/web clients
- **A mobile app** used by end users and service technicians (role-detected by phone number)
- **A web admin portal** used by department admins and super admins
- **A hardware display UI** on each physical unit (ESP32-S3 with LVGL 5" touch display)

---

## How to Use This Repo in a Dev Session

At the start of every Claude session in any FireEx sub-project, read the relevant files from this repo before writing any code or making any decisions.

### Minimum reads for every session
1. `README.md` — this file
2. `architecture/system-overview.md` — full system picture
3. `architecture/tech-stack.md` — confirmed stack per project
4. `status/project-status.md` — current build state

### Additional reads by task
| Task | Additional files to read |
|------|--------------------------|
| Working on the backend | `projects/backend.md`, `api-contracts/rest-api.md`, `api-contracts/mqtt-topics.md` |
| Working on mobile app | `projects/mobile-app.md`, `api-contracts/rest-api.md`, `api-contracts/websocket-events.md` |
| Working on web admin | `projects/web-admin.md`, `api-contracts/rest-api.md`, `api-contracts/websocket-events.md` |
| Working on hardware firmware | `projects/hardware-firmware.md`, `api-contracts/mqtt-topics.md` |
| Working on hardware UI | `projects/hardware-ui.md` |
| Designing data models | All files in `data-models/` |
| Reviewing architecture decisions | `decisions/architecture-decisions.md` |

---

## How to Update This Repo

When you make a significant decision or build something in a sub-project, **update the relevant file here immediately** so the knowledge stays current.

### Update triggers
- A new API endpoint is added → update `api-contracts/rest-api.md`
- A MQTT topic structure changes → update `api-contracts/mqtt-topics.md`
- A data model changes → update the relevant file in `data-models/`
- An architectural decision is made → append to `decisions/architecture-decisions.md`
- A sub-project reaches a new milestone → update `status/project-status.md`
- A new screen is designed → update the relevant project file in `projects/`

---

## Sub-Projects Overview

| Project | Repo (TBD) | Tech | Status |
|---------|-----------|------|--------|
| `fireex-backend` | TBD | Node.js + Fastify | Not started |
| `fireex-mobile` | TBD | React Native | Not started |
| `fireex-web` | TBD | Next.js | Not started |
| `fireex-firmware` | TBD | Arduino + PlatformIO (ESP32) | Not started |
| `fireex-ui` | TBD | Arduino + PlatformIO (ESP32-S3) + LVGL | Not started |

---

## Guiding Principles

1. **Phone number is identity** — no email-based auth. All users are pre-registered by admins.
2. **OTP only** — no passwords anywhere in the system.
3. **Role is derived, not chosen** — after OTP verification, the system determines the user's role from their registered phone number.
4. **Hardware is sovereign** — each unit operates safely in isolation if the network is unavailable.
5. **Alerts are never silent** — emergency alerts must propagate across all channels (push, WebSocket, SMS) regardless of app state.
