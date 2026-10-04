# Project: FireEx Hardware Display UI (`fireex-ui`)

## Overview

The display UI runs on a dedicated ESP32-S3 MCU inside the FireEx hardware unit. It drives a 5-inch 800×480 capacitive touch display using LVGL v8 over a 40-pin RGB parallel interface. The display shows live sensor data, device status, and active alerts — and provides a PIN-protected technician configuration screen.

**Status:** In progress — hardware bring-up complete, full screen set implemented
**Last updated:** 2026-10-04
**Repo:** `5inchTFT` (PlatformIO project at `~/Documents/PlatformIO/Projects/5inchTFT`)
**Platform:** ESP32-S3
**Framework:** Arduino + PlatformIO
**Language:** C++ (primary), C (HAL layer)
**Display library:** LVGL v8.x

---

## Hardware Configuration

| Component | Details |
|-----------|---------|
| MCU | ESP32-S3-WROOM-1 N16R8 (Xtensa LX7 dual-core, 240MHz, built-in USB) |
| Flash | 16MB (N16 variant) |
| PSRAM | 8MB (R8 variant) |
| Display | SmartElex 5" 800×480, capacitive touch, **40-pin RGB header** (NOT FPC connector) |
| Touch | **GT911** capacitive touch controller over I2C — confirmed, bring-up complete |
| Display interface | RGB parallel, 40-pin header directly on PCB |
| LVGL frame buffer | Two partial draw buffers (48 lines × 800px each) in internal SRAM (DMA-capable); RGB panel framebuffer lives in PSRAM, driven by ESP32-S3 RGB LCD peripheral |
| Communication | UART to firmware ESP32 (GPIO4=TX, GPIO5=RX, 115200 baud) — pin-mapped, protocol not yet wired |

> **Important:** This display uses a **40-pin RGB parallel header** soldered directly to the PCB, not an FPC ribbon connector. Do not reference FPC in firmware or hardware docs.

> **Hardware mod — DISP pin:** DISP was originally hardwired HIGH via pull-up (no GPIO control). The ST7265 datasheet requires DISP LOW through reset and only HIGH after RGB timing is running. Pull-up was lifted and bodge-wired to **GPIO6**. Code sequences DISP low → start panel → push first LVGL frame → DISP high → 120ms stabilization → backlight on.

> **Backlight polarity:** Active-LOW (inverting stage ahead of boost converter). GPIO40, LEDC channel 0. 100% brightness = duty 0.

### Confirmed Pin Assignments
| Signal | GPIO |
|--------|------|
| B3–B7 | 3, 20, 19, 8, 18 |
| G2–G7 | 39, 38, 11, 12, 9, 10 |
| R3–R7 | 13, 14, 21, 47, 48 |
| PCLK | 17 |
| VSYNC | 15 |
| HSYNC | 16 |
| DE | 7 |
| DISP | 6 (bodge-wired) |
| Backlight | 40 (active-LOW) |
| Status LED | 46 |
| Touch SDA | 2 |
| Touch SCL | 42 |
| Touch INT | 1 |
| Touch RST | 41 |
| UART TX (to firmware) | 4 |
| UART RX (from firmware) | 5 |

GT911 I2C address: **0x5D** (latched by holding INT low during reset sequence).

---

## Project Structure (PlatformIO) — Actual

> **Note:** The original planned structure has been superseded by the actual implementation below.

