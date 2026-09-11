# ADR-0058 — El plugin del workflow se publica bajo MIT

## Status

Accepted

## Date

2026-09-11

## Extends

[ADR-0042](0042-mit-licence-and-english-readme.md), que fijó MIT para Assay. Esta decisión
aplica la misma licencia al componente que [ADR-0057](0057-assay-carries-the-workflow-plugin.md)
incorporó al producto.

## Context

El plugin del workflow se publicó declarando `"license": "UNLICENSED"` y, en su README,
«all rights reserved. Not licensed for redistribution.» No tenía fichero `LICENSE`.

Eso convivía con dos hechos que lo contradecían. El repositorio `seed` es público y existe
precisamente para que cualquiera lo tome, lo instale en su agente y lo modifique. Y desde
ADR-0057 el plugin vive dentro de Assay, que es MIT, y viaja en su bundle: cada `.app`
distribuye una copia de un componente que decía no ser redistribuible.

Un componente bajo licencia más restrictiva que el repositorio que lo contiene es una
contradicción que alguien acaba teniendo que resolver, normalmente en el peor momento
—cuando alguien ya construyó algo encima—. Sale más barato resolverla antes de que nadie
haya confiado en ella.

## Decision

El plugin se publica bajo **MIT**, con el mismo texto y el mismo titular de copyright que
Assay. `LICENSE` la fija, `plugin.json` la declara de forma legible por máquina y el README
dice lo que permite en lugar de lo contrario.

El razonamiento de ADR-0042 se traslada sin cambios: MIT es la licencia que ya usa la mayor
parte del ecosistema en el que esto vive, es corta de leer y no obliga a mantener un
`NOTICE`. Un proyecto de un solo autor que busca contribuciones gana más en fricción baja
que en cobertura de patentes.

La versión pasa a `1.1.0`, no a `1.0.4`. Cambió lo que se puede hacer con el software, y
eso no es una corrección.

## Alternatives Considered

### Mantener `UNLICENSED` y retirar el repositorio público

Coherente, pero contradice la razón por la que el repositorio se publicó: que un
desarrollador pueda tomar la metodología sin adoptar Assay. Cerrarlo para arreglar una
etiqueta sería resolver el síntoma sacrificando el objetivo.

### Apache-2.0

Su cláusula de patentes sigue siendo una ventaja real, y sigue sin compensar aquí. Además
introduciría dos licencias distintas en un mismo árbol de ficheros: el repositorio MIT y un
subdirectorio Apache. Legalmente compatible, innecesariamente confuso.

### Copyleft

Descartado por lo mismo que en ADR-0042, y con más fuerza: un plugin cuyo propósito es
ejecutarse dentro del flujo de trabajo de otra persona no debería imponer condiciones al
código que esa persona escribe con él.

## Consequences

- El plugin puede tomarse, modificarse y redistribuirse conservando el aviso de copyright,
  que es lo que el repositorio público ya invitaba a hacer.
- Assay distribuye el plugin en su bundle sin conflicto de licencias: mismo texto, mismo
  titular, misma licencia que el repositorio.
- **Es irreversible en la práctica.** Las versiones ya publicadas bajo MIT siguen siendo MIT
  para siempre; relicenciar sólo afecta a las futuras, y sólo mientras el titular sea uno
  solo. A partir de la primera contribución externa aceptada, ni siquiera eso.
- `THIRD_PARTY_LICENSES.md` no cambia. El plugin no es de terceros: mismo autor, mismo
  titular de copyright, y ese documento inventaría aquello sobre lo que Assay se construye,
  no lo que Assay es.
