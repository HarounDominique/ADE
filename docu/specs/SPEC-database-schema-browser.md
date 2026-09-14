# Spec: Database Schema Browser

<!-- Nexus: SPEC-NEXUS.md | Module id: database-schema-browser -->

**Estado:** done — implementación backend y superficie Database verificadas. Ver `memory-bank/tasks/database-schema-browser.md` para el detalle de fases y límites de verificación.

## Objective

Permitir consultar el esquema de una base de datos del Project (tablas, columnas, tipos, claves) sin salir de Assay, igual que `run-configurations` evita abrir una terminal aparte para arrancar un servicio y `http-client` evita salir a un cliente HTTP externo para probar un endpoint.

El alcance de este primer corte es deliberadamente estrecho y fue recortado explícitamente durante la investigación previa a esta spec, tras descartar dos alternativas más amplias:

- Un gestor de base de datos completo (edición de datos, DDL, ERD, túneles SSH, administración) se descartó: introduciría en Assay su primer almacén de secretos propios, una superficie de ejecución de SQL arbitrario y semanas de esfuerzo, sin que quede claro que aporta más que el terminal PTY nativo que Assay ya tiene, con el que un operador ya puede lanzar `psql`/`mysql`/`sqlite3` directamente.
- Construir una capa de drivers propia (`pg`, `mysql2` en el sidecar) se descartó también: reimplementa un protocolo por motor que el ecosistema ya resuelve, y obliga a decidir dónde vive la contraseña de la conexión — un problema que Assay no tiene hoy porque delega toda credencial de proveedor de agente a ese proveedor (ver README, "sessions resume without copying credentials into ADE").

Este módulo no ejecuta SQL arbitrario ni edita datos. Se limita a lanzar, contra el motor detectado, un conjunto fijo de consultas de introspección de catálogo (equivalentes a lo que `\dt`/`\d` hacen en `psql`, `information_schema` en MySQL o `sqlite_master`/`PRAGMA` en SQLite), pedidas en un formato de salida estructurado (`--csv`, `--batch --raw` o `-json` según el cliente) para poder parsear el resultado sin ambigüedad, y muestra el árbol resultante.

## Product contract

- Un Project declara sus conexiones conocidas en `.ade/database-connections.json`, un array versionable con el repositorio, en el mismo espíritu que `.ade/run.json` y `.ade/services.json`. Cada entrada tiene motor (`postgres` | `mysql` | `sqlite`), host/puerto/nombre de base de datos y usuario para `postgres`/`mysql`, o ruta de fichero para `sqlite`. **Ninguna entrada admite un campo de contraseña**: la autenticación se delega íntegramente al mecanismo nativo del cliente instalado (`.pgpass`/`PGPASSWORD` del propio entorno del operador para `psql`, `~/.my.cnf`/`--defaults-extra-file` para `mysql`, ninguna para `sqlite3`). Si el cliente necesita un prompt de contraseña interactivo, Assay no lo intercepta ni lo reenvía: muestra el error nativo de autenticación tal cual, con instrucciones de cómo configurar autenticación no interactiva para ese motor.
- Assay detecta qué cliente (`psql`, `mysql`, `sqlite3`) está disponible en el `PATH` del sistema, reutilizando el mismo patrón de sondeo que `inspectProjectToolchains` ya aplica para `npm`/`cargo`/`mvn`/etc. (`src/application/local-runtime/toolchain-inspection.ts`): una llamada `--version` de solo lectura, nunca una instalación implícita. Una conexión cuyo motor no tiene cliente instalado muestra el hueco de toolchain de forma accionable, con el mismo lenguaje que ya usa `run-configurations` para un compilador ausente — ver [ADR-0038](../adr/0038-external-project-toolchains.md), cuyo principio ("orquestar el toolchain que el operador ya tiene, no empaquetarlo") este módulo reutiliza sin modificarlo.
- Examinar una conexión lanza el cliente nativo correspondiente como subproceso de una sola pasada (reutilizando la infraestructura de `LocalProcess` que ya ejecuta sondas de toolchain y configuraciones de ejecución), con los flags de salida estructurada del motor, y parsea el resultado a un árbol común: bases/esquemas → tablas/vistas → columnas (nombre, tipo, nullable, posición) → claves primarias → claves foráneas a nivel de tabla → índices. Ningún dato de fila de usuario se lee ni se muestra: sólo metadata de catálogo.
- El árbol se muestra en una entrada de navegación propia del lateral, junto a `Projects`, `Agents`, `Requests`, `Version control`, `Context` y `Editor` — ver Decisions. La superficie es de solo lectura: selector de conexión, árbol de esquema expandible, y un botón `Refresh` explícito que vuelve a lanzar la introspección; no hay carga automática periódica como la que `Version control` aplica a `git.pending`, porque una conexión externa no es un recurso local barato de sondear en bucle.

