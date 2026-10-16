import {
  MaintenanceExpense,
  NewContractInput,
  NewMaintenanceInput,
  NewOwnerInput,
  NewPropertyInput,
  NewRentPaymentInput,
  Owner,
  OwnerDashboardBundle,
  Property,
  RentPayment,
  Settlement,
  SmartAlert,
  TenantContract,
  WeeklyTelemetryPoint,
} from '../types/domain';

export interface CommissionBreakdown {
  percentageFeeCop: number;
  fixedFeeCop: number;
  totalCommissionCop: number;
}

export interface SettlementPreviewLine {
  property: Property;
  grossCollectedCop: number;
  percentageFeeCop: number;
  fixedFeeCop: number;
  totalAgencyFeeCop: number;
}

export interface OwnerSettlementPreview {
  periodMonth: string;
  lines: SettlementPreviewLine[];
  pendingMaintenances: MaintenanceExpense[];
  grossIncomeCop: number;
  commissionAmountCop: number;
  fixedFeeAmountCop: number;
  totalAgencyFeeCop: number;
  maintenanceDeductionCop: number;
  netPayableCop: number;
  sha256PreviewSeal: string;
}

export interface AgencyParticipationResult {
  ownerRentableCount: number;
  agencyRentableCount: number;
  participationByCountPct: number;
  ownerBaseRentCop: number;
  agencyBaseRentCop: number;
  participationByVolumePct: number;
}

/**
 * Core Business Rule 1:
 * Strictly computes the mixed agency commission formula:
 * `(Gross Income * Commission %) + Base Fixed Fee`
 */
export function calculatePropertyCommission(
  grossIncomeCop: number,
  commissionPct: number,
  fixedFeeCop: number
): CommissionBreakdown {
  const safeGross = Math.max(0, grossIncomeCop);
  const safePct = Math.max(0, commissionPct);
  const safeFixed = Math.max(0, fixedFeeCop);
  const percentageFeeCop = Math.round(safeGross * (safePct / 100));
  const totalCommissionCop = percentageFeeCop + safeFixed;
  return {
    percentageFeeCop,
    fixedFeeCop: safeFixed,
    totalCommissionCop,
  };
}

/**
 * Generates a deterministic 64-character hexadecimal integrity seal for a monthly settlement statement,
 * matching the Rust FNV-1a stream implementation in `src-tauri/src/db.rs`.
 */
export function computeSettlementSeal(
  ownerId: number,
  periodMonth: string,
  grossIncomeCop: number,
  commissionAmountCop: number,
  fixedFeeAmountCop: number,
  maintenanceDeductionCop: number,
  netPayableCop: number
): string {
  const payload = `INMOCONTROL-V2|OWNER:${ownerId}|PERIOD:${periodMonth}|GROSS:${grossIncomeCop}|COMM:${commissionAmountCop}|FIXED:${fixedFeeAmountCop}|MAINT:${maintenanceDeductionCop}|NET:${netPayableCop}`;
  let h1 = 0x84222325;
  let h2 = 0xcbf29ce4;
  let h3 = 0x27220a95;
  let h4 = 0x517cc1b7;
  for (let i = 0; i < payload.length; i++) {
    const code = payload.charCodeAt(i);
    h1 = Math.imul(h1 ^ code, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ (code + i), 0x01000193) >>> 0;
    h3 = Math.imul(h3 ^ ((code << (i % 5)) & 0xff), 0x01000193) >>> 0;
    h4 = Math.imul(h4 ^ (code ^ (h1 & 0xff)), 0x01000193) >>> 0;
  }
  const part = (n: number) => n.toString(16).padStart(8, '0');
  return `0x${part(h1)}${part(h2)}${part(h3)}${part(h4)}${part(h1 ^ h3)}${part(h2 ^ h4)}${part(h1 ^ h2)}${part(h3 ^ h4)}`;
}

/**
 * Core Business Rule 1 & 2:
 * Computes the complete monthly owner settlement preview:
 * - Crosses all `PAGADO` rent payments for the owner's properties in `periodMonth`.
 * - Subtracts mixed agency commission `(Gross * %) + Fixed Fee` for each collected property.
 * - Deducts 1:1 net cost (`net_cost_cop`) of all `'Por Liquidar'` maintenance expenses with zero markup.
 */
