import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Propiedad } from '../../types';
import { Wrench, User, DollarSign, Calendar, FileText, Upload, Trash2, ShieldAlert } from 'lucide-react';

export interface MaintenanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  properties: Propiedad[];
  onSave: (data: {
    propiedad_id: string;
    categoria: string;
    costo: number;
    fecha: string;
    tecnico_nombre?: string;
    tecnico_contacto?: string;
    descripcion: string;
    evidencias_fotos: string[];
    evidencia_factura?: string;
    estado: 'Completado' | 'Pendiente';
  }) => Promise<void>;
}

export const MaintenanceModal: React.FC<MaintenanceModalProps> = ({
  isOpen,
  onClose,
  properties,
  onSave,
}) => {
  const todayStr = new Date().toISOString().slice(0, 10);

  const [propiedadId, setPropiedadId] = useState<string>(properties.length > 0 ? properties[0].id : '');
  const [categoria, setCategoria] = useState<string>('Plomería');
  const [costo, setCosto] = useState<number | ''>('');
  const [fecha, setFecha] = useState<string>(todayStr);
  const [tecnicoNombre, setTecnicoNombre] = useState<string>('');
  const [tecnicoContacto, setTecnicoContacto] = useState<string>('');
  const [descripcion, setDescripcion] = useState<string>('');
  const [evidenciasFotos, setEvidenciasFotos] = useState<string[]>([]);
  const [evidenciaFactura, setEvidenciaFactura] = useState<string>('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      files.forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (reader.result) {
            setEvidenciasFotos(prev => [...prev, reader.result as string]);
          }
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const handleInvoiceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (reader.result) {
          setEvidenciaFactura(reader.result as string);
        }
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const handleRemovePhoto = (index: number) => {
    setEvidenciasFotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!propiedadId) newErrors.propiedadId = 'Seleccione una propiedad';
    if (!costo || costo <= 0) newErrors.costo = 'Ingrese un costo válido';
    if (!descripcion.trim()) newErrors.descripcion = 'La descripción es obligatoria';
    if (!fecha) newErrors.fecha = 'La fecha es obligatoria';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave({
        propiedad_id: propiedadId,
        categoria,
        costo: Number(costo),
        fecha,
        tecnico_nombre: tecnicoNombre,
        tecnico_contacto: tecnicoContacto,
        descripcion,
        evidencias_fotos: evidenciasFotos,
        evidencia_factura: evidenciaFactura || undefined,
        estado: 'Completado',
      });
      onClose();
    } catch (err) {
      console.error('Error saving maintenance:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Registrar Arreglo / Mantenimiento"
      subtitle="Registro operativo con evidencias fotográficas adjuntas automáticamente a la liquidación del propietario."
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Propiedad Select */}
        <div>
          <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">
            Propiedad / Inmueble <span className="text-status-danger">*</span>
          </label>
          <select
            value={propiedadId}
            onChange={(e) => setPropiedadId(e.target.value)}
            className="w-full px-3 py-2 bg-slate-900 border border-border-subtle rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent-primary"
          >
            {properties.map(p => (
              <option key={p.id} value={p.id}>
                {p.direccion} ({p.tipo_propiedad || 'Inmueble'})
              </option>
            ))}
          </select>
          {errors.propiedadId && <p className="text-xs text-status-danger mt-1">{errors.propiedadId}</p>}
        </div>

        {/* Categoría & Fecha */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">
              Categoría de Arreglo
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted">
                <Wrench className="w-4 h-4" />
              </div>
              <select
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-border-subtle rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent-primary"
              >
                <option value="Plomería">Plomería / Fugas</option>
                <option value="Electricidad">Electricidad / Redes</option>
                <option value="Pintura">Pintura y Resanes</option>
                <option value="Cerrajería">Cerrajería y Puertas</option>
                <option value="Gasodomésticos">Gasodomésticos y Calentador</option>
                <option value="Obra Civil">Obra Civil / Mampostería</option>
                <option value="Otro">Otro Arreglo</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">
              Fecha de Ejecución <span className="text-status-danger">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted">
                <Calendar className="w-4 h-4" />
              </div>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-border-subtle rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent-primary"
              />
            </div>
            {errors.fecha && <p className="text-xs text-status-danger mt-1">{errors.fecha}</p>}
          </div>
        </div>

        {/* Costo */}
        <div>
          <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">
            Costo Total del Arreglo (COP) <span className="text-status-danger">*</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted">
              <DollarSign className="w-4 h-4" />
            </div>
            <input
              type="number"
              min="0"
              step="1000"
              placeholder="Ej. 180000"
              value={costo}
              onChange={(e) => setCosto(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-border-subtle rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent-primary font-bold text-accent-primary"
            />
          </div>
          {errors.costo && <p className="text-xs text-status-danger mt-1">{errors.costo}</p>}
        </div>

        {/* Técnico & Contacto */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">
              Técnico / Proveedor
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted">
                <User className="w-4 h-4" />
              </div>
              <input
                type="text"
                placeholder="Ej. Mario Gómez"
                value={tecnicoNombre}
                onChange={(e) => setTecnicoNombre(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-border-subtle rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">
              Contacto / Teléfono
            </label>
            <input
              type="text"
              placeholder="Ej. +57 300 123 4567"
              value={tecnicoContacto}
              onChange={(e) => setTecnicoContacto(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-border-subtle rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent-primary"
            />
          </div>
        </div>

        {/* Descripción */}
        <div>
          <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">
            Descripción del Trabajo <span className="text-status-danger">*</span>
          </label>
          <textarea
            rows={2}
            placeholder="Detalle el arreglo realizado, repuestos cambiados y observaciones..."
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            className="w-full px-3 py-2 bg-slate-900 border border-border-subtle rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent-primary"
          />
          {errors.descripcion && <p className="text-xs text-status-danger mt-1">{errors.descripcion}</p>}
        </div>

        {/* Evidencias Fotográficas */}
        <div className="p-3 bg-slate-950/80 rounded-xl border border-border-subtle space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-text-primary flex items-center gap-1.5">
              <Upload className="w-4 h-4 text-accent-primary" />
              Evidencias Fotográficas (Antes / Después)
            </span>
            <label className="px-3 py-1 bg-accent-primary hover:bg-amber-600 text-white rounded text-xs font-semibold cursor-pointer transition-colors">
              Cargar Fotos
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handlePhotoUpload}
                className="hidden"
              />
            </label>
          </div>

          {evidenciasFotos.length > 0 ? (
            <div className="flex flex-wrap gap-2 pt-1">
              {evidenciasFotos.map((foto, idx) => (
                <div key={idx} className="relative group w-20 h-20 rounded-lg overflow-hidden border border-border-subtle">
                  <img src={foto} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => handleRemovePhoto(idx)}
                    className="absolute top-1 right-1 p-1 bg-red-600/80 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-text-muted italic">No hay fotos cargadas. Se recomienda adjuntar al menos una foto del trabajo terminado.</p>
          )}

          {/* Factura / Comprobante */}
          <div className="pt-2 border-t border-border-subtle flex items-center justify-between">
            <span className="text-xs text-text-muted flex items-center gap-1">
              <FileText className="w-3.5 h-3.5" />
              Factura o Cuenta de Cobro del Técnico:
            </span>
            <label className="text-xs text-accent-primary hover:underline font-semibold cursor-pointer">
              {evidenciaFactura ? 'Factura Adjunta ✓ (Cambiar)' : 'Adjuntar Factura (Imagen)'}
              <input
                type="file"
                accept="image/*"
                onChange={handleInvoiceUpload}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* Info Box: Deducción en liquidación */}
        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-start gap-2 text-xs text-amber-300">
          <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>
            Este arreglo se deducirá automáticamente de los ingresos del propietario en el extracto PDF de liquidación mensual (100% neto), y las evidencias fotográficas se anexarán al final del informe.
          </span>
        </div>

        {/* Buttons */}
        <div className="flex justify-end gap-3 pt-3 border-t border-border-subtle">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" isLoading={isSubmitting}>
            Registrar Mantenimiento
          </Button>
        </div>
      </form>
    </Modal>
  );
};
