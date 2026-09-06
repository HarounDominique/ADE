# Plan: Agents conversation workbench

<!-- Spec: docu/specs/SPEC-agent-providers.md#next-iteration-agent-workbench | ADR: docu/adr/0029-chatgpt-inspired-agent-workbench.md -->

## Status

Implemented — 2026-09-06.

## Goal

Convert `Agents` into a conversation-first workspace informed by ChatGPT Desktop patterns while preserving ADE's local Project, Task, provider and permissions contracts.

## Delivery order

1. Extend the read model so sessions load by active Project and optional Task, including an explicit `General` group and safe invalidation on Project changes.
2. Rebuild the session rail into collapsible Task groups, then preserve selection and focus across refreshes.
3. Simplify the thread header and give the transcript all remaining horizontal space; add turn-attached observable evidence only.
4. Make provider/model behavior explicit: provider immutable per existing session, model selectable per next turn, new provider creates a new conversation.
5. Add contract/UI tests, accessibility coverage and macOS manual smoke with one real provider for each available adapter. The contract and build checks are complete; provider smoke remains environment-dependent.

## Risks and mitigations

- **Provider resume mismatch:** create a new session on provider change; never translate identifiers.
- **Stale Project response:** stamp reads with the active Project id and discard stale results.
- **Dense rail at scale:** groups are collapsible and conversations sort by activity; only add a rail filter when manual evidence shows it is needed.
- **Evidence overload:** attach concise, collapsible runtime evidence to individual turns; retain full details in Tasks and Version control.

## Verification checkpoints

- Unit/read-model tests: grouping, ordering, general sessions, active Project invalidation.
- Adapter/UI contracts: provider-model compatibility and per-turn permission mapping unchanged.
- UI contracts: two-column layout only, keyboard navigation, focus restore, empty/loading/error states and reduced motion.
- Manual macOS smoke: create, resume, switch Project, change model, start a second-provider conversation and delete a saved conversation.

## Delivery evidence

- `agent_sessions` now persists a Project boundary and a stable conversation title, with migration and legacy-directory compatibility.
- The sidecar filters and validates session access by active Project; the shell ignores stale prompt responses after Project changes.
- The UI groups conversations by Task/General, keeps the selected group open, assigns a Task only during new-conversation setup and keeps provider/model controls at the composer.
- `npm test` passes with 117 tests; `npm run build`, `npm --prefix desktop run build` and JavaScript syntax validation pass.
