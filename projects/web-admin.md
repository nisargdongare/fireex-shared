# Project: FireEx Web Admin (`fireex-web`)

## Overview

A single Next.js application serving two admin roles: **Department Admin** and **Super Admin**. Role separation is enforced via Next.js middleware and server-side authorization. Both roles log in via OTP.

**Status:** Not started (as of 2024-10-04)
**Repo:** TBD
**Framework:** Next.js 14+ (App Router)

---

## Role Separation Strategy

- After OTP login, the JWT contains the user's role
- JWT is stored in an `httpOnly` cookie
- Next.js middleware reads the cookie and redirects unauthorized access:
  - `/admin/super/*` → requires `super_admin` role
  - `/admin/dept/*` → requires `dept_admin` or `super_admin`
  - `/admin/*` (shared) → requires any admin role
- Both roles share the same codebase; UI elements are shown/hidden based on role

---

## Route Structure (App Router)

```
app/
  (auth)/
    login/
      page.tsx               ← Phone number entry
    otp/
      page.tsx               ← OTP verification
  (admin)/
    layout.tsx               ← Admin shell: sidebar, header, WebSocket provider
    dashboard/
      page.tsx               ← Role-aware dashboard (different widgets per role)
    alerts/
      page.tsx               ← Alert list
      [id]/
        page.tsx             ← Alert detail
    tickets/
      page.tsx               ← Ticket list
      [id]/
        page.tsx             ← Ticket detail
    devices/
      page.tsx               ← Device list
      [id]/
        page.tsx             ← Device detail with live readings
      new/
        page.tsx             ← Register new device (dept_admin+)
    buildings/
      page.tsx               ← Building list
      [id]/
        page.tsx             ← Building detail with floor map
      [id]/floors/[floorId]/
        page.tsx             ← Floor detail with room list
    users/
      page.tsx               ← User list
      new/
        page.tsx             ← Register new user
      [id]/
        page.tsx             ← User detail / edit
    departments/             ← super_admin only
      page.tsx
      new/
        page.tsx
      [id]/
        page.tsx
    reports/
      page.tsx               ← Compliance reports, maintenance history
  middleware.ts              ← JWT verification + role-based redirect
```

---

## Page Descriptions

### Login Flow

**`/login`**
- Phone number input with country code selector
- POST to `/api/auth/otp/request`
- Redirect to `/otp` with phone number in session

**`/otp`**
- 6-digit OTP input
- POST to `/api/auth/otp/verify`
- On success: set JWT cookie, redirect to `/admin/dashboard`

---

### Dashboard (`/admin/dashboard`)

**Super Admin view:**
- System-wide stats: total devices, online/offline count, active alerts count, open tickets count
- Department health table: one row per department, showing device count, alert count, ticket count
- Recent alerts feed (last 10, across all departments)
- System health indicators: MQTT broker status, DB status

**Dept Admin view:**
- Department stats: devices, online/offline, active alerts, open tickets
- Building map / floor selector with device status overlay
- Recent alerts for department
- Open tickets summary with priority breakdown
- On-call technician list

---

### Alerts (`/admin/alerts`)

- Table: alert type, severity badge, device code, location, triggered time, status
- Filters: severity, status, building, date range
- Real-time: new rows appear at top when `alert.new` WebSocket event received
- Clicking a row → `/admin/alerts/[id]`
- Bulk acknowledge (dept_admin+)

**`/admin/alerts/[id]`**
- Alert type, severity, status with status history timeline
- Device info with link to device page
- Sensor values at trigger time vs. thresholds
- Acknowledge / Mark false alarm buttons
- Linked ticket (if created)
- Notification log (who was notified, which channels, delivery status)

---

### Tickets (`/admin/tickets`)

- Table: ticket number, type, priority, device, assignee, status, created time
- Filters: status, priority, type, assignee, building
- Create ticket button
- Clicking a row → `/admin/tickets/[id]`

**`/admin/tickets/[id]`**
- Full ticket detail: header info, linked alert, assignee
- Checklist items (read-only for admins)
- Comments thread
- Photo attachments viewer
- Reassign button (dept_admin+)
- Status timeline

---

### Devices (`/admin/devices`)

- Table: device code, serial, room location, status indicator, firmware version, last seen
- Filters: status, building, room
- Register new device button (super_admin)

**`/admin/devices/[id]`**
- Device info header
- Current status + last seen
- Live sensor readings panel (real-time via WebSocket `device.telemetry`)
- Sensor history chart: configurable time range (last 1h, 6h, 24h, 7d)
  - Lines: smoke level, CO PPM, temperature, humidity
- Recent alerts list
- Recent tickets list
- Device config editor: thresholds, reporting interval (dept_admin+)
- Commands panel: Test Alarm, Silence, Reboot, Sync Config (with confirmation modal)
- Assign to room form (super_admin)

---

### Buildings (`/admin/buildings`)

- Card grid: building name, city, device count, active alert indicator
- Create building button (super_admin)

**`/admin/buildings/[id]`**
- Building info, floor list
- Each floor: room count, device count, alert count
- Click floor → `/admin/buildings/[id]/floors/[floorId]`

**Floor detail:**
- Room list with device count and status per room
- Optional: floor plan image overlay (uploaded SVG/PNG) with device pins
- Click room → inline panel showing device list for that room

---

### Users (`/admin/users`)

- Table: name, phone number, role badge, department, active/inactive
- Create user button
- Dept admin sees only their department's users
- Super admin sees all users with department filter

**Create/Edit user form:**
- Full name, phone number, role selector, department selector
- Toggle active/inactive

---

### Departments (super_admin only, `/admin/departments`)

- List all departments
- Create/edit department
- Assign buildings to department

---

### Reports (`/admin/reports`)

- Alert frequency report: alerts per device per period
- Maintenance compliance: ticket resolution times, SLA compliance
- Device health: offline duration statistics
- Export to CSV/PDF (TBD)

---

## WebSocket Integration (Web)

- WebSocket connection established in `AdminLayout` on mount
- Subscribe to `department` scope (dept_admin) or `global` scope (super_admin)
- Events handled:
  - `alert.new`: toast notification + update alerts list/count
  - `alert.updated`: update alert status in list
  - `device.status_changed`: update device status in table
  - `ticket.created`: toast notification + update ticket count
  - `ticket.resolved`: update ticket in list

---

## Key Implementation Notes

- JWT stored in `httpOnly` cookie (set by backend on login, cleared on logout)
- Middleware reads cookie, decodes JWT (public key verification), attaches to request headers for Server Components
- All data fetching in Server Components uses `fetch` with the Authorization header derived from the cookie
- Client Components use React Query for mutations and real-time data (alerts list, device readings)
- shadcn/ui provides the component primitives: Table, Dialog, Sheet, Badge, Tabs, etc.
- Sensor charts: Recharts (LineChart for time-series) or Chart.js
- Dates: always display in the browser's local timezone; send/receive as ISO8601 UTC
