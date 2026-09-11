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

- [x] Task: Orquestación y contrato `WorkflowResult`
  - Acceptance: la ruta del modo propone la fase siguiente y calla cuando la matriz la rechazaría; un resultado de una fase ya abandonada se rechaza como obsoleto; volver atrás se marca como reentrada; `SHIP` se rechaza contra las gates reales de la Task, no contra lo que el llamante afirme; una skill no puede aprobar ni dispensar una gate; el tercer intento rechaza el despacho; con el flujo apagado se rechaza sin dejar estado a medias y un resultado rechazado nunca llega al store.
  - Verify: `npx tsx --test tests/workflow-orchestration.test.ts tests/workflow-task.test.ts` — 25 tests.
  - Files: `src/application/workflow/advance.ts`, `src/application/workflow/task-workflow.ts`, `tests/workflow-orchestration.test.ts`, `tests/workflow-task.test.ts`

- [x] Task: Exponer el workflow en el sidecar
  - Acceptance: `workflow.state`, `workflow.start` y `workflow.advance` existen; `state` contesta también con el flujo apagado (`enabled: false`) para que la superficie distinga «apagado» de «roto»; `start`/`advance` rechazan con `WORKFLOW_DISABLED` y un resultado inválido vuelve como `WORKFLOW_REFUSED`, nunca como excepción; los parámetros se validan, incluido un modo inexistente.
  - Verify: `npx tsx --test tests/workflow-sidecar.test.ts` — 9 tests.
  - Files: `src/desktop-sidecar.ts`, `src/application/workflow/task-workflow.ts`, `tests/workflow-sidecar.test.ts`

- [ ] Task: Superficie de shell e interruptor en Settings
  - Acceptance: fase, modo, intentos y motivo de reentrada son visibles en el detalle de la Task; Settings permite apagar el flujo; un Project que lo fuerza lo explica en vez de mostrar un control muerto.
  - Verify: `tests/desktop-ui-contract.test.ts`.
  - Files: `desktop/src/`, `tests/desktop-ui-contract.test.ts`

- [x] Task: Bucle de aprendizaje en RECONCILE
  - Acceptance: una Task cerrada deja cero o más reglas con evidencia de origen, refuerzo y prioridad; una regla nueva nace en `low` y nunca alcanza `critical` por sí sola; una Task no puede reforzar su propia regla dos veces; una regla humana jamás se reescribe; las cuatro categorías de rechazo se detectan y una regla rechazada no se almacena ni se carga; el corpus se acota por ficheros tocados y por número.
  - Verify: `npx tsx --test tests/workflow-learning.test.ts tests/workflow-rules-store.test.ts` — 25 tests.
  - Files: `src/domain/workflow/learned-rule.ts`, `src/application/workflow/learned-rules.ts`, `src/persistence/sqlite-store.ts`, `tests/workflow-learning.test.ts`, `tests/workflow-rules-store.test.ts`

- [x] Task: Dar cuerpo a la skill nativa `adaptive-workflow`
  - Acceptance: el briefing lleva intención, criterios de aceptación, fase, modo, ciclo, intento, aviso de escalada, motivo de reentrada, propuesta de la ruta, reglas aplicables y el contrato de respuesta con lo que el agente no puede decidir; una fase detenida no se briefea; una regla insegura nunca llega al prompt; el manifiesto distingue skill con cuerpo de skill que sólo se describe, y `spector` se declara pendiente.
  - Verify: `npx tsx --test tests/workflow-briefing.test.ts` — 8 tests.
  - Files: `src/application/workflow/workflow-briefing.ts`, `src/application/skills/skill-catalog.ts`, `src/application/skills/run-skill.ts`, `src/domain/skill.ts`, `tests/workflow-briefing.test.ts`

- [ ] Task: Sincronizar documentación y cerrar el módulo
  - Acceptance: nexus, PRODUCT, README y specs dependientes reflejan lo implementado; `development-workflow` vuelve a `done` sólo cuando el código lo sostiene.
  - Verify: `npm run build && npm test` y revisión de referencias.
  - Files: `docu/`, `README.md`, `PRODUCT.md`
