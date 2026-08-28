import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Propiedad, Arrendador, PropertyStatus, PropertyType, HouseDivisionType, AdminFeeType } from '../../types';
import { Building2, DollarSign, Calendar, Tag, Home, Layers, Percent, ShieldCheck } from 'lucide-react';

export interface PropertyModalProps {
  isOpen: boolean;
  onClose: () => void;
  owners: Arrendador[];
  initialData?: Propiedad | null;
  onSave: (
    data: Omit<Propiedad, 'id' | 'created_at'> | Omit<Propiedad, 'id' | 'created_at'>[]
  ) => void;
}

export const PropertyModal: React.FC<PropertyModalProps> = ({
  isOpen,
  onClose,
  owners,
  initialData,
  onSave,
}) => {
  const [arrendadorId, setArrendadorId] = useState('');
  const [tipoPropiedad, setTipoPropiedad] = useState<PropertyType>('Apartamento');
  const [direccion, setDireccion] = useState('');
  const [canonArriendo, setCanonArriendo] = useState<number | ''>('');
  const [diaVencimientoPago, setDiaVencimientoPago] = useState<number>(5);
  const [estado, setEstado] = useState<PropertyStatus>('Vacante');

  // Administration Fee State
  const [tipoAdministracion, setTipoAdministracion] = useState<AdminFeeType>('Ninguna');
  const [valorAdministracion, setValorAdministracion] = useState<number | ''>('');
  const [distribucionMulti, setDistribucionMulti] = useState<'PorUnidad' | 'Total'>('PorUnidad');

  // Torre sub-division state
  const [numAptosTorre, setNumAptosTorre] = useState<number>(4);
  const [inicialesTorre, setInicialesTorre] = useState<string>('TA');

  // Casa sub-division state
  const [casaDivision, setCasaDivision] = useState<HouseDivisionType>('Ninguna');
  const [numDivisionesCasa, setNumDivisionesCasa] = useState<number>(2);

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (initialData) {
      setArrendadorId(initialData.arrendador_id || '');
      setTipoPropiedad(initialData.tipo_propiedad || 'Apartamento');
      setDireccion(initialData.direccion || '');
      setCanonArriendo(initialData.canon_arriendo ?? '');
      setDiaVencimientoPago(initialData.dia_vencimiento_pago ?? initialData.dia_corte ?? 5);
      setTipoAdministracion(initialData.tipo_administracion || 'Ninguna');
      setValorAdministracion(initialData.valor_administracion ?? '');
      setEstado(initialData.estado || 'Vacante');
    } else {
      setArrendadorId(owners.length > 0 ? owners[0].id : '');
      setTipoPropiedad('Apartamento');
      setDireccion('');
      setCanonArriendo('');
      setDiaVencimientoPago(5);
      setTipoAdministracion('Ninguna');
      setValorAdministracion('');
      setDistribucionMulti('PorUnidad');
      setEstado('Vacante');
      setNumAptosTorre(4);
      setInicialesTorre('TA');
      setCasaDivision('Ninguna');
      setNumDivisionesCasa(2);
    }
    setErrors({});
  }, [initialData, isOpen, owners]);

  const isMultiUnit = !initialData && (tipoPropiedad === 'Torre' || (tipoPropiedad === 'Casa' && casaDivision !== 'Ninguna'));
  const totalUnits = tipoPropiedad === 'Torre' ? numAptosTorre : numDivisionesCasa;

  // Compute calculated admin fee per unit in COP for preview
  const calculatedAdminFeePerUnit = useMemo(() => {
    if (tipoAdministracion === 'Ninguna' || valorAdministracion === '' || Number(valorAdministracion) <= 0) {
      return 0;
    }
    const val = Number(valorAdministracion);
    const canon = typeof canonArriendo === 'number' ? canonArriendo : 0;

    if (tipoAdministracion === 'Porcentaje') {
      return Math.round(canon * (val / 100));
    }

    if (tipoAdministracion === 'MontoFijo') {
      if (isMultiUnit && distribucionMulti === 'Total' && totalUnits > 0) {
        return Math.round(val / totalUnits);
      }
      return val;
    }

    return 0;
  }, [tipoAdministracion, valorAdministracion, canonArriendo, isMultiUnit, distribucionMulti, totalUnits]);

  const formatCOP = (val: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!arrendadorId) newErrors.arrendadorId = 'El propietario es obligatorio';
    if (!direccion.trim()) newErrors.direccion = 'La dirección / nombre base es obligatoria';
    if (canonArriendo === '' || canonArriendo < 0) newErrors.canonArriendo = 'Ingrese un canon de arriendo válido';
    if (!diaVencimientoPago || diaVencimientoPago < 1 || diaVencimientoPago > 31) {
      newErrors.diaVencimientoPago = 'Día de pago inválido (1–31)';
    }

    if (tipoAdministracion !== 'Ninguna' && (valorAdministracion === '' || Number(valorAdministracion) < 0)) {
      newErrors.valorAdministracion = 'Ingrese un valor de administración válido';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const valAdmin = tipoAdministracion === 'Ninguna' ? 0 : Number(valorAdministracion || 0);

    // Sub-division logic: Torre
    if (!initialData && tipoPropiedad === 'Torre') {
      const generatedProps: Omit<Propiedad, 'id' | 'created_at'>[] = [];
      const prefix = inicialesTorre.trim().toUpperCase() || 'TA';
      const perUnitFee = calculatedAdminFeePerUnit;

      for (let i = 1; i <= numAptosTorre; i++) {
        const aptoNumber = i < 10 ? `0${i}` : `${i}`;
        generatedProps.push({
          arrendador_id: arrendadorId,
          direccion: `${direccion.trim()} - ${prefix}-${aptoNumber}`,
          tipo_propiedad: 'Apartamento',
          canon_arriendo: Number(canonArriendo),
          dia_vencimiento_pago: Number(diaVencimientoPago),
          tipo_administracion: tipoAdministracion,
          valor_administracion: valAdmin,
          cuota_administracion: perUnitFee,
          estado: 'Vacante',
        });
      }
      onSave(generatedProps);
      onClose();
      return;
    }

    // Sub-division logic: Casa
    if (!initialData && tipoPropiedad === 'Casa' && casaDivision !== 'Ninguna') {
      const generatedProps: Omit<Propiedad, 'id' | 'created_at'>[] = [];
      const perUnitFee = calculatedAdminFeePerUnit;

      for (let i = 1; i <= numDivisionesCasa; i++) {
        const subLabel = casaDivision === 'Pisos' ? `Piso ${i}` : `Apartaestudio ${100 + i}`;
        generatedProps.push({
          arrendador_id: arrendadorId,
          direccion: `${direccion.trim()} - ${subLabel}`,
          tipo_propiedad: casaDivision === 'Pisos' ? 'Apartamento' : 'Otro',
          canon_arriendo: Number(canonArriendo),
          dia_vencimiento_pago: Number(diaVencimientoPago),
          tipo_administracion: tipoAdministracion,
          valor_administracion: valAdmin,
          cuota_administracion: perUnitFee,
          estado: 'Vacante',
        });
      }
      onSave(generatedProps);
      onClose();
      return;
    }

    // Single Property
    onSave({
      arrendador_id: arrendadorId,
      direccion: direccion.trim(),
      tipo_propiedad: tipoPropiedad,
      canon_arriendo: Number(canonArriendo),
      dia_vencimiento_pago: Number(diaVencimientoPago),
      tipo_administracion: tipoAdministracion,
      valor_administracion: valAdmin,
      cuota_administracion: calculatedAdminFeePerUnit,
      estado,
    });
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? 'Editar Inmueble' : 'Registrar Nuevo Inmueble'}
      subtitle="Complete los datos del inmueble para el control de contratos, cobros y cuota de administración."
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Propietario Select */}
        <div>
          <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">
            Propietario / Arrendador <span className="text-status-danger">*</span>
          </label>
          <select
            value={arrendadorId}
            onChange={(e) => setArrendadorId(e.target.value)}
            className={`w-full px-3 py-2 bg-slate-900 border ${
              errors.arrendadorId ? 'border-status-danger' : 'border-border-subtle'
            } rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent-primary transition-colors`}
          >
            {owners.map((owner) => (
              <option key={owner.id} value={owner.id}>
                {owner.nombre} ({owner.cedula_nit})
              </option>
            ))}
          </select>
          {errors.arrendadorId && <p className="text-xs text-status-danger mt-1">{errors.arrendadorId}</p>}
        </div>

        {/* Tipo & Estado */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">
              Tipo de Inmueble
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted">
                <Tag className="w-4 h-4" />
              </div>
              <select
                value={tipoPropiedad}
                onChange={(e) => setTipoPropiedad(e.target.value as PropertyType)}
                disabled={!!initialData}
                className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-border-subtle rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent-primary transition-colors disabled:opacity-50"
              >
                <option value="Apartamento">Apartamento Individual</option>
                <option value="Casa">Casa Unifamiliar / Subdividida</option>
                <option value="Torre">Edificio / Torre de Apartamentos</option>
                <option value="Local">Local Comercial</option>
                <option value="Bodega">Bodega</option>
                <option value="Garaje">Garaje / Parqueadero</option>
                <option value="Otro">Otro Inmueble</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">
              Estado de Ocupación
            </label>
            <select
              value={estado}
              onChange={(e) => setEstado(e.target.value as PropertyStatus)}
              className="w-full px-3 py-2 bg-slate-900 border border-border-subtle rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent-primary transition-colors"
            >
              <option value="Vacante">Vacante (Disponible)</option>
              <option value="Alquilada">Alquilada</option>
              <option value="Mantenimiento">En Mantenimiento / Reparación</option>
            </select>
          </div>
        </div>

        {/* Dirección / Nombre Base */}
        <div>
          <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">
            {tipoPropiedad === 'Torre'
              ? 'Nombre / Dirección del Edificio o Torre'
              : tipoPropiedad === 'Casa' && !initialData && casaDivision !== 'Ninguna'
              ? 'Dirección / Nombre Base de la Casa'
              : 'Dirección Completa del Inmueble'}{' '}
            <span className="text-status-danger">*</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted">
              <Building2 className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
              placeholder={
                tipoPropiedad === 'Torre'
                  ? 'Ej. Torre Los Rosales, Calle 140 # 11-20'
                  : 'Ej. Calle 100 # 15-20 Apt 502'
              }
              className={`w-full pl-9 pr-3 py-2 bg-slate-900 border ${
                errors.direccion ? 'border-status-danger' : 'border-border-subtle'
              } rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent-primary transition-colors`}
            />
          </div>
          {errors.direccion && <p className="text-xs text-status-danger mt-1">{errors.direccion}</p>}
        </div>

        {/* Torre Multi-Unit Settings */}
        {!initialData && tipoPropiedad === 'Torre' && (
          <div className="p-3.5 bg-slate-950/80 rounded-xl border border-border-subtle space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-accent-primary">
              <Layers className="w-4 h-4" />
              Configuración de Unidades del Edificio / Torre
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-text-muted mb-1">
                  Cantidad de Apartamentos
                </label>
                <input
                  type="number"
                  min="2"
                  max="50"
                  value={numAptosTorre}
                  onChange={(e) => setNumAptosTorre(Number(e.target.value))}
                  className="w-full px-3 py-1.5 bg-slate-900 border border-border-subtle rounded-lg text-text-primary text-xs focus:outline-none focus:border-accent-primary"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-text-muted mb-1">
                  Prefijo / Iniciales de Nomenclatura
                </label>
                <input
                  type="text"
                  placeholder="Ej. TA, BL1, APT"
                  value={inicialesTorre}
                  onChange={(e) => setInicialesTorre(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-900 border border-border-subtle rounded-lg text-text-primary text-xs focus:outline-none focus:border-accent-primary"
                />
              </div>
            </div>

            <p className="text-[11px] text-text-muted">
              ✨ Se generarán automáticamente <b>{numAptosTorre}</b> propiedades independientes vinculadas al propietario:{' '}
              <span className="text-amber-400 font-mono">
                {direccion.trim() || 'Torre'} - {inicialesTorre.trim().toUpperCase() || 'TA'}-01 a ...
              </span>
            </p>
          </div>
        )}

        {/* Casa Sub-Division Settings */}
        {!initialData && tipoPropiedad === 'Casa' && (
          <div className="p-3.5 bg-slate-950/80 rounded-xl border border-border-subtle space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-accent-primary">
              <Home className="w-4 h-4" />
              Subdivisión de Casa (Opcional)
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-text-muted mb-1">
                  Modalidad de División
                </label>
                <select
                  value={casaDivision}
                  onChange={(e) => setCasaDivision(e.target.value as HouseDivisionType)}
                  className="w-full px-3 py-1.5 bg-slate-900 border border-border-subtle rounded-lg text-text-primary text-xs focus:outline-none focus:border-accent-primary"
                >
                  <option value="Ninguna">Casa Completa (Unifamiliar)</option>
                  <option value="Pisos">Dividida por Pisos Independientes</option>
                  <option value="Apartaestudios">Dividida en Apartaestudios</option>
                </select>
              </div>

              {casaDivision !== 'Ninguna' && (
                <div>
                  <label className="block text-[11px] font-semibold text-text-muted mb-1">
                    Número de {casaDivision === 'Pisos' ? 'Pisos' : 'Apartaestudios'}
                  </label>
                  <input
                    type="number"
                    min="2"
                    max="10"
                    value={numDivisionesCasa}
                    onChange={(e) => setNumDivisionesCasa(Number(e.target.value))}
                    className="w-full px-3 py-1.5 bg-slate-900 border border-border-subtle rounded-lg text-text-primary text-xs focus:outline-none focus:border-accent-primary"
                  />
                </div>
              )}
            </div>

            {casaDivision !== 'Ninguna' && (
              <p className="text-[11px] text-text-muted">
                ✨ Se crearán <b>{numDivisionesCasa}</b> unidades:{' '}
                <span className="text-indigo-300 font-mono">
                  {direccion.trim() || 'Casa'} - {casaDivision === 'Pisos' ? 'Piso 1' : 'Apartaestudio 101'}
                </span>
              </p>
            )}
          </div>
        )}

        {/* Canon & Dia de Vencimiento */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">
              Canon de Arriendo por Unidad (COP $) <span className="text-status-danger">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted">
                <DollarSign className="w-4 h-4" />
              </div>
              <input
                type="number"
                min="0"
                step="50000"
                value={canonArriendo}
                onChange={(e) => setCanonArriendo(e.target.value ? Number(e.target.value) : '')}
                placeholder="Ej. 2500000"
                className={`w-full pl-9 pr-3 py-2 bg-slate-900 border ${
                  errors.canonArriendo ? 'border-status-danger' : 'border-border-subtle'
                } rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent-primary transition-colors`}
              />
            </div>
            {errors.canonArriendo && <p className="text-xs text-status-danger mt-1">{errors.canonArriendo}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">
              Día Vencimiento Pago Arriendo (1–31) <span className="text-status-danger">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted">
                <Calendar className="w-4 h-4" />
              </div>
              <input
                type="number"
                min="1"
                max="31"
                value={diaVencimientoPago}
                onChange={(e) => setDiaVencimientoPago(Number(e.target.value))}
                placeholder="Ej. 5"
                className={`w-full pl-9 pr-3 py-2 bg-slate-900 border ${
                  errors.diaVencimientoPago ? 'border-status-danger' : 'border-border-subtle'
                } rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent-primary transition-colors`}
              />
            </div>
            {errors.diaVencimientoPago && <p className="text-xs text-status-danger mt-1">{errors.diaVencimientoPago}</p>}
          </div>
        </div>

        {/* Cuota de Administración Section */}
        <div className="p-3.5 bg-slate-950/80 rounded-xl border border-border-subtle space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-text-primary flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-accent-primary" />
              Cuota de Administración (PH / Edificio)
            </span>
            {calculatedAdminFeePerUnit > 0 && (
              <span className="text-xs font-extrabold text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/30">
                {formatCOP(calculatedAdminFeePerUnit)} / unidad
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-text-muted mb-1">
                Modalidad de Cuota
              </label>
              <select
                value={tipoAdministracion}
                onChange={(e) => setTipoAdministracion(e.target.value as AdminFeeType)}
                className="w-full px-3 py-2 bg-slate-900 border border-border-subtle rounded-lg text-text-primary text-xs focus:outline-none focus:border-accent-primary"
              >
                <option value="Ninguna">No Aplica / Sin Administración ($0)</option>
                <option value="Porcentaje">Porcentaje (%) sobre el Canon</option>
                <option value="MontoFijo">Monto Fijo ($ COP)</option>
              </select>
            </div>

            {tipoAdministracion !== 'Ninguna' && (
              <div>
                <label className="block text-[11px] font-semibold text-text-muted mb-1">
                  {tipoAdministracion === 'Porcentaje' ? 'Porcentaje (%)' : 'Valor Administración (COP $)'}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted">
                    {tipoAdministracion === 'Porcentaje' ? <Percent className="w-3.5 h-3.5" /> : <DollarSign className="w-3.5 h-3.5" />}
                  </div>
                  <input
                    type="number"
                    min="0"
                    step={tipoAdministracion === 'Porcentaje' ? '0.5' : '10000'}
                    placeholder={tipoAdministracion === 'Porcentaje' ? 'Ej. 10' : 'Ej. 150000'}
                    value={valorAdministracion}
                    onChange={(e) => setValorAdministracion(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full pl-8 pr-3 py-2 bg-slate-900 border border-border-subtle rounded-lg text-text-primary text-xs focus:outline-none focus:border-accent-primary font-bold text-accent-primary"
                  />
                </div>
                {errors.valorAdministracion && <p className="text-xs text-status-danger mt-1">{errors.valorAdministracion}</p>}
              </div>
            )}
          </div>

          {/* Subdivided distribution selector for multi-unit properties with MontoFijo */}
          {isMultiUnit && tipoAdministracion === 'MontoFijo' && (
            <div className="pt-2 border-t border-border-subtle space-y-2">
              <label className="block text-[11px] font-semibold text-text-muted">
                Aplicación en Inmueble Subdividido ({totalUnits} unidades):
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <label className={`flex items-center gap-2 p-2 rounded-lg border text-xs font-semibold cursor-pointer transition-all ${
                  distribucionMulti === 'PorUnidad'
                    ? 'bg-amber-500/20 border-accent-primary text-accent-primary'
                    : 'bg-slate-900 border-border-subtle text-text-muted'
                }`}>
                  <input
                    type="radio"
                    name="distribucionMulti"
                    value="PorUnidad"
                    checked={distribucionMulti === 'PorUnidad'}
                    onChange={() => setDistribucionMulti('PorUnidad')}
                    className="hidden"
                  />
                  Aplicar monto por cada unidad individual ({formatCOP(Number(valorAdministracion || 0))} c/u)
                </label>

                <label className={`flex items-center gap-2 p-2 rounded-lg border text-xs font-semibold cursor-pointer transition-all ${
                  distribucionMulti === 'Total'
                    ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300'
                    : 'bg-slate-900 border-border-subtle text-text-muted'
                }`}>
                  <input
                    type="radio"
                    name="distribucionMulti"
                    value="Total"
                    checked={distribucionMulti === 'Total'}
                    onChange={() => setDistribucionMulti('Total')}
                    className="hidden"
                  />
                  Monto total del edificio (dividir en {totalUnits} partes iguales: {formatCOP(calculatedAdminFeePerUnit)} c/u)
                </label>
              </div>
            </div>
          )}

          {tipoAdministracion !== 'Ninguna' && (
            <p className="text-[11px] text-text-muted">
              💡 Esta cuota se deducirá automáticamente de los ingresos del propietario en el extracto de liquidación mensual.
            </p>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-border-subtle">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary">
            {initialData ? 'Guardar Cambios' : 'Registrar Propiedad(es)'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
