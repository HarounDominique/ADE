# Tasks: Agent Terminal History

<!-- Plan: tasks/plan-agent-terminal-history.md | Spec: docu/specs/SPEC-agent-terminal-history.md -->

- [x] Task: Persistir sesiones de terminal de agente
  - Acceptance: SQLite migra sin perder datos; guarda, ordena, lee y borra por
    Project transcript, provider, fechas, título y truncamiento.
  - Verify: tests de `sqlite-store` para round-trip, migración y aislamiento.
  - Files: `src/domain/`, `src/persistence/sqlite-store.ts`, `tests/sqlite-store.test.ts`.

- [x] Task: Detectar y titular sesiones elegibles
  - Acceptance: sólo ejecutables `claude`, `codex` y `opencode` activan captura;
    cada provider usa el modelo económico definido; un fallo deja fallback.
  - Verify: tests unitarios de parser, provider, límite y fallback.
  - Files: `src/application/`, `src/adapters/`, `tests/`.

- [x] Task: Exponer historial seguro por el sidecar
  - Acceptance: listar, leer, guardar y borrar exigen Project y rechazan acceso
    cruzado o parámetros inválidos.
  - Verify: tests de `desktop-sidecar` para éxito y errores.
  - Files: `src/desktop-sidecar.ts`, `tests/desktop-sidecar.test.ts`.

- [x] Task: Capturar terminales de agente desde el dock
  - Acceptance: una tab PTY se vuelve elegible tras la primera orden reconocida,
    persiste al cerrar/parar y una tab manual no deja historial.
  - Verify: pruebas de lógica de captura y contrato de shell.
  - Files: `desktop/src/main.js`, `tests/desktop-ui-contract.test.ts`.

- [x] Task: Mostrar y borrar historial en popup
  - Acceptance: botón junto a `+`, popup accesible y no persistente, fecha/hora,
    reanudación de la conversación elegida y borrado confirmado por el usuario.
  - Verify: contract tests de HTML/CSS/JS y `node --check`.
  - Files: `desktop/src/index.html`, `desktop/src/main.js`,
    `desktop/src/styles.css`, `tests/desktop-ui-contract.test.ts`.

- [x] Task: Registrar la decisión y verificar el corte
  - Acceptance: ADR y specs/Nexus reflejan la implementación real; no hay
    referencias rotas ni cambios de formato.
  - Verify: `npm test`, `npm run build`, `node --check desktop/src/main.js`,
    `cargo test --manifest-path desktop/src-tauri/Cargo.toml`, `git diff --check`.
  - Files: `docu/adr/`, `docu/specs/`, `tasks/`.

- [x] Task: Reanudar la conversación elegida, no el selector del provider
  - Acceptance: al guardar y al listar se identifica la conversación en el
    almacén del agente exigiendo que naciera durante la sesión y en su
    directorio; varias candidatas se descartan; abrir usa `--resume <id>` y la
    fila que no se puede identificar lo advierte y cae al selector.
  - Verify: tests de resolución por ventana, ambigüedad, backfill del listado y
    contrato de UI.
  - Files: `src/application/terminal-history/provider-session-id.ts`,
    `src/desktop-sidecar.ts`, `src/persistence/sqlite-store.ts`,
    `desktop/src/main.js`, `tests/`.
