# Tasks: Native adaptive development workflow

<!-- Plan: tasks/plan-development-workflow.md | Spec: docu/specs/SPEC-development-workflow.md | ADR-0056 -->

- [x] Task: Registrar la decisión y corregir el estado falso del nexus
  - Acceptance: existe un ADR con la decisión y sus alternativas; `development-workflow` deja de estar marcado `done` sin implementación; la `Project Structure` de la spec declara rutas que van a existir.
  - Verify: `grep development-workflow docu/specs/SPEC-NEXUS.md` muestra `in-progress`.
  - Files: `docu/adr/0056-native-development-workflow.md`, `docu/specs/SPEC-NEXUS.md`, `docu/specs/SPEC-development-workflow.md`

- [x] Task: Especificar activación, escalada, guard TDD y bucle de aprendizaje
  - Acceptance: la spec define dónde vive el interruptor y quién gana, la tabla de intentos, qué comprueba el guard y qué deliberadamente no comprueba, y la forma de una regla aprendida.
  - Verify: revisión de las secciones `Activation`, `Attempts and model escalation`, `TDD guard` y `Learning loop`.
  - Files: `docu/specs/SPEC-development-workflow.md`

- [x] Task: Dominio de fases, modos, ciclos e intentos
  - Acceptance: las ocho fases y la matriz de transiciones de la spec se imponen en ambas direcciones; una transición rechazada no muta el estado; la reentrada es explícita y queda marcada; el segundo intento escala y el tercero para; un ciclo nuevo limpia los contadores; el estado sobrevive a un round trip.
  - Verify: `npx tsx --test tests/workflow-phase.test.ts tests/workflow-attempts.test.ts` — 15 tests.
  - Files: `src/domain/workflow/phase.ts`, `tests/workflow-phase.test.ts`, `tests/workflow-attempts.test.ts`

- [x] Task: Activación por operador y por Project
  - Acceptance: el flujo está activado si nadie dice lo contrario; el operador puede apagarlo para sí; un Project que se pronuncia gana en ambas direcciones; un valor no booleano o una policy ilegible son silencio, nunca un apagado silencioso.
  - Verify: `npx tsx --test tests/workflow-activation.test.ts` — 7 tests.
  - Files: `src/application/workflow/activation.ts`, `src/application/settings/settings.ts`, `src/application/change-review/gate-policy.ts`, `tests/workflow-activation.test.ts`

- [x] Task: Persistir el estado de workflow junto a la Task
  - Acceptance: existe `workflow_state` en SQLite; una Task reanudada conserva fase, modo, ciclo, intentos e historial; una Task sin estado de workflow lee `undefined` en vez de fallar; dos Tasks no se mezclan; una escalada guardada no se reinicia al reabrir.
  - Verify: `npx tsx --test tests/workflow-store.test.ts` — 5 tests.
  - Files: `src/persistence/sqlite-store.ts`, `tests/workflow-store.test.ts`

- [x] Task: Guard TDD sobre el diff staged
  - Acceptance: un fichero de producción añadido o modificado sin test en el mismo diff bloquea; un borrado puro no; un rename cuenta como cambio; sin evidencia de ejecución bloquea en vez de asumir verde; una ejecución roja cita su código de salida; la convención de nombres es declarable en `.ade/policy.json` y una declaración ilegible es silencio, nunca un guard más ancho.
  - Verify: `npx tsx --test tests/commit-guard.test.ts` — 17 tests.
  - Files: `src/application/workflow/commit-guard.ts`, `src/application/change-review/gate-policy.ts`, `tests/commit-guard.test.ts`

- [ ] Task: Orquestación y contrato `WorkflowResult`
  - Acceptance: un caso de uso propone la fase siguiente según modo y evidencia, aplica `gateUpdates`, respeta el halt del tercer intento y nunca salta una gate obligatoria ni aprueba `SHIP`.
  - Verify: matriz de modos y loops en `tests/workflow-orchestration.test.ts`.
  - Files: `src/application/workflow/advance.ts`, `tests/workflow-orchestration.test.ts`

- [ ] Task: Exponer el workflow en el sidecar
  - Acceptance: la shell puede leer estado y avanzar fase; con el flujo desactivado los comandos responden que está apagado en vez de fallar.
  - Verify: `tests/desktop-sidecar.test.ts`.
  - Files: `src/desktop-sidecar.ts`, `tests/desktop-sidecar.test.ts`

- [ ] Task: Superficie de shell e interruptor en Settings
  - Acceptance: fase, modo, intentos y motivo de reentrada son visibles en el detalle de la Task; Settings permite apagar el flujo; un Project que lo fuerza lo explica en vez de mostrar un control muerto.
  - Verify: `tests/desktop-ui-contract.test.ts`.
  - Files: `desktop/src/`, `tests/desktop-ui-contract.test.ts`

- [ ] Task: Bucle de aprendizaje en RECONCILE
  - Acceptance: una Task cerrada deja cero o más reglas con evidencia de origen, refuerzo y prioridad; una regla nueva nace en `low`; una regla rechazada por la validación de seguridad no se carga nunca; el coste de contexto está acotado.
  - Verify: `tests/workflow-learning.test.ts`.
  - Files: `src/application/workflow/learned-rules.ts`, `tests/workflow-learning.test.ts`

- [ ] Task: Dar cuerpo a la skill nativa `adaptive-workflow`
  - Acceptance: la skill despacha contra el dominio en vez de reenviar su propia descripción como prompt; `spector` se declara explícitamente como pendiente en vez de aparentar paridad.
  - Verify: `tests/skill-catalog.test.ts` y `tests/run-skill.test.ts`.
  - Files: `src/application/skills/skill-catalog.ts`, `src/application/skills/run-skill.ts`

- [ ] Task: Sincronizar documentación y cerrar el módulo
  - Acceptance: nexus, PRODUCT, README y specs dependientes reflejan lo implementado; `development-workflow` vuelve a `done` sólo cuando el código lo sostiene.
  - Verify: `npm run build && npm test` y revisión de referencias.
  - Files: `docu/`, `README.md`, `PRODUCT.md`
