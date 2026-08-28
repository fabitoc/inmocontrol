# Design: `properties-hierarchy-and-utility-defaults`

## Technical Approach
Unify the navigation by promoting the landlord-property hierarchy view to be the primary **"Propiedades"** module. Enhance `EntitiesView.tsx` with top toolbar shortcuts, inline landlord editing in the accordion header, and structural grouping (Torres / Casas / Individuales). Extend `PropertyModal.tsx` to configure template utility bills that are automatically inserted into `ServiciosPublicos` on creation.

## Architecture Decisions

### Decision 1: Navigation Renaming and Routing
- **Choice**: Rename `NavTab` `'gestionador'` to `'propiedades'`, update `Sidebar.tsx`, and make the landlord property hierarchy the default view.
- **Alternatives considered**: Keep "Gestionador" as a tab and add a duplicate "Propiedades" tab.
- **Rationale**: Eliminates redundancy and puts property asset management front and center.

### Decision 2: Utility Template Assignment Pattern
- **Choice**: Pass an array of enabled utility templates (`{ tipo: UtilityType; monto: number }[]`) from `PropertyModal` to the property creation handler. For multi-unit batches (Torres / Casas), bootstrap utility rows for each created unit.
- **Alternatives considered**: Require manual utility creation in a separate view.
- **Rationale**: Saves time and ensures newly registered units are instantly tracked in Servicios Públicos.

### Decision 3: Visual Typology Grouping Algorithm
- **Choice**: Group properties under each landlord by inspecting `tipo_propiedad` and address patterns:
  - `Torre`: Clustered by building/tower name.
  - `Casa`: Clustered by base address if divided into pisos/apartaestudios.
  - `Individuales`: Standalone list.
- **Rationale**: Gives property managers immediate clarity over building clusters and multi-unit structures.

## File Changes
| File | Action | Description |
|------|--------|-------------|
| `src/types/index.ts` | Modify | Update `NavTab` to include `'propiedades'` instead of `'gestionador'`, add `UtilityTemplateConfig` |
| `src/components/layout/Sidebar.tsx` | Modify | Update navigation items to display "Propiedades" (`Building2` icon) |
| `src/components/crud/PropertyModal.tsx` | Modify | Add utility template selection section with amounts |
| `src/views/EntitiesView.tsx` | Modify | Add landlord edit button, toolbar actions, and typology hierarchy layout |
| `src/App.tsx` | Modify | Update tab mappings and header titles |

## Interfaces / Contracts

```typescript
export interface UtilityTemplateItem {
  tipo: UtilityType;
  monto: number;
  enabled: boolean;
}

export interface PropertyCreationPayload {
  propertyData: Omit<Propiedad, 'id' | 'created_at'> | Omit<Propiedad, 'id' | 'created_at'>[];
  utilities: { tipo_servicio: UtilityType; monto_estimado: number }[];
}
```

## Testing & Verification
- Verify TypeScript compilation via `tsc --noEmit`.
- Test landlord inline edit opening `OwnerModal`.
- Test multi-unit creation (Torre/Casa) creating both properties and associated utility template records.
