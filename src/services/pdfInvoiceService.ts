import {
  HandoverSettlementNote,
  Owner,
  OwnerDashboardBundle,
  Settlement,
  SettlementLineSnapshot,
  SettlementMaintenanceSnapshot,
} from '../types/domain';
import {
  ActiveMoraBalanceSnapshot,
  OwnerSettlementPreview,
  formatCop,
  formatCopInWords,
  getOwnerSharePct,
} from './inmoService';

export interface SettlementInvoiceDocument {
  invoiceNumber: string;
  periodMonth: string;
  issuedAt: string;
  statusLabel: string;
  owner: Owner;
  lines: SettlementLineSnapshot[];
  activeMoraBalances?: ActiveMoraBalanceSnapshot[];
  handoverNotes?: HandoverSettlementNote[];
  maintenances: SettlementMaintenanceSnapshot[];
  grossIncomeCop: number;
  commissionAmountCop: number;
  maintenanceDeductionCop: number;
  netPayableCop: number;
  netPayableWords: string;
  sha256Seal: string;
}

/**
 * Builds a complete `SettlementInvoiceDocument` from the active monthly preview.
 */
export function buildInvoiceFromPreview(
  bundle: OwnerDashboardBundle,
  preview: OwnerSettlementPreview
): SettlementInvoiceDocument {
  const ownerId = bundle.selected_owner.id;
  const propMap = new Map(bundle.properties.map((p) => [p.id, p]));

  const lines: SettlementLineSnapshot[] = preview.lines.map((line) => ({
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
      is_mora_payment: rp.period_month < preview.periodMonth,
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

  const maintenances: SettlementMaintenanceSnapshot[] =
    preview.pendingMaintenances.map((m) => {
      const prop = propMap.get(m.property_id);
      const sharePct = prop ? getOwnerSharePct(prop, ownerId) : 100;
      const proratedDeductionCop = Math.round(
        m.net_cost_cop * (sharePct / 100)
      );
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
        prorated_deduction_cop: proratedDeductionCop,
        receipt_image_path: m.receipt_image_path,
      };
    });

  return {
    invoiceNumber: `PRELIQ-${preview.periodMonth}-P0${ownerId}`,
    periodMonth: preview.periodMonth,
    issuedAt: new Date().toISOString().slice(0, 10),
    statusLabel: 'PRELIQUIDACION // PENDIENTE DISPERSION',
    owner: bundle.selected_owner,
    lines,
    activeMoraBalances: preview.activeMoraBalances ?? [],
    handoverNotes: preview.handoverNotes ?? [],
    maintenances,
    grossIncomeCop: preview.grossIncomeCop,
    commissionAmountCop: preview.commissionAmountCop,
    maintenanceDeductionCop: preview.maintenanceDeductionCop,
    netPayableCop: preview.netPayableCop,
    netPayableWords: formatCopInWords(preview.netPayableCop),
    sha256Seal: preview.sha256PreviewSeal,
  };
}

/**
 * Builds a complete `SettlementInvoiceDocument` from an executed historical `Settlement`.
 */
export function buildInvoiceFromHistoricalSettlement(
  bundle: OwnerDashboardBundle,
  settlement: Settlement
): SettlementInvoiceDocument {
  const ownerId = settlement.owner_id;
  const propMap = new Map(bundle.properties.map((p) => [p.id, p]));

  let lines: SettlementLineSnapshot[] = settlement.lines_snapshot ?? [];
  if (lines.length === 0) {
    // Reconstruct from owner's properties if historical record predates snapshot field
    for (const prop of bundle.properties) {
      if (prop.property_type === 'EDIFICIO MATRIZ') continue;
      const sharePct = getOwnerSharePct(prop, ownerId);
      if (sharePct <= 0) continue;

      const propPayments = bundle.payments
        .filter(
          (rp) =>
            rp.property_id === prop.id &&
            rp.period_month === settlement.period_month &&
            rp.status === 'PAGADO'
        )
        .sort((a, b) => a.id - b.id);

      const paidForPeriod = propPayments.reduce(
        (sum, rp) => sum + rp.gross_amount_cop,
        0
      );

      const baseGross =
        paidForPeriod > 0
          ? paidForPeriod
          : prop.status === 'OCUPADO'
            ? prop.base_rent_cop
            : 0;

      if (baseGross > 0) {
        const agreedRentCop = prop.base_rent_cop;
        const remainingBalanceCop = Math.max(0, agreedRentCop - baseGross);
        const isPartialPayment = agreedRentCop > 0 && baseGross < agreedRentCop;
        const ownerGross = Math.round(baseGross * (sharePct / 100));
        const pctFee = Math.round(ownerGross * (prop.commission_pct / 100));
        lines.push({
          property_id: prop.id,
          property_code: prop.code,
          property_title: prop.title,
          property_type: prop.property_type,
          owner_share_pct: sharePct,
          agreed_rent_cop: agreedRentCop,
          remaining_balance_cop: remainingBalanceCop,
          is_partial_payment: isPartialPayment,
          abonos_count: propPayments.length || 1,
          abonos_breakdown: propPayments.map((rp) => ({
            id: rp.id,
            reference_code: rp.reference_code,
            payment_date: rp.payment_date,
            payment_method: rp.payment_method,
            gross_amount_cop: rp.gross_amount_cop,
            owner_dividend_cop: Math.round(
              rp.gross_amount_cop * (sharePct / 100)
            ),
          })),
          property_gross_collected_cop: baseGross,
          gross_collected_cop: ownerGross,
          commission_pct: prop.commission_pct,
          percentage_fee_cop: pctFee,
          net_unit_cop: ownerGross - pctFee,
        });
      }
    }
  }

  let maintenances: SettlementMaintenanceSnapshot[] =
    settlement.maintenances_snapshot ?? [];
  if (maintenances.length === 0) {
    const linked = bundle.maintenances.filter(
      (m) => m.settlement_id === settlement.id
    );
    maintenances = linked.map((m) => {
      const prop = propMap.get(m.property_id);
      const sharePct = prop ? getOwnerSharePct(prop, ownerId) : 100;
      const proratedDeductionCop = Math.round(
        m.net_cost_cop * (sharePct / 100)
      );
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
        prorated_deduction_cop: proratedDeductionCop,
        receipt_image_path: m.receipt_image_path,
      };
    });
  }

  return {
    invoiceNumber: `FAC-LIQ-${settlement.period_month}-${String(settlement.id).padStart(3, '0')}`,
    periodMonth: settlement.period_month,
    issuedAt: settlement.created_at.slice(0, 10),
    statusLabel: `EJECUTADO // LIQUIDACION CERRADA`,
    owner: bundle.selected_owner,
    lines,
    handoverNotes: settlement.handover_notes_snapshot ?? [],
    maintenances,
    grossIncomeCop: settlement.gross_income_cop,
    commissionAmountCop: settlement.commission_amount_cop,
    maintenanceDeductionCop: settlement.maintenance_deduction_cop,
    netPayableCop: settlement.net_payable_cop,
    netPayableWords: formatCopInWords(settlement.net_payable_cop),
    sha256Seal: settlement.sha256_seal,
  };
}

/**
 * Escapes and normalizes text for PDF Type1 Helvetica/Courier WinAnsi encoding.
 */
function pdfEscape(raw: string): string {
  const normalized = raw
    .replace(/—/g, '-')
    .replace(/–/g, '-')
    .replace(/·/g, '-')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, '');

  let out = '';
  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i];
    const code = normalized.charCodeAt(i);
    if (ch === '\\' || ch === '(' || ch === ')') {
      out += `\\${ch}`;
    } else if (code > 127) {
      out += `\\${code.toString(8).padStart(3, '0')}`;
    } else {
      out += ch;
    }
  }
  return out;
}

