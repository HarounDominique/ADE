# ADR-0032: El producto se llama Assay

## Status

Accepted

## Date

2026-09-06

## Context

El proyecto se llamaba ADE, por *Agentic Development Environment*. El nombre describía la categoría, no el producto, y en 2026 esa categoría está en disputa: «ADE» significa hoy al menos tres cosas —*Application Development Environment* en la literatura clásica, *Agent Development Environment* según la acuñación de Letta para construir agentes, y *Agentic Development Environment* en el sentido que usábamos—. Varios competidores publican artículos «What is an ADE» posicionándose como la definición de referencia.

Llamarse igual que la categoría tiene una consecuencia concreta: el significado del nombre lo escribe otro. Además, fuera del software «ADE» es sobre todo *Adverse Drug Event*, lo que contamina cualquier búsqueda desde el primer día.

Había un problema de posicionamiento por debajo del de marca. «Environment» invita a la comparación con los IDE, terreno en el que este producto pierde por diseño: deliberadamente no es un editor completo. Y «agentic» es un prefijo de ciclo de moda que envejecerá.

El mercado ayuda a ver el hueco. Cursor, Claude Code, Codex, Devin y Factory compiten en capacidad del agente; la gobernanza aparece como añadido para clientes enterprise. Lo que distingue a este producto no es el modelo sino la postura, ya escrita en sus principios: *el agente no es autoridad sobre su propio resultado*. El nombre debía decir eso.

## Decision

El producto se llama **Assay**.

Un *assay* es la determinación de la composición y la pureza de una muestra: no se acepta lo que una sustancia dice ser, se mide. Es la traducción exacta del principio de verificación del producto y del modelo de verdad, donde el resumen del agente no sustituye al código, a los tests ni a Git.

`ade` se conserva como identificador técnico —binario, comando, ids de módulo, variables de entorno `ADE_*`, directorio `.ade/`—. Renombrar el producto no obliga a renombrar la implementación, y mantener el comando en tres letras conserva una propiedad valiosa.

## Alternatives considered

### Conservar ADE

Rechazado por lo anterior: es una etiqueta de categoría en disputa activa, con colisión fuerte fuera del software y una promesa de IDE que el producto no cumple.

### Docket

El registro ordenado de asuntos pendientes de resolución, cada uno con su evidencia. Encajaba con la Task como unidad y con la adjudicación. Descartado por preferencia de quien tiene que pronunciarlo a diario y por la saturación del término en software legal.

### Warrant, Foreman

Descartados por colisión directa: Warrant es una empresa de Y Combinator dedicada a autorización; Foreman es a la vez theforeman.org y la herramienta de Procfiles de Heroku.

### Purity Control

Propuesto como referencia a The X-Files. Descartado tras comprobar la mitología: *Purity Control* nombra allí el programa del Sindicato, una cábala que experimenta con humanos en secreto y sin consentimiento. Es exactamente lo contrario de lo que este producto defiende, y «purity» arrastra además carga política ajena al software. El impulso —un nombre con un referente detrás— se conserva; el referente concreto firmaba el contraargumento.

## Consequences

- La identidad se apoya en registro y evidencia, no en conversación ni en copiloto: se *acepta* o se *devuelve* un cambio, no se «confía» en él.
- El producto deja de compararse por defecto con los IDE.
- La documentación distingue dos cosas que antes eran una: `Assay` es el producto, `ade` es la implementación. Un texto que hable del comando o del esquema de datos sigue diciendo `ade`.
- Queda pendiente, y no lo cubre esta decisión, la verificación de dominio y de marca registrada antes de cualquier uso comercial.

## Implementation evidence

El cliente muestra el nombre en la marca del lateral, el título de la ventana, el breadcrumb, `productName` de Tauri y los mensajes al usuario. README, PRODUCT, DESIGN y el nexus lo adoptan como nombre de producto conservando `ade` como identificador técnico.
