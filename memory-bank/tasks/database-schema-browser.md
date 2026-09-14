---
slug: database-schema-browser
spec: docu/specs/SPEC-database-schema-browser.md
status: approved
---

## Implementation Roadmap

- [x] Phase 1 — Dominio y detección de toolchain. Tipos `DatabaseConnection`/`SchemaColumn`/
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
  Done: `src/domain/database-schema.ts`, `src/adapters/database-connection-store.ts`,
  `src/application/local-runtime/database-toolchain.ts` (reutiliza `probe()`, ahora
  exportado, de `toolchain-inspection.ts`), `tests/database-schema.test.ts`,
  `tests/database-connection-store.test.ts`, `tests/database-toolchain.test.ts`.
  11/11 tests nuevos, 683/683 suite completa, build limpio, review pasó limpio a la
  primera. Guarda contra contraseña verificada en dos capas independientes: tipo
  (`Extract<keyof DatabaseConnection, ForbiddenConnectionKey>` + `@ts-expect-error`) y
  runtime (`toConnection()` reconstruye cada entrada campo a campo en lectura y
  escritura, probado inyectando `password: "hunter2"` por spread y confirmando que ni
  la clave ni el valor sobreviven al fichero). Ninguna ambigüedad de spec encontrada;
  no aplica `/seed:spec-sync`.

- [x] Phase 2 — Ejecución de introspección por motor. Construcción del comando exacto
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
  Done: `src/application/local-runtime/database-introspection.ts` expone argv fijo y
  parseadores CSV/TSV/JSON, pliega columnas/PK/FK/índices en `SchemaSnapshot`, limita el
  proceso one-shot y conserva los mensajes nativos de error. El sidecar expone
  `database.connections.list`, `.connections.save`, `.connections.delete` y
  `database.schema.browse`. 4 tests nuevos específicos y build limpio; la suite completa
  queda en 659 pasados, con 2 fallos EPERM de listeners HTTP del sandbox y 1 test cancelado
  por ese mismo límite de red preexistente.

- [x] Phase 3 — Superficie `Database` en la shell. Nueva entrada de navegación en el
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
  Done: `desktop/src/index.html`, `desktop/src/main.js` y `desktop/src/styles.css` añaden
  `Database` como entrada propia, formulario seguro sin contraseña, selector de conexiones,
  árbol expandible y Refresh. El contrato UI y `node --check` pasan.

- [x] Phase 4 — Barrido de `#acceptance-criteria` y actualización de
  `SPEC-desktop-shell.md#information-architecture` con la nueva entrada de navegación,
  siguiendo el mismo criterio que aplicó `http-client` al pasar de `planned` a
  implementación activa.
  (satisfies: SPEC-database-schema-browser.md#acceptance-criteria,
  SPEC-database-schema-browser.md#decisions)
  Test strategy: barrido completo de SPEC-database-schema-browser.md#acceptance-criteria
  contra la suite real.
  Done: los criterios de listado, persistencia sin contraseña, cliente ausente, errores nativos,
  introspección de los tres motores y ausencia de SQL libre quedan cubiertos por los tests de
  dominio/introspección, el contrato de shell y el RPC. `SPEC-desktop-shell` y el Nexus ya
  reflejan la entrada `Database` activa.

## Execution State

**Build Status**: DONE
**Current Phase**: 4
**Current Step**: 4/4
**Step Attempts**: {2: 1, 3: 1, 4: 1}
**Last Block Rule**: none
**Can Resume**: NO — la vertical backend + shell está implementada y verificada; queda el smoke
manual de desktop con una base real como comprobación operativa opcional del entorno.

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
- Phase 1: `database-connection-store.ts` no incluye guard de contención de ruta propio
  (path traversal) — se deja para la fase RPC (Phase 2), mismo criterio que
  `readRequestFile`/`writeRequestFile` de `http-client`, que tampoco lo llevan en el
  adapter y lo aplican en la capa de sidecar (`resolveHttpCollectionPath`). Anotado
  explícitamente para que Phase 2 no lo dé por hecho.
- Phase 1: los tests de detección de toolchain ajustaron sus aserciones a forma de
  versión (`/\d+\.\d+/`) en vez de una versión fija, porque `runtimeEnvironment()`
  reutilizado sin modificar puede exponer un `psql` real de Homebrew en la máquina de
  desarrollo por delante del fixture falso del test; el caso "cliente ausente" usa
  `mysql` en vez de `psql` por el mismo motivo. Comportamiento de producción sin
  cambios, sólo el fixture de test.
