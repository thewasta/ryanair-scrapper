import db from './database';

interface FlightPrice {
  id: number;
  fecha_consulta: string;
  fecha_vuelo: string;
  precio: number;
  origen: string;
  tipo_vuelo: 'ida' | 'vuelta';
  ruta: string;
}

interface InsertFlightPriceParams {
  fecha_consulta: string;
  fecha_vuelo: string;
  precio: number;
  origen: string;
  tipo_vuelo: 'ida' | 'vuelta';
  ruta: string;
}


/**
 * Inserta un nuevo precio de vuelo (ida o vuelta)
 */
export function insertarPrecio(params: InsertFlightPriceParams): void {
  const stmt = db.prepare(`
    INSERT INTO flight_prices (fecha_consulta, fecha_vuelo, precio, origen, tipo_vuelo, ruta)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(
    params.fecha_consulta,
    params.fecha_vuelo,
    params.precio,
    params.origen,
    params.tipo_vuelo,
    params.ruta
  );
  
  console.log(`[DB] Precio insertado: ${params.tipo_vuelo} ${params.fecha_vuelo} - €${params.precio}`);
}

/**
 * Consulta histórico de precios por fecha y tipo de vuelo
 */
export function consultarPrecioPorFecha(
  fechaVuelo: string, 
  tipoVuelo: 'ida' | 'vuelta',
  ruta: string,
  limit: number = 30
): FlightPrice[] {  
  const stmt = db.prepare(`
    SELECT * FROM flight_prices 
    WHERE fecha_vuelo = ? AND tipo_vuelo = ? AND ruta = ?
    ORDER BY fecha_consulta DESC 
    LIMIT ?
  `);
  
  const results = stmt.all(fechaVuelo, tipoVuelo, ruta, limit) as FlightPrice[];
  console.log(`[DB] Consultado histórico: ${results.length} registros para ${tipoVuelo} ${fechaVuelo}`);
  
  return results;
}

/**
 * Consulta todos los precios de un vuelo completo (ida + vuelta) para una fecha específica
 */
export function consultarVueloCompleto(
  fechaIda: string,
  fechaVuelta: string,
  rutaIda: string,
  rutaVuelta: string,
  limit: number = 30
): {
  ida: FlightPrice[];
  vuelta: FlightPrice[];
} {
  const ida = consultarPrecioPorFecha(fechaIda, 'ida', rutaIda, limit);
  const vuelta = consultarPrecioPorFecha(fechaVuelta, 'vuelta', rutaVuelta, limit);
  
  return { ida, vuelta };
}

export function obtenerUltimosPreciosPorRuta(ruta: string): {
  ida: FlightPrice | null;
  vuelta: FlightPrice | null;
} {
  const stmtIda = db.prepare(`
    SELECT * FROM flight_prices 
    WHERE tipo_vuelo = 'ida' AND ruta = ?
    ORDER BY fecha_consulta DESC 
    LIMIT 1
  `);
  
  const stmtVuelta = db.prepare(`
    SELECT * FROM flight_prices 
    WHERE tipo_vuelo = 'vuelta' AND ruta = ?
    ORDER BY fecha_consulta DESC 
    LIMIT 1
  `);
  
  const ida = stmtIda.get(ruta) as FlightPrice | null;
  const vuelta = stmtVuelta.get(ruta) as FlightPrice | null;
  
  return { ida, vuelta };
}

export function obtenerEstadisticasPrecios(
  fechaVuelo: string,
  tipoVuelo: 'ida' | 'vuelta',
  ruta: string,
  dias: number = 30
): {
  promedio: number;
  minimo: number;
  maximo: number;
  count: number;
} | null {  
  const fechaLimite = new Date();
  fechaLimite.setDate(fechaLimite.getDate() - dias);
  const fechaLimiteStr = fechaLimite.toISOString();
  
  const stmt = db.prepare(`
    SELECT 
      AVG(precio) as promedio,
      MIN(precio) as minimo,
      MAX(precio) as maximo,
      COUNT(*) as count
    FROM flight_prices 
    WHERE fecha_vuelo = ? AND tipo_vuelo = ? AND ruta = ?
    AND fecha_consulta >= ?
  `);
  
  const result = stmt.get(fechaVuelo, tipoVuelo, ruta, fechaLimiteStr) as any;
  
  if (result && result.count > 0) {
    return {
      promedio: parseFloat(result.promedio),
      minimo: parseFloat(result.minimo),
      maximo: parseFloat(result.maximo),
      count: parseInt(result.count)
    };
  }
  
  return null;
}


export function obtenerEvolucionPrecios(
  fechaVuelo: string,
  tipoVuelo: 'ida' | 'vuelta',
  ruta: string,
  dias: number = 7
): FlightPrice[] {  
  const stmt = db.prepare(`
    SELECT DISTINCT 
      DATE(fecha_consulta) as fecha_dia,
      MIN(precio) as precio_minimo_dia,
      fecha_vuelo,
      tipo_vuelo,
      ruta
    FROM flight_prices 
    WHERE fecha_vuelo = ? AND tipo_vuelo = ? AND ruta = ?
    GROUP BY DATE(fecha_consulta)
    ORDER BY fecha_dia DESC 
    LIMIT ?
  `);
  
  const results = stmt.all(fechaVuelo, tipoVuelo, ruta, dias);
  
  return results.map(row => ({
    id: 0, // No relevante para este caso
    //@ts-ignore
    fecha_consulta: row.fecha_dia,
    //@ts-ignore
    fecha_vuelo: row.fecha_vuelo,
    //@ts-ignore
    precio: row.precio_minimo_dia,
    origen: '',
    //@ts-ignore
    tipo_vuelo: row.tipo_vuelo,
    //@ts-ignore
    ruta: row.ruta
  })) as FlightPrice[];
}


/**
 * Consulta el precio más bajo en un rango de fechas de vuelo (inclusive).
 * Devuelve el registro completo con el precio mínimo.
 */
export function limpiarRegistrosAntiguos(diasAMantener: number = 90): number {
  
  const fechaLimite = new Date();
  fechaLimite.setDate(fechaLimite.getDate() - diasAMantener);
  const fechaLimiteStr = fechaLimite.toISOString();
  
  const stmt = db.prepare(`
    DELETE FROM flight_prices 
    WHERE fecha_consulta < ?
  `);
  
  const result = stmt.run(fechaLimiteStr);
  console.log(`[DB] Eliminados ${result.changes} registros antiguos`);
  
  return result.changes || 0;
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