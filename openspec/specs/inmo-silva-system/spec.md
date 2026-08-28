# Main System Specifications: inmo-silva-system

This artifact contains the authoritative set of feature specifications and Given/When/Then scenario requirements for the InmoAdmin system under OpenSpec guidelines.

---

## Capability 1: `dashboard-kpi-alerts`

### Feature Description
The `dashboard-kpi-alerts` capability provides real-time financial summaries and administrative alert notifications for the InmoAdmin desktop application. It monitors active lease contracts, overdue payments, property repairs, and negative owner balances to display actionable metrics.

### Design Specification (Fluent Dark UI)
- **Color Palette**: Backdrop background MUST use deep dark slate (`#0F172A`). Highlights, primary active indicators, and high-priority alert cards MUST use warm desaturated amber (`#D97706`) and bronze (`#B45309`).
- **Surface Elevation**: Content cards SHALL use Fluent acrylic glassmorphism styling (`#1E293B` with subtle border opacity).
- **Typography & Metrics**: KPI numerical values MUST be displayed in high-contrast white with amber unit labels (`COP`).

### Requirements

#### Requirement: KPI Summary Calculation
The system MUST calculate real-time financial metrics in COP based on active lease agreements and transactions within the current billing cycle.

##### Scenario: Display financial metrics on dashboard load
- **Given** active lease contracts and recorded income/expense transactions for the current month
- **When** the administrator navigates to the main Dashboard page
- **Then** the system SHALL display total income collected in COP, pending rent balance, total active properties, and net portfolio yield
- **And** all metrics MUST update without requiring a full application restart.

#### Requirement: Overdue Rent Alert Triggering
The system MUST identify tenants with unpaid rent past the agreed contract payment cutoff date.

##### Scenario: Alert for overdue tenant payments
- **Given** a lease agreement with a monthly payment cutoff on day 5 of the month
- **When** the current system date reaches day 6 and no corresponding payment transaction is logged
- **Then** the dashboard SHALL present an alert badge with warm amber highlight (`#D97706`) detailing the tenant name, property address, and overdue amount.

#### Requirement: Negative Owner Balance Warning
The system MUST flag owners (Arrendadores) whose accrued expenses exceed total collected income for the active billing period.

##### Scenario: Flag red balance owner statement
- **Given** an owner with recorded property repairs of $500,000 COP and collected rent of $300,000 COP
- **When** the dashboard KPI processor evaluates owner account balances
- **Then** the dashboard MUST display a red balance warning card highlighting a net balance of -$200,000 COP
- **And** the warning SHALL provide a direct link to the owner's financial statement.

---

## Capability 2: `financial-administration` (Updated)

### Feature Description
The `financial-administration` capability provides income and expense transaction recording, contract-date cutoff filtering, 100% net calculation logic (Payments - Expenses), and automated PDF owner settlement statement generation with integrated photo evidence attachments in COP.

### Design Specification (Fluent Dark UI)
- **Color Palette**: Dark UI canvas background MUST be `#0F172A`. Action triggers (e.g., "Exportar Liquidación PDF (100% Neto)", "Log Transaction") MUST utilize warm desaturated amber highlights (`#D97706`) with bronze hover states (`#B45309`).
- **Data Tables**: Financial log tables MUST feature zebra striping over acrylic dark background (`#1E293B`) with high-contrast text and monetary formatting in COP (`$X,XXX,XXX COP`).

### Requirements

#### Requirement: Transaction Logging (Income & Expenses)
The system MUST record income payments (rent collections) and property expenses (repairs, utilities, maintenance) categorized per property and owner.

##### Scenario: Register property payment transaction
- **Given** an active lease agreement with monthly rent of $1,200,000 COP
- **When** the administrator enters a payment receipt of $1,200,000 COP associated with Property ID P-101
- **Then** the system SHALL store the transaction in SQLite with timestamp, payment method, and status `PAID`
- **And** recalculate the net owner balance for the current period.

#### Requirement: 100% Net Owner Calculation Enforcing
The system MUST compute net owner settlement strictly using 100% net math: `Net Settlement = Total Income Collected - Total Approved Expenses`.

