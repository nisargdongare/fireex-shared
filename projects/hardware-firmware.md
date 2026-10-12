# Project: FireEx Hardware Firmware (`fireex-firmware`)

## Overview

The firmware running on the ESP32 MCU inside each FireEx hardware unit. Responsible for reading sensors, controlling actuators, communicating with the backend via MQTT, and operating safely in isolation when the network is unavailable.

**Status:** In progress (as of 2026-10-13)
**Repo:** `~/Documents/PlatformIO/Projects/fireex-firmware`
**Platform:** ESP32-S3-WROOM-1 N16R8 (dual-core, 240MHz, 16MB flash, 8MB PSRAM) — both master and slave
**Framework:** Arduino + PlatformIO
**Language:** C/C++

---

## Hardware Configuration

### Sensors
| Sensor | Model | Interface | Notes |
|--------|-------|-----------|-------|
| Smoke | MQ2 | Analog (ADC) | Reading normalized 0.0–1.0; detects smoke, LPG, CO |
| Temperature + Humidity | DHT22 | Digital (1-Wire) | Combined sensor, 1 GPIO — **DHT22 confirmed in firmware, not DHT11** |
| Motion/Presence | HLK-LD2410B radar | UART (256000 baud) | Swept by stepper motor to positions A/B/C/D |

> **Note:** CO sensor removed — MQ2 covers smoke and combustible gases. **DHT22 confirmed from firmware code** (shared docs previously said DHT11 — that was wrong).

### Microwave Radar — Stepper Motor Positions
The radar module sweeps a stepper motor through 4 positions to provide directional presence coverage:
| Position | Zone |
|----------|------|
| A | Left quadrant |
| B | Front-left |
| C | Front-right |
| D | Right quadrant |

### Actuators
| Actuator | GPIO | Interface | Notes |
|----------|------|-----------|-------|
| Solenoid valve | 18 | Digital output | Water solenoid; controllable from Outputs screen |
| Buzzer | 7 | Digital output (PWM capable) | Alarm sound; controllable from Outputs screen |
| Smoke sensor enable | 6 | Digital output | Powers/enables MQ2 module; controllable from Outputs screen |
| Emergency tubelight | 17 | Digital output via IRF44N MOSFET | 24V tubelight; controllable from Outputs screen |
| Door lock | 15 | Digital output | Electromagnetic door lock; controllable from Outputs screen |
| Power fan | 16 | Digital output | Main ventilation fan relay; controllable from Outputs screen |
| Exhaust fan | — | PWM/ESC | Brushless motor via ESC, 50Hz RC signal; speed set via Exhaust Speed screen |
| LED Red | — | Digital output | Alarm / error indicator |
| LED Green | — | Digital output | Normal operation / online indicator |

> **Output control:** All 6 main outputs (solenoid valve, buzzer, smoke sensor, tube light, door lock, power fan) are individually controllable from the display's Outputs on/off screen. Toggling any output sends an immediate UART command to the master MCU which drives the corresponding GPIO.

### Communication
| Interface | Purpose |
|-----------|---------|
| WiFi | Primary MQTT to backend |
| BLE | Device pairing during installation (technician app scans and pairs) |
| GSM module | Cellular backup when WiFi is unavailable; sends SMS alert fallback |
| UART1 (HardwareSerial(1)) | Communication with Display UI (ESP32-S3); TX=GPIO11, RX=GPIO12 on master |
| USB Serial (Serial0) | Programming and provisioning |

### Pin Assignments (Master — confirmed from firmware `src/master/main_master.cpp`)
```cpp
// Output GPIOs — all digital, driven HIGH=on / LOW=off
#define PIN_SOLENOID_VALVE  18   // Water solenoid valve
#define PIN_BUZZER           7   // Alarm buzzer
#define PIN_SMOKE_SENSOR     6   // MQ2 enable / power
#define PIN_TUBE_LIGHT      17   // 24V emergency tubelight via IRF44N MOSFET
#define PIN_DOOR_LOCK       15   // Electromagnetic door lock
#define PIN_POWER_FAN       16   // Main ventilation fan relay

// UART1 to slave display MCU — confirmed working from PCB
#define SLAVE_TX_PIN        11   // Master TX → Slave RX (GPIO5)
#define SLAVE_RX_PIN        12   // Master RX ← Slave TX (GPIO4)
#define SLAVE_BAUD          115200
```

