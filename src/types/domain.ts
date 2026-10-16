export type ModuleId =
  | 'dashboard-analitico'
  | 'registro-control'
  | 'mantenimientos'
  | 'administracion-alertas'
  | 'liquidaciones';

export interface Owner {
  id: number;
  name: string;
  document_id: string;
  phone: string;
  email: string;
  bank_name: string;
  bank_account_type: 'AHORROS' | 'CORRIENTE' | string;
  bank_account_number: string;
  created_at: string;
}

export interface NewOwnerInput {
  name: string;
  document_id: string;
  phone: string;
  email: string;
  bank_name: string;
  bank_account_type: string;
  bank_account_number: string;
}

export type PropertyStatus = 'DISPONIBLE' | 'OCUPADO';

export interface Property {
  id: number;
  owner_id: number;
  parent_property_id: number | null;
  code: string;
  title: string;
  address: string;
  property_type: string;
  base_rent_cop: number;
  commission_pct: number;
  fixed_fee_cop: number;
  cutoff_day: number;
  status: PropertyStatus;
  created_at: string;
}

export interface NewPropertyInput {
  owner_id: number;
  parent_property_id: number | null;
  code: string;
  title: string;
  address: string;
  property_type: string;
  base_rent_cop: number;
  commission_pct: number;
  fixed_fee_cop: number;
  cutoff_day: number;
  status: PropertyStatus;
}

export type ContractStatus = 'ACTIVO' | 'FINALIZADO' | 'MORA';

export interface TenantContract {
  id: number;
  property_id: number;
  tenant_name: string;
  tenant_document: string;
  guarantor_name: string;
  phone: string;
  monthly_rent_cop: number;
  start_date: string;
  end_date: string;
  cutoff_day: number;
  status: ContractStatus;
  created_at: string;
}

export interface NewContractInput {
  property_id: number;
  tenant_name: string;
  tenant_document: string;
  guarantor_name: string;
  phone: string;
  monthly_rent_cop: number;
  start_date: string;
  end_date: string;
  cutoff_day: number;
  status: ContractStatus;
}

export type PaymentStatus = 'PAGADO' | 'PENDIENTE' | 'MORA';

export interface RentPayment {
  id: number;
  contract_id: number;
  property_id: number;
  period_month: string;
  gross_amount_cop: number;
  payment_date: string;
  payment_method: string;
  reference_code: string;
  status: PaymentStatus;
}

export interface NewRentPaymentInput {
  contract_id: number;
  property_id: number;
  period_month: string;
  gross_amount_cop: number;
  payment_date: string;
  payment_method: string;
  reference_code: string;
  status: PaymentStatus;
}

export type DeductionStatus = 'Por Liquidar' | 'Liquidado';

export interface MaintenanceExpense {
  id: number;
  property_id: number;
  execution_date: string;
  category: string;
  description: string;
  technician_name: string;
  invoice_number: string;
  net_cost_cop: number;
  receipt_image_path: string;
  evidence_images_paths: string[];
  deduction_status: DeductionStatus;
  settlement_id: number | null;
}

export interface NewMaintenanceInput {
  property_id: number;
  execution_date: string;
  category: string;
  description: string;
  technician_name: string;
  invoice_number: string;
  net_cost_cop: number;
  receipt_image_path: string;
  evidence_images_paths: string[];
}

export interface Settlement {
  id: number;
  owner_id: number;
  period_month: string;
  gross_income_cop: number;
  commission_amount_cop: number;
  fixed_fee_amount_cop: number;
  maintenance_deduction_cop: number;
  net_payable_cop: number;
  sha256_seal: string;
  status: 'EJECUTADO';
  created_at: string;
}

export interface SmartAlert {
  id: string;
  type: 'PROXIMO_COBRO' | 'EN_MORA' | 'PENDIENTE_LIQUIDACION';
  severity: 'AMBER' | 'MAGENTA' | 'CYAN';
  title: string;
  subtitle: string;
  amount_cop: number;
  cutoff_label: string;
  property_id?: number;
}

export interface WeeklyTelemetryPoint {
  weekLabel: string;
  grossIncomeCop: number;
  maintenanceCostCop: number;
  netLiquidityCop: number;
}

export interface OwnerDashboardBundle {
  selected_owner: Owner;
  all_owners: Owner[];
  properties: Property[];
  contracts: TenantContract[];
  payments: RentPayment[];
  maintenances: MaintenanceExpense[];
  settlements: Settlement[];
  agency_total_properties: number;
  owner_property_count: number;
  agency_participation_pct: number;
  expected_monthly_collection_cop: number;
  collected_monthly_cop: number;
  pending_maintenance_cop: number;
  occupancy_rate_pct: number;
  query_time_ms: number;
}
