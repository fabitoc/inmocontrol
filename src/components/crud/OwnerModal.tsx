import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Arrendador } from '../../types';
import { User, CreditCard, Phone, Mail, FileText, Calendar } from 'lucide-react';

export interface OwnerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: Arrendador | null;
  onSave: (data: Omit<Arrendador, 'id' | 'created_at'> | Partial<Arrendador>) => void;
}

export const OwnerModal: React.FC<OwnerModalProps> = ({
  isOpen,
  onClose,
  initialData,
  onSave,
}) => {
  const [nombre, setNombre] = useState('');
  const [cedulaNit, setCedulaNit] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [cuentaBancaria, setCuentaBancaria] = useState('');
  const [diaCorteLiquidacion, setDiaCorteLiquidacion] = useState(10);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (initialData) {
      setNombre(initialData.nombre || '');
      setCedulaNit(initialData.cedula_nit || '');
      setTelefono(initialData.telefono || '');
      setEmail(initialData.email || '');
      setCuentaBancaria(initialData.cuenta_bancaria || '');
      setDiaCorteLiquidacion(initialData.dia_corte_liquidacion ?? 10);
    } else {
      setNombre('');
      setCedulaNit('');
      setTelefono('');
      setEmail('');
      setCuentaBancaria('');
      setDiaCorteLiquidacion(10);
    }
    setErrors({});
  }, [initialData, isOpen]);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!nombre.trim()) errs.nombre = 'El nombre es obligatorio';
    if (!cedulaNit.trim()) errs.cedulaNit = 'La cédula o NIT es obligatoria';
    if (!diaCorteLiquidacion || diaCorteLiquidacion < 1 || diaCorteLiquidacion > 31) {
      errs.diaCorteLiquidacion = 'El día de corte debe estar entre 1 y 31';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    onSave({
      nombre: nombre.trim(),
      cedula_nit: cedulaNit.trim(),
      telefono: telefono.trim() || undefined,
      email: email.trim() || undefined,
      cuenta_bancaria: cuentaBancaria.trim() || undefined,
      dia_corte_liquidacion: Number(diaCorteLiquidacion),
    });
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? 'Editar Arrendador (Propietario)' : 'Nuevo Arrendador (Propietario)'}
      subtitle="Complete la información del propietario y su cuenta bancaria para consignaciones."
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">
            Nombre Completo / Razón Social <span className="text-status-danger">*</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted">
              <User className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Carlos Eduardo Silva"
              className={`w-full pl-9 pr-3 py-2 bg-slate-900 border ${
                errors.nombre ? 'border-status-danger' : 'border-border-subtle'
              } rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent-primary transition-colors`}
            />
          </div>
          {errors.nombre && <p className="text-xs text-status-danger mt-1">{errors.nombre}</p>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">
              Cédula / NIT <span className="text-status-danger">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted">
                <FileText className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={cedulaNit}
                onChange={(e) => setCedulaNit(e.target.value)}
                placeholder="Ej. 80.123.456"
                className={`w-full pl-9 pr-3 py-2 bg-slate-900 border ${
                  errors.cedulaNit ? 'border-status-danger' : 'border-border-subtle'
                } rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent-primary transition-colors`}
              />
            </div>
            {errors.cedulaNit && <p className="text-xs text-status-danger mt-1">{errors.cedulaNit}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">
              Teléfono de Contacto
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted">
                <Phone className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="Ej. +57 310 555 1234"
                className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-border-subtle rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent-primary transition-colors"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">
              Correo Electrónico
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted">
                <Mail className="w-4 h-4" />
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Ej. propietario@correo.com"
                className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-border-subtle rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent-primary transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">
              Día Corte Liquidación (1–31) <span className="text-status-danger">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted">
                <Calendar className="w-4 h-4" />
              </div>
              <input
                type="number"
                min={1}
                max={31}
                value={diaCorteLiquidacion}
                onChange={(e) => setDiaCorteLiquidacion(Number(e.target.value))}
                placeholder="10"
                className={`w-full pl-9 pr-3 py-2 bg-slate-900 border ${
                  errors.diaCorteLiquidacion ? 'border-status-danger' : 'border-border-subtle'
                } rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent-primary transition-colors`}
              />
            </div>
            {errors.diaCorteLiquidacion && <p className="text-xs text-status-danger mt-1">{errors.diaCorteLiquidacion}</p>}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">
            Cuenta Bancaria para Transferencias (COP)
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted">
              <CreditCard className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={cuentaBancaria}
              onChange={(e) => setCuentaBancaria(e.target.value)}
              placeholder="Ej. Bancolombia Ahorros #123-456789-00"
              className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-border-subtle rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent-primary transition-colors"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-border-subtle">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary">
            {initialData ? 'Guardar Cambios' : 'Registrar Arrendador'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
