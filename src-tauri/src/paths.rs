use std::env;
use std::fs;
use std::path::{Path, PathBuf};

use crate::models::AppError;

/// Resolved local filesystem paths under `%LocalAppData%\InmoControl\`.
#[derive(Debug, Clone)]
pub struct AppPaths {
    pub root_dir: PathBuf,
    pub data_dir: PathBuf,
    pub db_file: PathBuf,
    pub evidencias_dir: PathBuf,
    pub backups_dir: PathBuf,
}

impl AppPaths {
    /// Resolves `%LocalAppData%\InmoControl\` subdirectories (`data\inmo_database.db`, `evidencias\`, `backups\`)
    /// and ensures all directories exist on disk.
    pub fn resolve_default() -> Result<Self, AppError> {
        let base = env::var_os("LOCALAPPDATA")
            .map(PathBuf::from)
            .or_else(|| env::var_os("HOME").map(|h| PathBuf::from(h).join(".local").join("share")))
            .unwrap_or_else(|| env::temp_dir());

        Self::from_root(base.join("InmoControl"))
    }

    /// Resolves application paths rooted at a custom directory (useful for isolated tests).
    pub fn from_root(root_dir: PathBuf) -> Result<Self, AppError> {
        let data_dir = root_dir.join("data");
        let db_file = data_dir.join("inmo_database.db");
        let evidencias_dir = root_dir.join("evidencias");
        let backups_dir = root_dir.join("backups");

        fs::create_dir_all(&data_dir)?;
        fs::create_dir_all(&evidencias_dir)?;
        fs::create_dir_all(&backups_dir)?;

        Ok(Self {
            root_dir,
            data_dir,
            db_file,
            evidencias_dir,
            backups_dir,
        })
    }

    /// Copies or writes an evidence image into `%LocalAppData%\InmoControl\evidencias\`
    /// and returns the normalized relative path `evidencias/<filename>`.
    pub fn store_evidence_bytes(
        &self,
        filename: &str,
        bytes: &[u8],
    ) -> Result<String, AppError> {
        let sanitized = sanitize_filename(filename);
        let dest_path = self.evidencias_dir.join(&sanitized);
        fs::write(&dest_path, bytes)?;
        Ok(format!("evidencias/{}", sanitized))
    }

    /// Copies an existing image file from disk into `%LocalAppData%\InmoControl\evidencias\`
    /// and returns the normalized relative path `evidencias/<filename>`.
    pub fn copy_evidence_file(&self, source_path: &Path) -> Result<String, AppError> {
        let raw_name = source_path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("evidence_capture.jpg");
        let sanitized = sanitize_filename(raw_name);
        let dest_path = self.evidencias_dir.join(&sanitized);
        fs::copy(source_path, &dest_path)?;
        Ok(format!("evidencias/{}", sanitized))
    }
}

/// Strips path traversal characters and normalizes spaces to underscores.
pub fn sanitize_filename(name: &str) -> String {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return "evidence_file.jpg".to_string();
    }
    trimmed
        .chars()
        .map(|c| match c {
            'a'..='z' | 'A'..='Z' | '0'..='9' | '.' | '-' | '_' => c,
            _ => '_',
        })
        .collect()
}
