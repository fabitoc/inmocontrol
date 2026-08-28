import React, { useState, useEffect } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useDatabase } from '../hooks/useDatabase';
import { getStoredAgencyBranding, saveAgencyBranding, AgencyBranding } from '../services/pdf';
import { Building2, Save, Download, Upload, Database, CheckCircle, Trash2, ShieldAlert, Sparkles } from 'lucide-react';

export interface SettingsViewProps {
  db: ReturnType<typeof useDatabase>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ db }) => {
  const [agency, setAgency] = useState<AgencyBranding>({
    nombre: 'Aide Silva Mateus - SilvaCooperativa',
    nit: '',
    telefono: '',
    email: '',
    direccion: '',
  });

  const [brandingSaved, setBrandingSaved] = useState(false);
  const [backupMessage, setBackupMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    setAgency(getStoredAgencyBranding());
  }, []);

  const handleSaveBranding = (e: React.FormEvent) => {
    e.preventDefault();
    saveAgencyBranding(agency);
    setBrandingSaved(true);
    setTimeout(() => setBrandingSaved(false), 3000);
  };

  const handleExportBackup = () => {
    try {
      const jsonStr = db.exportBackupJSON();
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `inmoadmin-backup-${dateStr}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setBackupMessage({ type: 'success', text: 'Respaldo de base de datos SQLite exportado con éxito.' });
    } catch (err) {
      setBackupMessage({ type: 'error', text: 'Error al exportar la base de datos.' });
    }
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const ok = db.importBackupJSON(content);
        if (ok) {
          setBackupMessage({ type: 'success', text: 'Base de datos SQLite restaurada correctamente.' });
        } else {
          setBackupMessage({ type: 'error', text: 'El archivo JSON no tiene la estructura de base de datos válida.' });
        }
      } catch {
        setBackupMessage({ type: 'error', text: 'Error al leer el archivo de respaldo.' });
      }
    };
    reader.readAsText(file);
  };

  const handleResetToCleanProduction = async () => {
    const confirm1 = window.confirm(
      '⚠️ ¿Está seguro de limpiar todos los datos de prueba y entrar a FASE DE PRODUCCIÓN?\n\nEsta acción eliminará todos los registros temporales y dejará la base de datos lista para clientes reales.'
    );
    if (!confirm1) return;

    const confirm2 = window.confirm(
      'Última confirmación: Se vaciarán arrendadores, inmuebles, inquilinos, transacciones y mantenimientos de prueba. ¿Desea continuar?'
    );
    if (!confirm2) return;

    await db.clearDatabase();
    setBackupMessage({
      type: 'success',
      text: '✅ Base de datos limpiada con éxito. El sistema está 100% listo para producción.',
    });
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Agency Branding Configuration Card */}
      <Card
        title="Parámetros de Marca y Encabezados PDF"
        subtitle="Configure el nombre legal y los datos que encabezarán las liquidaciones oficiales y recibos de caja en PDF."
        headerAction={
          brandingSaved && (
            <span className="flex items-center gap-1.5 px-3 py-1 bg-status-success/20 text-status-success rounded-full text-xs font-bold">
              <CheckCircle className="w-4 h-4" /> Configuración Guardada
            </span>
          )
        }
      >
        <form onSubmit={handleSaveBranding} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">
                Nombre de la Entidad / Inmobiliaria <span className="text-status-danger">*</span>
              </label>
              <input
                type="text"
                required
                value={agency.nombre}
                onChange={(e) => setAgency({ ...agency, nombre: e.target.value })}
                placeholder="Ej. Aide Silva Mateus - SilvaCooperativa"
                className="w-full px-3 py-2 bg-slate-900 border border-border-subtle rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent-primary font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">
                NIT / Identificación Tributaria (Opcional)
              </label>
              <input
                type="text"
                value={agency.nit}
                onChange={(e) => setAgency({ ...agency, nit: e.target.value })}
                placeholder="Ej. 900.123.456-7"
                className="w-full px-3 py-2 bg-slate-900 border border-border-subtle rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">
                Teléfono de Contacto (Opcional)
              </label>
              <input
                type="text"
                value={agency.telefono}
                onChange={(e) => setAgency({ ...agency, telefono: e.target.value })}
                placeholder="Ej. +57 310 000 0000"
                className="w-full px-3 py-2 bg-slate-900 border border-border-subtle rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">
                Correo Electrónico (Opcional)
              </label>
              <input
                type="email"
                value={agency.email}
                onChange={(e) => setAgency({ ...agency, email: e.target.value })}
                placeholder="Ej. contacto@silvacooperativa.com"
                className="w-full px-3 py-2 bg-slate-900 border border-border-subtle rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">
              Dirección Física / Ubicación (Opcional)
            </label>
            <input
              type="text"
              value={agency.direccion}
              onChange={(e) => setAgency({ ...agency, direccion: e.target.value })}
              placeholder="Ej. Bogotá D.C., Colombia"
              className="w-full px-3 py-2 bg-slate-900 border border-border-subtle rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent-primary"
            />
          </div>

          <div className="flex justify-end pt-2">
            <Button type="submit" variant="primary" icon={<Save className="w-4 h-4" />}>
              Guardar Parámetros de Marca
            </Button>
          </div>
        </form>
      </Card>

      {/* Production Setup & Data Cleanup Card */}
      <Card
        title="Fase de Producción y Base de Datos Local"
        subtitle="Los registros se guardan físicamente en el archivo data/database.json en la carpeta del sistema."
        headerAction={
          <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded-full text-xs font-bold text-emerald-400 font-mono">
            <Database className="w-4 h-4" /> data/database.json
          </div>
        }
      >
        <div className="space-y-6">
          {/* Database Statistics Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-slate-950/80 rounded-xl border border-border-subtle text-center">
            <div>
              <span className="text-[10px] font-bold text-text-muted uppercase">Arrendadores</span>
              <p className="text-xl font-extrabold text-text-primary mt-0.5">{db.owners.length}</p>
            </div>
            <div>
              <span className="text-[10px] font-bold text-text-muted uppercase">Propiedades</span>
              <p className="text-xl font-extrabold text-accent-primary mt-0.5">{db.properties.length}</p>
            </div>
            <div>
              <span className="text-[10px] font-bold text-text-muted uppercase">Arrendatarios</span>
              <p className="text-xl font-extrabold text-blue-400 mt-0.5">{db.tenants.length}</p>
            </div>
            <div>
              <span className="text-[10px] font-bold text-text-muted uppercase">Transacciones</span>
              <p className="text-xl font-extrabold text-status-success mt-0.5">{db.transactions.length}</p>
            </div>
          </div>

          {backupMessage && (
            <div
              className={`p-3.5 rounded-lg border text-sm font-semibold flex items-center gap-2 ${
                backupMessage.type === 'success'
                  ? 'bg-status-success/15 border-status-success/40 text-status-success'
                  : 'bg-status-danger/15 border-status-danger/40 text-status-danger'
              }`}
            >
              <CheckCircle className="w-4 h-4 shrink-0" />
              {backupMessage.text}
            </div>
          )}

          {/* Action Triggers */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-border-subtle">
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary" icon={<Download className="w-4 h-4" />} onClick={handleExportBackup}>
                Exportar Backup SQLite (JSON)
              </Button>

              <label className="inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none px-4 py-2 text-sm gap-2 bg-surface hover:bg-border border border-border-subtle text-text-primary cursor-pointer">
                <Upload className="w-4 h-4" />
                <span>Restaurar Backup desde Archivo</span>
                <input type="file" accept=".json" onChange={handleImportBackup} className="hidden" />
              </label>
            </div>

            <Button
              variant="outline"
              icon={<Trash2 className="w-4 h-4 text-status-danger" />}
              onClick={handleResetToCleanProduction}
              className="hover:border-status-danger hover:text-status-danger"
            >
              Limpiar Datos y Dejar en Blanco
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};
