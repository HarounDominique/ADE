use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use serde::Serialize;
use std::collections::HashMap;
use std::io::{BufRead, BufReader, Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use tauri::{Emitter, Manager};
use tauri_plugin_dialog::DialogExt;

#[derive(Default)]
struct SidecarSupervisor {
    child: Mutex<Option<Child>>,
}

struct TerminalProcess {
    child: Box<dyn portable_pty::Child + Send + Sync>,
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
}

#[derive(Default)]
struct TerminalSupervisor {
    processes: Mutex<HashMap<String, TerminalProcess>>,
}

#[derive(Clone, Serialize)]
struct TerminalOutput {
    session_id: String,
    data: String,
}

#[derive(Default)]
struct WorkspaceRoot {
    root: Mutex<Option<PathBuf>>,
}

impl WorkspaceRoot {
    fn select(&self, repository_path: &str) -> Result<PathBuf, String> {
        let repository = Path::new(repository_path);
        if !repository.is_dir() {
            return Err(format!("Repository does not exist: {repository_path}"));
        }
        let canonical = normalize_windows_path(repository
            .canonicalize()
            .map_err(|error| format!("Unable to resolve Project root: {error}"))?);
        *self
            .root
            .lock()
            .map_err(|_| "Workspace root state is poisoned".to_string())? = Some(canonical.clone());
        Ok(canonical)
    }

    fn resolve(&self, requested_path: &str) -> Result<PathBuf, String> {
        let root = self
            .root
            .lock()
            .map_err(|_| "Workspace root state is poisoned".to_string())?
            .clone()
            .ok_or_else(|| "Select a Project before accessing its workspace".to_string())?;
        let candidate = normalize_windows_path(Path::new(requested_path)
            .canonicalize()
            .map_err(|error| format!("Unable to resolve workspace path: {error}"))?);
        if !candidate.starts_with(&root) {
            return Err("Workspace path is outside the selected Project".to_string());
        }
        Ok(candidate)
    }
}

/// Windows APIs may return the extended-length `\\?\` spelling from
/// canonicalize(), while a path supplied by the frontend uses the regular
/// drive spelling. Strip only that transparent prefix before comparing paths;
/// UNC paths retain their `\\server\share` identity.
fn normalize_windows_path(path: PathBuf) -> PathBuf {
    #[cfg(target_os = "windows")]
    {
        let value = path.to_string_lossy();
        if let Some(rest) = value.strip_prefix(r"\\?\UNC\") {
            return PathBuf::from(format!(r"\\{}", rest));
        }
        if let Some(rest) = value.strip_prefix(r"\\?\") {
            return PathBuf::from(rest);
        }
    }
    path
}

#[tauri::command]
fn terminal_start(
    app: tauri::AppHandle,
    state: tauri::State<'_, TerminalSupervisor>,
    workspace: tauri::State<'_, WorkspaceRoot>,
    session_id: String,
    cwd: String,
) -> Result<(), String> {
    terminal_start_in(&app, &state, &workspace, &session_id, &cwd)
}

fn terminal_start_in(
    app: &tauri::AppHandle,
    state: &TerminalSupervisor,
    workspace: &WorkspaceRoot,
    session_id: &str,
    cwd: &str,
) -> Result<(), String> {
    if session_id.trim().is_empty() {
        return Err("Terminal session id cannot be empty".to_string());
    }
    let cwd = workspace.resolve(cwd)?;
    if !cwd.is_dir() {
        return Err(format!("Terminal cwd does not exist: {}", cwd.display()));
    }
    let (process, mut reader) = start_terminal_pty(&cwd)?;
    let output_app = app.clone();
    let output_session_id = session_id.to_string();
    std::thread::spawn(move || {
        let mut bytes = [0u8; 4096];
        loop {
            match reader.read(&mut bytes) {
                Ok(0) | Err(_) => break,
                Ok(size) => {
                    let _ = output_app.emit(
                        "terminal:output",
                        TerminalOutput {
                            session_id: output_session_id.clone(),
                            data: String::from_utf8_lossy(&bytes[..size]).into_owned(),
                        },
                    );
                }
            }
        }
    });
    let mut processes = state
        .processes
        .lock()
        .map_err(|_| "Terminal state is poisoned".to_string())?;
    if processes.contains_key(session_id) {
        let mut process = process;
        let _ = process.child.kill();
        let _ = process.child.wait();
        return Err(format!("Terminal session already exists: {session_id}"));
    }
    processes.insert(session_id.to_string(), process);
    Ok(())
}

/// The escape hatch is the one place ADE hands a path to the host desktop, and
/// each platform names that handoff differently.  Keeping it here means the
/// callers stay about authorization, not about which OS is running.
/// A process Assay runs for itself must not open a console window. The shell
/// binary declares the windows subsystem, but that covers only itself: the
/// sidecar is a copy of `node.exe` with a payload injected, and `node.exe` is
/// built as a console application, so Windows gives it a console of its own
/// unless the parent says otherwise at spawn time. The same is true of every
/// `cmd.exe` and `powershell.exe` Assay runs to read something back.
///
/// This is deliberately not applied to the escape hatch: opening a terminal is
/// a window the operator asked for.
#[cfg(target_os = "windows")]
fn without_a_console(command: &mut Command) -> &mut Command {
    use std::os::windows::process::CommandExt;
    // `CREATE_NO_WINDOW`: run the child with no console at all, rather than
    // with one that is merely hidden.
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    command.creation_flags(CREATE_NO_WINDOW)
}

#[cfg(not(target_os = "windows"))]
fn without_a_console(command: &mut Command) -> &mut Command {
    command
}

fn open_with_desktop(path: &Path, what: &str) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    let spawned = Command::new("open").arg(path).spawn();
    #[cfg(target_os = "windows")]
    let spawned = without_a_console(&mut Command::new(
        std::env::var("ComSpec").unwrap_or_else(|_| "cmd.exe".to_string()),
    ))
        .args(["/C", "start", ""])
        .arg(path)
        .spawn();
    #[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
    let spawned = Command::new("xdg-open").arg(path).spawn();
    spawned
        .map(|_| ())
        .map_err(|error| format!("Unable to open {what}: {error}"))
}

/// A run's own address is the only thing this opens. The URL is composed by the
/// shell from a port the Project declared, so anything that is not loopback http
/// is a bug or an injection and is refused rather than handed to the desktop.
fn open_local_url(url: &str) -> Result<(), String> {
    let rest = url
        .strip_prefix("http://")
        .or_else(|| url.strip_prefix("https://"))
        .ok_or_else(|| "Only http and https addresses can be opened".to_string())?;
    let authority = rest.split('/').next().unwrap_or_default();
    let host = authority.rsplit_once(':').map_or(authority, |(host, _)| host);
    if !matches!(host, "localhost" | "127.0.0.1" | "[::1]") {
        return Err(format!("Only a local address can be opened: {host}"));
    }
    #[cfg(target_os = "macos")]
    let spawned = Command::new("open").arg(url).spawn();
    #[cfg(target_os = "windows")]
    let spawned = without_a_console(&mut Command::new(
        std::env::var("ComSpec").unwrap_or_else(|_| "cmd.exe".to_string()),
    ))
        .args(["/C", "start", ""])
        .arg(url)
        .spawn();
    #[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
    let spawned = Command::new("xdg-open").arg(url).spawn();
    spawned
        .map(|_| ())
        .map_err(|error| format!("Unable to open the running application: {error}"))
}

#[tauri::command]
fn open_run_url(url: String) -> Result<(), String> {
    open_local_url(&url)
}