##### Scenario: Calculate 100% net owner balance
- **Given** an owner with total tenant income of $3,500,000 COP and maintenance expenses of $450,000 COP
- **When** the financial module executes statement calculations
- **Then** the resulting net payable balance MUST equal exactly $3,050,000 COP
- **And** no percentage-based agency commissions SHALL be deducted unless explicitly entered as an itemized expense.

#### Requirement: Automated PDF Statement Export with Evidence Embedding
The system MUST render a printable PDF settlement statement for any selected owner and date range, automatically deducting landlord repairs and appending multi-column photo grid evidence sheets & contractor invoices.

##### Scenario: Export Landlord Settlement PDF with embedded maintenance evidence
- **Given** a landlord monthly period with `$2,000,000 COP` rent collected and `$300,000 COP` in landlord maintenance with 2 attached photos
- **When** the administrator exports the Landlord Monthly Settlement PDF
- **Then** the net payable balance MUST equal `$1,700,000 COP`
- **And** the generated PDF MUST automatically contain itemized expense lines followed by embedded evidence photo sheets.

---

## Capability 3: `owner-property-crud` (Updated)

### Requirements

#### Requirement: Landlord (Arrendador) Management with Inline & Toolbar Actions
The system MUST support registering, updating, viewing, and deleting landlord profiles from the main toolbar and directly from accordion card headers with preloaded editing modals.

#### Scenario: Register new landlord
- **Given** the main Propiedades toolbar
- **When** the administrator clicks "Nuevo Arrendador" and submits the form
- **Then** the system SHALL validate required fields and persist the record in SQLite.

#### Scenario: Inline edit landlord from card header
- **Given** a landlord accordion card in the Propiedades view
- **When** the administrator clicks "Editar Arrendador" on the header
- **Then** the system MUST open the `OwnerModal` with current details and save updates reactively.

#### Requirement: Property Management & Linking
The system MUST allow creating and updating properties associated with a registered landlord.

##### Scenario: Create property linked to owner
- **Given** an existing landlord record in the database
- **When** the administrator creates a property specifying Address, Property Code, Monthly Rent Target, and assigned Owner ID
- **Then** the system MUST bind the property to the specified landlord and mark status as `AVAILABLE`.

---

## Capability 4: `system-settings-backup`

### Requirements

#### Requirement: Database Backup Creation
The system MUST provide a one-click local database export feature that copies the active SQLite file to a user-selected destination path.

##### Scenario: Export SQLite database backup
- **Given** an operational SQLite database containing system records
- **When** the administrator clicks "Create Backup" in System Settings and selects a file location
- **Then** the application MUST execute an offline snapshot of the database file.

---

## Capability 5: `billing-maintenance-evidence`

### Requirement: Property Maintenance Logging & Evidence Attachment
The system MUST record property repairs and maintenance items with mandatory fields: property ID, category, cost in COP, contractor details, execution date, description, responsible party (`Propietario` or `Inquilino`), and attached evidence files (photos/receipts).

#### Scenario: Log maintenance expense with evidence photos and invoice
- **Given** a registered property requiring plumbing maintenance
- **When** the administrator records a maintenance log with cost `$250,000 COP`, responsible party `Propietario`, and uploads before/after photos and receipt
- **Then** the system MUST persist the record with all metadata and linked Base64 images in SQLite
- **And** the status SHALL be set to `Completado`.

### Requirement: Tenant-Responsible Maintenance Ledger Separation
The system MUST isolate tenant-responsible maintenance charges from base rent accounts, preventing automated merging or rent invoice tampering.

#### Scenario: Track tenant repair independently from rent
- **Given** a repair assigned to `Inquilino` for `$120,000 COP`
- **When** the monthly rent invoice is generated for the tenant
- **Then** the base rent amount MUST remain unchanged
- **And** the tenant maintenance balance SHALL be tracked as an independent payable ledger item.

---

## Capability 6: `billing-utilities-management` (Updated)

### Requirement: Landlord-Centric Utility Directory Hierarchy
The system MUST display public utilities grouped first by **Arrendador** (accordion card with owner details and total pending utility balance), and second by **Building Typology** (Torres, Casas subdivididas, Individuales).

#### Scenario: View utilities grouped under landlord accordion
- **Given** multiple properties owned by Carlos Silva
- **When** the administrator opens the "Servicios Públicos" subtab
- **Then** the system MUST render a dedicated accordion card for Carlos Silva displaying total pending utility debt, and containing building clusters with "Asignar Cobro de Servicio" action buttons.

