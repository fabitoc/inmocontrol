# Delta Specifications: `utilities-landlord-grouping-and-equal-split-billing`

## Capability: `utilities-equal-split-billing`

### Requirement: Master Invoice Equal-Split Billing Assignment
The system MUST provide a master bill assignment workflow that allows selecting a building structure (Torre, Casa dividida, or single property), entering the total invoice amount in COP, specifying the due date, and automatically dividing the amount in equal parts (`Math.round(total / units.length)`) across all member sub-units.

#### Scenario: Prorate a master water bill across a 4-unit tower
- **Given** a Tower with 4 apartments (TA-101, TA-102, TA-201, TA-202)
- **When** the administrator assigns a Master Water Bill of `$400,000 COP` due on `2026-09-05`
- **Then** the system MUST create 4 distinct `ServicioPublico` records in SQLite, each with `tipo_servicio: 'Agua'`, `monto_estimado: 100000`, `fecha_vencimiento: '2026-09-05'`, and `estado: 'Pendiente'`.

#### Scenario: Assign utility bill to single standalone property
- **Given** a standalone commercial property (Local 101)
- **When** the administrator assigns an Electricity bill of `$250,000 COP`
- **Then** the system MUST create a single `ServicioPublico` record for Local 101 of `$250,000 COP`.

---

## Capability: `billing-utilities-management` (MODIFIED)

### Requirement: Landlord-Centric Utility Directory Hierarchy
The system MUST display public utilities grouped first by **Arrendador** (accordion card with owner details and total pending utility balance), and second by **Building Typology** (Torres, Casas subdivididas, Individuales).

(Previously: Properties were displayed in a flat list without landlord grouping).

#### Scenario: View utilities grouped under landlord accordion
- **Given** multiple properties owned by Carlos Silva
- **When** the administrator opens the "Servicios Públicos" subtab
- **Then** the system MUST render a dedicated accordion card for Carlos Silva displaying total pending utility debt, and containing building clusters with "Asignar Cobro de Servicio" action buttons.

---

## Capability: `property-utility-templates` (MODIFIED)

### Requirement: Zero-Price Service Assignment at Property Registration
The system MUST allow tagging applicable public utility services (Agua, Energía, Gas, Internet, etc.) during property registration without requiring monetary price entry.

(Previously: Required entering estimated monetary amounts during property registration).

#### Scenario: Check applicable services without price input
- **Given** the PropertyModal creation form
- **When** the administrator checks "Agua" and "Energía"
- **Then** the modal MUST NOT request monetary amounts
- **And** the property SHALL be registered with these utility types enabled as assignable services.
