# Data Model: Buildings, Floors, Departments, Rooms

The location hierarchy in FireEx determines where devices are installed and how alerts and access are scoped. A device belongs to a room, which belongs to a floor, which belongs to a building, which belongs to a department.

> **Database note (ADR-012):** All collections below are MongoDB collections accessed via Mongoose, not PostgreSQL tables. `id` fields are MongoDB ObjectId strings, not UUIDs.

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

## MongoDB: `buildings` Collection

```ts
{
  _id:            ObjectId,
  name:           string,
  address?:       string,
  city?:          string,
  country?:       string,
  latitude?:      number,
  longitude?:     number,
  departmentIds:  ObjectId[],  // refs: departments — replaces the old department_buildings junction table
  isActive:       boolean,     // default true
  createdAt:      Date,
  updatedAt:      Date,
}
```

> **Note:** the department↔building many-to-many relationship, previously a separate `department_buildings` junction table in PostgreSQL, is now a plain `departmentIds` array embedded directly on the building document — idiomatic for MongoDB, and avoids a join collection for a relationship that's always read together with the building.

---

## MongoDB: `floors` Collection

```ts
{
  _id:            ObjectId,
  buildingId:     ObjectId,   // ref: buildings, indexed
  floorNumber:    number,     // 0 = ground, -1 = basement, etc.
  floorName?:     string,     // optional: "Ground Floor", "Mezzanine"
  floorPlanUrl?:  string,     // link to floor plan image/PDF (cloud storage)
  createdAt:      Date,
  updatedAt:      Date,
}
```

Compound unique index on `(buildingId, floorNumber)`.

---

## MongoDB: `rooms` Collection

```ts
{
  _id:            ObjectId,
  floorId:        ObjectId,   // ref: floors, indexed
  departmentId:   ObjectId,   // ref: departments, indexed — which dept owns this room
  roomCode?:      string,     // e.g. "3B-04", "SERVER-ROOM-2"
  name:           string,     // e.g. "Server Room 3B"
  roomType?:      string,     // see Room Types below
  areaSqm?:       number,     // floor area in square metres
  isActive:       boolean,    // default true
  createdAt:      Date,
  updatedAt:      Date,
}
```

Indexes: `floorId`, `departmentId`.

---

## Room Types

| `roomType` | Description |
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
  ↓ (via buildings.departmentIds array)
buildings
  ↓ (floors.buildingId)
floors
  ↓ (rooms.floorId)
rooms
  ↓ (devices.roomId)
devices
```

Every device's full path is: `Department > Building > Floor > Room > Device`

---

## Access Scoping Rules

- **super_admin**: can see all departments, buildings, floors, rooms, devices
- **dept_admin**: can see and manage buildings where `departmentIds` contains their department, but only rooms where `rooms.departmentId = their department`
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
