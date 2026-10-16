# Core ERP Specification (`core-erp`)

## Purpose

Defines the core domain rules, financial settlement formulas, UI reactivity, property hierarchy, and transactional integrity requirements for **InmoControl 2.0** — a Local-First Desktop ERP built on Tauri v2 (Rust + SQLite WAL) and React 18.3 with the Obsidian Telemetry HUD design system.

---

## Requirements

### Requirement 1: Mixed Agency Commission

The system MUST calculate agency commissions for each owner settlement using the mixed commission formula:

$$\text{Agency Commission} = (\text{Gross Income} \times \text{Commission Percentage}) + \text{Base Fixed Fee}$$

- The system SHALL persist `commission_percentage` (decimal/percentage) and `base_fee` (fixed integer currency value) per owner record.
- The system MUST compute the exact commission before applying operational deductions during monthly settlement previews and executions.

#### Scenario: Standard Mixed Commission Calculation
- **Given** an owner has a `commission_percentage` of `8%` (`0.08`) and a `base_fee` of `$85,000`
- **And** the owner's properties generate a total `Gross Income` of `$4,200,000` for the active billing period
- **When** the monthly settlement engine calculates the agency fee
- **Then** the percentage component SHALL equal `$336,000` (`$4,200,000 * 0.08`)
- **And** the total `Agency Commission` MUST equal `$421,000` (`$336,000 + $85,000`).

#### Scenario: Zero Gross Income with Active Base Fee
- **Given** an owner has a `commission_percentage` of `10%` and a `base_fee` of `$50,000`
- **And** the owner's properties have `$0` in collected `Gross Income` for the period
- **When** the monthly settlement preview is generated
- **Then** the percentage component SHALL equal `$0`
- **And** the total `Agency Commission` SHALL equal the `$50,000` `base_fee`.

---

### Requirement 2: Zero Operational Markups

The system MUST deduct maintenance and repair expenses at a strict **1:1 net cost** (`0%` agency surcharge or hidden markup) and store physical/digital evidence locally.

- The system SHALL NOT apply any percentage markup or handling fee on top of `maintenance_tickets` costs deducted from the owner's payout.
- The system MUST store ticket invoice receipts (`receipt_image_path`) and repair photo evidence (`evidence_images_paths`) inside `%LocalAppData%\InmoControl\evidencias\`.

#### Scenario: 1:1 Maintenance Cost Deduction in Owner Settlement
- **Given** an approved maintenance ticket has a provider invoice cost of `$180,000`
- **And** the owner's gross income is `$4,200,000` with an agency commission of `$421,000`
- **When** the settlement engine computes the `Net Owner Payout`
- **Then** the maintenance deduction MUST be exactly `$180,000` (`1:1` net cost, `0%` markup)
- **And** the final `Net Owner Payout` SHALL equal `$3,599,000` (`$4,200,000 - $421,000 - $180,000`).

#### Scenario: Local Evidence Path Persistence
- **Given** an operator attaches a provider invoice and repair photos to a maintenance ticket
- **When** the ticket record is saved
- **Then** `receipt_image_path` and `evidence_images_paths` MUST resolve under `%LocalAppData%\InmoControl\evidencias\`
- **And** the UI SHALL allow instant preview of the stored local evidence files.

---

### Requirement 3: Global Master Owner Selector

The application header MUST provide a global Master Owner Selector that filters all 5 separated sidebar views (`Dashboard`, `Inmuebles`, `Contratos`, `Mantenimientos`, `Liquidación`) with `<300ms` UI reactivity.

- Switching the selected owner (or selecting `TODOS LOS PROPIETARIOS`) MUST synchronize all 5 views without full-page reloads.
- The selector MUST remain accessible in the top telemetry bar across all views.

#### Scenario: Filtering Across All 5 Separated Views Under 300ms
- **Given** the operator is viewing any of the 5 separated PRD views (`Dashboard`, `Inmuebles`, `Contratos`, `Mantenimientos`, or `Liquidación`)
- **When** the operator selects a specific owner from the Global Master Owner Selector
- **Then** the active view and all subsequent view switches MUST filter records exclusively to that owner's portfolio within `<300ms`
- **And** the HUD header telemetry indicators MUST reflect the active owner scope immediately.

---

### Requirement 4: Matrix & Sub-unit Property Hierarchy

The system MUST support two-level property hierarchies linking child sub-units to parent matrix properties via `parent_property_id`, rendered as an accessible tree accordion.

- Matrix properties SHALL have `parent_property_id = NULL` and `is_matrix = true`.
- Sub-units SHALL reference their parent matrix property via `parent_property_id`.
- The `Inmuebles` view MUST render matrix properties and their sub-units using `role="tree"` and `role="treeitem"` semantics with `[+]`/`[-]` expansion controls, `├──` / `└──` ASCII tree connectors, and `[DISPONIBLE]` / `[OCUPADO]` status badges.

#### Scenario: Expanding a Matrix Property to Inspect Sub-units
- **Given** a matrix property `"Edificio Mirador Central"` has 3 linked sub-units via `parent_property_id`
- **When** the operator views the `Inmuebles` tree (`role="tree"`) and toggles the `[+]` accordion control on the matrix row
- **Then** the child sub-units MUST be displayed with `├──` tree branch indicators
- **And** each sub-unit MUST display its occupancy badge (`[DISPONIBLE]` in Matrix Green `#00FF66` or `[OCUPADO]` in Cyan `#00eefc`).

