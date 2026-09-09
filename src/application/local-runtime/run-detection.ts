import { readFile, readdir, stat } from "node:fs/promises";
import { basename, join } from "node:path";
import type { RunConfiguration, RunPort } from "../../domain/run-configuration.js";

/** A proposal, never a fact: detection reads what the repository already
    declares and offers it, and the operator is the one who accepts. Each draft
    names the file it came from so the offer can be checked rather than
    trusted. */
export type RunConfigurationDraft = RunConfiguration & { source: string };

const ignoredDirectories = new Set([".git", ".ade", "node_modules", "dist", "build", "target", "out", "vendor", ".gradle", ".idea", ".vscode"]);
const runnableScripts = ["start", "dev", "serve"] as const;
const qualityScripts = ["build", "test", "lint"] as const;

export async function detectRunConfigurations(projectRoot: string): Promise<readonly RunConfigurationDraft[]> {
  const directories = [projectRoot, ...(await immediateSubdirectories(projectRoot))];
  const drafts: RunConfigurationDraft[] = [];
  for (const directory of directories) {
    drafts.push(...await detectNode(projectRoot, directory));
    drafts.push(...await detectMaven(projectRoot, directory));
    drafts.push(...await detectGradle(projectRoot, directory));
    drafts.push(...await detectPython(projectRoot, directory));
    drafts.push(...await detectRust(projectRoot, directory));
    drafts.push(...await detectGo(projectRoot, directory));
    drafts.push(...await detectDotnet(projectRoot, directory));
  }
  const unique = drafts.filter((draft, index) => drafts.findIndex((candidate) => candidate.id === draft.id) === index);
  const servers = unique.filter((draft) => draft.ports?.some((port) => port.protocol === "http"));
  /** Two halves of one application are started together far more often than
      apart, so the compound is offered as soon as both are visible. */
  if (servers.length > 1) {
    unique.push({
      id: "full-stack",
      label: "Full stack",
      kind: "compound",
      members: servers.map((draft) => draft.id),
      source: servers.map((draft) => draft.source).join(", "),
    });
  }
  return unique;
}

async function immediateSubdirectories(projectRoot: string): Promise<readonly string[]> {
  const entries = await readdir(projectRoot, { withFileTypes: true }).catch(() => []);
  return entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith(".") && !ignoredDirectories.has(entry.name))
    .map((entry) => join(projectRoot, entry.name));
}

async function readJson(path: string): Promise<Record<string, unknown> | undefined> {
  const text = await readFile(path, "utf8").catch(() => undefined);
  if (text === undefined) return undefined;
  try { return JSON.parse(text) as Record<string, unknown>; } catch { return undefined; }
}

async function exists(path: string): Promise<boolean> {
  return stat(path).then(() => true).catch(() => false);
}

function relativeLabel(projectRoot: string, directory: string): string {
  return directory === projectRoot ? "" : basename(directory);
}

function identifier(prefix: string, name: string): string {
  return [prefix, name].filter(Boolean).join("-").toLowerCase().replaceAll(/[^a-z0-9-]+/g, "-").replaceAll(/-+/g, "-").replace(/^-|-$/g, "");
}

function cwdToken(projectRoot: string, directory: string): string {
  const suffix = relativeLabel(projectRoot, directory);
  return suffix ? `\${projectRoot}/${suffix}` : "${projectRoot}";
}

function sourceLabel(projectRoot: string, directory: string, fileName: string): string {
  const prefix = relativeLabel(projectRoot, directory);
  return [prefix, fileName].filter(Boolean).join("/");
}

function toolchainId(projectRoot: string, directory: string, toolchain: string, operation: string): string {
  const prefix = relativeLabel(projectRoot, directory);
  return identifier(prefix ? `${prefix}-${toolchain}` : toolchain, operation);
}

function toolchainLabel(projectRoot: string, directory: string, toolchain: string, operation: string): string {
  const prefix = relativeLabel(projectRoot, directory);
  return [prefix, toolchain, operation].filter(Boolean).join(" · ");
}

