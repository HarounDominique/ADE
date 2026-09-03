use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use serde::Serialize;
use std::io::{BufRead, BufReader, Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use tauri::{Emitter, Manager};

#[derive(Default)]
struct SidecarSupervisor {
    child: Mutex<Option<Child>>,
}

struct TerminalProcess {
    child: Box<dyn portable_pty::Child + Send + Sync>,
    writer: Box<dyn Write + Send>,
}

#[derive(Default)]
struct TerminalSupervisor {
    process: Mutex<Option<TerminalProcess>>,
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
        let canonical = repository
            .canonicalize()
            .map_err(|error| format!("Unable to resolve Project root: {error}"))?;
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
        let candidate = Path::new(requested_path)
            .canonicalize()
            .map_err(|error| format!("Unable to resolve workspace path: {error}"))?;
        if !candidate.starts_with(&root) {
            return Err("Workspace path is outside the selected Project".to_string());
        }
        Ok(candidate)
    }
}

#[tauri::command]
fn terminal_start(
    app: tauri::AppHandle,
    state: tauri::State<'_, TerminalSupervisor>,
    workspace: tauri::State<'_, WorkspaceRoot>,
    cwd: String,
) -> Result<(), String> {
    terminal_start_in(&app, &state, &workspace, &cwd)
}

fn terminal_start_in(
    app: &tauri::AppHandle,
    state: &TerminalSupervisor,
    workspace: &WorkspaceRoot,
    cwd: &str,
) -> Result<(), String> {
    let cwd = workspace.resolve(cwd)?;
    if !cwd.is_dir() {
        return Err(format!("Terminal cwd does not exist: {}", cwd.display()));
    }
    let (process, mut reader) = start_terminal_pty(&cwd)?;
    let output_app = app.clone();
    std::thread::spawn(move || {
        let mut bytes = [0u8; 4096];
        loop {
            match reader.read(&mut bytes) {
                Ok(0) | Err(_) => break,
                Ok(size) => {
                    let _ = output_app.emit(
                        "terminal:output",
                        String::from_utf8_lossy(&bytes[..size]).into_owned(),
                    );
                }
            }
        }
    });
    *state
        .process
        .lock()
        .map_err(|_| "Terminal state is poisoned".to_string())? = Some(process);
    Ok(())
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
        CommandBuilder::new("cmd")
    } else {
        let mut command = CommandBuilder::new("/bin/sh");
        command.arg("-i");
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
    Ok((TerminalProcess { child, writer }, reader))
}

#[tauri::command]
fn terminal_input(
    state: tauri::State<'_, TerminalSupervisor>,
    input: String,
) -> Result<(), String> {
    use std::io::Write;
    let mut guard = state
        .process
        .lock()
        .map_err(|_| "Terminal state is poisoned".to_string())?;
    let process = guard
        .as_mut()
        .ok_or_else(|| "Terminal is not running".to_string())?;
    process
        .writer
        .write_all(input.as_bytes())
        .and_then(|_| process.writer.flush())
        .map_err(|error| format!("Unable to write terminal input: {error}"))
}

