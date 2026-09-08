# ADR-0037 — Evidencia estructural como gate, no como análisis propio

## Status

Accepted

## Date

2026-09-08

## Context

El modelo de verdad del nexus ya reserva una fila para ASK como «evidencia estructural». Assay no analiza código: dirige agentes y pesa su trabajo. ASK Engine analiza código de forma determinista y no ejecuta agentes. La pregunta era si Assay debía incorporar análisis estructural propio, absorber ASK, o consumirlo.

Un gate de Assay ya existe con su vocabulario (`passed`, `failed`, `pending`, `waived`), su evidencia citable y su política por Project. ASK ya publica un veredicto con vocabulario propio (`PASS`, `BLOCK`, `UNVERIFIED`), esquema versionado (`ask-pack-gate-v1`) y manifiesto con la versión y el commit que lo produjeron.

## Decision

Assay consume ASK por contrato, nunca por código compartido. La skill de Project `ask-gate` es la unidad de autorización; `gate.ask` ejecuta `ask pack gate` y traduce su veredicto a la gate `structural-gate`, que se publica con la evidencia que la produjo.

`UNVERIFIED` se traduce a `pending`, nunca a `passed`: ASK declara explícitamente que no probó nada en ninguna dirección, y una gate que pasa por silencio es exactamente lo que este producto existe para evitar. Un exit distinto de cero es una respuesta que leer, no un fallo: el veredicto se lee del payload.

La gate es opt-in por Project mediante `.ade/policy.json`. ASK responde con solvencia en Java/Spring; imponerla a todo Project convertiría un silencio esperado en un bloqueo permanente.

## Alternatives considered

### Absorber ASK dentro de Assay

- **Ventaja:** una sola instalación y un solo release.
- **Rechazo:** toolchains incompatibles (Python/hatch frente a TypeScript/Tauri/cargo), licencias distintas, madurez opuesta, y ASK pierde su alcance fuera de Assay (CI, MCP en otros clientes).

### Reimplementar el análisis estructural en el sidecar

- **Ventaja:** sin dependencia externa.
- **Rechazo:** duplica años de trabajo determinista para producir una respuesta peor, y convierte a Assay en un analizador que debe mantener reglas por framework.

### Consumir ASK por MCP en vez de por CLI

- **Ventaja:** una sola superficie para las 32 herramientas de ASK.
- **Rechazo:** Assay no tiene cliente MCP hoy. La CLI ya publica el mismo veredicto con esquema versionado, así que la vía MCP queda abierta sin bloquear esta.

## Consequences

- Un Project declara `structural-gate` en su política y obtiene un bloqueo con evidencia citable; uno que no la declara no cambia de comportamiento.
- Assay depende de un binario externo cuya ausencia se reporta como `ASK_UNAVAILABLE` y nunca como gate aprobada.
- El contrato de veredicto queda anclado al esquema `ask-pack-gate`; un cambio de esquema falla de forma explícita en vez de leerse mal.
