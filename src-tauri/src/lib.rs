mod server;

use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use serde::Serialize;
use server::LibraryState;
use tauri::{Manager, State};

const DEFAULT_PORT: u16 = 8088;

#[derive(Serialize)]
pub struct LibraryStatus {
    folder: Option<String>,
    url: Option<String>,
}

/// Shared app state: the running server's bound port (0 until started) and the folder.
struct AppState {
    library: LibraryState,
    bound_port: Mutex<Option<u16>>,
}

fn lan_url(port: u16) -> Option<String> {
    local_ip_address::local_ip()
        .ok()
        .map(|ip| format!("http://{ip}:{port}"))
}

fn current_status(app: &AppState) -> LibraryStatus {
    let folder = app
        .library
        .folder
        .lock()
        .unwrap()
        .clone()
        .map(|p| p.to_string_lossy().to_string());
    let url = app.bound_port.lock().unwrap().and_then(lan_url);
    LibraryStatus { folder, url }
}

/// Sets the shared folder and ensures the LAN server is running.
#[tauri::command]
fn start_library_server(
    state: State<'_, AppState>,
    folder: String,
) -> Result<LibraryStatus, String> {
    let path = PathBuf::from(&folder);
    if !path.is_dir() {
        return Err("Selected path is not a folder".into());
    }
    *state.library.folder.lock().unwrap() = Some(path);

    // Start the server lazily on first use.
    let already_running = state.bound_port.lock().unwrap().is_some();
    if !already_running {
        let port = server::spawn(state.library.clone()).map_err(|e| e.to_string())?;
        *state.bound_port.lock().unwrap() = Some(port);
    }

    Ok(current_status(&state))
}

#[tauri::command]
fn get_library_status(state: State<'_, AppState>) -> LibraryStatus {
    current_status(&state)
}

/// Reads a local file the user picked via the native dialog. Returns raw bytes.
#[tauri::command]
fn read_file(path: String) -> Result<Vec<u8>, String> {
    std::fs::read(&path).map_err(|e| e.to_string())
}

/// Resolves (and creates) the app's own library folder. Used on Android, where
/// arbitrary user folders aren't writable, as the destination for downloaded tabs.
#[tauri::command]
fn default_library_dir(app: tauri::AppHandle) -> Result<String, String> {
    let base = app
        .path()
        .app_local_data_dir()
        .map_err(|e| e.to_string())?;
    let dir = base.join("library");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.to_string_lossy().to_string())
}

/// Strips any path components and characters that are illegal in file names,
/// so a downloaded tab always lands as a flat file inside the library folder.
fn safe_file_name(name: &str) -> String {
    name.rsplit(['/', '\\'])
        .next()
        .unwrap_or(name)
        .chars()
        .filter(|c| !matches!(c, '<' | '>' | ':' | '"' | '|' | '?' | '*' | '\0'))
        .collect::<String>()
        .trim()
        .to_string()
}

/// Writes downloaded tab bytes into the local library folder. Returns the path.
#[tauri::command]
fn save_tab(dir: String, name: String, bytes: Vec<u8>) -> Result<String, String> {
    let dirp = PathBuf::from(&dir);
    std::fs::create_dir_all(&dirp).map_err(|e| e.to_string())?;
    let fname = safe_file_name(&name);
    if fname.is_empty() {
        return Err("Invalid file name".into());
    }
    let dest = dirp.join(&fname);
    std::fs::write(&dest, &bytes).map_err(|e| e.to_string())?;
    Ok(dest.to_string_lossy().to_string())
}

/// Lists the supported tab files already saved in the local library folder.
#[tauri::command]
fn list_local_tabs(dir: String) -> Vec<server::TabEntry> {
    let p = PathBuf::from(&dir);
    if p.is_dir() {
        server::list_supported(&p)
    } else {
        Vec::new()
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            app.manage(AppState {
                library: LibraryState {
                    folder: Arc::new(Mutex::new(None)),
                    port: DEFAULT_PORT,
                },
                bound_port: Mutex::new(None),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            start_library_server,
            get_library_status,
            read_file,
            default_library_dir,
            save_tab,
            list_local_tabs
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
