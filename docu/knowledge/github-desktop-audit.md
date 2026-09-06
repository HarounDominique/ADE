# Auditoría de GitHub Desktop para Version control

## Propósito

Este documento registra la auditoría funcional y de distribución realizada sobre una sesión activa de GitHub Desktop en macOS. Su objetivo es convertir sus patrones más claros en un contrato de diseño para la siguiente iteración de `Version control` de ADE. No prescribe copiar la implementación interna ni la identidad visual completa de GitHub Desktop: prescribe una experiencia de control de versiones fácil de abordar, legible y orientada a la decisión.

La auditoría se realizó el 2026-09-06 sobre un repositorio local de ADE con cambios e historial disponibles. Las observaciones describen superficies y flujos visibles, no datos concretos del repositorio auditado.

## Hallazgos principales

### 1. Contexto persistente

GitHub Desktop mantiene una franja superior estable con tres piezas de contexto:

- `Current Repository`: selector visible del repositorio activo.
- `Current Branch`: selector visible de la rama activa.
- `Fetch origin`: acción directa con el momento del último fetch y el estado de publicación.

El usuario entiende dónde está antes de operar. El contexto no se repite en un panel lateral ni se mezcla con el diff.

El selector de repositorio contiene un filtro, una acción `Add` y agrupaciones `Recent` y por propietario. Esta combinación permite cambiar rápido de repositorio sin convertir el selector en una lista plana. La selección es explícita y debe actualizar todos los datos dependientes de ADE.

### 2. `Changes`: decidir qué entra en el commit

La pantalla `Changes` se divide en dos responsabilidades con una jerarquía inequívoca:

1. Una columna izquierda estrecha para filtrar, seleccionar ficheros e indicar qué cambios se incluirán.
2. Una superficie derecha dominante para leer el diff del fichero activo.

La columna izquierda contiene `Filter Options`, un filtro de ficheros, un control de inclusión del working tree y la lista de ficheros modificados. El fichero seleccionado queda resaltado y su diff cambia inmediatamente.

El diff ocupa la mayor parte del ancho útil. Muestra líneas de contexto, números de línea, hunks, adiciones y eliminaciones con diferenciación cromática y suficiente contraste. Las líneas pueden seleccionarse para preparar commits parciales. Existe una acción secundaria `Diff Settings`, pero no compite con la lectura.

El commit se prepara en la misma vista: autor, `Commit summary`, `Commit description`, coautores/opciones y un botón que expresa exactamente la operación. GitHub Desktop no obliga a saltar a otra pantalla para convertir la selección en un commit.

### 3. `History`: comprender qué ocurrió

La pantalla `History` conserva la misma división general, pero cambia el foco:

- la columna izquierda lista commits y ofrece `Select Branch to Compare…`;
- el panel principal muestra título del commit, autor, fecha, SHA y copia del SHA completo;
- las métricas de líneas añadidas/eliminadas y el número de ficheros afectados hacen visible el tamaño del cambio;
- una lista de ficheros modificados permite elegir el diff concreto;
- el diff mantiene la lectura con líneas numeradas y colores semánticos.

El commit seleccionado es el contexto de lectura. La lista no se sustituye por un resumen generado: el diff sigue siendo la fuente de evidencia.

### 4. Menús y operaciones

La barra nativa de GitHub Desktop mantiene las operaciones de repositorio y branch fuera de la superficie de lectura. El principio relevante para ADE es la separación entre leer cambios e historial, preparar y crear un commit local, publicar (`Push origin`), actualizar referencias remotas (`Fetch origin`) y cambiar o gestionar ramas.

ADE debe conservar esa separación. En particular, `Commit` no debe significar `Commit and Push`; el push debe ser posterior y visible como acción independiente.

## Mapa de adopción en ADE

| Patrón observado | Aplicación en ADE | Estado |
|---|---|---|
| Repositorio y rama siempre visibles | Topbar con `Current project` y `Current branch` | Implementado; debe conservarse |
| Selector de repositorio con filtro, recientes y alta | Selector de Project con Projects Git/No Git | Parcial; ampliar en la próxima iteración |
| Tabs `Changes`/`History` | Tabs accesibles de `Version control` | Implementado |
| Lista de cambios a la izquierda | Working tree filtrable y seleccionable | Implementado |
| Diff como superficie dominante | Diff ocupa la columna derecha completa, sin huecos | Objetivo de paridad; corregir distribución pendiente |
| Commit contextual en `Changes` | ADE usa botón `Commit` y diálogo modal | Implementado; validar contra uso integrado de GitHub Desktop |
| Commit local separado de Push | `Commit` local, después `Push origin` | Implementado |
| Fetch visible e independiente | `Fetch origin` independiente | Implementado |
| Historial con detalle y diff | Commit, ficheros y diff seleccionable | Implementado; mejorar distribución |
| Compare branch | Filtro/selector de comparación de ramas | Pendiente |
| Selección parcial de líneas | Inclusión por fichero actualmente; hunk/línea después | Pendiente y fuera del primer corte si eleva riesgo |

## Flujo objetivo de ADE

```text
seleccionar Project → seleccionar branch → Changes/History
        ├─ Changes → filtrar → seleccionar fichero → leer diff → Commit local → Push origin
        └─ History  → filtrar/comparar → seleccionar commit → seleccionar fichero → leer diff
```

El cambio de Project o branch invalida y vuelve a cargar la lista, el fichero activo, el diff, las métricas y los estados de publicación. Ningún diff o commit del contexto anterior puede permanecer visible como si perteneciera al nuevo contexto.

## Criterios de calidad de la siguiente iteración

- La mayor parte del área de Version control se dedica al diff o al detalle del commit; no quedan columnas vacías entre lista y diff.
- El usuario distingue en un vistazo `working tree`, `commit local`, `push pendiente` y `fetch`.
- Al seleccionar un fichero de `Changes` cambia el diff en la misma vista, con feedback de selección y estados `loading`, `empty` y `failed`.
- El título y el cuerpo del commit son opcionales según el flujo, pero la acción deja claro si crea un commit local o publica cambios.
- `History` mantiene una lista navegable, detalles del commit y diff legible sin abandonar la vista.
- Los selectores de Project y branch son rápidos, filtrables, accesibles por teclado y coherentes con el estado real del repositorio.
- La interfaz conserva los contratos de seguridad existentes: no descarta cambios locales ni fuerza un cambio de branch.

## Fuera de este contrato

No se adopta la identidad visual completa de GitHub Desktop, sus menús internos ni sus servicios GitHub. Tampoco se introduce en esta iteración una integración de PR, selección parcial por línea o gestión avanzada de ramas salvo que una decisión posterior lo priorice explícitamente.

