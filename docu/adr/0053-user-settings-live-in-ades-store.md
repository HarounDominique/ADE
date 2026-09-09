# ADR-0053 — Las preferencias del operador viven en el store de ADE

## Status

Accepted

## Date

2026-09-09

## Amends

El almacenamiento de preferencias que [ADR-0027](0027-provider-scoped-model-selection.md) y [ADR-0046](0046-turn-chime-and-frozen-remote-notice.md) dejaron en el `localStorage` de la shell, y desbloquea el aviso remoto congelado en el segundo.

## Context

Assay no tenía configuración de usuario. Cada preferencia —el tono de fin de turno, el modelo por defecto por proveedor, el estado de los paneles— vivía en el `localStorage` del webview.

Eso tiene dos consecuencias, y la segunda es la cara. La primera: una preferencia se pierde al reinstalar o al limpiar los datos del sitio. La segunda: **el sidecar no puede leerla**. Una preferencia que el backend no ve es una preferencia de la que ninguna capacidad puede depender, y por eso quedaron bloqueadas varias a la vez: el aviso remoto se congeló explícitamente por «no existe configuración de usuario en ADE», el feed de actualización sólo podía fijarse por variable de entorno, y un presupuesto de gasto —ahora que el consumo se mide— no tendría dónde declararse.

## Decision

Existe una tabla `settings` en la base de datos de ADE, y un módulo de aplicación que la lee y la escribe con tipos y valores por defecto. Las preferencias del operador viven ahí.

Se distingue lo que es del operador de lo que es del dispositivo. El tono de fin de turno, el modelo por defecto por proveedor y el feed de releases son suyos y van al store. La altura del dock, el ancho del sidebar, las columnas plegadas, el tema y las pestañas abiertas describen esta ventana en esta máquina y se quedan en `localStorage`, donde no molestan a nadie.

Una escritura declara sólo lo que cambia y el resto se conserva, de modo que dos superficies que editan preferencias distintas no se borran entre sí.

Lo que este webview ya recordaba se traslada una vez, en el primer arranque contra un store sin preferencias: actualizar Assay no reinicia en silencio el tono ni los modelos por defecto.

El feed de actualización tiene precedencia explícita: lo que pida la petición, luego lo que el operador haya configurado, luego la variable de entorno, luego el valor por defecto. Vacío significa que este install no pregunta a nadie.

La superficie es un diálogo, no una vista: son pocas, se leen poco y ninguna necesita la ventana entera.

## Alternatives Considered

### Un fichero de configuración en `.ade/`

Rechazado para lo del operador: `.ade/` pertenece al Project y se versiona con él. Un tono de aviso no es una decisión del repositorio, y compartirla por Git sería un efecto no deseado.

### Seguir en `localStorage` y exponerlo al sidecar por petición

Rechazado: obliga a que la shell esté viva y a que cada capacidad pregunte a la UI por un dato que necesita antes de que la UI exista. Es la inversión que causó el bloqueo.

### Una vista completa de Ajustes en la navegación

Rechazado hoy: hay tres preferencias. Una vista permanente para eso ocupa una entrada de navegación que compite con Projects, Agents o Changes. Cuando haya más, promocionarla es barato.

### Mover también el tema y los tamaños de panel

Rechazado: describen esta ventana, no al operador. Sincronizarlos entre instalaciones sería una promesa que nadie ha pedido.

## Consequences

- Existe por fin dónde declarar una preferencia, y con ello dejan de estar bloqueados el aviso remoto, un presupuesto de gasto y un feed de releases privado.
- Una preferencia sobrevive a la reinstalación y el sidecar puede leerla sin que la ventana esté abierta.
- Las preferencias son globales al operador: no hay todavía preferencia por Project, y alguna —el modelo por defecto— podría quererlo.
- El `localStorage` sigue guardando el modelo por defecto como copia, para que la elección no parpadee mientras el sidecar contesta; el store es el que manda.
