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

Los comandos concretos dependen del runtime. La interfaz de workflow debe exponer operaciones equivalentes a:

```text
start-task --mode standard
resume-task <task-id>
advance-task <task-id>
reenter-task <task-id> --at explore --reason "new evidence"
review-task <task-id>
ship-task <task-id>
```

Son comandos conceptuales; sus nombres definitivos quedan abiertos hasta el Spike 001.

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

## Open Questions

- ¿La selección de modo es manual, automática o híbrida?
- ¿Qué umbrales determinan “cambio significativo”?
- ¿Las transition skills serán skills reales del runtime o primitivas nativas de ADE?
- ¿Cómo se representa una Task que contiene varios ciclos BUILD/VERIFY?
