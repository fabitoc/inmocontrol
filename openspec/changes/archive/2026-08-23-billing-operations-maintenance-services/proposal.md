# Proposal: Billing Operations - Maintenance, Utilities, and Rent Collections

## Intent
Restructure the Facturación module into 3 dedicated operational views (Mantenimiento, Servicios Públicos, Arriendos) with maintenance evidence attachment in landlord settlements, consolidated utility management, and payment receipts.

## Scope

### In Scope
- **Mantenimiento**:
  - Property maintenance/repair logging (category, contractor, cost COP, description, responsible party: Landlord vs Tenant).
  - Evidence attachment (before/after photos, invoice/receipt image or PDF).
  - Mandatory automated inclusion of maintenance evidence sheets/receipts in Landlord Monthly Settlement PDF.
  - Independent tenant maintenance ledger (unmerged from base rent).
- **Servicios Públicos**:
  - Expandable property directory with upcoming due dates and overdue (mora) indicators.
  - Consolidated payment modal (method, custom amount, notes, official PDF payment receipt).
- **Arriendos**:
  - Rent collection management grouped by due dates (upcoming vs overdue).
  - Quick payment modal (method, notes, downloadable PDF receipt).

### Out of Scope
- Direct utility provider API synchronization.
- External payment gateway / bank integration.

## Capabilities

### New Capabilities
- `billing-maintenance-evidence`: Maintenance/repair tracking with mandatory photo/receipt attachments in landlord settlement PDFs.
- `billing-utilities-management`: Utility bill tracking, expandable property views, consolidated payments, and PDF receipt generation.
- `billing-rent-collection`: Rent collection tracking, overdue status grouping, and payment receipt issuance.

### Modified Capabilities
- `financial-administration`: Update settlement PDF compilation to embed maintenance evidence sheets.

## Approach
- Add SQLite tables/columns for maintenance evidence, utility payments, and rent receipts.
- Implement React tabs/views in Facturación with accordion components for utilities.
- Enhance PDF generation engine to embed photo/receipt pages into landlord settlements and emit instant payment receipts.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/modules/billing/` | High | 3 operational views (Maintenance, Utilities, Rent Collections) and payment modals |
| `src-tauri/` / Services | Med | PDF receipt generation and settlement PDF evidence compilation |
| `database/` / SQLite | Med | Schemas for maintenance evidence, utility payments, and receipt tracking |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Large settlement PDF size from photo attachments | Med | Compress images and use structured multi-photo grid layout before PDF embedding |
| Utility payment tracking desynchronization | Low | Atomic transactions recording consolidated payment and updating utility status |

## Rollback Plan
Revert billing UI components, PDF generation templates, and migrate database schema back to previous revision.

## Success Criteria
- [ ] Repairs logged with photo/receipt evidence appear attached in landlord settlement PDFs.
- [ ] Tenant-responsible repairs track separately without auto-merging into rent.
- [ ] Utilities view renders expandable properties with mora indicators and consolidated payment + PDF receipt.
- [ ] Rent collections view allows quick payment processing with downloadable PDF receipt.
