# Project: FireEx Backend (`fireex-backend`)

## Overview

The central **Express + Node.js** backend serves all FireEx clients: mobile app, web admin, and hardware devices (via MQTT — not yet implemented). It is the single source of truth for all business logic.

**Status:** In progress (as of 2026-10-11)
**Repo:** `~/Documents/Software_projects/fireex-backend`
**Port (dev):** 3000
**Language:** TypeScript (ESM — `"type": "module"` in package.json; all local imports use `.js` extension)

> **Framework note:** The backend uses **Express**, not Fastify. Previous docs describing Fastify, plugins, decorators, or `@fastify/*` packages are incorrect.

---

## Actual Folder Structure

```
fireex-backend/
  src/
    app.ts                  ← Express app factory, route mounting, Swagger UI at /api/docs
    index.ts                ← Entry point, starts server
    config.ts               ← Config (port, JWT secrets/expiry, env)
    db.ts                   ← MongoDB connection, seed data (users, orgs, devices)
    swagger.ts              ← swagger-jsdoc config, glob: src/routes/**/*.ts
    middleware/
      auth.middleware.ts    ← jwtMiddleware + optionalJwt (Express middleware)
    models/
      Device.ts
      Organisation.ts
      User.ts
      OtpCode.ts
      RefreshToken.ts
    routes/
      auth.ts               ← POST /api/auth/otp/request, /otp/verify, /refresh, /logout
      devices.ts            ← GET /api/devices (+ /floor/:n, /room/:n, /:id)
      users.ts              ← POST /api/users/login, GET /api/users/me
      health.ts             ← GET /health
    services/
      auth.service.ts       ← OTP generation, JWT issuance, refresh, logout (implemented)
      device.service.ts     ← Device queries by org/floor/room/id (implemented)
  dist/                     ← Compiled JS (mirrors src/)
  package.json
  tsconfig.json
```

---

## Tech Stack

| Concern | Library |
|---|---|
| HTTP framework | **Express 4** |
| Language | TypeScript (ESM) |
| Database | MongoDB via **Mongoose** |
| Validation | **Zod** (request bodies) |
| Auth | **jsonwebtoken** (JWT) + **bcryptjs** (OTP hashing) |
| API docs | **swagger-jsdoc** + **swagger-ui-express** at `/api/docs` |

---

## Code Patterns

### Models (`src/models/*.ts`)
- TypeScript interface extending `Document`
- Sub-schemas with `{ _id: false }` for embedded objects
- Main schema: `new Schema<IModel>({ ... }, { timestamps: true, collection: 'name' })`
- Exported as: `export const ModelName = mongoose.model<IModel>('ModelName', schema)`

### Services (`src/services/*.ts`)
- Static class with static async methods
- Input validated first (`mongoose.Types.ObjectId.isValid(id)` → throw `new Error('INVALID_X_ID')`)
- Throws plain `Error` with ALL-CAPS string codes (`'INVALID_ORG_ID'`, `'ORGANIZATION_NOT_FOUND'`)

### Routes (`src/routes/*.ts`)
- `Router()` instance; `router.use(jwtMiddleware)` for protected routes
- Zod schema defined at module scope; `.parse(req.body)` inside handler
- Async handlers `(req: Request, res: Response)` — no `NextFunction`
- Error handling: `try/catch` with `errorMap: { [key: string]: { status, message } }`
- JSDoc `/** @swagger ... */` blocks directly above each route for Swagger

### `req.user` shape (after `jwtMiddleware`)
```ts
{
  sub: string,                              // user ObjectId
  mobileNumber: string,
  appRole: string,
  organizationIds?: string[],               // array of org ObjectId strings
  organizations?: { _id: string, name: string }[]
}
```

---

## Environment Variables (Required)

```bash
NODE_ENV=development
PORT=3000
MONGODB_URI=mongodb://localhost:27017/fireex
JWT_ACCESS_SECRET=<32+ chars>
JWT_REFRESH_SECRET=<32+ chars>
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=30d
```

---

## Database (MongoDB only)

- Managed by Mongoose — no PostgreSQL, no Prisma, no TimescaleDB
- Collections: `users`, `organisations`, `devices`, `otp_codes`, `refresh_tokens`
- Seed data in `db.ts`: 2 default users (mobile: `8888888888`, `9999999999`), 1 org, 1 device
- `dbConnected` flag exported from `db.ts`; some routes fall back to in-memory seed data when DB is unreachable

---

## Authentication Flow

1. `POST /api/auth/otp/request` — look up user by `mobileNumber` (10-digit, no country code), generate 6-digit OTP, bcrypt-hash it, store in `otp_codes` with 5-min expiry, log to console in dev
2. `POST /api/auth/otp/verify` — compare OTP hash, issue access token (15m) + refresh token (30d), return tokens + user with embedded `organizations[]`
3. `POST /api/auth/refresh` — exchange refresh token for new pair
4. `POST /api/auth/logout` — revoke refresh token (requires JWT)

Also: `POST /api/users/login` — a simpler direct login by mobile number (no OTP step), returns same token shape; used for dev/test.

---

## Swagger / API Docs

- Available at `http://localhost:3000/api/docs` in development
- All routes documented via JSDoc `@swagger` comments in `src/routes/**/*.ts`
- Global `bearerAuth` security scheme; most routes require it except OTP request/verify

---

## MQTT / WebSocket

Not yet implemented. Planned for a future phase.

---

## Key Decisions

- Express chosen (not Fastify) for simplicity and team familiarity
- Zod for runtime payload validation
- MongoDB-only persistence — no SQL/TimescaleDB
- OTPs stored hashed (bcrypt) — raw OTP never persisted
- Multi-org support: users have `organizationIds[]` array; JWT embeds `organizations[]` with `_id` + `name`
