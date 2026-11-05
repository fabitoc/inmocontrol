import React, { useEffect, useRef, useState } from 'react';
import {
  NewContractInput,
  NewOwnerInput,
  NewPropertyInput,
  NewRentPaymentInput,
  OwnerDashboardBundle,
  Property,
  PropertyCoOwner,
  PropertyStatus,
  TenantContract,
} from '../../types/domain';
import {
  calculatePropertyCommission,
  formatCop,
  formatCopInWords,
  formatPeriodMonthLabel,
  getContractBillingCycleState,
  getCurrentPeriodMonth,
  getOwnerSharePct,
  getPeriodCollectionStatus,
} from '../../services/inmoService';

interface SubdivisionDraft {
  id: string;
  code: string;
  title: string;
  property_type: string;
  base_rent_cop: number;
  status: PropertyStatus;
  customCommission: boolean;
  commission_pct: number;
}

interface RegistroControlViewProps {
  bundle: OwnerDashboardBundle;
  onCreateOwner: (input: NewOwnerInput) => void;
  onCreateProperty: (input: NewPropertyInput) => Property | void;
  onCreateContract: (input: NewContractInput) => TenantContract | void;
  onRecordPayment: (input: NewRentPaymentInput) => void;
}

type RegistroControlTab = 'propietario' | 'inmueble' | 'inquilino' | 'recaudo';

const TABS: Array<{
  id: RegistroControlTab;
  code: string;
  label: string;
  subtitle: string;
}> = [
  {
    id: 'propietario',
    code: '01',
    label: '01 // Registro de Propietario',
    subtitle: 'TABLA: owners · Directorio Bancario',
  },
  {
    id: 'inmueble',
    code: '02',
    label: '02 // Registro de Inmueble',
    subtitle: 'TABLA: properties · Jerarquía Matriz / Sub-unidad',
  },
  {
    id: 'inquilino',
    code: '03',
    label: '03 // Vinculación de Inquilino',
    subtitle: 'TABLA: tenant_contracts · Pólizas y Arrendamiento',
  },
  {
    id: 'recaudo',
    code: '04',
    label: '04 // Recaudo Mensual',
    subtitle: 'TABLA: rent_payments · Libro Mayor de Abonos',
  },
];