## Connection and schema contract

```ts
type DatabaseEngine = "postgres" | "mysql" | "sqlite";

type DatabaseConnection = {
  id: string;
  name: string;
  engine: DatabaseEngine;
  host?: string;       // postgres/mysql
  port?: number;       // postgres/mysql
  database?: string;   // postgres/mysql: nombre de la base; sqlite: no aplica
  user?: string;        // postgres/mysql
  filePath?: string;    // sqlite: ruta al fichero .db/.sqlite
};

type SchemaColumn = {
  name: string;
  dataType: string;
  nullable: boolean;
  isPrimaryKey: boolean;
  ordinalPosition: number;
};

type SchemaForeignKey = {
  column: string;
  referencesTable: string;
  referencesColumn: string;
};

type SchemaTable = {
  name: string;
  kind: "table" | "view";
  columns: readonly SchemaColumn[];
  foreignKeys: readonly SchemaForeignKey[];
  indexes: readonly { name: string; columns: readonly string[]; unique: boolean }[];
};

type SchemaSnapshot = {
  connectionId: string;
  fetchedAt: string;
  schemas: readonly { name: string; tables: readonly SchemaTable[] }[];
};

type ToolchainGap = {
  engine: DatabaseEngine;
  command: string;      // "psql" | "mysql" | "sqlite3"
  error: "not-found" | "auth-failed" | "connection-failed";
  nativeMessage: string; // salida real del cliente, sin reescribir
};
```

`SchemaSnapshot` no se persiste más allá de la sesión activa del panel: cada `Refresh` reemplaza el snapshot anterior en memoria del sidecar. No hay historial de introspecciones ni atribución a Task en este corte — ver Open Questions.

## Out of scope

Ejecución de SQL libre o parametrizado por el operador; edición de filas; DDL (crear/alterar/borrar tabla); un grid de resultados para consultas arbitrarias; túneles SSH; almacenamiento de contraseñas o de cualquier secreto propio de Assay; pooling o reutilización de sesión de conexión entre introspecciones; motores no relacionales; catálogos remotos/cloud a los que el cliente local no llegue ya por sí mismo; atribución de la introspección a evidencia de Task (ver Open Questions). Cualquiera de estos puntos puede convertirse en una iteración futura con su propia spec — ninguno se resuelve implícitamente aquí.

## Acceptance criteria

- Un Project con `.ade/database-connections.json` existente lista sus conexiones sin requerir conversión.
- Crear, editar y borrar una conexión desde Assay escribe JSON válido en `.ade/database-connections.json` y nunca incluye un campo de contraseña, ni siquiera vacío.
- Examinar una conexión cuyo cliente (`psql`/`mysql`/`sqlite3`) no está instalado muestra el hueco de toolchain de forma accionable, sin intentar ninguna alternativa empaquetada.
- Examinar una conexión que requiere contraseña interactiva y no tiene autenticación no interactiva configurada muestra el error nativo del cliente, sin quedarse colgada esperando un prompt que Assay no puede satisfacer.
- Examinar una conexión válida de cada motor soportado (`postgres`, `mysql`, `sqlite`) construye el árbol de esquema real: al menos nombre de tabla, columnas con tipo y nullable, y clave primaria.
- El panel no ofrece ningún campo de entrada de SQL libre en este corte.

