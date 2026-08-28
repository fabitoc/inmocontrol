import React, { useState, useMemo } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Table } from '../components/ui/Table';
import { TransactionForm } from '../components/admin/TransactionForm';
import { SettlementPdfButton } from '../components/admin/SettlementPdfButton';
import { useDatabase } from '../hooks/useDatabase';
import { Plus, DollarSign, Calendar, Filter, Trash2, ArrowUpRight, ArrowDownRight, ShieldCheck, User } from 'lucide-react';

export interface AdminViewProps {
  db: ReturnType<typeof useDatabase>;
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export const AdminView: React.FC<AdminViewProps> = ({ db }) => {
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [filterTipo, setFilterTipo] = useState<'Todos' | 'Ingreso' | 'Gasto'>('Todos');
  const [filterPropId, setFilterPropId] = useState<string>('');

  // Settlement Generator Month/Year State
  const now = new Date();
  const [selectedOwnerId, setSelectedOwnerId] = useState<string>(
    db.owners.length > 0 ? db.owners[0].id : ''
  );
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1); // 1-12
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());

  const selectedOwner = useMemo(() => {
    return db.owners.find(o => o.id === selectedOwnerId) || db.owners[0];
  }, [db.owners, selectedOwnerId]);

  // Compute dateFrom and dateTo based on landlord cutoff day with strict month length clamping
  const { dateFrom, dateTo } = useMemo(() => {
    const cutoffDay = selectedOwner?.dia_corte_liquidacion ?? 10;
    return db.getSettlementCutoffRange(cutoffDay, selectedYear, selectedMonth);
  }, [db, selectedOwner, selectedYear, selectedMonth]);

  const formatCOP = (val: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const handleSaveTransaction = async (data: any) => {
    await db.addTransaction(data);
  };

  const handleDeleteTransaction = async (id: string, concepto: string) => {
    if (window.confirm(`¿Está seguro de eliminar la transacción "${concepto}"?`)) {
      await db.deleteTransaction(id);
    }
  };

  // Filtered transactions for main table
  const filteredTransactions = db.transactionsWithDetails.filter((tx) => {
    if (filterTipo !== 'Todos' && tx.tipo !== filterTipo) return false;
    if (filterPropId && tx.propiedad_id !== filterPropId) return false;
    return true;
  });

  // Calculate settlement preview for selected owner
  const currentSettlement = selectedOwner
    ? db.getNetSettlementForOwner(selectedOwner.id, dateFrom, dateTo)
    : null;

  return (
    <div className="space-y-6">
      {/* 100% Net Owner Settlement Engine Card */}
      <Card
        title="Generador de Liquidación 100% Neta (Arrendadores)"
        subtitle="Seleccione el propietario, mes y año de facturación. El período de liquidación se calculará automáticamente con base en el día de corte del arrendador."
        headerAction={
          <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/30 rounded-full text-xs font-bold text-accent-primary">
            <ShieldCheck className="w-4 h-4" />
            Cálculo 100% Neto Enforcado
          </div>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">
              Propietario / Arrendador
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted">
                <User className="w-4 h-4" />
              </div>
              <select
                value={selectedOwnerId}
                onChange={(e) => setSelectedOwnerId(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-border-subtle rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent-primary transition-colors"
              >
                {db.owners.map((owner) => (
                  <option key={owner.id} value={owner.id}>
                    {owner.nombre} ({owner.cedula_nit}) - Corte Día {owner.dia_corte_liquidacion ?? 10}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">
              Mes de Liquidación
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted">
                <Calendar className="w-4 h-4" />
              </div>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-border-subtle rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent-primary transition-colors"
              >
                {MONTH_NAMES.map((name, idx) => (
                  <option key={idx + 1} value={idx + 1}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">
              Año
            </label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="w-full px-3 py-2 bg-slate-900 border border-border-subtle rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent-primary transition-colors"
            >
              {[2024, 2025, 2026, 2027, 2028, 2029, 2030].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Calculated Cutoff Period Info Banner */}
        <div className="mb-4 p-3 bg-slate-900/80 rounded-lg border border-border-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-text-primary">
            <span className="text-text-muted">Período calculado por corte:</span>
            <span className="font-bold text-accent-primary font-mono">{dateFrom}</span>
            <span className="text-text-muted">hasta</span>
            <span className="font-bold text-accent-primary font-mono">{dateTo}</span>
          </div>
          <div className="text-text-muted text-[11px]">
            Día de corte: <b>{selectedOwner?.dia_corte_liquidacion ?? 10}</b> • Mes: <b>{MONTH_NAMES[selectedMonth - 1]} {selectedYear}</b>
          </div>
        </div>

        {/* Settlement Preview Summary Panel */}
        {currentSettlement ? (
          <div className="p-4 bg-slate-950/80 rounded-xl border border-border-subtle space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border-subtle pb-4">
              <div>
                <span className="text-xs text-text-muted uppercase tracking-wider font-semibold">Resumen de Liquidación</span>
                <h3 className="text-lg font-bold text-text-primary mt-0.5">{currentSettlement.owner.nombre}</h3>
                <p className="text-xs text-amber-400 font-medium">
                  Cuenta: {currentSettlement.owner.cuenta_bancaria || 'No especificada'} | Período: {dateFrom} al {dateTo}
                </p>
              </div>
              <SettlementPdfButton
                ownerId={selectedOwner?.id || selectedOwnerId}
                dateFrom={dateFrom}
                dateTo={dateTo}
                db={db}
                variant="primary"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-center">
              <div className="p-3 bg-status-success/10 rounded-lg border border-status-success/30">
                <span className="text-xs font-semibold text-status-success uppercase">Total Ingresos</span>
                <p className="text-lg font-extrabold text-status-success mt-1">
                  +{formatCOP(currentSettlement.totalIncome)}
                </p>
              </div>

              <div className="p-3 bg-status-danger/10 rounded-lg border border-status-danger/30">
                <span className="text-xs font-semibold text-status-danger uppercase">Reparaciones / Gastos</span>
                <p className="text-lg font-extrabold text-status-danger mt-1">
                  -{formatCOP(currentSettlement.totalExpenses)}
                </p>
              </div>

              <div className="p-3 bg-indigo-500/10 rounded-lg border border-indigo-500/30">
                <span className="text-xs font-semibold text-indigo-400 uppercase">Cuotas Administración</span>
                <p className="text-lg font-extrabold text-indigo-400 mt-1">
                  -{formatCOP(currentSettlement.totalAdminFees)}
                </p>
              </div>

              <div className="p-3 bg-accent-primary/10 rounded-lg border border-accent-primary/40">
                <span className="text-xs font-semibold text-accent-primary uppercase">Saldo Neto (100%)</span>
                <p className="text-lg font-black text-amber-400 mt-1">
                  {formatCOP(currentSettlement.netPayable)}
                </p>
              </div>
            </div>

            <p className="text-[11px] text-text-muted italic">
              * Incluye {currentSettlement.transactions.length} transacciones registradas entre {dateFrom} y {dateTo}.
            </p>
          </div>
        ) : (
          <div className="p-6 text-center text-text-muted bg-slate-950/40 rounded-xl border border-border-subtle">
            Seleccione un propietario para previsualizar los cálculos netos.
          </div>
        )}
      </Card>

      {/* Main Transactions Log & Registration Section */}
      <Card
        title="Registro Histórico de Transacciones"
        subtitle="Bitácora de pagos de cánones de arriendo y gastos de reparaciones o servicios."
        headerAction={
          <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setIsTxModalOpen(true)}>
            Nueva Transacción
          </Button>
        }
      >
        {/* Filters */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-4 pb-4 border-b border-border-subtle">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-text-muted" />
            <span className="text-xs font-semibold text-text-muted uppercase">Filtrar:</span>
            <div className="flex bg-slate-900 rounded-lg p-1 border border-border-subtle">
              {(['Todos', 'Ingreso', 'Gasto'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setFilterTipo(t)}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${
                    filterTipo === t
                      ? t === 'Ingreso'
                        ? 'bg-status-success text-white'
                        : t === 'Gasto'
                        ? 'bg-status-danger text-white'
                        : 'bg-accent-primary text-white'
                      : 'text-text-muted hover:text-text-primary'
                  }`}
                >
                  {t}s
                </button>
              ))}
            </div>
          </div>

          <div>
            <select
              value={filterPropId}
              onChange={(e) => setFilterPropId(e.target.value)}
              className="px-3 py-1.5 bg-slate-900 border border-border-subtle rounded-lg text-text-primary text-xs focus:outline-none focus:border-accent-primary"
            >
              <option value="">-- Todas las Propiedades --</option>
              {db.properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.direccion}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Transactions Table */}
        <Table
          data={filteredTransactions}
          keyExtractor={(tx) => tx.id}
          emptyMessage="No hay transacciones registradas con los filtros seleccionados."
          columns={[
            { header: 'ID', accessorKey: 'id', className: 'font-mono text-xs w-24' },
            { header: 'Fecha', accessorKey: 'fecha', className: 'w-28' },
            { header: 'Propiedad / Dirección', accessorKey: 'propiedad_direccion', className: 'font-semibold' },
            { header: 'Propietario', accessorKey: 'arrendador_nombre' },
            {
              header: 'Tipo',
              cell: (tx) => (
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    tx.tipo === 'Ingreso'
                      ? 'bg-status-success/20 text-status-success'
                      : 'bg-status-danger/20 text-status-danger'
                  }`}
                >
                  {tx.tipo === 'Ingreso' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  {tx.tipo}
                </span>
              ),
            },
            { header: 'Categoría', accessorKey: 'categoria', className: 'text-xs text-text-muted' },
            { header: 'Concepto / Detalle', accessorKey: 'concepto' },
            {
              header: 'Monto COP',
              cell: (tx) => (
                <span className={`font-extrabold text-sm ${tx.tipo === 'Ingreso' ? 'text-status-success' : 'text-status-danger'}`}>
                  {tx.tipo === 'Ingreso' ? '+' : '-'}{formatCOP(tx.monto)}
                </span>
              ),
            },
            {
              header: 'Acciones',
              className: 'text-right w-16',
              cell: (tx) => (
                <button
                  onClick={() => handleDeleteTransaction(tx.id, tx.concepto)}
                  className="p-1.5 text-text-muted hover:text-status-danger hover:bg-slate-800 rounded-lg transition-colors"
                  title="Eliminar transacción"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              ),
            },
          ]}
        />
      </Card>

      {/* Transaction Modal */}
      <TransactionForm
        isOpen={isTxModalOpen}
        onClose={() => setIsTxModalOpen(false)}
        properties={db.propertiesWithOwners}
        onSave={handleSaveTransaction}
      />
    </div>
  );
};
