# Design: `utilities-landlord-grouping-and-equal-split-billing`

## Technical Approach
Restructure the application navigation to 4 cohesive modules (`dashboard`, `finanzas`, `administracion`, `settings`). Move the hierarchical Properties view inside `AdministracionView.tsx`. Refactor `PropertyModal.tsx` so utility assignment is a pure checkbox list. Create `AssignUtilityBillModal.tsx` to handle master utility invoice entry and equal-split division across child units (`total / count`).

## Architecture Decisions

### Decision 1: Master Invoice Equal-Split Model
- **Choice**: When assigning a utility bill to a building cluster (Torre or Casa Subdividida), accept `(totalAmount, utilityType, dueDate)` and distribute `amountPerUnit = Math.round(totalAmount / units.length)` across each member property ID.
- **Alternatives considered**: Require manual bill creation for each individual apartment.
- **Rationale**: Eliminates human calculation errors, saves time, and matches standard Colombian property management practices for master utility meters.

### Decision 2: Navigation Consolidation
- **Choice**: `NavTab = 'dashboard' | 'finanzas' | 'administracion' | 'settings'`. Inside `AdministracionView.tsx`, subtabs:
  - `arriendos` (Arriendos y Recaudos)
  - `servicios` (Servicios Públicos con jerarquía de arrendadores y división equitativa)
  - `mantenimiento` (Mantenimiento y Reparaciones)
  - `propiedades` (Catálogo jerárquico de Arrendadores, Torres, Casas e Inquilinos con edición inline)
  - `inquilinos` (Directorio de Arrendatarios)
- **Rationale**: Centralizes all administrative operations in one place and keeps the sidebar clean.

## File Changes
| File | Action | Description |
|------|--------|-------------|
| `src/types/index.ts` | Modify | Update `NavTab` to 4 tabs |
| `src/components/layout/Sidebar.tsx` | Modify | Sidebar with 4 primary items |
| `src/App.tsx` | Modify | Tab routing and header mappings |
| `src/components/crud/PropertyModal.tsx` | Modify | Simplify utility service selection to checkboxes without price inputs |
| `src/components/crud/AssignUtilityBillModal.tsx` | Create | New modal to assign and prorate master bills equally across units |
| `src/views/AdministracionView.tsx` | Modify | Reorganize Servicios Públicos by Landlord + Typology, integrate "Asignar Cobro" button, and embed hierarchical Propiedades view |

## Interfaces / Contracts

```typescript
export interface AssignUtilityBillPayload {
  targetType: 'Torre' | 'Casa' | 'Propiedad';
  targetName: string;
  propertyIds: string[];
  tipo_servicio: UtilityType;
  monto_total: number;
  fecha_vencimiento: string;
}
```
