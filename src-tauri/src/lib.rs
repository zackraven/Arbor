pub mod db;

#[cfg(not(test))]
use tauri::Manager;

#[cfg(not(test))]
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("failed to resolve app data dir");
            std::fs::create_dir_all(&app_data_dir)
                .expect("failed to create app data dir");
            let db_path = app_data_dir.join("arbor.db");
            if let Err(e) = db::open_or_init(&db_path) {
                eprintln!("fatal: database initialisation failed: {e}");
                std::process::exit(1);
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
