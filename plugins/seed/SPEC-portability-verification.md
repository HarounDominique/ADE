# Spec: Portability verification

<!-- Nexus: SPEC-NEXUS.md | Module id: portability-verification -->

## Objective

Verify that the dual plugin remains usable on macOS, Ubuntu and Windows,
including path handling and Node-based validation without Bash.

## Verification

- Run `node scripts/validate-plugin-parity.mjs` on every platform.
- Keep all plugin paths relative to their manifests.
- Do not require Unix executables, shell quoting or platform-specific paths.
- Record host smoke results separately from static validation.

## Success Criteria

- Manifest and skill validation passes on all three target platforms.
- Claude's existing package remains installable.
- Codex's package remains discoverable without modifying the Claude package.