## Verification

Tests de construcción del comando exacto (argv) por motor y por conexión, contra fixtures fijos — sin depender de un servidor real; tests de parseo contra salida capturada real de `psql --csv`, `mysql --batch --raw` y `sqlite3 -json` para casos con y sin tablas, con nombres de columna con caracteres especiales, y con clave foránea; test de detección de toolchain reutilizando el patrón de `inspectProjectToolchains`; test de que ningún camino de código serializa un campo de contraseña; y contract test de la superficie — selector de conexión, árbol de esquema, botón `Refresh`, estado `ToolchainGap` — sobre la shell. Ningún test depende de un servidor Postgres/MySQL/SQLite real corriendo en CI.

## Boundaries

**Always:** ejecutar la introspección con el cliente nativo que el operador ya tiene instalado, nunca un driver o motor vendorizado por Assay; mostrar el comando real lanzado y, ante error, el mensaje nativo del cliente sin reescribirlo; mantener `.ade/database-connections.json` libre de cualquier secreto.

**Ask first:** ninguno previsto para esta iteración — añadir una conexión es ya la acción explícita del operador, y examinar su esquema es de solo lectura, el mismo criterio que ya aplica `run-configurations` a una configuración aceptada.

**Never:** nunca almacenar una contraseña o secreto en `.ade/database-connections.json` ni en ningún otro almacén propio de Assay; nunca ejecutar una sentencia SQL distinta del conjunto fijo de introspección de catálogo de este módulo; nunca interceptar, cachear o reenviar un prompt de contraseña interactivo del cliente nativo.

## Decisions

- El módulo delega toda ejecución en el cliente nativo instalado (`psql`/`mysql`/`sqlite3`), reutilizando el principio de [ADR-0038](../adr/0038-external-project-toolchains.md) sin necesidad de un ADR propio: no se vendoriza ningún motor ni protocolo, a diferencia de `http-client` (que sí vendoriza el motor de Bruno y por eso tiene su propio [ADR-0059](../adr/0059-vendor-bruno-as-embedded-http-client.md)).
- El módulo añade una entrada de navegación propia. Su peso de superficie en este corte (selector de conexión + árbol de solo lectura) es menor que el de `Requests`, pero sigue siendo una categoría de riesgo distinta de `Editor`, `Version control` o `Requests` — consultar una base de datos externa — y no encaja en el resumen deliberadamente compacto de `Projects` ni en el árbol de `Context`. Este cambio de contrato se propaga a `SPEC-desktop-shell.md#information-architecture` cuando el módulo pase de `planned` a implementación activa, siguiendo el mismo criterio que ya aplicó `http-client`.
- No hay atribución a evidencia de Task en este corte, a diferencia de `http-client`: la introspección de esquema es de solo lectura y no produce un resultado pasa/falla citable. Si el uso real muestra que hace falta, queda como pregunta abierta, no se adelanta aquí.

## Open Questions

- ¿Debe una introspección de esquema quedar en el historial del Project o en la evidencia de una Task activa, con el mismo criterio que ya aplica `http-client`? Se descarta deliberadamente en este corte para mantener el módulo mínimo.
- ¿Cómo detecta Assay qué conexiones declaradas corresponden a un servicio que una configuración de `run-configurations` ya expone (mismo host/puerto de un servicio en ejecución), para evitar que el operador las declare dos veces? Sin resolver aquí, análoga a la pregunta abierta equivalente de `http-client` sobre sus variables de entorno y los puertos de `run-configurations`.
- Si en el futuro se justifica ejecutar SQL libre de solo lectura (`SELECT` acotado, sin escritura), ¿se hace como extensión de este módulo o como uno nuevo con su propia spec y su propio análisis de riesgo? Dejado explícitamente sin decidir.
