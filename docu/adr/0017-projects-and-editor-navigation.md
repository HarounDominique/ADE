# ADR-0017: Projects como entrada y Editor como superficie de ficheros

## Status

Accepted

## Date

2026-09-04

## Context

La primera vista de ADE se llamaba `Overview`, aunque funcionaba principalmente como un Project Hub estático. El alta de Projects sólo era posible fuera de la shell y el selector superior asumía que todo Project era un repositorio Git. El visor de ficheros, en cambio, aparecía fuera de la navegación principal aunque ya permite editar y guardar.

## Decision

La primera opción de la navegación se denomina `Projects` y es la pantalla de entrada para:

- listar los Projects persistidos en ADE;
- mostrar nombre, ruta y tipo de control de versiones;
- seleccionar el Project activo;
- añadir un Project nuevo mediante el selector nativo de carpetas de macOS.

El alta acepta cualquier directorio local. Si contiene Git se registra como `Git` y se conserva su branch; si no lo contiene se registra como `No Git`, sin impedir el uso del Explorer, Editor, terminal o Tasks. El nombre inicial se toma del último segmento de la ruta y puede evolucionar a edición de metadata en una iteración posterior.

La superficie de ficheros se denomina `Editor`, porque permite consultar, modificar, guardar y descartar texto. Seleccionar o encontrar un fichero desde Explorer activa `Editor` automáticamente; cerrar el documento mantiene disponible la vista con un estado vacío explicativo. `Explorer` sigue siendo la navegación de archivos, no una vista duplicada.

El selector superior pasa a mostrar `Current project`. Su menú y la pantalla `Projects` comparten el mismo catálogo persistido. El control de branch permanece disponible sólo para Projects Git; en Projects sin Git muestra `No Git` y no es accionable.

## Alternatives considered

### Mantener `Overview` y añadir un botón de alta

Rechazado: no expresa que la vista administra el catálogo de Projects ni resuelve la ambigüedad del hub actual.

### Llamar `Visualizer` al editor

Rechazado: describe una vista pasiva y oculta que el fichero puede editarse y guardarse. `Editor` es el término estándar en IDEs.

### Rechazar carpetas sin Git

Rechazado: el workspace local, terminal y agente pueden aportar valor antes de inicializar Git.

## Consequences

- El alta de Project queda disponible dentro de ADE y requiere sólo seleccionar una carpeta.
- SQLite conserva el tipo de control de versiones para que Git no se infiera por errores de comandos.
- El selector de branch no intenta consultar Git en Projects `No Git`.
- Las Tasks, terminales y documentos siguen vinculados al Project activo; cambiar de Project no destruye sesiones PTY abiertas.
- La vista Projects conserva el detalle operativo existente como resumen del Project seleccionado, sin volver a convertirlo en la entrada principal.