export const RegistroControlView: React.FC<RegistroControlViewProps> = ({
  bundle,
  onCreateOwner,
  onCreateProperty,
  onCreateContract,
  onRecordPayment,
}) => {
  const [activeTab, setActiveTab] = useState<RegistroControlTab>('propietario');

  // 01 // Owner Registration Form State
  const [ownerName, setOwnerName] = useState('');
  const [ownerDoc, setOwnerDoc] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [bankName, setBankName] = useState('Bancolombia');
  const [bankType, setBankType] = useState('AHORROS');
  const [bankAccount, setBankAccount] = useState('');
  const [ownerCutoffDay, setOwnerCutoffDay] = useState<number>(5);
  const [ownerFeedback, setOwnerFeedback] = useState<string | null>(null);

  // 02 // Property & Subdivisions Registration Form State
  const [selectedOwnerForProp, setSelectedOwnerForProp] = useState<number>(
    bundle.selected_owner.id
  );
  const [hasCoOwners, setHasCoOwners] = useState<boolean>(false);
  const [coOwners, setCoOwners] = useState<PropertyCoOwner[]>(() => {
    const defaultCo = bundle.all_owners.find(
      (o) => o.id !== bundle.selected_owner.id
    );
    return defaultCo ? [{ owner_id: defaultCo.id, share_pct: 50 }] : [];
  });
  const [hasSubdivisions, setHasSubdivisions] = useState<boolean>(false);
  const [propCode, setPropCode] = useState('');
  const [propTitle, setPropTitle] = useState('');
  const [propAddress, setPropAddress] = useState('');
  const [propType, setPropType] = useState('APARTAMENTO');
  const [baseRentCop, setBaseRentCop] = useState<number>(1_600_000);
  const [commissionPct, setCommissionPct] = useState<number>(8.0);
  const [propStatus, setPropStatus] = useState<PropertyStatus>('DISPONIBLE');
  const [expandedParentIds, setExpandedParentIds] = useState<
    Record<number, boolean>
  >({});

  const isParentExpanded = (parentId: number) =>
    expandedParentIds[parentId] ?? true;

  const toggleParentSummary = (parentId: number) => {
    setExpandedParentIds((prev) => ({
      ...prev,
      [parentId]: !(prev[parentId] ?? true),
    }));
  };

  useEffect(() => {
    setSelectedOwnerForProp(bundle.selected_owner.id);
  }, [bundle.selected_owner.id]);
  const [subdivisions, setSubdivisions] = useState<SubdivisionDraft[]>([
    {
      id: 'sub-1',
      code: 'SUB-101',
      title: 'Apto 101 - Piso 1',
      property_type: 'APARTAMENTO',
      base_rent_cop: 1_500_000,
      status: 'DISPONIBLE',
      customCommission: false,
      commission_pct: 8.0,
    },
    {
      id: 'sub-2',
      code: 'SUB-102',
      title: 'Apto 102 - Piso 1',
      property_type: 'APARTAMENTO',
      base_rent_cop: 1_500_000,
      status: 'DISPONIBLE',
      customCommission: false,
      commission_pct: 8.0,
    },
  ]);
  const [propFeedback, setPropFeedback] = useState<string | null>(null);

  // 03 // Tenant Contract Form State
  const currentSystemPeriod = getCurrentPeriodMonth();
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
  const [contractRentCop, setContractRentCop] = useState<number>(
    rentableProperties[0]?.base_rent_cop ?? 1_500_000
  );
  const [contractPaymentMode, setContractPaymentMode] = useState<
    'COMPLETO' | 'ABONO'
  >('COMPLETO');
  const [contractInitialPaymentCop, setContractInitialPaymentCop] =
    useState<number>(rentableProperties[0]?.base_rent_cop ?? 1_500_000);
  const [contractPaymentPeriod, setContractPaymentPeriod] =
    useState<string>(currentSystemPeriod);
  const [contractPaymentMethod, setContractPaymentMethod] =
    useState('TRANSFERENCIA PSE');
  const [contractPaymentRef, setContractPaymentRef] =
    useState('INGRESO-INQ-01');
  const [startDate, setStartDate] = useState(
    `${currentSystemPeriod}-01`
  );
  const [endDate] = useState('2027-10-31');
  const [contractCutoffDay, setContractCutoffDay] = useState<number>(5);
  const [contractFeedback, setContractFeedback] = useState<string | null>(null);
  const [contractError, setContractError] = useState<string | null>(null);

  // 04 // Quick Rent Payment Recording Form State
  const paymentPeriodSelectRef = useRef<HTMLSelectElement | null>(null);

  const [paymentPropertyId, setPaymentPropertyId] = useState<number>(
    rentableProperties[0]?.id ??
      bundle.contracts[0]?.property_id ??
      bundle.properties[0]?.id ??
      2
  );
  const [paymentPeriod, setPaymentPeriod] =
    useState<string>(currentSystemPeriod);
  const [paymentAmountCop, setPaymentAmountCop] = useState<number>(() => {
    const initialPropId =
      rentableProperties[0]?.id ??
      bundle.contracts[0]?.property_id ??
      bundle.properties[0]?.id ??
      2;
    const status = getPeriodCollectionStatus(
      initialPropId,
      currentSystemPeriod,
      bundle.properties,
      bundle.contracts,
      bundle.payments
    );
    return status.remainingBalanceCop;
  });
  const [paymentMethod, setPaymentMethod] = useState('TRANSFERENCIA PSE');
  const [paymentRef, setPaymentRef] = useState('PSE-881020');
  const [paymentFeedback, setPaymentFeedback] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  useEffect(() => {
    if (rentableProperties.length > 0) {
      const stillValid = rentableProperties.some(
        (p) => p.id === Number(selectedPropertyId)
      );
      if (!stillValid) {
        setSelectedPropertyId(rentableProperties[0].id);
      }
    }
  }, [bundle.selected_owner.id, rentableProperties.length]);

  // Sync Tab 03 contractRentCop and initial payment with the selected property's base_rent_cop when property changes
  useEffect(() => {
    const targetProp = bundle.properties.find(
      (p) => p.id === Number(selectedPropertyId)
    );
    if (targetProp && targetProp.base_rent_cop > 0) {
      setContractRentCop(targetProp.base_rent_cop);
      setContractInitialPaymentCop(
        contractPaymentMode === 'COMPLETO'
          ? targetProp.base_rent_cop
          : Math.round(targetProp.base_rent_cop / 2)
      );
      setContractError(null);
    }
  }, [selectedPropertyId, bundle.properties.length]);

  useEffect(() => {
    if (rentableProperties.length > 0) {
      const stillValid = rentableProperties.some(
        (p) => p.id === Number(paymentPropertyId)
      );
      if (!stillValid) {
        const fallbackId =
          bundle.contracts[0]?.property_id ?? rentableProperties[0].id;
        setPaymentPropertyId(fallbackId);
      }
    }
  }, [bundle.selected_owner.id, rentableProperties.length]);

  // Focus Periodo Contable field when entering Tab 04 (Recaudo Mensual)
  useEffect(() => {
    if (activeTab === 'recaudo') {
      paymentPeriodSelectRef.current?.focus();
    }
  }, [activeTab]);

  // Automatically sync active billing period and Valor Recaudado ($ COP) with the contract's registration date, cutoff date, and remaining period balance
  useEffect(() => {
    const cycle = getContractBillingCycleState(
      Number(paymentPropertyId),
      bundle.properties,
      bundle.contracts,
      bundle.payments
    );
    const resolvedPeriod = cycle.collectiblePeriods.includes(paymentPeriod)
      ? paymentPeriod
      : cycle.activePeriod;
    if (resolvedPeriod !== paymentPeriod) {
      setPaymentPeriod(resolvedPeriod);
    }
    const status = getPeriodCollectionStatus(
      Number(paymentPropertyId),
      resolvedPeriod,
      bundle.properties,
      bundle.contracts,
      bundle.payments
    );
    setPaymentAmountCop(status.remainingBalanceCop);
    setPaymentError(null);
  }, [
    paymentPropertyId,
    paymentPeriod,
    bundle.selected_owner.id,
    bundle.properties.length,
    bundle.contracts.length,
    bundle.payments.length,
  ]);

  const liveCommission = calculatePropertyCommission(
    baseRentCop,
    commissionPct,
    0
  );

  const getSubdivisionCommission = (sub: SubdivisionDraft) => {
    const effPct = sub.customCommission ? sub.commission_pct : commissionPct;
    return {
      effPct,
      ...calculatePropertyCommission(sub.base_rent_cop, effPct, 0),
    };
  };

  const subdivisionsTotalRentCop = subdivisions.reduce(
    (sum, s) => sum + Number(s.base_rent_cop || 0),
    0
  );

  const subdivisionsTotalCommissionCop = subdivisions.reduce(
    (sum, s) => sum + getSubdivisionCommission(s).totalCommissionCop,
    0
  );

  const subdivisionsNetOwnerCop = Math.max(
    0,
    subdivisionsTotalRentCop - subdivisionsTotalCommissionCop
  );

  const handleAddSubdivision = () => {
    const nextIdx = subdivisions.length + 1;
    setSubdivisions((prev) => [
      ...prev,
      {
        id: `sub-${Date.now()}-${nextIdx}`,
        code: `SUB-10${nextIdx}`,
        title: `Apto 10${nextIdx}`,
        property_type: 'APARTAMENTO',
        base_rent_cop: 1_500_000,
        status: 'DISPONIBLE',
        customCommission: false,
        commission_pct: commissionPct,
      },
    ]);
  };

  const handleUpdateSubdivision = (
    id: string,
    patch: Partial<SubdivisionDraft>
  ) => {
    setSubdivisions((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );
  };

  const handleRemoveSubdivision = (id: string) => {
    setSubdivisions((prev) =>
      prev.length > 1 ? prev.filter((item) => item.id !== id) : prev
    );
  };

  const availableCoOwnerCandidates = bundle.all_owners.filter(
    (o) => o.id !== Number(selectedOwnerForProp)
  );

  const coOwnersTotalSharePct = hasCoOwners
    ? coOwners.reduce((sum, co) => sum + Number(co.share_pct || 0), 0)
    : 0;
  const primaryOwnerSharePct = Math.max(0, 100 - coOwnersTotalSharePct);

  const handleAddCoOwner = () => {
    const usedIds = new Set([
      Number(selectedOwnerForProp),
      ...coOwners.map((c) => c.owner_id),
    ]);
    const nextCandidate =
      bundle.all_owners.find((o) => !usedIds.has(o.id)) ??
      availableCoOwnerCandidates[0];
    if (!nextCandidate) return;

    setCoOwners((prev) => [
      ...prev,
      {
        owner_id: nextCandidate.id,
        share_pct: 25,
      },
    ]);
  };

  const handleUpdateCoOwner = (
    idx: number,
    patch: Partial<PropertyCoOwner>
  ) => {
    setCoOwners((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, ...patch } : item))
    );
  };

  const handleRemoveCoOwner = (idx: number) => {
    setCoOwners((prev) => prev.filter((_, i) => i !== idx));
  };

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
      cutoff_day: Number(ownerCutoffDay),
    });
    setOwnerFeedback(
      `Propietario "${ownerName.trim()}" registrado en SQLite (Corte/Liquidación: Día ${ownerCutoffDay}).`
    );
    setOwnerName('');
    setOwnerDoc('');
    setOwnerPhone('');
    setOwnerEmail('');
    setBankAccount('');
  };

  const handlePropertySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const isMultiMode = hasSubdivisions || propType === 'EDIFICIO MATRIZ';
    const suffix = String(bundle.properties.length + 1).padStart(2, '0');
    const resolvedCode = (
      propCode.trim() || (isMultiMode ? `MAT-NORTE-${suffix}` : `APT-FACA-${suffix}`)
    ).toUpperCase();
    const resolvedTitle =
      propTitle.trim() ||
      (isMultiMode
        ? `Edificio Matriz ${suffix}`
        : `Inmueble Registrado ${suffix}`);
    const resolvedAddress =
      propAddress.trim() || 'Dirección Registrada Localmente';
    const targetOwnerObj =
      bundle.all_owners.find((o) => o.id === Number(selectedOwnerForProp)) ??
      bundle.selected_owner;
    const ownerCutoff = targetOwnerObj.cutoff_day ?? 5;
    const secondaryCoOwners =
      hasCoOwners && coOwners.length > 0
        ? coOwners.filter((co) => co.owner_id !== targetOwnerObj.id)
        : [];
    const normalizedCoOwners: PropertyCoOwner[] | undefined =
      secondaryCoOwners.length > 0
        ? [
            {
              owner_id: targetOwnerObj.id,
              share_pct: Math.max(
                0,
                100 -
                  secondaryCoOwners.reduce(
                    (sum, co) => sum + Number(co.share_pct || 0),
                    0
                  )
              ),
            },
            ...secondaryCoOwners.map((co) => ({
              owner_id: Number(co.owner_id),
              share_pct: Number(co.share_pct),
            })),
          ]
        : undefined;

    if (!isMultiMode) {
      const createdSingle = onCreateProperty({
        owner_id: targetOwnerObj.id,
        co_owners: normalizedCoOwners,
        parent_property_id: null,
        code: resolvedCode,
        title: resolvedTitle,
        address: resolvedAddress,
        property_type: propType,
        base_rent_cop: Number(baseRentCop),
        commission_pct: Number(commissionPct),
        fixed_fee_cop: 0,
        cutoff_day: ownerCutoff,
        status: propStatus,
      });
      if (createdSingle && typeof createdSingle === 'object') {
        setExpandedParentIds((prev) => ({
          ...prev,
          [createdSingle.id]: false,
        }));
        setSelectedPropertyId(createdSingle.id);
        setPaymentPropertyId(createdSingle.id);
      }
      const coText = secondaryCoOwners.length
        ? ` (+ ${secondaryCoOwners.length} copropietario(s))`
        : '';
      setPropFeedback(
        `Inmueble único "${resolvedTitle}" vinculado a ${targetOwnerObj.name}${coText}.`
      );
    } else {
      const validSubs = subdivisions.filter(
        (s) => s.code.trim() || s.title.trim()
      );
      const createdParent = onCreateProperty({
        owner_id: targetOwnerObj.id,
        co_owners: normalizedCoOwners,
        parent_property_id: null,
        code: resolvedCode,
        title: resolvedTitle,
        address: resolvedAddress,
        property_type: 'EDIFICIO MATRIZ',
        base_rent_cop: 0,
        commission_pct: Number(commissionPct),
        fixed_fee_cop: 0,
        cutoff_day: ownerCutoff,
        status: 'DISPONIBLE',
      });

      const parentId =
        createdParent && typeof createdParent === 'object'
          ? createdParent.id
          : null;

      if (parentId !== null) {
        setExpandedParentIds((prev) => ({
          ...prev,
          [parentId]: true,
        }));
      }

      validSubs.forEach((sub, idx) => {
        const effPct = sub.customCommission
          ? Number(sub.commission_pct)
          : Number(commissionPct);
        const subCode = (sub.code.trim() || `SUB-10${idx + 1}`).toUpperCase();
        const subTitle = sub.title.trim() || `Unidad ${idx + 1}`;

        const createdSub = onCreateProperty({
          owner_id: targetOwnerObj.id,
          co_owners: normalizedCoOwners,
          parent_property_id: parentId,
          code: subCode,
          title: `${resolvedTitle} - ${subTitle}`,
          address: resolvedAddress,
          property_type: sub.property_type,
          base_rent_cop: Number(sub.base_rent_cop),
          commission_pct: effPct,
          fixed_fee_cop: 0,
          cutoff_day: ownerCutoff,
          status: sub.status,
        });
        if (idx === 0 && createdSub && typeof createdSub === 'object') {
          setSelectedPropertyId(createdSub.id);
          setPaymentPropertyId(createdSub.id);
        }
      });

      const coText = secondaryCoOwners.length
        ? ` (+ ${secondaryCoOwners.length} copropietario(s))`
        : '';
      setPropFeedback(
        `Propiedad Matriz "${resolvedTitle}" + ${validSubs.length} subdivisiones vinculadas a ${targetOwnerObj.name}${coText}.`
      );
    }

    setPropCode('');
    setPropTitle('');
    setPropAddress('');
  };

  const effectiveContractInitialPaymentCop =
    contractPaymentMode === 'COMPLETO'
      ? Number(contractRentCop || 0)
      : Number(contractInitialPaymentCop || 0);

  const contractRemainingBalanceCop = Math.max(
    0,
    Number(contractRentCop || 0) - effectiveContractInitialPaymentCop
  );

  const handleContractSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantName.trim() || !tenantDocument.trim()) {
      setContractError(
        'Debes ingresar el nombre y documento del inquilino para formalizar el contrato.'
      );
      setContractFeedback(null);
      return;
    }

    const agreedCop = Number(contractRentCop || 0);
    const initialPaidCop = effectiveContractInitialPaymentCop;

    if (initialPaidCop <= 0) {
      setContractError(
        'Operación bloqueada: El inquilino debe entregar un abono mayor a $0 COP o el pago completo del alquiler al registrarse.'
      );
      setContractFeedback(null);
      return;
    }

    if (agreedCop > 0 && initialPaidCop > agreedCop) {
      setContractError(
        `Operación bloqueada: El abono inicial de ${formatCop(initialPaidCop)} supera el canon mensual pactado del inmueble (${formatCop(agreedCop)}).`
      );
      setContractFeedback(null);
      return;
    }

    const existingPeriodStatus = getPeriodCollectionStatus(
      Number(selectedPropertyId),
      contractPaymentPeriod,
      bundle.properties,
      bundle.contracts,
      bundle.payments
    );
    if (
      agreedCop > 0 &&
      existingPeriodStatus.alreadyCollectedCop + initialPaidCop > agreedCop
    ) {
      setContractError(
        `Operación bloqueada: El pago inicial de ${formatCop(initialPaidCop)} supera el saldo disponible del periodo ${contractPaymentPeriod} (${formatCop(existingPeriodStatus.remainingBalanceCop)}).`
      );
      setContractFeedback(null);
      return;
    }

    const createdContract = onCreateContract({
      property_id: Number(selectedPropertyId),
      tenant_name: tenantName.trim(),
      tenant_document: tenantDocument.trim(),
      guarantor_name: guarantorName.trim() || 'Póliza Arrendamiento Seguro',
      phone: tenantPhone.trim() || '+57 310 000 0000',
      monthly_rent_cop: agreedCop,
      start_date: startDate,
      end_date: endDate,
      cutoff_day: Number(contractCutoffDay),
      status: 'ACTIVO',
    });

    const contractId =
      createdContract && typeof createdContract === 'object'
        ? createdContract.id
        : 0;

    onRecordPayment({
      contract_id: contractId,
      property_id: Number(selectedPropertyId),
      period_month: contractPaymentPeriod,
      gross_amount_cop: initialPaidCop,
      payment_date: startDate || new Date().toISOString().slice(0, 10),
      payment_method: contractPaymentMethod,
      reference_code:
        contractPaymentRef.trim() ||
        (contractPaymentMode === 'COMPLETO'
          ? 'PAGO-COMPLETO-INGRESO'
          : 'ABONO-INGRESO'),
      status: 'PAGADO',
    });

    setPaymentPropertyId(Number(selectedPropertyId));
    setPaymentPeriod(contractPaymentPeriod);
    setContractError(null);

    const modeBadge =
      initialPaidCop >= agreedCop
        ? `Pago Completo 100% (${formatCop(initialPaidCop)})`
        : `Abono Inicial (${formatCop(initialPaidCop)} · Saldo pendiente en ${contractPaymentPeriod}: ${formatCop(agreedCop - initialPaidCop)})`;

    setContractFeedback(
      `Contrato activo creado para "${tenantName.trim()}" · ${modeBadge} registrado en ${contractPaymentPeriod} · Inmueble pasa a [OCUPADO].`
    );
    setTenantName('');
    setTenantDocument('');
    setGuarantorName('');
    setTenantPhone('');
  };

  const activePaymentProperty =
    rentableProperties.find((p) => p.id === Number(paymentPropertyId)) ??
    rentableProperties[0] ??
    bundle.properties[0];

  const activePaymentContract = activePaymentProperty
    ? (bundle.contracts.find(
        (c) =>
          c.property_id === activePaymentProperty.id &&
          c.status !== 'FINALIZADO'
      ) ??
      bundle.contracts.find((c) => c.property_id === activePaymentProperty.id))
    : bundle.contracts[0];

  const activePaymentOwnerSharePct = activePaymentProperty
    ? getOwnerSharePct(activePaymentProperty, bundle.selected_owner.id)
    : 100;

  const activeBillingCycle = getContractBillingCycleState(
    activePaymentProperty?.id ?? Number(paymentPropertyId),
    bundle.properties,
    bundle.contracts,
    bundle.payments
  );

  const periodCollectionStatus = activePaymentProperty
    ? getPeriodCollectionStatus(
        activePaymentProperty.id,
        paymentPeriod,
        bundle.properties,
        bundle.contracts,
        bundle.payments,
        activePaymentContract?.id
      )
    : {
        agreedRentCop: 0,
        alreadyCollectedCop: 0,
        remainingBalanceCop: 0,
        isFullyPaid: false,
      };

  const resolvePropertyCoOwnerShares = (
    prop: Property
  ): PropertyCoOwner[] => {
    if (!prop.co_owners || prop.co_owners.length === 0) {
      return [{ owner_id: prop.owner_id, share_pct: 100 }];
    }
    if (prop.co_owners.some((co) => co.owner_id === prop.owner_id)) {
      return prop.co_owners;
    }
    return [
      {
        owner_id: prop.owner_id,
        share_pct: getOwnerSharePct(prop, prop.owner_id),
      },
      ...prop.co_owners,
    ];
  };

  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePaymentProperty) return;

    if (paymentPeriod < activeBillingCycle.registrationPeriod) {
      setPaymentError(
        `Operación bloqueada: No se pueden cobrar meses anteriores (${paymentPeriod}) a la fecha de registro del inquilino (${activeBillingCycle.registrationDate}).`
      );
      setPaymentFeedback(null);
      return;
    }

    if (paymentPeriod > currentSystemPeriod) {
      setPaymentError(
        `Operación bloqueada: El periodo ${paymentPeriod} aún no ha llegado. El cobro se activa únicamente al llegar la fecha de corte (${activeBillingCycle.nextCutoffDate}).`
      );
      setPaymentFeedback(null);
      return;
    }

    const amount = Number(paymentAmountCop || 0);
    if (amount <= 0) {
      setPaymentError(
        'El valor del abono o recaudo debe ser mayor a $0 COP.'
      );
      setPaymentFeedback(null);
      return;
    }

    if (
      periodCollectionStatus.agreedRentCop > 0 &&
      periodCollectionStatus.alreadyCollectedCop + amount >
        periodCollectionStatus.agreedRentCop
    ) {
      setPaymentError(
        `Operación bloqueada: El abono de ${formatCop(amount)} supera el saldo pendiente del periodo ${paymentPeriod} (Valor pactado: ${formatCop(periodCollectionStatus.agreedRentCop)} · Ya abonado: ${formatCop(periodCollectionStatus.alreadyCollectedCop)} · Saldo máximo permitido: ${formatCop(periodCollectionStatus.remainingBalanceCop)}).`
      );
      setPaymentFeedback(null);
      return;
    }

    try {
      onRecordPayment({
        contract_id: activePaymentContract?.id ?? 0,
        property_id: activePaymentProperty.id,
        period_month: paymentPeriod,
        gross_amount_cop: amount,
        payment_date: new Date().toISOString().slice(0, 10),
        payment_method: paymentMethod,
        reference_code: paymentRef.trim() || 'REF-LOCAL',
        status: 'PAGADO',
      });

      const nextRemaining = Math.max(
        0,
        periodCollectionStatus.remainingBalanceCop - amount
      );
      setPaymentAmountCop(nextRemaining);
      setPaymentError(null);

      const shareSuffix =
        activePaymentOwnerSharePct < 100
          ? ` · Dividendo ${bundle.selected_owner.name} (${activePaymentOwnerSharePct}%): ${formatCop(Math.round(amount * (activePaymentOwnerSharePct / 100)))}`
          : '';
      const balanceSuffix =
        nextRemaining > 0
          ? ` · Saldo pendiente en ${paymentPeriod}: ${formatCop(nextRemaining)}`
          : ` · Periodo ${paymentPeriod} 100% Paz y Salvo`;
      setPaymentFeedback(
        `Recaudo por ${formatCop(amount)} registrado en periodo ${paymentPeriod}${shareSuffix}${balanceSuffix}.`
      );
    } catch (err) {
      setPaymentError(
        err instanceof Error
          ? err.message
          : 'Error al validar el límite de recaudo del periodo.'
      );
      setPaymentFeedback(null);
    }
  };

  return (
    <section
      aria-label="Módulo 2: Registro y Control"
      className="space-y-6"
      data-testid="module-registro-control"
    >
      {/* Header & Single Top Sub-view Tab Bar */}
      <div className="bg-[#0d0e12] border border-[#292a2e] p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2">
          <div>
            <div className="text-xs font-mono text-[#00eefc] uppercase tracking-widest">
              MÓDULO 02 // ENTRADA TRANSACCIONAL DE DATOS Y JERARQUÍA DE ACTIVOS
            </div>
            <h2 className="text-xl font-bold text-white mt-1">
              Registro y Control — Propietario Activo:{' '}
              {bundle.selected_owner.name}
            </h2>
            <p className="text-xs font-mono text-[#9ca3af] mt-0.5">
              Selecciona la operación transaccional a ejecutar. Cada sub-vista
              opera de forma independiente sobre el motor relacional.
            </p>
          </div>
          <div className="text-xs font-mono text-[#9ca3af] border border-[#292a2e] bg-[#14151a] px-3 py-2">
            VISTA ACTIVA:{' '}
            <span className="text-[#00eefc] font-bold uppercase">
              {TABS.find((t) => t.id === activeTab)?.label}
            </span>
          </div>
        </div>

        {/* Single Top Tab Bar */}
        <div
          role="tablist"
          aria-label="Sub-vistas de Registro y Control"
          className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2 pt-2 border-t border-[#292a2e]"
        >
          {TABS.map((tab) => {
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`tab-btn-${tab.id}`}
                type="button"
                role="tab"
                aria-selected={isSelected}
                aria-controls={`tabpanel-${tab.id}`}
                data-testid={`tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`text-left px-3.5 py-2.5 border font-mono transition-colors ${
                  isSelected
                    ? 'bg-[#00eefc]/10 border-[#00eefc] text-white'
                    : 'bg-[#14151a] border-[#292a2e] text-[#9ca3af] hover:border-[#00eefc]/40 hover:text-white'
                }`}
              >
                <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider">
                  <span className={isSelected ? 'text-[#00eefc]' : 'text-white'}>
                    {tab.label}
                  </span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 border ${
                      isSelected
                        ? 'border-[#00eefc] text-[#00eefc]'
                        : 'border-[#292a2e] text-[#9ca3af]'
                    }`}
                  >
                    {tab.code}
                  </span>
                </div>
                <div className="text-[11px] text-[#9ca3af] mt-1 truncate">
                  {tab.subtitle}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB PANEL 01 // REGISTRO DE PROPIETARIO */}
      {activeTab === 'propietario' && (
        <div
          id="tabpanel-propietario"
          role="tabpanel"
          aria-labelledby="tab-btn-propietario"
          data-testid="panel-propietario"
          className="grid grid-cols-1 xl:grid-cols-12 gap-6"
        >
          <form
            onSubmit={handleOwnerSubmit}
            className="xl:col-span-6 bg-[#0d0e12] border border-[#292a2e] p-5 space-y-4"
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

              <label className="block">
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

              <div className="block">
                <div className="flex items-center justify-between mb-1">
                  <label
                    htmlFor="select-cutoff-day"
                    className="text-[#9ca3af] uppercase"
                  >
                    Fecha de Corte / Liquidación
                  </label>
                  <span
                    className="text-[#ffb800] font-bold"
                    data-testid="cutoff-day-display"
                  >
                    Día {ownerCutoffDay} de cada mes
                  </span>
                </div>
                <select
                  id="select-cutoff-day"
                  data-testid="select-cutoff-day"
                  aria-label="Fecha de Corte Mensual"
                  value={ownerCutoffDay}
                  onChange={(e) => setOwnerCutoffDay(Number(e.target.value))}
                  className="w-full bg-[#1a1b20] border border-[#ffb800]/60 px-3 py-2 text-white font-bold"
                >
                  {Array.from({ length: 30 }, (_, idx) => idx + 1).map(
                    (day) => (
                      <option key={day} value={day}>
                        Día {day} del mes (Entrega de cuentas)
                      </option>
                    )
                  )}
                </select>
              </div>
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

          {/* Context Column: Directorio de Propietarios Registrados */}
          <div className="xl:col-span-6 bg-[#0d0e12] border border-[#292a2e] p-5 space-y-4">
            <div className="border-b border-[#292a2e] pb-3 flex items-center justify-between">
              <h3 className="text-sm font-mono font-bold uppercase tracking-wider text-white">
                Directorio de Propietarios Registrados
              </h3>
              <span className="text-xs font-mono text-[#00eefc]">
                TOTAL: {bundle.all_owners.length}
              </span>
            </div>

            <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
              {bundle.all_owners.map((owner) => {
                const isSelected = owner.id === bundle.selected_owner.id;
                return (
                  <div
                    key={owner.id}
                    className={`p-3 border font-mono text-xs ${
                      isSelected
                        ? 'bg-[#00eefc]/5 border-[#00eefc]/60'
                        : 'bg-[#14151a] border-[#292a2e]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white">{owner.name}</span>
                      {isSelected && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-[#00eefc]/20 text-[#00eefc] border border-[#00eefc]/40">
                          [PROPIETARIO ACTIVO]
                        </span>
                      )}
                    </div>
                    <div className="text-[#9ca3af] mt-1 grid grid-cols-1 sm:grid-cols-2 gap-1">
                      <span>DOC: {owner.document_id}</span>
                      <span>TEL: {owner.phone}</span>
                      <span>EMAIL: {owner.email}</span>
                      <span>
                        BANCO: {owner.bank_name} ({owner.bank_account_type}) ·{' '}
                        {owner.bank_account_number}
                      </span>
                      <span className="text-[#ffb800] font-bold sm:col-span-2">
                        FECHA DE CORTE / LIQUIDACIÓN: Día {owner.cutoff_day ?? 5}{' '}
                        de cada mes
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB PANEL 02 // REGISTRO DE INMUEBLE Y SUBDIVISIONES */}
      {activeTab === 'inmueble' && (
        <div
          id="tabpanel-inmueble"
          role="tabpanel"
          aria-labelledby="tab-btn-inmueble"
          data-testid="panel-inmueble"
          className="grid grid-cols-1 xl:grid-cols-12 gap-6"
        >
          <form
            onSubmit={handlePropertySubmit}
            className="xl:col-span-7 bg-[#0d0e12] border border-[#292a2e] p-5 space-y-5"
          >
            <div className="border-b border-[#292a2e] pb-3 flex items-center justify-between">
              <h3 className="text-sm font-mono font-bold uppercase tracking-wider text-[#00eefc]">
                02 // Registro de Inmueble y Subdivisiones
              </h3>
              <span className="text-xs font-mono text-[#9ca3af]">
                TABLA: properties
              </span>
            </div>

            {/* Modalidad de Activo Selector */}
            <div className="bg-[#14151a] border border-[#292a2e] p-3 font-mono text-xs space-y-2">
              <div className="text-[#9ca3af] uppercase">
                Modalidad de Inscripción de Activo:
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  data-testid="mode-single-property"
                  onClick={() => setHasSubdivisions(false)}
                  className={`px-3 py-2 border text-left transition-colors ${
                    !hasSubdivisions
                      ? 'bg-[#00eefc]/15 border-[#00eefc] text-[#00eefc] font-bold'
                      : 'bg-[#1a1b20] border-[#292a2e] text-[#9ca3af] hover:text-white'
                  }`}
                >
                  ( {!hasSubdivisions ? '•' : ' '} ) INMUEBLE ÚNICO (Sin
                  subdivisiones)
                </button>
                <button
                  type="button"
                  data-testid="mode-with-subdivisions"
                  onClick={() => setHasSubdivisions(true)}
                  className={`px-3 py-2 border text-left transition-colors ${
                    hasSubdivisions
                      ? 'bg-[#00eefc]/15 border-[#00eefc] text-[#00eefc] font-bold'
                      : 'bg-[#1a1b20] border-[#292a2e] text-[#9ca3af] hover:text-white'
                  }`}
                >
                  ( {hasSubdivisions ? '•' : ' '} ) PROPIEDAD CON SUBDIVISIONES
                </button>
              </div>
            </div>

            {/* 1. Titularidad: Propietario Principal y Copropietarios */}
            <div className="space-y-3 text-xs font-mono bg-[#14151a] border border-[#292a2e] p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#292a2e] pb-2">
                <span className="text-[#00eefc] uppercase tracking-wider font-bold">
                  1. Titularidad (Propietario Registrado y Copropietarios)
                </span>
                <label className="flex items-center gap-2 cursor-pointer text-[#ffb800]">
                  <input
                    type="checkbox"
                    data-testid="toggle-co-owners"
                    checked={hasCoOwners}
                    onChange={(e) => setHasCoOwners(e.target.checked)}
                    className="accent-[#ffb800]"
                  />
                  <span className="font-bold uppercase">
                    Incluir Copropietarios
                  </span>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                <label className="block sm:col-span-8">
                  <span className="text-[#9ca3af] uppercase block mb-1">
                    Propietario Principal (Titular Registrado)
                  </span>
                  <select
                    aria-label="Propietario Principal del Inmueble"
                    data-testid="property-owner-select"
                    value={selectedOwnerForProp}
                    onChange={(e) =>
                      setSelectedOwnerForProp(Number(e.target.value))
                    }
                    className="w-full bg-[#1a1b20] border border-[#00eefc]/60 px-3 py-2 text-white font-bold"
                  >
                    {bundle.all_owners.map((owner) => (
                      <option key={owner.id} value={owner.id}>
                        {owner.name} — {owner.document_id} ({owner.bank_name})
                      </option>
                    ))}
                  </select>
                </label>

                <div className="sm:col-span-4 bg-[#1a1b20] border border-[#292a2e] px-3 py-2 flex items-center justify-between">
                  <span className="text-[#9ca3af] uppercase">
                    Participación Titular:
                  </span>
                  <span
                    className="text-[#00eefc] font-bold"
                    data-testid="primary-owner-share-pct"
                  >
                    {primaryOwnerSharePct}%
                  </span>
                </div>
              </div>

              {hasCoOwners && (
                <div
                  data-testid="co-owners-section"
                  className="space-y-2.5 pt-2 border-t border-[#292a2e]"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-[#ffb800] uppercase font-bold">
                      Copropietarios Vinculados ({coOwners.length})
                    </span>
                    <button
                      type="button"
                      data-testid="add-co-owner-btn"
                      onClick={handleAddCoOwner}
                      className="px-2.5 py-1 bg-[#1a1b20] border border-[#ffb800] text-[#ffb800] font-bold hover:bg-[#ffb800]/15"
                    >
                      [ + AGREGAR COPROPIETARIO ]
                    </button>
                  </div>

                  {coOwners.map((co, idx) => (
                    <div
                      key={`${co.owner_id}-${idx}`}
                      data-testid={`co-owner-row-${idx}`}
                      className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end bg-[#1a1b20] border border-[#ffb800]/40 p-2.5"
                    >
                      <label className="sm:col-span-7 block">
                        <span className="text-[10px] text-[#9ca3af] uppercase block mb-0.5">
                          Copropietario #{idx + 1} (De Lista Registrada)
                        </span>
                        <select
                          aria-label={`Copropietario ${idx + 1}`}
                          value={co.owner_id}
                          onChange={(e) =>
                            handleUpdateCoOwner(idx, {
                              owner_id: Number(e.target.value),
                            })
                          }
                          className="w-full bg-[#121317] border border-[#292a2e] px-2.5 py-1.5 text-white"
                        >
                          {availableCoOwnerCandidates.map((cand) => (
                            <option key={cand.id} value={cand.id}>
                              {cand.name} — {cand.document_id}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="sm:col-span-3 block">
                        <span className="text-[10px] text-[#ffb800] uppercase block mb-0.5">
                          % Participación
                        </span>
                        <input
                          type="number"
                          min={1}
                          max={99}
                          aria-label={`Participación Copropietario ${idx + 1}`}
                          value={co.share_pct}
                          onChange={(e) =>
                            handleUpdateCoOwner(idx, {
                              share_pct: Number(e.target.value),
                            })
                          }
                          className="w-full bg-[#121317] border border-[#292a2e] px-2.5 py-1.5 text-white"
                        />
                      </label>

                      <div className="sm:col-span-2 flex justify-end">
                        <button
                          type="button"
                          onClick={() => handleRemoveCoOwner(idx)}
                          className="w-full py-1.5 bg-[#121317] border border-[#ff3366]/60 text-[#ff3366] hover:bg-[#ff3366]/15"
                          title="Quitar copropietario"
                        >
                          [ ✕ ]
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 2. Datos de la Propiedad Principal */}
            <div className="space-y-3 text-xs font-mono">
              <div className="text-[#00eefc] uppercase tracking-wider font-bold border-b border-[#292a2e] pb-1">
                2. Datos de la Propiedad Principal{' '}
                {hasSubdivisions ? '(Matriz)' : '(Activo Único)'}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-[#9ca3af] uppercase block mb-1">
                    Código Principal
                  </span>
                  <input
                    type="text"
                    value={propCode}
                    onChange={(e) => setPropCode(e.target.value)}
                    placeholder={
                      hasSubdivisions ? 'MAT-NORTE-01' : 'APT-FACA-201'
                    }
                    className="w-full bg-[#1a1b20] border border-[#292a2e] px-3 py-2 text-white"
                  />
                </label>

                <label className="block">
                  <span className="text-[#9ca3af] uppercase block mb-1">
                    Título / Nombre de la Propiedad
                  </span>
                  <input
                    type="text"
                    value={propTitle}
                    onChange={(e) => setPropTitle(e.target.value)}
                    placeholder={
                      hasSubdivisions
                        ? 'Edificio Mirador del Parque'
                        : 'Torre 1 - Apto 201'
                    }
                    className="w-full bg-[#1a1b20] border border-[#292a2e] px-3 py-2 text-white"
                  />
                </label>

                <label className="block">
                  <span className="text-[#9ca3af] uppercase block mb-1">
                    Tipología Principal
                  </span>
                  <select
                    value={hasSubdivisions ? 'EDIFICIO MATRIZ' : propType}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPropType(val);
                      if (val === 'EDIFICIO MATRIZ') {
                        setHasSubdivisions(true);
                      } else if (hasSubdivisions) {
                        setHasSubdivisions(false);
                      }
                    }}
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
                    Dirección Física
                  </span>
                  <input
                    type="text"
                    value={propAddress}
                    onChange={(e) => setPropAddress(e.target.value)}
                    placeholder="Cra 7 # 14-20, Facatativá"
                    className="w-full bg-[#1a1b20] border border-[#292a2e] px-3 py-2 text-white"
                  />
                </label>

                {!hasSubdivisions && (
                  <>
                    <label className="block">
                      <span className="text-[#9ca3af] uppercase block mb-1">
                        Canon Base Mensual ($ COP)
                      </span>
                      <input
                        type="number"
                        data-testid="input-base-rent-cop"
                        value={baseRentCop}
                        onChange={(e) => setBaseRentCop(Number(e.target.value))}
                        className="w-full bg-[#1a1b20] border border-[#292a2e] px-3 py-2 text-white"
                      />
                      <span
                        data-testid="base-rent-words"
                        className="text-[11px] text-[#00eefc] mt-1 block"
                      >
                        {formatCop(baseRentCop)} — {formatCopInWords(baseRentCop)}
                      </span>
                    </label>

                    <label className="block">
                      <span className="text-[#9ca3af] uppercase block mb-1">
                        Estado Inicial
                      </span>
                      <select
                        value={propStatus}
                        onChange={(e) =>
                          setPropStatus(
                            e.target.value as 'DISPONIBLE' | 'OCUPADO'
                          )
                        }
                        className="w-full bg-[#1a1b20] border border-[#292a2e] px-3 py-2 text-white"
                      >
                        <option value="DISPONIBLE">DISPONIBLE</option>
                        <option value="OCUPADO">OCUPADO</option>
                      </select>
                    </label>
                  </>
                )}
              </div>
            </div>

            {/* 2. Condiciones Comerciales de Agencia (Base) */}
            <div className="space-y-3 text-xs font-mono">
              <div className="text-[#00eefc] uppercase tracking-wider font-bold border-b border-[#292a2e] pb-1">
                2. Condiciones Comerciales de Agencia{' '}
                {hasSubdivisions
                  ? '(Valores Base por Defecto para Subdivisiones)'
                  : '(Comisión Porcentual)'}
              </div>

              <div className="grid grid-cols-1 gap-3">
                {/* WCAG 2.1 AA Native Range Slider for Percentage Commission */}
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
                    <span>
                      Equivale a {formatCop(liveCommission.percentageFeeCop)}
                    </span>
                    <span>Máx: 15.0%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Constructor Dinámico de Subdivisiones */}
            {hasSubdivisions && (
              <div
                className="space-y-3 text-xs font-mono"
                data-testid="subdivisions-builder"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#292a2e] pb-2">
                  <span className="text-[#00eefc] uppercase tracking-wider font-bold">
                    3. Subdivisiones / Unidades Internas ({subdivisions.length})
                  </span>
                  <button
                    type="button"
                    data-testid="add-subdivision-btn"
                    onClick={handleAddSubdivision}
                    className="px-3 py-1 bg-[#1a1b20] border border-[#00eefc] text-[#00eefc] font-bold hover:bg-[#00eefc]/15"
                  >
                    [ + AGREGAR SUBDIVISIÓN ]
                  </button>
                </div>

                <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                  {subdivisions.map((sub, idx) => {
                    const subComm = getSubdivisionCommission(sub);
                    const subNetCop = Math.max(
                      0,
                      Number(sub.base_rent_cop || 0) -
                        subComm.totalCommissionCop
                    );
                    return (
                      <div
                        key={sub.id}
                        data-testid={`subdivision-row-${idx}`}
                        className="p-3 bg-[#14151a] border border-[#292a2e] space-y-2.5"
                      >
                        <div className="flex items-center justify-between border-b border-[#292a2e] pb-1.5">
                          <span className="text-[#00eefc] font-bold">
                            DIVISIÓN #{idx + 1} // {sub.code || 'SIN-CÓDIGO'}
                          </span>
                          <div className="flex items-center gap-3">
                            <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-[#ffb800]">
                              <input
                                type="checkbox"
                                data-testid={`subdivision-custom-comm-toggle-${idx}`}
                                checked={sub.customCommission}
                                onChange={(e) =>
                                  handleUpdateSubdivision(sub.id, {
                                    customCommission: e.target.checked,
                                    commission_pct: sub.customCommission
                                      ? sub.commission_pct
                                      : commissionPct,
                                  })
                                }
                                className="accent-[#ffb800]"
                              />
                              <span>Comisión por división</span>
                            </label>
                            {subdivisions.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveSubdivision(sub.id)}
                                className="px-2 py-0.5 bg-[#1a1b20] border border-[#ff3366]/60 text-[#ff3366] hover:bg-[#ff3366]/15"
                                title="Eliminar subdivisión"
                              >
                                [ ✕ ]
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                          <label className="sm:col-span-3 block">
                            <span className="text-[10px] text-[#9ca3af] uppercase block mb-0.5">
                              Código
                            </span>
                            <input
                              type="text"
                              value={sub.code}
                              onChange={(e) =>
                                handleUpdateSubdivision(sub.id, {
                                  code: e.target.value,
                                })
                              }
                              className="w-full bg-[#1a1b20] border border-[#292a2e] px-2 py-1.5 text-white"
                            />
                          </label>

                          <label className="sm:col-span-4 block">
                            <span className="text-[10px] text-[#9ca3af] uppercase block mb-0.5">
                              Unidad / Título
                            </span>
                            <input
                              type="text"
                              value={sub.title}
                              onChange={(e) =>
                                handleUpdateSubdivision(sub.id, {
                                  title: e.target.value,
                                })
                              }
                              className="w-full bg-[#1a1b20] border border-[#292a2e] px-2 py-1.5 text-white"
                            />
                          </label>

                          <label className="sm:col-span-3 block">
                            <span className="text-[10px] text-[#9ca3af] uppercase block mb-0.5">
                              Tipología
                            </span>
                            <select
                              value={sub.property_type}
                              onChange={(e) =>
                                handleUpdateSubdivision(sub.id, {
                                  property_type: e.target.value,
                                })
                              }
                              className="w-full bg-[#1a1b20] border border-[#292a2e] px-2 py-1.5 text-white"
                            >
                              <option value="APARTAMENTO">APARTAMENTO</option>
                              <option value="LOCAL COMERCIAL">
                                LOCAL COMERCIAL
                              </option>
                              <option value="OFICINA">OFICINA</option>
                              <option value="BODEGA">BODEGA</option>
                              <option value="CASA">CASA</option>
                            </select>
                          </label>

                          <label className="sm:col-span-2 block">
                            <span className="text-[10px] text-[#9ca3af] uppercase block mb-0.5">
                              Canon ($ COP)
                            </span>
                            <input
                              type="number"
                              data-testid={`input-subdivision-rent-${idx}`}
                              value={sub.base_rent_cop}
                              onChange={(e) =>
                                handleUpdateSubdivision(sub.id, {
                                  base_rent_cop: Number(e.target.value),
                                })
                              }
                              className="w-full bg-[#1a1b20] border border-[#292a2e] px-2 py-1.5 text-white"
                            />
                            <span
                              data-testid={`subdivision-rent-words-${idx}`}
                              className="text-[10px] text-[#00eefc] mt-1 block leading-tight"
                            >
                              {formatCop(sub.base_rent_cop)} —{' '}
                              {formatCopInWords(sub.base_rent_cop)}
                            </span>
                          </label>
                        </div>

                        {/* Optional Per-Subdivision Commission Override (Percentage Only) */}
                        {sub.customCommission ? (
                          <div
                            data-testid={`subdivision-custom-comm-panel-${idx}`}
                            className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-2.5 bg-[#1a1b20] border border-[#ffb800]/50"
                          >
                            <label className="block">
                              <span className="text-[10px] text-[#ffb800] uppercase block mb-0.5">
                                % Comisión División
                              </span>
                              <input
                                type="number"
                                min={1}
                                max={25}
                                step={0.5}
                                aria-label={`Comisión Porcentual División ${idx + 1}`}
                                value={sub.commission_pct}
                                onChange={(e) =>
                                  handleUpdateSubdivision(sub.id, {
                                    commission_pct: Number(e.target.value),
                                  })
                                }
                                className="w-full bg-[#121317] border border-[#292a2e] px-2 py-1 text-white"
                              />
                            </label>

                            <div className="flex flex-col justify-center text-right">
                              <span className="text-[10px] text-[#9ca3af] uppercase">
                                Comisión División ({subComm.effPct.toFixed(1)}%)
                              </span>
                              <span className="text-xs font-bold text-[#ffb800]">
                                -{formatCop(subComm.totalCommissionCop)} · Neto:{' '}
                                {formatCop(subNetCop)}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between text-[11px] text-[#9ca3af] pt-0.5">
                            <span>
                              Comisión heredada de propiedad base:{' '}
                              <strong className="text-white">
                                {commissionPct.toFixed(1)}%
                              </strong>
                            </span>
                            <span className="text-[#00eefc] font-bold">
                              Comisión: -{formatCop(subComm.totalCommissionCop)}{' '}
                              · Neto: {formatCop(subNetCop)}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Live Formula Preview Box */}
            <div className="bg-[#121317] border border-[#00eefc]/40 p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 font-mono text-xs">
              {!hasSubdivisions ? (
                <>
                  <div>
                    <span className="text-[#9ca3af] block">
                      FÓRMULA: INGRESO BRUTO × % COMISIÓN
                    </span>
                    <span className="text-white">
                      {formatCop(baseRentCop)} × {commissionPct.toFixed(1)}% ·
                      Neto Propietario:{' '}
                      <strong className="text-[#00FF66]">
                        {formatCop(
                          Math.max(
                            0,
                            baseRentCop - liveCommission.totalCommissionCop
                          )
                        )}
                      </strong>
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
                </>
              ) : (
                <>
                  <div className="space-y-0.5">
                    <span className="text-[#9ca3af] block">
                      INGRESOS POR SUBDIVISIONES (1 MATRIZ +{' '}
                      {subdivisions.length} UNIDADES)
                    </span>
                    <span className="text-white block">
                      Ingresos Brutos Subdivisiones:{' '}
                      <strong data-testid="subdivisions-gross-income">
                        {formatCop(subdivisionsTotalRentCop)}
                      </strong>{' '}
                      · Neto Propietario (sin sumar comisión al ingreso):{' '}
                      <strong
                        className="text-[#00FF66]"
                        data-testid="subdivisions-net-income"
                      >
                        {formatCop(subdivisionsNetOwnerCop)}
                      </strong>
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[#9ca3af] block">
                      COMISIÓN TOTAL SUBDIVISIONES
                    </span>
                    <span
                      className="text-base font-bold text-[#00eefc]"
                      data-testid="live-commission-preview"
                    >
                      {formatCop(subdivisionsTotalCommissionCop)}
                    </span>
                  </div>
                </>
              )}
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
              {hasSubdivisions
                ? `[ GUARDAR PROPIEDAD Y ${subdivisions.length} SUBDIVISIONES EN SQLITE ]`
                : '[ GUARDAR PROPIEDAD ÚNICA EN SQLITE ]'}
            </button>
          </form>

          {/* Context Column: Resumen de Inmuebles del Propietario Activo */}
          <div className="xl:col-span-5 bg-[#0d0e12] border border-[#292a2e] p-5 space-y-4">
            <div className="border-b border-[#292a2e] pb-3 flex items-center justify-between">
              <h3 className="text-sm font-mono font-bold uppercase tracking-wider text-white">
                Resumen de Inmuebles del Propietario Activo
              </h3>
              <span className="text-xs font-mono text-[#00eefc]">
                ACTIVOS: {bundle.properties.length}
              </span>
            </div>

            <div className="space-y-2.5">
              {bundle.properties
                .filter(
                  (prop) =>
                    prop.parent_property_id === null ||
                    !bundle.properties.some(
                      (p) => Number(p.id) === Number(prop.parent_property_id)
                    )
                )
                .map((prop) => {
                  const isAvailable = prop.status === 'DISPONIBLE';
                  const ownerObj = bundle.all_owners.find(
                    (o) => o.id === prop.owner_id
                  );
                  const childSubdivisions = bundle.properties.filter(
                    (child) =>
                      child.parent_property_id !== null &&
                      Number(child.parent_property_id) === Number(prop.id)
                  );
                  const hasChildren = childSubdivisions.length > 0;
                  const isExpanded = isParentExpanded(prop.id);

                  return (
                    <div key={prop.id} className="space-y-2">
                      <div className="p-3 bg-[#14151a] border border-[#292a2e] font-mono text-xs">
                        <div
                          onClick={() =>
                            hasChildren && toggleParentSummary(prop.id)
                          }
                          className={`flex items-center justify-between gap-2 ${
                            hasChildren ? 'cursor-pointer select-none' : ''
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {hasChildren && (
                              <button
                                type="button"
                                data-testid={`toggle-summary-subdivisions-${prop.id}`}
                                aria-expanded={isExpanded}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleParentSummary(prop.id);
                                }}
                                className="px-2 py-0.5 bg-[#1a1b20] border border-[#00eefc] text-[#00eefc] font-bold hover:bg-[#00eefc]/20"
                                title={
                                  isExpanded
                                    ? 'Contraer subdivisiones'
                                    : 'Desplegar subdivisiones'
                                }
                              >
                                {isExpanded ? '[-]' : '[+]'}
                              </button>
                            )}
                            <div>
                              <span className="text-[#00eefc] font-bold">
                                [{prop.code}]
                              </span>{' '}
                              <span className="text-white font-bold">
                                {prop.title}
                              </span>
                            </div>
                          </div>
                          <span
                            className={`text-[10px] px-1.5 py-0.5 border font-bold ${
                              isAvailable
                                ? 'border-[#00FF66] text-[#00FF66] bg-[#00FF66]/10'
                                : 'border-[#ffb800] text-[#ffb800] bg-[#ffb800]/10'
                            }`}
                          >
                            [{prop.status}]
                          </span>
                        </div>

                        <div className="text-[#9ca3af] mt-1.5 flex items-center justify-between">
                          <span>
                            {prop.property_type} · Com:{' '}
                            {prop.commission_pct.toFixed(1)}%
                          </span>
                          <span className="text-white font-bold">
                            {hasChildren
                              ? `${childSubdivisions.length} SUBDIVISIONES`
                              : formatCop(prop.base_rent_cop)}
                          </span>
                        </div>

                        <div className="text-[11px] text-[#9ca3af] mt-2 pt-2 border-t border-[#292a2e]/60 flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <span>
                              Titular:{' '}
                              <strong className="text-white">
                                {ownerObj?.name ?? `ID #${prop.owner_id}`}
                              </strong>
                            </span>
                            {prop.co_owners && prop.co_owners.length > 0 && (
                              <span className="text-[#ffb800] ml-2">
                                · Copropietarios:{' '}
                                {prop.co_owners
                                  .map((co) => {
                                    const coName =
                                      bundle.all_owners.find(
                                        (o) => o.id === co.owner_id
                                      )?.name ?? `#${co.owner_id}`;
                                    return `${coName} (${co.share_pct}%)`;
                                  })
                                  .join(', ')}
                              </span>
                            )}
                          </div>

                          {hasChildren && (
                            <button
                              type="button"
                              onClick={() => toggleParentSummary(prop.id)}
                              className="px-2 py-0.5 bg-[#1a1b20] border border-[#00eefc]/60 text-[10px] text-[#00eefc] font-bold hover:bg-[#00eefc]/15 uppercase"
                            >
                              {isExpanded
                                ? `Contraer (${childSubdivisions.length})`
                                : `Desplegar (${childSubdivisions.length})`}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Subdivisions Accordion Drawer */}
                      {hasChildren && isExpanded && (
                        <div
                          data-testid={`summary-subdivisions-list-${prop.id}`}
                          className="space-y-2 pl-3"
                        >
                          {childSubdivisions.map((child) => {
                            const childAvailable =
                              child.status === 'DISPONIBLE';
                            return (
                              <div
                                key={child.id}
                                className="p-2.5 bg-[#14151a] border-l-2 border-l-[#00eefc] border border-[#292a2e] font-mono text-xs"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div>
                                    <span className="text-[#00eefc] font-bold">
                                      └── [{child.code}]
                                    </span>{' '}
                                    <span className="text-white font-bold">
                                      {child.title}
                                    </span>
                                  </div>
                                  <span
                                    className={`text-[10px] px-1.5 py-0.5 border font-bold ${
                                      childAvailable
                                        ? 'border-[#00FF66] text-[#00FF66] bg-[#00FF66]/10'
                                        : 'border-[#ffb800] text-[#ffb800] bg-[#ffb800]/10'
                                    }`}
                                  >
                                    [{child.status}]
                                  </span>
                                </div>
                                <div className="text-[#9ca3af] mt-1 flex items-center justify-between">
                                  <span>
                                    {child.property_type} · Com:{' '}
                                    {child.commission_pct.toFixed(1)}%
                                  </span>
                                  <span className="text-white font-bold">
                                    {formatCop(child.base_rent_cop)}
                                  </span>
                                </div>
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
        </div>
      )}

      {/* TAB PANEL 03 // VINCULACIÓN DE INQUILINO Y CONTRATO DE ARRENDAMIENTO */}
      {activeTab === 'inquilino' && (
        <div
          id="tabpanel-inquilino"
          role="tabpanel"
          aria-labelledby="tab-btn-inquilino"
          data-testid="panel-inquilino"
          className="grid grid-cols-1 xl:grid-cols-12 gap-6"
        >
          <form
            noValidate
            onSubmit={handleContractSubmit}
            className="xl:col-span-7 bg-[#0d0e12] border border-[#292a2e] p-5 space-y-4"
          >
            <div className="border-b border-[#292a2e] pb-3 flex items-center justify-between">
              <h3 className="text-sm font-mono font-bold uppercase tracking-wider text-[#00eefc]">
                03 // Vinculación de Inquilino y Contrato de Arrendamiento
              </h3>
              <span className="text-xs font-mono text-[#9ca3af]">
                TABLA: tenant_contracts + rent_payments
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
              <label className="block sm:col-span-2">
                <span className="text-[#9ca3af] uppercase block mb-1">
                  Inmueble Destino
                </span>
                <select
                  data-testid="select-contract-property"
                  value={selectedPropertyId}
                  onChange={(e) =>
                    setSelectedPropertyId(Number(e.target.value))
                  }
                  className="w-full bg-[#1a1b20] border border-[#292a2e] px-3 py-2 text-white font-bold"
                >
                  {rentableProperties.map((p) => (
                    <option key={p.id} value={p.id}>
                      [{p.code}] {p.title} ({p.status}) — Canon:{' '}
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
                  data-testid="input-tenant-name"
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
                  data-testid="input-tenant-document"
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
                  data-testid="input-contract-rent-cop"
                  value={contractRentCop}
                  onChange={(e) => {
                    const nextRent = Number(e.target.value);
                    setContractRentCop(nextRent);
                    if (contractPaymentMode === 'COMPLETO') {
                      setContractInitialPaymentCop(nextRent);
                    }
                  }}
                  className="w-full bg-[#1a1b20] border border-[#292a2e] px-3 py-2 text-white font-bold"
                />
                <span
                  data-testid="contract-rent-words"
                  className="text-[11px] text-[#00eefc] mt-1 block"
                >
                  {formatCop(contractRentCop)} —{' '}
                  {formatCopInWords(contractRentCop)}
                </span>
              </label>

              <label className="block">
                <span className="text-[#9ca3af] uppercase block mb-1">
                  Fecha Inicio
                </span>
                <input
                  type="date"
                  value={startDate}
                  max={`${currentSystemPeriod}-31`}
                  onChange={(e) => {
                    const nextStart = e.target.value;
                    setStartDate(nextStart);
                    const startPeriod = nextStart.slice(0, 7);
                    if (startPeriod) {
                      setContractPaymentPeriod(
                        startPeriod <= currentSystemPeriod
                          ? startPeriod
                          : currentSystemPeriod
                      );
                    }
                  }}
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

            {/* Mandatory Initial Rent Payment / Abono Box at Tenant Registration */}
            <div
              data-testid="contract-initial-payment-section"
              className="bg-[#14151a] border border-[#00FF66]/40 p-4 space-y-3 text-xs font-mono"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#292a2e] pb-2">
                <span className="text-[#00FF66] font-bold uppercase tracking-wider">
                  Recaudo Inicial Obligatorio del Inquilino (Pago Completo o Abono)
                </span>
                <span className="text-[11px] text-[#00eefc]">
                  CANON PACTADO: {formatCop(contractRentCop)}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  data-testid="contract-payment-mode-full"
                  onClick={() => {
                    setContractPaymentMode('COMPLETO');
                    setContractInitialPaymentCop(Number(contractRentCop || 0));
                    setContractError(null);
                  }}
                  className={`px-3 py-2 border text-left transition-colors ${
                    contractPaymentMode === 'COMPLETO'
                      ? 'bg-[#00FF66]/15 border-[#00FF66] text-[#00FF66] font-bold'
                      : 'bg-[#1a1b20] border-[#292a2e] text-[#9ca3af] hover:text-white'
                  }`}
                >
                  ( {contractPaymentMode === 'COMPLETO' ? '•' : ' '} ) PAGO
                  COMPLETO DEL ALQUILER (100%)
                </button>
                <button
                  type="button"
                  data-testid="contract-payment-mode-abono"
                  onClick={() => {
                    setContractPaymentMode('ABONO');
                    if (
                      contractInitialPaymentCop >= Number(contractRentCop || 0)
                    ) {
                      setContractInitialPaymentCop(
                        Math.round(Number(contractRentCop || 0) / 2)
                      );
                    }
                    setContractError(null);
                  }}
                  className={`px-3 py-2 border text-left transition-colors ${
                    contractPaymentMode === 'ABONO'
                      ? 'bg-[#ffb800]/15 border-[#ffb800] text-[#ffb800] font-bold'
                      : 'bg-[#1a1b20] border-[#292a2e] text-[#9ca3af] hover:text-white'
                  }`}
                >
                  ( {contractPaymentMode === 'ABONO' ? '•' : ' '} ) ABONO
                  PARCIAL DE ALQUILER
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-[#9ca3af] uppercase block mb-1">
                    Periodo Contable del Recaudo Inicial (Automático por Registro)
                  </span>
                  <select
                    aria-label="Periodo Contable del Pago Inicial"
                    data-testid="select-contract-payment-period"
                    value={contractPaymentPeriod}
                    onChange={(e) => setContractPaymentPeriod(e.target.value)}
                    className="w-full bg-[#1a1b20] border border-[#00eefc]/60 px-3 py-2 text-white font-bold"
                  >
                    <option value={contractPaymentPeriod}>
                      {formatPeriodMonthLabel(
                        contractPaymentPeriod,
                        currentSystemPeriod
                      )}
                    </option>
                  </select>
                </label>

                <label className="block">
                  <span className="text-[#9ca3af] uppercase block mb-1">
                    {contractPaymentMode === 'COMPLETO'
                      ? 'Valor Pago Completo ($ COP)'
                      : 'Valor Abono Inicial ($ COP)'}
                  </span>
                  <input
                    type="number"
                    data-testid="input-contract-initial-payment-cop"
                    readOnly={contractPaymentMode === 'COMPLETO'}
                    value={effectiveContractInitialPaymentCop}
                    onChange={(e) => {
                      setContractInitialPaymentCop(Number(e.target.value));
                      setContractError(null);
                    }}
                    className={`w-full bg-[#1a1b20] border px-3 py-2 text-white font-bold ${
                      contractPaymentMode === 'COMPLETO'
                        ? 'border-[#00FF66]/60 opacity-90'
                        : 'border-[#ffb800]'
                    }`}
                  />
                  <span
                    data-testid="contract-initial-payment-words"
                    className="text-[11px] text-[#00FF66] mt-1 block"
                  >
                    {formatCop(effectiveContractInitialPaymentCop)} —{' '}
                    {formatCopInWords(effectiveContractInitialPaymentCop)}
                  </span>
                </label>

                <label className="block">
                  <span className="text-[#9ca3af] uppercase block mb-1">
                    Medio de Pago Inicial
                  </span>
                  <select
                    value={contractPaymentMethod}
                    onChange={(e) => setContractPaymentMethod(e.target.value)}
                    className="w-full bg-[#1a1b20] border border-[#292a2e] px-3 py-2 text-white"
                  >
                    <option value="TRANSFERENCIA PSE">TRANSFERENCIA PSE</option>
                    <option value="CONSIGNACIÓN BANCARIA">
                      CONSIGNACIÓN BANCARIA
                    </option>
                    <option value="TRANSFERENCIA ACH">TRANSFERENCIA ACH</option>
                    <option value="EFECTIVO EN OFICINA">
                      EFECTIVO EN OFICINA
                    </option>
                  </select>
                </label>

                <label className="block">
                  <span className="text-[#9ca3af] uppercase block mb-1">
                    Referencia Bancaria / Recibo
                  </span>
                  <input
                    type="text"
                    value={contractPaymentRef}
                    onChange={(e) => setContractPaymentRef(e.target.value)}
                    className="w-full bg-[#1a1b20] border border-[#292a2e] px-3 py-2 text-white"
                  />
                </label>
              </div>

              <div className="bg-[#121317] border border-[#292a2e] p-2.5 grid grid-cols-3 gap-2 text-[11px]">
                <div>
                  <span className="text-[#9ca3af] block uppercase">
                    Alquiler Pactado:
                  </span>
                  <span className="text-white font-bold">
                    {formatCop(contractRentCop)}
                  </span>
                </div>
                <div>
                  <span className="text-[#9ca3af] block uppercase">
                    Recibido al Ingreso:
                  </span>
                  <span
                    data-testid="contract-initial-received-cop"
                    className="text-[#00FF66] font-bold"
                  >
                    {formatCop(effectiveContractInitialPaymentCop)}
                  </span>
                </div>
                <div>
                  <span className="text-[#9ca3af] block uppercase">
                    Saldo Restante ({contractPaymentPeriod}):
                  </span>
                  <span
                    data-testid="contract-initial-remaining-cop"
                    className={
                      contractRemainingBalanceCop === 0
                        ? 'text-[#00FF66] font-bold'
                        : 'text-[#ffb800] font-bold'
                    }
                  >
                    {formatCop(contractRemainingBalanceCop)}
                  </span>
                </div>
              </div>
            </div>

            {contractError && (
              <div
                data-testid="contract-error-feedback"
                className="p-2.5 bg-[#ff007f]/15 border border-[#ff007f] text-xs font-mono text-[#ff007f] font-bold"
              >
                {contractError}
              </div>
            )}

            {contractFeedback && (
              <div
                data-testid="contract-success-feedback"
                className="p-2.5 bg-[#00FF66]/10 border border-[#00FF66]/40 text-xs font-mono text-[#00FF66]"
              >
                {contractFeedback}
              </div>
            )}

            <button
              type="submit"
              data-testid="submit-contract-button"
              className="w-full py-2.5 bg-[#00FF66] text-[#0d0e12] font-mono font-bold text-xs uppercase tracking-wider hover:bg-[#00FF66]/90"
            >
              [ FORMALIZAR CONTRATO, REGISTRAR PAGO Y OCUPAR INMUEBLE ]
            </button>
          </form>

          {/* Context Column: Contratos Activos del Propietario */}
          <div className="xl:col-span-5 bg-[#0d0e12] border border-[#292a2e] p-5 space-y-4">
            <div className="border-b border-[#292a2e] pb-3 flex items-center justify-between">
              <h3 className="text-sm font-mono font-bold uppercase tracking-wider text-white">
                Contratos Activos del Propietario
              </h3>
              <span className="text-xs font-mono text-[#00FF66]">
                VIGENTES: {bundle.contracts.length}
              </span>
            </div>

            <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
              {bundle.contracts.map((contract) => {
                const prop = bundle.properties.find(
                  (p) => p.id === contract.property_id
                );
                return (
                  <div
                    key={contract.id}
                    className="p-3 bg-[#14151a] border border-[#292a2e] font-mono text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white">
                        {contract.tenant_name}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 border border-[#00FF66]/40 text-[#00FF66]">
                        [{contract.status}]
                      </span>
                    </div>
                    <div className="text-[#9ca3af]">
                      DOC: {contract.tenant_document} · GARANTÍA:{' '}
                      {contract.guarantor_name}
                    </div>
                    <div className="flex items-center justify-between text-[#9ca3af] pt-1 border-t border-[#292a2e]">
                      <span>
                        INMUEBLE: {prop ? `[${prop.code}] ${prop.title}` : `#${contract.property_id}`}
                      </span>
                      <span className="text-[#00eefc] font-bold">
                        {formatCop(contract.monthly_rent_cop)} (Día{' '}
                        {contract.cutoff_day})
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB PANEL 04 // REGISTRO DE RECAUDO MENSUAL */}
      {activeTab === 'recaudo' && (
        <div
          id="tabpanel-recaudo"
          role="tabpanel"
          aria-labelledby="tab-btn-recaudo"
          data-testid="panel-recaudo"
          className="grid grid-cols-1 xl:grid-cols-12 gap-6"
        >
          <form
            noValidate
            onSubmit={handlePaymentSubmit}
            className="xl:col-span-6 bg-[#0d0e12] border border-[#292a2e] p-5 space-y-4 flex flex-col justify-between"
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
                    Inmueble / Contrato a Recaudar
                  </span>
                  <select
                    aria-label="Inmueble o Contrato Activo para Recaudo"
                    data-testid="select-payment-property"
                    value={paymentPropertyId}
                    onChange={(e) =>
                      setPaymentPropertyId(Number(e.target.value))
                    }
                    className="w-full bg-[#1a1b20] border border-[#292a2e] px-3 py-2 text-white font-bold"
                  >
                    {rentableProperties.map((prop) => {
                      const contract =
                        bundle.contracts.find(
                          (c) =>
                            c.property_id === prop.id &&
                            c.status !== 'FINALIZADO'
                        ) ??
                        bundle.contracts.find((c) => c.property_id === prop.id);
                      const agreedCop =
                        contract && contract.monthly_rent_cop > 0
                          ? contract.monthly_rent_cop
                          : prop.base_rent_cop;
                      const tenantLabel = contract
                        ? contract.tenant_name
                        : 'Canon Inmueble';
                      return (
                        <option key={prop.id} value={prop.id}>
                          [{prop.code}] {prop.title} — {tenantLabel} (Pactado:{' '}
                          {formatCop(agreedCop)})
                        </option>
                      );
                    })}
                  </select>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-[#00eefc] uppercase font-bold block mb-1">
                      Periodo Contable Activo (Por Fecha de Corte)
                    </span>
                    <select
                      ref={paymentPeriodSelectRef}
                      autoFocus
                      aria-label="Periodo Contable de Recaudo"
                      data-testid="select-payment-period"
                      value={paymentPeriod}
                      onChange={(e) => setPaymentPeriod(e.target.value)}
                      className="w-full bg-[#1a1b20] border-2 border-[#00eefc] px-3 py-2 text-white font-bold focus:outline-none focus:ring-2 focus:ring-[#00eefc]/60"
                    >
                      {activeBillingCycle.collectiblePeriods.map((period) => (
                        <option key={period} value={period}>
                          {formatPeriodMonthLabel(period, currentSystemPeriod)}
                        </option>
                      ))}
                    </select>
                    <span
                      data-testid="payment-cutoff-cycle-info"
                      className="text-[11px] text-[#9ca3af] mt-1 block"
                    >
                      Registro Inquilino:{' '}
                      <strong className="text-white">
                        {activeBillingCycle.registrationDate}
                      </strong>{' '}
                      · Corte: Día {activeBillingCycle.cutoffDay} · Próximo (
                      {activeBillingCycle.nextPeriod}) se activa el{' '}
                      <strong className="text-[#ffb800]">
                        {activeBillingCycle.nextCutoffDate}
                      </strong>
                    </span>
                  </label>

                  <label className="block">
                    <span className="text-[#9ca3af] uppercase block mb-1">
                      Valor Recaudado / Abono ($ COP)
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={
                        periodCollectionStatus.agreedRentCop > 0
                          ? periodCollectionStatus.remainingBalanceCop
                          : undefined
                      }
                      data-testid="input-payment-amount-cop"
                      value={paymentAmountCop}
                      onChange={(e) => {
                        setPaymentAmountCop(Number(e.target.value));
                        setPaymentError(null);
                      }}
                      className="w-full bg-[#1a1b20] border border-[#292a2e] px-3 py-2 text-white font-bold"
                    />
                    <span
                      data-testid="payment-amount-words"
                      className="text-[11px] text-[#00FF66] mt-1 block"
                    >
                      {formatCop(paymentAmountCop)} —{' '}
                      {formatCopInWords(paymentAmountCop)}
                    </span>
                  </label>
                </div>

                {/* Period Quota & Balance Guardrail Box */}
                <div
                  data-testid="period-collection-status-box"
                  className="bg-[#14151a] border border-[#292a2e] p-3 grid grid-cols-3 gap-2 text-[11px]"
                >
                  <div>
                    <span className="text-[#9ca3af] block uppercase">
                      Valor Pactado:
                    </span>
                    <span
                      data-testid="payment-agreed-rent-cop"
                      className="text-white font-bold"
                    >
                      {formatCop(periodCollectionStatus.agreedRentCop)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#9ca3af] block uppercase">
                      Abonado ({paymentPeriod}):
                    </span>
                    <span
                      data-testid="payment-already-collected-cop"
                      className="text-[#00eefc] font-bold"
                    >
                      {formatCop(periodCollectionStatus.alreadyCollectedCop)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#9ca3af] block uppercase">
                      Saldo Pendiente:
                    </span>
                    <span
                      data-testid="payment-remaining-balance-cop"
                      className={
                        periodCollectionStatus.remainingBalanceCop === 0
                          ? 'text-[#00FF66] font-bold'
                          : 'text-[#ffb800] font-bold'
                      }
                    >
                      {formatCop(periodCollectionStatus.remainingBalanceCop)}
                    </span>
                  </div>
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
                      <option value="TRANSFERENCIA PSE">
                        TRANSFERENCIA PSE
                      </option>
                      <option value="CONSIGNACIÓN BANCARIA">
                        CONSIGNACIÓN BANCARIA
                      </option>
                      <option value="TRANSFERENCIA ACH">
                        TRANSFERENCIA ACH
                      </option>
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

                {activePaymentProperty &&
                  (activePaymentOwnerSharePct < 100 ||
                    (activePaymentProperty.co_owners &&
                      activePaymentProperty.co_owners.length > 1)) && (
                    <div
                      data-testid="payment-coowner-dividend-box"
                      className="bg-[#121317] border border-[#ffb800]/50 p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between border-b border-[#292a2e] pb-1.5">
                        <span className="text-[11px] text-[#ffb800] font-bold uppercase">
                          DISTRIBUCIÓN DE DIVIDENDOS POR COPROPIEDAD
                        </span>
                        <span className="text-[11px] text-[#00eefc] font-bold">
                          [{activePaymentProperty.code}]
                        </span>
                      </div>
                      <div className="space-y-1">
                        {resolvePropertyCoOwnerShares(
                          activePaymentProperty
                        ).map((co) => {
                          const ownerName =
                            bundle.all_owners.find((o) => o.id === co.owner_id)
                              ?.name ?? `Propietario #${co.owner_id}`;
                          const isCurrent =
                            co.owner_id === bundle.selected_owner.id;
                          const dividendCop = Math.round(
                            Number(paymentAmountCop || 0) * (co.share_pct / 100)
                          );
                          return (
                            <div
                              key={co.owner_id}
                              className="flex items-center justify-between text-[11px]"
                            >
                              <span
                                className={
                                  isCurrent
                                    ? 'text-white font-bold'
                                    : 'text-[#9ca3af]'
                                }
                              >
                                {ownerName} ({co.share_pct}%)
                                {isCurrent ? ' [ACTIVO]' : ''}
                              </span>
                              <span
                                className={
                                  isCurrent
                                    ? 'text-[#00FF66] font-bold'
                                    : 'text-[#e3e2e7]'
                                }
                              >
                                {formatCop(dividendCop)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
              </div>

              {paymentError && (
                <div
                  data-testid="payment-error-feedback"
                  className="p-2.5 bg-[#ff007f]/15 border border-[#ff007f] text-xs font-mono text-[#ff007f] font-bold"
                >
                  {paymentError}
                </div>
              )}

              {paymentFeedback && (
                <div
                  data-testid="payment-success-feedback"
                  className="p-2.5 bg-[#00FF66]/10 border border-[#00FF66]/40 text-xs font-mono text-[#00FF66]"
                >
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

          {/* Context Column: Historial Reciente de Recaudos */}
          <div className="xl:col-span-6 bg-[#0d0e12] border border-[#292a2e] p-5 space-y-4">
            <div className="border-b border-[#292a2e] pb-3 flex items-center justify-between">
              <h3 className="text-sm font-mono font-bold uppercase tracking-wider text-white">
                Historial Reciente de Recaudos
              </h3>
              <span className="text-xs font-mono text-[#00FF66]">
                REGISTROS: {bundle.payments.length}
              </span>
            </div>

            <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
              {bundle.payments.map((payment) => {
                const payProp = bundle.properties.find(
                  (p) => p.id === payment.property_id
                );
                const paySharePct = payProp
                  ? getOwnerSharePct(payProp, bundle.selected_owner.id)
                  : 100;
                const ownerDividendCop = Math.round(
                  payment.gross_amount_cop * (paySharePct / 100)
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
                    data-testid={`payment-history-item-${payment.id}`}
                    className="p-3 bg-[#14151a] border border-[#292a2e] font-mono text-xs flex items-center justify-between gap-3"
                  >
                    <div className="space-y-0.5">
                      <div className="text-[#00eefc] font-bold">
                        {payProp
                          ? `[${payProp.code}] ${payProp.title}`
                          : `Inmueble #${payment.property_id}`}
                      </div>
                      <div className="text-white font-bold">
                        PERIODO: {payment.period_month} · REF:{' '}
                        {payment.reference_code}
                      </div>
                      <div className="text-[#9ca3af]">
                        {payment.payment_method} · FECHA: {payment.payment_date}
                      </div>
                      <div className="text-[11px] text-[#9ca3af]">
                        Pactado: {formatCop(payStatus.agreedRentCop)} ·
                        Acumulado Periodo:{' '}
                        {formatCop(payStatus.alreadyCollectedCop)} · Saldo:{' '}
                        <span
                          className={
                            payStatus.remainingBalanceCop > 0
                              ? 'text-[#ffb800] font-bold'
                              : 'text-[#00FF66] font-bold'
                          }
                        >
                          {formatCop(payStatus.remainingBalanceCop)}
                        </span>
                      </div>
                      {paySharePct < 100 && (
                        <div className="text-[11px] text-[#ffb800]">
                          Dividendo ({paySharePct}%):{' '}
                          {formatCop(ownerDividendCop)} (Total unidad:{' '}
                          {formatCop(payment.gross_amount_cop)})
                        </div>
                      )}
                    </div>
                    <div className="text-right space-y-1 shrink-0">
                      <div className="text-[#00FF66] font-bold">
                        {formatCop(
                          paySharePct < 100
                            ? ownerDividendCop
                            : payment.gross_amount_cop
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span
                          className={`text-[10px] px-1.5 py-0.5 border font-bold ${
                            isPartial
                              ? 'border-[#ffb800] bg-[#ffb800]/15 text-[#ffb800]'
                              : 'border-[#00FF66]/40 text-[#00FF66]'
                          }`}
                        >
                          {isPartial ? '[ABONO PARCIAL]' : '[PAGO COMPLETO]'}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 border border-[#00FF66]/40 text-[#00FF66]">
                          [{payment.status}]
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
