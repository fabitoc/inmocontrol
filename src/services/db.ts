import {
  Arrendador,
  Propiedad,
  Arrendatario,
  Transaccion,
  Mantenimiento,
  ReciboPago
} from '../types';

const STORAGE_KEY = 'inmocontrol_db_prod';
const API_DB_URL = '/api/db';

interface DbStore {
  arrendadores: Arrendador[];
  propiedades: Propiedad[];
  arrendatarios: Arrendatario[];
  transacciones: Transaccion[];
  mantenimientos: Mantenimiento[];
  recibos_pago: ReciboPago[];
}

const DEFAULT_STORE: DbStore = {
  arrendadores: [],
  propiedades: [],
  arrendatarios: [],
  transacciones: [],
  mantenimientos: [],
  recibos_pago: []
};

export const SQLITE_SCHEMA_DDL = `
CREATE TABLE IF NOT EXISTS Arrendadores (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    cedula_nit TEXT UNIQUE NOT NULL,
    telefono TEXT,
    email TEXT,
    cuenta_bancaria TEXT,
    dia_corte_liquidacion INTEGER NOT NULL DEFAULT 10 CHECK (dia_corte_liquidacion BETWEEN 1 AND 31),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS Propiedades (
    id TEXT PRIMARY KEY,
    arrendador_id TEXT NOT NULL,
    direccion TEXT NOT NULL,
    canon_arriendo REAL NOT NULL CHECK (canon_arriendo >= 0),
    dia_vencimiento_pago INTEGER NOT NULL CHECK (dia_vencimiento_pago BETWEEN 1 AND 31),
    tipo_administracion TEXT DEFAULT 'Ninguna',
    valor_administracion REAL DEFAULT 0,
    cuota_administracion REAL DEFAULT 0,
    estado TEXT CHECK (estado IN ('Alquilada', 'Vacante', 'Mantenimiento')) DEFAULT 'Vacante',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (arrendador_id) REFERENCES Arrendadores(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS Arrendatarios (
    id TEXT PRIMARY KEY,
    propiedad_id TEXT UNIQUE,
    nombre TEXT NOT NULL,
    cedula_nit TEXT UNIQUE NOT NULL,
    telefono TEXT,
    email TEXT,
    fecha_inicio TEXT NOT NULL,
    fecha_fin TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (propiedad_id) REFERENCES Propiedades(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS Transacciones (
    id TEXT PRIMARY KEY,
    propiedad_id TEXT NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('Ingreso', 'Gasto')),
    categoria TEXT NOT NULL,
    concepto TEXT NOT NULL,
    monto REAL NOT NULL CHECK (monto >= 0),
    fecha TEXT NOT NULL,
    estado TEXT CHECK (estado IN ('Pagado', 'Pendiente')) DEFAULT 'Pagado',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (propiedad_id) REFERENCES Propiedades(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS Mantenimientos (
    id TEXT PRIMARY KEY,
    propiedad_id TEXT NOT NULL,
    categoria TEXT NOT NULL,
    costo REAL NOT NULL CHECK (costo >= 0),
    fecha TEXT NOT NULL,
    tecnico_nombre TEXT,
    tecnico_contacto TEXT,
    descripcion TEXT NOT NULL,
    evidencias_fotos TEXT DEFAULT '[]',
    evidencia_factura TEXT,
    estado TEXT CHECK (estado IN ('Completado', 'Pendiente')) DEFAULT 'Completado',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (propiedad_id) REFERENCES Propiedades(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS RecibosPago (
    id TEXT PRIMARY KEY,
    transaccion_id TEXT,
    propiedad_id TEXT NOT NULL,
    tipo_recibo TEXT NOT NULL CHECK (tipo_recibo IN ('Arriendo', 'Mantenimiento')),
    monto REAL NOT NULL CHECK (monto >= 0),
    metodo_pago TEXT NOT NULL CHECK (metodo_pago IN ('Transferencia', 'Efectivo', 'Consignacion', 'Otro')),
    notas TEXT,
    fecha_pago TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (propiedad_id) REFERENCES Propiedades(id) ON DELETE CASCADE
);
`;

export class DatabaseService {
  private static store: DbStore | null = null;

  public static async initDatabase(): Promise<DbStore> {
    if (!this.store) {
      let loadedFromDisk = false;

      // 1. Intentar cargar desde el archivo físico en disco (data/database.json)
      try {
        const response = await fetch(API_DB_URL);
        if (response.ok) {
          const data = await response.json();
          if (data && typeof data === 'object' && Array.isArray(data.arrendadores)) {
            this.store = data;
            loadedFromDisk = true;
            this.persistLocalOnly();
          }
        }
      } catch (err) {
        console.warn('Servidor local de base de datos en disco no disponible, usando caché local:', err);
      }

      // 2. Si no cargó desde disco, cargar desde localStorage
      if (!loadedFromDisk) {
        try {
          localStorage.removeItem('inmoadmin_db_store');
          const raw = localStorage.getItem(STORAGE_KEY);
          if (raw) {
            this.store = JSON.parse(raw);
          } else {
            this.store = { ...DEFAULT_STORE };
            this.persist();
          }
        } catch (err) {
          console.error('Error al inicializar store local:', err);
          this.store = { ...DEFAULT_STORE };
          this.persist();
        }
      }

      // Asegurar que todos los arreglos existan
      if (this.store) {
        if (!this.store.arrendadores) this.store.arrendadores = [];
        if (!this.store.propiedades) this.store.propiedades = [];
        if (!this.store.arrendatarios) this.store.arrendatarios = [];
        if (!this.store.transacciones) this.store.transacciones = [];
        if (!this.store.mantenimientos) this.store.mantenimientos = [];
        if (!this.store.recibos_pago) this.store.recibos_pago = [];
      }
    }
    return this.store!;
  }

