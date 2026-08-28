import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Transaccion, PropiedadConArrendador, TransactionType, TransactionStatus } from '../../types';
import { DollarSign, Building2, Calendar, Tag, FileText, CheckCircle2 } from 'lucide-react';

export interface TransactionFormProps {
  isOpen: boolean;
  onClose: () => void;
  properties: PropiedadConArrendador[];
  initialPropertyId?: string;
  onSave: (data: Omit<Transaccion, 'id' | 'created_at'>) => void;
}

export const TransactionForm: React.FC<TransactionFormProps> = ({
  isOpen,
  onClose,
  properties,
  initialPropertyId,
  onSave,
}) => {
  const [propiedadId, setPropiedadId] = useState('');
  const [tipo, setTipo] = useState<TransactionType>('Ingreso');
  const [categoria, setCategoria] = useState('Arriendo');
  const [concepto, setConcepto] = useState('');
  const [monto, setMonto] = useState<number | ''>('');
  const [fecha, setFecha] = useState('');
  const [estado, setEstado] = useState<TransactionStatus>('Pagado');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    setFecha(today);
    if (initialPropertyId) {
      setPropiedadId(initialPropertyId);
    } else if (properties.length > 0) {
      setPropiedadId(properties[0].id);
    }
    setTipo('Ingreso');
    setCategoria('Arriendo');
    setConcepto('Pago canon de arriendo');
    setMonto('');
    setEstado('Pagado');
    setErrors({});
  }, [isOpen, initialPropertyId, properties]);

  // Handle property change to auto-fill monthly canon if income
  const handlePropertyChange = (newPropId: string) => {
    setPropiedadId(newPropId);
    if (tipo === 'Ingreso') {
      const prop = properties.find(p => p.id === newPropId);
      if (prop) {
        setMonto(prop.canon_arriendo);
      }
    }
  };

  const handleTipoChange = (newTipo: TransactionType) => {
    setTipo(newTipo);
    if (newTipo === 'Ingreso') {
      setCategoria('Arriendo');
      setConcepto('Pago canon de arriendo');
      const prop = properties.find(p => p.id === propiedadId);
      if (prop) setMonto(prop.canon_arriendo);
    } else {
      setCategoria('Mantenimiento');
      setConcepto('Reparación / Mantenimiento de inmueble');
      setMonto('');
    }
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!propiedadId) errs.propiedadId = 'Debe seleccionar una propiedad';
    if (!concepto.trim()) errs.concepto = 'El concepto es obligatorio';
    if (monto === '' || Number(monto) <= 0) errs.monto = 'El monto debe ser un valor numérico positivo en COP';
    if (!fecha) errs.fecha = 'La fecha de la transacción es obligatoria';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    onSave({
      propiedad_id: propiedadId,
      tipo,
      categoria: categoria.trim() || (tipo === 'Ingreso' ? 'Arriendo' : 'Gasto'),
      concepto: concepto.trim(),
      monto: Number(monto),
      fecha,
      estado,
    });
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Registrar Nueva Transacción Financiera"
      subtitle="Registre pagos de arriendo recibidos o gastos de mantenimiento deducibles en COP."
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Selector de Tipo (Ingreso vs Gasto) */}
        <div>
          <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
            Tipo de Transacción <span className="text-status-danger">*</span>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => handleTipoChange('Ingreso')}
              className={`py-2.5 px-4 rounded-xl border text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                tipo === 'Ingreso'
                  ? 'bg-status-success/20 border-status-success text-status-success shadow-lg shadow-emerald-950/40'
                  : 'bg-slate-900 border-border-subtle text-text-muted hover:text-text-primary'
              }`}
            >
              <DollarSign className="w-4 h-4" />
              Ingreso (Pago Arriendo)
            </button>
            <button
              type="button"
              onClick={() => handleTipoChange('Gasto')}
              className={`py-2.5 px-4 rounded-xl border text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                tipo === 'Gasto'
                  ? 'bg-status-danger/20 border-status-danger text-status-danger shadow-lg shadow-red-950/40'
                  : 'bg-slate-900 border-border-subtle text-text-muted hover:text-text-primary'
              }`}
            >
              <Tag className="w-4 h-4" />
              Gasto (Mantenimiento)
            </button>
          </div>
        </div>

        {/* Propiedad Selector */}
        <div>
          <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">
            Propiedad Asociada <span className="text-status-danger">*</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted">
              <Building2 className="w-4 h-4" />
            </div>
            <select
              value={propiedadId}
              onChange={(e) => handlePropertyChange(e.target.value)}
              className={`w-full pl-9 pr-3 py-2 bg-slate-900 border ${
                errors.propiedadId ? 'border-status-danger' : 'border-border-subtle'
              } rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent-primary transition-colors`}
            >
              <option value="">-- Seleccionar Propiedad --</option>
              {properties.map((prop) => (
                <option key={prop.id} value={prop.id}>
                  {prop.direccion} (Propietario: {prop.arrendador_nombre})
                </option>
              ))}
            </select>
          </div>
          {errors.propiedadId && <p className="text-xs text-status-danger mt-1">{errors.propiedadId}</p>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">
              Categoría
            </label>
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-border-subtle rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent-primary transition-colors"
            >
              {tipo === 'Ingreso' ? (
                <>
                  <option value="Arriendo">Arriendo Mensual</option>
                  <option value="Depósito">Depósito de Garantía</option>
                  <option value="Otro Ingreso">Otro Ingreso</option>
                </>
              ) : (
                <>
                  <option value="Mantenimiento">Mantenimiento Preventivo</option>
                  <option value="Reparación">Reparación Locativa</option>
                  <option value="Servicios">Servicios Públicos</option>
                  <option value="Administración">Cuota de Administración</option>
                  <option value="Comisión">Comisión de Gestión</option>
                  <option value="Otro Gasto">Otro Gasto Deducible</option>
                </>
              )}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">
              Monto en COP ($) <span className="text-status-danger">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted">
                <DollarSign className="w-4 h-4" />
              </div>
              <input
                type="number"
                min="0"
                step="1000"
                value={monto}
                onChange={(e) => setMonto(e.target.value ? Number(e.target.value) : '')}
                placeholder="Ej. 1200000"
                className={`w-full pl-9 pr-3 py-2 bg-slate-900 border ${
                  errors.monto ? 'border-status-danger' : 'border-border-subtle'
                } rounded-lg text-text-primary text-sm font-bold focus:outline-none focus:border-accent-primary transition-colors`}
              />
            </div>
            {errors.monto && <p className="text-xs text-status-danger mt-1">{errors.monto}</p>}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">
            Concepto / Descripción <span className="text-status-danger">*</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted">
              <FileText className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
              placeholder="Ej. Pago de canon de arriendo - Agosto 2026"
              className={`w-full pl-9 pr-3 py-2 bg-slate-900 border ${
                errors.concepto ? 'border-status-danger' : 'border-border-subtle'
              } rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent-primary transition-colors`}
            />
          </div>
          {errors.concepto && <p className="text-xs text-status-danger mt-1">{errors.concepto}</p>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">
              Fecha de Transacción <span className="text-status-danger">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted">
                <Calendar className="w-4 h-4" />
              </div>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className={`w-full pl-9 pr-3 py-2 bg-slate-900 border ${
                  errors.fecha ? 'border-status-danger' : 'border-border-subtle'
                } rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent-primary transition-colors`}
              />
            </div>
            {errors.fecha && <p className="text-xs text-status-danger mt-1">{errors.fecha}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">
              Estado de Pago
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <select
                value={estado}
                onChange={(e) => setEstado(e.target.value as TransactionStatus)}
                className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-border-subtle rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent-primary transition-colors"
              >
                <option value="Pagado">Pagado / Erogado</option>
                <option value="Pendiente">Pendiente</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-border-subtle">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary">
            Guardar Transacción
          </Button>
        </div>
      </form>
    </Modal>
  );
};
