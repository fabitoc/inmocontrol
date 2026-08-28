# Tasks: `properties-hierarchy-and-utility-defaults`

## Phase 1: Navigation & Types Foundation
- [x] 1.1 Update `src/types/index.ts` to support `NavTab` with `'propiedades'`, and define `UtilityTemplateItem` interface.
- [x] 1.2 Update `src/components/layout/Sidebar.tsx` and `src/App.tsx` replacing "Gestionador" with "Propiedades" (`Building2` icon).

## Phase 2: Utility Template Defaults in Property Modal
- [x] 2.1 Extend `src/components/crud/PropertyModal.tsx` with interactive checklist for utility services (Agua, Energía, Gas, Internet) and default COP amounts.
- [x] 2.2 Update `PropertyModal` `onSave` signature to emit selected utility templates alongside property data.

## Phase 3: Landlord Actions & Typology Hierarchy in Properties View
- [x] 3.1 In `src/views/EntitiesView.tsx` (Propiedades), add "Nuevo Arrendador" button in the top action toolbar.
- [x] 3.2 Add inline "Editar" button on each landlord accordion card header opening `OwnerModal`.
- [x] 3.3 Implement typology-based grouping in `EntitiesView.tsx` clustering properties by **Torres** (with apartment sub-tables), **Casas Subdivididas** (with floor/unit sub-tables), and **Inmuebles Individuales**.
- [x] 3.4 In `EntitiesView.tsx`, bootstrap default `ServiciosPublicos` records for every created property using the selected utility templates.

## Phase 4: Verification & Typecheck
- [x] 4.1 Run `npx tsc --noEmit` to guarantee 0 TypeScript compilation errors.
- [x] 4.2 Verify landlord editing, property clustering, and utility initialization end-to-end.

## Review Workload Forecast
- **Estimated changed lines**: ~320 lines across 5 files.
- **400-line budget risk**: Low.
- **Decision needed before apply**: No.
