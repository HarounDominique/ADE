# Creative: superficie `Requests` — http-client (Phase 4)

## Step 1 — does this actually need a design pass?

Sí. `SPEC-http-client.md#decisions` ya resolvió las preguntas de producto — sexta entrada
de navegación llamada `Requests`, posicionada entre `Agents` y `Version control`,
ejecución en el sidecar, evidencia sin gate — pero ninguna Boundary del spec fija cómo se
reparte el espacio entre árbol de colecciones, editor de petición, panel de respuesta y
selector de entorno, ni qué componentes visuales existentes se reutilizan. Eso es
exactamente lo que este documento decide, contra el CSS real de `desktop/src/styles.css`
y no contra una descripción general del sistema de diseño.

## Step 2 — exploración

### Inventario de componentes reutilizables (verificado contra el CSS real)

| Componente existente | Selector | Qué resuelve hoy | Reutilizable para `Requests` |
|---|---|---|---|
| Árbol del Explorer | `.workspace-tree`, `.workspace-entry` | Filas planas con cambio de fondo en hover/selected, disclosure de carpetas, carga perezosa | Árbol de colecciones/peticiones — misma jerarquía visual, sin componente nuevo |
| Menú desplegable de contexto | `.picker`, `.picker-button`, `.picker-value`, `.picker-menu` | Selector `Run configuration` en la topbar; el mismo patrón describe `Model`/`Agent` en `Agents` | Selector de entorno (`environment`) en la cabecera de la vista |
| Tabs accesibles | `.version-control-tabs`, `.version-control-tab` (con `aria-controls`/`aria-labelledby`/roving tab stop ya resueltos) | `Changes`/`History` | Tabs de la petición (`Params`/`Headers`/`Body`/`Auth`/`Assertions`) y de la respuesta (`Body`/`Headers`/`Timing`) |
| Layout de dos columnas, contenido dominante | `.version-history-layout` (`grid-template-columns: minmax(250px, .72fr) minmax(0, 1.5fr)`) | `History`: lista de commits angosta + detalle dominante | Rail de colecciones angosto + editor de petición dominante |
| Fila de estado con glifo coloreado | `.git-file-status` (verde `+`, rojo `−`, ámbar `º`) | Estado de fichero en `Changes` | **No** se adopta para el método HTTP — ver alternativa rechazada abajo |
| Rail colapsable con control de restauración | Explorer compacto/expandido, rail de `Agents` | Recuperar ancho de lectura cuando el árbol no hace falta | Rail de colecciones colapsable con el mismo control |

No se introduce ningún componente visual nuevo: la vista completa se construye
recombinando estos cinco, igual que `run-configurations` reutilizó el dock de terminal en
vez de abrir un panel de consola propio.

### Decisión de layout

Tres franjas, no tres columnas:

```
┌ rail (colapsable) ─┬───────────── main ──────────────┐
│                     │  cabecera: método+URL, Send,    │
│  árbol de           │  selector de entorno (.picker)  │
│  colecciones         ├──────────────────────────────────┤
│  (.workspace-tree)  │  tabs de petición                │
│                     │  (Params/Headers/Body/Auth/      │
│                     │   Assertions)                    │
│                     ├──────────────────────────────────┤
│                     │  tabs de respuesta                │
│                     │  (Body/Headers/Timing)            │
└─────────────────────┴──────────────────────────────────┘
```

**Rail + main**, no rail + editor + respuesta como tres columnas: un split vertical
dentro de `main` (petición arriba, respuesta abajo) sigue el flujo de lectura
"construyo la petición → leo la respuesta" de arriba a abajo, que es también el flujo
temporal real (nada que leer en la respuesta hasta que la petición se envía). Tres
columnas lado a lado forzaría a leer la respuesta fuera del eje natural en el que se
construyó la petición, y en las anchuras de ventana que `desktop-shell` ya declara como
mínimas (900×640, lateral reservando 580px de workbench) tres columnas reales dejarían
cada una por debajo de una anchura legible para JSON con indentación.

División vertical dentro de `main`: petición y respuesta comparten el espacio con un
divisor redimensionable (mismo mecanismo que ya usa el dock de terminal para su altura:
grip visible + resize por pointer o teclado), no una proporción fija — una respuesta
grande de JSON necesita más alto que los campos de la petición, y lo inverso es cierto
mientras se editan headers largos.

