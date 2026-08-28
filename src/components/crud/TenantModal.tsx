import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Arrendatario, Propiedad } from '../../types';
import { User, Building2, Phone, Mail, FileText, Calendar } from 'lucide-react';

export interface TenantModalProps {
  isOpen: boolean;
  onClose: () => void;
  properties: Propiedad[];
  initialData?: Arrendatario | null;
  onSave: (data: Omit<Arrendatario, 'id' | 'created_at'> | Partial<Arrendatario>) => void;
}

export const TenantModal: React.FC<TenantModalProps> = ({
  isOpen,
  onClose,
  properties,
  initialData,
  onSave,
}) => {
  const [nombre, setNombre] = useState('');
  const [cedulaNit, setCedulaNit] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [propiedadId, setPropiedadId] = useState<string>('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    if (initialData) {
      setNombre(initialData.nombre || '');
      setCedulaNit(initialData.cedula_nit || '');
      setTelefono(initialData.telefono || '');
      setEmail(initialData.email || '');
      setPropiedadId(initialData.propiedad_id || '');
      setFechaInicio(initialData.fecha_inicio || today);
      setFechaFin(initialData.fecha_fin || '');
    } else {
      setNombre('');
      setCedulaNit('');
      setTelefono('');
      setEmail('');
      setPropiedadId('');
      setFechaInicio(today);
      setFechaFin('');
    }
    setErrors({});
  }, [initialData, isOpen]);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!nombre.trim()) errs.nombre = 'El nombre del inquilino es obligatorio';
    if (!cedulaNit.trim()) errs.cedulaNit = 'La cédula o NIT es obligatoria';
    if (!fechaInicio) errs.fechaInicio = 'La fecha de inicio de contrato es obligatoria';
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
      propiedad_id: propiedadId || null,
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin.trim() || undefined,
    });
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? 'Editar Arrendatario (Inquilino)' : 'Nuevo Arrendatario (Inquilino)'}
      subtitle="Complete los datos del inquilino, asigne la propiedad correspondiente y la vigencia del contrato."
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">
            Nombre Completo del Inquilino <span className="text-status-danger">*</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted">
              <User className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Juan Pablo Morales"
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
                placeholder="Ej. 1.018.234.567"
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
                placeholder="Ej. +57 315 222 3344"
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
                placeholder="Ej. inquilino@correo.com"
                className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-border-subtle rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent-primary transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">
              Propiedad Asignada (Solo Vacantes)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted">
                <Building2 className="w-4 h-4" />
              </div>
              <select
                value={propiedadId}
                onChange={(e) => setPropiedadId(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-border-subtle rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent-primary transition-colors"
              >
                <option value="">-- Sin propiedad asignada --</option>
                {properties
                  .filter((prop) => prop.estado === 'Vacante' || prop.id === initialData?.propiedad_id)
                  .map((prop) => (
                    <option key={prop.id} value={prop.id}>
                      {prop.direccion} (${prop.canon_arriendo.toLocaleString('es-CO')} COP) [{prop.estado}]
                    </option>
                  ))}
              </select>
            </div>
            {properties.filter((prop) => prop.estado === 'Vacante' || prop.id === initialData?.propiedad_id).length === 0 && (
              <p className="text-[11px] text-amber-400 mt-1">
                ⚠️ No hay inmuebles vacantes disponibles para arrendar.
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">
              Fecha Inicio Contrato <span className="text-status-danger">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted">
                <Calendar className="w-4 h-4" />
              </div>
              <input
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                className={`w-full pl-9 pr-3 py-2 bg-slate-900 border ${
                  errors.fechaInicio ? 'border-status-danger' : 'border-border-subtle'
                } rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent-primary transition-colors`}
              />
            </div>
            {errors.fechaInicio && <p className="text-xs text-status-danger mt-1">{errors.fechaInicio}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">
              Fecha Fin Contrato
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted">
                <Calendar className="w-4 h-4" />
              </div>
              <input
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-border-subtle rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent-primary transition-colors"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-border-subtle">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary">
            {initialData ? 'Guardar Cambios' : 'Registrar Arrendatario'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
