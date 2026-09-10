# Spec: Soporte multiplataforma del shell

<!-- Nexus: SPEC-NEXUS.md | Module id: cross-platform-support -->

## Objective

Assay debe instalarse y ejecutarse en macOS, Windows y Linux sin que el usuario note qué plataforma fue la primera. El objetivo no es abstraer el sistema operativo, sino aislar los pocos puntos donde Assay lo toca y verificar cada uno en la plataforma real, de forma que una regresión de plataforma falle en CI y no en la máquina de alguien.

macOS es hoy la plataforma verificada. Windows es objetivo de primer orden. Linux es objetivo declarado, con la misma frontera técnica, y se acepta que su verificación llegue después.

## Platform boundary

Assay toca el sistema operativo en diez sitios, y sólo en esos diez. Cualquier código nuevo que necesite un undécimo es una señal de que la frontera se está filtrando. Las tres últimas se añadieron al revisar la paridad en 2026-09-09 y 2026-09-10: no eran fronteras nuevas del producto, eran sitios donde el código asumía macOS sin decirlo, y el último lo pagó una instalación real en Windows con una terminal de fondo que no se podía cerrar.

1. **Escape hatch al escritorio.** Abrir un fichero, un documento o una terminal en la aplicación del sistema, y elegir una carpeta con el selector nativo. `open` y `osascript` en macOS, `cmd /C start` y un `FolderBrowserDialog` de PowerShell en Windows, `xdg-open` y `zenity` en Linux. Cancelar debe ser indistinguible de no elegir nada, aunque el selector de la plataforma lo comunique con un código de salida distinto de cero.
2. **Shell interactiva del PTY.** Fuera de Windows, el `$SHELL` del usuario como sesión de login e interactiva, con `/bin/sh` como reserva cuando no está declarado o no existe; `cmd` en Windows. El PTY en sí es `portable_pty`, ya multiplataforma.

   Esta frontera es hoy **asimétrica, y a propósito**: macOS y Linux entregan la terminal del usuario, mientras Windows entrega `cmd` pelado, sin equivalente de `$SHELL` —que allí no es una convención— y sin `TERM` ni `COLORTERM`, que sólo se declaran en la rama no-Windows. La desigualdad no existía cuando ambas ramas eran igual de mínimas; la introdujo [ADR-0033](../adr/0033-terminal-runs-the-user-shell.md) y se registra aquí para que no se descubra al abrir Assay en Windows. Cerrarla exige decidir antes el intérprete por defecto de esa plataforma, que es una pregunta abierta más abajo.
3. **Ejecución de comandos declarados.** `/bin/sh -lc` frente a `cmd /C`.
4. **Localización del runtime Node del sidecar.** `ADE_SIDECAR_NODE` manda siempre; en su ausencia se prueban ubicaciones conocidas por plataforma y finalmente `PATH`.
5. **Construcción del sidecar.** Rutas temporales, nombre del ejecutable, shims `.cmd` de npm, flags específicos de formato binario y el lanzador de reserva cuando la distribución de Node carece del fuse SEA.

6. **Detección de proveedores agénticos.** Codex y Claude Code se resuelven probando candidatos en orden: la variable de entorno (`ADE_CODEX_COMMAND`, `ADE_CLAUDE_COMMAND`), el comando en el `PATH`, las rutas donde los instaladores los dejan y, en el caso de Codex en macOS, el binario incluido en ChatGPT en último lugar. Un candidato sólo se acepta si existe y este proceso puede ejecutarlo. Esto importa fuera de un terminal: una aplicación abierta desde el escritorio hereda el `PATH` mínimo de launchd, no el del shell, así que un comando desnudo puede ser inalcanzable justo donde el operador lo usa. Cuando ningún candidato sirve, el error nombra todos los que se probaron y la variable con la que forzarlo, en lugar de un `ENOENT` con una sola ruta.

7. **Grafía de rutas en la shell.** Tauri devuelve rutas con el separador de la plataforma, así que ninguna comparación ni troceo puede asumir `/`. La shell las trata con helpers que aceptan ambos separadores; un `split('/')` o un prefijo con barra fija es un defecto, y un test de contrato lo impide.

8. **Comparación de rutas escritas por una persona.** Un operador teclea el separador que lee, y en Windows la ruta en disco lleva el otro. Toda comparación entre lo tecleado y lo que el sistema almacena se hace en una sola grafía —minúsculas y `/`—, no en la del disco. Vale también para los nombres de directorio que la búsqueda salta: Windows los escribe como se crearon.

9. **Borrado de ficheros que otro programa tiene abiertos.** Windows lo impide donde macOS lo permite. Una operación que borra varios ficheros —restaurar un checkpoint— borra los que puede y nombra los que no, en vez de detenerse en el primero y dejar el árbol en un estado que no es ni el de antes ni el de después.

