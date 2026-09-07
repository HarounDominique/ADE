# Spec: Soporte multiplataforma del shell

<!-- Nexus: SPEC-NEXUS.md | Module id: cross-platform-support -->

## Objective

Assay debe instalarse y ejecutarse en macOS, Windows y Linux sin que el usuario note qué plataforma fue la primera. El objetivo no es abstraer el sistema operativo, sino aislar los pocos puntos donde Assay lo toca y verificar cada uno en la plataforma real, de forma que una regresión de plataforma falle en CI y no en la máquina de alguien.

macOS es hoy la plataforma verificada. Windows es objetivo de primer orden. Linux es objetivo declarado, con la misma frontera técnica, y se acepta que su verificación llegue después.

## Platform boundary

Assay toca el sistema operativo en siete sitios, y sólo en esos siete. Cualquier código nuevo que necesite un octavo es una señal de que la frontera se está filtrando.

1. **Escape hatch al escritorio.** Abrir un fichero, un documento o una terminal en la aplicación del sistema, y elegir una carpeta con el selector nativo. `open` y `osascript` en macOS, `cmd /C start` y un `FolderBrowserDialog` de PowerShell en Windows, `xdg-open` y `zenity` en Linux. Cancelar debe ser indistinguible de no elegir nada, aunque el selector de la plataforma lo comunique con un código de salida distinto de cero.
2. **Shell interactiva del PTY.** Fuera de Windows, el `$SHELL` del usuario como sesión de login e interactiva, con `/bin/sh` como reserva cuando no está declarado o no existe; `cmd` en Windows. El PTY en sí es `portable_pty`, ya multiplataforma.
3. **Ejecución de comandos declarados.** `/bin/sh -lc` frente a `cmd /C`.
4. **Localización del runtime Node del sidecar.** `ADE_SIDECAR_NODE` manda siempre; en su ausencia se prueban ubicaciones conocidas por plataforma y finalmente `PATH`.
5. **Construcción del sidecar.** Rutas temporales, nombre del ejecutable, shims `.cmd` de npm, flags específicos de formato binario y el lanzador de reserva cuando la distribución de Node carece del fuse SEA.

