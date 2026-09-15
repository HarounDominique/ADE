# Spec: Windows Runtime Hardening

<!-- Nexus: SPEC-NEXUS.md | Module id: windows-runtime-hardening -->

## Objective

Evitar falsos negativos y fallos transitorios en Windows cuando Assay inspecciona
toolchains o consulta Git. Los warnings de una herramienta no deben sustituir a su
versión real, y un lock breve del index de Git no debe convertir una lectura válida
en un error definitivo.

## Commands

```bash
npm run build
npm test
cargo test --manifest-path desktop/src-tauri/Cargo.toml
```

## Project Structure

- `src/application/local-runtime/toolchain-inspection.ts` — sondas `--version`.
- `src/adapters/git-command.ts` — ejecución compartida de Git.
- `tests/toolchain-inspection.test.ts` y `tests/git-command.test.ts` — regresiones.

## Code Style

La salida de versión se extrae de `stdout` y `stderr` se conserva sólo como apoyo de
diagnóstico. Los reintentos Git deben ser acotados, sólo para errores de lock/uso
transitorio y con backoff explícito.

## Testing Strategy

- Probar una herramienta que escribe warning en `stderr` y versión en `stdout`.
- Probar reconocimiento de errores transitorios de `.git/index` sin depender de un
  antivirus ni de una máquina Windows concreta.
- Ejecutar build, suite completa y tests Rust antes del commit.

## Boundaries

- Always: preservar el warning para diagnóstico, no ocultar errores definitivos y
  limitar los reintentos.
- Ask first: añadir dependencias, cambiar el contrato de Git o modificar CI.
- Never: tratar cualquier error de Git como reintentable ni presentar `stderr` como
  versión si `stdout` contiene una versión válida.

## Success Criteria

1. `npm --version` devuelve su versión aunque emita warnings en `stderr`.
2. Un lock temporal de `.git/index` se reintenta y un error persistente se propaga.
3. El comportamiento POSIX existente y la compatibilidad Windows se conservan.

## Resolved Decisions

- El warning queda disponible en el error sólo cuando la sonda falla; no se mezcla con
  la versión humana mostrada.
- Se permiten hasta cuatro intentos totales con backoff corto para locks reconocibles.
