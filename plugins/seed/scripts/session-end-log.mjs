#!/usr/bin/env node
/* SessionEnd hook.
 *
 * Reads the hook JSON from stdin (session_id, transcript_path, cwd,
 * hook_event_name, reason) and writes one small log entry under
 * memory-bank/.local/session-logs/<session_id>.md -- hot cache, gitignored,
 * never a truth source. /seed:reflect reads these as optional corroborating
 * evidence, never as the only source for a claim.
 *
 * Node rather than bash: Claude Code runs on Node, so this hook fires on every
 * platform the plugin can be installed on. The bash version needed a shell that
 * Windows does not guarantee, which made the evidence trail quietly
 * platform-dependent.
 *
 * Fails silently on any missing piece -- a hook must never break the session it
 * is attached to. No telemetry, no external send, purely local.
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

try {
  const raw = await readStdin();
  const data = JSON.parse(raw);
  const cwd = data.cwd;
  const sessionId = data.session_id;
  if (!cwd || !sessionId) process.exit(0);

  /* Not a SEED-initialized project, or /seed:init has not run yet. Nothing to
     log here, and creating the tree would be initializing by side effect from
     a hook nobody asked to run. */
  const memoryBank = join(cwd, "memory-bank");
  if (!existsSync(memoryBank)) process.exit(0);

  const logDir = join(memoryBank, ".local", "session-logs");
  mkdirSync(logDir, { recursive: true });
  writeFileSync(
    join(logDir, `${sessionId}.md`),
    [
      `# Session log: ${sessionId}`,
      ``,
      `- ended_at: ${new Date().toISOString()}`,
      `- reason: ${data.reason ?? "unknown"}`,
      `- transcript_path: ${data.transcript_path ?? ""}`,
      ``,
    ].join("\n"),
    "utf8",
  );
} catch {
  /* Every failure mode lands here -- unparseable stdin, an uninitialized
     project, an unwritable directory -- and every one of them means the same
     thing: no log this session. Never the session itself. */
}

process.exit(0);
