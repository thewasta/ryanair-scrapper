/**
 * priceRules.ts
 * Lógica de reglas para notificaciones de precios.
 */

export interface PriceHistory {
  current: number;
  yesterday: number;
  lastWeek: number[]; // Array de precios de los últimos 7 días, excluyendo el actual
}

export interface NotificationResult {
  shouldNotify: boolean;
  message: string | null;
  reason: 'PRICE_DROP' | 'UNDER_100' | 'WEEK_LOW' | null;
}

/**
 * Determina si se debe notificar y genera el mensaje adecuado según las reglas.
 */
export function evaluatePriceRules(history: PriceHistory): NotificationResult {
  // Regla 1: Notificar si el precio ha bajado respecto a ayer.
  if (history.current < history.yesterday) {
    return {
      shouldNotify: true,
      message: `¡El precio ha bajado respecto a ayer! Ahora está en ${history.current.toFixed(2)}€. Antes: ${history.yesterday.toFixed(2)}€.`,
      reason: 'PRICE_DROP',
    };
  }

  // Regla 2: Notificar si el precio está por debajo de 100€.
  if (history.current < 100) {
    return {
      shouldNotify: true,
      message: `¡El precio está por debajo de 100€! Precio actual: ${history.current.toFixed(2)}€.`,
      reason: 'UNDER_100',
    };
  }

  // Regla 3: Notificar si es el precio más bajo de la última semana.
  const minLastWeek = Math.min(...history.lastWeek, history.yesterday);
  if (history.current < minLastWeek) {
    return {
      shouldNotify: true,
      message: `¡Nuevo precio mínimo de la semana! Ahora: ${history.current.toFixed(2)}€. Mínimo anterior: ${minLastWeek.toFixed(2)}€.`,
      reason: 'WEEK_LOW',
    };
  }

  // No cumple ninguna regla
  return {
    shouldNotify: false,
    message: null,
    reason: null,
  };
}