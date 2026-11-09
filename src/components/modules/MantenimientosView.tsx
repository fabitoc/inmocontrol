import React, { useState } from 'react';
import {
  NewMaintenanceInput,
  OwnerDashboardBundle,
} from '../../types/domain';
import {
  formatCop,
  formatCopInWords,
  normalizeEvidencePath,
} from '../../services/inmoService';

interface MantenimientosViewProps {
  bundle: OwnerDashboardBundle;
  onCreateMaintenance: (input: NewMaintenanceInput) => void;
}

export const MantenimientosView: React.FC<MantenimientosViewProps> = ({
  bundle,
  onCreateMaintenance,
}) => {
  const rentableProperties = bundle.properties.filter(
    (p) => p.property_type !== 'EDIFICIO MATRIZ'
  );
  const availableProps =
    rentableProperties.length > 0 ? rentableProperties : bundle.properties;

  const [propertyId, setPropertyId] = useState<number>(
    availableProps[0]?.id ?? 2
  );
  const [executionDate, setExecutionDate] = useState('2026-10-15');
  const [category, setCategory] = useState('PLOMERÍA HIDRÁULICA');
  const [customCategory, setCustomCategory] = useState('');
  const [description, setDescription] = useState('');
  const [technicianName, setTechnicianName] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [netCostCop, setNetCostCop] = useState<number>(180_000);
  const [receiptFileName, setReceiptFileName] = useState(
    'recibo_soporte_mantenimiento.jpg'
  );
  const [evidenceFileNames, setEvidenceFileNames] = useState<string[]>([
    'evidencia_antes_trabajo.jpg',
    'evidencia_despues_trabajo.jpg',
  ]);
  const [statusFilter, setStatusFilter] = useState<
    'TODOS' | 'Por Liquidar' | 'Liquidado'
  >('TODOS');
  const [propertyFilter, setPropertyFilter] = useState<string>('ALL');
  const [feedback, setFeedback] = useState<string | null>(null);

  const propById = new Map(bundle.properties.map((p) => [p.id, p]));

  const handleReceiptFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setReceiptFileName(file.name);
    }
  };

  const handleEvidenceFilesChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setEvidenceFileNames(Array.from(files).map((f) => f.name));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || !invoiceNumber.trim()) return;

    const normalizedReceipt = normalizeEvidencePath(receiptFileName);
    const normalizedEvidences = evidenceFileNames.map((f) =>
      normalizeEvidencePath(f)
    );

    const resolvedCategory =
      category === 'OTRA'
        ? customCategory.trim()
          ? `OTRA: ${customCategory.trim().toUpperCase()}`
          : 'OTRA'
        : category;

    onCreateMaintenance({
      property_id: Number(propertyId),
      execution_date: executionDate,
      category: resolvedCategory,
      description: description.trim(),
      technician_name: technicianName.trim() || 'Contratista Autorizado Agencia',
      invoice_number: invoiceNumber.trim().toUpperCase(),
      net_cost_cop: Number(netCostCop),
      receipt_image_path: normalizedReceipt,
      evidence_images_paths: normalizedEvidences,
    });

    setFeedback(
      `Orden ${invoiceNumber.trim().toUpperCase()} guardada en estado [Por Liquidar] con deducción 1:1 (${formatCop(netCostCop)}) y soporte en %LocalAppData%\\InmoControl\\${normalizedReceipt}`
    );
    setDescription('');
    setTechnicianName('');
    setInvoiceNumber('');
    setCustomCategory('');
  };

  const filteredMaintenances = bundle.maintenances.filter((m) => {
    if (statusFilter !== 'TODOS' && m.deduction_status !== statusFilter) {
      return false;
    }
    if (propertyFilter !== 'ALL' && m.property_id !== Number(propertyFilter)) {
      return false;
    }
    return true;
  });

  return (
    <section
      aria-label="Módulo 3: Mantenimientos"
      className="space-y-6"
      data-testid="module-mantenimientos"
    >
      <div className="bg-[#0d0e12] border border-[#292a2e] p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="text-xs font-mono text-[#00eefc] uppercase tracking-widest">
            MÓDULO 03 // BITÁCORA TÉCNICA Y ALMACENAMIENTO LOCAL DE EVIDENCIAS
          </div>
          <h2 className="text-xl font-bold text-white mt-1">
            Mantenimientos y Soportes — {bundle.selected_owner.name}
          </h2>
          <p className="text-xs font-mono text-[#9ca3af] mt-0.5">
            Ruta local de almacenamiento:{' '}
            <code className="text-[#00eefc]">
              %LocalAppData%\InmoControl\evidencias\
            </code>
          </p>
        </div>

        <div className="px-3 py-2 bg-[#ffb800]/10 border border-[#ffb800]/40 font-mono text-xs text-[#ffb800]">
          [RELACIÓN 1:1 // CERO RECARGOS OPERATIVOS DE AGENCIA]
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Maintenance Execution Form */}
        <form
          onSubmit={handleSubmit}
          className="xl:col-span-5 bg-[#0d0e12] border border-[#292a2e] p-5 space-y-4"
        >
          <div className="border-b border-[#292a2e] pb-3 flex items-center justify-between">
            <h3 className="text-sm font-mono font-bold uppercase tracking-wider text-[#00eefc]">
              Formulario de Ejecución de Mantenimiento
            </h3>
            <span className="text-xs font-mono text-[#ffb800]">
              ESTADO INICIAL: Por Liquidar
            </span>
          </div>

          <div className="space-y-3 text-xs font-mono">
            <label className="block">
              <span className="text-[#9ca3af] uppercase block mb-1">
                Inmueble Intervenido (Pre-filtrado por Propietario)
              </span>
              <select
                aria-label="Inmueble Intervenido"
                value={propertyId}
                onChange={(e) => setPropertyId(Number(e.target.value))}
                className="w-full bg-[#1a1b20] border border-[#292a2e] px-3 py-2 text-white"
              >
                {availableProps.map((p) => (
                  <option key={p.id} value={p.id}>
                    [{p.code}] {p.title}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-[#9ca3af] uppercase block mb-1">
                  Fecha de Ejecución
                </span>
                <input
                  type="date"
                  value={executionDate}
                  onChange={(e) => setExecutionDate(e.target.value)}
                  className="w-full bg-[#1a1b20] border border-[#292a2e] px-3 py-2 text-white"
                />
              </label>

              <label className="block">
                <span className="text-[#9ca3af] uppercase block mb-1">
                  Categoría Técnica
                </span>
                <select
                  aria-label="Categoría Técnica"
                  data-testid="select-maintenance-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-[#1a1b20] border border-[#292a2e] px-3 py-2 text-white"
                >
                  <option value="PLOMERÍA HIDRÁULICA">
                    Plomería Hidráulica
                  </option>
                  <option value="ELÉCTRICO // TABLERO">
                    Electricidad / Tablero
                  </option>
                  <option value="PINTURA Y ACABADOS">Pintura y Acabados</option>
                  <option value="CERRAJERÍA">Cerrajería</option>
                  <option value="IMPERMEABILIZACIÓN">
                    Impermeabilización / Obra Civil
                  </option>
                  <option value="OTRA">Otra:</option>
                </select>
                {category === 'OTRA' && (
                  <input
                    type="text"
                    aria-label="Especificar otra categoría técnica"
                    data-testid="input-custom-maintenance-category"
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    placeholder="Especificar otra categoría técnica..."
                    className="mt-2 w-full bg-[#1a1b20] border border-[#00eefc]/60 px-3 py-2 text-white"
                  />
                )}
              </label>
            </div>

            <label className="block">
              <span className="text-[#9ca3af] uppercase block mb-1">
                Descripción de la Novedad y Trabajo Realizado
              </span>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Detalle técnico del arreglo ejecutado en el inmueble..."
                className="w-full bg-[#1a1b20] border border-[#292a2e] px-3 py-2 text-white"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-[#9ca3af] uppercase block mb-1">
                  Nombre del Técnico / Contratista
                </span>
                <input
                  type="text"
                  value={technicianName}
                  onChange={(e) => setTechnicianName(e.target.value)}
                  placeholder="Ing. Hernando Téllez"
                  className="w-full bg-[#1a1b20] border border-[#292a2e] px-3 py-2 text-white"
                />
              </label>

              <label className="block">
                <span className="text-[#9ca3af] uppercase block mb-1">
                  Nº de Factura / Recibo de Soporte
                </span>
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="FAC-9940"
                  className="w-full bg-[#1a1b20] border border-[#292a2e] px-3 py-2 text-white"
                />
              </label>
            </div>

            <label className="block">
              <span className="text-[#9ca3af] uppercase block mb-1">
                Costo Neto ($ COP — Deducción exacta 1:1 en Liquidación)
              </span>
              <input
                type="number"
                data-testid="input-net-cost-cop"
                value={netCostCop}
                onChange={(e) => setNetCostCop(Number(e.target.value))}
                className="w-full bg-[#1a1b20] border border-[#ffb800]/60 px-3 py-2 text-[#ffb800] font-bold"
              />
              <span
                data-testid="net-cost-words"
                className="text-[11px] text-[#ffb800] mt-1 block"
              >
                {formatCop(netCostCop)} — {formatCopInWords(netCostCop)}
              </span>
            </label>

            {/* Single File Upload: Receipt Image */}
            <div className="bg-[#1a1b20] border border-[#292a2e] p-3 space-y-1.5">
              <label
                htmlFor="receipt-upload"
                className="text-[#9ca3af] uppercase block"
              >
                Fotografía del Recibo / Factura (`receipt_image_path` - 1
                Archivo)
              </label>
              <input
                id="receipt-upload"
                type="file"
                accept="image/*"
                onChange={handleReceiptFileChange}
                className="w-full text-xs text-[#9ca3af]"
              />
              <div className="text-[11px] text-[#00eefc] truncate">
                Destino: %LocalAppData%\InmoControl\
                {normalizeEvidencePath(receiptFileName)}
              </div>
            </div>

            {/* Multiple File Upload: Evidence Photos */}
            <div className="bg-[#1a1b20] border border-[#292a2e] p-3 space-y-1.5">
              <label
                htmlFor="evidence-upload"
                className="text-[#9ca3af] uppercase block"
              >
                Imágenes de Evidencia del Trabajo (`evidence_images_paths` -
                Múltiples)
              </label>
              <input
                id="evidence-upload"
                type="file"
                accept="image/*"
                multiple
                onChange={handleEvidenceFilesChange}
                className="w-full text-xs text-[#9ca3af]"
              />
              <div className="text-[11px] text-[#00FF66]">
                JSON Array ({evidenceFileNames.length} archivos): [
                {evidenceFileNames
                  .map((f) => `"${normalizeEvidencePath(f)}"`)
                  .join(', ')}
                ]
              </div>
            </div>
          </div>

          {feedback && (
            <div
              className="p-2.5 bg-[#00FF66]/10 border border-[#00FF66]/40 text-xs font-mono text-[#00FF66]"
              data-testid="maintenance-feedback"
            >
              {feedback}
            </div>
          )}

          <button
            type="submit"
            className="w-full py-2.5 bg-[#ffb800] text-[#0d0e12] font-mono font-bold text-xs uppercase tracking-wider hover:bg-[#ffb800]/90"
          >
            [ REGISTRAR ORDEN Y COPIAR EVIDENCIAS LOCALES ]
          </button>
        </form>

        {/* Maintenance History Table */}
        <div className="xl:col-span-7 bg-[#0d0e12] border border-[#292a2e] p-5 flex flex-col justify-between">
          <div>
            <div className="border-b border-[#292a2e] pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div>
                <h3 className="text-sm font-mono font-bold uppercase tracking-wider text-white">
                  Historial de Mantenimientos y Estado de Descuento
                </h3>
                <p className="text-xs font-mono text-[#9ca3af]">
                  Trazabilidad de facturas y evidencias fotográficas por unidad
                </p>
              </div>

              <div className="flex items-center gap-2 font-mono text-xs">
                <select
                  aria-label="Filtrar mantenimientos por inmueble"
                  value={propertyFilter}
                  onChange={(e) => setPropertyFilter(e.target.value)}
                  className="bg-[#1a1b20] border border-[#292a2e] px-2.5 py-1.5 text-white"
                >
                  <option value="ALL">Todos los Inmuebles</option>
                  {availableProps.map((p) => (
                    <option key={p.id} value={String(p.id)}>
                      {p.title}
                    </option>
                  ))}
                </select>

                <select
                  aria-label="Filtrar mantenimientos por estado"
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(
                      e.target.value as 'TODOS' | 'Por Liquidar' | 'Liquidado'
                    )
                  }
                  className="bg-[#1a1b20] border border-[#292a2e] px-2.5 py-1.5 text-white"
                >
                  <option value="TODOS">Estado: Todos</option>
                  <option value="Por Liquidar">Por Liquidar</option>
                  <option value="Liquidado">Liquidado</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table
                role="table"
                aria-label="Historial de mantenimientos del propietario"
                className="w-full text-left border-collapse font-mono text-xs"
              >
                <thead>
                  <tr className="border-b border-[#292a2e] text-[#9ca3af] bg-[#1a1b20]">
                    <th scope="col" className="py-2.5 px-3">
                      FACTURA / FECHA
                    </th>
                    <th scope="col" className="py-2.5 px-3">
                      INMUEBLE / NOVEDAD
                    </th>
                    <th scope="col" className="py-2.5 px-3">
                      SOPORTES LOCALES (`evidencias\`)
                    </th>
                    <th scope="col" className="py-2.5 px-3 text-right">
                      COSTO NETO (1:1)
                    </th>
                    <th scope="col" className="py-2.5 px-3 text-center">
                      ESTADO DEDUCCIÓN
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#292a2e]/60">
                  {filteredMaintenances.map((maint) => {
                    const prop = propById.get(maint.property_id);
                    const isPending = maint.deduction_status === 'Por Liquidar';
                    return (
                      <tr
                        key={maint.id}
                        className="hover:bg-[#1a1b20]/70 transition-colors"
                      >
                        <td className="py-2.5 px-3">
                          <div className="text-[#00eefc] font-bold">
                            {maint.invoice_number}
                          </div>
                          <div className="text-[11px] text-[#9ca3af]">
                            {maint.execution_date}
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="text-white font-semibold">
                            {prop?.title ?? `Inmueble #${maint.property_id}`} ·{' '}
                            <span className="text-[#00eefc]">
                              {maint.category}
                            </span>
                          </div>
                          <div className="text-[11px] text-[#9ca3af]">
                            {maint.description} ({maint.technician_name})
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="text-[11px] text-[#e3e2e7]">
                            Recibo: {maint.receipt_image_path}
                          </div>
                          <div className="text-[11px] text-[#9ca3af]">
                            Evidencias ({maint.evidence_images_paths.length}):{' '}
                            {maint.evidence_images_paths.join(', ')}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-[#ffb800]">
                          {formatCop(maint.net_cost_cop)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            data-testid={`maint-status-${maint.invoice_number}`}
                            className={`inline-block px-2 py-0.5 text-[11px] font-bold border ${
                              isPending
                                ? 'bg-[#ffb800]/10 text-[#ffb800] border-[#ffb800]/40'
                                : 'bg-[#00FF66]/10 text-[#00FF66] border-[#00FF66]/40'
                            }`}
                          >
                            {maint.deduction_status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="border-t border-[#292a2e] pt-3 mt-4 flex items-center justify-between text-xs font-mono text-[#9ca3af]">
            <span>
              TOTAL PENDIENTE POR LIQUIDAR:{' '}
              <strong className="text-[#ffb800]">
                {formatCop(bundle.pending_maintenance_cop)}
              </strong>
            </span>
            <span>TRANSACCIÓN VINCULADA A MÓDULO 05</span>
          </div>
        </div>
      </div>
    </section>
  );
};
