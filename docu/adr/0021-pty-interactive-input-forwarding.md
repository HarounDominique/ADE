# ADR-0021: Terminal interactiva basada en xterm.js y portable-pty

## Status

Accepted

## Date

2026-09-04

## Context

La terminal de ADE ya disponía de un PTY real con `portable-pty`, pero la UI interponía un campo HTML para escribir comandos y un emulador ANSI propio para pintar la salida. Esa combinación obligaba a detectar casos especiales —pantalla alternativa, comandos como `claude` y teclas concretas— y podía consumir `↑`, `↓`, `Space`, `Enter` o `Esc` antes de que llegaran a una TUI. El síntoma era que Claude Code mostraba sus opciones, pero el usuario no podía mover la selección.

## Decision

Mantener `portable-pty` en Rust y sustituir la capa de presentación e interacción por `xterm.js` con `@xterm/addon-fit`.

- Cada tab crea una instancia `Terminal` y un host DOM propio.
- `Terminal.onData` reenvía cada secuencia de teclado sin transformación a `terminal_input` con el `sessionId` del tab.
- `Terminal.onResize` envía filas y columnas a `terminal_resize`, que ajusta el mismo PTY mediante `MasterPty::resize`.
- El shell real conserva eco, prompt, historial, completado, pantalla alternativa y demás semántica de terminal.
- ADE no detecta comandos interactivos, no mantiene un modo especial para Claude y no vuelve a interpretar teclas mediante heurísticas.

La entrada se entrega al proceso exactamente como la produce una terminal: las flechas, espacio, Enter, Escape, Tab, borrado, caracteres imprimibles y controles `Ctrl` llegan al PTY sin que la shell desktop los capture.

## Alternatives considered

### Mantener el campo HTML y ampliar las heurísticas

Rechazado: cada TUI puede usar secuencias, modos y combinaciones distintas; añadir excepciones mantiene la causa del bug y multiplica los casos frágiles.

### Implementar otro emulador ANSI propio

Rechazado: el renderizado de cursor, borrado, colores, pantalla alternativa y resize ya es un problema resuelto por una librería especializada; duplicarlo aumenta el mantenimiento sin aportar valor al usuario.

### Cambiar también el backend a otro runtime de terminal

Rechazado para esta iteración: `portable-pty` ya proporciona una PTY nativa válida y el fallo estaba en la frontera UI–PTY. Se conserva el backend y se reduce el cambio al renderer, el forwarding y el resize.

## Consequences

- Claude Code y otras TUIs reciben la entrada interactiva estándar, incluidos los prompts iniciales de confianza.
- La UI deja de duplicar prompt, eco, historial y completado; el comportamiento lo determina la shell real.
- El tamaño visual del terminal se sincroniza con el tamaño del PTY.
- Se añaden `@xterm/xterm`, `@xterm/addon-fit` y el bundle frontend con esbuild.
- La persistencia de procesos y el aislamiento por tab siguen siendo responsabilidad del supervisor Rust.
- La futura ampliación de capacidades de terminal debe evaluarse contra xterm.js y `portable-pty`, no mediante parsers o modos especiales en ADE.
