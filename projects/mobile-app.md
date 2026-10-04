# Project: FireEx Mobile App (`fireex-mobile`)

## Overview

A single React Native app for two user types: **facility users** (building occupants/managers) and **service technicians**. The role is determined post-authentication — the backend detects role from the registered phone number and returns it in the JWT. Same binary, UI adapts automatically.

**Status:** Not started (as of 2024-10-04)
**Design:** Completed — [canvas](https://claude.ai/artifact/TFP8dCVRFBC61pEdJvKGW6)
**Repo:** TBD
**Platform:** iOS + Android

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

## Role Detection Flow

```
App launch
  → Check stored JWT (MMKV)
  → If none: show Login screen
  → OTP verified → backend returns JWT with role
  → Store JWT
  → Route based on role:
      facility_user   → Dashboard (UserTabs)
      technician      → MaintenanceDashboard (TechTabs)
```

OTP screen has a **prototype-only** role picker (2 buttons: "Facility user" / "Service technician"). In production this section is hidden — routing is automatic from the JWT.

---

## Navigation Structure

```
RootNavigator (Stack)
  ├── AuthStack (unauthenticated)
  │     ├── LoginScreen
  │     └── OTPVerifyScreen
  │
  └── AppStack (authenticated)
        ├── UserTabs (role: facility_user)
        │     ├── HomeTab → DashboardScreen
        │     ├── ChatTab → SupportScreen
        │     └── SettingsTab → SettingsScreen
        │                     └── ProfileScreen
        │
        └── TechnicianTabs (role: technician)
              ├── TicketsTab → MaintenanceDashboardScreen
              └── ProfileTab → ProfileScreen
```

Bottom nav (facility user): Home · Chat · Settings (3 tabs)
Bottom nav (technician): Tickets (single primary view)

---

## Screens — Facility User Mode

### LoginScreen
- FireEx flame logo (52×52, `#C2410C`, `border-radius: 16px`)
- Manrope 800 "FireEx" wordmark + tagline "Fire & smoke safety, in your pocket."
- Country code pill (+91) + phone number input, side by side
- Helper text: "Your number must already be registered with FireEx."
- "Send OTP" primary button → navigate to OTPVerifyScreen
- Terms footer

### OTPVerifyScreen
- Back button to LoginScreen
- "Enter the code" heading with phone number shown
- 6 individual `maxlength="1"` `type="tel"` inputs (46×56px each, gap 8px)
- "Change number" link (→ LoginScreen) + "Resend code" link (orange)
- Prototype role-picker section (hidden in production)
- "Verify & continue" button: routes to DashboardScreen (facility_user) or MaintenanceDashboardScreen (technician)

### DashboardScreen
- Header: "Home" label + "FireEx" title + notification bell (with red dot badge) + profile icon
- Building selector: location pin icon + building name + chevron (tappable to switch building)
- Status strip (horizontal scroll, pill badges): Emergency count, Overdue count, Issue count, Armed count, Offline count — each with correct color + animation
- Search bar: "Search rooms or devices"
- "Rooms" section heading
- Rooms list: each row is a card (18px radius) with:
  - Colored icon square (status-colored bg, room icon in stroke SVG)
  - Room name + device count
  - Status badge (worst status in that room)
  - Ordered worst-to-best status
- Tap room → RoomDevicesScreen

### RoomDevicesScreen
- Back to Dashboard
- Header: room name + "N devices · Building name"
- Mini status strip (count-only pills, no labels)
- Devices list: ordered worst-to-best, each card shows:
  - Status-colored icon square (server/rack SVG icon)
  - Device name (e.g. "Rack Row 3 — Unit 04A3")
  - Status subtitle (e.g. "Smoke high · 68°C", "Service overdue 19 days", "Last seen 3h ago", "Smoke 2% · 21°C")
  - Status badge
- Tap device → DeviceDetailScreen
- Offline cards: 65% opacity

### DeviceDetailScreen
- Back button + device name header + current status badge
- 2×2 sensor reading grid (cards): Smoke level (%), Temperature (°C), Humidity (%RH), Battery backup (%)
  - Each card: metric icon, large Manrope value, label
- **Controls section** (grouped border-radius list):
  - Exhaust fan toggle (off by default)
  - Mute buzzer toggle (off by default)
  - Armed toggle (green when on)
- "Request maintenance" outline button → SupportScreen
- Helper text: "Sprinkler reset and other physical servicing need a technician visit."
- **Device details** read-only table: Device ID, Firmware version, Wi-Fi SSID + signal, GSM backup carrier + bars, Smoke sensor model + status, Last synced
- **Recent activity** list: timestamped events (e.g. "Armed by Priya", "Connectivity restored")

### EmergencyAlertScreen
- Full-screen `#B3261E` red background
- Close (×) button top-right (returns to Dashboard)
- Flame icon in frosted circle
- "FIREEX ALERT" label (caps, 80% white, letter-spacing)
- "Fire detected" heading (Manrope 800, 30px)
- Location line: "Kitchen · FireEx 4F2A · Just now"
- 3-column stat row: Smoke level, Temp (°C), Sprinkler status (Active/Inactive)
- Primary CTA: "Call emergency contact" white button with red text + phone icon
- Secondary CTA: "View live status" (outline, white border, returns to DeviceDetail)
- Tertiary: "Mark as false alarm" text link

### SettingsScreen
- Page title "Settings"
- Profile row card (avatar initials, name, designation + phone) → ProfileScreen
- **HOUSEHOLD section**: member list (Owner badge, Member badge) + "Invite a member" dashed-circle add button
- **EMERGENCY CONTACTS section**: "Local fire department — 101" + "Add emergency contact" button
- **GENERAL section**: Alert notifications toggle (on), Help & support link → SupportScreen, Log out → LoginScreen
- Bottom nav tabs

### SupportScreen (Chat triage)
- Chat-style header: FireEx logo + "FireEx Support" + "Usually replies in a few minutes"
- First message: "Is this a fire emergency happening right now?"
- Two reply buttons:
  - "Yes — it's an emergency" (red `#B3261E`) → shows "Please don't wait on chat — call for help right now" + "Call emergency contact" red button + "View live device status" link + "This was a mistake — start over"
  - "No, I need help with something else" → shows menu of 5 options: Device setup / Technical issue / Schedule a service visit / Billing & account / Something else → all lead to "Request recorded" confirmation message
- "Start a new request" link resets the chat

### ProfileScreen
- Back to Settings + Edit button (pencil icon)
- Avatar circle (initials, `#C2410C` bg)
- Name + designation subtitle
- **WORK DETAILS**: Designation, Department, Employee ID, Site
- **CONTACT**: Mobile number (with green "Verified" pill), Email
- **ACCESS**: Household role (Owner / Member)

---

## Screens — Technician Mode

Technician mode is indicated by a "TECHNICIAN MODE" dark pill badge (`#1C1A17` bg, white text) below the header on the MaintenanceDashboard.

### MaintenanceDashboardScreen
- Header: "Tickets" label + "FireEx" title + profile icon
- TECHNICIAN MODE badge (dark pill)
- Status strip: Critical (red ring pulse), In progress (orange breathing), Open (yellow static), On hold (gray)
- Search bar: "Search tickets, rooms, devices"
- "Assigned to you" section heading
- Ticket list cards, each showing:
  - Status-colored icon square (wrench/tool SVG icon)
  - Ticket number + department (e.g. "TCKT-4821 · IT Infrastructure")
  - Ticket title (e.g. "Sprinkler valve fault — Server Wing")
  - Relative time (e.g. "12 min ago", "Started 40 min ago")
  - Status badge
- Resolved tickets: 65% opacity
- Tap maintenance ticket → TicketDetailScreen
- Tap new-device ticket → TicketDetailNewDeviceScreen

### TicketDetailScreen (maintenance type)
- Back to MaintenanceDashboard
- Ticket number + department/location + status badge in header
- **Info card**: title, description, Raised by, Type, Department, Location, Created
- **Maintenance code flow** (stateful, 4 states):
  1. **Idle**: "Generate maintenance code" primary button + "Mark in progress" outline button
  2. **Code generated**: Shows 6-digit code (e.g. "482 193") in Manrope 800 large type, instruction "Enter this code on the device's own display within 10 minutes", animated orange dot + "Waiting for device confirmation…" — plus prototype buttons to simulate Confirmed/Failed
  3. **Confirmed**: Green success banner "Device confirmed maintenance mode" + "Start work checklist" button → TicketInProgressScreen
  4. **Failed**: Yellow warning banner "Device did not confirm" + "Generate new code" button
- **Department devices** list below the code flow: all devices in the same department, with status badges (same 5-state system)

### TicketInProgressScreen
- Back to TicketDetail
- Ticket number + title + "In progress" badge (orange, breathing)
- **Checklist**: "N of 5 complete" counter + grouped list of checkboxes
  - Each item: 22×22px checkbox (rounded 7px), tappable toggle
  - Checked state: `#1E7A34` fill, white checkmark, text strikethrough + gray
  - Unchecked: `#D9D9D5` border, white fill
  - "Device confirmed maintenance mode" item: pre-checked, non-interactive (done via code flow)
- **Comments section**: existing comments (name + timestamp + text) + add comment textarea
- **Close ticket** row: "Resolved" green button + "Close with issue" outline amber button
  - Helper text: "Use 'Close with issue' if the fault couldn't be fully fixed — it stays flagged for follow-up."

### TicketDetailNewDeviceScreen (new device installation type)
- Same header pattern
- Info card: title, description, Raised by, Type, Department, Location, Created
- Single "Add device" primary button → AddDeviceScreen
- Helper text: "The ticket closes automatically once the new device is paired and registered."

### AddDeviceScreen (technician only)
Two steps, each full-screen:

**Step 1 — BLE Scan:**
- Back to TicketDetailNewDeviceScreen
- "Add a device" heading
- Instruction: "Turn on Bluetooth and stay close to the FireEx unit."
- Animated BLE pulse: orange circle expanding outward (CSS `@keyframes pulse`)
- "SCANNING FOR DEVICES…" label
- **NEARBY** section:
  - Available device card (highlighted orange border): device name + "Signal strong" + "Pair" button → go to Step 2
  - Out-of-range device (65% opacity, "Signal weak")

**Step 2 — Assign location:**
- Back button returns to Step 1
- Paired device confirmed row (green checkmark)
- "Where is this device being installed?"
- 3 selector rows (Floor, Department, Room): each opens a **bottom-sheet popup** on tap
  - Bottom sheet: drag indicator, title, list of options (tappable full-width rows)
  - Floor options: Ground Floor, 1st Floor, 2nd Floor, Basement
  - Department options: IT Infrastructure, Facilities, Operations, Manufacturing, Logistics
  - Room options: Server Wing, Production Floor A, Warehouse B, Admin Offices, Loading Dock
  - Tapping outside the sheet closes it
- "Register device" primary button → returns to MaintenanceDashboardScreen (ticket auto-closes)

---

## Key Implementation Notes

- OTP inputs: 6 individual single-character `TextInput` components, auto-advance on entry
- Status animations: `pulseRedRing` (expanding ring, 1s) for Emergency; `pulseOrange` (opacity pulse, 2.4s) for Overdue
- Bottom sheet (Add Device): use `react-native-bottom-sheet` or a custom Modal with slide-up animation
- Emergency screen: full-screen red, no bottom navigation visible
- Technician mode indicator: dark pill visible on MaintenanceDashboard header only
- All datetime display: device locale format; store/send as ISO8601 UTC
- Controls (fan, buzzer, arm): optimistic UI — toggle immediately, revert on API error
- "Request maintenance" routes to SupportScreen with pre-selected context (device ID in params)
- Sensor readings on DeviceDetail: live via WebSocket `device.telemetry` events while screen is open
- Offline cards (device/ticket): use `opacity: 0.65` wrapper style
