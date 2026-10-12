# Project: FireEx Mobile App (`fireex-mobile`)

## Overview

A single React Native app for two user types: **facility users** (building occupants/managers) and **service technicians**. The role is determined post-authentication — the backend detects role from the registered phone number and returns it in the JWT. Same binary, UI adapts automatically.

**Status:** Dashboard + full maintenance ticket flow implemented (as of 2026-10-12)
**Design:** Completed — [UX Canvas](https://claude.ai/artifact/TFP8dCVRFBC61pEdJvKGW6) — contains all screens; read artboard `.dc.html` before building any screen
**Repo:** `~/Documents/Software_projects/fireex-mobile`
**Platform:** iOS + Android (+ web via Expo, for faster iteration)

---

## Current Implementation Status

### ✅ Completed

**Authentication & JWT:**
- Login with phone + OTP
- JWT token contains user data and organizations array
- Token refresh with refresh token
- Automatic bearer token in API calls
- Multi-organization support with `organizations: [{ _id, name }]` array

**Dashboard Screen:**
- Organization selector dropdown (shows org names only)
- Address display with pin icon
- Device fetching via `/api/devices?orgId={orgId}`
- Device grouping by room (floor + room name)
- Status calculation (worst device status per room)
- Status animations (emergency ring pulse, overdue opacity pulse)
- Real-time search across rooms and devices
- Status pills with counts (emergency, overdue, issue, armed, offline)
- Room cards with device count and status badge
- Bottom tab bar (Home active, Chat, Settings placeholders)
- Loading states and error handling

**Components Built:**
- DashboardHeader (org selector + notifications/profile)
- OrganizationSelector (multi-org dropdown)
- BuildingSelector (address display)
- StatusPill & StatusBadge (status indicators)
- RoomCard (room list items)
- SearchBar (real-time search)
- BottomTabBar (navigation)
- StatusDot (animated status indicators)

**Maintenance Ticket Flow (serviceBoy role):**
- `/maintenance-tickets` — ticket list with status tabs (All/Open/In Progress/Closed/Other) + search
- `/ticket-detail` — full ticket detail with linked device card, smart actions by status
- `/ticket-in-progress` — interactive checklist, comments, resolve/close actions
- Real API: `GET /api/tickets/assigned` and `GET /api/tickets/:ticketId`
- `StatusPulse` component with animated critical/in_progress states
- `serviceBoy` role routes here after login (not dashboard)

### 🔄 In Progress / Next Steps

- [ ] BLE Device Provisioning screen (see BLE section below)
- [ ] RoomDevicesScreen - tap room to see devices
- [ ] DeviceDetailScreen - sensor readings and controls
- [ ] ChatScreen & SettingsScreen
- [ ] Device control endpoints (fan, buzzer, arm)
- [ ] WebSocket for live telemetry
- [ ] Emergency alert screen
- [ ] Offline support with caching
- [ ] Profile screen (linked from both dashboard and ticket list headers)

---

## Design System

### Colors
| Token | Hex | Usage |
|-------|-----|-------|
| Primary accent | `#C2410C` | Buttons, active icons, links, toggles on |
| Background | `#F6F6F4` | App background |
| Surface | `#FFFFFF` | Cards, inputs |
| Border | `#E6E6E3` | Card borders, input borders |
| Text primary | `#1C1A17` | Body text |
| Text secondary | `#6E6E68` | Subtitles, metadata |
| Text muted | `#8A8A85` | Captions, placeholders |
| Emergency red | `#B3261E` / `#C62828` | Emergency screen bg / status badges only |
| Armed green | `#1E7A34` | Armed status only |
| Issue yellow bg | `#FEF3C7` | Issue status badge bg |
| Issue yellow text | `#92400E` | Issue status text |
| Overdue orange bg | `#FBE7DC` | Overdue badge bg |
| Overdue orange text | `#C2410C` | Overdue badge text |

### Typography
- **Headings / brand:** Manrope, weight 800 (screen titles, device names, ticket numbers)
- **Body / UI:** Public Sans, weight 400/500/600/700
- Screen titles: Manrope 800, 22px
- Card titles: 15–16px, weight 700
- Labels/badges: 11.5–12.5px, weight 700
- Body text: 13.5–14.5px, weight 400–600

---

## Device / Ticket Status System (5 States)

Used consistently across Dashboard rooms, Room Devices list, Device Detail, Maintenance tickets, and all badge components.

| State | Badge bg | Dot/text color | Animation |
|-------|----------|----------------|-----------|
| Emergency | `#FBE4E4` | `#C62828` | Expanding ring pulse (`pulseRedRing` keyframe) |
| Overdue (>15 days) | `#FBE7DC` | `#C2410C` | Slow opacity breathing (`pulseOrange` keyframe) |
| Issue / needs maintenance | `#FEF3C7` | `#92400E` | None |
| Armed & ready | `#E6F4E9` | `#1E7A34` | None |
| Offline | `#EFEFEC` | `#6E6E68` | None (card fades to 65% opacity) |

Status badges are pill-shaped: `border-radius: 20px`, `padding: 6–7px 11–12px`.

---

## Multi-Organization Support

**JWT Token Structure:**
```json
{
  "organizations": [
    { "_id": "6ac7a6c700f6cbb00c86bfba", "name": "FireEx Services" },
    { "_id": "6ac7a6c800f6cbb00c86bfc6", "name": "Emergency Response Unit" }
  ]
}
```

**Dashboard Flow:**
1. User has access to multiple organizations
2. Organization selector dropdown displays org names
3. Selecting an organization triggers API call with orgId
4. Data refreshes for selected organization
5. First organization selected by default

---

## Role Detection Flow

```
App launch
  → Check stored JWT (MMKV)
  → If none: show Login screen
  → OTP verified → backend returns JWT with role
  → Store JWT (with organizations array)
  → Route based on role:
      user            → Dashboard (UserTabs)
      technician      → MaintenanceDashboard (TechTabs)
```

---

## Navigation Structure

```
RootNavigator (Stack)
  ├── AuthStack (unauthenticated)
  │     ├── LoginScreen
  │     └── OTPVerifyScreen
  │
  └── AppStack (authenticated)
        ├── UserTabs (role: user)
        │     ├── HomeTab → DashboardScreen ✅
        │     ├── ChatTab → SupportScreen (placeholder)
        │     └── SettingsTab → SettingsScreen (placeholder)
        │                     └── ProfileScreen
        │
        └── TechnicianTabs (role: technician)
              ├── TicketsTab → MaintenanceDashboardScreen
              └── ProfileTab → ProfileScreen
```

Bottom nav (facility user): Home · Chat · Settings (3 tabs)
Bottom nav (technician): Tickets (single primary view)

---

## DashboardScreen Layout

```
┌─────────────────────────────────┐
│  Header: Notifications/Profile  │
├─────────────────────────────────┤
│ Org Selector (if multi-org)     │
├─────────────────────────────────┤
│ 📍 Organization Address         │
├─────────────────────────────────┤
│ [Emergency] [Overdue] [Issue]   │ ← Status Pills
│ [Armed] [Offline]               │
├─────────────────────────────────┤
│ Search rooms or devices         │
├─────────────────────────────────┤
│ Rooms                           │
│ ┌─────────────────────────────┐ │
│ │ Server Wing      14 devices │ │ ← Emergency
│ └─────────────────────────────┘ │
│ ┌─────────────────────────────┐ │
│ │ Production Floor  22 devices│ │ ← Overdue
│ └─────────────────────────────┘ │
│ ... (ordered worst to best)      │
├─────────────────────────────────┤
│ Home | Chat | Settings          │ ← Bottom Tabs
└─────────────────────────────────┘
```

---

## DeviceDetail Screen Layout

Based on UX canvas artboard `project/DeviceDetail.dc.html`.

```
┌─────────────────────────────────┐
│ ← Back  Kitchen       [Armed]   │ ← Header
│          FireEx — 4F2A          │
├─────────────────────────────────┤
│ ┌──────────┐ ┌──────────┐      │
│ │ Smoke 4% │ │ Temp 22°C│      │ ← 2×2 Sensor Grid
│ └──────────┘ └──────────┘      │
│ ┌──────────┐ ┌──────────┐      │
│ │ Humid 48%│ │Battery 92│      │
│ └──────────┘ └──────────┘      │
├─────────────────────────────────┤
│ Controls                        │
│ [Fan icon]  Exhaust fan  [off]  │
│ [Mute icon] Mute buzzer  [off]  │
│ [Lock icon] Armed        [on]   │
├─────────────────────────────────┤
│ [ Request maintenance ]         │
│ Sprinkler reset needs a tech... │
├─────────────────────────────────┤
│ Device details                  │
│ Device ID       FX-4F2A-003     │
│ Firmware        v2.3.1          │
│ Wi-Fi           Office-5G       │
│ GSM backup      Jio · 4 bars    │
│ Smoke sensor    MQ2 · reading OK│
│ Last synced     2 min ago       │
├─────────────────────────────────┤
│ Recent activity                 │
│ ● Armed by Priya   Today 8:02AM │
│ ● Connectivity restored  Yesterday│
└─────────────────────────────────┘
```

---

## API: GET /api/devices

**Query Params:**
- `orgId` (optional) - Organization ID to fetch devices for specific organization

**Response:**
```json
{
  "success": true,
  "data": {
    "organization": {
      "_id": "6ac7a6c700f6cbb00c86bfba",
      "name": "FireEx Services",
      "address": "123 Main Street",
      "city": "New Delhi",
      "state": "Delhi",
      "buildingStructure": [
        {
          "floorsNo": 1,
          "name": "Ground Floor",
          "Rooms": [
            { "roomNumber": "101", "name": "Main Office" }
          ]
        }
      ]
    },
    "deviceList": [
      {
        "_id": "6ac7aa591e4c202f6f567c8e",
        "deviceName": "Smoke Detector - Main Office",
        "deviceType": "smoke_detector",
        "floor": { "floorsNo": 1, "name": "Ground Floor" },
        "room": { "roomNumber": "101", "name": "Main Office" },
        "status": "active",
        "isActive": true,
        "location": "Ceiling near entrance",
        "serialNumber": "SD-2024-001"
      }
    ]
  }
}
```

---

## Key Implementation Notes

- OTP inputs: 6 individual single-character `TextInput` components, auto-advance on entry
- Status animations: `pulseRedRing` (expanding ring, 1s) for Emergency; `pulseOrange` (opacity pulse, 2.4s) for Overdue
- Bottom sheet (Add Device): use `react-native-bottom-sheet` or a custom Modal with slide-up animation
- Emergency screen: full-screen red, no bottom navigation visible
- Technician mode indicator: dark pill visible on MaintenanceDashboard header only
- All datetime display: device locale format; store/send as ISO8601 UTC
- Controls (fan, buzzer, arm): optimistic UI — toggle immediately, revert on API error
- Sensor readings on DeviceDetail: live via WebSocket `device.telemetry` events while screen is open
- Offline cards (device/ticket): use `opacity: 0.65` wrapper style

---

---

## BLE Device Provisioning (Technician Flow)

Used by the **technician** role to set up a new FireEx device on-site via Bluetooth.

### Library
Use `react-native-ble-plx` (well-maintained, works on iOS + Android via Expo dev client).

### BLE Constants
```js
const BLE_DEVICE_NAME   = "FireEx";
const SERVICE_UUID      = "0000ABCD-0000-1000-8000-00805F9B34FB"; // full 128-bit form of "ABCD"
const CHAR_UUID         = "00001234-0000-1000-8000-00805F9B34FB"; // full 128-bit form of "1234"
```

### Manufacturer Data — Reading Model Number
During scan, each advertising packet contains manufacturer specific data:
- Bytes 0–1: `0xFF 0xFF` (company ID — skip these)
- Bytes 2–N: ASCII model number string e.g. `"FX-SD-100"`

```js
// Parse model number from scan result
const mfrData = device.manufacturerData; // base64-encoded bytes
const bytes = Buffer.from(mfrData, 'base64');
const modelNumber = bytes.slice(2).toString('ascii'); // skip 2-byte company ID
// Use modelNumber to fetch product config from server
```

### Full Provisioning Flow

```
1. Request BLE permissions (Android: BLUETOOTH_SCAN + BLUETOOTH_CONNECT; iOS: NSBluetoothAlwaysUsageDescription)
2. Scan for devices named "FireEx"
3. Read manufacturer data → extract model number (e.g. "FX-SD-100")
4. Use model number → GET /api/products?model=FX-SD-100 → get product features
5. GET /api/devices/provision → server assigns UDN for this installation
6. Connect to device
7. Request MTU = 512 (negotiate max before writing)
8. Subscribe to notifications on CHAR_UUID
9. Write "MODEL_NUMBER:" → wait for notify → verify response = "MODEL_NUMBER:FireEx"
10. Build CONFIG payload (see format below)
11. Write CONFIG payload as SINGLE write (MTU negotiated, fits in one packet)
12. Wait for notify → verify response = "CONFIG:OK"
13. Write "RESTART:" → wait for "RESTART:OK"
14. Device reboots — provisioning complete
15. POST /api/devices/:deviceId/activate to mark device as provisioned on backend
```

### CONFIG Payload Format (app → device)
```
CONFIG:{"udn":"FX00123","ssid":"WiFiName","pass":"WiFiPass","mqtt_host":"broker.fireex.in","mqtt_port":"1883","mqtt_topic":"FX00123","http_url":"https://api.fireex.in","show_serial":false}
```

| Field | Type | Description |
|-------|------|-------------|
| `udn` | string | Unique Device Number from server |
| `ssid` | string | Wi-Fi SSID for the installation site |
| `pass` | string | Wi-Fi password |
| `mqtt_host` | string | MQTT broker hostname |
| `mqtt_port` | string | MQTT port e.g. `"1883"` |
| `mqtt_topic` | string | MQTT base topic (usually same as UDN) |
| `http_url` | string | Backend API base URL |
| `show_serial` | boolean | `false` for production |

> All values are strings **except** `show_serial` which is a JSON boolean (no quotes).

### Other BLE Commands
| Write | Expected notify response | Use |
|-------|--------------------------|-----|
| `MODEL_NUMBER:` | `MODEL_NUMBER:FireEx` | Verify correct device before provisioning |
| `RESTART:` | `RESTART:OK` | Reboot device after provisioning |
| `RESET:` | `RESET:OK` | Factory reset — clears all credentials |

### Important Implementation Notes
- Always request MTU 512 before writing CONFIG (`device.requestMTU(512)` in react-native-ble-plx)
- Send CONFIG as a **single write** — do not chunk manually
- If device disconnects mid-flow, restart from step 6 (re-connect) — the accumulation buffer on the device resets on disconnect
- The device re-starts advertising automatically after disconnect so re-connection always works
- GSM APN is **not** provisioned via BLE — the device reads it automatically from the SIM card

---

## Recent Changes (2026-10-12)

✅ Built complete maintenance ticket flow: list → detail → in-progress (3 screens)
✅ Real API integration: `/api/tickets/assigned` + `/api/tickets/:id`
✅ Status filter tabs with per-tab colors and horizontal scroll
✅ Multi-field search (org, room, floor, ticket ID, device name)
✅ `StatusPulse` component with critical ring + in_progress breathing animations
✅ Linked device card on ticket detail navigates to device detail screen
✅ `serviceBoy` role routes to `/maintenance-tickets` after OTP login
✅ Backend seed fixed — tickets now reference real device IDs
✅ Icon additions: wrench, plusSquare, ticket, key

## Recent Changes (2026-10-08)

✅ Updated JWT token handling for organizations array
✅ Created OrganizationSelector component with org names
✅ Updated BuildingSelector to show address only
✅ Implemented device fetch with orgId parameter
✅ Real-time search filtering for rooms and devices
✅ Status animations with react-native-reanimated
✅ All lint and type checks passing
✅ Memory and documentation updated
