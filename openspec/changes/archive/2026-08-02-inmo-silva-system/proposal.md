# Proposal: InmoAdmin Real Estate Management System

## Intent
Provide a lightweight desktop application (InmoAdmin) for real estate administration, replacing manual tracking with automated COP financial management, owner statement generation, and tenant tracking.

## Scope

### In Scope
- **Dashboard**: Financial KPIs, overdue rent alerts, repair alerts, and red balance tracking.
- **Administration**: Income/expense recording, contract-date cutoffs, and 100% net PDF owner statements (Payment - Expenses).
- **Owner & Property Management**: CRUD for owners (Arrendadores), properties (Propiedades), tenants (Arrendatarios), and contract linking.
- **User Settings**: Agency branding setup and local SQLite database backup/restore.

### Out of Scope
- Automated percentage commission calculations (100% net model enforced).
- Multi-currency support (COP only).
- Cloud synchronization or web multi-tenant SaaS architecture.

## Capabilities

### New Capabilities
- `dashboard-kpi-alerts`: Real-time KPI summaries and alerts for overdue rent, repairs, and negative owner balances.
- `financial-administration`: Income/expense transactions and automated PDF owner settlement generation.
- `owner-property-crud`: Lifecycle management of landlords, properties, tenants, and lease agreements.
- `system-settings-backup`: Local database backup/restore and agency PDF branding configurations.

### Modified Capabilities
- None (Initial system proposal).

## Approach
Build a local desktop application using Tauri (Rust backend wrapper) and React (TypeScript + Vite + Tailwind CSS UI). The visual design will follow **Fluent Design + Dark UI** with an elegant black/dark backdrop and warm desaturated amber/bronze accents (`#D97706` / `#B45309`) designed to prevent eye fatigue while highlighting active states, alerts, and primary actions. Persistent state is stored locally in SQLite (`Arrendadores`, `Propiedades`, `Arrendatarios`, `Transacciones`). PDF generation runs locally to ensure privacy and offline reliability.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/` (Frontend React) | New | Dashboard, Admin, Owner/Property, and Settings UI modules |
| `src-tauri/` (Rust Backend) | New | Tauri IPC bridge, SQLite drivers, and PDF generation |
| `database/` (SQLite Schema) | New | Core tables (`Arrendadores`, `Propiedades`, `Arrendatarios`, `Transacciones`) |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| SQLite corruption | Low | Automatic backup triggers in Settings module |
| PDF formatting issues with long tables | Med | Standard table pagination logic in PDF renderer |

## Rollback Plan
Delete application binary and local SQLite data files. No cloud infrastructure or external databases affected.

## Dependencies
- Tauri CLI & Rust toolchain
- Node.js / Vite build environment
- SQLite engine

## Success Criteria
- [ ] CRUD operations functional for owners, properties, and tenants.
- [ ] Income and expense transactions accurately reflect 100% net calculations in COP.
- [ ] PDF Owner Statements generate correctly according to contract cutoff dates.
- [ ] SQLite database backup and restore operate without data loss.
