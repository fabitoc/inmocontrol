import {
  ExecutePropertyHandoverInput,
  HandoverSettlementNote,
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
  UpdatePropertyInput,
  WeeklyTelemetryPoint,
} from '../types/domain';

export interface CommissionBreakdown {
  percentageFeeCop: number;
  fixedFeeCop: number;
  totalCommissionCop: number;
}

export interface SettlementPreviewLine {
  property: Property;
  ownerSharePct: number;
  agreedRentCop: number;
  remainingBalanceCop: number;
  isPartialPayment: boolean;
  moraPeriodMonths?: string[];
  abonosCount: number;
  paymentsBreakdown: RentPayment[];
  propertyGrossCollectedCop: number;
  grossCollectedCop: number;
  percentageFeeCop: number;
  fixedFeeCop: number;
  totalAgencyFeeCop: number;
}

export interface ActiveMoraBalanceSnapshot {
  property: Property;
  tenantName: string;
  periodMonth: string;
  agreedRentCop: number;
  alreadyCollectedCop: number;
  remainingBalanceCop: number;
  ownerSharePct: number;
}

export interface OwnerSettlementPreview {
  periodMonth: string;
  lines: SettlementPreviewLine[];
  activeMoraBalances?: ActiveMoraBalanceSnapshot[];
  handoverNotes?: HandoverSettlementNote[];
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
 * Resolves the ownership participation percentage (`0` to `100`) of `ownerId` for a given property.
 * - When `property.co_owners` is populated, returns the matching co-owner's `share_pct`
 *   (or the remaining share for `property.owner_id` if only secondary co-owners were listed).
 * - Otherwise, returns `100` when `property.owner_id === ownerId`, or `0`.
 */
export function getOwnerSharePct(property: Property, ownerId: number): number {
  if (property.co_owners && property.co_owners.length > 0) {
    const found = property.co_owners.find((co) => co.owner_id === ownerId);
    if (found) {
      return found.share_pct;
    }
    if (
      property.owner_id === ownerId &&
      !property.co_owners.some((co) => co.owner_id === property.owner_id)
    ) {
      const secondaryTotal = property.co_owners.reduce(
        (sum, co) => sum + Number(co.share_pct || 0),
        0
      );
      return Math.max(0, 100 - secondaryTotal);
    }
    return 0;
  }
  return property.owner_id === ownerId ? 100 : 0;
}

/**
 * Resolves the effective `Property` attributes for a given `periodMonth` (`YYYY-MM`):
 * - Property edits made in `currentPeriod` (`updated_effective_period`) ONLY apply from `currentPeriod` onwards (`periodMonth >= updated_effective_period`).
 * - Any prior period (`periodMonth < snap.effective_until_period`) strictly uses the pre-edit `PropertyHistoricalSnapshot` so past periods are never retroactively altered.
 */
export function resolvePropertyForPeriod(
  prop: Property,
  periodMonth: string
): Property {
  if (prop.historical_snapshots && prop.historical_snapshots.length > 0) {
    const matching = prop.historical_snapshots.find(
      (snap) => periodMonth < snap.effective_until_period
    );
    if (matching) {
      return {
        ...prop,
        owner_id: matching.owner_id,
        co_owners: matching.co_owners
          ? matching.co_owners.map((c) => ({ ...c }))
          : undefined,
        code: matching.code,
        title: matching.title,
        address: matching.address,
        property_type: matching.property_type,
        base_rent_cop: matching.base_rent_cop,
        commission_pct: matching.commission_pct,
        cutoff_day: matching.cutoff_day,
      };
    }
  }
  return prop;
}

function preservePreEditPropertySnapshot(
  prop: Property,
  effectivePeriod: string
): void {
  if (!prop.historical_snapshots) {
    prop.historical_snapshots = [];
  }
  const hasSnapshotForPeriod = prop.historical_snapshots.some(
    (s) => s.effective_until_period === effectivePeriod
  );
  if (!hasSnapshotForPeriod) {
    prop.historical_snapshots.push({
      effective_until_period: effectivePeriod,
      owner_id: prop.owner_id,
      co_owners: prop.co_owners
        ? prop.co_owners.map((c) => ({ ...c }))
        : undefined,
      code: prop.code,
      title: prop.title,
      address: prop.address,
      property_type: prop.property_type,
      base_rent_cop: prop.base_rent_cop,
      commission_pct: prop.commission_pct,
      cutoff_day: prop.cutoff_day,
    });
  }
  prop.updated_effective_period = effectivePeriod;
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
 * - Crosses all `PAGADO` rent payments for the owner's properties in `periodMonth`, prorated by co-ownership share (`share_pct`).
 * - Subtracts strictly percentage-based agency commission (`Gross * %`) without any fixed base fee.
 * - Deducts 1:1 net cost (`net_cost_cop`) of all `'Por Liquidar'` maintenance expenses prorated by co-ownership share.
 */
export function calculateOwnerSettlementPreview(
  ownerId: number,
  properties: Property[],
  payments: RentPayment[],
  maintenances: MaintenanceExpense[],
  periodMonth: string,
  contracts: TenantContract[] = [],
  settlements: Settlement[] = [],
  handoverNotes: HandoverSettlementNote[] = []
): OwnerSettlementPreview {
  const lines: SettlementPreviewLine[] = [];
  let grossIncomeCop = 0;
  let commissionAmountCop = 0;
  const fixedFeeAmountCop = 0;

  const effectiveProperties = properties.map((p) =>
    resolvePropertyForPeriod(p, periodMonth)
  );
  const propById = new Map(effectiveProperties.map((p) => [p.id, p]));
  const isPeriodAlreadySettled = settlements.some(
    (s) => s.owner_id === ownerId && s.period_month === periodMonth
  );

  for (const prop of effectiveProperties) {
    const sharePct = getOwnerSharePct(prop, ownerId);
    if (sharePct <= 0) continue;

    const propPayments = payments
      .filter(
        (rp) =>
          rp.property_id === prop.id &&
          (rp.settlement_period_month ?? rp.period_month) === periodMonth &&
          rp.status === 'PAGADO'
      )
      .sort((a, b) => a.id - b.id);

    const paidForProp = propPayments.reduce(
      (sum, rp) => sum + rp.gross_amount_cop,
      0
    );

    if (paidForProp > 0) {
      const activeContract =
        contracts.find(
          (c) => c.property_id === prop.id && c.status !== 'FINALIZADO'
        ) ?? contracts.find((c) => c.property_id === prop.id);
      const periodStatus = getPeriodCollectionStatus(
        prop.id,
        periodMonth,
        properties,
        contracts,
        payments,
        activeContract?.id
      );
      const baseAgreedCop = periodStatus.agreedRentCop || prop.base_rent_cop;

      const distinctOriginPeriods = Array.from(
        new Set(propPayments.map((rp) => rp.period_month))
      );
      const moraPeriodMonths = distinctOriginPeriods.filter(
        (pm) => pm < periodMonth
      );

      const agreedRentCop =
        distinctOriginPeriods.length > 1
          ? distinctOriginPeriods.reduce(
              (sum, pm) =>
                sum +
                (getPeriodCollectionStatus(
                  prop.id,
                  pm,
                  properties,
                  contracts,
                  payments,
                  activeContract?.id
                ).agreedRentCop || baseAgreedCop),
              0
            )
          : baseAgreedCop;
      const remainingBalanceCop = Math.max(0, agreedRentCop - paidForProp);
      const isPartialPayment = agreedRentCop > 0 && paidForProp < agreedRentCop;

      const ownerGrossCop = Math.round(paidForProp * (sharePct / 100));
      const breakdown = calculatePropertyCommission(
        ownerGrossCop,
        prop.commission_pct,
        0
      );
      grossIncomeCop += ownerGrossCop;
      commissionAmountCop += breakdown.percentageFeeCop;

      lines.push({
        property: prop,
        ownerSharePct: sharePct,
        agreedRentCop,
        remainingBalanceCop,
        isPartialPayment,
        moraPeriodMonths,
        abonosCount: propPayments.length,
        paymentsBreakdown: propPayments,
        propertyGrossCollectedCop: paidForProp,
        grossCollectedCop: ownerGrossCop,
        percentageFeeCop: breakdown.percentageFeeCop,
        fixedFeeCop: 0,
        totalAgencyFeeCop: breakdown.percentageFeeCop,
      });
    }
  }

  const currentSystemPeriod = getCurrentPeriodMonth();
  const activeMoraBalances: ActiveMoraBalanceSnapshot[] = [];
  if (periodMonth >= currentSystemPeriod) {
    for (const prop of effectiveProperties) {
      if (prop.property_type === 'EDIFICIO MATRIZ') continue;
      const sharePct = getOwnerSharePct(prop, ownerId);
      if (sharePct <= 0) continue;

      const state = getPropertyTenantPaymentState(
        prop.id,
        properties,
        contracts,
        payments
      );
      if (!state.hasActiveContract || state.isAlDia) continue;

      for (const bal of state.periodBalances) {
        if (bal.remainingBalanceCop > 0) {
          activeMoraBalances.push({
            property: resolvePropertyForPeriod(prop, bal.periodMonth),
            tenantName: state.contract?.tenant_name ?? 'Inquilino Activo',
            periodMonth: bal.periodMonth,
            agreedRentCop: bal.agreedRentCop,
            alreadyCollectedCop: bal.alreadyCollectedCop,
            remainingBalanceCop: bal.remainingBalanceCop,
            ownerSharePct: sharePct,
          });
        }
      }
    }
  }

  const pendingMaintenances = isPeriodAlreadySettled
    ? []
    : maintenances.filter(
        (m) =>
          m.deduction_status === 'Por Liquidar' &&
          !m.settled_owner_ids?.includes(ownerId) &&
          (!m.settlement_period_month ||
            m.settlement_period_month <= periodMonth)
      );
  // 1:1 net cost deduction prorated by owner's co-ownership share without agency operational markup
  const maintenanceDeductionCop = pendingMaintenances.reduce((sum, m) => {
    const prop = propById.get(m.property_id);
    const sharePct = prop ? getOwnerSharePct(prop, ownerId) : 100;
    return sum + Math.round(m.net_cost_cop * (sharePct / 100));
  }, 0);

  const totalAgencyFeeCop = commissionAmountCop;
  const netPayableCop =
    grossIncomeCop - totalAgencyFeeCop - maintenanceDeductionCop;

  const sha256PreviewSeal = computeSettlementSeal(
    ownerId,
    periodMonth,
    grossIncomeCop,
    commissionAmountCop,
    0,
    maintenanceDeductionCop,
    netPayableCop
  );

  const periodHandoverNotes = handoverNotes.filter(
    (hn) =>
      hn.settlement_period_month === periodMonth &&
      propById.has(hn.property_id) &&
      getOwnerSharePct(propById.get(hn.property_id)!, ownerId) > 0
  );

  return {
    periodMonth,
    lines,
    activeMoraBalances,
    handoverNotes: periodHandoverNotes,
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
  const rentableOwner = rentableAll.filter(
    (p) => getOwnerSharePct(p, ownerId) > 0
  );

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
    (sum, p) =>
      sum + Math.round(p.base_rent_cop * (getOwnerSharePct(p, ownerId) / 100)),
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

function convertUnderThousandToSpanishWords(n: number): string {
  if (n === 0) return '';
  if (n === 100) return 'cien';

  const hundreds = [
    '',
    'ciento',
    'doscientos',
    'trescientos',
    'cuatrocientos',
    'quinientos',
    'seiscientos',
    'setecientos',
    'ochocientos',
    'novecientos',
  ];

  const underThirty = [
    '',
    'un',
    'dos',
    'tres',
    'cuatro',
    'cinco',
    'seis',
    'siete',
    'ocho',
    'nueve',
    'diez',
    'once',
    'doce',
    'trece',
    'catorce',
    'quince',
    'dieciséis',
    'diecisiete',
    'dieciocho',
    'diecinueve',
    'veinte',
    'veintiún',
    'veintidós',
    'veintitrés',
    'veinticuatro',
    'veinticinco',
    'veintiséis',
    'veintisiete',
    'veintiocho',
    'veintinueve',
  ];

  const tens = [
    '',
    '',
    '',
    'treinta',
    'cuarenta',
    'cincuenta',
    'sesenta',
    'setenta',
    'ochenta',
    'noventa',
  ];

  const h = Math.floor(n / 100);
  const rem = n % 100;
  const parts: string[] = [];

  if (h > 0) {
    parts.push(hundreds[h]);
  }

  if (rem > 0) {
    if (rem < 30) {
      parts.push(underThirty[rem]);
    } else {
      const t = Math.floor(rem / 10);
      const u = rem % 10;
      parts.push(u === 0 ? tens[t] : `${tens[t]} y ${underThirty[u]}`);
    }
  }

  return parts.join(' ');
}

/**
 * Converts a numeric COP amount into Spanish currency text (e.g., 2000 -> "Dos mil pesos").
 */
export function formatCopInWords(amountCop: number): string {
  const safe = Math.max(0, Math.floor(Number(amountCop) || 0));
  if (safe === 0) return 'Cero pesos';
  if (safe === 1) return 'Un peso';

  const billions = Math.floor(safe / 1_000_000_000);
  const millions = Math.floor((safe % 1_000_000_000) / 1_000_000);
  const thousands = Math.floor((safe % 1_000_000) / 1_000);
  const units = safe % 1_000;

  const chunks: string[] = [];

  if (billions > 0) {
    chunks.push(
      billions === 1
        ? 'mil'
        : `${convertUnderThousandToSpanishWords(billions)} mil`
    );
    if (millions === 0) {
      chunks.push('millones');
    }
  }

  if (millions > 0) {
    if (millions === 1 && billions === 0) {
      chunks.push('un millón');
    } else {
      chunks.push(`${convertUnderThousandToSpanishWords(millions)} millones`);
    }
  }

  if (thousands > 0) {
    chunks.push(
      thousands === 1
        ? 'mil'
        : `${convertUnderThousandToSpanishWords(thousands)} mil`
    );
  }

  if (units > 0) {
    chunks.push(convertUnderThousandToSpanishWords(units));
  }

  const suffix =
    (billions > 0 || millions > 0) && thousands === 0 && units === 0
      ? 'de pesos'
      : 'pesos';

  const phrase = `${chunks.join(' ')} ${suffix}`.trim();
  return phrase.charAt(0).toUpperCase() + phrase.slice(1);
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

const SPANISH_MONTH_NAMES: Record<string, string> = {
  '01': 'Enero',
  '02': 'Febrero',
  '03': 'Marzo',
  '04': 'Abril',
  '05': 'Mayo',
  '06': 'Junio',
  '07': 'Julio',
  '08': 'Agosto',
  '09': 'Septiembre',
  '10': 'Octubre',
  '11': 'Noviembre',
  '12': 'Diciembre',
};

/**
 * Returns the current accounting period in `YYYY-MM` format based on the local system clock.
 */
export function getCurrentPeriodMonth(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Formats a `YYYY-MM` period string into a human-readable Spanish label (e.g., `2026-11 (Noviembre 2026 — Mes Actual)`).
 */
export function formatPeriodMonthLabel(
  periodMonth: string,
  currentPeriod: string = getCurrentPeriodMonth()
): string {
  const [year, month] = periodMonth.split('-');
  const monthName = SPANISH_MONTH_NAMES[month] ?? month;
  const suffix = periodMonth === currentPeriod ? ' — Mes Actual' : '';
  return `${periodMonth} (${monthName} ${year}${suffix})`;
}

export function getNextPeriodMonth(periodMonth: string): string {
  const [y, m] = periodMonth.split('-').map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Enumerates all `YYYY-MM` monthly periods in chronological order from `startPeriod` up to `endPeriod` (inclusive).
 */
export function enumeratePeriodsBetween(
  startPeriod: string,
  endPeriod: string
): string[] {
  if (!startPeriod || !endPeriod || startPeriod > endPeriod) {
    return endPeriod ? [endPeriod] : [];
  }
  const result: string[] = [];
  let cursor = startPeriod;
  let guard = 0;
  while (cursor <= endPeriod && guard < 60) {
    result.push(cursor);
    cursor = getNextPeriodMonth(cursor);
    guard++;
  }
  return result;
}

export function resolveNextUnsettledCutoffPeriod(
  ownerId: number,
  basePeriodMonth: string,
  settlements: Settlement[]
): string {
  let candidate = basePeriodMonth;
  let guard = 0;
  while (
    settlements.some(
      (s) => s.owner_id === ownerId && s.period_month === candidate
    ) &&
    guard < 24
  ) {
    candidate = getNextPeriodMonth(candidate);
    guard++;
  }
  return candidate;
}

/**
 * Automatically resolves the active cutoff period for an owner in `LiquidacionesView`:
 * - Prioritizes the current period (`getCurrentPeriodMonth()`) or any next cutoff period that has unsettled movements (payments, abonos, or maintenances).
 * - Falls back to the latest unsettled period with `PAGADO` payments (e.g. `2026-10` in seed state before approval), or `currentSystemPeriod`.
 */
export function resolveActiveSettlementPeriodForOwner(
  ownerId: number,
  payments: RentPayment[],
  maintenances: MaintenanceExpense[],
  settlements: Settlement[],
  now: Date = new Date(),
  handoverNotes: HandoverSettlementNote[] = []
): string {
  const currentSystemPeriod = getCurrentPeriodMonth(now);
  const settledPeriods = new Set(
    settlements.filter((s) => s.owner_id === ownerId).map((s) => s.period_month)
  );

  const unsettledHandoverPeriods = handoverNotes
    .map((hn) => hn.settlement_period_month)
    .filter((p) => p && !settledPeriods.has(p));

  if (unsettledHandoverPeriods.includes(currentSystemPeriod)) {
    return currentSystemPeriod;
  }

  const unsettledPaymentPeriods = payments
    .filter(
      (rp) =>
        rp.status === 'PAGADO' && !rp.settled_owner_ids?.includes(ownerId)
    )
    .map((rp) => rp.settlement_period_month ?? rp.period_month)
    .filter((p) => !settledPeriods.has(p))
    .sort((a, b) => b.localeCompare(a));

  if (unsettledPaymentPeriods.includes(currentSystemPeriod)) {
    return currentSystemPeriod;
  }
  if (unsettledPaymentPeriods.length > 0) {
    return unsettledPaymentPeriods[0];
  }

  const unsettledMaintPeriods = maintenances
    .filter(
      (m) =>
        m.deduction_status === 'Por Liquidar' &&
        !m.settled_owner_ids?.includes(ownerId) &&
        m.settlement_period_month
    )
    .map((m) => m.settlement_period_month!)
    .filter((p) => !settledPeriods.has(p))
    .sort((a, b) => b.localeCompare(a));

  if (unsettledMaintPeriods.length > 0) {
    return unsettledMaintPeriods[0];
  }

  const hasCurrentMonthPaid = payments.some(
    (rp) =>
      (rp.settlement_period_month ?? rp.period_month) === currentSystemPeriod &&
      rp.status === 'PAGADO'
  );
  if (hasCurrentMonthPaid) return currentSystemPeriod;

  const latestPaid = payments
    .filter((rp) => rp.status === 'PAGADO')
    .map((rp) => rp.settlement_period_month ?? rp.period_month)
    .sort((a, b) => b.localeCompare(a))[0];

  return latestPaid || currentSystemPeriod;
}

/**
 * Builds a sorted list (newest first) of accounting periods (`YYYY-MM`), always including
 * the current month (`getCurrentPeriodMonth()`), recent rolling months, and any period
 * referenced by existing payments, maintenances, or settlements.
 */
export function getAccountingPeriodOptions(
  payments: RentPayment[] = [],
  settlements: Settlement[] = [],
  now: Date = new Date(),
  maintenances: MaintenanceExpense[] = []
): string[] {
  const currentPeriod = getCurrentPeriodMonth(now);
  const periods = new Set<string>([
    currentPeriod,
    '2026-11',
    '2026-10',
    '2026-09',
    '2026-08',
  ]);

  const baseYear = now.getFullYear();
  const baseMonth = now.getMonth() + 1;
  for (let offset = -3; offset <= 0; offset++) {
    const d = new Date(baseYear, baseMonth - 1 + offset, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (ym <= currentPeriod) {
      periods.add(ym);
    }
  }

  for (const rp of payments) {
    if (rp.period_month && rp.period_month <= currentPeriod) {
      periods.add(rp.period_month);
    }
    if (rp.settlement_period_month) {
      periods.add(rp.settlement_period_month);
    }
  }
  for (const m of maintenances) {
    if (m.settlement_period_month) {
      periods.add(m.settlement_period_month);
    }
  }
  for (const s of settlements) {
    if (s.period_month) {
      periods.add(s.period_month);
    }
  }

  return Array.from(periods).sort((a, b) => b.localeCompare(a));
}

export interface ContractBillingCycleState {
  registrationDate: string;
  registrationPeriod: string;
  cutoffDay: number;
  activePeriod: string;
  collectiblePeriods: string[];
  nextPeriod: string;
  nextCutoffDate: string;
}

/**
 * Resolves the active collectible period(s) for a specific property/contract in `04 // Registro de Recaudo Mensual`:
 * - Strictly forbids charging any period prior to the tenant's registration date (`contract.start_date`).
 * - Strictly forbids selecting any future period that has not arrived yet (`> getCurrentPeriodMonth()`).
 * - Automatically activates the current billing period according to the contract's cutoff date (`cutoff_day`).
 */
export function getContractBillingCycleState(
  propertyId: number,
  properties: Property[],
  contracts: TenantContract[],
  payments: RentPayment[],
  now: Date = new Date()
): ContractBillingCycleState {
  const currentPeriod = getCurrentPeriodMonth(now);
  const prop = properties.find((p) => p.id === propertyId);
  const contract =
    contracts.find(
      (c) => c.property_id === propertyId && c.status !== 'FINALIZADO'
    ) ?? contracts.find((c) => c.property_id === propertyId);

  const rawStartDate =
    contract?.start_date?.slice(0, 10) || `${currentPeriod}-01`;
  const rawRegPeriod = rawStartDate.slice(0, 7);
  const registrationPeriod =
    rawRegPeriod > currentPeriod ? currentPeriod : rawRegPeriod;
  const cutoffDay = contract?.cutoff_day ?? prop?.cutoff_day ?? 5;

  const validPeriods = new Set<string>([currentPeriod]);

  // If the tenant contract was created retroactively from past months ("por descuidos del usuario"),
  // calculate all elapsed months from registrationPeriod up to currentPeriod and include any unpaid month.
  const isRetroactiveContract = Boolean(
    contract &&
      (contract.retroactive_from_period || contract.id > 6) &&
      registrationPeriod < currentPeriod
  );
  if (isRetroactiveContract) {
    for (const p of enumeratePeriodsBetween(
      registrationPeriod,
      currentPeriod
    )) {
      const st = getPeriodCollectionStatus(
        propertyId,
        p,
        properties,
        contracts,
        payments,
        contract?.id
      );
      if (p === currentPeriod || st.remainingBalanceCop > 0) {
        validPeriods.add(p);
      }
    }
  }

  for (const rp of payments) {
    if (rp.property_id !== propertyId) continue;
    const p = rp.period_month;
    if (!p || p < registrationPeriod || p > currentPeriod) continue;

    const status = getPeriodCollectionStatus(
      propertyId,
      p,
      properties,
      contracts,
      payments,
      contract?.id
    );
    if (
      rp.status === 'MORA' ||
      rp.status === 'PENDIENTE' ||
      status.remainingBalanceCop > 0
    ) {
      validPeriods.add(p);
    }
  }

  const collectiblePeriods = Array.from(validPeriods)
    .filter((p) => p >= registrationPeriod && p <= currentPeriod)
    .sort((a, b) => b.localeCompare(a));

  const activePeriod = collectiblePeriods[0] ?? currentPeriod;

  const [currYear, currMonth] = currentPeriod.split('-').map(Number);
  const nextDateObj = new Date(currYear, currMonth, 1);
  const nextPeriod = `${nextDateObj.getFullYear()}-${String(nextDateObj.getMonth() + 1).padStart(2, '0')}`;
  const nextCutoffDate = `${nextPeriod}-${String(cutoffDay).padStart(2, '0')}`;

  return {
    registrationDate: rawStartDate,
    registrationPeriod,
    cutoffDay,
    activePeriod,
    collectiblePeriods:
      collectiblePeriods.length > 0 ? collectiblePeriods : [currentPeriod],
    nextPeriod,
    nextCutoffDate,
  };
}

export interface PeriodCollectionStatus {
  agreedRentCop: number;
  alreadyCollectedCop: number;
  remainingBalanceCop: number;
  isFullyPaid: boolean;
}

/**
 * Computes the agreed rent (`agreedRentCop`), cumulative `PAGADO` payments (`alreadyCollectedCop`),
 * and maximum remaining balance (`remainingBalanceCop`) for a property/contract in a given `periodMonth`.
 */
export function getPeriodCollectionStatus(
  propertyId: number,
  periodMonth: string,
  properties: Property[],
  contracts: TenantContract[],
  payments: RentPayment[],
  contractId?: number
): PeriodCollectionStatus {
  const rawProp = properties.find((p) => p.id === propertyId);
  const prop = rawProp
    ? resolvePropertyForPeriod(rawProp, periodMonth)
    : undefined;
  const contract =
    (contractId
      ? contracts.find((c) => c.id === contractId)
      : undefined) ??
    contracts.find(
      (c) => c.property_id === propertyId && c.status !== 'FINALIZADO'
    ) ??
    contracts.find((c) => c.property_id === propertyId);

  const isBeforePropertyEdit = Boolean(
    rawProp?.historical_snapshots?.some(
      (snap) => periodMonth < snap.effective_until_period
    )
  );
  const isAtOrAfterPropertyEdit = Boolean(
    rawProp?.updated_effective_period &&
      periodMonth >= rawProp.updated_effective_period
  );

  let agreedRentCop = 0;
  if (isBeforePropertyEdit && prop) {
    agreedRentCop = prop.base_rent_cop;
  } else if (isAtOrAfterPropertyEdit && prop && prop.base_rent_cop > 0) {
    agreedRentCop = prop.base_rent_cop;
  } else {
    agreedRentCop =
      contract && contract.monthly_rent_cop > 0
        ? contract.monthly_rent_cop
        : prop?.base_rent_cop ?? 0;
  }

  const alreadyCollectedCop = payments
    .filter(
      (rp) =>
        rp.property_id === propertyId &&
        rp.period_month === periodMonth &&
        rp.status === 'PAGADO'
    )
    .reduce((sum, rp) => sum + rp.gross_amount_cop, 0);

  const remainingBalanceCop = Math.max(0, agreedRentCop - alreadyCollectedCop);

  return {
    agreedRentCop,
    alreadyCollectedCop,
    remainingBalanceCop,
    isFullyPaid: agreedRentCop > 0 && remainingBalanceCop === 0,
  };
}

export interface TenantPeriodBalanceSummary {
  periodMonth: string;
  agreedRentCop: number;
  alreadyCollectedCop: number;
  remainingBalanceCop: number;
  isFullyPaid: boolean;
}

export interface PropertyTenantPaymentState {
  propertyId: number;
  hasActiveContract: boolean;
  contract: TenantContract | null;
  cutoffDay: number;
  activePeriod: string;
  agreedRentCop: number;
  alreadyCollectedCop: number;
  remainingBalanceCop: number;
  totalRemainingDebtCop: number;
  daysUntilCutoff: number;
  activationDateLabel: string;
  cutoffDateLabel: string;
  isCutoffWindowOpen: boolean;
  isAlDia: boolean;
  statusLabel: 'AL DÍA' | 'MOROSO' | 'SIN INQUILINO' | 'MATRIZ';
  canPay: boolean;
  periodBalances: TenantPeriodBalanceSummary[];
  recentPayments: RentPayment[];
}

/**
 * Evaluates a property's tenant payment state for the Dashboard table and `[ PAGAR ]` modal:
 * - Activates the `[ PAGAR ]` button when the tenant reaches their cutoff date or within 5 days before (`daysUntilCutoff <= 5`),
 *   or whenever an active period has a partial payment (`abono`) or prior overdue balance.
 * - Keeps `[ PAGAR ]` enabled across multiple partial `abonos` until 100% of the balance is paid (`totalRemainingDebtCop === 0`).
 * - Disables `[ PAGAR ]` only when the tenant is `AL DÍA` (or when there is no active tenant).
 * - Reports `statusLabel` as `'AL DÍA'` or `'MOROSO'` for the Dashboard `ESTADO` column.
 */
export function getPropertyTenantPaymentState(
  propertyId: number,
  properties: Property[],
  contracts: TenantContract[],
  payments: RentPayment[],
  now: Date = new Date()
): PropertyTenantPaymentState {
  const currentPeriod = getCurrentPeriodMonth(now);
  const prop = properties.find((p) => p.id === propertyId);

  if (!prop || prop.property_type === 'EDIFICIO MATRIZ') {
    return {
      propertyId,
      hasActiveContract: false,
      contract: null,
      cutoffDay: prop?.cutoff_day ?? 5,
      activePeriod: currentPeriod,
      agreedRentCop: 0,
      alreadyCollectedCop: 0,
      remainingBalanceCop: 0,
      totalRemainingDebtCop: 0,
      daysUntilCutoff: 0,
      activationDateLabel: '',
      cutoffDateLabel: '',
      isCutoffWindowOpen: false,
      isAlDia: true,
      statusLabel: 'MATRIZ',
      canPay: false,
      periodBalances: [],
      recentPayments: [],
    };
  }

  const contract =
    contracts.find(
      (c) => c.property_id === propertyId && c.status !== 'FINALIZADO'
    ) ?? null;

  if (!contract || prop.status === 'DISPONIBLE') {
    return {
      propertyId,
      hasActiveContract: false,
      contract: null,
      cutoffDay: prop.cutoff_day || 5,
      activePeriod: currentPeriod,
      agreedRentCop: prop.base_rent_cop,
      alreadyCollectedCop: 0,
      remainingBalanceCop: 0,
      totalRemainingDebtCop: 0,
      daysUntilCutoff: 0,
      activationDateLabel: '',
      cutoffDateLabel: '',
      isCutoffWindowOpen: false,
      isAlDia: true,
      statusLabel: 'SIN INQUILINO',
      canPay: false,
      periodBalances: [],
      recentPayments: [],
    };
  }

  const cutoffDay = contract.cutoff_day || prop.cutoff_day || 5;
  const todayMidnight = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );
  const cutoffDate = new Date(now.getFullYear(), now.getMonth(), cutoffDay);
  const activationDate = new Date(
    now.getFullYear(),
    now.getMonth(),
    cutoffDay - 5
  );
  const daysUntilCutoff = Math.round(
    (cutoffDate.getTime() - todayMidnight.getTime()) / (1000 * 60 * 60 * 24)
  );

  const fmtDate = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const cycleState = getContractBillingCycleState(
    propertyId,
    properties,
    contracts,
    payments,
    now
  );

  const periodBalances: TenantPeriodBalanceSummary[] = [];
  for (const p of cycleState.collectiblePeriods) {
    const st = getPeriodCollectionStatus(
      propertyId,
      p,
      properties,
      contracts,
      payments,
      contract.id
    );
    const hasMoraRecord = payments.some(
      (rp) =>
        rp.property_id === propertyId &&
        rp.period_month === p &&
        rp.status === 'MORA'
    );
    const isPeriodWindowOpen =
      p < currentPeriod ||
      daysUntilCutoff <= 5 ||
      st.alreadyCollectedCop > 0 ||
      contract.status === 'MORA' ||
      hasMoraRecord;

    if (isPeriodWindowOpen) {
      periodBalances.push({
        periodMonth: p,
        agreedRentCop: st.agreedRentCop,
        alreadyCollectedCop: st.alreadyCollectedCop,
        remainingBalanceCop: st.remainingBalanceCop,
        isFullyPaid: st.isFullyPaid,
      });
    }
  }

  const totalRemainingDebtCop = periodBalances.reduce(
    (sum, b) => sum + b.remainingBalanceCop,
    0
  );
  const activeBalance =
    periodBalances.find((b) => b.remainingBalanceCop > 0) ??
    periodBalances[0] ?? {
      periodMonth: currentPeriod,
      agreedRentCop: contract.monthly_rent_cop || prop.base_rent_cop,
      alreadyCollectedCop: 0,
      remainingBalanceCop: 0,
      isFullyPaid: true,
    };

  const isCutoffWindowOpen = periodBalances.length > 0;
  const isAlDia = totalRemainingDebtCop === 0;
  const canPay = isCutoffWindowOpen && totalRemainingDebtCop > 0;

  const recentPayments = payments
    .filter((rp) => rp.property_id === propertyId)
    .sort((a, b) => b.id - a.id);

  return {
    propertyId,
    hasActiveContract: true,
    contract,
    cutoffDay,
    activePeriod: activeBalance.periodMonth,
    agreedRentCop: activeBalance.agreedRentCop,
    alreadyCollectedCop: activeBalance.alreadyCollectedCop,
    remainingBalanceCop: activeBalance.remainingBalanceCop,
    totalRemainingDebtCop,
    daysUntilCutoff,
    activationDateLabel: fmtDate(activationDate),
    cutoffDateLabel: fmtDate(cutoffDate),
    isCutoffWindowOpen,
    isAlDia,
    statusLabel: isAlDia ? 'AL DÍA' : 'MOROSO',
    canPay,
    periodBalances,
    recentPayments,
  };
}

/**
  * Builds Real-Time Smart Alerts for the Dashboard (`DashboardAnaliticoView`) scoped to the selected owner:
  * 1. Moras de los inquilinos (`EN_MORA`)
  * 2. Liquidaciones retrasadas por aprobar (`LIQUIDACION_RETRASADA`)
  * 3. Próximas liquidaciones a ejecutar (`PROXIMA_LIQUIDACION`)
  * 4. Próximos cobros (`PROXIMO_COBRO`)
  */
export function buildSmartAlerts(
  bundle: OwnerDashboardBundle,
  now: Date = new Date()
): SmartAlert[] {
  const alerts: SmartAlert[] = [];
  const currentPeriod = getCurrentPeriodMonth(now);
  const nextPeriod = getNextPeriodMonth(currentPeriod);
  const ownerCutoffDay = bundle.selected_owner.cutoff_day ?? 5;
  const propMap = new Map(bundle.properties.map((p) => [p.id, p]));

  // 1. Moras de los inquilinos (EN_MORA)
  for (const contract of bundle.contracts) {
    if (contract.status === 'FINALIZADO') continue;
    const prop = propMap.get(contract.property_id);
    if (!prop) continue;

    const paymentState = getPropertyTenantPaymentState(
      prop.id,
      bundle.properties,
      bundle.contracts,
      bundle.payments,
      now
    );

    const owedBalances = paymentState.periodBalances.filter(
      (b) => b.remainingBalanceCop > 0
    );

    if (contract.status === 'MORA' || !paymentState.isAlDia) {
      const owedPeriodsLabel =
        owedBalances.length > 0
          ? owedBalances.map((b) => b.periodMonth).join(', ')
          : currentPeriod;
      const moraAmount =
        paymentState.totalRemainingDebtCop > 0
          ? paymentState.totalRemainingDebtCop
          : contract.monthly_rent_cop;

      alerts.push({
        id: `mora-${contract.id}`,
        type: 'EN_MORA',
        severity: 'MAGENTA',
        title: `Mora de Inquilino: ${contract.tenant_name} — ${prop.title}`,
        subtitle: `Saldo en mora (${owedPeriodsLabel}) · Corte Día ${contract.cutoff_day} · Tel: ${contract.phone}`,
        amount_cop: moraAmount,
        cutoff_label: `MORA INQUILINO // CORTE DÍA ${contract.cutoff_day}`,
        property_id: prop.id,
        period_month: owedBalances[0]?.periodMonth ?? currentPeriod,
      });
    }
  }

  // 2. Liquidaciones retrasadas por aprobar (LIQUIDACION_RETRASADA)
  const candidatePeriods = Array.from(
    new Set([
      currentPeriod,
      '2026-10',
      ...bundle.payments.map(
        (rp) => rp.settlement_period_month ?? rp.period_month
      ),
      ...bundle.maintenances
        .map((m) => m.settlement_period_month ?? m.execution_date.slice(0, 7))
        .filter(Boolean),
    ])
  ).sort((a, b) => b.localeCompare(a));

  for (const period of candidatePeriods) {
    if (period >= currentPeriod) continue;

    const alreadySettled = bundle.settlements.some(
      (s) => s.period_month === period
    );
    if (alreadySettled) continue;

    const preview = calculateOwnerSettlementPreview(
      bundle.selected_owner.id,
      bundle.properties,
      bundle.payments,
      bundle.maintenances,
      period,
      bundle.contracts,
      bundle.settlements
    );

    if (preview.grossIncomeCop > 0 || preview.maintenanceDeductionCop > 0) {
      alerts.push({
        id: `liq-retrasada-${bundle.selected_owner.id}-${period}`,
        type: 'LIQUIDACION_RETRASADA',
        severity: 'MAGENTA',
        title: `Liquidación Retrasada por Aprobar (${period}) — ${bundle.selected_owner.name}`,
        subtitle: `Corte vencido (Día ${ownerCutoffDay}) · Recaudo: ${formatCop(preview.grossIncomeCop)} · ${preview.pendingMaintenances.length} mant. por descontar · ${bundle.selected_owner.bank_name}`,
        amount_cop: preview.netPayableCop,
        cutoff_label: `LIQUIDACIÓN RETRASADA POR APROBAR // ${period}`,
        period_month: period,
      });
    }
  }

  // 3. Próximas liquidaciones a ejecutar (PROXIMA_LIQUIDACION)
  const currentAlreadySettled = bundle.settlements.some(
    (s) => s.period_month === currentPeriod
  );
  const upcomingSettlementPeriod = currentAlreadySettled
    ? nextPeriod
    : currentPeriod;
  const upcomingPreview = calculateOwnerSettlementPreview(
    bundle.selected_owner.id,
    bundle.properties,
    bundle.payments,
    bundle.maintenances,
    upcomingSettlementPeriod,
    bundle.contracts,
    bundle.settlements
  );
  const upcomingCutoffDate = `${upcomingSettlementPeriod}-${String(ownerCutoffDay).padStart(2, '0')}`;

  alerts.push({
    id: `liq-proxima-${bundle.selected_owner.id}-${upcomingSettlementPeriod}`,
    type: 'PROXIMA_LIQUIDACION',
    severity: 'CYAN',
    title: `Próxima Liquidación a Ejecutar (${upcomingSettlementPeriod}) — ${bundle.selected_owner.name}`,
    subtitle: `Fecha de cierre automático: ${upcomingCutoffDate} (Día ${ownerCutoffDay}) · Recaudo acumulado: ${formatCop(upcomingPreview.grossIncomeCop)} · Dispersión: ${bundle.selected_owner.bank_name} (${bundle.selected_owner.bank_account_number})`,
    amount_cop:
      upcomingPreview.netPayableCop > 0
        ? upcomingPreview.netPayableCop
        : bundle.expected_monthly_collection_cop,
    cutoff_label: `PRÓXIMA LIQUIDACIÓN A EJECUTAR // CORTE DÍA ${ownerCutoffDay} (${upcomingSettlementPeriod})`,
    period_month: upcomingSettlementPeriod,
  });

  // 4. Próximos cobros (PROXIMO_COBRO)
  for (const contract of bundle.contracts) {
    if (contract.status === 'FINALIZADO') continue;
    const prop = propMap.get(contract.property_id);
    if (!prop) continue;

    const currentStatus = getPeriodCollectionStatus(
      prop.id,
      currentPeriod,
      bundle.properties,
      bundle.contracts,
      bundle.payments,
      contract.id
    );
    const targetCobroPeriod = currentStatus.isFullyPaid
      ? nextPeriod
      : currentPeriod;
    const targetCobroAmount = currentStatus.isFullyPaid
      ? contract.monthly_rent_cop
      : currentStatus.remainingBalanceCop;

    alerts.push({
      id: `cobro-${contract.id}`,
      type: 'PROXIMO_COBRO',
      severity: 'AMBER',
      title: `Próximo Cobro: ${contract.tenant_name} — ${prop.title}`,
      subtitle: `Periodo ${targetCobroPeriod} (Vence Día ${contract.cutoff_day} · Botón pagar activo 5 días antes) · Codeudor: ${contract.guarantor_name}`,
      amount_cop: targetCobroAmount,
      cutoff_label: `PRÓXIMO COBRO // VENCE DÍA ${contract.cutoff_day} (${targetCobroPeriod})`,
      property_id: prop.id,
      period_month: targetCobroPeriod,
    });
  }

  return alerts;
}

/**
 * Generates real weekly telemetry points (`SEM-01`..`SEM-04`) for Module 5 (`Liquidaciones`) SVG chart,
 * bucketed by the actual payment dates (`payment_date`) and maintenance execution dates (`execution_date`)
 * of the selected accounting period (`periodMonth`).
 */
export function buildWeeklyTelemetrySeries(
  bundle: OwnerDashboardBundle,
  periodMonth?: string,
  preview?: OwnerSettlementPreview
): WeeklyTelemetryPoint[] {
  const ownerId = bundle.selected_owner.id;
  const targetPeriod =
    periodMonth ??
    preview?.periodMonth ??
    resolveActiveSettlementPeriodForOwner(
      ownerId,
      bundle.payments,
      bundle.maintenances,
      bundle.settlements,
      new Date(),
      bundle.handover_notes ?? []
    );

  const activePreview =
    preview ??
    calculateOwnerSettlementPreview(
      ownerId,
      bundle.properties,
      bundle.payments,
      bundle.maintenances,
      targetPeriod,
      bundle.contracts,
      bundle.settlements,
      bundle.handover_notes ?? []
    );

  const getWeekIndex = (dateStr?: string): number => {
    if (!dateStr) return 0;
    const parts = dateStr.slice(0, 10).split('-');
    const day = Number(parts[2] ?? 1);
    if (!Number.isFinite(day) || day <= 7) return 0;
    if (day <= 14) return 1;
    if (day <= 21) return 2;
    return 3;
  };

  const grossByWeek = [0, 0, 0, 0];
  const maintByWeek = [0, 0, 0, 0];

  if (activePreview.lines.length > 0) {
    for (const line of activePreview.lines) {
      if (line.paymentsBreakdown && line.paymentsBreakdown.length > 0) {
        for (const rp of line.paymentsBreakdown) {
          const ownerDividend = Math.round(
            rp.gross_amount_cop * (line.ownerSharePct / 100)
          );
          const wIdx = getWeekIndex(rp.payment_date);
          grossByWeek[wIdx] += ownerDividend;
        }
      } else if (line.grossCollectedCop > 0) {
        grossByWeek[0] += line.grossCollectedCop;
      }
    }
  } else {
    const settled = bundle.settlements.find(
      (s) => s.owner_id === ownerId && s.period_month === targetPeriod
    );
    if (settled?.lines_snapshot && settled.lines_snapshot.length > 0) {
      for (const snap of settled.lines_snapshot) {
        if (snap.abonos_breakdown && snap.abonos_breakdown.length > 0) {
          for (const ab of snap.abonos_breakdown) {
            const wIdx = getWeekIndex(ab.payment_date);
            grossByWeek[wIdx] += ab.owner_dividend_cop;
          }
        } else if (snap.gross_collected_cop > 0) {
          grossByWeek[0] += snap.gross_collected_cop;
        }
      }
    }
  }

  const propById = new Map(bundle.properties.map((p) => [p.id, p]));
  const seenMaintIds = new Set<number>();

  for (const m of activePreview.pendingMaintenances) {
    seenMaintIds.add(m.id);
    const prop = propById.get(m.property_id);
    const sharePct = prop ? getOwnerSharePct(prop, ownerId) : 100;
    const prorated = Math.round(m.net_cost_cop * (sharePct / 100));
    maintByWeek[getWeekIndex(m.execution_date)] += prorated;
  }

  const settledForPeriod = bundle.settlements.find(
    (s) => s.owner_id === ownerId && s.period_month === targetPeriod
  );
  if (settledForPeriod) {
    if (
      settledForPeriod.maintenances_snapshot &&
      settledForPeriod.maintenances_snapshot.length > 0
    ) {
      for (const ms of settledForPeriod.maintenances_snapshot) {
        if (seenMaintIds.has(ms.id)) continue;
        seenMaintIds.add(ms.id);
        maintByWeek[getWeekIndex(ms.execution_date)] +=
          ms.prorated_deduction_cop;
      }
    } else {
      for (const m of bundle.maintenances) {
        if (seenMaintIds.has(m.id)) continue;
        const mPeriod =
          m.settlement_period_month ?? m.execution_date.slice(0, 7);
        if (
          m.settlement_id === settledForPeriod.id ||
          mPeriod === targetPeriod
        ) {
          seenMaintIds.add(m.id);
          const prop = propById.get(m.property_id);
          const sharePct = prop ? getOwnerSharePct(prop, ownerId) : 100;
          const prorated = Math.round(m.net_cost_cop * (sharePct / 100));
          maintByWeek[getWeekIndex(m.execution_date)] += prorated;
        }
      }
    }
  }

  return ['SEM-01', 'SEM-02', 'SEM-03', 'SEM-04'].map((weekLabel, idx) => {
    const grossIncomeCop = grossByWeek[idx];
    const maintenanceCostCop = maintByWeek[idx];
    const netLiquidityCop = grossIncomeCop - maintenanceCostCop;
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
  handoverNotes: HandoverSettlementNote[];
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
      fixed_fee_cop: 0,
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
      fixed_fee_cop: 0,
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
      fixed_fee_cop: 0,
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
      fixed_fee_cop: 0,
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
      fixed_fee_cop: 0,
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
      fixed_fee_cop: 0,
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
      fixed_fee_cop: 0,
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
      fixed_fee_amount_cop: 0,
      maintenance_deduction_cop: 420_000,
      net_payable_cop: 3_480_000,
      sha256_seal: computeSettlementSeal(
        1,
        '2026-09',
        4_300_000,
        400_000,
        0,
        420_000,
        3_480_000
      ),
      status: 'EJECUTADO',
      created_at: '2026-09-30T17:45:00Z',
      lines_snapshot: [
        {
          property_id: 2,
          property_code: 'SUB-FACA-101',
          property_title: 'Torre 1 - Apto 101',
          property_type: 'APARTAMENTO',
          owner_share_pct: 100,
          property_gross_collected_cop: 1_500_000,
          gross_collected_cop: 1_500_000,
          commission_pct: 8.0,
          percentage_fee_cop: 120_000,
          net_unit_cop: 1_380_000,
        },
        {
          property_id: 4,
          property_code: 'SUB-FACA-LOC1',
          property_title: 'Local Esquinero 01',
          property_type: 'LOCAL COMERCIAL',
          owner_share_pct: 100,
          property_gross_collected_cop: 2_800_000,
          gross_collected_cop: 2_800_000,
          commission_pct: 10.0,
          percentage_fee_cop: 280_000,
          net_unit_cop: 2_520_000,
        },
      ],
      maintenances_snapshot: [
        {
          id: 3,
          property_id: 2,
          property_code: 'SUB-FACA-101',
          property_title: 'Torre 1 - Apto 101',
          execution_date: '2026-09-14',
          category: 'IMPERMEABILIZACIÓN',
          description: 'Sellado acrílico de terraza y bajante pluvial',
          technician_name: 'Soluciones Civiles Cundinamarca',
          invoice_number: 'FAC-7710',
          total_net_cost_cop: 420_000,
          owner_share_pct: 100,
          prorated_deduction_cop: 420_000,
          receipt_image_path: 'evidencias/recibo_imper_sep.jpg',
        },
      ],
    },
    {
      id: 2,
      owner_id: 1,
      period_month: '2026-08',
      gross_income_cop: 4_300_000,
      commission_amount_cop: 400_000,
      fixed_fee_amount_cop: 0,
      maintenance_deduction_cop: 0,
      net_payable_cop: 3_900_000,
      sha256_seal: computeSettlementSeal(
        1,
        '2026-08',
        4_300_000,
        400_000,
        0,
        0,
        3_900_000
      ),
      status: 'EJECUTADO',
      created_at: '2026-08-31T18:10:00Z',
      lines_snapshot: [
        {
          property_id: 2,
          property_code: 'SUB-FACA-101',
          property_title: 'Torre 1 - Apto 101',
          property_type: 'APARTAMENTO',
          owner_share_pct: 100,
          property_gross_collected_cop: 1_500_000,
          gross_collected_cop: 1_500_000,
          commission_pct: 8.0,
          percentage_fee_cop: 120_000,
          net_unit_cop: 1_380_000,
        },
        {
          property_id: 4,
          property_code: 'SUB-FACA-LOC1',
          property_title: 'Local Esquinero 01',
          property_type: 'LOCAL COMERCIAL',
          owner_share_pct: 100,
          property_gross_collected_cop: 2_800_000,
          gross_collected_cop: 2_800_000,
          commission_pct: 10.0,
          percentage_fee_cop: 280_000,
          net_unit_cop: 2_520_000,
        },
      ],
      maintenances_snapshot: [],
    },
    {
      id: 3,
      owner_id: 2,
      period_month: '2026-09',
      gross_income_cop: 6_800_000,
      commission_amount_cop: 612_000,
      fixed_fee_amount_cop: 0,
      maintenance_deduction_cop: 0,
      net_payable_cop: 6_188_000,
      sha256_seal: computeSettlementSeal(
        2,
        '2026-09',
        6_800_000,
        612_000,
        0,
        0,
        6_188_000
      ),
      status: 'EJECUTADO',
      created_at: '2026-09-30T18:00:00Z',
      lines_snapshot: [
        {
          property_id: 7,
          property_code: 'SUB-POB-301',
          property_title: 'Oficina 301 Ejecutiva',
          property_type: 'OFICINA',
          owner_share_pct: 100,
          property_gross_collected_cop: 3_600_000,
          gross_collected_cop: 3_600_000,
          commission_pct: 9.0,
          percentage_fee_cop: 324_000,
          net_unit_cop: 3_276_000,
        },
        {
          property_id: 8,
          property_code: 'SUB-POB-302',
          property_title: 'Oficina 302 Co-Working',
          property_type: 'OFICINA',
          owner_share_pct: 100,
          property_gross_collected_cop: 3_200_000,
          gross_collected_cop: 3_200_000,
          commission_pct: 9.0,
          percentage_fee_cop: 288_000,
          net_unit_cop: 2_912_000,
        },
      ],
      maintenances_snapshot: [],
    },
  ];

  return {
    owners,
    properties,
    contracts,
    payments,
    maintenances,
    settlements,
    handoverNotes: [],
    backupSnapshots: [
      '%LocalAppData%\\InmoControl\\backups\\inmo_backup_20261015_080000_000.db',
    ],
  };
}

const STORAGE_KEY = 'inmo_control_v2_state_v2';

declare global {
  interface Window {
    __INMOCONTROL_DESKTOP_EXE__?: boolean;
    __INMOCONTROL_INITIAL_DB__?: LocalDatabaseState | null;
  }
}

function normalizeLoadedState(parsed: LocalDatabaseState): LocalDatabaseState {
  parsed.properties = parsed.properties.map((p) => ({
    ...p,
    fixed_fee_cop: 0,
  }));
  if (Array.isArray(parsed.settlements)) {
    parsed.settlements = parsed.settlements.map((s) => {
      if (s.fixed_fee_amount_cop > 0) {
        const updatedNet =
          s.gross_income_cop -
          s.commission_amount_cop -
          s.maintenance_deduction_cop;
        return {
          ...s,
          fixed_fee_amount_cop: 0,
          net_payable_cop: updatedNet,
          sha256_seal: computeSettlementSeal(
            s.owner_id,
            s.period_month,
            s.gross_income_cop,
            s.commission_amount_cop,
            0,
            s.maintenance_deduction_cop,
            updatedNet
          ),
        };
      }
      return s;
    });
  }
  if (!Array.isArray(parsed.handoverNotes)) {
    parsed.handoverNotes = [];
  }
  if (!Array.isArray(parsed.backupSnapshots)) {
    parsed.backupSnapshots = [
      '%LocalAppData%\\InmoControl\\backups\\inmo_backup_20261015_080000_000.db',
    ];
  }
  return parsed;
}

function syncStateToLocalExeDisk(state: LocalDatabaseState): void {
  try {
    if (
      typeof window !== 'undefined' &&
      window.__INMOCONTROL_DESKTOP_EXE__ &&
      typeof window.fetch === 'function'
    ) {
      void window
        .fetch('/api/local-db', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(state),
        })
        .catch(() => {
          // Ignore network errors in test/offline environments
        });
    }
  } catch {
    // Ignore errors
  }
}

function loadPersistedState(): LocalDatabaseState {
  try {
    if (typeof window !== 'undefined') {
      if (
        window.__INMOCONTROL_INITIAL_DB__ &&
        Array.isArray(window.__INMOCONTROL_INITIAL_DB__.owners) &&
        Array.isArray(window.__INMOCONTROL_INITIAL_DB__.properties)
      ) {
        const diskState = normalizeLoadedState(
          window.__INMOCONTROL_INITIAL_DB__
        );
        if (window.localStorage) {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(diskState));
        }
        return diskState;
      }

      if (window.localStorage) {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as LocalDatabaseState;
          if (
            parsed &&
            Array.isArray(parsed.owners) &&
            Array.isArray(parsed.properties)
          ) {
            const normalized = normalizeLoadedState(parsed);
            syncStateToLocalExeDisk(normalized);
            return normalized;
          }
        }
      }
    }
  } catch {
    // Fallback to seed state if storage is unavailable
  }
  const initial = createInitialSeedState();
  syncStateToLocalExeDisk(initial);
  return initial;
}

class InmoRepositoryImpl {
  private state: LocalDatabaseState = loadPersistedState();

  private persistState(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      }
    } catch {
      // Ignore storage quota errors
    }
    syncStateToLocalExeDisk(this.state);
  }

  public resetToSeed(): void {
    this.state = createInitialSeedState();
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // Ignore storage errors
    }
    syncStateToLocalExeDisk(this.state);
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
      .filter((p) => getOwnerSharePct(p, targetOwnerId) > 0)
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
    const propById = new Map(properties.map((p) => [p.id, p]));

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
      .reduce(
        (sum, p) =>
          sum +
          Math.round(
            p.base_rent_cop * (getOwnerSharePct(p, targetOwnerId) / 100)
          ),
        0
      );

    const contracts = this.state.contracts
      .filter((c) => propIds.has(c.property_id))
      .sort((a, b) => b.id - a.id);

    const payments = this.state.payments
      .filter((rp) => propIds.has(rp.property_id))
      .sort((a, b) => b.id - a.id);

    const collectedMonthlyCop = payments
      .filter((rp) => rp.status === 'PAGADO')
      .reduce((sum, rp) => {
        const prop = propById.get(rp.property_id);
        const sharePct = prop ? getOwnerSharePct(prop, targetOwnerId) : 100;
        return sum + Math.round(rp.gross_amount_cop * (sharePct / 100));
      }, 0);

    const maintenances = this.state.maintenances
      .filter((m) => propIds.has(m.property_id))
      .sort((a, b) => b.id - a.id);

    const pendingMaintenanceCop = maintenances
      .filter(
        (m) =>
          m.deduction_status === 'Por Liquidar' &&
          !m.settled_owner_ids?.includes(targetOwnerId)
      )
      .reduce((sum, m) => {
        const prop = propById.get(m.property_id);
        const sharePct = prop ? getOwnerSharePct(prop, targetOwnerId) : 100;
        return sum + Math.round(m.net_cost_cop * (sharePct / 100));
      }, 0);

    const settlements = this.state.settlements
      .filter((s) => s.owner_id === targetOwnerId)
      .sort(
        (a, b) =>
          b.period_month.localeCompare(a.period_month) || b.id - a.id
      );

    const handoverNotes = (this.state.handoverNotes ?? []).filter((hn) =>
      propIds.has(hn.property_id)
    );

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
      handover_notes: handoverNotes,
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
    this.persistState();
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
    this.persistState();
    return prop;
  }

  public updateProperty(input: UpdatePropertyInput): Property {
    const prop = this.state.properties.find((p) => p.id === input.id);
    if (!prop) {
      throw new Error(`No existe el inmueble con ID #${input.id}`);
    }
    const currentEffectivePeriod = getCurrentPeriodMonth();
    preservePreEditPropertySnapshot(prop, currentEffectivePeriod);

    const oldTitle = prop.title;
    const oldAddress = prop.address;

    if (input.owner_id !== undefined && Number(input.owner_id) > 0) {
      prop.owner_id = Number(input.owner_id);
      const ownerObj = this.state.owners.find((o) => o.id === prop.owner_id);
      if (ownerObj?.cutoff_day) {
        prop.cutoff_day = ownerObj.cutoff_day;
      }
    }
    if (input.code !== undefined && input.code.trim()) {
      prop.code = input.code.trim().toUpperCase();
    }
    if (input.title !== undefined && input.title.trim()) {
      prop.title = input.title.trim();
    }
    if (input.address !== undefined && input.address.trim()) {
      prop.address = input.address.trim();
    }
    if (input.property_type !== undefined && input.property_type.trim()) {
      prop.property_type = input.property_type.trim();
    }
    if (input.base_rent_cop !== undefined) {
      prop.base_rent_cop = Math.max(0, Number(input.base_rent_cop));
      if (prop.base_rent_cop > 0) {
        for (const c of this.state.contracts) {
          if (c.property_id === prop.id && c.status !== 'FINALIZADO') {
            c.monthly_rent_cop = prop.base_rent_cop;
          }
        }
      }
    }
    if (input.commission_pct !== undefined) {
      prop.commission_pct = Math.max(0, Number(input.commission_pct));
    }
    if (input.status !== undefined) {
      prop.status = input.status;
    }
    if ('co_owners' in input) {
      prop.co_owners = input.co_owners;
    }

    if (input.subdivisions !== undefined && prop.parent_property_id === null) {
      if (input.subdivisions.length > 0) {
        prop.property_type = 'EDIFICIO MATRIZ';
        prop.base_rent_cop = 0;
        const keptChildIds = new Set<number>();

        input.subdivisions.forEach((sub, idx) => {
          const cleanCode = (
            sub.code.trim() || `SUB-10${idx + 1}`
          ).toUpperCase();
          const rawTitle = sub.title.trim() || `Unidad ${idx + 1}`;
          const existingChild =
            sub.id !== undefined
              ? this.state.properties.find(
                  (c) => c.id === sub.id && c.parent_property_id === prop.id
                )
              : undefined;

          if (existingChild) {
            preservePreEditPropertySnapshot(
              existingChild,
              currentEffectivePeriod
            );
            existingChild.owner_id = prop.owner_id;
            existingChild.co_owners = prop.co_owners;
            existingChild.code = cleanCode;
            existingChild.title = rawTitle;
            existingChild.address = prop.address;
            existingChild.property_type = sub.property_type || 'APARTAMENTO';
            existingChild.base_rent_cop = Math.max(
              0,
              Number(sub.base_rent_cop || 0)
            );
            if (existingChild.base_rent_cop > 0) {
              for (const c of this.state.contracts) {
                if (
                  c.property_id === existingChild.id &&
                  c.status !== 'FINALIZADO'
                ) {
                  c.monthly_rent_cop = existingChild.base_rent_cop;
                }
              }
            }
            existingChild.commission_pct = Math.max(
              0,
              Number(sub.commission_pct || prop.commission_pct)
            );
            existingChild.cutoff_day = prop.cutoff_day;
            existingChild.status = sub.status || existingChild.status;
            keptChildIds.add(existingChild.id);
          } else {
            const nextId =
              this.state.properties.reduce((max, p) => Math.max(max, p.id), 0) +
              1;
            const createdChild: Property = {
              id: nextId,
              owner_id: prop.owner_id,
              co_owners: prop.co_owners,
              parent_property_id: prop.id,
              code: cleanCode,
              title: rawTitle,
              address: prop.address,
              property_type: sub.property_type || 'APARTAMENTO',
              base_rent_cop: Math.max(0, Number(sub.base_rent_cop || 0)),
              commission_pct: Math.max(
                0,
                Number(sub.commission_pct || prop.commission_pct)
              ),
              fixed_fee_cop: 0,
              cutoff_day: prop.cutoff_day,
              status: sub.status || 'DISPONIBLE',
              created_at: new Date().toISOString(),
              updated_effective_period: currentEffectivePeriod,
            };
            this.state.properties.push(createdChild);
            keptChildIds.add(createdChild.id);
          }
        });

        this.state.properties = this.state.properties.filter(
          (p) => p.parent_property_id !== prop.id || keptChildIds.has(p.id)
        );
      } else {
        this.state.properties = this.state.properties.filter(
          (p) => p.parent_property_id !== prop.id
        );
      }
    } else if (prop.parent_property_id === null) {
      // Propagate updated owner, co_owners, address, and prefix title to child sub-units
      for (const child of this.state.properties) {
        if (child.parent_property_id === prop.id) {
          preservePreEditPropertySnapshot(child, currentEffectivePeriod);
          child.owner_id = prop.owner_id;
          if ('co_owners' in input) {
            child.co_owners = prop.co_owners;
          }
          if (input.address !== undefined && child.address === oldAddress) {
            child.address = prop.address;
          }
          if (
            input.title !== undefined &&
            oldTitle &&
            child.title.startsWith(`${oldTitle} - `)
          ) {
            child.title = `${prop.title} - ${child.title.slice(oldTitle.length + 3)}`;
          }
        }
      }
    }

    this.persistState();
    return { ...prop };
  }

  public createTenantContract(input: NewContractInput): TenantContract {
    const nextId =
      this.state.contracts.reduce((max, c) => Math.max(max, c.id), 0) + 1;
    const currentPeriod = getCurrentPeriodMonth();
    const startPeriod = input.start_date?.slice(0, 7) || currentPeriod;
    const contract: TenantContract = {
      id: nextId,
      ...input,
      ...(startPeriod < currentPeriod
        ? { retroactive_from_period: startPeriod }
        : {}),
      created_at: new Date().toISOString(),
    };
    // Transactional update: insert contract + mark property OCUPADO
    this.state.contracts.push(contract);
    const prop = this.state.properties.find((p) => p.id === input.property_id);
    if (prop) {
      prop.status = 'OCUPADO';
    }
    this.persistState();
    return contract;
  }

  public recordRentPayment(input: NewRentPaymentInput): RentPayment {
    const amount = Number(input.gross_amount_cop || 0);
    if (amount <= 0) {
      throw new Error('El valor del recaudo o abono debe ser mayor a $0 COP.');
    }

    const currentPeriod = getCurrentPeriodMonth();
    if (input.period_month > currentPeriod) {
      throw new Error(
        `Operación bloqueada: El periodo ${input.period_month} aún no ha llegado. El cobro se activa únicamente cuando llegue la fecha de corte.`
      );
    }

    const contract =
      (input.contract_id
        ? this.state.contracts.find((c) => c.id === input.contract_id)
        : undefined) ??
      this.state.contracts.find(
        (c) => c.property_id === input.property_id && c.status !== 'FINALIZADO'
      ) ??
      this.state.contracts.find((c) => c.property_id === input.property_id);

    if (contract?.start_date) {
      const registrationPeriod = contract.start_date.slice(0, 7);
      if (input.period_month < registrationPeriod) {
        throw new Error(
          `Operación bloqueada: No se pueden cobrar meses anteriores (${input.period_month}) a la fecha de registro del inquilino (${contract.start_date}).`
        );
      }
    }

    const status = getPeriodCollectionStatus(
      input.property_id,
      input.period_month,
      this.state.properties,
      this.state.contracts,
      this.state.payments,
      input.contract_id
    );

    if (
      status.agreedRentCop > 0 &&
      status.alreadyCollectedCop + amount > status.agreedRentCop
    ) {
      throw new Error(
        `El abono de ${formatCop(amount)} supera el saldo pendiente del periodo ${input.period_month} (Pactado: ${formatCop(status.agreedRentCop)} · Abonado: ${formatCop(status.alreadyCollectedCop)} · Saldo máximo permitido: ${formatCop(status.remainingBalanceCop)}).`
      );
    }

    const prop = this.state.properties.find((p) => p.id === input.property_id);
    const primaryOwnerId = prop?.owner_id ?? 1;
    const cutoffDay = contract?.cutoff_day ?? prop?.cutoff_day ?? 5;
    const hasMoraRecordForPeriod = this.state.payments.some(
      (rp) =>
        rp.property_id === input.property_id &&
        rp.period_month === input.period_month &&
        rp.status === 'MORA'
    );
    const isExplicitMoraContract =
      input.period_month < currentPeriod &&
      (hasMoraRecordForPeriod || contract?.status === 'MORA');
    const isOriginPeriodSettled = this.state.settlements.some(
      (s) =>
        s.owner_id === primaryOwnerId && s.period_month === input.period_month
    );

    let settlementPeriodMonth: string;
    let effectivePaymentDate =
      input.payment_date || new Date().toISOString().slice(0, 10);

    if (isExplicitMoraContract) {
      settlementPeriodMonth = resolveNextUnsettledCutoffPeriod(
        primaryOwnerId,
        currentPeriod,
        this.state.settlements
      );
    } else if (input.period_month < currentPeriod) {
      if (!isOriginPeriodSettled) {
        settlementPeriodMonth = input.period_month;
        if (
          !input.payment_date ||
          input.payment_date.slice(0, 7) !== input.period_month
        ) {
          effectivePaymentDate = `${input.period_month}-${String(cutoffDay).padStart(2, '0')}`;
        }
      } else {
        settlementPeriodMonth = resolveNextUnsettledCutoffPeriod(
          primaryOwnerId,
          currentPeriod,
          this.state.settlements
        );
      }
    } else {
      settlementPeriodMonth = resolveNextUnsettledCutoffPeriod(
        primaryOwnerId,
        input.period_month,
        this.state.settlements
      );
    }

    const nextId =
      this.state.payments.reduce((max, rp) => Math.max(max, rp.id), 0) + 1;
    const normalizedMethod = input.payment_method || 'TRANSACCIÓN';
    const payment: RentPayment = {
      id: nextId,
      ...input,
      payment_date: effectivePaymentDate,
      payment_method: normalizedMethod,
      reference_code:
        input.reference_code?.trim() ||
        (normalizedMethod.toUpperCase().includes('EFECTIVO')
          ? `REC-EFE-${nextId}`
          : `REC-TRX-${nextId}`),
      settlement_period_month: settlementPeriodMonth,
      gross_amount_cop: amount,
    };
    this.state.payments.push(payment);

    if (
      status.agreedRentCop > 0 &&
      status.alreadyCollectedCop + amount >= status.agreedRentCop
    ) {
      for (const rp of this.state.payments) {
        if (
          rp.property_id === input.property_id &&
          rp.period_month === input.period_month &&
          rp.status === 'MORA'
        ) {
          rp.status = 'PENDIENTE';
        }
      }
      if (contract && contract.status === 'MORA') {
        const updatedState = getPropertyTenantPaymentState(
          input.property_id,
          this.state.properties,
          this.state.contracts,
          this.state.payments
        );
        if (updatedState.totalRemainingDebtCop === 0) {
          contract.status = 'ACTIVO';
        }
      }
    }

    this.persistState();
    return payment;
  }

  public createMaintenanceExpense(
    input: NewMaintenanceInput
  ): MaintenanceExpense {
    const prop = this.state.properties.find((p) => p.id === input.property_id);
    const primaryOwnerId = prop?.owner_id ?? 1;
    const basePeriod =
      input.execution_date?.slice(0, 7) || getCurrentPeriodMonth();
    const settlementPeriodMonth = resolveNextUnsettledCutoffPeriod(
      primaryOwnerId,
      basePeriod,
      this.state.settlements
    );

    const nextId =
      this.state.maintenances.reduce((max, m) => Math.max(max, m.id), 0) + 1;
    const expense: MaintenanceExpense = {
      id: nextId,
      property_id: input.property_id,
      execution_date: input.execution_date,
      settlement_period_month: settlementPeriodMonth,
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
    this.persistState();
    return expense;
  }

  /**
   * Executes a transactional monthly settlement (`BEGIN TRANSACTION ... COMMIT`):
   * - Verifies that `(ownerId, periodMonth)` has not already been approved to prevent duplicate historical records.
   * - Calculates gross rent collected, percentage commission `(Gross * %)`, and 1:1 net maintenance deductions.
   * - Persists the settlement record with a SHA-256 seal.
   * - Marks included rent payments and `Por Liquidar` maintenance expenses as settled for this owner.
   */
  public executeMonthlySettlement(
    ownerId: number,
    periodMonth: string
  ): Settlement {
    // Snapshot state for atomic rollback on any failure
    const snapshot = JSON.stringify(this.state);
    try {
      const alreadyApproved = this.state.settlements.some(
        (s) => s.owner_id === ownerId && s.period_month === periodMonth
      );
      if (alreadyApproved) {
        throw new Error(
          `Operación bloqueada: La liquidación del periodo ${periodMonth} ya fue aprobada y registrada en el historial.`
        );
      }

      const ownerProps = this.state.properties.filter(
        (p) => getOwnerSharePct(p, ownerId) > 0
      );
      const ownerPropIds = new Set(ownerProps.map((p) => p.id));
      const ownerPayments = this.state.payments.filter((rp) =>
        ownerPropIds.has(rp.property_id)
      );
      const ownerMaintenances = this.state.maintenances.filter((m) =>
        ownerPropIds.has(m.property_id)
      );

      const ownerContracts = this.state.contracts.filter((c) =>
        ownerPropIds.has(c.property_id)
      );

      const preview = calculateOwnerSettlementPreview(
        ownerId,
        ownerProps,
        ownerPayments,
        ownerMaintenances,
        periodMonth,
        ownerContracts,
        this.state.settlements,
        this.state.handoverNotes ?? []
      );

      const propById = new Map(ownerProps.map((p) => [p.id, p]));

      const linesSnapshot = preview.lines.map((line) => ({
        property_id: line.property.id,
        property_code: line.property.code,
        property_title: line.property.title,
        property_type: line.property.property_type,
        owner_share_pct: line.ownerSharePct,
        agreed_rent_cop: line.agreedRentCop,
        remaining_balance_cop: line.remainingBalanceCop,
        is_partial_payment: line.isPartialPayment,
        mora_period_months: line.moraPeriodMonths,
        abonos_count: line.abonosCount,
        abonos_breakdown: line.paymentsBreakdown.map((rp) => ({
          id: rp.id,
          reference_code: rp.reference_code,
          payment_date: rp.payment_date,
          payment_method: rp.payment_method,
          payment_description: rp.payment_description,
          origin_period_month: rp.period_month,
          is_mora_payment: rp.period_month < periodMonth,
          gross_amount_cop: rp.gross_amount_cop,
          owner_dividend_cop: Math.round(
            rp.gross_amount_cop * (line.ownerSharePct / 100)
          ),
        })),
        property_gross_collected_cop: line.propertyGrossCollectedCop,
        gross_collected_cop: line.grossCollectedCop,
        commission_pct: line.property.commission_pct,
        percentage_fee_cop: line.percentageFeeCop,
        net_unit_cop: line.grossCollectedCop - line.percentageFeeCop,
      }));

      const maintenancesSnapshot = preview.pendingMaintenances.map((m) => {
        const prop = propById.get(m.property_id);
        const sharePct = prop ? getOwnerSharePct(prop, ownerId) : 100;
        return {
          id: m.id,
          property_id: m.property_id,
          property_code: prop?.code ?? `INM-${m.property_id}`,
          property_title: prop?.title ?? `Inmueble #${m.property_id}`,
          execution_date: m.execution_date,
          category: m.category,
          description: m.description,
          technician_name: m.technician_name,
          invoice_number: m.invoice_number,
          total_net_cost_cop: m.net_cost_cop,
          owner_share_pct: sharePct,
          prorated_deduction_cop: Math.round(m.net_cost_cop * (sharePct / 100)),
          receipt_image_path: m.receipt_image_path,
        };
      });

      const nextId =
        this.state.settlements.reduce((max, s) => Math.max(max, s.id), 0) + 1;

      const settlement: Settlement = {
        id: nextId,
        owner_id: ownerId,
        period_month: periodMonth,
        gross_income_cop: preview.grossIncomeCop,
        commission_amount_cop: preview.commissionAmountCop,
        fixed_fee_amount_cop: 0,
        maintenance_deduction_cop: preview.maintenanceDeductionCop,
        net_payable_cop: preview.netPayableCop,
        sha256_seal: preview.sha256PreviewSeal,
        status: 'EJECUTADO',
        created_at: new Date().toISOString(),
        lines_snapshot: linesSnapshot,
        maintenances_snapshot: maintenancesSnapshot,
        handover_notes_snapshot: preview.handoverNotes ?? [],
      };

      this.state.settlements.push(settlement);

      for (const rp of this.state.payments) {
        if (
          ownerPropIds.has(rp.property_id) &&
          (rp.settlement_period_month ?? rp.period_month) === periodMonth &&
          rp.status === 'PAGADO'
        ) {
          const settledSet = new Set(rp.settled_owner_ids ?? []);
          settledSet.add(ownerId);
          rp.settled_owner_ids = Array.from(settledSet);
          rp.settlement_id = settlement.id;
        }
      }

      for (const maint of this.state.maintenances) {
        if (
          ownerPropIds.has(maint.property_id) &&
          maint.deduction_status === 'Por Liquidar' &&
          !maint.settled_owner_ids?.includes(ownerId) &&
          (!maint.settlement_period_month ||
            maint.settlement_period_month <= periodMonth)
        ) {
          const settledSet = new Set(maint.settled_owner_ids ?? []);
          settledSet.add(ownerId);
          maint.settled_owner_ids = Array.from(settledSet);
          maint.settlement_id = settlement.id;

          const prop = propById.get(maint.property_id);
          const requiredOwners =
            prop?.co_owners && prop.co_owners.length > 0
              ? prop.co_owners
                  .filter((co) => co.share_pct > 0)
                  .map((co) => co.owner_id)
              : [ownerId];

          const allCoOwnersSettled = requiredOwners.every((oid) =>
            settledSet.has(oid)
          );
          if (allCoOwnersSettled) {
            maint.deduction_status = 'Liquidado';
          }
        }
      }

      this.persistState();
      return settlement;
    } catch (err) {
      this.state = JSON.parse(snapshot);
      throw err;
    }
  }

  /**
   * Executes a transactional property handover (`BEGIN TRANSACTION ... COMMIT`):
   * - If the tenant makes a partial or full payment (`abono_amount_cop > 0`) during handover, records the payment with `payment_description` so it adds to the active settlement's gross income.
   * - If the tenant is NOT a paz y salvo (still owes months/balance) or paid a handover abono, records a `HandoverSettlementNote` in the active settlement period detailing the owed months, remaining balance, and any abono + payment description.
   * - Terminates active/overdue contracts on `propertyId` (`FINALIZADO`).
   * - Transitions property status to `DISPONIBLE`.
   */
  public executePropertyHandover(
    propertyIdOrInput: number | ExecutePropertyHandoverInput
  ): HandoverSettlementNote | null {
    const snapshot = JSON.stringify(this.state);
    try {
      const normalizedInput: ExecutePropertyHandoverInput =
        typeof propertyIdOrInput === 'number'
          ? { property_id: propertyIdOrInput }
          : propertyIdOrInput;
      const propertyId = Number(normalizedInput.property_id);
      const abonoAmountCop = Math.max(
        0,
        Number(normalizedInput.abono_amount_cop || 0)
      );
      const paymentMethod = normalizedInput.payment_method || 'TRANSACCIÓN';
      const paymentDescription =
        normalizedInput.payment_description?.trim() ||
        'Abono en entrega de inmueble';

      const prop = this.state.properties.find((p) => p.id === propertyId);
      if (!prop) {
        throw new Error(`Property ${propertyId} does not exist`);
      }

      const activeContract =
        this.state.contracts.find(
          (c) =>
            c.property_id === propertyId &&
            (c.status === 'ACTIVO' || c.status === 'MORA')
        ) ?? null;

      const currentPeriod = getCurrentPeriodMonth();
      const todayIso = new Date().toISOString().slice(0, 10);
      const primaryOwnerId = prop.owner_id ?? 1;
      const settlementPeriodMonth = resolveNextUnsettledCutoffPeriod(
        primaryOwnerId,
        currentPeriod,
        this.state.settlements
      );

      const initialState = getPropertyTenantPaymentState(
        propertyId,
        this.state.properties,
        this.state.contracts,
        this.state.payments
      );

      // Apply handover abono across owed periods (oldest owed period first) so it adds to the settlement gross income with the payment description
      let appliedAbonoCop = 0;
      if (abonoAmountCop > 0 && activeContract) {
        let remainingToApply = abonoAmountCop;
        const owedBalances = [...initialState.periodBalances]
          .filter((b) => b.remainingBalanceCop > 0)
          .sort((a, b) => a.periodMonth.localeCompare(b.periodMonth));

        for (const bal of owedBalances) {
          if (remainingToApply <= 0) break;
          const chunk = Math.min(remainingToApply, bal.remainingBalanceCop);
          if (chunk > 0) {
            this.recordRentPayment({
              contract_id: activeContract.id,
              property_id: propertyId,
              period_month: bal.periodMonth,
              gross_amount_cop: chunk,
              payment_date: todayIso,
              payment_method: paymentMethod,
              reference_code: `ENTREGA-${prop.code}-${bal.periodMonth}`,
              payment_description: paymentDescription,
              status: 'PAGADO',
            });
            appliedAbonoCop += chunk;
            remainingToApply -= chunk;
          }
        }

        // If no open period balance matched or user paid an extra handover abono, record it on the active period
        if (appliedAbonoCop === 0 && abonoAmountCop > 0) {
          const nextId =
            this.state.payments.reduce((max, rp) => Math.max(max, rp.id), 0) +
            1;
          this.state.payments.push({
            id: nextId,
            contract_id: activeContract.id,
            property_id: propertyId,
            period_month: currentPeriod,
            settlement_period_month: settlementPeriodMonth,
            gross_amount_cop: abonoAmountCop,
            payment_date: todayIso,
            payment_method: paymentMethod,
            reference_code: `ENTREGA-${prop.code}-${nextId}`,
            payment_description: paymentDescription,
            status: 'PAGADO',
          });
          appliedAbonoCop = abonoAmountCop;
        }
      }

      const postAbonoState = getPropertyTenantPaymentState(
        propertyId,
        this.state.properties,
        this.state.contracts,
        this.state.payments
      );
      const owedMonths = postAbonoState.periodBalances
        .filter((b) => b.remainingBalanceCop > 0)
        .map((b) => b.periodMonth);
      const remainingDebtCop = postAbonoState.totalRemainingDebtCop;

      let createdNote: HandoverSettlementNote | null = null;
      if (
        activeContract &&
        (remainingDebtCop > 0 || owedMonths.length > 0 || appliedAbonoCop > 0)
      ) {
        if (!Array.isArray(this.state.handoverNotes)) {
          this.state.handoverNotes = [];
        }
        const nextNoteId =
          this.state.handoverNotes.reduce((max, n) => Math.max(max, n.id), 0) +
          1;
        const owedText =
          owedMonths.length > 0
            ? `Quedó debiendo los meses: ${owedMonths.join(', ')} (Saldo pendiente: ${formatCop(remainingDebtCop)})`
            : 'Saldo cubierto con el abono en entrega ($0 COP pendiente)';
        const abonoText =
          appliedAbonoCop > 0
            ? ` · Abonó a la deuda: ${formatCop(appliedAbonoCop)} (${paymentMethod} — Descripción: ${paymentDescription})`
            : ' · Sin abono registrado en la entrega';

        createdNote = {
          id: nextNoteId,
          property_id: prop.id,
          property_code: prop.code,
          property_title: prop.title,
          tenant_name: activeContract.tenant_name,
          handover_date: todayIso,
          settlement_period_month: settlementPeriodMonth,
          owed_months: owedMonths,
          remaining_debt_cop: remainingDebtCop,
          abono_amount_cop: appliedAbonoCop,
          payment_description: appliedAbonoCop > 0 ? paymentDescription : '',
          note_text: `NOTA DE ENTREGA DE INMUEBLE: [${prop.code}] ${prop.title} — Inquilino: ${activeContract.tenant_name} · ${owedText}${abonoText}.`,
        };
        this.state.handoverNotes.push(createdNote);
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
      this.persistState();
      return createdNote;
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
    this.persistState();
    return backupPath;
  }

  public getBackupSnapshots(): string[] {
    return [...this.state.backupSnapshots];
  }
}

export const inmoRepository = new InmoRepositoryImpl();