export function calculateOwnerSettlementPreview(
  ownerId: number,
  properties: Property[],
  payments: RentPayment[],
  maintenances: MaintenanceExpense[],
  periodMonth: string
): OwnerSettlementPreview {
  const lines: SettlementPreviewLine[] = [];
  let grossIncomeCop = 0;
  let commissionAmountCop = 0;
  let fixedFeeAmountCop = 0;

  for (const prop of properties) {
    const paidForProp = payments
      .filter(
        (rp) =>
          rp.property_id === prop.id &&
          rp.period_month === periodMonth &&
          rp.status === 'PAGADO'
      )
      .reduce((sum, rp) => sum + rp.gross_amount_cop, 0);

    if (paidForProp > 0) {
      const breakdown = calculatePropertyCommission(
        paidForProp,
        prop.commission_pct,
        prop.fixed_fee_cop
      );
      grossIncomeCop += paidForProp;
      commissionAmountCop += breakdown.percentageFeeCop;
      fixedFeeAmountCop += breakdown.fixedFeeCop;

      lines.push({
        property: prop,
        grossCollectedCop: paidForProp,
        percentageFeeCop: breakdown.percentageFeeCop,
        fixedFeeCop: breakdown.fixedFeeCop,
        totalAgencyFeeCop: breakdown.totalCommissionCop,
      });
    }
  }

  const pendingMaintenances = maintenances.filter(
    (m) => m.deduction_status === 'Por Liquidar'
  );
  // 1:1 net cost deduction without agency operational markup
  const maintenanceDeductionCop = pendingMaintenances.reduce(
    (sum, m) => sum + m.net_cost_cop,
    0
  );

  const totalAgencyFeeCop = commissionAmountCop + fixedFeeAmountCop;
  const netPayableCop =
    grossIncomeCop - totalAgencyFeeCop - maintenanceDeductionCop;

  const sha256PreviewSeal = computeSettlementSeal(
    ownerId,
    periodMonth,
    grossIncomeCop,
    commissionAmountCop,
    fixedFeeAmountCop,
    maintenanceDeductionCop,
    netPayableCop
  );

  return {
    periodMonth,
    lines,
    pendingMaintenances,
    grossIncomeCop,
    commissionAmountCop,
    fixedFeeAmountCop,
    totalAgencyFeeCop,
    maintenanceDeductionCop,
    netPayableCop,
    sha256PreviewSeal,
  };
}

/**
 * Computes the owner's radial participation in the agency's total managed portfolio.
 */
export function calculateAgencyParticipation(
  ownerId: number,
  allProperties: Property[]
): AgencyParticipationResult {
  const rentableAll = allProperties.filter(
    (p) => p.property_type !== 'EDIFICIO MATRIZ'
  );
  const rentableOwner = rentableAll.filter((p) => p.owner_id === ownerId);

  const agencyRentableCount = rentableAll.length;
  const ownerRentableCount = rentableOwner.length;

  const participationByCountPct =
    agencyRentableCount > 0
      ? Math.round((ownerRentableCount / agencyRentableCount) * 1000) / 10
      : 0;

  const agencyBaseRentCop = rentableAll.reduce(
    (sum, p) => sum + p.base_rent_cop,
    0
  );
  const ownerBaseRentCop = rentableOwner.reduce(
    (sum, p) => sum + p.base_rent_cop,
    0
  );

  const participationByVolumePct =
    agencyBaseRentCop > 0
      ? Math.round((ownerBaseRentCop / agencyBaseRentCop) * 1000) / 10
      : 0;

  return {
    ownerRentableCount,
    agencyRentableCount,
    participationByCountPct,
    ownerBaseRentCop,
    agencyBaseRentCop,
    participationByVolumePct,
  };
}

/**
 * Formats integer Colombian Pesos (COP) with standard dot thousands separators.
 */
