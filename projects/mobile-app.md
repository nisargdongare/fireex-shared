# Project: FireEx Mobile App (`fireex-mobile`)

## Overview

A single React Native app for two user types: **facility users** (building occupants/managers) and **service technicians**. The role is determined post-authentication — the backend detects role from the registered phone number and returns it in the JWT. Same binary, UI adapts automatically.

**Status:** Dashboard + full maintenance ticket flow + BLE device provisioning implemented (as of 2026-10-13)
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

**BLE Device Provisioning (serviceBoy, installation tickets):**
- `/add-device` screen with multi-step flow: scan → verify → wifi → registering → provisioning → done
- Real BLE scan via `useBLE.ts` hook (react-native-ble-plx) — no mock devices
- Model mismatch guard: reads manufacturer data from BLE advertising packet, compares to `ticket.product.modelNumber` before connecting; shows mismatch modal if wrong device
- Connects, negotiates MTU, sends `MODEL_NUMBER:` command to verify device identity
- Reads `ticket.wifiNetworks[]` array for Wi-Fi selection (populated from backend on the ticket detail)
- Calls `POST /api/devices/register` with `{ productId: ticket.product._id, ticketId: ticket._id }` — backend auto-generates UDN, sets device name from product catalog
- Sends `CONFIG:{json}` payload over BLE — full format: `{ udn, ssid, pass, mqtt_host, mqtt_port, mqtt_topic, http_url, show_serial }`
- MQTT constants from `src/constants/mqtt.ts`: `host: "broker.fireex.in"`, `port: "1883"`, `httpUrl: "https://api.fireex.in"`
- Sends `RESTART:` command after successful config write
- Active ticket carried via Redux (`ticketSlice`) — `ticket-detail.tsx` dispatches `setActiveTicket` before navigating to `/add-device`
- Device-detail "Set up device via BLE" button also routes to `/add-device`

**Device Detail Screen:**
- Full product info, hardware/software versions, feature pills
- Location grid (status, floor, room, location)
- "Set up device via BLE" button routes to `/add-device`

### 🔄 In Progress / Next Steps

- [ ] RoomDevicesScreen — tap room card on dashboard to see device list
- [ ] Device controls (fan, buzzer, arm) via REST
- [ ] ChatScreen & SettingsScreen
- [ ] WebSocket for live telemetry on device detail
- [ ] Emergency alert screen
- [ ] Offline support with caching
- [ ] Profile screen (linked from both dashboard and ticket list headers)
- [ ] Ticket auto-close after successful device provisioning (backend side)

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
      serviceBoy      → MaintenanceDashboard (TechTabs)
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
        │
        └── TechnicianTabs (role: serviceBoy)
              └── TicketsTab → MaintenanceDashboard ✅
                    ├── /ticket-detail ✅
                    ├── /ticket-in-progress ✅
                    └── /add-device ✅ (BLE provisioning)
