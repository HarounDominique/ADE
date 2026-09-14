# ADR-0059 — Assay vendoriza el motor de Bruno como cliente HTTP embebido

## Status

Accepted

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

**La verificación previa a la superficie de usuario queda hecha, no pendiente.** El monorepo `usebruno/bruno` es un workspace npm con `packages/bruno-app` (React) y `packages/bruno-electron` como únicos paquetes acoplados a UI/Electron; el resto son paquetes Node puros, publicados de forma independiente en npm y consumidos por `@usebruno/cli` —la propia CLI oficial de Bruno para correr colecciones en CI, sin Electron ni React— como prueba de que son consumibles fuera de la aplicación de escritorio:

| Paquete | Versión verificada | Licencia | Rol |
|---|---|---|---|
| `@usebruno/lang` | 0.12.0 | MIT | conversión bidireccional `.bru` ↔ JSON |
| `@usebruno/requests` | 0.1.0 | MIT | ejecución HTTP (sobre `axios`), proxies, gRPC |
| `@usebruno/js` | 0.12.0 | MIT | sandbox de scripts pre/post-request y assertions (QuickJS o Node VM) |
| `@usebruno/common` | 0.1.0 | MIT | interpolación de variables y entornos |
| `@usebruno/filestore` | 0.1.0 | MIT | lectura/escritura de colecciones en disco |
| `@usebruno/cli` | 1.16.0 | MIT | prueba de consumo: usa los anteriores sin Electron/React |

`license.md` en la raíz del repositorio y en `packages/bruno-cli/license.md` declaran el mismo texto MIT y el mismo titular de copyright ("Anoop M D, Anusree P S and Contributors"), verificado directamente contra el repositorio el 2026-09-14. El sidecar de Assay puede consumir estos paquetes como dependencias de Node normales, sin vendorizar ni readaptar código fuente ajeno a mano.

## Alternatives Considered

### Embeber la aplicación de escritorio de Bruno completa (proceso o vista separada)

Rechazado. Introduciría una segunda ventana, un segundo framework de UI (Electron+React contra Tauri+vanilla) y un segundo modelo de chrome dentro del mismo producto — exactamente lo que el principio de chrome veraz de DESIGN.md prohíbe: "cada panel debe vivir únicamente en la vista donde el usuario puede actuar sobre él" deja de cumplirse si esa vista es, en realidad, otra aplicación completa flotando dentro de Assay. También duplicaría persistencia (SQLite de Bruno frente al store de Assay) y complicaría el empaquetado multiplataforma que Assay ya audita módulo a módulo en `cross-platform-support`.

### Construir el cliente HTTP desde cero

Rechazado por lo mismo que ADR-0057 rechazó reimplementar SEED: reinventar parseo de colecciones, resolución de variables de entorno, manejo de auth (Bearer, Basic, OAuth2, API key) y ejecución HTTP es trabajo ya resuelto, probado contra casos reales durante años, y de bajo valor diferencial para Assay. El valor de Assay está en la integración con Task/evidencia, no en la ejecución HTTP en sí.

### Adoptar Hoppscotch en lugar de Bruno

Considerado y descartado para esta iteración. Hoppscotch (MIT) es igualmente viable en licencia, pero su modelo de referencia es self-host con backend NestJS y Postgres propios — infraestructura que Assay ya resuelve con su sidecar y SQLite, y que se solaparía en lugar de reutilizarse. El modelo de colección de Bruno como ficheros de texto encaja sin capas intermedias con el "truth model" del Nexus; el de Hoppscotch exigiría decidir primero qué hacer con un backend que Assay no necesita. Queda registrado como alternativa de respaldo si en el desarrollo aparece un límite no previsto en los paquetes de Bruno ya verificados.

### No incorporar cliente HTTP y mantener la salida a una herramienta externa

Rechazado por ser el problema que motiva este ADR: cada salida a una herramienta externa es un cambio de contexto que el resto del shell ya evita para Git, terminal y agentes.

## Consequences

- Assay gana una superficie nativa para ejecutar peticiones HTTP sin salir del shell, con colecciones versionables en el propio repositorio del Project.
- Cualquier colección `.bru` externa es compatible sin conversión; el formato no es un silo propio de Assay.
- La extracción queda verificada, no es un riesgo abierto: `@usebruno/lang`, `@usebruno/requests`, `@usebruno/js`, `@usebruno/common` y `@usebruno/filestore` son paquetes Node MIT publicados de forma independiente, y `@usebruno/cli` prueba en producción que se consumen sin Electron ni React.
- `THIRD_PARTY_LICENSES.md` en `desktop/` debe ampliarse con estos cinco paquetes (y `@usebruno/cli` si el sidecar termina apoyándose en su capa de orquestación en vez de recomponerla) cuando la implementación los añada como dependencias reales del `package-lock.json`; esta tabla fija la versión verificada en la fecha de este ADR, no sustituye al lockfile como fuente de versiones concretas en el momento de cada release, según el mismo criterio que ya aplica ADR-0023.
- Igual que en ADR-0057, la copia vendorizada y el repositorio `usebruno/bruno` pueden divergir con el tiempo; no hay proceso de sincronización automática y no se le debe nada al proyecto origen más allá de conservar el aviso de copyright que su licencia MIT exige.
- **Corrección post-Phase 2:** `@usebruno/requests@0.20.0` (instalado durante Phase 2 del roadmap) resuelve transitivamente `axios@1.16.0` y `@faker-js/faker@9.9.0`, ambos con vulnerabilidades altas conocidas (`npm audit`: prototype pollution de axios que permite inyectar cabeceras Basic auth, bypass de `maxBodyLength`, ReDoS; ejecución de código arbitraria vía `helpers.fake` de faker). `package.json` fija `overrides` a `axios@^1.20.0` y `@faker-js/faker@^10.6.0` — versiones fuera del rango vulnerable, verificadas con `npm audit` en 0 hallazgos tras el override, y con la suite completa y el build limpios contra esas versiones. Esto no es una limitación de la decisión de vendorizar Bruno en sí: es un hueco real de las dependencias declaradas por `@usebruno/requests`, corregido a nivel de resolución sin tocar su código.
