# ADR-0021: Reenvío de teclado para TUIs interactivas en el PTY

## Status

Accepted

## Date

2026-09-04

## Context

La terminal de ADE usa un campo HTML para introducir comandos y un emulador ANSI para representar la salida del PTY. Ese campo tenía sentido en modo shell, pero seguía consumiendo `↑`, `↓`, `Space`, `Enter` y `Esc` cuando Claude Code activaba su pantalla alternativa. Como resultado, los prompts interactivos de confianza y selección no recibían la entrada del usuario.

## Decision

Cuando el emulador detecta que el tab PTY está en pantalla alternativa, ADE entra en modo interactivo. El campo se vuelve de sólo lectura para impedir que el navegador capture texto, y cada tecla soportada se codifica como entrada de terminal y se envía mediante `terminal_input` al mismo `sessionId`. Se cubren caracteres imprimibles, flechas, navegación, espacio, Enter, Escape, Tab/Shift+Tab, borrado y controles `Ctrl`. Al volver a la pantalla principal se restaura el modo shell, incluido historial y completado de rutas `cd`.

## Alternatives considered

### Mantener el campo como editor de comandos

Rechazado: las teclas de una TUI seguirían siendo interpretadas por ADE y no llegarían al proceso interactivo.

### Sustituir el emulador por una dependencia de terminal completa

Diferido: resolvería más casos, pero ampliaría el alcance y el coste del shell. El PTY existente ya soporta la entrada necesaria y el bug está en la frontera de eventos.

### Enviar siempre todas las teclas al PTY

Rechazado: rompería el historial, el completado de `cd` y la ergonomía del modo shell.

## Consequences

- Claude Code y otras TUIs que usen pantalla alternativa pueden recibir navegación y selección normales.
- La separación entre modo shell y modo interactivo es observable y testeable sin acoplar el dominio a la UI.
- La superficie sigue siendo un emulador acotado; TUIs que requieran capacidades ANSI no implementadas pueden necesitar una evolución futura.
- El backend no necesita cambios de protocolo: `terminal_input` ya acepta bytes de entrada arbitrarios.
