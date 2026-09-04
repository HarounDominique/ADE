# ADR-0009 — Adoptar Tauri 2 para el shell desktop

## Status

Accepted for MVP

## Date

2026-09-02

## Context

El spike 003 comparó Tauri y Electron para una workstation local-first. ADE necesita una ventana desktop, acceso controlado a procesos/filesystem y un frontend web, pero debe mantener el dominio TypeScript independiente del framework.

## Decision

Adoptar Tauri 2 para el shell desktop del MVP, con macOS como primera plataforma. El prototipo generado en `desktop/` compila en release, produce `.app`/`.dmg` y arranca en modo desarrollo. Las capacidades nativas se expondrán de forma mínima y explícita; la UI invocará casos de uso de ADE y no accederá directamente a SQLite o Git.

El estado de release vigente se valida con el `.app` macOS. La generación del `.dmg` queda diferida porque el script de bundle del entorno no es estable y no forma parte del cierre v0.3.

Electron queda como fallback si un spike de integración real demuestra que Rust/WebView o el modelo de permisos bloquea la vertical. No se construirá un editor completo ni se habilitará contenido remoto con privilegios.

## Alternatives considered

### Electron

- Ventaja: encaja directamente con Node/TypeScript y Chromium incluido.
- Rechazo: mayor peso de distribución y más superficie privilegiada; requiere disciplina estricta de main/renderer, preload, sandbox y context isolation.

### Shell web local sin empaquetar

- Ventaja: prototipado rápido.
- Rechazo: no ofrece la experiencia desktop objetivo ni una frontera nativa clara para permisos y escape hatch.

## Consequences

- Se añade un subproyecto Rust/frontend bajo `desktop/` y un toolchain nativo para desarrollo.
- El WebView del sistema reduce el tamaño de distribución, pero exige validar diferencias de rendering en las plataformas objetivo.
- Los comandos Tauri y las capacidades pasan a ser parte del contrato de build desktop.
- El siguiente trabajo debe implementar una única vertical observable y mantener el CLI como fallback operativo.
