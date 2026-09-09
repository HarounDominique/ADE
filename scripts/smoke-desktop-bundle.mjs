import { accessSync, constants, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { createInterface } from "node:readline";

// A file URL's pathname keeps a leading slash before a drive letter, which
// resolve() then prefixes with the current drive: C:\C:\...
const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
// Every platform lays its bundle out differently, and only macOS nests the
// executable inside the bundle directory.
// Tauri names the binary after the Cargo package, not after productName, so
// the bundle holds `Assay.app/Contents/MacOS/desktop`. Read the name rather
// than restate it: spelling the product here is what silently stopped this
// check from finding anything when the product was renamed.
const binaryName = readFileSync(join(root, "desktop/src-tauri/Cargo.toml"), "utf8")
  .split(/\[[^\]]+\]/)[1]
  ?.match(/^\s*name\s*=\s*"([^"]+)"/m)?.[1];
if (!binaryName) {
  console.error("Unable to read the binary name from desktop/src-tauri/Cargo.toml");
  process.exit(1);
}
const bundleLayout = {
  darwin: {
    app: "desktop/src-tauri/target/release/bundle/macos/Assay.app",
    executable: `Contents/MacOS/${binaryName}`,
    sidecar: "Contents/Resources/sidecar-dist/ade-sidecar",
  },
  win32: {
    app: "desktop/src-tauri/target/release",
    executable: `${binaryName}.exe`,
    sidecar: "sidecar-dist/ade-sidecar.exe",
  },
}[process.platform] ?? {
  app: "desktop/src-tauri/target/release",
  executable: binaryName,
  sidecar: "sidecar-dist/ade-sidecar",
};
const app = resolve(process.env.ADE_APP_PATH ?? join(root, bundleLayout.app));
const appExecutable = join(app, bundleLayout.executable);
const windows = process.platform === "win32";
const sidecarBase = join(app, bundleLayout.sidecar);
const sidecar = windows && !existsSync(sidecarBase)
  ? sidecarBase.replace(/\.exe$/, ".cmd")
  : sidecarBase;
const smokeDirectory = mkdtempSync(join(tmpdir(), "ade-desktop-smoke-"));
const database = join(smokeDirectory, "ade.db");
const repository = join(smokeDirectory, "repository");

function requireExecutable(path) {
  accessSync(path, constants.X_OK);
}

async function waitForExit(child, timeoutMs) {
  return Promise.race([
    once(child, "close").then(([code, signal]) => ({ code, signal })),
    new Promise((resolve) => setTimeout(() => resolve(null), timeoutMs)),
  ]);
}

function createProtocol(process) {
  const waiters = new Map();
  const buffered = new Map();
  const stream = createInterface({ input: process.stdout });
  stream.on("line", (line) => {
    const message = JSON.parse(line);
    const waiter = message.id !== undefined ? waiters.get(String(message.id)) : waiters.get(message.type);
    const key = message.id !== undefined ? String(message.id) : message.type;
    if (waiter) { waiters.delete(key); waiter.resolve(message); }
    else if (key) buffered.set(key, message);
  });
  return {
    request(message, timeoutMs = 15_000) {
      return new Promise((resolve, reject) => {
        const key = String(message.id);
        const timeout = setTimeout(() => { waiters.delete(key); reject(new Error(`Timed out waiting for ${key}`)); }, timeoutMs);
        waiters.set(key, { resolve: (result) => { clearTimeout(timeout); resolve(result); } });
        process.stdin.write(`${JSON.stringify(message)}\n`);
      });
    },
    waitFor(type, timeoutMs = 90_000) {
      const early = buffered.get(type);
      if (early) { buffered.delete(type); return Promise.resolve(early); }
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => { waiters.delete(type); reject(new Error(`Timed out waiting for ${type}`)); }, timeoutMs);
        waiters.set(type, { resolve: (result) => { clearTimeout(timeout); resolve(result); } });
      });
    },
  };
}

function spawnPackagedSidecar() {
  return spawn(sidecar, [], {
    cwd: tmpdir(),
    env: { ...process.env, ADE_DB_PATH: database },
    stdio: ["pipe", "pipe", "ignore"],
    // The SEA fallback is a .cmd shim because Windows cannot execute a shell
    // script directly. Node needs shell mode to launch that shim.
    shell: windows,
  });
}

