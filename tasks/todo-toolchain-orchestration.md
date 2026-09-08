# Tasks: Orquestación de toolchains del Project

<!-- Plan: tasks/plan-toolchain-orchestration.md | Spec: docu/specs/SPEC-run-configurations.md -->

- [x] Task: Proponer build/test/lint desde los manifiestos soportados
  - Acceptance: Node, Python, Maven/Gradle, Rust, Go y .NET generan propuestas explícitas sin escribir ni ejecutar comandos.
  - Verify: `npm test -- --test-name-pattern='toolchain|run configuration'`.
  - Files: `src/application/local-runtime/run-detection.ts`, `tests/run-detection.test.ts`.

- [x] Task: Preservar el contrato de la shell
  - Acceptance: Las propuestas aparecen en el menú existente, conservan la fuente y no cambian el flujo de aceptación de `.ade/run.json`.
  - Verify: `npm run build`, `node --check desktop/src/main.js` y tests de contrato.
  - Files: `desktop/src/main.js`, `tests/desktop-ui-contract.test.ts`.

- [x] Task: Sincronizar documentación
  - Acceptance: ADR, spec, nexus, plan y tareas describen que ADE orquesta toolchains externos y los límites de detección.
  - Verify: revisión de referencias por módulo y `git diff --check`.
  - Files: `docu/adr/0038-external-project-toolchains.md`, `docu/specs/SPEC-run-configurations.md`, `docu/specs/SPEC-NEXUS.md`, `README.md`, `tasks/`.