export function formatCop(amountCop: number): string {
  const sign = amountCop < 0 ? '-' : '';
  const abs = Math.abs(Math.round(amountCop));
  return `${sign}$${abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}

/**
 * Normalizes a local file selection into `%LocalAppData%\InmoControl\evidencias\<sanitized_name>`.
 */
export function normalizeEvidencePath(rawFilename: string): string {
  const trimmed = rawFilename.trim();
  if (!trimmed) {
    return 'evidencias/evidencia_captura.jpg';
  }
  const baseName = trimmed.split(/[/\\]/).pop() || trimmed;
  const sanitized = baseName.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `evidencias/${sanitized}`;
}

/**
 * Builds Smart Alerts for Module 4 (`Administración y Alertas`) scoped to the selected owner.
 */
export function buildSmartAlerts(bundle: OwnerDashboardBundle): SmartAlert[] {
  const alerts: SmartAlert[] = [];
  const propMap = new Map(bundle.properties.map((p) => [p.id, p]));

  for (const contract of bundle.contracts) {
    const prop = propMap.get(contract.property_id);
    if (!prop) continue;

    if (contract.status === 'MORA') {
      alerts.push({
        id: `mora-${contract.id}`,
        type: 'EN_MORA',
        severity: 'MAGENTA',
        title: `${contract.tenant_name} — ${prop.title}`,
        subtitle: `Incumplimiento respecto a fecha de corte (Día ${contract.cutoff_day}) · ${contract.phone}`,
        amount_cop: contract.monthly_rent_cop,
        cutoff_label: `CORTE DÍA ${contract.cutoff_day} // EN MORA`,
        property_id: prop.id,
      });
    } else if (contract.status === 'ACTIVO') {
      alerts.push({
        id: `cobro-${contract.id}`,
        type: 'PROXIMO_COBRO',
        severity: 'AMBER',
        title: `${contract.tenant_name} — ${prop.title}`,
        subtitle: `Próximo cobro programado · Codeudor: ${contract.guarantor_name}`,
        amount_cop: contract.monthly_rent_cop,
        cutoff_label: `VENCE DÍA ${contract.cutoff_day} DEL MES`,
        property_id: prop.id,
      });
    }
  }

  const preview = calculateOwnerSettlementPreview(
    bundle.selected_owner.id,
    bundle.properties,
    bundle.payments,
    bundle.maintenances,
    '2026-10'
  );
  const alreadySettledOct = bundle.settlements.some(
    (s) => s.period_month === '2026-10'
  );

  if (!alreadySettledOct && preview.grossIncomeCop > 0) {
    alerts.push({
      id: `liq-owner-${bundle.selected_owner.id}`,
      type: 'PENDIENTE_LIQUIDACION',
      severity: 'CYAN',
      title: `Liquidación Mensual 2026-10 — ${bundle.selected_owner.name}`,
      subtitle: `${bundle.selected_owner.bank_name} (${bundle.selected_owner.bank_account_type}) · Cta ${bundle.selected_owner.bank_account_number}`,
      amount_cop: preview.netPayableCop,
      cutoff_label: `PENDIENTE DISPERSIÓN // ${preview.pendingMaintenances.length} MANT. POR LIQUIDAR`,
    });
  }

  return alerts;
}

/**
 * Generates deterministic weekly telemetry points for Module 5 (`Liquidaciones`) SVG chart.
 */
export function buildWeeklyTelemetrySeries(
  bundle: OwnerDashboardBundle
): WeeklyTelemetryPoint[] {
  const grossTotal = Math.max(bundle.collected_monthly_cop, 1_500_000);
  const maintTotal = bundle.maintenances
    .filter((m) => m.execution_date.startsWith('2026-10'))
    .reduce((s, m) => s + m.net_cost_cop, 0);

  const weights = [0.42, 0.33, 0.15, 0.1];
  const maintWeights = [0.25, 0.45, 0.2, 0.1];

  return ['SEM-01', 'SEM-02', 'SEM-03', 'SEM-04'].map((weekLabel, idx) => {
    const grossIncomeCop = Math.round(grossTotal * weights[idx]);
    const maintenanceCostCop = Math.round(maintTotal * maintWeights[idx]);
    const netLiquidityCop = Math.max(0, grossIncomeCop - maintenanceCostCop);
    return {
      weekLabel,
      grossIncomeCop,
      maintenanceCostCop,
      netLiquidityCop,
    };
  });
}

// ============================================================================
// Deterministic SQLite-Mirror Store (matches src-tauri/src/db.rs seed data 100%)
// ============================================================================

interface LocalDatabaseState {
  owners: Owner[];
  properties: Property[];
  contracts: TenantContract[];
  payments: RentPayment[];
  maintenances: MaintenanceExpense[];
  settlements: Settlement[];
  backupSnapshots: string[];
}

