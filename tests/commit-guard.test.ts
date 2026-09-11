import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { evaluateCommitGuard, type StagedChange } from "../src/application/workflow/commit-guard.js";
import { loadGatePolicy } from "../src/application/change-review/gate-policy.js";

const green = { exitCode: 0, evidenceId: "ev-tests" };

function staged(...entries: [string, string][]): StagedChange[] {
  return entries.map(([status, path]) => ({ status, path }));
}

test("a production file changed with no test in the same diff blocks", () => {
  const verdict = evaluateCommitGuard({ staged: staged(["M", "src/pricing.ts"]), verification: green });

  assert.equal(verdict.ok, false);
  assert.match(verdict.reason, /no test/i);
  assert.deepEqual(verdict.files, ["src/pricing.ts"]);
});

test("a production file with its test passes", () => {
  assert.equal(evaluateCommitGuard({ staged: staged(["M", "src/pricing.ts"], ["A", "tests/pricing.test.ts"]), verification: green }).ok, true);
});

test("a flat layout works the same as src/ plus tests/", () => {
  assert.equal(evaluateCommitGuard({ staged: staged(["A", "wordcount.py"], ["A", "test_wordcount.py"]), verification: green }).ok, true);
});

test("deleting production code needs no test — cleanup is not an untested change", () => {
  assert.equal(evaluateCommitGuard({ staged: staged(["D", "src/legacy.ts"]), verification: green }).ok, true);
});

test("a rename counts as a change to the file that now exists", () => {
  const verdict = evaluateCommitGuard({ staged: staged(["R100", "src/renamed.ts"]), verification: green });
  assert.equal(verdict.ok, false);
  assert.deepEqual(verdict.files, ["src/renamed.ts"]);
});

test("missing verification evidence blocks — absence is not green", () => {
  const verdict = evaluateCommitGuard({ staged: staged(["M", "src/a.ts"], ["M", "src/a.test.ts"]), verification: undefined });

  assert.equal(verdict.ok, false);
  assert.match(verdict.reason, /no recorded test run/i);
});

test("a red verification blocks and quotes its exit code", () => {
  const verdict = evaluateCommitGuard({ staged: staged(["M", "src/a.ts"], ["M", "src/a.test.ts"]), verification: { exitCode: 1, evidenceId: "ev-1" } });

  assert.equal(verdict.ok, false);
  assert.match(verdict.reason, /exited 1/);
  assert.deepEqual(verdict.evidenceIds, ["ev-1"]);
});

test("nothing staged is nothing to guard", () => {
  assert.equal(evaluateCommitGuard({ staged: [], verification: undefined }).ok, true);
});

test("a change with no production file at all passes without a test", () => {
  assert.equal(evaluateCommitGuard({ staged: staged(["M", "README.md"], ["M", "docu/specs/SPEC-NEXUS.md"]), verification: green }).ok, true);
});

test("a file with no extension is not production code", () => {
  assert.equal(evaluateCommitGuard({ staged: staged(["A", "Makefile"], ["A", "LICENSE"]), verification: green }).ok, true);
});

test("the four stock test-name patterns are all recognised", () => {
  for (const [production, testFile] of [
    ["app.py", "test_app.py"],
    ["app.go", "app_test.go"],
    ["app.ts", "app.test.ts"],
    ["app.rb", "app.spec.rb"],
  ] as const) {
    assert.equal(evaluateCommitGuard({ staged: staged(["M", production], ["M", testFile]), verification: green }).ok, true, `${testFile} should count as a test`);
  }
});

test("a Project can declare its own convention once, in policy", () => {
  const rubySpec = staged(["M", "lib/pricing.rb"], ["M", "spec/pricing_spec.rb"]);

  assert.equal(evaluateCommitGuard({ staged: rubySpec, verification: green }).ok, false, "the stock patterns do not cover *_spec.rb");
  assert.equal(
    evaluateCommitGuard({ staged: rubySpec, verification: green, testNamePatterns: ["*_spec.*"] }).ok,
    true,
  );
});

test("a declared production extension list narrows what counts as production", () => {
  const verdict = evaluateCommitGuard({ staged: staged(["M", "src/a.ts"]), verification: green, productionExtensions: ["py"] });
  assert.equal(verdict.ok, true, "a TypeScript file is not production in a Project that declared Python only");
});

test("the Project's declared convention reaches the guard through policy", () => {
  const root = mkdtempSync(join(tmpdir(), "ade-tdd-"));
  mkdirSync(join(root, ".ade"), { recursive: true });
  writeFileSync(join(root, ".ade", "policy.json"), JSON.stringify({ tdd: { testNamePatterns: ["*_spec.*"] } }), "utf8");

  const policy = loadGatePolicy(root);
  assert.deepEqual(policy.tdd.testNamePatterns, ["*_spec.*"]);

  const verdict = evaluateCommitGuard({
    staged: staged(["M", "lib/pricing.rb"], ["M", "spec/pricing_spec.rb"]),
    verification: green,
    ...(policy.tdd.testNamePatterns ? { testNamePatterns: policy.tdd.testNamePatterns } : {}),
  });
  assert.equal(verdict.ok, true);
});

test("a Project that declares nothing keeps the stock patterns", () => {
  assert.deepEqual(loadGatePolicy().tdd, {});
});

test("a malformed convention is silence, never a wider guard", () => {
  const root = mkdtempSync(join(tmpdir(), "ade-tdd-"));
  mkdirSync(join(root, ".ade"), { recursive: true });
  writeFileSync(join(root, ".ade", "policy.json"), JSON.stringify({ tdd: { testNamePatterns: [""] } }), "utf8");

  assert.equal(loadGatePolicy(root).tdd.testNamePatterns, undefined);
});

test("the failing files are all reported, not just the first", () => {
  const verdict = evaluateCommitGuard({ staged: staged(["M", "src/a.ts"], ["A", "src/b.ts"], ["D", "src/c.ts"]), verification: green });

  assert.equal(verdict.ok, false);
  assert.deepEqual(verdict.files, ["src/a.ts", "src/b.ts"], "the deleted file is not among them");
});
