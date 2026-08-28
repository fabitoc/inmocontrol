# Tasks: `utilities-landlord-grouping-and-equal-split-billing`

## Phase 1: Navigation & Types Consolidation
- [x] 1.1 Update `src/types/index.ts` to define `NavTab = 'dashboard' | 'finanzas' | 'administracion' | 'settings'` and payload interfaces for master bill distribution.
- [x] 1.2 Update `src/components/layout/Sidebar.tsx` and `src/App.tsx` removing the standalone Propiedades/Gestionador tab and streamlining main navigation to 4 items.

## Phase 2: Master Utility Equal-Split Modal & Property Form Simplification
- [x] 2.1 Refactor `src/components/crud/PropertyModal.tsx` to display utility services as simple boolean checkboxes without price inputs.
- [x] 2.2 Create `src/components/crud/AssignUtilityBillModal.tsx` allowing selection of a building group (Torre, Casa) or single unit, utility type (Agua, Energía, Gas, etc.), total master bill amount, and due date with automated equal-split preview.

## Phase 3: Administración View Overhaul
- [x] 3.1 In `src/views/AdministracionView.tsx`, restructure the "Servicios Públicos" subtab to group by **Arrendador** (accordion) and **Building Typology** (Torres, Casas, Individuales) with active "Asignar Cobro de Servicio" triggers.
- [x] 3.2 In `src/views/AdministracionView.tsx`, replace the legacy flat properties tab with the full hierarchical Properties view (integrating landlord edit buttons, top action toolbar, and typology sub-tables).
- [x] 3.3 Connect `AssignUtilityBillModal` in `AdministracionView.tsx` to create prorated `ServiciosPublicos` records in the database.

## Phase 4: Verification & Compilation
- [x] 4.1 Run `npx tsc --noEmit` to verify type safety across all components and hooks.
- [x] 4.2 Verify end-to-end master utility bill distribution and landlord hierarchy in the browser.

## Review Workload Forecast
- **Estimated changed lines**: ~380 lines across 6 files.
- **400-line budget risk**: Low.
- **Decision needed before apply**: No.
