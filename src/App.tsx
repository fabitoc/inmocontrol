import React, { useState } from 'react';
import {
  ModuleId,
  NewContractInput,
  NewMaintenanceInput,
  NewOwnerInput,
  NewPropertyInput,
  NewRentPaymentInput,
} from './types/domain';
import { inmoRepository } from './services/inmoService';
import { DashboardAnaliticoView } from './components/modules/DashboardAnaliticoView';
import { RegistroControlView } from './components/modules/RegistroControlView';
import { MantenimientosView } from './components/modules/MantenimientosView';
import { AdministracionAlertasView } from './components/modules/AdministracionAlertasView';
import { LiquidacionesView } from './components/modules/LiquidacionesView';

const SIDEBAR_MODULES: { id: ModuleId; code: string; label: string }[] = [
  {
    id: 'dashboard-analitico',
    code: '01',
    label: '1. Dashboard Analítico',
  },
  {
    id: 'registro-control',
    code: '02',
    label: '2. Registro y Control',
  },
  {
    id: 'mantenimientos',
    code: '03',
    label: '3. Mantenimientos',
  },
  {
    id: 'administracion-alertas',
    code: '04',
    label: '4. Administración y Alertas',
  },
  {
    id: 'liquidaciones',
    code: '05',
    label: '5. Liquidaciones',
  },
];

