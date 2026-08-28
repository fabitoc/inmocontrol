# Delta Specifications: `billing-operations-maintenance-services`

## Capability: `billing-maintenance-evidence`

### Requirement: Property Maintenance Logging & Evidence Attachment
The system MUST record property repairs and maintenance items with mandatory fields: property ID, category, cost in COP, contractor details, execution date, description, responsible party (`LANDLORD` or `TENANT`), and attached evidence files (photos/receipts).

#### Scenario: Log maintenance expense with evidence photos and invoice
- **Given** a registered property requiring plumbing maintenance
- **When** the administrator records a maintenance log with cost `$250,000 COP`, responsible party `LANDLORD`, and uploads before/after photos and receipt PDF
- **Then** the system MUST persist the record with all metadata and linked file paths in SQLite
- **And** the status SHALL be set to `COMPLETED`.

### Requirement: Tenant-Responsible Maintenance Ledger Separation
The system MUST isolate tenant-responsible maintenance charges from base rent accounts, preventing automated merging or rent invoice tampering.

#### Scenario: Track tenant repair independently from rent
- **Given** a repair assigned to `TENANT` for `$120,000 COP`
- **When** the monthly rent invoice is generated for the tenant
- **Then** the base rent amount MUST remain unchanged
- **And** the tenant maintenance balance SHALL be tracked as an independent payable ledger item.

---

## Capability: `billing-utilities-management`

### Requirement: Accordion Property Utility Status & Overdue Monitoring
The system MUST display properties in an expandable accordion view indicating utility service statuses (Energy, Water, Gas, Internet), due dates, and visual overdue (`mora`) alerts.

#### Scenario: View property utilities with overdue status
- **Given** a property with an overdue Water bill past its payment due date
- **When** the administrator expands the property row in the Servicios Públicos view
- **Then** the system MUST render an active `mora` indicator with days overdue
- **And** display total pending utility balance in COP.

### Requirement: Consolidated Utility Payment & PDF Receipt Generation
The system MUST provide a consolidated payment workflow allowing custom amount entry, payment method selection, and immediate downloadable PDF receipt generation.

#### Scenario: Process consolidated utility payment
- **Given** pending utility services for a property totaling `$300,000 COP`
- **When** the administrator executes a payment specifying method `TRANSFER` and custom amount `$300,000 COP`
- **Then** the system MUST mark selected utilities as `PAID` in SQLite
- **And** generate an official downloadable PDF payment receipt with unique voucher ID.

---

## Capability: `billing-rent-collection`

### Requirement: Rent Collection Status Grouping & Quick Payment
The system MUST group active rent collection schedules by payment status (`UPCOMING`, `OVERDUE`) and provide a quick payment processing modal with immediate PDF receipt export.

#### Scenario: Process overdue rent collection and generate receipt
- **Given** an overdue rent record for Property P-101 of `$1,500,000 COP`
- **When** the administrator opens the Quick Payment modal and submits a payment with method `CASH`
- **Then** the system MUST transition the rent collection status to `PAID`
- **And** generate a downloadable official PDF rent payment receipt.

---

## Capability: `financial-administration` (MODIFIED)

### Requirement: Automated Settlement PDF Evidence Embedding & Net Deduction
The system MUST automatically deduct `LANDLORD`-assigned maintenance expenses from the landlord net balance and append formatted evidence sheets (photos and receipts) into the exported Monthly Settlement PDF.

#### Scenario: Export Landlord Settlement PDF with embedded maintenance evidence
- **Given** a landlord monthly period with `$2,000,000 COP` rent collected and `$300,000 COP` in landlord maintenance with 2 attached photos
- **When** the administrator exports the Landlord Monthly Settlement PDF
- **Then** the net payable balance MUST equal `$1,700,000 COP`
- **And** the generated PDF MUST automatically contain itemized expense lines followed by embedded evidence photo sheets.