10. **Ventanas de consola en Windows.** Un proceso que Assay ejecuta para sí mismo no debe abrir consola. El binario de la shell declara el subsistema `windows`, pero eso sólo cubre a sí mismo: el sidecar es una copia de `node.exe` con su carga inyectada, así que hereda el subsistema `console` de Node y Windows le da consola propia salvo que quien lo lanza lo diga en el momento del spawn (`CREATE_NO_WINDOW`). Lo mismo vale para cada `cmd.exe` o `powershell.exe` que Assay ejecuta para leer una salida, y para los hijos del sidecar —Git, los CLI de los agentes, los healthchecks, las sondas de toolchain—, que sin `windowsHide` recibirían cada uno la suya. La excepción es deliberada y es el escape hatch: abrir una terminal es una ventana que el operador ha pedido.

Queda además sin resolver la canonización de rutas del workspace en el lado nativo. `WorkspaceRoot::resolve` compara con `starts_with` sobre rutas canónicas, y en Windows la canonización produce prefijos UNC (`\\?\C:\…`). Está descrito en Open Questions porque no puede decidirse sin ejecutar en Windows.

## Verification strategy

La verificación de plataforma no se delega a la intuición ni a la lectura del código: un cambio se considera portable cuando una máquina de esa plataforma lo compila y ejecuta sus tests.

- **CI por matriz.** `windows-latest` y `ubuntu-latest` ejecutan la misma secuencia: instalar dependencias, construir el sidecar, `npm test`, compilar el bundle, `cargo test` y compilar el shell. macOS queda fuera de la matriz deliberadamente: es la plataforma de desarrollo, se verifica en local en cada cambio, y en un repositorio privado su runner se factura al décuplo de las plataformas que la matriz existe para cubrir.
- **Lo que CI cubre y lo que no.** CI demuestra que compila, que los tests pasan y que el script de construcción del sidecar funciona en esa plataforma. No demuestra que la ventana abra, que el PTY se comporte, que el escape hatch haga lo que promete ni que no aparezca una consola que nadie pidió: eso exige un smoke manual por plataforma. La consola de fondo del sidecar es el ejemplo caro de esta distinción — compilaba, pasaba los tests y arruinaba la instalación.
- **Grados de soporte.** Una plataforma es `verificada` cuando su secuencia está verde y existe un smoke manual registrado; `construible` cuando sólo lo está la secuencia; `no verificada` en cualquier otro caso. La documentación debe nombrar el grado, nunca insinuar más.

El gesto de separar una pestaña arrastrándola se apoya en eventos de ratón y se juzga contra el rectángulo de la barra de pestañas, no contra los límites de la ventana, así que no depende de que el sistema siga enrutando el ratón más allá del borde. Está ejercitado en macOS.

Una segunda ejecución de Assay no abre una segunda aplicación: el bloqueo de instancia única entrega la petición a la ventana que ya existe y termina. Dos instancias significaban dos sidecars escribiendo la misma base SQLite.

**Estado a 2026-09-06:** macOS `verificada` (secuencia local verde y aplicación arrancada a mano). Windows y Linux `construibles` (matriz verde el 2026-09-06, sin smoke manual). El PTY en Windows no está cubierto ni siquiera por la matriz.

## Distribution and update

macOS tiene artefacto instalable. `npm run desktop:release` construye el bundle y produce un `.dmg` con `hdiutil` —no con el `bundle_dmg.sh` de Tauri, que falla en este entorno— llevando dentro la aplicación y un enlace a `/Applications`: instalar es arrastrar, no reemplazar un bundle a mano. La versión sale de un único sitio, `desktop/src-tauri/tauri.conf.json`, y de ahí toman su nombre el artefacto y el manifiesto.

Junto al artefacto se escribe `latest.json` con producto, versión, fecha, notas y, por artefacto, plataforma, arquitectura, fichero, tamaño y `sha256`. Es el mismo fichero que la aplicación lee al arrancar para comparar su versión con la publicada.

Assay avisa de que existe una versión más reciente y ahí termina: no descarga, no se reemplaza y no ejecuta nada. Sin conexión, sin publicar o con un manifiesto ilegible se dice como tal y nunca como "al día". El feed por defecto es un asset de release del repositorio. La precedencia es explícita: lo que pida la petición, luego lo que el operador haya configurado en sus preferencias ([ADR-0053](../adr/0053-user-settings-live-in-ades-store.md)), luego `ADE_UPDATE_FEED_URL`, luego el valor por defecto; vacío significa que este install no pregunta a nadie. La decisión vive en [ADR-0050](../adr/0050-installable-artifact-and-update-notice.md).

El artefacto no está firmado ni notarizado; una instalación limpia verá la advertencia de Gatekeeper. Windows y Linux siguen sin artefacto propio: el script lo dice y falla en vez de fingir soporte. Mientras eso sea así, una versión nueva publicada sólo para macOS **no** se anuncia en Windows como actualización disponible: se distingue de un `UPDATE_AVAILABLE` real, porque pedir instalar algo que no existe es una instrucción que nadie puede seguir.

