# Project: FireEx Hardware Display UI (`fireex-ui`)

## Overview

The display UI runs on a dedicated ESP32-S3 MCU inside the FireEx hardware unit. It drives a 5-inch 800×480 capacitive touch display using LVGL v8 over a 40-pin RGB parallel interface. The display shows live sensor data, device status, and active alerts — and provides a PIN-protected technician configuration screen.

**Status:** Not started (as of 2024-10-04)
**Repo:** TBD
**Platform:** ESP32-S3
**Framework:** Arduino + PlatformIO
**Language:** C (with minimal C++)
**Display library:** LVGL v8.x

---

## Hardware Configuration

| Component | Details |
|-----------|---------|
| MCU | ESP32-S3-WROOM-1 N16R8 (Xtensa LX7 dual-core, 240MHz, built-in USB) |
| Flash | 16MB (N16 variant) |
| PSRAM | 8MB (R8 variant) |
| Display | SmartElex 5" 800×480, capacitive touch, **40-pin RGB header** (NOT FPC connector) |
| Touch | Capacitive touch controller over I2C (confirmed; exact IC TBD — likely GT911) |
| Display interface | RGB parallel, 40-pin header directly on PCB |
| LVGL frame buffer | PSRAM-backed double buffer (8MB PSRAM provides ample space for 800×480×2 buffers) |
| Communication | UART to firmware ESP32 (Serial1 at 115200 baud) |

> **Important:** This display uses a **40-pin RGB parallel header** soldered directly to the PCB, not an FPC ribbon connector. Do not reference FPC in firmware or hardware docs.

### Pin Assignments (TBD — finalize with hardware schematic)
- RGB pins: 16 data bits (R[4:0], G[5:0], B[4:0]) + HSYNC, VSYNC, PCLK, DE — via 40-pin header
- Touch I2C: SDA, SCL (confirmed I2C, touch IC to be verified as GT911)
- UART to firmware: TX (GPIO17), RX (GPIO18)

---

## Project Structure (PlatformIO)

```
fireex-ui/
  platformio.ini
  src/
    main.cpp                  ← Setup + loop
    config.h                  ← Display constants (width, height, etc.)
    hal/
      display_driver.c/.h     ← Low-level RGB LCD driver
      touch_driver.c/.h       ← Touch controller driver (FT5x06/GT911)
    lvgl_port/
      lvgl_init.c/.h          ← LVGL init, tick, flush callback
    screens/
      screen_main.c/.h        ← Main status screen
      screen_alert.c/.h       ← Alert banner / full-screen alert
      screen_technician.c/.h  ← PIN entry + technician menu
      screen_settings.c/.h    ← Device settings (read-only display)
    widgets/
      sensor_gauge.c/.h       ← Reusable gauge widget
      status_bar.c/.h         ← Top status bar (WiFi, time, battery)
    comms/
      uart_receiver.c/.h      ← Receive state updates from firmware MCU
      uart_sender.c/.h        ← Send technician actions to firmware MCU
    storage/
      nvs_pin.c/.h            ← Store technician PIN in NVS
  assets/
    fonts/                    ← LVGL font files (.c)
    images/                   ← LVGL image files (.c)
  lv_conf.h                   ← LVGL configuration
```

---

## Screen Descriptions

### Main Status Screen (`screen_main`)

The default screen, always visible during normal operation.

**Layout (800×480):**
```
┌──────────────────────────────────────────────┐
│  [WiFi icon] [Time: 14:32]       [Battery: 95%] │  ← Status bar (40px)
├──────────────────────────────────────────────┤
│  DEVICE: FX-0042   ROOM: Server Room 3B       │  ← Device info (50px)
├──────────────────────────────────────────────┤
│                                              │
│  🔴 SMOKE    🟢 CO      🟡 TEMP    🟢 HUM    │  ← Sensor status icons
│   0.12        8.4 ppm   23.5°C    52%RH     │  ← Values
│  ▓░░░░░░░  ▓░░░░░░░   ▓░░░░░░░  ▓░░░░░░░  │  ← Progress bars
│                                              │
│  STATUS: ● ONLINE                            │
│  Last sync: 14:31:58                         │
│                                              │
│                        [⚙ TECH ACCESS]       │  ← Bottom right button
└──────────────────────────────────────────────┘
```

- Sensor values update in real-time from UART state messages
- Sensor icon color: green (normal), yellow (approaching threshold), red (exceeded)
- Status indicator: green dot (online), red dot (alarm), grey dot (offline)
- Bottom-right button opens PIN entry screen

---

### Alert Screen (`screen_alert`)

Shown as an overlay when an alarm is active. Replaces the main screen with a full-screen red alert.

**Layout:**
```
┌──────────────────────────────────────────────┐
│              ⚠ FIRE ALARM ⚠                  │  ← Flashing red background
│                                              │
│          SMOKE DETECTED                      │
│                                              │
│       Level: 0.87  (threshold: 0.50)         │
│                                              │
│       Location: Server Room 3B               │
│       Time: 14:32:15                         │
│                                              │
│    [🔇 SILENCE LOCAL ALARM]                  │  ← Button (does not resolve)
│                                              │
│    Backend notified. Help is on the way.     │
└──────────────────────────────────────────────┘
```

