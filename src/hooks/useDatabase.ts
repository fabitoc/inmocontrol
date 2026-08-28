import { useState, useEffect, useCallback } from 'react';
import {
  Arrendador,
  Propiedad,
  Arrendatario,
  Transaccion,
  Mantenimiento,
  ReciboPago,
  PropiedadConArrendador,
  ArrendatarioConPropiedad,
  TransaccionConPropiedad,
  MantenimientoConPropiedad,
  ReciboPagoConDetalles,
  FinancialSummary,
  OverdueAlert,
  NegativeBalanceOwner,
  OwnerSettlement
} from '../types';
import { DatabaseService } from '../services/db';

export function useDatabase() {
  const [owners, setOwners] = useState<Arrendador[]>([]);
  const [properties, setProperties] = useState<Propiedad[]>([]);
  const [tenants, setTenants] = useState<Arrendatario[]>([]);
  const [transactions, setTransactions] = useState<Transaccion[]>([]);
  const [maintenances, setMaintenances] = useState<Mantenimiento[]>([]);
  const [paymentReceipts, setPaymentReceipts] = useState<ReciboPago[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Load all reactive collections from database
  const refreshData = useCallback(async () => {
    try {
      setLoading(true);
      await DatabaseService.initDatabase();
      setOwners(DatabaseService.getArrendadores());
      setProperties(DatabaseService.getPropiedades());
      setTenants(DatabaseService.getArrendatarios());
      setTransactions(DatabaseService.getTransacciones());
      setMaintenances(DatabaseService.getMaintenances());
      setPaymentReceipts(DatabaseService.getPaymentReceipts());
      setError(null);
    } catch (err: any) {
      console.error('Error fetching database tables:', err);
      setError(err?.message || 'Error al conectar con la base de datos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Joined collections for rich UI data display
  const propertiesWithOwners: PropiedadConArrendador[] = properties.map(p => {
    const owner = owners.find(o => o.id === p.arrendador_id);
    return {
      ...p,
      arrendador_nombre: owner ? owner.nombre : 'Sin propietario'
    };
  });

  const tenantsWithProperties: ArrendatarioConPropiedad[] = tenants.map(t => {
    const prop = properties.find(p => p.id === t.propiedad_id);
    return {
      ...t,
      propiedad_direccion: prop ? prop.direccion : 'Sin propiedad asignada',
      canon_arriendo: prop ? prop.canon_arriendo : 0
    };
  });

  const transactionsWithDetails: TransaccionConPropiedad[] = transactions.map(tx => {
    const prop = properties.find(p => p.id === tx.propiedad_id);
    const owner = prop ? owners.find(o => o.id === prop.arrendador_id) : undefined;
    return {
      ...tx,
      propiedad_direccion: prop ? prop.direccion : 'Propiedad no encontrada',
      arrendador_nombre: owner ? owner.nombre : 'Desconocido'
    };
  });

  const maintenancesWithDetails: MantenimientoConPropiedad[] = maintenances.map(m => {
    const prop = properties.find(p => p.id === m.propiedad_id);
    const owner = prop ? owners.find(o => o.id === prop.arrendador_id) : undefined;
    return {
      ...m,
      propiedad_direccion: prop ? prop.direccion : 'Propiedad no encontrada',
      arrendador_nombre: owner ? owner.nombre : 'Desconocido'
    };
  });

  const receiptsWithDetails: ReciboPagoConDetalles[] = paymentReceipts.map(r => {
    const prop = properties.find(p => p.id === r.propiedad_id);
    return {
      ...r,
      propiedad_direccion: prop ? prop.direccion : 'Propiedad no encontrada'
    };
  });

  // --- CRUD ACTIONS ---
  const addOwner = async (data: Omit<Arrendador, 'id' | 'created_at'>) => {
    const res = DatabaseService.addArrendador(data);
    await refreshData();
    return res;
  };

  const updateOwner = async (id: string, updates: Partial<Arrendador>) => {
    const res = DatabaseService.updateArrendador(id, updates);
    await refreshData();
    return res;
  };

  const deleteOwner = async (id: string) => {
    const ok = DatabaseService.deleteArrendador(id);
    await refreshData();
    return ok;
  };

  const addProperty = async (data: Omit<Propiedad, 'id' | 'created_at'>) => {
    const res = DatabaseService.addPropiedad(data);
    await refreshData();
    return res;
  };

  const updateProperty = async (id: string, updates: Partial<Propiedad>) => {
    const res = DatabaseService.updatePropiedad(id, updates);
    await refreshData();
    return res;
  };

  const deleteProperty = async (id: string) => {
    const ok = DatabaseService.deletePropiedad(id);
    await refreshData();
    return ok;
  };

  const addTenant = async (data: Omit<Arrendatario, 'id' | 'created_at'>) => {
    const res = DatabaseService.addArrendatario(data);
    await refreshData();
    return res;
  };

  const updateTenant = async (id: string, updates: Partial<Arrendatario>) => {
    const res = DatabaseService.updateArrendatario(id, updates);
    await refreshData();
    return res;
  };

  const deleteTenant = async (id: string) => {
    const ok = DatabaseService.deleteArrendatario(id);
    await refreshData();
    return ok;
  };

  const addTransaction = async (data: Omit<Transaccion, 'id' | 'created_at'>) => {
    const res = DatabaseService.addTransaccion(data);
    await refreshData();
    return res;
  };

  const deleteTransaction = async (id: string) => {
    const ok = DatabaseService.deleteTransaccion(id);
    await refreshData();
    return ok;
  };

  const addMaintenance = async (data: Omit<Mantenimiento, 'id' | 'created_at'>) => {
    const res = DatabaseService.addMaintenance(data);
    await refreshData();
    return res;
  };

  const updateMaintenance = async (id: string, updates: Partial<Mantenimiento>) => {
    const res = DatabaseService.updateMaintenance(id, updates);
    await refreshData();
    return res;
  };

  const deleteMaintenance = async (id: string) => {
    const ok = DatabaseService.deleteMaintenance(id);
    await refreshData();
    return ok;
  };

  const addPaymentReceipt = async (data: Omit<ReciboPago, 'id' | 'created_at'>) => {
    const res = DatabaseService.addPaymentReceipt(data);
    await refreshData();
    return res;
  };

  // --- FINANCIAL & ALERT QUERIES ---
  const getFinancialSummary = (): FinancialSummary => {
    const now = new Date();
    const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const totalIncomeMonth = transactions
      .filter(tx => tx.tipo === 'Ingreso' && tx.estado === 'Pagado' && tx.fecha.startsWith(currentYearMonth))
      .reduce((sum, tx) => sum + tx.monto, 0);

    const totalExpensesMonth = transactions
      .filter(tx => tx.tipo === 'Gasto' && tx.estado === 'Pagado' && tx.fecha.startsWith(currentYearMonth))
      .reduce((sum, tx) => sum + tx.monto, 0);

    const activeProperties = properties.filter(p => p.estado === 'Alquilada');
    const activePropertiesCount = activeProperties.length;

    let totalPendingRent = 0;
    activeProperties.forEach(p => {
      const paidInCurrentMonth = transactions.some(
        tx => tx.propiedad_id === p.id && tx.tipo === 'Ingreso' && tx.fecha.startsWith(currentYearMonth)
      );
      if (!paidInCurrentMonth) {
        totalPendingRent += p.canon_arriendo;
      }
    });

    const netPortfolioYield = totalIncomeMonth - totalExpensesMonth;

    return {
      totalIncomeMonth,
      totalPendingRent,
      activePropertiesCount,
      netPortfolioYield
    };
  };

  const getOverdueTenants = (): OverdueAlert[] => {
    const now = new Date();
    const currentDay = now.getDate();
    const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const alerts: OverdueAlert[] = [];

    tenants.forEach(tenant => {
      if (!tenant.propiedad_id) return;

      const prop = properties.find(p => p.id === tenant.propiedad_id);
      if (!prop || prop.estado !== 'Alquilada') return;

      const dueDay = prop.dia_vencimiento_pago ?? prop.dia_corte ?? 5;

      if (currentDay > dueDay) {
        const paymentLogged = transactions.some(
          tx => tx.propiedad_id === prop.id && tx.tipo === 'Ingreso' && tx.fecha.startsWith(currentYearMonth)
        );

        if (!paymentLogged) {
          alerts.push({
            tenantId: tenant.id,
            tenantName: tenant.nombre,
            propertyId: prop.id,
            propertyAddress: prop.direccion,
            dueDay,
            canonArriendo: prop.canon_arriendo,
            daysOverdue: currentDay - dueDay
          });
        }
      }
    });

    return alerts;
  };

  const getNegativeBalanceOwners = (): NegativeBalanceOwner[] => {
    const result: NegativeBalanceOwner[] = [];

    owners.forEach(owner => {
      const ownerProperties = properties.filter(p => p.arrendador_id === owner.id);
      const ownerPropIds = ownerProperties.map(p => p.id);

      const ownerTransactions = transactions.filter(
        tx => ownerPropIds.includes(tx.propiedad_id) && tx.estado === 'Pagado'
      );

      const totalIncome = ownerTransactions
        .filter(tx => tx.tipo === 'Ingreso')
        .reduce((sum, tx) => sum + tx.monto, 0);

      const totalExpenses = ownerTransactions
        .filter(tx => tx.tipo === 'Gasto')
        .reduce((sum, tx) => sum + tx.monto, 0);

      const totalAdminFees = ownerProperties.reduce((sum, p) => sum + (p.cuota_administracion || 0), 0);

      const netBalance = totalIncome - (totalExpenses + totalAdminFees);

      if (netBalance < 0) {
        result.push({
          ownerId: owner.id,
          ownerName: owner.nombre,
          totalIncome,
          totalExpenses: totalExpenses + totalAdminFees,
          netBalance
        });
      }
    });

    return result;
  };

  const getNetSettlementForOwner = (
    ownerId: string,
    dateFrom: string,
    dateTo: string
  ): OwnerSettlement | null => {
    const owner = owners.find(o => o.id === ownerId);
    if (!owner) return null;

    const ownerProps = properties.filter(p => p.arrendador_id === ownerId);
    const ownerPropIds = ownerProps.map(p => p.id);

    const periodTransactions = transactionsWithDetails.filter(tx => {
      if (!ownerPropIds.includes(tx.propiedad_id)) return false;
      if (tx.estado !== 'Pagado') return false;
      return tx.fecha >= dateFrom && tx.fecha <= dateTo;
    });

    const periodMaintenances = maintenances.filter(m => {
      if (!ownerPropIds.includes(m.propiedad_id)) return false;
      return m.fecha >= dateFrom && m.fecha <= dateTo;
    });

    const totalIncome = periodTransactions
      .filter(tx => tx.tipo === 'Ingreso')
      .reduce((sum, tx) => sum + tx.monto, 0);

    const txExpenses = periodTransactions
      .filter(tx => tx.tipo === 'Gasto')
      .reduce((sum, tx) => sum + tx.monto, 0);

    // Dedup / aggregate maintenance expenses not recorded directly in tx
    const unrecordedMaintenanceCost = periodMaintenances
      .filter(m => !periodTransactions.some(tx => tx.tipo === 'Gasto' && tx.monto === m.costo && tx.fecha === m.fecha))
      .reduce((sum, m) => sum + m.costo, 0);

    const totalExpenses = txExpenses + unrecordedMaintenanceCost;

    // Calculate total Administration Fees for owner's properties
    const totalAdminFees = ownerProps.reduce((sum, p) => sum + (p.cuota_administracion || 0), 0);

    const netPayable = totalIncome - (totalExpenses + totalAdminFees);

    return {
      owner,
      properties: ownerProps,
      transactions: periodTransactions,
      maintenances: periodMaintenances,
      totalIncome,
      totalExpenses,
      totalAdminFees,
      netPayable,
      dateFrom,
      dateTo
    };
  };

  const getSettlementCutoffRange = (
    cutoffDay: number,
    year: number,
    month: number // 1 to 12
  ): { dateFrom: string; dateTo: string } => {
    const safeCutoff = Math.min(Math.max(1, cutoffDay || 10), 31);
    
    // Current month clamp
    const daysInCurrMonth = new Date(year, month, 0).getDate();
    const clampedEndDay = Math.min(safeCutoff, daysInCurrMonth);
    const dateTo = `${year}-${String(month).padStart(2, '0')}-${String(clampedEndDay).padStart(2, '0')}`;

    // Previous month clamp
    const prevYear = month === 1 ? year - 1 : year;
    const prevMonth = month === 1 ? 12 : month - 1;
    const daysInPrevMonth = new Date(prevYear, prevMonth, 0).getDate();
    const clampedPrevCutoff = Math.min(safeCutoff, daysInPrevMonth);

    const prevCutoffDate = new Date(prevYear, prevMonth - 1, clampedPrevCutoff);
    const startDate = new Date(prevCutoffDate);
    startDate.setDate(startDate.getDate() + 1);

    const startY = startDate.getFullYear();
    const startM = String(startDate.getMonth() + 1).padStart(2, '0');
    const startD = String(startDate.getDate()).padStart(2, '0');
    const dateFrom = `${startY}-${startM}-${startD}`;

    return { dateFrom, dateTo };
  };

  return {
    owners,
    properties,
    propertiesWithOwners,
    tenants,
    tenantsWithProperties,
    transactions,
    transactionsWithDetails,
    maintenances,
    maintenancesWithDetails,
    paymentReceipts,
    receiptsWithDetails,
    loading,
    error,
    refreshData,

    // CRUD Methods
    addOwner,
    updateOwner,
    deleteOwner,
    addProperty,
    updateProperty,
    deleteProperty,
    addTenant,
    updateTenant,
    deleteTenant,
    addTransaction,
    deleteTransaction,
    addMaintenance,
    updateMaintenance,
    deleteMaintenance,
    addPaymentReceipt,

    // Financial & Alert Queries
    getFinancialSummary,
    getOverdueTenants,
    getNegativeBalanceOwners,
    getNetSettlementForOwner,
    getSettlementCutoffRange,

    // Backup & Restore & Production Reset
    clearDatabase: async () => {
      DatabaseService.clearDatabase();
      await refreshData();
    },
    exportBackupJSON: DatabaseService.exportBackupJSON,
    importBackupJSON: (jsonStr: string) => {
      const ok = DatabaseService.importBackupJSON(jsonStr);
      if (ok) refreshData();
      return ok;
    }
  };
}
