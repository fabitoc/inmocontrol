use std::fs;
use std::path::{Path, PathBuf};

use chrono::Utc;
use rusqlite::Connection;

use crate::models::AppError;

/// Executes SQLite `VACUUM INTO` to create a consistent, defragmented snapshot of the live WAL database
/// inside `backups_dir`, and rotates older `.db` backups so at most `retention_days` (e.g. 30) files remain.
pub fn run_vacuum_into_backup(
    conn: &Connection,
    backups_dir: &Path,
    retention_days: usize,
) -> Result<PathBuf, AppError> {
    fs::create_dir_all(backups_dir)?;

    let now = Utc::now();
    let timestamp = now.format("%Y%m%d_%H%M%S_%3f").to_string();
    let mut backup_filename = format!("inmo_backup_{}.db", timestamp);
    let mut target_path = backups_dir.join(&backup_filename);

    // Ensure uniqueness if called multiple times within the same millisecond in tests
    let mut counter = 1u32;
    while target_path.exists() {
        backup_filename = format!("inmo_backup_{}_{}.db", timestamp, counter);
        target_path = backups_dir.join(&backup_filename);
        counter += 1;
    }

    let target_str = target_path.to_string_lossy().to_string();
    conn.execute("VACUUM INTO ?1", [target_str])?;

    prune_old_backups(backups_dir, retention_days)?;

    Ok(target_path)
}

/// Retains only the newest `retention_limit` `.db` files in `backups_dir`, sorted lexicographically
/// by filename (or modification time fallback), deleting older snapshots.
pub fn prune_old_backups(backups_dir: &Path, retention_limit: usize) -> Result<usize, AppError> {
    if retention_limit == 0 {
        return Ok(0);
    }

    let mut db_files: Vec<PathBuf> = fs::read_dir(backups_dir)?
        .filter_map(|entry| entry.ok())
        .map(|entry| entry.path())
        .filter(|path| {
            path.is_file()
                && path
                    .extension()
                    .and_then(|ext| ext.to_str())
                    .map(|ext| ext.eq_ignore_ascii_case("db"))
                    .unwrap_or(false)
        })
        .collect();

    if db_files.len() <= retention_limit {
        return Ok(0);
    }

    // Sort ascending by filename so oldest timestamped backups come first
    db_files.sort_by(|a, b| a.file_name().cmp(&b.file_name()));

    let remove_count = db_files.len().saturating_sub(retention_limit);
    let mut removed = 0usize;
    for old_path in db_files.into_iter().take(remove_count) {
        fs::remove_file(old_path)?;
        removed += 1;
    }

    Ok(removed)
}
