# ADR-0054 — Ubuntu como primer objetivo Linux

## Status

Accepted

## Date

2026-09-10

## Amends

[ADR-0031](0031-cross-platform-target.md) en lo relativo al orden operativo de verificación y distribución de Linux, y [ADR-0050](0050-installable-artifact-and-update-notice.md) en lo relativo a la plataforma con artefacto instalable.

## Context

Assay ya arranca en Ubuntu según una comprobación manual del operador, y la matriz de CI ya compila y prueba el proyecto en `ubuntu-latest`. Sin embargo, Linux todavía no tiene un artefacto distribuible ni un smoke registrado que cubra el recorrido de uso real.

“Linux” es una familia demasiado amplia para ser el primer contrato de distribución: cambia el WebKitGTK disponible, el sistema de paquetes, el compositor y las convenciones de integración de escritorio.

## Decision

Ubuntu será el primer objetivo Linux de Assay.

El primer artefacto será un paquete Debian (`.deb`), construido en Ubuntu y publicado junto con su checksum en el manifiesto de releases. La primera verificación manual cubrirá, como mínimo, arranque, terminal PTY, Explorer/editor, escape hatch, Git, detección de proveedores, persistencia tras reinicio y ausencia de procesos huérfanos.

Esto no convierte todavía a Linux en plataforma `verificada`: el grado sólo cambia cuando la matriz y el smoke completo estén registrados. Tampoco implica prometer soporte equivalente para todas las distribuciones basadas en Debian ni para Fedora, Arch o Flatpak.

## Alternatives Considered

### Soportar Linux genérico desde el primer release

Rechazado: no define un runtime WebKitGTK, un formato de instalación ni un conjunto reproducible de pruebas. La amplitud sería una afirmación difícil de sostener.

### Empezar por Fedora o Flatpak

Rechazado para este corte: ambos pueden ser objetivos posteriores, pero añadirían otra combinación de packaging y permisos antes de tener un recorrido Ubuntu cerrado.

### Publicar sólo AppImage

Rechazado como primer artefacto: facilita descargar, pero no ofrece la integración de paquetes que una instalación Ubuntu espera. Puede añadirse como canal complementario.

## Consequences

- Las decisiones de Linux se prueban primero contra un entorno concreto y reproducible.
- CI construye el shell, genera el paquete Debian, ejecuta el smoke disponible y conserva el artefacto como evidencia.
- La documentación debe distinguir “arranca en Ubuntu” de “Ubuntu está verificado y soportado”.
- Fedora, Arch, otras distribuciones, Flatpak y AppImage quedan como expansiones posteriores, no como soporte implícito.
