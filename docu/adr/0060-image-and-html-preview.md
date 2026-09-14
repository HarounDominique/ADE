# ADR-0060 — El Editor incorpora preview de imagen y HTML sandboxed; Mermaid resuelve diagramas como código

## Status

Accepted

## Date

2026-09-14

## Extends

[ADR-0014](0014-internal-file-viewer.md), que fijó los estados `loading`/`ready`/`binary`/`too-large`/`failed` del editor interno y dejó explícito que un fichero binario muestra un estado explicativo con `Open externally` como escape hatch, sin mandar bytes al frontend. [ADR-0023](0023-code-editor-and-formatting.md), que fijó el patrón "motor MIT pequeño + interfaz propia del shell" ya aplicado a CodeMirror/Monaco y que esta decisión repite para imagen y diagramas.

## Context

[SPEC-file-workspace.md](../specs/SPEC-file-workspace.md#out-of-scope) declara "preview de formatos binarios" fuera de alcance, y su [Native boundary](../specs/SPEC-file-workspace.md#native-boundary) lo confirma a nivel de implementación: `read_file` (`desktop/src-tauri/src/lib.rs:798-865`) clasifica por contenido, no por extensión — cualquier fichero con un byte nulo o UTF-8 inválido vuelve `kind: "binary"` con `content: None`. Ninguna superficie del frontend consume esos bytes hoy; es la razón por la que un PNG sólo ofrece el estado explicativo y `Open externally`.

SVG es la excepción interesante dentro de ese mismo mecanismo: un SVG válido es XML UTF-8 sin bytes nulos, así que ya clasifica como `kind: "text"` y su contenido ya llega al frontend — hoy se abre como texto plano en CodeMirror. Lo que falta para SVG no es una vía de lectura nueva, es una vista nueva sobre contenido que el backend ya entrega.

Markdown ya resuelve el patrón que el operador pide para HTML: un control en la cabecera del Editor alterna `Preview`/`Source` sobre el mismo documento (`SPEC-file-workspace.md` línea 18; `markdownPreviewVisible()` en `desktop/src/main.js:2730`). Ese preview corre con `markdown-it` en modo `{ html: false }` deliberadamente — `tests/markdown-preview.test.ts:33` documenta la razón en el propio nombre del test: *"a document in the tree is untrusted input, so its HTML is never executed"*. Cualquier preview de HTML tiene que sostener ese mismo invariante o es una regresión de seguridad disfrazada de feature: a diferencia de un `.md`, un `.html` es contenido ejecutable completo, no texto que hay que escapar.

El pedido concreto del operador es previsualizar PNG y otros formatos de imagen, y HTML con el mismo patrón Pretty/Source que Markdown, señalando el caso de HTML que embebe esquemas UML (típicamente exportados desde Mermaid o PlantUML).

## Decision

**Imagen raster (PNG, JPEG, GIF, WEBP, BMP, ICO) gana una vía de lectura binaria acotada.** Se extiende el backend con una ruta que sirve los bytes de estas extensiones bajo el mismo `MAX_FILE_PREVIEW_BYTES` que ADR-0014 fijó para texto — un fichero que hoy excede el límite ya vuelve `too-large` antes de llegar a clasificar contenido, y esa frontera se reutiliza sin cambiarla. El mecanismo de transporte (IPC en base64 o el protocolo `asset://` de Tauri) queda como decisión de implementación de la Task de build, no de este ADR. El frontend renderiza con `<img>` nativo; no hace falta motor de imagen.

**SVG se trata como un tercer caso, no como imagen raster.** Ya es `kind: "text"` hoy; se añade una vista Pretty que renderiza el contenido ya leído dentro de un `<img>` vía `URL.createObjectURL` sobre un `Blob` `image/svg+xml`. Un SVG cargado como `<img>` no ejecuta `<script>` embebido por diseño de la plataforma — la plataforma resuelve el mismo invariante de seguridad que Markdown sin necesitar sandboxing explícito.

**Pan/zoom de imagen usa `@panzoom/panzoom` (MIT) sobre el `<img>`.** Vanilla JS, sin dependencias, mismo perfil de footprint que `markdown-it`.

**HTML (`.html`/`.htm`) gana el mismo control Pretty/Source que Markdown, con la vista Pretty dentro de un `<iframe sandbox srcdoc="...">` sin `allow-scripts`.** El source view reutiliza `@codemirror/lang-html`, ya instalado desde ADR-0023 — cero dependencia nueva para esa mitad. Sin `allow-scripts`, cualquier `<script>` embebido en el fichero no se ejecuta nunca; CSS, markup y SVG inline sí se pintan, que es lo que cubre la mayoría de exports estáticos de PlantUML/Mermaid (HTML autocontenido con el diagrama ya resuelto a SVG). El toggle comparte cabecera, atajo y patrón de preferencia con el de Markdown, namespaced aparte en `localStorage`.

**Los diagramas expresados como código — fences ` ```mermaid ` dentro de un `.md`, o ficheros `.mmd` sueltos — se renderizan con Mermaid (MIT).** Se engancha como una regla nueva del mismo renderer `markdown-it` que ya extiende `markdownHeadingAnchors`/`markdownTaskLists` (`desktop/src/main.js:2718-2727`). Mermaid parsea su propio DSL y emite SVG client-side: no ejecuta el contenido arbitrario del fichero, sólo su propio lenguaje de diagrama, así que no reabre el vector que el resto de esta decisión cierra.

**No se adopta DOMPurify ni sanitización de HTML libre en esta fase.** Ver Alternatives.

| Paquete | Versión verificada | Licencia | Rol |
|---|---|---|---|
| `@panzoom/panzoom` | 4.6.2 | MIT | pan/zoom sobre `<img>` para preview de imagen raster y SVG |
| `mermaid` | 12.0.0 | MIT | motor de render de diagramas-como-código a SVG client-side |

## Alternatives considered

### `innerHTML` directo del HTML del fichero, igual que Markdown

Rechazado. Markdown puede permitirse `innerHTML` porque `markdown-it` con `html: false` escapa cualquier tag antes de llegar al DOM — el fichero fuente nunca es markup ejecutable. Un `.html` real es 100% markup: no existe un "modo seguro" de `innerHTML` equivalente sin sanitizar antes, que es la alternativa de abajo.

### DOMPurify + `innerHTML` sanitizado

Considerado. Habría dado una vista Pretty visualmente más integrada que un iframe (sin borde de frame, hereda el tema del shell). Rechazado para esta fase: DOMPurify se licencia `MPL-2.0 OR Apache-2.0`, fuera del ecosistema 100% MIT-compatible que `THIRD_PARTY_LICENSES.md` declara hoy para el resto de dependencias directas; además exige mantener y auditar una lista de sanitización en cada release, superficie que un `<iframe sandbox>` sin `allow-scripts` resuelve gratis, a nivel de plataforma, sin dependencia nueva. Queda disponible como opción futura si aparece necesidad real de HTML enriquecido con interacción visual propia del shell.

### `<iframe>` con `allow-scripts` (ejecutar el HTML tal cual, embebido en vez de externo)

Rechazado. Es exactamente el vector que el test de Markdown existe para cerrar, aplicado a un formato con más superficie ejecutable: un `.html` en el árbol es "untrusted input" igual que un `.md`, y esta decisión no le baja la guardia sólo porque ahora se ve embebido en vez de abierto por el sistema operativo.

### OpenSeadragon en vez de `@panzoom/panzoom`

Rechazado para esta fase. Resuelve deep zoom/tiling para imágenes muy grandes o microscopía; Assay no tiene ese caso de uso, y su footprint es mucho mayor que el pan/zoom simple que pide el pedido original.

### PlantUML embebido (render server-side, requiere runtime Java o servicio)

Rechazado. Repite el mismo criterio que ADR-0023 ya aplicó a formatters de Python/Rust/SQL/XML: no se adopta una dependencia de ejecución externa al shell sin una estrategia de ejecución local segura y trazable ya resuelta. Mermaid es JS puro, corre en el mismo proceso del webview sin proceso ni runtime externo.

## Consequences

- El "Out of scope" de [SPEC-file-workspace.md](../specs/SPEC-file-workspace.md#out-of-scope) queda desactualizado por esta decisión: "preview de formatos binarios" pasa de excluido por completo a alcance parcial (imagen raster + SVG); el resto de binarios (PDF, audio, vídeo, fuentes, comprimidos) sigue fuera. La actualización de la spec es un paso de spec-sync posterior a este ADR, no parte de él.
- `THIRD_PARTY_LICENSES.md` gana `@panzoom/panzoom` y `mermaid`, ambos MIT, sin romper el ecosistema de licencias 100% permisivo que la tabla ya declara para el resto de dependencias directas.
- El backend gana una ruta de lectura de bytes binarios acotada a un whitelist de MIME de imagen conocido y al mismo techo `MAX_FILE_PREVIEW_BYTES` que ADR-0014 fijó — no un endpoint binario genérico ni una vía para abrir cualquier binario del árbol.
- El toggle Pretty/Source de HTML sigue el mismo patrón de estado, atajo y cabecera que ya existe para Markdown; no introduce un tercer patrón de interacción en el Editor.
- El invariante "ningún fichero del árbol ejecuta su propio script en preview" se mantiene y se extiende a los tres formatos nuevos: HTML vía `iframe` sin `allow-scripts`, SVG vía `<img>`, imagen raster sin superficie ejecutable. Sólo Mermaid ejecuta código, y el código que ejecuta es su propio DSL de diagrama — nunca el contenido arbitrario de un fichero del árbol.
- Antes de cerrar la Task, hace falta un test análogo a `tests/markdown-preview.test.ts` para el preview de HTML, verificando que un `<script>` embebido no se ejecuta dentro del `iframe`.
- Fuera de alcance: otros formatos binarios (PDF, audio, vídeo, fuentes, comprimidos), edición de imagen, y HTML que depende de ejecutar su propio script para mostrarse (p. ej. un dashboard interactivo embebido) — quedan como `binary`/`Open externally` o como iframe inerte, respectivamente.
