use serde::Serialize;

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
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet, project_context])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::project_context;
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
}
