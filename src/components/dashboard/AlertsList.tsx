import React from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { OverdueAlert, NegativeBalanceOwner } from '../../types';
import { AlertTriangle, AlertCircle, Plus, FileText, ArrowRight } from 'lucide-react';

export interface AlertsListProps {
  overdueAlerts: OverdueAlert[];
  negativeOwners: NegativeBalanceOwner[];
  onRecordPayment?: (propertyId: string) => void;
  onViewOwnerSettlement?: (ownerId: string) => void;
}

export const AlertsList: React.FC<AlertsListProps> = ({
  overdueAlerts,
  negativeOwners,
  onRecordPayment,
  onViewOwnerSettlement,
}) => {
  const formatCOP = (val: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(val);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Overdue Rent Payments past Cutoff Day */}
      <Card
        title="Alertas de Mora (Corte Vencido)"
        subtitle="Inquilinos con fecha de pago cumplida sin registro de canon para el ciclo activo."
        headerAction={
          <span
            className={`px-2.5 py-1 rounded-full text-xs font-bold ${
              overdueAlerts.length > 0
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                : 'bg-slate-800 text-text-muted'
            }`}
          >
            {overdueAlerts.length} Alertas
          </span>
        }
      >
        {overdueAlerts.length === 0 ? (
          <div className="py-8 text-center text-text-muted text-sm space-y-1">
            <p className="font-semibold text-status-success">✓ Todos los cánones se encuentran al día.</p>
            <p className="text-xs text-text-muted">No hay contratos con fecha de corte vencida sin pago.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {overdueAlerts.map((alert) => (
              <div
                key={alert.tenantId}
                className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950/80 border border-amber-500/40 hover:border-amber-500 transition-all shadow-md shadow-amber-950/20"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-text-primary text-sm">{alert.tenantName}</span>
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-600 text-white rounded">
                      Vence día {alert.dueDay}
                    </span>
                  </div>
                  <p className="text-xs text-text-muted">{alert.propertyAddress}</p>
                  <p className="text-[11px] text-status-danger font-medium flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {alert.daysOverdue} {alert.daysOverdue === 1 ? 'día' : 'días'} en mora acumulada
                  </p>
                </div>
                <div className="text-right space-y-1.5">
                  <span className="font-extrabold text-amber-400 text-base block">
                    {formatCOP(alert.canonArriendo)}
                  </span>
                  {onRecordPayment && (
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => onRecordPayment(alert.propertyId)}
                      icon={<Plus className="w-3.5 h-3.5" />}
                    >
                      Registrar Pago
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Negative Owner Account Warnings */}
      <Card
        title="Alertas de Saldo En Rojo (#EF4444)"
        subtitle="Arrendadores con gastos de mantenimiento o servicios superiores al ingreso de arriendos."
        headerAction={
          <span
            className={`px-2.5 py-1 rounded-full text-xs font-bold ${
              negativeOwners.length > 0
                ? 'bg-status-danger/20 text-status-danger border border-status-danger/40'
                : 'bg-slate-800 text-text-muted'
            }`}
          >
            {negativeOwners.length} En Rojo
          </span>
        }
      >
        {negativeOwners.length === 0 ? (
          <div className="py-8 text-center text-text-muted text-sm space-y-1">
            <p className="font-semibold text-status-success">✓ Todos los propietarios cuentan con saldo positivo.</p>
            <p className="text-xs text-text-muted">No existen balances en rojo registrados.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {negativeOwners.map((owner) => (
              <div
                key={owner.ownerId}
                className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950/80 border border-status-danger/50 hover:border-status-danger transition-all shadow-md shadow-red-950/30"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-text-primary text-sm">{owner.ownerName}</span>
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-status-danger text-white rounded">
                      Saldo En Rojo
                    </span>
                  </div>
                  <p className="text-xs text-text-muted">
                    Recaudado: <span className="text-status-success font-medium">{formatCOP(owner.totalIncome)}</span> | Gastos: <span className="text-status-danger font-medium">{formatCOP(owner.totalExpenses)}</span>
                  </p>
                </div>
                <div className="text-right space-y-1.5">
                  <span className="font-black text-status-danger text-lg block">
                    {formatCOP(owner.netBalance)}
                  </span>
                  {onViewOwnerSettlement && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => onViewOwnerSettlement(owner.ownerId)}
                      icon={<ArrowRight className="w-3.5 h-3.5" />}
                    >
                      Ver Liquidación
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};
