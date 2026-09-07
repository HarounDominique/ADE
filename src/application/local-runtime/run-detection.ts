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

export async function detectRunConfigurations(projectRoot: string): Promise<readonly RunConfigurationDraft[]> {
  const directories = [projectRoot, ...(await immediateSubdirectories(projectRoot))];
  const drafts: RunConfigurationDraft[] = [];
  for (const directory of directories) {
    drafts.push(...await detectNode(projectRoot, directory));
    drafts.push(...await detectMaven(projectRoot, directory));
    drafts.push(...await detectGradle(projectRoot, directory));
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
  for (const script of [runnable, scripts.test ? "test" : undefined].filter((value): value is string => Boolean(value))) {
    drafts.push({
      id: identifier(prefix, script),
      label: [prefix, script].filter(Boolean).join(" · ") || script,
      kind: "command",
      command: "npm",
      args: ["run", script],
      cwd: cwdToken(projectRoot, directory),
      ...(script === runnable && port ? { ports: [port] } : {}),
      source: [prefix, "package.json"].filter(Boolean).join("/"),
    });
  }
  return drafts;
}

async function detectMaven(projectRoot: string, directory: string): Promise<readonly RunConfigurationDraft[]> {
  const pom = await readFile(join(directory, "pom.xml"), "utf8").catch(() => undefined);
  if (!pom || !pom.includes("spring-boot")) return [];
  const wrapper = await exists(join(directory, process.platform === "win32" ? "mvnw.cmd" : "mvnw"));
  const prefix = relativeLabel(projectRoot, directory);
  return [{
    id: identifier(prefix, "spring-boot"),
    label: [prefix, "Spring Boot"].filter(Boolean).join(" · "),
    kind: "command",
    // cmd.exe does not understand the POSIX `./mvnw` spelling. Maven projects
    // ship a dedicated batch wrapper on Windows, which also avoids requiring a
    // machine-wide Maven installation.
    command: wrapper ? (process.platform === "win32" ? "mvnw.cmd" : "./mvnw") : "mvn",
    args: ["spring-boot:run"],
    cwd: cwdToken(projectRoot, directory),
    ports: [{ name: "api", port: 8080, protocol: "http", bind: "loopback" }],
    debug: {
      args: ["spring-boot:run", "-Dspring-boot.run.jvmArguments=-agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=5005"],
      port: 5005,
      protocol: "jdwp",
      attachHint: "Attach a JVM debugger to localhost:5005",
    },
    source: [prefix, "pom.xml"].filter(Boolean).join("/"),
  }];
}

async function detectGradle(projectRoot: string, directory: string): Promise<readonly RunConfigurationDraft[]> {
  const build = await readFile(join(directory, "build.gradle"), "utf8").catch(() => readFile(join(directory, "build.gradle.kts"), "utf8").catch(() => undefined));
  if (!build || !build.includes("org.springframework.boot")) return [];
  const wrapper = await exists(join(directory, process.platform === "win32" ? "gradlew.bat" : "gradlew"));
  const prefix = relativeLabel(projectRoot, directory);
  return [{
    id: identifier(prefix, "boot-run"),
    label: [prefix, "Spring Boot"].filter(Boolean).join(" · "),
    kind: "command",
    command: wrapper ? (process.platform === "win32" ? "gradlew.bat" : "./gradlew") : "gradle",
    args: ["bootRun"],
    cwd: cwdToken(projectRoot, directory),
    ports: [{ name: "api", port: 8080, protocol: "http", bind: "loopback" }],
    debug: { args: ["bootRun", "--debug-jvm"], port: 5005, protocol: "jdwp", attachHint: "Attach a JVM debugger to localhost:5005" },
    source: [prefix, "build.gradle"].filter(Boolean).join("/"),
  }];
}