#[tauri::command]
fn terminal_stop(state: tauri::State<'_, TerminalSupervisor>) -> Result<(), String> {
    let mut guard = state
        .process
        .lock()
        .map_err(|_| "Terminal state is poisoned".to_string())?;
    if let Some(mut process) = guard.take() {
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

#[tauri::command]
fn list_directory(
    workspace: tauri::State<'_, WorkspaceRoot>,
    path: String,
    max_depth: Option<usize>,
) -> Result<Vec<DirectoryEntry>, String> {
    list_directory_in(&workspace, &path, max_depth)
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

#[tauri::command]
fn open_file(workspace: tauri::State<'_, WorkspaceRoot>, path: String) -> Result<(), String> {
    open_file_in(&workspace, &path)
}

fn open_file_in(workspace: &WorkspaceRoot, path: &str) -> Result<(), String> {
    let file = workspace.resolve(path)?;
    if !file.is_file() {
        return Err(format!("File does not exist: {}", file.display()));
    }
    Command::new("open")
        .arg(file)
        .spawn()
        .map(|_| ())
        .map_err(|error| format!("Unable to open file: {error}"))
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
    let output = Command::new("cmd")
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
        working_tree: "detected".to_string(),
    })
}

#[tauri::command]
fn project_id() -> String {
    std::env::var("ADE_PROJECT_ID").unwrap_or_else(|_| "ade".to_string())
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
    Command::new("open")
        .args(["-a", "Terminal", &repository.to_string_lossy()])
        .spawn()
        .map(|_| ())
        .map_err(|error| format!("Unable to open Terminal: {error}"))
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
    if relative.is_absolute() || !relative_path.starts_with("docu/specs/") {
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
    Command::new("open")
        .arg(&document)
        .spawn()
        .map(|_| ())
        .map_err(|error| format!("Unable to open document: {error}"))
}

#[tauri::command]
fn sidecar_start(
    app: tauri::AppHandle,
    state: tauri::State<'_, SidecarSupervisor>,
) -> Result<(), String> {
    if state.reap_finished()? {
        return Ok(());
    }
    let database_path = std::env::var("ADE_DB_PATH")
        .map_err(|_| "ADE_DB_PATH must point to the ADE metadata database".to_string())?;
    let mut command = if let Ok(script) = std::env::var("ADE_SIDECAR_SCRIPT") {
        let node = std::env::var("ADE_SIDECAR_NODE").unwrap_or_else(|_| "node".to_string());
        let mut command = Command::new(node);
        command.arg(script);
        command
    } else {
        let binary = std::env::var("ADE_SIDECAR_BIN")
            .map(std::path::PathBuf::from)
            .or_else(|_| {
                app.path()
                    .resource_dir()
                    .map(|directory| directory.join("sidecar-dist/ade-sidecar"))
                    .map_err(|error| error.to_string())
            })?;
        Command::new(binary)
    };
    let mut child = command
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
        .manage(SidecarSupervisor::default())
        .manage(TerminalSupervisor::default())
        .manage(WorkspaceRoot::default())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            project_context,
            list_directory,
            open_file,
            terminal_exec,
            terminal_start,
            terminal_input,
            terminal_stop,
            project_id,
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
        list_directory_in, open_document_in, open_file_in, open_terminal_in, project_context_for,
        start_terminal_pty, terminal_exec_in, SidecarSupervisor, WorkspaceRoot,
    };
    use std::fs;

    fn fixture_root(name: &str) -> std::path::PathBuf {
        let root = std::env::temp_dir().join(format!("ade-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(&root).expect("create fixture root");
        root
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
        assert_eq!(context.working_tree, "detected");
        assert_eq!(
            context.repository_path,
            root.canonicalize().unwrap().to_string_lossy()
        );
        fs::remove_dir_all(root).expect("remove fixture");
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
    fn terminal_exec_returns_output_and_exit_code() {
        let root = fixture_root("terminal");
        let workspace = WorkspaceRoot::default();
        project_context_for(&workspace, &root.to_string_lossy()).expect("select root");
        let result = terminal_exec_in(
            &workspace,
            &root.to_string_lossy(),
            "printf ade".to_string(),
        )
        .expect("run terminal");
        assert_eq!(result.stdout, "ade");
        assert_eq!(result.exit_code, Some(0));
        fs::remove_dir_all(root).expect("remove fixture");
    }

    #[test]
    fn terminal_pty_runs_an_interactive_shell_command() {
        let root = fixture_root("terminal-pty");
        let (mut process, reader) = start_terminal_pty(&root).expect("start PTY");
        process
            .writer
            .write_all(b"printf ADE_PTY_OK\\nexit\\n")
            .expect("write PTY input");
        process.writer.flush().expect("flush PTY input");
        let (sender, receiver) = std::sync::mpsc::channel();
        std::thread::spawn(move || {
            let mut reader = reader;
            let mut output = String::new();
            let mut bytes = [0u8; 1024];
            loop {
                match reader.read(&mut bytes) {
                    Ok(0) | Err(_) => break,
                    Ok(size) => {
                        output.push_str(&String::from_utf8_lossy(&bytes[..size]));
                        if output.contains("ADE_PTY_OK") {
                            let _ = sender.send(output);
                            break;
                        }
                    }
                }
            }
        });
        let output = receiver
            .recv_timeout(std::time::Duration::from_secs(2))
            .expect("read PTY output before timeout");

        assert!(output.contains("ADE_PTY_OK"));
        let _ = process.child.kill();
        let _ = process.child.wait();
        fs::remove_dir_all(root).expect("remove fixture");
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
        let child = std::process::Command::new("sh")
            .args(["-c", "exit 0"])
            .spawn()
            .expect("spawn fixture");
        *supervisor.child.lock().expect("lock state") = Some(child);

        std::thread::sleep(std::time::Duration::from_millis(20));

        assert!(!supervisor.reap_finished().expect("status"));
    }

    #[test]
    fn sidecar_stop_handles_a_process_that_already_exited() {
        let supervisor = SidecarSupervisor::default();
        let child = std::process::Command::new("sh")
            .args(["-c", "exit 0"])
            .spawn()
            .expect("spawn fixture");
        *supervisor.child.lock().expect("lock state") = Some(child);

        std::thread::sleep(std::time::Duration::from_millis(20));

        supervisor.stop().expect("stop exited process");
        assert!(!supervisor.reap_finished().expect("status"));
    }
}
