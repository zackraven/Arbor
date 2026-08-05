use serde::ser::SerializeStruct;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("db.not_found: {0}")]
    NotFound(String),
    #[error("graph.duplicate_node: {0}")]
    DuplicateNode(String),
    #[error("graph.self_loop: {0}")]
    SelfLoop(String),
    #[error("graph.cycle_detected: {0}")]
    CycleDetected(String),
    #[error("graph.dangling_edge: {0}")]
    DanglingEdge(String),
    #[error("graph.invalid_status_transition: {0}")]
    InvalidStatusTransition(String),
    #[error("db.internal: {0}")]
    Internal(String),
}

impl AppError {
    fn code(&self) -> &'static str {
        match self {
            AppError::NotFound(_) => "db.not_found",
            AppError::DuplicateNode(_) => "graph.duplicate_node",
            AppError::SelfLoop(_) => "graph.self_loop",
            AppError::CycleDetected(_) => "graph.cycle_detected",
            AppError::DanglingEdge(_) => "graph.dangling_edge",
            AppError::InvalidStatusTransition(_) => "graph.invalid_status_transition",
            AppError::Internal(_) => "db.internal",
        }
    }

    fn message(&self) -> String {
        match self {
            AppError::NotFound(m)
            | AppError::DuplicateNode(m)
            | AppError::SelfLoop(m)
            | AppError::CycleDetected(m)
            | AppError::DanglingEdge(m)
            | AppError::InvalidStatusTransition(m)
            | AppError::Internal(m) => m.clone(),
        }
    }
}

impl serde::Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        let mut s = serializer.serialize_struct("AppError", 2)?;
        s.serialize_field("code", self.code())?;
        s.serialize_field("message", &self.message())?;
        s.end()
    }
}
