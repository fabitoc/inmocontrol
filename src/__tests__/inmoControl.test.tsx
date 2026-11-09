import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../App';
import {
  calculateAgencyParticipation,
  calculateOwnerSettlementPreview,
  calculatePropertyCommission,
  formatCopInWords,
  getCurrentPeriodMonth,
  getOwnerSharePct,
  inmoRepository,
} from '../services/inmoService';
import {
  buildInvoiceFromHistoricalSettlement,
  buildInvoiceFromPreview,
  generateSettlementPdfContent,
} from '../services/pdfInvoiceService';

describe('InmoControl 2.0 Core Domain & 5-Module HUD Suite', () => {
  beforeEach(() => {
    inmoRepository.resetToSeed();
  });

  it('strictly computes mixed commission: (Gross Income * Commission %) + Base Fixed Fee', () => {
    // 1,500,000 * 8% = 120,000 + 45,000 = 165,000
    const res1 = calculatePropertyCommission(1_500_000, 8.0, 45_000);
    expect(res1.percentageFeeCop).toBe(120_000);
    expect(res1.fixedFeeCop).toBe(45_000);
    expect(res1.totalCommissionCop).toBe(165_000);

    // 2,800,000 * 10% = 280,000 + 60,000 = 340,000
    const res2 = calculatePropertyCommission(2_800_000, 10.0, 60_000);
    expect(res2.percentageFeeCop).toBe(280_000);
    expect(res2.fixedFeeCop).toBe(60_000);
    expect(res2.totalCommissionCop).toBe(340_000);
  });

  it('deducts Por Liquidar maintenance expenses 1:1 at net cost without markup in monthly settlement preview', () => {
    const bundle = inmoRepository.getOwnerDashboardBundle(1);
    const preview = calculateOwnerSettlementPreview(
      1,
      bundle.properties,
      bundle.payments,
      bundle.maintenances,
      '2026-10'
    );

    // Paid in 2026-10 for Owner 1: Prop 2 ($1,500,000) + Prop 4 ($2,800,000) = $4,300,000
    expect(preview.grossIncomeCop).toBe(4_300_000);
    // % Commission: $120,000 + $280,000 = $400,000 (Strictly percentage-based, $0 fixed fee)
    expect(preview.commissionAmountCop).toBe(400_000);
    expect(preview.fixedFeeAmountCop).toBe(0);
    // 1:1 Maintenance ('Por Liquidar'): FAC-8821 ($285,000) + FE-4092 ($340,000) = $625,000
    // (FAC-7710 is already 'Liquidado' and excluded)
    expect(preview.maintenanceDeductionCop).toBe(625_000);
    // Net Payable: 4,300,000 - 400,000 - 625,000 = 3,275,000
    expect(preview.netPayableCop).toBe(3_275_000);
  });

  it('updates radial agency participation and KPIs in <300ms when switching Global Master Owner Selector', () => {
    render(<App />);

    // Initial Owner 1: Fabián Vargas Correa (4 of 7 rentable units = 57.1%)
    expect(screen.getByTestId('radial-participation-pct')).toHaveTextContent(
      '57.1%'
    );
    const bundle1 = inmoRepository.getOwnerDashboardBundle(1);
    expect(bundle1.query_time_ms).toBeLessThan(300);

    // Switch Global Master Owner Selector to Owner 2: Inversiones Delta S.A.S (2 of 7 rentable units = 28.6%)
    const selector = screen.getByTestId('global-owner-selector');
    fireEvent.change(selector, { target: { value: '2' } });

    expect(screen.getByTestId('radial-participation-pct')).toHaveTextContent(
      '28.6%'
    );
    expect(screen.getByTestId('kpi-expected-collection')).toHaveTextContent(
      '$6.800.000'
    );

    const part3 = calculateAgencyParticipation(
      3,
      inmoRepository.getAllProperties()
    );
    expect(part3.participationByCountPct).toBe(14.3);
  });

  it('exposes WCAG 2.1 AA ARIA attributes on Module 2 range sliders and Module 4 accordion tree + executes transactional handover', () => {
    render(<App />);

    // Navigate to Module 2 (Registro y Control)
    fireEvent.click(screen.getByTestId('nav-registro-control'));
    expect(screen.getByTestId('module-registro-control')).toBeInTheDocument();

    // Verify all 3 isolated registration tabs exist in Module 2 and Tab 01 (Propietario) is active by default
    const tabPropietario = screen.getByTestId('tab-propietario');
    const tabInmueble = screen.getByTestId('tab-inmueble');
    const tabInquilino = screen.getByTestId('tab-inquilino');
    expect(screen.queryByTestId('tab-recaudo')).not.toBeInTheDocument();

    expect(tabPropietario).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('panel-propietario')).toBeInTheDocument();
    expect(screen.queryByTestId('panel-inmueble')).not.toBeInTheDocument();

    // Cutoff / Settlement Day is selected exclusively in Tab 01 (Propietario)
    const cutoffSelect = screen.getByLabelText('Fecha de Corte Mensual');
    expect(cutoffSelect).toHaveValue('5');
    fireEvent.change(cutoffSelect, { target: { value: '15' } });
    expect(cutoffSelect).toHaveValue('15');
    expect(screen.getByTestId('cutoff-day-display')).toHaveTextContent(
      'Día 15 de cada mes'
    );

    // Switch to Tab 02 (Inmueble) to inspect WCAG 2.1 AA range sliders
    fireEvent.click(tabInmueble);
    expect(tabInmueble).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('panel-inmueble')).toBeInTheDocument();
    expect(screen.queryByTestId('panel-propietario')).not.toBeInTheDocument();

    const pctSlider = screen.getByLabelText('Comisión Porcentual de Agencia');
    expect(pctSlider).toHaveAttribute('aria-valuemin', '4');
    expect(pctSlider).toHaveAttribute('aria-valuemax', '15');
    expect(pctSlider).toHaveAttribute('aria-valuenow', '8');

    expect(
      screen.queryByLabelText('Cuota Fija Base en Pesos Colombianos')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText('Fecha de Corte Mensual')
    ).not.toBeInTheDocument();

    // Switch to Tab 03 (Inquilino) to verify isolated view
    fireEvent.click(tabInquilino);
    expect(screen.getByTestId('panel-inquilino')).toBeInTheDocument();
    expect(screen.queryByTestId('panel-inmueble')).not.toBeInTheDocument();

    // Navigate to Module 4 (Administración y Alertas)
    fireEvent.click(screen.getByTestId('nav-administracion-alertas'));
    expect(
      screen.getByTestId('module-administracion-alertas')
    ).toBeInTheDocument();

    // Verify ARIA role="tree" and accordion sub-unit connectors
    const tree = screen.getByRole('tree', {
      name: /Directorio Jerárquico de Inmuebles/i,
    });
    expect(tree).toBeInTheDocument();
    expect(screen.getByText('Torre 1 - Apto 101')).toBeInTheDocument();

    // Property 2 (Torre 1 - Apto 101) starts as [OCUPADO]
    expect(screen.getByTestId('property-status-badge-2')).toHaveTextContent(
      '[OCUPADO]'
    );

    // Execute transactional handover button <<<<< EJECUTAR ENTREGA DE INQUILINO DE INMUEBLE >>>>>
    const handoverSelect = screen.getByTestId('handover-property-select');
    fireEvent.change(handoverSelect, { target: { value: '2' } });
    fireEvent.click(screen.getByTestId('hazard-handover-button'));

    // Property 2 must atomically transition to [DISPONIBLE]
    expect(screen.getByTestId('property-status-badge-2')).toHaveTextContent(
      '[DISPONIBLE]'
    );
  });

  it('isolates each form in Module 2 (Registro y Control) into its own dedicated tab panel', () => {
    render(<App />);

    fireEvent.click(screen.getByTestId('nav-registro-control'));

    const tablist = screen.getByRole('tablist', {
      name: /Sub-vistas de Registro y Control/i,
    });
    expect(tablist).toBeInTheDocument();

    // Default tab: Propietario
    expect(screen.getByTestId('panel-propietario')).toBeInTheDocument();
    expect(screen.queryByTestId('panel-inmueble')).not.toBeInTheDocument();
    expect(screen.queryByTestId('panel-inquilino')).not.toBeInTheDocument();
    expect(screen.queryByTestId('panel-recaudo')).not.toBeInTheDocument();

    // Switch to Inmueble
    fireEvent.click(screen.getByTestId('tab-inmueble'));
    expect(screen.queryByTestId('panel-propietario')).not.toBeInTheDocument();
    expect(screen.getByTestId('panel-inmueble')).toBeInTheDocument();
    expect(screen.getByTestId('live-commission-preview')).toBeInTheDocument();
    expect(screen.queryByTestId('panel-inquilino')).not.toBeInTheDocument();
    expect(screen.queryByTestId('panel-recaudo')).not.toBeInTheDocument();

    // Switch to Inquilino
    fireEvent.click(screen.getByTestId('tab-inquilino'));
    expect(screen.queryByTestId('panel-propietario')).not.toBeInTheDocument();
    expect(screen.queryByTestId('panel-inmueble')).not.toBeInTheDocument();
    expect(screen.getByTestId('panel-inquilino')).toBeInTheDocument();
    expect(screen.queryByTestId('panel-recaudo')).not.toBeInTheDocument();

    // Return to Dashboard and open 04 // Registro de Recaudo Mensual modal via [ PAGAR ] button
    fireEvent.click(screen.getByTestId('nav-dashboard-analitico'));
    fireEvent.click(screen.getByTestId('dashboard-pay-button-2'));
    expect(screen.getByTestId('payment-modal-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('panel-recaudo')).toBeInTheDocument();
    expect(screen.getByTestId('modal-recent-payments')).toBeInTheDocument();
  });

  it('registers a property with subdivisions, supports per-division commission override without fixed fee, and expands/collapses subdivisions in summary', () => {
    render(<App />);

    fireEvent.click(screen.getByTestId('nav-registro-control'));
    fireEvent.click(screen.getByTestId('tab-inmueble'));

    // Switch to PROPIEDAD CON SUBDIVISIONES mode
    fireEvent.click(screen.getByTestId('mode-with-subdivisions'));
    expect(screen.getByTestId('subdivisions-builder')).toBeInTheDocument();

    // 2 default subdivisions of $1,500,000 each = $3,000,000 gross
    // Commission at 8% (no fixed fee) = $120,000 * 2 = $240,000 (deducted, not added to gross)
    expect(screen.getByTestId('subdivisions-gross-income')).toHaveTextContent(
      '$3.000.000'
    );
    expect(screen.getByTestId('live-commission-preview')).toHaveTextContent(
      '$240.000'
    );
    expect(screen.getByTestId('subdivisions-net-income')).toHaveTextContent(
      '$2.760.000'
    );

    // Enable custom commission on division #1 and change to 10%
    fireEvent.click(screen.getByTestId('subdivision-custom-comm-toggle-0'));
    expect(
      screen.getByTestId('subdivision-custom-comm-panel-0')
    ).toBeInTheDocument();

    const pctInput = screen.getByLabelText('Comisión Porcentual División 1');
    fireEvent.change(pctInput, { target: { value: '10' } });

    // Division #1: $1,500,000 * 10% = $150,000
    // Division #2 (inherited 8%): $120,000 -> Total Commission = $270,000, Net = $2,730,000
    expect(screen.getByTestId('live-commission-preview')).toHaveTextContent(
      '$270.000'
    );
    expect(screen.getByTestId('subdivisions-net-income')).toHaveTextContent(
      '$2.730.000'
    );

    // Verify expand/collapse of parent property subdivisions in Resumen de Inmuebles del Propietario Activo
    const toggleBtn = screen.getByTestId('toggle-summary-subdivisions-1');
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'true');
    expect(
      screen.getByTestId('summary-subdivisions-list-1')
    ).toBeInTheDocument();

    fireEvent.click(toggleBtn);
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'false');
    expect(
      screen.queryByTestId('summary-subdivisions-list-1')
    ).not.toBeInTheDocument();

    fireEvent.click(toggleBtn);
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'true');
    expect(
      screen.getByTestId('summary-subdivisions-list-1')
    ).toBeInTheDocument();

    // Verify Owner Dropdown & Co-owners option
    const ownerSelect = screen.getByTestId('property-owner-select');
    expect(ownerSelect).toHaveValue('1');
    expect(screen.getByTestId('primary-owner-share-pct')).toHaveTextContent(
      '100%'
    );

    fireEvent.click(screen.getByTestId('toggle-co-owners'));
    expect(screen.getByTestId('co-owners-section')).toBeInTheDocument();
    expect(screen.getByTestId('primary-owner-share-pct')).toHaveTextContent(
      '50%'
    );

    // Submit the new property with 2 subdivisions and verify expand/collapse on the newly created parent (id 10)
    fireEvent.click(
      screen.getByRole('button', {
        name: /GUARDAR PROPIEDAD Y 2 SUBDIVISIONES EN SQLITE/i,
      })
    );

    const newPropToggle = screen.getByTestId('toggle-summary-subdivisions-10');
    expect(newPropToggle).toHaveAttribute('aria-expanded', 'true');
    expect(
      screen.getByTestId('summary-subdivisions-list-10')
    ).toBeInTheDocument();

    fireEvent.click(newPropToggle);
    expect(newPropToggle).toHaveAttribute('aria-expanded', 'false');
    expect(
      screen.queryByTestId('summary-subdivisions-list-10')
    ).not.toBeInTheDocument();

    fireEvent.click(newPropToggle);
    expect(newPropToggle).toHaveAttribute('aria-expanded', 'true');
    expect(
      screen.getByTestId('summary-subdivisions-list-10')
    ).toBeInTheDocument();
  });

  it('registers a maintenance expense in Module 3 and settles it transactionally in Module 5 ([ APROBAR // EJECUTAR ])', () => {
    render(<App />);

    // Navigate to Module 3 (Mantenimientos)
    fireEvent.click(screen.getByTestId('nav-mantenimientos'));
    expect(screen.getByTestId('module-mantenimientos')).toBeInTheDocument();

    // Verify existing 'Por Liquidar' maintenance FAC-8821 is shown
    expect(screen.getByTestId('maint-status-FAC-8821')).toHaveTextContent(
      'Por Liquidar'
    );

    // Navigate to Module 5 (Liquidaciones)
    fireEvent.click(screen.getByTestId('nav-liquidaciones'));
    expect(screen.getByTestId('module-liquidaciones')).toBeInTheDocument();

    // Verify net payable before settlement: $3.275.000 ($4.300.000 - $400.000 commission - $625.000 maintenance)
    expect(screen.getByTestId('settlement-net-payable')).toHaveTextContent(
      '$3.275.000'
    );
    expect(
      screen.queryByTestId('settlement-fixed-fee')
    ).not.toBeInTheDocument();

    // Click transactional [ APROBAR // EJECUTAR ]
    fireEvent.click(screen.getByTestId('approve-settlement-button'));
    expect(screen.getByTestId('settlement-feedback')).toHaveTextContent(
      /BEGIN TRANSACTION \.\.\. COMMIT completado/i
    );

    // After settlement, pending maintenance deduction drops to $0
    expect(
      screen.getByTestId('settlement-maintenance-deduction')
    ).toHaveTextContent('-$0');

    // Return to Module 3 and verify FAC-8821 is now 'Liquidado'
    fireEvent.click(screen.getByTestId('nav-mantenimientos'));
    expect(screen.getByTestId('maint-status-FAC-8821')).toHaveTextContent(
      'Liquidado'
    );
  });

  it('converts currency amounts into Spanish words underneath every COP input field (e.g. 2000 -> Dos mil pesos)', () => {
    expect(formatCopInWords(0)).toBe('Cero pesos');
    expect(formatCopInWords(1)).toBe('Un peso');
    expect(formatCopInWords(2000)).toBe('Dos mil pesos');
    expect(formatCopInWords(180_000)).toBe('Ciento ochenta mil pesos');
    expect(formatCopInWords(1_500_000)).toBe(
      'Un millón quinientos mil pesos'
    );
    expect(formatCopInWords(2_850_000)).toBe(
      'Dos millones ochocientos cincuenta mil pesos'
    );

    render(<App />);

    // Navigate to Module 2 -> Tab 02 (Inmueble)
    fireEvent.click(screen.getByTestId('nav-registro-control'));
    fireEvent.click(screen.getByTestId('tab-inmueble'));

    const baseRentInput = screen.getByTestId('input-base-rent-cop');
    expect(screen.getByTestId('base-rent-words')).toHaveTextContent(
      '$1.600.000 — Un millón seiscientos mil pesos'
    );

    fireEvent.change(baseRentInput, { target: { value: '2000' } });
    expect(screen.getByTestId('base-rent-words')).toHaveTextContent(
      '$2.000 — Dos mil pesos'
    );

    // Tab 03 (Inquilino)
    fireEvent.click(screen.getByTestId('tab-inquilino'));
    const contractRentInput = screen.getByTestId('input-contract-rent-cop');
    fireEvent.change(contractRentInput, { target: { value: '2000' } });
    expect(screen.getByTestId('contract-rent-words')).toHaveTextContent(
      '$2.000 — Dos mil pesos'
    );

    // Dashboard [ PAGAR ] Modal -> 04 // Registro de Recaudo Mensual
    fireEvent.click(screen.getByTestId('nav-dashboard-analitico'));
    fireEvent.click(screen.getByTestId('dashboard-pay-button-2'));
    const paymentAmountInput = screen.getByTestId('input-payment-amount-cop');
    fireEvent.change(paymentAmountInput, { target: { value: '2000' } });
    expect(screen.getByTestId('payment-amount-words')).toHaveTextContent(
      '$2.000 — Dos mil pesos'
    );
    fireEvent.click(screen.getByTestId('close-payment-modal-button'));

    // Module 3 (Mantenimientos)
    fireEvent.click(screen.getByTestId('nav-mantenimientos'));
    const netCostInput = screen.getByTestId('input-net-cost-cop');
    expect(screen.getByTestId('net-cost-words')).toHaveTextContent(
      'Ciento ochenta mil pesos'
    );
    fireEvent.change(netCostInput, { target: { value: '2000' } });
    expect(screen.getByTestId('net-cost-words')).toHaveTextContent(
      '$2.000 — Dos mil pesos'
    );
  });

  it('prorates 50/50 co-ownership rent collection, commission, maintenance, and settlement preview across two co-owners', () => {
    const baseOwner1 = inmoRepository.getOwnerDashboardBundle(1);
    const baseOwner2 = inmoRepository.getOwnerDashboardBundle(2);

    const coOwnedProp = inmoRepository.createProperty({
      owner_id: 1,
      co_owners: [
        { owner_id: 1, share_pct: 50 },
        { owner_id: 2, share_pct: 50 },
      ],
      parent_property_id: null,
      code: 'COP-5050-01',
      title: 'Local Copropiedad 50/50',
      address: 'Calle 10 # 20-30',
      property_type: 'LOCAL COMERCIAL',
      base_rent_cop: 2_000_000,
      commission_pct: 10.0,
      fixed_fee_cop: 0,
      cutoff_day: 5,
      status: 'DISPONIBLE',
    });

    expect(getOwnerSharePct(coOwnedProp, 1)).toBe(50);
    expect(getOwnerSharePct(coOwnedProp, 2)).toBe(50);
    expect(getOwnerSharePct(coOwnedProp, 3)).toBe(0);

    const contract = inmoRepository.createTenantContract({
      property_id: coOwnedProp.id,
      tenant_name: 'Comercializadora 5050 S.A.S',
      tenant_document: 'NIT 901.505.050-1',
      guarantor_name: 'Fianza Comercial',
      phone: '+57 310 505 0505',
      monthly_rent_cop: 2_000_000,
      start_date: '2026-10-01',
      end_date: '2027-09-30',
      cutoff_day: 5,
      status: 'ACTIVO',
    });

    inmoRepository.recordRentPayment({
      contract_id: contract.id,
      property_id: coOwnedProp.id,
      period_month: '2026-10',
      gross_amount_cop: 2_000_000,
      payment_date: '2026-10-05',
      payment_method: 'TRANSFERENCIA PSE',
      reference_code: 'PSE-5050-OCT',
      status: 'PAGADO',
    });

    const afterOwner1 = inmoRepository.getOwnerDashboardBundle(1);
    const afterOwner2 = inmoRepository.getOwnerDashboardBundle(2);

    // Each co-owner receives +$1.000.000 (50% of $2.000.000) in collected_monthly_cop and expected_monthly_collection_cop
    expect(
      afterOwner1.collected_monthly_cop - baseOwner1.collected_monthly_cop
    ).toBe(1_000_000);
    expect(
      afterOwner2.collected_monthly_cop - baseOwner2.collected_monthly_cop
    ).toBe(1_000_000);
    expect(
      afterOwner1.expected_monthly_collection_cop -
        baseOwner1.expected_monthly_collection_cop
    ).toBe(1_000_000);
    expect(
      afterOwner2.expected_monthly_collection_cop -
        baseOwner2.expected_monthly_collection_cop
    ).toBe(1_000_000);

    const previewOwner1 = calculateOwnerSettlementPreview(
      1,
      [coOwnedProp],
      afterOwner1.payments,
      [],
      '2026-10'
    );
    const previewOwner2 = calculateOwnerSettlementPreview(
      2,
      [coOwnedProp],
      afterOwner2.payments,
      [],
      '2026-10'
    );

    expect(previewOwner1.grossIncomeCop).toBe(1_000_000);
    expect(previewOwner1.commissionAmountCop).toBe(100_000);
    expect(previewOwner1.netPayableCop).toBe(900_000);
    expect(previewOwner1.lines[0].ownerSharePct).toBe(50);
    expect(previewOwner1.lines[0].propertyGrossCollectedCop).toBe(2_000_000);
    expect(previewOwner1.lines[0].grossCollectedCop).toBe(1_000_000);

    expect(previewOwner2.grossIncomeCop).toBe(1_000_000);
    expect(previewOwner2.commissionAmountCop).toBe(100_000);
    expect(previewOwner2.netPayableCop).toBe(900_000);
    expect(previewOwner2.lines[0].ownerSharePct).toBe(50);
    expect(previewOwner2.lines[0].propertyGrossCollectedCop).toBe(2_000_000);
    expect(previewOwner2.lines[0].grossCollectedCop).toBe(1_000_000);
  });

  it('generates PDF settlement invoices with full financial breakdown and navigates to past settlements history view', () => {
    const bundle = inmoRepository.getOwnerDashboardBundle(1);
    const preview = calculateOwnerSettlementPreview(
      1,
      bundle.properties,
      bundle.payments,
      bundle.maintenances,
      '2026-10'
    );

    const activeDoc = buildInvoiceFromPreview(bundle, preview);
    expect(activeDoc.lines).toHaveLength(2);
    expect(activeDoc.maintenances).toHaveLength(2);
    expect(activeDoc.grossIncomeCop).toBe(4_300_000);
    expect(activeDoc.commissionAmountCop).toBe(400_000);
    expect(activeDoc.maintenanceDeductionCop).toBe(625_000);
    expect(activeDoc.netPayableCop).toBe(3_275_000);

    const pdfBinary = generateSettlementPdfContent(activeDoc);
    expect(pdfBinary.startsWith('%PDF-1.4')).toBe(true);
    expect(pdfBinary).toContain('SUB-FACA-101');
    expect(pdfBinary).toContain('SUB-FACA-LOC1');
    expect(pdfBinary).toContain('FAC-8821');
    expect(pdfBinary).toContain('$3.275.000');

    // Historical settlement invoice
    const histDoc = buildInvoiceFromHistoricalSettlement(
      bundle,
      bundle.settlements[0]
    );
    expect(histDoc.periodMonth).toBe('2026-09');
    expect(histDoc.netPayableCop).toBe(3_480_000);

    render(<App />);
    fireEvent.click(screen.getByTestId('nav-liquidaciones'));

    // Click [ FACTURA PDF ] in active settlement view
    fireEvent.click(screen.getByTestId('download-active-pdf-button'));
    expect(screen.getByTestId('pdf-invoice-feedback')).toHaveTextContent(
      /Factura_Liquidacion_Fabian_Vargas_Correa_2026-10\.pdf/i
    );

    // Switch to Historial de Liquidaciones view
    const historyBtn = screen.getByTestId('toggle-settlement-history-btn');
    expect(historyBtn).toHaveTextContent(/HISTORIAL DE LIQUIDACIONES \(2\)/i);
    fireEvent.click(historyBtn);

    expect(screen.getByTestId('settlement-history-view')).toBeInTheDocument();
    expect(screen.getByTestId('history-row-2026-09')).toBeInTheDocument();
    expect(screen.getByTestId('history-row-2026-08')).toBeInTheDocument();
    expect(
      screen.getByTestId('historical-settlement-detail')
    ).toHaveTextContent('FAC-LIQ-2026-09-001');

    // Download historical PDF from history table
    fireEvent.click(screen.getByTestId('download-history-pdf-1'));
    expect(screen.getByTestId('pdf-invoice-feedback')).toHaveTextContent(
      /Factura_Liquidacion_Fabian_Vargas_Correa_2026-09\.pdf/i
    );
  });

  it('opens 04 // Registro de Recaudo Mensual from Dashboard [ PAGAR ] button, restricts payment methods to EFECTIVO and TRANSACCIÓN without bank reference, keeps [ PAGAR ] enabled across partial abonos, and disables it once AL DÍA', () => {
    const currentMonth = getCurrentPeriodMonth();
    render(<App />);

    // Verify occupancy badges ([OCUPADO] / [DISPONIBLE]) are rendered in ACTIVO / JERARQUÍA and ESTADO shows [MOROSO] / [AL DÍA]
    expect(screen.getByTestId('dashboard-occupancy-badge-2')).toHaveTextContent(
      '[OCUPADO]'
    );
    expect(screen.getByTestId('dashboard-occupancy-badge-3')).toHaveTextContent(
      '[DISPONIBLE]'
    );
    expect(screen.getByTestId('dashboard-tenant-status-2')).toHaveTextContent(
      '[MOROSO]'
    );
    expect(screen.getByTestId('dashboard-pay-button-2')).not.toBeDisabled();
    expect(screen.getByTestId('dashboard-pay-button-3')).toBeDisabled();

    // 1. Click [ PAGAR ] on Property 2 in Dashboard to open the modal window
    fireEvent.click(screen.getByTestId('dashboard-pay-button-2'));
    expect(screen.getByTestId('payment-modal-dialog')).toBeInTheDocument();

    const periodSelect = screen.getByTestId(
      'select-payment-period'
    ) as HTMLSelectElement;
    expect(periodSelect).toHaveValue(currentMonth);
    expect(document.activeElement).toBe(periodSelect);

    // Verify Medio de Pago has ONLY EFECTIVO and TRANSACCIÓN, and no Referencia Bancaria input exists
    const methodSelect = screen.getByTestId(
      'select-payment-method'
    ) as HTMLSelectElement;
    const methodOptions = Array.from(methodSelect.options).map((o) => o.value);
    expect(methodOptions).toEqual(['EFECTIVO', 'TRANSACCIÓN']);
    expect(
      screen.queryByLabelText(/Referencia Bancaria/i)
    ).not.toBeInTheDocument();

    // 2. Verify initial selected property (Prop 2: $1.500.000) brings agreed rent, and switching to Prop 4 brings $2.800.000
    const amountInput = screen.getByTestId(
      'input-payment-amount-cop'
    ) as HTMLInputElement;
    expect(amountInput).toHaveValue(1_500_000);

    const propSelect = screen.getByTestId('select-payment-property');
    fireEvent.change(propSelect, { target: { value: '4' } });
    expect(amountInput).toHaveValue(2_800_000);
    expect(screen.getByTestId('payment-agreed-rent-cop')).toHaveTextContent(
      '$2.800.000'
    );

    // 3. Make a partial payment (abono) of $1.000.000 for currentMonth on Prop 4 ($2.800.000 agreed)
    fireEvent.change(methodSelect, { target: { value: 'EFECTIVO' } });
    fireEvent.change(amountInput, { target: { value: '1000000' } });
    fireEvent.click(
      screen.getByRole('button', { name: /REGISTRAR ABONO EN LIBRO MAYOR/i })
    );

    expect(
      screen.getByTestId('payment-already-collected-cop')
    ).toHaveTextContent('$1.000.000');
    expect(
      screen.getByTestId('payment-remaining-balance-cop')
    ).toHaveTextContent('$1.800.000');
    expect(amountInput).toHaveValue(1_800_000);
    // [ PAGAR ] on Prop 4 remains enabled because $1.800.000 is still owed
    expect(screen.getByTestId('dashboard-pay-button-4')).not.toBeDisabled();
    expect(screen.getByTestId('dashboard-tenant-status-4')).toHaveTextContent(
      '[MOROSO]'
    );

    // 4. Attempt a second payment of $2.000.000 (which exceeds the $1.800.000 remaining balance) -> MUST BE BLOCKED
    fireEvent.change(amountInput, { target: { value: '2000000' } });
    fireEvent.click(
      screen.getByRole('button', { name: /REGISTRAR ABONO EN LIBRO MAYOR/i })
    );

    expect(screen.getByTestId('payment-error-feedback')).toHaveTextContent(
      /Operación bloqueada: El abono de \$2\.000\.000 supera el saldo pendiente/i
    );
    expect(
      screen.getByTestId('payment-already-collected-cop')
    ).toHaveTextContent('$1.000.000');

    // 5. Pay the remaining $1.800.000 on Prop 4 -> Prop 4 transitions to [AL DÍA] and [ PAGAR ] disables
    fireEvent.change(amountInput, { target: { value: '1800000' } });
    fireEvent.click(
      screen.getByRole('button', { name: /REGISTRAR ABONO EN LIBRO MAYOR/i })
    );
    expect(screen.getByTestId('dashboard-tenant-status-4')).toHaveTextContent(
      '[AL DÍA]'
    );
    expect(screen.getByTestId('dashboard-pay-button-4')).toBeDisabled();

    fireEvent.click(screen.getByTestId('close-payment-modal-button'));

    // 6. Navigate to Module 5 (Liquidaciones) and verify current month (e.g. 2026-11) is present and selected with $2.800.000
    fireEvent.click(screen.getByTestId('nav-liquidaciones'));
    const settlementPeriodSelect = screen.getByTestId(
      'select-settlement-period'
    ) as HTMLSelectElement;
    expect(settlementPeriodSelect).toHaveValue(currentMonth);
    expect(screen.getByTestId('settlement-gross-income')).toHaveTextContent(
      '$2.800.000'
    );
  });

  it('requires and records a full rent payment or partial advance (abono) during tenant registration in 03 // Vinculación de Inquilino, and blocks duplicate settlement approvals while routing subsequent movements to the next cutoff period', () => {
    render(<App />);

    fireEvent.click(screen.getByTestId('nav-registro-control'));
    fireEvent.click(screen.getByTestId('tab-inquilino'));

    // Select available Property 3 (Torre 1 - Apto 102, Canon $1.450.000)
    const propSelect = screen.getByTestId('select-contract-property');
    fireEvent.change(propSelect, { target: { value: '3' } });

    expect(screen.getByTestId('input-contract-rent-cop')).toHaveValue(
      1_450_000
    );
    expect(
      screen.getByTestId('input-contract-initial-payment-cop')
    ).toHaveValue(1_450_000);
    expect(
      screen.getByTestId('contract-initial-remaining-cop')
    ).toHaveTextContent('$0');

    // Switch to ABONO PARCIAL DE ALQUILER mode and enter $650.000
    fireEvent.click(screen.getByTestId('contract-payment-mode-abono'));
    const initPayInput = screen.getByTestId(
      'input-contract-initial-payment-cop'
    );
    fireEvent.change(initPayInput, { target: { value: '650000' } });

    expect(
      screen.getByTestId('contract-initial-received-cop')
    ).toHaveTextContent('$650.000');
    expect(
      screen.getByTestId('contract-initial-remaining-cop')
    ).toHaveTextContent('$800.000');

    // Fill tenant details and submit
    fireEvent.change(screen.getByTestId('input-tenant-name'), {
      target: { value: 'Laura Méndez' },
    });
    fireEvent.change(screen.getByTestId('input-tenant-document'), {
      target: { value: 'CC 1.090.331.220' },
    });

    fireEvent.click(screen.getByTestId('submit-contract-button'));
    expect(screen.getByTestId('contract-success-feedback')).toHaveTextContent(
      /Abono Inicial \(\$650\.000 · Saldo pendiente.*\$800\.000\)/i
    );

    // Return to Dashboard and open [ PAGAR ] modal for Property 3 to verify $650.000 collected and $800.000 remaining
    fireEvent.click(screen.getByTestId('nav-dashboard-analitico'));
    expect(screen.getByTestId('dashboard-pay-button-3')).not.toBeDisabled();
    fireEvent.click(screen.getByTestId('dashboard-pay-button-3'));

    expect(
      screen.getByTestId('payment-already-collected-cop')
    ).toHaveTextContent('$650.000');
    expect(
      screen.getByTestId('payment-remaining-balance-cop')
    ).toHaveTextContent('$800.000');
    expect(screen.getByTestId('input-payment-amount-cop')).toHaveValue(800_000);

    // Verify that in 04 // Registro de Recaudo Mensual modal, months prior to registration and future months cannot be selected
    const recaudoPeriodSelect = screen.getByTestId(
      'select-payment-period'
    ) as HTMLSelectElement;
    const optionValues = Array.from(recaudoPeriodSelect.options).map(
      (opt) => opt.value
    );
    expect(optionValues).toEqual([getCurrentPeriodMonth()]);
    expect(screen.getByTestId('payment-cutoff-cycle-info')).toHaveTextContent(
      /Registro Inquilino:.*Corte:.*Día 5.*Próximo.*se activa el/i
    );
    fireEvent.click(screen.getByTestId('close-payment-modal-button'));

    // Also verify repository blocks charging any period prior to tenant registration or future period
    expect(() =>
      inmoRepository.recordRentPayment({
        contract_id: 0,
        property_id: 3,
        period_month: '2026-09',
        gross_amount_cop: 100_000,
        payment_date: '2026-11-04',
        payment_method: 'TRANSACCIÓN',
        status: 'PAGADO',
      })
    ).toThrow(/No se pueden cobrar meses anteriores/i);

    expect(() =>
      inmoRepository.recordRentPayment({
        contract_id: 0,
        property_id: 3,
        period_month: '2099-12',
        gross_amount_cop: 100_000,
        payment_date: '2026-11-04',
        payment_method: 'TRANSACCIÓN',
        status: 'PAGADO',
      })
    ).toThrow(/aún no ha llegado/i);

    // Navigate to Module 5 (Liquidaciones) and verify the abono appears in Desglose de Recaudos with its partial badge and Abono #1 detail
    fireEvent.click(screen.getByTestId('nav-liquidaciones'));
    expect(screen.getByTestId('settlement-line-row-3')).toBeInTheDocument();
    expect(
      screen.getByTestId('settlement-line-abono-badge-3')
    ).toHaveTextContent(/ABONO PARCIAL · SALDO PENDIENTE: \$800\.000/i);
    expect(
      screen.getByTestId('settlement-line-abonos-list-3')
    ).toHaveTextContent(/Abono #1/i);
    expect(
      screen.getByTestId('settlement-line-abonos-list-3')
    ).toHaveTextContent('$650.000');

    // Approve the settlement for current month and verify the button locks to prevent duplicate historical records
    const approveBtn = screen.getByTestId('approve-settlement-button');
    expect(approveBtn).not.toBeDisabled();
    fireEvent.click(approveBtn);
    expect(approveBtn).toBeDisabled();
    expect(approveBtn).toHaveTextContent(/LIQUIDACIÓN YA APROBADA/i);
    expect(() =>
      inmoRepository.executeMonthlySettlement(1, getCurrentPeriodMonth())
    ).toThrow(/ya fue aprobada y registrada en el historial/i);
  });

  it('filters only owed balances in Historial Reciente de Recaudos Anteriores to choose which debt to pay, and places overdue mora balances in the current settlement period and PDF rather than the past mora month', () => {
    const currentMonth = getCurrentPeriodMonth();
    render(<App />);

    // Open [ PAGAR ] modal on Property 5 (Bodega Logística Sabana, which owes 2026-10 in MORA and currentMonth)
    fireEvent.click(screen.getByTestId('dashboard-pay-button-5'));
    expect(screen.getByTestId('payment-modal-dialog')).toBeInTheDocument();

    // Verify Historial Reciente de Recaudos Anteriores ONLY shows the owed balances for Property 5 (2026-10 and currentMonth)
    expect(screen.getByTestId(`owed-balance-card-${currentMonth}`)).toBeInTheDocument();
    expect(screen.getByTestId('owed-balance-card-2026-10')).toBeInTheDocument();

    // Click [ ESCOGER ESTE SALDO A PAGAR ] on the overdue 2026-10 balance
    fireEvent.click(screen.getByTestId('select-owed-balance-2026-10'));
    expect(screen.getByTestId('select-payment-period')).toHaveValue('2026-10');
    expect(screen.getByTestId('input-payment-amount-cop')).toHaveValue(4_200_000);

    // Pay a partial abono of $2.000.000 toward the 2026-10 mora balance
    fireEvent.change(screen.getByTestId('input-payment-amount-cop'), {
      target: { value: '2000000' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: /REGISTRAR ABONO EN LIBRO MAYOR/i })
    );

    // Verify 2026-10 still shows the remaining $2.200.000 owed in Historial Reciente de Recaudos Anteriores
    expect(screen.getByTestId('owed-balance-card-2026-10')).toHaveTextContent(
      '$2.200.000'
    );

    // Pay the remaining $2.200.000 of 2026-10 -> 2026-10 is now $0 owed and disappears from Historial Reciente de Recaudos Anteriores!
    fireEvent.click(
      screen.getByRole('button', { name: /REGISTRAR ABONO EN LIBRO MAYOR/i })
    );
    expect(
      screen.queryByTestId('owed-balance-card-2026-10')
    ).not.toBeInTheDocument();
    expect(
      screen.getByTestId(`owed-balance-card-${currentMonth}`)
    ).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('close-payment-modal-button'));

    // Verify that the 2026-10 mora payment does NOT appear in the 2026-10 settlement period, but DOES appear in the current settlement period and its PDF!
    const bundle = inmoRepository.getOwnerDashboardBundle(1);
    const previewOct = calculateOwnerSettlementPreview(
      1,
      bundle.properties,
      bundle.payments,
      bundle.maintenances,
      '2026-10',
      bundle.contracts,
      bundle.settlements
    );
    // October settlement stays at $4.300.000 (Prop 2 + Prop 4) and has 0 activeMoraBalances
    expect(previewOct.grossIncomeCop).toBe(4_300_000);
    expect(previewOct.activeMoraBalances).toHaveLength(0);

    const previewCurr = calculateOwnerSettlementPreview(
      1,
      bundle.properties,
      bundle.payments,
      bundle.maintenances,
      currentMonth,
      bundle.contracts,
      bundle.settlements
    );
    expect(previewCurr.grossIncomeCop).toBe(4_200_000);
    expect(previewCurr.lines[0].moraPeriodMonths).toEqual(['2026-10']);

    const currPdf = generateSettlementPdfContent(
      buildInvoiceFromPreview(bundle, previewCurr)
    );
    expect(currPdf).toContain('RECAUDO SALDO EN MORA 2026-10');
    expect(currPdf).toContain(
      `SALDOS EN MORA ACTIVOS REPORTADOS EN PERIODO DE LIQUIDACION ACTUAL \\(${currentMonth}\\)`
    );
  });
});
