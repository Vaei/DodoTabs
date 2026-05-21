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
            read_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
