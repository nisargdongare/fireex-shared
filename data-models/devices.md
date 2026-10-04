# Data Model: Devices

A FireEx device is a physical hardware unit installed in a building. Each unit contains an ESP32 (firmware) and an ESP32-S3 (display UI). The backend tracks both as a single logical device.

---

## Device States

```
unprovisioned → online → offline → maintenance → decommissioned
                  ↕
               alarming  (transient state during active alert)
```

| State | Description |
|-------|-------------|
| `unprovisioned` | Device record created in backend but hardware not yet connected |
| `online` | Device connected to MQTT and reporting normally |
| `offline` | Device was online but has not sent telemetry within the offline threshold (default: 2 min) |
| `alarming` | Device has an active, unacknowledged alert |
| `maintenance` | Device taken offline for maintenance by a technician |
| `decommissioned` | Device permanently removed from service |

---

## PostgreSQL: `devices` Table

```sql
CREATE TABLE devices (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_code         VARCHAR(50) NOT NULL UNIQUE,   -- human-readable: "FX-0042"
  serial_number       VARCHAR(100) UNIQUE,            -- physical label on unit
  room_id             UUID REFERENCES rooms(id) ON DELETE SET NULL,
  department_id       UUID NOT NULL REFERENCES departments(id),
  firmware_version    VARCHAR(20),                    -- e.g. "1.2.3"
  ui_version          VARCHAR(20),                    -- display MCU firmware version
  status              VARCHAR(20) NOT NULL DEFAULT 'unprovisioned'
                      CHECK (status IN ('unprovisioned','online','offline','alarming','maintenance','decommissioned')),
  last_seen_at        TIMESTAMPTZ,
  installed_at        TIMESTAMPTZ,
  installed_by        UUID REFERENCES users(id),      -- technician who installed it
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## PostgreSQL: `device_configs` Table

Stores per-device sensor thresholds and operational parameters:

```sql
CREATE TABLE device_configs (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id               UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  smoke_threshold         FLOAT NOT NULL DEFAULT 0.5,    -- normalized 0.0–1.0
  co_threshold_ppm        FLOAT NOT NULL DEFAULT 50.0,   -- PPM
  temp_threshold_celsius  FLOAT NOT NULL DEFAULT 60.0,   -- °C
  humidity_threshold_pct  FLOAT NOT NULL DEFAULT 80.0,   -- %RH
  reporting_interval_sec  INTEGER NOT NULL DEFAULT 30,   -- how often to send telemetry
  alarm_auto_silence_sec  INTEGER NOT NULL DEFAULT 0,    -- 0 = never auto-silence
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by              UUID REFERENCES users(id)
);
```

---

## TimescaleDB: `sensor_readings` Hypertable

All sensor data is written here. TimescaleDB automatically partitions by time.

```sql
CREATE TABLE sensor_readings (
  time                TIMESTAMPTZ NOT NULL,
  device_id           UUID NOT NULL,
  smoke_level         FLOAT,        -- normalized 0.0–1.0 from MQ2
  temperature_celsius FLOAT,        -- from DHT11
  humidity_pct        FLOAT,        -- from DHT11
  battery_pct         FLOAT,        -- battery level if on backup power
  wifi_rssi           INTEGER,      -- WiFi signal strength (dBm)
  gsm_signal_bars     SMALLINT,     -- GSM backup carrier signal bars (0–5)
  exhaust_fan_on      BOOLEAN,      -- state of exhaust fan relay
  sprinkler_triggered BOOLEAN,      -- one-shot sprinkler activation state
  raw_payload         JSONB         -- full raw MQTT payload for debugging
);

SELECT create_hypertable('sensor_readings', 'time');
CREATE INDEX ON sensor_readings (device_id, time DESC);
```

### Retention Policy (default)
- Raw readings retained for 1 year
- Continuous aggregate (hourly averages) retained indefinitely
- Configurable per-deployment

---

## MongoDB: `device_config_snapshots` Collection

Every time a device config changes, a snapshot is stored:

```json
{
  "_id": "ObjectId",
  "deviceId": "uuid",
  "snapshotAt": "ISODate",
  "changedBy": "user-uuid",
  "config": {
    "smokeThreshold": 0.5,
    "coThresholdPpm": 50.0,
    "tempThresholdCelsius": 60.0,
    "humidityThresholdPct": 80.0,
    "reportingIntervalSec": 30,
    "alarmAutoSilenceSec": 0
  }
}
```

Retention: last 10 snapshots per device.

---

## MQTT Identity

Each device authenticates to the MQTT broker using:
- **Client ID**: `fireex-{deviceId}`
- **Username**: `device-{deviceId}`
- **Password**: device-specific secret provisioned at manufacture time

---

## Device Sensor Fields (Summary)

| Field | Unit | Range | Notes |
|-------|------|-------|-------|
| `smoke_level` | normalized | 0.0 – 1.0 | MQ2 sensor reading |
| `temperature_celsius` | °C | -10 – 100 | DHT11 ambient temp |
| `humidity_pct` | %RH | 0 – 100 | DHT11 relative humidity |
| `battery_pct` | % | 0 – 100 | Battery backup level; shown on DeviceDetail screen |
| `wifi_rssi` | dBm | -100 – 0 | WiFi signal strength; shown on DeviceDetail |
| `gsm_signal_bars` | integer | 0 – 5 | GSM backup carrier signal; shown on DeviceDetail |
| `exhaust_fan_on` | boolean | — | Current state of exhaust fan relay; controllable from app |
| `sprinkler_triggered` | boolean | — | Has the one-shot sprinkler been activated; shown as "Active/Inactive" on EmergencyAlertScreen |
| `buzzer_muted` | boolean | — | Whether local buzzer has been silenced; controllable from app |
| `is_armed` | boolean | — | Device armed state; controllable from app (Armed toggle) |

---

## API: Device Management

| Endpoint | Access | Description |
|----------|--------|-------------|
| `POST /api/devices` | super_admin | Register a new device |
| `GET /api/devices` | dept_admin+ | List devices (filtered by dept for dept_admin) |
| `GET /api/devices/:id` | dept_admin+ | Get device details |
| `PATCH /api/devices/:id` | dept_admin+ | Update device config or room assignment |
| `GET /api/devices/:id/readings` | dept_admin+ | Get time-series sensor readings |
| `POST /api/devices/:id/command` | dept_admin+ | Send command to device |
| `DELETE /api/devices/:id` | super_admin | Decommission device |

See `api-contracts/rest-api.md` for full request/response shapes.
