# Feature: InmoControl 2.0 Core Desktop ERP (`inmo-control-v2-core`)

- **Repository Locator**: `odd/tasks/inmo-control-v2-core.md`
- **Feature Branch**: `feat/inmo-control-v2-core`
- **Delivery Strategy**: `ask-on-risk` (Forecast: ~1,800 authored lines across 5 work-unit tasks; running authored lines: 0)

## Objective
Build **InmoControl 2.0**, a 100% local-first (offline) high-performance desktop real-estate administration ERP using **Tauri v2 (Rust)**, **SQLite (WAL mode)**, and **React 18 + TypeScript + Tailwind CSS** following the **Obsidian Telemetry HUD** (`projects/9603629535201010920`) design system and the 5-module PRD specification.

## Problem & Why
Real-estate agencies need maximum privacy, sub-300ms analytical reactivity, deterministic transactional integrity (`BEGIN TRANSACTION ... COMMIT`), and automated local database backups (`VACUUM INTO`) without cloud latency or third-party fees. Version 2.0 unifies property hierarchy management (`parent_property_id`), strict commission calculation `(Gross Income * Commission %) + Base Fixed Fee`, 1:1 net-cost maintenance deductions with local evidence storage (`%LocalAppData%\InmoControl\evidencias\`), smart delinquency alerts, and monthly owner settlements into 5 dedicated sidebar views.

## Authorized Scope & Constraints
- **In Scope**:
  1. Tauri v2 (Rust) backend + SQLite WAL database at `%LocalAppData%\InmoControl\data\inmo_database.db` + evidence storage at `%LocalAppData%\InmoControl\evidencias\`.
  2. Automatic `VACUUM INTO` backups on startup and shutdown with 30-day rotation in `%LocalAppData%\InmoControl\backups\`.
  3. Five separated views in the left sidebar matching the 5 PRD Modules, filtered dynamically (<300ms) by the Global Master Owner Selector in the header.
  4. Strict business rules: Commission = `(Gross Income * Commission %) + Base Fixed Fee`; Maintenance deducted 1:1 at net cost (`Costo Neto`); transactional execution for monthly settlements and contract termination/handover.
  5. WCAG 2.1 AA accessibility compliance from the Stitch audits (`#9ca3af` muted text contrast, ARIA range sliders, `:focus-visible` `#00f0ff` outlines, semantic `role="tree"` and `role="table"`).
- **Constraints**:
  - 100% offline/local operation.
  - Web frontend + Tauri v2 desktop bridge (with graceful fallback/mock preview support when running in pure Vite/vitest browser tests).

## Actionable Checklist

- [x] **T1 — Project Scaffolding, Rust SQLite WAL Engine, Schema v4.0 & Rotating `VACUUM INTO` Backups**
  - **Route**: `delegated-direct` (Writer trigger: >2 non-trivial files across Rust backend and Vite/React/TS/Tailwind config).
  - **Risk Tier**: `high` (database schema, WAL concurrency, transactional integrity, file-system backup rotation).
  - **Scope**: Initialize Tauri v2 + React 18 + TypeScript + Tailwind CSS + Vitest project structure; implement Rust SQLite WAL connection manager, Schema v4.0 (`owners`, `properties` with `parent_property_id`, `tenants`, `contracts`, `rent_payments`, `maintenance_expenses` with `receipt_image_path` & `evidence_images_paths`, `settlements`), 30-day rotating `VACUUM INTO` backup engine, deterministic seed dataset, and Rust `cargo test` suite.
  - **Checks**:
    - Independent Verifier (`bfcb2674`): `PASS` across all 7 criteria (`db.rs:25-33` WAL + FK pragmas, `db.rs:58-72` `parent_property_id`, `db.rs:101-114` `receipt_image_path` + `evidence_images_paths`, `paths.rs:20-47` `%LocalAppData%\InmoControl\`, `db.rs:143-151` & `599-691` mixed commission & transactional settlement, `db.rs:721-747` transactional handover, `backup.rs:11-74` `VACUUM INTO` 30-file rotation).
    - Host `cargo test --manifest-path src-tauri/Cargo.toml`: `env-blocked` (`error: linker link.exe not found` — Windows host has `rustc 1.99.0` installed without Visual Studio C++ Build Tools `link.exe`).

- [ ] **T2 — Domain Calculation Engine, Tauri IPC Bridge, Obsidian HUD Shell & Module 1 (Analytical Dashboard)**
  - **Route**: `delegated-direct` (Writer trigger: >2 non-trivial files across Rust IPC commands and React shell/dashboard).
  - **Risk Tier**: `medium` (domain calculations + analytical query performance + UI rendering).
  - **Scope**: Expose Tauri IPC commands (with SQLite JOIN queries optimized for <300ms owner filtering), TypeScript domain/IPC service layer, Obsidian Telemetry HUD Shell (Top OS status bar, 5-module Left Sidebar, Header with Global Master Owner Selector), and Module 1 (Analytical Dashboard: radial agency participation chart, KPI cards for total properties, expected collection, occupancy rate, and owner portfolio summary).
  - **Checks**: `cargo test --manifest-path src-tauri/Cargo.toml` and `npm test -- --run` (Vitest unit/component tests for mixed commission formula `(Gross * %) + Fixed`, radial participation calculation, and global owner filter reactivity).

- [ ] **T3 — Module 2 (Registration & Control) & Module 3 (Maintenance Execution & Local Evidence Storage)**
  - **Route**: `delegated-direct` (Writer trigger: >2 non-trivial files).
  - **Risk Tier**: `medium` (form validation, parent/sub-unit hierarchy creation, local evidence image saving in `%LocalAppData%\InmoControl\evidencias\`).
  - **Scope**: Implement Module 2 (Owner registration with CC/NIT & bank account, Property registration with ARIA Commission % slider + Fixed Fee slider + `parent_property_id` selector for Matrix/Sub-units, Tenant & Contract registration with cutoff day, and Rent Payment recording) and Module 3 (Maintenance execution form pre-filtered by property with calendar date, category, description, technician, invoice #, net cost, receipt photo upload, multiple evidence photos upload saved to `%LocalAppData%\InmoControl\evidencias\`, and filterable maintenance history table showing `Por Liquidar` / `Liquidado`).
  - **Checks**: `cargo test --manifest-path src-tauri/Cargo.toml` and `npm test -- --run`.

- [ ] **T4 — Module 4 (Administration, Accordion Tree, Smart Alerts & Hazard Handover) & Module 5 (Owner Settlements)**
  - **Route**: `delegated-direct` (Writer trigger: >2 non-trivial files).
  - **Risk Tier**: `high` (transactional `BEGIN TRANSACTION ... COMMIT` for contract termination and monthly settlement accounting).
  - **Scope**: Implement Module 4 (Accordion Property Directory Tree `[+]` with `├──` sub-unit connectors and `[DISPONIBLE]`/`[OCUPADO]` badges, Smart Alerts for upcoming collections in Amber, overdue tenants in Magenta/Red, and pending owner settlements, plus transactional Hazard Contract Termination button `<<<<< EJECUTAR ENTREGA DE INQUILINO DE INMUEBLE >>>>>`) and Module 5 (Weekly gross income vs maintenance cost chart with net liquidity trendline, automatic closing calculation crossing monthly rent payments minus mixed commission minus 1:1 net pending maintenance expenses with visual receipt preview, final statement, and transactional `[ APROBAR // EJECUTAR ]` button marking maintenances as `Liquidado`).
  - **Checks**: `cargo test --manifest-path src-tauri/Cargo.toml` and `npm test -- --run` (including rollback/commit verification for settlement and handover transactions).

- [ ] **T5 — WCAG 2.1 AA Accessibility Hardening, End-to-End Verification & Documentation**
  - **Route**: `delegated-direct` (Writer trigger: >2 non-trivial files).
  - **Risk Tier**: `medium` (accessibility audit compliance, build verification, documentation).
  - **Scope**: Verify all Stitch WCAG 2.1 AA audit remediations (`#9ca3af` muted text contrast, `:focus-visible` cyan outlines, `role="tree"` / `role="treeitem"` / `aria-expanded`, `role="table"`, `aria-valuemin/max/now/valuetext` on sliders), run full production build (`npm run build` + `cargo check`/`cargo test`), and document architecture and usage in `README.md`.
  - **Checks**: `npm test -- --run`, `npm run build`, and `cargo test --manifest-path src-tauri/Cargo.toml`.

## Acceptance Criteria
1. SQLite database runs in `WAL` mode at `%LocalAppData%\InmoControl\data\inmo_database.db` and executes `VACUUM INTO` backups on startup and shutdown (retaining 30 days).
2. `properties` table includes `parent_property_id` (self-referencing FK) and `maintenance_expenses` includes `receipt_image_path` (TEXT) and `evidence_images_paths` (JSON array TEXT) pointing to `%LocalAppData%\InmoControl\evidencias\`.
3. Left sidebar separates the 5 PRD Modules into 5 distinct views, all reacting in <300ms to the Global Master Owner Selector in the header.
4. Agency commission strictly follows `(Gross Income * Commission %) + Base Fixed Fee` and maintenance expenses are deducted 1:1 at net cost (`Costo Neto`).
5. Contract termination (`EJECUTAR ENTREGA DE INQUILINO DE INMUEBLE`) and Monthly Settlement (`APROBAR // EJECUTAR`) execute inside `BEGIN TRANSACTION ... COMMIT` blocks.

## Progress & Verification Evidence
- **Status**: Initialized (`0/5` tasks completed).
- **Next Step**: Execute **T1** via bounded delegated writer and independent verifier.
