use serde::Serialize;
use std::io::{BufRead, BufReader, Write};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use tauri::{Emitter, Manager};

#[derive(Default)]
struct SidecarSupervisor {
    child: Mutex<Option<Child>>,
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
            process
                .kill()
                .map_err(|error| format!("Unable to stop sidecar: {error}"))?;
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

// Read-only bridge for the shell. Domain mutations remain in application
// use-cases; this command only exposes local repository context to the UI.
#[tauri::command]
fn project_context(repository_path: String) -> Result<ProjectContext, String> {
    let repository = std::path::Path::new(&repository_path);
    if !repository.is_dir() {
        return Err(format!("Repository does not exist: {repository_path}"));
    }

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
        repository_path,
        branch,
        working_tree: "detected".to_string(),
    })
}

#[tauri::command]
fn project_id() -> String {
    std::env::var("ADE_PROJECT_ID").unwrap_or_else(|_| "ade".to_string())
}

#[tauri::command]
fn sidecar_start(
    app: tauri::AppHandle,
    state: tauri::State<'_, SidecarSupervisor>,
) -> Result<(), String> {
    if state.reap_finished()? {
        return Ok(());
    }
    let node = std::env::var("ADE_SIDECAR_NODE").unwrap_or_else(|_| "node".to_string());
    let script = std::env::var("ADE_SIDECAR_SCRIPT")
        .map(std::path::PathBuf::from)
        .or_else(|_| {
            app.path()
                .resource_dir()
                .map(|directory| directory.join("sidecar-dist/desktop-sidecar.js"))
                .map_err(|error| error.to_string())
        })?;
    let database_path = std::env::var("ADE_DB_PATH")
        .map_err(|_| "ADE_DB_PATH must point to the ADE metadata database".to_string())?;
    let mut child = Command::new(node)
        .arg(script)
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
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            project_context,
            project_id,
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
    use super::{project_context, SidecarSupervisor};
    use std::fs;

    #[test]
    fn project_context_rejects_missing_repository() {
        let result = project_context("/path/that/cannot/exist/for/ade".to_string());

        assert!(result.is_err());
    }

    #[test]
    fn project_context_reads_repository_branch() {
        let root = std::env::temp_dir().join(format!("ade-project-context-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(root.join(".git")).expect("create fixture");
        fs::write(root.join(".git/HEAD"), "ref: refs/heads/feature/ui\n").expect("write head");

        let context = project_context(root.to_string_lossy().into_owned()).expect("read context");

        assert_eq!(context.name, root.file_name().unwrap().to_string_lossy());
        assert_eq!(context.branch, "feature/ui");
        assert_eq!(context.working_tree, "detected");
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
}