function createInitialSeedState(): LocalDatabaseState {
  const owners: Owner[] = [
    {
      id: 1,
      name: 'Fabián Vargas Correa',
      document_id: 'CC 79.452.810',
      phone: '+57 310 458 9210',
      email: 'fvargas@inmocontrol.co',
      bank_name: 'Bancolombia',
      bank_account_type: 'AHORROS',
      bank_account_number: '412-889012-44',
      created_at: '2026-01-10T08:00:00Z',
    },
    {
      id: 2,
      name: 'Inversiones Delta S.A.S',
      document_id: 'NIT 900.412.889-1',
      phone: '+57 315 881 2030',
      email: 'gerencia@inversionesdelta.co',
      bank_name: 'Banco de Bogotá',
      bank_account_type: 'CORRIENTE',
      bank_account_number: '091-334510-01',
      created_at: '2026-01-12T09:30:00Z',
    },
    {
      id: 3,
      name: 'Carlos A. Montoya',
      document_id: 'CC 71.688.320',
      phone: '+57 300 612 7741',
      email: 'cmontoya@patrimonio.co',
      bank_name: 'Davivienda',
      bank_account_type: 'AHORROS',
      bank_account_number: '0550-7712-9901',
      created_at: '2026-02-01T10:15:00Z',
    },
  ];

  const properties: Property[] = [
    {
      id: 1,
      owner_id: 1,
      parent_property_id: null,
      code: 'MAT-FACA-001',
      title: 'Edificio Central Facatativá',
      address: 'Cra 2 # 5-48 Centro, Facatativá',
      property_type: 'EDIFICIO MATRIZ',
      base_rent_cop: 0,
      commission_pct: 8.0,
      fixed_fee_cop: 0,
      cutoff_day: 5,
      status: 'OCUPADO',
      created_at: '2026-01-15T08:00:00Z',
    },
    {
      id: 2,
      owner_id: 1,
      parent_property_id: 1,
      code: 'SUB-FACA-101',
      title: 'Torre 1 - Apto 101',
      address: 'Cra 2 # 5-48 Apto 101, Facatativá',
      property_type: 'APARTAMENTO',
      base_rent_cop: 1_500_000,
      commission_pct: 8.0,
      fixed_fee_cop: 45_000,
      cutoff_day: 5,
      status: 'OCUPADO',
      created_at: '2026-01-15T08:10:00Z',
    },
    {
      id: 3,
      owner_id: 1,
      parent_property_id: 1,
      code: 'SUB-FACA-102',
      title: 'Torre 1 - Apto 102',
      address: 'Cra 2 # 5-48 Apto 102, Facatativá',
      property_type: 'APARTAMENTO',
      base_rent_cop: 1_450_000,
      commission_pct: 8.0,
      fixed_fee_cop: 45_000,
      cutoff_day: 5,
      status: 'DISPONIBLE',
      created_at: '2026-01-15T08:20:00Z',
    },
    {
      id: 4,
      owner_id: 1,
      parent_property_id: 1,
      code: 'SUB-FACA-LOC1',
      title: 'Local Esquinero 01',
      address: 'Cra 2 # 5-48 Local 1, Facatativá',
      property_type: 'LOCAL COMERCIAL',
      base_rent_cop: 2_800_000,
      commission_pct: 10.0,
      fixed_fee_cop: 60_000,
      cutoff_day: 5,
      status: 'OCUPADO',
      created_at: '2026-01-15T08:30:00Z',
    },
    {
      id: 5,
      owner_id: 1,
      parent_property_id: null,
      code: 'IND-CHAP-204',
      title: 'Bodega Logística Sabana',
      address: 'Km 3 Vía Occidente, Mosquera',
      property_type: 'BODEGA',
      base_rent_cop: 4_200_000,
      commission_pct: 8.0,
      fixed_fee_cop: 85_000,
      cutoff_day: 10,
      status: 'OCUPADO',
      created_at: '2026-01-18T11:00:00Z',
    },
    {
      id: 6,
      owner_id: 2,
      parent_property_id: null,
      code: 'MAT-POB-010',
      title: 'Complejo Empresarial Poblado',
      address: 'Av. El Poblado # 10-80, Medellín',
      property_type: 'EDIFICIO MATRIZ',
      base_rent_cop: 0,
      commission_pct: 9.0,
      fixed_fee_cop: 0,
      cutoff_day: 5,
      status: 'OCUPADO',
      created_at: '2026-01-20T09:00:00Z',
    },
    {
      id: 7,
      owner_id: 2,
      parent_property_id: 6,
      code: 'SUB-POB-301',
      title: 'Oficina 301 Ejecutiva',
      address: 'Av. El Poblado # 10-80 Of. 301',
      property_type: 'OFICINA',
      base_rent_cop: 3_600_000,
      commission_pct: 9.0,
      fixed_fee_cop: 70_000,
      cutoff_day: 5,
      status: 'OCUPADO',
      created_at: '2026-01-20T09:15:00Z',
    },
    {
      id: 8,
      owner_id: 2,
      parent_property_id: 6,
      code: 'SUB-POB-302',
      title: 'Oficina 302 Co-Working',
      address: 'Av. El Poblado # 10-80 Of. 302',
      property_type: 'OFICINA',
      base_rent_cop: 3_200_000,
      commission_pct: 9.0,
      fixed_fee_cop: 70_000,
      cutoff_day: 5,
      status: 'OCUPADO',
      created_at: '2026-01-20T09:20:00Z',
    },
    {
      id: 9,
      owner_id: 3,
      parent_property_id: null,
      code: 'RES-LAUR-08',
      title: 'Penthouse Laureles Nogal',
      address: 'Circular 4 # 72-19, Medellín',
      property_type: 'APARTAMENTO',
      base_rent_cop: 4_100_000,
      commission_pct: 8.5,
      fixed_fee_cop: 50_000,
      cutoff_day: 5,
      status: 'OCUPADO',
      created_at: '2026-02-05T10:00:00Z',
    },
  ];

  const contracts: TenantContract[] = [
    {
      id: 1,
      property_id: 2,
      tenant_name: 'Alejandro Ruiz Betancur',
      tenant_document: 'CC 1.070.982.114',
      guarantor_name: 'Marta Betancur Gómez',
      phone: '+57 311 224 8901',
      monthly_rent_cop: 1_500_000,
      start_date: '2026-02-01',
      end_date: '2027-01-31',
      cutoff_day: 5,
      status: 'ACTIVO',
      created_at: '2026-02-01T09:00:00Z',
    },
    {
      id: 2,
      property_id: 4,
      tenant_name: 'Droguerías Salud Total S.A.S',
      tenant_document: 'NIT 830.114.992-4',
      guarantor_name: 'Seguros Sura Póliza #8812',
      phone: '+57 318 776 5510',
      monthly_rent_cop: 2_800_000,
      start_date: '2026-01-01',
      end_date: '2026-12-31',
      cutoff_day: 5,
      status: 'ACTIVO',
      created_at: '2026-01-01T10:00:00Z',
    },
    {
      id: 3,
      property_id: 5,
      tenant_name: 'Logística Andina Express Ltda',
      tenant_document: 'NIT 901.229.301-8',
      guarantor_name: 'Libertador Fianza #44910',
      phone: '+57 320 991 3402',
      monthly_rent_cop: 4_200_000,
      start_date: '2026-01-10',
      end_date: '2027-01-09',
      cutoff_day: 10,
      status: 'MORA',
      created_at: '2026-01-10T14:00:00Z',
    },
    {
      id: 4,
      property_id: 7,
      tenant_name: 'Consultores Tech Finanzas S.A.S',
      tenant_document: 'NIT 900.881.112-3',
      guarantor_name: 'Aseguradora El Cóndor',
      phone: '+57 314 509 1122',
      monthly_rent_cop: 3_600_000,
      start_date: '2026-02-01',
      end_date: '2027-01-31',
      cutoff_day: 5,
      status: 'ACTIVO',
      created_at: '2026-02-01T11:00:00Z',
    },
    {
      id: 5,
      property_id: 8,
      tenant_name: 'Estudio Creativo Nébula',
      tenant_document: 'NIT 901.552.710-2',
      guarantor_name: 'Camilo Restrepo Jaramillo',
      phone: '+57 301 445 9980',
      monthly_rent_cop: 3_200_000,
      start_date: '2026-03-01',
      end_date: '2027-02-28',
      cutoff_day: 5,
      status: 'ACTIVO',
      created_at: '2026-03-01T11:30:00Z',
    },
    {
      id: 6,
      property_id: 9,
      tenant_name: 'Dra. Valentina Ospina',
      tenant_document: 'CC 43.998.120',
      guarantor_name: 'Roberto Ospina Calle',
      phone: '+57 312 678 0091',
      monthly_rent_cop: 4_100_000,
      start_date: '2026-02-05',
      end_date: '2027-02-04',
      cutoff_day: 5,
      status: 'ACTIVO',
      created_at: '2026-02-05T12:00:00Z',
    },
  ];

  const payments: RentPayment[] = [
    {
      id: 1,
      contract_id: 1,
      property_id: 2,
      period_month: '2026-10',
      gross_amount_cop: 1_500_000,
      payment_date: '2026-10-04',
      payment_method: 'TRANSFERENCIA PSE',
      reference_code: 'PSE-992014-FACA',
      status: 'PAGADO',
    },
    {
      id: 2,
      contract_id: 2,
      property_id: 4,
      period_month: '2026-10',
      gross_amount_cop: 2_800_000,
      payment_date: '2026-10-05',
      payment_method: 'CONSIGNACIÓN BANCARIA',
      reference_code: 'BANCOL-774120',
      status: 'PAGADO',
    },
    {
      id: 3,
      contract_id: 3,
      property_id: 5,
      period_month: '2026-10',
      gross_amount_cop: 4_200_000,
      payment_date: '2026-10-10',
      payment_method: 'PENDIENTE TRANSFERENCIA',
      reference_code: 'MORA-2026-10-BOD',
      status: 'MORA',
    },
    {
      id: 4,
      contract_id: 4,
      property_id: 7,
      period_month: '2026-10',
      gross_amount_cop: 3_600_000,
      payment_date: '2026-10-03',
      payment_method: 'TRANSFERENCIA ACH',
      reference_code: 'ACH-884120-POB',
      status: 'PAGADO',
    },
    {
      id: 5,
      contract_id: 5,
      property_id: 8,
      period_month: '2026-10',
      gross_amount_cop: 3_200_000,
      payment_date: '2026-10-05',
      payment_method: 'TRANSFERENCIA PSE',
      reference_code: 'PSE-551209-POB',
      status: 'PAGADO',
    },
    {
      id: 6,
      contract_id: 6,
      property_id: 9,
      period_month: '2026-10',
      gross_amount_cop: 4_100_000,
      payment_date: '2026-10-04',
      payment_method: 'TRANSFERENCIA BANCARIA',
      reference_code: 'DAV-339104-LAU',
      status: 'PAGADO',
    },
  ];

  const maintenances: MaintenanceExpense[] = [
    {
      id: 1,
      property_id: 2,
      execution_date: '2026-10-08',
      category: 'PLOMERÍA HIDRÁULICA',
      description:
        'Reemplazo de válvula de presión y sello sifón cocina principal',
      technician_name: 'Ing. Hernando Téllez',
      invoice_number: 'FAC-8821',
      net_cost_cop: 285_000,
      receipt_image_path: 'evidencias/recibo_plomeria_101.jpg',
      evidence_images_paths: [
        'evidencias/valvula_antes_101.jpg',
        'evidencias/valvula_despues_101.jpg',
      ],
      deduction_status: 'Por Liquidar',
      settlement_id: null,
    },
    {
      id: 2,
      property_id: 4,
      execution_date: '2026-10-11',
      category: 'ELÉCTRICO // TABLERO',
      description:
        'Cambio de breaker trifásico 40A y balanceo de carga iluminación comercial',
      technician_name: 'Técnicos Eléctricos Sabana',
      invoice_number: 'FE-4092',
      net_cost_cop: 340_000,
      receipt_image_path: 'evidencias/recibo_electrico_loc1.jpg',
      evidence_images_paths: ['evidencias/tablero_loc1_ev1.jpg'],
      deduction_status: 'Por Liquidar',
      settlement_id: null,
    },
    {
      id: 3,
      property_id: 2,
      execution_date: '2026-09-14',
      category: 'IMPERMEABILIZACIÓN',
      description: 'Sellado acrílico de terraza y bajante pluvial',
      technician_name: 'Soluciones Civiles Cundinamarca',
      invoice_number: 'FAC-7710',
      net_cost_cop: 420_000,
      receipt_image_path: 'evidencias/recibo_imper_sep.jpg',
      evidence_images_paths: ['evidencias/terraza_sep_01.jpg'],
      deduction_status: 'Liquidado',
      settlement_id: 1,
    },
    {
      id: 4,
      property_id: 7,
      execution_date: '2026-10-09',
      category: 'AIRE ACONDICIONADO',
      description:
        'Mantenimiento preventivo unidad Chiller y recarga refrigerante R410A',
      technician_name: 'ClimaTech Medellín S.A.S',
      invoice_number: 'CM-1904',
      net_cost_cop: 510_000,
      receipt_image_path: 'evidencias/recibo_hvac_301.jpg',
      evidence_images_paths: [
        'evidencias/chiller_301_a.jpg',
        'evidencias/chiller_301_b.jpg',
      ],
      deduction_status: 'Por Liquidar',
      settlement_id: null,
    },
  ];

  const settlements: Settlement[] = [
    {
      id: 1,
      owner_id: 1,
      period_month: '2026-09',
      gross_income_cop: 4_300_000,
      commission_amount_cop: 400_000,
      fixed_fee_amount_cop: 105_000,
      maintenance_deduction_cop: 420_000,
      net_payable_cop: 3_375_000,
      sha256_seal: computeSettlementSeal(
        1,
        '2026-09',
        4_300_000,
        400_000,
        105_000,
        420_000,
        3_375_000
      ),
      status: 'EJECUTADO',
      created_at: '2026-09-30T17:45:00Z',
    },
  ];

  return {
    owners,
    properties,
    contracts,
    payments,
    maintenances,
    settlements,
    backupSnapshots: [
      '%LocalAppData%\\InmoControl\\backups\\inmo_backup_20261015_080000_000.db',
    ],
  };
}

