use std::path::Path;

use rusqlite::{params, Connection};

use crate::models::{
    AppError, MaintenanceExpense, NewContractInput, NewMaintenanceInput, NewOwnerInput,
    NewPropertyInput, NewRentPaymentInput, Owner, OwnerDashboardBundle, Property, RentPayment,
    Settlement, TenantContract,
};

/// Opens a SQLite database connection at `db_path`, enforces `WAL` mode, `synchronous = NORMAL`,
/// and `foreign_keys = ON`, and initializes Schema v4.0.
pub fn init_database(db_path: &Path) -> Result<Connection, AppError> {
    if let Some(parent) = db_path.parent() {
        std::fs::create_dir_all(parent)?;
    }

    let conn = Connection::open(db_path)?;
    configure_pragmas(&conn)?;
    create_schema_v4(&conn)?;
    Ok(conn)
}

/// Applies required SQLite performance and relational integrity PRAGMAs.
pub fn configure_pragmas(conn: &Connection) -> Result<String, AppError> {
    let journal_mode: String =
        conn.query_row("PRAGMA journal_mode = WAL;", [], |row| row.get(0))?;
    conn.execute_batch(
        "PRAGMA synchronous = NORMAL;
         PRAGMA foreign_keys = ON;
         PRAGMA temp_store = MEMORY;",
    )?;
    Ok(journal_mode)
}

/// Queries the active `PRAGMA journal_mode` on the connection.
pub fn get_journal_mode(conn: &Connection) -> Result<String, AppError> {
    let mode: String = conn.query_row("PRAGMA journal_mode;", [], |row| row.get(0))?;
    Ok(mode)
}

