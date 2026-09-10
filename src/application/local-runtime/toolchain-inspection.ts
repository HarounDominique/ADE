import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import crossSpawn from "cross-spawn";
import { runtimeEnvironment } from "../../adapters/local-process.js";

export type ToolchainStatus = {
  id: string;
  label: string;
  command: string;
  available: boolean;
  version?: string;
  source: string;
  error?: string;
};

const ignoredDirectories = new Set([".git", ".ade", "node_modules", "dist", "build", "target", "out", "vendor", ".gradle", ".idea", ".vscode"]);

/**
 * Checks only the toolchain entry points implied by repository manifests.
 * Version probes are read-only; build, test and lint remain explicit run
 * configurations and are never started by inspection.
 */
export async function inspectProjectToolchains(projectRoot: string): Promise<readonly ToolchainStatus[]> {
  const directories = [projectRoot, ...(await immediateSubdirectories(projectRoot))];
  // Computed once per inspection, not once per probe: it stats every version
  // manager and JDK vendor directory it knows of, and a manifest-heavy Project
  // can imply a probe per language per directory.
  const environment = runtimeEnvironment(undefined);
  const statuses: ToolchainStatus[] = [];
  for (const directory of directories) statuses.push(...await inspectDirectory(projectRoot, directory, environment));
  return statuses.filter((status, index) => statuses.findIndex((candidate) => candidate.id === status.id) === index);
}

async function immediateSubdirectories(projectRoot: string): Promise<readonly string[]> {
  const entries = await readdir(projectRoot, { withFileTypes: true }).catch(() => []);
  return entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith(".") && !ignoredDirectories.has(entry.name))
    .map((entry) => join(projectRoot, entry.name));
}

async function exists(path: string): Promise<boolean> {
  return readFile(path, "utf8").then(() => true).catch(() => false);
}

async function inspectDirectory(projectRoot: string, directory: string, environment: NodeJS.ProcessEnv): Promise<readonly ToolchainStatus[]> {
  const statuses: ToolchainStatus[] = [];
  const directoryPrefix = relative(projectRoot, directory).replaceAll("\\", "/");
  const prefix = directoryPrefix ? `${directoryPrefix}/` : "";
  const source = (file: string) => `${prefix}${file}`;
  const scopedId = (id: string) => identifier(prefix, id);
  if (await exists(join(directory, "package.json"))) statuses.push(await probe(scopedId("node"), "Node/npm", "npm", ["--version"], source("package.json"), directory, environment));
  if (await exists(join(directory, "pyproject.toml"))) {
    const pyproject = await readFile(join(directory, "pyproject.toml"), "utf8").catch(() => "");
    const python = await exists(join(directory, "uv.lock")) || /\[tool\.uv\]/.test(pyproject)
      ? { id: "uv", label: "uv", command: "uv", args: ["--version"] }
      : await exists(join(directory, "poetry.lock")) || /\[tool\.poetry\]/.test(pyproject)
        ? { id: "poetry", label: "Poetry", command: "poetry", args: ["--version"] }
        : { id: "python", label: "Python", command: "python", args: ["--version"] };
    statuses.push(await probe(scopedId(python.id), python.label, python.command, python.args, source("pyproject.toml"), directory, environment));
  }
  if (await exists(join(directory, "pom.xml"))) statuses.push(await probe(scopedId("maven"), "Maven", "mvn", ["--version"], source("pom.xml"), directory, environment));
  if (await exists(join(directory, "build.gradle")) || await exists(join(directory, "build.gradle.kts"))) statuses.push(await probe(scopedId("gradle"), "Gradle", "gradle", ["--version"], source(await exists(join(directory, "build.gradle")) ? "build.gradle" : "build.gradle.kts"), directory, environment));
  if (await exists(join(directory, "Cargo.toml"))) statuses.push(await probe(scopedId("rust"), "Rust/Cargo", "cargo", ["--version"], source("Cargo.toml"), directory, environment));
  if (await exists(join(directory, "go.mod"))) statuses.push(await probe(scopedId("go"), "Go", "go", ["version"], source("go.mod"), directory, environment));
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
  const dotnetManifest = entries.find((entry) => entry.isFile() && /\.(sln|csproj)$/.test(entry.name));
  if (dotnetManifest) statuses.push(await probe(scopedId("dotnet"), ".NET", "dotnet", ["--version"], source(dotnetManifest.name), directory, environment));
  return statuses;
}

function identifier(prefix: string, name: string): string {
  return `${prefix}${name}`.replaceAll(/[^a-z0-9-]+/gi, "-").replaceAll(/-+/g, "-").replace(/^-|-$/g, "").toLowerCase();
}

async function probe(id: string, label: string, command: string, args: readonly string[], source: string, cwd: string, environment: NodeJS.ProcessEnv): Promise<ToolchainStatus> {
  const base = { id, label, command, source };
  return new Promise((resolve) => {
    // A toolchain probe is a question, not a window: on Windows every one of
    // these would otherwise flash a console of its own. The same augmented
    // PATH (and JAVA_HOME) that a run configuration gets through LocalProcess
    // applies here too -- otherwise a version manager's node, cargo or java
    // reads as "unavailable" in this preview and as present the moment the
    // operator actually runs it.
    const child = crossSpawn(command, [...args], { cwd, env: environment, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    let output = "";
    const append = (chunk: Buffer | string) => { output += chunk.toString(); };
    child.stdout?.on("data", append);
    child.stderr?.on("data", append);
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      resolve({ ...base, available: false, error: "version check timed out" });
    }, 1_500);
    child.once("error", (error) => {
      clearTimeout(timer);
      resolve({ ...base, available: false, error: error.message });
    });
    child.once("close", (code) => {
      clearTimeout(timer);
      const version = output.trim().split(/\r?\n/).find(Boolean)?.trim();
      resolve(code === 0 ? { ...base, available: true, ...(version ? { version } : {}) } : { ...base, available: false, ...(version ? { version } : {}), error: `exited with code ${code ?? "unknown"}` });
    });
  });
}
