# Project: FireEx Hardware Display UI (`fireex-ui`)

## Overview

The display UI runs on a dedicated ESP32-S3 MCU inside the FireEx hardware unit. It drives a 5-inch 800×480 capacitive touch display using LVGL v8 over a 40-pin RGB parallel interface. The display shows live sensor data, device status, and active alerts — and provides a PIN-protected technician configuration screen.

**Status:** In progress — hardware bring-up complete, full screen set implemented
**Last updated:** 2026-10-06
**Repo:** `fireex-firmware` (PlatformIO project at `~/Documents/PlatformIO/Projects/fireex-firmware`, env: `slave`)
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
fireex-firmware/src/slave/
  main_slave.cpp             ← Setup + loop (hardware init, LVGL glue, GT911 touch)
  main_sim.cpp               ← SDL2 simulator entry point (env: simulator)
  ui.cpp / ui.h              ← build_ui() entry point
  hw.h                       ← hw_backlight_set() declaration
  master_link.h              ← send_command_to_master() declaration
  display_settings.h         ← save_rotation(), apply_rotation(), save_power_thresholds()
  ui/
    model.h / model.cpp      ← FireExModel g_model (live state mirrored from firmware MCU)
    screen_manager.h/.cpp    ← ScreenManager g_screen_mgr (create-on-enter / destroy-on-leave)
    session.h/.cpp           ← Session (auto-logout timer; PIN flow reserved for future use)
    theme.h/.cpp             ← LVGL theme / colour tokens
    screens/
      scr_startup.cpp/.h     ← Boot splash (auto-advances to Home)
      scr_home.cpp/.h        ← Main status screen
      scr_alarm.cpp/.h       ← Full-screen alarm overlay (Alert / Panic states)
      scr_pin.cpp/.h         ← PIN entry + lockout + first-run (kept, not wired to menu yet)
      scr_menu.cpp/.h        ← Menu tile grid (3 groups: USER / SAFETY / HARDWARE)
      scr_alarm_levels.cpp/.h    ← Alert/Panic threshold settings
      scr_device_logs.cpp/.h     ← Device event log (fetched from BE API in future)
      scr_exhaust_speed.cpp/.h   ← Exhaust fan speed setting
      scr_outputs.cpp/.h         ← Test mode: Auto/Manual toggle + 7 output on/off rows
      scr_sprinkler.cpp/.h       ← Sprinkler arm/fire/reset
      scr_unlock_knob.cpp/.h     ← Sprinkler unlock knob sequence UI
      scr_sensors.cpp/.h         ← Raw sensor readings + thresholds
      scr_power.cpp/.h           ← Battery / power status and thresholds
      scr_network.cpp/.h         ← Network overview (kept in codebase, not in menu)
      scr_wifi.cpp/.h            ← WiFi settings
      scr_gsm.cpp/.h             ← GSM settings
      scr_ble.cpp/.h             ← BLE settings
      scr_display.cpp/.h         ← Display/brightness settings
      scr_maintenance.cpp/.h     ← Read-only maintenance info + health check (no Save, Back button)
      scr_stepper.cpp/.h         ← Radar stepper motor position
      scr_factory_reset.cpp/.h   ← Factory reset (PIN-gated)
      scr_device_update.cpp/.h   ← OTA update check / available / up-to-date flow
      scr_about.cpp/.h           ← Device info (FW/UI versions, MAC, device ID)
      scr_placeholder.cpp/.h     ← Generic "Coming soon" for unbuilt tiles
    widgets/
      status_bar.cpp/.h      ← Top bar (WiFi%, GSM%, BLE dot, battery%, time)
      keypad.cpp/.h          ← Reusable numeric keypad widget
      onoff_toggle.cpp/.h    ← Labelled on/off toggle widget
      toast.cpp/.h           ← Transient toast notification widget
      value_stepper.cpp/.h   ← +/- stepper for numeric settings