```

---

## State Management (Redux)

**Store:** `src/store/index.ts` — Redux Toolkit with `@reduxjs/toolkit` + `react-redux`

**Slices:**
- `ticketSlice` (`src/store/ticketSlice.ts`) — holds `activeTicket: TicketDetail | null`
  - `setActiveTicket(ticket)` — called in `ticket-detail.tsx` when ticket loads, so `/add-device` can read `ticket.product._id`, `ticket.wifiNetworks`, etc. without re-fetching
  - `clearActiveTicket()` — called on logout or when leaving the provisioning flow

**Why Redux for active ticket:** The `/add-device` screen is a separate route with no direct props channel from ticket-detail. Redux slice bridges the data without requiring URL params for complex objects.

---

## BLE Device Provisioning — Full Flow

### Entry Points
1. `ticket-detail.tsx` — installation ticket "Add device" button → dispatches `setActiveTicket(ticket)` → navigates to `/add-device?ticketId=...`
2. `device-detail.tsx` — "Set up device via BLE" button → navigates to `/add-device?deviceId=...&deviceName=...`

### Screen Steps (`src/app/add-device.tsx`)
```
scan → verifying → wifi → registering → provisioning → done
```

| Step | What happens |
|------|-------------|
| `scan` | BLE permission request + scan for `"FireEx"` devices. Shows pulsing Bluetooth icon while scanning. Lists found devices with RSSI. |
| (pair tap) | Reads manufacturer data → checks model matches `ticket.product.modelNumber`. Shows mismatch modal if wrong. Connects to device. |
| `verifying` | Sends `MODEL_NUMBER:` over BLE, waits for response to confirm device identity. |
| `wifi` | Shows connected device pill. Lists `ticket.wifiNetworks[]` in bottom-sheet picker. |
| `registering` | Calls `POST /api/devices/register` — gets back `udn` and device record. |
| `provisioning` | Negotiates MTU, sends `CONFIG:{json}` over BLE, sends `RESTART:`. |
| `done` | Success screen with "Done" → `router.back()`. |

### Hook: `src/hooks/useBLE.ts`
Wraps `react-native-ble-plx`. Key exports:
- `requestPermissions()` — Android 12+ needs BLUETOOTH_SCAN + BLUETOOTH_CONNECT; older Android needs ACCESS_FINE_LOCATION; iOS returns true
- `startBluetooth()` — checks BLE state, returns `'on' | 'off'`
- `scanForPeripherials()` — scans for devices whose name includes `"FireEx"`, deduplicates
- `stopScan()`
- `allDevices: Device[]`
- `connectToDevice(device)` → `Promise<boolean>`
- `sendRequestAndReceiveResponse(device, serviceUUID, charUUID, command)` — colon-prefixed RPC with 9s timeout
- `readManufacturerData(device)` → `string | null` — parses model number from bytes 2–N of manufacturer data
- `negotiateMTU(device)` → `Promise<number>` — requests MTU 512

### BLE Constants (interim — pending real firmware UUIDs)
```ts
const BLE_SERVICE_UUID = 'ABCD';
const BLE_CHAR_UUID    = '1234';
```
These match what's in the archived firmware source. Will be updated once firmware BLE goes live.

### API: `POST /api/devices/register`
- **Auth:** NOT required (public provisioning endpoint by design)
- **Body:** `{ productId: string, ticketId: string }`
- **Response:** `{ success: true, data: { _id, udn, deviceName, orgId, floor, room, status, isActive, createdAt, updatedAt } }`
- The backend auto-generates a unique UDN, sets `deviceName` from the linked product, resolves org/floor/room from the ticket context
- `registerDevice()` wrapper in `src/services/protectedApiClient.ts` (currently uses authenticated client — no-auth is fine too since JWT is available at this point)

### CONFIG Payload Sent Over BLE
```json
{
  "udn": "FX00123",
  "ssid": "WiFiName",
  "pass": "WiFiPass",
  "mqtt_host": "broker.fireex.in",
  "mqtt_port": "1883",
  "mqtt_topic": "FX00123",
  "http_url": "https://api.fireex.in",
  "show_serial": false
}
```
Sent as `CONFIG:{json}` — device expects the prefix.

### MQTT Constants (`src/constants/mqtt.ts`)
```ts
export const MQTT_CONFIG = {
  host: 'broker.fireex.in',
  port: '1883',
  httpUrl: 'https://api.fireex.in',
} as const;
```

### Types Added (`src/types/api.ts`)
- `WifiNetwork { ssid: string; password: string }`
- `TicketDetailProduct { _id, modelNumber, name, category, productType }`
- `TicketDetail.product: TicketDetailProduct` — populated from backend
- `TicketDetail.wifiNetworks: WifiNetwork[]` — list of site Wi-Fi networks on the ticket
- `RegisterDeviceRequest { productId: string; ticketId: string }`
- `RegisterDeviceData { _id, udn, deviceName, orgId, floor, room, status, isActive, createdAt, updatedAt }`
- `RegisterDeviceResponse { success, data?, error? }`

### Requires Dev Client
`react-native-ble-plx` has native code — Expo Go does not work. Build with:
```bash
npx expo run:android   # local dev client
# or
bunx eas-cli build --profile development   # EAS cloud build
```

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
- Emergency screen: full-screen red, no bottom navigation visible
- Technician mode indicator: dark pill visible on MaintenanceDashboard header only
- All datetime display: device locale format; store/send as ISO8601 UTC
- Controls (fan, buzzer, arm): optimistic UI — toggle immediately, revert on API error
- Sensor readings on DeviceDetail: live via WebSocket `device.telemetry` events while screen is open
- Offline cards (device/ticket): use `opacity: 0.65` wrapper style

---

## Recent Changes (2026-10-13)

✅ BLE Device Provisioning screen fully implemented (`/add-device`)
✅ Real BLE scan + connect via `react-native-ble-plx` (no mock devices)
✅ Model mismatch guard — reads manufacturer data, validates against ticket product
✅ Full provisioning pipeline: scan → verify → wifi picker → register → CONFIG over BLE → restart
✅ `POST /api/devices/register` wired with `{ productId, ticketId }` body
✅ Redux store added (`ticketSlice`) to pass active ticket into add-device flow
✅ `ticket-detail.tsx` dispatches `setActiveTicket` before navigating to add-device
✅ `TicketDetail` type extended: `product: TicketDetailProduct`, `wifiNetworks: WifiNetwork[]`
✅ `src/constants/mqtt.ts` added with MQTT broker config
✅ `device-detail.tsx` "Set up device via BLE" button wired to `/add-device`
✅ `RegisterDeviceRequest/Response` types added to `src/types/api.ts`

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
