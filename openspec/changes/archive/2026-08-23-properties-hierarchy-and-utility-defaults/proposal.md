# Proposal: `properties-hierarchy-and-utility-defaults`

## Intent
Transform the main navigation so the rich hierarchical "Properties" accordion from the entities module becomes the primary **"Propiedades"** view. Add quick landlord creation and inline landlord edition. Integrate template public utilities management inside the property creation modal, and organize properties visually by physical typology (Torres with apartments, Casas with floors/studios, and independent units).

## Scope

### In Scope
- **Navigation Unification**: Rename the sidebar tab "Gestionador" to **"Propiedades"** with icon `Building2`. Direct users to the hierarchical Landlord -> Properties accordion as the default view.
- **Landlord Actions in View**:
  - Add **"Nuevo Arrendador"** action button in the top action toolbar alongside "Nueva Propiedad".
  - Add an **"Editar"** button in each landlord's accordion card header to view/update full landlord details (`OwnerModal`).
- **Utility Template Defaults in Property Modal**:
  - Add utility service selector checklist (Agua, Energía, Gas, Internet, etc.) with estimated COP amounts in `PropertyModal`.
  - When saving a property (or batch properties in Towers/Houses), automatically bootstrap these utility records as templates in `servicios_publicos`.
- **Property Hierarchy & Typology Grouping**:
  - Group properties under each landlord by structural typology:
    - **Torres**: Grouped header with unit breakdown (e.g. TA-101, TA-102) showing tenant, canon, and status.
    - **Casas Subdivididas**: Grouped header with division breakdown (e.g. Piso 1, Apartaestudio 2).
    - **Inmuebles Individuales**: Direct list (Locales, Casas sin división, Bodegas, etc.).

### Out of Scope
- Automatic monthly billing cron generation (utilities remain as base template records).
- Tenant contract legal document generation.

## Capabilities

### New Capabilities
- `property-typology-hierarchy`: Hierarchical grouping and rendering of properties by structural typology (Torres, Casas, Unidades independientes).
- `property-utility-templates`: Default public utility checklist and amount assignment during property registration.

### Modified Capabilities
- `owner-property-crud`: Enhanced landlord management with direct inline editing and quick creation from the main properties view.

## Approach
1. Update `NavTab` / `Sidebar.tsx` / `App.tsx` navigation labels and routing.
2. Refactor `EntitiesView.tsx` (or extract to `PropertiesHierarchyView.tsx`) to implement landlord edit buttons, top toolbar actions, and typology-based grouping (Torres / Casas / Individuales).
3. Extend `PropertyModal.tsx` with utility options checklist and connect to `db.addUtility` upon property creation.

## Affected Areas
| Area | Impact | Description |
|------|--------|-------------|
| `src/types/index.ts` | Modified | Add utility template config to Property creation payload and typology groups |
| `src/components/layout/Sidebar.tsx` | Modified | Rename tab to "Propiedades" |
| `src/components/crud/PropertyModal.tsx` | Modified | Add utility checklist and amounts selector |
| `src/views/EntitiesView.tsx` | Modified | Add landlord edit button, new landlord action, and typology hierarchy renderer |
| `src/App.tsx` | Modified | Update tab titles and headers |

## Risks
| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Multi-property creation (Torre/Casa) duplicating utility records | Medium | Create utilities per generated sub-unit cleanly in a loop |

## Rollback Plan
Revert changes to `Sidebar.tsx`, `EntitiesView.tsx`, and `PropertyModal.tsx` via git.

## Success Criteria
- [ ] Tab named "Propiedades" displays the landlord accordion hierarchy by default.
- [ ] "Nuevo Arrendador" and "Editar Arrendador" work seamlessly from the view.
- [ ] Properties in a Torre or Casa are visually clustered under their respective parent building group.
- [ ] New properties save with selected default utility service templates in SQLite.
