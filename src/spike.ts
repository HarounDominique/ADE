import { OpenCodeHttpRuntime } from "./adapters/opencode-http-runtime.js";
import { runSpike } from "./application/run-spike.js";
import { AdeStore } from "./persistence/sqlite-store.js";

const directory = process.argv[2] ?? process.cwd();
const intent = process.argv.slice(3).join(" ") || "Inspect the repository and report its current state without editing files.";

console.log(`Connecting to OpenCode at ${process.env.OPENCODE_URL ?? "http://127.0.0.1:4096"}`);
console.log(`Directory: ${directory}`);
console.log(`Intent: ${intent}`);

const runtime = new OpenCodeHttpRuntime(process.env.OPENCODE_URL);
const store = new AdeStore(process.env.ADE_DB_PATH ?? `${directory}/.ade/ade.db`);
const result = await runSpike(runtime, {
  taskId: `spike-${Date.now()}`,
  directory,
  intent,
  store,
});

console.log(JSON.stringify({ ...result, events: result.events.length }, null, 2));
store.close();
