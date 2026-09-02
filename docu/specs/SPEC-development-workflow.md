# Spec: Adaptive Development Workflow

<!-- Nexus: SPEC-NEXUS.md | Module id: development-workflow -->

## Objective

Definir cómo ADE conduce una Task desde la intención hasta un cambio aceptado sin imponer una receta lineal. El workflow debe ofrecer estructura suficiente para reducir omisiones, pero permitir atajos, reentrada y cambio de estrategia según complejidad, riesgo y evidencia.

## Assumptions

1. Una Task puede ser trivial, exploratoria, correctiva o arquitectónica.
2. La complejidad no se conoce siempre al inicio y puede cambiar durante la ejecución.
3. El humano decide cuándo una ambigüedad requiere discusión y cuándo el agente puede continuar.
4. Las fases son estados de trabajo observables; las skills son capacidades invocables, no necesariamente pasos obligatorios.

## Workflow model

```text
FRAME → EXPLORE → DESIGN → BUILD → VERIFY → REVIEW → RECONCILE → SHIP
          ↕          ↕         ↕        ↕        ↕
       re-frame   re-design  re-build  re-verify  re-review
```

`RECONCILE` comprueba documentación, decisiones y estado de la Task. `SHIP` requiere que las gates obligatorias hayan pasado y aprobación humana.

## State transition contract

Las fases son estados de workflow, no estados adicionales del agregado `Task`. Cada transición debe registrar `taskId`, fase anterior, fase nueva, actor, razón, timestamp y evidencias asociadas. Una fase puede completarse varias veces durante una Task.

| From | To permitido | Condición mínima |
|---|---|---|
| FRAME | EXPLORE, DESIGN, BUILD | intención y criterio de aceptación registrados |
| EXPLORE | FRAME, DESIGN, BUILD | contexto inspeccionado o incertidumbre explicitada |
| DESIGN | FRAME, BUILD, REVIEW | decisión/interfaz o plan mínimo registrado |
| BUILD | EXPLORE, VERIFY, REVIEW | ChangeSet capturado |
| VERIFY | BUILD, REVIEW, RECONCILE | evidencia de checks disponible |
| REVIEW | BUILD, VERIFY, RECONCILE | Review independiente y findings clasificados |
| RECONCILE | FRAME, BUILD, SHIP | impacto documental y findings reconciliados |
| SHIP | — | gates obligatorias pasadas y aprobación humana |

Las transiciones no permitidas fallan sin mutar el estado. `reenter` es una transición explícita hacia una fase anterior y conserva el historial; no reinicia ni duplica la Task.

## Gate contract

Una gate tiene `id`, `phase`, `required`, `status`, `evidenceIds` y `failureReason`. Las gates obligatorias bloquean el avance; las informativas sólo dejan una observación. El conjunto mínimo es:

- `task-framed`: intención y aceptación presentes antes de BUILD.
- `changeset-captured`: BUILD deja un ChangeSet identificable.
- `verification-evidence`: VERIFY registra build, tests o evidencia runtime apropiada.
- `independent-review`: REVIEW usa un Reviewer separado cuando la policy lo exige.
- `documentation-reconciled`: RECONCILE resuelve impactos `required`.
- `human-approval`: SHIP requiere una decisión humana explícita.

Un fallo debe incluir una fase de reentrada recomendada. La gate no decide por sí sola si el trabajo se corrige, se acepta con riesgo o se abandona.

### Phase semantics

- **FRAME:** intención, alcance, criterios de aceptación, riesgo y modo inicial.
- **EXPLORE:** inspección del repositorio, runtime, documentación y restricciones desconocidas.
- **DESIGN:** opciones, interfaces, impacto y plan mínimo; sólo necesario cuando la decisión merece diseño explícito.
- **BUILD:** implementación o cambio operativo por el Implementer.
- **VERIFY:** build, tests, checks y evidencia runtime adecuados al riesgo.
- **REVIEW:** evaluación independiente del resultado, no continuación de la conversación del Implementer.
- **RECONCILE:** impacto documental, decisiones, findings pendientes y estado final.
- **SHIP:** aprobación humana, commit y cierre de la Task.

## Adaptive modes

El sistema selecciona un modo inicial y puede escalarlo:

| Mode | Flujo por defecto | Uso |
|---|---|---|
| quick | `FRAME → BUILD → VERIFY` | Cambio pequeño, local y de bajo riesgo |
| standard | `FRAME → EXPLORE → BUILD → VERIFY → REVIEW → RECONCILE → SHIP` | Feature o bug normal |
| design-heavy | `FRAME → EXPLORE → DESIGN → REVIEW → BUILD → VERIFY → RECONCILE → SHIP` | Cambio arquitectónico o contrato público |
| recovery | `EXPLORE → BUILD/VERIFY` | Fallo, regresión o nueva evidencia durante otro modo |

El modo no puede omitir invariantes: ChangeSet, evidencia de verificación, review cuando la policy la exige y aprobación humana antes de commit.

## Workflow skills

### Transition skills

