/** The TDD guard, ported from SEED (ADR-0056).

    The verdict is computed by code, not judged by an agent. A model under
    pressure rationalises the exception -- "this one file is config, not logic"
    -- and a boolean read off the staged diff and a real exit code has no such
    failure mode. The judgement about what counts as production code is made
    once, in the Project's policy, instead of being re-litigated per commit. */

export type StagedChange = {
  /** As `git diff --cached --name-status` reports it: `A`, `M`, `D`, `R100`… */
  status: string;
  path: string;
};

export type VerificationResult = {
  exitCode: number;
  evidenceId: string;
};

export type GuardVerdict =
  | { ok: true }
  | { ok: false; reason: string; files: readonly string[]; evidenceIds: readonly string[] };

/** Extensions that make a file production code when its name is not a test.
    Deliberately a list of source languages: a change to Markdown or JSON is not
    something a unit test was ever going to cover. */
const PRODUCTION_EXTENSIONS = ["py", "js", "ts", "jsx", "tsx", "go", "rs", "java", "rb", "php", "c", "cpp", "h", "hpp", "cs"] as const;

/** Matched against the file name, never the path, so a flat root and a
    `src/` + `tests/` split behave identically without per-Project globs. */
const TEST_NAME_PATTERNS = ["test_*", "*_test.*", "*.test.*", "*.spec.*"] as const;

export function evaluateCommitGuard(input: {
  staged: readonly StagedChange[];
  verification: VerificationResult | undefined;
  productionExtensions?: readonly string[];
  testNamePatterns?: readonly string[];
}): GuardVerdict {
  if (input.staged.length === 0) return { ok: true };

  const extensions = input.productionExtensions ?? PRODUCTION_EXTENSIONS;
  const patterns = input.testNamePatterns ?? TEST_NAME_PATTERNS;

  const isTest = (path: string) => patterns.some((pattern) => matchesName(basename(path), pattern));
  const isProduction = (path: string) => {
    const name = basename(path);
    const dot = name.lastIndexOf(".");
    if (dot <= 0) return false;
    return extensions.includes(name.slice(dot + 1)) && !isTest(path);
  };

  const testChanged = input.staged.some((change) => isTest(change.path));
  /** A deletion needs nothing added: removing code is not an untested change,
      and failing it here would block a perfectly ordinary cleanup commit. */
  const productionFiles = input.staged
    .filter((change) => !change.status.toUpperCase().startsWith("D") && isProduction(change.path))
    .map((change) => change.path);

  if (productionFiles.length > 0 && !testChanged) {
    return {
      ok: false,
      reason: "Production file(s) added or changed with no test file in the same commit.",
      files: productionFiles,
      evidenceIds: [],
    };
  }

  /** Read from evidence rather than trusted from a claim. A Project that never
      ran its verification has not proved anything in either direction, and
      treating that silence as green is exactly what makes the gate decorative. */
  if (!input.verification) {
    return {
      ok: false,
      reason: "No recorded test run for this Task. Run the Project's verification before committing.",
      files: [],
      evidenceIds: [],
    };
  }

  if (input.verification.exitCode !== 0) {
    return {
      ok: false,
      reason: `The last recorded test run exited ${input.verification.exitCode}.`,
      files: [],
      evidenceIds: [input.verification.evidenceId],
    };
  }

  return { ok: true };
}

/** Git reports forward slashes on every platform, including Windows, so that is
    the shape this normally sees. Backslashes are handled anyway because the
    verdict must not depend on which side of the boundary the caller got its
    paths from. */
function basename(path: string): string {
  const cut = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return cut === -1 ? path : path.slice(cut + 1);
}

/** The handful of shell glob forms these patterns actually use -- `*` standing
    for any run of characters -- rather than a dependency on a glob library for
    four literals. */
function matchesName(name: string, pattern: string): boolean {
  const expression = pattern
    .split("*")
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${expression}$`).test(name);
}
