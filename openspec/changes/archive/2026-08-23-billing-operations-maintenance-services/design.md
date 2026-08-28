# Technical Design: Billing Operations, Maintenance & Utility Services

## 1. Architecture Decisions & Tradeoffs

| Decision | Selected Approach | Alternatives Considered | Tradeoffs & Rationale |
|---|---|---|---|
| **Evidence Storage** | Base64 Data URIs / JSON string arrays in SQLite & localStorage | Tauri file system binary paths | Portability across web/desktop preview without native Tauri FS locks; JSON arrays handle 1-4 compressed photos per repair cleanly. |
| **Facturación UI Hierarchy** | Sub-navigation bar inside AdministracionView Facturación tab (Mantenimiento, Servicios Públicos, Arriendos) | Separate top-level navigation routes in Sidebar | Keeps administrative operations unified under one module while avoiding navigation bloat in the main sidebar. |
| **PDF Generation Engine** | Pure CSS/HTML window print templates (window.open + @page letter) | Heavy client PDF libs (pdfmake, jsPDF) | Zero-dependency, native high-fidelity print rendering, effortless multi-column photo grids and page breaks. |
| **Tenant Repair Isolation** | Independent Mantenimientos table with esponsable: 'Inquilino' | Adding repair line items directly into rent invoices | Prevents rent corruption, contract base rent drift, and maintains clean audit trails for tenant repairs. |

## 2. Data Model & SQLite Schema

`sql
CREATE TABLE IF NOT EXISTS Mantenimientos (
    id TEXT PRIMARY KEY,
    propiedad_id TEXT NOT NULL,
    categoria TEXT NOT NULL,
    costo REAL NOT NULL CHECK (costo >= 0),
    fecha TEXT NOT NULL,
    tecnico_nombre TEXT,
    tecnico_contacto TEXT,
    descripcion TEXT NOT NULL,
    responsable TEXT NOT NULL CHECK (responsable IN ('Propietario', 'Inquilino')),
    evidencias_fotos TEXT DEFAULT '[]', -- JSON array of base64 strings
    evidencia_factura TEXT,             -- Base64 string or file URI
    estado TEXT CHECK (estado IN ('Completado', 'Pendiente')) DEFAULT 'Completado',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (propiedad_id) REFERENCES Propiedades(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ServiciosPublicos (
    id TEXT PRIMARY KEY,
    propiedad_id TEXT NOT NULL,
    tipo_servicio TEXT NOT NULL CHECK (tipo_servicio IN ('Agua', 'Energia', 'Gas', 'Internet', 'Otro')),
    monto_estimado REAL NOT NULL CHECK (monto_estimado >= 0),
    fecha_vencimiento TEXT NOT NULL,
    estado TEXT CHECK (estado IN ('Pendiente', 'Pagado', 'En Mora')) DEFAULT 'Pendiente',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (propiedad_id) REFERENCES Propiedades(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS RecibosPago (
    id TEXT PRIMARY KEY,
    transaccion_id TEXT,
    propiedad_id TEXT NOT NULL,
    tipo_recibo TEXT NOT NULL CHECK (tipo_recibo IN ('Arriendo', 'Servicios', 'Mantenimiento')),
    monto REAL NOT NULL CHECK (monto >= 0),
    metodo_pago TEXT NOT NULL CHECK (metodo_pago IN ('Transferencia', 'Efectivo', 'Consignacion', 'Otro')),
    notas TEXT,
    fecha_pago TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (propiedad_id) REFERENCES Propiedades(id) ON DELETE CASCADE
);
`

### TypeScript Interfaces (src/types/index.ts)

`	ypescript
export type MaintenanceResponsible = 'Propietario' | 'Inquilino';
export type MaintenanceStatus = 'Completado' | 'Pendiente';
export type UtilityType = 'Agua' | 'Energia' | 'Gas' | 'Internet' | 'Otro';
export type UtilityStatus = 'Pendiente' | 'Pagado' | 'En Mora';
export type PaymentReceiptType = 'Arriendo' | 'Servicios' | 'Mantenimiento';
export type PaymentMethod = 'Transferencia' | 'Efectivo' | 'Consignacion' | 'Otro';

export interface Mantenimiento {
  id: string;
  propiedad_id: string;
  categoria: string;
  costo: number;
  fecha: string;
  tecnico_nombre?: string;
  tecnico_contacto?: string;
  descripcion: string;
  responsable: MaintenanceResponsible;
  evidencias_fotos: string[];
  evidencia_factura?: string;
  estado: MaintenanceStatus;
  created_at?: string;
}

export interface ServicioPublico {
  id: string;
  propiedad_id: string;
  tipo_servicio: UtilityType;
  monto_estimado: number;
  fecha_vencimiento: string;
  estado: UtilityStatus;
  created_at?: string;
}

export interface ReciboPago {
  id: string;
  transaccion_id?: string;
  propiedad_id: string;
  tipo_recibo: PaymentReceiptType;
  monto: number;
  metodo_pago: PaymentMethod;
  notas?: string;
  fecha_pago: string;
  created_at?: string;
}

export interface PaymentReceiptData {
  receipt: ReciboPago;
  propiedad: Propiedad;
  arrendatario?: Arrendatario;
  detalles: { concepto: string; valor: number }[];
}
`

## 3. Component Architecture & Data Flow

`mermaid
graph TD
    A[AdministracionView] --> B[Facturación Subtabs]
    B --> C[MantenimientoView]
    B --> D[ServiciosPublicosView]
    B --> E[ArriendosView]
    
    C --> C1[MaintenanceModal: Photo Upload & Cost]
    C --> C2[Settlement Deduction: Propietario]
    
    D --> D1[Property Accordion & Mora Indicators]
    D --> D2[UtilityPaymentModal -> PDF Receipt]
    
    E --> E1[Rent Collections Table]
    E --> E2[Quick Payment Action -> PDF Receipt]
    
    C2 --> F[generateOwnerSettlementPDF]
    F --> F1[Appends Evidence Photo Sheets & Invoices]
    
    D2 --> G[generatePaymentReceiptPDF]
    E2 --> G
`

## 4. File Changes

| File | Nature | Key Responsibilities |
|---|---|---|
| src/types/index.ts | Modify | Add Mantenimiento, ServicioPublico, ReciboPago, PaymentReceiptData interfaces. |
| src/services/db.ts | Modify | Update schema DDL, seed data, and CRUD methods for maintenances, utilities, and receipts. |
| src/services/pdf.ts | Modify | Update generateOwnerSettlementPDF (photo grid evidence pages) and add generatePaymentReceiptPDF. |
| src/hooks/useDatabase.ts | Modify | Expose maintenance, utility, and payment receipt state + reactive queries. |
| src/views/AdministracionView.tsx | Modify | Integrate 3-way Facturación subtab switcher (Mantenimiento, Servicios Públicos, Arriendos). |
| src/components/crud/MaintenanceModal.tsx | Create | Modal for logging repairs with multi-image file reader & previews. |
| src/components/crud/UtilityPaymentModal.tsx | Create | Consolidated payment modal for utility bills with receipt emission. |
