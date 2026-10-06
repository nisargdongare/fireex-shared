# FireEx MQTT Topic Structure

This document defines the MQTT topic hierarchy for communication between hardware devices and the backend.

MQTT broker: TBD (Mosquitto / HiveMQ / EMQX)
QoS levels are specified per topic.

---

## Topic Naming Convention

```
fireex/{deviceId}/{direction}/{messageType}
```

- `deviceId`: UUID of the device (set at manufacture time, stored in device flash)
- `direction`: `telemetry` (device → broker), `command` (broker → device), `ack` (device → broker in response to command), `status` (device → broker for state)
- `messageType`: specific message type

All payloads are JSON.

---

## Device → Broker Topics

### `fireex/{deviceId}/telemetry`
**QoS:** 0 (fire and forget — sensor readings are frequent and loss is acceptable)
**Retained:** No
**Frequency:** Configurable (default: every 30 seconds)

Published by the device with every sensor reading cycle.

```json
{
  "deviceId": "uuid",
  "timestamp": "2024-01-15T14:32:00Z",
  "readings": {
    "smokeLevel": 0.12,
    "coPpm": 8.4,
    "temperatureCelsius": 23.5,
    "humidityPct": 52.0,
    "batteryPct": 95.0,
    "batteryVoltage": 23.1,
    "mainsVoltage": 228.4,
    "mainsPresent": true,
    "batteryCharging": true,
    "wifiRssi": -65
  },
  "fwVersion": "1.2.3"
}
```

---

### `fireex/{deviceId}/alert`
**QoS:** 2 (exactly once — alerts must not be lost or duplicated)
**Retained:** No
**Trigger:** When any sensor reading exceeds its threshold

Published immediately when a threshold is crossed — does not wait for the next telemetry cycle.

```json
{
  "deviceId": "uuid",
  "timestamp": "2024-01-15T14:32:00Z",
  "alertType": "smoke",
  "readings": {
    "smokeLevel": 0.87,
    "coPpm": 8.4,
    "temperatureCelsius": 23.5,
    "humidityPct": 52.0
  },
  "thresholds": {
    "smokeThreshold": 0.5,
    "coThresholdPpm": 50.0,
    "tempThresholdCelsius": 60.0
  }
}
```

Valid `alertType` values: `smoke`, `co`, `temperature`, `tamper`, `battery_low`, `mains_lost`

---

### `fireex/{deviceId}/status`
**QoS:** 1 (at least once)
**Retained:** Yes (broker retains last status — allows backend to query current state on reconnect)
**Trigger:** On connect, on disconnect (Last Will), on explicit state change

```json
{
  "deviceId": "uuid",
  "timestamp": "2024-01-15T14:32:00Z",
  "online": true,
  "uptime": 86400,
  "fwVersion": "1.2.3",
  "uiVersion": "1.0.1",
  "config": {
    "reportingIntervalSec": 30
  }
}
```

**Last Will message** (sent by broker on unexpected disconnect):
Topic: `fireex/{deviceId}/status`
Payload:
```json
{
  "deviceId": "uuid",
  "online": false,
  "timestamp": "auto"
}
```

---

### `fireex/{deviceId}/register`
**QoS:** 1
**Retained:** No
**Trigger:** On first boot after provisioning

Sent once when a device connects to the broker for the first time. Backend responds with full config.

```json
{
  "deviceId": "uuid",
  "serialNumber": "SN-ESP32-00042",
  "fwVersion": "1.0.0",
  "chipModel": "ESP32",
  "macAddress": "AA:BB:CC:DD:EE:FF"
}
```

---

### `fireex/{deviceId}/ack`
**QoS:** 1
**Retained:** No
**Trigger:** After executing a command received on the command topic

```json
{
  "deviceId": "uuid",
  "commandId": "uuid",
  "command": "test_alarm",
  "status": "success",
  "timestamp": "2024-01-15T14:32:00Z",
  "message": "Test alarm completed"
}
```

Valid `status` values: `success`, `failed`, `rejected`

---

## Broker → Device Topics

### `fireex/{deviceId}/command`
**QoS:** 1 (at least once — commands must be delivered)
**Retained:** No

Published by the backend to send a command to a specific device.

```json
{
  "commandId": "uuid",
  "command": "test_alarm",
  "params": {},
  "issuedAt": "2024-01-15T14:32:00Z",
  "issuedBy": "user-uuid"
}
```

Valid commands:
| Command | Params | Description |
|---------|--------|-------------|
| `test_alarm` | `{}` | Trigger test: buzzer + LED for 3 seconds |
| `silence_alarm` | `{}` | Silence buzzer (does not resolve the alert) |
| `reboot` | `{}` | Reboot the ESP32 |
| `sync_config` | `{}` | Request backend to resend device config |
| `set_config` | `{ "reportingIntervalSec": 60, ... }` | Update device config directly |
| `ota_update` | `{ "url": "https://...", "version": "1.3.0" }` | Initiate OTA firmware update |

---

### `fireex/{deviceId}/config`
**QoS:** 1
**Retained:** Yes (broker retains latest config so device gets it on reconnect)

Published by the backend after registration or after a config change.

```json
{
  "deviceId": "uuid",
  "version": 5,
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

Device should compare `version` with its stored config version and apply only if newer.

---

## Backend Wildcard Subscriptions

The backend MQTT bridge subscribes to these wildcards to receive messages from all devices:

| Subscription | Purpose |
|-------------|---------|
| `fireex/+/telemetry` | Receive all device telemetry readings |
| `fireex/+/alert` | Receive all device alerts |
| `fireex/+/status` | Receive all device online/offline status |
| `fireex/+/register` | Handle new device registrations |
| `fireex/+/ack` | Receive command acknowledgments |

---

## MQTT Security

- **TLS**: All connections use TLS (port 8883)
- **Authentication**: Username/password per device (provisioned at manufacture)
- **Authorization**: Each device can only publish to `fireex/{its own deviceId}/...` and only subscribe to `fireex/{its own deviceId}/command` and `fireex/{its own deviceId}/config`
- Backend service account has publish/subscribe rights to all `fireex/#` topics
- No device can publish to another device's topics or subscribe to `fireex/+/telemetry`

---

## Topic Summary Table

| Topic | Direction | QoS | Retained | Trigger |
|-------|-----------|-----|----------|---------|
| `fireex/{id}/telemetry` | Device→Broker | 0 | No | Every N seconds |
| `fireex/{id}/alert` | Device→Broker | 2 | No | Threshold exceeded |
| `fireex/{id}/status` | Device→Broker | 1 | Yes | Connect/disconnect/change |
| `fireex/{id}/register` | Device→Broker | 1 | No | First boot |
| `fireex/{id}/ack` | Device→Broker | 1 | No | After command |
| `fireex/{id}/command` | Broker→Device | 1 | No | Admin action |
| `fireex/{id}/config` | Broker→Device | 1 | Yes | After registration / config change |
