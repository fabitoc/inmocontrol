import React from 'react';
import { OwnerDashboardBundle, Property } from '../../types/domain';
import {
  calculateAgencyParticipation,
  calculatePropertyCommission,
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
}

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

  const contractByProp = new Map(
    bundle.contracts.map((c) => [c.property_id, c])
  );

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
                  {bundle.contracts.filter((c) => c.status === 'MORA').length}{' '}
                  Mora
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

      {/* Portfolio Analytical Breakdown Table */}
      <div className="bg-[#0d0e12] border border-[#292a2e] p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-mono font-bold uppercase tracking-wider text-white">
              Matriz de Activos Inmobiliarios y Estructura de Comisión Mixta
            </h3>
            <p className="text-xs font-mono text-[#9ca3af]">
              Fórmula estricta de agencia: (Ingreso Bruto × % Comisión) + Cuota
              Fija Base
            </p>
          </div>
          <span className="text-xs font-mono text-[#9ca3af]">
            PROPIETARIO #{bundle.selected_owner.id}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table
            role="table"
            aria-label="Tabla analítica de inmuebles del propietario seleccionado"
            className="w-full text-left border-collapse font-mono text-xs"
          >
            <thead>
              <tr className="border-b border-[#292a2e] text-[#9ca3af] bg-[#1a1b20]">
                <th scope="col" className="py-2.5 px-3">
                  CÓDIGO
                </th>
                <th scope="col" className="py-2.5 px-3">
                  ACTIVO / JERARQUÍA
                </th>
                <th scope="col" className="py-2.5 px-3">
                  TIPO
                </th>
                <th scope="col" className="py-2.5 px-3">
                  INQUILINO ACTUAL
                </th>
                <th scope="col" className="py-2.5 px-3 text-right">
                  CANON BASE
                </th>
                <th scope="col" className="py-2.5 px-3 text-right">
                  COMISIÓN MIXTA
                </th>
                <th scope="col" className="py-2.5 px-3 text-center">
                  ESTADO
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#292a2e]/60">
              {bundle.properties.map((prop) => {
                const contract = contractByProp.get(prop.id);
                const comm = calculatePropertyCommission(
                  prop.base_rent_cop,
                  prop.commission_pct,
                  prop.fixed_fee_cop
                );
                const isChild = prop.parent_property_id !== null;
                return (
                  <tr
                    key={prop.id}
                    className="hover:bg-[#1a1b20]/70 transition-colors"
                  >
                    <td className="py-2.5 px-3 text-[#00eefc]">{prop.code}</td>
                    <td className="py-2.5 px-3 text-white">
                      {isChild && (
                        <span className="text-[#00eefc] mr-1.5">├──</span>
                      )}
                      <span className="font-semibold">{prop.title}</span>
                      <div className="text-[11px] text-[#9ca3af]">
                        {prop.address}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-[#9ca3af]">
                      {prop.property_type}
                    </td>
                    <td className="py-2.5 px-3 text-[#e3e2e7]">
                      {contract ? (
                        <div>
                          <div>{contract.tenant_name}</div>
                          <div className="text-[11px] text-[#9ca3af]">
                            Corte Día {contract.cutoff_day} · {contract.status}
                          </div>
                        </div>
                      ) : (
                        <span className="text-[#9ca3af]">
                          Sin contrato activo
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right text-white">
                      {prop.property_type === 'EDIFICIO MATRIZ'
                        ? 'MATRIZ PRINCIPAL'
                        : formatCop(prop.base_rent_cop)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-[#ffb800]">
                      {prop.property_type === 'EDIFICIO MATRIZ' ? (
                        <span className="text-[#9ca3af]">
                          Segregado por unidad
                        </span>
                      ) : (
                        <div>
                          <div>{formatCop(comm.totalCommissionCop)}</div>
                          <div className="text-[11px] text-[#9ca3af]">
                            {prop.commission_pct}% +{' '}
                            {formatCop(prop.fixed_fee_cop)}
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 text-[11px] font-bold border ${
                          prop.status === 'DISPONIBLE'
                            ? 'bg-[#00FF66]/10 text-[#00FF66] border-[#00FF66]/40'
                            : 'bg-[#00eefc]/10 text-[#00eefc] border-[#00eefc]/40'
                        }`}
                      >
                        [{prop.status}]
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};
