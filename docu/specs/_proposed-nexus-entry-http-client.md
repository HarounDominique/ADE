# Propuesta de entrada en SPEC-NEXUS.md — módulo `http-client`

No aplicada todavía. Pegar en `SPEC-NEXUS.md` sólo tras aprobación humana.

La pregunta de navegación ya se resolvió (sexta entrada `Requests`, entre `Agents` y
`Version control` — ver `SPEC-http-client.md#decisions` y la nota en
`SPEC-desktop-shell.md#information-architecture`). Queda pendiente el spike de
extracción del motor de Bruno (ADR-0059) antes de mover el módulo de `planned` a
`in-progress`.

## Fila para la tabla `## Modules`

```
| http-client | [SPEC-http-client.md](SPEC-http-client.md) | Cliente de peticiones HTTP embebido, colecciones versionables y evidencia de ejecución por Task | project-task-workflow, changes-review-governance, workspace-core, desktop-shell | planned | spike de extracción del motor (ADR-0059) |
```

## Entrada para el `## Change Log`

```
- 2026-09-14 — http-client-spec — Se documenta el módulo `http-client` como base para
  añadir un cliente de peticiones HTTP embebido, vendorizando el motor de Bruno (MIT,
  colecciones `.bru` como ficheros de texto) en lugar de construir un cliente desde cero
  o embeber su aplicación de escritorio completa; la decisión y sus alternativas quedan
  en [ADR-0059](../adr/0059-vendor-bruno-as-embedded-http-client.md). El módulo queda
  `planned`, pendiente del spike de extracción del motor y de resolver si necesita una
  sexta entrada de navegación o vive dentro de una vista existente.
```

## Por qué no se aplicó directamente

`SPEC-NEXUS.md` es el índice único de specs del producto y su tabla de módulos es
contrato leído por todo el resto del corpus. Añadir una fila ahí declara el módulo como
parte aceptada de la hoja de ruta de Assay, no como una exploración. Dado que
`SPEC-http-client.md` deja abierta una pregunta que toca el contrato fijo de
`SPEC-desktop-shell.md#information-architecture` (orden de navegación), aplicar esta
entrada antes de esa decisión escribiría en el Nexus un compromiso que el propio spec
todavía no puede sostener.
