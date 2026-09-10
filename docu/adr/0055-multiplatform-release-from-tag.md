# ADR-0055 — Release multiplataforma desde un tag

## Status

Accepted

## Date

2026-09-10

## Amends

[ADR-0050](0050-installable-artifact-and-update-notice.md) en lo relativo a la publicación del artefacto y [ADR-0054](0054-ubuntu-first-linux-target.md) en lo relativo al alcance de la release Ubuntu.

## Context

Ubuntu ya tiene un `.deb` verificado y publicado, pero una release que sólo ofrece Linux obliga a los usuarios de macOS y Windows a buscar otro canal. Cada sistema necesita su runner nativo: el `.dmg` depende de `hdiutil`, el instalador Windows lo produce el bundler de Tauri y el `.deb` necesita las dependencias de WebKitGTK de Ubuntu.

El manifiesto de actualización debe seguir describiendo una sola versión con un artefacto para cada plataforma, aunque esos artefactos se construyan en máquinas distintas.

## Decision

El workflow [`release.yml`](../../.github/workflows/release.yml) se dispara al empujar un tag `v<version>` o manualmente para un tag existente. Ejecuta jobs independientes en Ubuntu, macOS y Windows; cada job valida el código, construye su instalador y sube su artefacto junto con un manifiesto parcial.

Un job final descarga los tres resultados, fusiona los manifiestos con el mismo contrato que `npm run desktop:release` y crea o actualiza la GitHub Release. El job rechaza una release si no están presentes los tres artefactos. La versión del tag debe coincidir con `desktop/src-tauri/tauri.conf.json`.

La publicación sigue siendo una decisión humana: crear el tag o lanzar manualmente el workflow. La aplicación sólo lee `latest.json` y avisa; no descarga ni se autoactualiza.

## Alternatives Considered

### Publicar cada plataforma desde un workflow separado

Rechazado: permite que cada plataforma publique un manifiesto parcial y deja una ventana en la que la aplicación puede ver una versión nueva sin disponer de su descarga. Un job final hace atómica la publicación del conjunto.

### Construir todos los instaladores en Ubuntu

Rechazado: macOS y Windows requieren toolchains y bundlers nativos; simularlos en Ubuntu haría que el artefacto dejara de representar la instalación real.

### Mantener sólo el release Ubuntu

Rechazado: es suficiente para validar la primera plataforma Linux, pero no para que el mismo release sirva a los usuarios de las tres plataformas soportadas.

## Consequences

- Un tag versionado produce `.deb`, `.dmg`, instalador Windows y `latest.json` fusionado.
- El build de cada plataforma queda aislado en su runner y una plataforma no puede borrar silenciosamente la entrada de otra.
- macOS no ejecuta el smoke gráfico en este workflow; mantiene la verificación manual registrada, mientras Ubuntu y Windows ejecutan su smoke automatizado disponible.
- La publicación depende de `contents: write` y de la existencia del tag; la firma y notarización de artefactos siguen pendientes.
