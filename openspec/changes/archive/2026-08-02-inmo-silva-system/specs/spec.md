# Change Specifications: inmo-silva-system

This artifact contains the complete set of feature specifications and Given/When/Then scenario requirements for the `inmo-silva-system` change under OpenSpec guidelines.

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

## Capability 2: `financial-administration`

### Feature Description
The `financial-administration` capability provides income and expense transaction recording, contract-date cutoff filtering, 100% net calculation logic (Payments - Expenses), and automated PDF owner settlement statement generation in COP.

### Design Specification (Fluent Dark UI)
- **Color Palette**: Dark UI canvas background MUST be `#0F172A`. Action triggers (e.g., "Generate PDF Statement", "Log Transaction") MUST utilize warm desaturated amber highlights (`#D97706`) with bronze hover states (`#B45309`).
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

#### Requirement: Automated PDF Statement Export
The system MUST render a printable PDF settlement statement for any selected owner and date range.

##### Scenario: Generate PDF owner settlement statement
- **Given** aggregated financial transactions for an owner
- **When** the administrator clicks "Export PDF Statement"
- **Then** the backend SHALL generate a formatted PDF containing agency branding header, itemized income/expense table, and final net payment summary in COP.

---

## Capability 3: `owner-property-crud`

### Requirements

#### Requirement: Landlord (Arrendador) Management
The system MUST support registering, updating, viewing, and deleting landlord profiles including contact details and bank account numbers for COP payouts.

##### Scenario: Register new landlord
- **Given** full landlord details including Name, Tax ID (CC/NIT), Phone, Email, and Bank Account
- **When** the administrator submits the Landlord registration form
- **Then** the system SHALL validate required fields and persist the record in SQLite.

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
