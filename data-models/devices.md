# Data Model: Devices

A FireEx device is a physical hardware unit installed in a building. Each unit contains an ESP32 (firmware) and an ESP32-S3 (display UI). The backend tracks both as a single logical device.

> **Database note (ADR-012):** All collections below are MongoDB collections accessed via Mongoose, not PostgreSQL/TimescaleDB. `id` fields are MongoDB ObjectId strings, not UUIDs. `device_configs` (previously a separate 1:1 table) is now an embedded `config` subdocument on the device itself — see below. `sensor_readings` (previously a TimescaleDB hypertable) is now a plain MongoDB collection.

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

## MongoDB: `devices` Collection

```ts
{
  _id:                ObjectId,
  deviceCode:         string,     // human-readable: "FX-0042" — unique index
  serialNumber:       string,     // physical label on unit — unique index
  roomId?:            ObjectId,   // ref: rooms, indexed
  departmentId:       ObjectId,   // ref: departments, indexed
  firmwareVersion?:   string,     // e.g. "1.2.3"
  uiVersion?:         string,     // display MCU firmware version
  status:             'unprovisioned' | 'online' | 'offline' | 'alarming' | 'maintenance' | 'decommissioned',
                                  // default 'unprovisioned'
  lastSeenAt?:        Date,
  installedAt?:       Date,
  installedBy?:       ObjectId,  // ref: users — technician who installed it
  notes?:             string,
  config:             DeviceConfig,  // embedded subdocument, see below
  createdAt:          Date,
  updatedAt:          Date,
}
```

---

## Embedded: `DeviceConfig` (the `devices.config` subdocument)

Stores per-device sensor thresholds and operational parameters. Previously a separate `device_configs` table with a 1:1 relationship to `devices` — now embedded directly, since it's always read/written together with its parent device and MongoDB has no benefit from normalizing a strict 1:1 relation into a separate collection.

```ts
{
  smokeThreshold:          number,     // default 0.5, normalized 0.0–1.0
  coThresholdPpm:          number,     // default 50.0, PPM
  tempThresholdCelsius:    number,     // default 60.0, °C
  humidityThresholdPct:    number,     // default 80.0, %RH
  lowBatteryVoltageV:      number,     // default 20.0 — below this = battery LOW / 0%; range 15–24V
  lowMainsVoltageV:        number,     // default 20.0 — below this = mains absent; range 15–24V
  reportingIntervalSec:    number,     // default 30 — how often to send telemetry
  alarmAutoSilenceSec:     number,     // default 0 — 0 = never auto-silence
  updatedAt:               Date,
  updatedBy?:              ObjectId,  // ref: users
}
```

---

## MongoDB: `sensor_readings` Collection

All sensor data is written here. Previously a TimescaleDB hypertable; now a plain MongoDB collection with a compound index for time-range queries per device. See ADR-012 for the trade-offs of this change (query/storage efficiency vs. TimescaleDB) and the upgrade path (MongoDB native `timeseries` collection type) if sensor volume grows large enough to need it.

```ts
{
  _id:                  ObjectId,
  time:                 Date,       // indexed, part of compound index
  deviceId:             ObjectId,   // ref: devices, part of compound index
  smokeLevel?:          number,     // normalized 0.0–1.0 from MQ2
  temperatureCelsius?:  number,     // from DHT22
  humidityPct?:         number,     // from DHT22
  batteryPct?:          number,     // 0–100%, computed on device from voltage vs lowBatteryVoltage threshold
  batteryVoltage?:      number,     // raw voltage (V) from GPIO9 ADC via R1=100kΩ/R2=12kΩ divider
  mainsVoltage?:        number,     // raw voltage (V) from GPIO10 ADC via R1=100kΩ/R2=12kΩ divider
  mainsPresent?:        boolean,    // true if mainsVoltage > lowMainsVoltage threshold
  batteryCharging?:     boolean,    // true if mains present AND battery voltage rose >0.3V over 30s
  wifiRssi?:            number,     // WiFi signal strength (dBm)
  gsmSignalBars?:       number,     // GSM backup carrier signal bars (0–5)
  exhaustFanOn?:        boolean,    // state of exhaust fan relay
  sprinklerTriggered?:  boolean,    // one-shot sprinkler activation state
  rawPayload?:          Mixed,      // full raw MQTT payload for debugging
}
```

