// Embedded HTTP server that shares a local folder of tab files over the LAN.
// The desktop ("host") runs this so a phone/browser on the same network can
// list and download tabs. Clients hit:
//   GET /api/tabs          -> [{ "path": "<relative>", "name": "<filename>" }]
//   GET /api/file?path=... -> raw file bytes
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use axum::{
    extract::{Query, State},
    http::{header, StatusCode},
    response::IntoResponse,
    routing::get,
    Json, Router,
};
use serde::{Deserialize, Serialize};
use tower_http::cors::CorsLayer;
use walkdir::WalkDir;

const SUPPORTED_EXTENSIONS: &[&str] = &[
    "gp", "gp3", "gp4", "gp5", "gpx", "gp7", "gp8", "musicxml", "xml", "mxl", "capx", "alphatab",
    "tex",
];

#[derive(Clone)]
pub struct LibraryState {
    pub folder: Arc<Mutex<Option<PathBuf>>>,
    pub port: u16,
}

#[derive(Serialize)]
pub struct TabEntry {
    pub path: String,
    pub name: String,
}

#[derive(Deserialize)]
struct FileQuery {
    path: String,
}

pub fn is_supported(path: &Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .map(|e| SUPPORTED_EXTENSIONS.contains(&e.to_lowercase().as_str()))
        .unwrap_or(false)
}

/// Recursively lists the supported tab files in `folder`, sorted by name.
/// Shared by the LAN server and the local-library command.
pub fn list_supported(folder: &Path) -> Vec<TabEntry> {
    let mut entries: Vec<TabEntry> = WalkDir::new(folder)
        .follow_links(false)
        .into_iter()
        .filter_map(Result::ok)
        .filter(|e| e.file_type().is_file() && is_supported(e.path()))
        .filter_map(|e| {
            let rel = e.path().strip_prefix(folder).ok()?;
            Some(TabEntry {
                path: rel.to_string_lossy().replace('\\', "/"),
                name: e.file_name().to_string_lossy().to_string(),
            })
        })
        .collect();

    entries.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    entries
}

async fn list_tabs(State(state): State<LibraryState>) -> impl IntoResponse {
    let folder = { state.folder.lock().unwrap().clone() };
    let Some(folder) = folder else {
        return Json(Vec::<TabEntry>::new());
    };
    Json(list_supported(&folder))
}

async fn get_file(
    State(state): State<LibraryState>,
    Query(q): Query<FileQuery>,
) -> Result<impl IntoResponse, StatusCode> {
    let folder = { state.folder.lock().unwrap().clone() };
    let folder = folder.ok_or(StatusCode::NOT_FOUND)?;

    let base = folder.canonicalize().map_err(|_| StatusCode::NOT_FOUND)?;
    let requested = base.join(&q.path);
    let canon = requested.canonicalize().map_err(|_| StatusCode::NOT_FOUND)?;

    // Guard against path traversal outside the shared folder.
    if !canon.starts_with(&base) {
        return Err(StatusCode::FORBIDDEN);
    }
    if !is_supported(&canon) {
        return Err(StatusCode::FORBIDDEN);
    }

    let bytes = tokio::fs::read(&canon)
        .await
        .map_err(|_| StatusCode::NOT_FOUND)?;

    Ok((
        [(header::CONTENT_TYPE, "application/octet-stream")],
        bytes,
    ))
}

async fn root() -> impl IntoResponse {
    "DodoTabs library server. Open this address in the DodoTabs app to browse tabs."
}

/// Spawns the server on its own thread/Tokio runtime. Tries the preferred port
/// first, then a small range, binding once inside the server runtime and reporting
/// the bound port back to the caller. Returns the port it actually bound to.
pub fn spawn(state: LibraryState) -> std::io::Result<u16> {
    let candidates: Vec<u16> = (state.port..state.port + 8).collect();
    let (tx, rx) = std::sync::mpsc::channel::<std::io::Result<u16>>();

    let app = Router::new()
        .route("/", get(root))
        .route("/api/tabs", get(list_tabs))
        .route("/api/file", get(get_file))
        .layer(CorsLayer::permissive())
        .with_state(state);

    std::thread::spawn(move || {
        let rt = match tokio::runtime::Builder::new_multi_thread()
            .enable_all()
            .build()
        {
            Ok(rt) => rt,
            Err(e) => {
                let _ = tx.send(Err(e));
                return;
            }
        };

        rt.block_on(async move {
            let mut listener = None;
            for port in &candidates {
                if let Ok(l) = tokio::net::TcpListener::bind(("0.0.0.0", *port)).await {
                    listener = Some(l);
                    break;
                }
            }
            let listener = match listener {
                Some(l) => l,
                None => {
                    let _ = tx.send(Err(std::io::Error::new(
                        std::io::ErrorKind::AddrInUse,
                        "no free port for library server",
                    )));
                    return;
                }
            };

            let port = listener.local_addr().map(|a| a.port());
            let _ = tx.send(port);

            if let Err(e) = axum::serve(listener, app).await {
                eprintln!("library server stopped: {e}");
            }
        });
    });

    rx.recv()
        .map_err(|_| std::io::Error::new(std::io::ErrorKind::Other, "library server thread died"))?
}
