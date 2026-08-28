import { useState } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { useDatabase } from './hooks/useDatabase';
import { NavTab } from './types';
import { DashboardView } from './views/DashboardView';
import { AdminView } from './views/AdminView';
import { AdministracionView } from './views/AdministracionView';
import { EntitiesView } from './views/EntitiesView';
import { SettingsView } from './views/SettingsView';

export function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const db = useDatabase();

  // Header Titles & Subtitles mapping
  const tabTitles: Record<NavTab, { title: string; subtitle: string }> = {
    dashboard: {
      title: 'Dashboard Principal',
      subtitle: 'Resumen financiero, alertas de mora y KPIs inmobiliarios',
    },
    finanzas: {
      title: 'Módulo de Finanzas',
      subtitle: 'Bitácora de transacciones (Ingresos / Gastos) y liquidaciones 100% netas para propietarios',
    },
    administracion: {
      title: 'Módulo de Administración Integral',
      subtitle: 'Facturación (Arriendos, Servicios, Mantenimiento), Arrendadores, Propiedades e Inquilinos',
    },
    settings: {
      title: 'Configuración del Sistema',
      subtitle: 'Respaldo de base de datos SQLite y parámetros de marca de la agencia',
    },
  };

  return (
    <div className="flex h-screen bg-canvas text-text-primary overflow-hidden">
      {/* Sidebar Navigation */}
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <Header
          title={tabTitles[activeTab].title}
          subtitle={tabTitles[activeTab].subtitle}
        />

        <main className="flex-1 p-6 space-y-6">
          {db.loading ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3 text-text-muted">
              <div className="w-8 h-8 border-4 border-accent-primary border-t-transparent rounded-full animate-spin"></div>
              <p className="text-sm font-medium">Inicializando base de datos SQLite...</p>
            </div>
          ) : activeTab === 'dashboard' ? (
            <DashboardView db={db} onNavigateToAdmin={() => setActiveTab('finanzas')} />
          ) : activeTab === 'finanzas' ? (
            <AdminView db={db} />
          ) : activeTab === 'administracion' ? (
            <AdministracionView db={db} />
          ) : (
            <SettingsView db={db} />
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