function commandDraft(
  projectRoot: string,
  directory: string,
  toolchain: string,
  operation: string,
  command: string,
  args: readonly string[],
  source: string,
): RunConfigurationDraft {
  /** A proposal that builds or tests is proposed as verification too, so a
      Project that accepts it gets gates backed by a real exit code instead of
      by the existence of a ChangeSet. Lint stands for neither gate. */
  const verifies = operation === "build" ? "build" as const : operation === "test" ? "tests" as const : undefined;
  return {
    id: toolchainId(projectRoot, directory, toolchain, operation),
    label: toolchainLabel(projectRoot, directory, toolchain, operation),
    kind: "command",
    command,
    args,
    cwd: cwdToken(projectRoot, directory),
    ...(verifies ? { verifies } : {}),
    source,
  };
}

/** The port is only proposed when a framework that documents one is actually a
    dependency; guessing it would put a wrong number in front of the operator
    with the same confidence as a right one. */
function frameworkPort(dependencies: Record<string, unknown>, hasAngularJson: boolean): RunPort | undefined {
  if (hasAngularJson || dependencies["@angular/core"]) return { name: "web", port: 4200, protocol: "http", bind: "loopback" };
  if (dependencies.next) return { name: "web", port: 3000, protocol: "http", bind: "loopback" };
  if (dependencies["react-scripts"]) return { name: "web", port: 3000, protocol: "http", bind: "loopback" };
  if (dependencies.vite) return { name: "web", port: 5173, protocol: "http", bind: "loopback" };
  return undefined;
}

async function detectNode(projectRoot: string, directory: string): Promise<readonly RunConfigurationDraft[]> {
  const manifest = await readJson(join(directory, "package.json"));
  if (!manifest) return [];
  const scripts = (manifest.scripts ?? {}) as Record<string, string>;
  const dependencies = { ...(manifest.dependencies as Record<string, unknown>), ...(manifest.devDependencies as Record<string, unknown>) };
  const port = frameworkPort(dependencies, await exists(join(directory, "angular.json")));
  const prefix = relativeLabel(projectRoot, directory);
  const drafts: RunConfigurationDraft[] = [];
  const runnable = runnableScripts.find((script) => scripts[script]);
  const scriptsToDetect = [...new Set([
    runnable,
    ...qualityScripts.filter((script) => scripts[script]),
  ].filter(Boolean))] as string[];
  for (const script of scriptsToDetect) {
    drafts.push({
      id: identifier(prefix, script),
      label: [prefix, script].filter(Boolean).join(" · ") || script,
      kind: "command",
      command: "npm",
      args: ["run", script],
      cwd: cwdToken(projectRoot, directory),
      ...(script === "build" ? { verifies: "build" as const } : script === "test" ? { verifies: "tests" as const } : {}),
      ...(script === runnable && port ? { ports: [port] } : {}),
      source: [prefix, "package.json"].filter(Boolean).join("/"),
    });
  }
  return drafts;
}

async function detectMaven(projectRoot: string, directory: string): Promise<readonly RunConfigurationDraft[]> {
  const pom = await readFile(join(directory, "pom.xml"), "utf8").catch(() => undefined);
  if (!pom) return [];
  const wrapperName = process.platform === "win32" ? "mvnw.cmd" : "mvnw";
  const wrapper = await wrapperInvocation(directory, wrapperName);
  const prefix = relativeLabel(projectRoot, directory);
  const command = wrapper?.command ?? "mvn";
  const wrapperArgs = wrapper?.args ?? [];
  const source = sourceLabel(projectRoot, directory, "pom.xml");
  const drafts: RunConfigurationDraft[] = [
    commandDraft(projectRoot, directory, "maven", "build", command, [...wrapperArgs, "verify"], source),
    commandDraft(projectRoot, directory, "maven", "test", command, [...wrapperArgs, "test"], source),
  ];
  if (pom.includes("spring-boot") && await hasSpringBootEntryPoint(directory, pom)) {
    drafts.unshift({
      id: identifier(prefix, "spring-boot"),
      label: [prefix, "Spring Boot"].filter(Boolean).join(" · "),
      kind: "command",
      command,
      args: [...wrapperArgs, "spring-boot:run"],
      cwd: cwdToken(projectRoot, directory),
      ports: [{ name: "api", port: 8080, protocol: "http", bind: "loopback" }],
      debug: {
        args: [...wrapperArgs, "spring-boot:run", "-Dspring-boot.run.jvmArguments=-agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=5005"],
        port: 5005,
        protocol: "jdwp",
        attachHint: "Attach a JVM debugger to localhost:5005",
      },
      source,
    });
  }
  return drafts;
}