### Pin Assignments (Slave Display MCU — confirmed from firmware, PCB verified)
```cpp
// UART1 from master — confirmed working from PCB
#define MASTER_RX_PIN       5    // Slave RX ← Master TX (GPIO11)
#define MASTER_TX_PIN       4    // Slave TX → Master RX (GPIO12)

// RGB565 display bus (ST7265, 800×480)
#define PIN_B3  3
#define PIN_B4  20
#define PIN_B5  19
#define PIN_B6  8
#define PIN_B7  18
#define PIN_G2  39
#define PIN_G3  38
#define PIN_G4  11
#define PIN_G5  12
#define PIN_G6  9
#define PIN_G7  10
#define PIN_R3  13
#define PIN_R4  14
#define PIN_R5  21
#define PIN_R6  47
#define PIN_R7  48

// RGB control signals — confirmed from PCB schematic
#define PIN_PCLK   17
#define PIN_VSYNC  7
#define PIN_HSYNC  15
#define PIN_DE     6
#define PIN_DISP   16   // bodge-wired; active-LOW during reset, HIGH after RGB timing stable

// Backlight & status
#define PIN_BACKLIGHT   40  // active-LOW (inverting stage ahead of boost converter)
#define PIN_STATUS_LED  46

// GT911 capacitive touch (I2C)
#define PIN_TOUCH_SDA  2
#define PIN_TOUCH_SCL  42
#define PIN_TOUCH_INT  1
#define PIN_TOUCH_RST  41
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
- `temperatureCelsius >= tempThresholdCelsius`

### Local Alarm Sequence
```
1. Buzzer: continuous tone at 3500Hz
2. LED Red: on solid
3. LED Green: off
4. Emergency tubelight: activate
5. Exhaust fan: activate automatically
6. Sprinkler: ONLY if commanded by backend (never auto-triggers from firmware alone)
7. MQTT alert published (if connected); GSM SMS sent if WiFi unavailable
```

### Sprinkler Activation Sequence (command-driven only)
When backend sends `command: "activate_sprinkler"`:
```
1. Rotate unlock knob (GPIO pulse)
2. Disengage pin-driven door lock (GPIO pulse, wait for confirmation)
3. Open solenoid valve (GPIO set HIGH)
4. Publish sprinkler_activated event to MQTT
```
**This sequence is irreversible from firmware.** Water flow continues until physical reset by technician.

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

### Master → Display (every 1 second)
```json
{"t":"state","seq":1,"smoke":0.0,"photo":0.0,"temp":25.0,"hum":50.0,
 "alarm":false,"tubelight":false,"door_lock":true,"power_fan":false,
 "buzzer":false,"exhaust_fan":false,"solenoid":false,
 "batt_v":24.50,"batt_pct":85,"mains_v":230.0,"on_mains":true,"charging":false,
 "wifi_connected":true,"wifi_rssi":-65,
 "fw_ver":"1.0"}
