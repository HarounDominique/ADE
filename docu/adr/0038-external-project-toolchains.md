# ADR-0038 — Orquestar toolchains del Project sin empaquetar compiladores

## Status

Accepted

## Date

2026-09-08

## Context

ADE necesita ayudar a ejecutar build, test y lint en los lenguajes que ya puede editar. El shell conoce el Project, dispone de un supervisor local de procesos y ya expone configuraciones de ejecución, pero no debe convertirse en una distribución de compiladores ni imponer versiones de runtime.

## Decision

ADE detectará los manifiestos y scripts que el repositorio ya declara y propondrá configuraciones ejecutables para build, test, lint y, cuando sea inequívoco, run. Las propuestas no escriben archivos ni ejecutan comandos: el operador las acepta desde la UI y pueden guardarse en `.ade/run.json`.

La ejecución delega en el toolchain local del Project (`npm`, `python`, `mvn`, `gradle`, `cargo`, `go`, `dotnet`, etc.). ADE muestra el comando, cwd, estado y salida en el dock de terminal mediante el contrato existente de `run-configurations` y `local-runtime`.

## Alternatives considered

### Empaquetar compiladores y runtimes en ADE

- **Ventaja:** experiencia uniforme sin instalación previa.
- **Rechazo:** aumenta mucho el tamaño del producto, duplica gestión de versiones y licencias, y puede ejecutar una versión distinta de la que el repositorio declara.

### Inferir comandos recorriendo todo el repositorio

- **Ventaja:** detectaría más proyectos anidados.
- **Rechazo:** introduce ruido, puede entrar en dependencias o artefactos generados y propone comandos con una confianza difícil de explicar. El primer corte limita la detección a la raíz y sus subdirectorios inmediatos, igual que la detección de ejecución actual.

### Ejecutar automáticamente todo lo detectado

- **Ventaja:** feedback inmediato.
- **Rechazo:** una detección no es autorización. Los comandos quedan como propuestas revisables y requieren una acción explícita del operador.

## Consequences

- ADE funciona con el entorno que el Project ya necesita y respeta sus wrappers cuando existen.
- Los repositorios sin un toolchain instalado reciben un fallo accionable en la consola, no una instalación implícita.
- Las propuestas pueden quedar incompletas cuando el build depende de convenciones no declaradas; el usuario siempre puede crear una configuración manual.
- La detección de C/C++ y otros sistemas no declarativos queda separada hasta disponer de una estrategia segura para CMake, Make y generadores equivalentes.
