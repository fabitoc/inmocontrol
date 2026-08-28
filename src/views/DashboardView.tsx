import React, { useState } from 'react';
import { Card } from '../components/ui/Card';
import { Table } from '../components/ui/Table';
import { Button } from '../components/ui/Button';
import { KpiCard } from '../components/dashboard/KpiCard';
import { AlertsList } from '../components/dashboard/AlertsList';
import { TransactionForm } from '../components/admin/TransactionForm';
import { useDatabase } from '../hooks/useDatabase';
import { DollarSign, AlertTriangle, Building2, ShieldCheck, Plus, ArrowRight, Receipt } from 'lucide-react';

export interface DashboardViewProps {
  db: ReturnType<typeof useDatabase>;
  onNavigateToAdmin: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ db, onNavigateToAdmin }) => {
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [prefilledPropertyId, setPrefilledPropertyId] = useState<string | undefined>(undefined);

  const financialSummary = db.getFinancialSummary();
  const overdueAlerts = db.getOverdueTenants();
  const negativeOwners = db.getNegativeBalanceOwners();

  const formatCOP = (val: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const handleRecordPaymentForProperty = (propId: string) => {
    setPrefilledPropertyId(propId);
    setIsTxModalOpen(true);
  };

  const handleSaveTransaction = async (data: any) => {
    await db.addTransaction(data);
  };

  return (
    <div className="space-y-6">
      {/* Top Financial KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Ingresos Recaudados (Mes)"
          value={formatCOP(financialSummary.totalIncomeMonth)}
          variant="success"
          badgeText="100% Neto Recaudado"
          icon={<DollarSign className="w-6 h-6" />}
        />

        <KpiCard
          title="Arriendos Pendientes"
          value={formatCOP(financialSummary.totalPendingRent)}
          variant="warning"
          badgeText="Por cobrar este mes"
          icon={<AlertTriangle className="w-6 h-6" />}
        />

        <KpiCard
          title="Propiedades Activas"
          value={`${financialSummary.activePropertiesCount} / ${db.properties.length}`}
          variant="info"
          badgeText="En arriendo vigente"
          icon={<Building2 className="w-6 h-6" />}
        />

        <KpiCard
          title="Rendimiento Neto Portfolio"
          value={formatCOP(financialSummary.netPortfolioYield)}
          variant="purple"
          badgeText="Total Ingresos - Gastos"
          icon={<ShieldCheck className="w-6 h-6" />}
        />
      </div>

      {/* Dynamic Alerts List Component */}
      <AlertsList
        overdueAlerts={overdueAlerts}
        negativeOwners={negativeOwners}
        onRecordPayment={handleRecordPaymentForProperty}
        onViewOwnerSettlement={() => onNavigateToAdmin()}
      />

      {/* Recent Transactions Section */}
      <Card
        title="Últimas Transacciones Registradas"
        subtitle="Movimientos financieros recientes en COP para el portfolio de inmuebles."
        headerAction={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setPrefilledPropertyId(undefined);
                setIsTxModalOpen(true);
              }}
              icon={<Plus className="w-3.5 h-3.5" />}
            >
              Registrar Pago / Gasto
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={onNavigateToAdmin}
              icon={<ArrowRight className="w-3.5 h-3.5" />}
            >
              Ver Administración
            </Button>
          </div>
        }
      >
        <Table
          data={db.transactionsWithDetails.slice(0, 6)}
          keyExtractor={(tx) => tx.id}
          emptyMessage="No hay transacciones registradas."
          columns={[
            { header: 'ID', accessorKey: 'id', className: 'font-mono text-xs w-24' },
            { header: 'Fecha', accessorKey: 'fecha', className: 'w-28' },
            { header: 'Propiedad / Dirección', accessorKey: 'propiedad_direccion', className: 'font-semibold' },
            {
              header: 'Tipo',
              cell: (tx) => (
                <span
                  className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                    tx.tipo === 'Ingreso'
                      ? 'bg-status-success/20 text-status-success'
                      : 'bg-status-danger/20 text-status-danger'
                  }`}
                >
                  {tx.tipo}
                </span>
              ),
            },
            { header: 'Categoría', accessorKey: 'categoria', className: 'text-xs text-text-muted' },
            { header: 'Concepto / Descripción', accessorKey: 'concepto' },
            {
              header: 'Monto COP',
              cell: (tx) => (
                <span
                  className={`font-extrabold text-sm ${
                    tx.tipo === 'Ingreso' ? 'text-status-success' : 'text-status-danger'
                  }`}
                >
                  {tx.tipo === 'Ingreso' ? '+' : '-'}{formatCOP(tx.monto)}
                </span>
              ),
            },
          ]}
        />
      </Card>

      {/* Transaction Logging Modal */}
      <TransactionForm
        isOpen={isTxModalOpen}
        onClose={() => setIsTxModalOpen(false)}
        properties={db.propertiesWithOwners}
        initialPropertyId={prefilledPropertyId}
        onSave={handleSaveTransaction}
      />
    </div>
  );
};
