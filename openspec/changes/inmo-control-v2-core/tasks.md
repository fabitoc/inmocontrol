# Implementation Tasks: `inmo-control-v2-core`

- [x] **Task 1: Project Scaffolding & Obsidian Telemetry HUD Tokens** (`289f78f`)
  - Configure Vite + React 18.3 + TypeScript + Tailwind CSS v3 + Vitest testing harness.
  - Define Obsidian Telemetry HUD color palette (`#121317`, `#0d0e12`, Cyan `#00eefc`, Amber `#ffb800`, Magenta `#ff007f`, Matrix Green `#00FF66`, and WCAG 2.1 AA `#9ca3af` muted text).

- [x] **Task 2: Rust Tauri v2 & SQLite WAL Transactional Layer** (`b24c7e5`)
  - Implement SQLite WAL schema (`owners`, `properties` with `parent_property_id`, `contracts`, `maintenance_tickets` with `receipt_image_path` and `evidence_images_paths`, and `liquidations`).
  - Implement atomic `BEGIN TRANSACTION ... COMMIT` commands for monthly settlement and tenant property handover, plus `VACUUM INTO` 30-day rotating backups in `%LocalAppData%\InmoControl\backups\`.

- [x] **Task 3: Domain Engine & Reactive ERP Store** (`4afb42c`)
  - Implement Mixed Agency Commission formula `(Gross Income * Commission %) + Base Fixed Fee` and 1:1 zero-markup maintenance deduction in `src/lib/domain.ts`.
  - Create `ErpContext` providing `<300ms` Global Master Owner Selector filtering across all views and local evidence path formatting (`%LocalAppData%\InmoControl\evidencias\`).

- [x] **Task 4: AppShell, Dashboard & Matrix/Sub-unit Property Tree (`Inmuebles`)** (`47af104`)
  - Build `AppShell` with the Global Master Owner Selector and 5 separated sidebar navigation views.
  - Implement `DashboardView` telemetry cards and `PropertiesView` with `role="tree"` / `role="treeitem"`, `[+]`/`[-]` accordion toggles, `├──` connectors, and `[DISPONIBLE]`/`[OCUPADO]` badges.

- [x] **Task 5: Lease Handover (`Contratos`), Zero-Markup Repairs (`Mantenimientos`) & Atomic Settlement (`Liquidación`)** (`fce2116`)
  - Implement `ContractsView` with `<<<<< EJECUTAR ENTREGA DE INQUILINO DE INMUEBLE >>>>>`.
  - Implement `MaintenanceView` with 1:1 net cost tracking and local evidence paths under `%LocalAppData%\InmoControl\evidencias\`.
  - Implement `SettlementView` with live formula breakdown and `[ APROBAR // EJECUTAR ]` atomic settlement trigger.

- [x] **Task 6: Automated Verification Suite (TDD & Build Proof)** (`e0fb435`)
  - Add comprehensive Vitest + React Testing Library suite covering all 5 core ERP requirements (`npm test -- --run` passing 5/5 tests) and verify production bundle (`npm run build`).

- [x] **Task 7: Viewport Vertical Scroll Fix on Main HUD Shell** (`33734ce`)
  - Enable `overflow-y-auto` on the `<main>` container in `AppShell` so all 5 separated HUD views scroll smoothly on smaller desktop viewports.
