import db from './database';

export interface PrecioVuelo {
  id?: number;
  fecha_consulta: string; // ISO string
  fecha_vuelo: string;    // ISO string (solo fecha)
  precio: number;
  origen?: string;
}

/**
 * Inserta un nuevo precio de vuelo.
 */
export function insertarPrecio(data: Omit<PrecioVuelo, 'id'>): number {
  const stmt = db.prepare(
    `INSERT INTO flight_prices (fecha_consulta, fecha_vuelo, precio, origen)
     VALUES (?, ?, ?, ?)`
  );
  const result = stmt.run(
    data.fecha_consulta,
    data.fecha_vuelo,
    data.precio,
    data.origen ?? null
  );
  return result.lastInsertRowid as number;
}

/**
 * Consulta el precio de un vuelo por fecha exacta de vuelo.
 * Devuelve todos los registros encontrados.
 */
export function consultarPrecioPorFecha(fecha_vuelo: string): PrecioVuelo[] {
  const stmt = db.prepare(
    `SELECT * FROM flight_prices WHERE fecha_vuelo = ? ORDER BY fecha_consulta DESC`
  );
  return stmt.all(fecha_vuelo) as PrecioVuelo[];
}

/**
 * Consulta el precio más bajo en un rango de fechas de vuelo (inclusive).
 * Devuelve el registro completo con el precio mínimo.
 */
export function consultarPrecioMinimoEnRango(
  fecha_inicio: string,
  fecha_fin: string
): PrecioVuelo | undefined {
  const stmt = db.prepare(
    `SELECT * FROM flight_prices
     WHERE fecha_vuelo BETWEEN ? AND ?
     ORDER BY precio ASC, fecha_consulta DESC
     LIMIT 1`
  );
  return stmt.get(fecha_inicio, fecha_fin) as PrecioVuelo | undefined;
}
export interface Usuario {
  id?: number;
  chat_id: number;
  chat_title?: string | null;
}

/**
 * Inserta o actualiza un usuario por chat_id.
 */
export function insertarUsuario(data: Omit<Usuario, 'id'>): number {
  const stmt = db.prepare(
    `INSERT INTO users (chat_id, chat_title)
     VALUES (?, ?)
     ON CONFLICT(chat_id) DO UPDATE SET chat_title=excluded.chat_title`
  );
  const result = stmt.run(
    data.chat_id,
    data.chat_title ?? null
  );
  return result.lastInsertRowid as number;
}

/**
 * Obtiene todos los usuarios registrados.
 */
export function obtenerTodosLosUsuarios(): Usuario[] {
  const stmt = db.prepare(
    `SELECT * FROM users`
  );
  return stmt.all() as Usuario[];
}