/**
 * Generates a valid PDF 1.4 binary document containing the full financial breakdown
 * of the monthly settlement invoice.
 */
export function generateSettlementPdfContent(
  doc: SettlementInvoiceDocument
): string {
  const ops: string[] = [];

  const drawRect = (
    x: number,
    y: number,
    w: number,
    h: number,
    fillRgb: [number, number, number],
    strokeRgb?: [number, number, number]
  ) => {
    ops.push(`${fillRgb[0]} ${fillRgb[1]} ${fillRgb[2]} rg`);
    if (strokeRgb) {
      ops.push(`${strokeRgb[0]} ${strokeRgb[1]} ${strokeRgb[2]} RG 0.8 w`);
      ops.push(`${x} ${y} ${w} ${h} re B`);
    } else {
      ops.push(`${x} ${y} ${w} ${h} re f`);
    }
  };

  const drawLine = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    rgb: [number, number, number] = [0.8, 0.82, 0.85],
    width = 0.6
  ) => {
    ops.push(
      `${rgb[0]} ${rgb[1]} ${rgb[2]} RG ${width} w ${x1} ${y1} m ${x2} ${y2} l S`
    );
  };

  const drawText = (
    x: number,
    y: number,
    text: string,
    font: 'F1' | 'F2' | 'F3' = 'F1',
    size = 9,
    rgb: [number, number, number] = [0.08, 0.09, 0.12]
  ) => {
    ops.push(
      `BT /${font} ${size} Tf ${rgb[0]} ${rgb[1]} ${rgb[2]} rg ${x} ${y} Td (${pdfEscape(text)}) Tj ET`
    );
  };

  // Top Header Band
  drawRect(36, 760, 540, 52, [0.05, 0.06, 0.08]);
  drawText(
    48,
    792,
    'INMOCONTROL 2.0 // FACTURA Y EXTRACTO OFICIAL DE LIQUIDACION MENSUAL',
    'F2',
    11,
    [0.0, 0.93, 0.99]
  );
  drawText(
    48,
    774,
    `FACTURA: ${doc.invoiceNumber}   |   PERIODO CONTABLE: ${doc.periodMonth}   |   EMISION: ${doc.issuedAt}`,
    'F3',
    8.5,
    [0.9, 0.92, 0.95]
  );
  drawText(415, 792, doc.statusLabel, 'F2', 8, [0.0, 1.0, 0.4]);

  // Owner & Bank Dispersion Metadata Box
  drawRect(36, 686, 540, 64, [0.96, 0.97, 0.98], [0.78, 0.8, 0.84]);
  drawText(
    48,
    735,
    'DATOS DEL PROPIETARIO Y CUENTA DE DISPERSION BANCARIA',
    'F2',
    9,
    [0.1, 0.12, 0.16]
  );
  drawText(
    48,
    720,
    `Propietario: ${doc.owner.name} (${doc.owner.document_id})`,
    'F1',
    8.5
  );
  drawText(
    48,
    707,
    `Contacto: ${doc.owner.phone} | ${doc.owner.email}`,
    'F1',
    8.5
  );
  drawText(
    48,
    694,
    `Cuenta Destino: ${doc.owner.bank_name} - ${doc.owner.bank_account_type} Nro. ${doc.owner.bank_account_number} (Corte Dia ${doc.owner.cutoff_day ?? 5})`,
    'F2',
    8.5
  );

  // Section 1: Property Breakdown Table
  let y = 664;
  drawText(
    36,
    y,
    `1. DESGLOSE DE RECAUDOS Y COMISION POR INMUEBLE (${doc.periodMonth})`,
    'F2',
    9.5,
    [0.06, 0.08, 0.12]
  );
  y -= 18;

  // Table Header
  drawRect(36, y - 4, 540, 18, [0.12, 0.14, 0.18]);
  drawText(42, y, 'CODIGO / INMUEBLE', 'F2', 7.5, [1, 1, 1]);
  drawText(230, y, 'PART.', 'F2', 7.5, [1, 1, 1]);
  drawText(272, y, 'TOTAL UNIDAD', 'F2', 7.5, [1, 1, 1]);
  drawText(348, y, 'DIVIDENDO BRUTO', 'F2', 7.5, [1, 1, 1]);
  drawText(435, y, 'COMISION AGENCIA', 'F2', 7.5, [1, 1, 1]);
  drawText(518, y, 'NETO UNIDAD', 'F2', 7.5, [1, 1, 1]);
  y -= 18;

  if (doc.lines.length === 0) {
    drawText(
      42,
      y,
      'Sin recaudos registrados en este periodo contable.',
      'F1',
      8,
      [0.4, 0.4, 0.45]
    );
    y -= 16;
  } else {
    for (const line of doc.lines) {
      const label = `[${line.property_code}] ${line.property_title}`.slice(
        0,
        36
      );
      drawText(42, y, label, 'F1', 8);
      drawText(
        230,
        y,
        `${line.owner_share_pct}%`,
        line.owner_share_pct < 100 ? 'F2' : 'F1',
        8
      );
      drawText(272, y, formatCop(line.property_gross_collected_cop), 'F3', 8);
      drawText(348, y, formatCop(line.gross_collected_cop), 'F2', 8);
      drawText(
        435,
        y,
        `-${formatCop(line.percentage_fee_cop)} (${line.commission_pct}%)`,
        'F3',
        8
      );
      drawText(518, y, formatCop(line.net_unit_cop), 'F2', 8);

      const agreedCop = line.agreed_rent_cop ?? line.property_gross_collected_cop;
      const remCop = line.remaining_balance_cop ?? 0;
      const isPartial = Boolean(line.is_partial_payment || remCop > 0);
      if (isPartial || (line.abonos_breakdown && line.abonos_breakdown.length > 0)) {
        y -= 11;
        const statusBadge = isPartial
          ? `[ABONO PARCIAL - Pactado: ${formatCop(agreedCop)} | Saldo Pendiente: ${formatCop(remCop)}]`
          : `[PAGO COMPLETO 100% - Pactado: ${formatCop(agreedCop)}]`;
        drawText(50, y, statusBadge, 'F2', 7, [0.25, 0.3, 0.38]);
        if (line.abonos_breakdown && line.abonos_breakdown.length > 0) {
          for (let idx = 0; idx < line.abonos_breakdown.length; idx++) {
            const ab = line.abonos_breakdown[idx];
            const moraTag = ab.is_mora_payment
              ? ` [RECAUDO SALDO EN MORA ${ab.origin_period_month}]`
              : ab.origin_period_month
                ? ` [${ab.origin_period_month}]`
                : '';
            const descTag = ab.payment_description
              ? ` | Desc: ${ab.payment_description}`
              : '';
            y -= 10;
            drawText(
              58,
              y,
              `-> Abono #${idx + 1} (${ab.payment_date})${moraTag} [${ab.payment_method}]${descTag}: ${formatCop(ab.owner_dividend_cop)}`,
              'F3',
              7,
              [0.32, 0.35, 0.42]
            );
          }
        }
      }

      drawLine(36, y - 4, 576, y - 4);
      y -= 15;
    }
  }

  if (doc.handoverNotes && doc.handoverNotes.length > 0) {
    y -= 4;
    drawText(
      42,
      y,
      `NOTAS DE LIQUIDACION POR ENTREGA DE INMUEBLE (${doc.periodMonth}):`,
      'F2',
      7.5,
      [0.72, 0.45, 0.05]
    );
    y -= 11;
    for (const note of doc.handoverNotes) {
      drawText(
        50,
        y,
        `* ${note.note_text}`,
        'F3',
        6.8,
        [0.45, 0.28, 0.05]
      );
      y -= 10;
    }
  }

  if (doc.activeMoraBalances && doc.activeMoraBalances.length > 0) {
    y -= 4;
    drawText(
      42,
      y,
      `SALDOS EN MORA ACTIVOS REPORTADOS EN PERIODO DE LIQUIDACION ACTUAL (${doc.periodMonth}):`,
      'F2',
      7.5,
      [0.75, 0.1, 0.35]
    );
    y -= 11;
    for (const mb of doc.activeMoraBalances) {
      drawText(
        50,
        y,
        `* [${mb.property.code}] ${mb.property.title} - ${mb.tenantName} (Origen Mora: ${mb.periodMonth}) | Pactado: ${formatCop(mb.agreedRentCop)} | Abonado: ${formatCop(mb.alreadyCollectedCop)} | Saldo en Mora: ${formatCop(mb.remainingBalanceCop)}`,
        'F3',
        7,
        [0.65, 0.12, 0.32]
      );
      y -= 10;
    }
  }

  y -= 10;

  // Section 2: Maintenance Deductions (1:1 Net)
  drawText(
    36,
    y,
    '2. DESGLOSE DE MANTENIMIENTOS DEDUCIDOS (1:1 COSTO NETO SIN RECARGO)',
    'F2',
    9.5,
    [0.06, 0.08, 0.12]
  );
  y -= 18;

  drawRect(36, y - 4, 540, 18, [0.12, 0.14, 0.18]);
  drawText(42, y, 'FACTURA / FECHA', 'F2', 7.5, [1, 1, 1]);
  drawText(140, y, 'INMUEBLE / CATEGORIA', 'F2', 7.5, [1, 1, 1]);
  drawText(300, y, 'PROVEEDOR / DESCRIPCION', 'F2', 7.5, [1, 1, 1]);
  drawText(455, y, 'COSTO 100%', 'F2', 7.5, [1, 1, 1]);
  drawText(515, y, 'DEDUCCION', 'F2', 7.5, [1, 1, 1]);
  y -= 18;

  if (doc.maintenances.length === 0) {
    drawText(
      42,
      y,
      'Sin deducciones de mantenimiento aplicadas en este periodo ($0 COP).',
      'F1',
      8,
      [0.4, 0.4, 0.45]
    );
    y -= 16;
  } else {
    for (const m of doc.maintenances) {
      drawText(42, y, `${m.invoice_number} (${m.execution_date})`, 'F2', 7.5);
      drawText(
        140,
        y,
        `[${m.property_code}] ${m.category}`.slice(0, 28),
        'F1',
        7.5
      );
      drawText(
        300,
        y,
        `${m.technician_name} - ${m.description}`.slice(0, 30),
        'F1',
        7.5
      );
      drawText(455, y, formatCop(m.total_net_cost_cop), 'F3', 7.5);
      drawText(
        515,
        y,
        `-${formatCop(m.prorated_deduction_cop)} (${m.owner_share_pct}%)`,
        'F2',
        7.5
      );
      drawLine(36, y - 4, 576, y - 4);
      y -= 15;
    }
  }

  y -= 14;

  // Section 3: Final Financial Summary Box
  const summaryTop = Math.max(y - 115, 70);
  drawRect(36, summaryTop, 540, 115, [0.95, 0.97, 0.99], [0.1, 0.55, 0.65]);

  let sy = summaryTop + 96;
  drawText(
    48,
    sy,
    '3. LIQUIDACION FINANCIERA FINAL DEL PERIODO (SIN CUOTA FIJA)',
    'F2',
    9.5,
    [0.05, 0.08, 0.12]
  );
  sy -= 18;

  drawText(48, sy, '(+) Ingreso Bruto Recaudado (Propietario):', 'F1', 9);
  drawText(460, sy, formatCop(doc.grossIncomeCop), 'F2', 9);
  sy -= 15;

  drawText(48, sy, '(-) Comision Porcentual Agencia Inmobiliaria:', 'F1', 9);
  drawText(460, sy, `-${formatCop(doc.commissionAmountCop)}`, 'F2', 9);
  sy -= 15;

  drawText(48, sy, '(-) Mantenimientos Descontados (1:1 Neto):', 'F1', 9);
  drawText(460, sy, `-${formatCop(doc.maintenanceDeductionCop)}`, 'F2', 9);
  sy -= 18;

  drawLine(48, sy + 10, 560, sy + 10, [0.2, 0.25, 0.3], 1.0);
  drawText(
    48,
    sy - 2,
    '(=) NETO FINAL A TRANSFERIR AL PROPIETARIO:',
    'F2',
    10.5,
    [0.02, 0.45, 0.2]
  );
  drawText(450, sy - 2, formatCop(doc.netPayableCop), 'F2', 11, [
    0.02,
    0.45,
    0.2,
  ]);
  sy -= 16;

  drawText(
    48,
    sy - 2,
    `SON: ${doc.netPayableWords.toUpperCase()} M/CTE`,
    'F2',
    8,
    [0.25, 0.28, 0.32]
  );

  // Cryptographic Integrity Seal Footer
  drawText(
    36,
    summaryTop - 16,
    `SELLO INTEGRIDAD SHA-256: ${doc.sha256Seal}`,
    'F3',
    7.5,
    [0.35, 0.38, 0.42]
  );

  const streamContent = ops.join('\n');

  const objects: string[] = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R /F3 6 0 R >> >> /Contents 7 0 R >>\nendobj\n',
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n',
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n',
    '6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>\nendobj\n',
    `7 0 obj\n<< /Length ${streamContent.length} >>\nstream\n${streamContent}\nendstream\nendobj\n`,
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(pdf.length);
    pdf += obj;
  }

  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i <= objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return pdf;
}

/**
 * Triggers a browser download of the generated `.pdf` settlement invoice and returns the filename.
 */
export function downloadSettlementInvoicePdf(
  doc: SettlementInvoiceDocument
): string {
  const safeOwnerSlug = doc.owner.name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '');

  const filename = `Factura_Liquidacion_${safeOwnerSlug}_${doc.periodMonth}.pdf`;
  const pdfContent = generateSettlementPdfContent(doc);

  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    try {
      const bytes = new Uint8Array(pdfContent.length);
      for (let i = 0; i < pdfContent.length; i++) {
        bytes[i] = pdfContent.charCodeAt(i) & 0xff;
      }
      const blob = new Blob([bytes], { type: 'application/pdf' });
      if (
        typeof URL !== 'undefined' &&
        typeof URL.createObjectURL === 'function'
      ) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch {
      // Safe fallback in headless test environments (jsdom)
    }
  }

  return filename;
}