/// Opening a terminal *at* a directory has no portable spelling: macOS targets
/// Terminal.app by name, Windows starts a shell whose cwd is the directory.
fn open_terminal_at(directory: &Path) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    let spawned = Command::new("open")
        .args(["-a", "Terminal"])
        .arg(directory)
        .spawn();
    #[cfg(target_os = "windows")]
    let spawned = Command::new(std::env::var("ComSpec").unwrap_or_else(|_| "cmd.exe".to_string()))
        .args(["/C", "start", "", "cmd", "/K", "cd", "/D"])
        .arg(directory)
        .spawn();
    #[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
    let spawned = spawn_linux_terminal(directory);
    spawned
        .map(|_| ())
        .map_err(|error| format!("Unable to open Terminal: {error}"))
}

/// Linux has no one terminal the way macOS has Terminal.app: `x-terminal-emulator`
/// is only Debian and Ubuntu's own `update-alternatives` convention, absent on
/// Fedora, Arch, openSUSE and any minimal install that never registered one.
/// `$TERMINAL` is the closer thing to a standard -- set by several window
/// managers and by operators themselves -- so it is tried first, then the
/// Debian convention, then the emulators actually shipped by the desktops ADE
/// is likely to run under. Every one of them starts its shell in its own
/// process's working directory when given no other instruction, so a single
/// `current_dir` covers all of them without per-terminal argument spellings.
#[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
fn spawn_linux_terminal(directory: &Path) -> std::io::Result<Child> {
    let mut candidates: Vec<String> = std::env::var("TERMINAL")
        .ok()
        .filter(|value| !value.trim().is_empty())
        .into_iter()
        .collect();
    candidates.extend(
        [
            "x-terminal-emulator",
            "gnome-terminal",
            "konsole",
            "xfce4-terminal",
            "tilix",
            "terminator",
            "kitty",
            "alacritty",
            "mate-terminal",
            "lxterminal",
            "deepin-terminal",
            "xterm",
        ]
        .map(str::to_string),
    );
    let mut last_error = std::io::Error::new(
        std::io::ErrorKind::NotFound,
        "no terminal emulator found among $TERMINAL, x-terminal-emulator or the common desktop terminals",
    );
    for candidate in candidates {
        match Command::new(&candidate).current_dir(directory).spawn() {
            Ok(child) => return Ok(child),
            Err(error) => last_error = error,
        }
    }
    Err(last_error)
}

