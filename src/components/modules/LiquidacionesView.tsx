import React, { useState } from 'react';
import { OwnerDashboardBundle } from '../../types/domain';
import {
  buildWeeklyTelemetrySeries,
  calculateOwnerSettlementPreview,
  formatCop,
} from '../../services/inmoService';

interface LiquidacionesViewProps {
  bundle: OwnerDashboardBundle;
  onExecuteSettlement: (ownerId: number, periodMonth: string) => void;
}

export const LiquidacionesView: React.FC<LiquidacionesViewProps> = ({
  bundle,
  onExecuteSettlement,
}) => {
  const [periodMonth, setPeriodMonth] = useState('2026-10');
  const [selectedReceiptPreview, setSelectedReceiptPreview] = useState<
    string | null
  >(null);
  const [settlementFeedback, setSettlementFeedback] = useState<string | null>(
    null
  );

  const preview = calculateOwnerSettlementPreview(
    bundle.selected_owner.id,
    bundle.properties,
    bundle.payments,
    bundle.maintenances,
    periodMonth
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
    onExecuteSettlement(bundle.selected_owner.id, periodMonth);
    setSettlementFeedback(
      `BEGIN TRANSACTION ... COMMIT completado: Liquidación ${periodMonth} sellada para ${bundle.selected_owner.name} por ${formatCop(preview.netPayableCop)}. Mantenimientos actualizados a [Liquidado].`
    );
  };

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
            MÓDULO 05 // MOTOR DE LIQUIDACIONES, CRUCE AUTOMÁTICO Y EXTRACTO
            FINAL
          </div>
          <h2 className="text-xl font-bold text-white mt-1">
            Liquidaciones de Propietario — {bundle.selected_owner.name}
          </h2>
          <p className="text-xs font-mono text-[#9ca3af] mt-0.5">
            Cruce automático de recaudos menos comisión mixta `(Bruto × %) +
            Cuota Fija` menos mantenimientos netos `1:1`.
          </p>
        </div>

        <div className="flex items-center gap-3 font-mono text-xs">
          <label className="flex items-center gap-2 text-[#9ca3af]">
            <span>PERIODO CONTABLE:</span>
            <select
              aria-label="Periodo Contable de Liquidación"
              value={periodMonth}
              onChange={(e) => setPeriodMonth(e.target.value)}
              className="bg-[#1a1b20] border border-[#00eefc]/50 px-3 py-1.5 text-white font-bold"
            >
              <option value="2026-10">2026-10 (Octubre 2026)</option>
              <option value="2026-09">2026-09 (Septiembre 2026)</option>
            </select>
          </label>
        </div>
      </div>

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
                        Math.round((pt.netLiquidityCop / maxChartValue) * 115)
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
                <div className="text-[10px] text-[#00FF66]">Liquidez Neta</div>
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
                {preview.pendingMaintenances.map((maint) => (
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
                        -{formatCop(maint.net_cost_cop)}
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedReceiptPreview(maint.receipt_image_path)
                        }
                        className="text-[11px] text-[#00eefc] underline mt-0.5"
                      >
                        Inspeccionar Recibo
                      </button>
                    </div>
                  </div>
                ))}
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
        {/* Detailed Property Commission Crossing Table */}
        <div className="xl:col-span-7 bg-[#0d0e12] border border-[#292a2e] p-5 space-y-4">
          <div className="border-b border-[#292a2e] pb-3 flex items-center justify-between">
            <h3 className="text-sm font-mono font-bold uppercase tracking-wider text-white">
              Desglose de Recaudos y Comisión Mixta por Unidad ({periodMonth})
            </h3>
            <span className="text-xs font-mono text-[#00eefc]">
              (BRUTO × %) + FIJA
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
                    % COMISIÓN
                  </th>
                  <th scope="col" className="py-2.5 px-3 text-right">
                    CUOTA FIJA
                  </th>
                  <th scope="col" className="py-2.5 px-3 text-right">
                    TOTAL AGENCIA
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#292a2e]/60">
                {preview.lines.map((line) => (
                  <tr key={line.property.id}>
                    <td className="py-2.5 px-3 text-white font-semibold">
                      [{line.property.code}] {line.property.title}
                    </td>
                    <td className="py-2.5 px-3 text-right text-[#00FF66]">
                      {formatCop(line.grossCollectedCop)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-[#9ca3af]">
                      {formatCop(line.percentageFeeCop)} (
                      {line.property.commission_pct}%)
                    </td>
                    <td className="py-2.5 px-3 text-right text-[#9ca3af]">
                      {formatCop(line.fixedFeeCop)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-[#ffb800] font-bold">
                      -{formatCop(line.totalAgencyFeeCop)}
                    </td>
                  </tr>
                ))}
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
                  (-) CUOTA FIJA BASE ACUMULADA:
                </span>
                <span
                  className="text-[#ffb800]"
                  data-testid="settlement-fixed-fee"
                >
                  -{formatCop(preview.fixedFeeAmountCop)}
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

          <button
            type="button"
            data-testid="approve-settlement-button"
            onClick={handleApproveSettlement}
            className="w-full py-3 px-4 bg-[#00eefc] text-[#0d0e12] font-mono font-bold text-xs uppercase tracking-wider hover:bg-[#00eefc]/90"
          >
            [ APROBAR // EJECUTAR ]
          </button>
        </div>
      </div>
    </section>
  );
};