### Selector de entorno

Vive en la cabecera de `main`, junto al campo de URL, no en la topbar: la topbar es
contexto transversal de Project/Task/branch/run, y el entorno pertenece a la petición
activa igual que `Model`/`Agent` pertenecen a la conversación activa de `Agents` y no a
la topbar. Usa `.picker`/`.picker-menu` sin modificar su CSS.

### Codificación visual del método HTTP — alternativa rechazada

**Rechazado:** un glifo coloreado por método (p. ej. verde `GET`, ámbar `POST`, rojo
`DELETE`), calcado del patrón `.git-file-status` de `Changes`. Motivo: la Signal
Scarcity Rule de `DESIGN.md` reserva cyan/verde/ámbar/rojo para comunicar interacción o
estado real — un método HTTP no es un estado, es una categoría fija de la petición, y
seis colores por seis verbos convertiría el árbol en decoración categórica, exactamente
lo que la regla prohíbe.

**Adoptado:** el método aparece como texto monoespaciado en mayúsculas
(`font: 11px var(--mono)`, color `--muted`, igual que el hash de commit en
`.git-commit-item-meta code` pero sin el tono cyan reservado a identificadores) delante
del nombre de la petición en cada fila del árbol. Sin color semántico, sin icono nuevo.

### Codificación visual del código de estado de la respuesta — sí es estado real

A diferencia del método, el código de estado de una respuesta **sí** es información de
estado real (la petición funcionó, falló del lado del operador o del servidor), así que
sí usa el color semántico ya existente: `--green` para 2xx, `--amber` para 3xx/4xx,
`--red` para 5xx o error de red — mismos tokens que ya distinguen `passed`/`pending`/
`failed` en el resto del shell, sin inventar una escala nueva.

### Icono de navegación

Ningún icono existente sirve sin reinterpretarse (el de `Version control` ya es una
rama Git, el de `Context` un círculo con cruz). Se añade un pictograma de dos flechas
opuestas —salida y retorno— coherente con el estilo lineal de 24×24, `stroke-width:
1.5`, `stroke-linecap`/`stroke-linejoin: round`, sin relleno, que ya usan los cinco
iconos existentes:

```html
<svg viewBox="0 0 24 24" aria-hidden="true">
  <path d="M4 8h12M12 4l4 4-4 4"/>
  <path d="M20 16H8M12 12l-4 4 4 4"/>
</svg>
```

### Estado vacío y colapso

Sin colecciones: el árbol muestra el mismo patrón que el Explorer sin resultados —
mensaje explicativo y acción para crear la primera colección, sin fixture. Rail
colapsado: mismo control de restauración accesible que ya usan `History`/`Changes` para
sus columnas auxiliares (icono, posición al final de la cabecera, animación), no un
control nuevo.

### Responsive

Bajo el ancho mínimo de 900px, el rail de colecciones se comporta como el lateral
general: se colapsa a un control de restauración en vez de encogerse ilegible, y la
franja de petición/respuesta pasa de split ajustable a apilado con scroll propio por
sección — mismo criterio que ya aplica el workbench general para paneles de contexto de
Project.

## Decision

- Layout: rail de colecciones (`.workspace-tree` reutilizado) + `main` con split
  vertical redimensionable (petición arriba, respuesta abajo), sin tercera columna.
- Selector de entorno: `.picker` en la cabecera de `main`, junto al campo de URL.
- Tabs de petición y de respuesta: `.version-control-tabs`/`.version-control-tab`
  reutilizados sin cambios de CSS, sólo nuevo `aria-label` por instancia.
- Método HTTP: texto monoespaciado sin color semántico. Código de estado de respuesta:
  sí usa `--green`/`--amber`/`--red` por ser estado real.
- Icono de navegación nuevo (dos flechas opuestas), único elemento visual sin precedente
  directo en el shell; todo lo demás es recomposición de componentes existentes.
- Rail colapsable y comportamiento responsive: mismo control y mismo criterio que
  `Explorer`/`History`/`Changes`, sin mecanismo nuevo.