export const App: React.FC = () => {
  const [selectedOwnerId, setSelectedOwnerId] = useState<number>(1);
  const [activeModule, setActiveModule] = useState<ModuleId>(
    'dashboard-analitico'
  );
  const [, setRevision] = useState<number>(0);
  const [lastBackupPath, setLastBackupPath] = useState<string>(
    '%LocalAppData%\\InmoControl\\backups\\inmo_backup_20261015_080000_000.db'
  );

  const bundle = inmoRepository.getOwnerDashboardBundle(selectedOwnerId);
  const allProperties = inmoRepository.getAllProperties();

  const bumpRevision = () => setRevision((r) => r + 1);

  const handleCreateOwner = (input: NewOwnerInput) => {
    const created = inmoRepository.createOwner(input);
    setSelectedOwnerId(created.id);
    bumpRevision();
  };

  const handleCreateProperty = (input: NewPropertyInput) => {
    const created = inmoRepository.createProperty(input);
    setSelectedOwnerId(created.owner_id);
    bumpRevision();
    return created;
  };

  const handleCreateContract = (input: NewContractInput) => {
    const created = inmoRepository.createTenantContract(input);
    bumpRevision();
    return created;
  };

  const handleRecordPayment = (input: NewRentPaymentInput) => {
    inmoRepository.recordRentPayment(input);
    bumpRevision();
  };

  const handleCreateMaintenance = (input: NewMaintenanceInput) => {
    inmoRepository.createMaintenanceExpense(input);
    bumpRevision();
  };

  const handleExecuteHandover = (propertyId: number) => {
    inmoRepository.executePropertyHandover(propertyId);
    bumpRevision();
  };

  const handleExecuteSettlement = (ownerId: number, periodMonth: string) => {
    inmoRepository.executeMonthlySettlement(ownerId, periodMonth);
    bumpRevision();
  };

  const handleManualBackup = () => {
    const snapshot = inmoRepository.runVacuumBackup();
    setLastBackupPath(snapshot);
    bumpRevision();
  };

  return (
    <div className="h-screen overflow-hidden bg-[#121317] text-[#e3e2e7] flex flex-col scanline-overlay">
      {/* Top Desktop OS Telemetry Bar */}
      <div className="shrink-0 bg-[#0d0e12] border-b border-[#292a2e] px-4 py-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-[#9ca3af]">
        <div className="flex items-center gap-3">
          <span className="text-[#00eefc] font-bold">
            INMOCONTROL 2.0 // DESKTOP ERP
          </span>
          <span>|</span>
          <span>DB: %LocalAppData%\InmoControl\data\inmo_database.db</span>
          <span>|</span>
          <span className="text-[#00FF66]">PRAGMA journal_mode = WAL</span>
        </div>

        <div className="flex items-center gap-3">
          <span title={lastBackupPath}>
            VACUUM INTO (30D ROTATION): ACTIVO
          </span>
          <button
            type="button"
            onClick={handleManualBackup}
            className="px-2 py-0.5 bg-[#1a1b20] border border-[#00eefc]/40 text-[#00eefc] hover:bg-[#00eefc]/10"
          >
            [ EJECUTAR BACKUP VACUUM INTO ]
          </button>
        </div>
      </div>

      {/* Main Application Frame: Left Sidebar + Right Workspace */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
        {/* Left Navigation Sidebar with the 5 Separated PRD Views */}
        <aside
          aria-label="Navegación Principal de Módulos"
          className="w-full lg:w-64 shrink-0 bg-[#0d0e12] border-b lg:border-b-0 lg:border-r border-[#292a2e] p-4 flex flex-col justify-between overflow-y-auto"
        >
          <div className="space-y-4">
            <div className="border-b border-[#292a2e] pb-3">
              <div className="text-xs font-mono text-[#00eefc] uppercase tracking-widest">
                OBSIDIAN TELEMETRY HUD
              </div>
              <h1 className="text-lg font-bold tracking-tight text-white">
                InmoControl 2.0
              </h1>
              <p className="text-xs font-mono text-[#9ca3af]">
                Arquitectura Local-First (Tauri + SQLite)
              </p>
            </div>

            <nav aria-label="Módulos del Sistema" className="space-y-1.5">
              {SIDEBAR_MODULES.map((mod) => {
                const isActive = activeModule === mod.id;
                return (
                  <button
                    key={mod.id}
                    type="button"
                    data-testid={`nav-${mod.id}`}
                    aria-current={isActive ? 'page' : undefined}
                    onClick={() => setActiveModule(mod.id)}
                    className={`w-full text-left px-3 py-2.5 font-mono text-xs uppercase tracking-wider border transition-colors flex items-center justify-between ${
                      isActive
                        ? 'bg-[#00eefc]/15 border-[#00eefc] text-[#00eefc] font-bold'
                        : 'bg-[#121317] border-[#292a2e] text-[#e3e2e7] hover:bg-[#1a1b20]'
                    }`}
                  >
                    <span>{mod.label}</span>
                    <span className="text-[10px] text-[#9ca3af]">
                      [{mod.code}]
                    </span>
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="hidden lg:block border-t border-[#292a2e] pt-3 space-y-1 font-mono text-[11px] text-[#9ca3af]">
            <div>EVIDENCIAS LOCALES:</div>
            <div className="text-[#00eefc] truncate">
              %LocalAppData%\InmoControl\evidencias\
            </div>
            <div>LATENCIA FILTRO: {bundle.query_time_ms.toFixed(2)}ms</div>
          </div>
        </aside>

        {/* Right Workspace: Global Master Owner Selector Header + Active View */}
        <div className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
          {/* Header with Global Master Owner Selector */}
          <header className="shrink-0 bg-[#0d0e12] border-b border-[#292a2e] px-6 py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <span className="text-[11px] font-mono text-[#9ca3af] uppercase tracking-widest block">
                FILTRO MAESTRO REACTIVO (&lt;300ms) // ESTADO GLOBAL SINCRONIZADO
              </span>
              <div className="text-sm font-mono text-white">
                Propietario en Foco:{' '}
                <strong className="text-[#00eefc]">
                  {bundle.selected_owner.name}
                </strong>{' '}
                <span className="text-[#9ca3af]">
                  ({bundle.selected_owner.document_id})
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <label
                htmlFor="global-owner-selector"
                className="text-xs font-mono uppercase text-[#9ca3af]"
              >
                Selector Maestro de Propietario:
              </label>
              <select
                id="global-owner-selector"
                data-testid="global-owner-selector"
                aria-label="Selector Maestro de Propietario"
                value={bundle.selected_owner.id}
                onChange={(e) => setSelectedOwnerId(Number(e.target.value))}
                className="bg-[#1a1b20] border border-[#00eefc] px-3 py-2 font-mono text-xs text-white font-bold"
              >
                {bundle.all_owners.map((owner) => (
                  <option key={owner.id} value={owner.id}>
                    {owner.name} — {owner.document_id}
                  </option>
                ))}
              </select>
            </div>
          </header>

          {/* Active Module Content Canvas */}
          <main className="flex-1 min-h-0 p-6 overflow-y-auto">
            {activeModule === 'dashboard-analitico' && (
              <DashboardAnaliticoView
                bundle={bundle}
                allProperties={allProperties}
                onNavigateModule={setActiveModule}
                onRecordPayment={handleRecordPayment}
              />
            )}

            {activeModule === 'registro-control' && (
              <RegistroControlView
                bundle={bundle}
                onCreateOwner={handleCreateOwner}
                onCreateProperty={handleCreateProperty}
                onCreateContract={handleCreateContract}
                onRecordPayment={handleRecordPayment}
              />
            )}

            {activeModule === 'mantenimientos' && (
              <MantenimientosView
                bundle={bundle}
                onCreateMaintenance={handleCreateMaintenance}
              />
            )}

            {activeModule === 'administracion-alertas' && (
              <AdministracionAlertasView
                bundle={bundle}
                onExecuteHandover={handleExecuteHandover}
                onRecordPayment={handleRecordPayment}
              />
            )}

            {activeModule === 'liquidaciones' && (
              <LiquidacionesView
                bundle={bundle}
                onExecuteSettlement={handleExecuteSettlement}
              />
            )}
          </main>
        </div>
      </div>
    </div>
  );
};

export default App;
