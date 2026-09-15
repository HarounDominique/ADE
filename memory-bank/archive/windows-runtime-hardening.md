# Archive: windows-runtime-hardening

## Delivered

Hardened Windows toolchain inspection and Git access. Warnings emitted by npm or other
tools on stderr no longer replace the real version printed on stdout. Git retries
transient `.git/index` permission/lock failures up to four total attempts with bounded
backoff, while permanent and unrelated errors remain visible immediately.

## Evidence

- Focused regressions: 12 passed.
- Full repository suite: 694 passed in the final run.
- TypeScript build: passed.
- Existing Git discovery coverage preserved.

Reflection: [windows-runtime-hardening](../reflection/windows-runtime-hardening.md).
Specification: [SPEC-windows-runtime-hardening](../../docu/specs/SPEC-windows-runtime-hardening.md).
