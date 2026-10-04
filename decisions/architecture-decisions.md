# FireEx Architecture Decisions

All significant architectural decisions are recorded here with the date they were made and the reasoning behind them. This prevents relitigating decisions in future sessions.

Format:
```
## ADR-NNN: Title
Date: YYYY-MM-DD
Status: decided | superseded | reversed
Decision: ...
Reason: ...
Alternatives considered: ...
```

---

## ADR-001: Single Backend for All Clients
**Date:** 2024-10-04
**Status:** decided

**Decision:** One Fastify backend (`fireex-backend`) serves mobile, web, and hardware (via MQTT bridge). No microservices split.

**Reason:** The system is not yet at a scale where microservices overhead is justified. A monolith is easier to develop, test, and deploy at this stage. Service boundaries are enforced through the internal module structure (services, routes) so a future split remains possible.

**Alternatives considered:** Separate backend services per client type. Rejected — operational overhead with no benefit at current scale.

---

## ADR-002: OTP-only Authentication (No Passwords)
**Date:** 2024-10-04
**Status:** decided

**Decision:** All authentication is via SMS OTP. No passwords exist anywhere in the system.

**Reason:** Target users (fire safety personnel, building occupants) may share devices or forget passwords. OTP removes credential management burden. Phone number is already the natural identity in this domain. Admin pre-registers all users, so no self-service password reset is needed.

**Alternatives considered:** Password + 2FA. Rejected — OTP alone is simpler and appropriate for this use case.

---

## ADR-003: Role-in-JWT (Not Role Lookup Per Request)
**Date:** 2024-10-04
**Status:** decided

**Decision:** The user's role and departmentId are embedded in the JWT access token payload. The backend does not look up role from the database on every request.

**Reason:** Reduces DB queries on every authenticated request. Access tokens are short-lived (15 minutes), so role data is never stale for long. If a role changes, the change takes effect within 15 minutes when the token expires.

**Alternatives considered:** Look up role from DB on every request. Rejected — unnecessary DB load and latency for a field that changes rarely.

---

## ADR-004: TimescaleDB for Sensor Readings
**Date:** 2024-10-04
**Status:** decided

**Decision:** Sensor time-series data goes into a TimescaleDB hypertable, not a plain PostgreSQL table or a separate time-series DB (InfluxDB, etc.).

**Reason:** TimescaleDB is a PostgreSQL extension — it uses the same PostgreSQL connection, the same Prisma/SQL tooling, and requires no separate service. Time-bucket aggregation queries are a core requirement for dashboards. InfluxDB or Prometheus would require maintaining a separate service and learning a new query language.

**Alternatives considered:** InfluxDB, plain PostgreSQL table. InfluxDB rejected (extra service). Plain PG rejected (slow on large time-series without partitioning).

---

## ADR-005: MongoDB for Audit Logs and Config Snapshots
**Date:** 2024-10-04
**Status:** decided

**Decision:** Audit logs and device config snapshots are stored in MongoDB, not PostgreSQL.

**Reason:** These are document-shaped records with variable structure (audit log payloads differ by action type). MongoDB makes it easy to store them without upfront schema design. PostgreSQL JSONB could work but is more cumbersome for document-centric queries.

**Alternatives considered:** PostgreSQL with JSONB. Possible, but MongoDB is a better fit for document-centric, schema-flexible data.

---

## ADR-006: Single React Native App for End User and Technician
**Date:** 2024-10-04
**Status:** decided

**Decision:** One React Native app binary for both end users and service technicians. The UI adapts based on the role returned in the JWT.

**Reason:** Simplifies distribution (one app in app stores). Technicians and end users may be the same person in smaller buildings. Maintaining two apps for what is essentially the same base app is unnecessary overhead.

**Alternatives considered:** Two separate apps. Rejected — doubles maintenance and distribution effort.

---

## ADR-007: Single Next.js App for Super Admin and Dept Admin
**Date:** 2024-10-04
**Status:** decided

**Decision:** One Next.js application serves both admin roles. Role-based UI hiding and server-side route protection separates what each role can see and do.

**Reason:** Same reasoning as ADR-006. The roles share the majority of screens; only a small subset (department management, system config) is super_admin-only.

**Alternatives considered:** Two separate web apps. Rejected — most of the UI is shared; the difference is authorization, not functionality.

---

## ADR-008: Hardware Has Two MCUs (ESP32 + ESP32-S3)
**Date:** 2024-10-04
**Status:** decided

**Decision:** The firmware MCU (ESP32) and the display UI MCU (ESP32-S3) are separate chips that communicate via UART.

**Reason:** The ESP32-S3 has a native 16-bit RGB LCD peripheral required for the 40-pin display interface. The standard ESP32 does not. Keeping the firmware MCU separate means display crashes or rendering issues cannot crash the safety-critical sensor/alarm logic. The firmware MCU can operate fully without the display MCU.

**Alternatives considered:** Single ESP32-S3 for both duties. Rejected — the RGB LCD DMA would compete with WiFi/MQTT and sensor reading. Separation gives cleaner resource isolation.

---

## ADR-009: UART for Inter-MCU Communication
**Date:** 2024-10-04
**Status:** decided

**Decision:** UART (Serial2 on ESP32, Serial1 on ESP32-S3) at 115200 baud, with newline-delimited JSON messages.

**Reason:** Simple to implement, no additional hardware, deterministic latency at 115200 baud for the small payloads involved (< 200 bytes per message). JSON is human-readable for debugging.

**Alternatives considered:** SPI (faster but more complex, not needed for this data rate), I2C (slower, shared bus risk), shared PSRAM (only possible on same SoC). UART chosen for simplicity.

---

## ADR-010: No Self-Signup (Admin Pre-Registration Only)
**Date:** 2024-10-04
**Status:** decided

**Decision:** Users cannot sign up themselves. All user accounts are created by super_admin or dept_admin. Phone numbers are validated at registration time.

**Reason:** FireEx is deployed in controlled environments (buildings, departments). Access should be explicitly granted by an admin, not self-served. This is a security requirement — not everyone with the app should be able to create an account for any building.

---

## ADR-011: MQTT QoS Levels by Message Type
**Date:** 2024-10-04
**Status:** decided

**Decision:** Telemetry at QoS 0, alerts at QoS 2, commands at QoS 1, status at QoS 1.

**Reason:** Telemetry is frequent (every 30s) and a missed reading is acceptable — the next one arrives soon. Alerts are safety-critical and must not be lost or duplicated. Commands need delivery assurance but not exactly-once semantics.

---

## TBD Items (Decisions Pending)

| Item | Options | Target decision date |
|------|---------|---------------------|
| MQTT broker | Mosquitto (self-hosted), HiveMQ Cloud, EMQX | TBD |
| Cloud hosting | AWS, GCP, DigitalOcean | TBD |
| SMS provider | Twilio, AWS SNS | TBD |
| WiFi provisioning on hardware | Hardcoded SSID, BLE provisioning, SmartConfig | TBD |
| OTP storage backend | PostgreSQL, Redis | TBD |
| Refresh token storage | PostgreSQL, Redis | TBD |
| MQTT library for ESP32 | PubSubClient, AsyncMqttClient | TBD |
| Touch controller model | FT5x06 or GT911 | TBD (depends on panel) |
| CO sensor model | MQ-7 or other | TBD (hardware team) |
| Smoke sensor model | TBD | TBD (hardware team) |
| Battery backup spec | TBD | TBD (hardware team) |