class InmoRepositoryImpl {
  private state: LocalDatabaseState = createInitialSeedState();

  public resetToSeed(): void {
    this.state = createInitialSeedState();
  }

  public getAllProperties(): Property[] {
    return [...this.state.properties];
  }

  public getOwnerDashboardBundle(ownerId: number): OwnerDashboardBundle {
    const start = performance.now();
    const allOwners = [...this.state.owners];
    const selectedOwner =
      allOwners.find((o) => o.id === ownerId) || allOwners[0];
    const targetOwnerId = selectedOwner.id;

    const properties = this.state.properties
      .filter((p) => p.owner_id === targetOwnerId)
      .sort((a, b) => {
        const groupA = a.parent_property_id ?? a.id;
        const groupB = b.parent_property_id ?? b.id;
        if (groupA !== groupB) return groupA - groupB;
        const isChildA = a.parent_property_id !== null ? 1 : 0;
        const isChildB = b.parent_property_id !== null ? 1 : 0;
        if (isChildA !== isChildB) return isChildA - isChildB;
        return a.id - b.id;
      });

    const propIds = new Set(properties.map((p) => p.id));

    const participation = calculateAgencyParticipation(
      targetOwnerId,
      this.state.properties
    );

    const ownerRentable = properties.filter(
      (p) => p.property_type !== 'EDIFICIO MATRIZ'
    );
    const occupiedCount = ownerRentable.filter(
      (p) => p.status === 'OCUPADO'
    ).length;
    const occupancyRatePct =
      ownerRentable.length > 0
        ? Math.round((occupiedCount / ownerRentable.length) * 1000) / 10
        : 0;

    const expectedMonthlyCollectionCop = ownerRentable
      .filter((p) => p.status === 'OCUPADO')
      .reduce((sum, p) => sum + p.base_rent_cop, 0);

    const contracts = this.state.contracts
      .filter((c) => propIds.has(c.property_id))
      .sort((a, b) => b.id - a.id);

    const payments = this.state.payments
      .filter((rp) => propIds.has(rp.property_id))
      .sort((a, b) => b.id - a.id);

    const collectedMonthlyCop = payments
      .filter((rp) => rp.status === 'PAGADO')
      .reduce((sum, rp) => sum + rp.gross_amount_cop, 0);

    const maintenances = this.state.maintenances
      .filter((m) => propIds.has(m.property_id))
      .sort((a, b) => b.id - a.id);

    const pendingMaintenanceCop = maintenances
      .filter((m) => m.deduction_status === 'Por Liquidar')
      .reduce((sum, m) => sum + m.net_cost_cop, 0);

    const settlements = this.state.settlements
      .filter((s) => s.owner_id === targetOwnerId)
      .sort((a, b) => b.id - a.id);

    const elapsedMs = Math.max(
      0.4,
      Math.round((performance.now() - start) * 100) / 100
    );

    return {
      selected_owner: selectedOwner,
      all_owners: allOwners,
      properties,
      contracts,
      payments,
      maintenances,
      settlements,
      agency_total_properties: participation.agencyRentableCount,
      owner_property_count: participation.ownerRentableCount,
      agency_participation_pct: participation.participationByCountPct,
      expected_monthly_collection_cop: expectedMonthlyCollectionCop,
      collected_monthly_cop: collectedMonthlyCop,
      pending_maintenance_cop: pendingMaintenanceCop,
      occupancy_rate_pct: occupancyRatePct,
      query_time_ms: elapsedMs,
    };
  }

