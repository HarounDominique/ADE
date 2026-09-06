# ADR-0028: Paridad operativa con GitHub Desktop en Version control

## Status

Accepted

## Date

2026-09-06

## Context

La shell de ADE ya tiene un MVP funcional de control de versiones: Projects, contexto de Project y branch, historial, cambios pendientes, diff, commit local, push y fetch. El problema pendiente es de distribución y comprensión: Version control todavía puede presentar demasiado chrome, separación espacial poco útil y una jerarquía menos directa que la de las herramientas de referencia.

Se auditó en vivo GitHub Desktop en macOS para entender sus pantallas, opciones y flujos sin asumir que un IDE tradicional sea el modelo adecuado. El detalle observado se conserva en [Auditoría de GitHub Desktop](../knowledge/github-desktop-audit.md).

## Decision

`Version control` adopta la arquitectura de información de GitHub Desktop:

1. Mantener una cabecera persistente con repositorio/Project, branch, estado de fetch y estado de publicación.
2. Mantener dos tabs principales: `Changes` para el working tree y `History` para la evidencia histórica.
3. En `Changes`, reservar una columna compacta para filtro y selección de ficheros y dedicar el espacio principal al diff del fichero activo.
4. En `History`, mostrar lista de commits, filtro, detalle del commit, ficheros afectados y diff seleccionable; las columnas auxiliares se contraen independientemente y conservan un control de restauración accesible. La comparación entre ramas queda pendiente de un contrato backend específico.
5. Tratar `Commit`, `Push origin` y `Fetch origin` como operaciones distintas y reconocibles. `Commit` crea únicamente un commit local.
6. Hacer que Project y branch sean selectores de contexto de primera clase; al cambiar cualquiera se rehidratan lista, selección, diff y estado Git.
7. Retirar duplicaciones visuales y paneles que compitan con el diff. `Git workspace` seguirá existiendo sólo dentro de `Version control`, pero se integrará en sus tabs en lugar de actuar como un workbench paralelo.
8. Mantener los invariantes existentes: no descartar cambios locales, no forzar cambios de branch, confirmar mutaciones sensibles y mostrar errores con una reentrada clara.

La paridad es de flujo, jerarquía e información, no una copia literal de la identidad visual ni de la implementación de GitHub Desktop.

## Alternatives considered

### Mantener la distribución actual

Rechazado como objetivo final: es operativa, pero deja demasiado espacio sin información y exige interpretar una composición menos habitual.

### Adoptar una vista densa tipo IDE/GitLens

Rechazado: ADE está orientado a dirigir agentes y revisar cambios, no a maximizar escritura manual ni comandos Git avanzados en una sola superficie.

### Hacer que `Commit` publique automáticamente

Rechazado: mezcla una mutación local con una operación remota y reduce el control del usuario. GitHub Desktop demuestra que la separación `commit → push` es más legible.

### Copiar toda la interfaz de GitHub Desktop

Rechazado: ADE necesita conservar Projects No Git, Agents, documentación viva y sus propios contratos de permisos. Se adopta el patrón de interacción, no la totalidad del producto de referencia.

## Consequences

- Version control se convierte en una superficie más reconocible desde el primer vistazo.
- El diff obtiene prioridad espacial y deja de competir con columnas vacías o paneles permanentes.
- El modelo de estado debe invalidar explícitamente selecciones al cambiar Project o branch.
- La UI requerirá pruebas de layout, teclado, estados de carga/error y cambios externos al repositorio.
- El modal de commit se mantiene como implementación válida: concentra una mutación sensible, conserva foco y evita sacrificar espacio del diff. Un composer integrado sólo se adoptará si evidencia posterior demuestra una mejora clara.

## Acceptance criteria for implementation

- `Changes` y `History` conservan tabs accesibles y muestran su contenido sin encabezados redundantes.
- En `Changes`, seleccionar un fichero actualiza el diff visible y el diff utiliza todo el ancho disponible después de la lista.
- En `History`, seleccionar commit y fichero actualiza de forma inmediata el detalle y su diff.
- El cambio de Project o branch no deja residuos del contexto anterior.
- `Commit`, `Push origin` y `Fetch origin` mantienen estados y errores independientes.
- La composición sigue siendo usable en tamaños de ventana macOS soportados y con navegación por teclado.
- Las pruebas de contrato cubren el flujo `Changes → diff → commit local → push` y `History → commit → fichero → diff`.

## Implementation evidence

La implementación de 2026-09-06 entrega `Changes` como tab inicial, filtro de ficheros, filtro de historial, estado remoto, `Fetch origin`, `Push origin` y `Commit` independientes, diff dominante, paneles auxiliares de `History` contraíbles con restauración accesible y el disclosure `Repository actions` para operaciones menos frecuentes. El split de `Changes` no depende de tracks implícitos; los controles de restauración de `History` permanecen alineados con sus cabeceras y los diffs reenvuelven líneas largas al ancho disponible cuando cambian las columnas. `npm run build` y `npm test` pasan con 115 tests TypeScript. El bundle macOS genera `ADE.app`; el empaquetado de `.dmg` sigue fuera de este corte.
