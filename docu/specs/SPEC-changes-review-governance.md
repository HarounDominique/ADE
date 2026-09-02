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

## Project Structure

```text
src/application/change-review/ → Pipeline y casos de uso
src/ports/git.ts              → Operaciones Git
src/domain/governance/        → Gates, Findings y Policies
tests/change-review/           → Tests de pipeline y reglas
```

## Commands

El MVP debe ejecutar comandos configurables de build y tests del repositorio, capturando código de salida, duración, stdout/stderr y artefactos relevantes.

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

El flujo `implement → build → tests → review → fix → re-review → documentation gate → human approval → commit` produce un resultado trazable y deja claro por qué cada gate pasó o falló.

## Open Questions

- ¿Qué gates son obligatorios por defecto?
- ¿Cómo se implementan checkpoints reversibles?
- ¿Qué nivel de resumen semántico es fiable sin ASK?
