---
id: chatgpt-desktop-agents-audit
class: operational
status: proposed
updatedAt: 2026-09-06
source: user-brief, official-openai-documentation, ADE-source-audit
---

# Auditoría de ChatGPT Desktop para Agents

## Propósito y método

Este documento convierte los patrones de conversación de ChatGPT Desktop en un contrato de trabajo para la siguiente iteración de `Agents` en ADE. La referencia es de jerarquía, continuidad y recuperación de conversaciones; no autoriza copiar su identidad ni integrar sus servicios remotos.

La automatización no puede controlar ni capturar la aplicación ChatGPT que hospeda esta sesión. Por rigor, las afirmaciones sobre producto se apoyan en la documentación oficial vigente y en el comportamiento que el usuario ha delimitado; las conclusiones de distribución son una propuesta explícita, no una afirmación de inspección visual píxel a píxel.

Fuentes funcionales:

- [ChatGPT Desktop: Chat, Work, Codex, Recents y Projects](https://help.openai.com/en/articles/20001276/).
- [Projects in ChatGPT: conversaciones, continuidad, búsqueda y ramas](https://help.openai.com/en/articles/10169521-projects-in-chatgpt).
- La superficie implementada de ADE en `desktop/src/` y sus contratos [SPEC-agent-providers](../specs/SPEC-agent-providers.md#agents-surface) y [SPEC-desktop-shell](../specs/SPEC-desktop-shell.md#agents).

## Patrones de referencia que sí aportan valor

### 1. La conversación es el trabajo

ChatGPT separa la navegación de conversaciones del hilo que se está leyendo. El hilo recibe el ancho, el scroll y el foco; la lista lateral sirve para recuperar, no para competir con el contenido. El compositor se mantiene anclado al borde inferior y no obliga a abandonar la conversación para actuar.

**Adopción en ADE:** el centro de `Agents` será una única superficie de conversación. No habrá inspector derecho permanente para cambios Git, estado local, rama, commit, actividad o skills. Esas responsabilidades pertenecen a `Version control`, `Projects` y `Tasks`.

### 2. Continuidad recuperable

La aplicación distingue una conversación nueva de una existente y permite volver a una conversación sin reconstruir mentalmente el contexto. La documentación oficial confirma que Projects conserva chats y que una conversación puede ramificarse sin perder el hilo original.

**Adopción en ADE:** cada conversación conserva su sesión real de provider, Project, Task opcional, título, proveedor, último modelo usado, fecha de actividad y mensajes. ADE nunca simula una reanudación: sólo muestra una sesión como reanudable tras recibir su identificador real.

### 3. El contexto organiza; no duplica navegación

ChatGPT usa Projects para agrupar conversaciones y contexto. ADE ya posee un contexto canónico más apropiado para desarrollo local: `Projects` y los selectores globales de Project/rama. Repetir Projects dentro de Agents crearía dos autoridades para el mismo concepto.

**Adaptación obligatoria:** Agents sólo lista conversaciones del Project activo. No muestra conversaciones de otros Projects, ni permite cambiar Project desde el rail. El cambio de Project desde `Projects` o la topbar invalida la selección anterior, carga sólo las conversaciones del nuevo Project y ofrece un vacío accionable si no existen.

### 4. Recuperación rápida, no una lista plana

La documentación de ChatGPT Desktop describe Recents unificados con ordenación, filtrado y fijación; el patrón subyacente es que una conversación se encuentra por su relación con el trabajo y por recencia, no por una lista interminable de proveedores.

**Adaptación obligatoria:** el rail de ADE se agrupa por `Task`, no por Project ni sólo por provider. Cada grupo muestra título de Task, estado y actividad reciente; dentro, las conversaciones se ordenan por última actividad. Las conversaciones sin Task se agrupan en `General`. Los grupos son contraíbles, conservan su estado por Project y no esconden la conversación activa. Un filtro de conversaciones por título, Task y texto de preview llegará cuando el rail necesite más de una pantalla; no se adelanta un buscador duplicado antes de esa necesidad demostrada.

### 5. Controles próximos a la decisión

El selector de modo/modelo y las herramientas de composición pertenecen al momento de enviar, no a un panel de configuración separado. Su cambio debe conservar el contexto del hilo y dejar claro qué afectará al siguiente turno.

**Adopción en ADE:** el composer mantiene `Provider`, `Model` y permisos por turno en una franja compacta y accesible. El modelo se actualiza inmediatamente al abrir una conversación o cambiar de provider, y sólo presenta opciones del provider asociado. `Provider default` sigue sin enviar override. Cambiar de modelo afecta al siguiente turno, no reescribe mensajes históricos.

Una conversación queda ligada a un provider para preservar su protocolo de reanudación. Cambiar de provider crea una conversación nueva —opcionalmente vinculada a la misma Task— en lugar de fingir que una sesión Codex puede continuar como Claude Code u OpenCode. Esto preserva el contrato provider-neutral sin perder libertad para elegir modelos dentro de cada provider.

### 6. Progreso legible, sin razonamiento privado

Una conversación agéntica necesita distinguir mensaje, ejecución, resultado y error sin inundar la pantalla. La evidencia útil debe estar cerca del turno que la produjo y poder contraerse; no equivale a exponer razonamiento privado.

**Adopción en ADE:** los turnos podrán mostrar estados verificables (`Working`, `Completed`, `Stopped`, `Failed`) y, cuando existan, un resumen contraíble de herramientas/eventos y archivos observables. No habrá cadena de pensamiento, bloque de Git lateral ni inventario global de skills. El detalle duradero seguirá en Task y Version control.

## Distribución objetivo de Agents

```text
┌──────────────────────────┬──────────────────────────────────────────────────────┐
│ Conversations            │ Task / conversation title · provider · session state │
│ + New conversation       ├──────────────────────────────────────────────────────┤
│                          │                                                      │
│ TASK: Implement login    │          transcript, evidence attached to turns      │
│   ◉ Fix token refresh    │                                                      │
│   ○ Review retry logic   │                                                      │
│                          ├──────────────────────────────────────────────────────┤
│ TASK: Document v0.4      │ Provider · Model · permissions                       │
│   ○ Align specs          │ [Write a message…                              ][Send]│
│                          │                                                      │
│ GENERAL                  │                                                      │
│   ○ Explore repository   │                                                      │
└──────────────────────────┴──────────────────────────────────────────────────────┘
```

- El rail ocupa ancho estable, es redimensionable sólo si la lectura de títulos lo exige y no roba espacio a la conversación de forma permanente.
- El thread usa todo el resto del workbench. No hay tercera columna.
- La cabecera del thread es compacta: Task enlazada, nombre/título editable de la conversación, provider y estado. Project y rama permanecen en la topbar global.
- Los mensajes humanos se distinguen sutilmente y se alinean a la derecha; los del agente, a la izquierda. Los bloques de código, errores y evidencia conservan ancho de lectura y copia accesible.
- `New conversation` pide provider y asociación opcional a Task antes de crear la sesión. Cuando hay una Task activa, la preselecciona sin imponerla.
- Borrar, renombrar y futuros archive/branch viven en el menú contextual de cada conversación; borrar conserva el diálogo explícito existente y nunca toca archivos, Task ni Git.

## Flujos que se implementarán después de aprobar esta auditoría

### Nueva conversación asociada a una Task

`Project activo → Agents → New conversation → provider → Task opcional/preseleccionada → primer prompt → sesión real → hilo persistido`

### Retomar trabajo

`Project activo → Agents → grupo de Task → conversación → modelo para próximo turno → prompt → estado/evidencia del turno`

### Cambiar de Project

`selector global de Project → invalidar sesión/UI anterior → cargar grupos de Task y General del nuevo Project → restaurar última conversación válida o estado vacío`

No se trasladan a Agents los flujos de contexto Git, working tree, commit, push, fetch, rama, PR ni diff. El usuario los consulta en `Version control` sin perder la conversación persistida.

## Criterios de aceptación de la futura implementación

- Sólo se renderizan conversaciones del Project activo; ninguna respuesta asíncrona puede repoblar el rail con el Project anterior.
- El rail agrupa por Task y `General`, ordena conversaciones por actividad y conserva el grupo de la conversación activa abierto.
- La conversación ocupa toda la anchura restante; no existe inspector derecho permanente.
- Provider y modelo son visibles en el composer, son accesibles por teclado y su catálogo se sincroniza al seleccionar conversación.
- Cambiar provider no intenta reanudar una sesión de otro provider; crea un hilo nuevo ligado opcionalmente a la misma Task.
- El estado de una ejecución y la evidencia observada se conectan al turno correspondiente sin revelar razonamiento privado.
- Vacío, carga, error, cancelación, sesión no reanudable y permisos insuficientes tienen una recuperación comprensible.
- La experiencia conserva foco, atajos de envío, `prefers-reduced-motion`, contraste y el mínimo de ventana de macOS definido por la shell.

## Fuera de alcance

- Incrustar o sincronizar conversaciones remotas de ChatGPT/Codex Desktop.
- Mostrar conversaciones de varios Projects en el mismo rail.
- Copiar la barra lateral de Projects de ChatGPT Desktop.
- Duplicar Git o Version control dentro de Agents.
- Exponer cadena de pensamiento, credenciales, tokens o eventos que no puedan persistirse sin secretos.
- Compartición cloud, memoria entre Projects o colaboración multiusuario.