fn start_terminal_pty(cwd: &Path) -> Result<(TerminalProcess, Box<dyn Read + Send>), String> {
    let pty = native_pty_system();
    let pair = pty
        .openpty(PtySize {
            rows: 24,
            cols: 120,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|error| format!("Unable to allocate terminal PTY: {error}"))?;
    let mut shell = if cfg!(target_os = "windows") {
        // The terminal UI and project commands use common Unix spellings such
        // as `pwd` and `ls`. PowerShell provides them as built-in aliases,
        // whereas cmd.exe rejects both and makes the integrated terminal look
        // broken on a fresh Windows machine.
        let mut command = CommandBuilder::new(
            std::env::var("ADE_POWERSHELL_COMMAND")
                .unwrap_or_else(|_| "powershell.exe".to_string()),
        );
        command.arg("-NoLogo");
        command
    } else {
        // The operator's own shell, as a login and interactive session, so their
        // prompt, aliases and colours are the ones they already know. A minimal
        // `/bin/sh` was deliberate once, but it also meant the terminal never
        // looked or behaved like the one they use everywhere else -- and login
        // is what gives it their real PATH when the app starts from Finder.
        let login = std::env::var("SHELL")
            .ok()
            .filter(|value| !value.trim().is_empty() && Path::new(value).is_file())
            .unwrap_or_else(|| "/bin/sh".to_string());
        let mut command = CommandBuilder::new(&login);
        command.arg("-l");
        command.arg("-i");
        // Only a shell with no configuration of its own needs a prompt from us.
        if login == "/bin/sh" {
            command.env("PS1", "$ ");
            command.env("PS2", "> ");
        }
        command.env("TERM", "xterm-256color");
        command.env("COLORTERM", "truecolor");
        command
    };
    shell.cwd(&cwd);
    let child = pair
        .slave
        .spawn_command(shell)
        .map_err(|error| format!("Unable to start terminal: {error}"))?;
    let reader = pair
        .master
        .try_clone_reader()
        .map_err(|error| format!("Terminal PTY reader unavailable: {error}"))?;
    let writer = pair
        .master
        .take_writer()
        .map_err(|error| format!("Terminal PTY writer unavailable: {error}"))?;
    Ok((
        TerminalProcess {
            child,
            master: pair.master,
            writer,
        },
        reader,
    ))
}

#[tauri::command]
fn terminal_input(
    state: tauri::State<'_, TerminalSupervisor>,
    session_id: String,
    input: String,
) -> Result<(), String> {
    use std::io::Write;
    let mut processes = state
        .processes
        .lock()
        .map_err(|_| "Terminal state is poisoned".to_string())?;
    let process = processes
        .get_mut(&session_id)
        .ok_or_else(|| format!("Terminal session is not running: {session_id}"))?;
    process
        .writer
        .write_all(input.as_bytes())
        .and_then(|_| process.writer.flush())
        .map_err(|error| format!("Unable to write terminal input: {error}"))
}

#[tauri::command]
fn terminal_resize(
    state: tauri::State<'_, TerminalSupervisor>,
    session_id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    if cols == 0 || rows == 0 {
        return Err("Terminal dimensions must be positive".to_string());
    }
    let processes = state
        .processes
        .lock()
        .map_err(|_| "Terminal state is poisoned".to_string())?;
    let process = processes
        .get(&session_id)
        .ok_or_else(|| format!("Terminal session is not running: {session_id}"))?;
    process
        .master
        .resize(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|error| format!("Unable to resize terminal: {error}"))
}

fn terminal_stop_session(state: &TerminalSupervisor, session_id: &str) -> Result<(), String> {
    let mut processes = state
        .processes
        .lock()
        .map_err(|_| "Terminal state is poisoned".to_string())?;
    if let Some(mut process) = processes.remove(session_id) {
        let _ = process.child.kill();
        let _ = process.child.wait();
    }
    Ok(())
}

#[tauri::command]
fn terminal_stop(
    session_id: String,
    state: tauri::State<'_, TerminalSupervisor>,
) -> Result<(), String> {
    terminal_stop_session(&state, &session_id)
}

#[tauri::command]
fn terminal_stop_all(state: tauri::State<'_, TerminalSupervisor>) -> Result<(), String> {
    let mut processes = state
        .processes
        .lock()
        .map_err(|_| "Terminal state is poisoned".to_string())?;
    for (_, mut process) in processes.drain() {
        let _ = process.child.kill();
        let _ = process.child.wait();
    }
    Ok(())
}

impl SidecarSupervisor {
    fn reap_finished(&self) -> Result<bool, String> {
        let mut child = self
            .child
            .lock()
            .map_err(|_| "Sidecar state is poisoned".to_string())?;
        if let Some(process) = child.as_mut() {
            if process
                .try_wait()
                .map_err(|error| error.to_string())?
                .is_some()
            {
                *child = None;
            }
        }
        Ok(child.is_some())
    }

    fn stop(&self) -> Result<(), String> {
        let mut child = self
            .child
            .lock()
            .map_err(|_| "Sidecar state is poisoned".to_string())?;
        if let Some(mut process) = child.take() {
            if process
                .try_wait()
                .map_err(|error| format!("Unable to inspect sidecar: {error}"))?
                .is_none()
            {
                process
                    .kill()
                    .map_err(|error| format!("Unable to stop sidecar: {error}"))?;
            }
            process
                .wait()
                .map_err(|error| format!("Unable to reap sidecar: {error}"))?;
        }
        Ok(())
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ProjectContext {
    name: String,
    repository_path: String,
    branch: String,
    version_control: String,
    working_tree: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DirectoryEntry {
    name: String,
    path: String,
    kind: String,
    depth: usize,
}

const MAX_FILE_PREVIEW_BYTES: u64 = 2 * 1024 * 1024;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct FileReadResult {
    path: String,
    relative_path: String,
    name: String,
    kind: String,
    size: u64,
    content: Option<String>,
    message: Option<String>,
}

#[tauri::command]
fn list_directory(
    workspace: tauri::State<'_, WorkspaceRoot>,
    path: String,
    max_depth: Option<usize>,
) -> Result<Vec<DirectoryEntry>, String> {
    list_directory_in(&workspace, &path, max_depth)
}

#[tauri::command]
async fn search_directory(
    workspace: tauri::State<'_, WorkspaceRoot>,
    path: String,
    query: String,
) -> Result<Vec<DirectoryEntry>, String> {
    let root = workspace.resolve(&path)?;
    if !root.is_dir() {
        return Err(format!("Directory does not exist: {}", root.display()));
    }
    let needle = query.trim().to_lowercase();
    tauri::async_runtime::spawn_blocking(move || search_directory_from_root(root, needle))
        .await
        .map_err(|error| format!("Unable to search workspace: {error}"))?
}

fn list_directory_in(
    workspace: &WorkspaceRoot,
    path: &str,
    max_depth: Option<usize>,
) -> Result<Vec<DirectoryEntry>, String> {
    let root = workspace.resolve(path)?;
    if !root.is_dir() {
        return Err(format!("Directory does not exist: {}", root.display()));
    }
    let mut entries = Vec::new();
    collect_directory(&root, 0, max_depth.unwrap_or(1), &mut entries)?;
    Ok(entries)
}

fn collect_directory(
    root: &Path,
    depth: usize,
    max_depth: usize,
    entries: &mut Vec<DirectoryEntry>,
) -> Result<(), String> {
    let mut children = std::fs::read_dir(root)
        .map_err(|error| format!("Unable to read directory: {error}"))?
        .filter_map(Result::ok)
        .collect::<Vec<_>>();
    children.sort_by_key(|entry| entry.file_name().to_string_lossy().to_lowercase());
    children.sort_by_key(|entry| {
        std::cmp::Reverse(entry.file_type().map(|kind| kind.is_dir()).unwrap_or(false))
    });
    for entry in children {
        let entry_path = entry.path();
        let file_type = entry.file_type().map_err(|error| error.to_string())?;
        let kind = if file_type.is_dir() {
            "directory"
        } else if file_type.is_symlink() {
            "symlink"
        } else {
            "file"
        };
        entries.push(DirectoryEntry {
            name: entry.file_name().to_string_lossy().into_owned(),
            path: entry_path.clone().to_string_lossy().into_owned(),
            kind: kind.to_string(),
            depth,
        });
        if file_type.is_dir() && depth < max_depth {
            collect_directory(&entry_path, depth + 1, max_depth, entries)?;
        }
    }
    Ok(())
}

#[cfg(test)]
fn search_directory_in(
    workspace: &WorkspaceRoot,
    path: &str,
    query: &str,
) -> Result<Vec<DirectoryEntry>, String> {
    let root = workspace.resolve(path)?;
    if !root.is_dir() {
        return Err(format!("Directory does not exist: {}", root.display()));
    }
    search_directory_from_root(root, query.trim().to_lowercase())
}

/// What a file search must never spend itself on. `.git` is Git's own storage
/// and `node_modules` is a dependency tree: neither holds a file the operator
/// opens to edit, and in this very repository they are 63,733 of the 64,574
/// files on disk. Walking them made a one-letter query answer with tens of
/// thousands of matches, which the tree then tried to draw.
const UNSEARCHED_DIRECTORIES: [&str; 2] = [".git", "node_modules"];

/// Enough matches to choose from, few enough to draw. A query that reaches it
/// says so rather than pretending it found everything there was.
const SEARCH_RESULT_LIMIT: usize = 200;

/// One spelling for both sides of a comparison: lowercase, and separators the
/// way the operator types them rather than the way the platform stores them.
fn forward_slashed(value: &str) -> String {
    value.to_lowercase().replace('\\', "/")
}

/// What the operator's own repository says its files are: tracked, plus
/// untracked that nothing ignores. It is one process and it needs no guesses —
/// `target`, `dist`, a virtualenv, whatever this project builds into — because
/// the rules are the ones already written in the repository.
///
/// Walking instead was the defect: skipping `.git` and `node_modules` left
/// 62,797 files here, of which 59,266 were the Rust build directory, and each
/// keystroke walked all of them. Git answers the same question in 19ms.
fn files_git_knows_about(root: &Path) -> Option<Vec<PathBuf>> {
    let output = without_a_console(&mut Command::new(git_command()))
        .args(["ls-files", "-z", "-c", "-o", "--exclude-standard"])
        .current_dir(root)
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    Some(
        String::from_utf8_lossy(&output.stdout)
            .split('\0')
            .filter(|path| !path.is_empty())
            .map(|path| root.join(path))
            .collect(),
    )
}

/// Windows installs Git somewhere the launcher's PATH may not carry, and the
/// override is the same one the rest of Assay honours.
fn git_command() -> String {
    std::env::var("ADE_GIT_COMMAND")
        .ok()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| if cfg!(target_os = "windows") { "git.exe".to_string() } else { "git".to_string() })
}

fn search_directory_from_root(
    root: PathBuf,
    needle: String,
) -> Result<Vec<DirectoryEntry>, String> {
    let needle = forward_slashed(&needle);
    let mut entries = Vec::new();
    match files_git_knows_about(&root) {
        Some(files) => collect_matching_paths(&root, files, &needle, &mut entries),
        // Not a repository, or no Git: the walk stands as the fallback it was
        // always meant to be, with its own list of places nobody edits.
        None => collect_matching_files(&root, 0, &needle, &mut entries)?,
    }
    // A file whose *name* matches is what was being looked for; one that
    // matches only through a directory in its path is a neighbour of it. The
    // first kind comes first, and shallower before deeper, so the limit cuts
    // the least useful matches rather than an arbitrary slice.
    entries.sort_by_key(|entry| {
        let named = !forward_slashed(&entry.name).contains(&needle);
        (named, entry.depth, entry.path.to_lowercase())
    });
    entries.truncate(SEARCH_RESULT_LIMIT);
    Ok(entries)
}

/// The same match and the same shape of answer, from a list Git handed over.
fn collect_matching_paths(
    root: &Path,
    files: Vec<PathBuf>,
    needle: &str,
    entries: &mut Vec<DirectoryEntry>,
) {
    for path in files {
        let Some(name) = path.file_name().and_then(|value| value.to_str()).map(str::to_string) else {
            continue;
        };
        let spelled = path.to_string_lossy().into_owned();
        if !forward_slashed(&format!("{name} {spelled}")).contains(needle) {
            continue;
        }
        // Depth is how far the file sits from the Project root, which is what
        // orders a name match ahead of a deeper one.
        let depth = path
            .strip_prefix(root)
            .map(|relative| relative.components().count().saturating_sub(1))
            .unwrap_or(0);
        entries.push(DirectoryEntry { name, path: spelled, kind: "file".to_string(), depth });
    }
}

fn collect_matching_files(
    root: &Path,
    depth: usize,
    needle: &str,
    entries: &mut Vec<DirectoryEntry>,
) -> Result<(), String> {
    let mut children = std::fs::read_dir(root)
        .map_err(|error| format!("Unable to read directory: {error}"))?
        .filter_map(Result::ok)
        .collect::<Vec<_>>();
    children.sort_by_key(|entry| entry.file_name().to_string_lossy().to_lowercase());
    children.sort_by_key(|entry| {
        std::cmp::Reverse(entry.file_type().map(|kind| kind.is_dir()).unwrap_or(false))
    });
    for entry in children {
        let entry_path = entry.path();
        let file_type = entry.file_type().map_err(|error| error.to_string())?;
        if file_type.is_dir() {
            // Windows spells its directories however they were created, so the
            // comparison is made in one case rather than in the one on disk.
            let folder = entry.file_name().to_string_lossy().to_lowercase();
            if UNSEARCHED_DIRECTORIES.contains(&folder.as_str()) {
                continue;
            }
            collect_matching_files(&entry_path, depth + 1, needle, entries)?;
            continue;
        }
        if !file_type.is_file() {
            continue;
        }
        let name = entry.file_name().to_string_lossy().into_owned();
        let path = entry_path.to_string_lossy().into_owned();
        // The operator types the separator they read, and on Windows the path
        // is spelled with the other one. Both sides are compared in the same
        // spelling so `src/main` finds `src\main` there as it does here.
        if forward_slashed(&format!("{name} {path}")).contains(needle) {
            entries.push(DirectoryEntry {
                name,
                path,
                kind: "file".to_string(),
                depth,
            });
        }
    }
    Ok(())
}

#[tauri::command]
fn open_file(workspace: tauri::State<'_, WorkspaceRoot>, path: String) -> Result<(), String> {
    open_file_in(&workspace, &path)
}

fn open_file_in(workspace: &WorkspaceRoot, path: &str) -> Result<(), String> {
    let file = workspace.resolve(path)?;
    if !file.is_file() {
        return Err(format!("File does not exist: {}", file.display()));
    }
    open_with_desktop(&file, "file")
}

#[tauri::command]
fn read_file(
    workspace: tauri::State<'_, WorkspaceRoot>,
    path: String,
) -> Result<FileReadResult, String> {
    read_file_in(&workspace, &path)
}

fn read_file_in(workspace: &WorkspaceRoot, path: &str) -> Result<FileReadResult, String> {
    let file = workspace.resolve(path)?;
    if !file.is_file() {
        return Err(format!("File does not exist: {}", file.display()));
    }
    let metadata =
        std::fs::metadata(&file).map_err(|error| format!("Unable to inspect file: {error}"))?;
    let root = workspace
        .root
        .lock()
        .map_err(|_| "Workspace root state is poisoned".to_string())?
        .clone()
        .ok_or_else(|| "Select a Project before accessing its workspace".to_string())?;
    let relative_path = file
        .strip_prefix(&root)
        .map_err(|_| "File is outside the selected Project".to_string())?
        .to_string_lossy()
        .into_owned();
    let name = file
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("File")
        .to_string();
    let size = metadata.len();
    if size > MAX_FILE_PREVIEW_BYTES {
        return Ok(FileReadResult {
            path: file.to_string_lossy().into_owned(),
            relative_path,
            name,
            kind: "tooLarge".to_string(),
            size,
            content: None,
            message: Some(format!(
                "Preview is limited to {} MiB",
                MAX_FILE_PREVIEW_BYTES / 1024 / 1024
            )),
        });
    }
    let bytes = std::fs::read(&file).map_err(|error| format!("Unable to read file: {error}"))?;
    if bytes.contains(&0) {
        return Ok(FileReadResult {
            path: file.to_string_lossy().into_owned(),
            relative_path,
            name,
            kind: "binary".to_string(),
            size,
            content: None,
            message: Some("This file cannot be previewed as text".to_string()),
        });
    }
    match String::from_utf8(bytes) {
        Ok(content) => Ok(FileReadResult {
            path: file.to_string_lossy().into_owned(),
            relative_path,
            name,
            kind: "text".to_string(),
            size,
            content: Some(content),
            message: None,
        }),
        Err(_) => Ok(FileReadResult {
            path: file.to_string_lossy().into_owned(),
            relative_path,
            name,
            kind: "binary".to_string(),
            size,
            content: None,
            message: Some("This file cannot be decoded as UTF-8 text".to_string()),
        }),
    }
}

#[tauri::command]
fn write_file(
    workspace: tauri::State<'_, WorkspaceRoot>,
    path: String,
    content: String,
) -> Result<(), String> {
    write_file_in(&workspace, &path, &content)
}

fn write_file_in(workspace: &WorkspaceRoot, path: &str, content: &str) -> Result<(), String> {
    let file = workspace.resolve(path)?;
    if !file.is_file() {
        return Err(format!("File does not exist: {}", file.display()));
    }
    if content.len() as u64 > MAX_FILE_PREVIEW_BYTES {
        return Err(format!(
            "Editor is limited to {} MiB",
            MAX_FILE_PREVIEW_BYTES / 1024 / 1024
        ));
    }
    if content.as_bytes().contains(&0) {
        return Err("Binary content cannot be saved from the editor".to_string());
    }
    std::fs::write(&file, content).map_err(|error| format!("Unable to save file: {error}"))
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct TerminalResult {
    command: String,
    cwd: String,
    exit_code: Option<i32>,
    stdout: String,
    stderr: String,
}

#[tauri::command]
fn terminal_exec(
    workspace: tauri::State<'_, WorkspaceRoot>,
    cwd: String,
    command: String,
) -> Result<TerminalResult, String> {
    terminal_exec_in(&workspace, &cwd, command)
}

fn terminal_exec_in(
    workspace: &WorkspaceRoot,
    cwd: &str,
    command: String,
) -> Result<TerminalResult, String> {
    let directory = workspace.resolve(cwd)?;
    if !directory.is_dir() {
        return Err(format!(
            "Terminal cwd does not exist: {}",
            directory.display()
        ));
    }
    if command.trim().is_empty() {
        return Err("Terminal command cannot be empty".to_string());
    }
    #[cfg(target_os = "windows")]
    let output = without_a_console(&mut Command::new(
        std::env::var("ComSpec").unwrap_or_else(|_| "cmd.exe".to_string()),
    ))
        .args(["/C", &command])
        .current_dir(&directory)
        .output();
    #[cfg(not(target_os = "windows"))]
    let output = Command::new("/bin/sh")
        .args(["-lc", &command])
        .current_dir(&directory)
        .output();
    let output = output.map_err(|error| format!("Unable to execute terminal command: {error}"))?;
    Ok(TerminalResult {
        command,
        cwd: directory.to_string_lossy().into_owned(),
        exit_code: output.status.code(),
        stdout: String::from_utf8_lossy(&output.stdout).into_owned(),
        stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
    })
}

// Read-only bridge for the shell. Domain mutations remain in application
// use-cases; this command only exposes local repository context to the UI.
#[tauri::command]
fn project_context(
    workspace: tauri::State<'_, WorkspaceRoot>,
    repository_path: String,
) -> Result<ProjectContext, String> {
    project_context_for(&workspace, &repository_path)
}

fn project_context_for(
    workspace: &WorkspaceRoot,
    repository_path: &str,
) -> Result<ProjectContext, String> {
    let repository = workspace.select(repository_path)?;

    let is_git = repository.join(".git").exists();
    let branch = std::fs::read_to_string(repository.join(".git/HEAD"))
        .ok()
        .and_then(|head| {
            head.strip_prefix("ref: refs/heads/")
                .map(str::trim)
                .map(String::from)
        })
        .unwrap_or_else(|| "detached".to_string());
    let name = repository
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("Project")
        .to_string();

    Ok(ProjectContext {
        name,
        repository_path: repository.to_string_lossy().into_owned(),
        branch,
        version_control: if is_git { "git" } else { "none" }.to_string(),
        working_tree: "detected".to_string(),
    })
}

/// Which folder becomes the newly added Project's repository. `tauri-plugin-dialog`
/// puts one picker behind this call on every desktop -- GTK's own chooser on
/// Linux, NSOpenPanel on macOS, the common item dialog on Windows -- so Linux
/// gets the same first-class treatment as the other two instead of shelling
/// out to a CLI helper (`zenity`) that many Linux desktops, including this
/// project's own KDE dev environment, don't install by default. Cancelling
/// must be indistinguishable from choosing nothing, which is exactly what
/// `None` from the picker already means.
///
/// This has to stay `async`: a plain (blocking) command runs on the very
/// same UI thread that owns the window, and `blocking_pick_folder` needs
/// that thread free to dispatch the dialog onto -- a synchronous command
/// here deadlocks the whole window the moment the operator clicks the
/// button, rather than opening anything.
#[tauri::command]
async fn select_project_directory(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let selection = app
        .dialog()
        .file()
        .set_title("Add project to Assay")
        .blocking_pick_folder();
    match selection {
        None => Ok(None),
        Some(path) => path
            .into_path()
            .map(|path| Some(path.to_string_lossy().into_owned()))
            .map_err(|error| error.to_string()),
    }
}

/// Which Project the shell should open, when the operator's environment names
/// one. It used to answer "ade" whatever the store held, so a fresh install
/// asked for a Project that did not exist and the window filled with the
/// startup fixture's name instead of saying it had none. An empty answer means
/// "you decide from what is registered".
#[tauri::command]
fn project_id() -> String {
    std::env::var("ADE_PROJECT_ID")
        .map(|value| value.trim().to_string())
        .unwrap_or_default()
}

#[tauri::command]
fn open_terminal(
    workspace: tauri::State<'_, WorkspaceRoot>,
    repository_path: String,
) -> Result<(), String> {
    open_terminal_in(&workspace, &repository_path)
}

fn open_terminal_in(workspace: &WorkspaceRoot, repository_path: &str) -> Result<(), String> {
    let repository = workspace.resolve(repository_path)?;
    if !repository.is_dir() {
        return Err(format!(
            "Repository does not exist: {}",
            repository.display()
        ));
    }
    open_terminal_at(&repository)
}

#[tauri::command]
fn open_document(
    workspace: tauri::State<'_, WorkspaceRoot>,
    repository_path: String,
    relative_path: String,
) -> Result<(), String> {
    open_document_in(&workspace, &repository_path, &relative_path)
}

fn open_document_in(
    workspace: &WorkspaceRoot,
    repository_path: &str,
    relative_path: &str,
) -> Result<(), String> {
    let repository = workspace.resolve(repository_path)?;
    let relative = Path::new(relative_path);
    // The frontend normally sends `/`, but read_file returns native paths and
    // callers can come from a Windows shell. Validate both spellings before
    // joining the path with the authorized repository root.
    let normalized_relative = relative_path.replace('\\', "/");
    if relative.is_absolute() || !normalized_relative.starts_with("docu/specs/") {
        return Err("Only documents under docu/specs can be opened".to_string());
    }
    let documents_root = repository
        .join("docu/specs")
        .canonicalize()
        .map_err(|error| format!("Unable to resolve documents root: {error}"))?;
    let document = repository
        .join(relative)
        .canonicalize()
        .map_err(|error| format!("Unable to resolve document: {error}"))?;
    if !document.starts_with(&documents_root) {
        return Err("Only documents under docu/specs can be opened".to_string());
    }
    if !document.is_file() {
        return Err(format!("Document does not exist: {}", document.display()));
    }
    open_with_desktop(&document, "document")
}

/// A packaged `.app` inherits a login shell's PATH, a packaged `.exe` does not,
/// so the well-known install locations are the fallback when PATH has no node.
/// `ADE_SIDECAR_NODE` always wins, which is what the dev loop and CI set.
fn resolve_node_binary() -> String {
    if let Some(explicit) = std::env::var("ADE_SIDECAR_NODE")
        .ok()
        .filter(|value| !value.trim().is_empty())
    {
        return explicit;
    }
    // The same places the sidecar's own resolver looks, in the same order:
    // a version manager's shims first, a machine-wide install last. A shorter
    // list here means falling back to a bare `node` and the launcher's PATH,
    // which this codebase documents as insufficient in a packaged app.
    #[cfg(target_os = "windows")]
    let home = std::env::var("USERPROFILE").unwrap_or_default();
    #[cfg(target_os = "windows")]
    let candidates = [
        format!("{home}\\.volta\\bin\\node.exe"),
        format!("{home}\\scoop\\shims\\node.exe"),
        format!(
            "{}\\chocolatey\\bin\\node.exe",
            std::env::var("ProgramData").unwrap_or_else(|_| "C:\\ProgramData".to_string())
        ),
        format!(
            "{}\\nodejs\\node.exe",
            std::env::var("ProgramFiles").unwrap_or_else(|_| "C:\\Program Files".to_string())
        ),
        format!(
            "{}\\nodejs\\node.exe",
            std::env::var("ProgramFiles(x86)").unwrap_or_else(|_| "C:\\Program Files (x86)".to_string())
        ),
    ];
    // The same directories `posixNodeDirectories` in `local-process.ts` checks
    // for the sidecar's own child processes, so a packaged launch -- no login
    // shell, no version manager on PATH -- finds the same Node install
    // whichever of the two resolvers runs first. `/usr/local/bin` and
    // `/usr/bin` stand in for a distribution's package manager; nvm keeps one
    // directory per release with no stable "current" symlink, so only the
    // newest is checked.
    #[cfg(not(target_os = "windows"))]
    let candidates = {
        let home = std::env::var("HOME").unwrap_or_default();
        let mut candidates = vec![
            "/usr/local/bin/node".to_string(),
            "/opt/homebrew/bin/node".to_string(),
            "/opt/homebrew/opt/node@24/bin/node".to_string(),
            "/usr/bin/node".to_string(),
        ];
        if !home.is_empty() {
            candidates.push(format!("{home}/.local/bin/node"));
            candidates.push(format!("{home}/.volta/bin/node"));
            candidates.push(format!("{home}/.asdf/shims/node"));
            candidates.push(format!("{home}/.local/share/mise/shims/node"));
            if let Some(nvm_node) = newest_nvm_node(&home) {
                candidates.push(nvm_node);
            }
        }
        candidates
    };
    candidates
        .iter()
        .find(|candidate| Path::new(candidate).is_file())
        .cloned()
        .unwrap_or_else(|| "node".to_string())
}

/// nvm keeps one directory per installed release under a version string
/// (`v24.21.0`) and no stable symlink to the default -- only a numeric sort of
/// the directory names stands in for "the one `nvm use default` would pick".
#[cfg(not(target_os = "windows"))]
fn newest_nvm_node(home: &str) -> Option<String> {
    let versions_dir = Path::new(home).join(".nvm/versions/node");
    let mut versions: Vec<String> = std::fs::read_dir(&versions_dir)
        .ok()?
        .filter_map(|entry| entry.ok())
        .filter(|entry| {
            entry
                .file_type()
                .map(|kind| kind.is_dir() || kind.is_symlink())
                .unwrap_or(false)
        })
        .map(|entry| entry.file_name().to_string_lossy().into_owned())
        .collect();
    versions.sort_by(|left, right| version_key(right).cmp(&version_key(left)));
    versions.into_iter().next().map(|version| {
        versions_dir
            .join(version)
            .join("bin/node")
            .to_string_lossy()
            .into_owned()
    })
}

#[cfg(not(target_os = "windows"))]
fn version_key(value: &str) -> Vec<u64> {
    value
        .trim_start_matches('v')
        .split('.')
        .map(|part| part.parse().unwrap_or(0))
        .collect()
}

/// The packaged sidecar is a single executable, except where Node lacks the SEA
/// fuse and the build falls back to a launcher script.  Probe both spellings and
/// let the last candidate surface the spawn error if neither exists.
fn resolve_sidecar_binary(resource_dir: &Path) -> PathBuf {
    let candidates: &[&str] = if cfg!(target_os = "windows") {
        &["sidecar-dist/ade-sidecar.exe", "sidecar-dist/ade-sidecar.cmd"]
    } else {
        &["sidecar-dist/ade-sidecar"]
    };
    candidates
        .iter()
        .map(|candidate| resource_dir.join(candidate))
        .find(|candidate| candidate.is_file())
        .unwrap_or_else(|| resource_dir.join(candidates[0]))
}

#[tauri::command]
fn sidecar_start(
    app: tauri::AppHandle,
    state: tauri::State<'_, SidecarSupervisor>,
) -> Result<(), String> {
    if state.reap_finished()? {
        return Ok(());
    }
    let database_path = resolve_sidecar_database_path(&app)?;
    let mut command = if let Ok(script) = std::env::var("ADE_SIDECAR_SCRIPT") {
        let node = std::env::var("ADE_SIDECAR_NODE").unwrap_or_else(|_| "node".to_string());
        let mut command = Command::new(node);
        command.arg(script);
        command
    } else {
        let resource_dir = app
            .path()
            .resource_dir()
            .map_err(|error| error.to_string())?;
        let script = resource_dir.join("sidecar-dist/desktop-sidecar.cjs");
        if let Ok(binary) = std::env::var("ADE_SIDECAR_BIN") {
            Command::new(binary)
        } else {
            let packaged = resolve_sidecar_binary(&resource_dir);
            if packaged.is_file() {
                command_for_sidecar(&packaged)
            } else {
                let mut command = Command::new(resolve_node_binary());
                command.arg(script);
                command
            }
        }
    };
    // Every branch above -- node, the packaged binary, its .cmd shim -- is a
    // console application on Windows, and they all arrive at this one spawn.
    let mut child = without_a_console(&mut command)
        .env("ADE_DB_PATH", database_path)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::inherit())
        .spawn()
        .map_err(|error| format!("Unable to start sidecar: {error}"))?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "Sidecar stdout is unavailable".to_string())?;
    std::thread::spawn(move || {
        for line in BufReader::new(stdout).lines() {
            match line {
                Ok(payload) => {
                    let _ = app.emit("sidecar:response", payload);
                }
                Err(error) => {
                    let _ = app.emit("sidecar:error", error.to_string());
                    break;
                }
            }
        }
        let _ = app.emit("sidecar:exited", "Sidecar stdout closed");
    });
    let mut current = state
        .child
        .lock()
        .map_err(|_| "Sidecar state is poisoned".to_string())?;
    *current = Some(child);
    Ok(())
}

fn command_for_sidecar(path: &Path) -> Command {
    #[cfg(target_os = "windows")]
    if path.extension().and_then(|value| value.to_str()) == Some("cmd") {
        let mut command = Command::new(std::env::var("ComSpec").unwrap_or_else(|_| "cmd.exe".to_string()));
        command.args(["/D", "/S", "/C"]).arg(path);
        return command;
    }
    Command::new(path)
}

fn resolve_sidecar_database_path(app: &tauri::AppHandle) -> Result<String, String> {
    if let Ok(path) = std::env::var("ADE_DB_PATH") {
        if !path.trim().is_empty() {
            return Ok(path);
        }
    }

    // Development bundles live inside the repository. Reuse its metadata when
    // present so launching the .app from Finder keeps the registered Projects.
    if let Ok(executable) = std::env::current_exe() {
        for ancestor in executable.ancestors() {
            let candidate = ancestor.join(".ade/ade.db");
            if candidate.is_file() {
                return Ok(candidate.to_string_lossy().into_owned());
            }
        }
    }

    let directory = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Unable to resolve ADE application data directory: {error}"))?;
    std::fs::create_dir_all(&directory)
        .map_err(|error| format!("Unable to create ADE application data directory: {error}"))?;
    Ok(directory.join("ade.db").to_string_lossy().into_owned())
}

#[tauri::command]
fn sidecar_request(
    state: tauri::State<'_, SidecarSupervisor>,
    request: String,
) -> Result<(), String> {
    let mut child = state
        .child
        .lock()
        .map_err(|_| "Sidecar state is poisoned".to_string())?;
    let process = child
        .as_mut()
        .ok_or_else(|| "Sidecar is not running".to_string())?;
    let stdin = process
        .stdin
        .as_mut()
        .ok_or_else(|| "Sidecar stdin is unavailable".to_string())?;
    stdin
        .write_all(format!("{request}\n").as_bytes())
        .and_then(|_| stdin.flush())
        .map_err(|error| format!("Unable to send sidecar request: {error}"))
}

#[tauri::command]
fn sidecar_status(state: tauri::State<'_, SidecarSupervisor>) -> Result<bool, String> {
    state.reap_finished()
}

#[tauri::command]
fn sidecar_restart(
    app: tauri::AppHandle,
    state: tauri::State<'_, SidecarSupervisor>,
) -> Result<(), String> {
    state.stop()?;
    sidecar_start(app, state)
}

#[tauri::command]
fn sidecar_stop(state: tauri::State<'_, SidecarSupervisor>) -> Result<(), String> {
    state.stop()
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // A second launch is the operator asking for the window they already
        // have, not for a second application. Two of them would run two
        // sidecars against one SQLite file and write over each other's work, so
        // the second instance hands its request to the first and leaves. It is
        // registered first because the lock has to be claimed before anything
        // else is built.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            use tauri::Manager;
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .manage(SidecarSupervisor::default())
        .manage(TerminalSupervisor::default())
        .manage(WorkspaceRoot::default())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            project_context,
            list_directory,
            search_directory,
            open_file,
            open_run_url,
            read_file,
            write_file,
            terminal_exec,
            terminal_start,
            terminal_input,
            terminal_resize,
            terminal_stop,
            terminal_stop_all,
            project_id,
            select_project_directory,
            open_terminal,
            open_document,
            sidecar_start,
            sidecar_request,
            sidecar_status,
            sidecar_restart,
            sidecar_stop
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::{
        list_directory_in, open_document_in, open_file_in, open_local_url, open_terminal_in,
        project_context_for, search_directory_in, SEARCH_RESULT_LIMIT,
        read_file_in, start_terminal_pty, terminal_exec_in, write_file_in, SidecarSupervisor,
        WorkspaceRoot, MAX_FILE_PREVIEW_BYTES,
    };
    use std::fs;

    fn fixture_root(name: &str) -> std::path::PathBuf {
        let root = std::env::temp_dir().join(format!("ade-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(&root).expect("create fixture root");
        root
    }

    /// Windows keeps a directory locked while any process still has it as a
    /// working directory, and a killed shell's console host lets go a moment
    /// after the shell itself does, so removal is retried before it is a
    /// failure. POSIX unlinks on the first attempt.
    fn remove_fixture(root: std::path::PathBuf) {
        for attempt in 0..50 {
            match fs::remove_dir_all(&root) {
                Ok(()) => return,
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => return,
                Err(error) if attempt == 49 => panic!("remove fixture: {error:?}"),
                Err(_) => std::thread::sleep(std::time::Duration::from_millis(100)),
            }
        }
    }

    /// A process that exits immediately, spelled for the platform running the
    /// suite. `sh` only happens to exist on Windows CI because Git ships it.
    fn spawn_exiting_process() -> std::process::Child {
        #[cfg(target_os = "windows")]
        let command = std::process::Command::new("cmd").args(["/C", "exit 0"]).spawn();
        #[cfg(not(target_os = "windows"))]
        let command = std::process::Command::new("sh").args(["-c", "exit 0"]).spawn();
        command.expect("spawn fixture")
    }

    /// Process teardown is not instantaneous, and how long it takes is the
    /// platform's business. Poll for the outcome instead of guessing a delay.
    fn wait_until<F: Fn() -> bool>(condition: F) -> bool {
        for _ in 0..100 {
            if condition() {
                return true;
            }
            std::thread::sleep(std::time::Duration::from_millis(20));
        }
        false
    }

    #[test]
    fn project_context_rejects_missing_repository() {
        let workspace = WorkspaceRoot::default();
        let result = project_context_for(&workspace, "/path/that/cannot/exist/for/ade");

        assert!(result.is_err());
    }

    #[test]
    fn project_context_reads_repository_branch() {
        let root = fixture_root("project-context");
        fs::create_dir_all(root.join(".git")).expect("create fixture");
        fs::write(root.join(".git/HEAD"), "ref: refs/heads/feature/ui\n").expect("write head");
        let workspace = WorkspaceRoot::default();

        let context =
            project_context_for(&workspace, &root.to_string_lossy()).expect("read context");

        assert_eq!(context.name, root.file_name().unwrap().to_string_lossy());
        assert_eq!(context.branch, "feature/ui");
        assert_eq!(context.version_control, "git");
        assert_eq!(context.working_tree, "detected");
        let authorized_path = workspace
            .resolve(&root.to_string_lossy())
            .expect("resolve selected root")
            .to_string_lossy()
            .into_owned();
        assert_eq!(context.repository_path, authorized_path);
        fs::remove_dir_all(root).expect("remove fixture");
    }

    #[test]
    fn project_context_marks_a_folder_without_git() {
        let root = fixture_root("project-context-no-git");
        let workspace = WorkspaceRoot::default();

        let context =
            project_context_for(&workspace, &root.to_string_lossy()).expect("read context");

        assert_eq!(context.version_control, "none");
        assert_eq!(context.branch, "detached");
    }

    #[test]
    fn open_terminal_rejects_missing_repository() {
        let workspace = WorkspaceRoot::default();
        assert!(open_terminal_in(&workspace, "/path/that/cannot/exist/for/ade").is_err());
    }

    #[test]
    fn open_document_rejects_paths_outside_specs() {
        let root = fixture_root("document-root");
        fs::create_dir_all(root.join("docu/specs")).expect("create specs root");
        let workspace = WorkspaceRoot::default();
        project_context_for(&workspace, &root.to_string_lossy()).expect("select root");

        assert!(open_document_in(&workspace, &root.to_string_lossy(), "README.md").is_err());
        assert!(open_document_in(
            &workspace,
            &root.to_string_lossy(),
            "docu/specs/../../README.md"
        )
        .is_err());
        fs::remove_dir_all(root).expect("remove fixture");
    }

    #[test]
    fn list_directory_returns_directories_first_and_marks_symlinks() {
        let root = fixture_root("directory");
        fs::create_dir_all(root.join("folder")).expect("create folder");
        fs::write(root.join("file.txt"), "content").expect("create file");
        #[cfg(unix)]
        std::os::unix::fs::symlink(root.join("file.txt"), root.join("link")).expect("create link");
        let workspace = WorkspaceRoot::default();
        project_context_for(&workspace, &root.to_string_lossy()).expect("select root");
        let entries = list_directory_in(&workspace, &root.to_string_lossy(), Some(1))
            .expect("list directory");
        assert_eq!(entries[0].kind, "directory");
        assert!(entries
            .iter()
            .any(|entry| entry.name == "file.txt" && entry.kind == "file"));
        #[cfg(unix)]
        assert!(entries
            .iter()
            .any(|entry| entry.name == "link" && entry.kind == "symlink"));
        fs::remove_dir_all(root).expect("remove fixture");
    }

    #[test]
    fn search_directory_returns_matching_files_without_the_full_tree_payload() {
        let root = fixture_root("search-directory");
        fs::create_dir_all(root.join("src/nested")).expect("create nested source");
        fs::write(root.join("README.md"), "readme").expect("create readme");
        fs::write(root.join("src/main.rs"), "main").expect("create source");
        fs::write(root.join("src/nested/notes.md"), "notes").expect("create nested file");
        let workspace = WorkspaceRoot::default();
        project_context_for(&workspace, &root.to_string_lossy()).expect("select project");

        let entries = search_directory_in(&workspace, &root.to_string_lossy(), "notes")
            .expect("search files");

        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].name, "notes.md");
        assert_eq!(entries[0].kind, "file");
        fs::remove_dir_all(root).expect("remove fixture");
    }

    #[test]
    fn search_directory_skips_what_nobody_edits_and_leads_with_name_matches() {
        let root = fixture_root("search-directory-noise");
        fs::create_dir_all(root.join("node_modules/left-pad")).expect("create dependency");
        fs::create_dir_all(root.join(".git/objects")).expect("create git storage");
        fs::create_dir_all(root.join("src/deep/deeper")).expect("create nested source");
        fs::write(root.join("node_modules/left-pad/index.js"), "dep").expect("create dependency file");
        fs::write(root.join(".git/objects/index"), "object").expect("create git object");
        fs::write(root.join("src/deep/deeper/index-helper.ts"), "deep").expect("create deep file");
        fs::write(root.join("index.ts"), "shallow").expect("create shallow file");
        let workspace = WorkspaceRoot::default();
        project_context_for(&workspace, &root.to_string_lossy()).expect("select project");

        let entries = search_directory_in(&workspace, &root.to_string_lossy(), "index")
            .expect("search files");

        // A dependency tree and Git's own storage are not places a file is
        // edited, and here they would have doubled the answer.
        assert!(entries.iter().all(|entry| !entry.path.contains("node_modules")));
        assert!(entries.iter().all(|entry| !entry.path.contains(".git")));
        // The shallower name match leads; the deeper one follows.
        assert_eq!(entries.len(), 2);
        assert_eq!(entries[0].name, "index.ts");
        assert_eq!(entries[1].name, "index-helper.ts");
        fs::remove_dir_all(root).expect("remove fixture");
    }

    #[test]
    fn search_directory_asks_git_which_files_the_operator_has() {
        let root = fixture_root("search-directory-ignored");
        fs::create_dir_all(root.join("target/debug")).expect("create build output");
        fs::create_dir_all(root.join("src")).expect("create source");
        fs::write(root.join(".gitignore"), "target/\n").expect("create ignore rules");
        fs::write(root.join("src/report.rs"), "source").expect("create source file");
        fs::write(root.join("target/debug/report.rs"), "build output").expect("create build file");
        assert!(std::process::Command::new("git")
            .args(["init", "-q"])
            .current_dir(&root)
            .status()
            .map(|status| status.success())
            .unwrap_or(false), "git is required for this test");
        let workspace = WorkspaceRoot::default();
        project_context_for(&workspace, &root.to_string_lossy()).expect("select project");

        let entries = search_directory_in(&workspace, &root.to_string_lossy(), "report")
            .expect("search files");

        // A build directory is not a place a file is edited, and no hardcoded
        // list had to know it is called `target`: the repository says so.
        assert_eq!(entries.len(), 1, "only the source file is the operator's");
        assert!(entries[0].path.contains("src"));
        fs::remove_dir_all(root).expect("remove fixture");
    }

    #[test]
    fn search_directory_matches_a_path_typed_with_either_separator() {
        let root = fixture_root("search-directory-separators");
        fs::create_dir_all(root.join("src/domain")).expect("create nested source");
        fs::write(root.join("src/domain/task.ts"), "task").expect("create file");
        let workspace = WorkspaceRoot::default();
        project_context_for(&workspace, &root.to_string_lossy()).expect("select project");

        // The operator types the separator they read. On Windows the path on
        // disk is spelled with the other one, and this is the same query there.
        for query in ["src/domain", "SRC/Domain", "src\\domain"] {
            let entries = search_directory_in(&workspace, &root.to_string_lossy(), query)
                .expect("search files");
            assert_eq!(entries.len(), 1, "query {query} should find the file");
            assert_eq!(entries[0].name, "task.ts");
        }
        fs::remove_dir_all(root).expect("remove fixture");
    }

    #[test]
    fn search_directory_stops_at_a_drawable_number_of_matches() {
        let root = fixture_root("search-directory-limit");
        fs::create_dir_all(&root).expect("create fixture");
        for index in 0..(SEARCH_RESULT_LIMIT + 40) {
            fs::write(root.join(format!("match-{index}.txt")), "x").expect("create file");
        }
        let workspace = WorkspaceRoot::default();
        project_context_for(&workspace, &root.to_string_lossy()).expect("select project");

        let entries = search_directory_in(&workspace, &root.to_string_lossy(), "match")
            .expect("search files");

        assert_eq!(entries.len(), SEARCH_RESULT_LIMIT);
        fs::remove_dir_all(root).expect("remove fixture");
    }

    #[test]
    fn terminal_exec_returns_output_and_exit_code() {
        let root = fixture_root("terminal");
        let workspace = WorkspaceRoot::default();
        project_context_for(&workspace, &root.to_string_lossy()).expect("select root");
        #[cfg(target_os = "windows")]
        let command = "echo ade";
        #[cfg(not(target_os = "windows"))]
        let command = "printf ade";
        let result = terminal_exec_in(
            &workspace,
            &root.to_string_lossy(),
            command.to_string(),
        )
        .expect("run terminal");
        assert_eq!(result.stdout.trim(), "ade");
        assert_eq!(result.exit_code, Some(0));
        fs::remove_dir_all(root).expect("remove fixture");
    }

    #[test]
    fn terminal_pty_accepts_input_after_the_shell_is_ready() {
        let root = fixture_root("terminal-pty");
        let (mut process, reader) = start_terminal_pty(&root).expect("start PTY");
        let (sender, receiver) = std::sync::mpsc::channel();
        std::thread::spawn(move || {
            let mut reader = reader;
            let mut bytes = [0u8; 1024];
            loop {
                match reader.read(&mut bytes) {
                    Ok(0) | Err(_) => break,
                    Ok(size) => {
                        if sender
                            .send(String::from_utf8_lossy(&bytes[..size]).into_owned())
                            .is_err()
                        {
                            break;
                        }
                    }
                }
            }
        });
        let startup = receiver
            .recv_timeout(std::time::Duration::from_secs(5))
            .expect("shell should write a prompt before receiving terminal input");
        assert!(!startup.is_empty());
        #[cfg(target_os = "windows")]
        let command = b"Write-Output ([char]0x2603)\r".as_slice();
        #[cfg(not(target_os = "windows"))]
        let command = b"printf '\\342\\230\\203\\n'\n".as_slice();
        process
            .writer
            .write_all(command)
            .expect("write PTY input after prompt");
        process.writer.flush().expect("flush PTY input");
        let mut output = startup;
        while !output.contains('☃') {
            output.push_str(
                &receiver
                    .recv_timeout(std::time::Duration::from_secs(5))
                    .expect("PTY command should produce output after shell readiness"),
            );
        }
        let _ = process.child.kill();
        let _ = process.child.wait();
        remove_fixture(root);
    }

    #[test]
    fn workspace_rejects_paths_outside_selected_project() {
        let root = fixture_root("authorized-root");
        let outside = fixture_root("outside-root");
        fs::write(outside.join("outside.txt"), "private").expect("write fixture");
        let workspace = WorkspaceRoot::default();
        project_context_for(&workspace, &root.to_string_lossy()).expect("select root");

        assert!(list_directory_in(&workspace, &outside.to_string_lossy(), Some(0)).is_err());
        assert!(
            terminal_exec_in(&workspace, &outside.to_string_lossy(), "pwd".to_string()).is_err()
        );
        assert!(open_file_in(&workspace, &outside.join("outside.txt").to_string_lossy()).is_err());
        assert!(write_file_in(
            &workspace,
            &outside.join("outside.txt").to_string_lossy(),
            "nope"
        )
        .is_err());

        fs::remove_dir_all(root).expect("remove root fixture");
        fs::remove_dir_all(outside).expect("remove outside fixture");
    }

    #[cfg(unix)]
    #[test]
    fn workspace_rejects_symlink_that_escapes_selected_project() {
        let root = fixture_root("symlink-root");
        let outside = fixture_root("symlink-outside");
        let outside_file = outside.join("secret.txt");
        fs::write(&outside_file, "private").expect("write fixture");
        std::os::unix::fs::symlink(&outside_file, root.join("outside-link"))
            .expect("create external link");
        let workspace = WorkspaceRoot::default();
        project_context_for(&workspace, &root.to_string_lossy()).expect("select root");

        assert!(open_file_in(&workspace, &root.join("outside-link").to_string_lossy()).is_err());

        fs::remove_dir_all(root).expect("remove root fixture");
        fs::remove_dir_all(outside).expect("remove outside fixture");
    }

    #[test]
    fn read_file_returns_text_content_with_project_relative_path() {
        let root = fixture_root("read-file");
        fs::write(root.join("README.md"), "# ADE\n").expect("create text file");
        let workspace = WorkspaceRoot::default();
        project_context_for(&workspace, &root.to_string_lossy()).expect("select root");

        let result = read_file_in(&workspace, &root.join("README.md").to_string_lossy())
            .expect("read text file");
        assert_eq!(result.kind, "text");
        assert_eq!(result.relative_path, "README.md");
        assert_eq!(result.content.as_deref(), Some("# ADE\n"));

        fs::remove_dir_all(root).expect("remove fixture");
    }

    #[test]
    fn read_file_classifies_binary_content_without_returning_bytes() {
        let root = fixture_root("read-file-binary");
        fs::write(root.join("image.bin"), [0, 159, 146, 150]).expect("create binary file");
        let workspace = WorkspaceRoot::default();
        project_context_for(&workspace, &root.to_string_lossy()).expect("select root");

        let result = read_file_in(&workspace, &root.join("image.bin").to_string_lossy())
            .expect("classify binary file");
        assert_eq!(result.kind, "binary");
        assert!(result.content.is_none());

        fs::remove_dir_all(root).expect("remove fixture");
    }

    #[test]
    fn read_file_marks_previews_over_two_megabytes_as_too_large() {
        let root = fixture_root("read-file-large");
        fs::write(
            root.join("large.txt"),
            vec![b'a'; (MAX_FILE_PREVIEW_BYTES + 1) as usize],
        )
        .expect("create large file");
        let workspace = WorkspaceRoot::default();
        project_context_for(&workspace, &root.to_string_lossy()).expect("select root");

        let result = read_file_in(&workspace, &root.join("large.txt").to_string_lossy())
            .expect("classify large file");
        assert_eq!(result.kind, "tooLarge");
        assert!(result.content.is_none());

        fs::remove_dir_all(root).expect("remove fixture");
    }

    #[test]
    fn write_file_updates_text_file_inside_selected_project() {
        let root = fixture_root("write-file");
        let file = root.join("notes.md");
        fs::write(&file, "before\n").expect("create text file");
        let workspace = WorkspaceRoot::default();
        project_context_for(&workspace, &root.to_string_lossy()).expect("select root");

        write_file_in(&workspace, &file.to_string_lossy(), "after\n").expect("save text file");
        assert_eq!(
            fs::read_to_string(&file).expect("read saved file"),
            "after\n"
        );

        fs::remove_dir_all(root).expect("remove fixture");
    }

    #[test]
    fn sidecar_status_is_false_without_a_process() {
        let supervisor = SidecarSupervisor::default();

        assert!(!supervisor.reap_finished().expect("status"));
    }

    #[test]
    fn sidecar_stop_is_idempotent_without_a_process() {
        let supervisor = SidecarSupervisor::default();

        supervisor.stop().expect("first stop");
        supervisor.stop().expect("second stop");
    }

    #[test]
    fn sidecar_status_reaps_an_unexpected_exit() {
        let supervisor = SidecarSupervisor::default();
        *supervisor.child.lock().expect("lock state") = Some(spawn_exiting_process());

        assert!(wait_until(|| !supervisor.reap_finished().expect("status")));
    }

    #[test]
    fn sidecar_stop_handles_a_process_that_already_exited() {
        let supervisor = SidecarSupervisor::default();
        *supervisor.child.lock().expect("lock state") = Some(spawn_exiting_process());
        wait_until(|| !supervisor.reap_finished().expect("status"));

        supervisor.stop().expect("stop exited process");
        assert!(!supervisor.reap_finished().expect("status"));
    }

    /// The only URL the shell ever asks to open is the loopback address of a
    /// run it started. Anything else is refused before it reaches the desktop.
    #[test]
    fn open_run_url_refuses_anything_but_a_local_http_address() {
        assert!(open_local_url("file:///etc/passwd").is_err());
        assert!(open_local_url("http://example.com/").is_err());
        assert!(open_local_url("http://127.0.0.1.example.com/").is_err());
        assert!(open_local_url("javascript:alert(1)").is_err());
    }
}