  // Guarda en localStorage y sincroniza en el archivo físico data/database.json en el disco local
  private static persist() {
    if (this.store) {
      const jsonStr = JSON.stringify(this.store, null, 2);
      try {
        localStorage.setItem(STORAGE_KEY, jsonStr);
      } catch (e) {
        console.error('Error guardando en localStorage:', e);
      }

      // Sincronizar archivo en disco
      fetch(API_DB_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: jsonStr,
      }).catch((err) => {
        console.warn('Aviso: No se pudo escribir en data/database.json en disco:', err);
      });
    }
  }

  private static persistLocalOnly() {
    if (this.store) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.store));
      } catch (e) {
        console.error('Error guardando caché local:', e);
      }
    }
  }

  // --- RESET TO CLEAN PRODUCTION MODE ---
  public static clearDatabase(): void {
    localStorage.removeItem('inmoadmin_db_store');
    this.store = {
      arrendadores: [],
      propiedades: [],
      arrendatarios: [],
      transacciones: [],
      mantenimientos: [],
      recibos_pago: [],
    };
    this.persist();
  }

  // --- ARRENDADORES CRUD ---
  public static getArrendadores(): Arrendador[] {
    return this.store?.arrendadores || [];
  }

  public static addArrendador(arrendador: Omit<Arrendador, 'id' | 'created_at'>): Arrendador {
    const newRecord: Arrendador = {
      ...arrendador,
      id: `ARR-${Date.now().toString().slice(-4)}`,
      created_at: new Date().toISOString()
    };
    this.store?.arrendadores.push(newRecord);
    this.persist();
    return newRecord;
  }

  public static updateArrendador(id: string, updates: Partial<Arrendador>): Arrendador | null {
    if (!this.store) return null;
    const index = this.store.arrendadores.findIndex(a => a.id === id);
    if (index === -1) return null;
    this.store.arrendadores[index] = { ...this.store.arrendadores[index], ...updates };
    this.persist();
    return this.store.arrendadores[index];
  }

  public static deleteArrendador(id: string): boolean {
    if (!this.store) return false;
    const initialLen = this.store.arrendadores.length;
    this.store.arrendadores = this.store.arrendadores.filter(a => a.id !== id);
    const propertyIdsToDelete = this.store.propiedades.filter(p => p.arrendador_id === id).map(p => p.id);
    this.store.propiedades = this.store.propiedades.filter(p => p.arrendador_id !== id);
    this.store.arrendatarios = this.store.arrendatarios.map(t => 
      t.propiedad_id && propertyIdsToDelete.includes(t.propiedad_id) ? { ...t, propiedad_id: null } : t
    );
    this.store.transacciones = this.store.transacciones.filter(tx => !propertyIdsToDelete.includes(tx.propiedad_id));
    this.store.mantenimientos = this.store.mantenimientos.filter(m => !propertyIdsToDelete.includes(m.propiedad_id));
    this.store.recibos_pago = this.store.recibos_pago.filter(r => !propertyIdsToDelete.includes(r.propiedad_id));

    this.persist();
    return this.store.arrendadores.length < initialLen;
  }

  // --- PROPIEDADES CRUD ---
  public static getPropiedades(): Propiedad[] {
    return this.store?.propiedades || [];
  }

  public static addPropiedad(propiedad: Omit<Propiedad, 'id' | 'created_at'>): Propiedad {
    const newRecord: Propiedad = {
      ...propiedad,
      id: `PROP-${Date.now().toString().slice(-3)}`,
      created_at: new Date().toISOString()
    };
    this.store?.propiedades.push(newRecord);
    this.persist();
    return newRecord;
  }

  public static updatePropiedad(id: string, updates: Partial<Propiedad>): Propiedad | null {
    if (!this.store) return null;
    const index = this.store.propiedades.findIndex(p => p.id === id);
    if (index === -1) return null;
    this.store.propiedades[index] = { ...this.store.propiedades[index], ...updates };
    this.persist();
    return this.store.propiedades[index];
  }

  public static deletePropiedad(id: string): boolean {
    if (!this.store) return false;
    const initialLen = this.store.propiedades.length;
    this.store.propiedades = this.store.propiedades.filter(p => p.id !== id);
    this.store.arrendatarios = this.store.arrendatarios.map(t => t.propiedad_id === id ? { ...t, propiedad_id: null } : t);
    this.store.transacciones = this.store.transacciones.filter(tx => tx.propiedad_id !== id);
    this.store.mantenimientos = this.store.mantenimientos.filter(m => m.propiedad_id !== id);
    this.store.recibos_pago = this.store.recibos_pago.filter(r => r.propiedad_id !== id);

    this.persist();
    return this.store.propiedades.length < initialLen;
  }

  // --- ARRENDATARIOS CRUD ---
  public static getArrendatarios(): Arrendatario[] {
    return this.store?.arrendatarios || [];
  }

  public static addArrendatario(arrendatario: Omit<Arrendatario, 'id' | 'created_at'>): Arrendatario {
    const newRecord: Arrendatario = {
      ...arrendatario,
      id: `TEN-${Date.now().toString().slice(-3)}`,
      created_at: new Date().toISOString()
    };
    this.store?.arrendatarios.push(newRecord);
    this.persist();
    return newRecord;
  }

  public static updateArrendatario(id: string, updates: Partial<Arrendatario>): Arrendatario | null {
    if (!this.store) return null;
    const index = this.store.arrendatarios.findIndex(t => t.id === id);
    if (index === -1) return null;
    this.store.arrendatarios[index] = { ...this.store.arrendatarios[index], ...updates };
    this.persist();
    return this.store.arrendatarios[index];
  }

  public static deleteArrendatario(id: string): boolean {
    if (!this.store) return false;
    const initialLen = this.store.arrendatarios.length;
    this.store.arrendatarios = this.store.arrendatarios.filter(t => t.id !== id);
    this.persist();
    return this.store.arrendatarios.length < initialLen;
  }

  // --- TRANSACCIONES CRUD ---
  public static getTransacciones(): Transaccion[] {
    return this.store?.transacciones || [];
  }

  public static addTransaccion(transaccion: Omit<Transaccion, 'id' | 'created_at'>): Transaccion {
    const newRecord: Transaccion = {
      ...transaccion,
      id: `TXN-${Date.now().toString().slice(-3)}`,
      created_at: new Date().toISOString()
    };
    this.store?.transacciones.push(newRecord);
    this.persist();
    return newRecord;
  }

  public static deleteTransaccion(id: string): boolean {
    if (!this.store) return false;
    const initialLen = this.store.transacciones.length;
    this.store.transacciones = this.store.transacciones.filter(tx => tx.id !== id);
    this.persist();
    return this.store.transacciones.length < initialLen;
  }

  // --- MANTENIMIENTOS CRUD ---
  public static getMaintenances(): Mantenimiento[] {
    return this.store?.mantenimientos || [];
  }

  public static addMaintenance(maintenance: Omit<Mantenimiento, 'id' | 'created_at'>): Mantenimiento {
    const newRecord: Mantenimiento = {
      ...maintenance,
      id: `MNT-${Date.now().toString().slice(-4)}`,
      created_at: new Date().toISOString()
    };
    this.store?.mantenimientos.push(newRecord);
    this.persist();
    return newRecord;
  }

  public static updateMaintenance(id: string, updates: Partial<Mantenimiento>): Mantenimiento | null {
    if (!this.store) return null;
    const index = this.store.mantenimientos.findIndex(m => m.id === id);
    if (index === -1) return null;
    this.store.mantenimientos[index] = { ...this.store.mantenimientos[index], ...updates };
    this.persist();
    return this.store.mantenimientos[index];
  }

  public static deleteMaintenance(id: string): boolean {
    if (!this.store) return false;
    const initialLen = this.store.mantenimientos.length;
    this.store.mantenimientos = this.store.mantenimientos.filter(m => m.id !== id);
    this.persist();
    return this.store.mantenimientos.length < initialLen;
  }

  // --- RECIBOS DE PAGO CRUD ---
  public static getPaymentReceipts(): ReciboPago[] {
    return this.store?.recibos_pago || [];
  }

  public static addPaymentReceipt(receipt: Omit<ReciboPago, 'id' | 'created_at'>): ReciboPago {
    const newRecord: ReciboPago = {
      ...receipt,
      id: `REC-${Date.now().toString().slice(-4)}`,
      created_at: new Date().toISOString()
    };
    this.store?.recibos_pago.push(newRecord);
    this.persist();
    return newRecord;
  }

  // --- BACKUP & RESTORE ---
  public static exportBackupJSON(): string {
    return JSON.stringify(this.store || DEFAULT_STORE, null, 2);
  }

  public static importBackupJSON(jsonStr: string): boolean {
    try {
      const parsed = JSON.parse(jsonStr);
      if (
        parsed.arrendadores &&
        parsed.propiedades &&
        parsed.arrendatarios &&
        parsed.transacciones
      ) {
        this.store = {
          arrendadores: parsed.arrendadores,
          propiedades: parsed.propiedades,
          arrendatarios: parsed.arrendatarios,
          transacciones: parsed.transacciones,
          mantenimientos: parsed.mantenimientos || [],
          recibos_pago: parsed.recibos_pago || [],
        };
        this.persist();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }
}
