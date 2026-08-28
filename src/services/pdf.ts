import { OwnerSettlement, PaymentReceiptData } from '../types';

export interface AgencyBranding {
  nombre: string;
  nit: string;
  telefono: string;
  email: string;
  direccion: string;
}

export const DEFAULT_AGENCY_BRANDING: AgencyBranding = {
  nombre: 'Aide Silva Mateus - SilvaCooperativa',
  nit: '',
  telefono: '',
  email: '',
  direccion: '',
};

export function getStoredAgencyBranding(): AgencyBranding {
  try {
    localStorage.removeItem('inmoadmin_agency_branding');
    const raw = localStorage.getItem('inmocontrol_agency_branding');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.nombre && parsed.nombre !== 'INMOADMIN CONTROL INMOBILIARIO') {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Failed to parse agency branding from localStorage:', err);
  }
  return DEFAULT_AGENCY_BRANDING;
}

export function saveAgencyBranding(branding: AgencyBranding): void {
  localStorage.setItem('inmocontrol_agency_branding', JSON.stringify(branding));
}

export function generateOwnerSettlementPDF(
  settlement: OwnerSettlement,
  customAgency?: AgencyBranding
): void {
  const agency = customAgency || getStoredAgencyBranding();

  const formatCOP = (val: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const currentDateStr = new Date().toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const hasMaintenances = settlement.maintenances && settlement.maintenances.length > 0;

  const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Liquidación Arrendador - ${settlement.owner.nombre}</title>
  <style>
    @page {
      size: letter;
      margin: 14mm;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #1e293b;
      background-color: #ffffff;
      margin: 0;
      padding: 0;
      font-size: 11px;
      line-height: 1.4;
    }
    .header-table {
      width: 100%;
      border-collapse: collapse;
      border-bottom: 2px solid #d97706;
      padding-bottom: 10px;
      margin-bottom: 16px;
    }
    .agency-name {
      font-size: 18px;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.5px;
      text-transform: uppercase;
    }
    .agency-sub {
      color: #64748b;
      font-size: 10px;
      margin-top: 2px;
    }
    .statement-title-box {
      text-align: right;
    }
    .statement-title {
      font-size: 15px;
      font-weight: 800;
      color: #d97706;
      text-transform: uppercase;
    }
    .statement-period {
      font-size: 11px;
      font-weight: 600;
      color: #475569;
    }
    .owner-card {
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px 14px;
      margin-bottom: 16px;
    }
    .owner-grid {
      display: table;
      width: 100%;
    }
    .owner-row {
      display: table-row;
    }
    .owner-cell {
      display: table-cell;
      padding: 3px 6px;
      width: 50%;
    }
    .label {
      font-size: 9px;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
    }
    .value {
      font-size: 11px;
      font-weight: 600;
      color: #0f172a;
    }
    .section-title {
      font-size: 12px;
      font-weight: 700;
      color: #0f172a;
      margin-top: 14px;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-left: 3px solid #d97706;
      padding-left: 8px;
    }
    .txn-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
    }
    .txn-table th {
      background-color: #0f172a;
      color: #f8fafc;
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      padding: 6px 8px;
      text-align: left;
    }
    .txn-table td {
      padding: 6px 8px;
      border-bottom: 1px solid #e2e8f0;
      font-size: 10px;
    }
    .txn-table tr:nth-child(even) td {
      background-color: #f8fafc;
    }
    .badge-ingreso {
      color: #166534;
      font-weight: 700;
    }
    .badge-gasto {
      color: #991b1b;
      font-weight: 700;
    }
    .summary-table {
      float: right;
      width: 340px;
      border: 2px solid #0f172a;
      border-radius: 6px;
      overflow: hidden;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
    .summary-table td {
      padding: 6px 10px;
      font-size: 11px;
    }
    .summary-row-income {
      color: #166534;
    }
    .summary-row-expense {
      color: #991b1b;
    }
    .summary-row-net {
      background-color: #0f172a;
      color: #ffffff;
      font-weight: 800;
      font-size: 13px !important;
    }
    .net-amount {
      color: #fbbf24;
      font-size: 14px;
    }
    .page-break {
      page-break-before: always;
    }
    .maintenance-card {
      background-color: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 10px;
      margin-bottom: 12px;
    }
    .maintenance-meta {
      display: flex;
      justify-content: space-between;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 6px;
      margin-bottom: 8px;
      font-size: 10px;
    }
    .photo-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 8px;
    }
    .photo-item {
      width: 140px;
      height: 105px;
      object-fit: cover;
      border-radius: 4px;
      border: 1px solid #94a3b8;
    }
    .signatures-block {
      margin-top: 30px;
      width: 100%;
    }
    .sig-cell {
      width: 45%;
      text-align: center;
      vertical-align: bottom;
    }
    .sig-line {
      border-top: 1px solid #94a3b8;
      margin-bottom: 4px;
    }
    .footer-text {
      margin-top: 24px;
      text-align: center;
      font-size: 8px;
      color: #94a3b8;
      border-top: 1px solid #e2e8f0;
      padding-top: 6px;
    }
  </style>
</head>
<body>
  <!-- HEADER BRANDING -->
  <table class="header-table">
    <tr>
      <td>
        <div class="agency-name">${agency.nombre}</div>
        ${agency.nit || agency.telefono ? `<div class="agency-sub">${agency.nit ? `NIT: ${agency.nit}` : ''}${agency.nit && agency.telefono ? ' | ' : ''}${agency.telefono ? `Tel: ${agency.telefono}` : ''}</div>` : ''}
        ${agency.direccion || agency.email ? `<div class="agency-sub">${agency.direccion || ''}${agency.direccion && agency.email ? ' | ' : ''}${agency.email || ''}</div>` : ''}
      </td>
      <td class="statement-title-box">
        <div class="statement-title">LIQUIDACIÓN DE ARRENDADOR</div>
        <div class="statement-period">Período: ${settlement.dateFrom} a ${settlement.dateTo}</div>
        <div class="agency-sub">Generado: ${currentDateStr}</div>
      </td>
    </tr>
  </table>

  <!-- OWNER IDENTIFICATION CARD -->
  <div class="owner-card">
    <div class="owner-grid">
      <div class="owner-row">
        <div class="owner-cell">
          <span class="label">Propietario / Arrendador:</span><br/>
          <span class="value">${settlement.owner.nombre}</span>
        </div>
        <div class="owner-cell">
          <span class="label">Cédula / NIT:</span><br/>
          <span class="value">${settlement.owner.cedula_nit}</span>
        </div>
      </div>
      <div class="owner-row">
        <div class="owner-cell" style="padding-top: 6px;">
          <span class="label">Teléfono / Email:</span><br/>
          <span class="value">${settlement.owner.telefono || 'N/A'} | ${settlement.owner.email || 'N/A'}</span>
        </div>
        <div class="owner-cell" style="padding-top: 6px;">
          <span class="label">Cuenta / Corte Liquidación:</span><br/>
          <span class="value" style="color: #b45309;">${settlement.owner.cuenta_bancaria || 'No especificada'} (Día ${settlement.owner.dia_corte_liquidacion ?? 10})</span>
        </div>
      </div>
    </div>
  </div>

  <!-- ITEMIZATION TABLE -->
  <div class="section-title">Desglose Detallado de Transacciones y Gastos Deducibles</div>
  <table class="txn-table">
    <thead>
      <tr>
        <th>Fecha</th>
        <th>Propiedad / Inmueble</th>
        <th>Tipo</th>
        <th>Categoría</th>
        <th>Concepto</th>
        <th style="text-align: right;">Monto COP</th>
      </tr>
    </thead>
    <tbody>
      ${
        settlement.transactions.length === 0
          ? `<tr><td colspan="6" style="text-align:center; color:#64748b;">No hay transacciones registradas en este período.</td></tr>`
          : settlement.transactions
              .map(
                (tx) => `
          <tr>
            <td>${tx.fecha}</td>
            <td><b>${tx.propiedad_direccion || 'N/A'}</b></td>
            <td>
              <span class="${tx.tipo === 'Ingreso' ? 'badge-ingreso' : 'badge-gasto'}">
                ${tx.tipo.toUpperCase()}
              </span>
            </td>
            <td>${tx.categoria}</td>
            <td>${tx.concepto}</td>
            <td style="text-align: right; font-weight: 700;" class="${tx.tipo === 'Ingreso' ? 'badge-ingreso' : 'badge-gasto'}">
              ${tx.tipo === 'Ingreso' ? '+' : '-'}${formatCOP(tx.monto)}
            </td>
          </tr>
        `
              )
              .join('')
      }
    </tbody>
  </table>

  <!-- FINANCIAL SUMMARY TOTALS -->
  <div style="width: 100%; margin-top: 10px;">
    <table class="summary-table">
      <tr class="summary-row-income">
        <td><b>(+) Total Ingresos Recaudados:</b></td>
        <td style="text-align: right; font-weight: 700;">${formatCOP(settlement.totalIncome)}</td>
      </tr>
      <tr class="summary-row-expense">
        <td><b>(-) Reparaciones y Gastos:</b></td>
        <td style="text-align: right; font-weight: 700;">${formatCOP(settlement.totalExpenses)}</td>
      </tr>
      ${
        (settlement.totalAdminFees || 0) > 0
          ? `
      <tr class="summary-row-expense">
        <td><b>(-) Cuotas de Administración:</b></td>
        <td style="text-align: right; font-weight: 700;">${formatCOP(settlement.totalAdminFees)}</td>
      </tr>
      `
          : ''
      }
      <tr class="summary-row-net">
        <td>SALDO NETO A ENTREGAR (100%):</td>
        <td style="text-align: right;" class="net-amount">${formatCOP(settlement.netPayable)}</td>
      </tr>
    </table>
    <div style="clear: both;"></div>
  </div>

  ${
    hasMaintenances
      ? `
    <!-- EVIDENCIAS Y REPORTES DE MANTENIMIENTO -->
    <div class="page-break"></div>
    <div class="section-title">Evidencias y Soportes de Mantenimiento / Arreglos del Período</div>
    <p style="font-size: 10px; color: #64748b; margin-top: -4px; margin-bottom: 12px;">
      Los siguientes arreglos fueron autorizados y ejecutados a cargo del propietario durante este ciclo de liquidación:
    </p>

    ${settlement.maintenances!
      .map(
        (m, idx) => `
      <div class="maintenance-card">
        <div class="maintenance-meta">
          <div>
            <b>#${idx + 1}. ${m.categoria}</b> - Inmueble: <b>${settlement.properties.find(p => p.id === m.propiedad_id)?.direccion || m.propiedad_id}</b>
          </div>
          <div>
            Fecha: <b>${m.fecha}</b> | Costo Deducido: <b style="color: #991b1b;">${formatCOP(m.costo)}</b>
          </div>
        </div>
        <p style="margin: 4px 0; font-size: 10px;"><b>Descripción del daño / trabajo:</b> ${m.descripcion}</p>
        ${m.tecnico_nombre ? `<p style="margin: 2px 0; font-size: 9px; color: #475569;"><b>Técnico / Proveedor:</b> ${m.tecnico_nombre} (${m.tecnico_contacto || 'Sin contacto'})</p>` : ''}
        
        ${
          m.evidencias_fotos && m.evidencias_fotos.length > 0
            ? `
            <div style="margin-top: 8px;">
              <span class="label">Fotografías del Arreglo (Antes / Después):</span>
              <div class="photo-grid">
                ${m.evidencias_fotos
                  .map(
                    (photo, pIdx) => `
                  <img src="${photo}" class="photo-item" alt="Evidencia ${pIdx + 1}" />
                `
                  )
                  .join('')}
              </div>
            </div>
          `
            : ''
        }

        ${
          m.evidencia_factura
            ? `
            <div style="margin-top: 8px;">
              <span class="label">Comprobante / Factura Adjunta:</span><br/>
              <img src="${m.evidencia_factura}" style="max-width: 260px; max-height: 180px; object-fit: contain; border-radius: 4px; border: 1px solid #94a3b8; margin-top: 4px;" alt="Factura" />
            </div>
          `
            : ''
        }
      </div>
    `
      )
      .join('')}
  `
      : ''
  }

  <!-- SIGNATURES BLOCK -->
  <table class="signatures-block">
    <tr>
      <td class="sig-cell">
        <div class="sig-line"></div>
        <b>${agency.nombre}</b><br/>
        <span style="font-size: 9px; color: #64748b;">Administración Inmobiliaria</span>
      </td>
      <td style="width: 10%;"></td>
      <td class="sig-cell">
        <div class="sig-line"></div>
        <b>${settlement.owner.nombre}</b><br/>
        <span style="font-size: 9px; color: #64748b;">C.C. / NIT: ${settlement.owner.cedula_nit}</span>
      </td>
    </tr>
  </table>

  <div class="footer-text">
    Documento oficial generado por el Sistema de Liquidación Inmobiliaria. Para consultas contables, contacte a la administración.
  </div>
</body>
</html>
  `;

  printHtml(htmlContent, `Liquidacion_${settlement.owner.nombre.replace(/\s+/g, '_')}_${settlement.dateTo}`);
}

export function generatePaymentReceiptPDF(
  data: PaymentReceiptData,
  customAgency?: AgencyBranding
): void {
  const agency = customAgency || getStoredAgencyBranding();

  const formatCOP = (val: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Recibo de Caja - ${data.receipt.id}</title>
  <style>
    @page {
      size: letter;
      margin: 14mm;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #1e293b;
      background-color: #ffffff;
      margin: 0;
      padding: 0;
      font-size: 11px;
      line-height: 1.4;
    }
    .receipt-box {
      border: 2px solid #0f172a;
      border-radius: 8px;
      padding: 16px;
    }
    .header-table {
      width: 100%;
      border-collapse: collapse;
      border-bottom: 2px solid #d97706;
      padding-bottom: 10px;
      margin-bottom: 14px;
    }
    .agency-name {
      font-size: 16px;
      font-weight: 800;
      color: #0f172a;
      text-transform: uppercase;
    }
    .agency-sub {
      color: #64748b;
      font-size: 10px;
    }
    .receipt-title {
      font-size: 16px;
      font-weight: 800;
      color: #d97706;
      text-align: right;
    }
    .receipt-number {
      font-size: 13px;
      font-weight: 700;
      color: #0f172a;
      text-align: right;
    }
    .info-grid {
      display: table;
      width: 100%;
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 8px 12px;
      margin-bottom: 14px;
    }
    .info-row {
      display: table-row;
    }
    .info-cell {
      display: table-cell;
      padding: 2px 4px;
      width: 50%;
    }
    .label {
      font-size: 9px;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
    }
    .value {
      font-size: 11px;
      font-weight: 600;
      color: #0f172a;
    }
    .details-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
    }
    .details-table th {
      background-color: #0f172a;
      color: #ffffff;
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      padding: 6px 8px;
      text-align: left;
    }
    .details-table td {
      padding: 8px;
      border-bottom: 1px solid #e2e8f0;
      font-size: 10px;
    }
    .total-banner {
      background-color: #0f172a;
      color: #ffffff;
      padding: 10px 14px;
      border-radius: 6px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
    }
    .total-title {
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
    }
    .total-amount {
      font-size: 20px;
      font-weight: 800;
      color: #fbbf24;
    }
    .signatures-block {
      margin-top: 40px;
      width: 100%;
    }
    .sig-cell {
      width: 45%;
      text-align: center;
      vertical-align: bottom;
    }
    .sig-line {
      border-top: 1px solid #94a3b8;
      margin-bottom: 4px;
    }
  </style>
</head>
<body>
  <div class="receipt-box">
    <!-- HEADER -->
    <table class="header-table">
      <tr>
        <td>
          <div class="agency-name">${agency.nombre}</div>
          ${agency.nit || agency.telefono ? `<div class="agency-sub">${agency.nit ? `NIT: ${agency.nit}` : ''}${agency.nit && agency.telefono ? ' | ' : ''}${agency.telefono ? `Tel: ${agency.telefono}` : ''}</div>` : ''}
          ${agency.direccion || agency.email ? `<div class="agency-sub">${agency.direccion || ''}${agency.direccion && agency.email ? ' | ' : ''}${agency.email || ''}</div>` : ''}
        </td>
        <td>
          <div class="receipt-title">RECIBO OFICIAL DE CAJA</div>
          <div class="receipt-number">N°: ${data.receipt.id}</div>
          <div class="agency-sub" style="text-align: right;">Fecha: ${data.receipt.fecha_pago}</div>
        </td>
      </tr>
    </table>

    <!-- INFO CARD -->
    <div class="info-grid">
      <div class="info-row">
        <div class="info-cell">
          <span class="label">Inmueble / Propiedad:</span><br/>
          <span class="value">${data.propiedad.direccion}</span>
        </div>
        <div class="info-cell">
          <span class="label">Tipo de Pago / Concepto:</span><br/>
          <span class="value" style="color: #d97706; font-weight: 700;">${data.receipt.tipo_recibo.toUpperCase()}</span>
        </div>
      </div>
      <div class="info-row">
        <div class="info-cell" style="padding-top: 8px;">
          <span class="label">Pagador / Arrendatario:</span><br/>
          <span class="value">${data.arrendatario ? data.arrendatario.nombre : 'Inquilino / Responsable'}</span>
          ${data.arrendatario ? `<div style="font-size: 10px; color: #64748b;">CC: ${data.arrendatario.cedula_nit}</div>` : ''}
        </div>
        <div class="info-cell" style="padding-top: 8px;">
          <span class="label">Método de Pago:</span><br/>
          <span class="value">${data.receipt.metodo_pago}</span>
          ${data.receipt.notas ? `<div style="font-size: 10px; color: #64748b;">${data.receipt.notas}</div>` : ''}
        </div>
      </div>
    </div>

    <!-- DETAILS TABLE -->
    <table class="details-table">
      <thead>
        <tr>
          <th>Concepto / Detalle del Pago</th>
          <th style="text-align: right; width: 140px;">Valor COP</th>
        </tr>
      </thead>
      <tbody>
        ${data.detalles
          .map(
            (d) => `
          <tr>
            <td><b>${d.concepto}</b></td>
            <td style="text-align: right; font-weight: 700;">${formatCOP(d.valor)}</td>
          </tr>
        `
          )
          .join('')}
      </tbody>
    </table>

    <!-- TOTAL BANNER -->
    <div class="total-banner">
      <span class="total-title">Total Pagado:</span>
      <span class="total-amount">${formatCOP(data.receipt.monto)}</span>
    </div>

    <!-- SIGNATURES BLOCK -->
    <table class="signatures-block">
      <tr>
        <td class="sig-cell">
          <div class="sig-line"></div>
          <b>${agency.nombre}</b><br/>
          <span style="font-size: 9px; color: #64748b;">Recibido Por (Firma Autorizada)</span>
        </td>
        <td style="width: 10%;"></td>
        <td class="sig-cell">
          <div class="sig-line"></div>
          <b>${data.arrendatario ? data.arrendatario.nombre : 'Pagador'}</b><br/>
          <span style="font-size: 9px; color: #64748b;">Entregado Por (Firma Pagador)</span>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>
  `;

  printHtml(htmlContent, `Recibo_${data.receipt.id}`);
}

function printHtml(html: string, title: string): void {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Por favor, permita las ventanas emergentes (pop-ups) en su navegador para imprimir o guardar como PDF.');
    return;
  }

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();

  printWindow.onload = () => {
    printWindow.document.title = title;
    printWindow.focus();
    printWindow.print();
  };
}