### Requirement: Accordion Property Utility Status & Overdue Monitoring
The system MUST display properties in an expandable accordion view indicating utility service statuses (Agua, Energía, Gas, Internet), due dates, and visual overdue (`mora`) alerts.

#### Scenario: View property utilities with overdue status
- **Given** a property with an overdue Water bill past its payment due date
- **When** the administrator expands the property row in the Servicios Públicos view
- **Then** the system MUST render an active `mora` indicator with days overdue
- **And** display total pending utility balance in COP.

### Requirement: Consolidated Utility Payment & PDF Receipt Generation
The system MUST provide a consolidated payment workflow allowing custom amount entry, payment method selection, and immediate downloadable PDF receipt generation.

#### Scenario: Process consolidated utility payment
- **Given** pending utility services for a property totaling `$300,000 COP`
- **When** the administrator executes a payment specifying method `Transferencia` and custom amount `$300,000 COP`
- **Then** the system MUST mark selected utilities as `Pagado` in SQLite
- **And** generate an official downloadable PDF payment receipt with unique voucher ID.

---

## Capability 7: `billing-rent-collection`

### Requirement: Rent Collection Status Grouping & Quick Payment
The system MUST group active rent collection schedules by payment status and provide a quick payment processing modal with immediate PDF receipt export.

#### Scenario: Process overdue rent collection and generate receipt
- **Given** an overdue rent record for Property PROP-101 of `$1,500,000 COP`
- **When** the administrator opens the Quick Payment modal and submits a payment with method `Efectivo`
- **Then** the system MUST transition the rent collection status to `Pagado`
- **And** generate a downloadable official PDF rent payment receipt.

---

## Capability 8: `property-typology-hierarchy`

### Requirement: Landlord Property Typology Clustering
The system MUST render properties clustered into structural typologies:
1. **Torres**: Group header showing tower name, total units, occupied units, and sub-table of apartments with tenant, canon, and status.
2. **Casas Subdivididas**: Group header showing house address, division type, and sub-table of levels/units.
3. **Inmuebles Individuales**: Direct unit table for standalone properties.

#### Scenario: Display tower properties grouped under parent landlord
- **Given** an Arrendador with 4 properties created as part of "Torre A"
- **When** the administrator navigates to the "Propiedades" view and expands the landlord card
- **Then** the system MUST display a "Torre A" section card containing the 4 apartments itemized with tenant and status badges.

---

## Capability 9: `property-utility-templates` (Updated)

### Requirement: Zero-Price Service Assignment at Property Registration
The system MUST allow tagging applicable public utility services (Agua, Energía, Gas, Internet, etc.) during property registration without requiring monetary price entry.

#### Scenario: Check applicable services without price input
- **Given** the PropertyModal creation form
- **When** the administrator checks "Agua" and "Energía"
- **Then** the modal MUST NOT request monetary amounts
- **And** the property SHALL be registered with these utility types enabled as assignable services.

---

## Capability 10: `utilities-equal-split-billing`

### Requirement: Master Invoice Equal-Split Billing Assignment
The system MUST provide a master bill assignment workflow that allows selecting a building structure (Torre, Casa dividida, or single property), entering the total invoice amount in COP, specifying the due date, and automatically dividing the amount in equal parts (`Math.round(total / units.length)`) across all member sub-units.

#### Scenario: Prorate a master water bill across a 4-unit tower
- **Given** a Tower with 4 apartments (TA-101, TA-102, TA-201, TA-202)
- **When** the administrator assigns a Master Water Bill of `$400,000 COP` due on `2026-09-05`
- **Then** the system MUST create 4 distinct `ServicioPublico` records in SQLite, each with `tipo_servicio: 'Agua'`, `monto_estimado: 100000`, `fecha_vencimiento: '2026-09-05'`, and `estado: 'Pendiente'`.

#### Scenario: Assign utility bill to single standalone property
- **Given** a standalone commercial property (Local 101)
- **When** the administrator assigns an Electricity bill of `$250,000 COP`
- **Then** the system MUST create a single `ServicioPublico` record for Local 101 of `$250,000 COP`.
