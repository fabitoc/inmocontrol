# Proposal: `utilities-landlord-grouping-and-equal-split-billing`

## Intent
Restructure the Public Utilities (Servicios Públicos) module so it organizes bills by Landlords and building typologies, streamline property creation so only service types are assigned without predefined prices, implement an equal-split bill assignment modal ("Asignar Cobro de Servicio") that prorrates building/house utility invoices across sub-units, and relocate the hierarchical Properties view inside the Administration module.

## Scope

### In Scope
- **Servicios Públicos Landlord Hierarchy**: Group utility monitoring by Arrendador → Buildings (Torres, Casas, Individuales) in `AdministracionView.tsx`.
- **Zero-Price Service Assignment**: In `PropertyModal.tsx`, assign applicable public utility types as simple toggle checkboxes without requiring upfront price estimates.
- **Equal-Split Utility Bill Modal ("Asignar Cobro de Servicio")**:
  - Modal allowing users to select a building group (Torre, Casa) or single property, select the utility type (Agua, Energía, Gas, etc.), enter the total invoice amount and due date.
  - Automatically calculate and distribute equal portions (`total / sub_units.length`) across all child units, creating corresponding `ServiciosPublicos` records with status `Pendiente`.
- **Navigation Relocation to Administración**:
  - Integrate the complete hierarchical properties view (with inline landlord edit, toolbar buttons, and typology breakdown) into `AdministracionView.tsx` under the "Propiedades" subtab.
  - Remove standalone properties tab from `Sidebar.tsx` and streamline main nav to: Dashboard, Finanzas, Administración, Configuración.

### Out of Scope
- Integration with external utility meter reading hardware.
- Custom non-equal percentage formulas (e.g. weighted by square meters) — defaults to equal division per user specification.

## Capabilities

### New Capabilities
- `utilities-equal-split-billing`: Automated calculation and batch creation of prorated utility bills across building sub-units from a single master invoice.

### Modified Capabilities
- `billing-utilities-management`: Restructured into landlord-centric accordion hierarchy with building-level bill assignment triggers.
- `property-utility-templates`: Modified to register utility service tags without upfront monetary prices.

## Approach
1. Create `src/components/crud/AssignUtilityBillModal.tsx` for master invoice entry and equal-split distribution.
2. Update `PropertyModal.tsx` to simplify utility selection into pure boolean service tags.
3. Update `AdministracionView.tsx` to:
   - Render Servicios Públicos grouped by Landlord and Building Typology with "Asignar Cobro de Servicio" action buttons.
   - Replace the legacy flat properties tab with the full hierarchical Properties view (integrating landlord edit and typology clustering).
4. Update `Sidebar.tsx`, `App.tsx`, and `types/index.ts` to streamline `NavTab` to `dashboard | finanzas | administracion | settings`.

## Affected Areas
| Area | Impact | Description |
|------|--------|-------------|
| `src/types/index.ts` | Modified | Update `NavTab` and add utility split payload types |
| `src/components/layout/Sidebar.tsx` | Modified | Streamline sidebar items to 4 primary views |
| `src/App.tsx` | Modified | Remove standalone propiedades tab and update headers |
| `src/components/crud/PropertyModal.tsx` | Modified | Remove price inputs from utility template selection |
| `src/components/crud/AssignUtilityBillModal.tsx` | Create | New modal for entering master bills and prorating equally |
| `src/views/AdministracionView.tsx` | Modified | Group utilities by landlord and embed full hierarchical properties view |

## Risks
| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Rounding issues during division (e.g. $100.000 / 3) | Low | Use `Math.round()` to ensure clean integer COP currency amounts |

## Rollback Plan
Revert changes to `Sidebar.tsx`, `PropertyModal.tsx`, and `AdministracionView.tsx` via git.

## Success Criteria
- [ ] Servicios Públicos displays properties grouped by Arrendador and Building Typology.
- [ ] "Asignar Cobro de Servicio" creates equally prorated utility bills across all units of a Torre/Casa.
- [ ] PropertyModal allows checking utility services without asking for prices.
- [ ] Administración contains the complete hierarchical Propiedades view with landlord edit capabilities.