try {
  requireExecutable(appExecutable);
  requireExecutable(sidecar);
  let sidecarProcess = spawnPackagedSidecar();
  const protocol = createProtocol(sidecarProcess);
  const sidecarResponse = await protocol.request({ id: "bundle-smoke", method: "runtime.status" });
  if (sidecarResponse.result?.sidecar !== "READY") throw new Error("Packaged sidecar did not report READY");

  let task = { checked: false };
  let rehydration = { checked: false };
  if (process.env.ADE_SMOKE_OPENCODE === "1") {
    mkdirSync(repository, { recursive: true });
    if (spawnSync("git", ["init"], { cwd: repository }).status !== 0) throw new Error("Unable to initialize smoke repository");
    await protocol.request({ id: "task-create", method: "task.create", params: { taskId: "bundle-task", intent: "Create smoke-result.txt containing exactly ADE smoke complete.", acceptanceCriteria: ["smoke-result.txt exists in the repository root"], projectId: "bundle", repositoryPath: repository } });
    await protocol.request({ id: "task-ready", method: "task.advance", params: { taskId: "bundle-task", next: "READY", reason: "Smoke task accepted", actor: "smoke" } });
    await protocol.request({ id: "task-run", method: "task.run", params: { taskId: "bundle-task" } });
    const completed = await protocol.waitFor("runtime.completed");
    if (completed.status?.agentRuntime !== "CONNECTED") throw new Error("Bundled sidecar did not complete the OpenCode Task");
    if (!existsSync(join(repository, "smoke-result.txt"))) throw new Error("OpenCode Task did not write its result inside the smoke repository");
    task = { checked: true, taskId: "bundle-task" };

    await protocol.request({ id: "change-review-before-restart", method: "change.review", params: { taskId: "bundle-task" } });
    const beforeRestart = await protocol.request({ id: "task-detail-before-restart", method: "task.detail", params: { taskId: "bundle-task" } });
    const beforeDetail = beforeRestart.result;
    if (beforeRestart.error || beforeDetail?.task?.status !== "IMPLEMENTED" || !beforeDetail.runtimeEvidence?.length || !beforeDetail.gates?.length) {
      throw new Error("Packaged sidecar did not persist Task evidence and gates before restart");
    }
    sidecarProcess.kill("SIGTERM");
    await waitForExit(sidecarProcess, 2000);
    sidecarProcess = spawnPackagedSidecar();
    const restartedProtocol = createProtocol(sidecarProcess);
    const afterRestart = await restartedProtocol.request({ id: "task-detail-after-restart", method: "task.detail", params: { taskId: "bundle-task" } });
    const afterDetail = afterRestart.result;
    if (afterRestart.error || afterDetail?.task?.status !== "IMPLEMENTED" || !afterDetail.runtimeEvidence?.length || !afterDetail.gates?.length) {
      throw new Error("Packaged sidecar did not rehydrate Task evidence and gates after restart");
    }
    rehydration = {
      checked: true,
      status: afterDetail.task.status,
      runtimeEvidence: afterDetail.runtimeEvidence.length,
      gates: afterDetail.gates.length,
    };
  }
  sidecarProcess.kill("SIGTERM");
  await waitForExit(sidecarProcess, 2000);

  const appProcess = spawn(appExecutable, [], {
    cwd: tmpdir(),
    env: { ...process.env, ADE_DB_PATH: database, ADE_PROJECT_ID: "ade" },
    stdio: "ignore",
  });
  const startup = await waitForExit(appProcess, 1500);
  if (startup) throw new Error(`Packaged app exited during startup (${startup.code ?? startup.signal})`);
  appProcess.kill("SIGTERM");
  const shutdown = await waitForExit(appProcess, 3000);
  if (!shutdown) {
    appProcess.kill("SIGKILL");
    throw new Error("Packaged app did not stop cleanly");
  }
  let opencode = { checked: false };
  if (process.env.ADE_SMOKE_OPENCODE === "1") {
    const url = process.env.OPENCODE_URL ?? "http://127.0.0.1:4096";
    const response = await fetch(`${url}/global/health`);
    if (!response.ok) throw new Error(`OpenCode health failed (${response.status})`);
    opencode = { checked: true, url, health: await response.json() };
  }
  console.log(JSON.stringify({ app, sidecar, database, sidecarStatus: sidecarResponse.result.sidecar, appStarted: true, appStopped: true, opencode, task, rehydration }));
} finally {
  rmSync(smokeDirectory, { recursive: true, force: true });
}
