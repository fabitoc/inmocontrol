import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../App';
import {
  calculateAgencyParticipation,
  calculateOwnerSettlementPreview,
  calculatePropertyCommission,
  inmoRepository,
} from '../services/inmoService';

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
    // % Commission: $120,000 + $280,000 = $400,000
    expect(preview.commissionAmountCop).toBe(400_000);
    // Fixed Fees: $45,000 + $60,000 = $105,000
    expect(preview.fixedFeeAmountCop).toBe(105_000);
    // 1:1 Maintenance ('Por Liquidar'): FAC-8821 ($285,000) + FE-4092 ($340,000) = $625,000
    // (FAC-7710 is already 'Liquidado' and excluded)
    expect(preview.maintenanceDeductionCop).toBe(625_000);
    // Net Payable: 4,300,000 - 505,000 - 625,000 = 3,170,000
    expect(preview.netPayableCop).toBe(3_170_000);
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

    const pctSlider = screen.getByLabelText('Comisión Porcentual de Agencia');
    expect(pctSlider).toHaveAttribute('aria-valuemin', '4');
    expect(pctSlider).toHaveAttribute('aria-valuemax', '15');
    expect(pctSlider).toHaveAttribute('aria-valuenow', '8');

    const fixedSlider = screen.getByLabelText(
      'Cuota Fija Base en Pesos Colombianos'
    );
    expect(fixedSlider).toHaveAttribute('aria-valuemin', '0');
    expect(fixedSlider).toHaveAttribute('aria-valuemax', '100000');
    expect(fixedSlider).toHaveAttribute('aria-valuenow', '45000');

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

    // Verify net payable before settlement: $3.170.000
    expect(screen.getByTestId('settlement-net-payable')).toHaveTextContent(
      '$3.170.000'
    );

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
});