```text
frame-task
explore-codebase
design-change
build-change
verify-result
review-change
reconcile-task
ship-change
```

### Responsibility skills

```text
implementer
reviewer
architect
test-engineer
documentation-impact
```

### Domain skills

Las skills de dominio (`java-analysis`, `spring-migration`, `frontend-ui`, `database-change`, `security-review`, etc.) se combinan con las anteriores y no cambian por sí mismas el estado de la Task.

## Skill invocation contract

Una transition skill recibe una Task, la fase actual, restricciones, evidencia disponible y el modo. Devuelve una propuesta de resultado con evidencias, gates afectadas y fase siguiente; la aplicación valida la transición antes de persistirla. Una skill puede recomendar `reenter` o escalar de modo, pero no puede saltarse una gate obligatoria ni aprobar `SHIP`.

```ts
type WorkflowResult = {
  phase: string;
  next?: string;
  evidenceIds: string[];
  gateUpdates: Array<{ id: string; status: "passed" | "failed" | "waived" }>;
  reason: string;
};
```

## Transitions and triggers

Las transiciones se activan por intención humana, finalización de una skill, resultado de una gate o nueva evidencia. Ejemplos:

```text
ambiguous requirement → FRAME or DESIGN
unknown architecture  → EXPLORE
test failure           → BUILD
new runtime evidence   → EXPLORE or VERIFY
review finding         → BUILD
contract change        → DESIGN → REVIEW
documentation impact   → RECONCILE
```

No debe existir un `re-discuss` global obligatorio. La reentrada se dirige al estado que necesita corrección, conservando el historial de por qué se volvió atrás.

## Gates and invariants

- La Task tiene intención y criterios de aceptación antes de `BUILD`.
- Todo `BUILD` produce un ChangeSet identificable.
- Todo cambio ejecutable produce evidencia de `VERIFY`.
- Los cambios significativos pasan por Reviewer independiente.
- Findings y fallos de gates son accionables.
- El impacto documental se reconcilia antes de completar.
- El commit requiere aprobación humana en el MVP.

## Commands

La interfaz de workflow debe exponer operaciones equivalentes a:

```bash
start-task --project <project-id> --mode standard --intent "..."
resume-task <task-id>
advance-task <task-id>
reenter-task <task-id> --at explore --reason "new evidence"
review-task <task-id>
ship-task <task-id> --approve --reason "acceptance confirmed"
```

En v0.1 son comandos de aplicación, aunque inicialmente puedan exponerse sólo mediante una CLI de desarrollo. `ship-task` debe rechazar la operación si falta `--approve` o existe una gate obligatoria fallida.

## Project Structure

```text
src/application/workflow/ → Orquestación de transiciones
src/domain/workflow/      → Estados, modos, triggers e invariantes
src/skills/workflow/      → Skills de transición y responsibility
tests/workflow/            → Matriz de modos, loops y gates
```

## Code Style

Las transiciones deben declarar causa y evidencia:

```ts
workflow.reenter({
  taskId,
  target: "explore",
  reason: "runtime evidence contradicts the initial assumption",
  evidenceIds: [logId, testRunId],
});
```

## Testing Strategy

- Tests de transición para cada modo.
- Tests de que quick mode no omite invariantes.
- Tests de reentrada y preservación de historial.
- Tests de escalado de modo por riesgo/evidencia.
- Tests de gates bloqueantes y aprobación humana.
- Test end-to-end del flujo standard y del recovery loop.

## Boundaries

- **Always:** adaptar el flujo al riesgo; conservar estado e historial; hacer visible la razón de cada transición; usar gates como protección.
- **Ask first:** cambiar invariantes, permitir ship automático, introducir una nueva transición global o hacer obligatoria una skill.
- **Never:** imponer todas las fases a todo cambio; reabrir toda la Task ante cualquier fallo; considerar una fase completada sin evidencia.

## Success Criteria

El mismo sistema permite completar un typo con un flujo corto y un cambio arquitectónico con exploración/diseño/review, manteniendo trazabilidad y gates. Un fallo en tests vuelve a `BUILD` y un requisito ambiguo vuelve a `FRAME`/`DESIGN` sin perder el trabajo previo.

## v0.1 decisions

- La selección de modo es híbrida: el humano puede elegirlo y ADE puede recomendar una escalada por riesgo o evidencia.
- “Cambio significativo” significa, como mínimo, cambio de contrato público, migración de datos, modificación de seguridad, impacto documental `required` o una policy que exija Reviewer.
- Las transition skills son capacidades invocables detrás de una interfaz de aplicación; no son estados obligatorios ni autoridad para mutar el dominio directamente.
- Los ciclos se representan como transiciones repetidas con `cycleId` y evidencias nuevas; no se crea una Task nueva por cada re-build o re-review.

## Open Questions

- ¿Qué heurísticas concretas alimentan la recomendación automática de escalada?
- ¿Qué persistencia tendrán gates y `cycleId` en el esquema definitivo de ADE?
- ¿Qué policy predeterminada exige Reviewer y qué cambios puede aceptar con riesgo el humano?