/// Creates Schema v4.0 tables and high-performance analytical indexes (`<300ms` owner filter target).
pub fn create_schema_v4(conn: &Connection) -> Result<(), AppError> {
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS owners (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            document_id TEXT NOT NULL UNIQUE,
            phone TEXT NOT NULL,
            email TEXT NOT NULL,
            bank_name TEXT NOT NULL,
            bank_account_type TEXT NOT NULL,
            bank_account_number TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS properties (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            owner_id INTEGER NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
            parent_property_id INTEGER REFERENCES properties(id) ON DELETE SET NULL,
            code TEXT NOT NULL UNIQUE,
            title TEXT NOT NULL,
            address TEXT NOT NULL,
            property_type TEXT NOT NULL,
            base_rent_cop INTEGER NOT NULL DEFAULT 0,
            commission_pct REAL NOT NULL DEFAULT 8.0,
            fixed_fee_cop INTEGER NOT NULL DEFAULT 0,
            cutoff_day INTEGER NOT NULL DEFAULT 5,
            status TEXT NOT NULL DEFAULT 'DISPONIBLE' CHECK (status IN ('DISPONIBLE', 'OCUPADO')),
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS tenant_contracts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
            tenant_name TEXT NOT NULL,
            tenant_document TEXT NOT NULL,
            guarantor_name TEXT NOT NULL,
            phone TEXT NOT NULL,
            monthly_rent_cop INTEGER NOT NULL,
            start_date TEXT NOT NULL,
            end_date TEXT NOT NULL,
            cutoff_day INTEGER NOT NULL DEFAULT 5,
            status TEXT NOT NULL DEFAULT 'ACTIVO' CHECK (status IN ('ACTIVO', 'FINALIZADO', 'MORA')),
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS rent_payments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            contract_id INTEGER NOT NULL REFERENCES tenant_contracts(id) ON DELETE CASCADE,
            property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
            period_month TEXT NOT NULL,
            gross_amount_cop INTEGER NOT NULL,
            payment_date TEXT NOT NULL,
            payment_method TEXT NOT NULL,
            reference_code TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'PAGADO' CHECK (status IN ('PAGADO', 'PENDIENTE', 'MORA'))
        );

        CREATE TABLE IF NOT EXISTS maintenance_expenses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
            execution_date TEXT NOT NULL,
            category TEXT NOT NULL,
            description TEXT NOT NULL,
            technician_name TEXT NOT NULL,
            invoice_number TEXT NOT NULL,
            net_cost_cop INTEGER NOT NULL,
            receipt_image_path TEXT NOT NULL DEFAULT '',
            evidence_images_paths TEXT NOT NULL DEFAULT '[]',
            deduction_status TEXT NOT NULL DEFAULT 'Por Liquidar' CHECK (deduction_status IN ('Por Liquidar', 'Liquidado')),
            settlement_id INTEGER REFERENCES settlements(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS settlements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            owner_id INTEGER NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
            period_month TEXT NOT NULL,
            gross_income_cop INTEGER NOT NULL,
            commission_amount_cop INTEGER NOT NULL,
            fixed_fee_amount_cop INTEGER NOT NULL,
            maintenance_deduction_cop INTEGER NOT NULL,
            net_payable_cop INTEGER NOT NULL,
            sha256_seal TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'EJECUTADO' CHECK (status IN ('EJECUTADO')),
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_properties_owner ON properties(owner_id);
        CREATE INDEX IF NOT EXISTS idx_properties_parent ON properties(parent_property_id);
        CREATE INDEX IF NOT EXISTS idx_maintenance_property_status ON maintenance_expenses(property_id, deduction_status);
        CREATE INDEX IF NOT EXISTS idx_payments_property_period ON rent_payments(property_id, period_month);
        ",
    )?;
    Ok(())
}

/// Strictly computes the mixed agency commission formula:
/// `percentage_fee_cop = round(Gross Income * (Commission % / 100.0))`
/// `total_agency_fee_cop = percentage_fee_cop + Base Fixed Fee`
/// Returns `(percentage_fee_cop, total_agency_fee_cop)`.
pub fn calculate_property_commission(
    gross_income_cop: i64,
    commission_pct: f64,
    fixed_fee_cop: i64,
) -> (i64, i64) {
    let pct_fee = ((gross_income_cop as f64) * (commission_pct / 100.0)).round() as i64;
    let total_fee = pct_fee + fixed_fee_cop;
    (pct_fee, total_fee)
}

/// Generates a deterministic hexadecimal integrity seal for a monthly settlement statement.
pub fn compute_settlement_seal(
    owner_id: i64,
    period_month: &str,
    gross_income_cop: i64,
    commission_amount_cop: i64,
    fixed_fee_amount_cop: i64,
    maintenance_deduction_cop: i64,
    net_payable_cop: i64,
) -> String {
    let payload = format!(
        "INMOCONTROL-V2|OWNER:{}|PERIOD:{}|GROSS:{}|COMM:{}|FIXED:{}|MAINT:{}|NET:{}",
        owner_id,
        period_month,
        gross_income_cop,
        commission_amount_cop,
        fixed_fee_amount_cop,
        maintenance_deduction_cop,
        net_payable_cop
    );
    // FNV-1a 64-bit stream rounds to produce a deterministic 64-char hex seal without external native OpenSSL deps
    let mut h1: u64 = 0xcbf29ce484222325;
    let mut h2: u64 = 0x84222325cbf29ce4;
    let mut h3: u64 = 0x517cc1b727220a95;
    let mut h4: u64 = 0x27220a95517cc1b7;
    for (idx, b) in payload.bytes().enumerate() {
        h1 ^= b as u64;
        h1 = h1.wrapping_mul(0x100000001b3);
        h2 ^= (b as u64).wrapping_add(idx as u64);
        h2 = h2.wrapping_mul(0x100000001b3);
        h3 ^= (b as u64).rotate_left((idx % 8) as u32);
        h3 = h3.wrapping_mul(0x100000001b3);
        h4 ^= (b as u64) ^ (h1 & 0xff);
        h4 = h4.wrapping_mul(0x100000001b3);
    }
    format!("0x{:016x}{:016x}{:016x}{:016x}", h1, h2, h3, h4)
}

/// Populates deterministic Colombian real-estate seed data if the `owners` table is empty.
pub fn seed_if_empty(conn: &mut Connection) -> Result<bool, AppError> {
    let count: i64 = conn.query_row("SELECT COUNT(*) FROM owners;", [], |row| row.get(0))?;
    if count > 0 {
        return Ok(false);
    }

    let tx = conn.transaction()?;

    // 1. Seed 3 Owners matching the PRD & Stitch designs
    tx.execute(
        "INSERT INTO owners (id, name, document_id, phone, email, bank_name, bank_account_type, bank_account_number, created_at)
         VALUES
         (1, 'Fabián Vargas Correa', 'CC 79.452.810', '+57 310 458 9210', 'fvargas@inmocontrol.co', 'Bancolombia', 'AHORROS', '412-889012-44', '2026-01-10T08:00:00Z'),
         (2, 'Inversiones Delta S.A.S', 'NIT 900.412.889-1', '+57 315 881 2030', 'gerencia@inversionesdelta.co', 'Banco de Bogotá', 'CORRIENTE', '091-334510-01', '2026-01-12T09:30:00Z'),
         (3, 'Carlos A. Montoya', 'CC 71.688.320', '+57 300 612 7741', 'cmontoya@patrimonio.co', 'Davivienda', 'AHORROS', '0550-7712-9901', '2026-02-01T10:15:00Z');",
        [],
    )?;

    // 2. Seed Properties including Matrix/Parent Buildings and Sub-units
    // Owner 1: Fabián Vargas Correa -> Parent Building (id=1) + 3 sub-units (ids 2, 3, 4) + 1 standalone house (id=5)
    tx.execute(
        "INSERT INTO properties (id, owner_id, parent_property_id, code, title, address, property_type, base_rent_cop, commission_pct, fixed_fee_cop, cutoff_day, status, created_at)
         VALUES
         (1, 1, NULL, 'MAT-FACA-001', 'Edificio Central Facatativá', 'Cra 2 # 5-48 Centro, Facatativá', 'EDIFICIO MATRIZ', 0, 8.0, 0, 5, 'OCUPADO', '2026-01-15T08:00:00Z'),
         (2, 1, 1, 'SUB-FACA-101', 'Torre 1 - Apto 101', 'Cra 2 # 5-48 Apto 101, Facatativá', 'APARTAMENTO', 1500000, 8.0, 45000, 5, 'OCUPADO', '2026-01-15T08:10:00Z'),
         (3, 1, 1, 'SUB-FACA-102', 'Torre 1 - Apto 102', 'Cra 2 # 5-48 Apto 102, Facatativá', 'APARTAMENTO', 1450000, 8.0, 45000, 5, 'DISPONIBLE', '2026-01-15T08:20:00Z'),
         (4, 1, 1, 'SUB-FACA-LOC1', 'Local Esquinero 01', 'Cra 2 # 5-48 Local 1, Facatativá', 'LOCAL COMERCIAL', 2800000, 10.0, 60000, 5, 'OCUPADO', '2026-01-15T08:30:00Z'),
         (5, 1, NULL, 'IND-CHAP-204', 'Bodega Logística Sabana', 'Km 3 Vía Occidente, Mosquera', 'BODEGA', 4200000, 8.0, 85000, 10, 'OCUPADO', '2026-01-18T11:00:00Z'),
         (6, 2, NULL, 'MAT-POB-010', 'Complejo Empresarial Poblado', 'Av. El Poblado # 10-80, Medellín', 'EDIFICIO MATRIZ', 0, 9.0, 0, 5, 'OCUPADO', '2026-01-20T09:00:00Z'),
         (7, 2, 6, 'SUB-POB-301', 'Oficina 301 Ejecutiva', 'Av. El Poblado # 10-80 Of. 301', 'OFICINA', 3600000, 9.0, 70000, 5, 'OCUPADO', '2026-01-20T09:15:00Z'),
         (8, 2, 6, 'SUB-POB-302', 'Oficina 302 Co-Working', 'Av. El Poblado # 10-80 Of. 302', 'OFICINA', 3200000, 9.0, 70000, 5, 'OCUPADO', '2026-01-20T09:20:00Z'),
         (9, 3, NULL, 'RES-LAUR-08', 'Penthouse Laureles Nogal', 'Circular 4 # 72-19, Medellín', 'APARTAMENTO', 4100000, 8.5, 50000, 5, 'OCUPADO', '2026-02-05T10:00:00Z');",
        [],
    )?;

    // 3. Seed Tenant Contracts (Active & Overdue/MORA)
    tx.execute(
        "INSERT INTO tenant_contracts (id, property_id, tenant_name, tenant_document, guarantor_name, phone, monthly_rent_cop, start_date, end_date, cutoff_day, status, created_at)
         VALUES
         (1, 2, 'Alejandro Ruiz Betancur', 'CC 1.070.982.114', 'Marta Betancur Gómez', '+57 311 224 8901', 1500000, '2026-02-01', '2027-01-31', 5, 'ACTIVO', '2026-02-01T09:00:00Z'),
         (2, 4, 'Droguerías Salud Total S.A.S', 'NIT 830.114.992-4', 'Seguros Sura Póliza #8812', '+57 318 776 5510', 2800000, '2026-01-01', '2026-12-31', 5, 'ACTIVO', '2026-01-01T10:00:00Z'),
         (3, 5, 'Logística Andina Express Ltda', 'NIT 901.229.301-8', 'Libertador Fianza #44910', '+57 320 991 3402', 4200000, '2026-01-10', '2027-01-09', 10, 'MORA', '2026-01-10T14:00:00Z'),
         (4, 7, 'Consultores Tech Finanzas S.A.S', 'NIT 900.881.112-3', 'Aseguradora El Cóndor', '+57 314 509 1122', 3600000, '2026-02-01', '2027-01-31', 5, 'ACTIVO', '2026-02-01T11:00:00Z'),
         (5, 8, 'Estudio Creativo Nébula', 'NIT 901.552.710-2', 'Camilo Restrepo Jaramillo', '+57 301 445 9980', 3200000, '2026-03-01', '2027-02-28', 5, 'ACTIVO', '2026-03-01T11:30:00Z'),
         (6, 9, 'Dra. Valentina Ospina', 'CC 43.998.120', 'Roberto Ospina Calle', '+57 312 678 0091', 4100000, '2026-02-05', '2027-02-04', 5, 'ACTIVO', '2026-02-05T12:00:00Z');",
        [],
    )?;

    // 4. Seed Rent Payments for period 2026-10
    tx.execute(
        "INSERT INTO rent_payments (id, contract_id, property_id, period_month, gross_amount_cop, payment_date, payment_method, reference_code, status)
         VALUES
         (1, 1, 2, '2026-10', 1500000, '2026-10-04', 'TRANSFERENCIA PSE', 'PSE-992014-FACA', 'PAGADO'),
         (2, 2, 4, '2026-10', 2800000, '2026-10-05', 'CONSIGNACIÓN BANCARIA', 'BANCOL-774120', 'PAGADO'),
         (3, 3, 5, '2026-10', 4200000, '2026-10-10', 'PENDIENTE TRANSFERENCIA', 'MORA-2026-10-BOD', 'MORA'),
         (4, 4, 7, '2026-10', 3600000, '2026-10-03', 'TRANSFERENCIA ACH', 'ACH-884120-POB', 'PAGADO'),
         (5, 5, 8, '2026-10', 3200000, '2026-10-05', 'TRANSFERENCIA PSE', 'PSE-551209-POB', 'PAGADO'),
         (6, 6, 9, '2026-10', 4100000, '2026-10-04', 'TRANSFERENCIA BANCARIA', 'DAV-339104-LAU', 'PAGADO');",
        [],
    )?;

    // 5. Seed Maintenance Expenses (both 'Por Liquidar' and 'Liquidado') with local relative evidence paths
    tx.execute(
        "INSERT INTO maintenance_expenses (id, property_id, execution_date, category, description, technician_name, invoice_number, net_cost_cop, receipt_image_path, evidence_images_paths, deduction_status, settlement_id)
         VALUES
         (1, 2, '2026-10-08', 'PLOMERÍA HIDRÁULICA', 'Reemplazo de válvula de presión y sello sifón cocina principal', 'Ing. Hernando Téllez', 'FAC-8821', 285000, 'evidencias/recibo_plomeria_101.jpg', '[\"evidencias/valvula_antes_101.jpg\",\"evidencias/valvula_despues_101.jpg\"]', 'Por Liquidar', NULL),
         (2, 4, '2026-10-11', 'ELÉCTRICO // TABLERO', 'Cambio de breaker trifásico 40A y balanceo de carga iluminación comercial', 'Técnicos Eléctricos Sabana', 'FE-4092', 340000, 'evidencias/recibo_electrico_loc1.jpg', '[\"evidencias/tablero_loc1_ev1.jpg\"]', 'Por Liquidar', NULL),
         (3, 2, '2026-09-14', 'IMPERMEABILIZACIÓN', 'Sellado acrílico de terraza y bajante pluvial', 'Soluciones Civiles Cundinamarca', 'FAC-7710', 420000, 'evidencias/recibo_imper_sep.jpg', '[\"evidencias/terraza_sep_01.jpg\"]', 'Liquidado', NULL),
         (4, 7, '2026-10-09', 'AIRE ACONDICIONADO', 'Mantenimiento preventivo unidad Chiller y recarga refrigerante R410A', 'ClimaTech Medellín S.A.S', 'CM-1904', 510000, 'evidencias/recibo_hvac_301.jpg', '[\"evidencias/chiller_301_a.jpg\",\"evidencias/chiller_301_b.jpg\"]', 'Por Liquidar', NULL);",
        [],
    )?;

    // 6. Seed historical Settlement for 2026-09 on Owner 1
    let hist_seal = compute_settlement_seal(1, "2026-09", 4300000, 400000, 105000, 420000, 3375000);
    tx.execute(
        "INSERT INTO settlements (id, owner_id, period_month, gross_income_cop, commission_amount_cop, fixed_fee_amount_cop, maintenance_deduction_cop, net_payable_cop, sha256_seal, status, created_at)
         VALUES (1, 1, '2026-09', 4300000, 400000, 105000, 420000, 3375000, ?1, 'EJECUTADO', '2026-09-30T17:45:00Z');",
        params![hist_seal],
    )?;

    tx.execute(
        "UPDATE maintenance_expenses SET settlement_id = 1 WHERE id = 3;",
        [],
    )?;

    tx.commit()?;
    Ok(true)
}

/// Lists all registered owners ordered by ID.
pub fn list_owners(conn: &Connection) -> Result<Vec<Owner>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT id, name, document_id, phone, email, bank_name, bank_account_type, bank_account_number, created_at
         FROM owners
         ORDER BY id ASC;",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(Owner {
            id: row.get(0)?,
            name: row.get(1)?,
            document_id: row.get(2)?,
            phone: row.get(3)?,
            email: row.get(4)?,
            bank_name: row.get(5)?,
            bank_account_type: row.get(6)?,
            bank_account_number: row.get(7)?,
            created_at: row.get(8)?,
        })
    })?;
    rows.collect::<Result<Vec<_>, _>>().map_err(AppError::from)
}

