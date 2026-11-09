import React, { useEffect, useState } from 'react';
import { OwnerDashboardBundle } from '../../types/domain';
import {
  buildWeeklyTelemetrySeries,
  calculateOwnerSettlementPreview,
  formatCop,
  formatCopInWords,
  formatPeriodMonthLabel,
  getAccountingPeriodOptions,
  getCurrentPeriodMonth,
  getNextPeriodMonth,
  getOwnerSharePct,
  resolveActiveSettlementPeriodForOwner,
} from '../../services/inmoService';
import {
  buildInvoiceFromHistoricalSettlement,
  buildInvoiceFromPreview,
  downloadSettlementInvoicePdf,
} from '../../services/pdfInvoiceService';

interface LiquidacionesViewProps {
  bundle: OwnerDashboardBundle;
  onExecuteSettlement: (ownerId: number, periodMonth: string) => void;
}

export const LiquidacionesView: React.FC<LiquidacionesViewProps> = ({
  bundle,
  onExecuteSettlement,
}) => {
  const currentSystemPeriod = getCurrentPeriodMonth();
  const availablePeriods = getAccountingPeriodOptions(
    bundle.payments,
    bundle.settlements,
    new Date(),
    bundle.maintenances
  );
  const resolveInitialPeriod = () =>
    resolveActiveSettlementPeriodForOwner(
      bundle.selected_owner.id,
      bundle.payments,
      bundle.maintenances,
      bundle.settlements
    );

  const [viewMode, setViewMode] = useState<'ACTIVA' | 'HISTORIAL'>('ACTIVA');
  const [periodMonth, setPeriodMonth] = useState<string>(resolveInitialPeriod);
  const [selectedReceiptPreview, setSelectedReceiptPreview] = useState<
    string | null
  >(null);
  const [settlementFeedback, setSettlementFeedback] = useState<string | null>(
    null
  );
  const [pdfFeedback, setPdfFeedback] = useState<string | null>(null);
  const [selectedHistorySettlementId, setSelectedHistorySettlementId] =
    useState<number | null>(bundle.settlements[0]?.id ?? null);

  useEffect(() => {
    setSelectedHistorySettlementId(bundle.settlements[0]?.id ?? null);
    setSettlementFeedback(null);
    setPdfFeedback(null);
    setPeriodMonth(resolveInitialPeriod());
  }, [
    bundle.selected_owner.id,
    bundle.payments.length,
    bundle.maintenances.length,
  ]);

  const isPeriodAlreadyApproved = bundle.settlements.some(
    (s) =>
      s.owner_id === bundle.selected_owner.id && s.period_month === periodMonth
  );
  const ownerCutoffDay =
    bundle.selected_owner.cutoff_day ??
    bundle.properties[0]?.cutoff_day ??
    5;
  const nextCutoffPeriod = getNextPeriodMonth(periodMonth);

  const preview = calculateOwnerSettlementPreview(
    bundle.selected_owner.id,
    bundle.properties,
    bundle.payments,
    bundle.maintenances,
    periodMonth,
    bundle.contracts,
    bundle.settlements
  );

  const weeklySeries = buildWeeklyTelemetrySeries(bundle);
  const maxChartValue = Math.max(
    ...weeklySeries.map((w) =>
      Math.max(w.grossIncomeCop, w.maintenanceCostCop)
    ),
    1_000_000
  );

  const activeReceiptPath =
    selectedReceiptPreview ??
    preview.pendingMaintenances[0]?.receipt_image_path ??
    bundle.maintenances[0]?.receipt_image_path ??
    'evidencias/sin_soporte_pendiente.jpg';

  const handleApproveSettlement = () => {
    if (isPeriodAlreadyApproved) {
      setSettlementFeedback(
        `Operación bloqueada: La liquidación del periodo ${periodMonth} ya fue aprobada previamente y consta en el Historial. Los nuevos movimientos se liquidan en el siguiente corte (${nextCutoffPeriod}).`
      );
      return;
    }
    onExecuteSettlement(bundle.selected_owner.id, periodMonth);
    setSettlementFeedback(
      `BEGIN TRANSACTION ... COMMIT completado: Liquidación ${periodMonth} sellada para ${bundle.selected_owner.name} por ${formatCop(preview.netPayableCop)}. Mantenimientos actualizados a [Liquidado] y registrada en Historial. Los movimientos posteriores pasan automáticamente al corte ${nextCutoffPeriod}.`
    );
  };

  const handleDownloadActivePdf = () => {
    const doc = buildInvoiceFromPreview(bundle, preview);
    const filename = downloadSettlementInvoicePdf(doc);
    setPdfFeedback(
      `Factura PDF generada con desglose financiero completo: ${filename}`
    );
  };

  const handleDownloadHistoryPdf = (settlementId: number) => {
    const target = bundle.settlements.find((s) => s.id === settlementId);
    if (!target) return;
    const doc = buildInvoiceFromHistoricalSettlement(bundle, target);
    const filename = downloadSettlementInvoicePdf(doc);
    setPdfFeedback(
      `Factura histórica PDF descargada (${target.period_month}): ${filename}`
    );
  };

  const selectedHistorySettlement =
    bundle.settlements.find((s) => s.id === selectedHistorySettlementId) ??
    bundle.settlements[0] ??
    null;

  const selectedHistoryDoc = selectedHistorySettlement
    ? buildInvoiceFromHistoricalSettlement(bundle, selectedHistorySettlement)
    : null;

  const historyTotals = bundle.settlements.reduce(
    (acc, s) => ({
      gross: acc.gross + s.gross_income_cop,
      comm: acc.comm + s.commission_amount_cop,
      maint: acc.maint + s.maintenance_deduction_cop,
      net: acc.net + s.net_payable_cop,
    }),
    { gross: 0, comm: 0, maint: 0, net: 0 }
  );

  return (
    <section
      aria-label="Módulo 5: Liquidaciones"
      className="space-y-6"
      data-testid="module-liquidaciones"
    >
      {/* Top Banner */}
      <div className="bg-[#0d0e12] border border-[#292a2e] p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="text-xs font-mono text-[#00eefc] uppercase tracking-widest">
            MÓDULO 05 // MOTOR DE LIQUIDACIONES, FACTURACIÓN PDF E HISTORIAL
          </div>
          <h2 className="text-xl font-bold text-white mt-1">
            Liquidaciones de Propietario — {bundle.selected_owner.name}
          </h2>
          <p className="text-xs font-mono text-[#9ca3af] mt-0.5">
            Cruce automático de recaudos por copropiedad menos comisión
            porcentual `(Bruto × %)` menos mantenimientos netos `1:1`.
          </p>
          <div
            className="mt-1.5 text-[11px] font-mono text-[#00eefc]"
            data-testid="automatic-cutoff-banner"
          >
            CIERRE AUTOMÁTICO DE SISTEMA: Corte Día {ownerCutoffDay} ·{' '}
            {isPeriodAlreadyApproved
              ? `Periodo ${periodMonth} APROBADO → Nuevos movimientos pasan al corte ${nextCutoffPeriod}`
              : `Capturando en tiempo real recaudos, abonos, comisiones y mantenimientos del periodo ${periodMonth}`}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 font-mono text-xs">
          {viewMode === 'ACTIVA' && (
            <label className="flex items-center gap-2 text-[#9ca3af]">
              <span>PERIODO CONTABLE:</span>
              <select
                aria-label="Periodo Contable de Liquidación"
                data-testid="select-settlement-period"
                value={periodMonth}
                onChange={(e) => setPeriodMonth(e.target.value)}
                className="bg-[#1a1b20] border border-[#00eefc]/50 px-3 py-1.5 text-white font-bold"
              >
                {availablePeriods.map((p) => (
                  <option key={p} value={p}>
                    {formatPeriodMonthLabel(p, currentSystemPeriod)}
                  </option>
                ))}
              </select>
            </label>
          )}

          <button
            type="button"
            data-testid="toggle-settlement-history-btn"
            onClick={() =>
              setViewMode((prev) =>
                prev === 'ACTIVA' ? 'HISTORIAL' : 'ACTIVA'
              )
            }
            className={`px-3.5 py-2 font-mono font-bold text-xs uppercase tracking-wider border transition-colors ${
              viewMode === 'HISTORIAL'
                ? 'bg-[#1a1b20] border-[#00eefc] text-[#00eefc]'
                : 'bg-[#ffb800]/15 border-[#ffb800] text-[#ffb800] hover:bg-[#ffb800]/25'
            }`}
          >
            {viewMode === 'ACTIVA'
              ? `[ HISTORIAL DE LIQUIDACIONES (${bundle.settlements.length}) ]`
              : '[ ← VOLVER A LIQUIDACIÓN ACTIVA ]'}
          </button>
        </div>
      </div>

      {pdfFeedback && (
        <div
          className="p-3 bg-[#00eefc]/10 border border-[#00eefc] text-xs font-mono text-[#00eefc] flex items-center justify-between"
          data-testid="pdf-invoice-feedback"
        >
          <span>{pdfFeedback}</span>
          <button
            type="button"
            onClick={() => setPdfFeedback(null)}
            className="text-[11px] underline ml-4"
          >
            CERRAR
          </button>
        </div>
      )}

      {viewMode === 'HISTORIAL' ? (
        <div
          className="space-y-6"
          data-testid="settlement-history-view"
          aria-label="Vista de Historial de Liquidaciones de Meses Pasados"
        >
          {/* Historical KPI Summary */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 font-mono">
            <div className="bg-[#0d0e12] border border-[#292a2e] p-4">
              <div className="text-[11px] text-[#9ca3af] uppercase">
                MESES LIQUIDADOS ({bundle.settlements.length})
              </div>
              <div className="text-lg font-bold text-white mt-1">
                {formatCop(historyTotals.gross)}
              </div>
              <div className="text-[11px] text-[#00eefc] mt-0.5">
                Ingreso Bruto Histórico
              </div>
            </div>

            <div className="bg-[#0d0e12] border border-[#292a2e] p-4">
              <div className="text-[11px] text-[#9ca3af] uppercase">
                COMISIÓN AGENCIA ACUMULADA
              </div>
              <div className="text-lg font-bold text-[#ffb800] mt-1">
                -{formatCop(historyTotals.comm)}
              </div>
              <div className="text-[11px] text-[#9ca3af] mt-0.5">
                Exclusivamente Porcentual (Sin Cuota Fija)
              </div>
            </div>

            <div className="bg-[#0d0e12] border border-[#292a2e] p-4">
              <div className="text-[11px] text-[#9ca3af] uppercase">
                MANTENIMIENTOS DEDUCIDOS (1:1)
              </div>
              <div className="text-lg font-bold text-[#ff007f] mt-1">
                -{formatCop(historyTotals.maint)}
              </div>
              <div className="text-[11px] text-[#9ca3af] mt-0.5">
                Deducción Neta de Facturas
              </div>
            </div>

            <div className="bg-[#0d0e12] border border-[#00FF66]/50 p-4">
              <div className="text-[11px] text-[#00FF66] uppercase">
                TOTAL NETO DISPERSADO
              </div>
              <div
                className="text-lg font-bold text-[#00FF66] mt-1"
                data-testid="history-total-net-dispersed"
              >
                {formatCop(historyTotals.net)}
              </div>
              <div className="text-[11px] text-[#9ca3af] mt-0.5">
                {bundle.selected_owner.bank_name} ·{' '}
                {bundle.selected_owner.bank_account_number}
              </div>
            </div>
          </div>

          {/* Historical Settlements Master Table */}
          <div className="bg-[#0d0e12] border border-[#292a2e] p-5 space-y-4">
            <div className="border-b border-[#292a2e] pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h3 className="text-sm font-mono font-bold uppercase tracking-wider text-white">
                  Historial de Liquidaciones de Meses Pasados —{' '}
                  {bundle.selected_owner.name}
                </h3>
                <p className="text-xs font-mono text-[#9ca3af]">
                  Registro inmutable de cierres mensuales ejecutados con factura
                  PDF y sello SHA-256
                </p>
              </div>
              <span className="text-xs font-mono text-[#00FF66]">
                {bundle.settlements.length} LIQUIDACIONES CERRADAS
              </span>
            </div>

            {bundle.settlements.length === 0 ? (
              <div className="p-6 bg-[#1a1b20] border border-[#292a2e] font-mono text-xs text-[#9ca3af]">
                No existen liquidaciones históricas registradas para este
                propietario.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table
                  role="table"
                  aria-label="Tabla de historial de liquidaciones pasadas"
                  className="w-full text-left border-collapse font-mono text-xs"
                >
                  <thead>
                    <tr className="border-b border-[#292a2e] text-[#9ca3af] bg-[#1a1b20]">
                      <th scope="col" className="py-2.5 px-3">
                        N° FACTURA
                      </th>
                      <th scope="col" className="py-2.5 px-3">
                        PERIODO
                      </th>
                      <th scope="col" className="py-2.5 px-3">
                        FECHA CIERRE
                      </th>
                      <th scope="col" className="py-2.5 px-3 text-right">
                        INGRESO BRUTO
                      </th>
                      <th scope="col" className="py-2.5 px-3 text-right">
                        COMISIÓN (%)
                      </th>
                      <th scope="col" className="py-2.5 px-3 text-right">
                        MANTENIMIENTOS
                      </th>
                      <th scope="col" className="py-2.5 px-3 text-right">
                        NETO TRANSFERIDO
                      </th>
                      <th scope="col" className="py-2.5 px-3 text-right">
                        ACCIONES
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#292a2e]/60">
                    {bundle.settlements.map((s) => {
                      const isSelected = selectedHistorySettlement?.id === s.id;
                      const invoiceCode = `FAC-LIQ-${s.period_month}-${String(s.id).padStart(3, '0')}`;
                      return (
                        <tr
                          key={s.id}
                          data-testid={`history-row-${s.period_month}`}
                          className={
                            isSelected ? 'bg-[#00eefc]/10' : 'hover:bg-[#1a1b20]/60'
                          }
                        >
                          <td className="py-2.5 px-3 text-[#00eefc] font-bold">
                            {invoiceCode}
                          </td>
                          <td className="py-2.5 px-3 text-white font-bold">
                            {s.period_month}
                          </td>
                          <td className="py-2.5 px-3 text-[#9ca3af]">
                            {s.created_at.slice(0, 10)}
                          </td>
                          <td className="py-2.5 px-3 text-right text-white">
                            {formatCop(s.gross_income_cop)}
                          </td>
                          <td className="py-2.5 px-3 text-right text-[#ffb800]">
                            -{formatCop(s.commission_amount_cop)}
                          </td>
                          <td className="py-2.5 px-3 text-right text-[#ff007f]">
                            -{formatCop(s.maintenance_deduction_cop)}
                          </td>
                          <td className="py-2.5 px-3 text-right text-[#00FF66] font-bold">
                            {formatCop(s.net_payable_cop)}
                          </td>
                          <td className="py-2.5 px-3 text-right space-x-2">
                            <button
                              type="button"
                              data-testid={`inspect-history-settlement-${s.id}`}
                              onClick={() =>
                                setSelectedHistorySettlementId(s.id)
                              }
                              className="px-2 py-1 border border-[#00eefc]/50 text-[#00eefc] hover:bg-[#00eefc]/15 text-[11px]"
                            >
                              [ VER DESGLOSE ]
                            </button>
                            <button
                              type="button"
                              data-testid={`download-history-pdf-${s.id}`}
                              onClick={() => handleDownloadHistoryPdf(s.id)}
                              className="px-2 py-1 bg-[#00eefc] text-[#0d0e12] font-bold hover:bg-[#00eefc]/90 text-[11px]"
                            >
                              [ FACTURA PDF ]
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Selected Historical Settlement Detailed Invoice Breakdown */}
          {selectedHistoryDoc && selectedHistorySettlement && (
            <div
              className="bg-[#0d0e12] border-2 border-[#00eefc]/60 p-5 space-y-5 font-mono"
              data-testid="historical-settlement-detail"
            >
              <div className="border-b border-[#292a2e] pb-3 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                <div>
                  <span className="text-[11px] text-[#00eefc] uppercase tracking-widest block">
                    DETALLE DE FACTURA HISTÓRICA // {selectedHistoryDoc.invoiceNumber}
                  </span>
                  <h4 className="text-base font-bold text-white mt-0.5">
                    Periodo Liquidado: {selectedHistoryDoc.periodMonth} —{' '}
                    {selectedHistoryDoc.owner.name}
                  </h4>
                  <p className="text-xs text-[#9ca3af]">
                    Cuenta Dispersión: {selectedHistoryDoc.owner.bank_name} (
                    {selectedHistoryDoc.owner.bank_account_type}) · N°{' '}
                    {selectedHistoryDoc.owner.bank_account_number}
                  </p>
                </div>

                <button
                  type="button"
                  data-testid="download-selected-history-pdf-btn"
                  onClick={() =>
                    handleDownloadHistoryPdf(selectedHistorySettlement.id)
                  }
                  className="px-4 py-2.5 bg-[#00eefc] text-[#0d0e12] font-bold text-xs uppercase tracking-wider hover:bg-[#00eefc]/90"
                >
                  [ DESCARGAR FACTURA PDF ({selectedHistoryDoc.periodMonth}) ]
                </button>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                <div className="xl:col-span-7 space-y-3">
                  <div className="text-xs font-bold text-white uppercase">
                    1. Unidades Liquidables en el Periodo ({selectedHistoryDoc.periodMonth})
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-[#292a2e] text-[#9ca3af] bg-[#1a1b20]">
                          <th className="py-2 px-2.5">INMUEBLE</th>
                          <th className="py-2 px-2.5 text-right">
                            RECAUDO BRUTO
                          </th>
                          <th className="py-2 px-2.5 text-right">
                            % COMISIÓN AGENCIA
                          </th>
                          <th className="py-2 px-2.5 text-right">
                            NETO UNIDAD
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#292a2e]/60">
                        {selectedHistoryDoc.lines.map((line) => {
                          const isPartial = Boolean(
                            line.is_partial_payment ||
                              (line.remaining_balance_cop ?? 0) > 0
                          );
                          return (
                            <tr key={line.property_id}>
                              <td className="py-2 px-2.5 text-white font-semibold">
                                <div>
                                  [{line.property_code}] {line.property_title}
                                </div>
                                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                  {line.owner_share_pct < 100 && (
                                    <span className="inline-block px-1.5 py-0.5 text-[10px] border border-[#ffb800]/50 text-[#ffb800]">
                                      COPROPIEDAD {line.owner_share_pct}%
                                    </span>
                                  )}
                                  <span
                                    className={`inline-block px-1.5 py-0.5 text-[10px] font-bold border ${
                                      isPartial
                                        ? 'border-[#ffb800] bg-[#ffb800]/15 text-[#ffb800]'
                                        : 'border-[#00FF66]/50 bg-[#00FF66]/10 text-[#00FF66]'
                                    }`}
                                  >
                                    {isPartial
                                      ? `[ABONO PARCIAL · SALDO PENDIENTE: ${formatCop(line.remaining_balance_cop ?? 0)}]`
                                      : '[PAGO COMPLETO 100%]'}
                                  </span>
                                </div>
                                {line.abonos_breakdown &&
                                  line.abonos_breakdown.length > 0 && (
                                    <div className="mt-1.5 space-y-1 pl-2 border-l border-[#00eefc]/40 text-[11px] font-normal text-[#9ca3af]">
                                      {line.abonos_breakdown.map((ab, idx) => (
                                        <div
                                          key={ab.id}
                                          className="flex items-center justify-between gap-2"
                                        >
                                          <span>
                                            ↳ Abono #{idx + 1} · REF:{' '}
                                            <strong className="text-white">
                                              {ab.reference_code}
                                            </strong>{' '}
                                            ({ab.payment_date})
                                          </span>
                                          <span className="text-[#00eefc] font-bold">
                                            {formatCop(ab.owner_dividend_cop)}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                              </td>
                              <td className="py-2 px-2.5 text-right text-[#00FF66] align-top">
                                {formatCop(line.gross_collected_cop)}
                              </td>
                              <td className="py-2 px-2.5 text-right text-[#ffb800] align-top">
                                -{formatCop(line.percentage_fee_cop)} (
                                {line.commission_pct}%)
                              </td>
                              <td className="py-2 px-2.5 text-right text-white font-bold align-top">
                                {formatCop(line.net_unit_cop)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="text-xs font-bold text-white uppercase pt-2">
                    2. Mantenimientos Deducidos en este Cierre (1:1 Neto)
                  </div>
                  {selectedHistoryDoc.maintenances.length === 0 ? (
                    <div className="p-3 bg-[#1a1b20] border border-[#292a2e] text-xs text-[#9ca3af]">
                      Sin deducciones de mantenimiento aplicadas en{' '}
                      {selectedHistoryDoc.periodMonth} ($0 COP).
                    </div>
                  ) : (
                    <div className="space-y-2 text-xs">
                      {selectedHistoryDoc.maintenances.map((m) => (
                        <div
                          key={m.id}
                          className="p-2.5 bg-[#1a1b20] border border-[#292a2e] flex items-center justify-between"
                        >
                          <div>
                            <div className="text-white font-bold">
                              {m.invoice_number} — {m.category} ([
                              {m.property_code}])
                            </div>
                            <div className="text-[11px] text-[#9ca3af]">
                              {m.description} · {m.execution_date}
                            </div>
                          </div>
                          <div className="text-right text-[#ff007f] font-bold">
                            -{formatCop(m.prorated_deduction_cop)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="xl:col-span-5 bg-[#121317] border border-[#292a2e] p-4 space-y-3 flex flex-col justify-between text-xs">
                  <div className="space-y-2.5">
                    <div className="text-xs font-bold text-[#00eefc] uppercase border-b border-[#292a2e] pb-2">
                      3. Resumen Financiero Sellado
                    </div>
                    <div className="flex justify-between py-1 border-b border-[#292a2e]/60">
                      <span className="text-[#9ca3af]">
                        (+) INGRESO BRUTO RECAUDADO:
                      </span>
                      <span className="text-white font-bold">
                        {formatCop(selectedHistoryDoc.grossIncomeCop)}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-[#292a2e]/60">
                      <span className="text-[#9ca3af]">
                        (-) COMISIÓN PORCENTUAL AGENCIA:
                      </span>
                      <span className="text-[#ffb800]">
                        -{formatCop(selectedHistoryDoc.commissionAmountCop)}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-[#292a2e]/60">
                      <span className="text-[#9ca3af]">
                        (-) MANTENIMIENTOS DEDUCIDOS (1:1):
                      </span>
                      <span className="text-[#ff007f] font-bold">
                        -{formatCop(selectedHistoryDoc.maintenanceDeductionCop)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-2">
                      <span className="text-sm font-bold text-[#00eefc]">
                        (=) NETO TRANSFERIDO:
                      </span>
                      <span className="text-lg font-bold text-[#00FF66]">
                        {formatCop(selectedHistoryDoc.netPayableCop)}
                      </span>
                    </div>
                    <div className="text-[11px] text-[#00eefc]">
                      SON: {selectedHistoryDoc.netPayableWords}
                    </div>
                  </div>

                  <div className="bg-[#1a1b20] border border-[#292a2e] p-2.5 text-[11px] text-[#9ca3af] truncate">
                    SELLO SHA-256: {selectedHistoryDoc.sha256Seal}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Telemetry & Data Viz SVG Chart + Visual Receipt Inspector */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            {/* Weekly Gross Income vs Maintenance Costs SVG Chart */}
            <div className="xl:col-span-7 bg-[#0d0e12] border border-[#292a2e] p-5 space-y-4">
              <div className="border-b border-[#292a2e] pb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-mono font-bold uppercase tracking-wider text-white">
                    Telemetría Semanal: Ingreso Bruto vs Costos de Mantenimiento
                  </h3>
                  <p className="text-xs font-mono text-[#9ca3af]">
                    Comparativa semanal con línea de tendencia de liquidez neta
                  </p>
                </div>
                <div className="flex items-center gap-3 text-[11px] font-mono">
                  <span className="text-[#00eefc]">■ Ingreso Bruto</span>
                  <span className="text-[#ffb800]">■ Mantenimiento (1:1)</span>
                  <span className="text-[#00FF66]">● Liquidez Neta</span>
                </div>
              </div>

              <div className="bg-[#121317] border border-[#292a2e] p-4">
                <svg
                  viewBox="0 0 520 180"
                  className="w-full h-44"
                  role="img"
                  aria-label="Gráfico comparativo de ingreso bruto semanal versus costos de mantenimiento y tendencia de liquidez neta"
                >
                  {/* Horizontal reference lines */}
                  {[35, 80, 125, 155].map((y, idx) => (
                    <line
                      key={idx}
                      x1="30"
                      y1={y}
                      x2="495"
                      y2={y}
                      stroke="#292a2e"
                      strokeDasharray="3 3"
                      strokeWidth="1"
                    />
                  ))}

                  {/* Bars per week */}
                  {weeklySeries.map((pt, idx) => {
                    const baseX = 65 + idx * 115;
                    const grossHeight = Math.max(
                      8,
                      Math.round((pt.grossIncomeCop / maxChartValue) * 115)
                    );
                    const maintHeight = Math.max(
                      4,
                      Math.round((pt.maintenanceCostCop / maxChartValue) * 115)
                    );
                    return (
                      <g key={pt.weekLabel}>
                        <rect
                          x={baseX}
                          y={155 - grossHeight}
                          width="26"
                          height={grossHeight}
                          fill="#00eefc"
                        />
                        <rect
                          x={baseX + 30}
                          y={155 - maintHeight}
                          width="26"
                          height={maintHeight}
                          fill="#ffb800"
                        />
                        <text
                          x={baseX + 28}
                          y="172"
                          textAnchor="middle"
                          fill="#9ca3af"
                          fontSize="10"
                          fontFamily="monospace"
                        >
                          {pt.weekLabel}
                        </text>
                      </g>
                    );
                  })}

                  {/* Net liquidity trendline */}
                  <polyline
                    fill="none"
                    stroke="#00FF66"
                    strokeWidth="2.5"
                    points={weeklySeries
                      .map((pt, idx) => {
                        const x = 93 + idx * 115;
                        const y =
                          155 -
                          Math.max(
                            10,
                            Math.round(
                              (pt.netLiquidityCop / maxChartValue) * 115
                            )
                          );
                        return `${x},${y}`;
                      })
                      .join(' ')}
                  />

                  {weeklySeries.map((pt, idx) => {
                    const x = 93 + idx * 115;
                    const y =
                      155 -
                      Math.max(
                        10,
                        Math.round((pt.netLiquidityCop / maxChartValue) * 115)
                      );
                    return (
                      <circle
                        key={`dot-${pt.weekLabel}`}
                        cx={x}
                        cy={y}
                        r="4"
                        fill="#00FF66"
                      />
                    );
                  })}
                </svg>
              </div>

              <div className="grid grid-cols-4 gap-2 font-mono text-xs">
                {weeklySeries.map((w) => (
                  <div
                    key={w.weekLabel}
                    className="bg-[#1a1b20] border border-[#292a2e] p-2.5"
                  >
                    <div className="text-[#9ca3af]">{w.weekLabel}</div>
                    <div className="text-white font-bold">
                      {formatCop(w.netLiquidityCop)}
                    </div>
                    <div className="text-[10px] text-[#00FF66]">
                      Liquidez Neta
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Visual Receipt Support & 1:1 Deduction Inspector */}
            <div className="xl:col-span-5 bg-[#0d0e12] border border-[#292a2e] p-5 space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="border-b border-[#292a2e] pb-3 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-mono font-bold uppercase tracking-wider text-white">
                      Soporte Visual de Facturas por Descontar
                    </h3>
                    <p className="text-xs font-mono text-[#9ca3af]">
                      Verificación local en `%LocalAppData%\InmoControl\evidencias\`
                    </p>
                  </div>
                  <span className="text-xs font-mono text-[#ffb800]">
                    {preview.pendingMaintenances.length} POR LIQUIDAR
                  </span>
                </div>

                {preview.pendingMaintenances.length > 0 ? (
                  <div className="space-y-2 font-mono text-xs">
                    {preview.pendingMaintenances.map((maint) => {
                      const maintProp = bundle.properties.find(
                        (p) => p.id === maint.property_id
                      );
                      const sharePct = maintProp
                        ? getOwnerSharePct(maintProp, bundle.selected_owner.id)
                        : 100;
                      const proratedMaintCop = Math.round(
                        maint.net_cost_cop * (sharePct / 100)
                      );
                      return (
                        <div
                          key={maint.id}
                          className="bg-[#1a1b20] border border-[#292a2e] p-3 flex items-center justify-between gap-2"
                        >
                          <div>
                            <div className="text-white font-bold">
                              {maint.invoice_number} — {maint.category}
                            </div>
                            <div className="text-[11px] text-[#9ca3af]">
                              {maint.description} · {maint.receipt_image_path}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-[#ffb800] font-bold">
                              -{formatCop(proratedMaintCop)}
                            </div>
                            {sharePct < 100 && (
                              <div className="text-[10px] text-[#9ca3af]">
                                ({sharePct}% de {formatCop(maint.net_cost_cop)})
                              </div>
                            )}
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedReceiptPreview(
                                  maint.receipt_image_path
                                )
                              }
                              className="text-[11px] text-[#00eefc] underline mt-0.5"
                            >
                              Inspeccionar Recibo
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-4 bg-[#1a1b20] border border-[#00FF66]/30 font-mono text-xs text-[#00FF66]">
                    No existen mantenimientos en estado [Por Liquidar] para este
                    propietario. Todos los descuentos están en $0 COP.
                  </div>
                )}
              </div>

              <div className="bg-[#121317] border border-[#292a2e] p-3 font-mono text-xs space-y-1">
                <div className="text-[#9ca3af] uppercase">
                  VISOR DE SOPORTE LOCAL SELECCIONADO:
                </div>
                <div
                  className="text-[#00eefc] font-bold truncate"
                  data-testid="active-receipt-preview-path"
                >
                  %LocalAppData%\InmoControl\{activeReceiptPath}
                </div>
                <div className="text-[11px] text-[#9ca3af]">
                  Deducción 1:1 verificada sin recargo operativo de agencia.
                </div>
              </div>
            </div>
          </div>

          {/* Closing Calculation & Final Statement Execution */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            {/* Detailed Property Commission Crossing Table (Percentage-Only) */}
            <div className="xl:col-span-7 bg-[#0d0e12] border border-[#292a2e] p-5 space-y-4">
              <div className="border-b border-[#292a2e] pb-3 flex items-center justify-between">
                <h3 className="text-sm font-mono font-bold uppercase tracking-wider text-white">
                  Desglose de Recaudos y Comisión por Unidad ({periodMonth})
                </h3>
                <span className="text-xs font-mono text-[#00eefc]">
                  COMISIÓN (BRUTO × %)
                </span>
              </div>

              <div className="overflow-x-auto">
                <table
                  role="table"
                  aria-label="Tabla de desglose de comisiones para liquidación"
                  className="w-full text-left border-collapse font-mono text-xs"
                >
                  <thead>
                    <tr className="border-b border-[#292a2e] text-[#9ca3af] bg-[#1a1b20]">
                      <th scope="col" className="py-2.5 px-3">
                        INMUEBLE
                      </th>
                      <th scope="col" className="py-2.5 px-3 text-right">
                        RECAUDO BRUTO
                      </th>
                      <th scope="col" className="py-2.5 px-3 text-right">
                        % COMISIÓN AGENCIA
                      </th>
                      <th scope="col" className="py-2.5 px-3 text-right">
                        NETO UNIDAD
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#292a2e]/60">
                    {preview.lines.length === 0 ? (
                      <tr>
                        <td
                          colSpan={4}
                          className="py-4 px-3 text-center text-[#9ca3af]"
                          data-testid="settlement-empty-period-row"
                        >
                          No existen recaudos ni abonos registrados en el
                          periodo {periodMonth} para este propietario.
                        </td>
                      </tr>
                    ) : (
                      preview.lines.map((line) => (
                        <tr
                          key={line.property.id}
                          data-testid={`settlement-line-row-${line.property.id}`}
                        >
                          <td className="py-2.5 px-3 text-white font-semibold align-top">
                            <div>
                              [{line.property.code}] {line.property.title}
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 mt-1">
                              {line.ownerSharePct < 100 && (
                                <span className="inline-block px-1.5 py-0.5 text-[10px] font-bold border border-[#ffb800]/50 bg-[#ffb800]/10 text-[#ffb800]">
                                  COPROPIEDAD {line.ownerSharePct}%
                                </span>
                              )}
                              <span
                                data-testid={`settlement-line-abono-badge-${line.property.id}`}
                                className={`inline-block px-1.5 py-0.5 text-[10px] font-bold border ${
                                  line.isPartialPayment
                                    ? 'border-[#ffb800] bg-[#ffb800]/15 text-[#ffb800]'
                                    : 'border-[#00FF66]/50 bg-[#00FF66]/10 text-[#00FF66]'
                                }`}
                              >
                                {line.isPartialPayment
                                  ? `[ABONO PARCIAL · SALDO PENDIENTE: ${formatCop(line.remainingBalanceCop)}]`
                                  : line.abonosCount > 1
                                    ? `[PAGO COMPLETO EN ${line.abonosCount} ABONOS]`
                                    : '[PAGO COMPLETO 100%]'}
                              </span>
                            </div>

                            <div className="text-[11px] font-normal text-[#9ca3af] mt-1">
                              Canon Pactado: {formatCop(line.agreedRentCop)} ·
                              Recaudado Unidad:{' '}
                              {formatCop(line.propertyGrossCollectedCop)}
                              {line.isPartialPayment && (
                                <span className="text-[#ffb800] font-semibold">
                                  {' '}
                                  · Resta: {formatCop(line.remainingBalanceCop)}
                                </span>
                              )}
                            </div>

                            {line.paymentsBreakdown.length > 0 && (
                              <div
                                data-testid={`settlement-line-abonos-list-${line.property.id}`}
                                className="mt-2 space-y-1 pl-2.5 border-l-2 border-[#00eefc]/50 bg-[#14151a] p-2 text-[11px] font-normal"
                              >
                                <div className="text-[10px] uppercase tracking-wider text-[#00eefc] font-bold">
                                  Desglose de Abonos / Recaudos Registrados (
                                  {line.paymentsBreakdown.length}):
                                </div>
                                {line.paymentsBreakdown.map((rp, idx) => {
                                  const ownerDividend = Math.round(
                                    rp.gross_amount_cop *
                                      (line.ownerSharePct / 100)
                                  );
                                  return (
                                    <div
                                      key={rp.id}
                                      data-testid={`settlement-abono-item-${rp.id}`}
                                      className="flex flex-wrap items-center justify-between gap-2 text-[#e3e2e7]"
                                    >
                                      <span>
                                        <strong className="text-[#ffb800]">
                                          Abono #{idx + 1}
                                        </strong>{' '}
                                        · REF:{' '}
                                        <span className="text-white font-semibold">
                                          {rp.reference_code}
                                        </span>{' '}
                                        · {rp.payment_method} ({rp.payment_date})
                                      </span>
                                      <span className="text-[#00FF66] font-bold">
                                        {formatCop(ownerDividend)}
                                        {line.ownerSharePct < 100
                                          ? ` (${line.ownerSharePct}% de ${formatCop(rp.gross_amount_cop)})`
                                          : ''}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right text-[#00FF66] align-top">
                            <div className="font-bold">
                              {formatCop(line.grossCollectedCop)}
                            </div>
                            {line.ownerSharePct < 100 && (
                              <div className="text-[10px] text-[#9ca3af]">
                                Total unidad:{' '}
                                {formatCop(line.propertyGrossCollectedCop)} (
                                {line.ownerSharePct}%)
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right text-[#ffb800] font-bold align-top">
                            -{formatCop(line.percentageFeeCop)} (
                            {line.property.commission_pct}%)
                          </td>
                          <td className="py-2.5 px-3 text-right text-white font-bold align-top">
                            {formatCop(
                              line.grossCollectedCop - line.percentageFeeCop
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Final Statement & Transactional Execution Card */}
            <div className="xl:col-span-5 bg-[#0d0e12] border-2 border-[#00eefc] p-5 space-y-4 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="border-b border-[#292a2e] pb-3 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-mono text-[#00eefc] uppercase tracking-widest block">
                      EXTRACTO FINAL DE PROPIETARIO
                    </span>
                    <h3 className="text-base font-mono font-bold text-white">
                      {bundle.selected_owner.name} ({periodMonth})
                    </h3>
                  </div>
                  <span className="text-xs font-mono text-[#00FF66] border border-[#00FF66]/40 px-2 py-0.5">
                    SQLITE ACID
                  </span>
                </div>

                <div className="space-y-2.5 font-mono text-xs">
                  <div className="flex justify-between items-center py-1 border-b border-[#292a2e]/60">
                    <span className="text-[#9ca3af]">
                      (+) INGRESO BRUTO RECAUDADO:
                    </span>
                    <span
                      className="text-white font-bold"
                      data-testid="settlement-gross-income"
                    >
                      {formatCop(preview.grossIncomeCop)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-1 border-b border-[#292a2e]/60">
                    <span className="text-[#9ca3af]">
                      (-) COMISIÓN PORCENTUAL AGENCIA:
                    </span>
                    <span
                      className="text-[#ffb800]"
                      data-testid="settlement-pct-commission"
                    >
                      -{formatCop(preview.commissionAmountCop)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-1 border-b border-[#292a2e]/60">
                    <span className="text-[#9ca3af]">
                      (-) MANTENIMIENTOS POR LIQUIDAR (1:1 NETO):
                    </span>
                    <span
                      className="text-[#ff007f] font-bold"
                      data-testid="settlement-maintenance-deduction"
                    >
                      -{formatCop(preview.maintenanceDeductionCop)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center pt-2">
                    <span className="text-sm font-bold text-[#00eefc]">
                      (=) NETO A TRANSFERIR AL PROPIETARIO:
                    </span>
                    <span
                      className="text-xl font-bold text-[#00FF66]"
                      data-testid="settlement-net-payable"
                    >
                      {formatCop(preview.netPayableCop)}
                    </span>
                  </div>
                  <div className="text-[11px] text-[#00eefc]">
                    SON: {formatCopInWords(preview.netPayableCop)}
                  </div>
                </div>

                <div className="bg-[#1a1b20] border border-[#292a2e] p-2.5 font-mono text-[11px] text-[#9ca3af] truncate">
                  SELLO SHA-256: {preview.sha256PreviewSeal}
                </div>

                {settlementFeedback && (
                  <div
                    className="p-2.5 bg-[#00FF66]/10 border border-[#00FF66] text-xs font-mono text-[#00FF66]"
                    data-testid="settlement-feedback"
                  >
                    {settlementFeedback}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  data-testid="download-active-pdf-button"
                  onClick={handleDownloadActivePdf}
                  className="w-full py-3 px-4 bg-[#1a1b20] border border-[#00eefc] text-[#00eefc] font-mono font-bold text-xs uppercase tracking-wider hover:bg-[#00eefc]/15"
                >
                  [ FACTURA PDF ]
                </button>
                <button
                  type="button"
                  data-testid="approve-settlement-button"
                  disabled={isPeriodAlreadyApproved}
                  onClick={handleApproveSettlement}
                  className={`w-full py-3 px-4 font-mono font-bold text-xs uppercase tracking-wider transition-colors ${
                    isPeriodAlreadyApproved
                      ? 'bg-[#292a2e] border border-[#00FF66]/40 text-[#00FF66] cursor-not-allowed'
                      : 'bg-[#00eefc] text-[#0d0e12] hover:bg-[#00eefc]/90'
                  }`}
                >
                  {isPeriodAlreadyApproved
                    ? '[ LIQUIDACIÓN YA APROBADA // EN HISTORIAL ]'
                    : '[ APROBAR // EJECUTAR ]'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
};
