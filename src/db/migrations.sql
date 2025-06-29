-- Tabla actualizada para manejar vuelos de ida y vuelta
CREATE TABLE IF NOT EXISTS flight_prices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha_consulta TEXT NOT NULL,
  fecha_vuelo TEXT NOT NULL,
  precio REAL NOT NULL,
  origen TEXT NOT NULL,
  tipo_vuelo TEXT NOT NULL CHECK (tipo_vuelo IN ('ida', 'vuelta')), -- Nuevo campo
  ruta TEXT NOT NULL -- Ejemplo: 'ALC-KRK' o 'KRK-ALC'
);

-- Índices actualizados
CREATE INDEX IF NOT EXISTS idx_flight_fecha_vuelo ON flight_prices (fecha_vuelo);
CREATE INDEX IF NOT EXISTS idx_flight_fecha_consulta ON flight_prices (fecha_consulta);
CREATE INDEX IF NOT EXISTS idx_flight_tipo_vuelo ON flight_prices (tipo_vuelo);
CREATE INDEX IF NOT EXISTS idx_flight_ruta ON flight_prices (ruta);

-- Índice compuesto para consultas eficientes
CREATE INDEX IF NOT EXISTS idx_flight_complete ON flight_prices (fecha_vuelo, tipo_vuelo, ruta);
-- Tabla de usuarios para notificaciones
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id INTEGER NOT NULL UNIQUE,
  chat_title TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_chat_id ON users (chat_id);