async function detectGradle(projectRoot: string, directory: string): Promise<readonly RunConfigurationDraft[]> {
  const buildFile = await readFile(join(directory, "build.gradle"), "utf8").then((content) => ({ name: "build.gradle", content })).catch(() => readFile(join(directory, "build.gradle.kts"), "utf8").then((content) => ({ name: "build.gradle.kts", content })).catch(() => undefined));
  if (!buildFile) return [];
  const wrapperName = process.platform === "win32" ? "gradlew.bat" : "gradlew";
  const wrapper = await wrapperInvocation(directory, wrapperName);
  const prefix = relativeLabel(projectRoot, directory);
  const command = wrapper?.command ?? "gradle";
  const wrapperArgs = wrapper?.args ?? [];
  const source = sourceLabel(projectRoot, directory, buildFile.name);
  const drafts: RunConfigurationDraft[] = [
    commandDraft(projectRoot, directory, "gradle", "build", command, [...wrapperArgs, "build"], source),
    commandDraft(projectRoot, directory, "gradle", "test", command, [...wrapperArgs, "test"], source),
  ];
  if (buildFile.content.includes("org.springframework.boot") && await hasSpringBootEntryPoint(directory, buildFile.content)) {
    drafts.unshift({
      id: identifier(prefix, "boot-run"),
      label: [prefix, "Spring Boot"].filter(Boolean).join(" · "),
      kind: "command",
      command,
      args: [...wrapperArgs, "bootRun"],
      cwd: cwdToken(projectRoot, directory),
      ports: [{ name: "api", port: 8080, protocol: "http", bind: "loopback" }],
      debug: { args: [...wrapperArgs, "bootRun", "--debug-jvm"], port: 5005, protocol: "jdwp", attachHint: "Attach a JVM debugger to localhost:5005" },
      source,
    });
  }
  return drafts;
}

async function detectPython(projectRoot: string, directory: string): Promise<readonly RunConfigurationDraft[]> {
  const pyproject = await readFile(join(directory, "pyproject.toml"), "utf8").catch(() => undefined);
  if (!pyproject) return [];
  const requirements = await readFile(join(directory, "requirements.txt"), "utf8").catch(() => "");
  const declared = `${pyproject}\n${requirements}`;
  const source = sourceLabel(projectRoot, directory, "pyproject.toml");
  const runner = await exists(join(directory, "uv.lock")) || /\[tool\.uv\]/.test(pyproject)
    ? { command: "uv", prefix: ["run"] }
    : await exists(join(directory, "poetry.lock")) || /\[tool\.poetry\]/.test(pyproject)
      ? { command: "poetry", prefix: ["run"] }
      : { command: "python", prefix: [] };
  const drafts: RunConfigurationDraft[] = [];
  if (/\[build-system\]/.test(pyproject)) drafts.push(commandDraft(projectRoot, directory, "python", "build", runner.command, [...runner.prefix, "-m", "build"], source));
  if (/\[tool\.pytest(?:\.|\])|(?:^|[\s=])pytest(?:[<=>\s]|$)/m.test(declared)) drafts.push(commandDraft(projectRoot, directory, "python", "test", runner.command, [...runner.prefix, "-m", "pytest"], source));
  if (/\[tool\.ruff(?:\.|\])|(?:^|[\s=])ruff(?:[<=>\s]|$)/m.test(declared)) drafts.push(commandDraft(projectRoot, directory, "python", "lint", runner.command, [...runner.prefix, "ruff", "check", "."], source));
  if (/\[tool\.mypy(?:\.|\])|(?:^|[\s=])mypy(?:[<=>\s]|$)/m.test(declared)) drafts.push(commandDraft(projectRoot, directory, "python", "typecheck", runner.command, [...runner.prefix, "mypy", "."], source));
  return drafts;
}

async function detectRust(projectRoot: string, directory: string): Promise<readonly RunConfigurationDraft[]> {
  if (!await exists(join(directory, "Cargo.toml"))) return [];
  const source = sourceLabel(projectRoot, directory, "Cargo.toml");
  return [
    commandDraft(projectRoot, directory, "cargo", "build", "cargo", ["build", "--workspace"], source),
    commandDraft(projectRoot, directory, "cargo", "test", "cargo", ["test", "--workspace"], source),
    commandDraft(projectRoot, directory, "cargo", "lint", "cargo", ["clippy", "--workspace", "--all-targets", "--all-features"], source),
  ];
}

