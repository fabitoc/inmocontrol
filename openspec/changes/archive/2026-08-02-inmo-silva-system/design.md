# Technical Design: InmoAdmin System (`inmo-silva-system`)

## 1. Architecture Overview
InmoAdmin is designed as a lightweight, offline-first desktop application leveraging **Tauri v2** with a **React (TypeScript + Vite + Tailwind CSS)** frontend and an embedded **SQLite** database.

- **Tauri IPC Bridge**: Handles local database access, file I/O, and PDF export via native Rust commands.
- **Frontend Layer**: React SPA using Tailwind CSS for UI layout, Lucide React icons, and custom hooks for database operations.
- **Persistence Layer**: Local SQLite database (`inmoadmin.db`) with full transactional support.

## 2. Visual Theme & Fluent Dark Tokens
The UI adopts a Fluent Design dark aesthetic accented with warm desaturated amber/bronze tones to ensure high readability and minimal eye strain.

| Token Key | Color Code | Usage |
|---|---|---|
| `bg-canvas` | `#09090B` | Root application background |
| `bg-surface` | `#0F172A` | Cards, modals, sidebars, header panels |
| `border-subtle` | `#1E293B` | Dividers, card borders, input borders |
| `text-primary` | `#F8FAFC` | Main headings, body text, data values |
| `text-muted` | `#94A3B8` | Labels, table headers, secondary text |
| `accent-primary` | `#D97706` | Primary action buttons, active tab indicators |
| `accent-hover` | `#B45309` | Hover states for amber interactive components |
| `accent-subtle` | `#78350F` | Active card backgrounds, selected row highlights |
| `status-danger` | `#EF4444` | Overdue rent alerts, negative balance indicators |
| `status-success` | `#10B981` | Positive balances, completed payment tags |

## 3. Database Schema (SQLite DDL)

```sql
CREATE TABLE IF NOT EXISTS Arrendadores (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    cedula_nit TEXT UNIQUE NOT NULL,
    telefono TEXT,
    email TEXT,
    cuenta_bancaria TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS Propiedades (
    id TEXT PRIMARY KEY,
    arrendador_id TEXT NOT NULL,
    direccion TEXT NOT NULL,
    canon_arriendo REAL NOT NULL CHECK (canon_arriendo >= 0),
    dia_corte INTEGER NOT NULL CHECK (dia_corte BETWEEN 1 AND 31),
    estado TEXT CHECK (estado IN ('Alquilada', 'Vacante', 'Mantenimiento')) DEFAULT 'Vacante',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (arrendador_id) REFERENCES Arrendadores(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS Arrendatarios (
    id TEXT PRIMARY KEY,
    propiedad_id TEXT UNIQUE,
    nombre TEXT NOT NULL,
    cedula_nit TEXT UNIQUE NOT NULL,
    telefono TEXT,
    email TEXT,
    fecha_inicio TEXT NOT NULL,
    fecha_fin TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (propiedad_id) REFERENCES Propiedades(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS Transacciones (
    id TEXT PRIMARY KEY,
    propiedad_id TEXT NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('Ingreso', 'Gasto')),
    categoria TEXT NOT NULL,
    concepto TEXT NOT NULL,
    monto REAL NOT NULL CHECK (monto >= 0),
    fecha TEXT NOT NULL,
    estado TEXT CHECK (estado IN ('Pagado', 'Pendiente')) DEFAULT 'Pagado',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (propiedad_id) REFERENCES Propiedades(id) ON DELETE CASCADE
);
```

## 4. PDF Settlement Engine Formula
The settlement calculation engine enforces a 100% net payout calculation model per owner property for a defined cutoff period:

$$\text{Saldo a Entregar (COP)} = \sum \text{Pago Arrendatario (Ingresos)} - \sum \text{Gastos Deducibles}$$

### Engine Workflow
1. **Fetch Transactions**: Query `Transacciones` where `propiedad_id = ?`, `estado = 'Pagado'`, and `fecha` falls within `[fecha_inicio, fecha_corte]`.
2. **Aggregate Totals**:
   - `Total_Ingresos` = sum of income records (`tipo = 'Ingreso'`).
   - `Total_Gastos` = sum of expense records (`tipo = 'Gasto'`).
   - `Saldo_a_Entregar` = `Total_Ingresos - Total_Gastos`.
3. **Format COP**: Standardize numeric amounts to Colombian Pesos (`$ #.##0 COP`).
4. **Render Document**: Output owner header details, itemized transaction tables, net breakdown summary box, and approval signatures.

## 5. File Structure (`src/`)

```
src/
├── assets/
├── components/
│   ├── ui/
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Modal.tsx
│   │   └── Table.tsx
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   └── Header.tsx
│   ├── dashboard/
│   │   ├── KpiCard.tsx
│   │   └── AlertsList.tsx
│   ├── admin/
│   │   ├── TransactionForm.tsx
│   │   └── SettlementPdfButton.tsx
│   └── crud/
│       ├── OwnerModal.tsx
│       ├── PropertyModal.tsx
│       └── TenantModal.tsx
├── hooks/
│   └── useDatabase.ts
├── services/
│   ├── db.ts
│   └── pdf.ts
├── types/
│   └── index.ts
├── views/
│   ├── DashboardView.tsx
│   ├── AdminView.tsx
│   ├── EntitiesView.tsx
│   └── SettingsView.tsx
├── App.tsx
└── main.tsx
```
