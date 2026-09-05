# Spec: ADE v0.2 — Operación verificable

<!-- Nexus: SPEC-NEXUS.md | Release spec: v0.2 -->

**Estado de release:** CERRADA — sus criterios quedaron verificados dentro del cierre de v0.3.

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

Work debe permitir seleccionar una Task, ver su historial y acceder a Changes y Knowledge conservando el contexto; la evidencia de runtime se consulta desde Work y los consumidores operativos, sin una vista Runtime independiente. El resumen operativo dentro de `Projects` debe mostrar la Task activa y la última evidencia confirmada.

## Out of scope

Cloud, cuentas, sync, colaboración realtime, worktrees paralelos, multiagente complejo, browser automation, editor completo, restauración automática de checkpoints y commits autónomos.

## Public contracts

- `ProjectSnapshot` incorpora la Task activa y referencias resumidas a ChangeSet, Review y runtime evidence.
- El sidecar añade consultas `task.detail`, `runtime.history` y `change.review`; las mutaciones siguen pasando por casos de uso.
- `ServiceManager` ejecuta servicios declarados sobre `ProcessPort`, aplica healthcheck opcional y expone estados `DECLARED/RUNNING/FAILED/STOPPED`.
- La evidencia Runtime persistida queda limitada a tipo, resumen, detalles acotados, Task, sesión y timestamp.
- Los eventos de runtime persistidos no contienen secretos ni el contenido completo de conversaciones.
- Las acciones de gate requieren actor, razón y evidencia; aprobación humana sigue siendo obligatoria antes de commit.
- `task.approve` persiste la decisión humana y sólo completa la Task cuando las gates previas tienen evidencia; la gate humana no se satisface implícitamente por una consulta.

## Testing Strategy

- Tests de contrato para los nuevos métodos del sidecar y read models.
- Tests de persistencia y migración para runtime evidence, ChangeSets y Reviews.
- Tests de gates para aprobación, re-review, findings y reentrada.
- Tests de servicios con procesos temporales, healthcheck, timeout y parada.
- Smoke desktop con una Task real sobre `.app`, incluyendo rehidratación tras reinicio.

## Success Criteria

1. Una Task puede ejecutarse, cerrarse y reabrirse conservando eventos y contexto.
2. Changes muestra evidencia real, gates y findings de la Task seleccionada.
3. Una gate requerida bloquea aprobación/commit hasta que exista evidencia válida o waiver conforme a policy, y la aprobación/re-review se ejecutan mediante casos de uso auditables.
4. Un servicio local declarado puede iniciarse, comprobarse y detenerse mediante el contrato de runtime y sus superficies operativas, sin exigir un menú Runtime independiente.
5. ✅ El smoke empaquetado y el test de rehidratación sobreviven al reinicio de la app sin perder el historial operativo.

## Delivery order

`runtime-evidence → task-detail-read-model → review-gates-ui → local-services → rehydration-smoke`.

Cada corte debe actualizar las specs dependientes y el nexus antes de implementar el siguiente.

## Decisions carried forward

Las decisiones de esta versión son deliberadamente conservadoras y están cerradas. Los límites que se ampliaron posteriormente viven en [SPEC-v0.3](SPEC-v0.3.md):

- La evidencia visible en las superficies consumidoras queda limitada a 100 evidencias por Task y 12 eventos en la shell; v0.3 añade límites configurables de evidencia por Project.
- v0.2 usa gates declarativas; v0.3 añade la policy configurable por Project.
- El `ServiceManager` y sus pruebas existen; la declaración persistida se carga desde una policy local equivalente (`.ade/services.json` por defecto, configurable mediante `ADE_SERVICES_PATH`). El runtime conserva el contrato para listar servicios del Project, su comando/cwd/healthcheck y sus operaciones start/stop; la shell no expone una vista Runtime independiente y la validación de release sigue siendo macOS-local.
- Tras reinicio, la evidencia mínima para reanudar es Task + historial + ChangeSet + Review + runtime evidence + gates persistidos. El contrato de rehidratación está cubierto con store reiniciado; el smoke macOS empaquetado validó sidecar, Task real, OpenCode 1.18.26 y arranque/parada limpia de `.app`.
