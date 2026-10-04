# Project: FireEx Hardware Firmware (`fireex-firmware`)

## Overview

The firmware running on the ESP32 MCU inside each FireEx hardware unit. Responsible for reading sensors, controlling actuators, communicating with the backend via MQTT, and operating safely in isolation when the network is unavailable.

**Status:** Not started (as of 2024-10-04)
**Repo:** TBD
**Platform:** ESP32 (Xtensa LX6 dual-core, 240MHz)
**Framework:** Arduino + PlatformIO
**Language:** C/C++

---

## Hardware Configuration

### Sensors
| Sensor | Type | Interface | Notes |
|--------|------|-----------|-------|
| Smoke | Photoelectric (TBD model) | Analog (ADC) | Reading normalized 0.0–1.0 |
| CO | MQ-7 or similar | Analog (ADC) + GPIO (heater cycle) | Requires warm-up time |
| Temperature + Humidity | DHT22 or SHT31 | Digital (1-Wire or I2C) | |

### Actuators
| Actuator | Interface | Notes |
|----------|-----------|-------|
| Buzzer | GPIO (PWM) | Variable frequency for different alarm tones |
| LED Red | GPIO | Alarm / error indicator |
| LED Green | GPIO | Normal operation / online indicator |
| Relay | GPIO | NO/NC output for external alarm panel integration |

### Communication
| Interface | Purpose |
|-----------|---------|
| WiFi | MQTT to backend |
| UART (Serial2) | Communication with Display UI (ESP32-S3) |
| USB Serial (Serial0) | Programming and provisioning |

### Pin Assignments (TBD — finalize with hardware schematic)
```cpp
#define PIN_SMOKE_SENSOR    34   // ADC1_CH6
#define PIN_CO_SENSOR       35   // ADC1_CH7
#define PIN_CO_HEATER       26   // CO sensor heater control
#define PIN_DHT22           4    // DHT22 data
#define PIN_BUZZER          25   // PWM output
#define PIN_LED_RED         27
#define PIN_LED_GREEN       14
#define PIN_RELAY           32
#define PIN_UART_TX         17   // Serial2 TX → Display MCU RX
#define PIN_UART_RX         16   // Serial2 RX → Display MCU TX
```

---

## Project Structure (PlatformIO)

```
fireex-firmware/
  platformio.ini
  src/
    main.cpp                ← Setup + loop
    config.h                ← Compile-time constants
    credentials.h           ← Device ID + WiFi + MQTT (generated per device, gitignored)
    sensors/
      smoke_sensor.h/.cpp
      co_sensor.h/.cpp
      dht_sensor.h/.cpp
    actuators/
      buzzer.h/.cpp
      leds.h/.cpp
      relay.h/.cpp
    network/
      wifi_manager.h/.cpp   ← WiFi connection + reconnect
      mqtt_client.h/.cpp    ← MQTT connect, subscribe, publish
    messaging/
      telemetry.h/.cpp      ← Build + publish telemetry payload
      alert.h/.cpp          ← Build + publish alert payload
      command_handler.h/.cpp← Handle incoming commands
      display_comms.h/.cpp  ← UART protocol with display MCU
    storage/
      nvs_config.h/.cpp     ← Read/write device config from NVS
    utils/
      watchdog.h/.cpp
      time_sync.h/.cpp      ← NTP sync
  test/
    test_sensors/
    test_alerts/
```

---

## Main Loop Logic

```cpp
void loop() {
    // 1. Reconnect WiFi if disconnected
    wifi_manager.maintain();

    // 2. Reconnect MQTT if disconnected
    mqtt_client.maintain();

    // 3. Read sensors (non-blocking, checks elapsed time)
    SensorReadings readings = sensors.read();

    // 4. Check thresholds → publish alert if exceeded
    if (alert_manager.checkThresholds(readings)) {
        mqtt_client.publishAlert(alert_manager.buildAlertPayload(readings));
        actuators.triggerAlarm();
    }

    // 5. Publish telemetry at reporting interval
    if (telemetry_timer.isReady()) {
        mqtt_client.publishTelemetry(readings);
        telemetry_timer.reset();
    }

    // 6. Handle incoming MQTT messages (commands)
    mqtt_client.loop();

    // 7. Send current state to display MCU over UART
    if (display_timer.isReady()) {
        display_comms.sendStateUpdate(readings, current_status);
        display_timer.reset();
    }

    // 8. Feed watchdog
    watchdog.feed();
}
```