Sobre firma en Windows: el sidecar es una copia de `node.exe`, que el proyecto Node firma, y la inyección del payload invalida esa firma. Una firma rota es peor que ninguna —SmartScreen y los antivirus la leen como manipulación—, así que la construcción **retira** la firma heredada y deja el binario honestamente sin firmar. Firmarlo de verdad exige un certificado de firma de código que este proyecto todavía no tiene; hasta entonces, `bundle.windows.certificateThumbprint` se queda deliberadamente sin declarar en vez de con un valor de mentira. Lo que sí se declara es `webviewInstallMode`, para que el comportamiento sin WebView2 presente sea una decisión y no el defecto implícito de la versión de Tauri instalada.

## Out of scope

Empaquetado firmado y notarizado, instaladores de Windows y Linux (MSI/NSIS, AppImage o paquetes de distribución), actualización automática —descarga y reemplazo del bundle por la propia aplicación—, publicación automatizada de releases, soporte de arquitecturas distintas de x86-64 y ARM64 donde el runner no las ofrezca, y paridad visual pixel a pixel entre sistemas.

Tampoco entra abstraer Git: Assay seguirá invocando el `git` del sistema y exigiendo que esté en `PATH`.

## Acceptance criteria

1. ⏳ Las diez fronteras de plataforma están detrás de `cfg(target_os)` o de una comprobación explícita, sin rutas ni comandos de un sistema concreto en el camino común. Nueve lo están, incluidos el selector de carpetas y la grafía de rutas en la shell; la detección de proveedores sigue asumiendo la ruta de macOS y la canonización nativa sigue abierta.
2. ✅ CI ejecuta la matriz en cada push y su resultado es visible; macOS se verifica en local por la decisión de coste registrada arriba.
3. ✅ `windows-latest` compila el shell, construye el sidecar y pasa los tests Rust y TypeScript, con el test del PTY excluido en esa plataforma.
4. ✅ `ubuntu-latest` hace lo mismo, sin exclusiones.
5. ⏳ Un smoke manual en Windows registra que la ventana abre, la terminal responde y el escape hatch abre fichero y terminal.
6. ⏳ La autorización del workspace se comporta igual en las tres plataformas, incluidos los prefijos UNC de Windows.
7. ✅ La documentación nombra el grado de soporte real de cada plataforma.
8. ✅ macOS produce un artefacto instalable con un comando, con su `sha256` declarado, y la aplicación informa de que existe una versión más reciente sin actualizarse sola.

## Verification

```bash
npm run desktop:sidecar:build
npm test
cargo test --manifest-path desktop/src-tauri/Cargo.toml
npm --prefix desktop run build
npm run desktop:release   # macOS: bundle, .dmg y latest.json
npm run desktop:smoke
```

## Open Questions

- **Canonización de rutas en Windows.** `WorkspaceRoot::resolve` canoniza y compara con `starts_with`. Si `canonicalize` devuelve prefijos UNC de forma inconsistente entre la raíz y el fichero pedido, la comparación puede rechazar rutas legítimas y bloquear el árbol entero. Requiere ejecución real para decidir entre normalizar el prefijo o comparar por componentes.
- **Grafía de rutas entre Git y Node.** `git worktree list` emite rutas con `/` incluso en Windows, mientras Node devuelve `\`. Hoy sólo afecta a la comparación de un test, pero cualquier código futuro que contraste una ruta de Git con una del filesystem chocará con las dos grafías. Queda abierto si `inspectGitWorkspace` debe normalizar su salida a rutas nativas antes de exponerla.
- **Shell por defecto en Windows.** `cmd` es el mínimo común; PowerShell es lo que un desarrollador espera, y desde ADR-0033 es además lo que haría falta para que Windows reciba la misma terminal que macOS y Linux. La forma probable es `pwsh`, luego `powershell`, con `cmd` de reserva, más `TERM`/`COLORTERM` si el intérprete elegido los aprovecha; no se ha implementado porque decidirlo sin poder observar el PTY allí es exactamente lo que esta spec evita. La elección afecta al prompt, al color y a las secuencias que xterm.js recibe. Está enlazada con la anterior: el test del PTY no se ejecuta en Windows porque ConPTY descarta la entrada escrita antes de que el intérprete empiece a leer, y esperar a su prompt exige antes decidir cuál es ese intérprete y qué imprime. El comportamiento del PTY en Windows queda `no verificado`, no asumido.
- **Node como dependencia del sidecar.** El lanzador de reserva asume un Node instalado cuando la distribución carece del fuse SEA. Queda abierto si Windows debe empaquetar su propio runtime en vez de depender de una instalación previa.
- **Linux y WebKitGTK.** Tauri exige `webkit2gtk` y sus dependencias de sistema; queda abierto qué mínimo de distribución se declara soportado.
