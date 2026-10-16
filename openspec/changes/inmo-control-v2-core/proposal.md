# Change Proposal: `inmo-control-v2-core`

## Intent

Deliver the complete **InmoControl 2.0** Local-First Desktop ERP for real estate portfolio and lease administration, engineered with the **Obsidian Telemetry HUD** aesthetic (`#121317` / `#0d0e12`), strict **WCAG 2.1 AA** contrast compliance (`#9ca3af` muted text), **5 separated PRD views**, **Mixed Agency Commission** accounting, **Zero Operational Markups** (`1:1` maintenance deduction), **Matrix & Sub-unit Property Hierarchy**, and **SQLite WAL transactional integrity** (`BEGIN TRANSACTION ... COMMIT` + `VACUUM INTO` backups).

## Scope

### In Scope
1. **Obsidian Telemetry HUD & 5 Separated PRD Views**:
   - Dedicated sidebar navigation switching cleanly between `Dashboard`, `Inmuebles`, `Contratos`, `Mantenimientos`, and `Liquidación`.
   - Global Master Owner Selector in the top HUD bar filtering all 5 views in `<300ms`.
   - Full vertical scrolling in main viewport (`overflow-y-auto` on `<main>` shell container).
2. **Matrix & Sub-unit Property Hierarchy (`Inmuebles`)**:
   - Self-referencing `parent_property_id` supporting Matrix buildings and child sub-units.
   - Accessible `role="tree"` / `role="treeitem"` accordion with `[+]`/`[-]`, `├──` connectors, and `[DISPONIBLE]` / `[OCUPADO]` status badges.
3. **Lease Lifecycle & Handover (`Contratos`)**:
   - Active contract monitoring, IPC/expiry alerts, and atomic tenant handover action `<<<<< EJECUTAR ENTREGA DE INQUILINO DE INMUEBLE >>>>>`.
4. **Zero-Markup Maintenance & Local Evidence (`Mantenimientos`)**:
   - 1:1 repair cost tracking without agency markups.
   - Local evidence storage paths under `%LocalAppData%\InmoControl\evidencias\` for `receipt_image_path` and `evidence_images_paths`.
5. **Mixed Commission & Atomic Monthly Settlement (`Liquidación`)**:
   - Formula: `(Gross Income * Commission %) + Base Fixed Fee - Net Maintenance Costs`.
   - Atomic execution via `[ APROBAR // EJECUTAR ]` wrapped in `BEGIN TRANSACTION ... COMMIT`.
6. **Rust Tauri v2 + SQLite WAL Persistence & Backup Engine**:
   - SQLite WAL schema, transactional commands, and 30-day rotating `VACUUM INTO` backups in `%LocalAppData%\InmoControl\backups\`.

### Out of Scope
- Cloud multi-tenant SaaS sync (strictly Local-First Desktop ERP architecture).
- Third-party payment gateway charges or hidden maintenance surcharges.

## Approach

1. Define the canonical SQLite WAL schema and Rust transactional persistence layer (`src-tauri/src/db.rs`, `src-tauri/src/lib.rs`) enforcing `BEGIN TRANSACTION ... COMMIT` and `VACUUM INTO` rotation.
2. Build pure TypeScript domain calculation engines and state stores (`src/lib/domain.ts`, `src/context/ErpContext.tsx`) with deterministic seed data and Tauri IPC bridge fallback.
3. Implement the 5 separated HUD views (`DashboardView`, `PropertiesView`, `ContractsView`, `MaintenanceView`, `SettlementView`) and `AppShell` with WCAG 2.1 AA contrast (`#9ca3af`) and `<300ms` owner filtering.
4. Verify all business rules, UI trees, and atomic settlement/handover flows with Vitest + React Testing Library (`npm test -- --run`) and production compilation (`npm run build`).
