# Spec: HTTP Client

<!-- Nexus: SPEC-NEXUS.md | Module id: http-client -->

**Estado:** planned — spec en revisión, nada implementado. La verificación técnica y de licencia de [ADR-0059](../adr/0059-vendor-bruno-as-embedded-http-client.md) ya está hecha; el contrato queda cerrado en lo arquitectónico y pendiente sólo de aprobación humana y de la implementación.

## Objective

Permitir construir, guardar y ejecutar peticiones HTTP contra los servicios de un Project sin salir de Assay, con colecciones versionables en el propio repositorio y ejecución atribuible a una Task, del mismo modo que `run-configurations` evita abrir una terminal para arrancar un servicio.

El escenario que gobierna el diseño es el Project fullstack que ya gobierna `run-configurations`: un backend arrancado desde Assay que el operador necesita golpear con peticiones repetidas mientras dirige un agente — probar un endpoint nuevo, reproducir un bug, comprobar una respuesta antes de aceptar un cambio. Los clientes HTTP de escritorio habituales son la referencia de *flujo* —colección, entorno, petición, respuesta, historial—, no de superficie: Assay adopta el motor de [Bruno](https://github.com/usebruno/bruno) (MIT, formato de colección en ficheros de texto plano) y construye la superficie sobre su propio sistema de diseño, según [ADR-0059](../adr/0059-vendor-bruno-as-embedded-http-client.md).

Este módulo no sustituye ni depende de `run-configurations`: una configuración arranca procesos, este módulo les habla por HTTP una vez arrancados. Ambos pueden citarse mutuamente —una petición puede declarar el puerto de una configuración como variable— pero ninguno exige al otro para funcionar.

## Product contract

- Un Project declara sus colecciones en `.ade/http/`, un árbol de ficheros `.bru` versionable con el repositorio, en el mismo formato que produce y lee la CLI o la aplicación de escritorio de Bruno. Sin colecciones, Assay ofrece crear la primera desde un diálogo propio; editar los ficheros `.bru` a mano fuera de Assay sigue siendo válido y Assay debe reflejar el cambio al reabrir el árbol.
- Una colección agrupa carpetas y peticiones en el árbol, igual que el Explorer agrupa ficheros: nombre, método, URL, headers, query params, body (raw JSON/texto, form-urlencoded o multipart) y auth (ninguna, Basic, Bearer, API key). La superficie de edición vive en el propio panel de la petición, no en un diálogo modal separado.
- Un entorno (`environment`) declara variables con nombre y valor, seleccionable desde la cabecera del módulo con el mismo patrón de menú que `Model` y `Agent` en `Agents`. Una variable marcada como secreta nunca aparece en texto plano fuera del campo donde se edita: ni en el historial de ejecución, ni en la evidencia que se adjunta a una Task, ni en los logs del sidecar. La sustitución `{{variable}}` dentro de URL, headers, params y body sigue la sintaxis que el propio formato `.bru` ya define.
- Ejecutar una petición la envía desde el sidecar de Assay, no desde el proceso de renderizado del webview, para no exponer la petición ni sus credenciales al contexto de la página. La respuesta muestra código de estado, tiempo, tamaño, headers y body con resaltado por content-type, en un panel de pestañas análogo al que `Version control` usa para separar lista y diff.
- Cada ejecución queda en un historial por colección: método, URL resuelta (con variables sustituidas pero secretos redactados), código de estado, duración y timestamp. El historial pertenece al Project, no a la Task: una petición se puede ejecutar fuera de cualquier Task, igual que un `run-configurations` en modo `service` puede arrancar sin Task seleccionada.
- Cuando hay una Task activa, cada ejecución queda además atribuida a ella y visible en su evidencia, con el mismo criterio de atribución que ya aplican `run-configurations` y los turnos de `Agents`.

## Request and collection contract

```ts
type HttpAuth =
  | { type: "none" }
  | { type: "basic"; username: string; password: string }
  | { type: "bearer"; token: string }
  | { type: "apikey"; key: string; value: string; placement: "header" | "query" };

type HttpBody =
  | { type: "none" }
  | { type: "json" | "text" | "xml"; content: string }
  | { type: "form-urlencoded"; fields: readonly { key: string; value: string; enabled: boolean }[] }
  | { type: "multipart"; fields: readonly { key: string; value: string; isFile: boolean; enabled: boolean }[] };

type HttpAssertion = {
  target: "status" | "duration" | "header" | "body";
  path?: string;                        // header name, o expresión para body
  operator: "eq" | "neq" | "lt" | "lte" | "gt" | "gte" | "contains";
  expected: string | number;
};

type HttpRequest = {
  id: string;
  name: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";
  url: string;                          // admite sustitución {{variable}}
  headers: readonly { key: string; value: string; enabled: boolean }[];
  params: readonly { key: string; value: string; enabled: boolean }[];
  auth: HttpAuth;
  body: HttpBody;
  assertions?: readonly HttpAssertion[]; // opcional: convierte la ejecución en evidencia de verificación
  timeoutMs?: number;
};

type HttpEnvironment = {
  id: string;
  name: string;
  variables: readonly { key: string; value: string; secret: boolean }[];
};

type HttpExecution = {
  id: string;
  requestId: string;
  projectId: string;
  taskId?: string;
  environmentId?: string;
  startedAt: string;
  durationMs: number;
  status: number | "error";
  responseHeaders?: Record<string, string>;
  responseSize?: number;
  assertionResults?: readonly { assertion: HttpAssertion; passed: boolean }[];
};
```

Una petición sin `assertions` es puramente observacional: su ejecución queda en el historial y, con Task activa, en su evidencia, pero no produce un resultado pasa/falla. Una petición con `assertions` declaradas produce `assertionResults` en cada ejecución; si todas pasan, la ejecución se considera satisfactoria, y si alguna falla, se marca visiblemente en el historial y en la evidencia de la Task sin bloquear ninguna gate por sí sola — ver "Relación con gates".

## Relación con gates

Una ejecución de petición HTTP **no** se integra en el pipeline `BUILD → TESTS → AGENT_REVIEW → DOCUMENTATION_REVIEW → HUMAN_APPROVAL → COMMIT` de `changes-review-governance` en esta iteración. A diferencia de una configuración `run-configurations` con `verifies: "build"` o `"tests"`, una petición HTTP no tiene un contrato de proceso que termina con código de salida: es una interacción puntual, potencialmente repetida decenas de veces mientras el operador explora un endpoint, y tratar cada una como candidata a gate convertiría el ruido de exploración en evidencia formal.

En su lugar, una ejecución con `assertions` queda disponible como evidencia adicional de la Task —visible junto a ChangeSet, sesiones de agente y evidencia de runtime— que el Reviewer y el operador pueden citar igual que citan cualquier otro dato observado, pero que ninguna gate exige. Si el uso real muestra que hace falta una gate `http-check` explícita y opt-in, análoga a `structural-gate`, queda registrado como pregunta abierta y no se adelanta aquí.

## Out of scope

Sincronización cloud o multiusuario de colecciones — Assay es local-first de un solo operador, igual que fija el Nexus; scripting pre/post-petición con un lenguaje de extensión propio; mocking de servidor; generación de documentación de API; GraphQL y WebSocket como protocolos de primera clase (quedan fuera del primer corte, que cubre HTTP/HTTPS request-response); importación automática desde OpenAPI/Swagger; cualquier feature de equipos, comentarios o permisos compartidos que Bruno ofrezca en su propia oferta de colaboración — Assay vendoriza el motor de ejecución y el formato de fichero, no su plataforma de equipos.

## Acceptance criteria

- Un Project con `.ade/http/` existente lista sus colecciones y peticiones en el módulo sin requerir conversión de los ficheros `.bru`.
- Crear, editar y borrar una petición o una colección desde Assay escribe ficheros `.bru` válidos, legibles por la CLI o la aplicación de escritorio de Bruno sin pérdida de datos.
- Ejecutar una petición muestra código de estado, tiempo, headers y body de la respuesta real, sin pasar por el proceso de renderizado del webview.
- Una variable marcada como secreta no aparece en texto plano en historial, evidencia ni logs del sidecar.
- Con Task activa, cada ejecución queda visible en la evidencia de esa Task; sin Task activa, queda en el historial del Project igualmente.
- Una petición con `assertions` marca cada ejecución como satisfactoria o no, sin bloquear ninguna gate del pipeline de `changes-review-governance`.
- Cambiar de entorno reevalúa las variables de la petición activa sin perder lo editado en los campos que no dependen de esas variables.

## Verification

Tests de parseo y escritura de ficheros `.bru` contra el formato real de Bruno, incluida compatibilidad con colecciones creadas por su propia CLI/aplicación; sustitución de variables de entorno, incluidas variables no definidas; ejecución de peticiones contra un servidor HTTP efímero de test para cada método y cada tipo de body; evaluación de `assertions` para cada operador; redacción de variables secretas en historial y evidencia; atribución de ejecución a Task cuando existe una activa y ausencia de atribución cuando no; y contract test de la superficie —árbol de colecciones, editor de petición, panel de respuesta, selector de entorno— sobre la shell. Ningún test depende de un servicio HTTP externo real ni de una URL pública.

## Boundaries

- **Always:** mostrar la petición real enviada (URL resuelta, headers, body) antes y después de ejecutar; redactar valores marcados como secretos en cualquier superficie de lectura; atribuir cada ejecución a Project y, cuando exista, a Task.
- **Ask first:** ejecutar una petición cuya URL resuelta apunte fuera de `localhost`/`127.0.0.1` y de los hosts que el propio Project ya declara en sus configuraciones de `run-configurations`, para no convertir el módulo en un vector silencioso hacia redes externas.
- **Never:** enviar una petición desde el proceso de renderizado del webview; escribir un valor marcado como secreto en el fichero `.bru` en texto plano sin que el operador lo haya escrito así explícitamente; presentar una ejecución sin `assertions` como si hubiera pasado o fallado una verificación.

## Decisions

- El módulo adopta el formato de fichero `.bru` de Bruno sin modificarlo, según [ADR-0059](../adr/0059-vendor-bruno-as-embedded-http-client.md): una colección de Assay es una colección de Bruno en disco.
- Las colecciones viven en `.ade/http/`, junto al resto de configuración declarativa versionable del Project (`run.json`, `services.json`), y no en una carpeta visible fuera de `.ade/`: mantiene un único sitio conocido para configuración de herramienta, consistente con `run-configurations`.
- Una ejecución con `assertions` no se conecta al pipeline de gates de `changes-review-governance` en esta iteración: es evidencia citable, no una gate nueva. Añadir una gate `http-check` opt-in queda como pregunta abierta.
- La ejecución de la petición corre en el sidecar, no en el webview, con el mismo criterio de aislamiento que ya aplica el resto de operaciones con credenciales o red en Assay.
- El módulo añade una sexta entrada de navegación, `Requests`, entre `Agents` y `Version control`: el peso de la superficie —árbol de colecciones, editor de petición, respuesta, historial— es comparable al de `Editor`, y forzarlo como panel dentro de una vista existente mezclaría edición de código o revisión de cambios con ejecución de red, dos acciones de riesgo distinto. Su posición sigue el mismo criterio que ya ordena el resto: entre donde se construye el cambio (`Agents`) y donde se revisa (`Version control`), porque probar un endpoint pertenece al ciclo de construcción, no al de revisión. Este cambio de contrato se propaga a `SPEC-desktop-shell.md#information-architecture` cuando el módulo pase de `planned` a implementación activa; hasta entonces queda anotado ahí como extensión planeada, no como comportamiento vigente.

## Implementation status

Nada implementado. [ADR-0059](../adr/0059-vendor-bruno-as-embedded-http-client.md) ya verificó que `@usebruno/lang`, `@usebruno/requests`, `@usebruno/js`, `@usebruno/common` y `@usebruno/filestore` son paquetes Node MIT independientes de Electron/React, consumibles como dependencias normales del sidecar. La siguiente fase es planificación de build (`/seed:plan` o equivalente), no un nuevo spike de viabilidad.

## Open Questions

- ¿Debe existir una gate `http-check` opt-in, análoga a `structural-gate`, para Projects que quieran bloquear `SHIP` en una assertion HTTP fallida? Queda deliberadamente fuera de esta iteración.
- ¿Cómo se relaciona una variable de entorno de este módulo con el puerto real que expone una configuración `run-configurations` en ejecución — sustitución automática `${port:<name>}` como ya hace `run.json`, o dos sistemas de variables independientes que el operador sincroniza a mano?
- ¿El historial de ejecuciones tiene un límite de retención, o crece sin cota igual que puede crecer sin cota un `.ade/http/` con muchas colecciones?