/// Inserts a new owner and returns the persisted record.
pub fn create_owner(conn: &Connection, input: &NewOwnerInput) -> Result<Owner, AppError> {
    conn.execute(
        "INSERT INTO owners (name, document_id, phone, email, bank_name, bank_account_type, bank_account_number)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7);",
        params![
            input.name,
            input.document_id,
            input.phone,
            input.email,
            input.bank_name,
            input.bank_account_type,
            input.bank_account_number
        ],
    )?;
    let id = conn.last_insert_rowid();
    conn.query_row(
        "SELECT id, name, document_id, phone, email, bank_name, bank_account_type, bank_account_number, created_at
         FROM owners WHERE id = ?1;",
        params![id],
        |row| {
            Ok(Owner {
                id: row.get(0)?,
                name: row.get(1)?,
                document_id: row.get(2)?,
                phone: row.get(3)?,
                email: row.get(4)?,
                bank_name: row.get(5)?,
                bank_account_type: row.get(6)?,
                bank_account_number: row.get(7)?,
                created_at: row.get(8)?,
            })
        },
    )
    .map_err(AppError::from)
}

/// Lists all properties for a given owner (including parent buildings and sub-units).
pub fn list_properties_by_owner(conn: &Connection, owner_id: i64) -> Result<Vec<Property>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT id, owner_id, parent_property_id, code, title, address, property_type,
                base_rent_cop, commission_pct, fixed_fee_cop, cutoff_day, status, created_at
         FROM properties
         WHERE owner_id = ?1
         ORDER BY COALESCE(parent_property_id, id) ASC, parent_property_id IS NOT NULL ASC, id ASC;",
    )?;
    let rows = stmt.query_map(params![owner_id], |row| {
        Ok(Property {
            id: row.get(0)?,
            owner_id: row.get(1)?,
            parent_property_id: row.get(2)?,
            code: row.get(3)?,
            title: row.get(4)?,
            address: row.get(5)?,
            property_type: row.get(6)?,
            base_rent_cop: row.get(7)?,
            commission_pct: row.get(8)?,
            fixed_fee_cop: row.get(9)?,
            cutoff_day: row.get(10)?,
            status: row.get(11)?,
            created_at: row.get(12)?,
        })
    })?;
    rows.collect::<Result<Vec<_>, _>>().map_err(AppError::from)
}

