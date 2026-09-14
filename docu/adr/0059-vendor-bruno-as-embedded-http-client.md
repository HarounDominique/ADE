# ADR-0059 — Assay vendoriza el motor de Bruno como cliente HTTP embebido

## Status

Proposed

## Date

2026-09-14

## Extends

[ADR-0057](0057-assay-carries-the-workflow-plugin.md) y [ADR-0058](0058-the-workflow-plugin-is-mit.md), que fijaron el patrón de vendorizar una herramienta open source dentro del propio repositorio de Assay en lugar de resolverla como dependencia externa instalada por el operador. [ADR-0023](0023-code-editor-and-formatting.md) fijó el otro patrón relevante: adoptar un motor MIT existente y construir la superficie sobre la interfaz propia del shell en lugar de embeber la aplicación de terceros completa.

## Context

Assay organiza el desarrollo dirigido por agentes alrededor de Project, Task, terminal, Git y documentación, pero no tiene superficie propia para ejecutar peticiones HTTP contra el backend que el propio Project expone. Hoy esa necesidad se resuelve saliendo de Assay hacia una herramienta externa, lo que rompe el principio de contexto único que el resto del shell ya sostiene para Git, terminal y agentes.

Construir un cliente HTTP desde cero —parser de colecciones, motor de variables/entornos, ejecución de peticiones, historial— duplicaría trabajo ya resuelto y probado por herramientas open source maduras. El objetivo de esta decisión es identificar una de ellas y fijar qué se vendoriza y qué se reconstruye.

Bruno (`usebruno/bruno`, MIT) es un cliente de peticiones HTTP cuyo modelo de datos es explícitamente git-native: cada petición y cada colección son ficheros de texto plano en el árbol del repositorio, no un blob de base de datos ni un espacio de un servidor propio. Ese modelo coincide con el "truth model" del Nexus de Assay, donde Git conserva código, documentación e historial, y con el contrato que `run-configurations` ya aplica para sus propias configuraciones versionables en `.ade/run.json`.

Bruno se distribuye como aplicación de escritorio propia sobre Electron y React, con su propio shell, su propia ventana y su propia identidad visual. Assay es Tauri más HTML/CSS/JS más un sidecar Node/TS, con un sistema de diseño propio ("Sala de Evidencia", DESIGN.md) y un principio explícito de chrome veraz: ningún panel debe vivir fuera de la vista donde el usuario puede actuar sobre él, y la shell no duplica navegación ni ventanas dentro de sí misma.

## Decision

**Assay vendoriza el motor de Bruno, no su aplicación.** Se toma la parte de `usebruno/bruno` que resuelve formato de colección, parseo de ficheros `.bru`, resolución de variables/entornos y ejecución de peticiones —la capa independiente de Electron/React que el propio proyecto ya separa de su UI de escritorio en su monorepo—, y se adapta como dependencia del sidecar TypeScript/Node de Assay. La superficie de usuario —request builder, árbol de colecciones, pestañas de respuesta, historial— se construye nativamente en HTML/CSS/JS de Assay, siguiendo el mismo sistema de diseño que `Editor`, `Agents` y `Version control`, del mismo modo que ADR-0023 adoptó CodeMirror como motor sin heredar el editor de otro producto.

**El formato de fichero `.bru` se adopta sin modificar su sintaxis.** Una colección de Assay es, en disco, una colección de Bruno: cualquier fichero `.bru` existente se abre sin conversión, y cualquier colección que Assay escriba se puede abrir con la CLI o la aplicación de escritorio de Bruno si el operador lo prefiere en algún momento. No se inventa un formato propio donde uno ya resuelto y legible existe.

**Se publica bajo MIT, igual que Bruno y que el resto de Assay**, siguiendo el razonamiento ya fijado en ADR-0042 y ADR-0058: mismo ecosistema de licencias, sin fricción de compatibilidad, sin `NOTICE` que mantener.

