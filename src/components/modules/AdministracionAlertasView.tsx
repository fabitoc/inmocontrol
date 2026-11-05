import React, { useEffect, useState } from 'react';
import { OwnerDashboardBundle, Property } from '../../types/domain';
import { buildSmartAlerts, formatCop } from '../../services/inmoService';

interface AdministracionAlertasViewProps {
  bundle: OwnerDashboardBundle;
  onExecuteHandover: (propertyId: number) => void;
}

export const AdministracionAlertasView: React.FC<
  AdministracionAlertasViewProps
> = ({ bundle, onExecuteHandover }) => {
  const rootProperties = bundle.properties.filter(
    (p) => p.parent_property_id === null
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

  const toggleExpand = (propId: number) => {
    setExpandedIds((prev) => ({
      ...prev,
      [propId]: !(prev[propId] ?? true),
    }));
  };

  const alerts = buildSmartAlerts(bundle);
  const contractByProp = new Map(
    bundle.contracts
      .filter((c) => c.status !== 'FINALIZADO')
      .map((c) => [c.property_id, c])
  );

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

  return (
    <section
      aria-label="Módulo 4: Administración y Alertas"
      className="space-y-6"
      data-testid="module-administracion-alertas"
    >
      <div className="bg-[#0d0e12] border border-[#292a2e] p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="text-xs font-mono text-[#00eefc] uppercase tracking-widest">
            MÓDULO 04 // DIRECTORIO JERÁRQUICO, ALERTAS INTELIGENTES Y ENTREGA DE
            INMUEBLES
          </div>
          <h2 className="text-xl font-bold text-white mt-1">
            Administración y Alertas — {bundle.selected_owner.name}
          </h2>
          <p className="text-xs font-mono text-[#9ca3af] mt-0.5">
            Árbol acordeón de propiedades matrices/sub-unidades, radar de mora y
            protocolo transaccional de restitución.
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

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Accordion Property Directory Tree (WCAG 2.1 AA role="tree" / role="treeitem" / aria-expanded) */}
        <div className="xl:col-span-6 bg-[#0d0e12] border border-[#292a2e] p-5 space-y-4">
          <div className="border-b border-[#292a2e] pb-3 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-mono font-bold uppercase tracking-wider text-white">
                Árbol de Directorio de Inmuebles (Acordeón)
              </h3>
              <p className="text-xs font-mono text-[#9ca3af]">
                Despliegue `[+]` / `[-]` de Edificios Matrices y Sub-unidades
                (`parent_property_id`)
              </p>
            </div>
            <span className="text-xs font-mono text-[#00eefc]">
              ARIA TREE VIEW
            </span>
          </div>

          <div
            role="tree"
            aria-label="Directorio Jerárquico de Inmuebles del Propietario"
            className="space-y-3 font-mono text-xs"
          >
            {rootProperties.map((rootProp) => {
              const children = childrenByParent.get(rootProp.id) ?? [];
              const hasChildren = children.length > 0;
              const isExpanded = expandedIds[rootProp.id] ?? true;
              const activeContract = contractByProp.get(rootProp.id);

              return (
                <div
                  key={rootProp.id}
                  role="treeitem"
                  aria-expanded={hasChildren ? isExpanded : undefined}
                  aria-selected={false}
                  className="bg-[#1a1b20] border border-[#292a2e] p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {hasChildren ? (
                        <button
                          type="button"
                          aria-label={`${
                            isExpanded ? 'Contraer' : 'Expandir'
                          } ${rootProp.title}`}
                          aria-expanded={isExpanded}
                          data-testid={`accordion-toggle-${rootProp.id}`}
                          onClick={() => toggleExpand(rootProp.id)}
                          className="px-2 py-0.5 bg-[#0d0e12] border border-[#00eefc]/50 text-[#00eefc] font-bold hover:bg-[#00eefc]/15"
                        >
                          {isExpanded ? '[-]' : '[+]'}
                        </button>
                      ) : (
                        <span className="px-2 py-0.5 bg-[#0d0e12] border border-[#292a2e] text-[#9ca3af]">
                          [•]
                        </span>
                      )}
                      <div>
                        <div className="text-white font-bold">
                          [{rootProp.code}] {rootProp.title}
                        </div>
                        <div className="text-[11px] text-[#9ca3af]">
                          {rootProp.address} · {rootProp.property_type}
                          {activeContract
                            ? ` · Inquilino: ${activeContract.tenant_name}`
                            : ''}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {rootProp.base_rent_cop > 0 && (
                        <span className="text-[#e3e2e7]">
                          {formatCop(rootProp.base_rent_cop)}
                        </span>
                      )}
                      <span
                        data-testid={`property-status-badge-${rootProp.id}`}
                        className={`px-2 py-0.5 text-[11px] font-bold border ${
                          rootProp.status === 'DISPONIBLE'
                            ? 'bg-[#00FF66]/10 text-[#00FF66] border-[#00FF66]/40'
                            : 'bg-[#00eefc]/10 text-[#00eefc] border-[#00eefc]/40'
                        }`}
                      >
                        [{rootProp.status}]
                      </span>
                    </div>
                  </div>

                  {/* Child Sub-units */}
                  {hasChildren && isExpanded && (
                    <div
                      role="group"
                      aria-label={`Sub-unidades de ${rootProp.title}`}
                      className="mt-3 pl-4 border-l border-[#00eefc]/40 space-y-2"
                    >
                      {children.map((child, idx) => {
                        const connector =
                          idx === children.length - 1 ? '└──' : '├──';
                        const childContract = contractByProp.get(child.id);
                        return (
                          <div
                            key={child.id}
                            role="treeitem"
                            aria-selected={false}
                            className="bg-[#0d0e12] border border-[#292a2e] p-2.5 flex items-center justify-between gap-2"
                          >
                            <div>
                              <div className="text-white">
                                <span className="text-[#00eefc] font-bold mr-1.5">
                                  {connector}
                                </span>
                                <span className="text-[#00eefc]">
                                  [{child.code}]
                                </span>{' '}
                                <strong>{child.title}</strong>
                              </div>
                              <div className="text-[11px] text-[#9ca3af] pl-6">
                                Canon: {formatCop(child.base_rent_cop)} ·
                                Comisión: {child.commission_pct}% · Corte: Día{' '}
                                {child.cutoff_day}
                                {childContract
                                  ? ` · ${childContract.tenant_name}`
                                  : ' · Unidad Vacante'}
                              </div>
                            </div>

                            <span
                              data-testid={`property-status-badge-${child.id}`}
                              className={`px-2 py-0.5 text-[11px] font-bold border ${
                                child.status === 'DISPONIBLE'
                                  ? 'bg-[#00FF66]/10 text-[#00FF66] border-[#00FF66]/40'
                                  : 'bg-[#00eefc]/10 text-[#00eefc] border-[#00eefc]/40'
                              }`}
                            >
                              [{child.status}]
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Smart Alerts Panel + Hazard Contract Termination */}
        <div className="xl:col-span-6 space-y-6">
          {/* Smart Alerts Panel */}
          <div className="bg-[#0d0e12] border border-[#292a2e] p-5 space-y-4">
            <div className="border-b border-[#292a2e] pb-3 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-mono font-bold uppercase tracking-wider text-white">
                  Panel de Alertas Inteligentes (Tiempo Real)
                </h3>
                <p className="text-xs font-mono text-[#9ca3af]">
                  Próximos cobros, mora respecto a fecha de corte y
                  liquidaciones pendientes
                </p>
              </div>
              <span className="text-xs font-mono text-[#ffb800]">
                {alerts.length} ALERTAS ACTIVAS
              </span>
            </div>

            <div className="space-y-3 font-mono text-xs">
              {alerts.map((alert) => {
                const badgeStyle =
                  alert.severity === 'MAGENTA'
                    ? 'border-[#ff007f] bg-[#ff007f]/10 text-[#ff007f]'
                    : alert.severity === 'AMBER'
                      ? 'border-[#ffb800] bg-[#ffb800]/10 text-[#ffb800]'
                      : 'border-[#00eefc] bg-[#00eefc]/10 text-[#00eefc]';

                return (
                  <div
                    key={alert.id}
                    className="bg-[#1a1b20] border border-[#292a2e] p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
                  >
                    <div>
                      <div className="flex items-center gap-2">
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
                    <div className="text-right">
                      <div className="text-[11px] text-[#9ca3af]">MONTO</div>
                      <div className="text-sm font-bold text-white">
                        {formatCop(alert.amount_cop)}
                      </div>
                    </div>
                  </div>
                );
              })}
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
                que finaliza el contrato vigente y restituye el inmueble a
                estado <strong className="text-[#00FF66]">[DISPONIBLE]</strong>{' '}
                para nuevo arrendamiento.
              </p>

              <label className="block font-mono text-xs">
                <span className="text-[#9ca3af] uppercase block mb-1">
                  Seleccionar Inmueble Ocupado para Entrega
                </span>
                <select
                  aria-label="Seleccionar Inmueble Ocupado para Entrega"
                  data-testid="handover-property-select"
                  value={handoverPropertyId}
                  onChange={(e) =>
                    setHandoverPropertyId(Number(e.target.value))
                  }
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
                {
                  '<<<<< EJECUTAR ENTREGA DE INQUILINO DE INMUEBLE >>>>>'
                }
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
