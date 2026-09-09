# ADR-0046 — Aviso sonoro al terminar un turno, y aviso remoto congelado

## Status

Accepted

## Date

2026-09-09

## Context

Un turno de agente puede correr un cuarto de hora. Durante ese tiempo el operador no tiene nada que hacer delante de la pantalla, pero tampoco tiene forma de enterarse de que terminó salvo volver a mirar.

Se consideró un sistema de avisos con varias capas: sonido, notificación nativa del escritorio, webhook saliente y correo. El correo era el destino que el operador pedía —el único que alcanza a quien se ha ido de casa— y también el más caro: exige host, puerto, TLS, usuario, contraseña, remitente y destinatario, lo que obliga a una configuración de usuario que ADE no tiene y a guardar una credencial en el keychain del sistema. Eso son dos fronteras de sistema operativo nuevas sobre las siete que [SPEC-cross-platform-support](../specs/SPEC-cross-platform-support.md#platform-boundary) declara.

## Decision

Cuando un turno termina, ADE emite un tono corto. Suena tanto si el turno se completó como si falló, porque en ambos casos terminó; no suena cuando el operador lo detuvo, porque estaba delante y fue él quien lo paró.

El tono está encendido por defecto y se silencia desde la cabecera de la conversación. La preferencia es del operador, no del Project, y se conserva localmente.

El sonido se sintetiza con dos notas cortas en lugar de distribuir un fichero de audio: no añade un asset, ni decodificación, ni red.

No se añade resumen del turno. La respuesta del agente ya está en pantalla, y quien oye el tono está delante de ella; generar una frase con otro modelo sería trabajo que nadie pidió y coste que nadie autorizó.

El aviso remoto —correo, y con él el webhook y la casilla por turno que lo gobernaría— queda **congelado**, no descartado. Este ADR registra su diseño para que retomarlo no empiece de cero.

## Alternatives Considered

### Notificación nativa del escritorio

Diferida con el resto del aviso remoto. Cubre estar en la máquina pero en otra ventana, que es justo lo que el tono ya cubre sin tocar una octava frontera de plataforma.

### Casilla de aviso por turno, junto a los permisos

Diferida con el correo, que es lo que gobernaría. La idea sigue siendo buena y conviene conservarla: decidir al enviar evita bombardear a quien está delante, sin que ADE tenga que adivinar por el foco de la ventana. Cuando se retome, no debe viajar dentro de `grantedPermissions`: avisar no es algo que el agente pueda hacer, sino algo que hace ADE después, y ningún runtime entiende ese permiso.

### Frase de resumen generada por un modelo barato

Rechazada por sobreingeniería, según el criterio anterior: sólo tendría sentido cuando el aviso viaje a otro sitio y el operador no tenga la respuesta delante.

### Un fichero de audio distribuido con la app

Rechazado: un asset más que empaquetar, cargar y mantener para dos notas.

## Consequences

- Alejarse del ordenador durante un turno largo deja de exigir vigilancia: el final se oye.
- Quien trabaja con sonido desactivado en el sistema no recibe aviso alguno; es aceptable mientras el aviso remoto siga congelado, y deja de serlo cuando se retome.
- El tono no distingue éxito de fallo. La pantalla sí, y es donde está quien lo oye.
- El aviso remoto sigue siendo el alcance real de «me voy de casa», y esta decisión no lo sustituye.

## Update — 2026-09-09

El bloqueo por «no existe configuración de usuario en ADE» queda levantado por [ADR-0053](0053-user-settings-live-in-ades-store.md): las preferencias del operador viven en el store y el sidecar puede leerlas. Lo que sigue frenando el aviso remoto son las dos fronteras de plataforma que añade el correo, no la falta de dónde declararlo.
