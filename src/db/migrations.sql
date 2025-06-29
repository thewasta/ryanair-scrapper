CREATE TABLE IF NOT EXISTS flight_prices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha_consulta TEXT NOT NULL,
  fecha_vuelo TEXT NOT NULL,
  precio REAL NOT NULL,
  origen TEXT
);

CREATE INDEX IF NOT EXISTS idx_flight_fecha_vuelo ON flight_prices (fecha_vuelo);
CREATE INDEX IF NOT EXISTS idx_flight_fecha_consulta ON flight_prices (fecha_consulta);

-- Tabla de usuarios para notificaciones
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id INTEGER NOT NULL UNIQUE,
  chat_title TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_chat_id ON users (chat_id);