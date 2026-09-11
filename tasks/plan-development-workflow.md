# Plan: Native adaptive development workflow

<!-- Spec: docu/specs/SPEC-development-workflow.md | Module id: development-workflow | ADR-0056 -->

## Objective

Construir el módulo `development-workflow` que `SPEC-development-workflow` especifica desde 2026-09-02 y que nunca se implementó, con SEED como implementación de referencia de sus mecanismos. El flujo debe venir activado y poder desactivarse por operador y por Project.

## Current baseline

Auditoría del 2026-09-11: el módulo estaba marcado `done` en `SPEC-NEXUS` sin una sola línea de código. `src/domain/workflow/`, `src/application/workflow/`, `src/skills/workflow/` y `tests/workflow/` no existían; `FRAME`, `RECONCILE`, `reenter`, `design-heavy` y `WorkflowResult` no aparecían en `src/` ni en `tests/`. La skill nativa `adaptive-workflow` era un manifiesto sin cuerpo, igual que `spector`.

El nexus ya está corregido a `in-progress` y la decisión registrada en [ADR-0056](../docu/adr/0056-native-development-workflow.md).

## Implementation order

1. **Dominio de fases** — fases, modos, matriz de transiciones, reentrada explícita, ciclos, contador de intentos y escalada. Sin dependencias de persistencia ni de proveedor.
2. **Activación** — preferencia de operador en `UserSettings`, override de Project en `.ade/policy.json`, resolución con el Project ganando cuando se pronuncia.
3. **Persistencia** — tabla `workflow_state` junto a la Task; el estado de workflow no es un campo de `tasks` porque es un eje distinto de `TaskStatus`.
4. **Guard TDD** — chequeo determinista sobre el diff staged, leyendo la evidencia `verification.tests.*` que ADR-0044 ya produce.
5. **Orquestación** — casos de uso que proponen fase siguiente, aplican `WorkflowResult`, atan evidencia y gates, y respetan el halt del tercer intento.
6. **Sidecar** — comandos `workflow.*` para que la shell lea y avance el estado.
7. **Superficie** — fase, modo, intentos y motivo de reentrada visibles; interruptor en Settings.
8. **Bucle de aprendizaje** — extracción de reglas en `RECONCILE`, con prioridad, refuerzo y validación de seguridad antes de cargarlas.

## Risks and mitigations

- **Mezclar fase con `TaskStatus`:** son ejes ortogonales y se persisten por separado; la spec ya lo había decidido y el dominio lo respeta.
- **Que el guard TDD bloquee trabajo legítimo:** un borrado puro no exige test, y la convención de nombres es declarable por Project. Se probó contra los casos reales antes de conectarlo.
- **Deriva con SEED:** dos implementaciones de la misma metodología. Aceptada explícitamente en ADR-0056; SEED queda declarado como referencia upstream, no como copia a mantener sincronizada automáticamente.
- **Activación por defecto que sorprenda a un Project existente:** desactivado se conserva todo el comportamiento actual; lo que se apaga es la conducción, no la gobernanza.
