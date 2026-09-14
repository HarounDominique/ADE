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
  claves), botón `Refresh` explícito, estado `ToolchainGap` accionable.
  (satisfies: SPEC-database-schema-browser.md#product-contract)
  Test strategy: contract test de la superficie (selector, árbol, botón Refresh, estado de
  hueco de toolchain) sobre la shell.

- [ ] Phase 4 — Barrido de `#acceptance-criteria` y actualización de
  `SPEC-desktop-shell.md#information-architecture` con la nueva entrada de navegación,
  siguiendo el mismo criterio que aplicó `http-client` al pasar de `planned` a
  implementación activa.
