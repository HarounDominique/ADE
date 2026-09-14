---
slug: http-client
spec: docu/specs/SPEC-http-client.md
status: approved
---

## Implementation Roadmap

- [x] Phase 1 — Dominio y E/S de colecciones. Vendorizar `@usebruno/lang` y
  `@usebruno/filestore` en el sidecar; tipos `HttpRequest`/`HttpEnvironment`/colección;
  lectura y escritura de `.ade/http/*.bru` round-trip sin pérdida. Sin superficie de
  usuario. (satisfies: SPEC-http-client.md#product-contract,
  SPEC-http-client.md#request-and-collection-contract)
  Test strategy: parseo/escritura contra ficheros `.bru` reales (incluida compatibilidad
  con colecciones creadas por la CLI/app de Bruno), sustitución de variables con
  entorno no definido.
  Done: `src/domain/http-request.ts`, `src/adapters/bruno-collection-store.ts`,
  `tests/http-request.test.ts`, `tests/bruno-collection-store.test.ts`. 573/573 tests,
  build limpio, review pasó en el segundo intento (ver Deviations).

- [x] Phase 2 — Motor de ejecución en el sidecar. Usa `axios` directo (no
  `@usebruno/requests`: instalado, auditado y descartado en esta fase — su superficie
  real es OAuth2/Digest/gRPC/WebSocket/proxy PAC, nada de lo cual cubre el contrato
  `HttpAuth`/`HttpBody` de este módulo; ver corrección de alcance en ADR-0059). Método
  `http.request.execute` corre la petición desde el sidecar (nunca el webview), evalúa
  `assertions`, redacta variables marcadas como secretas en toda salida.
  (satisfies: SPEC-http-client.md#product-contract, SPEC-http-client.md#boundaries)
  Test strategy: ejecución contra servidor HTTP efímero de test para cada método/body;
  evaluación de cada operador de `assertions`; test de redacción de secretos en la
  respuesta capturada. Ningún test depende de una URL pública.
  Done: `src/adapters/http-request-executor.ts`, `HttpExecution` en
  `src/domain/http-request.ts`, `tests/http-request-executor.test.ts` (24 tests contra
  servidor `node:http` real). 597/597 tests, build limpio, review pasó limpio a la
  primera.

- [x] Phase 3 — Historial y evidencia de Task. Persistir `HttpExecution` en la DB de ADE
  por Project y, cuando exista, por Task activa; métodos `http.history.list` /
  lectura de evidencia con el mismo criterio de atribución que `run-configurations`.
  (satisfies: SPEC-http-client.md#product-contract "Cada ejecución queda en un
  historial...", SPEC-http-client.md#relación-con-gates)
  Test strategy: atribución a Task activa y su ausencia sin Task; evidencia visible
  desde el detalle de Task sin bloquear ninguna gate del pipeline.
  Done: tabla `http_executions` + `saveHttpExecution`/`listHttpExecutions` en
  `sqlite-store.ts`; `http.history.list` (síncrono) y `http.request.execute`
  (asíncrono, rama propia del loop del sidecar) en `desktop-sidecar.ts`, con
  `RuntimeEvidence` sólo cuando hay Task activa. 601/601 tests, build limpio, review
  bloqueó una vez (faltaba `loadGatePolicy`/`pruneRuntimeEvidence`, ver Deviations) y
  pasó limpio en el segundo intento.

- [x] Phase 4 — Superficie `Requests` en la shell. **Corrección de alcance
  descubierta al planificar esta fase:** ningún phase anterior expone CRUD de
  colecciones por RPC — Phase 1 sólo lee/escribe un fichero `.bru` individual dado su
  path, sin listar un árbol, y nunca se wireó al sidecar (quedó explícitamente
  diferido a esta fase en Phase 1's Deviations). Sin eso la UI no tiene qué llamar
  para poblar el rail ni para crear/guardar una petición. Fase 4 queda dividida en dos
  sub-pasos TDD secuenciales dentro del mismo build:
  - **4a — Backend:** `listHttpCollectionTree(rootDir)` en
    `src/adapters/bruno-collection-store.ts` (recorre `.ade/http/` recursivamente);
    métodos de sidecar `http.collection.list`, `http.collection.request.save`,
    `http.collection.environment.save` (síncronos, vía `handleDesktopRequest`, mismo
    patrón que `terminal.history.save`).
  - **4b — Vista:** diseño resuelto en `memory-bank/creative/http-client-ui-ux.md`:
  rail de colecciones reutilizando
  `.workspace-tree`, split vertical petición/respuesta en `main` (sin tercera columna),
  selector de entorno con `.picker`, tabs con `.version-control-tabs` reutilizado,
  método HTTP sin color semántico (Signal Scarcity Rule), código de estado de
  respuesta sí coloreado (`--green`/`--amber`/`--red`), icono de nav nuevo (dos flechas
  opuestas). Al completarse, esta fase convierte la nota "extensión planeada" de
  `SPEC-desktop-shell.md#information-architecture` en contrato vigente. (satisfies:
  SPEC-http-client.md#product-contract, SPEC-http-client.md#decisions)
  Test strategy: contract test de la superficie (árbol, editor de petición, panel de
  respuesta, selector de entorno) sobre la shell, mismo patrón que `run-configurations`.
  Done: 4a (`listHttpCollectionTree`, 3 métodos RPC) + 4b (vista completa: nav, árbol,
  editor con 5 tabs, picker de entorno, Send/Save, respuesta coloreada, divisor
  redimensionable real). Ganó 2 métodos RPC no previstos
  (`http.collection.request.get`/`.environment.get`). 632/632 tests, build y bundle
  esbuild limpios. Review bloqueó una vez (secreto sin redactar en `responseBody` +
  divisor fijo en vez de redimensionable) y pasó limpio en el segundo intento.

- [ ] Phase 5 — Boundary de red y cierre de criterios de aceptación. Diálogo `Ask first`
  reutilizando el patrón de confirmación propio de la shell cuando la URL resuelta
  apunta fuera de `localhost`/`127.0.0.1` y de los hosts que las configuraciones de
  `run-configurations` del Project ya declaran. Verificación final de los criterios de
  aceptación completos del spec. (satisfies: SPEC-http-client.md#boundaries,
  SPEC-http-client.md#acceptance-criteria)
  Test strategy: petición hacia host externo exige confirmación explícita; petición
  hacia host declarado localmente no la exige; barrido completo de
  `SPEC-http-client.md#acceptance-criteria`.

## Execution State

**Build Status**: NOT_STARTED
**Current Phase**: —
**Current Step**: —
**Step Attempts**: {2: 0, 3: 0, 4: 0}
**Last Block Rule**: none
**Can Resume**: YES

## Deviations

- La spec de origen vive en `docu/specs/SPEC-http-client.md` bajo el Nexus de producto
  (`docu/specs/SPEC-NEXUS.md`), no en `memory-bank/specs/`: este proyecto mantiene dos
  corpus de spec separados (Nexus de producto en `docu/specs/`, tareas SEED granulares
  en `memory-bank/specs/`), y un módulo de Nexus de este tamaño pertenece al primero.
  El campo `spec:` de este task file registra la ruta real en vez de asumir la
  convención por defecto del template.
- El estado `planned` de la fila del Nexus de producto es equivalente al `ready`/
  `approved` que este comando exige como gate: `SPEC-NEXUS.md` define `planned` como
  "una spec aprobada para una iteración posterior, todavía no implementada" — la
  aprobación ya ocurrió al escribir la fila, no falta un paso adicional de aprobación
  del spec en sí.
- La verificación de viabilidad técnica (extracción del motor de Bruno, licencias) ya
  se hizo durante la fase de spec (ADR-0059), no queda como trabajo de un spike dentro
  de este roadmap.
- Complejidad leída como `designed`, no `nexus`: aunque el módulo es grande, es un único
  módulo con una decisión de diseño abierta (superficie de navegación, Phase 4) y no
  agrupa varias capacidades que exijan spec-nexus propio dentro de esta tarea.
- Phase 1 review (step 4, attempt 1) bloqueó: `package.json`/`package-lock.json` añadió
  `@usebruno/filestore`, `@usebruno/lang` y `nanoid` como dependencias reales sin
  actualizar `desktop/THIRD_PARTY_LICENSES.md`, que ADR-0059 exige explícitamente al
  ocurrir justo esa condición. Corregido: las tres filas ya están en la tabla.
- `nanoid@3.3.19` no es una dependencia elegida por esta tarea: el bundle CJS de
  `@usebruno/filestore@0.12.0` hace `require('nanoid')` en tiempo de ejecución pero su
  propio `package.json` no lo declara en `dependencies` (sólo `@types/nanoid`) — un
  hueco real del paquete vendorizado, no una decisión de diseño. Se fija en major 3
  porque nanoid 4+ dejó de soportar `require()` CJS, que es como el bundle lo consume.
- `@usebruno/lang` queda como dependencia directa de `package.json` sin ningún `import`
  propio en `src/`: sólo se alcanza transitivamente a través de `@usebruno/filestore`.
  Se mantiene directa (no sólo transitiva) porque ADR-0059 la nombra explícitamente como
  una de las cinco piezas del "motor vendorizado" a efectos de inventario de licencias;
  si una fase posterior necesita llamarla directamente, no hace falta añadirla de nuevo.
- Phase 1 reveló un gap real de contrato (`HttpRequest.params` no distingue query/path).
  No amerita `/seed:spec-sync` completo: nada más cita
  `SPEC-http-client.md#request-and-collection-contract` todavía, así que no hay
  propagación cruzada que hacer. Se registró directamente como Open Question nueva en
  `SPEC-http-client.md`, a decidir antes de que Phase 2 dependa del contrato de
  `params`.
- Phase 2 corrigió el alcance de vendorización previsto en el roadmap y en ADR-0059:
  `@usebruno/requests` se instaló, se auditó (`npm audit` marcó altas en `axios@1.16.0`
  y `@faker-js/faker@9.9.0`, ambas transitivas suyas) y se desinstaló en la misma
  sesión al confirmar contra su `.d.ts` real que su superficie —OAuth2/Digest/EdgeGrid,
  gRPC, WebSocket, proxy PAC— no cubre nada del contrato `HttpAuth`/`HttpBody` de este
  módulo (`none`/`basic`/`bearer`/`apikey`; sin gRPC/WebSocket, fuera de alcance de la
  spec). La ejecución usa `axios@^1.20.0` como dependencia directa, fuera del rango
  vulnerable, sin necesidad de `overrides`. `@usebruno/js` tampoco se adopta: no hay
  scripting pre/post-request en el contrato, `HttpAssertion` es comparación estática.
  `npm audit`: 0 hallazgos. Commit intermedio `fix: pin axios/faker above
  known-vulnerable versions` quedó luego revertido en efecto por la desinstalación de
  `@usebruno/requests`, documentado en vez de reescrito con `git commit --amend`.
- Phase 2 deja sin implementar el envío real de campos `isFile: true` en bodies
  multipart: `HttpBody`'s multipart field sólo declara `value: string`, sin contrato de
  bytes de fichero, así que un campo marcado como fichero se omite del cuerpo enviado
  en vez de mandarse mal. Documentado con comentario en
  `src/adapters/http-request-executor.ts` y cubierto por test explícito
  (`POST multipart body sends only enabled non-file fields`); subida real de ficheros
  queda para cuando `HttpBody` gane un campo con contrato de bytes, no asumido aquí.
- Phase 3 (step 2, intento 1) crasheó a mitad por un error de infraestructura del
  dispatch (HTTP 400 "assistant message prefill" contra la API), no por el trabajo en
  sí: dejó `http_executions` (tabla, `saveHttpExecution`/`listHttpExecutions`) y
  `http.history.list` completos y correctos, pero `http.request.execute` sin
  implementar del todo. Se completó a mano en la misma sesión: `handleDesktopRequest`
  es síncrona (usada directa en tests), así que `http.request.execute` —que necesita
  `await executeHttpRequest`— no podía vivir ahí; se añadió como rama propia del bucle
  `for await` async del sidecar (mismo patrón que `run.start`/`task.run`), con
  `runHttpRequestExecution` escribiendo su propia respuesta a `stdout`. El test que el
  agente ya había escrito para este caso (spawn del sidecar real, correcto para algo
  async) no tenía `try/finally`: al fallar contra el método todavía inexistente dejó el
  proceso hijo y el servidor HTTP efímero sin cerrar, colgando `npm test` más allá del
  timeout. Corregido con el mismo patrón `try/finally` que ya usa el resto de tests de
  spawn en `tests/desktop-sidecar.test.ts`. Dos fixes de tipado adicionales por
  `exactOptionalPropertyTypes: true` (spread condicional de `environment`/`taskId` en
  vez de asignar `undefined`; cast a `NonNullable<...>` en `listHttpExecutions`).
  600/600 tests, build limpio, tras la corrección.
- Phase 3 review (attempt 1) bloqueó: `runHttpRequestExecution` escribía
  `RuntimeEvidence` sin `loadGatePolicy`/política ni `pruneRuntimeEvidence` posterior —
  los 8 demás sitios del repo que escriben evidencia siguen ese patrón sin excepción, y
  el propio spec describe la ejecución HTTP como algo que se repite "decenas de veces"
  explorando un endpoint, justo el crecimiento que `pruneRuntimeEvidence` existe para
  acotar. Corregido con el mismo patrón (`loadGatePolicy(store.getTask(taskId)
  ?.repositoryPath ?? undefined)` + `pruneRuntimeEvidence` tras guardar), más un test
  nuevo que dispara 3 ejecuciones con `maxItems: 2` vía `.ade/policy.json` real y
  confirma que sobreviven exactamente las 2 más recientes — no sólo que el conteo baja,
  sino que se poda la correcta. Pasó limpio en el segundo intento de review.
- Phase 4a (step 2, intento 1) crasheó por rate limit de sesión ("session limit, resets
  11:30am Madrid"). Se retomó directo en la sesión principal tras confirmar que ya
  había pasado la hora de reset; sin cambios a medio hacer que limpiar esta vez (el
  agente crasheó antes de escribir nada). `listHttpCollectionTree` distingue
  request/environment por convención de carpeta (`environments/`), ya que
  `@usebruno/filestore` no da esa señal por sí solo — documentado inline en el tipo
  `HttpCollectionNode`.
- Phase 4b descubrió y cerró un gap real no anticipado en el roadmap: `http.collection.list`
  sólo expone `id`/`name`/`method` por nodo (no el contenido completo), así que cargar
  una petición existente en el editor no tenía de dónde leer. Se añadieron
  `http.collection.request.get`/`.environment.get`, mismo patrón que `.save`.
- Phase 4 review (attempt 1) bloqueó dos cosas:
  1. `responseBody` (campo nuevo de Phase 4b, aditivo sobre `HttpExecution`, nunca
     persistido) no pasaba por ninguna redacción — Phase 2 sólo redacta
     `responseHeaders`. Una API que hace eco del body de la petición (patrón real y
     común) habría mostrado el secreto en texto plano en el panel de respuesta,
     violando el `Always` del spec ("redactar... en cualquier superficie de lectura").
     Corregido con `redactBody`, mismo escaneo-y-reemplazo que `redactHeaders` pero
     recursivo sobre objetos/arrays; test nuevo que manda un secreto en el body JSON,
     confirma por captura real del servidor que se envió de verdad, y confirma que
     nunca vuelve en texto plano.
  2. El divisor petición/respuesta redimensionable que pedía el creative doc (con
     razonamiento explícito: JSON grande necesita más alto, headers largos también, en
     direcciones opuestas) se había implementado como grid fijo 50/50 — exactamente el
     fallback de viewport angosto del propio doc, promovido a única conducta en vez de
     serlo sólo por debajo de 900px. Corregido implementando el grip real, espejo
     función-por-función del resizer del dock de terminal (`terminalHeightBounds`/
     `setTerminalHeight`) — pointer drag, teclado, persistencia por Project. El
     fallback angosto ahora sí sólo aplica bajo 900px.
  Ambos pasaron limpio en el segundo intento de review. 632/632 tests, build y bundle
  esbuild limpios.
- Al completar Phase 4, se cumplió la propagación prometida en Phase 1: la nota
  "extensión planeada, no vigente" de `SPEC-desktop-shell.md#information-architecture`
  se reemplazó por el contrato real de seis entradas (`Requests` entre `Agents` y
  `Version control`).
