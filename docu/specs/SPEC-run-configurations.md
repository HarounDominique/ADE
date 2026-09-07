# Spec: Run Configurations

<!-- Nexus: SPEC-NEXUS.md | Module id: run-configurations -->

**Estado:** in-progress — dominio, catálogo, supervisor, sondeo de puertos, métodos del sidecar y superficie de la shell implementados y verificados; queda la persistencia de la evidencia de cada ejecución junto a la Task.

## Objective

Permitir arrancar, depurar y detener las aplicaciones del Project desde la propia shell, con configuraciones declaradas, puertos visibles y evidencia atribuible, sin memorizar comandos ni abrir una terminal para cada servicio.

El escenario que gobierna el diseño es el Project fullstack: un backend y un cliente que se arrancan juntos, cada uno en su puerto, y que el usuario levanta decenas de veces al día mientras dirige agentes. IntelliJ y WebStorm son la referencia de *flujo* —una configuración seleccionable, un arranque normal y un arranque con depuración—, no de superficie: ADE toma el control, no el modelo de IDE completo.

Este módulo es la capa de usuario sobre [local-runtime](SPEC-local-runtime.md#runtime-contract). No define un supervisor propio.

## Product contract

- Un Project declara sus configuraciones en `.ade/run.json`, versionable con el repositorio. Sin fichero no hay configuraciones inventadas: la shell ofrece crear la primera.
- La topbar expone un control de ejecución: selector de configuración, `Run`, `Debug`, `Stop` y el estado de lo que está corriendo, con su puerto o URL.
- `Run` y `Debug` son dos modos de la misma configuración, no dos configuraciones. `Debug` añade los argumentos y el puerto de depuración que la configuración declara; si no los declara, `Debug` aparece deshabilitado y explica por qué.
- Cada ejecución abre su propia pestaña en el dock de terminal, con la salida del proceso, el comando ejecutado y su cwd. La salida no se resume ni se oculta.
- Los puertos declarados se comprueban antes de arrancar. Un puerto ocupado no produce un arranque a medias: la ejecución no empieza, y el mensaje dice qué puerto y —cuando la plataforma lo permita— qué proceso lo retiene.
- Una configuración `compound` compone otras: arranca en el orden declarado, espera el healthcheck de cada miembro antes del siguiente y detiene en orden inverso. Un miembro que falla detiene los ya arrancados.
- Una ejecución pertenece al Project y, cuando existe, a la Task activa. Su evidencia —comando, cwd, actor, puertos, estados, código de salida y salida truncada con marca de truncamiento— queda disponible para el workflow y el Reviewer con el mismo contrato que un servicio.
- Detener es siempre posible desde la misma superficie que arrancó, y una ejecución detenida por el usuario no se registra como fallo.

## Configuration contract

```ts
type RunMode = "run" | "debug";

type RunPort = {
  name?: string;
  port: number;
  protocol: "http" | "tcp";
  path?: string;                       // sólo http, para componer la URL de apertura
  bind: "loopback" | "all";            // "all" exige confirmación explícita por ejecución
};

type RunDebug = {
  args: readonly string[];             // sustituye a args en modo debug: el flag suele preceder al entry point
  port: number;
  protocol: "inspector" | "jdwp" | "dap" | "other";
  attachHint?: string;                 // cómo enganchar un depurador externo
};

type RunConfiguration = {
  id: string;
  label: string;
  kind: "command" | "service" | "compound";
  command?: string;                    // kind "command"
  args?: readonly string[];
  cwd?: string;                        // resuelto dentro del Project salvo autorización explícita
  env?: Record<string, string>;        // sin valores secretos: los secretos se referencian por nombre
  service?: string;                    // kind "service": id de .ade/services.json
  members?: readonly string[];         // kind "compound": ids de otras configuraciones
  ports?: readonly RunPort[];
  debug?: RunDebug;
  healthcheck?: { type: "http" | "command"; target: string; timeoutMs: number };
  autoOpen?: boolean;                  // abrir la URL http al alcanzar RUNNING
  shutdownTimeoutMs?: number;
};

type RunSession = {
  id: string;
  configurationId: string;
  mode: RunMode;
  projectId: string;
  taskId?: string;
  state: ServiceState;                 // el de local-runtime, sin estados nuevos
  pid?: number;
  ports: readonly RunPort[];
  startedAt: string;
  endedAt?: string;
  exitCode?: number;
  stoppedByUser?: boolean;
};
```

Una configuración `kind: "service"` no recopia el comando: hereda `command`, `args`, `cwd`, `env`, `ports` y `healthcheck` del `ServiceDefinition` referenciado y sólo puede añadir `env`, `debug` y `autoOpen`. Duplicar la declaración es un error de validación, no una comodidad: dos copias del mismo comando divergen.

`ports`, `env` y `cwd` admiten sustitución de variables `${projectRoot}` y `${port:<name>}` para que un compound pueda referirse al puerto real de otro miembro sin fijarlo dos veces.

## Debug boundary

ADE no implementa un depurador en esta iteración. `Debug` arranca el proceso con la variante de depuración declarada, expone el puerto y el `attachHint`, y deja el attach al depurador externo del usuario —IDE, devtools del navegador o cliente DAP—. La shell no muestra breakpoints, pila ni variables, y no debe insinuar que lo hace: el botón se llama `Debug` porque arranca en modo depurable, y su tooltip lo dice con esas palabras.

Un depurador dentro de ADE exige un cliente DAP y una superficie de breakpoints sobre el editor interno. Queda fuera de alcance y registrado como pregunta abierta, no como deuda silenciosa.

## Interaction states

- **Sin configuraciones:** el control ofrece crear la primera y explica dónde vivirá el fichero.
- **Idle:** configuración seleccionada, `Run` y `Debug` disponibles según lo que declare.
- **Starting:** el control muestra la configuración arrancando y su comando; `Stop` ya está disponible.
- **Running:** estado, tiempo transcurrido y puerto o URL abribles; `Run` se sustituye por `Stop` sin cambiar de sitio.
- **Port conflict:** no hay arranque parcial; el mensaje nombra el puerto, el ocupante si se puede resolver, y ofrece detener la ejecución de ADE que lo retiene cuando es una propia.
- **Failed:** código de salida y últimas líneas de salida, con acceso directo a la pestaña de consola completa.

Un compound expone el estado del conjunto y el de cada miembro; ninguno se pierde detrás del agregado.

## Ports contract

Los puertos son parte visible de la configuración, no un detalle del comando. El bind por defecto es loopback. `bind: "all"` expone el servicio a la red local y exige confirmación explícita por ejecución, con el mismo diálogo propio de la shell que usa el resto de acciones de riesgo.

Una URL http se abre en el navegador del sistema como escape hatch. ADE no incorpora un navegador ni hace de proxy: lo que el usuario ve es el servicio real en su puerto real.

## Out of scope

Depurador integrado, breakpoints y profiling; contenedores y Docker Compose; despliegue remoto o cloud; hot reload propio; gestión de versiones de runtime (`nvm`, `sdkman`, `pyenv`); orquestación de dependencias entre Projects distintos.

## Acceptance criteria

- Un Project con `.ade/run.json` válido lista sus configuraciones en la topbar y arranca la seleccionada con un solo control.
- `Debug` arranca con los argumentos declarados y muestra el puerto de depuración; sin `debug` declarado el control queda deshabilitado y explicado.
- Un puerto ocupado impide el arranque y produce un mensaje que nombra el puerto.
- Un compound arranca en orden, espera healthchecks y detiene en orden inverso; el fallo de un miembro detiene los anteriores.
- Detener desde la shell termina el proceso y sus hijos sin dejar huérfanos, respetando `shutdownTimeoutMs` antes de escalar la señal.
- La salida de cada ejecución es accesible completa y con marca explícita cuando se trunca.
- Los valores de entorno marcados como secretos no aparecen en consola, evidencia ni logs.
- Una configuración inválida —`service` inexistente, `members` circulares, puerto fuera de rango— falla en validación con el campo señalado, y nunca a mitad de arranque.

## Verification

Tests de parseo y validación de `.ade/run.json`, incluidas referencias rotas y ciclos en `members`; arranque y parada con procesos efímeros; puerto ocupado detectado antes de lanzar; orden de arranque y parada inversa en compound; timeout de parada y escalado de señal; ausencia de procesos huérfanos; redacción de secretos en salida y evidencia; sustitución de `${port:...}` entre miembros; y contract test de la superficie —selector, `Run`, `Debug`, `Stop` y estado— sobre la shell. Ningún test depende de un servidor externo ni de un puerto fijo del sistema anfitrión.

## Boundaries

- **Always:** mostrar comando, cwd, puertos y estado antes y durante la ejecución; atribuir cada ejecución a Project y Task; permitir detener desde donde se arrancó.
- **Ask first:** exponer un puerto fuera de loopback, ejecutar una configuración cuyo `cwd` cae fuera del Project, o detener una ejecución que ADE no arrancó.
- **Never:** ocultar salida; dejar procesos huérfanos; tratar un proceso vivo como servicio sano sin healthcheck; escribir valores secretos en `.ade/run.json`; presentar `Debug` como un depurador integrado.

## Decisions

- El módulo reutiliza el supervisor, los estados y el contrato de evidencia de `local-runtime`. No añade estados nuevos al ciclo `DECLARED → STARTING → RUNNING → STOPPING → STOPPED / FAILED`.
- Las configuraciones viven en `.ade/run.json` y no dentro de `.ade/services.json`: un servicio es una declaración de infraestructura del Project, una configuración es cómo el usuario la arranca. La referencia `kind: "service"` conecta ambas sin duplicarlas.
- La consola de cada ejecución reutiliza el dock de terminal en lugar de abrir un panel nuevo: la salida de procesos ya tiene un sitio en la shell y multiplicarlo fragmentaría la lectura.
- El control vive en la topbar, junto al contexto de Project, Task y branch, porque arrancar la aplicación es contexto transversal y no pertenece a una sola vista.

## Implementation status

Implementado y verificado: `RunConfiguration` y `RunSession` en el dominio; carga y validación de `.ade/run.json` con herencia desde `.ade/services.json`, ciclos de `members` y campos señalados uno a uno; `RunManager` con sondeo previo de todos los puertos del árbol, arranque ordenado de compuestas, parada en orden inverso, healthcheck con deadline y limpieza de los miembros ya arrancados cuando uno falla; `LocalPortProbe` por bind, sin depender de binarios externos; salida en vivo a través de `ProcessDefinition.onOutput`; y los métodos `run.list`, `run.start` y `run.stop` del sidecar, con `RUN_PORT_CONFLICT` y `RUN_CONFIG_INVALID` como errores propios y `run.output` / `run.session` como eventos.

La superficie también está implementada: el control vive en la topbar con el mismo menú que Project, Task y branch; `Debug` se deshabilita y se explica cuando la configuración no lo declara; el estado muestra `STARTING`/`RUNNING`/`FAILED` con su puerto y abre la URL local del servicio a través de un comando nativo que sólo acepta direcciones de loopback; `bind: "all"` se confirma por ejecución en el diálogo propio de la shell; y cada ejecución escribe en su propia pestaña del dock de terminal, que no acepta entrada y cuyo cierre oculta la consola sin detener el proceso.

Pendiente: la persistencia de la evidencia de cada ejecución junto a la Task, y la identificación del proceso que ocupa un puerto.

## Open Questions

- ¿Qué mecanismo multiplataforma identifica al proceso que ocupa un puerto sin depender de binarios externos (`lsof`, `netstat`)?
- ¿Debe ADE incorporar un cliente DAP y breakpoints sobre el editor interno, o el attach externo es el límite estable del producto?
- ¿Cómo se versiona el esquema de `.ade/run.json` y qué ocurre al abrir un Project con una versión posterior a la de la aplicación?
- ¿Una ejecución en curso debe bloquear transiciones de Task o gates, o basta con exponerla como evidencia?
- ¿Los atajos de teclado para `Run`, `Debug` y `Stop` deben ser configurables desde el principio, dado que colisionan con reflejos aprendidos en otros IDEs?