/// Creates a new property (either a root/matrix property or a child sub-unit linked via `parent_property_id`).
pub fn create_property(conn: &Connection, input: &NewPropertyInput) -> Result<Property, AppError> {
    conn.execute(
        "INSERT INTO properties (
            owner_id, parent_property_id, code, title, address, property_type,
            base_rent_cop, commission_pct, fixed_fee_cop, cutoff_day, status
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11);",
        params![
            input.owner_id,
            input.parent_property_id,
            input.code,
            input.title,
            input.address,
            input.property_type,
            input.base_rent_cop,
            input.commission_pct,
            input.fixed_fee_cop,
            input.cutoff_day,
            input.status
        ],
    )?;
    let id = conn.last_insert_rowid();
    get_property_by_id(conn, id)
}

/// Fetches a single property by primary key.
pub fn get_property_by_id(conn: &Connection, property_id: i64) -> Result<Property, AppError> {
    conn.query_row(
        "SELECT id, owner_id, parent_property_id, code, title, address, property_type,
                base_rent_cop, commission_pct, fixed_fee_cop, cutoff_day, status, created_at
         FROM properties WHERE id = ?1;",
        params![property_id],
        |row| {
            Ok(Property {
                id: row.get(0)?,
                owner_id: row.get(1)?,
                parent_property_id: row.get(2)?,
                code: row.get(3)?,
                title: row.get(4)?,
                address: row.get(5)?,
                property_type: row.get(6)?,
                base_rent_cop: row.get(7)?,
                commission_pct: row.get(8)?,
                fixed_fee_cop: row.get(9)?,
                cutoff_day: row.get(10)?,
                status: row.get(11)?,
                created_at: row.get(12)?,
            })
        },
    )
    .map_err(AppError::from)
}

