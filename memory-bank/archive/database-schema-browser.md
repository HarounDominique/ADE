# Archive: database-schema-browser

**Status:** DONE, ready to merge.
**Spec:** [SPEC-database-schema-browser.md](../../docu/specs/SPEC-database-schema-browser.md)
**Reflection:** [reflection/database-schema-browser.md](../reflection/database-schema-browser.md)

## What was built

Assay incorpora una superficie `Database` de solo lectura para explorar esquemas usando
el cliente nativo disponible (`psql`, `mysql` o `sqlite3`). Las conexiones del Project se
guardan en `.ade/database-connections.json` sin contraseñas; el sidecar detecta el
toolchain, ejecuta consultas fijas de catálogo en un proceso one-shot acotado y devuelve
tablas, columnas, claves primarias, claves foráneas e índices normalizados.

La shell añade selector de conexión, alta/edición segura, borrado confirmado, árbol
expandible y `Refresh`, además de estados accionables para cliente ausente y errores
nativos de autenticación/conexión.

## Spec satisfaction

Los criterios de `SPEC-database-schema-browser.md` están cubiertos por los tests de
dominio, persistencia, toolchain, introspección, sidecar y contrato de UI. El build
TypeScript, los 15 tests específicos, los 155 contratos de desktop UI y un smoke SQLite
real pasan. La spec del Nexus y `SPEC-desktop-shell.md` están sincronizadas.

## Deviations accepted

- No se añaden drivers, secretos propios, consulta de filas ni SQL libre.
- La spec permanece en `docu/specs/`, según la organización vigente del Nexus.
- El smoke con una base real queda como comprobación operativa dependiente del entorno;
  la funcionalidad se valida con fixtures y el smoke SQLite confirmado.
- La verificación completa del repositorio conserva dos fallos y una cancelación por
  `listen EPERM` del sandbox en pruebas HTTP no relacionadas con este módulo.

## Workflow learnings

Las reglas extraídas están en
[reflection/database-schema-browser.md](../reflection/database-schema-browser.md) y en
`agent-rules/_learned/security-defaults.md` y
`agent-rules/_learned/testing-side-effecting-code.md`.
