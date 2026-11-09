import React, { useEffect, useRef, useState } from 'react';
import {
  NewRentPaymentInput,
  OwnerDashboardBundle,
  Property,
} from '../../types/domain';
import {
  calculatePropertyCommission,
  formatCop,
  formatCopInWords,
  formatPeriodMonthLabel,
  getContractBillingCycleState,
  getCurrentPeriodMonth,
  getPeriodCollectionStatus,
  getPropertyTenantPaymentState,
} from '../../services/inmoService';

interface AdministracionAlertasViewProps {
  bundle: OwnerDashboardBundle;
  onExecuteHandover: (propertyId: number) => void;
  onRecordPayment?: (input: NewRentPaymentInput) => void;
}

export const AdministracionAlertasView: React.FC<
  AdministracionAlertasViewProps
> = ({ bundle, onExecuteHandover, onRecordPayment }) => {
  const currentSystemPeriod = getCurrentPeriodMonth();
  const rentableProperties = bundle.properties.filter(
    (p) => p.property_type !== 'EDIFICIO MATRIZ'
  );

  const rootProperties = bundle.properties.filter(
    (p) =>
      p.parent_property_id === null ||
      !bundle.properties.some((parent) => parent.id === p.parent_property_id)
  );
  const childrenByParent = new Map<number, Property[]>();
  for (const prop of bundle.properties) {
    if (prop.parent_property_id !== null) {
      const list = childrenByParent.get(prop.parent_property_id) ?? [];
      list.push(prop);
      childrenByParent.set(prop.parent_property_id, list);
    }
  }

  // Accordion state: expanded by default for root buildings so tree can be inspected or toggled
  const [expandedIds, setExpandedIds] = useState<Record<number, boolean>>(() => {
    const initial: Record<number, boolean> = {};
    for (const root of rootProperties) {
      initial[root.id] = true;
    }
    return initial;
  });

  const toggleExpand = (propId: number) => {
    setExpandedIds((prev) => ({
      ...prev,
      [propId]: !(prev[propId] ?? true),
    }));
  };

  // [ PAGAR ] Modal State
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

  // Property Handover State
  const occupiedRentableProps = bundle.properties.filter(
    (p) => p.property_type !== 'EDIFICIO MATRIZ' && p.status === 'OCUPADO'
  );

  const [handoverPropertyId, setHandoverPropertyId] = useState<number>(
    occupiedRentableProps[0]?.id ?? bundle.properties[0]?.id ?? 2
  );
  const [handoverFeedback, setHandoverFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (occupiedRentableProps.length > 0) {
      const stillValid = occupiedRentableProps.some(
        (p) => p.id === handoverPropertyId
      );
      if (!stillValid) {
        setHandoverPropertyId(occupiedRentableProps[0].id);
      }
    }
  }, [bundle.selected_owner.id, bundle.properties.length]);

  const handleHandoverClick = () => {
    const targetProp = bundle.properties.find(
      (p) => p.id === Number(handoverPropertyId)
    );
    if (!targetProp) return;
    onExecuteHandover(targetProp.id);
    setHandoverFeedback(
      `BEGIN TRANSACTION ... COMMIT ejecutado: Contrato finalizado y activo "${targetProp.title}" liberado a estado [DISPONIBLE].`
    );
  };

  const renderPropertyRow = (
    prop: Property,
    options: {
      isRoot: boolean;
      hasChildren: boolean;
      isExpanded: boolean;
      connector?: string;
    }
  ) => {
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

    return (
      <tr
        key={prop.id}
        data-testid={`admin-matrix-row-${prop.id}`}
        className={`hover:bg-[#1a1b20]/70 transition-colors ${
          options.isRoot ? 'bg-[#121317]' : 'bg-[#0d0e12]/80'
        }`}
      >
        <td className="py-2.5 px-3 text-[#00eefc]">{prop.code}</td>
        <td className="py-2.5 px-3 text-white">
          <div className="flex items-start gap-2">
            {options.isRoot ? (
              options.hasChildren ? (
                <button
                  type="button"
                  aria-label={`${
                    options.isExpanded ? 'Contraer' : 'Expandir'
                  } ${prop.title}`}
                  aria-expanded={options.isExpanded}
                  data-testid={`accordion-toggle-${prop.id}`}
                  onClick={() => toggleExpand(prop.id)}
                  className="px-2 py-0.5 bg-[#0d0e12] border border-[#00eefc]/60 text-[#00eefc] font-bold hover:bg-[#00eefc]/15 shrink-0"
                >
                  {options.isExpanded ? '[-]' : '[+]'}
                </button>
              ) : (
                <span className="px-2 py-0.5 bg-[#0d0e12] border border-[#292a2e] text-[#9ca3af] shrink-0">
                  [•]
                </span>
              )
            ) : (
              <span className="text-[#00eefc] font-bold pl-3 shrink-0">
                {options.connector ?? '├──'}
              </span>
            )}

            <div>
              <div className="font-semibold">{prop.title}</div>
              <div className="text-[11px] text-[#9ca3af]">{prop.address}</div>
              <div className="mt-1">
                <span
                  data-testid={`dashboard-occupancy-badge-${prop.id}`}
                  className={`inline-block px-2 py-0.5 text-[10px] font-bold border ${
                    prop.status === 'DISPONIBLE'
                      ? 'bg-[#00FF66]/10 text-[#00FF66] border-[#00FF66]/40'
                      : 'bg-[#00eefc]/10 text-[#00eefc] border-[#00eefc]/40'
                  }`}
                >
                  <span data-testid={`property-status-badge-${prop.id}`}>
                    [{prop.status}]
                  </span>
                </span>
              </div>
            </div>
          </div>
        </td>
        <td className="py-2.5 px-3 text-[#9ca3af]">{prop.property_type}</td>
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
            <span className="text-[#9ca3af]">Sin contrato activo</span>
          )}
        </td>
        <td className="py-2.5 px-3 text-right text-white">
          {prop.property_type === 'EDIFICIO MATRIZ'
            ? 'MATRIZ PRINCIPAL'
            : formatCop(prop.base_rent_cop)}
        </td>
        <td className="py-2.5 px-3 text-right">
          {prop.property_type === 'EDIFICIO MATRIZ' ? (
            <span className="text-[#9ca3af]">Segregado por unidad</span>
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
                Comisión: {prop.commission_pct}% ({formatCop(comm.percentageFeeCop)})
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
  };

  return (
    <section
      aria-label="Módulo 4: Administración y Alertas"
      className="space-y-6"
      data-testid="module-administracion-alertas"
    >
      <div className="bg-[#0d0e12] border border-[#292a2e] p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="text-xs font-mono text-[#00eefc] uppercase tracking-widest">
            MÓDULO 04 // MATRIZ JERÁRQUICA DE ACTIVOS, RECAUDO MENSUAL Y
            ENTREGA DE INMUEBLES
          </div>
          <h2 className="text-xl font-bold text-white mt-1">
            Administración — {bundle.selected_owner.name}
          </h2>
          <p className="text-xs font-mono text-[#9ca3af] mt-0.5">
            Matriz de activos con despliegue en acordeón `[+]` / `[-]`, recaudo
            mensual, saldos en mora y protocolo transaccional de restitución.
          </p>
        </div>

        <div className="flex items-center gap-3 font-mono text-xs">
          <span className="px-2.5 py-1 bg-[#00FF66]/10 border border-[#00FF66]/40 text-[#00FF66]">
            DISPONIBLES:{' '}
            {
              bundle.properties.filter(
                (p) =>
                  p.property_type !== 'EDIFICIO MATRIZ' &&
                  p.status === 'DISPONIBLE'
              ).length
            }
          </span>
          <span className="px-2.5 py-1 bg-[#00eefc]/10 border border-[#00eefc]/40 text-[#00eefc]">
            OCUPADOS:{' '}
            {
              bundle.properties.filter(
                (p) =>
                  p.property_type !== 'EDIFICIO MATRIZ' &&
                  p.status === 'OCUPADO'
              ).length
            }
          </span>
        </div>
      </div>

      {/* Matriz de Activos Inmobiliarios, Recaudo Mensual y Estado de Cuenta (Acordeón Despliegue) */}
      <div
        role="tree"
        aria-label="Directorio Jerárquico de Inmuebles del Propietario"
        data-testid="admin-property-matrix-accordion"
        className="bg-[#0d0e12] border border-[#292a2e] p-5"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
          <div>
            <h3 className="text-sm font-mono font-bold uppercase tracking-wider text-white">
              Matriz de Activos Inmobiliarios, Recaudo Mensual y Estado de Cuenta
            </h3>
            <p className="text-xs font-mono text-[#9ca3af]">
              Despliegue en acordeón `[+]` / `[-]` de Edificios Matrices y
              Sub-unidades · El botón [ PAGAR ] se activa en la fecha de corte o
              5 días antes.
            </p>
          </div>
          <span className="text-xs font-mono text-[#00eefc]">
            PROPIETARIO #{bundle.selected_owner.id} · ACORDEÓN JERÁRQUICO
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
                  ACTIVO / JERARQUÍA (ACORDEÓN)
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
              {rootProperties.map((rootProp) => {
                const children = childrenByParent.get(rootProp.id) ?? [];
                const hasChildren = children.length > 0;
                const isExpanded = expandedIds[rootProp.id] ?? true;

                return (
                  <React.Fragment key={rootProp.id}>
                    {renderPropertyRow(rootProp, {
                      isRoot: true,
                      hasChildren,
                      isExpanded,
                    })}
                    {hasChildren &&
                      isExpanded &&
                      children.map((child, idx) =>
                        renderPropertyRow(child, {
                          isRoot: false,
                          hasChildren: false,
                          isExpanded: false,
                          connector:
                            idx === children.length - 1 ? '└──' : '├──',
                        })
                      )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Contract Termination / Property Handover Hazard Block */}
      <div className="bg-[#0d0e12] border-2 border-[#ff0055] p-5 space-y-4 hazard-stripes">
        <div className="bg-[#0d0e12]/95 border border-[#ff0055]/50 p-4 space-y-4">
          <div className="flex items-center justify-between border-b border-[#ff0055]/40 pb-2.5">
            <div>
              <span className="text-[11px] font-mono text-[#ff0055] uppercase tracking-widest block font-bold">
                ZONA DE EJECUCIÓN TRANSACCIONAL // RESTITUCIÓN DE ACTIVO
              </span>
              <h3 className="text-sm font-mono font-bold uppercase text-white">
                Terminación de Contrato y Entrega de Inmueble
              </h3>
            </div>
            <span className="text-xs font-mono text-[#ff0055] border border-[#ff0055] px-2 py-0.5">
              ACID TX
            </span>
          </div>

          <p className="text-xs font-mono text-[#9ca3af]">
            Al ejecutar este protocolo, el motor SQLite inicia un bloque{' '}
            <code className="text-[#00eefc]">
              BEGIN TRANSACTION ... COMMIT
            </code>{' '}
            que finaliza el contrato vigente y restituye el inmueble a estado{' '}
            <strong className="text-[#00FF66]">[DISPONIBLE]</strong> para nuevo
            arrendamiento.
          </p>

          <label className="block font-mono text-xs">
            <span className="text-[#9ca3af] uppercase block mb-1">
              Seleccionar Inmueble Ocupado para Entrega
            </span>
            <select
              aria-label="Seleccionar Inmueble Ocupado para Entrega"
              data-testid="handover-property-select"
              value={handoverPropertyId}
              onChange={(e) => setHandoverPropertyId(Number(e.target.value))}
              className="w-full bg-[#1a1b20] border border-[#ff0055]/60 px-3 py-2 text-white"
            >
              {occupiedRentableProps.length > 0 ? (
                occupiedRentableProps.map((p) => (
                  <option key={p.id} value={p.id}>
                    [{p.code}] {p.title} — Estado actual: {p.status}
                  </option>
                ))
              ) : (
                <option value={bundle.properties[0]?.id ?? 0}>
                  Sin unidades ocupadas pendientes de entrega
                </option>
              )}
            </select>
          </label>

          {handoverFeedback && (
            <div
              className="p-2.5 bg-[#00FF66]/10 border border-[#00FF66] text-xs font-mono text-[#00FF66]"
              data-testid="handover-feedback"
            >
              {handoverFeedback}
            </div>
          )}

          <button
            type="button"
            data-testid="hazard-handover-button"
            disabled={occupiedRentableProps.length === 0}
            onClick={handleHandoverClick}
            className="w-full py-3 px-4 bg-[#ff0055] text-white font-mono font-bold text-xs uppercase tracking-wider hover:bg-[#ff0055]/90 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {'<<<<< EJECUTAR ENTREGA DE INQUILINO DE INMUEBLE >>>>>'}
          </button>
        </div>
      </div>

      {/* Modal Window: 04 // Registro de Recaudo Mensual + Historial Reciente de Recaudos Anteriores */}
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

              {/* Right Column: Historial Reciente de Recaudos Anteriores (Solo Saldos que Debe) */}
              <div className="lg:col-span-6 bg-[#121317] border border-[#292a2e] p-5 space-y-4 flex flex-col justify-between">
                <div
                  className="space-y-4"
                  data-testid="modal-recent-payments"
                >
                  <div className="border-b border-[#292a2e] pb-3 flex items-center justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-mono font-bold uppercase tracking-wider text-white">
                        Historial Reciente de Recaudos Anteriores
                      </h4>
                      <p className="text-[11px] font-mono text-[#9ca3af] mt-0.5">
                        Filtrado exclusivamente por los saldos que debe. Escoja
                        a cuál saldo abonar o pagar.
                      </p>
                    </div>
                    <span
                      data-testid="modal-pending-balances"
                      className={`text-xs font-mono font-bold px-2.5 py-1 border ${
                        selectedModalPaymentState.isAlDia
                          ? 'text-[#00FF66] border-[#00FF66]/40 bg-[#00FF66]/10'
                          : 'text-[#ff007f] border-[#ff007f]/50 bg-[#ff007f]/15'
                      }`}
                    >
                      Total que Debe:{' '}
                      {formatCop(
                        selectedModalPaymentState.totalRemainingDebtCop
                      )}
                    </span>
                  </div>

                  {(() => {
                    const owedBalances =
                      selectedModalPaymentState.periodBalances.filter(
                        (b) => b.remainingBalanceCop > 0
                      );

                    if (owedBalances.length === 0) {
                      return (
                        <div
                          data-testid="modal-no-pending-debt"
                          className="p-4 bg-[#1a1b20] border border-[#00FF66]/40 font-mono text-xs text-[#00FF66]"
                        >
                          Este inquilino no registra saldos pendientes ni en
                          mora ($0 COP). Estado: [AL DÍA].
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                        {owedBalances.map((bal) => {
                          const isSelectedToPay =
                            paymentPeriod === bal.periodMonth;
                          const isMoraPeriod =
                            bal.periodMonth < currentSystemPeriod;
                          const periodPayments = bundle.payments.filter(
                            (rp) =>
                              rp.property_id === paymentPropertyId &&
                              rp.period_month === bal.periodMonth &&
                              rp.status === 'PAGADO'
                          );

                          return (
                            <div
                              key={bal.periodMonth}
                              data-testid={`owed-balance-card-${bal.periodMonth}`}
                              onClick={() => {
                                setPaymentPeriod(bal.periodMonth);
                                setPaymentAmount(bal.remainingBalanceCop);
                                setPaymentError(null);
                              }}
                              className={`p-3.5 bg-[#1a1b20] border cursor-pointer transition-colors font-mono text-xs space-y-2.5 ${
                                isSelectedToPay
                                  ? 'border-2 border-[#00eefc] bg-[#00eefc]/5'
                                  : 'border-[#292a2e] hover:border-[#ffb800]/60'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-white font-bold text-sm">
                                      Periodo {bal.periodMonth}
                                    </span>
                                    <span
                                      className={`px-1.5 py-0.5 text-[10px] font-bold border ${
                                        isMoraPeriod
                                          ? 'border-[#ff007f] text-[#ff007f] bg-[#ff007f]/15'
                                          : 'border-[#ffb800] text-[#ffb800] bg-[#ffb800]/15'
                                      }`}
                                    >
                                      {isMoraPeriod
                                        ? '[SALDO EN MORA]'
                                        : '[SALDO PENDIENTE]'}
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-[#9ca3af] mt-1">
                                    Canon Pactado:{' '}
                                    <strong className="text-white">
                                      {formatCop(bal.agreedRentCop)}
                                    </strong>{' '}
                                    · Abonado:{' '}
                                    <strong className="text-[#00eefc]">
                                      {formatCop(bal.alreadyCollectedCop)}
                                    </strong>
                                  </div>
                                </div>

                                <div className="text-right">
                                  <div className="text-[10px] uppercase text-[#9ca3af]">
                                    Saldo que debe:
                                  </div>
                                  <div className="text-sm font-bold text-[#ff007f]">
                                    {formatCop(bal.remainingBalanceCop)}
                                  </div>
                                </div>
                              </div>

                              {periodPayments.length > 0 && (
                                <div className="pl-2.5 border-l-2 border-[#00eefc]/40 space-y-1 text-[11px] text-[#9ca3af]">
                                  {periodPayments.map((rp, idx) => (
                                    <div
                                      key={rp.id}
                                      className="flex items-center justify-between"
                                    >
                                      <span>
                                        Abono #{idx + 1} ({rp.payment_date}) ·{' '}
                                        <strong className="text-white">
                                          {rp.payment_method}
                                        </strong>
                                      </span>
                                      <span className="text-[#00eefc] font-bold">
                                        {formatCop(rp.gross_amount_cop)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}

                              <div className="pt-1 flex items-center justify-between border-t border-[#292a2e]">
                                <span className="text-[10px] text-[#9ca3af]">
                                  {isMoraPeriod
                                    ? `Se liquida en el periodo actual (${currentSystemPeriod})`
                                    : `Corte activo (${currentSystemPeriod})`}
                                </span>
                                <button
                                  type="button"
                                  data-testid={`select-owed-balance-${bal.periodMonth}`}
                                  onClick={(ev) => {
                                    ev.stopPropagation();
                                    setPaymentPeriod(bal.periodMonth);
                                    setPaymentAmount(bal.remainingBalanceCop);
                                    setPaymentError(null);
                                  }}
                                  className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider border ${
                                    isSelectedToPay
                                      ? 'bg-[#00eefc] text-[#0d0e12] border-[#00eefc]'
                                      : 'bg-[#121317] text-[#00eefc] border-[#00eefc]/50 hover:bg-[#00eefc]/15'
                                  }`}
                                >
                                  {isSelectedToPay
                                    ? '[ ✓ SALDO SELECCIONADO A PAGAR ]'
                                    : '[ ESCOGER ESTE SALDO A PAGAR ]'}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