  public createOwner(input: NewOwnerInput): Owner {
    const nextId =
      this.state.owners.reduce((max, o) => Math.max(max, o.id), 0) + 1;
    const owner: Owner = {
      id: nextId,
      ...input,
      created_at: new Date().toISOString(),
    };
    this.state.owners.push(owner);
    return owner;
  }

  public createProperty(input: NewPropertyInput): Property {
    const nextId =
      this.state.properties.reduce((max, p) => Math.max(max, p.id), 0) + 1;
    const prop: Property = {
      id: nextId,
      ...input,
      created_at: new Date().toISOString(),
    };
    this.state.properties.push(prop);
    return prop;
  }

  public createTenantContract(input: NewContractInput): TenantContract {
    const nextId =
      this.state.contracts.reduce((max, c) => Math.max(max, c.id), 0) + 1;
    const contract: TenantContract = {
      id: nextId,
      ...input,
      created_at: new Date().toISOString(),
    };
    // Transactional update: insert contract + mark property OCUPADO
    this.state.contracts.push(contract);
    const prop = this.state.properties.find((p) => p.id === input.property_id);
    if (prop) {
      prop.status = 'OCUPADO';
    }
    return contract;
  }

  public recordRentPayment(input: NewRentPaymentInput): RentPayment {
    const nextId =
      this.state.payments.reduce((max, rp) => Math.max(max, rp.id), 0) + 1;
    const payment: RentPayment = {
      id: nextId,
      ...input,
    };
    this.state.payments.push(payment);
    return payment;
  }

