export interface Arrendador {
  id: string;
  nombre: string;
  cedula_nit: string;
  telefono?: string;
  email?: string;
  cuenta_bancaria?: string;
  dia_corte_liquidacion: number; // 1 to 31 (Landlord settlement cutoff day)
  created_at?: string;
}

export type PropertyStatus = 'Alquilada' | 'Vacante' | 'Mantenimiento';
export type PropertyType = 'Apartamento' | 'Casa' | 'Torre' | 'Local' | 'Garaje' | 'Bodega' | 'Otro';
export type HouseDivisionType = 'Ninguna' | 'Pisos' | 'Apartaestudios';
export type AdminFeeType = 'Ninguna' | 'Porcentaje' | 'MontoFijo';

export interface Propiedad {
  id: string;
  arrendador_id: string;
  direccion: string;
  tipo_propiedad?: PropertyType;
  canon_arriendo: number;
  dia_vencimiento_pago: number; // 1 to 31 (Tenant rent due day)
  dia_corte?: number; // Legacy field retained for backward compatibility
  tipo_administracion?: AdminFeeType;
  valor_administracion?: number; // e.g. 10 for 10%, or 150000 for $150,000 COP
  cuota_administracion?: number; // Resulting monthly COP fee per unit
  estado: PropertyStatus;
  created_at?: string;
}

export interface Arrendatario {
  id: string;
  propiedad_id: string | null;
  nombre: string;
  cedula_nit: string;
  telefono?: string;
  email?: string;
  fecha_inicio: string; // YYYY-MM-DD
  fecha_fin?: string;   // YYYY-MM-DD
  created_at?: string;
}

export type TransactionType = 'Ingreso' | 'Gasto';
export type TransactionStatus = 'Pagado' | 'Pendiente';

export interface Transaccion {
  id: string;
  propiedad_id: string;
  tipo: TransactionType;
  categoria: string;
  concepto: string;
  monto: number;
  fecha: string; // YYYY-MM-DD
  estado: TransactionStatus;
  created_at?: string;
}

// Joined / Computed Entities
export interface PropiedadConArrendador extends Propiedad {
  arrendador_nombre?: string;
}

export interface ArrendatarioConPropiedad extends Arrendatario {
  propiedad_direccion?: string;
  canon_arriendo?: number;
}

export interface TransaccionConPropiedad extends Transaccion {
  propiedad_direccion?: string;
  arrendador_nombre?: string;
}

// Dashboard & Financial Summary Types
export interface FinancialSummary {
  totalIncomeMonth: number;
  totalPendingRent: number;
  activePropertiesCount: number;
  netPortfolioYield: number;
}

export interface OverdueAlert {
  tenantId: string;
  tenantName: string;
  propertyId: string;
  propertyAddress: string;
  dueDay: number;
  canonArriendo: number;
  daysOverdue: number;
}

export interface NegativeBalanceOwner {
  ownerId: string;
  ownerName: string;
  totalIncome: number;
  totalExpenses: number;
  netBalance: number; // Negative number
}

// Maintenance Domain Types
export type MaintenanceStatus = 'Completado' | 'Pendiente';
export type PaymentReceiptType = 'Arriendo' | 'Mantenimiento';
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
  evidencias_fotos: string[]; // JSON array of Base64 strings or URLs
  evidencia_factura?: string; // Base64 string or URL
  estado: MaintenanceStatus;
  created_at?: string;
}

export interface MantenimientoConPropiedad extends Mantenimiento {
  propiedad_direccion?: string;
  arrendador_nombre?: string;
}

export interface OwnerSettlement {
  owner: Arrendador;
  properties: Propiedad[];
  transactions: TransaccionConPropiedad[];
  maintenances?: Mantenimiento[];
  totalIncome: number;
  totalExpenses: number;
  totalAdminFees: number;
  netPayable: number; // 100% Net: Income - (Expenses + AdminFees)
  dateFrom: string;
  dateTo: string;
  month?: number; // 1 to 12
  year?: number;
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

export interface ReciboPagoConDetalles extends ReciboPago {
  propiedad_direccion?: string;
  arrendador_nombre?: string;
}

export interface PaymentReceiptData {
  receipt: ReciboPago;
  propiedad: Propiedad;
  arrendador?: Arrendador;
  arrendatario?: Arrendatario;
  detalles: { concepto: string; valor: number }[];
}

export type NavTab = 'dashboard' | 'finanzas' | 'administracion' | 'settings';
