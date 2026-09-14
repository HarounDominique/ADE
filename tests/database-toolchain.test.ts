import test from "node:test";
import assert from "node:assert/strict";
import { chmod, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { detectDatabaseClient, detectDatabaseToolchains } from "../src/application/local-runtime/database-toolchain.js";

/** Mirrors how `tests/toolchain-inspection.test.ts` exercises the shared `probe()` helper this
    module reuses, plus the PATH-override technique `tests/command-lookup.test.ts` already uses to
    make a command's presence/absence deterministic in CI rather than depending on whether the real
    `psql`/`mysql`/`sqlite3` happen to be installed on the runner. */

const windows = process.platform === "win32";

async function fakeVersionedClient(directory: string, command: string, versionLine: string): Promise<void> {
  const path = join(directory, windows ? `${command}.cmd` : command);
  await writeFile(path, windows ? `@echo off\r\necho ${versionLine}\r\nexit /b 0\r\n` : `#!/bin/sh\necho "${versionLine}"\nexit 0\n`);
  if (!windows) await chmod(path, 0o755);
}

test("detectDatabaseClient reports a client on PATH as available, with its version captured", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ade-db-toolchain-present-"));
  await fakeVersionedClient(directory, "psql", "psql (PostgreSQL) 16.2");
  const previous = process.env.PATH;
  try {
    process.env.PATH = directory;
    const status = await detectDatabaseClient("postgres", directory);
    assert.equal(status.command, "psql");
    assert.equal(status.available, true);
    // Not asserted against the fixture's own "16.2": `runtimeEnvironment` (reused unmodified, per
    // the spec) also exposes a real Homebrew `/opt/homebrew/bin` once it finds `npm` there, and on
    // a machine with Postgres installed that way its real `psql` can be what actually answers —
    // this only proves *a* version was captured, matching how `tests/toolchain-inspection.test.ts`
    // itself asserts (`/\d+\.\d+/`) rather than a literal version string.
    assert.match(status.version ?? "", /\d+\.\d+/);
  } finally {
    process.env.PATH = previous;
  }
});

test("detectDatabaseClient reports a client absent from PATH as unavailable, not as an error thrown", async () => {
  const previous = process.env.PATH;
  try {
    process.env.PATH = await mkdtemp(join(tmpdir(), "ade-db-toolchain-absent-"));
    const status = await detectDatabaseClient("mysql");
    assert.equal(status.command, "mysql");
    assert.equal(status.available, false);
    assert.ok(status.error, "an absent client reports why, without throwing");
  } finally {
    process.env.PATH = previous;
  }
});

test("detectDatabaseToolchains probes all three engines' native clients in one pass", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ade-db-toolchain-all-"));
  await fakeVersionedClient(directory, "sqlite3", "3.45.1 2024-01-30");
  const previous = process.env.PATH;
  try {
    process.env.PATH = directory;
    const statuses = await detectDatabaseToolchains(directory);
    assert.deepEqual(statuses.map((status) => status.command).sort(), ["mysql", "psql", "sqlite3"]);
    const sqlite = statuses.find((status) => status.command === "sqlite3");
    assert.equal(sqlite?.available, true);
    // mysql, not psql: `runtimeEnvironment` can genuinely expose a real `psql` alongside the fake
    // PATH (see the test above), but it only ever augments PATH with directories that also hold
    // `npm`/`java`, so a client with neither name next to it — mysql here — stays absent whenever
    // this directory truly has no mysql client of its own, on any machine.
    const mysql = statuses.find((status) => status.command === "mysql");
    assert.equal(mysql?.available, false);
  } finally {
    process.env.PATH = previous;
  }
});
