---
slug: http-client
spec: docu/specs/SPEC-http-client.md
status: approved
---

## Implementation Roadmap

- [ ] Phase 1 — Dominio y E/S de colecciones. Vendorizar `@usebruno/lang` y
  `@usebruno/filestore` en el sidecar; tipos `HttpRequest`/`HttpEnvironment`/colección;
  lectura y escritura de `.ade/http/*.bru` round-trip sin pérdida. Sin superficie de
  usuario. (satisfies: SPEC-http-client.md#product-contract,
  SPEC-http-client.md#request-and-collection-contract)
  Test strategy: parseo/escritura contra ficheros `.bru` reales (incluida compatibilidad
  con colecciones creadas por la CLI/app de Bruno), sustitución de variables con
  entorno no definido.

- [ ] Phase 2 — Motor de ejecución en el sidecar. Vendorizar `@usebruno/requests`;
  método `http.request.execute` corre la petición desde el sidecar (nunca el webview),
  evalúa `assertions`, redacta variables marcadas como secretas en toda salida.
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

- [ ] Phase 4 — Superficie `Requests` en la shell. **Necesita `/seed:creative` antes de
  construirse**: sexta entrada de navegación nueva, mismo peso visual que `Editor`,
  debe encajar en "Sala de Evidencia" (DESIGN.md) sin decisión de layout tomada todavía
  — árbol de colecciones, editor de petición, panel de respuesta con pestañas, selector
  de entorno con el patrón de menú de `Model`/`Agent`. Al completarse, esta fase
  convierte la nota "extensión planeada" de `SPEC-desktop-shell.md#information-architecture`
  en contrato vigente. (satisfies: SPEC-http-client.md#product-contract,
  SPEC-http-client.md#decisions)
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
