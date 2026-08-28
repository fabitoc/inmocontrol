# Tasks: Billing Operations - Maintenance, Utilities, and Rent Collections

## Phase 1: Types & Persistence Foundation
- [x] 1.1 Extend src/types/index.ts with Mantenimiento, ServicioPublico, ReciboPago, PaymentReceiptData, and associated enums (MaintenanceResponsible, MaintenanceStatus, UtilityType, UtilityStatus, PaymentReceiptType, PaymentMethod).
- [x] 1.2 Update src/services/db.ts SQLite DDL with Mantenimientos, ServiciosPublicos, and RecibosPago tables, plus initial seed data and migration logic.
- [x] 1.3 Implement CRUD functions in src/services/db.ts (getMaintenances, addMaintenance, updateMaintenance, deleteMaintenance, getUtilities, addUtility, updateUtility, deleteUtility, getPaymentReceipts, addPaymentReceipt).
- [x] 1.4 Expose reactive state and asynchronous mutations in src/hooks/useDatabase.ts for maintenance logs, utility bills, and payment receipts.

## Phase 2: PDF Reporting & Evidence Generation
- [x] 2.1 Refactor generateOwnerSettlementPDF in src/services/pdf.ts to calculate landlord repair deductions and append multi-column photo grid evidence sheets & contractor invoices.
- [x] 2.2 Implement generatePaymentReceiptPDF in src/services/pdf.ts with printable voucher layouts for rent and utility payments.

## Phase 3: Maintenance & Repair Management UI
- [x] 3.1 Create src/components/crud/MaintenanceModal.tsx supporting multi-photo base64 uploads, category/contractor selection, and responsible party assignment (Propietario vs Inquilino).
- [x] 3.2 Add the Mantenimiento operational subtab inside src/views/AdministracionView.tsx with summary KPI cards, filterable maintenance table, and settlement preview links.

## Phase 4: Servicios Públicos & Expandable Accordion UI
- [x] 4.1 Create src/components/crud/UtilityPaymentModal.tsx supporting consolidated multi-service payment, custom amount allocation, and receipt emission.
- [x] 4.2 Add Servicios Públicos subtab in src/views/AdministracionView.tsx with expandable property accordion, pending bill balances, and overdue (mora) status badges.

## Phase 5: Arriendos Billing & Receipt Emission UI
- [x] 5.1 Restructure Arriendos subtab in src/views/AdministracionView.tsx into grouped sections for upcoming vs overdue collections with mora indicators.
- [x] 5.2 Integrate quick payment modal and direct PDF receipt generation for rent collections in src/views/AdministracionView.tsx.

## Phase 6: Verification & Compilation
- [x] 6.1 Execute tsc --noEmit to verify type safety across models, hooks, PDF generators, and UI views.
- [x] 6.2 Conduct end-to-end functional audit of repair evidence attachments in settlement PDFs and payment receipt generation for utilities and rent.

## Review Workload Forecast
- **Estimated changed lines**: ~550 lines (+420 / -130 across 7 files).
- **400-line budget risk**: Moderate. Modals and PDF templates add bulk.
- **Chained PRs recommendation**: Split into 2 PRs if requested (PR 1: Phases 1-3 Foundation & Maintenance; PR 2: Phases 4-6 Utilities, Rent Collections & Verification).