```
5inchTFT/
  platformio.ini
  src/
    main_esp32.cpp            ← Setup + loop (hardware init, LVGL glue, GT911 touch)
    ui.cpp / ui.h             ← build_ui() entry point
    hw.h                      ← hw_backlight_set() declaration
    ui/
      model.h / model.cpp     ← FireExModel g_model (live state mirrored from firmware MCU)
      screen_manager.h/.cpp   ← ScreenManager g_screen_mgr (create-on-enter / destroy-on-leave)
      session.h/.cpp          ← Technician session (PIN auth, auto-logout timer)
      theme.h/.cpp            ← LVGL theme / colour tokens
      screens/
        scr_startup.cpp/.h    ← Boot splash (auto-advances to Home)
        scr_home.cpp/.h       ← Main status screen
        scr_alarm.cpp/.h      ← Full-screen alarm overlay (Alert / Panic states)
        scr_pin.cpp/.h        ← PIN entry + lockout + first-run sub-states
        scr_menu.cpp/.h       ← Technician menu (tile grid)
        scr_alarm_levels.cpp/.h   ← Alert/Panic threshold settings
        scr_alarm_log.cpp/.h      ← Recent alarm history
        scr_exhaust_speed.cpp/.h  ← Exhaust fan speed setting
        scr_fan_control.cpp/.h    ← Manual fan control
        scr_outputs.cpp/.h        ← Output states (tubelight, buzzer, exhaust, sprinkler)
        scr_sprinkler.cpp/.h      ← Sprinkler arm/fire/reset
        scr_unlock_knob.cpp/.h    ← Sprinkler unlock knob sequence UI
        scr_sensors.cpp/.h        ← Raw sensor readings + thresholds
        scr_battery.cpp/.h        ← Battery status
        scr_network.cpp/.h        ← Network overview (WiFi/GSM/BLE)
        scr_wifi.cpp/.h           ← WiFi settings
        scr_gsm.cpp/.h            ← GSM settings
        scr_ble.cpp/.h            ← BLE settings
        scr_display.cpp/.h        ← Display/brightness settings
        scr_maintenance.cpp/.h    ← Maintenance mode (enter code, send to firmware)
        scr_stepper.cpp/.h        ← Radar stepper motor position
        scr_test_mode.cpp/.h      ← Test alarm
        scr_change_pin.cpp/.h     ← Change technician PIN
        scr_factory_reset.cpp/.h  ← Factory reset (PIN-gated)
        scr_about.cpp/.h          ← Device info (FW/UI versions, MAC, device ID)
        scr_placeholder.cpp/.h    ← Generic "Coming soon" for unbuilt screens
      widgets/
        status_bar.cpp/.h     ← Top bar (WiFi%, GSM%, BLE dot, battery%, time)
        keypad.cpp/.h         ← Reusable numeric keypad widget (used by PIN + maintenance screens)
        onoff_toggle.cpp/.h   ← Labelled on/off toggle widget
        toast.cpp/.h          ← Transient toast notification widget
        value_stepper.cpp/.h  ← +/- stepper for numeric settings
  lv_conf.h                   ← LVGL configuration
```

---

## Screen Descriptions

> All screens below are **implemented** (files exist in `src/ui/screens/`). Screen navigation uses `ScreenManager::navigate_to(ScreenId)` with create-on-enter / destroy-on-leave lifecycle.

### Startup (`scr_startup`) — ✅ Built
Boot splash. Auto-advances to Home after a fixed duration. Never navigable to directly via `navigate_to()`.

---

### Home / Main Status Screen (`scr_home`) — ✅ Built
Default screen during normal operation.
- Status bar widget across the top: WiFi %, GSM %, BLE dot, battery %, time
- Sensor tiles: Smoke %, Temp °C, Humidity %RH, Radar presence indicator
- Alarm level badge driven from `g_model.alarm_level`
- Bottom-right "TECH ACCESS" button → `scr_pin`
- `g_model.link_ok()` drives a "no link" indicator (Milestone 1: always true)

---

### Alarm Screen (`scr_alarm`) — ✅ Built
Full-screen overlay, appears whenever `g_model.alarm_level` is `Alert` or `Panic`.
- `ScreenManager::on_alarm_level_changed()` forces navigation to/from this screen regardless of what is currently open (closes technician menus, drops unsaved changes).
- Background color and pulsing reflect severity (Alert = amber, Panic = red).
- "Silence" button → sends `silence_request` via UART to firmware.
- Returns to Home automatically when alarm clears back to Normal.

