// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[cfg(feature = "app")]
fn main() {
    use std::sync::Mutex;
    use tauri::Manager;

    tauri::Builder::default()
        .setup(|app| {
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("failed to resolve app data dir");
            std::fs::create_dir_all(&app_data_dir)
                .expect("failed to create app data dir");
            let db_path = app_data_dir.join("arbor.db");
            let conn = match arbor_lib::db::open_or_init(&db_path) {
                Ok(c) => c,
                Err(e) => {
                    eprintln!("fatal: database initialisation failed: {e}");
                    std::process::exit(1);
                }
            };
            app.manage(arbor_lib::DbConn(Mutex::new(conn)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            arbor_lib::commands::trees::list_trees,
            arbor_lib::commands::trees::get_tree,
            arbor_lib::commands::graph::get_graph,
            arbor_lib::commands::graph::get_node,
            arbor_lib::commands::graph::get_graph_log,
            arbor_lib::commands::seed::seed_graph,
            arbor_lib::commands::seed::update_node_status,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(not(feature = "app"))]
fn main() {
    // Stub for test builds — the binary is not used, but Cargo still compiles it.
}
