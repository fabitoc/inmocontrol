# Delta Specifications: `properties-hierarchy-and-utility-defaults`

## Capability: `property-typology-hierarchy`

### Requirement: Landlord-Centric Property Typology Clustering
The system MUST render properties grouped by parent Arrendador, and within each landlord, cluster properties into structural typologies:
1. **Torres**: Group header showing tower name/code, total units, occupied units, and sub-table of apartments with tenant, canon, and status.
2. **Casas Subdivididas**: Group header showing house address, division type (Pisos vs Apartaestudios), and sub-table of levels/units.
3. **Inmuebles Individuales**: Direct unit table for standalone properties (Apartamentos independientes, Casas no subdivididas, Locales, Bodegas, Garajes).

#### Scenario: Display tower properties grouped under parent landlord
- **Given** an Arrendador with 4 properties created as part of "Torre A" (TA-101, TA-102, TA-201, TA-202)
- **When** the administrator navigates to the "Propiedades" view and expands the landlord card
- **Then** the system MUST display a "Torre A" section card containing the 4 apartments itemized with their respective tenant, canon, and occupancy badge.

#### Scenario: Display house floors grouped under subdivided house
- **Given** an Arrendador with a property subdivided into 3 floors (Piso 1, Piso 2, Piso 3)
- **When** the administrator views the landlord's properties
- **Then** the system MUST cluster the 3 floor units under the parent house container.

---

## Capability: `property-utility-templates`

### Requirement: Utility Service Template Checklist in Property Creation
The system MUST provide an interactive utility service checklist (Agua, Energía, Gas, Internet, Otro) with optional estimated amounts in the property creation modal (`PropertyModal`).

#### Scenario: Save new property with default utility templates
- **Given** a new property registration form
- **When** the administrator checks "Agua ($80,000)" and "Energía ($120,000)" and clicks "Registrar Propiedad"
- **Then** the system MUST persist the property in SQLite
- **And** create initial template records in `ServiciosPublicos` with status `Pendiente` linked to the new property ID.

#### Scenario: Batch utility template assignment for Towers and Subdivided Houses
- **Given** a Tower property registration generating 4 apartments
- **When** the administrator selects "Energía" and "Agua" in the utility checklist
- **Then** the system MUST bootstrap individual utility template records for each generated apartment ID.

---

## Capability: `owner-property-crud` (MODIFIED)

### Requirement: Direct Landlord Creation and Inline Landlord Edition
The system MUST allow creating a new Landlord directly from the main Propiedades toolbar, and provide an "Editar" action directly in each landlord's accordion card header to open `OwnerModal` for editing.

(Previously: Landlord editing was only available in a separate Arrendadores subtab table).

#### Scenario: Open landlord edit modal from properties accordion card
- **Given** an expanded landlord card in the Propiedades view
- **When** the administrator clicks the "Editar" button on the landlord header
- **Then** the system MUST open the `OwnerModal` preloaded with the landlord's current details (Nombre, Cédula/NIT, Teléfono, Email, Cuenta Bancaria, Día de corte)
- **And** immediately update the header upon saving.