---

## MQTT Client Behavior

### Connection
- TLS on port 8883
- Client ID: `fireex-{deviceId}`
- Username: `device-{deviceId}`, Password: from NVS
- Last Will set before connecting:
  ```
  Topic: fireex/{deviceId}/status
  Payload: {"deviceId":"...","online":false}
  QoS: 1, Retain: true
  ```

### On Successful Connect
1. Publish `fireex/{deviceId}/status` with `online: true` (retained)
2. Subscribe to `fireex/{deviceId}/command`
3. Subscribe to `fireex/{deviceId}/config`
4. If first boot: publish `fireex/{deviceId}/register`
5. Sync NTP time

### On Disconnect
- Attempt reconnect with exponential backoff (5s, 10s, 20s, max 60s)
- During disconnect: local alarm still triggers; telemetry is not stored (no queue in v1)
- LED red blinks slowly to indicate offline state

---

## Alarm Logic

### Trigger Conditions
Alert is triggered when ANY of these is true for 3 consecutive readings (to prevent false positives from transient spikes):
- `smokeLevel >= smokeThreshold`
- `coPpm >= coThresholdPpm`
- `temperatureCelsius >= tempThresholdCelsius`

### Local Alarm Sequence
```
1. Buzzer: continuous tone at 3500Hz
2. LED Red: on solid
3. LED Green: off
4. Relay: activate (for external alarm panel)
5. MQTT alert published (if connected)
```

### Alarm Silence (via command)
- Backend publishes `command: "silence_alarm"` → buzzer stops, relay deactivates
- LED Red stays on until condition clears
- Alert is NOT auto-cleared from backend; technician must resolve

### Alert Auto-Clear (on device)
When sensor readings return below threshold for 5 consecutive readings:
- Buzzer off (if not silenced), relay deactivated
- Publish status update with `alarmCleared: true`
- Backend handles auto-resolving the alert

---

## NVS (Non-Volatile Storage) Config

Config keys stored in NVS partition `"config"`:
```
deviceId         → string (UUID)
mqttUsername     → string
mqttPassword     → string
smokeThreshold   → float
coThresholdPpm   → float
tempThreshold    → float
reportingInterval→ int (seconds)
configVersion    → int
```

On boot: load config from NVS. If no config: use `credentials.h` defaults + wait for backend config push.

---

## UART Protocol with Display MCU

Format: JSON-over-UART at 115200 baud, newline-terminated messages.

Firmware → Display (every 1 second):
```json
{"t":"state","smoke":0.12,"co":8.4,"temp":23.5,"hum":52.0,"status":"online","alarm":false}
```

Display → Firmware (on PIN entry / technician action):
```json
{"t":"pin_ok","pin":"123456"}
{"t":"silence_request"}
{"t":"test_alarm_request"}
```

---

## Provisioning (New Device Setup)

Done once at manufacture / installation:
1. Flash firmware via USB + PlatformIO
2. Open Serial Monitor at 115200 baud
3. Send provisioning command: `PROVISION {deviceId} {mqttUsername} {mqttPassword}`
4. Firmware stores credentials in NVS, reboots
5. Device connects to WiFi (SSID/password hardcoded in `credentials.h` for site WiFi, or configured via BLE provisioning TBD)

---

## OTA Firmware Update

Triggered by `ota_update` command from backend:
- `params.url`: HTTPS URL to new firmware binary
- `params.version`: target version string
- Device downloads binary, verifies checksum (TBD), applies via `Update` library
- On success: reboot into new firmware
- On failure: continue running current firmware, publish error ack

---

## Key Implementation Notes

- Use `millis()`-based non-blocking timing throughout — no `delay()` in the main loop
- CO sensor (MQ-7) requires a heater cycle: 60s at 5V, then 90s at 1.4V. Handle this in `co_sensor.cpp`. Do not read CO value during heater high phase.
- ADC readings on ESP32 are noisy — use averaging over 10 samples per reading cycle
- Use `ArduinoJson` library for all JSON serialization/deserialization
- Use `PubSubClient` or `AsyncMqttClient` — decision TBD (see `decisions/architecture-decisions.md`)
- Watchdog timeout: 30 seconds. All blocking operations must complete well within this.
