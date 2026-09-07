import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { detectRunConfigurations } from "../src/application/local-runtime/run-detection.js";
import { loadRunConfigurations, saveRunConfigurations } from "../src/application/local-runtime/run-config.js";

async function fixture(): Promise<string> {
  return mkdtemp(join(tmpdir(), "ade-detect-"));
}

test("a fullstack Project is proposed as its two halves and the compound that starts both", async () => {
  const root = await fixture();
  await mkdir(join(root, "angular-17-client"), { recursive: true });
  await mkdir(join(root, "spring-boot-server"), { recursive: true });
  await writeFile(join(root, "angular-17-client", "package.json"), JSON.stringify({ scripts: { start: "ng serve", test: "ng test" }, dependencies: { "@angular/core": "^17" } }), "utf8");
  await writeFile(join(root, "spring-boot-server", "pom.xml"), "<project><dependency>spring-boot-starter-web</dependency></project>", "utf8");

  const drafts = await detectRunConfigurations(root);
  const client = drafts.find((draft) => draft.id === "angular-17-client-start");
  assert.deepEqual(client?.args, ["run", "start"]);
  assert.equal(client?.cwd, "${projectRoot}/angular-17-client");
  assert.deepEqual(client?.ports, [{ name: "web", port: 4200, protocol: "http", bind: "loopback" }]);
  assert.equal(client?.source, "angular-17-client/package.json");

  const server = drafts.find((draft) => draft.id === "spring-boot-server-spring-boot");
  assert.equal(server?.command, "mvn");
  assert.equal(server?.ports?.[0]?.port, 8080);
  assert.equal(server?.debug?.port, 5005);
  assert.equal(server?.debug?.protocol, "jdwp");

  const compound = drafts.find((draft) => draft.kind === "compound");
  assert.deepEqual(compound?.members, ["angular-17-client-start", "spring-boot-server-spring-boot"]);

  // Tests are worth proposing; a build is not something you leave running.
  assert.ok(drafts.some((draft) => draft.id === "angular-17-client-test"));
});

test("the wrapper is preferred when the repository ships one", async () => {
  const root = await fixture();
  await writeFile(join(root, "pom.xml"), "<project>spring-boot-maven-plugin</project>", "utf8");
  await writeFile(join(root, "mvnw"), "#!/bin/sh\n", "utf8");
  const [draft] = await detectRunConfigurations(root);
  assert.equal(draft?.command, "./mvnw");

  const gradleRoot = await fixture();
  await writeFile(join(gradleRoot, "build.gradle"), "plugins { id 'org.springframework.boot' }", "utf8");
  await writeFile(join(gradleRoot, "gradlew"), "#!/bin/sh\n", "utf8");
  const [gradleDraft] = await detectRunConfigurations(gradleRoot);
  assert.equal(gradleDraft?.command, "./gradlew");
  assert.deepEqual(gradleDraft?.args, ["bootRun"]);
});

test("a port is proposed only when a framework that documents one is a dependency", async () => {
  const root = await fixture();
  await writeFile(join(root, "package.json"), JSON.stringify({ scripts: { start: "node server.js" }, dependencies: { express: "^4" } }), "utf8");
  const [draft] = await detectRunConfigurations(root);
  assert.equal(draft?.ports, undefined);
});

test("detection ignores build output and dependency directories", async () => {
  const root = await fixture();
  await mkdir(join(root, "node_modules", "left-pad"), { recursive: true });
  await writeFile(join(root, "node_modules", "left-pad", "package.json"), JSON.stringify({ scripts: { start: "node index.js" } }), "utf8");
  assert.deepEqual(await detectRunConfigurations(root), []);
});

test("saving validates before writing and keeps unknown keys in the file", async () => {
  const root = await fixture();
  await mkdir(join(root, ".ade"), { recursive: true });
  const path = join(root, ".ade", "run.json");
  await writeFile(path, JSON.stringify({ version: 1, configurations: [] }), "utf8");

  await saveRunConfigurations(path, [{ id: "client", label: "Client", kind: "command", command: "npm", args: ["start"], cwd: root }]);
  const reloaded = await loadRunConfigurations(path);
  assert.equal(reloaded[0]?.label, "Client");
  assert.equal(JSON.parse(await (await import("node:fs/promises")).readFile(path, "utf8")).version, 1);

  // A file that would not load again is never written in the first place.
  await assert.rejects(saveRunConfigurations(path, [{ id: "broken", label: "Broken", kind: "command" }]), /requires a command/);
  const untouched = await loadRunConfigurations(path);
  assert.deepEqual(untouched.map((configuration) => configuration.id), ["client"]);
});