- Background pulses red
- Buzzer control: "Silence Local Alarm" button sends `silence_request` to firmware MCU via UART
- Screen returns to main screen when alarm is resolved (firmware sends `alarm: false` in state update)

---

### Technician Access: PIN Entry Screen (`screen_technician`)

Accessed via the "Tech Access" button on the main screen.

**PIN Entry Layout:**
```
┌──────────────────────────────────────────────┐
│              TECHNICIAN ACCESS               │
│                                              │
│         Enter 6-digit PIN:                   │
│                                              │
│              [_ _ _ _ _ _]                   │
│                                              │
│   [1][2][3]                                  │
│   [4][5][6]                                  │
│   [7][8][9]                                  │
│   [←][0][✓]                                  │
│                                              │
│         [CANCEL]                             │
└──────────────────────────────────────────────┘
```

- 3 failed PIN attempts → 5-minute lockout (stored in RAM, resets on reboot)
- Default PIN: `000000` (changed on first technician login — TBD whether this is done here or via backend)
- Correct PIN → navigate to Technician Menu Screen

---

### Technician Menu Screen

Available only after correct PIN entry.

```
┌──────────────────────────────────────────────┐
│  TECHNICIAN MENU          [← EXIT]           │
│                                              │
│  [TEST ALARM]         [SILENCE ALARM]        │
│                                              │
│  [VIEW SENSOR DETAILS]                       │
│                                              │
│  [DEVICE INFO]                               │
│   FW: 1.2.3  UI: 1.0.1                      │
│   Device ID: FX-0042                         │
│   MAC: AA:BB:CC:DD:EE:FF                     │
│                                              │
│  [CHANGE PIN]                                │
│                                              │
│  Auto-exit in: 5:00                          │  ← Countdown timer
└──────────────────────────────────────────────┘
```

- Auto-exit after 5 minutes of inactivity (returns to main screen, PIN required again)
- "Test Alarm" sends `test_alarm_request` to firmware MCU via UART
- "Silence Alarm" sends `silence_request` to firmware MCU

---

### Sensor Details Screen

Accessible from Technician Menu. Shows raw sensor readings and allows threshold review.

```
┌──────────────────────────────────────────────┐
│  SENSOR DETAILS              [← BACK]        │
│                                              │
│  Smoke Level:    0.12   Threshold: 0.50      │
│  CO (PPM):        8.4   Threshold: 50.0      │
│  Temperature:   23.5°C  Threshold: 60.0°C   │
│  Humidity:      52.0%   Threshold: 80.0%    │
│                                              │
│  WiFi RSSI:    -65 dBm                       │
│  Uptime:       2d 4h 12m                     │
│  MQTT:         Connected                     │
│  Last sync:    14:31:58                      │
└──────────────────────────────────────────────┘
```

---

## LVGL Configuration (`lv_conf.h`)

Key settings:
```c
#define LV_COLOR_DEPTH 16           // RGB565
#define LV_HOR_RES_MAX 800
#define LV_VER_RES_MAX 480
#define LV_USE_PERF_MONITOR 0       // disable in production
#define LV_FONT_DEFAULT &lv_font_montserrat_16
#define LV_USE_ANIMATION 1
#define LV_MEM_SIZE (512 * 1024)    // 512KB LVGL heap (from PSRAM)
```

---

## LVGL Display Flush (RGB Panel)

The ESP32-S3 has a built-in RGB LCD peripheral. The flush callback writes the LVGL buffer directly to the LCD frame buffer in PSRAM. Uses DMA for non-blocking refresh.

```c
void lvgl_flush_cb(lv_disp_drv_t *drv, const lv_area_t *area, lv_color_t *color_p) {
    // Write to PSRAM-backed framebuffer at (area->x1, area->y1)
    // Signal LVGL flush complete immediately (DMA handles the rest)
    lv_disp_flush_ready(drv);
}
```

---

## UART Communication with Firmware MCU

See `projects/hardware-firmware.md` for full protocol. Summary:

**Receive (from firmware, every 1 second):**
```json
{"t":"state","smoke":0.12,"co":8.4,"temp":23.5,"hum":52.0,"status":"online","alarm":false}
```

Parse and update LVGL label values and gauge values directly from `uart_receiver.c`.

**Send (to firmware, on user action):**
```json
{"t":"silence_request"}
{"t":"test_alarm_request"}
{"t":"pin_ok","pin":"123456"}
```

---

## Key Implementation Notes

- LVGL tick must be called every 1ms — use `esp_timer_create` with a 1ms periodic ISR
- All LVGL UI updates must happen from the main task (not from UART receive ISR) — use a queue to pass parsed state from UART ISR to main task
- Sensor gauge colors: green (< 50% of threshold), yellow (50–80% of threshold), red (> 80% of threshold)
- Font choice: Montserrat (bundled with LVGL) — generate only needed glyphs to save flash
- Screen brightness: fixed at 80% via PWM on backlight pin (configurable TBD)
- Touch calibration: run once on first boot, store calibration matrix in NVS
