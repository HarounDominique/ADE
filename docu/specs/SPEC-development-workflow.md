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

## Activation

El workflow viene **activado por defecto** y puede desactivarse en dos niveles, decididos en [ADR-0056](../adr/0056-native-development-workflow.md):

| Nivel | Dónde | Precedente |
|---|---|---|
| Operador | `UserSettings.developmentWorkflow` en la base de ADE | `turnChime` ([ADR-0053](../adr/0053-user-settings-live-in-ades-store.md)) |
| Project | `developmentWorkflow` en `.ade/policy.json` | `requiredGates` ([ADR-0044](../adr/0044-verification-gates-from-real-runs.md)) |

El Project gana cuando se pronuncia: un repositorio que declara `developmentWorkflow: true` lo exige a quien lo abra, y uno que declara `false` lo apaga aunque el operador lo prefiera. Ausencia de declaración en `.ade/policy.json` cede la decisión al operador; ausencia en ambos sitios significa activado.

Desactivado, la Task conserva estado de ciclo de vida, gates, evidencia, review y aprobación. Lo que se apaga es la conducción por fases: nadie propone la fase siguiente, nadie cuenta intentos y el guard TDD no bloquea. La gobernanza no depende de este interruptor.

## Attempts and model escalation

Cada fase cuenta sus propios intentos sobre la Task, y el contador se reinicia al entrar en un ciclo nuevo de esa fase, nunca a mitad.

| Intento | Comportamiento |
|---|---|
| 1 | Despachar en el tier por defecto de la fase |
| 2 | Despachar la misma fase subiendo un tier, una sola vez |
| 3 | No despachar. Detener la fase y pedir decisión humana, nombrando fase, intentos y última razón de fallo |

No es un presupuesto de reintentos que se pueda ampliar: el tercer intento es la parada prevista. Un fallo que ya sobrevivió a un tier superior es información sobre el problema, no sobre el modelo.

El contador vive junto a la fase, no en el prompt, para que reanudar una Task tras cerrar la aplicación no reinicie la escalada ni la repita.

## TDD guard

Antes de que un cambio pase `VERIFY`, un chequeo determinista sobre el diff staged decide, sin intervención de un agente:

- Todo fichero de producción **añadido o modificado** lleva un fichero de test en el mismo diff. Un fichero de producción sólo **borrado** no exige nada: limpiar no es un cambio sin probar.
- La verificación declarada del Project terminó en `0`, leída de la evidencia `verification.tests.pass|fail` que [ADR-0044](../adr/0044-verification-gates-from-real-runs.md) ya produce. Sin evidencia de ejecución, el guard bloquea: ausencia no es verde.

Producción y test se distinguen por nombre de fichero —extensión conocida y patrón `test_*`, `*_test.*`, `*.test.*`, `*.spec.*`— lo que funciona igual para una raíz plana que para `src/` + `tests/`. Un Project cuya convención sea genuinamente distinta la declara una vez en `.ade/policy.json`, nunca por commit.

El guard no comprueba el **orden** en que se escribieron test e implementación: un chequeo sobre un diff no puede verlo. El orden lo impone `BUILD`, que exige un RED verificado antes de implementar. El guard cubre el caso que sí puede ver — que el test falte del todo.

## Learning loop

`RECONCILE` extrae de la Task cerrada reglas reutilizables. Una regla es una línea directiva con su evidencia de origen, un contador de refuerzo y una prioridad en cuatro niveles (`low` < `medium` < `high` < `critical`).

Una regla nueva nace en `low` con un solo refuerzo; sólo asciende cuando varias Tasks la reconfirman. Nunca sobrescribe una regla escrita por un humano.

Las fases que evalúan trabajo —`REVIEW` sobre todo— cargan las reglas que apliquen a los ficheros tocados, no el corpus entero, y una regla que la validación de seguridad rechazó no se carga nunca. El coste de contexto de las reglas está acotado por la misma razón que lo está el de las fases.

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
src/domain/workflow/      → Fases, modos, matriz de transiciones, intentos e invariantes
src/application/workflow/ → Orquestación, persistencia de estado, guard TDD y activación
tests/                     → Matriz de modos, loops, gates y escalada (un fichero por seam)
```

Los tests viven en `tests/` en plano, como el resto del repositorio, no en un subárbol
propio: `tests/workflow-phase.test.ts`, `tests/workflow-mode.test.ts`,
`tests/workflow-attempts.test.ts`, `tests/commit-guard.test.ts`.

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
