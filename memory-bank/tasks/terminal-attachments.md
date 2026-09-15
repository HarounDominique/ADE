---
slug: terminal-attachments
spec: docu/specs/SPEC-terminal-attachments.md
status: ready_to_archive
---

## Implementation Roadmap

## Technical Plan

1. Extraer y probar una normalización común de rutas y quoting POSIX/Windows.
2. Conectar `drop` al terminal PTY sin alterar las tabs `run` de solo salida.
3. Añadir referencias pendientes al composer y traducirlas al contrato común de prompt.
4. Cerrar con revisión de seguridad, matriz de plataformas y smoke manual.

- [x] Phase 1 — Contrato de drop, normalización y quoting multiplataforma. Resolver
  ficheros locales en cualquier ubicación, rechazar carpetas o tipos según decisión final
  y cubrir POSIX/Windows con tests puros.
- [x] Phase 2 — Drop en terminal PTY. Añadir target visual y accesible, inyectar la ruta
  mediante `terminal_input`, mantener intacta la consola `run` y cubrir el ciclo sin
  ejecución automática.
- [x] Phase 3 — Drop en Agents. Añadir chips de referencias al composer, envío explícito
  y preservación ante errores; mantener el contrato común para Claude Code, Codex y
  OpenCode.
- [x] Phase 4 — Revisión de seguridad, multiplataformidad y smoke manual. Verificar
  rutas con espacios/unicode, fuera de raíz, imagen/PDF/código y documentación de shell.

## Execution State

**Build Status**: PASSED
**Current Phase**: 4
**Current Step**: 6/6
**Step Attempts**: {1: 1, 2: 1, 3: 1, 4: 1}
**Last Block Rule**: none
**Can Resume**: YES

## Confirmed Decisions

- En terminal el drop inserta una ruta shell-quoted; no ejecuta nada.
- En Agents el drop crea una referencia local visible; no sube ni copia el fichero.
- El alcance inicial son ficheros de cualquier ubicación local de la máquina, no carpetas.
