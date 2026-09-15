# Reflection: windows-runtime-hardening

## Implementation review

The two reported Windows defects are addressed without changing provider or desktop
contracts. Toolchain probes keep stdout and stderr separate, preferring stdout for a
successful version while retaining stderr for failed diagnostics. Git execution now
retries only narrowly classified index-lock/access-denied errors, with four total
attempts and bounded 50/100/200 ms backoff; missing Git and ordinary failures remain
immediate.

Evidence: 12 focused tests pass, including the warning-before-version regression and
lock classifier; the TypeScript build passes; the previous full suite passed 691/691.
No dependency, CI, or public protocol change was introduced.

The reported Windows-specific runtime conditions cannot be reproduced on this macOS
host, so the retry behavior is covered by deterministic classification tests rather
than an antivirus-dependent integration test.

## Workflow review

The change was correctly split into two independently testable runtime concerns and
documented before the implementation was finalized. A process mistake briefly replaced
an existing Git test file; it was restored before verification, and the full original
coverage now passes alongside the new tests.

## Reusable learning

When a CLI reports a version, keep stdout (machine result) separate from stderr
(diagnostics); when Git touches a repository on Windows, retry only known transient
index-lock failures with a small finite backoff.
