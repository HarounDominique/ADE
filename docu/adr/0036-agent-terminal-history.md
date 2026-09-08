# ADR-0036 — Historial sólo para terminales que ejecutan agentes

## Status

Accepted

## Date

2026-09-08

## Context

El dock de terminal es una superficie general: persistir todo lo que el usuario
escribe convertiría actividad manual y posiblemente sensible en historial de
Assay. Sin embargo, las conversaciones de agentes CLI son evidencia útil y se
pierden al cerrar la pestaña.

## Decision

Assay captura una sesión únicamente desde la primera invocación simple de
`claude`, `codex` o `opencode`. La conversación se guarda por Project al cerrar
la pestaña y se consulta desde un popup del dock; nunca se reanuda como PTY.

El título se solicita asíncronamente al mismo provider, usando Haiku para Claude
y Luna para Codex; OpenCode conserva su modelo local default. El fallback local
permite conservar la sesión aunque el provider no esté disponible.

## Alternatives considered

### Guardar toda terminal

Rechazado: confunde uso manual con conversaciones de agente y aumenta sin
necesidad la superficie de privacidad.

### Inferir al agente desde la salida del PTY

Rechazado: banners y texto pueden simularse; la orden ejecutable es una señal
más estrecha y auditable.

## Consequences

- Aliases, wrappers y pipelines pueden no reconocerse hasta tener un contrato
  explícito; se prefiere el falso negativo.
- Los transcripts quedan locales, aislados por Project y eliminables.
- El resumen no puede ejecutar comandos ni modificar el Project.
