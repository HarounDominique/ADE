# ADR-0061: Postura comunitaria open source

## Status

Accepted

## Date

2026-09-15

## Contexto

ADE ha alcanzado un MVP suficientemente operable para abrirse a la comunidad.
La licencia MIT ya permite usar, modificar y redistribuir el proyecto, pero la
documentación todavía no expresa qué relación desea mantener el proyecto con
forks, continuaciones independientes y contribuciones al repositorio troncal.

También conviene hacer explícito que la arquitectura modular no sólo divide el
código: permite que personas o grupos se conviertan en mantenedores de hecho
de un módulo, como el gestor de base de datos, y lo mejoren de forma sostenida.

## Decisión

Publicar una [carta fundacional](../FOUNDING-CHARTER.md) que:

- distinga ADE como nombre del proyecto y Assay como nombre del producto;
- invite explícitamente a clonar, hacer fork o continuar el proyecto por otro
  cauce;
- anime a devolver al repositorio principal las mejoras que puedan beneficiar a
  la comunidad;
- presente los módulos como áreas abiertas a stewardship y evolución
  continuada;
- establezca colaboración respetuosa, cambios trazables y límites honestos
  sobre lo que el software verifica.

La carta expresa intención y valores. Las reglas operativas se repartirán entre
la licencia, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, las specs
y los ADRs.

## Alternativas consideradas

### No documentar una postura comunitaria

Rechazada: deja ambiguo si los forks se consideran competencia, si se esperan
contribuciones upstream y quién puede cuidar módulos concretos.

### Exigir que todo desarrollo vuelva al repositorio principal

Rechazada: sería incoherente con la libertad que concede MIT y con una
comunidad abierta. La colaboración upstream debe ser deseable y fácil, no una
condición para continuar el trabajo.

### Crear un modelo formal de gobernanza desde el primer día

Pospuesto: el MVP necesita una invitación clara y un proceso mínimo antes que
roles, comités o una estructura pesada. La gobernanza podrá evolucionar cuando
la comunidad genere necesidades reales.

## Consecuencias

- La apertura del proyecto incluye tanto colaboración upstream como libertad
  para crear forks y continuaciones independientes.
- Los módulos pueden atraer responsables con continuidad sin convertirlos en
  propietarios exclusivos del código.
- Los maintainers conservan la responsabilidad de proteger coherencia,
  calidad y límites de la release.
- La carta deberá evolucionar si la comunidad adopta un modelo de gobernanza
  más formal.
