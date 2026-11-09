import React, { useEffect, useRef, useState } from 'react';
import {
  NewRentPaymentInput,
  OwnerDashboardBundle,
  Property,
} from '../../types/domain';
import {
  calculateAgencyParticipation,
  calculatePropertyCommission,
  formatCop,
  formatCopInWords,
  formatPeriodMonthLabel,
  getContractBillingCycleState,
  getCurrentPeriodMonth,
  getPeriodCollectionStatus,
  getPropertyTenantPaymentState,
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

export const DashboardAnaliticoView: React.FC<DashboardAnaliticoViewProps> = ({
  bundle,
  allProperties,
  onNavigateModule,
  onRecordPayment,
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

  const currentSystemPeriod = getCurrentPeriodMonth();
  const rentableProperties = bundle.properties.filter(
    (p) => p.property_type !== 'EDIFICIO MATRIZ'
  );

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState<boolean>(false);
  const [paymentPropertyId, setPaymentPropertyId] = useState<number>(
    rentableProperties[0]?.id ?? 2
  );
  const [paymentPeriod, setPaymentPeriod] =
    useState<string>(currentSystemPeriod);
  const [paymentAmount, setPaymentAmount] = useState<number>(
    rentableProperties[0]?.base_rent_cop ?? 1_500_000
  );
  const [paymentDate, setPaymentDate] = useState<string>(
    `${currentSystemPeriod}-${String(new Date().getDate()).padStart(2, '0')}`
  );
  const [paymentMethod, setPaymentMethod] = useState<string>('TRANSACCIÓN');
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentFeedback, setPaymentFeedback] = useState<string | null>(null);
  const periodSelectRef = useRef<HTMLSelectElement | null>(null);

  const paymentCycleState = getContractBillingCycleState(
    paymentPropertyId,
    bundle.properties,
    bundle.contracts,
    bundle.payments
  );

  const activePeriodStatus = getPeriodCollectionStatus(
    paymentPropertyId,
    paymentPeriod,
    bundle.properties,
    bundle.contracts,
    bundle.payments
  );

  const selectedModalProperty = bundle.properties.find(
    (p) => p.id === paymentPropertyId
  );
  const selectedModalPaymentState = getPropertyTenantPaymentState(
    paymentPropertyId,
    bundle.properties,
    bundle.contracts,
    bundle.payments
  );

  useEffect(() => {
    if (
      !paymentCycleState.collectiblePeriods.includes(paymentPeriod) &&
      paymentCycleState.activePeriod
    ) {
      setPaymentPeriod(paymentCycleState.activePeriod);
    }
  }, [
    paymentPropertyId,
    paymentPeriod,
    paymentCycleState.activePeriod,
    paymentCycleState.collectiblePeriods,
  ]);

  useEffect(() => {
    const status = getPeriodCollectionStatus(
      paymentPropertyId,
      paymentPeriod,
      bundle.properties,
      bundle.contracts,
      bundle.payments
    );
    setPaymentAmount(
      status.remainingBalanceCop > 0 ? status.remainingBalanceCop : 0
    );
    setPaymentError(null);
  }, [
    paymentPropertyId,
    paymentPeriod,
    bundle.payments.length,
    bundle.selected_owner.id,
  ]);

  useEffect(() => {
    if (isPaymentModalOpen) {
      periodSelectRef.current?.focus();
    }
  }, [isPaymentModalOpen, paymentPropertyId]);

  const handleOpenPaymentModal = (propId: number) => {
    const propState = getPropertyTenantPaymentState(
      propId,
      bundle.properties,
      bundle.contracts,
      bundle.payments
    );
    setPaymentPropertyId(propId);
    setPaymentPeriod(propState.activePeriod);
    setPaymentAmount(propState.remainingBalanceCop);
    setPaymentError(null);
    setPaymentFeedback(null);
    setIsPaymentModalOpen(true);
  };

  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPaymentError(null);
    setPaymentFeedback(null);

    const amount = Number(paymentAmount || 0);
    if (amount <= 0) {
      setPaymentError(
        'Operación bloqueada: El valor del recaudo o abono debe ser mayor a $0 COP.'
      );
      return;
    }

    if (
      activePeriodStatus.agreedRentCop > 0 &&
      amount > activePeriodStatus.remainingBalanceCop
    ) {
      setPaymentError(
        `Operación bloqueada: El abono de ${formatCop(amount)} supera el saldo pendiente del periodo ${paymentPeriod} (Canon pactado: ${formatCop(activePeriodStatus.agreedRentCop)} · Abonado: ${formatCop(activePeriodStatus.alreadyCollectedCop)} · Saldo máximo permitido: ${formatCop(activePeriodStatus.remainingBalanceCop)}).`
      );
      return;
    }

    const contract =
      bundle.contracts.find(
        (c) => c.property_id === paymentPropertyId && c.status !== 'FINALIZADO'
      ) ?? bundle.contracts.find((c) => c.property_id === paymentPropertyId);

    try {
      onRecordPayment?.({
        contract_id: contract?.id ?? 0,
        property_id: paymentPropertyId,
        period_month: paymentPeriod,
        gross_amount_cop: amount,
        payment_date: paymentDate,
        payment_method: paymentMethod,
        status: 'PAGADO',
      });

      const nextRemaining = Math.max(
        0,
        activePeriodStatus.remainingBalanceCop - amount
      );
      setPaymentFeedback(
        nextRemaining === 0
          ? `Pago completado (${formatCop(amount)} vía ${paymentMethod}): El inmueble quedó AL DÍA para el periodo ${paymentPeriod}.`
          : `Abono registrado (${formatCop(amount)} vía ${paymentMethod}): Saldo pendiente del periodo ${paymentPeriod}: ${formatCop(nextRemaining)}. El botón [ PAGAR ] permanece habilitado hasta cubrir la totalidad.`
      );
    } catch (err) {
      setPaymentError(
        err instanceof Error
          ? err.message
          : 'Error al registrar el recaudo en el libro mayor.'
      );
    }
  };

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
              Matriz de Activos Inmobiliarios, Recaudo Mensual y Estado de Cuenta
            </h3>
            <p className="text-xs font-mono text-[#9ca3af]">
              El botón [ PAGAR ] se activa en la fecha de corte o 5 días antes y
              permanece habilitado con abonos hasta que el inquilino esté AL DÍA.
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
                  RECAUDO / PAGAR
                </th>
                <th scope="col" className="py-2.5 px-3 text-center">
                  ESTADO
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#292a2e]/60">
              {bundle.properties.map((prop) => {
                const paymentState = getPropertyTenantPaymentState(
                  prop.id,
                  bundle.properties,
                  bundle.contracts,
                  bundle.payments
                );
                const contract = paymentState.contract;
                const comm = calculatePropertyCommission(
                  prop.base_rent_cop,
                  prop.commission_pct,
                  0
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
                      <div className="mt-1">
                        <span
                          data-testid={`dashboard-occupancy-badge-${prop.id}`}
                          className={`inline-block px-2 py-0.5 text-[10px] font-bold border ${
                            prop.status === 'DISPONIBLE'
                              ? 'bg-[#00FF66]/10 text-[#00FF66] border-[#00FF66]/40'
                              : 'bg-[#00eefc]/10 text-[#00eefc] border-[#00eefc]/40'
                          }`}
                        >
                          [{prop.status}]
                        </span>
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
                            Corte Día {contract.cutoff_day} · Apertura:{' '}
                            {paymentState.activationDateLabel}
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
                    <td className="py-2.5 px-3 text-right">
                      {prop.property_type === 'EDIFICIO MATRIZ' ? (
                        <span className="text-[#9ca3af]">
                          Segregado por unidad
                        </span>
                      ) : (
                        <div className="flex flex-col items-end gap-1">
                          <button
                            type="button"
                            data-testid={`dashboard-pay-button-${prop.id}`}
                            disabled={!paymentState.canPay}
                            onClick={() => handleOpenPaymentModal(prop.id)}
                            className={`px-3 py-1 font-mono font-bold text-[11px] uppercase tracking-wider border transition-colors ${
                              paymentState.canPay
                                ? 'bg-[#00eefc] text-[#0d0e12] border-[#00eefc] hover:bg-[#00eefc]/90'
                                : 'bg-[#1a1b20] text-[#9ca3af]/60 border-[#292a2e] cursor-not-allowed'
                            }`}
                          >
                            {!paymentState.hasActiveContract
                              ? '[ SIN INQUILINO ]'
                              : paymentState.isAlDia
                                ? '[ AL DÍA // PAGADO ]'
                                : '[ PAGAR ]'}
                          </button>
                          <div className="text-[10px] text-[#9ca3af]">
                            Comisión: {prop.commission_pct}% (
                            {formatCop(comm.percentageFeeCop)})
                          </div>
                          {paymentState.hasActiveContract &&
                            paymentState.totalRemainingDebtCop > 0 && (
                              <div
                                className="text-[10px] text-[#ffb800]"
                                data-testid={`dashboard-remaining-debt-${prop.id}`}
                              >
                                Saldo: {formatCop(paymentState.totalRemainingDebtCop)}
                              </div>
                            )}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {prop.property_type === 'EDIFICIO MATRIZ' ? (
                        <span className="inline-block px-2 py-0.5 text-[11px] font-bold border bg-[#1a1b20] text-[#9ca3af] border-[#292a2e]">
                          [MATRIZ]
                        </span>
                      ) : !paymentState.hasActiveContract ? (
                        <span
                          data-testid={`dashboard-tenant-status-${prop.id}`}
                          className="inline-block px-2 py-0.5 text-[11px] font-bold border bg-[#1a1b20] text-[#9ca3af] border-[#292a2e]"
                        >
                          [SIN INQUILINO]
                        </span>
                      ) : (
                        <span
                          data-testid={`dashboard-tenant-status-${prop.id}`}
                          className={`inline-block px-2 py-0.5 text-[11px] font-bold border ${
                            paymentState.isAlDia
                              ? 'bg-[#00FF66]/10 text-[#00FF66] border-[#00FF66]/40'
                              : 'bg-[#ff007f]/15 text-[#ff007f] border-[#ff007f]/50'
                          }`}
                        >
                          [{paymentState.statusLabel}]
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Window: 04 // Registro de Recaudo Mensual + Historial Reciente de Recaudos & Saldos */}
      {isPaymentModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Ventana de Registro de Recaudo Mensual e Historial Reciente"
          data-testid="payment-modal-dialog"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
        >
          <div className="bg-[#0d0e12] border-2 border-[#00eefc] w-full max-w-5xl max-h-[92vh] overflow-y-auto p-6 space-y-5 shadow-2xl">
            <div className="flex items-start justify-between border-b border-[#292a2e] pb-4 gap-4">
              <div>
                <div className="text-xs font-mono text-[#00eefc] uppercase tracking-widest">
                  04 // PLANTILLA DE PAGO Y RECAUDO MENSUAL
                </div>
                <h3 className="text-lg font-mono font-bold text-white mt-0.5">
                  {selectedModalProperty?.title ?? 'Inmueble'} —{' '}
                  {selectedModalPaymentState.contract?.tenant_name ??
                    'Inquilino Activo'}
                </h3>
                <p className="text-xs font-mono text-[#9ca3af]">
                  Se permiten abonos parciales; el botón [ PAGAR ] seguirá
                  habilitado hasta cubrir el 100% del saldo pendiente.
                </p>
              </div>
              <button
                type="button"
                data-testid="close-payment-modal-button"
                onClick={() => setIsPaymentModalOpen(false)}
                className="px-3 py-1.5 bg-[#1a1b20] border border-[#ff007f]/60 text-[#ff007f] font-mono font-bold text-xs uppercase hover:bg-[#ff007f]/15"
              >
                [ CERRAR ✕ ]
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Payment Template (04 // Registro de Recaudo Mensual) */}
              <form
                noValidate
                onSubmit={handlePaymentSubmit}
                data-testid="panel-recaudo"
                className="lg:col-span-6 bg-[#121317] border border-[#292a2e] p-5 space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="border-b border-[#292a2e] pb-2 flex items-center justify-between">
                    <h4 className="text-sm font-mono font-bold uppercase text-[#00FF66]">
                      04 // Registro de Recaudo Mensual
                    </h4>
                    <span className="text-[11px] font-mono text-[#9ca3af]">
                      ABONOS Y PAGOS
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-mono text-[#9ca3af] mb-1">
                      Inmueble Recaudado
                    </label>
                    <select
                      aria-label="Inmueble Recaudado"
                      data-testid="select-payment-property"
                      value={paymentPropertyId}
                      onChange={(e) =>
                        setPaymentPropertyId(Number(e.target.value))
                      }
                      className="w-full bg-[#1a1b20] border border-[#292a2e] px-3 py-2 text-xs font-mono text-white"
                    >
                      {rentableProperties.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.code} — {p.title} (Canon:{' '}
                          {formatCop(p.base_rent_cop)})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-mono text-[#9ca3af] mb-1">
                        Periodo Contable (Corte Activo)
                      </label>
                      <select
                        ref={periodSelectRef}
                        aria-label="Periodo Contable"
                        data-testid="select-payment-period"
                        value={paymentPeriod}
                        onChange={(e) => setPaymentPeriod(e.target.value)}
                        className="w-full bg-[#1a1b20] border border-[#00FF66]/60 px-3 py-2 text-xs font-mono text-white font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00FF66]"
                      >
                        {paymentCycleState.collectiblePeriods.map((p) => (
                          <option key={p} value={p}>
                            {formatPeriodMonthLabel(p, currentSystemPeriod)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-mono text-[#9ca3af] mb-1">
                        Valor Recibido / Abono (COP)
                      </label>
                      <input
                        type="number"
                        aria-label="Valor Recibido COP"
                        data-testid="input-payment-amount-cop"
                        min={1}
                        max={
                          activePeriodStatus.remainingBalanceCop > 0
                            ? activePeriodStatus.remainingBalanceCop
                            : undefined
                        }
                        value={paymentAmount}
                        onChange={(e) =>
                          setPaymentAmount(Number(e.target.value))
                        }
                        className="w-full bg-[#1a1b20] border border-[#292a2e] px-3 py-2 text-xs font-mono text-white"
                        required
                      />
                      <div
                        className="mt-1 text-[11px] font-mono text-[#00FF66]"
                        data-testid="payment-amount-words"
                      >
                        {formatCop(paymentAmount)} —{' '}
                        {formatCopInWords(paymentAmount)}
                      </div>
                    </div>
                  </div>

                  <div
                    className="p-2.5 bg-[#1a1b20] border border-[#292a2e] font-mono text-[11px] space-y-1.5"
                    data-testid="payment-cutoff-cycle-info"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[#9ca3af] border-b border-[#292a2e] pb-1">
                      <span>
                        Registro Inquilino:{' '}
                        <strong className="text-white">
                          {paymentCycleState.registrationDate}
                        </strong>{' '}
                        · Corte:{' '}
                        <strong className="text-[#00eefc]">
                          Día {paymentCycleState.cutoffDay}
                        </strong>
                      </span>
                      <span className="text-[#ffb800]">
                        Próximo periodo ({paymentCycleState.nextPeriod}) se
                        activa el {paymentCycleState.nextCutoffDate}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                      <span className="text-[#9ca3af]">
                        Pactado ({paymentPeriod}):{' '}
                        <strong
                          className="text-white"
                          data-testid="payment-agreed-rent-cop"
                        >
                          {formatCop(activePeriodStatus.agreedRentCop)}
                        </strong>
                      </span>
                      <span className="text-[#9ca3af]">
                        Abonado:{' '}
                        <strong
                          className="text-[#00eefc]"
                          data-testid="payment-already-collected-cop"
                        >
                          {formatCop(activePeriodStatus.alreadyCollectedCop)}
                        </strong>
                      </span>
                      <span className="text-[#9ca3af]">
                        Saldo que Debe:{' '}
                        <strong
                          className={
                            activePeriodStatus.remainingBalanceCop === 0
                              ? 'text-[#00FF66]'
                              : 'text-[#ffb800]'
                          }
                          data-testid="payment-remaining-balance-cop"
                        >
                          {formatCop(activePeriodStatus.remainingBalanceCop)}
                        </strong>
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-mono text-[#9ca3af] mb-1">
                        Fecha de Pago
                      </label>
                      <input
                        type="date"
                        aria-label="Fecha de Pago"
                        data-testid="input-payment-date"
                        value={paymentDate}
                        onChange={(e) => setPaymentDate(e.target.value)}
                        className="w-full bg-[#1a1b20] border border-[#292a2e] px-3 py-2 text-xs font-mono text-white"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-mono text-[#9ca3af] mb-1">
                        Medio de Pago
                      </label>
                      <select
                        aria-label="Medio de Pago"
                        data-testid="select-payment-method"
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        className="w-full bg-[#1a1b20] border border-[#292a2e] px-3 py-2 text-xs font-mono text-white"
                      >
                        <option value="EFECTIVO">EFECTIVO</option>
                        <option value="TRANSACCIÓN">TRANSACCIÓN</option>
                      </select>
                    </div>
                  </div>

                  {paymentError && (
                    <div
                      className="p-2 bg-[#ff007f]/15 border border-[#ff007f] text-xs font-mono text-[#ff007f]"
                      data-testid="payment-error-feedback"
                    >
                      {paymentError}
                    </div>
                  )}

                  {paymentFeedback && (
                    <div
                      className="p-2 bg-[#00FF66]/10 border border-[#00FF66] text-xs font-mono text-[#00FF66]"
                      data-testid="payment-success-feedback"
                    >
                      {paymentFeedback}
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={activePeriodStatus.isFullyPaid}
                  className={`mt-4 w-full py-2.5 font-mono font-bold text-xs uppercase tracking-wider border transition-colors ${
                    activePeriodStatus.isFullyPaid
                      ? 'bg-[#1a1b20] border-[#292a2e] text-[#9ca3af] cursor-not-allowed'
                      : 'bg-[#00FF66]/15 border-[#00FF66] text-[#00FF66] hover:bg-[#00FF66]/25'
                  }`}
                >
                  {activePeriodStatus.isFullyPaid
                    ? '[ PERIODO AL DÍA — SALDO CUBIERTO AL 100% ]'
                    : '[ REGISTRAR ABONO EN LIBRO MAYOR ]'}
                </button>
              </form>

              {/* Right Column: Historial Reciente de Recaudos & Saldos que Debe */}
              <div className="lg:col-span-6 bg-[#121317] border border-[#292a2e] p-5 space-y-4 flex flex-col justify-between">
                <div className="space-y-4">
                  {/* Saldos que debe por periodo */}
                  <div data-testid="modal-pending-balances">
                    <div className="border-b border-[#292a2e] pb-2 mb-2.5 flex items-center justify-between">
                      <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-[#ffb800]">
                        Saldos que Debe por Periodo ({selectedModalProperty?.code})
                      </h4>
                      <span
                        className={`text-xs font-mono font-bold ${
                          selectedModalPaymentState.isAlDia
                            ? 'text-[#00FF66]'
                            : 'text-[#ff007f]'
                        }`}
                      >
                        Total que Debe:{' '}
                        {formatCop(
                          selectedModalPaymentState.totalRemainingDebtCop
                        )}
                      </span>
                    </div>

                    <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                      {selectedModalPaymentState.periodBalances.map((bal) => (
                        <div
                          key={bal.periodMonth}
                          className="p-2.5 bg-[#1a1b20] border border-[#292a2e] flex items-center justify-between font-mono text-xs"
                        >
                          <div>
                            <div className="text-white font-bold">
                              Periodo {bal.periodMonth}
                            </div>
                            <div className="text-[11px] text-[#9ca3af]">
                              Canon: {formatCop(bal.agreedRentCop)} · Abonado:{' '}
                              <span className="text-[#00eefc]">
                                {formatCop(bal.alreadyCollectedCop)}
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div
                              className={`font-bold ${
                                bal.remainingBalanceCop === 0
                                  ? 'text-[#00FF66]'
                                  : 'text-[#ff007f]'
                              }`}
                            >
                              Debe: {formatCop(bal.remainingBalanceCop)}
                            </div>
                            <span
                              className={`inline-block mt-0.5 px-1.5 py-0.5 text-[10px] border ${
                                bal.remainingBalanceCop === 0
                                  ? 'border-[#00FF66]/40 text-[#00FF66] bg-[#00FF66]/10'
                                  : 'border-[#ff007f]/40 text-[#ff007f] bg-[#ff007f]/10'
                              }`}
                            >
                              {bal.remainingBalanceCop === 0
                                ? '[AL DÍA]'
                                : '[SALDO PENDIENTE]'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Historial Reciente de Recaudos */}
                  <div data-testid="modal-recent-payments">
                    <div className="border-b border-[#292a2e] pb-2 mb-2.5 flex items-center justify-between">
                      <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-white">
                        Historial Reciente de Recaudos Anteriores
                      </h4>
                      <span className="text-[11px] font-mono text-[#00eefc]">
                        {bundle.payments.length} registros
                      </span>
                    </div>

                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {bundle.payments.map((payment) => {
                        const prop = bundle.properties.find(
                          (p) => p.id === payment.property_id
                        );
                        const payStatus = getPeriodCollectionStatus(
                          payment.property_id,
                          payment.period_month,
                          bundle.properties,
                          bundle.contracts,
                          bundle.payments,
                          payment.contract_id
                        );
                        const isPartial =
                          payStatus.agreedRentCop > 0 &&
                          payment.gross_amount_cop < payStatus.agreedRentCop;
                        return (
                          <div
                            key={payment.id}
                            className={`p-2.5 bg-[#1a1b20] border flex items-center justify-between font-mono text-xs ${
                              payment.property_id === paymentPropertyId
                                ? 'border-[#00eefc]/60'
                                : 'border-[#292a2e]'
                            }`}
                          >
                            <div>
                              <div className="text-white font-semibold">
                                {prop?.title ??
                                  `Inmueble #${payment.property_id}`}{' '}
                                <span className="text-[#9ca3af]">
                                  ({payment.period_month})
                                </span>
                              </div>
                              <div className="text-[11px] text-[#9ca3af]">
                                {payment.payment_date} · Medio:{' '}
                                <strong className="text-white">
                                  {payment.payment_method}
                                </strong>
                              </div>
                              <div className="text-[10px] text-[#00eefc] mt-0.5">
                                Acumulado Periodo:{' '}
                                {formatCop(payStatus.alreadyCollectedCop)} ·
                                Saldo que debe:{' '}
                                <strong
                                  className={
                                    payStatus.remainingBalanceCop === 0
                                      ? 'text-[#00FF66]'
                                      : 'text-[#ffb800]'
                                  }
                                >
                                  {formatCop(payStatus.remainingBalanceCop)}
                                </strong>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-white font-bold">
                                {formatCop(payment.gross_amount_cop)}
                              </div>
                              <span
                                className={`inline-block px-1.5 py-0.5 text-[10px] border ${
                                  payment.status === 'PAGADO'
                                    ? isPartial
                                      ? 'text-[#ffb800] border-[#ffb800]/40 bg-[#ffb800]/10'
                                      : 'text-[#00FF66] border-[#00FF66]/40 bg-[#00FF66]/10'
                                    : 'text-[#ff007f] border-[#ff007f]/40 bg-[#ff007f]/10'
                                }`}
                              >
                                [
                                {payment.status === 'PAGADO' && isPartial
                                  ? 'ABONO PARCIAL'
                                  : payment.status}
                                ]
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
