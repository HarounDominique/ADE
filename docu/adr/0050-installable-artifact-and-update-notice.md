# ADR-0050 — Artefacto instalable y aviso de versión, sin autoactualización

## Status

Accepted

## Date

2026-09-09

## Amends

El alcance de [SPEC-cross-platform-support](../specs/SPEC-cross-platform-support.md), que dejaba fuera el empaquetado por plataforma y la actualización remota, y el `.dmg` diferido en el corte de packaging de [ADR-0011](0011-portable-sidecar-and-automatic-reconciliation.md).

## Context

Descrito como G8 en [product-gap-audit](../knowledge/product-gap-audit.md). Instalar Assay era reemplazar `Assay.app` a mano en `/Applications`, y la aplicación no tenía forma de saber —ni de decir— que existía una versión más reciente. El `.dmg` seguía diferido porque el `bundle_dmg.sh` de Tauri falla en este entorno.

Cada iteración costaba, por tanto, una operación manual, y una instalación vieja no daba ninguna señal de serlo.

## Decision

**Un comando produce el artefacto instalable.** `npm run desktop:release` construye el bundle, lo monta junto a un enlace a `/Applications` y crea el `.dmg` con `hdiutil` directamente, evitando el script de Tauri que falla aquí. Instalar pasa a ser arrastrar, no reemplazar a mano.

La versión se lee de un único sitio, `desktop/src-tauri/tauri.conf.json`, y de ahí salen el nombre del artefacto, el manifiesto y la versión que la aplicación compara. Repetirla en otro lugar es exactamente cómo se separan en silencio.

Junto al artefacto se escribe `latest.json`: producto, versión, fecha, notas y, por artefacto, plataforma, arquitectura, fichero, tamaño y `sha256`. El manifiesto que un usuario verifica es el mismo que la aplicación lee.

**La aplicación avisa; no se actualiza sola.** Al arrancar pregunta al feed —por defecto un asset de release del propio repositorio, sustituible con `ADE_UPDATE_FEED_URL`— y compara versiones. Si hay una más reciente lo dice en la barra de estado y una vez por arranque. No descarga, no reemplaza el bundle y no ejecuta nada: instalar sigue siendo una decisión del operador. Estar sin conexión, un feed sin publicar o un manifiesto ilegible se dicen como tales, no como "estás al día".

El script local no publica. Para las tres plataformas, [`.github/workflows/release.yml`](../../.github/workflows/release.yml) construye en runners nativos, fusiona los manifiestos y publica los artefactos cuando se empuja un tag `v<version>` que coincide con la versión de Tauri. La acción sigue siendo deliberada —crear el tag es la decisión de release— y no convierte la aplicación en autoactualizable.

## Alternatives Considered

### Actualizador automático de Tauri

Rechazado por ahora: exige firmar los artefactos con una clave de actualización y que la aplicación se reescriba a sí misma. Firmar es una decisión de distribución que este proyecto todavía no ha tomado, y una app que se reemplaza sola contradice la postura del producto en todo lo demás.

### Un `.zip` en lugar de un `.dmg`

Rechazado: descomprimir y mover sigue siendo el reemplazo manual que este ADR quita. La imagen con enlace a `/Applications` es la convención que el usuario de macOS ya conoce.

### Un servicio propio de versiones

Rechazado: infraestructura que mantener para una pregunta que un fichero estático responde. Un asset de release es donde la versión ya vive.

### Seguir difiriendo el `.dmg` por el fallo de `bundle_dmg.sh`

Rechazado: el fallo es del script de empaquetado de Tauri, no de `hdiutil`. Llamar a `hdiutil` directamente cuesta diez líneas y cierra el hueco.

## Consequences

- Existe un artefacto instalable, reproducible con un comando, y su `sha256` está declarado junto a él.
- Una instalación vieja lo dice; el operador decide cuándo y si actualiza.
- macOS, Ubuntu y Windows tienen artefacto instalable en una release; Fedora/Arch no tienen canal específico.
- El artefacto no está firmado ni notarizado, así que macOS mostrará la advertencia de Gatekeeper en una instalación limpia. Firmar es la decisión siguiente y no se toma aquí.
- La publicación de las tres plataformas queda automatizada detrás de un tag versionado; firmar artefactos sigue siendo una decisión posterior.
