---
slug: database-schema-browser
spec: docu/specs/SPEC-database-schema-browser.md
status: approved
---

## Implementation Roadmap

- [ ] Phase 1 — Dominio y detección de toolchain. Tipos `DatabaseConnection`/`SchemaColumn`/
  `SchemaForeignKey`/`SchemaTable`/`SchemaSnapshot`/`ToolchainGap` en `src/domain/`.
  Lectura/escritura round-trip de `.ade/database-connections.json`, validando que ningún
  campo de contraseña puede colarse en el tipo ni en el fichero. Detección de
  `psql`/`mysql`/`sqlite3` en el `PATH`, reutilizando el patrón de sondeo `--version` de
  `src/application/local-runtime/toolchain-inspection.ts`. Sin superficie de usuario.
  (satisfies: SPEC-database-schema-browser.md#product-contract,
  SPEC-database-schema-browser.md#connection-and-schema-contract)
  Test strategy: round-trip de `.ade/database-connections.json` contra fixtures; test de
  que el tipo `DatabaseConnection` no admite un campo de contraseña ni por accidente de
  tipado estructural; test de detección de toolchain con cliente presente/ausente.

- [ ] Phase 2 — Ejecución de introspección por motor. Construcción del comando exacto
  (argv) para `psql --csv`, `mysql --batch --raw` y `sqlite3 -json` contra las consultas
  fijas de catálogo (tablas, columnas, nullable, PK, FK a nivel de tabla, índices) de cada
  motor; ejecución como subproceso de una sola pasada vía `LocalProcess`; parseo de cada
  formato de salida a `SchemaSnapshot`; superficie de error nativo (`not-found` /
  `auth-failed` / `connection-failed`) sin intentar interceptar un prompt de contraseña.
  Métodos de sidecar: `database.connections.list`, `.connections.save`,
  `.connections.delete`, `database.schema.browse`.
  (satisfies: SPEC-database-schema-browser.md#product-contract,
  SPEC-database-schema-browser.md#boundaries)
  Test strategy: construcción de argv por motor y conexión contra fixtures fijos; parseo
  contra salida capturada real de cada cliente (con y sin tablas, columnas con caracteres
  especiales, con clave foránea); ningún test depende de un servidor real corriendo.

- [ ] Phase 3 — Superficie `Database` en la shell. Nueva entrada de navegación en el
  lateral (`desktop/src`): selector de conexión, formulario de alta/edición sin campo de
  contraseña, árbol de esquema expandible (bases/esquemas → tablas/vistas → columnas →
  claves), botón `Refresh` explícito, estado `ToolchainGap` accionable. **Necesita una
  decisión de diseño** (icono de nav, layout del panel) antes de construirse — mucho más
  pequeña que la de `http-client` Phase 4b (un árbol de solo lectura + un picker, no un
  editor de 5 tabs con panel redimensionable), así que puede resolverse inline al
  empezar el build en vez de requerir un doc `/seed:creative` propio; si al arrancar
  Phase 3 resulta haber más decisión de la prevista, se para y se corre `/seed:creative`
  como hizo `http-client`.
  (satisfies: SPEC-database-schema-browser.md#product-contract)
  Test strategy: contract test de la superficie (selector, árbol, botón Refresh, estado de
  hueco de toolchain) sobre la shell.

- [ ] Phase 4 — Barrido de `#acceptance-criteria` y actualización de
  `SPEC-desktop-shell.md#information-architecture` con la nueva entrada de navegación,
  siguiendo el mismo criterio que aplicó `http-client` al pasar de `planned` a
  implementación activa.
  (satisfies: SPEC-database-schema-browser.md#acceptance-criteria,
  SPEC-database-schema-browser.md#decisions)
  Test strategy: barrido completo de SPEC-database-schema-browser.md#acceptance-criteria
  contra la suite real.

## Execution State

**Build Status**: NOT_STARTED
**Current Phase**: —
**Current Step**: —
**Step Attempts**: {2: 0, 3: 0, 4: 0}
**Last Block Rule**: none
**Can Resume**: YES

## Deviations

- La spec de origen vive en `docu/specs/SPEC-database-schema-browser.md` bajo el Nexus
  de producto (`docu/specs/SPEC-NEXUS.md`), no en `memory-bank/specs/`: mismo criterio
  ya documentado en `memory-bank/tasks/http-client.md` — este proyecto mantiene dos
  corpus de spec separados, y un módulo de Nexus de producto pertenece al primero. El
  campo `spec:` de este task file registra la ruta real.
- El estado `planned` de la fila del Nexus de producto es equivalente al `ready`/
  `approved` que este comando exige como gate — mismo razonamiento que
  `memory-bank/tasks/http-client.md`.
- Complejidad leída como `designed`, no `nexus`: un único módulo con una decisión de
  diseño abierta (superficie de navegación, Phase 3), sin capacidades bundladas que
  exijan spec-nexus propio dentro de esta tarea — el alcance ya se recortó
  deliberadamente durante la fase de spec para evitar precisamente eso.
- A diferencia de `http-client`, este roadmap no incluye una fase de historial/evidencia
  de Task: la spec la deja explícitamente fuera de alcance (Open Questions), no
  pendiente de planificar.
