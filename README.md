# InmoControl 2.0 — Desktop Real Estate ERP (Obsidian Telemetry HUD)

**InmoControl 2.0** is a 100% local-first (offline) high-performance desktop real-estate administration ERP engineered with **Tauri v2 (Rust)**, **SQLite (WAL mode)**, and **React 18 + TypeScript + Tailwind CSS**.

---

## 1. Local-First Architecture & Data Paths

All relational data, photographic maintenance evidence, and rotating database snapshots reside strictly on the local machine under `%LocalAppData%\InmoControl\`:

- **SQLite Database (`WAL` mode)**: `%LocalAppData%\InmoControl\data\inmo_database.db`
- **Local Maintenance Evidence Storage**: `%LocalAppData%\InmoControl\evidencias\`
- **Automated `VACUUM INTO` Backups (30-Day Rotation)**: `%LocalAppData%\InmoControl\backups\`

### SQLite Performance & Integrity Pragmas
- `PRAGMA journal_mode = WAL;`
- `PRAGMA synchronous = NORMAL;`
- `PRAGMA foreign_keys = ON;`

---

## 2. Core Business Rules

1. **Mixed Agency Commission Formula**:
   $$\text{Total Commission} = (\text{Gross Collected Rent} \times \text{Commission } \%) + \text{Base Fixed Fee}$$
2. **1:1 Net Maintenance Deduction**:
   Maintenance repairs (`Por Liquidar`) are deducted at exact net invoice cost (`net_cost_cop`) with zero operational agency markup, linked to local receipt and evidence paths inside `%LocalAppData%\InmoControl\evidencias\`.
3. **Sub-300ms Global Master Owner Selector**:
   Switching the active owner in the top header filters all 5 modules in `< 300ms` via indexed SQLite JOIN queries (`idx_properties_owner`, `idx_properties_parent`, `idx_maintenance_property_status`, `idx_payments_property_period`).
4. **Transactional ACID Operations (`BEGIN TRANSACTION ... COMMIT`)**:
   - **Module 4 Handover (`<<<<< EJECUTAR ENTREGA DE INQUILINO DE INMUEBLE >>>>>`)**: Atomically finalizes active contracts (`FINALIZADO`) and transitions the property status to `DISPONIBLE`.
   - **Module 5 Settlement (`[ APROBAR // EJECUTAR ]`)**: Atomically records the monthly owner settlement statement with a deterministic SHA-256 seal and transitions all included maintenance items from `Por Liquidar` to `Liquidado`.

---

## 3. Five Separated PRD Modules

1. **`1. Dashboard Analítico`**: Radial SVG chart of agency participation (`%`), portfolio KPIs, and property/commission breakdown table.
2. **`2. Registro y Control`**: Owner registration (`CC / NIT`, disbursement bank account), Property & Sub-unit hierarchy (`parent_property_id`) with WCAG 2.1 AA ARIA sliders for Commission (%) and Base Fixed Fee ($ COP), Tenant Contract binding, and Rent Payment recording.
3. **`3. Mantenimientos`**: Maintenance execution form pre-filtered by property with single receipt upload (`receipt_image_path`) and multiple evidence uploads (`evidence_images_paths`), plus filterable history (`Por Liquidar` / `Liquidado`).
4. **`4. Administración y Alertas`**: Accordion Property Directory Tree (`role="tree"`, `[+]` / `[-]` toggles, `├──` sub-unit connectors, `[DISPONIBLE]` / `[OCUPADO]` badges), Smart Alerts panel, and transactional Hazard Contract Termination block.
5. **`5. Liquidaciones`**: Weekly Gross Income vs. Maintenance Cost SVG chart with Net Liquidity trendline, 1:1 local receipt inspector, and transactional `[ APROBAR // EJECUTAR ]` settlement execution.

---

## 4. Verification Commands

```bash
# Run frontend unit & integration tests (Vitest + React Testing Library)
npm test -- --run

# Build production TypeScript + Vite bundle
npm run build

# Run Rust SQLite WAL & VACUUM INTO unit tests
cargo test --manifest-path src-tauri/Cargo.toml
```
