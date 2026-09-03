# Plan: ADE v0.2 — Operación verificable

<!-- Spec: docu/specs/SPEC-v0.2.md | Release: v0.2 -->

## Objective

Implementar la segunda iteración sobre la base local validada en v0.1, conservando el sidecar y los casos de uso como fronteras de autoridad.

## Implementation order

1. **Runtime evidence** — Añadir entidad/persistencia de eventos resumidos, migración SQLite y consultas por Task; el sidecar debe publicar evidencia sin secretos.
2. **Task detail read model** — Componer una vista de detalle con historial, ChangeSet, Review y runtime evidence; añadir `task.detail` y `runtime.history`.
3. **Review gates UI** — Conectar Changes a Review/Gate reales, mostrar evidencia y proteger aprobación/re-review con actor y razón.
4. **Local services** — Declarar servicios, lifecycle controlado, healthcheck y logs; probar procesos temporales y timeouts.
5. **Rehydration smoke** — Reiniciar app/sidecar, rehidratar Task y evidencia, y ejecutar el recorrido completo en `.app`.

## Dependencies

Runtime evidence precede al read model; éste precede la UI de review. Services puede avanzar en paralelo después de fijar el contrato local-runtime. El smoke final depende de todos los cortes.

## Risks and mitigations

- **Crecimiento de logs:** límites por evento, tamaño y retención; no almacenar conversación completa.
- **Deriva entre UI y governance:** toda mutación pasa por casos de uso y gates; la UI sólo orquesta.
- **Procesos huérfanos:** supervisor idempotente, timeout y reap explícito; tests con procesos temporales.
- **Migraciones frágiles:** migración incremental y round-trip contra DB antigua.
- **Scope creep:** cualquier capacidad fuera de `SPEC-v0.2.md` requiere nueva decisión en el Nexus.

## Verification checkpoints

- Tras runtime evidence: build, tests de migración, captura y consulta por Task.
- Tras read model: tests de selección/rehidratación y contrato sidecar.
- Tras review gates: tests de bloqueo, waiver, aprobación y re-review.
- Tras services: tests de start/health/stop/timeout sin secretos.
- Antes del cierre: suites TypeScript/Rust, `.app` arm64 y smoke con DB temporal fuera del workspace.

## Delivery rule

Un commit por tarea implementada y otro por sincronización documental cuando cambie un contrato. No iniciar el siguiente punto con el checkpoint anterior en rojo.
