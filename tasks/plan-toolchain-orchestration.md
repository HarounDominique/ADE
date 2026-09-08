# Plan: Orquestación de toolchains del Project

<!-- Spec: docu/specs/SPEC-run-configurations.md | Module id: run-configurations -->
<!-- ADR: docu/adr/0038-external-project-toolchains.md -->

## Objetivo

Ampliar `run.detect` para proponer build, test y lint usando los manifiestos y scripts reales del Project, sin empaquetar compiladores ni ejecutar nada durante la detección.

## Orden de implementación

1. Extraer helpers pequeños para propuestas de comandos y wrappers.
2. Ampliar Node y Java sin cambiar las propuestas de run existentes.
3. Añadir Python, Rust, Go y .NET con detección limitada a manifiestos inequívocos.
4. Sondear disponibilidad y versión de los entry points implicados, sin ejecutar build/test/lint.
5. Cubrir colisiones de ids, directorios ignorados y ausencia de toolchain mediante tests.
6. Sincronizar spec, nexus, ADR y README.

## Riesgos

- **Falsos positivos:** sólo proponer operaciones respaldadas por manifiestos, scripts o bloques de configuración reconocibles.
- **Comandos que mutan el workspace:** no proponer comandos de formateo como lint; usar verificaciones (`clippy`, `vet`, `dotnet format --verify-no-changes`) cuando proceda.
- **Proyectos monorepo:** mantener raíz y subdirectorios inmediatos, y nombres con prefijo para evitar confundir dos toolchains.
- **Wrappers:** respetar `mvnw`/`gradlew` y el runner declarado por Python cuando sea detectable.

## Verificación

`npm run build`, `npm test`, `node --check desktop/src/main.js` y revisión de `git diff --check`.