6. **Detección de proveedores agénticos.** Codex se localiza hoy mediante el binario incluido en ChatGPT para macOS o `ADE_CODEX_COMMAND`, según [SPEC-agent-providers](SPEC-agent-providers.md#availability-and-selection). La variable de entorno es ya el camino portable; la ruta por defecto no lo es y necesita su equivalente por plataforma.

7. **Grafía de rutas en la shell.** Tauri devuelve rutas con el separador de la plataforma, así que ninguna comparación ni troceo puede asumir `/`. La shell las trata con helpers que aceptan ambos separadores; un `split('/')` o un prefijo con barra fija es un defecto, y un test de contrato lo impide.

Queda además sin resolver la canonización de rutas del workspace en el lado nativo. `WorkspaceRoot::resolve` compara con `starts_with` sobre rutas canónicas, y en Windows la canonización produce prefijos UNC (`\\?\C:\…`). Está descrito en Open Questions porque no puede decidirse sin ejecutar en Windows.

## Verification strategy

La verificación de plataforma no se delega a la intuición ni a la lectura del código: un cambio se considera portable cuando una máquina de esa plataforma lo compila y ejecuta sus tests.

- **CI por matriz.** `windows-latest` y `ubuntu-latest` ejecutan la misma secuencia: instalar dependencias, construir el sidecar, `npm test`, compilar el bundle, `cargo test` y compilar el shell. macOS queda fuera de la matriz deliberadamente: es la plataforma de desarrollo, se verifica en local en cada cambio, y en un repositorio privado su runner se factura al décuplo de las plataformas que la matriz existe para cubrir.
- **Lo que CI cubre y lo que no.** CI demuestra que compila, que los tests pasan y que el script de construcción del sidecar funciona en esa plataforma. No demuestra que la ventana abra, que el PTY se comporte ni que el escape hatch haga lo que promete: eso exige un smoke manual por plataforma.
- **Grados de soporte.** Una plataforma es `verificada` cuando su secuencia está verde y existe un smoke manual registrado; `construible` cuando sólo lo está la secuencia; `no verificada` en cualquier otro caso. La documentación debe nombrar el grado, nunca insinuar más.

**Estado a 2026-09-06:** macOS `verificada` (secuencia local verde y aplicación arrancada a mano). Windows y Linux `construibles` (matriz verde el 2026-09-06, sin smoke manual). El PTY en Windows no está cubierto ni siquiera por la matriz.

## Out of scope

Empaquetado firmado y distribución por plataforma (`.dmg`, instalador MSI/NSIS, AppImage o paquetes de distribución), instaladores automáticos, actualización remota, soporte de arquitecturas distintas de x86-64 y ARM64 donde el runner no las ofrezca, y paridad visual pixel a pixel entre sistemas.

Tampoco entra abstraer Git: Assay seguirá invocando el `git` del sistema y exigiendo que esté en `PATH`.

## Acceptance criteria

1. ⏳ Las siete fronteras de plataforma están detrás de `cfg(target_os)` o de una comprobación explícita, sin rutas ni comandos de un sistema concreto en el camino común. Seis lo están, incluidos el selector de carpetas y la grafía de rutas en la shell; la detección de proveedores sigue asumiendo la ruta de macOS y la canonización nativa sigue abierta.
2. ✅ CI ejecuta la matriz en cada push y su resultado es visible; macOS se verifica en local por la decisión de coste registrada arriba.
3. ✅ `windows-latest` compila el shell, construye el sidecar y pasa los tests Rust y TypeScript, con el test del PTY excluido en esa plataforma.
4. ✅ `ubuntu-latest` hace lo mismo, sin exclusiones.
5. ⏳ Un smoke manual en Windows registra que la ventana abre, la terminal responde y el escape hatch abre fichero y terminal.
6. ⏳ La autorización del workspace se comporta igual en las tres plataformas, incluidos los prefijos UNC de Windows.
7. ✅ La documentación nombra el grado de soporte real de cada plataforma.

## Verification

```bash
npm run desktop:sidecar:build
npm test
cargo test --manifest-path desktop/src-tauri/Cargo.toml
npm --prefix desktop run build
```

## Open Questions

- **Canonización de rutas en Windows.** `WorkspaceRoot::resolve` canoniza y compara con `starts_with`. Si `canonicalize` devuelve prefijos UNC de forma inconsistente entre la raíz y el fichero pedido, la comparación puede rechazar rutas legítimas y bloquear el árbol entero. Requiere ejecución real para decidir entre normalizar el prefijo o comparar por componentes.
- **Grafía de rutas entre Git y Node.** `git worktree list` emite rutas con `/` incluso en Windows, mientras Node devuelve `\`. Hoy sólo afecta a la comparación de un test, pero cualquier código futuro que contraste una ruta de Git con una del filesystem chocará con las dos grafías. Queda abierto si `inspectGitWorkspace` debe normalizar su salida a rutas nativas antes de exponerla.
- **Shell por defecto en Windows.** `cmd` es el mínimo común; PowerShell es lo que un desarrollador espera. La elección afecta al prompt, al color y a las secuencias que xterm.js recibe. Está enlazada con la anterior: el test del PTY no se ejecuta en Windows porque ConPTY descarta la entrada escrita antes de que el intérprete empiece a leer, y esperar a su prompt exige antes decidir cuál es ese intérprete y qué imprime. El comportamiento del PTY en Windows queda `no verificado`, no asumido.
- **Node como dependencia del sidecar.** El lanzador de reserva asume un Node instalado cuando la distribución carece del fuse SEA. Queda abierto si Windows debe empaquetar su propio runtime en vez de depender de una instalación previa.
- **Linux y WebKitGTK.** Tauri exige `webkit2gtk` y sus dependencias de sistema; queda abierto qué mínimo de distribución se declara soportado.