---

### PIN Entry (`scr_pin`) — ✅ Built
Three sub-states managed within the screen (no navigate_to() for sub-states):
- **Enter PIN** — 6-digit keypad entry
- **Lockout** — shown after 3 failed attempts; 5-minute cooldown (RAM, resets on reboot)
- **First Run** — prompts new PIN on first boot (default PIN `000000`)

`navigate_to_pin(on_success_cb)` variant used by sprinkler reset and factory reset to PIN-gate individual actions without routing through the Menu.

---

### Technician Menu (`scr_menu`) — ✅ Built
Tile grid; available only after successful PIN. Auto-exits on inactivity (session timer in `ui/session.cpp`). Tiles navigate to:

| Tile | Screen |
|------|--------|
| Alarm Levels | `scr_alarm_levels` |
| Fan Control | `scr_fan_control` |
| Exhaust Speed | `scr_exhaust_speed` |
| Outputs | `scr_outputs` |
| Sprinkler | `scr_sprinkler` |
| Sensors | `scr_sensors` |
| Battery | `scr_battery` |
| Network | `scr_network` |
| Display | `scr_display` |
| Maintenance | `scr_maintenance` |
| Stepper | `scr_stepper` |
| Test Mode | `scr_test_mode` |
| Alarm Log | `scr_alarm_log` |
| Change PIN | `scr_change_pin` |
| Factory Reset | `scr_factory_reset` |
| About | `scr_about` |
| Unbuilt tiles | `scr_placeholder` |

---

### Alarm Levels (`scr_alarm_levels`) — ✅ Built
Edit `alert_level_pct`, `panic_level_pct`, `clear_delay_s`. Uses `value_stepper` widget.

### Exhaust Speed (`scr_exhaust_speed`) — ✅ Built
Set `alert_fan_pct`, `panic_fan_mains_pct`, `panic_fan_batt_pct`.

### Outputs (`scr_outputs`) — ✅ Built
Toggle `tubelight_on`, `buzzer_output_on`, `exhaust_output_on`, `sprinkler_armed`. Uses `onoff_toggle` widget.

### Sprinkler (`scr_sprinkler`) — ✅ Built
Arm/fire/reset controls. Sprinkler reset is PIN-gated via `navigate_to_pin()`. Shows `sprinkler_fired` state.

### Unlock Knob (`scr_unlock_knob`) — ✅ Built
Step-by-step UI guide for the physical unlock knob sequence before sprinkler can fire.

### Sensors (`scr_sensors`) — ✅ Built
Raw sensor values: smoke %, temp °C, humidity %RH, radar position, `sensor_raw_temp_c`. Thresholds from `g_model.settings`.

### Battery (`scr_battery`) — ✅ Built
`battery_pct_f`, `battery_voltage`, `on_mains`, `battery_charging`, `low_battery_pct` setting.

### Network (`scr_network`) — ✅ Built
Overview: WiFi %, GSM %, BLE connected. Sub-screens: `scr_wifi`, `scr_gsm`, `scr_ble`.

### WiFi (`scr_wifi`) / GSM (`scr_gsm`) / BLE (`scr_ble`) — ✅ Built
Per-radio status and on/off toggle (`wifi_on`, `gsm_on`, `ble_on`).

### Display (`scr_display`) — ✅ Built
`brightness_pct` (via `hw_backlight_set()`), `dim_after_s`, `screen_off_min`.

### Maintenance (`scr_maintenance`) — ✅ Built
Technician enters a 6-digit maintenance code via the `keypad` widget.
- Sends `{"t":"maintenance_code","code":"XXXXXX"}` to firmware via UART.
- Firmware replies `{"t":"maintenance_code_result","accepted":true/false}`.
- On accepted: device enters maintenance mode; backend notified via MQTT; mobile app TicketDetailScreen transitions to "Confirmed".

