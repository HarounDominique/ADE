import { accessSync, constants, mkdtempSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";

const root = resolve(new URL("..", import.meta.url).pathname);
const app = resolve(process.env.ADE_APP_PATH ?? join(root, "desktop/src-tauri/target/release/bundle/macos/desktop.app"));
const appExecutable = join(app, "Contents/MacOS/desktop");
const sidecar = join(app, "Contents/Resources/sidecar-dist/ade-sidecar");
const smokeDirectory = mkdtempSync("/private/tmp/ade-desktop-smoke-");
const database = join(smokeDirectory, "ade.db");

function requireExecutable(path) {
  accessSync(path, constants.X_OK);
}

async function waitForExit(child, timeoutMs) {
  return Promise.race([
    once(child, "close").then(([code, signal]) => ({ code, signal })),
    new Promise((resolve) => setTimeout(() => resolve(null), timeoutMs)),
  ]);
}

try {
  requireExecutable(appExecutable);
  requireExecutable(sidecar);
  const sidecarProcess = spawn(sidecar, [], {
    cwd: "/private/tmp",
    env: { ...process.env, ADE_DB_PATH: database },
    stdio: ["pipe", "pipe", "ignore"],
  });
  sidecarProcess.stdin.write('{"id":"bundle-smoke","method":"runtime.status"}\n');
  const [sidecarOutput] = await once(sidecarProcess.stdout, "data");
  const sidecarResponse = JSON.parse(sidecarOutput.toString());
  if (sidecarResponse.result?.sidecar !== "READY") throw new Error("Packaged sidecar did not report READY");
  sidecarProcess.kill("SIGTERM");
  await waitForExit(sidecarProcess, 2000);

  const appProcess = spawn(appExecutable, [], {
    cwd: "/private/tmp",
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
  console.log(JSON.stringify({ app, sidecar, database, sidecarStatus: sidecarResponse.result.sidecar, appStarted: true, appStopped: true, opencode }));
} finally {
  rmSync(smokeDirectory, { recursive: true, force: true });
}
