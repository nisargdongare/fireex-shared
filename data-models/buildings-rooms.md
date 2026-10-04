# Data Model: Buildings, Floors, Departments, Rooms

The location hierarchy in FireEx determines where devices are installed and how alerts and access are scoped. A device belongs to a room, which belongs to a floor, which belongs to a building, which belongs to a department.

---

## Hierarchy

```
Department
  └── Building (a building can be associated with multiple departments)
        └── Floor
              └── Room
                    └── Device(s)
```

A building can serve multiple departments. Access is scoped at the **department** level: a department admin only sees rooms and devices that belong to their department within a building.

---

## PostgreSQL: `buildings` Table

```sql
CREATE TABLE buildings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(255) NOT NULL,
  address         TEXT,
  city            VARCHAR(100),
  country         VARCHAR(100),
  latitude        FLOAT,
  longitude       FLOAT,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## PostgreSQL: `department_buildings` Table (Junction)

A many-to-many relationship between departments and buildings:

```sql
CREATE TABLE department_buildings (
  department_id   UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  building_id     UUID NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  PRIMARY KEY (department_id, building_id)
);
```

---

## PostgreSQL: `floors` Table

```sql
CREATE TABLE floors (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id     UUID NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  floor_number    SMALLINT NOT NULL,           -- 0 = ground, -1 = basement, etc.
  floor_name      VARCHAR(100),                -- optional: "Ground Floor", "Mezzanine"
  floor_plan_url  TEXT,                        -- link to floor plan image/PDF (cloud storage)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (building_id, floor_number)
);
```

---

## PostgreSQL: `rooms` Table

```sql
CREATE TABLE rooms (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  floor_id        UUID NOT NULL REFERENCES floors(id) ON DELETE CASCADE,
  department_id   UUID NOT NULL REFERENCES departments(id),  -- which dept owns this room
  room_code       VARCHAR(50),               -- e.g. "3B-04", "SERVER-ROOM-2"
  name            VARCHAR(255) NOT NULL,     -- e.g. "Server Room 3B"
  room_type       VARCHAR(50),               -- e.g. "office", "server_room", "corridor", "stairwell"
  area_sqm        FLOAT,                     -- floor area in square metres
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ON rooms (floor_id);
CREATE INDEX ON rooms (department_id);
```

---

## Room Types

| `room_type` | Description |
|-------------|-------------|
| `office` | Open or closed office space |
| `server_room` | IT/server infrastructure room (higher alert priority) |
| `corridor` | Hallway or common passage |
| `stairwell` | Fire escape stairwell |
| `storage` | Storage room |
| `kitchen` | Kitchen or break room (smoke sensor thresholds adjusted for cooking) |
| `lobby` | Building entrance / lobby |
| `plant_room` | Mechanical/electrical plant room |
| `other` | Anything not categorized above |

---

## Relationship Summary

```
departments
  ↓ (via department_buildings)
buildings
  ↓ (floors.building_id)
floors
  ↓ (rooms.floor_id)
rooms
  ↓ (devices.room_id)
devices
```

Every device's full path is: `Department > Building > Floor > Room > Device`

---

## Access Scoping Rules

- **super_admin**: can see all departments, buildings, floors, rooms, devices
- **dept_admin**: can see and manage buildings where their department has a `department_buildings` entry, but only rooms where `rooms.department_id = their department`
- **technician**: same as dept_admin read access for their assigned building(s)
- **end_user**: can see status of their assigned building(s) but not room-level detail (TBD — may expose room-level in mobile app later)

---

## API: Buildings & Rooms

| Endpoint | Access | Description |
|----------|--------|-------------|
| `GET /api/buildings` | dept_admin+ | List buildings (filtered by dept for dept_admin) |
| `POST /api/buildings` | super_admin | Create building |
| `GET /api/buildings/:id` | dept_admin+ | Get building with floors |
| `GET /api/buildings/:id/floors` | dept_admin+ | List floors |
| `POST /api/buildings/:id/floors` | super_admin | Add floor |
| `GET /api/floors/:id/rooms` | dept_admin+ | List rooms on a floor |
| `POST /api/floors/:id/rooms` | dept_admin+ | Create room |
| `GET /api/rooms/:id` | dept_admin+ | Get room with devices |
| `PATCH /api/rooms/:id` | dept_admin+ | Update room |
| `DELETE /api/rooms/:id` | super_admin | Delete room (only if no devices assigned) |

See `api-contracts/rest-api.md` for full request/response shapes.
