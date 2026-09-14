import { cp, readFile, readdir, stat } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const tracked = [
  ".agents/plugins/marketplace.json",
  ".claude-plugin/plugin.json",
  ".claude-plugin/marketplace.json",
  ".codex-plugin/plugin.json",
  "agents",
  "commands",
  "context",
  "scripts/commit-guard.mjs",
  "scripts/init-state-db.mjs",
  "scripts/session-end-log.mjs",
  "scripts/validate-plugin-parity.mjs",
  "skills",
  "templates",
  "CHANGELOG.md",
  "LICENSE",
  "README.md",
  "SPEC-NEXUS.md",
  "SPEC-codex-integration.md",
  "SPEC-portability-verification.md",
  "SPEC-provider-contract.md",
];

const args = process.argv.slice(2);
const mode = args.includes("--sync") ? "sync" : "check";
const sourceArg = args[args.indexOf("--source") + 1];
const source = resolve(root, sourceArg && !sourceArg.startsWith("--") ? sourceArg : "../seed");
const destination = join(root, "plugins", "seed");

async function sameFile(left, right) {
  try {
    const [a, b] = await Promise.all([readFile(left), readFile(right)]);
    return a.equals(b);
  } catch {
    return false;
  }
}

async function filesUnder(path, prefix = "") {
  const info = await stat(path);
  if (info.isFile()) return [prefix];
  const children = await readdir(path, { withFileTypes: true });
  const result = [];
  for (const child of children) {
    const childPath = join(path, child.name);
    const childPrefix = join(prefix, child.name);
    if (child.isDirectory()) result.push(...await filesUnder(childPath, childPrefix));
    else if (child.isFile()) result.push(childPrefix);
  }
  return result;
}

async function sameEntry(left, right) {
  try {
    const [leftInfo, rightInfo] = await Promise.all([stat(left), stat(right)]);
    if (leftInfo.isDirectory() !== rightInfo.isDirectory()) return false;
    if (leftInfo.isFile()) return sameFile(left, right);
    const [leftFiles, rightFiles] = await Promise.all([filesUnder(left), filesUnder(right)]);
    if (leftFiles.length !== rightFiles.length || leftFiles.some((file) => !rightFiles.includes(file))) return false;
    return Promise.all(leftFiles.map((file) => sameFile(join(left, file), join(right, file)))).then((matches) => matches.every(Boolean));
  } catch {
    return false;
  }
}

async function exists(path) {
  try { await stat(path); return true; } catch { return false; }
}

const drift = [];
for (const path of tracked) {
  const from = join(source, path);
  const to = join(destination, path);
  if (!(await exists(from))) {
    drift.push(`${path}: missing from source`);
  } else if (!(await sameEntry(from, to))) {
    drift.push(path);
    if (mode === "sync") await cp(from, to, { recursive: true });
  }
}

if (mode === "check" && drift.length) {
  console.error(`SEED vendor drift (${drift.length}):\n${drift.map((path) => `- ${path}`).join("\n")}`);
  process.exitCode = 1;
} else if (mode === "sync") {
  console.log(drift.length ? `SEED vendor synchronized: ${drift.length} path(s)` : "SEED vendor already synchronized");
} else {
  console.log(`SEED vendor check OK: ${tracked.length} paths`);
}

console.log(`source=${source}`);
console.log(`destination=${destination}`);
