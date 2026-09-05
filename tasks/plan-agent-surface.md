# Plan: Agent surface

<!-- Spec: docu/specs/SPEC-agent-providers.md; ADR: docu/adr/0024-agent-surface.md -->

## Status

Implemented on 2026-09-05.

## Scope

- Expose `Agents` in the desktop navigation.
- Persist agent sessions and ordered user/assistant messages per Project.
- Add sidecar reads for sessions/messages and an asynchronous generic prompt operation.
- Reuse Codex CLI, Claude Code CLI and OpenCode HTTP adapters without storing credentials.
- Show provider selection, transcript, Task context and per-run sensitive permission grants.
- Show a provider-scoped model selector beside the per-run permissions and reset it when the user changes provider or saved conversation.
- Keep the primary surface focused: the Sessions rail and conversation thread occupy the workbench; Activity, Files changed and Skills & tools are not rendered in a permanent inspector.

## Verification

`npm run build` and `npm test` pass (108 TypeScript tests). Manual `.app` smoke with a real provider turn remains a release-level check because availability depends on the local installation and license.
