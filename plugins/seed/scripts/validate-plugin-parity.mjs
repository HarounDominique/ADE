import { readFile } from "node:fs/promises";
import { access, readdir } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const claudeManifestPath = join(root, ".claude-plugin", "plugin.json");
const codexManifestPath = join(root, ".codex-plugin", "plugin.json");
const codexMarketplacePath = join(root, ".agents", "plugins", "marketplace.json");

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const requireFile = async (path) => access(path, constants.R_OK);
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const claude = await readJson(claudeManifestPath);
const codex = await readJson(codexManifestPath);
const marketplace = await readJson(codexMarketplacePath);
assert(claude.name === codex.name, "Claude and Codex plugin names must match");
assert(claude.license === codex.license, "Claude and Codex plugin licenses must match");
assert(claude.version === codex.version, "Claude and Codex plugin versions must match");
assert(typeof codex.skills === "string", "Codex manifest must declare a skills directory");
assert(marketplace.name === codex.name, "Codex marketplace and plugin names must match");
assert(Array.isArray(marketplace.plugins), "Codex marketplace must declare plugins");
const listing = marketplace.plugins.find((plugin) => plugin?.name === codex.name);
assert(listing?.source?.source === "local" && listing.source.path === "./", "Codex marketplace must point at the repository plugin");

const skillsRoot = join(root, codex.skills.replace(/^\.\//, ""));
const entries = await readdir(skillsRoot, { withFileTypes: true });
const skills = entries.filter((entry) => entry.isDirectory());
assert(skills.length > 0, "Codex plugin must publish at least one skill");
const commandsRoot = join(root, "commands");
const commands = (await readdir(commandsRoot, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
  .map((entry) => `seed-${entry.name.slice(0, -3)}`)
  .sort();
const publishedSkills = skills.map((skill) => skill.name).sort();
const hostSkills = ["seed-workflow"];
const expectedSkills = [...commands, ...hostSkills].sort();
assert(JSON.stringify(publishedSkills) === JSON.stringify(expectedSkills),
  `Codex skills must map to Claude commands plus host skills. Commands=${commands.join(",")} skills=${publishedSkills.join(",")}`);
for (const skill of skills) {
  const path = join(skillsRoot, skill.name, "SKILL.md");
  await requireFile(path);
  const body = await readFile(path, "utf8");
  assert(body.startsWith("---\n"), `${skill.name}: SKILL.md is missing frontmatter`);
  assert(new RegExp(`^name: ${skill.name}$`, "m").test(body), `${skill.name}: frontmatter name must match its directory`);
  assert(/^description: .+$/m.test(body), `${skill.name}: frontmatter description is required`);
  assert(!body.includes("${CLAUDE_PLUGIN_ROOT}"), `${skill.name}: Codex skill contains a Claude-only root placeholder`);
}

console.log(`Plugin parity OK: Claude ${claude.version}, Codex ${codex.version}, ${skills.length} Codex skills`);
