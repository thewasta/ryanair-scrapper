// notifier/priceRules.ts - Reglas actualizadas para ida y vuelta

export interface PriceHistory {
  current: number;
  yesterday: number;
  lastWeek: number[];
}

export interface PriceEvaluation {
  shouldNotify: boolean;
  message?: string;
  priority: 'low' | 'medium' | 'high';
  reason: string;
}

/**
 * Evalúa las reglas de precio para un tramo específico (ida o vuelta)
 */
export function evaluatePriceRules(history: PriceHistory): PriceEvaluation {
  const { current, yesterday, lastWeek } = history;
  
  // Validaciones básicas
  if (!current || current <= 0) {
    return {
      shouldNotify: false,
      priority: 'low',
      reason: 'Precio actual inválido'
    };
  }

  // Calcular métricas
  const changeFromYesterday = current - yesterday;
  const percentChangeFromYesterday = yesterday > 0 ? (changeFromYesterday / yesterday) * 100 : 0;
  
  const weekAverage = lastWeek.length > 0 ? 
    lastWeek.reduce((sum, price) => sum + price, 0) / lastWeek.length : current;
  const changeFromWeekAverage = current - weekAverage;
  const percentChangeFromWeekAverage = weekAverage > 0 ? (changeFromWeekAverage / weekAverage) * 100 : 0;
  
  const weekMin = lastWeek.length > 0 ? Math.min(...lastWeek) : current;
  const weekMax = lastWeek.length > 0 ? Math.max(...lastWeek) : current;

  // REGLA 1: Caída significativa de precio (ALTA PRIORIDAD)
  if (percentChangeFromYesterday <= -10 || changeFromYesterday <= -15) {
    return {
      shouldNotify: true,
      priority: 'high',
      reason: 'Caída significativa de precio',
      message: `🎉 ¡PRECIO EN CAÍDA!\n\n` +
        `💰 Precio actual: €${current.toFixed(2)}\n` +
        `📉 Ayer: €${yesterday.toFixed(2)}\n` +
        `📊 Cambio: €${changeFromYesterday.toFixed(2)} (${percentChangeFromYesterday.toFixed(1)}%)\n\n` +
        `🔥 ¡Es un buen momento para comprar!`
    };
  }

  // REGLA 2: Nuevo mínimo semanal (ALTA PRIORIDAD)
  if (current < weekMin && lastWeek.length >= 5) {
    const savingsFromPreviousMin = weekMin - current;
    return {
      shouldNotify: true,
      priority: 'high',
      reason: 'Nuevo mínimo semanal',
      message: `🏆 ¡NUEVO MÍNIMO DE LA SEMANA!\n\n` +
        `💰 Precio actual: €${current.toFixed(2)}\n` +
        `📈 Mínimo anterior: €${weekMin.toFixed(2)}\n` +
        `💡 Ahorro: €${savingsFromPreviousMin.toFixed(2)}\n\n` +
        `⚡ ¡Mejor precio de los últimos 7 días!`
    };
  }

  // REGLA 3: Muy por debajo del promedio semanal (MEDIA PRIORIDAD)
  if (percentChangeFromWeekAverage <= -8 && changeFromWeekAverage <= -12) {
    return {
      shouldNotify: true,
      priority: 'medium',
      reason: 'Precio por debajo del promedio semanal',
      message: `📊 PRECIO POR DEBAJO DEL PROMEDIO\n\n` +
        `💰 Precio actual: €${current.toFixed(2)}\n` +
        `📈 Promedio semanal: €${weekAverage.toFixed(2)}\n` +
        `📉 Diferencia: €${changeFromWeekAverage.toFixed(2)} (${percentChangeFromWeekAverage.toFixed(1)}%)\n\n` +
        `👍 Buen momento para considerar la compra`
    };
  }

  // REGLA 4: Subida significativa de precio (MEDIA PRIORIDAD)
  if (percentChangeFromYesterday >= 15 || changeFromYesterday >= 20) {
    return {
      shouldNotify: true,
      priority: 'medium',
      reason: 'Subida significativa de precio',
      message: `📈 ALERTA: PRECIO EN SUBIDA\n\n` +
        `💰 Precio actual: €${current.toFixed(2)}\n` +
        `📊 Ayer: €${yesterday.toFixed(2)}\n` +
        `📈 Cambio: +€${changeFromYesterday.toFixed(2)} (+${percentChangeFromYesterday.toFixed(1)}%)\n\n` +
        `⚠️ Los precios están aumentando`
    };
  }

  // REGLA 5: Precio muy volátil (BAJA PRIORIDAD)
  if (lastWeek.length >= 5) {
    const volatility = ((weekMax - weekMin) / weekAverage) * 100;
    if (volatility > 25 && Math.abs(percentChangeFromYesterday) >= 5) {
      return {
        shouldNotify: true,
        priority: 'low',
        reason: 'Alta volatilidad de precios',
        message: `📊 MERCADO VOLÁTIL\n\n` +
          `💰 Precio actual: €${current.toFixed(2)}\n` +
          `📈 Rango semanal: €${weekMin.toFixed(2)} - €${weekMax.toFixed(2)}\n` +
          `📊 Volatilidad: ${volatility.toFixed(1)}%\n\n` +
          `🎯 Monitorea de cerca para mejores oportunidades`
      };
    }
  }

  // REGLA 6: Precio estable pero informativo (fines de semana o días específicos)
  const today = new Date();
  const isDayForUpdate = today.getDay() === 0 || today.getDay() === 3; // Domingo o Miércoles
  
  if (isDayForUpdate && Math.abs(percentChangeFromYesterday) < 2) {
    return {
      shouldNotify: true,
      priority: 'low',
      reason: 'Actualización informativa',
      message: `ℹ️ ACTUALIZACIÓN DE PRECIOS\n\n` +
        `💰 Precio actual: €${current.toFixed(2)}\n` +
        `📊 Cambio 24h: €${changeFromYesterday.toFixed(2)} (${percentChangeFromYesterday.toFixed(1)}%)\n` +
        `📈 Promedio semanal: €${weekAverage.toFixed(2)}\n\n` +
        `📋 Precio estable - sin cambios significativos`
    };
  }

  // No hay razón para notificar
  return {
    shouldNotify: false,
    priority: 'low',
    reason: 'Sin cambios significativos'
  };
}

