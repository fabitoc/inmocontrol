import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

// Plugin para persistir la base de datos directamente en un archivo físico en el disco local: data/database.json
function localDatabasePlugin() {
  const dataDir = path.resolve(__dirname, './data');
  const dbFile = path.resolve(dataDir, 'database.json');

  const ensureDbFile = () => {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    if (!fs.existsSync(dbFile)) {
      const initialData = {
        arrendadores: [],
        propiedades: [],
        arrendatarios: [],
        transacciones: [],
        mantenimientos: [],
        recibos_pago: [],
      };
      fs.writeFileSync(dbFile, JSON.stringify(initialData, null, 2), 'utf-8');
    }
  };

  const handler = (req: any, res: any, next: any) => {
    if (req.url === '/api/db') {
      ensureDbFile();
      if (req.method === 'GET') {
        try {
          const content = fs.readFileSync(dbFile, 'utf-8');
          res.setHeader('Content-Type', 'application/json');
          res.end(content);
        } catch (err: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err.message }));
        }
        return;
      }
      if (req.method === 'POST') {
        let body = '';
        req.on('data', (chunk: any) => {
          body += chunk;
        });
        req.on('end', () => {
          try {
            JSON.parse(body); // Validar estructura JSON
            fs.writeFileSync(dbFile, body, 'utf-8');
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true }));
          } catch (err: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
          }
        });
        return;
      }
    }
    next();
  };

  return {
    name: 'local-disk-database-plugin',
    configureServer(server: any) {
      server.middlewares.use(handler);
    },
    configurePreviewServer(server: any) {
      server.middlewares.use(handler);
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), localDatabasePlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
  },
  envPrefix: ['VITE_'],
});