/// Creates a new tenant contract and marks the target property as `OCUPADO`.
pub fn create_contract(
    conn: &mut Connection,
    input: &NewContractInput,
) -> Result<TenantContract, AppError> {
    let tx = conn.transaction()?;
    tx.execute(
        "INSERT INTO tenant_contracts (
            property_id, tenant_name, tenant_document, guarantor_name, phone,
            monthly_rent_cop, start_date, end_date, cutoff_day, status
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10);",
        params![
            input.property_id,
            input.tenant_name,
            input.tenant_document,
            input.guarantor_name,
            input.phone,
            input.monthly_rent_cop,
            input.start_date,
            input.end_date,
            input.cutoff_day,
            input.status
        ],
    )?;
    let contract_id = tx.last_insert_rowid();
    tx.execute(
        "UPDATE properties SET status = 'OCUPADO' WHERE id = ?1;",
        params![input.property_id],
    )?;
    tx.commit()?;

    get_contract_by_id(conn, contract_id)
}

/// Retrieves a tenant contract by ID.
pub fn get_contract_by_id(
    conn: &Connection,
    contract_id: i64,
) -> Result<TenantContract, AppError> {
    conn.query_row(
        "SELECT id, property_id, tenant_name, tenant_document, guarantor_name, phone,
                monthly_rent_cop, start_date, end_date, cutoff_day, status, created_at
         FROM tenant_contracts WHERE id = ?1;",
        params![contract_id],
        |row| {
            Ok(TenantContract {
                id: row.get(0)?,
                property_id: row.get(1)?,
                tenant_name: row.get(2)?,
                tenant_document: row.get(3)?,
                guarantor_name: row.get(4)?,
                phone: row.get(5)?,
                monthly_rent_cop: row.get(6)?,
                start_date: row.get(7)?,
                end_date: row.get(8)?,
                cutoff_day: row.get(9)?,
                status: row.get(10)?,
                created_at: row.get(11)?,
            })
        },
    )
    .map_err(AppError::from)
}

/// Records a rent payment for a contract and property.
pub fn create_rent_payment(
    conn: &Connection,
    input: &NewRentPaymentInput,
) -> Result<RentPayment, AppError> {
    conn.execute(
        "INSERT INTO rent_payments (
            contract_id, property_id, period_month, gross_amount_cop,
            payment_date, payment_method, reference_code, status
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8);",
        params![
            input.contract_id,
            input.property_id,
            input.period_month,
            input.gross_amount_cop,
            input.payment_date,
            input.payment_method,
            input.reference_code,
            input.status
        ],
    )?;
    let id = conn.last_insert_rowid();
    conn.query_row(
        "SELECT id, contract_id, property_id, period_month, gross_amount_cop,
                payment_date, payment_method, reference_code, status
         FROM rent_payments WHERE id = ?1;",
        params![id],
        |row| {
            Ok(RentPayment {
                id: row.get(0)?,
                contract_id: row.get(1)?,
                property_id: row.get(2)?,
                period_month: row.get(3)?,
                gross_amount_cop: row.get(4)?,
                payment_date: row.get(5)?,
                payment_method: row.get(6)?,
                reference_code: row.get(7)?,
                status: row.get(8)?,
            })
        },
    )
    .map_err(AppError::from)
}

