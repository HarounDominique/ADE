import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { askExecutable } from "../../adapters/ask-command.js";

export type JavaStack = { java: boolean; spring: boolean; markers: readonly string[] };

const ignoredDirectories = new Set([".git", ".ade", "node_modules", "dist", "build", "target", "out", "vendor", ".gradle", ".idea", ".vscode", ".venv"]);
const buildFiles = ["pom.xml", "build.gradle", "build.gradle.kts", "settings.gradle", "settings.gradle.kts"];
const springMarkers = ["spring-boot", "springframework", "org.springframework"];
/** Java sources sit under `src/main/java/<package path>`, so a shallow walk
    would answer "no Java" on every conventional repository. The depth covers a
    module plus its package prefix; the entry budget, not the depth, is what
    keeps a large tree from stalling a turn. */
const maxDepth = 6;
const maxEntries = 4_000;
export async function detectJavaStack(repositoryPath: string): Promise<JavaStack> {
  const markers: string[] = [];
  const rootBuildFiles: string[] = [];
  let java = false;
  let sourceRootJava = false;
  let budget = maxEntries;
  const done = () => java && rootBuildFiles.length > 0;

  const walk = async (directory: string, relative: string, depth: number): Promise<void> => {
    if (depth > maxDepth || budget <= 0 || done()) return;
    const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (budget-- <= 0) return;
      const path = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (ignoredDirectories.has(entry.name) || entry.name.startsWith(".")) continue;
        await walk(join(directory, entry.name), path, depth + 1);
        if (done()) return;
        continue;
      }
      if (entry.name.endsWith(".java")) {
        if (!java) markers.push(path);
        java = true;
        if (/(^|\/)src\/(main|test)\/java\//.test(path)) sourceRootJava = true;
      }
      if (buildFiles.includes(entry.name)) {
        if (!markers.includes(path)) markers.push(path);
        // A build file beside the repository or beside a module is the project's
        // own; one buried in a test fixture describes somebody else's project.
        if (depth <= 1) rootBuildFiles.push(path);
      }
    }
  };

  await walk(repositoryPath, "", 0);
  /** Java in a test fixture is not a Java repository: the tree also has to
      declare it, either with its own build file or with a conventional source
      root. A Python project that ships `.java` fixtures is briefed about
      nothing, which is the correct answer for it. */
  if (!java || (!rootBuildFiles.length && !sourceRootJava)) return { java: false, spring: false, markers: [] };
  const spring = await detectSpring(repositoryPath, rootBuildFiles);
  return { java, spring, markers: [...rootBuildFiles, ...markers.filter((marker) => !rootBuildFiles.includes(marker))].slice(0, 6) };
}

async function detectSpring(repositoryPath: string, buildFilePaths: readonly string[]): Promise<boolean> {
  for (const marker of buildFilePaths) {
    const contents = await readFile(join(repositoryPath, marker), "utf8").catch(() => "");
    if (springMarkers.some((needle) => contents.includes(needle))) return true;
  }
  return false;
}

/** A command the operator has not installed is noise in a prompt: the briefing
    is written only when this machine can actually answer with it. */
export function askIsInstalled(fileExists: (path: string) => boolean = existsSync): boolean {
  const command = askExecutable();
  return /[\\/]/.test(command) ? fileExists(command) : false;
}

export function askBriefingText(stack: JavaStack): string {
  return [
    `[ADE] This repository is ${stack.spring ? "Java/Spring" : "Java"} (${stack.markers.slice(0, 3).join(", ")}). ASK Engine is installed as \`ask\`: it answers structural questions deterministically from a cached model of the repository, so reach for it before re-reading the tree file by file.`,
    "- `ask . --compact` — repository shape and where to start",
    "- `ask endpoints .` — REST surface with effective paths and security policy",
    "- `ask impact <Type> .` — what breaks if that type changes",
    ...(stack.spring ? ["- `ask spring-audit .` — Spring findings; `ask migrate-check .` — Boot 2→3 readiness"] : []),
    "- `ask intent \"<question>\" --run` — resolve a question to the typed query that answers it",
    "Its answers are evidence, not permission: it analyses Java/Spring only, and silence about a check it does not run is not a pass.",
  ].join("\n");
}

/** Returns the text to prepend to the operator's prompt, or nothing at all: a
    repository ASK cannot speak about pays no tokens for being told so. */
export async function askBriefing(input: { repositoryPath: string; enabled?: boolean }): Promise<string | undefined> {
  if (input.enabled === false || !askIsInstalled()) return undefined;
  const stack = await detectJavaStack(input.repositoryPath);
  if (!stack.java) return undefined;
  return askBriefingText(stack);
}

export function composeAgentPrompt(briefing: string | undefined, prompt: string, acceptanceCriteria?: readonly string[]): string {
  /** A turn under a Task carries what that Task calls done. The reviewer will
      judge the change against exactly these lines, so an agent that has not
      seen them is being asked to hit a target it was never shown. The
      conversation still persists only the operator's prompt. */
  const acceptance = acceptanceCriteria?.length
    ? `Acceptance criteria for this Task, which this work will be reviewed against:\n${acceptanceCriteria.map((criterion, index) => `${index + 1}. ${criterion}`).join("\n")}`
    : undefined;
  return [briefing, acceptance, prompt].filter(Boolean).join("\n\n");
}
