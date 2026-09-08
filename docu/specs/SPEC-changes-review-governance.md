# Spec: Changes, Review and Governance

<!-- Nexus: SPEC-NEXUS.md | Module id: changes-review-governance -->

## Objective

Hacer observable, verificable y reversible el resultado del agente mediante ChangeSets, Git, quality gates, review independiente y aprobación humana.

El pipeline se integra con las transiciones del módulo `development-workflow`: las gates son invariantes del flujo, no fases rígidas. Un fallo debe indicar el punto de reentrada recomendado (`BUILD`, `VERIFY`, `EXPLORE` o `RECONCILE`). Véase [SPEC-development-workflow.md](SPEC-development-workflow.md#transitions-and-triggers).

## Review hierarchy

La revisión humana se presenta de menor a mayor detalle: resumen semántico, impacto arquitectónico/comportamental, findings, archivos y diff. El Reviewer debe poder explicar qué cambió, qué evidencia lo respalda, qué riesgo queda y qué documentación se ve afectada.

## Gate contract

```text
BUILD → TESTS → AGENT_REVIEW → DOCUMENTATION_REVIEW → HUMAN_APPROVAL → COMMIT
```

Cada gate tiene estado, actor, duración, evidencia, findings y recomendación de reentrada. Los checkpoints permiten comparar y revertir; el mecanismo exacto se decidirá en el spike de Git.

## Gate semantics

Las gates se evalúan en orden, pero un fallo puede reentrar en la fase que lo necesita sin reiniciar la Task:

| Gate | Evidencia mínima | Fallo vuelve a |
|---|---|---|
| `build` | código de salida 0 y logs | BUILD |
| `tests` | comandos definidos, salida y código 0 | BUILD o VERIFY |
| `agent-review` | Review independiente persistida | REVIEW |
| `documentation-review` | evidencia `documentation.reconciled` con paquete de reconciliación y traza de Nexus | RECONCILE |
| `structural-gate` | evidencia `structural.gate.*` con veredicto, componentes y versión de la herramienta; opt-in por `requiredGates` ([SPEC-structural-gate.md](SPEC-structural-gate.md)) | BUILD o VERIFY |
| `human-approval` | actor humano, decisión y razón | BUILD, REVIEW o RECONCILE |
| `commit` | aprobación previa y referencia al ChangeSet | SHIP |

**Hueco abierto (2026-09-08):** `tests` exige evidencia de tipo `verification` que hoy ningún productor escribe, y `build` se resuelve por la existencia de un `ChangeSet` en lugar de por una ejecución. Con la policy por defecto eso deja la aprobación humana permanentemente bloqueada. El inventario y la dirección de arreglo están en [product-gap-audit](../knowledge/product-gap-audit.md#g2--la-gate-tests-no-puede-pasar-y-build-no-comprueba-nada); hasta cerrarlo, esta sección describe el contrato buscado, no el comportamiento vigente.

Una gate tiene estados `pending`, `passed`, `failed` o `waived`. Sólo una policy explícita permite `waived`, siempre con actor, motivo y evidencia. `failed` no destruye el ChangeSet ni la evidencia anterior. La aplicación debe impedir `SHIP` si alguna gate requerida no está en `passed` o `waived` conforme a policy.

## ChangeSet and checkpoint contract

Un ChangeSet inmutable vincula `taskId`, sesión Implementer, repositorio, diff del runtime, estado Git, patch, archivos no trackeados y timestamp. Cada nuevo ciclo de BUILD produce un nuevo ChangeSet; la Task conserva la secuencia y nunca se sobrescribe evidencia histórica.

Un checkpoint es una referencia a un estado Git identificable (`commit`, branch o snapshot disponible) y a su ChangeSet. Restaurar un checkpoint requiere confirmación humana si puede descartar cambios no guardados. El MVP puede mostrar y persistir ChangeSets sin implementar todavía restauración automática.

## Review and finding contract

El Reviewer recibe intención, criterios, ChangeSet y evidencia fresca. Cada Finding debe contener severidad, claim, evidencia, ubicación opcional y acción. Las acciones `fix` y `assign` mantienen abierta la Task; `accept-risk` requiere actor humano cuando la severidad es `high` o `critical`; `dismiss` requiere razón. Un re-review crea una nueva Review relacionada con el mismo `taskId` y el ChangeSet corregido.

## Project Structure

```text
src/application/change-review/ → Pipeline y casos de uso
src/ports/git.ts              → Operaciones Git
src/ports/reviewer.ts         → Contrato de contexto fresco
src/domain/governance/        → Gates, Findings y Policies
src/adapters/opencode-reviewer.ts → Reviewer LLM con salida estructurada
tests/change-review/           → Tests de pipeline y reglas
```

## Commands

El MVP debe ejecutar comandos configurables de build y tests del repositorio, capturando código de salida, duración, stdout/stderr y artefactos relevantes.

La primera implementación del contrato de Reviewer se valida con:

```bash
npm run build
npm test
```

El reviewer determinista del Spike 002 valida el pipeline; no se considera sustituto de una revisión semántica LLM.

El flujo de aplicación previsto es:

```bash
run-checks <task-id> --build --tests
review-task <task-id>
reconcile-task <task-id>
approve-task <task-id> --reason "acceptance confirmed"
ship-task <task-id>
```

`ship-task` no ejecuta `git commit` si falta aprobación humana, hay findings sin decisión o una gate requerida fallida.

## Code Style

Un Finding es accionable y no texto perdido:

```ts
type Finding = {
  severity: "low" | "medium" | "high";
  location?: FileLocation;
  claim: string;
  evidence: string;
  action: "fix" | "assign" | "accept-risk" | "dismiss";
};
```

## Testing Strategy

Tests de gates con éxito, fallo y reintento; tests de captura de diff; tests de que no hay commit sin aprobación humana; fixtures de reviewer y regresiones; smoke tests sobre un repositorio temporal.

## Boundaries

- **Always:** separar Implementer/Reviewer; conservar evidencia; permitir re-review; mantener commit posterior a aprobación.
- **Always:** devolver una recomendación de reentrada cuando falle una gate; no reiniciar el workflow completo por defecto.
- **Ask first:** aceptar riesgo alto, automatizar commit, alterar políticas o eliminar checkpoints.
- **Never:** autoaprobar cambios; convertir texto del reviewer en finding sin evidencia; perder el diff original.

## Success Criteria

El flujo `implement → build → tests → review → fix → re-review → documentation gate → human approval → commit` produce un resultado trazable y deja claro por qué cada gate pasó o falló. La Review persiste `taskId`, `changeSetId`, reviewer, resumen, estado y findings.

## v0.1 decisions

- Son obligatorias por defecto `build`, `tests`, `agent-review`, `documentation-review` y `human-approval`; `.ade/policy.json` puede adaptar la lista por Project. `knowledge.reconcile.apply` persiste la evidencia documental cuando recibe una Task.
- El MVP persiste checkpoints y ChangeSets; la restauración automática queda fuera hasta validar la política de descarte de cambios.
- El resumen semántico del Reviewer es informativo; la decisión se basa en findings, evidencia y gates, no en una puntuación única.

## Open Questions

- ¿Cómo se configuran las policies por Project sin duplicar reglas en las specs?
- ¿Qué formato final tendrá el vínculo entre checkpoint, branch y commit?
- ¿Cómo se presenta al humano un riesgo aceptado para que siga siendo auditable?
