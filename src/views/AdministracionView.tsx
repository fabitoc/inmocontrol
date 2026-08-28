import React, { useState } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Table } from '../components/ui/Table';
import { TenantModal } from '../components/crud/TenantModal';
import { PropertyModal } from '../components/crud/PropertyModal';
import { OwnerModal } from '../components/crud/OwnerModal';
import { MaintenanceModal } from '../components/crud/MaintenanceModal';
import { useDatabase } from '../hooks/useDatabase';
import { generatePaymentReceiptPDF } from '../services/pdf';
import {
  Arrendador,
  Arrendatario,
  Propiedad,
  Mantenimiento,
  PaymentMethod,
  PaymentReceiptData,
} from '../types';
import {
  Plus,
  Search,
  Filter,
  DollarSign,
  Calendar,
  Users,
  Building2,
  Phone,
  Mail,
  Edit2,
  Trash2,
  Wrench,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  FileText,
  Printer,
  CreditCard,
  Home,
  Layers,
  Building,
  User,
  Clock,
  ShieldCheck
} from 'lucide-react';

export interface AdministracionViewProps {
  db: ReturnType<typeof useDatabase>;
}

type AdminSubTab = 'arriendos' | 'mantenimiento' | 'propiedades' | 'inquilinos';

export const AdministracionView: React.FC<AdministracionViewProps> = ({ db }) => {
  const [activeSubTab, setActiveSubTab] = useState<AdminSubTab>('arriendos');
  const [searchTerm, setSearchTerm] = useState('');

  // Modals state
  const [isOwnerModalOpen, setIsOwnerModalOpen] = useState(false);
  const [selectedOwner, setSelectedOwner] = useState<Arrendador | null>(null);

  const [isTenantModalOpen, setIsTenantModalOpen] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<Arrendatario | null>(null);

  const [isPropertyModalOpen, setIsPropertyModalOpen] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<Propiedad | null>(null);

  const [isMaintenanceModalOpen, setIsMaintenanceModalOpen] = useState(false);

  // Quick Rent Payment Modal State
  const [isRentPaymentModalOpen, setIsRentPaymentModalOpen] = useState(false);
  const [rentPaymentTarget, setRentPaymentTarget] = useState<{
    tenant: Arrendatario;
    property: Propiedad;
  } | null>(null);
  const [rentPaymentMethod, setRentPaymentMethod] = useState<PaymentMethod>('Transferencia');
  const [rentPaymentNotes, setRentPaymentNotes] = useState('');

  // Collapsed Owners State (for Propiedades view)
  const [collapsedOwners, setCollapsedOwners] = useState<Record<string, boolean>>({});

  const formatCOP = (val: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(val);
  };

  // Helper to group properties under a landlord into Typologies: Torres, Casas, Individuales
  const groupPropertiesByTypology = (props: Propiedad[]) => {
    const towers: Record<string, Propiedad[]> = {};
    const dividedHouses: Record<string, Propiedad[]> = {};
    const individualProps: Propiedad[] = [];

    props.forEach((prop) => {
      if (prop.direccion.includes(' - Apt ') || prop.direccion.includes(' - TA-') || prop.direccion.includes(' - BL')) {
        const baseName = prop.direccion.split(' - ')[0];
        if (!towers[baseName]) towers[baseName] = [];
        towers[baseName].push(prop);
      } else if (prop.direccion.includes(' - Piso ') || prop.direccion.includes(' - Apartaestudio ')) {
        const baseName = prop.direccion.split(' - ')[0];
        if (!dividedHouses[baseName]) dividedHouses[baseName] = [];
        dividedHouses[baseName].push(prop);
      } else {
        individualProps.push(prop);
      }
    });

    return { towers, dividedHouses, individualProps };
  };

  // --- Handlers for Arrendadores ---
  const handleOpenNewOwner = () => {
    setSelectedOwner(null);
    setIsOwnerModalOpen(true);
  };

  const handleOpenEditOwner = (owner: Arrendador) => {
    setSelectedOwner(owner);
    setIsOwnerModalOpen(true);
  };

  const handleSaveOwner = async (data: any) => {
    if (selectedOwner) {
      await db.updateOwner(selectedOwner.id, data);
    } else {
      await db.addOwner(data);
    }
  };

  const handleDeleteOwner = async (id: string, name: string) => {
    if (window.confirm(`¿Está seguro de eliminar al arrendador "${name}"? Esta acción desvinculará sus propiedades.`)) {
      await db.deleteOwner(id);
    }
  };

  // --- Handlers for Propiedades ---
  const handleOpenNewProperty = () => {
    setSelectedProperty(null);
    setIsPropertyModalOpen(true);
  };

  const handleOpenEditProperty = (prop: Propiedad) => {
    setSelectedProperty(prop);
    setIsPropertyModalOpen(true);
  };

  const handleSaveProperty = async (data: any) => {
    if (selectedProperty) {
      await db.updateProperty(selectedProperty.id, data);
    } else if (Array.isArray(data)) {
      for (const item of data) await db.addProperty(item);
    } else {
      await db.addProperty(data);
    }
  };

  const handleDeleteProperty = async (id: string, dir: string) => {
    if (window.confirm(`¿Está seguro de eliminar la propiedad "${dir}"? Se eliminarán las transacciones asociadas.`)) {
      await db.deleteProperty(id);
    }
  };

  // --- Handlers for Mantenimiento (100% Direct Owner Debit) ---
  const handleSaveMaintenance = async (data: any) => {
    await db.addMaintenance(data);
    await db.addTransaction({
      propiedad_id: data.propiedad_id,
      tipo: 'Gasto',
      categoria: 'Mantenimiento',
      concepto: `${data.categoria}: ${data.descripcion.slice(0, 40)}`,
      monto: data.costo,
      fecha: data.fecha,
      estado: 'Pagado',
    });
  };

  // --- Handlers for Rent Payment ---
  const handleConfirmRentPayment = async () => {
    if (!rentPaymentTarget) return;
    const { property, tenant } = rentPaymentTarget;
    const todayStr = new Date().toISOString().slice(0, 10);
    const owner = db.owners.find(o => o.id === property.arrendador_id);

    const tx = await db.addTransaction({
      propiedad_id: property.id,
      tipo: 'Ingreso',
      categoria: 'Arriendo',
      concepto: `Pago canon arriendo mensual - ${tenant.nombre}`,
      monto: property.canon_arriendo,
      fecha: todayStr,
      estado: 'Pagado',
    });

    const receipt = await db.addPaymentReceipt({
      transaccion_id: tx.id,
      propiedad_id: property.id,
      tipo_recibo: 'Arriendo',
      monto: property.canon_arriendo,
      metodo_pago: rentPaymentMethod,
      notas: rentPaymentNotes || `Canon mensual correspondiente a ${todayStr.slice(0, 7)}`,
      fecha_pago: todayStr,
    });

    if (receipt) {
      const receiptData: PaymentReceiptData = {
        receipt,
        propiedad: property,
        arrendador: owner,
        arrendatario: tenant,
        detalles: [
          {
            concepto: `Canon de Arrendamiento Mensual - ${property.direccion}`,
            valor: property.canon_arriendo,
          },
        ],
      };
      generatePaymentReceiptPDF(receiptData);
    }

    setIsRentPaymentModalOpen(false);
    setRentPaymentTarget(null);
    setRentPaymentNotes('');
  };

  // KPI calculations
  const now = new Date();
  const currentDay = now.getDate();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const overdueTenants = db.getOverdueTenants();
  const totalRentCollected = db.transactions
    .filter(tx => tx.tipo === 'Ingreso' && tx.categoria === 'Arriendo' && tx.fecha.startsWith(currentMonthStr))
    .reduce((sum, tx) => sum + tx.monto, 0);

  const totalRentPending = db.properties
    .filter(p => p.estado === 'Alquilada')
    .reduce((sum, p) => {
      const paid = db.transactions.some(
        tx => tx.propiedad_id === p.id && tx.tipo === 'Ingreso' && tx.fecha.startsWith(currentMonthStr)
      );
      return paid ? sum : sum + p.canon_arriendo;
    }, 0);

  return (
    <div className="space-y-6">
      {/* Top Navigation Subtabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border-subtle pb-4">
        <div className="flex flex-wrap items-center gap-2 bg-slate-900/80 p-1.5 rounded-xl border border-border-subtle">
          <button
            onClick={() => setActiveSubTab('arriendos')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeSubTab === 'arriendos'
                ? 'bg-accent-primary text-white shadow-lg'
                : 'text-text-muted hover:text-text-primary hover:bg-slate-800'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            Arriendos y Recaudos
            {overdueTenants.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-red-600 text-white rounded-full text-[10px] font-bold">
                {overdueTenants.length} en mora
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveSubTab('mantenimiento')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeSubTab === 'mantenimiento'
                ? 'bg-accent-primary text-white shadow-lg'
                : 'text-text-muted hover:text-text-primary hover:bg-slate-800'
            }`}
          >
            <Wrench className="w-4 h-4" />
            Mantenimiento ({db.maintenances.length})
          </button>

          <button
            onClick={() => setActiveSubTab('propiedades')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeSubTab === 'propiedades'
                ? 'bg-accent-primary text-white shadow-lg'
                : 'text-text-muted hover:text-text-primary hover:bg-slate-800'
            }`}
          >
            <Building2 className="w-4 h-4" />
            Propiedades e Inmuebles ({db.properties.length})
          </button>

          <button
            onClick={() => setActiveSubTab('inquilinos')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeSubTab === 'inquilinos'
                ? 'bg-accent-primary text-white shadow-lg'
                : 'text-text-muted hover:text-text-primary hover:bg-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
            Inquilinos ({db.tenants.length})
          </button>
        </div>

        {/* Global Action Toolbar */}
        <div className="flex items-center gap-2">
          {activeSubTab === 'mantenimiento' && (
            <Button
              variant="primary"
              icon={<Plus className="w-4 h-4" />}
              onClick={() => setIsMaintenanceModalOpen(true)}
            >
              Registrar Arreglo
            </Button>
          )}

          {activeSubTab === 'propiedades' && (
            <>
              <Button
                variant="outline"
                icon={<Plus className="w-4 h-4 text-accent-primary" />}
                onClick={handleOpenNewOwner}
              >
                Nuevo Arrendador
              </Button>
              <Button
                variant="primary"
                icon={<Plus className="w-4 h-4" />}
                onClick={handleOpenNewProperty}
              >
                Nueva Propiedad
              </Button>
            </>
          )}

          {activeSubTab === 'inquilinos' && (
            <Button
              variant="primary"
              icon={<Plus className="w-4 h-4" />}
              onClick={() => {
                setSelectedTenant(null);
                setIsTenantModalOpen(true);
              }}
            >
              Nuevo Inquilino
            </Button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. SUBTAB: ARRIENDOS Y RECAUDOS                                           */}
      {/* ========================================================================= */}
      {activeSubTab === 'arriendos' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="p-4 bg-slate-900/60 border-border-subtle">
              <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Recaudado este Mes</span>
              <div className="text-2xl font-extrabold text-status-success mt-1">{formatCOP(totalRentCollected)}</div>
              <p className="text-xs text-text-muted mt-1">Ingresos por arriendos facturados</p>
            </Card>

            <Card className="p-4 bg-slate-900/60 border-border-subtle">
              <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Pendiente por Recaudar</span>
              <div className="text-2xl font-extrabold text-amber-400 mt-1">{formatCOP(totalRentPending)}</div>
              <p className="text-xs text-text-muted mt-1">Cánones de arriendo en período de cobro</p>
            </Card>

            <Card className="p-4 bg-slate-900/60 border-border-subtle">
              <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Inquilinos en Mora</span>
              <div className="text-2xl font-extrabold text-status-danger mt-1">{overdueTenants.length}</div>
              <p className="text-xs text-text-muted mt-1">Han superado su día de corte sin pago</p>
            </Card>
          </div>

          <Card className="p-5 border-border-subtle">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
              <div>
                <h3 className="text-base font-bold text-text-primary">Estado de Cobro de Arriendos</h3>
                <p className="text-xs text-text-muted">Gestión de cobro, fecha límite del inquilino y emisión de recibo de caja oficial.</p>
              </div>
            </div>

            <Table
              data={db.tenantsWithProperties}
              keyExtractor={(t) => t.id}
              emptyMessage="No hay inquilinos con contratos vigentes registrados."
              columns={[
                {
                  header: 'Inquilino / Pagador',
                  cell: (t) => (
                    <div>
                      <div className="font-bold text-text-primary">{t.nombre}</div>
                      <div className="text-xs text-text-muted">C.C. {t.cedula_nit} | {t.telefono || 'Sin teléfono'}</div>
                    </div>
                  )
                },
                {
                  header: 'Inmueble Arrendado',
                  accessorKey: 'propiedad_direccion',
                  className: 'text-xs text-text-primary font-medium'
                },
                {
                  header: 'Canon Mensual',
                  cell: (t) => (
                    <span className="font-extrabold text-accent-primary text-sm">
                      {formatCOP(t.canon_arriendo || 0)}
                    </span>
                  )
                },
                {
                  header: 'Día Vencimiento',
                  cell: (t) => {
                    const prop = db.properties.find(p => p.id === t.propiedad_id);
                    const dueDay = prop?.dia_vencimiento_pago ?? 5;
                    const isOverdue = currentDay > dueDay && !db.transactions.some(
                      tx => tx.propiedad_id === prop?.id && tx.tipo === 'Ingreso' && tx.fecha.startsWith(currentMonthStr)
                    );
                    return (
                      <div>
                        <span className="text-xs font-semibold text-text-primary">Día {dueDay} de cada mes</span>
                        {isOverdue ? (
                          <div className="flex items-center gap-1 text-[10px] font-bold text-status-danger mt-0.5">
                            <AlertTriangle className="w-3 h-3" /> En Mora ({currentDay - dueDay} días)
                          </div>
                        ) : (
                          <div className="text-[10px] text-status-success font-medium mt-0.5">Al día / En fecha</div>
                        )}
                      </div>
                    );
                  }
                },
                {
                  header: 'Estado del Mes',
                  cell: (t) => {
                    const paidThisMonth = db.transactions.some(
                      tx => tx.propiedad_id === t.propiedad_id && tx.tipo === 'Ingreso' && tx.fecha.startsWith(currentMonthStr)
                    );
                    return (
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                        paidThisMonth
                          ? 'bg-status-success/20 text-status-success'
                          : 'bg-amber-500/20 text-amber-400'
                      }`}>
                        {paidThisMonth ? '✓ Pagado' : 'Pendiente'}
                      </span>
                    );
                  }
                },
                {
                  header: 'Acciones de Cobro',
                  className: 'text-right',
                  cell: (t) => {
                    const prop = db.properties.find(p => p.id === t.propiedad_id);
                    if (!prop) return null;
                    return (
                      <Button
                        variant="primary"
                        size="sm"
                        icon={<CreditCard className="w-3.5 h-3.5" />}
                        onClick={() => {
                          setRentPaymentTarget({ tenant: t, property: prop });
                          setIsRentPaymentModalOpen(true);
                        }}
                      >
                        Efectuar Pago
                      </Button>
                    );
                  }
                }
              ]}
            />
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. SUBTAB: MANTENIMIENTO Y ARREGLOS (100% DIRECTO A LIQUIDACIÓN)           */}
      {/* ========================================================================= */}
      {activeSubTab === 'mantenimiento' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card className="p-4 bg-slate-900/60 border-border-subtle">
              <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Total Arreglos Registrados</span>
              <div className="text-2xl font-extrabold text-accent-primary mt-1">{db.maintenances.length}</div>
              <p className="text-xs text-text-muted mt-1">Intervenciones operativas en el portafolio</p>
            </Card>

            <Card className="p-4 bg-slate-900/60 border-border-subtle">
              <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Total Inversión en Reparaciones</span>
              <div className="text-2xl font-extrabold text-status-danger mt-1">
                {formatCOP(db.maintenances.reduce((sum, m) => sum + m.costo, 0))}
              </div>
              <p className="text-xs text-text-muted mt-1">Deducibles directamente de las liquidaciones de propietarios (100% neto)</p>
            </Card>
          </div>

          <Card className="p-5 border-border-subtle">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
              <div>
                <h3 className="text-base font-bold text-text-primary">Bitácora de Mantenimientos y Reparaciones</h3>
                <p className="text-xs text-text-muted">Registro detallado con evidencias fotográficas adjuntas automáticamente al extracto PDF.</p>
              </div>
            </div>

            <Table
              data={db.maintenancesWithDetails}
              keyExtractor={(m) => m.id}
              emptyMessage="No hay registros de mantenimientos o daños en las propiedades."
              columns={[
                {
                  header: 'Fecha / Categoría',
                  cell: (m) => (
                    <div>
                      <div className="font-bold text-text-primary flex items-center gap-1.5">
                        <Wrench className="w-3.5 h-3.5 text-accent-primary" />
                        {m.categoria}
                      </div>
                      <div className="text-xs text-text-muted">{m.fecha}</div>
                    </div>
                  )
                },
                {
                  header: 'Inmueble / Ubicación',
                  accessorKey: 'propiedad_direccion',
                  className: 'text-xs font-medium text-text-primary'
                },
                {
                  header: 'Descripción del Trabajo',
                  cell: (m) => (
                    <div className="max-w-xs">
                      <p className="text-xs text-text-primary line-clamp-2">{m.descripcion}</p>
                      {m.tecnico_nombre && (
                        <p className="text-[10px] text-text-muted mt-0.5">Técnico: {m.tecnico_nombre}</p>
                      )}
                    </div>
                  )
                },
                {
                  header: 'Costo Deducible COP',
                  cell: (m) => (
                    <span className="font-extrabold text-sm text-status-danger">
                      -{formatCOP(m.costo)}
                    </span>
                  )
                },
                {
                  header: 'Evidencias',
                  cell: (m) => (
                    <div className="flex items-center gap-1">
                      {m.evidencias_fotos && m.evidencias_fotos.length > 0 ? (
                        <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold rounded">
                          📷 {m.evidencias_fotos.length} foto(s)
                        </span>
                      ) : (
                        <span className="text-[10px] text-text-muted italic">Sin fotos</span>
                      )}
                      {m.evidencia_factura && (
                        <span className="px-1.5 py-0.5 bg-slate-800 text-text-primary text-[10px] font-semibold rounded">
                          📄 Factura
                        </span>
                      )}
                    </div>
                  )
                },
                {
                  header: 'Acciones',
                  className: 'text-right',
                  cell: (m) => (
                    <button
                      onClick={() => {
                        if (confirm(`¿Eliminar registro de mantenimiento ${m.categoria}?`)) {
                          db.deleteMaintenance(m.id);
                        }
                      }}
                      className="p-1.5 text-text-muted hover:text-status-danger rounded-lg transition-colors"
                      title="Eliminar registro"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )
                }
              ]}
            />
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. SUBTAB: PROPIEDADES E INMUEBLES (ESTRUCTURA JERÁRQUICA COMPLETA)       */}
      {/* ========================================================================= */}
      {activeSubTab === 'propiedades' && (
        <div className="space-y-5">
          {db.owners.length === 0 ? (
            <Card title="Inventario de Propiedades (Inmuebles)">
              <div className="p-8 text-center text-text-muted space-y-3">
                <p>No hay propietarios ni inmuebles registrados.</p>
                <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={handleOpenNewOwner}>
                  Registrar Primer Arrendador
                </Button>
              </div>
            </Card>
          ) : (
            db.owners.map((owner) => {
              const ownerProperties = db.properties.filter(p => p.arrendador_id === owner.id);
              const isCollapsed = collapsedOwners[`prop_${owner.id}`] ?? false;
              const totalCanon = ownerProperties.reduce((sum, p) => sum + p.canon_arriendo, 0);
              const rentedCount = ownerProperties.filter(p => p.estado === 'Alquilada').length;
              const vacantCount = ownerProperties.filter(p => p.estado === 'Vacante').length;

              const { towers, dividedHouses, individualProps } = groupPropertiesByTypology(ownerProperties);

              return (
                <Card key={owner.id} className="border-border-subtle overflow-hidden">
                  {/* Owner Header with Edit Action */}
                  <div
                    onClick={() => setCollapsedOwners(prev => ({ ...prev, [`prop_${owner.id}`]: !isCollapsed }))}
                    className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 cursor-pointer select-none -m-5 p-5 bg-slate-900/95 hover:bg-slate-850 rounded-xl transition-colors border-b border-border-subtle"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-accent-primary/10 border border-accent-primary/30 rounded-xl text-accent-primary">
                        <User className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-text-primary text-base">{owner.nombre}</h3>
                          <span className="text-xs text-text-muted font-mono bg-slate-950 px-2 py-0.5 rounded border border-border-subtle">
                            NIT/CC: {owner.cedula_nit}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEditOwner(owner);
                            }}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-accent-primary text-text-muted hover:text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all border border-border-subtle"
                            title="Ver y editar datos del arrendador"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            Editar Arrendador
                          </button>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-text-muted mt-1">
                          <span>{owner.cuenta_bancaria ? `Cta: ${owner.cuenta_bancaria}` : 'Sin cuenta bancaria'}</span>
                          <span>•</span>
                          <span>Corte: <b>Día {owner.dia_corte_liquidacion ?? 10}</b></span>
                          {owner.telefono && (
                            <>
                              <span>•</span>
                              <span>Tel: {owner.telefono}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                      <div className="text-right">
                        <span className="text-[11px] text-text-muted font-semibold uppercase tracking-wider block">
                          Canon Mensual Potencial
                        </span>
                        <span className="text-sm font-extrabold text-accent-primary">
                          {formatCOP(totalCanon)}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-status-success/20 text-status-success">
                          {rentedCount} Alquilada{rentedCount !== 1 ? 's' : ''}
                        </span>
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-800 text-text-muted">
                          {vacantCount} Vacante{vacantCount !== 1 ? 's' : ''}
                        </span>
                      </div>

                      <div className="text-text-muted p-1 rounded hover:bg-slate-800">
                        {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </div>
                    </div>
                  </div>

                  {/* Owner Typologies Breakdown */}
                  {!isCollapsed && (
                    <div className="mt-4 pt-2 space-y-5">
                      {ownerProperties.length === 0 ? (
                        <div className="p-5 text-center text-xs text-text-muted bg-slate-950/40 rounded-xl border border-dashed border-border-subtle space-y-2">
                          <p>Este arrendador aún no tiene inmuebles registrados.</p>
                          <Button
                            variant="secondary"
                            size="sm"
                            icon={<Plus className="w-3.5 h-3.5" />}
                            onClick={handleOpenNewProperty}
                          >
                            Agregar Inmueble a este Arrendador
                          </Button>
                        </div>
                      ) : (
                        <>
                          {/* TORRES */}
                          {Object.keys(towers).map(towerName => {
                            const towerProps = towers[towerName];
                            const occupied = towerProps.filter(p => p.estado === 'Alquilada').length;
                            return (
                              <div key={towerName} className="p-3.5 bg-slate-950/60 rounded-xl border border-amber-500/20 space-y-3">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <div className="p-1.5 bg-amber-500/20 text-amber-400 rounded-lg">
                                      <Building className="w-4 h-4" />
                                    </div>
                                    <div>
                                      <h4 className="text-sm font-bold text-text-primary flex items-center gap-2">
                                        {towerName}
                                        <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-[10px] font-bold rounded-full">
                                          Torre ({towerProps.length} Apartamentos)
                                        </span>
                                      </h4>
                                      <p className="text-[11px] text-text-muted">
                                        {occupied} alquilados • {towerProps.length - occupied} vacantes
                                      </p>
                                    </div>
                                  </div>

                                  <div className="text-right">
                                    <div className="text-xs text-text-muted">Total Torre:</div>
                                    <div className="text-xs font-bold text-accent-primary">
                                      {formatCOP(towerProps.reduce((s, p) => s + p.canon_arriendo, 0))}
                                    </div>
                                  </div>
                                </div>

                                <Table
                                  data={towerProps}
                                  keyExtractor={(p) => p.id}
                                  columns={[
                                    { header: 'Apartamento', accessorKey: 'direccion', className: 'font-semibold text-xs' },
                                    {
                                      header: 'Inquilino Asignado',
                                      cell: (p) => {
                                        const tenant = db.tenants.find(t => t.propiedad_id === p.id);
                                        return tenant ? (
                                          <span className="text-text-primary font-medium text-xs">{tenant.nombre}</span>
                                        ) : (
                                          <span className="text-text-muted text-xs italic">Sin inquilino</span>
                                        );
                                      }
                                    },
                                    {
                                      header: 'Canon COP',
                                      cell: (p) => (
                                        <span className="font-bold text-accent-primary text-xs">
                                          {formatCOP(p.canon_arriendo)}
                                        </span>
                                      )
                                    },
                                    {
                                      header: 'Administración',
                                      cell: (p) => (
                                        p.cuota_administracion && p.cuota_administracion > 0 ? (
                                          <span className="font-semibold text-xs text-amber-400">
                                            {formatCOP(p.cuota_administracion)}
                                            {p.tipo_administracion === 'Porcentaje' && (
                                              <span className="text-[10px] text-text-muted block">({p.valor_administracion}%)</span>
                                            )}
                                          </span>
                                        ) : (
                                          <span className="text-[10px] text-text-muted">N/A</span>
                                        )
                                      )
                                    },
                                    {
                                      header: 'Día Vencimiento',
                                      cell: (p) => <span className="text-xs text-text-muted">Día {p.dia_vencimiento_pago ?? 5}</span>
                                    },
                                    {
                                      header: 'Estado',
                                      cell: (p) => (
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                          p.estado === 'Alquilada' ? 'bg-status-success/20 text-status-success' : 'bg-slate-800 text-text-muted'
                                        }`}>
                                          {p.estado}
                                        </span>
                                      )
                                    },
                                    {
                                      header: 'Acciones',
                                      className: 'text-right',
                                      cell: (p) => (
                                        <div className="flex items-center justify-end gap-1">
                                          <button
                                            onClick={() => handleOpenEditProperty(p)}
                                            className="p-1 text-text-muted hover:text-accent-primary rounded"
                                          >
                                            <Edit2 className="w-3.5 h-3.5" />
                                          </button>
                                          <button
                                            onClick={() => handleDeleteProperty(p.id, p.direccion)}
                                            className="p-1 text-text-muted hover:text-status-danger rounded"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      )
                                    }
                                  ]}
                                />
                              </div>
                            );
                          })}

                          {/* CASAS */}
                          {Object.keys(dividedHouses).map(houseName => {
                            const houseProps = dividedHouses[houseName];
                            const occupied = houseProps.filter(p => p.estado === 'Alquilada').length;
                            return (
                              <div key={houseName} className="p-3.5 bg-slate-950/60 rounded-xl border border-indigo-500/20 space-y-3">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <div className="p-1.5 bg-indigo-500/20 text-indigo-400 rounded-lg">
                                      <Home className="w-4 h-4" />
                                    </div>
                                    <div>
                                      <h4 className="text-sm font-bold text-text-primary flex items-center gap-2">
                                        {houseName}
                                        <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-400 text-[10px] font-bold rounded-full">
                                          Casa Subdividida ({houseProps.length} Unidades)
                                        </span>
                                      </h4>
                                      <p className="text-[11px] text-text-muted">
                                        {occupied} alquilados • {houseProps.length - occupied} vacantes
                                      </p>
                                    </div>
                                  </div>

                                  <div className="text-right">
                                    <div className="text-xs text-text-muted">Total Casa:</div>
                                    <div className="text-xs font-bold text-accent-primary">
                                      {formatCOP(houseProps.reduce((s, p) => s + p.canon_arriendo, 0))}
                                    </div>
                                  </div>
                                </div>

                                <Table
                                  data={houseProps}
                                  keyExtractor={(p) => p.id}
                                  columns={[
                                    { header: 'Unidad / Piso', accessorKey: 'direccion', className: 'font-semibold text-xs' },
                                    {
                                      header: 'Inquilino Asignado',
                                      cell: (p) => {
                                        const tenant = db.tenants.find(t => t.propiedad_id === p.id);
                                        return tenant ? (
                                          <span className="text-text-primary font-medium text-xs">{tenant.nombre}</span>
                                        ) : (
                                          <span className="text-text-muted text-xs italic">Sin inquilino</span>
                                        );
                                      }
                                    },
                                    {
                                      header: 'Canon COP',
                                      cell: (p) => (
                                        <span className="font-bold text-accent-primary text-xs">
                                          {formatCOP(p.canon_arriendo)}
                                        </span>
                                      )
                                    },
                                    {
                                      header: 'Administración',
                                      cell: (p) => (
                                        p.cuota_administracion && p.cuota_administracion > 0 ? (
                                          <span className="font-semibold text-xs text-amber-400">
                                            {formatCOP(p.cuota_administracion)}
                                            {p.tipo_administracion === 'Porcentaje' && (
                                              <span className="text-[10px] text-text-muted block">({p.valor_administracion}%)</span>
                                            )}
                                          </span>
                                        ) : (
                                          <span className="text-[10px] text-text-muted">N/A</span>
                                        )
                                      )
                                    },
                                    {
                                      header: 'Día Vencimiento',
                                      cell: (p) => <span className="text-xs text-text-muted">Día {p.dia_vencimiento_pago ?? 5}</span>
                                    },
                                    {
                                      header: 'Estado',
                                      cell: (p) => (
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                          p.estado === 'Alquilada' ? 'bg-status-success/20 text-status-success' : 'bg-slate-800 text-text-muted'
                                        }`}>
                                          {p.estado}
                                        </span>
                                      )
                                    },
                                    {
                                      header: 'Acciones',
                                      className: 'text-right',
                                      cell: (p) => (
                                        <div className="flex items-center justify-end gap-1">
                                          <button
                                            onClick={() => handleOpenEditProperty(p)}
                                            className="p-1 text-text-muted hover:text-accent-primary rounded"
                                          >
                                            <Edit2 className="w-3.5 h-3.5" />
                                          </button>
                                          <button
                                            onClick={() => handleDeleteProperty(p.id, p.direccion)}
                                            className="p-1 text-text-muted hover:text-status-danger rounded"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      )
                                    }
                                  ]}
                                />
                              </div>
                            );
                          })}

                          {/* INMUEBLES INDIVIDUALES */}
                          {individualProps.length > 0 && (
                            <div className="p-3.5 bg-slate-950/60 rounded-xl border border-border-subtle space-y-3">
                              <h4 className="text-sm font-bold text-text-primary">
                                Inmuebles Individuales / Standalone ({individualProps.length})
                              </h4>

                              <Table
                                data={individualProps}
                                keyExtractor={(p) => p.id}
                                columns={[
                                  { header: 'Dirección', accessorKey: 'direccion', className: 'font-semibold text-xs' },
                                  { header: 'Tipo', accessorKey: 'tipo_propiedad', className: 'text-xs text-text-muted' },
                                  {
                                    header: 'Inquilino Asignado',
                                    cell: (p) => {
                                      const tenant = db.tenants.find(t => t.propiedad_id === p.id);
                                      return tenant ? (
                                        <span className="text-text-primary font-medium text-xs">{tenant.nombre}</span>
                                      ) : (
                                        <span className="text-text-muted text-xs italic">Sin inquilino</span>
                                      );
                                    }
                                  },
                                  {
                                    header: 'Canon COP',
                                    cell: (p) => (
                                      <span className="font-bold text-accent-primary text-xs">
                                        {formatCOP(p.canon_arriendo)}
                                      </span>
                                    )
                                  },
                                  {
                                    header: 'Administración',
                                    cell: (p) => (
                                      p.cuota_administracion && p.cuota_administracion > 0 ? (
                                        <span className="font-semibold text-xs text-amber-400">
                                          {formatCOP(p.cuota_administracion)}
                                          {p.tipo_administracion === 'Porcentaje' && (
                                            <span className="text-[10px] text-text-muted block">({p.valor_administracion}%)</span>
                                          )}
                                        </span>
                                      ) : (
                                        <span className="text-[10px] text-text-muted">N/A</span>
                                      )
                                    )
                                  },
                                  {
                                    header: 'Día Vencimiento',
                                    cell: (p) => <span className="text-xs text-text-muted">Día {p.dia_vencimiento_pago ?? 5}</span>
                                  },
                                  {
                                    header: 'Estado',
                                    cell: (p) => (
                                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                        p.estado === 'Alquilada' ? 'bg-status-success/20 text-status-success' : 'bg-slate-800 text-text-muted'
                                      }`}>
                                        {p.estado}
                                      </span>
                                    )
                                  },
                                  {
                                    header: 'Acciones',
                                    className: 'text-right',
                                    cell: (p) => (
                                      <div className="flex items-center justify-end gap-1">
                                        <button
                                          onClick={() => handleOpenEditProperty(p)}
                                          className="p-1 text-text-muted hover:text-accent-primary rounded"
                                        >
                                          <Edit2 className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                          onClick={() => handleDeleteProperty(p.id, p.direccion)}
                                          className="p-1 text-text-muted hover:text-status-danger rounded"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    )
                                  }
                                ]}
                              />
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. SUBTAB: INQUILINOS (DIRECTORIO Y CONTRATOS)                             */}
      {/* ========================================================================= */}
      {activeSubTab === 'inquilinos' && (
        <Card title="Directorio de Inquilinos y Contratos">
          <Table
            data={db.tenantsWithProperties}
            keyExtractor={(t) => t.id}
            emptyMessage="No hay inquilinos registrados en la base de datos."
            columns={[
              { header: 'Nombre', accessorKey: 'nombre', className: 'font-bold text-xs' },
              { header: 'Cédula / NIT', accessorKey: 'cedula_nit', className: 'font-mono text-xs' },
              { header: 'Inmueble Asignado', accessorKey: 'propiedad_direccion', className: 'text-xs font-medium' },
              { header: 'Teléfono', accessorKey: 'telefono', className: 'text-xs text-text-muted' },
              { header: 'Email', accessorKey: 'email', className: 'text-xs text-text-muted' },
              { header: 'Fecha Inicio', accessorKey: 'fecha_inicio', className: 'text-xs' },
              {
                header: 'Acciones',
                className: 'text-right',
                cell: (t) => (
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => {
                        setSelectedTenant(t);
                        setIsTenantModalOpen(true);
                      }}
                      className="p-1 text-text-muted hover:text-accent-primary rounded"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`¿Eliminar inquilino ${t.nombre}?`)) {
                          db.deleteTenant(t.id);
                        }
                      }}
                      className="p-1 text-text-muted hover:text-status-danger rounded"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )
              }
            ]}
          />
        </Card>
      )}

      {/* Modals */}
      <OwnerModal
        isOpen={isOwnerModalOpen}
        onClose={() => setIsOwnerModalOpen(false)}
        onSave={handleSaveOwner}
        initialData={selectedOwner}
      />

      <PropertyModal
        isOpen={isPropertyModalOpen}
        onClose={() => setIsPropertyModalOpen(false)}
        owners={db.owners}
        initialData={selectedProperty}
        onSave={handleSaveProperty}
      />

      <TenantModal
        isOpen={isTenantModalOpen}
        onClose={() => setIsTenantModalOpen(false)}
        properties={db.properties}
        initialData={selectedTenant}
        onSave={async (data: any) => {
          if (selectedTenant) {
            await db.updateTenant(selectedTenant.id, data);
          } else {
            await db.addTenant(data);
          }
        }}
      />

      <MaintenanceModal
        isOpen={isMaintenanceModalOpen}
        onClose={() => setIsMaintenanceModalOpen(false)}
        properties={db.properties}
        onSave={handleSaveMaintenance}
      />

      {/* Quick Rent Payment Modal */}
      {isRentPaymentModalOpen && rentPaymentTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-border-subtle rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <h3 className="text-base font-bold text-text-primary flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-accent-primary" />
                Registrar Pago de Arriendo
              </h3>
              <button
                onClick={() => setIsRentPaymentModalOpen(false)}
                className="text-text-muted hover:text-text-primary p-1"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-slate-950 rounded-xl border border-border-subtle space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-text-muted">Inquilino:</span>
                <span className="font-bold text-text-primary">{rentPaymentTarget.tenant.nombre}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Inmueble:</span>
                <span className="font-medium text-text-primary">{rentPaymentTarget.property.direccion}</span>
              </div>
              <div className="flex justify-between border-t border-slate-800 pt-1.5 mt-1.5">
                <span className="font-semibold text-text-muted">Valor a Cobrar:</span>
                <span className="font-black text-sm text-status-success">{formatCOP(rentPaymentTarget.property.canon_arriendo)}</span>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-text-muted font-semibold mb-1">Método de Pago</label>
                <select
                  value={rentPaymentMethod}
                  onChange={(e) => setRentPaymentMethod(e.target.value as PaymentMethod)}
                  className="w-full px-3 py-2 bg-slate-950 border border-border-subtle rounded-lg text-text-primary text-xs focus:outline-none focus:border-accent-primary"
                >
                  <option value="Transferencia">Transferencia Bancaria</option>
                  <option value="Efectivo">Efectivo</option>
                  <option value="Consignacion">Consignación Bancaria</option>
                  <option value="Otro">Otro Medio</option>
                </select>
              </div>

              <div>
                <label className="block text-text-muted font-semibold mb-1">Observaciones / Notas del Recibo</label>
                <input
                  type="text"
                  placeholder="Ej. Pago correspondiente a Agosto 2026..."
                  value={rentPaymentNotes}
                  onChange={(e) => setRentPaymentNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-border-subtle rounded-lg text-text-primary text-xs focus:outline-none focus:border-accent-primary"
                />
              </div>
            </div>

            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-start gap-2 text-xs text-amber-300">
              <ShieldCheck className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>
                Al confirmar, se registrará el ingreso en la bitácora financiera y se descargará automáticamente el <b>Recibo Oficial de Pago (PDF)</b>.
              </span>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border-subtle">
              <Button variant="secondary" size="sm" onClick={() => setIsRentPaymentModalOpen(false)}>
                Cancelar
              </Button>
              <Button variant="primary" size="sm" onClick={handleConfirmRentPayment}>
                Confirmar y Emitir Recibo PDF
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