---

### Requirement 5: Transactional Integrity & Local Backups

Critical state transitions MUST execute inside atomic SQLite transactions (`BEGIN TRANSACTION ... COMMIT` with automatic `ROLLBACK` on error), and the system MUST maintain automated 30-day rotating local backups via `VACUUM INTO`.

- Monthly settlement execution (`[ APROBAR // EJECUTAR ]`) MUST atomically insert the `liquidations` record, mark included `maintenance_tickets` as settled, and record ledger entries within a single `BEGIN TRANSACTION ... COMMIT` block.
- Contract termination (`<<<<< EJECUTAR ENTREGA DE INQUILINO DE INMUEBLE >>>>>`) MUST atomically close the active lease contract, release the property/sub-unit occupancy status to `[DISPONIBLE]`, and persist inspection notes within a single `BEGIN TRANSACTION ... COMMIT` block.
- Database backups MUST use SQLite `VACUUM INTO` targeting `%LocalAppData%\InmoControl\backups\` with a 30-day retention rotation policy.

#### Scenario: Atomic Monthly Settlement Execution
- **Given** an operator reviews a pending owner settlement in the `Liquidación` view
- **When** the operator triggers `[ APROBAR // EJECUTAR ]`
- **Then** the backend MUST execute `BEGIN TRANSACTION ... COMMIT` to persist the settlement and update linked maintenance tickets atomically
- **And** if any SQL statement fails, the entire settlement transaction MUST `ROLLBACK` leaving zero partial records.

#### Scenario: Atomic Contract Handover & Property Release
- **Given** an active lease contract on a `[OCUPADO]` property or sub-unit
- **When** the operator triggers `<<<<< EJECUTAR ENTREGA DE INQUILINO DE INMUEBLE >>>>>` in the `Contratos` view
- **Then** the system MUST atomically mark the contract as terminated and update the property status to `[DISPONIBLE]` inside `BEGIN TRANSACTION ... COMMIT`.

#### Scenario: Automated Local Backup with 30-Day Rotation
- **Given** the SQLite WAL database is active
- **When** the backup routine executes
- **Then** the system SHALL run `VACUUM INTO` to write a consistent snapshot into `%LocalAppData%\InmoControl\backups\`
- **And** backup snapshots older than 30 days MUST be pruned automatically.
