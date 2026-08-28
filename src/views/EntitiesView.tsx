import React, { useState } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Table } from '../components/ui/Table';
import { OwnerModal } from '../components/crud/OwnerModal';
import { PropertyModal } from '../components/crud/PropertyModal';
import { TenantModal } from '../components/crud/TenantModal';
import { useDatabase } from '../hooks/useDatabase';
import { Arrendador, Propiedad, Arrendatario } from '../types';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Users,
  Building2,
  UserCheck,
  Phone,
  Mail,
  CreditCard,
  ChevronDown,
  ChevronRight,
  User,
  Home,
  Layers,
  Building,
  DollarSign,
  Calendar
} from 'lucide-react';

export interface EntitiesViewProps {
  db: ReturnType<typeof useDatabase>;
  initialTab?: 'propiedades' | 'arrendadores' | 'arrendatarios';
}

export const EntitiesView: React.FC<EntitiesViewProps> = ({ db, initialTab = 'propiedades' }) => {
  const [subTab, setSubTab] = useState<'propiedades' | 'arrendadores' | 'arrendatarios'>(initialTab);
  const [searchTerm, setSearchTerm] = useState('');
  const [collapsedOwners, setCollapsedOwners] = useState<Record<string, boolean>>({});

  const toggleOwnerCollapse = (ownerId: string) => {
    setCollapsedOwners((prev) => ({ ...prev, [ownerId]: !prev[ownerId] }));
  };

  // Modal States
  const [isOwnerModalOpen, setIsOwnerModalOpen] = useState(false);
  const [selectedOwner, setSelectedOwner] = useState<Arrendador | null>(null);

  const [isPropertyModalOpen, setIsPropertyModalOpen] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<Propiedad | null>(null);

  const [isTenantModalOpen, setIsTenantModalOpen] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<Arrendatario | null>(null);

  const formatCOP = (val: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0
    }).format(val);
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
      for (const item of data) {
        await db.addProperty(item);
      }
    } else {
      await db.addProperty(data);
    }
  };

  const handleDeleteProperty = async (id: string, dir: string) => {
    if (window.confirm(`¿Está seguro de eliminar la propiedad "${dir}"? Se eliminarán las transacciones asociadas.`)) {
      await db.deleteProperty(id);
    }
  };

  // --- Handlers for Arrendatarios ---
  const handleOpenNewTenant = () => {
    setSelectedTenant(null);
    setIsTenantModalOpen(true);
  };

  const handleOpenEditTenant = (tenant: Arrendatario) => {
    setSelectedTenant(tenant);
    setIsTenantModalOpen(true);
  };

  const handleSaveTenant = async (data: any) => {
    const oldPropId = selectedTenant?.propiedad_id;
    const newPropId = data.propiedad_id;

    if (selectedTenant) {
      await db.updateTenant(selectedTenant.id, data);
    } else {
      await db.addTenant(data);
    }

    // Auto sync property occupancy states
    if (oldPropId && oldPropId !== newPropId) {
      await db.updateProperty(oldPropId, { estado: 'Vacante' });
    }
    if (newPropId) {
      await db.updateProperty(newPropId, { estado: 'Alquilada' });
    }
  };

  const handleDeleteTenant = async (id: string, name: string) => {
    const tenant = db.tenants.find(t => t.id === id);
    if (window.confirm(`¿Está seguro de eliminar al inquilino "${name}"?`)) {
      if (tenant?.propiedad_id) {
        await db.updateProperty(tenant.propiedad_id, { estado: 'Vacante' });
      }
      await db.deleteTenant(id);
    }
  };

  // Filtered lists
  const filteredOwners = db.owners.filter(o =>
    o.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    o.cedula_nit.includes(searchTerm) ||
    (o.email && o.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredProperties = db.propertiesWithOwners.filter(p =>
    p.direccion.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.arrendador_nombre && p.arrendador_nombre.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredTenants = db.tenantsWithProperties.filter(t =>
    t.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.cedula_nit.includes(searchTerm) ||
    (t.propiedad_direccion && t.propiedad_direccion.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Group properties under a landlord into Typologies: Torres, Casas subdivididas, Individuales
  const groupPropertiesByTypology = (props: Propiedad[]) => {
    const towers: Record<string, Propiedad[]> = {};
    const dividedHouses: Record<string, Propiedad[]> = {};
    const individualProps: Propiedad[] = [];

    props.forEach(prop => {
      // Check Tower pattern (contains " - Apt " and suffix like "-TA")
      if (prop.direccion.includes(' - Apt ')) {
        const baseName = prop.direccion.split(' - Apt ')[0];
        if (!towers[baseName]) towers[baseName] = [];
        towers[baseName].push(prop);
      } else if (prop.direccion.includes(' - Piso ') || prop.direccion.includes(' - Apartaestudio ')) {
        // Check Divided House pattern
        const baseName = prop.direccion.split(' - ')[0];
        if (!dividedHouses[baseName]) dividedHouses[baseName] = [];
        dividedHouses[baseName].push(prop);
      } else {
        individualProps.push(prop);
      }
    });

    return { towers, dividedHouses, individualProps };
  };

  return (
    <div className="space-y-6">
      {/* Top Header & SubTab Switcher */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-surface p-4 rounded-xl border border-border-subtle">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSubTab('propiedades')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              subTab === 'propiedades'
                ? 'bg-accent-primary text-white shadow'
                : 'text-text-muted hover:text-text-primary hover:bg-slate-800'
            }`}
          >
            <Building2 className="w-4 h-4" />
            Propiedades por Arrendador ({db.properties.length})
          </button>
          <button
            onClick={() => setSubTab('arrendadores')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              subTab === 'arrendadores'
                ? 'bg-accent-primary text-white shadow'
                : 'text-text-muted hover:text-text-primary hover:bg-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
            Directorio Arrendadores ({db.owners.length})
          </button>
          <button
            onClick={() => setSubTab('arrendatarios')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              subTab === 'arrendatarios'
                ? 'bg-accent-primary text-white shadow'
                : 'text-text-muted hover:text-text-primary hover:bg-slate-800'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            Inquilinos ({db.tenants.length})
          </button>
        </div>

        {/* Global Action Toolbar */}
        <div className="flex items-center gap-2.5">
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
        </div>
      </div>

      {/* Search Filter Bar */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-text-muted">
          <Search className="w-4 h-4" />
        </div>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder={`Buscar en ${
            subTab === 'propiedades' ? 'propiedades por dirección o propietario...' :
            subTab === 'arrendadores' ? 'arrendadores por nombre, cédula o email...' :
            'arrendatarios por nombre, cédula o propiedad...'
          }`}
          className="w-full pl-10 pr-4 py-2.5 bg-surface border border-border-subtle rounded-xl text-text-primary text-sm focus:outline-none focus:border-accent-primary transition-colors"
        />
      </div>

      {/* ========================================================================= */}
      {/* 1. SUBTAB: PROPIEDADES (INVENTARIO JERÁRQUICO CON EDICIÓN Y TIPOLOGÍAS)    */}
      {/* ========================================================================= */}
      {subTab === 'propiedades' && (
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
            db.owners
              .filter((owner) => {
                if (!searchTerm.trim()) return true;
                const ownerMatch =
                  owner.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  owner.cedula_nit.includes(searchTerm);
                const propsMatch = filteredProperties.some(
                  (p) => p.arrendador_id === owner.id
                );
                return ownerMatch || propsMatch;
              })
              .map((owner) => {
                const ownerProperties = filteredProperties.filter(
                  (p) => p.arrendador_id === owner.id
                );
                const isCollapsed = collapsedOwners[owner.id] || false;
                const totalCanon = ownerProperties.reduce((sum, p) => sum + p.canon_arriendo, 0);
                const rentedCount = ownerProperties.filter((p) => p.estado === 'Alquilada').length;
                const vacantCount = ownerProperties.filter((p) => p.estado === 'Vacante').length;

                // Group properties by typologies
                const { towers, dividedHouses, individualProps } = groupPropertiesByTypology(ownerProperties);

                return (
                  <Card key={owner.id} className="border-border-subtle overflow-hidden">
                    {/* Owner Header with Edit Action */}
                    <div
                      onClick={() => toggleOwnerCollapse(owner.id)}
                      className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 cursor-pointer select-none -m-5 p-5 bg-slate-900/95 hover:bg-slate-850 rounded-xl transition-colors border-b border-border-subtle"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-accent-primary/10 border border-accent-primary/30 rounded-xl text-accent-primary">
                          <User className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-text-primary text-base">
                              {owner.nombre}
                            </h3>
                            <span className="text-xs text-text-muted font-mono bg-slate-950 px-2 py-0.5 rounded border border-border-subtle">
                              NIT/CC: {owner.cedula_nit}
                            </span>
                            {/* Inline Edit Button for Landlord */}
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

                      {/* Header Metrics & Toggle Icon */}
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

                        <div className="text-text-muted p-1 rounded-lg hover:bg-slate-800">
                          {isCollapsed ? (
                            <ChevronRight className="w-5 h-5" />
                          ) : (
                            <ChevronDown className="w-5 h-5" />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Owner Properties Content (Grouped by Typologies) */}
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
                            {/* 1. TORRES CLUSTER */}
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
                                            Edificio / Torre ({towerProps.length} Apartamentos)
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
                                      {
                                        header: 'Apartamento',
                                        accessorKey: 'direccion',
                                        className: 'font-semibold text-xs',
                                      },
                                      {
                                        header: 'Inquilino Asignado',
                                        cell: (p) => {
                                          const tenant = db.tenants.find(t => t.propiedad_id === p.id);
                                          return tenant ? (
                                            <span className="text-xs text-text-primary font-medium">{tenant.nombre}</span>
                                          ) : (
                                            <span className="text-xs text-text-muted italic">Sin asignar</span>
                                          );
                                        }
                                      },
                                      {
                                        header: 'Canon COP',
                                        cell: (p) => (
                                          <span className="font-extrabold text-accent-primary text-xs">
                                            {formatCOP(p.canon_arriendo)}
                                          </span>
                                        ),
                                      },
                                      {
                                        header: 'Vencimiento',
                                        cell: (p) => (
                                          <span className="text-xs text-text-muted">
                                            Día {p.dia_vencimiento_pago ?? 5}
                                          </span>
                                        ),
                                      },
                                      {
                                        header: 'Estado',
                                        cell: (p) => (
                                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                            p.estado === 'Alquilada'
                                              ? 'bg-status-success/20 text-status-success'
                                              : 'bg-slate-800 text-text-muted'
                                          }`}>
                                            {p.estado}
                                          </span>
                                        ),
                                      },
                                      {
                                        header: 'Acciones',
                                        className: 'text-right w-20',
                                        cell: (p) => (
                                          <div className="flex items-center justify-end gap-1">
                                            <button
                                              onClick={() => handleOpenEditProperty(p)}
                                              className="p-1 text-text-muted hover:text-accent-primary rounded transition-colors"
                                              title="Editar unidad"
                                            >
                                              <Edit2 className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                              onClick={() => handleDeleteProperty(p.id, p.direccion)}
                                              className="p-1 text-text-muted hover:text-status-danger rounded transition-colors"
                                              title="Eliminar unidad"
                                            >
                                              <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                          </div>
                                        ),
                                      },
                                    ]}
                                  />
                                </div>
                              );
                            })}

                            {/* 2. CASAS SUBDIVIDIDAS CLUSTER */}
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
                                            Casa Subdividida ({houseProps.length} Unidades / Pisos)
                                          </span>
                                        </h4>
                                        <p className="text-[11px] text-text-muted">
                                          {occupied} alquiladas • {houseProps.length - occupied} vacantes
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
                                      {
                                        header: 'División / Nivel',
                                        accessorKey: 'direccion',
                                        className: 'font-semibold text-xs',
                                      },
                                      {
                                        header: 'Inquilino Asignado',
                                        cell: (p) => {
                                          const tenant = db.tenants.find(t => t.propiedad_id === p.id);
                                          return tenant ? (
                                            <span className="text-xs text-text-primary font-medium">{tenant.nombre}</span>
                                          ) : (
                                            <span className="text-xs text-text-muted italic">Sin asignar</span>
                                          );
                                        }
                                      },
                                      {
                                        header: 'Canon COP',
                                        cell: (p) => (
                                          <span className="font-extrabold text-accent-primary text-xs">
                                            {formatCOP(p.canon_arriendo)}
                                          </span>
                                        ),
                                      },
                                      {
                                        header: 'Vencimiento',
                                        cell: (p) => (
                                          <span className="text-xs text-text-muted">
                                            Día {p.dia_vencimiento_pago ?? 5}
                                          </span>
                                        ),
                                      },
                                      {
                                        header: 'Estado',
                                        cell: (p) => (
                                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                            p.estado === 'Alquilada'
                                              ? 'bg-status-success/20 text-status-success'
                                              : 'bg-slate-800 text-text-muted'
                                          }`}>
                                            {p.estado}
                                          </span>
                                        ),
                                      },
                                      {
                                        header: 'Acciones',
                                        className: 'text-right w-20',
                                        cell: (p) => (
                                          <div className="flex items-center justify-end gap-1">
                                            <button
                                              onClick={() => handleOpenEditProperty(p)}
                                              className="p-1 text-text-muted hover:text-accent-primary rounded transition-colors"
                                              title="Editar unidad"
                                            >
                                              <Edit2 className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                              onClick={() => handleDeleteProperty(p.id, p.direccion)}
                                              className="p-1 text-text-muted hover:text-status-danger rounded transition-colors"
                                              title="Eliminar unidad"
                                            >
                                              <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                          </div>
                                        ),
                                      },
                                    ]}
                                  />
                                </div>
                              );
                            })}

                            {/* 3. INMUEBLES INDIVIDUALES */}
                            {individualProps.length > 0 && (
                              <div className="space-y-2">
                                {(Object.keys(towers).length > 0 || Object.keys(dividedHouses).length > 0) && (
                                  <h5 className="text-xs font-bold text-text-muted uppercase tracking-wider pl-1">
                                    Inmuebles Individuales e Independientes
                                  </h5>
                                )}
                                <Table
                                  data={individualProps}
                                  keyExtractor={(prop) => prop.id}
                                  columns={[
                                    {
                                      header: 'Dirección Inmueble',
                                      accessorKey: 'direccion',
                                      className: 'font-semibold text-xs',
                                    },
                                    {
                                      header: 'Tipo',
                                      cell: (prop) => (
                                        <span className="px-2 py-0.5 bg-slate-900 border border-border-subtle rounded text-xs text-text-muted">
                                          {prop.tipo_propiedad || 'Apartamento'}
                                        </span>
                                      ),
                                    },
                                    {
                                      header: 'Inquilino Asignado',
                                      cell: (p) => {
                                        const tenant = db.tenants.find(t => t.propiedad_id === p.id);
                                        return tenant ? (
                                          <span className="text-xs text-text-primary font-medium">{tenant.nombre}</span>
                                        ) : (
                                          <span className="text-xs text-text-muted italic">Vacante / Sin inquilino</span>
                                        );
                                      }
                                    },
                                    {
                                      header: 'Canon COP',
                                      cell: (prop) => (
                                        <span className="font-extrabold text-accent-primary text-xs">
                                          {formatCOP(prop.canon_arriendo)}
                                        </span>
                                      ),
                                    },
                                    {
                                      header: 'Vencimiento',
                                      cell: (prop) => (
                                        <span className="text-xs text-text-muted">
                                          Día {prop.dia_vencimiento_pago ?? 5}
                                        </span>
                                      ),
                                    },
                                    {
                                      header: 'Estado',
                                      cell: (prop) => (
                                        <span
                                          className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                            prop.estado === 'Alquilada'
                                              ? 'bg-status-success/20 text-status-success'
                                              : prop.estado === 'Mantenimiento'
                                              ? 'bg-amber-500/20 text-amber-400'
                                              : 'bg-slate-800 text-text-muted'
                                          }`}
                                        >
                                          {prop.estado}
                                        </span>
                                      ),
                                    },
                                    {
                                      header: 'Acciones',
                                      className: 'text-right w-20',
                                      cell: (prop) => (
                                        <div className="flex items-center justify-end gap-1">
                                          <button
                                            onClick={() => handleOpenEditProperty(prop)}
                                            className="p-1 text-text-muted hover:text-accent-primary rounded transition-colors"
                                            title="Editar propiedad"
                                          >
                                            <Edit2 className="w-3.5 h-3.5" />
                                          </button>
                                          <button
                                            onClick={() =>
                                              handleDeleteProperty(prop.id, prop.direccion)
                                            }
                                            className="p-1 text-text-muted hover:text-status-danger rounded transition-colors"
                                            title="Eliminar propiedad"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      ),
                                    },
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
      {/* 2. SUBTAB: ARRENDADORES (DIRECTORIO COMPLETO)                             */}
      {/* ========================================================================= */}
      {subTab === 'arrendadores' && (
        <Card title="Directorio de Arrendadores (Propietarios)">
          <Table
            data={filteredOwners}
            keyExtractor={(owner) => owner.id}
            emptyMessage="No se encontraron arrendadores registrados."
            columns={[
              { header: 'ID', accessorKey: 'id', className: 'font-mono text-xs w-24' },
              { header: 'Nombre / Razón Social', accessorKey: 'nombre', className: 'font-semibold' },
              { header: 'Cédula / NIT', accessorKey: 'cedula_nit' },
              {
                header: 'Contacto',
                cell: (owner) => (
                  <div className="text-xs space-y-0.5">
                    {owner.telefono && <p className="flex items-center gap-1 text-text-primary"><Phone className="w-3 h-3 text-text-muted" />{owner.telefono}</p>}
                    {owner.email && <p className="flex items-center gap-1 text-text-muted"><Mail className="w-3 h-3" />{owner.email}</p>}
                  </div>
                )
              },
              {
                header: 'Cuenta Bancaria',
                cell: (owner) => (
                  owner.cuenta_bancaria ? (
                    <span className="flex items-center gap-1.5 text-xs text-amber-400 font-medium">
                      <CreditCard className="w-3.5 h-3.5 shrink-0" />
                      {owner.cuenta_bancaria}
                    </span>
                  ) : (
                    <span className="text-xs text-text-muted">No registrada</span>
                  )
                )
              },
              {
                header: 'Corte Liquidación',
                cell: (owner) => (
                  <span className="px-2.5 py-1 rounded bg-slate-900 border border-border-subtle text-xs font-semibold text-text-primary">
                    Día {owner.dia_corte_liquidacion ?? 10}
                  </span>
                )
              },
              {
                header: 'Acciones',
                className: 'text-right w-28',
                cell: (owner) => (
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => handleOpenEditOwner(owner)}
                      className="p-1.5 text-text-muted hover:text-accent-primary hover:bg-slate-800 rounded-lg transition-colors"
                      title="Editar arrendador"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteOwner(owner.id, owner.nombre)}
                      className="p-1.5 text-text-muted hover:text-status-danger hover:bg-slate-800 rounded-lg transition-colors"
                      title="Eliminar arrendador"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )
              }
            ]}
          />
        </Card>
      )}

      {/* ========================================================================= */}
      {/* 3. SUBTAB: ARRENDATARIOS (INQUILINOS DIRECTORY)                           */}
      {/* ========================================================================= */}
      {subTab === 'arrendatarios' && (
        <Card title="Listado de Arrendatarios (Inquilinos)">
          <Table
            data={filteredTenants}
            keyExtractor={(tenant) => tenant.id}
            emptyMessage="No se encontraron arrendatarios registrados."
            columns={[
              { header: 'ID', accessorKey: 'id', className: 'font-mono text-xs w-24' },
              { header: 'Nombre Inquilino', accessorKey: 'nombre', className: 'font-semibold' },
              { header: 'Cédula / NIT', accessorKey: 'cedula_nit' },
              { header: 'Propiedad Asignada', accessorKey: 'propiedad_direccion' },
              {
                header: 'Vigencia Contrato',
                cell: (tenant) => (
                  <span className="text-xs text-text-muted">
                    {tenant.fecha_inicio} {tenant.fecha_fin ? `hasta ${tenant.fecha_fin}` : '(Indefinido)'}
                  </span>
                )
              },
              {
                header: 'Acciones',
                className: 'text-right w-28',
                cell: (tenant) => (
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => handleOpenEditTenant(tenant)}
                      className="p-1.5 text-text-muted hover:text-accent-primary hover:bg-slate-800 rounded-lg transition-colors"
                      title="Editar arrendatario"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteTenant(tenant.id, tenant.nombre)}
                      className="p-1.5 text-text-muted hover:text-status-danger hover:bg-slate-800 rounded-lg transition-colors"
                      title="Eliminar arrendatario"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )
              }
            ]}
          />
        </Card>
      )}

      {/* CRUD Modals */}
      <OwnerModal
        isOpen={isOwnerModalOpen}
        onClose={() => setIsOwnerModalOpen(false)}
        initialData={selectedOwner}
        onSave={handleSaveOwner}
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
        onSave={handleSaveTenant}
      />
    </div>
  );
};
