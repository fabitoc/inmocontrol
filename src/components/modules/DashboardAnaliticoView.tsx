import React, { useState } from 'react';
import {
  NewRentPaymentInput,
  OwnerDashboardBundle,
  Property,
} from '../../types/domain';
import {
  buildSmartAlerts,
  calculateAgencyParticipation,
  formatCop,
} from '../../services/inmoService';

interface DashboardAnaliticoViewProps {
  bundle: OwnerDashboardBundle;
  allProperties: Property[];
  onNavigateModule: (
    moduleId:
      | 'dashboard-analitico'
      | 'registro-control'
      | 'mantenimientos'
      | 'administracion-alertas'
      | 'liquidaciones'
  ) => void;
  onRecordPayment?: (input: NewRentPaymentInput) => void;
}

type AlertFilterType =
  | 'TODAS'
  | 'EN_MORA'
  | 'LIQUIDACION_RETRASADA'
  | 'PROXIMA_LIQUIDACION'
  | 'PROXIMO_COBRO';

export const DashboardAnaliticoView: React.FC<DashboardAnaliticoViewProps> = ({
  bundle,
  allProperties,
  onNavigateModule,
}) => {
  const participation = calculateAgencyParticipation(
    bundle.selected_owner.id,
    allProperties
  );

  const radius = 58;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset =
    circumference -
    (participation.participationByCountPct / 100) * circumference;

  const [alertFilter, setAlertFilter] = useState<AlertFilterType>('TODAS');

  const alerts = buildSmartAlerts(bundle);
  const moraAlerts = alerts.filter((a) => a.type === 'EN_MORA');
  const delayedSettlementAlerts = alerts.filter(
    (a) => a.type === 'LIQUIDACION_RETRASADA'
  );
  const upcomingSettlementAlerts = alerts.filter(
    (a) => a.type === 'PROXIMA_LIQUIDACION'
  );
  const upcomingCollectionAlerts = alerts.filter(
    (a) => a.type === 'PROXIMO_COBRO'
  );

  const filteredAlerts =
    alertFilter === 'TODAS'
      ? alerts
      : alerts.filter((a) => a.type === alertFilter);

  return (
    <section
      aria-label="Módulo 1: Dashboard Analítico"
      className="space-y-6"
      data-testid="module-dashboard-analitico"
    >
      {/* Top Analytical Banner */}
      <div className="bg-[#0d0e12] border border-[#292a2e] p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-[#00eefc] uppercase tracking-widest">
            <span>MÓDULO 01 // TELEMETRÍA DE PORTAFOLIO</span>
            <span className="text-[#9ca3af]">|</span>
            <span data-testid="dashboard-latency-badge">
              SQLITE_JOIN: {bundle.query_time_ms.toFixed(2)}ms (&lt;300ms SLA)
            </span>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-white mt-1">
            Dashboard Analítico — {bundle.selected_owner.name}
          </h2>
          <p className="text-xs font-mono text-[#9ca3af] mt-0.5">
            ID Fiscal: {bundle.selected_owner.document_id} · Dispersión:{' '}
            {bundle.selected_owner.bank_name} (
            {bundle.selected_owner.bank_account_type}{' '}
            {bundle.selected_owner.bank_account_number})
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => onNavigateModule('administracion-alertas')}
            className="px-3 py-2 bg-[#1a1b20] border border-[#00FF66]/50 text-[#00FF66] font-mono text-xs uppercase tracking-wider hover:bg-[#00FF66]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00FF66] focus-visible:outline-offset-2"
          >
            Ir a Matriz de Activos / Pagos →
          </button>
          <button
            type="button"
            onClick={() => onNavigateModule('registro-control')}
            className="px-3 py-2 bg-[#1a1b20] border border-[#00eefc]/40 text-[#00eefc] font-mono text-xs uppercase tracking-wider hover:bg-[#00eefc]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00f0ff] focus-visible:outline-offset-2"
          >
            + Registrar Activo / Contrato
          </button>
          <button
            type="button"
            onClick={() => onNavigateModule('liquidaciones')}
            className="px-3 py-2 bg-[#00eefc] text-[#0d0e12] font-mono font-bold text-xs uppercase tracking-wider hover:bg-[#00eefc]/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00f0ff] focus-visible:outline-offset-2"
          >
            Ir a Cierre Mensual →
          </button>
        </div>
      </div>

      {/* Radial Participation Chart + 4 KPI Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Radial SVG Chart Card */}
        <div className="lg:col-span-4 bg-[#0d0e12] border border-[#292a2e] p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-[#292a2e] pb-3">
            <span className="text-xs font-mono uppercase tracking-widest text-[#9ca3af]">
              Participación en la Agencia
            </span>
            <span className="text-xs font-mono text-[#00eefc] bg-[#00eefc]/10 px-2 py-0.5 border border-[#00eefc]/30">
              CUOTA PORTAFOLIO
            </span>
          </div>

          <div className="my-4 flex items-center justify-center gap-6">
            <div className="relative w-36 h-36 flex items-center justify-center">
              <svg
                className="w-36 h-36 -rotate-90"
                viewBox="0 0 140 140"
                role="img"
                aria-label={`Participación en la agencia: ${participation.participationByCountPct}% de unidades rentables`}
              >
                <circle
                  cx="70"
                  cy="70"
                  r={radius}
                  stroke="#1e1f24"
                  strokeWidth="12"
                  fill="transparent"
                />
                <circle
                  cx="70"
                  cy="70"
                  r={radius}
                  stroke="#00eefc"
                  strokeWidth="12"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="butt"
                  fill="transparent"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span
                  className="text-2xl font-mono font-bold text-[#00eefc]"
                  data-testid="radial-participation-pct"
                >
                  {participation.participationByCountPct.toFixed(1)}%
                </span>
                <span className="text-[11px] font-mono text-[#9ca3af] uppercase">
                  {participation.ownerRentableCount}/
                  {participation.agencyRentableCount} UNID.
                </span>
              </div>
            </div>

            <div className="space-y-2 text-xs font-mono">
              <div>
                <div className="text-[#9ca3af]">PONDERACIÓN POR CANON</div>
                <div
                  className="text-base font-bold text-white"
                  data-testid="volume-participation-pct"
                >
                  {participation.participationByVolumePct.toFixed(1)}%
                </div>
              </div>
              <div>
                <div className="text-[#9ca3af]">CANON PROPIETARIO</div>
                <div className="text-sm text-[#00FF66]">
                  {formatCop(participation.ownerBaseRentCop)}
                </div>
              </div>
              <div>
                <div className="text-[#9ca3af]">TOTAL AGENCIA</div>
                <div className="text-sm text-[#9ca3af]">
                  {formatCop(participation.agencyBaseRentCop)}
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-[#292a2e] pt-3 flex items-center justify-between text-xs font-mono text-[#9ca3af]">
            <span>FILTRO REACTIVO ACTIVO</span>
            <span className="text-[#00FF66]">WAL INDEXED</span>
          </div>
        </div>

        {/* 4 Analytical KPI Cards */}
        <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-[#0d0e12] border border-[#292a2e] p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-wider text-[#9ca3af]">
                01 // Inmuebles Totales (Rentables)
              </span>
              <span className="text-xs font-mono text-[#00eefc]">ACTIVOS</span>
            </div>
            <div className="my-3">
              <div
                className="text-3xl font-mono font-bold text-white"
                data-testid="kpi-owner-properties"
              >
                {bundle.owner_property_count}{' '}
                <span className="text-sm font-normal text-[#9ca3af]">
                  / {bundle.agency_total_properties} en agencia
                </span>
              </div>
              <p className="text-xs font-mono text-[#9ca3af] mt-1">
                Incluye {bundle.properties.length} registros totales (matrices y
                sub-unidades)
              </p>
            </div>
            <div className="text-xs font-mono text-[#00FF66]">
              Tasa de Ocupación: {bundle.occupancy_rate_pct.toFixed(1)}%
            </div>
          </div>

          <div className="bg-[#0d0e12] border border-[#292a2e] p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-wider text-[#9ca3af]">
                02 // Recaudo Mensual Esperado
              </span>
              <span className="text-xs font-mono text-[#00FF66]">
                CANON PACTADO
              </span>
            </div>
            <div className="my-3">
              <div
                className="text-3xl font-mono font-bold text-[#00FF66]"
                data-testid="kpi-expected-collection"
              >
                {formatCop(bundle.expected_monthly_collection_cop)}
              </div>
              <p className="text-xs font-mono text-[#9ca3af] mt-1">
                Recaudo efectivo periodo actual:{' '}
                {formatCop(bundle.collected_monthly_cop)}
              </p>
            </div>
            <div className="text-xs font-mono text-[#9ca3af]">
              Moneda local: Pesos Colombianos (COP)
            </div>
          </div>

          <div className="bg-[#0d0e12] border border-[#292a2e] p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-wider text-[#9ca3af]">
                03 // Mantenimientos Por Liquidar (1:1)
              </span>
              <span className="text-xs font-mono text-[#ffb800]">
                DEDUCCIÓN NETA
              </span>
            </div>
            <div className="my-3">
              <div
                className="text-3xl font-mono font-bold text-[#ffb800]"
                data-testid="kpi-pending-maintenance"
              >
                {formatCop(bundle.pending_maintenance_cop)}
              </div>
              <p className="text-xs font-mono text-[#9ca3af] mt-1">
                {
                  bundle.maintenances.filter(
                    (m) => m.deduction_status === 'Por Liquidar'
                  ).length
                }{' '}
                órdenes pendientes de descuento sin sobrecosto
              </p>
            </div>
            <div className="text-xs font-mono text-[#9ca3af]">
              Soporte en %LocalAppData%\InmoControl\evidencias\
            </div>
          </div>

          <div className="bg-[#0d0e12] border border-[#292a2e] p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-wider text-[#9ca3af]">
                04 // Estado de Contratos y Alertas
              </span>
              <span className="text-xs font-mono text-[#ff007f]">
                CONTROL MORA
              </span>
            </div>
            <div className="my-3">
              <div className="text-3xl font-mono font-bold text-white">
                {bundle.contracts.filter((c) => c.status === 'ACTIVO').length}{' '}
                <span className="text-sm font-normal text-[#9ca3af]">
                  Activos
                </span>{' '}
                /{' '}
                <span className="text-[#ff007f]">
                  {moraAlerts.length} Mora
                </span>
              </div>
              <p className="text-xs font-mono text-[#9ca3af] mt-1">
                Monitoreo automático sobre día límite de corte
              </p>
            </div>
            <div className="text-xs font-mono text-[#00eefc]">
              Liquidaciones ejecutadas: {bundle.settlements.length}
            </div>
          </div>
        </div>
      </div>

      {/* Real-Time Smart Alerts Panel (Moved from Administración to Dashboard) */}
      <div
        data-testid="dashboard-smart-alerts-panel"
        className="bg-[#0d0e12] border border-[#292a2e] p-5 space-y-5"
      >
        <div className="border-b border-[#292a2e] pb-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <h3 className="text-sm font-mono font-bold uppercase tracking-wider text-white">
              Panel de Alertas Inteligentes (Tiempo Real)
            </h3>
            <p className="text-xs font-mono text-[#9ca3af]">
              Moras de los inquilinos, liquidaciones retrasadas por aprobar,
              próximas liquidaciones a ejecutar y próximos cobros
            </p>
          </div>
          <div className="flex items-center gap-2 font-mono text-xs">
            <span
              data-testid="dashboard-alerts-total-badge"
              className="px-2.5 py-1 bg-[#ffb800]/10 border border-[#ffb800]/40 text-[#ffb800] font-bold"
            >
              {alerts.length} ALERTAS ACTIVAS
            </span>
          </div>
        </div>

        {/* 4 Category Filter / Indicator Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3 font-mono text-xs">
          <button
            type="button"
            data-testid="alert-filter-TODAS"
            onClick={() => setAlertFilter('TODAS')}
            className={`text-left p-3 border transition-colors ${
              alertFilter === 'TODAS'
                ? 'bg-[#00eefc]/15 border-[#00eefc] text-white'
                : 'bg-[#14151a] border-[#292a2e] text-[#9ca3af] hover:border-[#00eefc]/50'
            }`}
          >
            <div className="text-[10px] uppercase tracking-wider text-[#9ca3af]">
              RADAR COMPLETO
            </div>
            <div className="text-base font-bold text-white mt-0.5">
              Todas ({alerts.length})
            </div>
          </button>

          <button
            type="button"
            data-testid="alert-summary-mora"
            onClick={() => setAlertFilter('EN_MORA')}
            className={`text-left p-3 border transition-colors ${
              alertFilter === 'EN_MORA'
                ? 'bg-[#ff007f]/20 border-[#ff007f] text-white'
                : 'bg-[#14151a] border-[#ff007f]/40 text-[#9ca3af] hover:border-[#ff007f]'
            }`}
          >
            <div className="text-[10px] uppercase tracking-wider text-[#ff007f] font-bold">
              1. MORAS DE INQUILINOS
            </div>
            <div className="text-base font-bold text-white mt-0.5">
              {moraAlerts.length} en mora ·{' '}
              {formatCop(
                moraAlerts.reduce((sum, a) => sum + a.amount_cop, 0)
              )}
            </div>
          </button>

          <button
            type="button"
            data-testid="alert-summary-liquidacion-retrasada"
            onClick={() => setAlertFilter('LIQUIDACION_RETRASADA')}
            className={`text-left p-3 border transition-colors ${
              alertFilter === 'LIQUIDACION_RETRASADA'
                ? 'bg-[#ff007f]/20 border-[#ff007f] text-white'
                : 'bg-[#14151a] border-[#ff007f]/40 text-[#9ca3af] hover:border-[#ff007f]'
            }`}
          >
            <div className="text-[10px] uppercase tracking-wider text-[#ff007f] font-bold">
              2. LIQUIDACIONES RETRASADAS POR APROBAR
            </div>
            <div className="text-base font-bold text-white mt-0.5">
              {delayedSettlementAlerts.length} retrasada(s) ·{' '}
              {formatCop(
                delayedSettlementAlerts.reduce(
                  (sum, a) => sum + a.amount_cop,
                  0
                )
              )}
            </div>
          </button>

          <button
            type="button"
            data-testid="alert-summary-proxima-liquidacion"
            onClick={() => setAlertFilter('PROXIMA_LIQUIDACION')}
            className={`text-left p-3 border transition-colors ${
              alertFilter === 'PROXIMA_LIQUIDACION'
                ? 'bg-[#00eefc]/20 border-[#00eefc] text-white'
                : 'bg-[#14151a] border-[#00eefc]/40 text-[#9ca3af] hover:border-[#00eefc]'
            }`}
          >
            <div className="text-[10px] uppercase tracking-wider text-[#00eefc] font-bold">
              3. PRÓXIMAS LIQUIDACIONES A EJECUTAR
            </div>
            <div className="text-base font-bold text-white mt-0.5">
              {upcomingSettlementAlerts.length} programada(s) ·{' '}
              {formatCop(
                upcomingSettlementAlerts.reduce(
                  (sum, a) => sum + a.amount_cop,
                  0
                )
              )}
            </div>
          </button>

          <button
            type="button"
            data-testid="alert-summary-proximo-cobro"
            onClick={() => setAlertFilter('PROXIMO_COBRO')}
            className={`text-left p-3 border transition-colors ${
              alertFilter === 'PROXIMO_COBRO'
                ? 'bg-[#ffb800]/20 border-[#ffb800] text-white'
                : 'bg-[#14151a] border-[#ffb800]/40 text-[#9ca3af] hover:border-[#ffb800]'
            }`}
          >
            <div className="text-[10px] uppercase tracking-wider text-[#ffb800] font-bold">
              4. PRÓXIMOS COBROS
            </div>
            <div className="text-base font-bold text-white mt-0.5">
              {upcomingCollectionAlerts.length} cobro(s) ·{' '}
              {formatCop(
                upcomingCollectionAlerts.reduce(
                  (sum, a) => sum + a.amount_cop,
                  0
                )
              )}
            </div>
          </button>
        </div>

        {/* Alerts List */}
        <div
          data-testid="dashboard-alerts-list"
          className="space-y-3 font-mono text-xs"
        >
          {filteredAlerts.map((alert) => {
            const badgeStyle =
              alert.severity === 'MAGENTA'
                ? 'border-[#ff007f] bg-[#ff007f]/10 text-[#ff007f]'
                : alert.severity === 'AMBER'
                  ? 'border-[#ffb800] bg-[#ffb800]/10 text-[#ffb800]'
                  : 'border-[#00eefc] bg-[#00eefc]/10 text-[#00eefc]';

            const isSettlementAlert =
              alert.type === 'LIQUIDACION_RETRASADA' ||
              alert.type === 'PROXIMA_LIQUIDACION' ||
              alert.type === 'PENDIENTE_LIQUIDACION';

            return (
              <div
                key={alert.id}
                data-testid={`smart-alert-${alert.id}`}
                className="bg-[#1a1b20] border border-[#292a2e] p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`px-2 py-0.5 text-[10px] font-bold border ${badgeStyle}`}
                    >
                      {alert.cutoff_label}
                    </span>
                  </div>
                  <div className="text-white font-bold mt-1.5">
                    {alert.title}
                  </div>
                  <div className="text-[11px] text-[#9ca3af]">
                    {alert.subtitle}
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
                  <div className="text-right">
                    <div className="text-[10px] text-[#9ca3af] uppercase">
                      {alert.type === 'EN_MORA'
                        ? 'SALDO EN MORA'
                        : alert.type === 'LIQUIDACION_RETRASADA'
                          ? 'NETO POR APROBAR'
                          : alert.type === 'PROXIMA_LIQUIDACION'
                            ? 'PROYECCIÓN CIERRE'
                            : 'VALOR COBRO'}
                    </div>
                    <div className="text-sm font-bold text-white">
                      {formatCop(alert.amount_cop)}
                    </div>
                  </div>

                  <button
                    type="button"
                    data-testid={`alert-action-${alert.id}`}
                    onClick={() =>
                      onNavigateModule(
                        isSettlementAlert
                          ? 'liquidaciones'
                          : 'administracion-alertas'
                      )
                    }
                    className="px-2.5 py-1.5 bg-[#0d0e12] border border-[#00eefc]/50 text-[#00eefc] text-[10px] font-bold uppercase hover:bg-[#00eefc]/15"
                  >
                    {isSettlementAlert
                      ? '[ IR A LIQUIDACIONES → ]'
                      : '[ GESTIONAR EN ADMINISTRACIÓN → ]'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
