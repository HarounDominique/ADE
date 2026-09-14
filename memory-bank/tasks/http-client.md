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

- [ ] Phase 2 — Motor de ejecución en el sidecar. Usa `axios` directo (no
  `@usebruno/requests`: instalado, auditado y descartado en esta fase — su superficie
  real es OAuth2/Digest/gRPC/WebSocket/proxy PAC, nada de lo cual cubre el contrato
  `HttpAuth`/`HttpBody` de este módulo; ver corrección de alcance en ADR-0059). Método
  `http.request.execute` corre la petición desde el sidecar (nunca el webview), evalúa
  `assertions`, redacta variables marcadas como secretas en toda salida.
  (satisfies: SPEC-http-client.md#product-contract, SPEC-http-client.md#boundaries)
  Test strategy: ejecución contra servidor HTTP efímero de test para cada método/body;
  evaluación de cada operador de `assertions`; test de redacción de secretos en la
  respuesta capturada. Ningún test depende de una URL pública.

- [ ] Phase 3 — Historial y evidencia de Task. Persistir `HttpExecution` en la DB de ADE
  por Project y, cuando exista, por Task activa; métodos `http.history.list` /
  lectura de evidencia con el mismo criterio de atribución que `run-configurations`.
  (satisfies: SPEC-http-client.md#product-contract "Cada ejecución queda en un
  historial...", SPEC-http-client.md#relación-con-gates)
  Test strategy: atribución a Task activa y su ausencia sin Task; evidencia visible
  desde el detalle de Task sin bloquear ninguna gate del pipeline.

- [ ] Phase 4 — Superficie `Requests` en la shell. Diseño resuelto en
  `memory-bank/creative/http-client-ui-ux.md`: rail de colecciones reutilizando
  `.workspace-tree`, split vertical petición/respuesta en `main` (sin tercera columna),
  selector de entorno con `.picker`, tabs con `.version-control-tabs` reutilizado,
  método HTTP sin color semántico (Signal Scarcity Rule), código de estado de
  respuesta sí coloreado (`--green`/`--amber`/`--red`), icono de nav nuevo (dos flechas
  opuestas). Al completarse, esta fase convierte la nota "extensión planeada" de
  `SPEC-desktop-shell.md#information-architecture` en contrato vigente. (satisfies:
  SPEC-http-client.md#product-contract, SPEC-http-client.md#decisions)
  Test strategy: contract test de la superficie (árbol, editor de petición, panel de
  respuesta, selector de entorno) sobre la shell, mismo patrón que `run-configurations`.

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

**Build Status**: RUNNING
**Current Phase**: 2
**Current Step**: 2/6
**Step Attempts**: {2: 1, 3: 0, 4: 0}
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
