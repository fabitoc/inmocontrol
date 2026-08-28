# Tasks: Simplify Settlements, Maintenance, and Remove Utilities

## Phase 1: Types & Domain Cleanup (`src/types/index.ts`)
- [x] 1.1 Remove public utility domain types and payloads (`UtilityType`, `UtilityStatus`, `ServicioPublico`, `ServicioPublicoConPropiedad`, `UtilityTemplateItem`, `AssignUtilityBillPayload`) from `src/types/index.ts`.
- [x] 1.2 Update `PaymentReceiptType` in `src/types/index.ts` to exclude `'Servicios'`, retaining `'Arriendo' | 'Mantenimiento'`.
- [x] 1.3 Review and consolidate `Mantenimiento`, `MantenimientoConPropiedad`, and `OwnerSettlement` interfaces in `src/types/index.ts` to support streamlined maintenance records and date-range settlement calculations.

## Phase 2: Database Store & Hook Refactoring (`src/services/db.ts`, `src/hooks/useDatabase.ts`)
- [x] 2.1 In `src/services/db.ts`, remove `servicios_publicos` from `DbStore` interface, `DEFAULT_STORE` mock data, migration logic, and automatic deduplication routines in `initDatabase()`.
- [x] 2.2 In `src/services/db.ts`, drop `ServiciosPublicos` table definition from `SQLITE_SCHEMA_DDL` and remove all utility CRUD methods (`getUtilities`, `addUtility`, `updateUtility`, `deleteUtility`).
- [x] 2.3 In `src/services/db.ts`, clean up cascade deletion handlers for Arrendadores/Propiedades and JSON backup import/export routines to eliminate `servicios_publicos` dependencies.
- [x] 2.4 In `src/hooks/useDatabase.ts`, remove reactive state (`utilities`, `utilitiesWithDetails`) and mutation hooks (`addUtility`, `updateUtility`, `deleteUtility`).
- [x] 2.5 In `src/hooks/useDatabase.ts`, enhance `getNetSettlementForOwner` (or add cutoff date range helper) to compute exact settlement cutoff date ranges `[dateFrom, dateTo]` based on the landlord's `dia_corte_liquidacion` (Day $C$) for a given Month and Year, correctly filtering transactions and maintenance items.

## Phase 3: Maintenance UI Simplification (`src/components/crud/MaintenanceModal.tsx`, `src/views/AdministracionView.tsx`)
- [x] 3.1 Refactor `src/components/crud/MaintenanceModal.tsx` to streamline the maintenance logging workflow (Property selector, category, cost in COP, execution date, technician details, description, multi-photo evidence, invoice attachment, with 100% direct debit to property owner).
- [x] 3.2 In `src/views/AdministracionView.tsx`, ensure the Mantenimiento tab (`'mantenimiento'`) cleanly handles creation, listing, filtering, and deletion of property maintenance records.
- [x] 3.3 In `src/views/AdministracionView.tsx`, verify that registering a maintenance automatically creates a matching deductible expense transaction in `db.transactions`.

## Phase 4: Utilities Module Removal (`src/components/crud/PropertyModal.tsx`, `src/views/AdministracionView.tsx`, delete utility modal files)
- [x] 4.1 Delete deprecated utility modal components (`AssignUtilityBillModal.tsx`, `ManageUtilityDatesModal.tsx`, `UtilityPaymentModal.tsx`).
- [x] 4.2 In `src/components/crud/PropertyModal.tsx`, remove `UtilityTemplateChoice`, `utilityChoices` state, checklist UI, utility icons, and `utilityTemplates` parameter from `onSave`.
- [x] 4.3 In `src/views/AdministracionView.tsx`, update `AdminSubTab` type to `'arriendos' | 'mantenimiento' | 'propiedades' | 'inquilinos'`, removing the `'servicios'` subtab and navigation button.
- [x] 4.4 In `src/views/AdministracionView.tsx`, remove all imports, state variables (`isAssignBillModalOpen`, `isDatesModalOpen`, `isUtilityModalOpen`), helper functions (`getUtilityIcon`), and handlers related to public utilities.

## Phase 5: Settlement Month/Year Cutoff Range Engine (`src/views/AdminView.tsx`, `src/services/pdf.ts`)
- [x] 5.1 In `src/views/AdminView.tsx`, replace manual start/end date inputs with Month (Enero–Diciembre) and Year dropdown selectors.
- [x] 5.2 In `src/views/AdminView.tsx`, dynamically calculate and display the effective cutoff date range based on the selected owner's `dia_corte_liquidacion` (e.g., from Day $C+1$ of previous month to Day $C$ of selected month).
- [x] 5.3 In `src/views/AdminView.tsx` and `src/components/admin/SettlementPdfButton.tsx`, pass the computed `dateFrom` and `dateTo` parameters into `db.getNetSettlementForOwner` and PDF export triggers.
- [x] 5.4 In `src/services/pdf.ts`, update `generateOwnerSettlementPDF` to display the Month, Year, and Cutoff Day in the header, rendering the 100% net calculation summary and embedded photo evidence sheets.

## Phase 6: TypeScript Build & Static Verification (`tsc --noEmit`)
- [x] 6.1 Execute TypeScript compilation check (`tsc --noEmit`) to verify zero type errors across models, hooks, services, and views.
- [x] 6.2 Validate that the Dashboard, Finanzas / Liquidaciones, and Administración views render and interact cleanly without runtime errors or missing references.
- [x] 6.3 Verify end-to-end PDF generation for Landlord 100% Net Settlements with embedded maintenance evidence photos and invoices.

---

## Review Workload Forecast
- **Estimated changed files**: 10 files (6 modified, 3 deleted, 1 tasks file).
- **Estimated changed lines**: ~-450 lines net reduction (clean deletion of utilities code and streamlined modals).
- **400-line budget risk**: Low. Net reduction in codebase complexity and dead code.
- **Decision needed before apply**: No.