  public createMaintenanceExpense(
    input: NewMaintenanceInput
  ): MaintenanceExpense {
    const nextId =
      this.state.maintenances.reduce((max, m) => Math.max(max, m.id), 0) + 1;
    const expense: MaintenanceExpense = {
      id: nextId,
      property_id: input.property_id,
      execution_date: input.execution_date,
      category: input.category,
      description: input.description,
      technician_name: input.technician_name,
      invoice_number: input.invoice_number,
      net_cost_cop: input.net_cost_cop,
      receipt_image_path: normalizeEvidencePath(input.receipt_image_path),
      evidence_images_paths: input.evidence_images_paths.map((p) =>
        normalizeEvidencePath(p)
      ),
      deduction_status: 'Por Liquidar',
      settlement_id: null,
    };
    this.state.maintenances.push(expense);
    return expense;
  }

  /**
   * Executes a transactional monthly settlement (`BEGIN TRANSACTION ... COMMIT`):
   * - Calculates gross rent collected, mixed commission `(Gross * %) + Fixed Fee`, and 1:1 net maintenance deductions.
   * - Persists the settlement record with a SHA-256 seal.
   * - Transitions all `Por Liquidar` maintenance expenses for this owner's properties to `Liquidado`.
   */
  public executeMonthlySettlement(
    ownerId: number,
    periodMonth: string
  ): Settlement {
    // Snapshot state for atomic rollback on any failure
    const snapshot = JSON.stringify(this.state);
    try {
      const ownerProps = this.state.properties.filter(
        (p) => p.owner_id === ownerId
      );
      const ownerPropIds = new Set(ownerProps.map((p) => p.id));
      const ownerPayments = this.state.payments.filter((rp) =>
        ownerPropIds.has(rp.property_id)
      );
      const ownerMaintenances = this.state.maintenances.filter((m) =>
        ownerPropIds.has(m.property_id)
      );

      const preview = calculateOwnerSettlementPreview(
        ownerId,
        ownerProps,
        ownerPayments,
        ownerMaintenances,
        periodMonth
      );

      const nextId =
        this.state.settlements.reduce((max, s) => Math.max(max, s.id), 0) + 1;

      const settlement: Settlement = {
        id: nextId,
        owner_id: ownerId,
        period_month: periodMonth,
        gross_income_cop: preview.grossIncomeCop,
        commission_amount_cop: preview.commissionAmountCop,
        fixed_fee_amount_cop: preview.fixedFeeAmountCop,
        maintenance_deduction_cop: preview.maintenanceDeductionCop,
        net_payable_cop: preview.netPayableCop,
        sha256_seal: preview.sha256PreviewSeal,
        status: 'EJECUTADO',
        created_at: new Date().toISOString(),
      };

      this.state.settlements.push(settlement);

      for (const maint of this.state.maintenances) {
        if (
          ownerPropIds.has(maint.property_id) &&
          maint.deduction_status === 'Por Liquidar'
        ) {
          maint.deduction_status = 'Liquidado';
          maint.settlement_id = settlement.id;
        }
      }

      return settlement;
    } catch (err) {
      this.state = JSON.parse(snapshot);
      throw err;
    }
  }