/// Creates a maintenance expense with `receipt_image_path` and `evidence_images_paths` serialized as JSON array TEXT.
/// New expenses always initialize with `deduction_status = 'Por Liquidar'`.
pub fn create_maintenance_expense(
    conn: &Connection,
    input: &NewMaintenanceInput,
) -> Result<MaintenanceExpense, AppError> {
    let evidence_json = serde_json::to_string(&input.evidence_images_paths)?;
    conn.execute(
        "INSERT INTO maintenance_expenses (
            property_id, execution_date, category, description, technician_name,
            invoice_number, net_cost_cop, receipt_image_path, evidence_images_paths, deduction_status
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 'Por Liquidar');",
        params![
            input.property_id,
            input.execution_date,
            input.category,
            input.description,
            input.technician_name,
            input.invoice_number,
            input.net_cost_cop,
            input.receipt_image_path,
            evidence_json
        ],
    )?;
    let id = conn.last_insert_rowid();
    get_maintenance_by_id(conn, id)
}

/// Fetches a maintenance expense by ID and deserializes `evidence_images_paths` from JSON array TEXT.
pub fn get_maintenance_by_id(
    conn: &Connection,
    maintenance_id: i64,
) -> Result<MaintenanceExpense, AppError> {
    conn.query_row(
        "SELECT id, property_id, execution_date, category, description, technician_name,
                invoice_number, net_cost_cop, receipt_image_path, evidence_images_paths,
                deduction_status, settlement_id
         FROM maintenance_expenses WHERE id = ?1;",
        params![maintenance_id],
        |row| {
            let raw_json: String = row.get(9)?;
            let evidence_paths: Vec<String> =
                serde_json::from_str(&raw_json).unwrap_or_default();
            Ok(MaintenanceExpense {
                id: row.get(0)?,
                property_id: row.get(1)?,
                execution_date: row.get(2)?,
                category: row.get(3)?,
                description: row.get(4)?,
                technician_name: row.get(5)?,
                invoice_number: row.get(6)?,
                net_cost_cop: row.get(7)?,
                receipt_image_path: row.get(8)?,
                evidence_images_paths: evidence_paths,
                deduction_status: row.get(10)?,
                settlement_id: row.get(11)?,
            })
        },
    )
    .map_err(AppError::from)
}

/// Executes a monthly owner settlement inside an explicit `BEGIN TRANSACTION ... COMMIT` block:
/// 1. Aggregates all `PAGADO` rent payments for the owner's properties in `period_month`.
/// 2. Computes each collected property's mixed agency fee: `(Gross * Commission %) + Base Fixed Fee`.
/// 3. Deducts all `Por Liquidar` maintenance expenses across the owner's properties at 1:1 net cost (`net_cost_cop`).
/// 4. Persists the `Settlement` statement with a deterministic integrity seal (`sha256_seal`).
/// 5. Marks all deducted maintenance expenses as `'Liquidado'` and links their `settlement_id`.
pub fn execute_monthly_settlement(
    conn: &mut Connection,
    owner_id: i64,
    period_month: &str,
) -> Result<Settlement, AppError> {
    let tx = conn.transaction()?;

    // Collect paid rent payments per property for this owner and period
    let mut payment_stmt = tx.prepare(
        "SELECT p.id, p.commission_pct, p.fixed_fee_cop, COALESCE(SUM(rp.gross_amount_cop), 0)
         FROM properties p
         INNER JOIN rent_payments rp ON rp.property_id = p.id
         WHERE p.owner_id = ?1 AND rp.period_month = ?2 AND rp.status = 'PAGADO'
         GROUP BY p.id, p.commission_pct, p.fixed_fee_cop;",
    )?;

    let mut total_gross_cop: i64 = 0;
    let mut total_pct_commission_cop: i64 = 0;
    let mut total_fixed_fee_cop: i64 = 0;

    let prop_rows = payment_stmt.query_map(params![owner_id, period_month], |row| {
        let prop_id: i64 = row.get(0)?;
        let commission_pct: f64 = row.get(1)?;
        let fixed_fee_cop: i64 = row.get(2)?;
        let prop_gross: i64 = row.get(3)?;
        Ok((prop_id, commission_pct, fixed_fee_cop, prop_gross))
    })?;

    for row in prop_rows {
        let (_prop_id, commission_pct, fixed_fee_cop, prop_gross) = row?;
        if prop_gross > 0 {
            let (pct_fee, _combined_fee) =
                calculate_property_commission(prop_gross, commission_pct, fixed_fee_cop);
            total_gross_cop += prop_gross;
            total_pct_commission_cop += pct_fee;
            total_fixed_fee_cop += fixed_fee_cop;
        }
    }
    drop(payment_stmt);

    // Sum all 'Por Liquidar' maintenance expenses for this owner's properties (1:1 net cost)
    let maintenance_deduction_cop: i64 = tx.query_row(
        "SELECT COALESCE(SUM(m.net_cost_cop), 0)
         FROM maintenance_expenses m
         INNER JOIN properties p ON p.id = m.property_id
         WHERE p.owner_id = ?1 AND m.deduction_status = 'Por Liquidar';",
        params![owner_id],
        |row| row.get(0),
    )?;

    let total_agency_fee_cop = total_pct_commission_cop + total_fixed_fee_cop;
    let net_payable_cop = total_gross_cop - total_agency_fee_cop - maintenance_deduction_cop;

    let seal = compute_settlement_seal(
        owner_id,
        period_month,
        total_gross_cop,
        total_pct_commission_cop,
        total_fixed_fee_cop,
        maintenance_deduction_cop,
        net_payable_cop,
    );

    tx.execute(
        "INSERT INTO settlements (
            owner_id, period_month, gross_income_cop, commission_amount_cop,
            fixed_fee_amount_cop, maintenance_deduction_cop, net_payable_cop, sha256_seal, status
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'EJECUTADO');",
        params![
            owner_id,
            period_month,
            total_gross_cop,
            total_pct_commission_cop,
            total_fixed_fee_cop,
            maintenance_deduction_cop,
            net_payable_cop,
            seal
        ],
    )?;
    let settlement_id = tx.last_insert_rowid();

    // Update all 'Por Liquidar' maintenance expenses for this owner to 'Liquidado'
    tx.execute(
        "UPDATE maintenance_expenses
         SET deduction_status = 'Liquidado',
             settlement_id = ?1
         WHERE deduction_status = 'Por Liquidar'
           AND property_id IN (SELECT id FROM properties WHERE owner_id = ?2);",
        params![settlement_id, owner_id],
    )?;

    tx.commit()?;

    conn.query_row(
        "SELECT id, owner_id, period_month, gross_income_cop, commission_amount_cop,
                fixed_fee_amount_cop, maintenance_deduction_cop, net_payable_cop,
                sha256_seal, status, created_at
         FROM settlements WHERE id = ?1;",
        params![settlement_id],
        |row| {
            Ok(Settlement {
                id: row.get(0)?,
                owner_id: row.get(1)?,
                period_month: row.get(2)?,
                gross_income_cop: row.get(3)?,
                commission_amount_cop: row.get(4)?,
                fixed_fee_amount_cop: row.get(5)?,
                maintenance_deduction_cop: row.get(6)?,
                net_payable_cop: row.get(7)?,
                sha256_seal: row.get(8)?,
                status: row.get(9)?,
                created_at: row.get(10)?,
            })
        },
    )
    .map_err(AppError::from)
}

