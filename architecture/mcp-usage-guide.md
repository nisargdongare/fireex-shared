# Using FireEx Shared Repo as AI Context in Claude Code

This guide explains how to use this repository as a shared AI knowledge base across all FireEx sub-projects. An MCP server runs locally and exposes every markdown file in this repo as a readable resource. Any Claude session in any sub-project can connect to it and get full platform context instantly.

---

## How It Works

The `mcp-server/` folder inside this repo contains a Node.js MCP server. When running, it:
- Registers all 20+ markdown files as readable resources (URI scheme: `fireex://path/to/file.md`)
- Exposes a `fireex-context` prompt that loads the right subset of files for any given sub-project in one shot

---

## One-time Setup (Do This Once on Your Machine)

### Step 1: Install dependencies

```bash
cd /Users/nisarg/Documents/Software_projects/fireex-shared/mcp-server
npm install
```

### Step 2: Verify the server starts

```bash
npm start
# Should print: fireex-shared MCP server ready — 20 resources registered
# Then hang (waiting for MCP client input) — Ctrl+C to stop
```

---

## Connecting a Sub-Project to the MCP Server

Each sub-project needs a `.mcp.json` file at its root that tells Claude Code where to find the server. Claude Code spawns the server automatically when you open a session in that project.

### Option A: Copy the pre-built config (recommended)

From inside any sub-project repo:

```bash
cp /Users/nisarg/Documents/Software_projects/fireex-shared/.mcp.json ./.mcp.json
```

The file contains:
```json
{
  "mcpServers": {
    "fireex-shared": {
      "command": "node",
      "args": ["/Users/nisarg/Documents/Software_projects/fireex-shared/mcp-server/src/index.js"]
    }
  }
}
```

### Option B: Add to an existing `.mcp.json`

If the sub-project already has a `.mcp.json`, add the `fireex-shared` entry to its `mcpServers` object:

```json
{
  "mcpServers": {
    "fireex-shared": {
      "command": "node",
      "args": ["/Users/nisarg/Documents/Software_projects/fireex-shared/mcp-server/src/index.js"]
    }
  }
}
```

### Option C: Add to user-level Claude settings (applies to all projects)

Edit `~/.claude/settings.json` and add the `mcpServers` key:

```json
{
  "mcpServers": {
    "fireex-shared": {
      "command": "node",
      "args": ["/Users/nisarg/Documents/Software_projects/fireex-shared/mcp-server/src/index.js"]
    }
  }
}
```

This approach means every Claude session on your machine has access to the FireEx context without any per-project setup.

---

## Using the MCP Server in a Claude Session

Once connected, the server provides two things:

### 1. The `fireex-context` prompt (fastest way to load context)

Run this slash command at the start of any session:

```
/mcp fireex-shared fireex-context project=backend
```

Replace `backend` with the sub-project you're working in:
- `backend` — loads all data models + all API contracts + backend project file
- `mobile` — loads mobile app + REST + WebSocket contracts
- `web` — loads web admin + REST + WebSocket contracts
- `firmware` — loads firmware project + MQTT topics
- `ui` — loads hardware UI project file

This injects the full relevant context as a single prompt message. Claude will have everything it needs before you write the first line of code.

### 2. Individual resource reads

Ask Claude to read specific files by URI:

```
Read the resource fireex://data-models/alerts.md
```

Or browse all available resources with `/mcp` in the Claude Code terminal.

---

## Available Resources (All URIs)

| URI | Description |
|-----|-------------|
| `fireex://README.md` | Repo overview and usage guide |
| `fireex://architecture/system-overview.md` | Full system diagram and component descriptions |
| `fireex://architecture/tech-stack.md` | Confirmed tech stack per project |
| `fireex://architecture/data-flow.md` | How data moves through the system |
| `fireex://architecture/mcp-usage-guide.md` | This file |
| `fireex://data-models/users.md` | Users, roles, OTP, JWT |
| `fireex://data-models/devices.md` | Devices, sensor readings, config |
| `fireex://data-models/alerts.md` | Alerts, severity, notification routing |
| `fireex://data-models/tickets.md` | Maintenance tickets, checklist, status flow |
| `fireex://data-models/buildings-rooms.md` | Building → floor → room → device hierarchy |
| `fireex://api-contracts/rest-api.md` | All REST endpoints with request/response shapes |
| `fireex://api-contracts/websocket-events.md` | Real-time WebSocket events |
| `fireex://api-contracts/mqtt-topics.md` | MQTT topic structure, QoS, payloads |
| `fireex://projects/backend.md` | Backend project structure and implementation notes |
| `fireex://projects/mobile-app.md` | Mobile app screens, navigation, state |
| `fireex://projects/web-admin.md` | Web admin routes, pages, role separation |
| `fireex://projects/hardware-firmware.md` | ESP32 firmware, sensors, MQTT client |
| `fireex://projects/hardware-ui.md` | ESP32-S3 + LVGL display screens |
| `fireex://decisions/architecture-decisions.md` | All ADRs with rationale |
| `fireex://status/project-status.md` | Current state of every sub-project |

---

## Keeping the Server Updated

The MCP server reads files **at request time** — there is no cache. When you update any markdown file in this repo, the next resource read will return the new content automatically. No server restart needed.

---

## Troubleshooting

**Server not appearing in Claude Code:**
- Run `/mcp` in the Claude Code terminal to see connected servers and their status
- Verify `.mcp.json` is at the project root (not inside `.claude/`)
- Check the path in `args` matches your actual machine path
- Reconnect with `/mcp` → Reconnect

**"Module not found" error on start:**
- Run `npm install` inside `fireex-shared/mcp-server/`

**Wrong number of resources (not 20):**
- New markdown files added to the repo are picked up automatically on next server start
- If resources are missing, check that the file is inside one of the scanned directories: `.`, `architecture/`, `data-models/`, `api-contracts/`, `projects/`, `decisions/`, `status/`

---

## How to Start a Dev Session (Recommended Flow)

At the beginning of every Claude session in any FireEx sub-project:

1. Confirm the `fireex-shared` MCP server shows as connected (`/mcp`)
2. Run the context prompt for your project:
   ```
   /mcp fireex-shared fireex-context project=<your-project>
   ```
3. Work normally — Claude now has full platform context

When you make significant changes (new API endpoint, data model change, architectural decision):
1. Update the relevant file(s) in `fireex-shared/`
2. The change is immediately available to all future sessions (no restart needed)

---

## File Ownership (Who Updates What)

| File | Responsible project |
|------|---------------------|
| `api-contracts/rest-api.md` | `fireex-backend` |
| `api-contracts/mqtt-topics.md` | `fireex-backend` + `fireex-firmware` |
| `api-contracts/websocket-events.md` | `fireex-backend` |
| `data-models/*.md` | `fireex-backend` |
| `projects/mobile-app.md` | `fireex-mobile` |
| `projects/web-admin.md` | `fireex-web` |
| `projects/hardware-firmware.md` | `fireex-firmware` |
| `projects/hardware-ui.md` | `fireex-ui` |
| `projects/backend.md` | `fireex-backend` |
| `decisions/architecture-decisions.md` | Any project (append only) |
| `status/project-status.md` | Any project (update your own section) |
