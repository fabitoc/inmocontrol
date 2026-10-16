use std::path::PathBuf;
use std::sync::Mutex;

use rusqlite::Connection;

use crate::backup::run_vacuum_into_backup;
use crate::db;
use crate::models::{
    AppError, MaintenanceExpense, NewContractInput, NewMaintenanceInput, NewOwnerInput,
    NewPropertyInput, NewRentPaymentInput, Owner, OwnerDashboardBundle, Property, RentPayment,
    Settlement, TenantContract,
};
use crate::paths::AppPaths;

/// Thread-safe application state managing the local SQLite WAL connection and `%LocalAppData%\InmoControl\` paths.
pub struct InmoAppState {
    pub paths: AppPaths,
    pub conn: Mutex<Connection>,
}

impl InmoAppState {
    /// Initializes the local application state under `%LocalAppData%\InmoControl\`,
    /// activates SQLite `WAL` mode, seeds initial data if empty, and runs the startup `VACUUM INTO` backup.
    pub fn initialize_default() -> Result<Self, AppError> {
        let paths = AppPaths::resolve_default()?;
        Self::initialize_with_paths(paths)
    }

    /// Initializes the engine with explicit `AppPaths` (used for both desktop runtime and isolated tests).
    pub fn initialize_with_paths(paths: AppPaths) -> Result<Self, AppError> {
        let mut conn = db::init_database(&paths.db_file)?;
        db::seed_if_empty(&mut conn)?;
        // Run startup VACUUM INTO snapshot with 30-day retention rotation
        let _ = run_vacuum_into_backup(&conn, &paths.backups_dir, 30);

        Ok(Self {
            paths,
            conn: Mutex::new(conn),
        })
    }

    /// Executes the shutdown `VACUUM INTO` backup with 30-day rotation.
    pub fn on_shutdown_backup(&self) -> Result<PathBuf, AppError> {
        let guard = self
            .conn
            .lock()
            .map_err(|_| AppError::Domain("Database mutex poisoned".to_string()))?;
        run_vacuum_into_backup(&guard, &self.paths.backups_dir, 30)
    }
}

/// IPC command: lists all registered property owners.
pub fn list_owners(state: &InmoAppState) -> Result<Vec<Owner>, AppError> {
    let guard = state
        .conn
        .lock()
        .map_err(|_| AppError::Domain("Database mutex poisoned".to_string()))?;
    db::list_owners(&guard)
}

/// IPC command: retrieves the <300ms single-read analytical bundle for the selected owner.
pub fn get_owner_dashboard_bundle(
    state: &InmoAppState,
    owner_id: i64,
) -> Result<OwnerDashboardBundle, AppError> {
    let guard = state
        .conn
        .lock()
        .map_err(|_| AppError::Domain("Database mutex poisoned".to_string()))?;
    db::get_owner_dashboard_bundle(&guard, owner_id)
}

/// IPC command: registers a new property owner.
pub fn create_owner(state: &InmoAppState, input: NewOwnerInput) -> Result<Owner, AppError> {
    let guard = state
        .conn
        .lock()
        .map_err(|_| AppError::Domain("Database mutex poisoned".to_string()))?;
    db::create_owner(&guard, &input)
}

/// IPC command: registers a new matrix property or child sub-unit (`parent_property_id`).
pub fn create_property(
    state: &InmoAppState,
    input: NewPropertyInput,
) -> Result<Property, AppError> {
    let guard = state
        .conn
        .lock()
        .map_err(|_| AppError::Domain("Database mutex poisoned".to_string()))?;
    db::create_property(&guard, &input)
}

/// IPC command: creates a new tenant lease contract and marks the property as `OCUPADO`.
pub fn create_tenant_contract(
    state: &InmoAppState,
    input: NewContractInput,
) -> Result<TenantContract, AppError> {
    let mut guard = state
        .conn
        .lock()
        .map_err(|_| AppError::Domain("Database mutex poisoned".to_string()))?;
    db::create_contract(&mut guard, &input)
}

/// IPC command: records a monthly rent payment for a property and contract.
pub fn record_rent_payment(
    state: &InmoAppState,
    input: NewRentPaymentInput,
) -> Result<RentPayment, AppError> {
    let guard = state
        .conn
        .lock()
        .map_err(|_| AppError::Domain("Database mutex poisoned".to_string()))?;
    db::create_rent_payment(&guard, &input)
}

/// IPC command: creates a maintenance expense with local evidence paths (`Por Liquidar`, 1:1 net cost).
pub fn create_maintenance_expense(
    state: &InmoAppState,
    input: NewMaintenanceInput,
) -> Result<MaintenanceExpense, AppError> {
    let guard = state
        .conn
        .lock()
        .map_err(|_| AppError::Domain("Database mutex poisoned".to_string()))?;
    db::create_maintenance_expense(&guard, &input)
}

/// IPC command: executes a transactional monthly owner settlement (`BEGIN TRANSACTION ... COMMIT`).
pub fn execute_monthly_settlement(
    state: &InmoAppState,
    owner_id: i64,
    period_month: String,
) -> Result<Settlement, AppError> {
    let mut guard = state
        .conn
        .lock()
        .map_err(|_| AppError::Domain("Database mutex poisoned".to_string()))?;
    db::execute_monthly_settlement(&mut guard, owner_id, &period_month)
}

/// IPC command: executes a transactional property handover (`BEGIN TRANSACTION ... COMMIT`),
/// terminating active contracts and setting the property status to `DISPONIBLE`.
pub fn execute_property_handover(
    state: &InmoAppState,
    property_id: i64,
) -> Result<(), AppError> {
    let mut guard = state
        .conn
        .lock()
        .map_err(|_| AppError::Domain("Database mutex poisoned".to_string()))?;
    db::execute_property_handover(&mut guard, property_id)
}

/// IPC command: triggers an immediate `VACUUM INTO` backup in `%LocalAppData%\InmoControl\backups\` with 30-day rotation.
pub fn run_manual_backup(state: &InmoAppState) -> Result<String, AppError> {
    let path = state.on_shutdown_backup()?;
    Ok(path.to_string_lossy().to_string())
}
