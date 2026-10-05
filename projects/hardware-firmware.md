# Project: FireEx Hardware Firmware (`fireex-firmware`)

## Overview

The firmware running on the ESP32 MCU inside each FireEx hardware unit. Responsible for reading sensors, controlling actuators, communicating with the backend via MQTT, and operating safely in isolation when the network is unavailable.

**Status:** In progress (as of 2026-10-04)
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
{"t":"state","seq":1,"smoke":0.0,"temp":25.0,"hum":50.0,"alarm":false,
 "tubelight":false,"door_lock":true,"power_fan":false,
 "smoke_sensor":true,"buzzer":false,"solenoid":false}
```
All 6 output states are included so the display can reflect live hardware state.

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

### Master → Display (maintenance code response)
```json
{"t":"maintenance_code_result","accepted":true}
{"t":"maintenance_code_result","accepted":false}
```

When `accepted: true`, device enters maintenance mode. The technician app is notified via MQTT.

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
- MQ2 requires ~20s warm-up after power-on before readings are stable; ignore early readings
- ADC readings on ESP32 are noisy — use averaging over 10 samples per reading cycle
- Use `ArduinoJson` library for all JSON serialization/deserialization
- Use `PubSubClient` or `AsyncMqttClient` — decision TBD (see `decisions/architecture-decisions.md`)
- Watchdog timeout: 30 seconds. All blocking operations must complete well within this.