async function detectGo(projectRoot: string, directory: string): Promise<readonly RunConfigurationDraft[]> {
  if (!await exists(join(directory, "go.mod"))) return [];
  const source = sourceLabel(projectRoot, directory, "go.mod");
  return [
    commandDraft(projectRoot, directory, "go", "build", "go", ["build", "./..."], source),
    commandDraft(projectRoot, directory, "go", "test", "go", ["test", "./..."], source),
    commandDraft(projectRoot, directory, "go", "lint", "go", ["vet", "./..."], source),
  ];
}

async function detectDotnet(projectRoot: string, directory: string): Promise<readonly RunConfigurationDraft[]> {
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
  const manifest = entries.find((entry) => entry.isFile() && /\.sln$/.test(entry.name))
    ?? entries.find((entry) => entry.isFile() && /\.csproj$/.test(entry.name));
  if (!manifest) return [];
  const source = sourceLabel(projectRoot, directory, manifest.name);
  const target = [manifest.name];
  const drafts = [
    commandDraft(projectRoot, directory, "dotnet", "build", "dotnet", ["build", ...target], source),
    commandDraft(projectRoot, directory, "dotnet", "test", "dotnet", ["test", ...target], source),
  ];
  if (await exists(join(directory, ".editorconfig"))) {
    drafts.push(commandDraft(projectRoot, directory, "dotnet", "lint", "dotnet", ["format", ...target, "--verify-no-changes"], source));
  }
  return drafts;
}

type WrapperInvocation = { command: string; args: readonly string[] };

/** A wrapper copied from a zip or checked out with broken executable bits is
    still usable on POSIX, but spawning `./mvnw` would fail with EACCES. Invoke
    it through `sh` in that case; on Windows cross-spawn handles the `.cmd`
    entry point directly. */
async function wrapperInvocation(directory: string, name: string): Promise<WrapperInvocation | undefined> {
  const path = join(directory, name);
  if (!await exists(path)) return undefined;
  if (process.platform === "win32") return { command: name, args: [] };
  const executable = await stat(path).then((entry) => (entry.mode & 0o111) !== 0).catch(() => false);
  return executable ? { command: `./${name}`, args: [] } : { command: "sh", args: [`./${name}`] };
}

/** Spring Boot's plugin can be inherited by every module in a reactor. A
    plugin mention is therefore not enough evidence that the current directory
    is runnable. Require a configured main class or a real source entry point;
    aggregators with `<packaging>pom</packaging>` consequently offer build/test
    but never a misleading application run. */
async function hasSpringBootEntryPoint(directory: string, buildFile: string): Promise<boolean> {
  if (configuredMainClass(buildFile)) return true;
  if (/<packaging>\s*pom\s*<\/packaging>/i.test(buildFile) || /<modules\s*>/i.test(buildFile)) return false;
  for (const sourceRoot of ["src/main/java", "src/main/kotlin", "src/main/groovy"]) {
    if (await sourceTreeHasMain(join(directory, sourceRoot))) return true;
  }
  return false;
}

function configuredMainClass(buildFile: string): boolean {
  return /<(?:mainClass|start-class)>\s*[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*\s*<\//i.test(buildFile)
    || /spring-boot\.run\.main-class\s*[=:]\s*[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*/i.test(buildFile);
}

async function sourceTreeHasMain(root: string, depth = 0): Promise<boolean> {
  if (depth > 8) return false;
  const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (entry.name.startsWith(".") || ignoredDirectories.has(entry.name)) continue;
    const path = join(root, entry.name);
    if (entry.isDirectory() && await sourceTreeHasMain(path, depth + 1)) return true;
    if (!entry.isFile() || !/\.(?:java|kt|groovy)$/.test(entry.name)) continue;
    const source = await readFile(path, "utf8").catch(() => "");
    if (/(?:static\s+void\s+main\s*\(|\bfun\s+main\s*\()/s.test(source)
      && /@SpringBoot(?:Application|Configuration)\b|\bSpringApplication\.run\s*\(|\brunApplication\s*</.test(source)) return true;
  }
  return false;
}
