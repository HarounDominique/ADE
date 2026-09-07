# ADR-0033: La terminal ejecuta el shell del usuario

## Status

Accepted

## Date

2026-09-07

## Amends

La decisión de «prompt mínimo, sin bienvenida ni eco duplicados», registrada en [SPEC-v0.3](../specs/SPEC-v0.3.md#post-release-maintenance) y en el contrato de terminal de [SPEC-workspace-core](../specs/SPEC-workspace-core.md#testing-strategy).

## Context

El PTY lanzaba `/bin/sh -i` con `PS1` forzado a `$ `. La intención era un arranque limpio y predecible: sin mensajes de bienvenida, sin configuración ajena, sin eco duplicado.

El coste apareció en uso. La terminal de Assay no se parecía a la terminal del desarrollador: sin su prompt, sin sus alias, sin sus colores, y —en macOS— sin su `PATH` real, porque una sesión que no es de login no lee `.zprofile` y la aplicación arrancada desde Finder hereda un entorno mínimo. El síntoma que lo destapó fue estético: la terminal se veía desnuda comparada con cualquier otra, aunque los dieciséis colores ANSI ya estuvieran definidos y el entorno anunciara `TERM=xterm-256color` y `COLORTERM=truecolor`.

Ese diagnóstico importa: no faltaba capacidad de color, faltaba el entorno del usuario. Un shell mínimo no emite color porque no hay nada configurado que lo emita.

## Decision

Fuera de Windows, el PTY ejecuta el `$SHELL` del usuario como sesión de **login e interactiva**. Assay no impone `PS1` ni `PS2` cuando el shell tiene configuración propia; sólo los aporta cuando la reserva es `/bin/sh`, que no tiene ninguna.

`$SHELL` se usa si está declarado y el fichero existe; en cualquier otro caso la reserva es `/bin/sh`. Windows conserva `cmd`, pendiente de la pregunta abierta sobre su intérprete por defecto.

`TERM` y `COLORTERM` se siguen declarando: son la promesa de capacidad, independiente de quién la aproveche.

## Alternatives considered

### Conservar `/bin/sh` y activar color por variables

Rechazado como solución completa: `CLICOLOR` y `LSCOLORS` arreglarían `ls`, pero no el prompt, ni los alias, ni el `PATH`, ni las herramientas que el desarrollador tiene configuradas. Habría atacado el síntoma más visible dejando intacta la causa.

### Un prompt propio de Assay con color y contexto

Rechazado como sustituto, no como idea: un prompt con proyecto y rama es útil, pero compite con el que el usuario ya tiene configurado en lugar de respetarlo. Queda disponible si alguna vez interesa un modo sin configuración personal.

### Sesión interactiva sin login

Rechazado: en macOS es precisamente `.zprofile` quien construye el `PATH`, y sin él la terminal no encuentra las herramientas que el usuario sí tiene instaladas.

## Consequences

- La terminal se comporta como la del usuario, con lo bueno y lo malo: un `.zshrc` lento o ruidoso se nota al abrir cada pestaña, y eso ahora es responsabilidad de su configuración, no de Assay.
- Assay deja de garantizar un prompt concreto. Cualquier prueba que dependiese de una cadena de prompt fija sería frágil por diseño.
- El entorno heredado deja de ser mínimo, de modo que el comportamiento puede variar entre máquinas. Es el precio explícito de que la herramienta se parezca a la del usuario.
- La reserva conserva el contrato anterior para un entorno sin `$SHELL`.

## Implementation evidence

`start_terminal_pty` resuelve `$SHELL`, lo lanza con `-l -i` y sólo aporta prompt cuando la reserva es `/bin/sh`. El test del PTY, que ejecuta un comando real y espera su salida, pasa contra el shell del desarrollador —zsh con su configuración cargada— además de contra la reserva.
