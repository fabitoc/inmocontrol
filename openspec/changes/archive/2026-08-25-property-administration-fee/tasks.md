# Tasks: Property Administration Fee

## Phase 1: Types & Schema Updates (`src/types/index.ts`, `src/services/db.ts`)
- [x] 1.1 In `src/types/index.ts`, extend `Propiedad` with `tipo_administracion?: AdminFeeType`, `valor_administracion?: number`, and `cuota_administracion?: number`.
- [x] 1.2 In `src/types/index.ts`, update `OwnerSettlement` to include `totalAdminFees: number` for financial settlements.
- [x] 1.3 In `src/services/db.ts`, update `SQLITE_SCHEMA_DDL` to include `tipo_administracion`, `valor_administracion`, and `cuota_administracion` in the `Propiedades` table.
- [x] 1.4 In `src/services/db.ts`, update `DEFAULT_STORE` mock data with representative administration fee values for sample properties.
- [x] 1.5 In `src/services/db.ts`, add migration and normalization logic in `DatabaseService.initDatabase()` to populate default values for existing records.

## Phase 2: Property Modal Administration Fee Configuration & Multi-Unit Split (`src/components/crud/PropertyModal.tsx`)
- [x] 2.1 In `src/components/crud/PropertyModal.tsx`, add reactive form state variables for `tipoAdministracion`, `valorAdministracion`, and `distribucionMulti`.
- [x] 2.2 In `src/components/crud/PropertyModal.tsx`, add form input fields for `Modalidad de Cuota` (Ninguna, Porcentaje, Monto Fijo) and real-time calculated COP preview badge.
- [x] 2.3 In `src/components/crud/PropertyModal.tsx`, update multi-unit generation routines for **Torres** and **Casas Subdivididas** to support "Por Unidad" vs "Inmueble Total" distribution (`Math.round(total / count)`).
- [x] 2.4 In `src/components/crud/PropertyModal.tsx`, add input validation and persist the new fields in `onSave`.

## Phase 3: Settlement Engine & Hook Deductions (`src/hooks/useDatabase.ts`, `src/views/AdminView.tsx`)
- [x] 3.1 In `src/hooks/useDatabase.ts`, update `getNetSettlementForOwner` to calculate total deductible administration fees for properties owned by the landlord.
- [x] 3.2 In `src/hooks/useDatabase.ts`, deduct administration fees in the 100% net formula: `Net Settlement = Total Income - Maintenance Expenses - Administration Fees`.
- [x] 3.3 In `src/hooks/useDatabase.ts`, ensure `getNegativeBalanceOwners` accurately reflects administration fee expenses in net yield computations.
- [x] 3.4 In `src/views/AdminView.tsx`, update the Owner Settlement Preview card to display an itemized 4-card metric including `Cuotas Administración` alongside income, maintenance expenses, and net balance.

## Phase 4: PDF Statement Itemization & UI Badges (`src/services/pdf.ts`, `src/views/AdministracionView.tsx`)
- [x] 4.1 In `src/services/pdf.ts`, include administration fee deductions in the PDF financial summary table (`(-) Cuotas de Administración`).
- [x] 4.2 In `src/views/AdministracionView.tsx`, display administration fee column and values across Torre apartments, divided house units, and standalone properties.

## Phase 5: Build & Type Check Verification (`tsc --noEmit`, `npm run build`)
- [x] 5.1 Run `npx tsc --noEmit` to verify type safety across all models, hooks, services, and view components.
- [x] 5.2 Execute `npm run build` to verify clean production bundle compilation with zero build errors.
- [x] 5.3 Validate end-to-end functionality in the browser.

---

## Review Workload Forecast
- **Estimated changed files**: 7 files.
- **Estimated changed lines**: ~280 lines total.
- **400-line budget risk**: Low.
- **Decision needed before apply**: No.