**Queda un spike previo a la superficie de usuario**, en la misma línea que los spikes fundacionales del Nexus (integración de runtime, resolución documental) y que el spike 004 de transporte Tauri–TypeScript. Este ADR fija la dirección arquitectónica; no fija con certeza el punto exacto del monorepo de Bruno del que se extrae el motor, porque esa verificación exige inspeccionar el código fuente real y no debe inventarse aquí. El spike debe responder, con evidencia y no con supuestos: qué paquete(s) del monorepo `usebruno/bruno` implementan parseo `.bru` y ejecución de peticiones de forma desacoplada de Electron/React; si ese código puede consumirse como dependencia de Node sin arrastrar la UI; y qué licencia declara exactamente cada paquete que se termine consumiendo (MIT en el repositorio raíz no garantiza que cada paquete interno la declare igual).

## Alternatives Considered

### Embeber la aplicación de escritorio de Bruno completa (proceso o vista separada)

Rechazado. Introduciría una segunda ventana, un segundo framework de UI (Electron+React contra Tauri+vanilla) y un segundo modelo de chrome dentro del mismo producto — exactamente lo que el principio de chrome veraz de DESIGN.md prohíbe: "cada panel debe vivir únicamente en la vista donde el usuario puede actuar sobre él" deja de cumplirse si esa vista es, en realidad, otra aplicación completa flotando dentro de Assay. También duplicaría persistencia (SQLite de Bruno frente al store de Assay) y complicaría el empaquetado multiplataforma que Assay ya audita módulo a módulo en `cross-platform-support`.

### Construir el cliente HTTP desde cero

Rechazado por lo mismo que ADR-0057 rechazó reimplementar SEED: reinventar parseo de colecciones, resolución de variables de entorno, manejo de auth (Bearer, Basic, OAuth2, API key) y ejecución HTTP es trabajo ya resuelto, probado contra casos reales durante años, y de bajo valor diferencial para Assay. El valor de Assay está en la integración con Task/evidencia, no en la ejecución HTTP en sí.

### Adoptar Hoppscotch en lugar de Bruno

Considerado y descartado para esta iteración. Hoppscotch (MIT) es igualmente viable en licencia, pero su modelo de referencia es self-host con backend NestJS y Postgres propios — infraestructura que Assay ya resuelve con su sidecar y SQLite, y que se solaparía en lugar de reutilizarse. El modelo de colección de Bruno como ficheros de texto encaja sin capas intermedias con el "truth model" del Nexus; el de Hoppscotch exigiría decidir primero qué hacer con un backend que Assay no necesita. Queda registrado como alternativa válida si el spike descubre que el motor de Bruno no es extraíble de forma limpia.

### No incorporar cliente HTTP y mantener la salida a una herramienta externa

Rechazado por ser el problema que motiva este ADR: cada salida a una herramienta externa es un cambio de contexto que el resto del shell ya evita para Git, terminal y agentes.

## Consequences

- Assay gana una superficie nativa para ejecutar peticiones HTTP sin salir del shell, con colecciones versionables en el propio repositorio del Project.
- Cualquier colección `.bru` externa es compatible sin conversión; el formato no es un silo propio de Assay.
- El spike previo puede descubrir que el motor de Bruno no está lo bastante desacoplado de su UI para vendorizarse limpio. Si eso ocurre, esta decisión debe revisarse antes de escribir `SPEC-http-client.md#product-contract` como contrato cerrado; el spec queda `planned` hasta entonces.
- `THIRT_PARTY_LICENSES.md` en `desktop/` debe ampliarse con las dependencias concretas que el spike identifique, con su licencia verificada paquete por paquete, no asumida desde la licencia del repositorio raíz.
- Igual que en ADR-0057, la copia vendorizada y el repositorio `usebruno/bruno` pueden divergir con el tiempo; no hay proceso de sincronización automática y no se le debe nada al proyecto origen más allá de conservar el aviso de copyright que su licencia MIT exige.
