import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { join, relative, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { z } from "zod";

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

// ── Write tools ──────────────────────────────────────────────────────────────

// Allowed paths: only markdown files inside the scanned directories
function isAllowedPath(relPath) {
  const normalized = relPath.replace(/\\/g, "/").replace(/^\//, "");
  const inScanDir = SCAN_DIRS.some((d) =>
    d === "." ? !normalized.includes("/") : normalized.startsWith(d + "/")
  );
  return inScanDir && normalized.endsWith(".md");
}

server.tool(
  "update_file",
  "Write new content to a fireex-shared markdown file. Use this to update specs, data models, API contracts, or any other shared documentation after a decision is made in a sub-project session.",
  {
    path: z.string().describe("Repo-relative path, e.g. 'projects/hardware-ui.md'"),
    content: z.string().describe("Full new content of the file (replaces existing content)"),
  },
  async ({ path: relPath, content }) => {
    if (!isAllowedPath(relPath)) {
      return {
        content: [{ type: "text", text: `Error: '${relPath}' is not an allowed path. Must be a .md file inside one of: ${SCAN_DIRS.join(", ")}` }],
        isError: true,
      };
    }
    const absPath = join(REPO_ROOT, relPath);
    await mkdir(dirname(absPath), { recursive: true });
    await writeFile(absPath, content, "utf-8");
    return {
      content: [{ type: "text", text: `Updated: ${relPath}` }],
    };
  }
);

server.tool(
  "read_file",
  "Read the current content of a fireex-shared markdown file. Use this before updating a file so you can make targeted edits rather than replacing the whole thing.",
  {
    path: z.string().describe("Repo-relative path, e.g. 'projects/hardware-ui.md'"),
  },
  async ({ path: relPath }) => {
    if (!isAllowedPath(relPath)) {
      return {
        content: [{ type: "text", text: `Error: '${relPath}' is not an allowed path.` }],
        isError: true,
      };
    }
    const absPath = join(REPO_ROOT, relPath);
    const text = await readFile(absPath, "utf-8").catch(() => null);
    if (text === null) {
      return { content: [{ type: "text", text: `File not found: ${relPath}` }], isError: true };
    }
    return { content: [{ type: "text", text }] };
  }
);

server.tool(
  "list_files",
  "List all markdown files currently tracked in the fireex-shared knowledge base.",
  {},
  async () => {
    const files = await collectMarkdownFiles();
    const list = files.map((f) => f.relPath).join("\n");
    return { content: [{ type: "text", text: list }] };
  }
);

server.tool(
  "preview_commit",
  "Show a diff of all pending changes in fireex-shared WITHOUT committing. Always call this before git_commit so the user can review and confirm what will be saved.",
  {},
  async () => {
    try {
      execSync(`git -C "${REPO_ROOT}" add -A`, { stdio: "pipe" });
      const diff = execSync(`git -C "${REPO_ROOT}" diff --cached --stat`, { stdio: "pipe" }).toString().trim();
      if (!diff) {
        return { content: [{ type: "text", text: "No changes staged — working tree is clean." }] };
      }
      const fullDiff = execSync(`git -C "${REPO_ROOT}" diff --cached`, { stdio: "pipe" }).toString().trim();
      return {
        content: [{ type: "text", text: `Pending changes:\n\n${diff}\n\n---\n\n${fullDiff}\n\n---\nReview the above and confirm before calling git_commit.` }],
      };
    } catch (err) {
      return { content: [{ type: "text", text: `Git error: ${err.message}` }], isError: true };
    }
  }
);

server.tool(
  "git_commit",
  "Commit all staged changes in fireex-shared. MUST call preview_commit first and get explicit user confirmation before calling this.",
  {
    message: z.string().describe("Commit message describing what changed and why"),
    confirmed: z.boolean().describe("Set to true only after the user has reviewed preview_commit output and explicitly said yes/confirmed"),
  },
  async ({ message, confirmed }) => {
    if (!confirmed) {
      return {
        content: [{ type: "text", text: "Blocked: call preview_commit first and get explicit user confirmation, then call git_commit with confirmed=true." }],
        isError: true,
      };
    }
    try {
      const safeMessage = message.replace(/"/g, '\\"');
      execSync(`git -C "${REPO_ROOT}" add -A`, { stdio: "pipe" });
      const result = execSync(`git -C "${REPO_ROOT}" commit -m "${safeMessage}"`, { stdio: "pipe" });
      return { content: [{ type: "text", text: result.toString().trim() }] };
    } catch (err) {
      const msg = err.stdout?.toString().trim() || err.message;
      if (msg.includes("nothing to commit")) {
        return { content: [{ type: "text", text: "Nothing to commit — working tree clean." }] };
      }
      return { content: [{ type: "text", text: `Git error: ${msg}` }], isError: true };
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────

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
