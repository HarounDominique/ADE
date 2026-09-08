import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { askBriefing, askBriefingText, askIsInstalled, composeAgentPrompt, detectJavaStack } from "../src/application/structural-context/ask-briefing.js";
import { loadGatePolicy } from "../src/application/change-review/gate-policy.js";

function repository(name: string, files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), `ade-briefing-${name}-`));
  for (const [path, contents] of Object.entries(files)) {
    const full = join(root, path);
    mkdirSync(join(full, ".."), { recursive: true });
    writeFileSync(full, contents);
  }
  return root;
}

test("a Spring repository is detected from its build file and its sources", async () => {
  const root = repository("spring", {
    "pom.xml": "<project><dependency><groupId>org.springframework.boot</groupId></dependency></project>",
    "src/main/java/com/example/OrderService.java": "class OrderService {}",
  });
  const stack = await detectJavaStack(root);

  assert.equal(stack.java, true);
  assert.equal(stack.spring, true);
  assert.ok(stack.markers.some((marker) => marker.endsWith("pom.xml")));
});

test("Java without Spring is Java, and the briefing does not claim Spring answers", async () => {
  const root = repository("plain-java", { "build.gradle": "plugins { id 'java' }", "src/Main.java": "class Main {}" });
  const stack = await detectJavaStack(root);

  assert.equal(stack.java, true);
  assert.equal(stack.spring, false);
  assert.doesNotMatch(askBriefingText(stack), /spring-audit/);
  assert.match(askBriefingText(stack), /ask endpoints \./);
});

/** The briefing is a per-turn cost. A repository ASK cannot speak about pays
    nothing for being told so. */
test("a repository with no Java is never briefed", async () => {
  const root = repository("typescript", { "package.json": "{}", "src/index.ts": "export {};" });
  const stack = await detectJavaStack(root);

  assert.equal(stack.java, false);
  assert.equal(await askBriefing({ repositoryPath: root }), undefined);
});

/** atlas-cli is a Python project whose test fixtures contain Java: briefing an
    agent about ASK there would spend tokens on an answer ASK cannot give. */
test("Java that only lives in a test fixture is not a Java repository", async () => {
  const root = repository("fixtures", {
    "pyproject.toml": "[project]\nname = 'tool'",
    "tests/fixtures/legacy/pom.xml": "<project><groupId>org.springframework.boot</groupId></project>",
    "tests/fixtures/legacy/DateService.java": "class DateService {}",
  });
  const stack = await detectJavaStack(root);

  assert.equal(stack.java, false);
  assert.equal(await askBriefing({ repositoryPath: root }), undefined);
});

test("a module's own build file counts, and a conventional source root counts without one", async () => {
  const module = repository("module", { "services/api/pom.xml": "<project/>", "services/api/src/main/java/Api.java": "class Api {}" });
  assert.equal((await detectJavaStack(module)).java, true);

  const conventional = repository("conventional", { "src/main/java/com/example/App.java": "class App {}" });
  assert.equal((await detectJavaStack(conventional)).java, true);
});

test("build output and dependency directories are not scanned for Java", async () => {
  const root = repository("ignored", { "package.json": "{}", "node_modules/lib/pom.xml": "<project/>", "node_modules/lib/src/main/java/Vendor.java": "class Vendor {}", "target/classes/Built.java": "class Built {}" });
  assert.equal((await detectJavaStack(root)).java, false);
});

test("a Project can turn the briefing off, and an absent ASK turns it off by itself", async () => {
  const root = repository("opt-out", {
    "pom.xml": "<project><groupId>org.springframework.boot</groupId></project>",
    "src/main/java/App.java": "class App {}",
    ".ade/policy.json": JSON.stringify({ structuralBriefing: false }),
  });

  assert.equal(loadGatePolicy(root).structuralBriefing, false);
  assert.equal(await askBriefing({ repositoryPath: root, enabled: false }), undefined);
  assert.equal(loadGatePolicy(repository("default", { "package.json": "{}" })).structuralBriefing, true);
  assert.equal(askIsInstalled(() => false), false);
});

test("the operator's prompt survives the briefing verbatim", () => {
  const prompt = "Rename OrderService to BillingService and keep the tests green.";
  const briefing = askBriefingText({ java: true, spring: true, markers: ["pom.xml"] });

  assert.equal(composeAgentPrompt(undefined, prompt), prompt);
  assert.ok(composeAgentPrompt(briefing, prompt).endsWith(prompt));
  assert.match(composeAgentPrompt(briefing, prompt), /^\[ADE\] This repository is Java\/Spring/);
});
