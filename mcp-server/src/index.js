import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { readdir, readFile } from "node:fs/promises";
import { join, relative, extname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..");

// Directories to scan for markdown files (relative to repo root)
const SCAN_DIRS = [
  ".",              // README.md
  "architecture",
  "data-models",
  "api-contracts",
  "projects",
  "decisions",
  "status",
];

async function collectMarkdownFiles() {
  const files = [];
  for (const dir of SCAN_DIRS) {
    const absDir = join(REPO_ROOT, dir);
    let entries;
    try {
      entries = await readdir(absDir);
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (extname(entry) === ".md") {
        const absPath = join(absDir, entry);
        const relPath = relative(REPO_ROOT, absPath).replace(/\\/g, "/");
        files.push({ absPath, relPath });
      }
    }
  }
  return files;
}

function relPathToUri(relPath) {
  // e.g. "architecture/system-overview.md" → "fireex://architecture/system-overview.md"
  return `fireex://${relPath}`;
}

function relPathToTitle(relPath) {
  const name = relPath.replace(/\.md$/, "").replace(/\//g, " / ");
  return name.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const server = new McpServer({
  name: "fireex-shared",
  version: "1.0.0",
});

// Register a prompt that explains how to use this server
server.registerPrompt(
  "fireex-context",
  {
    title: "FireEx Shared Context",
    description: "Load the recommended FireEx shared context files for a given sub-project",
    argsSchema: {
      type: "object",
      properties: {
        project: {
          type: "string",
          description: "Which sub-project you are working in: backend, mobile, web, firmware, ui",
          enum: ["backend", "mobile", "web", "firmware", "ui"],
        },
      },
      required: ["project"],
    },
  },
  async ({ project }) => {
    const projectFileMap = {
      backend:  ["README.md", "architecture/system-overview.md", "architecture/tech-stack.md", "architecture/data-flow.md", "status/project-status.md", "projects/backend.md", "api-contracts/rest-api.md", "api-contracts/mqtt-topics.md", "api-contracts/websocket-events.md", "data-models/users.md", "data-models/devices.md", "data-models/alerts.md", "data-models/tickets.md", "data-models/buildings-rooms.md"],
      mobile:   ["README.md", "architecture/system-overview.md", "architecture/tech-stack.md", "status/project-status.md", "projects/mobile-app.md", "api-contracts/rest-api.md", "api-contracts/websocket-events.md"],
      web:      ["README.md", "architecture/system-overview.md", "architecture/tech-stack.md", "status/project-status.md", "projects/web-admin.md", "api-contracts/rest-api.md", "api-contracts/websocket-events.md"],
      firmware: ["README.md", "architecture/system-overview.md", "architecture/tech-stack.md", "status/project-status.md", "projects/hardware-firmware.md", "api-contracts/mqtt-topics.md"],
      ui:       ["README.md", "architecture/system-overview.md", "architecture/tech-stack.md", "status/project-status.md", "projects/hardware-ui.md"],
    };

    const files = projectFileMap[project] ?? projectFileMap.backend;
    const contents = await Promise.all(
      files.map(async (relPath) => {
        const absPath = join(REPO_ROOT, relPath);
        const text = await readFile(absPath, "utf-8").catch(() => `[File not found: ${relPath}]`);
        return `\n\n---\n## ${relPath}\n\n${text}`;
      })
    );

    return {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `You are working on the FireEx sub-project: **${project}**.\n\nHere is the full shared context from the fireex-shared knowledge base. Read this before doing any work:\n${contents.join("")}`,
          },
        },
      ],
    };
  }
);

// Dynamically register all markdown files as resources
const markdownFiles = await collectMarkdownFiles();

for (const { absPath, relPath } of markdownFiles) {
  const uri = relPathToUri(relPath);
  const title = relPathToTitle(relPath);

  server.registerResource(
    relPath,
    uri,
    {
      title,
      mimeType: "text/markdown",
      description: `FireEx shared knowledge base: ${relPath}`,
    },
    async (resourceUri) => {
      const text = await readFile(absPath, "utf-8");
      return {
        contents: [{ uri: resourceUri.href, text }],
      };
    }
  );
}

process.stderr.write(
  `fireex-shared MCP server ready — ${markdownFiles.length} resources registered\n`
);

const transport = new StdioServerTransport();
await server.connect(transport);
