# Spec: ADE v0.2 — Operación verificable

<!-- Nexus: SPEC-NEXUS.md | Release spec: v0.2 -->

## Objective

Convertir el MVP desktop en una workstation operativa para el ciclo diario de una Task: ejecutar trabajo, conservar evidencia entre sesiones, revisar cambios con gates visibles y reentrar sin perder contexto.

La versión v0.2 parte de la arquitectura validada en v0.1. No cambia la unidad de trabajo (`Task`), el sidecar local, la separación Implementer/Reviewer ni el principio de aprobación humana.

## Baseline and assumptions

- El MVP local ya arranca como `.app` arm64 y el sidecar standalone responde por stdio.
- OpenCode continúa siendo el primer adapter; cambiar de proveedor no forma parte de esta versión.
- SQLite sigue siendo metadata local provisional y Git conserva la historia del repositorio.
- La UI puede mostrar datos persistidos y eventos locales, pero no se convierte en un editor completo.

## Scope

### Review and governance in Changes

Changes debe cargar el ChangeSet y Review de la Task seleccionada, mostrar gates con estado/evidencia, permitir re-review y preparar aprobación humana. Ninguna acción de aprobación o commit puede saltarse una gate requerida.

### Persistent runtime evidence

Los eventos de Implementer, healthchecks, stdout/stderr resumidos y errores deben persistirse con `taskId`, sesión, timestamp y tipo. Runtime debe rehidratar el historial al abrir la app, limitar el volumen visible y distinguir evidencia actual de estado stale.

### Local project services

Un Project puede declarar servicios locales con comando, directorio, puertos, healthcheck y política de parada. Runtime puede iniciar, inspeccionar y detener un servicio con confirmación cuando corresponda. Las credenciales no se persisten en ADE DB.

### Task navigation and context

Work debe permitir seleccionar una Task, ver su historial y saltar a Runtime, Changes y Knowledge conservando el contexto. El Project Hub debe mostrar la Task activa y la última evidencia confirmada.

## Out of scope

Cloud, cuentas, sync, colaboración realtime, worktrees paralelos, multiagente complejo, browser automation, editor completo, restauración automática de checkpoints y commits autónomos.

## Public contracts

- `ProjectSnapshot` incorpora la Task activa y referencias resumidas a ChangeSet, Review y runtime evidence.
- El sidecar añade consultas `task.detail`, `runtime.history` y `change.review`; las mutaciones siguen pasando por casos de uso.
- La evidencia Runtime persistida queda limitada a tipo, resumen, detalles acotados, Task, sesión y timestamp.
- Los eventos de runtime persistidos no contienen secretos ni el contenido completo de conversaciones.
- Las acciones de gate requieren actor, razón y evidencia; aprobación humana sigue siendo obligatoria antes de commit.

## Testing Strategy

- Tests de contrato para los nuevos métodos del sidecar y read models.
- Tests de persistencia y migración para runtime evidence, ChangeSets y Reviews.
- Tests de gates para aprobación, re-review, findings y reentrada.
- Tests de servicios con procesos temporales, healthcheck, timeout y parada.
- Smoke desktop con una Task real sobre `.app`, incluyendo rehidratación tras reinicio.

## Success Criteria

1. Una Task puede ejecutarse, cerrarse y reabrirse conservando eventos y contexto.
2. Changes muestra evidencia real, gates y findings de la Task seleccionada.
3. Una gate requerida bloquea aprobación/commit hasta que exista evidencia válida o waiver conforme a policy.
4. Un servicio local declarado puede iniciarse, comprobarse y detenerse desde Runtime.
5. El smoke empaquetado sobrevive al reinicio de la app sin perder el historial operativo.

## Delivery order

`runtime-evidence → task-detail-read-model → review-gates-ui → local-services → rehydration-smoke`.

Cada corte debe actualizar las specs dependientes y el nexus antes de implementar el siguiente.

## Open Questions

- ¿Qué retención y límite de tamaño tendrá la evidencia de runtime persistida?
- ¿Qué formato mínimo de policy por Project necesita la primera UI de gates?
- ¿Los servicios se declaran en SQLite, en `.ade/` versionado o en ambos?
- ¿Qué evidencia mínima permite marcar una Task como `IMPLEMENTED` tras reiniciar la app?
