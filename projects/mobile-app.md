# Project: FireEx Mobile App (`fireex-mobile`)

## Overview

A single React Native app for two user types: **facility users** (building occupants/managers) and **service technicians**. The role is determined post-authentication — the backend detects role from the registered phone number and returns it in the JWT. Same binary, UI adapts automatically.

**Status:** Dashboard implemented with full multi-organization support (as of 2026-10-08)
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

### 🔄 In Progress / Next Steps

- [ ] RoomDevicesScreen - tap room to see devices
- [ ] DeviceDetailScreen - sensor readings and controls
- [ ] ChatScreen & SettingsScreen
- [ ] Device control endpoints (fan, buzzer, arm)
- [ ] WebSocket for live telemetry
- [ ] Emergency alert screen
- [ ] Offline support with caching

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

## Recent Changes (2026-10-08)

✅ Updated JWT token handling for organizations array
✅ Created OrganizationSelector component with org names
✅ Updated BuildingSelector to show address only
✅ Implemented device fetch with orgId parameter
✅ Real-time search filtering for rooms and devices
✅ Status animations with react-native-reanimated
✅ All lint and type checks passing
✅ Memory and documentation updated
