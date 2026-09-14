# Reflection: database-schema-browser

## Step 1 — Implementation vs. spec

La implementación cubre el contrato de `docu/specs/SPEC-database-schema-browser.md`:

- conexiones versionables por Project sin contraseñas;
- detección de `psql`, `mysql` y `sqlite3` desde el `PATH`;
- introspección de solo lectura con consultas fijas y comandos nativos;
- normalización de tablas, columnas, claves primarias, claves foráneas e índices;
- errores diferenciados para cliente ausente, autenticación y conexión;
- RPC del sidecar para listar, guardar, borrar y consultar esquemas;
- superficie `Database` en la shell con selector, formulario seguro, árbol expandible y `Refresh` explícito.

Desviaciones aceptadas: la spec vive bajo `docu/specs/` y se sincronizó allí con el Nexus; no se implementa consulta de filas ni SQL libre; el smoke con una base real queda como comprobación operativa dependiente del entorno; y la contención de rutas se aplica en la frontera RPC mientras el adapter mantiene responsabilidades de persistencia simples.

No quedan criterios de aceptación funcionales pendientes. La ausencia de contraseña se verifica tanto en el tipo como en la reconstrucción runtime del JSON.

## Step 2 — Workflow evaluation

La complejidad `designed` fue adecuada: el trabajo era una única capacidad con una pequeña decisión de layout, no un Nexus nuevo. El roadmap de cuatro fases fue suficiente y no se detectó sharding leak ni fue necesario corregir la spec durante la implementación.

La decisión más importante fue mantener el cliente nativo de cada motor y no añadir drivers ni almacenamiento de secretos, conservando la multiplataformidad y reduciendo mantenimiento.

La verificación completa del repositorio mantiene dos fallos y una cancelación preexistentes por la restricción de red del sandbox (`listen EPERM` en pruebas HTTP); los tests específicos, el build y el contrato de UI pasan. No se interpreta ese límite ambiental como fallo del módulo.

## Step 3 — Extracted patterns

Se consolidan estas reglas reutilizables:

- No persistir credenciales de bases de datos en archivos de configuración; reconstruir explícitamente la allowlist de campos al leer y guardar.
- Para introspecciones nativas, usar argv fijo y consultas de catálogo predefinidas; no aceptar SQL libre desde la shell.
- Todo subproceso de introspección debe ser one-shot, con timeout y clasificación de errores conservando el mensaje nativo útil para el operador.

## Step 4 — Evidence

- Build TypeScript limpio.
- 15 tests específicos de introspección pasados.
- 155 contratos de desktop UI pasados.
- Smoke SQLite real confirmado para tablas, foreign key e índice.
- `git diff --check` limpio.

Next: `/seed:archive database-schema-browser`.