/**
 * Evalúa reglas específicas para el precio total de ida y vuelta
 */
export function evaluateRoundTripRules(
  outboundHistory: PriceHistory,
  returnHistory: PriceHistory
): PriceEvaluation {
  const totalCurrent = outboundHistory.current + returnHistory.current;
  const totalYesterday = outboundHistory.yesterday + returnHistory.yesterday;
  const totalChange = totalCurrent - totalYesterday;
  const totalPercentChange = totalYesterday > 0 ? (totalChange / totalYesterday) * 100 : 0;

  // Calcular promedio semanal total
  const outboundWeekAvg = outboundHistory.lastWeek.length > 0 ? 
    outboundHistory.lastWeek.reduce((sum, price) => sum + price, 0) / outboundHistory.lastWeek.length : 
    outboundHistory.current;
  
  const returnWeekAvg = returnHistory.lastWeek.length > 0 ? 
    returnHistory.lastWeek.reduce((sum, price) => sum + price, 0) / returnHistory.lastWeek.length : 
    returnHistory.current;
  
  const totalWeekAvg = outboundWeekAvg + returnWeekAvg;
  const totalChangeFromAvg = totalCurrent - totalWeekAvg;
  const totalPercentChangeFromAvg = totalWeekAvg > 0 ? (totalChangeFromAvg / totalWeekAvg) * 100 : 0;

  // REGLA ESPECIAL: Gran ahorro en precio total
  if (totalPercentChange <= -8 || totalChange <= -25) {
    return {
      shouldNotify: true,
      priority: 'high',
      reason: 'Gran ahorro en precio total',
      message: `🎊 ¡GRAN OPORTUNIDAD - PRECIO TOTAL BAJO!\n\n` +
        `✈️ VIAJE COMPLETO (IDA + VUELTA)\n` +
        `💰 Precio total: €${totalCurrent.toFixed(2)}\n` +
        `📉 Ayer: €${totalYesterday.toFixed(2)}\n` +
        `💡 Ahorro: €${Math.abs(totalChange).toFixed(2)} (${Math.abs(totalPercentChange).toFixed(1)}%)\n\n` +
        `🔥 ¡Excelente momento para reservar el viaje completo!`
    };
  }

  // REGLA ESPECIAL: Precio total muy por debajo del promedio
  if (totalPercentChangeFromAvg <= -10) {
    return {
      shouldNotify: true,
      priority: 'medium',
      reason: 'Precio total por debajo del promedio',
      message: `📊 VIAJE COMPLETO - PRECIO ATRACTIVO\n\n` +
        `✈️ PRECIO TOTAL (IDA + VUELTA)\n` +
        `💰 Actual: €${totalCurrent.toFixed(2)}\n` +
        `📈 Promedio semanal: €${totalWeekAvg.toFixed(2)}\n` +
        `💡 Ahorro vs promedio: €${Math.abs(totalChangeFromAvg).toFixed(2)}\n\n` +
        `👍 Buen precio para el viaje completo`
    };
  }

  return {
    shouldNotify: false,
    priority: 'low',
    reason: 'Precio total sin cambios significativos'
  };
}

/**
 * Función helper para determinar el mejor momento para comprar
 */
export function getBuyingRecommendation(
  outboundHistory: PriceHistory,
  returnHistory: PriceHistory
): {
  recommendation: 'buy_now' | 'wait' | 'monitor';
  confidence: number; // 0-100
  message: string;
} {
  const outboundEval = evaluatePriceRules(outboundHistory);
  const returnEval = evaluatePriceRules(returnHistory);
  const totalEval = evaluateRoundTripRules(outboundHistory, returnHistory);

  let score = 0;
  let reasons: string[] = [];

  // Evaluar factores positivos para comprar
  if (outboundEval.priority === 'high' && outboundEval.shouldNotify) {
    score += 30;
    reasons.push('Excelente precio de ida');
  }
  
  if (returnEval.priority === 'high' && returnEval.shouldNotify) {
    score += 30;
    reasons.push('Excelente precio de vuelta');
  }
  
  if (totalEval.priority === 'high' && totalEval.shouldNotify) {
    score += 40;
    reasons.push('Gran ahorro en precio total');
  }

  // Determinar recomendación
  if (score >= 60) {
    return {
      recommendation: 'buy_now',
      confidence: Math.min(score, 100),
      message: `🎯 RECOMENDACIÓN: ¡COMPRA AHORA!\n\nConfianza: ${Math.min(score, 100)}%\nMotivos: ${reasons.join(', ')}`
    };
  } else if (score >= 30) {
    return {
      recommendation: 'monitor',
      confidence: score,
      message: `👀 RECOMENDACIÓN: MONITOREAR DE CERCA\n\nConfianza: ${score}%\nBuen momento pero puede mejorar`
    };
  } else {
    return {
      recommendation: 'wait',
      confidence: 100 - score,
      message: `⏳ RECOMENDACIÓN: ESPERAR\n\nLos precios pueden bajar más`
    };
  }
}