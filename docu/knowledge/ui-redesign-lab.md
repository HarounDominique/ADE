# Laboratorio de rediseño visual

## Propósito

Esta rama (`codex/ui-ux-redesign-lab`) es un entorno aislado para sustituir la apariencia actual del shell sin alterar sus contratos funcionales. El objetivo no es convertir ADE en un IDE tradicional ni en un dashboard genérico: es hacer que un desarrollador pueda leer una conversación de agente, inspeccionar un diff y tomar una decisión con menos esfuerzo visual.

## Herramientas activas

- `impeccable` es la capa principal: dirección de producto, crítica y verificación visual.
- `ui-ux-pro-max` queda instalado localmente en `.agents/skills/ui-ux-pro-max/` como biblioteca de patrones, accesibilidad, tipografía y estados. Sus recomendaciones son referencias, no decisiones automáticas.
- No se incorpora el paquete externo `ui-ux-agent-skill-system`: su distribución Codex referencia contratos compartidos que no se entregan como una skill instalable y dejaría dependencias incompletas.

## Evidencia de partida

- El shell ejecutable conserva navegación lateral, Explorer, selector de Project/rama, `Agents`, `Version control` y dock de terminal.
- La inspección del shell activo confirma que `Version control` ya contiene la información real necesaria: lista de cambios, diff, historial, fetch, commit y push.
- La hoja de estilos mantiene, no obstante, capas de chrome heredadas y decisiones de superficie de distintas iteraciones. Esto explica una percepción desigual aunque los flujos funcionen.
- El detector de Impeccable se ejecutó en `desktop/src/index.html`, pero quedó degradado porque sus módulos de parser no están disponibles; no debe interpretarse como un pase limpio.

## Dirección de prueba: escritorio de lectura operativa

Una herramienta macOS clara y serena, con la jerarquía de Codex Desktop para conversación y la economía de GitHub Desktop para cambios. El producto se reconoce por una idea: **todo lo que un agente hace deja una evidencia que se puede leer, comparar y aceptar**.

- La luz es el modo de trabajo por defecto; el oscuro es una traducción de la misma jerarquía, no un tema negro genérico.
- La conversación de agente es el centro de `Agents`: rail de sesiones discreto, mensajes humanos claramente propios y bloques de herramienta/evidencia ligados al turno que los produjo.
- `Version control` prioriza el diff y la selección de archivo; el commit es una acción deliberada que no compite por superficie constante.
- Navegación y Explorer son estructura, no decoración: un único lateral, etiquetas visibles, estados activos inequívocos y sin railes duplicados.
- Se emplean bordes finos, profundidad tonal contenida, tipografía de interfaz legible y una sola familia de iconos SVG. No hay glassmorphism, gradientes, tarjetas anidadas ni estética HUD.
- Las transiciones explican una continuidad espacial —panel, Explorer y terminal cambian de tamaño sin saltos— y respetan `prefers-reduced-motion`.

## Límites de la prueba

- Se preservan rutas, comandos Tauri, providers, permisos, persistencia y flujo Git existentes.
- No se inventan métricas, actividad, notificaciones ni identidad de usuario para decorar el shell.
- Cualquier ajuste de layout debe conservar foco de teclado, contraste, estados loading/empty/error y el mínimo de 900 × 640 px de la ventana.
- Antes de proponer merge se requiere captura real del `.app`, `npm test`, build desktop y una revisión visual comparada de `Agents` y `Version control`.

## Orden de implementación

1. Consolidar tokens, tipografía, elevación y cromas de ambos temas.
2. Rehacer la jerarquía de `Agents` para conversación, sesiones y evidencia por turno.
3. Rehacer `Version control` como lectura de cambios y diff, manteniendo el flujo local Commit → Push.
4. Afinar navegación, Explorer y terminal como infraestructura tranquila.
5. Verificar estados y capturas, corregir en una única pasada y documentar el resultado.

## Primera pasada aplicada

La primera prueba modifica únicamente `desktop/src/styles.css`: consolida una paleta light-first menos azulada, una noche separada pero legible, reduce el peso del chrome, convierte `Agents` en una superficie de lectura más amplia y rebaja `Version control` a pestañas de navegación con el diff como zona dominante. No altera el DOM, la semántica, los comandos ni los flujos de Project, Git o agentes.

Se verificó el bundle macOS en una instancia real de ADE con conversaciones de Claude Code y cambios Git del proyecto Apache Camel. `npm test` mantiene 112 tests correctos y el build desktop completa. La validación pendiente antes de cualquier merge es una revisión humana de esta variante y, si se acepta la dirección, una segunda pasada focalizada en tipografía y densidad de `Version control`.
