import React, { useState } from 'react';
import {
  NewContractInput,
  NewOwnerInput,
  NewPropertyInput,
  NewRentPaymentInput,
  OwnerDashboardBundle,
} from '../../types/domain';
import {
  calculatePropertyCommission,
  formatCop,
} from '../../services/inmoService';

interface RegistroControlViewProps {
  bundle: OwnerDashboardBundle;
  onCreateOwner: (input: NewOwnerInput) => void;
  onCreateProperty: (input: NewPropertyInput) => void;
  onCreateContract: (input: NewContractInput) => void;
  onRecordPayment: (input: NewRentPaymentInput) => void;
}

export const RegistroControlView: React.FC<RegistroControlViewProps> = ({
  bundle,
  onCreateOwner,
  onCreateProperty,
  onCreateContract,
  onRecordPayment,
}) => {
  // 01 // Owner Registration Form State
  const [ownerName, setOwnerName] = useState('');
  const [ownerDoc, setOwnerDoc] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [bankName, setBankName] = useState('Bancolombia');
  const [bankType, setBankType] = useState('AHORROS');
  const [bankAccount, setBankAccount] = useState('');
  const [ownerFeedback, setOwnerFeedback] = useState<string | null>(null);

  // 02 // Property & Sub-unit Registration Form State
  const [parentPropId, setParentPropId] = useState<string>('NULL');
  const [propCode, setPropCode] = useState('');
  const [propTitle, setPropTitle] = useState('');
  const [propAddress, setPropAddress] = useState('');
  const [propType, setPropType] = useState('APARTAMENTO');
  const [baseRentCop, setBaseRentCop] = useState<number>(1_600_000);
  const [commissionPct, setCommissionPct] = useState<number>(8.0);
  const [fixedFeeCop, setFixedFeeCop] = useState<number>(45_000);
  const [cutoffDay, setCutoffDay] = useState<number>(5);
  const [propStatus, setPropStatus] = useState<'DISPONIBLE' | 'OCUPADO'>(
    'DISPONIBLE'
  );
  const [propFeedback, setPropFeedback] = useState<string | null>(null);

  // 03 // Tenant Contract & Rent Payment Form State
  const rentableProperties = bundle.properties.filter(
    (p) => p.property_type !== 'EDIFICIO MATRIZ'
  );
  const [selectedPropertyId, setSelectedPropertyId] = useState<number>(
    rentableProperties[0]?.id ?? bundle.properties[0]?.id ?? 1
  );
  const [tenantName, setTenantName] = useState('');
  const [tenantDocument, setTenantDocument] = useState('');
  const [guarantorName, setGuarantorName] = useState('');
  const [tenantPhone, setTenantPhone] = useState('');
  const [contractRentCop, setContractRentCop] = useState<number>(1_500_000);
  const [startDate, setStartDate] = useState('2026-10-15');
  const [endDate, setEndDate] = useState('2027-10-14');
  const [contractCutoffDay, setContractCutoffDay] = useState<number>(5);
  const [contractFeedback, setContractFeedback] = useState<string | null>(null);

  // Quick Rent Payment Recording
  const [paymentContractId, setPaymentContractId] = useState<number>(
    bundle.contracts[0]?.id ?? 1
  );
  const [paymentPeriod, setPaymentPeriod] = useState('2026-10');
  const [paymentAmountCop, setPaymentAmountCop] = useState<number>(1_500_000);
  const [paymentMethod, setPaymentMethod] = useState('TRANSFERENCIA PSE');
  const [paymentRef, setPaymentRef] = useState('PSE-881020');
  const [paymentFeedback, setPaymentFeedback] = useState<string | null>(null);

  const liveCommission = calculatePropertyCommission(
    baseRentCop,
    commissionPct,
    fixedFeeCop
  );

  const matrixCandidates = bundle.properties.filter(
    (p) => p.parent_property_id === null
  );

  const handleOwnerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ownerName.trim() || !ownerDoc.trim()) return;
    onCreateOwner({
      name: ownerName.trim(),
      document_id: ownerDoc.trim(),
      phone: ownerPhone.trim() || '+57 300 000 0000',
      email: ownerEmail.trim() || 'contacto@inmocontrol.co',
      bank_name: bankName,
      bank_account_type: bankType,
      bank_account_number: bankAccount.trim() || '000-000000-00',
    });
    setOwnerFeedback(`Propietario "${ownerName.trim()}" registrado en SQLite.`);
    setOwnerName('');
    setOwnerDoc('');
    setOwnerPhone('');
    setOwnerEmail('');
    setBankAccount('');
  };

  const handlePropertySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!propTitle.trim() || !propCode.trim()) return;
    onCreateProperty({
      owner_id: bundle.selected_owner.id,
      parent_property_id: parentPropId === 'NULL' ? null : Number(parentPropId),
      code: propCode.trim().toUpperCase(),
      title: propTitle.trim(),
      address: propAddress.trim() || 'Dirección Registrada Localmente',
      property_type: propType,
      base_rent_cop: propType === 'EDIFICIO MATRIZ' ? 0 : Number(baseRentCop),
      commission_pct: Number(commissionPct),
      fixed_fee_cop: propType === 'EDIFICIO MATRIZ' ? 0 : Number(fixedFeeCop),
      cutoff_day: Number(cutoffDay),
      status: propStatus,
    });
    setPropFeedback(
      `Inmueble "${propTitle.trim()}" vinculado a ${bundle.selected_owner.name}.`
    );
    setPropCode('');
    setPropTitle('');
    setPropAddress('');
  };

  const handleContractSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantName.trim() || !tenantDocument.trim()) return;
    onCreateContract({
      property_id: Number(selectedPropertyId),
      tenant_name: tenantName.trim(),
      tenant_document: tenantDocument.trim(),
      guarantor_name: guarantorName.trim() || 'Póliza Arrendamiento Seguro',
      phone: tenantPhone.trim() || '+57 310 000 0000',
      monthly_rent_cop: Number(contractRentCop),
      start_date: startDate,
      end_date: endDate,
      cutoff_day: Number(contractCutoffDay),
      status: 'ACTIVO',
    });
    setContractFeedback(
      `Contrato activo creado para "${tenantName.trim()}" · Inmueble pasa a [OCUPADO].`
    );
    setTenantName('');
    setTenantDocument('');
    setGuarantorName('');
    setTenantPhone('');
  };

  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const targetContract =
      bundle.contracts.find((c) => c.id === Number(paymentContractId)) ??
      bundle.contracts[0];
    if (!targetContract) return;
    onRecordPayment({
      contract_id: targetContract.id,
      property_id: targetContract.property_id,
      period_month: paymentPeriod,
      gross_amount_cop: Number(paymentAmountCop),
      payment_date: '2026-10-15',
      payment_method: paymentMethod,
      reference_code: paymentRef.trim() || 'REF-LOCAL',
      status: 'PAGADO',
    });
    setPaymentFeedback(
      `Recaudo por ${formatCop(paymentAmountCop)} registrado en periodo ${paymentPeriod}.`
    );
  };

  return (
    <section
      aria-label="Módulo 2: Registro y Control"
      className="space-y-6"
      data-testid="module-registro-control"
    >
      <div className="bg-[#0d0e12] border border-[#292a2e] p-5">
        <div className="text-xs font-mono text-[#00eefc] uppercase tracking-widest">
          MÓDULO 02 // ENTRADA TRANSACCIONAL DE DATOS Y JERARQUÍA DE ACTIVOS
        </div>
        <h2 className="text-xl font-bold text-white mt-1">
          Registro y Control — Propietario Activo: {bundle.selected_owner.name}
        </h2>
        <p className="text-xs font-mono text-[#9ca3af] mt-0.5">
          Creación de propietarios, edificios matrices (`parent_property_id`),
          sub-unidades, contratos y recaudos mensuales.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* 01 // Registro de Propietario */}
        <form
          onSubmit={handleOwnerSubmit}
          className="xl:col-span-5 bg-[#0d0e12] border border-[#292a2e] p-5 space-y-4"
        >
          <div className="border-b border-[#292a2e] pb-3 flex items-center justify-between">
            <h3 className="text-sm font-mono font-bold uppercase tracking-wider text-[#00eefc]">
              01 // Registro de Propietario
            </h3>
            <span className="text-xs font-mono text-[#9ca3af]">
              TABLA: owners
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
            <label className="block sm:col-span-2">
              <span className="text-[#9ca3af] uppercase block mb-1">
                Nombre Completo o Razón Social
              </span>
              <input
                type="text"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="Ej. Inversiones Sabana Real S.A.S"
                className="w-full bg-[#1a1b20] border border-[#292a2e] px-3 py-2 text-white"
              />
            </label>

            <label className="block">
              <span className="text-[#9ca3af] uppercase block mb-1">
                Documento (CC / NIT)
              </span>
              <input
                type="text"
                value={ownerDoc}
                onChange={(e) => setOwnerDoc(e.target.value)}
                placeholder="NIT 901.442.110-4"
                className="w-full bg-[#1a1b20] border border-[#292a2e] px-3 py-2 text-white"
              />
            </label>

            <label className="block">
              <span className="text-[#9ca3af] uppercase block mb-1">
                Teléfono Móvil
              </span>
              <input
                type="text"
                value={ownerPhone}
                onChange={(e) => setOwnerPhone(e.target.value)}
                placeholder="+57 310 555 0192"
                className="w-full bg-[#1a1b20] border border-[#292a2e] px-3 py-2 text-white"
              />
            </label>

            <label className="block sm:col-span-2">
              <span className="text-[#9ca3af] uppercase block mb-1">
                Correo Electrónico
              </span>
              <input
                type="email"
                value={ownerEmail}
                onChange={(e) => setOwnerEmail(e.target.value)}
                placeholder="tesoreria@sabana.co"
                className="w-full bg-[#1a1b20] border border-[#292a2e] px-3 py-2 text-white"
              />
            </label>

            <label className="block">
              <span className="text-[#9ca3af] uppercase block mb-1">
                Entidad Bancaria
              </span>
              <select
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                className="w-full bg-[#1a1b20] border border-[#292a2e] px-3 py-2 text-white"
              >
                <option value="Bancolombia">Bancolombia</option>
                <option value="Banco de Bogotá">Banco de Bogotá</option>
                <option value="Davivienda">Davivienda</option>
                <option value="BBVA Colombia">BBVA Colombia</option>
              </select>
            </label>

            <label className="block">
              <span className="text-[#9ca3af] uppercase block mb-1">
                Tipo de Cuenta
              </span>
              <select
                value={bankType}
                onChange={(e) => setBankType(e.target.value)}
                className="w-full bg-[#1a1b20] border border-[#292a2e] px-3 py-2 text-white"
              >
                <option value="AHORROS">AHORROS</option>
                <option value="CORRIENTE">CORRIENTE</option>
              </select>
            </label>

            <label className="block sm:col-span-2">
              <span className="text-[#9ca3af] uppercase block mb-1">
                Número de Cuenta para Dispersión
              </span>
              <input
                type="text"
                value={bankAccount}
                onChange={(e) => setBankAccount(e.target.value)}
                placeholder="412-990123-88"
                className="w-full bg-[#1a1b20] border border-[#292a2e] px-3 py-2 text-white"
              />
            </label>
          </div>

          {ownerFeedback && (
            <div className="p-2.5 bg-[#00FF66]/10 border border-[#00FF66]/40 text-xs font-mono text-[#00FF66]">
              {ownerFeedback}
            </div>
          )}

          <button
            type="submit"
            className="w-full py-2.5 bg-[#00eefc] text-[#0d0e12] font-mono font-bold text-xs uppercase tracking-wider hover:bg-[#00eefc]/90"
          >
            [ GUARDAR PROPIETARIO EN SQLITE ]
          </button>
        </form>

        {/* 02 // Registro de Inmueble & Estructura Matriz/Sub-unidad */}
        <form
          onSubmit={handlePropertySubmit}
          className="xl:col-span-7 bg-[#0d0e12] border border-[#292a2e] p-5 space-y-4"
        >
          <div className="border-b border-[#292a2e] pb-3 flex items-center justify-between">
            <h3 className="text-sm font-mono font-bold uppercase tracking-wider text-[#00eefc]">
              02 // Registro de Inmueble y Jerarquía Matriz / Sub-unidad
            </h3>
            <span className="text-xs font-mono text-[#9ca3af]">
              FK: parent_property_id
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
            <label className="block sm:col-span-2">
              <span className="text-[#9ca3af] uppercase block mb-1">
                Propiedad Padre (`parent_property_id`)
              </span>
              <select
                aria-label="Propiedad Padre (parent_property_id)"
                value={parentPropId}
                onChange={(e) => setParentPropId(e.target.value)}
                className="w-full bg-[#1a1b20] border border-[#292a2e] px-3 py-2 text-white"
              >
                <option value="NULL">
                  NULL — Propiedad Independiente o Edificio Matriz Principal
                </option>
                {matrixCandidates.map((mat) => (
                  <option key={mat.id} value={String(mat.id)}>
                    Sub-unidad de: [{mat.code}] {mat.title}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-[#9ca3af] uppercase block mb-1">
                Código Interno Inmueble
              </span>
              <input
                type="text"
                value={propCode}
                onChange={(e) => setPropCode(e.target.value)}
                placeholder="SUB-FACA-201"
                className="w-full bg-[#1a1b20] border border-[#292a2e] px-3 py-2 text-white"
              />
            </label>

            <label className="block">
              <span className="text-[#9ca3af] uppercase block mb-1">
                Tipología de Activo
              </span>
              <select
                value={propType}
                onChange={(e) => setPropType(e.target.value)}
                className="w-full bg-[#1a1b20] border border-[#292a2e] px-3 py-2 text-white"
              >
                <option value="APARTAMENTO">APARTAMENTO</option>
                <option value="LOCAL COMERCIAL">LOCAL COMERCIAL</option>
                <option value="CASA">CASA</option>
                <option value="BODEGA">BODEGA</option>
                <option value="OFICINA">OFICINA</option>
                <option value="EDIFICIO MATRIZ">EDIFICIO MATRIZ</option>
              </select>
            </label>

            <label className="block">
              <span className="text-[#9ca3af] uppercase block mb-1">
                Título / Identificador Unidad
              </span>
              <input
                type="text"
                value={propTitle}
                onChange={(e) => setPropTitle(e.target.value)}
                placeholder="Torre 1 - Apto 201"
                className="w-full bg-[#1a1b20] border border-[#292a2e] px-3 py-2 text-white"
              />
            </label>

            <label className="block">
              <span className="text-[#9ca3af] uppercase block mb-1">
                Dirección Física
              </span>
              <input
                type="text"
                value={propAddress}
                onChange={(e) => setPropAddress(e.target.value)}
                placeholder="Cra 2 # 5-48 Apto 201, Facatativá"
                className="w-full bg-[#1a1b20] border border-[#292a2e] px-3 py-2 text-white"
              />
            </label>

            <label className="block">
              <span className="text-[#9ca3af] uppercase block mb-1">
                Canon Base Mensual ($ COP)
              </span>
              <input
                type="number"
                value={baseRentCop}
                onChange={(e) => setBaseRentCop(Number(e.target.value))}
                className="w-full bg-[#1a1b20] border border-[#292a2e] px-3 py-2 text-white"
              />
            </label>

            <label className="block">
              <span className="text-[#9ca3af] uppercase block mb-1">
                Estado Inicial
              </span>
              <select
                value={propStatus}
                onChange={(e) =>
                  setPropStatus(e.target.value as 'DISPONIBLE' | 'OCUPADO')
                }
                className="w-full bg-[#1a1b20] border border-[#292a2e] px-3 py-2 text-white"
              >
                <option value="DISPONIBLE">DISPONIBLE</option>
                <option value="OCUPADO">OCUPADO</option>
              </select>
            </label>

            {/* WCAG 2.1 AA Native Range Sliders with full ARIA attributes */}
            <div className="bg-[#1a1b20] border border-[#292a2e] p-3">
              <div className="flex justify-between items-center mb-1">
                <label
                  htmlFor="slider-commission-pct"
                  className="text-[#9ca3af] uppercase"
                >
                  Comisión Porcentual (%)
                </label>
                <span className="text-[#00eefc] font-bold">
                  {commissionPct.toFixed(1)}%
                </span>
              </div>
              <input
                id="slider-commission-pct"
                type="range"
                min={4}
                max={15}
                step={0.5}
                value={commissionPct}
                aria-label="Comisión Porcentual de Agencia"
                aria-valuemin={4}
                aria-valuemax={15}
                aria-valuenow={commissionPct}
                aria-valuetext={`${commissionPct.toFixed(1)}% de comisión sobre ingreso bruto`}
                onChange={(e) => setCommissionPct(Number(e.target.value))}
                className="w-full accent-[#00eefc] cursor-pointer"
              />
              <div className="flex justify-between text-[11px] text-[#9ca3af] mt-1">
                <span>Mín: 4.0%</span>
                <span>Equivale a {formatCop(liveCommission.percentageFeeCop)}</span>
                <span>Máx: 15.0%</span>
              </div>
            </div>

            <div className="bg-[#1a1b20] border border-[#292a2e] p-3">
              <div className="flex justify-between items-center mb-1">
                <label
                  htmlFor="slider-fixed-fee"
                  className="text-[#9ca3af] uppercase"
                >
                  Cuota Fija Base ($ COP)
                </label>
                <span className="text-[#ffb800] font-bold">
                  {formatCop(fixedFeeCop)}
                </span>
              </div>
              <input
                id="slider-fixed-fee"
                type="range"
                min={0}
                max={100000}
                step={5000}
                value={fixedFeeCop}
                aria-label="Cuota Fija Base en Pesos Colombianos"
                aria-valuemin={0}
                aria-valuemax={100000}
                aria-valuenow={fixedFeeCop}
                aria-valuetext={`${formatCop(fixedFeeCop)} pesos colombianos de cuota fija base`}
                onChange={(e) => setFixedFeeCop(Number(e.target.value))}
                className="w-full accent-[#ffb800] cursor-pointer"
              />
              <div className="flex justify-between text-[11px] text-[#9ca3af] mt-1">
                <span>$0</span>
                <span>Día Corte: {cutoffDay}</span>
                <span>$100.000</span>
              </div>
            </div>
          </div>

          {/* Live Formula Preview Box */}
          <div className="bg-[#121317] border border-[#00eefc]/40 p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 font-mono text-xs">
            <div>
              <span className="text-[#9ca3af] block">
                FÓRMULA: (INGRESO BRUTO × % COMISIÓN) + CUOTA FIJA BASE
              </span>
              <span className="text-white">
                ({formatCop(baseRentCop)} × {commissionPct.toFixed(1)}%) +{' '}
                {formatCop(fixedFeeCop)}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[#9ca3af] block">
                COMISIÓN TOTAL AGENCIA
              </span>
              <span
                className="text-base font-bold text-[#00eefc]"
                data-testid="live-commission-preview"
              >
                {formatCop(liveCommission.totalCommissionCop)}
              </span>
            </div>
          </div>

          {propFeedback && (
            <div className="p-2.5 bg-[#00FF66]/10 border border-[#00FF66]/40 text-xs font-mono text-[#00FF66]">
              {propFeedback}
            </div>
          )}

          <button
            type="submit"
            className="w-full py-2.5 bg-[#00eefc] text-[#0d0e12] font-mono font-bold text-xs uppercase tracking-wider hover:bg-[#00eefc]/90"
          >
            [ VINCULAR INMUEBLE / SUB-UNIDAD AL PORTAFOLIO ]
          </button>
        </form>
      </div>

      {/* 03 // Registro de Inquilinos, Contratos y Recaudos */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <form
          onSubmit={handleContractSubmit}
          className="lg:col-span-7 bg-[#0d0e12] border border-[#292a2e] p-5 space-y-4"
        >
          <div className="border-b border-[#292a2e] pb-3 flex items-center justify-between">
            <h3 className="text-sm font-mono font-bold uppercase tracking-wider text-[#00eefc]">
              03 // Vinculación de Inquilino y Contrato de Arrendamiento
            </h3>
            <span className="text-xs font-mono text-[#9ca3af]">
              TABLA: tenant_contracts
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
            <label className="block sm:col-span-2">
              <span className="text-[#9ca3af] uppercase block mb-1">
                Inmueble Destino
              </span>
              <select
                value={selectedPropertyId}
                onChange={(e) => setSelectedPropertyId(Number(e.target.value))}
                className="w-full bg-[#1a1b20] border border-[#292a2e] px-3 py-2 text-white"
              >
                {rentableProperties.map((p) => (
                  <option key={p.id} value={p.id}>
                    [{p.code}] {p.title} ({p.status}) —{' '}
                    {formatCop(p.base_rent_cop)}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-[#9ca3af] uppercase block mb-1">
                Nombre del Inquilino / Arrendatario
              </span>
              <input
                type="text"
                value={tenantName}
                onChange={(e) => setTenantName(e.target.value)}
                placeholder="Ej. Carolina Gómez Restrepo"
                className="w-full bg-[#1a1b20] border border-[#292a2e] px-3 py-2 text-white"
              />
            </label>

            <label className="block">
              <span className="text-[#9ca3af] uppercase block mb-1">
                Documento Inquilino (CC / NIT)
              </span>
              <input
                type="text"
                value={tenantDocument}
                onChange={(e) => setTenantDocument(e.target.value)}
                placeholder="CC 1.020.441.890"
                className="w-full bg-[#1a1b20] border border-[#292a2e] px-3 py-2 text-white"
              />
            </label>

            <label className="block">
              <span className="text-[#9ca3af] uppercase block mb-1">
                Codeudor Solidario / Póliza
              </span>
              <input
                type="text"
                value={guarantorName}
                onChange={(e) => setGuarantorName(e.target.value)}
                placeholder="Seguros Bolívar Póliza #1104"
                className="w-full bg-[#1a1b20] border border-[#292a2e] px-3 py-2 text-white"
              />
            </label>

            <label className="block">
              <span className="text-[#9ca3af] uppercase block mb-1">
                Canon Mensual Pactado ($ COP)
              </span>
              <input
                type="number"
                value={contractRentCop}
                onChange={(e) => setContractRentCop(Number(e.target.value))}
                className="w-full bg-[#1a1b20] border border-[#292a2e] px-3 py-2 text-white"
              />
            </label>

            <label className="block">
              <span className="text-[#9ca3af] uppercase block mb-1">
                Fecha Inicio
              </span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-[#1a1b20] border border-[#292a2e] px-3 py-2 text-white"
              />
            </label>

            <label className="block">
              <span className="text-[#9ca3af] uppercase block mb-1">
                Día Límite de Corte (1-28)
              </span>
              <input
                type="number"
                min={1}
                max={28}
                value={contractCutoffDay}
                onChange={(e) => setContractCutoffDay(Number(e.target.value))}
                className="w-full bg-[#1a1b20] border border-[#292a2e] px-3 py-2 text-white"
              />
            </label>
          </div>

          {contractFeedback && (
            <div className="p-2.5 bg-[#00FF66]/10 border border-[#00FF66]/40 text-xs font-mono text-[#00FF66]">
              {contractFeedback}
            </div>
          )}

          <button
            type="submit"
            className="w-full py-2.5 bg-[#00FF66] text-[#0d0e12] font-mono font-bold text-xs uppercase tracking-wider hover:bg-[#00FF66]/90"
          >
            [ FORMALIZAR CONTRATO Y OCUPAR INMUEBLE ]
          </button>
        </form>

        {/* Quick Rent Payment Form */}
        <form
          onSubmit={handlePaymentSubmit}
          className="lg:col-span-5 bg-[#0d0e12] border border-[#292a2e] p-5 space-y-4 flex flex-col justify-between"
        >
          <div className="space-y-4">
            <div className="border-b border-[#292a2e] pb-3 flex items-center justify-between">
              <h3 className="text-sm font-mono font-bold uppercase tracking-wider text-[#00FF66]">
                04 // Registro de Recaudo Mensual
              </h3>
              <span className="text-xs font-mono text-[#9ca3af]">
                TABLA: rent_payments
              </span>
            </div>

            <div className="space-y-3 text-xs font-mono">
              <label className="block">
                <span className="text-[#9ca3af] uppercase block mb-1">
                  Contrato Activo
                </span>
                <select
                  value={paymentContractId}
                  onChange={(e) =>
                    setPaymentContractId(Number(e.target.value))
                  }
                  className="w-full bg-[#1a1b20] border border-[#292a2e] px-3 py-2 text-white"
                >
                  {bundle.contracts.map((c) => (
                    <option key={c.id} value={c.id}>
                      #{c.id} — {c.tenant_name} ({formatCop(c.monthly_rent_cop)}
                      )
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-[#9ca3af] uppercase block mb-1">
                    Periodo Contable
                  </span>
                  <input
                    type="text"
                    value={paymentPeriod}
                    onChange={(e) => setPaymentPeriod(e.target.value)}
                    className="w-full bg-[#1a1b20] border border-[#292a2e] px-3 py-2 text-white"
                  />
                </label>

                <label className="block">
                  <span className="text-[#9ca3af] uppercase block mb-1">
                    Valor Recaudado ($ COP)
                  </span>
                  <input
                    type="number"
                    value={paymentAmountCop}
                    onChange={(e) =>
                      setPaymentAmountCop(Number(e.target.value))
                    }
                    className="w-full bg-[#1a1b20] border border-[#292a2e] px-3 py-2 text-white"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-[#9ca3af] uppercase block mb-1">
                    Medio de Pago
                  </span>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full bg-[#1a1b20] border border-[#292a2e] px-3 py-2 text-white"
                  >
                    <option value="TRANSFERENCIA PSE">TRANSFERENCIA PSE</option>
                    <option value="CONSIGNACIÓN BANCARIA">
                      CONSIGNACIÓN BANCARIA
                    </option>
                    <option value="TRANSFERENCIA ACH">TRANSFERENCIA ACH</option>
                  </select>
                </label>

                <label className="block">
                  <span className="text-[#9ca3af] uppercase block mb-1">
                    Referencia Bancaria
                  </span>
                  <input
                    type="text"
                    value={paymentRef}
                    onChange={(e) => setPaymentRef(e.target.value)}
                    className="w-full bg-[#1a1b20] border border-[#292a2e] px-3 py-2 text-white"
                  />
                </label>
              </div>
            </div>

            {paymentFeedback && (
              <div className="p-2.5 bg-[#00FF66]/10 border border-[#00FF66]/40 text-xs font-mono text-[#00FF66]">
                {paymentFeedback}
              </div>
            )}
          </div>

          <button
            type="submit"
            className="w-full py-2.5 bg-[#1a1b20] border border-[#00FF66] text-[#00FF66] font-mono font-bold text-xs uppercase tracking-wider hover:bg-[#00FF66]/10"
          >
            [ REGISTRAR ABONO EN LIBRO MAYOR ]
          </button>
        </form>
      </div>
    </section>
  );
};
