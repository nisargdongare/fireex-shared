# Project: FireEx Mobile App (`fireex-mobile`)

## Overview

A single React Native app for two user types: **end users** (building occupants) and **service technicians**. The role is determined post-authentication — the same app binary serves both roles, with the UI adapting based on the role returned in the JWT.

**Status:** Not started (as of 2024-10-04)
**Repo:** TBD
**Platform:** iOS + Android

---

## Role Detection Flow

```
App launch
  → Check for stored access token (MMKV)
  → If none: show Phone Number screen
  → OTP verification → backend returns JWT with role
  → Store JWT in MMKV
  → Navigate to correct home screen based on role
      - end_user → UserHomeScreen
      - technician → TechnicianHomeScreen
      - dept_admin → DeptAdminHomeScreen (limited)
      - super_admin → redirect to web admin (mobile app not primary tool for super_admin)
```

---

## Navigation Structure

```
RootNavigator (Stack)
  ├── AuthStack (unauthenticated)
  │     ├── PhoneNumberScreen
  │     └── OTPVerificationScreen
  │
  └── AppStack (authenticated)
        ├── UserTabs (role: end_user)
        │     ├── HomeTab → UserHomeScreen
        │     ├── AlertsTab → AlertListScreen
        │     └── ProfileTab → ProfileScreen
        │
        ├── TechnicianTabs (role: technician)
        │     ├── HomeTab → TechnicianHomeScreen
        │     ├── TicketsTab → TicketListScreen
        │     ├── AlertsTab → AlertListScreen
        │     ├── DevicesTab → DeviceListScreen
        │     └── ProfileTab → ProfileScreen
        │
        └── DeptAdminTabs (role: dept_admin)
              ├── DashboardTab → DashboardScreen
              ├── AlertsTab → AlertListScreen
              ├── TicketsTab → TicketListScreen
              ├── DevicesTab → DeviceListScreen
              └── ProfileTab → ProfileScreen
```

---

## Screen Descriptions

### Auth Screens

**PhoneNumberScreen**
- Single input: phone number (with country code picker)
- "Send OTP" button → calls `POST /api/auth/otp/request`
- Shows error if number not registered

**OTPVerificationScreen**
- 6-digit OTP input (auto-advance between digits)
- Timer countdown showing OTP expiry (5 min)
- "Resend OTP" link (enabled after 60 seconds)
- On success: store tokens, determine role, navigate

---

### End User Screens

**UserHomeScreen**
- Building status summary: green/yellow/red indicator
- Active alerts count badge (if any)
- Last sensor readings for nearby devices (room-level, if assigned)
- "All clear" / "Alert active" banner

**AlertListScreen** (shared with technician, filtered by role)
- List of alerts for user's department
- Grouped by status: Active / Recent
- Each row: alert type icon, location, time elapsed
- Tap → AlertDetailScreen

**AlertDetailScreen**
- Alert type, severity badge, location breadcrumb
- Sensor values at trigger time
- Current status (active/acknowledged/resolved)
- Timeline: triggered → acknowledged → resolved

---

### Technician Screens

**TechnicianHomeScreen**
- "My open tickets" summary card (count + priority breakdown)
- Active alerts for department
- Quick-action buttons: Start next ticket, View alerts

**TicketListScreen**
- Tabs: My Tickets / All Department Tickets
- Filter: status, priority
- Each row: ticket number, title, priority badge, device location, time
- Tap → TicketDetailScreen

**TicketDetailScreen**
- Header: ticket number, type, priority, status
- Device info with location (building > floor > room)
- Linked alert (if `alert_response` type) — tap to see alert
- Checklist: interactive checkboxes with notes field per item
- Comments section
- Attachment section: camera button to add photos
- Action buttons at bottom: "Start Work" / "Pause — Pending Parts" / "Mark Resolved"
- Mark Resolved: opens resolution notes modal

**DeviceListScreen** (technician/admin)
- List of devices in department
- Status indicator per device (online/offline/alarming)
- Filter by building, status
- Tap → DeviceDetailScreen

**DeviceDetailScreen**
- Device code, room location, firmware version
- Current status indicator
- Live sensor values (via WebSocket `device.telemetry` events)
- Last 24h sensor graph (spark line: smoke, CO, temp)
- Recent alerts list
- Quick actions: Test Alarm, Silence Alarm (requires confirmation)

---

### Shared Screens

**ProfileScreen**
- User name, role badge, department
- Notification preferences (which alert types to receive push for)
- Log out button

---

## Real-time Updates (WebSocket)

- Connect on app foreground, disconnect on app background
- Subscribe to `department` scope on login
- When `alert.new` received: show banner notification at top of screen + update alerts list
- When `device.status_changed` received: update device status in device list
- When `ticket.updated` received (technician): update ticket in list

## Push Notifications

- Register device token with backend on login: `POST /api/users/me/push-token`
- `critical` alerts: push notification even when app is in background/killed
- Tap on push notification → open AlertDetailScreen for that alert
- Notification categories (iOS): "View", "Acknowledge" (for technicians)

---

## Offline Behavior

- Last fetched data is cached in MMKV (alerts, tickets, device list)
- Offline indicator banner shown when no internet
- Actions that require network (update ticket, acknowledge alert) show error and queue for retry (TBD — may skip queuing in v1)
- Sensor graphs fall back to cached data

---

## State Management (Zustand Stores)

- `authStore`: user, tokens, role
- `alertStore`: active alerts list, subscribe to WebSocket updates
- `ticketStore`: my tickets, all tickets (technician)
- `deviceStore`: device list, cached readings
- `wsStore`: WebSocket connection state, reconnect logic

---

## Key Implementation Notes

- OTP input: use a custom component with 6 separate `TextInput` elements, auto-focus next on entry
- Phone number input: use `react-native-phone-input` or similar for country code selection
- All datetime display: use the device locale format; store/send as ISO8601 UTC
- Images in ticket attachments: compress before upload (max 1MB per photo)
- Alert banners: use a persistent in-app notification component, not the OS notification system, while app is foregrounded
