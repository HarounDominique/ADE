# ADR-0031: ADE como producto multiplataforma verificado por CI

## Status

Accepted

## Date

2026-09-06

## Context

ADE se construyó contra macOS. La elección nunca fue una decisión declarada: fue la máquina donde se desarrollaba. El resultado es que el sistema operativo se filtró en cinco puntos del código —el escape hatch, la shell del PTY, la ejecución de comandos, la localización del runtime Node y la construcción del sidecar— sin que ninguno estuviera marcado como frontera.

Dos de esos puntos ya ramificaban por plataforma; los otros tres asumían macOS de forma literal: `Command::new("open")`, rutas de Homebrew y un script de construcción que escribía en `/private/tmp`, leía su raíz de un `URL.pathname` y generaba un lanzador `#!/bin/sh`.

Tauri 2, el framework ya adoptado, compila en las tres plataformas. La barrera no es el framework sino la ausencia de dos cosas: una frontera explícita y una forma de saber si algo sigue funcionando fuera de macOS. Sin la segunda, cualquier afirmación sobre Windows o Linux es una hipótesis leída en el código, no un hecho.

## Decision

1. ADE es un producto multiplataforma: macOS, Windows y Linux son objetivos declarados, no adaptaciones oportunistas.
2. El contacto con el sistema operativo se concentra en las cinco fronteras enumeradas en [SPEC-cross-platform-support](../specs/SPEC-cross-platform-support.md#platform-boundary). Cada una vive detrás de `cfg(target_os)` o de una comprobación explícita, y el camino común no contiene rutas ni comandos de un sistema concreto.
3. La verificación es CI por matriz sobre las tres plataformas. Un cambio no se declara portable porque el código lo parezca; se declara portable cuando la máquina de esa plataforma lo compila y pasa sus tests.
4. La documentación nombra el grado de soporte de cada plataforma: `verificada` (CI verde y smoke manual registrado), `construible` (sólo CI verde) o `no verificada`. Ningún documento insinúa más de lo que existe.
5. No se abstrae el sistema operativo detrás de una capa propia. Cinco fronteras explícitas son más baratas de leer y de corregir que una indirección que las oculte.

## Alternatives considered

### Seguir siendo un producto macOS

Rechazado por el objetivo de producto: ADE dirige agentes sobre repositorios locales, y esa población no es mayoritariamente macOS. Mantener una sola plataforma tampoco era gratis: las asunciones seguían filtrándose sin marca.

### Portar a Windows sin CI, verificando a mano

Rechazado: convierte cada cambio futuro en una apuesta. Las regresiones de plataforma son invisibles desde la máquina de desarrollo, que es precisamente la plataforma que no regresa. Sin matriz, el soporte se degrada en silencio.

### Una capa de abstracción del sistema operativo

Rechazado: son cinco puntos, no cincuenta. Una capa propia añadiría indirección, ocultaría en qué plataforma falla algo y tendría que crecer con cada caso particular, que es justo lo que hace ilegible este tipo de código.

### Esperar a tener una máquina Windows antes de tocar nada

Rechazado: el trabajo de aislar fronteras es legible desde el código y no requiere la plataforma destino. Lo que sí la requiere es afirmar que funciona, y eso es exactamente lo que la política de grados de soporte impide hacer antes de tiempo.

## Consequences

- Un cambio que introduzca una asunción de plataforma en el camino común es un defecto, no una omisión.
- CI pasa a ser la fuente de verdad sobre portabilidad, y su coste de mantenimiento es parte del coste de ser multiplataforma.
- Linux entra en la matriz desde el principio aunque su verificación práctica llegue después: incluirlo tarde habría significado descubrir sus fronteras cuando ya hubiera más código.
- El empaquetado firmado y la distribución por plataforma quedan fuera de esta decisión y necesitarán la suya.
- La afirmación «ADE es una aplicación macOS», presente en documentación anterior, deja de ser el contrato vigente.

## Implementation evidence

El primer corte del 2026-09-06 lleva las cinco fronteras a `cfg(target_os)` o a comprobación explícita y corrige el script de construcción del sidecar. Verificado en macOS: `cargo build` limpio, 18 tests Rust, 120 TypeScript, sidecar reconstruido y aplicación relanzada contra él. Windows y Linux quedan `no verificadas` hasta el primer resultado de la matriz de CI.