/// Executes property handover (`<<<<< EJECUTAR ENTREGA DE INQUILINO DE INMUEBLE >>>>>`) inside an explicit
/// `BEGIN TRANSACTION ... COMMIT` block:
/// - Terminates all active or delinquent contracts on `property_id` (`status = 'FINALIZADO'`).
/// - Transitions the property `status` to `'DISPONIBLE'`.
pub fn execute_property_handover(
    conn: &mut Connection,
    property_id: i64,
) -> Result<(), AppError> {
    let tx = conn.transaction()?;

    let updated_props = tx.execute(
        "UPDATE properties SET status = 'DISPONIBLE' WHERE id = ?1;",
        params![property_id],
    )?;
    if updated_props == 0 {
        return Err(AppError::Domain(format!(
            "Property {} does not exist",
            property_id
        )));
    }

    tx.execute(
        "UPDATE tenant_contracts
         SET status = 'FINALIZADO'
         WHERE property_id = ?1 AND status IN ('ACTIVO', 'MORA');",
        params![property_id],
    )?;

    tx.commit()?;
    Ok(())
}

/// Single-read analytical bundle for the selected owner in the Global Master Selector (`<300ms` target).
pub fn get_owner_dashboard_bundle(
    conn: &Connection,
    owner_id: i64,
) -> Result<OwnerDashboardBundle, AppError> {
    let all_owners = list_owners(conn)?;
    let selected_owner = all_owners
        .iter()
        .find(|o| o.id == owner_id)
        .cloned()
        .or_else(|| all_owners.first().cloned())
        .ok_or_else(|| AppError::Domain("No owners registered in database".to_string()))?;

    let target_owner_id = selected_owner.id;
    let properties = list_properties_by_owner(conn, target_owner_id)?;

    // Count rentable units (excluding purely organizational matrix shells with base_rent_cop == 0 and child units)
    let agency_total_properties: usize = conn.query_row(
        "SELECT COUNT(*) FROM properties WHERE property_type != 'EDIFICIO MATRIZ';",
        [],
        |row| row.get::<_, i64>(0).map(|v| v as usize),
    )?;

    let owner_rentable: Vec<&Property> = properties
        .iter()
        .filter(|p| p.property_type != "EDIFICIO MATRIZ")
        .collect();
    let owner_property_count = owner_rentable.len();

    let agency_participation_pct = if agency_total_properties > 0 {
        ((owner_property_count as f64 / agency_total_properties as f64) * 1000.0).round() / 10.0
    } else {
        0.0
    };

    let occupied_count = owner_rentable
        .iter()
        .filter(|p| p.status == "OCUPADO")
        .count();
    let occupancy_rate_pct = if owner_property_count > 0 {
        ((occupied_count as f64 / owner_property_count as f64) * 1000.0).round() / 10.0
    } else {
        0.0
    };

    let expected_monthly_collection_cop: i64 = owner_rentable
        .iter()
        .filter(|p| p.status == "OCUPADO")
        .map(|p| p.base_rent_cop)
        .sum();

    // Load contracts for owner's properties
    let mut contract_stmt = conn.prepare(
        "SELECT c.id, c.property_id, c.tenant_name, c.tenant_document, c.guarantor_name,
                c.phone, c.monthly_rent_cop, c.start_date, c.end_date, c.cutoff_day, c.status, c.created_at
         FROM tenant_contracts c
         INNER JOIN properties p ON p.id = c.property_id
         WHERE p.owner_id = ?1
         ORDER BY c.id DESC;",
    )?;
    let contracts = contract_stmt
        .query_map(params![target_owner_id], |row| {
            Ok(TenantContract {
                id: row.get(0)?,
                property_id: row.get(1)?,
                tenant_name: row.get(2)?,
                tenant_document: row.get(3)?,
                guarantor_name: row.get(4)?,
                phone: row.get(5)?,
                monthly_rent_cop: row.get(6)?,
                start_date: row.get(7)?,
                end_date: row.get(8)?,
                cutoff_day: row.get(9)?,
                status: row.get(10)?,
                created_at: row.get(11)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    // Load rent payments for owner's properties
    let mut payment_stmt = conn.prepare(
        "SELECT rp.id, rp.contract_id, rp.property_id, rp.period_month, rp.gross_amount_cop,
                rp.payment_date, rp.payment_method, rp.reference_code, rp.status
         FROM rent_payments rp
         INNER JOIN properties p ON p.id = rp.property_id
         WHERE p.owner_id = ?1
         ORDER BY rp.payment_date DESC, rp.id DESC;",
    )?;
    let payments = payment_stmt
        .query_map(params![target_owner_id], |row| {
            Ok(RentPayment {
                id: row.get(0)?,
                contract_id: row.get(1)?,
                property_id: row.get(2)?,
                period_month: row.get(3)?,
                gross_amount_cop: row.get(4)?,
                payment_date: row.get(5)?,
                payment_method: row.get(6)?,
                reference_code: row.get(7)?,
                status: row.get(8)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    let collected_monthly_cop: i64 = payments
        .iter()
        .filter(|rp| rp.status == "PAGADO")
        .map(|rp| rp.gross_amount_cop)
        .sum();

    // Load maintenance expenses for owner's properties
    let mut maint_stmt = conn.prepare(
        "SELECT m.id, m.property_id, m.execution_date, m.category, m.description,
                m.technician_name, m.invoice_number, m.net_cost_cop, m.receipt_image_path,
                m.evidence_images_paths, m.deduction_status, m.settlement_id
         FROM maintenance_expenses m
         INNER JOIN properties p ON p.id = m.property_id
         WHERE p.owner_id = ?1
         ORDER BY m.execution_date DESC, m.id DESC;",
    )?;
    let maintenances = maint_stmt
        .query_map(params![target_owner_id], |row| {
            let raw_json: String = row.get(9)?;
            let evidence_paths: Vec<String> =
                serde_json::from_str(&raw_json).unwrap_or_default();
            Ok(MaintenanceExpense {
                id: row.get(0)?,
                property_id: row.get(1)?,
                execution_date: row.get(2)?,
                category: row.get(3)?,
                description: row.get(4)?,
                technician_name: row.get(5)?,
                invoice_number: row.get(6)?,
                net_cost_cop: row.get(7)?,
                receipt_image_path: row.get(8)?,
                evidence_images_paths: evidence_paths,
                deduction_status: row.get(10)?,
                settlement_id: row.get(11)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    let pending_maintenance_cop: i64 = maintenances
        .iter()
        .filter(|m| m.deduction_status == "Por Liquidar")
        .map(|m| m.net_cost_cop)
        .sum();

    // Load settlements for owner
    let mut settlement_stmt = conn.prepare(
        "SELECT id, owner_id, period_month, gross_income_cop, commission_amount_cop,
                fixed_fee_amount_cop, maintenance_deduction_cop, net_payable_cop,
                sha256_seal, status, created_at
         FROM settlements
         WHERE owner_id = ?1
         ORDER BY period_month DESC, id DESC;",
    )?;
    let settlements = settlement_stmt
        .query_map(params![target_owner_id], |row| {
            Ok(Settlement {
                id: row.get(0)?,
                owner_id: row.get(1)?,
                period_month: row.get(2)?,
                gross_income_cop: row.get(3)?,
                commission_amount_cop: row.get(4)?,
                fixed_fee_amount_cop: row.get(5)?,
                maintenance_deduction_cop: row.get(6)?,
                net_payable_cop: row.get(7)?,
                sha256_seal: row.get(8)?,
                status: row.get(9)?,
                created_at: row.get(10)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(OwnerDashboardBundle {
        selected_owner,
        all_owners,
        properties,
        contracts,
        payments,
        maintenances,
        settlements,
        agency_total_properties,
        owner_property_count,
        agency_participation_pct,
        expected_monthly_collection_cop,
        collected_monthly_cop,
        pending_maintenance_cop,
        occupancy_rate_pct,
    })
}