```
All 6 output states, battery pack voltage/percent, mains voltage, WiFi status (connected + RSSI dBm), and firmware version are included.

**Field notes:**
- `smoke` — MQ2 percentage 0.0–100.0; `photo` — photoelectric sensor percentage
- `batt_v` — pack voltage in volts (float, 2dp); `batt_pct` — 0–100 (linear 22V–25V)
- `wifi_connected` — true if actively connected; `wifi_rssi` — dBm (e.g. -65), 0 when disconnected
- No `co` field — CO sensor was removed; MQ2 covers smoke and combustible gases

### Display → Master (output toggle — immediate, on each toggle change)
```json
{"t":"output","action":"power_fan","value":true}
{"t":"output","action":"tubelight","value":false}
{"t":"output","action":"door_lock","value":true}
{"t":"output","action":"smoke_sensor","value":true}
{"t":"output","action":"buzzer","value":false}
{"t":"output","action":"solenoid_valve","value":false}
{"t":"output","action":"exhaust_fan","value":true}
```
Sent immediately when a toggle is flipped on the Outputs screen — no Save required. Master drives the corresponding GPIO on receipt.

### Display → Master (technician actions)
```json
{"t":"maintenance_code","code":"482193"}
{"t":"silence_request"}
{"t":"test_alarm_request"}
```

### Display → Master (factory reset commands)
```json
{"t":"cmd","action":"reset_settings"}
{"t":"cmd","action":"reset_all"}
```
- `reset_settings` — resets runtime alarm thresholds to factory defaults; keeps NVS credentials (WiFi/MQTT/UDN). Master reboots.
- `reset_all` — clears **all NVS credentials** (WiFi, MQTT, UDN) AND resets runtime settings. Device enters config/BLE mode on reboot.

Both commands trigger `ESP.restart()` on master after applying changes.

### Master → Display (maintenance code response)
```json
{"t":"maintenance_code_result","accepted":true}
{"t":"maintenance_code_result","accepted":false}
```

When `accepted: true`, device enters maintenance mode. The technician app is notified via MQTT.

---

## BLE Provisioning (Device Setup via Mobile App)

Done once during installation by a technician using the mobile app.

### BLE Constants (master firmware)
| Item | Value |
|------|-------|
| Advertised device name | `"FireEx"` |
| Service UUID | `"ABCD"` (16-bit short) |
| Characteristic UUID | `"1234"` (16-bit short); READ + WRITE + NOTIFY |
| Manufacturer data | `[0xFF, 0xFF] + "<model_number>"` e.g. `FF FF 46 58 2D 53 44 2D 31 30 30` = "FX-SD-100" |
| Model number define | `BLE_MODEL_NUMBER "FX-SD-100"` |

### WiFi Boot Progress UART Frames (master → slave display)
During startup, master attempts WiFi connection and sends live progress frames so the display startup screen can show status:
```json
{"t":"wifi_status","state":"connecting","ssid":"MyNetwork"}
{"t":"wifi_status","state":"connected","ssid":"MyNetwork","rssi":-65}
{"t":"wifi_status","state":"failed","ssid":"MyNetwork"}
{"t":"wifi_status","state":"skipped"}
```
- `connecting` — WiFi.begin() called, polling has started (15s timeout, 30×500ms)
- `connected` — WiFi associated; `rssi` is the link quality in dBm
- `failed` — timed out after 15s; device continues offline
- `skipped` — no SSID stored (device still in config mode / not yet provisioned)

The slave parses these into `FireExModel::WifiBootState` (Waiting → Connecting → Connected/Failed/Skipped) and drives the startup progress bar through 3 phases.

### BLE Setup Trigger
- On boot: master reads NVS key `"udn"`. If empty → `g_config_mode = true` (BLE mode on demand)
- Display slave BLE screen → user taps **Start BLE Setup** → slave sends `{"t":"cmd","action":"ble_start"}` over UART → master calls `ble_setup()`
- If `"udn"` is present on boot → normal WiFi/MQTT mode; BLE setup can still be triggered from screen (re-provisioning warning shown)

### Provisioning Flow
1. Master advertises as `"FireEx"` + service UUID + manufacturer data (model number)
2. Phone scans → reads model number from manufacturer data → fetches product config from server
3. Phone connects → subscribes to notifications on characteristic `"1234"`
4. Phone writes `MODEL_NUMBER:` → device responds `MODEL_NUMBER:FireEx` (verify correct device)
5. Phone writes `CONFIG:{...json...}` → device parses, saves to NVS, responds `CONFIG:OK`
6. Phone writes `RESTART:` → device responds `RESTART:OK` → reboots into normal mode

### CONFIG Payload Format (phone → device)
```
CONFIG:{"udn":"FX00123","ssid":"WiFiName","pass":"WiFiPass","mqtt_host":"broker.fireex.in","mqtt_port":"1883","mqtt_topic":"FX00123","http_url":"https://api.fireex.in","show_serial":false}
```

| JSON key | Type | Max | Description |
|----------|------|-----|-------------|
| `udn` | string | 32 | Unique Device Number — assigned by server on device registration |
| `ssid` | string | 32 | Wi-Fi SSID |
| `pass` | string | 64 | Wi-Fi password |
| `mqtt_host` | string | 64 | MQTT broker hostname/IP |
| `mqtt_port` | string | 6 | MQTT broker port e.g. `"1883"` or `"8883"` |
| `mqtt_topic` | string | 64 | MQTT base topic (usually same as UDN) |
| `http_url` | string | 128 | Base URL for HTTP/HTTPS API calls |
| `show_serial` | bool | — | Enable serial debug output |

> **GSM APN is NOT provisioned via BLE.** The master will query the SIM800L over UART using AT commands (`AT+CGDCONT?`) to auto-detect the APN after WiFi connects.

### Other BLE Commands
| Command | Response | Effect |
|---------|----------|--------|
| `MODEL_NUMBER:` | `MODEL_NUMBER:FireEx` | Identity check |
| `RESTART:` | `RESTART:OK` | Reboots device |
| `RESET:` | `RESET:OK` | Clears all NVS credentials |

### Chunk Handling
The `onWrite` callback uses an **accumulation buffer** (`std::string accum`). For `CONFIG:` commands it waits until the closing `}` is received before processing — handles cases where the phone splits the write across multiple BLE packets. Phone should still negotiate MTU ≥ 250 bytes and send as a single write for best reliability.

### Slave NVS Namespaces (cleared on factory reset)
| Namespace | Contents |
|-----------|----------|
| `alarm` | Alarm threshold settings (smoke %, temp, etc.) |
| `power` | Power-related settings |
| `display` | Display/UI preferences |
| `session` | Session data including PIN (reset to default `1234`) |

On `reset_settings` or `reset_all`, the slave clears all four namespaces via `Preferences::clear()` before rebooting itself.

### NVS Layout (master, namespace `"fireex"`)
| Key | Type | Description |
|-----|------|-------------|
| `udn` | String | Primary identity; empty = unprovisioned |
| `ssid` | String | Wi-Fi SSID |
| `password` | String | Wi-Fi password |
| `mqtt_host` | String | MQTT broker domain |
| `mqtt_port` | String | MQTT port |
| `mqtt_topic` | String | MQTT base topic |
| `http_url` | String | HTTP/HTTPS API base URL |
| `show_serial` | Bool | Serial debug flag |

### BLE Progress UART Frames (master → slave display)
During provisioning, master sends live progress frames over UART so the display shows a progress bar:
```json
{"t":"ble_progress","pct":10,"step":"Advertising..."}
{"t":"ble_progress","pct":20,"step":"Phone connected"}
{"t":"ble_progress","pct":40,"step":"Saving credentials"}
{"t":"ble_progress","pct":80,"step":"Verifying"}
{"t":"ble_progress","pct":100,"step":"Done"}
{"t":"ble_status","state":"done","udn":"FX00123"}
{"t":"ble_status","state":"failed"}
```

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
- MQ2 requires ~20s warm-up after power-on before readings are stable; ignore early readings
- ADC readings on ESP32 are noisy — use averaging over 10 samples per reading cycle
- Use `ArduinoJson` library for all JSON serialization/deserialization
- Use `PubSubClient` or `AsyncMqttClient` — decision TBD (see `decisions/architecture-decisions.md`)
- Watchdog timeout: 30 seconds. All blocking operations must complete well within this.
