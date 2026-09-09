# ADR-0042 — Licencia MIT y README en inglés

## Status

Accepted

## Date

2026-09-09

## Context

El repositorio no declaraba licencia. Sin fichero de licencia, el trabajo es legalmente «todos los derechos reservados»: nadie puede empaquetarlo, redistribuirlo ni contribuir sin riesgo, y ninguna distribución puede empaquetar la aplicación. Es lo primero que mira quien llega al repositorio, y su ausencia bloquea cualquier acercamiento a la comunidad open source antes de que empiece la discusión técnica.

El README, la puerta de entrada, estaba en español. Los comentarios de código, los mensajes de commit y los identificadores ya están en inglés, de modo que el idioma de la puerta era la incoherencia, no el interior.

Assay se construye enteramente sobre trabajo ajeno con licencias permisivas —Tauri, portable-pty, serde, CodeMirror, Monaco, xterm.js, Prettier, markdown-it, esbuild, TypeScript, tsx, cross-spawn, postject y Node— y llama a herramientas externas que nunca redistribuye: Git, los toolchains del Project, los CLIs de agente y ASK. Ese inventario existía sólo para la shell y en español.

## Decision

Assay se publica bajo licencia MIT. `LICENSE` la fija en la raíz y los tres manifiestos la declaran de forma legible por máquina: `package.json`, `desktop/package.json` y `desktop/src-tauri/Cargo.toml`.

MIT es compatible con todas las dependencias directas verificadas en este árbol: MIT, Apache-2.0 o el doble licenciamiento `MIT OR Apache-2.0`. Ninguna dependencia directa impone copyleft, y Git —GPL— se invoca como programa externo, nunca se enlaza ni se redistribuye.

El README pasa a inglés y añade tres secciones que antes no existían: los módulos de spec que componen ADE, citados uno a uno con su contrato; el inventario de aquello sobre lo que se construye, con su licencia; y una sección de huecos conocidos que enlaza la auditoría en lugar de dejar que el README prometa un bucle que todavía no cierra.

`desktop/THIRD_PARTY_LICENSES.md` pasa a inglés y deja de cubrir sólo el editor: ahora inventaría las dependencias directas de los tres manifiestos con versión resuelta y licencia publicada, y separa lo que Assay distribuye de lo que sólo invoca.

## Alternatives Considered

### Apache-2.0

Descartado para esta iteración. Su cláusula de patentes es una ventaja real, pero MIT es la licencia que la mayoría del ecosistema en el que Assay vive ya usa, es más corta de leer y no obliga a mantener un `NOTICE`. Un proyecto de un solo autor que busca contribuciones gana más en fricción baja que en cobertura de patentes.

### Copyleft (GPL-3.0 o AGPL-3.0)

Descartado: obligaría a cualquier integrador a abrir su propio producto y cierra la puerta al uso dentro de herramientas internas, que es justo donde una workstation de este tipo se prueba. No hay aquí un servicio de red que proteger.

### Esperar a que el bucle cierre antes de licenciar

Rechazado: la licencia no afirma madurez, sólo permiso. Retenerla mantiene el repositorio inservible para terceros sin mejorar nada, y la honestidad sobre el estado se resuelve documentando los huecos, que es lo que hace la sección nueva del README.

### Mantener el README en español y traducir sólo un resumen

Rechazado: una puerta de entrada duplicada se desincroniza. El español sigue siendo el idioma de las specs y los ADRs, donde el autor razona; el inglés es el de la puerta.

## Consequences

- El repositorio puede empaquetarse, redistribuirse y recibir contribuciones sin ambigüedad legal.
- Cualquiera puede verificar en un minuto que la licencia declarada es compatible con lo que el árbol instala.
- El README dice lo que Assay es, de qué módulos se compone, sobre qué se apoya y qué no cumple todavía.
- Las specs y los ADRs siguen en español: quien contribuya al núcleo se encontrará con esa frontera, y cerrarla es una decisión posterior que este ADR no toma.
- Antes de distribuir un binario habrá que generar el aviso transitivo completo desde los tres lockfiles; el inventario directo no lo sustituye.