### Stepper (`scr_stepper`) — ✅ Built
Shows current radar stepper position (A/B/C/D). Allows manual override for diagnostics.

### Test Mode (`scr_test_mode`) — ✅ Built
Sends `test_alarm_request` to firmware. Shows buzzer/LED response.

### Alarm Log (`scr_alarm_log`) — ✅ Built
Scrollable list of recent alarm events (data from `g_model`).

### Change PIN (`scr_change_pin`) — ✅ Built
Old PIN → new PIN → confirm. Stores in NVS.

### Factory Reset (`scr_factory_reset`) — ✅ Built
PIN-gated via `navigate_to_pin()`. Clears NVS config and reboots.

### About (`scr_about`) — ✅ Built
FW version, UI version, device code, MAC address, uptime, service due info.

### Placeholder (`scr_placeholder`) — ✅ Built
Generic "Coming soon" screen for any tile not yet wired to a real screen. Called via `navigate_to_placeholder(title)`.

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

## LVGL Display Flush (RGB Panel) — Actual Implementation

Uses `esp_lcd_panel_draw_bitmap()` with `disp_drv.full_refresh = 1`. Two draw buffers (48 lines × 800 px each) allocated with `MALLOC_CAP_DMA | MALLOC_CAP_INTERNAL`. The RGB panel's own full framebuffer lives in PSRAM (managed by the ESP-IDF RGB LCD peripheral, not by LVGL).

```cpp
static void lvgl_flush_cb(lv_disp_drv_t *drv, const lv_area_t *area, lv_color_t *color_p) {
    esp_lcd_panel_draw_bitmap(panel_handle, area->x1, area->y1, area->x2 + 1, area->y2 + 1, color_p);
    lv_disp_flush_ready(drv);
}
```

LVGL tick: `lv_timer_handler()` called every 5ms in `loop()`. No separate 1ms ISR in current implementation.

---

## UART Communication with Firmware MCU

**Status (Milestone 1):** GPIO pins reserved (TX=GPIO4, RX=GPIO5) but UART protocol not wired yet. `g_model` uses hardcoded defaults. See `projects/hardware-firmware.md` for the full protocol.

**Planned receive (from firmware, every 1 second):**
```json
{"t":"state","smoke":0.12,"temp":23.5,"hum":52.0,"status":"online","alarm":false,"fan_pct":0}
```

**Planned send (from UI to firmware, on user action):**
```json
{"t":"silence_request"}
{"t":"test_alarm_request"}
{"t":"maintenance_code","code":"482193"}
```

**Planned receive response (firmware → UI):**
```json
{"t":"maintenance_code_result","accepted":true}
```

Note: `co` field removed from state updates — CO sensor not present in hardware (MQ2 covers smoke only). See `data-models/devices.md`.

---

## Key Implementation Notes — Actual

- **Loop timing:** `lv_timer_handler()` + 5ms `delay()` in Arduino `loop()`. Simple; revisit if UI responsiveness needs improvement.
- **Screen lifecycle:** create-on-enter, destroy-on-leave. Only one screen's widgets live at a time.
- **Model updates:** All `g_model` field updates happen in the main loop task before calling `lv_timer_handler()`. Once UART is wired, parsed frames will update `g_model` fields in the main task (not from ISR).
- **Screen brightness:** Configurable via `g_model.settings.brightness_pct` → `hw_backlight_set()`. Default 80%. LEDC channel 0, active-LOW on GPIO40.
- **Alarm pre-emption:** `ScreenManager::on_alarm_level_changed()` immediately navigates to/from `scr_alarm`, overriding any open screen.
- **PIN storage:** NVS, via `scr_change_pin` and `scr_factory_reset` flows.
- **Technician session auto-exit:** Session timer in `ui/session.cpp` navigates back to Home on inactivity.