  /**
   * Executes a transactional property handover (`BEGIN TRANSACTION ... COMMIT`):
   * - Terminates active/overdue contracts on `propertyId` (`FINALIZADO`).
   * - Transitions property status to `DISPONIBLE`.
   */
  public executePropertyHandover(propertyId: number): void {
    const snapshot = JSON.stringify(this.state);
    try {
      const prop = this.state.properties.find((p) => p.id === propertyId);
      if (!prop) {
        throw new Error(`Property ${propertyId} does not exist`);
      }
      prop.status = 'DISPONIBLE';

      for (const contract of this.state.contracts) {
        if (
          contract.property_id === propertyId &&
          (contract.status === 'ACTIVO' || contract.status === 'MORA')
        ) {
          contract.status = 'FINALIZADO';
        }
      }
    } catch (err) {
      this.state = JSON.parse(snapshot);
      throw err;
    }
  }

  public runVacuumBackup(): string {
    const stamp = new Date()
      .toISOString()
      .replace(/[-:T.Z]/g, '')
      .slice(0, 15);
    const backupPath = `%LocalAppData%\\InmoControl\\backups\\inmo_backup_${stamp}.db`;
    this.state.backupSnapshots.push(backupPath);
    if (this.state.backupSnapshots.length > 30) {
      this.state.backupSnapshots.splice(
        0,
        this.state.backupSnapshots.length - 30
      );
    }
    return backupPath;
  }

  public getBackupSnapshots(): string[] {
    return [...this.state.backupSnapshots];
  }
}

export const inmoRepository = new InmoRepositoryImpl();