```

**Removed screens (deleted from codebase):**
- `scr_test_mode` — replaced by Auto/Manual mode toggle in `scr_outputs` (now called "Test mode" in menu)
- `scr_fan_control` — fan Auto/Manual is now part of `scr_outputs`
- `scr_change_pin` — PIN change removed; PIN screen kept for future use
- `scr_alarm_log` — renamed to `scr_device_logs` (data will come from BE API)

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
- Bottom-right "Menu" button → `scr_menu` (direct, no PIN gate currently)
- `g_model.link_ok()` drives a "no link" indicator (Milestone 1: always true)

---

### Alarm Screen (`scr_alarm`) — ✅ Built
Full-screen overlay, appears whenever `g_model.alarm_level` is `Alert` or `Panic`.
- `ScreenManager::on_alarm_level_changed()` forces navigation to/from this screen regardless of what is currently open (closes technician menus, drops unsaved changes).
- Background color and pulsing reflect severity (Alert = amber, Panic = red).
- "Silence" button → sends `silence_request` via UART to firmware.
- Returns to Home automatically when alarm clears back to Normal.

---

### PIN Entry (`scr_pin`) — ✅ Built (reserved for future use)
Three sub-states: Enter PIN, Lockout (after 3 fails), First Run.
- Menu is currently accessible directly without PIN (new requirement).
- `scr_pin` is kept in the codebase; `navigate_to_pin(on_success_cb)` is still used by sprinkler reset and factory reset to PIN-gate those specific actions.

---

### Menu (`scr_menu`) — ✅ Built
Tile grid; accessible directly from the Home screen (no PIN required). Auto-exits on inactivity (session timer). Three groups, scrollable:

**USER** (2 rows of 4):

| Tile | Screen |
|------|--------|
| Device logs | `scr_device_logs` |
| Maintenance | `scr_maintenance` |
| Wi-Fi | `scr_wifi` |
| GSM + numbers | `scr_gsm` |
| Display | `scr_display` |
| About | `scr_about` |
| BLE setup | `scr_ble` |
| Device Update | `scr_device_update` |

**SAFETY** (1 row of 4):

| Tile | Screen |
|------|--------|
| Alarm levels | `scr_alarm_levels` |
| Exhaust speed | `scr_exhaust_speed` |
| Sprinkler | `scr_sprinkler` |
| Test mode | `scr_outputs` |

**HARDWARE** (1 row of 5):

| Tile | Screen |
|------|--------|
| Sensors | `scr_sensors` |
| Stepper | `scr_stepper` |
| Unlock knob | `scr_unlock_knob` |
| Power | `scr_power` |
| Factory reset | `scr_factory_reset` |

---

### Alarm Levels (`scr_alarm_levels`) — ✅ Built
Edit `alert_level_pct`, `panic_level_pct`, `clear_delay_s`. Uses `value_stepper` widget.

### Exhaust Speed (`scr_exhaust_speed`) — ✅ Built
Set `alert_fan_pct`, `panic_fan_mains_pct`, `panic_fan_batt_pct`.

### Test Mode (`scr_outputs`) — ✅ Built
Reached via the "Test mode" tile in SAFETY. Two sections:
- **Auto / Manual mode toggle** at the top (same pattern as former fan control) — saves to `g_model.mode` (Auto / Manual).
- **7 output on/off rows** below: Tube light, Door lock, Power fan, Smoke sensor, Buzzer, Exhaust fan, Solenoid valve. Each toggle sends an immediate UART command to master; Save commits final states to `g_model`.

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
Read-only info screen for the user. No Save button. Back button returns to Menu.
- **Data source:** All maintenance data (service dates, health check statuses) comes from the backend API. The screen checks `g_model.maintenance_ready`; while `false` it shows a spinner + "Fetching data..." overlay. Once the API response is parsed and `maintenance_ready` is set to `true`, the screen must be re-opened to display the content (screen lifecycle: create-on-enter).
- **Service dates card**: Last service date, Next due date, days remaining (`g_model.next_service_days`).
- **Health check rows**: status indicator (green/amber dot) for Smoke sensor, Temp+humidity, Human radar, Door lock, Battery.
- Interval setting and "Mark service done" button removed — service tracking is handled via the backend.

### Stepper (`scr_stepper`) — ✅ Built
Shows current radar stepper position (A/B/C/D). Allows manual override for diagnostics.

### Device Logs (`scr_device_logs`) — ✅ Built
Paginated table of device events (alarm, power, output changes, mode changes, online/offline). Columns: When, Event, Peak smoke%, Person, Power source.
- **Data source:** Fetched from `GET /api/devices/:id/logs`. The screen checks `g_model.logs_ready`; while `false` it shows a spinner + "Fetching data..." overlay inside the table container. Once logs are parsed into the model and `logs_ready` is set to `true`, the screen re-renders with data on next open.
- Currently shows mock data in the simulator (`logs_ready = false` by default, `true` must be set explicitly to show data).

### Factory Reset (`scr_factory_reset`) — ✅ Built
PIN-gated via `navigate_to_pin()`. Clears NVS config and reboots. Located in the **HARDWARE** group on the menu.

### Device Update (`scr_device_update`) — ✅ Built
Located in the **USER** group. Checks for OTA firmware updates. Three UI states driven by `g_model.update_state` (`FireExModel::UpdateState` enum):

| State | Display |
|-------|---------|
| `Checking` | LVGL arc spinner + "Checking for updates..." label |
| `UpToDate` | Green `LV_SYMBOL_OK` icon + "Device is up to date" + current version (`g_model.master_fw_version`) |
| `UpdateAvailable` | "Update Available" heading + side-by-side version boxes (Current vX.X → New vX.X) + **Update** (accent) and **Cancel** buttons |

**Model fields:**
- `g_model.update_state` — `FireExModel::UpdateState::Checking / UpToDate / UpdateAvailable`
- `g_model.update_latest_version[16]` — version string set when update is available (e.g. `"1.1"`)

In the simulator, a one-shot `lv_timer` fires after 3 s, sets `update_state = UpdateAvailable` and `update_latest_version = "1.1"`, then refreshes the screen if it is open. Real integration will parse an API response and set the same fields.

### About (`scr_about`) — ✅ Built
- **Display version:** `g_model.display_fw_version` (stored in slave, currently `"1.0"`)
- **Controller version:** `g_model.master_fw_version` (received from master MCU via UART `"fw_ver"` field)
- Developed by: FireEx R&D Team
- Contact: +91 8698800448
- Website: www.globtouch.com
- Copyright @ 2026

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
