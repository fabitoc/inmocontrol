# Implementation Tasks: Separate Cutoff and Due Dates

## Phase 1: Data Models & Database Schema
- [x] 1.1 Update `Arrendador` and `Propiedad` interfaces in `src/types/index.ts` to add `dia_corte_liquidacion` and replace `dia_corte` with `dia_vencimiento_pago`.
- [x] 1.2 Update `OverdueAlert` and `PropiedadConArrendador` types in `src/types/index.ts` to include `dueDay` and updated field names.
- [x] 1.3 Update SQLite schema DDL (`SQLITE_SCHEMA_DDL`) and `DEFAULT_STORE` seed data in `src/services/db.ts` to include `dia_corte_liquidacion` and `dia_vencimiento_pago`.
- [x] 1.4 Add migration/fallback handling in `src/services/db.ts` to populate default values (`dia_corte_liquidacion: 10`, `dia_vencimiento_pago: 5`) for legacy stored records.

## Phase 2: Core Data Services & Custom Hooks
- [x] 2.1 Refactor `getOverdueTenants` in `src/hooks/useDatabase.ts` to compare `currentDay > prop.dia_vencimiento_pago` for mora calculation.
- [x] 2.2 Update owner settlement helper methods in `src/hooks/useDatabase.ts` to set billing cycle date ranges based on `Arrendador.dia_corte_liquidacion`.

## Phase 3: Entity Management UI (Modals & Tables)
- [x] 3.1 Update `src/components/crud/OwnerModal.tsx` to add numerical input (1–31) and validation for `dia_corte_liquidacion`.
- [x] 3.2 Update `src/components/crud/PropertyModal.tsx` form inputs and labels to bind to `dia_vencimiento_pago` with 1–31 validation.
- [x] 3.3 Update owner and property tables in `src/views/EntitiesView.tsx` to render columns for "Día Corte Liquidación" and "Día Vencimiento Pago".

## Phase 4: Financial Administration & PDF Export
- [x] 4.1 Update `src/components/dashboard/AlertsList.tsx` to display tenant payment due day (`dueDay`) and updated alert text.
- [x] 4.2 Update `src/views/AdminView.tsx` settlement generator to display landlord settlement cutoff day (`dia_corte_liquidacion`).
- [x] 4.3 Update PDF statement header in `src/services/pdf.ts` to render `dia_corte_liquidacion` as the official cutoff date of the owner settlement.

## Phase 5: Verification & Testing
- [x] 5.1 Verify landlord CRUD form saves and validates `dia_corte_liquidacion` between 1 and 31.
- [x] 5.2 Verify property CRUD form saves and validates `dia_vencimiento_pago` between 1 and 31.
- [x] 5.3 Test overdue alert trigger scenario: confirm alert triggers when `currentDay > dia_vencimiento_pago` regardless of landlord cutoff day.
- [x] 5.4 Verify PDF owner settlement generation uses `Arrendador.dia_corte_liquidacion` for settlement period boundaries.

## Review Workload Forecast

| Metric | Details |
|---|---|
| **Total Tasks** | 13 actionable tasks across 5 implementation phases |
| **Files Affected** | 9 files (`src/types/index.ts`, `src/services/db.ts`, `src/hooks/useDatabase.ts`, `src/components/crud/OwnerModal.tsx`, `src/components/crud/PropertyModal.tsx`, `src/components/dashboard/AlertsList.tsx`, `src/views/EntitiesView.tsx`, `src/views/AdminView.tsx`, `src/services/pdf.ts`) |
| **Risk Profile** | **Low-Medium**: Schema refactoring requires runtime fallbacks for existing `localStorage` data |
| **Critical Review Paths** | 1. Backwards compatibility fallback in `db.ts` (`prop.dia_vencimiento_pago ?? prop.dia_corte ?? 5`).<br>2. Overdue calculation in `useDatabase.ts`.<br>3. Validation constraints (1–31) in `OwnerModal.tsx` and `PropertyModal.tsx`. |
| **Verification Method** | Manual UI form testing, mock alert verification, and PDF settlement rendering inspection |
