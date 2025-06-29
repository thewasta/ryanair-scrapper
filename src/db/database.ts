import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DB_PATH = path.resolve(__dirname, 'flights.db');
const MIGRATIONS_PATH = path.resolve(__dirname, 'migrations.sql');

const db = new Database(DB_PATH);

// DEBUG: Log para saber si este archivo se ejecuta
console.log("[database.ts] Inicializando base de datos en:", DB_PATH);

// DEBUG: Mostrar todas las tablas existentes antes de migrar
const tablas = db.prepare("SELECT name FROM sqlite_master WHERE type='table';").all() as { name: string }[];
console.log("[database.ts] Tablas existentes antes de migrar:", tablas.map((t: { name: string }) => t.name));

// Ejecutar migraciones si alguna de las tablas no existe
const flightPricesExists = tablas.some((t: { name: string }) => t.name === 'flight_prices');
const usersExists = tablas.some((t: { name: string }) => t.name === 'users');

if (!flightPricesExists || !usersExists) {
  console.log("[database.ts] Ejecutando migraciones desde:", MIGRATIONS_PATH);
  const migrations = fs.readFileSync(MIGRATIONS_PATH, 'utf-8');
  db.exec(migrations);
  // DEBUG: Mostrar tablas después de migrar
  const tablasDespues = db.prepare("SELECT name FROM sqlite_master WHERE type='table';").all() as { name: string }[];
  console.log("[database.ts] Tablas existentes después de migrar:", tablasDespues.map((t: { name: string }) => t.name));
} else {
  console.log("[database.ts] No es necesario ejecutar migraciones.");
}

export default db;