Compound index on `(deviceId, time DESC)`.

### Time-bucket aggregation (dashboards)

Previously done via TimescaleDB's `time_bucket()`. Now done via the MongoDB aggregation pipeline, e.g. bucketing to 5-minute intervals:

```js
db.sensor_readings.aggregate([
  { $match: { deviceId, time: { $gte: from, $lte: to } } },
  {
    $group: {
      _id: {
        $dateTrunc: { date: "$time", unit: "minute", binSize: 5 }
      },
      avgSmokeLevel: { $avg: "$smokeLevel" },
      avgTempCelsius: { $avg: "$temperatureCelsius" },
      avgHumidityPct: { $avg: "$humidityPct" },
    }
  },
  { $sort: { _id: 1 } }
])
```

### Retention Policy (default)
- Raw readings retained for 1 year — implement via a MongoDB TTL index or a scheduled cleanup job (no built-in continuous-aggregate retention policy like TimescaleDB; if long-term rollups are needed, write them to a separate `sensor_readings_hourly` collection via a scheduled job)
- Configurable per-deployment

---

## MongoDB: `device_config_snapshots` Collection

Every time a device config changes, a snapshot is stored (unchanged from before — this collection was already in MongoDB):

```json
{
  "_id": "ObjectId",
  "deviceId": "ObjectId",
  "snapshotAt": "ISODate",
  "changedBy": "ObjectId",
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

(`{deviceId}` here is the MongoDB ObjectId string of the device document.)

---

## Device Sensor Fields (Summary)

| Field | Unit | Range | Notes |
|-------|------|-------|-------|
| `smokeLevel` | normalized | 0.0 – 1.0 | MQ2 sensor reading |
| `temperatureCelsius` | °C | -10 – 100 | DHT22 ambient temp |
| `humidityPct` | %RH | 0 – 100 | DHT22 relative humidity |
| `batteryPct` | % | 0 – 100 | Computed on device: 0% = lowBatteryVoltage threshold, 100% = 24V |
| `batteryVoltage` | V | 0 – 24 | Raw ADC reading via R1=100kΩ/R2=12kΩ divider on GPIO9 |
| `mainsVoltage` | V | 0 – 30 | Raw ADC reading via R1=100kΩ/R2=12kΩ divider on GPIO10 |
| `mainsPresent` | boolean | — | True if mainsVoltage > user-set lowMainsVoltage threshold |
| `batteryCharging` | boolean | — | True if mains present AND voltage rising >0.3V over 30s window |
| `wifiRssi` | dBm | -100 – 0 | WiFi signal strength; shown on DeviceDetail |
| `gsmSignalBars` | integer | 0 – 5 | GSM backup carrier signal; shown on DeviceDetail |
| `exhaustFanOn` | boolean | — | Current state of exhaust fan relay; controllable from app |
| `sprinklerTriggered` | boolean | — | Has the one-shot sprinkler been activated; shown as "Active/Inactive" on EmergencyAlertScreen |
| `buzzerMuted` | boolean | — | Whether local buzzer has been silenced; controllable from app |
| `isArmed` | boolean | — | Device armed state; controllable from app (Armed toggle) |

---

## API: Device Management

| Endpoint | Access | Description |
|----------|--------|-------------|
| `POST /api/devices` | super_admin | Register a new device |
| `GET /api/devices` | dept_admin+ | List devices (filtered by dept for dept_admin) |
| `GET /api/devices/:id` | dept_admin+ | Get device details |
| `PATCH /api/devices/:id` | dept_admin+ | Update device config or room assignment |
| `GET /api/devices/:id/readings` | dept_admin+ | Get time-series sensor readings |
| `GET /api/devices/:id/logs` | technician+ | Get paginated device event logs |
| `POST /api/devices/:id/command` | dept_admin+ | Send command to device |
| `DELETE /api/devices/:id` | super_admin | Decommission device |

See `api-contracts/rest-api.md` for full request/response shapes.
