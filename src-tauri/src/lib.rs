pub mod commands;
pub mod db;
pub mod errors;

pub struct DbConn(pub std::sync::Mutex<rusqlite::Connection>);
